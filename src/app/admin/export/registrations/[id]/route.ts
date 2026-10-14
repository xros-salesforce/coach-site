import { csvResponse, toCsv } from "@/lib/admin/csv";
import { getEvent, listRegistrations } from "@/lib/admin/data";
import { registrationStatus } from "@/lib/admin/labels";
import { formatDateTime } from "@/lib/format";

export async function GET(_request: Request, ctx: RouteContext<"/admin/export/registrations/[id]">) {
  const { id } = await ctx.params;
  const [event, registrations] = await Promise.all([getEvent(id), listRegistrations(id)]);
  if (!event) return new Response("Not found", { status: 404 });

  const csv = toCsv(
    ["Ім'я", "Email", "Телефон", "Instagram", "Статус", "Сума, грн", "Оплачено", "Коментар", "Зареєструвалась"],
    registrations.map((r) => [
      r.contact.full_name,
      r.contact.email,
      r.contact.phone,
      r.contact.instagram_handle,
      registrationStatus[r.status].label,
      r.amount_uah,
      r.paid_at && formatDateTime(r.paid_at),
      r.comment,
      formatDateTime(r.created_at),
    ]),
  );
  return csvResponse(`uchasnytsi-${event.slug}.csv`, csv);
}
