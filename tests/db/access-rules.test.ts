// Who can see and do what. Personal data (contacts, registrations, payments) must only ever
// reach admins; public writes must go through the server (service role), never the browser key.
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, Fixture, hasDb } from "./helpers";

describe.skipIf(!hasDb)("access rules", () => {
  const fx = new Fixture();
  let published: { id: string; slug: string };
  let draft: { id: string; slug: string };
  let paidRegistrationId: string;

  beforeAll(async () => {
    await fx.assertReachable();
    published = await fx.createEvent({ price: 400 });
    draft = await fx.createEvent({ status: "draft" });
    paidRegistrationId = (await fx.registerOk(published.id, "buyer", { consent: true })).registration_id;
  });
  afterAll(() => fx.cleanup());

  const privateTables = ["contacts", "registrations", "payments", "admins", "settings"] as const;

  const PERMISSION_DENIED = "42501";

  async function read(client: SupabaseClient, table: string) {
    const { data, error } = await client.from(table).select("*").limit(1000);
    return { rows: data, code: error?.code ?? null };
  }

  // A valid row, so a refusal can only come from permissions, not from missing columns.
  async function validEventRow() {
    const { data: type } = await fx.db.from("event_types").select("id").eq("code", "training").single();
    return { slug: `${fx.run}-forbidden`, title: "x", event_type_id: type!.id, capacity: 1, status: "published",
      starts_at: new Date(Date.now() + 864e5).toISOString() };
  }

  describe("anonymous visitor (browser key)", () => {
    const anon = anonClient();

    it.each(privateTables)("is denied access to %s", async (table) => {
      expect(await read(anon, table)).toEqual({ rows: null, code: PERMISSION_DENIED });
    });

    it("sees published events but not drafts", async () => {
      const { data } = await anon.from("events").select("id").in("id", [published.id, draft.id]);
      expect(data?.map((e) => e.id)).toEqual([published.id]);
      const { data: view } = await anon.from("events_public").select("slug").in("slug", [published.slug, draft.slug]);
      expect(view?.map((e) => e.slug)).toEqual([published.slug]);
    });

    it("cannot register directly (must go through the server)", async () => {
      const { error } = await fx.register(published.id, "anon-direct", { client: anon });
      expect(error?.message).toMatch(/permission denied/);
    });

    it("cannot create or edit events", async () => {
      const { error: insertError } = await anon.from("events").insert(await validEventRow());
      expect(insertError?.code).toBe(PERMISSION_DENIED);
      const { error: updateError } = await anon.from("events").update({ title: "hacked" }).eq("id", published.id);
      expect(updateError?.code).toBe(PERMISSION_DENIED);
    });

    it("cannot mark a registration as paid", async () => {
      const { error } = await anon.rpc("mark_registration_paid", { p_registration_id: paidRegistrationId });
      expect(error?.code).toBe(PERMISSION_DENIED);
    });

    it("cannot upload event covers", async () => {
      const { error } = await anon.storage.from("event-covers").upload(`${fx.run}.txt`, new Blob(["x"]), { contentType: "text/plain" });
      expect(error).not.toBeNull();
    });
  });

  describe("signed-in user who is not an admin", () => {
    let user: SupabaseClient;
    beforeAll(async () => {
      user = await fx.signedInClient("not-admin");
    });

    it("is not an admin", async () => {
      expect((await user.rpc("is_admin")).data).toBe(false);
    });

    it.each(privateTables)("sees no rows in %s", async (table) => {
      // Allowed to query, but row-level security filters everything out.
      expect(await read(user, table)).toEqual({ rows: [], code: null });
    });

    it("cannot mark a registration as paid", async () => {
      const { error } = await user.rpc("mark_registration_paid", { p_registration_id: paidRegistrationId });
      expect(error?.message).toBe("forbidden");
      expect((await fx.registration(paidRegistrationId)).status).toBe("pending_payment");
    });

    it("cannot see drafts or edit events", async () => {
      expect((await user.from("events").select("id").eq("id", draft.id)).data).toEqual([]);
      const { data, error } = await user.from("events").update({ title: "hacked" }).eq("id", published.id).select();
      expect(error).toBeNull();
      expect(data).toEqual([]);
      const { error: insertError } = await user.from("events").insert(await validEventRow());
      expect(insertError?.code).toBe(PERMISSION_DENIED);
    });
  });

  describe("admin", () => {
    let admin: SupabaseClient;
    beforeAll(async () => {
      admin = await fx.signedInClient("admin", { admin: true });
    });

    it("is an admin", async () => {
      expect((await admin.rpc("is_admin")).data).toBe(true);
    });

    it("can read contacts and registrations", async () => {
      const { data: contacts } = await admin.from("contacts").select("email").eq("email", fx.email("buyer"));
      expect(contacts).toHaveLength(1);
      const { data: regs } = await admin.from("registrations").select("id").eq("event_id", published.id);
      expect(regs).toHaveLength(1);
    });

    it("can see and edit drafts", async () => {
      const { data } = await admin.from("events").update({ title: "Edited" }).eq("id", draft.id).select("title");
      expect(data).toEqual([{ title: "Edited" }]);
    });

    it("marks a payment as received", async () => {
      const { error } = await admin.rpc("mark_registration_paid", { p_registration_id: paidRegistrationId });
      expect(error).toBeNull();
      expect((await fx.registration(paidRegistrationId)).status).toBe("confirmed");
      const { data: payment } = await fx.db.from("payments").select("status, paid_at").eq("registration_id", paidRegistrationId).single();
      expect(payment?.status).toBe("paid");
      expect(payment?.paid_at).not.toBeNull();
    });

    it("can't mark the same registration paid twice", async () => {
      const { error } = await admin.rpc("mark_registration_paid", { p_registration_id: paidRegistrationId });
      expect(error?.message).toBe("not_awaiting_payment");
    });
  });
});
