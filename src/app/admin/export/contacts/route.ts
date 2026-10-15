import type { NextRequest } from "next/server";
import { csvResponse, toCsv } from "@/lib/admin/csv";
import { listContacts } from "@/lib/admin/data";
import { contactFilters } from "@/lib/admin/filters";
import { contactSource } from "@/lib/admin/labels";
import { formatDateTime } from "@/lib/format";

// Exports the same filtered list the contacts page shows.
export async function GET(request: NextRequest) {
  const contacts = await listContacts(contactFilters(request.nextUrl.searchParams));
  const csv = toCsv(
    ["Ім'я", "Email", "Телефон", "Instagram", "Інтереси", "Згода на розсилку", "Відписалась", "Реєстрацій", "Джерело", "Нотатки", "Додано"],
    contacts.map((c) => [
      c.full_name,
      c.email,
      c.phone,
      c.instagram_handle,
      c.interests.join(", "),
      c.marketing_consent_at && formatDateTime(c.marketing_consent_at),
      c.unsubscribed_at && formatDateTime(c.unsubscribed_at),
      c.registrations[0]?.count ?? 0,
      contactSource[c.source],
      c.notes,
      formatDateTime(c.created_at),
    ]),
  );
  return csvResponse("kontakty.csv", csv);
}
