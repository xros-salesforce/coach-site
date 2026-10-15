import { createClient } from "@supabase/supabase-js";

// Anonymous client for the browser (public key only). Used to request admin sign-in links directly
// from Supabase, so its per-IP rate limits and captcha check apply to the visitor, not our server.
export function createBrowserAuthClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
