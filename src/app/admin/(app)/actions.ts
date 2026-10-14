"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { EVENTS_TAG } from "@/lib/events";
import { fromKyivInput } from "@/lib/kyiv-time";
import { slugify } from "@/lib/slug";
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

const EVENT_FIELDS = [
  "title", "slug", "description", "event_type_id", "starts_at", "ends_at", "location", "online_url",
  "capacity", "price_uah", "payment_instructions", "status",
] as const;

const optionalText = z.string().trim().transform((v) => v || null);

const eventSchema = z
  .object({
    title: z.string().trim().min(3, "Вкажіть назву (від 3 символів)"),
    slug: z.string().trim(),
    description: z.string().trim(),
    event_type_id: z.uuid("Оберіть тип події"),
    starts_at: z.string().transform((v, ctx) => fromKyivInput(v) ?? (ctx.addIssue({ code: "custom", message: "Вкажіть дату й час початку" }), z.NEVER)),
    ends_at: z.string().transform((v) => (v ? fromKyivInput(v) : null)),
    location: optionalText,
    online_url: optionalText.pipe(z.url("Посилання має починатися з https://").nullable()),
    capacity: z.coerce.number().int("Ціле число").min(1, "Хоча б 1 місце").max(10000),
    is_paid: z.boolean(),
    price_uah: z.string().trim(),
    payment_instructions: optionalText,
    status: z.enum(["draft", "published", "cancelled"]),
  })
  .transform((v, ctx) => {
    const slug = slugify(v.slug || v.title);
    if (!slug) ctx.addIssue({ code: "custom", path: ["slug"], message: "Адреса має містити літери або цифри" });
    if (v.ends_at && v.ends_at <= v.starts_at) {
      ctx.addIssue({ code: "custom", path: ["ends_at"], message: "Кінець має бути пізніше за початок" });
    }
    const price = v.is_paid ? Number(v.price_uah.replace(",", ".")) : null;
    if (v.is_paid && !(price! > 0)) ctx.addIssue({ code: "custom", path: ["price_uah"], message: "Вкажіть ціну в гривнях" });
    return { ...v, slug, price_uah: price, payment_instructions: v.is_paid ? v.payment_instructions : null };
  });

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

  const parsed = eventSchema.safeParse({ ...raw, is_paid: raw.is_paid === "on" });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return fail({ errors });
  }

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
