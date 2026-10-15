import type { Metadata } from "next";
import { Download, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listContacts, listEventTypes } from "@/lib/admin/data";
import { contactFilters } from "@/lib/admin/filters";
import { contactSource } from "@/lib/admin/labels";
import { formatShortDate } from "@/lib/format";

// Admin data is always fetched fresh, so navigation waits for it; instant navigation isn't a goal here.
export const instant = false;

export const metadata: Metadata = { title: "Контакти" };

export default async function ContactsPage(props: PageProps<"/admin/contacts">) {
  const filters = contactFilters(await props.searchParams);
  const [contacts, eventTypes] = await Promise.all([listContacts(filters), listEventTypes()]);
  const typeName = Object.fromEntries(eventTypes.map((t) => [t.code, t.name]));
  const exportQuery = new URLSearchParams(
    Object.entries({ q: filters.q, interest: filters.interest, consent: filters.consent ? "1" : undefined }).filter(
      (e): e is [string, string] => !!e[1],
    ),
  ).toString();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-3xl font-semibold">
          Контакти <span className="text-muted-foreground">({contacts.length})</span>
        </h1>
        <a href={`/admin/export/contacts${exportQuery ? `?${exportQuery}` : ""}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          <Download />
          CSV
        </a>
      </div>

      <form className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
        <Input name="q" defaultValue={filters.q} placeholder="Ім'я, email або телефон" className="h-9 max-w-xs" />
        <select
          name="interest"
          defaultValue={filters.interest ?? ""}
          className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          aria-label="Інтерес"
        >
          <option value="">Усі інтереси</option>
          {eventTypes.map((t) => (
            <option key={t.code} value={t.code}>
              {t.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="consent" value="1" defaultChecked={filters.consent} className="size-4 accent-primary" />
          Лише з дозволом на розсилку
        </label>
        <Button type="submit" size="sm" variant="secondary">
          <Search />
          Знайти
        </Button>
      </form>

      {contacts.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-muted-foreground">Нікого не знайдено.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Ім&apos;я</th>
                <th className="p-3 font-medium">Контакти</th>
                <th className="p-3 font-medium">Інтереси</th>
                <th className="p-3 font-medium">Розсилка</th>
                <th className="p-3 text-right font-medium">Реєстрацій</th>
                <th className="p-3 font-medium">Звідки</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {contacts.map((c) => (
                <tr key={c.id} className="align-top">
                  <td className="p-3 font-medium">{c.full_name}</td>
                  <td className="p-3">
                    <a href={`mailto:${c.email}`} className="block hover:underline">
                      {c.email}
                    </a>
                    {c.phone && <span className="block text-muted-foreground">{c.phone}</span>}
                    {c.instagram_handle && <span className="block text-muted-foreground">@{c.instagram_handle.replace(/^@/, "")}</span>}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {c.interests.map((i) => (
                        <Badge key={i} variant="secondary">
                          {typeName[i] ?? i}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="p-3">
                    {c.unsubscribed_at ? (
                      <span className="text-muted-foreground">відписалась</span>
                    ) : c.marketing_consent_at ? (
                      "так"
                    ) : (
                      <span className="text-muted-foreground">ні</span>
                    )}
                  </td>
                  <td className="p-3 text-right tabular-nums">{c.registrations[0]?.count ?? 0}</td>
                  <td className="whitespace-nowrap p-3 text-muted-foreground">
                    {contactSource[c.source]}
                    <div className="text-xs">{formatShortDate(c.created_at)}</div>
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
