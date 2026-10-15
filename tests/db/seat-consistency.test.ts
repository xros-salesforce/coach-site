// Overdue payment holds, lock ordering and promotion rules (migration 20261015100000_hold_consistency).
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, Fixture, hasDb } from "./helpers";

describe.skipIf(!hasDb)("seat consistency", () => {
  const fx = new Fixture();
  let admin: SupabaseClient;
  beforeAll(async () => {
    await fx.assertReachable();
    admin = await fx.signedInClient("seat-admin", { admin: true });
  });
  afterAll(() => fx.cleanup());

  const overdue = (registrationId: string) =>
    fx.db.from("registrations").update({ hold_expires_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", registrationId);
  const cancel = (token: string) => fx.db.rpc("cancel_registration", { p_cancel_token: token });
  const markPaid = (id: string) => admin.rpc("mark_registration_paid", { p_registration_id: id });
  const takenSeats = async (eventId: string) => {
    const { data } = await fx.db.from("registrations").select("status, hold_expires_at").eq("event_id", eventId);
    return data!.filter((r) => r.status === "confirmed" || (r.status === "pending_payment" && new Date(r.hold_expires_at) > new Date())).length;
  };

  it("an overdue hold can't be marked paid once its seat went to the waitlist", async () => {
    const event = await fx.createEvent({ capacity: 1, price: 300 });
    const late = await fx.registerOk(event.id, "late");
    const w1 = await fx.registerOk(event.id, "w1");
    const w2 = await fx.registerOk(event.id, "w2");
    await overdue(late.registration_id);

    // Any seat change sweeps overdue holds: cancelling W2 expires the late hold and promotes W1.
    await cancel(w2.cancel_token);
    expect((await fx.registration(late.registration_id)).status).toBe("expired");
    expect((await fx.registration(w1.registration_id)).status).toBe("pending_payment");

    const { error } = await markPaid(late.registration_id);
    expect(error?.message).toBe("no_seats_left");
    expect(await takenSeats(event.id)).toBe(1);
  });

  it("a late transfer is still accepted while the seat is free", async () => {
    const event = await fx.createEvent({ capacity: 1, price: 300 });
    const late = await fx.registerOk(event.id, "late-ok");
    await overdue(late.registration_id);
    expect((await markPaid(late.registration_id)).error).toBeNull();
    expect((await fx.registration(late.registration_id)).status).toBe("confirmed");
  });

  it("paid → free confirms live holds only; an overdue hold's seat goes to the waitlist", async () => {
    const event = await fx.createEvent({ capacity: 2, price: 300 });
    const live = await fx.registerOk(event.id, "pf-live");
    const late = await fx.registerOk(event.id, "pf-late");
    const waiting = await fx.registerOk(event.id, "pf-wait");
    await overdue(late.registration_id);
    await fx.db.from("events").update({ is_paid: false, price_uah: null }).eq("id", event.id);
    expect((await fx.registration(live.registration_id)).status).toBe("confirmed");
    expect((await fx.registration(late.registration_id)).status).toBe("expired");
    expect((await fx.registration(waiting.registration_id)).status).toBe("confirmed");
    expect(await takenSeats(event.id)).toBe(2);
  });

  it("racing 'paid' and 'cancel' on the same hold never overbooks", async () => {
    for (let round = 0; round < 5; round++) {
      const event = await fx.createEvent({ capacity: 1, price: 300 });
      const holder = await fx.registerOk(event.id, `race-${round}-a`);
      await fx.registerOk(event.id, `race-${round}-b`);
      await Promise.all([markPaid(holder.registration_id), cancel(holder.cancel_token)]);
      expect(await takenSeats(event.id)).toBe(1);
    }
  });

  it("cancelling on a cancelled event doesn't hand out seats; re-publishing does", async () => {
    const event = await fx.createEvent({ capacity: 1 });
    const first = await fx.registerOk(event.id, "rp-first");
    const waiting = await fx.registerOk(event.id, "rp-wait");
    await fx.db.from("events").update({ status: "cancelled" }).eq("id", event.id);
    await cancel(first.cancel_token);
    expect((await fx.registration(waiting.registration_id)).status).toBe("waitlist");

    await fx.db.from("events").update({ status: "published" }).eq("id", event.id);
    expect((await fx.registration(waiting.registration_id)).status).toBe("confirmed");
  });

  it("the public key can't read meeting links or payment instructions", async () => {
    const anon = anonClient();
    for (const column of ["online_url", "payment_instructions"]) {
      expect((await anon.from("events").select(column).limit(1)).error?.code, column).toBe("42501");
      expect((await anon.from("events_public").select(column).limit(1)).error, column).not.toBeNull();
    }
    expect((await anon.from("events_public").select("slug, seats_left").limit(1)).error).toBeNull();
  });
});
