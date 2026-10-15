// Each RPC is a separate HTTP request, so PostgREST runs them on separate DB connections and
// they genuinely race. The event-row lock in register_for_event must keep seat counts exact.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Fixture, hasDb } from "./helpers";

describe.skipIf(!hasDb)("register_for_event under concurrency", () => {
  const fx = new Fixture();
  beforeAll(() => fx.assertReachable());
  afterAll(() => fx.cleanup());

  const burst = (eventId: string, n: number, label: (i: number) => string) =>
    Promise.all(Array.from({ length: n }, (_, i) => fx.register(eventId, label(i))));

  it("never gives out more seats than capacity (free event)", async () => {
    const event = await fx.createEvent({ capacity: 3 });
    const results = await burst(event.id, 20, (i) => `free-${i}`);

    expect(results.map((r) => r.error)).toEqual(Array(20).fill(null));
    const statuses = results.map((r) => r.data![0].status);
    expect(statuses.filter((s) => s === "confirmed")).toHaveLength(3);
    expect(statuses.filter((s) => s === "waitlist")).toHaveLength(17);
    expect((await fx.db.rpc("seats_left", { p_event_id: event.id })).data).toBe(0);
  });

  it("holds exactly capacity seats for a paid event", async () => {
    const event = await fx.createEvent({ capacity: 2, price: 500 });
    const results = await burst(event.id, 15, (i) => `paid-${i}`);

    const statuses = results.map((r) => r.data![0].status);
    expect(statuses.filter((s) => s === "pending_payment")).toHaveLength(2);
    expect(statuses.filter((s) => s === "waitlist")).toHaveLength(13);

    const { count } = await fx.db.from("payments").select("id", { count: "exact", head: true })
      .in("registration_id", results.map((r) => r.data![0].registration_id));
    expect(count).toBe(2);
  });

  it("registers the same email only once when submitted in parallel", async () => {
    const event = await fx.createEvent({ capacity: 5 });
    const results = await burst(event.id, 10, () => "dup");

    expect(results.filter((r) => !r.error)).toHaveLength(1);
    for (const r of results.filter((r) => r.error)) expect(r.error!.message).toBe("already_registered");
    const { count } = await fx.db.from("registrations").select("id", { count: "exact", head: true }).eq("event_id", event.id);
    expect(count).toBe(1);
  });
});
