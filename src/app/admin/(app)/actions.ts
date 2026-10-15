"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { EVENT_FIELDS, parseEventForm } from "@/lib/admin/event-schema";
import { EVENTS_TAG } from "@/lib/events";
import { createSessionClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// `values` echoes the submission back: React resets the form after an action, so without it a
// validation error would wipe everything that was typed. `attempt` remounts the fields with them.
export type EventFormState = {
  errors?: Record<string, string>;
  message?: string;
  values?: Record<string, string>;
  attempt?: number;
};

const COVER_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const COVER_MAX_BYTES = 5 * 1024 * 1024;

export async function saveEvent(prev: EventFormState, formData: FormData): Promise<EventFormState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "") || null;
  const raw: Record<string, string> = Object.fromEntries(EVENT_FIELDS.map((k) => [k, String(formData.get(k) ?? "")]));
  raw.is_paid = formData.get("is_paid") === "on" ? "on" : "";
  const fail = (s: Pick<EventFormState, "errors" | "message">): EventFormState => ({
    ...s,
    values: raw,
    attempt: (prev.attempt ?? 0) + 1,
  });

  const parsed = parseEventForm(raw);
  if (!parsed.ok) return fail({ errors: parsed.errors });

  const supabase = await createSessionClient();
  const values: Record<string, unknown> = { ...parsed.data };

  const cover = formData.get("cover");
  if (cover instanceof File && cover.size > 0) {
    const ext = COVER_TYPES[cover.type];
    if (!ext) return fail({ errors: { cover: "Підходять JPG, PNG або WebP" } });
    if (cover.size > COVER_MAX_BYTES) return fail({ errors: { cover: "Файл більший за 5 МБ" } });
    const path = `${parsed.data.slug}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("event-covers").upload(path, cover, { contentType: cover.type });
    if (error) return fail({ message: `Не вдалося завантажити обкладинку: ${error.message}` });
    values.cover_image_path = path;
  } else if (formData.get("remove_cover") === "on") {
    values.cover_image_path = null;
  }

  const { error } = id
    ? await supabase.from("events").update(values).eq("id", id)
    : await supabase.from("events").insert(values);
  if (error?.code === "23505") return fail({ errors: { slug: "Така адреса вже зайнята іншою подією" } });
  if (error) return fail({ message: `Не вдалося зберегти: ${error.message}` });

  updateTag(EVENTS_TAG);
  redirect("/admin");
}

const registrationErrors: Record<string, string> = {
  not_awaiting_payment: "Ця реєстрація не очікує оплати.",
  no_seats_left: "Вільних місць уже немає — бронь прострочена, а місце зайняли.",
  registration_not_found: "Реєстрацію не знайдено.",
};

export type RowActionState = { error?: string };

export async function markPaid(_prev: RowActionState, formData: FormData): Promise<RowActionState> {
  await requireAdmin();
  const supabase = await createSessionClient();
  const { error } = await supabase.rpc("mark_registration_paid", {
    p_registration_id: String(formData.get("registration_id")),
  });
  if (error) return { error: registrationErrors[error.message] ?? error.message };
  // TODO(phase 4): email the participant their confirmation.
  updateTag(EVENTS_TAG);
  refresh();
  return {};
}

export async function cancelRegistration(_prev: RowActionState, formData: FormData): Promise<RowActionState> {
  await requireAdmin();
  const { data: reg, error: readError } = await (await createSessionClient())
    .from("registrations")
    .select("cancel_token")
    .eq("id", String(formData.get("registration_id")))
    .single();
  if (readError) return { error: registrationErrors.registration_not_found };
  // cancel_registration is service-role only (participants cancel via their emailed token); the
  // admin check above authorises this call.
  const { error } = await createServiceClient().rpc("cancel_registration", { p_cancel_token: reg.cancel_token });
  if (error) return { error: error.message };
  // TODO(phase 4): email whoever was promoted off the waitlist.
  updateTag(EVENTS_TAG);
  refresh();
  return {};
}
