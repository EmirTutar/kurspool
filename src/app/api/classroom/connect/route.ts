import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { buildAuthUrl } from "@/lib/classroom/client";
import { getMembership } from "@/lib/membership";

export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl;
  const membership = await getMembership();
  if (membership?.role !== "maintainer") return NextResponse.redirect(`${origin}/dashboard`);

  const clientId = process.env.GOOGLE_SYNC_CLIENT_ID;
  if (!clientId) return NextResponse.redirect(`${origin}/maintainer?message=missing_configuration`);

  const state = randomBytes(24).toString("hex");
  const response = NextResponse.redirect(
    buildAuthUrl({ clientId, redirectUri: `${origin}/api/classroom/callback`, state }),
  );
  response.cookies.set("classroom_oauth_state", state, {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    path: "/api/classroom",
    maxAge: 600,
  });
  return response;
}
