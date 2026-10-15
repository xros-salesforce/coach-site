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

  async function rowsVisible(client: SupabaseClient, table: string) {
    const { data } = await client.from(table).select("*").limit(1000);
    return data?.length ?? 0;
  }

  describe("anonymous visitor (browser key)", () => {
    const anon = anonClient();

    it.each(privateTables)("cannot read %s", async (table) => {
      expect(await rowsVisible(anon, table)).toBe(0);
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
      const { error: insertError } = await anon.from("events").insert({ slug: `${fx.run}-anon`, title: "x" });
      expect(insertError).not.toBeNull();
      const { data } = await anon.from("events").update({ title: "hacked" }).eq("id", published.id).select();
      expect(data ?? []).toHaveLength(0);
    });

    it("cannot mark a registration as paid", async () => {
      const { error } = await anon.rpc("mark_registration_paid", { p_registration_id: paidRegistrationId });
      expect(error).not.toBeNull();
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

    it.each(privateTables)("cannot read %s", async (table) => {
      expect(await rowsVisible(user, table)).toBe(0);
    });

    it("cannot mark a registration as paid", async () => {
      const { error } = await user.rpc("mark_registration_paid", { p_registration_id: paidRegistrationId });
      expect(error?.message).toBe("forbidden");
      expect((await fx.registration(paidRegistrationId)).status).toBe("pending_payment");
    });

    it("cannot see drafts or edit events", async () => {
      expect((await user.from("events").select("id").eq("id", draft.id)).data).toEqual([]);
      const { data } = await user.from("events").update({ title: "hacked" }).eq("id", published.id).select();
      expect(data ?? []).toHaveLength(0);
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
