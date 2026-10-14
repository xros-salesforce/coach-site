import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { listEvents } from "@/lib/admin/data";
import { eventStatus } from "@/lib/admin/labels";
import { formatDateTime, formatPrice } from "@/lib/format";

// Admin data is always fetched fresh, so navigation waits for it; instant navigation isn't a goal here.
export const instant = false;

export default async function AdminEventsPage() {
  const events = await listEvents();
  const now = new Date().toISOString();
  const upcoming = events.filter((e) => e.starts_at >= now).reverse();
  const past = events.filter((e) => e.starts_at < now);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-3xl font-semibold">Події</h1>
        <Link href="/admin/events/new" className={buttonVariants()}>
          <Plus />
          Нова подія
        </Link>
      </div>
      <EventTable title="Майбутні" events={upcoming} empty="Майбутніх подій немає. Створіть першу!" />
      {past.length > 0 && <EventTable title="Минулі" events={past} />}
    </div>
  );
}

function EventTable({ title, events, empty }: { title: string; events: Awaited<ReturnType<typeof listEvents>>; empty?: string }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
      {events.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-muted-foreground">{empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Подія</th>
                <th className="p-3 font-medium">Коли</th>
                <th className="p-3 font-medium">Статус</th>
                <th className="p-3 text-right font-medium">Місця</th>
                <th className="p-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {events.map((e) => {
                const taken = e.counts.confirmed + e.counts.pending_payment;
                return (
                  <tr key={e.id} className="align-top">
                    <td className="p-3">
                      <Link href={`/admin/events/${e.id}`} className="font-medium hover:underline">
                        {e.title}
                      </Link>
                      <div className="text-muted-foreground">
                        {e.type_name} · {formatPrice(e.price_uah)}
                      </div>
                    </td>
                    <td className="whitespace-nowrap p-3">{formatDateTime(e.starts_at)}</td>
                    <td className="p-3">
                      <Badge variant={eventStatus[e.status].variant}>{eventStatus[e.status].label}</Badge>
                    </td>
                    <td className="whitespace-nowrap p-3 text-right tabular-nums">
                      {taken} / {e.capacity}
                      {e.counts.pending_payment > 0 && (
                        <div className="text-xs text-muted-foreground">{e.counts.pending_payment} чекають оплати</div>
                      )}
                      {e.counts.waitlist > 0 && <div className="text-xs text-muted-foreground">+{e.counts.waitlist} в листі</div>}
                    </td>
                    <td className="whitespace-nowrap p-3 text-right">
                      <Link href={`/admin/events/${e.id}/registrations`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                        Учасниці
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
