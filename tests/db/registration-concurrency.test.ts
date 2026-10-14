// Integration test against local Supabase (`npx supabase start`). Each RPC is a separate HTTP
// request, so PostgREST runs them on separate DB connections and they genuinely race.
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: the suite is skipped below.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const run = `t${Date.now()}`;

describe.skipIf(!url || !serviceKey)("register_for_event under concurrency", () => {
  const db = createClient(url!, serviceKey!, { auth: { persistSession: false } });
  const eventIds: string[] = [];

  async function createEvent(capacity: number, isPaid = false) {
    const { data: type, error: typeError } = await db
      .from("event_types").select("id").eq("code", "training").single();
    if (typeError) throw typeError;
    const { data, error } = await db.from("events").insert({
      slug: `${run}-${eventIds.length}`,
      title: "Concurrency test",
      event_type_id: type.id,
      starts_at: new Date(Date.now() + 7 * 864e5).toISOString(),
      capacity,
      is_paid: isPaid,
      price_uah: isPaid ? 500 : null,
      status: "published",
    }).select("id").single();
    if (error) throw error;
    eventIds.push(data.id);
    return data.id as string;
  }

  function register(eventId: string, email: string) {
    return db.rpc("register_for_event", {
      p_event_id: eventId,
      p_full_name: "Test Person",
      p_email: email,
      p_phone: null,
      p_instagram_handle: null,
      p_comment: null,
      p_marketing_consent: false,
    });
  }

  beforeAll(async () => {
    const { error } = await db.from("events").select("id").limit(1);
    if (error) throw new Error(`Local Supabase not reachable: ${error.message}`);
  });

  afterAll(async () => {
    if (eventIds.length) await db.from("events").delete().in("id", eventIds);
    await db.from("contacts").delete().like("email", `${run}-%`);
  });

  it("never gives out more seats than capacity (free event)", async () => {
    const eventId = await createEvent(3);
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => register(eventId, `${run}-free-${i}@example.com`)),
    );

    expect(results.map((r) => r.error)).toEqual(Array(20).fill(null));
    const statuses = results.map((r) => r.data![0].status);
    expect(statuses.filter((s) => s === "confirmed")).toHaveLength(3);
    expect(statuses.filter((s) => s === "waitlist")).toHaveLength(17);

    const { data: left } = await db.rpc("seats_left", { p_event_id: eventId });
    expect(left).toBe(0);
  });

  it("holds exactly capacity seats for a paid event", async () => {
    const eventId = await createEvent(2, true);
    const results = await Promise.all(
      Array.from({ length: 15 }, (_, i) => register(eventId, `${run}-paid-${i}@example.com`)),
    );

    const statuses = results.map((r) => r.data![0].status);
    expect(statuses.filter((s) => s === "pending_payment")).toHaveLength(2);
    expect(statuses.filter((s) => s === "waitlist")).toHaveLength(13);

    const { count } = await db.from("payments").select("id", { count: "exact", head: true })
      .in("registration_id", results.map((r) => r.data![0].registration_id));
    expect(count).toBe(2);
  });

  it("registers the same email only once when submitted in parallel", async () => {
    const eventId = await createEvent(5);
    const results = await Promise.all(
      Array.from({ length: 10 }, () => register(eventId, `${run}-dup@example.com`)),
    );

    expect(results.filter((r) => !r.error)).toHaveLength(1);
    for (const r of results.filter((r) => r.error)) {
      expect(r.error!.message).toBe("already_registered");
    }
    const { count } = await db.from("registrations").select("id", { count: "exact", head: true })
      .eq("event_id", eventId);
    expect(count).toBe(1);
  });
});
