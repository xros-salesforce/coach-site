import { type NextRequest, NextResponse } from "next/server";
import { safeTarget } from "@/lib/safe-redirect";
import { createSessionClient } from "@/lib/supabase/server";

// Target of the sign-in email link (supabase/templates/magic_link.html).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  // Only email sign-in links are accepted here.
  if (tokenHash && type === "email") {
    const supabase = await createSessionClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(safeTarget(searchParams.get("next"), request.url));
  }
  return NextResponse.redirect(new URL("/admin/login?error=link", request.url));
}

