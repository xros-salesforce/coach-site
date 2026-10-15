import { z } from "zod";
import { fromKyivInput, KYIV_INPUT_FORMAT } from "@/lib/kyiv-time";
import { slugify } from "@/lib/slug";

// Validation for the admin event form. Kept out of the server-actions file so it can be unit-tested.

export const EVENT_FIELDS = [
  "title", "slug", "description", "event_type_id", "starts_at", "ends_at", "location", "online_url",
  "capacity", "price_uah", "payment_instructions", "status",
] as const;

const optionalText = z.string().trim().transform((v) => v || null);

export const MAX_PRICE_UAH = 1_000_000;

// Kyiv wall-clock time → UTC ISO, with a clear message for times skipped when clocks go forward.
function parseKyiv(v: string, missingMessage: string, ctx: z.RefinementCtx) {
  const iso = fromKyivInput(v);
  if (iso) return iso;
  ctx.addIssue({
    code: "custom",
    message: KYIV_INPUT_FORMAT.test(v)
      ? "Такого часу немає: цієї ночі годинник переводять на годину вперед. Оберіть інший час."
      : missingMessage,
  });
  return z.NEVER;
}
const kyivTime = (msg: string) => z.string().transform((v, ctx) => parseKyiv(v, msg, ctx));
const optionalKyivTime = (msg: string) => z.string().transform((v, ctx) => (v ? parseKyiv(v, msg, ctx) : null));

export const eventSchema = z
  .object({
    title: z.string().trim().min(3, "Вкажіть назву (від 3 символів)"),
    slug: z.string().trim(),
    description: z.string().trim(),
    event_type_id: z.uuid("Оберіть тип події"),
    starts_at: kyivTime("Вкажіть дату й час початку"),
    ends_at: optionalKyivTime("Перевірте дату й час кінця"),
    location: optionalText,
    online_url: optionalText.pipe(
      z.url({ protocol: /^https$/, hostname: z.regexes.domain, error: "Посилання має починатися з https://" }).nullable(),
    ),
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
    if (v.is_paid && !(Number.isFinite(price) && price! > 0)) {
      ctx.addIssue({ code: "custom", path: ["price_uah"], message: "Вкажіть ціну в гривнях" });
    } else if (price !== null && price > MAX_PRICE_UAH) {
      ctx.addIssue({ code: "custom", path: ["price_uah"], message: "Ціна завелика — перевірте суму" });
    }
    return { ...v, slug, price_uah: price, payment_instructions: v.is_paid ? v.payment_instructions : null };
  });

export type EventInput = z.output<typeof eventSchema>;

/** Validates raw form strings (is_paid is "on" when checked). Returns the row to save or per-field errors. */
export function parseEventForm(raw: Record<string, string>):
  | { ok: true; data: EventInput }
  | { ok: false; errors: Record<string, string> } {
  const parsed = eventSchema.safeParse({ ...raw, is_paid: raw.is_paid === "on" });
  if (parsed.success) return { ok: true, data: parsed.data };
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
  return { ok: false, errors };
}
