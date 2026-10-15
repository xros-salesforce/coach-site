import "server-only";
import { requireAdmin } from "@/lib/admin/auth";
import { type ContactFilters, searchTerm } from "@/lib/admin/filters";
import { createSessionClient } from "@/lib/supabase/server";

// Admin reads. Each one checks the session itself (layouts and pages render in parallel, so a
// check in the layout alone wouldn't protect page data), and RLS enforces it again in Postgres.

export type RegistrationStatus = "confirmed" | "pending_payment" | "waitlist" | "cancelled" | "expired";
export type EventStatus = "draft" | "published" | "cancelled";

export type AdminEvent = {
  id: string;
  slug: string;
  title: string;
  description: string;
  event_type_id: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  online_url: string | null;
  capacity: number;
  is_paid: boolean;
  price_uah: number | null;
  payment_instructions: string | null;
  cover_image_path: string | null;
  status: EventStatus;
};

export type EventType = { id: string; code: string; name: string; is_paid_default: boolean };

async function db() {
  await requireAdmin();
  return createSessionClient();
}

export async function listEvents() {
  const { data, error } = await (await db())
    .from("events")
    .select("*, event_types(name), registrations(status)")
    .order("starts_at", { ascending: false });
  if (error) throw error;
  return data.map(({ registrations, event_types, ...event }) => {
    const counts = { confirmed: 0, pending_payment: 0, waitlist: 0 };
    for (const r of registrations as { status: RegistrationStatus }[]) {
      if (r.status in counts) counts[r.status as keyof typeof counts]++;
    }
    return { ...(event as AdminEvent), type_name: (event_types as { name: string } | null)?.name ?? "", counts };
  });
}

export async function getEvent(id: string) {
  const { data, error } = await (await db()).from("events").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as AdminEvent | null;
}

export async function listEventTypes() {
  const { data, error } = await (await db())
    .from("event_types")
    .select("id, code, name, is_paid_default")
    .order("sort_order");
  if (error) throw error;
  return data as EventType[];
}

export type AdminRegistration = {
  id: string;
  status: RegistrationStatus;
  comment: string | null;
  amount_uah: number | null;
  hold_expires_at: string | null;
  created_at: string;
  contact: { full_name: string; email: string; phone: string | null; instagram_handle: string | null };
  paid_at: string | null;
};

export async function listRegistrations(eventId: string) {
  const { data, error } = await (await db())
    .from("registrations")
    .select(
      "id, status, comment, amount_uah, hold_expires_at, created_at, contacts(full_name, email, phone, instagram_handle), payments(status, paid_at)",
    )
    .eq("event_id", eventId)
    .order("created_at");
  if (error) throw error;
  return data.map(({ contacts, payments, ...r }) => ({
    ...r,
    contact: contacts,
    paid_at: (payments as { status: string; paid_at: string | null }[]).find((p) => p.status === "paid")?.paid_at ?? null,
  })) as unknown as AdminRegistration[];
}

export type AdminContact = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  instagram_handle: string | null;
  interests: string[];
  source: "registration" | "interest_form" | "manual";
  marketing_consent_at: string | null;
  unsubscribed_at: string | null;
  notes: string | null;
  created_at: string;
  registrations: { count: number }[];
};

export async function listContacts({ q, interest, consent }: ContactFilters) {
  let query = (await db())
    .from("contacts")
    .select("*, registrations(count)")
    .order("created_at", { ascending: false });
  const term = searchTerm(q);
  if (term) query = query.or(`full_name.ilike.*${term}*,email.ilike.*${term}*,phone.ilike.*${term}*`);
  if (interest) query = query.contains("interests", [interest]);
  if (consent) query = query.not("marketing_consent_at", "is", null).is("unsubscribed_at", null);
  const { data, error } = await query;
  if (error) throw error;
  return data as AdminContact[];
}
