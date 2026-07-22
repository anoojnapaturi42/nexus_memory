import { NextRequest, NextResponse } from "next/server";
import { googleAuthService } from "@/services/google/auth.service";
import { getGoogleAuthConfig } from "@/lib/google/env";

export const runtime = "nodejs";

function clearAuthCookies(response: NextResponse) {
  response.cookies.set(googleAuthService.stateCookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 0,
  });
  response.cookies.set(googleAuthService.nextCookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 0,
  });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    return NextResponse.json(
      googleAuthService.buildError("OAUTH_ERROR", "google oauth returned an error", {
        oauthError,
      }),
      {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.json(
      googleAuthService.buildError("MISSING_CODE", "missing oauth code"),
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const expectedState = request.cookies.get(googleAuthService.stateCookieName)?.value;
  const actualState = url.searchParams.get("state");
  if (!googleAuthService.isValidOAuthState(expectedState, actualState)) {
    return NextResponse.json(
      googleAuthService.buildError("INVALID_STATE", "invalid oauth state"),
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const envResult = getGoogleAuthConfig();
  if (!envResult.ok) {
    return NextResponse.json(envResult.error, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const tokenResult = await googleAuthService.exchangeCodeForTokens(code);
    if (!tokenResult.refreshToken) {
      throw new Error("missing refresh token");
    }

    const identity = await googleAuthService.fetchIdentity(tokenResult.accessToken);
    const expiresAt = tokenResult.expiryDate
      ? new Date(tokenResult.expiryDate).toISOString()
      : new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await googleAuthService.persistAuthorizedAccount({
      userId: identity.userId,
      accessToken: tokenResult.accessToken,
      refreshToken: tokenResult.refreshToken,
      expiresAt,
    });

    const sessionValue = googleAuthService.createSessionCookieValue({
      userId: identity.userId,
      accountEmail: identity.accountEmail,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const nextPath = googleAuthService.buildRedirectTarget(request.cookies.get(googleAuthService.nextCookieName)?.value);
    const response = NextResponse.redirect(new URL(nextPath, request.url), { status: 302 });
    response.cookies.set(googleAuthService.sessionCookieName, sessionValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
    clearAuthCookies(response);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return NextResponse.json(
      googleAuthService.buildError("TOKEN_EXCHANGE_FAILED", "failed to exchange google oauth code", {
        reason: error instanceof Error ? error.message : "unknown",
      }),
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
