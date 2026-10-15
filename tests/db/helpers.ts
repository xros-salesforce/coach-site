// Shared setup for database tests. They run against local Supabase (`npx supabase start`) and
// clean up everything they create, so they can run against a database with real-looking data.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: suites are skipped via `hasDb`.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const hasDb = Boolean(url && anonKey && serviceKey);

// These tests create users, events and contacts with the service-role key. Refuse to touch anything
// but a local database unless explicitly told to (ALLOW_REMOTE_DB_TESTS=1).
if (hasDb && process.env.ALLOW_REMOTE_DB_TESTS !== "1") {
  const host = new URL(url!).hostname;
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
    throw new Error(
      `Refusing to run database tests against ${host}: they write test data with the service-role key. ` +
        "Point .env.local at local Supabase (npx supabase start), or set ALLOW_REMOTE_DB_TESTS=1 if you really mean it.",
    );
  }
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
export const serviceClient = () => createClient(url!, serviceKey!, options);
export const anonClient = () => createClient(url!, anonKey!, options);

/** Tracks what a test file creates and removes it afterwards. */
export class Fixture {
  readonly run = `t${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  readonly db = serviceClient();
  private eventIds: string[] = [];
  private userIds: string[] = [];
  private n = 0;

  email(label: string) {
    return `${this.run}-${label}@example.com`;
  }

  /** Registers an event created outside the fixture (e.g. through the admin UI) for cleanup. */
  track(eventId: string) {
    this.eventIds.push(eventId);
  }

  async assertReachable() {
    const { error } = await this.db.from("event_types").select("id").limit(1);
    if (error) throw new Error(`Local Supabase not reachable (run \`npx supabase start\`): ${error.message}`);
  }

  async createEvent(opts: {
    capacity?: number;
    price?: number;
    status?: "draft" | "published" | "cancelled";
    type?: "training" | "coaching" | "workshop" | "online";
    startsInDays?: number;
  } = {}) {
    const { data: type, error: typeError } = await this.db
      .from("event_types").select("id").eq("code", opts.type ?? "training").single();
    if (typeError) throw typeError;
    const { data, error } = await this.db.from("events").insert({
      slug: `${this.run}-${this.n++}`,
      title: `Test event ${this.run}`,
      event_type_id: type.id,
      starts_at: new Date(Date.now() + (opts.startsInDays ?? 7) * 864e5).toISOString(),
      capacity: opts.capacity ?? 5,
      is_paid: opts.price != null,
      price_uah: opts.price ?? null,
      status: opts.status ?? "published",
    }).select("id, slug").single();
    if (error) throw error;
    this.eventIds.push(data.id);
    return data as { id: string; slug: string };
  }

  register(eventId: string, label: string, extra: { consent?: boolean; client?: SupabaseClient } = {}) {
    return (extra.client ?? this.db).rpc("register_for_event", {
      p_event_id: eventId,
      p_full_name: `Test ${label}`,
      p_email: this.email(label),
      p_phone: null,
      p_instagram_handle: null,
      p_comment: null,
      p_marketing_consent: extra.consent ?? false,
    });
  }

  /** Registers and returns the single result row, failing the test on error. */
  async registerOk(eventId: string, label: string, extra: { consent?: boolean } = {}) {
    const { data, error } = await this.register(eventId, label, extra);
    if (error) throw error;
    return data[0] as { registration_id: string; status: string; cancel_token: string; hold_expires_at: string | null; amount_uah: number | null };
  }

  async registration(id: string) {
    const { data, error } = await this.db.from("registrations").select("*").eq("id", id).single();
    if (error) throw error;
    return data;
  }

  /** Creates a temporary user (optionally an admin); removed in cleanup(). */
  async createUser(label: string, { admin = false } = {}) {
    const email = this.email(label);
    const password = `pw-${this.run}-${label}`;
    const { data, error } = await this.db.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    this.userIds.push(data.user.id);
    if (admin) {
      const { error: adminError } = await this.db.from("admins").insert({ user_id: data.user.id, email });
      if (adminError) throw adminError;
    }
    return { email, password };
  }

  /** Signs in a fresh user (optionally an admin) and returns a client acting as them. */
  async signedInClient(label: string, { admin = false } = {}) {
    const { email, password } = await this.createUser(label, { admin });
    const client = anonClient();
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    return client;
  }

  async cleanup() {
    if (this.eventIds.length) await this.db.from("events").delete().in("id", this.eventIds);
    // Also catch events created through the admin UI that a failed test never got to track.
    // `run` is "t<timestamp><random>" (letters and digits only), so it can't match real titles or slugs.
    await this.db.from("events").delete().or(`slug.like.*${this.run}*,title.like.*${this.run}*`);
    await this.db.from("contacts").delete().like("email", `${this.run}-%`);
    for (const id of this.userIds) await this.db.auth.admin.deleteUser(id);
  }
}
