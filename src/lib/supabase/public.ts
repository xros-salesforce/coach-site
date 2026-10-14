import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Anonymous, cookie-less client for public pages so they stay cacheable (ISR).
export function createPublicClient() {
  return createClient(env().NEXT_PUBLIC_SUPABASE_URL, env().NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
