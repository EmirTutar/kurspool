import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode } from "@/lib/classroom/client";
import { getMembership } from "@/lib/membership";
import { encryptToken } from "@/lib/sync/crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const finish = (message: string) => {
    const response = NextResponse.redirect(`${origin}/maintainer?message=${message}`);
    response.cookies.delete({ name: "classroom_oauth_state", path: "/api/classroom" });
    return response;
  };

  const membership = await getMembership();
  if (membership?.role !== "maintainer") return NextResponse.redirect(`${origin}/dashboard`);

  const expectedState = request.cookies.get("classroom_oauth_state")?.value;
  const code = searchParams.get("code");
  if (!expectedState || searchParams.get("state") !== expectedState || !code) return finish("connect_failed");

  const { GOOGLE_SYNC_CLIENT_ID: clientId, GOOGLE_SYNC_CLIENT_SECRET: clientSecret, SYNC_TOKEN_KEY: tokenKey } = process.env;
  if (!clientId || !clientSecret || !tokenKey) return finish("missing_configuration");

  try {
    const refreshToken = await exchangeCode({
      clientId,
      clientSecret,
      code,
      redirectUri: `${origin}/api/classroom/callback`,
    });
    if (!refreshToken) return finish("connect_failed");

    const { error } = await createAdminClient()
      .from("sync_credentials")
      .upsert({
        batch_id: membership.batchId,
        encrypted_refresh_token: encryptToken(refreshToken, tokenKey),
        connected_at: new Date().toISOString(),
      });
    return finish(error ? "connect_failed" : "connected");
  } catch {
    return finish("connect_failed");
  }
}
