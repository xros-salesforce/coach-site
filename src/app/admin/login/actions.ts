"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/lib/env";
import { createSessionClient } from "@/lib/supabase/server";

export type LoginState = { status: "idle" | "sent" | "invalid" | "rate_limited"; email?: string };

export async function sendSignInLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { status: "invalid" };
  const email = parsed.data;

  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    // Sign-ups are disabled: only pre-created admin accounts (scripts/add-admin.mts) get a link.
    options: { shouldCreateUser: false, emailRedirectTo: `${env().NEXT_PUBLIC_SITE_URL}/admin` },
  });
  if (error?.status === 429) return { status: "rate_limited", email };
  if (error) console.warn("Sign-in link not sent", email, error.message);

  // Same answer whether or not the address has access, so the form can't be used to find admins.
  return { status: "sent", email };
}

export async function signOut() {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
