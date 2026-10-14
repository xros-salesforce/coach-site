import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";

export type Admin = { id: string; email: string };

// Data Access Layer for the admin area: every admin page, action and export calls this.
// Deduplicated per request, so the layout and the page share one auth round-trip.
export const requireAdmin = cache(async (): Promise<Admin> => {
  // Request-time only: the session check compares token expiry with the clock, which must not
  // run during prerendering.
  await connection();
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/admin/login?error=forbidden");

  return { id: user.id, email: user.email ?? "" };
});
