import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getEvent, listRegistrations } from "@/lib/admin/data";
import { registrationStatus } from "@/lib/admin/labels";
import { formatDateTime, formatPrice } from "@/lib/format";
import { RowActions } from "./row-actions";

// Admin data is always fetched fresh, so navigation waits for it; instant navigation isn't a goal here.
export const instant = false;

export const metadata: Metadata = { title: "Учасниці" };

export default async function RegistrationsPage(props: PageProps<"/admin/events/[id]/registrations">) {
  const { id } = await props.params;
  const [event, registrations] = await Promise.all([getEvent(id), listRegistrations(id)]);
  if (!event) notFound();

  const count = (s: string) => registrations.filter((r) => r.status === s).length;
  const taken = count("confirmed") + count("pending_payment");

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
        ← Усі події
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold">{event.title}</h1>
          <p className="text-muted-foreground">
            {formatDateTime(event.starts_at)} · {formatPrice(event.price_uah)} · зайнято {taken} з {event.capacity}
            {count("pending_payment") > 0 && ` (${count("pending_payment")} чекають оплати)`}
            {count("waitlist") > 0 && ` · у листі очікування ${count("waitlist")}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/events/${id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Редагувати подію
          </Link>
          <a href={`/admin/export/registrations/${id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Download />
            CSV
          </a>
        </div>
      </div>

      {registrations.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-muted-foreground">Поки що ніхто не зареєструвався.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Учасниця</th>
                <th className="p-3 font-medium">Контакти</th>
                <th className="p-3 font-medium">Статус</th>
                <th className="p-3 font-medium">Зареєструвалась</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {registrations.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="p-3">
                    <div className="font-medium">{r.contact.full_name}</div>
                    {r.comment && <div className="mt-1 max-w-xs text-muted-foreground">«{r.comment}»</div>}
                  </td>
                  <td className="p-3">
                    <a href={`mailto:${r.contact.email}`} className="block hover:underline">
                      {r.contact.email}
                    </a>
                    {r.contact.phone && (
                      <a href={`tel:${r.contact.phone}`} className="block text-muted-foreground hover:underline">
                        {r.contact.phone}
                      </a>
                    )}
                    {r.contact.instagram_handle && (
                      <a
                        href={`https://instagram.com/${r.contact.instagram_handle.replace(/^@/, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-muted-foreground hover:underline"
                      >
                        @{r.contact.instagram_handle.replace(/^@/, "")}
                      </a>
                    )}
                  </td>
                  <td className="p-3">
                    <Badge variant={registrationStatus[r.status].variant}>{registrationStatus[r.status].label}</Badge>
                    {r.status === "pending_payment" && r.hold_expires_at && (
                      <div className="mt-1 text-xs text-muted-foreground">бронь до {formatDateTime(r.hold_expires_at)}</div>
                    )}
                    {r.paid_at && <div className="mt-1 text-xs text-muted-foreground">оплачено {formatDateTime(r.paid_at)}</div>}
                  </td>
                  <td className="whitespace-nowrap p-3 text-muted-foreground">{formatDateTime(r.created_at)}</td>
                  <td className="p-3">
                    <RowActions id={r.id} status={r.status} name={r.contact.full_name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
