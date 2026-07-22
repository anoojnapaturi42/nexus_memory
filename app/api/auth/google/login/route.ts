import { NextRequest, NextResponse } from "next/server";
import { googleAuthService } from "@/services/google/auth.service";
import { getGoogleAuthConfig } from "@/lib/google/env";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const envResult = getGoogleAuthConfig();
  if (!envResult.ok) {
    return NextResponse.json(envResult.error, { status: 500, headers: { "Cache-Control": "no-store" } });
  }

  const { state, authorizationUrl } = googleAuthService.createLoginState();
  const nextPath = googleAuthService.buildRedirectTarget(new URL(request.url).searchParams.get("next"));

  const response = NextResponse.redirect(authorizationUrl, { status: 302 });
  response.cookies.set(googleAuthService.stateCookieName, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 10 * 60,
  });
  response.cookies.set(googleAuthService.nextCookieName, nextPath, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 10 * 60,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
