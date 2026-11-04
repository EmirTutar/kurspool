import { NextResponse, type NextRequest } from "next/server";
import { safeRedirectPath } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"));
  if (!code) return NextResponse.redirect(`${origin}/login?error=1`);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=1`);

  const { data: batchId, error: joinError } = await supabase.rpc("join_batch_if_allowed");
  if (joinError) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=1`);
  }
  if (!batchId) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/no-access`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
