import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSessionClient } from "@/lib/supabase/server";

// Target of the sign-in email link (supabase/templates/magic_link.html).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next");
  // Only same-site relative paths, so the link can't be turned into an open redirect.
  const target = next?.startsWith("/") && !next.startsWith("//") ? next : "/admin";

  if (tokenHash && type) {
    const supabase = await createSessionClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(target, request.url));
  }
  return NextResponse.redirect(new URL("/admin/login?error=link", request.url));
}
