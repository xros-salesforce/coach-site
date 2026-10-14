import "server-only";
import { z } from "zod";

// Server-side environment. Optional integrations (Resend, Turnstile, Instagram) may be absent
// in local dev; callers degrade gracefully when they are.
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Coach Site <onboarding@resend.dev>"),
  ADMIN_NOTIFY_EMAIL: z.email().optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  INSTAGRAM_APP_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional(),
});

let cached: z.infer<typeof schema> | undefined;

// Parsed lazily so a missing variable only breaks the feature that needs it, not every import.
export function env() {
  return (cached ??= schema.parse(process.env));
}
