import { NextRequest, NextResponse } from "next/server";
import { googleAuthService } from "@/services/google/auth.service";

export const runtime = "nodejs";

function clearCookie(response: NextResponse, name: string) {
  response.cookies.set(name, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: name === googleAuthService.sessionCookieName ? "/" : "/api/auth/google",
    maxAge: 0,
  });
}

async function handleLogout(request: NextRequest) {
  const sessionValue = request.cookies.get(googleAuthService.sessionCookieName)?.value ?? null;
  let userId: string | null = null;

  try {
    const session = googleAuthService.parseSessionCookieValue(sessionValue);
    userId = session?.userId ?? null;
  } catch {
    userId = null;
  }

  if (userId) {
    try {
      await googleAuthService.revokeAuthorizedAccount(userId);
    } catch {
      // logout should remain idempotent even if the database is temporarily unavailable
    }
  }

  const nextPath = googleAuthService.buildRedirectTarget(new URL(request.url).searchParams.get("next"));
  const response = NextResponse.redirect(new URL(nextPath, request.url), { status: 302 });
  clearCookie(response, googleAuthService.sessionCookieName);
  clearCookie(response, googleAuthService.stateCookieName);
  clearCookie(response, googleAuthService.nextCookieName);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: NextRequest) {
  return handleLogout(request);
}

export async function POST(request: NextRequest) {
  return handleLogout(request);
}
