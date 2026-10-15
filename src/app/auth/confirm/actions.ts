"use server";

import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { safeTarget } from "@/lib/safe-redirect";
import { createSessionClient } from "@/lib/supabase/server";

// Runs only when the person presses "Увійти". Opening the link (or an email scanner fetching it)
// doesn't use up the one-time token.
export async function confirmSignIn(formData: FormData) {
  const tokenHash = String(formData.get("token_hash") ?? "");
  const type = formData.get("type");
  if (!tokenHash || type !== "email") redirect("/admin/login?error=link");

  const supabase = await createSessionClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) redirect("/admin/login?error=link");

  const target = safeTarget(String(formData.get("next") ?? ""), env().NEXT_PUBLIC_SITE_URL);
  redirect(`${target.pathname}${target.search}`);
}
