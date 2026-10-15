// The registration lifecycle as implemented in Postgres: seats, waitlist, payment holds,
// cancellation and the contact (lead) list.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Fixture, hasDb } from "./helpers";

describe.skipIf(!hasDb)("registration flow", () => {
  const fx = new Fixture();
  beforeAll(() => fx.assertReachable());
  afterAll(() => fx.cleanup());

  const seatsLeft = async (eventId: string) => (await fx.db.rpc("seats_left", { p_event_id: eventId })).data as number;
  const cancel = (token: string) => fx.db.rpc("cancel_registration", { p_cancel_token: token });

  describe("free event", () => {
    it("confirms while seats last, then waitlists", async () => {
      const event = await fx.createEvent({ capacity: 2 });
      expect((await fx.registerOk(event.id, "free-a")).status).toBe("confirmed");
      expect((await fx.registerOk(event.id, "free-b")).status).toBe("confirmed");
      expect((await fx.registerOk(event.id, "free-c")).status).toBe("waitlist");
      expect(await seatsLeft(event.id)).toBe(0);
    });

    it("cancelling gives the seat to the first person on the waitlist", async () => {
      const event = await fx.createEvent({ capacity: 1 });
      const first = await fx.registerOk(event.id, "cx-first");
      const waiting1 = await fx.registerOk(event.id, "cx-wait1");
      const waiting2 = await fx.registerOk(event.id, "cx-wait2");

      const { data, error } = await cancel(first.cancel_token);
      expect(error).toBeNull();
      expect(data[0].promoted).toEqual([waiting1.registration_id]);
      expect((await fx.registration(first.registration_id)).status).toBe("cancelled");
      expect((await fx.registration(waiting1.registration_id)).status).toBe("confirmed");
      expect((await fx.registration(waiting2.registration_id)).status).toBe("waitlist");
    });

    it("cancelling twice is harmless", async () => {
      const event = await fx.createEvent();
      const reg = await fx.registerOk(event.id, "twice");
      await cancel(reg.cancel_token);
      const { data, error } = await cancel(reg.cancel_token);
      expect(error).toBeNull();
      expect(data[0].promoted).toEqual([]);
    });

    it("rejects an unknown cancel link", async () => {
      const { error } = await cancel("00000000-0000-4000-8000-000000000000");
      expect(error?.message).toBe("registration_not_found");
    });
  });

  describe("paid event (manual bank transfer)", () => {
    it("holds the seat for 48 hours and opens a pending payment", async () => {
      const event = await fx.createEvent({ capacity: 3, price: 450 });
      const reg = await fx.registerOk(event.id, "paid-a");
      expect(reg.status).toBe("pending_payment");
      expect(Number(reg.amount_uah)).toBe(450);
      const holdHours = (new Date(reg.hold_expires_at!).getTime() - Date.now()) / 36e5;
      // The database clock (Docker VM) and this machine's clock can drift slightly; allow a minute either way.
      expect(Math.abs(holdHours - 48)).toBeLessThan(1 / 60);

      const { data: payments } = await fx.db.from("payments").select("status, amount_uah, provider").eq("registration_id", reg.registration_id);
      expect(payments).toEqual([{ status: "pending", amount_uah: 450, provider: "manual" }]);
      expect(await seatsLeft(event.id)).toBe(2);
    });

    it("an expired hold frees the seat and promotes the waitlist", async () => {
      const event = await fx.createEvent({ capacity: 1, price: 300 });
      const late = await fx.registerOk(event.id, "exp-late");
      const next = await fx.registerOk(event.id, "exp-next");
      expect(next.status).toBe("waitlist");

      await fx.db.from("registrations").update({ hold_expires_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", late.registration_id);
      const { data: promoted, error } = await fx.db.rpc("expire_holds");
      expect(error).toBeNull();
      expect(promoted).toContain(next.registration_id);

      expect((await fx.registration(late.registration_id)).status).toBe("expired");
      expect((await fx.registration(next.registration_id)).status).toBe("pending_payment");
      const { data: payment } = await fx.db.from("payments").select("status").eq("registration_id", late.registration_id).single();
      expect(payment?.status).toBe("failed");
    });

    it("an expired hold is also cleared when the next person registers", async () => {
      const event = await fx.createEvent({ capacity: 1, price: 300 });
      const late = await fx.registerOk(event.id, "lazy-late");
      await fx.db.from("registrations").update({ hold_expires_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", late.registration_id);
      expect((await fx.registerOk(event.id, "lazy-new")).status).toBe("pending_payment");
      expect((await fx.registration(late.registration_id)).status).toBe("expired");
    });
  });

  describe("who can register", () => {
    it("refuses the same person twice", async () => {
      const event = await fx.createEvent();
      await fx.registerOk(event.id, "dup");
      const { error } = await fx.register(event.id, "dup");
      expect(error?.message).toBe("already_registered");
    });

    it("lets someone register again after cancelling, with a new cancel link", async () => {
      const event = await fx.createEvent();
      const first = await fx.registerOk(event.id, "again");
      await cancel(first.cancel_token);
      const second = await fx.registerOk(event.id, "again");
      expect(second.registration_id).toBe(first.registration_id);
      expect(second.status).toBe("confirmed");
      expect(second.cancel_token).not.toBe(first.cancel_token);
    });

    it.each([
      ["a draft", "draft", { status: "draft" as const }, "event_not_available"],
      ["a cancelled event", "cancelled", { status: "cancelled" as const }, "event_not_available"],
      ["an event that already started", "past", { startsInDays: -1 }, "event_started"],
    ])("refuses %s", async (_label, key, opts, message) => {
      const event = await fx.createEvent(opts);
      const { error } = await fx.register(event.id, `closed-${key}`);
      expect(error?.message).toBe(message);
    });
  });

  describe("contact list", () => {
    it("keeps one contact per email and merges interests across events", async () => {
      const training = await fx.createEvent({ type: "training" });
      const coaching = await fx.createEvent({ type: "coaching" });
      await fx.registerOk(training.id, "lead", { consent: true });
      await fx.registerOk(coaching.id, "lead");

      const { data } = await fx.db.from("contacts").select("interests, marketing_consent_at, source").eq("email", fx.email("lead"));
      expect(data).toHaveLength(1);
      expect(data![0].interests).toEqual(["coaching", "training"]);
      // Consent given once is kept when a later registration doesn't tick the box.
      expect(data![0].marketing_consent_at).not.toBeNull();
      expect(data![0].source).toBe("registration");
    });

    it("unsubscribing is recorded, and opting in again clears it", async () => {
      const event = await fx.createEvent();
      await fx.registerOk(event.id, "unsub", { consent: true });
      const { data: contact } = await fx.db.from("contacts").select("unsubscribe_token").eq("email", fx.email("unsub")).single();

      expect((await fx.db.rpc("unsubscribe_contact", { p_token: contact!.unsubscribe_token })).data).toBe(true);
      const after = await fx.db.from("contacts").select("unsubscribed_at").eq("email", fx.email("unsub")).single();
      expect(after.data!.unsubscribed_at).not.toBeNull();

      await fx.db.rpc("upsert_contact", {
        p_full_name: "Test unsub", p_email: fx.email("unsub"), p_phone: null, p_instagram_handle: null,
        p_interests: [], p_marketing_consent: true, p_source: "interest_form",
      });
      const again = await fx.db.from("contacts").select("unsubscribed_at").eq("email", fx.email("unsub")).single();
      expect(again.data!.unsubscribed_at).toBeNull();
    });

    it("matches emails case-insensitively", async () => {
      const event = await fx.createEvent();
      await fx.registerOk(event.id, "case");
      const { error } = await fx.db.rpc("register_for_event", {
        p_event_id: event.id, p_full_name: "Test case", p_email: fx.email("case").toUpperCase(),
        p_phone: null, p_instagram_handle: null, p_comment: null, p_marketing_consent: false,
      });
      expect(error?.message).toBe("already_registered");
    });
  });
});
