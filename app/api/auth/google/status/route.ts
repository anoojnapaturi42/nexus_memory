import { NextRequest, NextResponse } from "next/server";
import { googleAuthService } from "@/services/google/auth.service";
import type { GoogleOAuthStatusSuccess } from "@/types/auth";

export const runtime = "nodejs";

async function buildStatus(request: NextRequest): Promise<GoogleOAuthStatusSuccess> {
  const sessionValue = request.cookies.get(googleAuthService.sessionCookieName)?.value ?? null;

  try {
    return await googleAuthService.getStatusFromSession(sessionValue);
  } catch {
    return googleAuthService.getDisconnectedStatus();
  }
}

export async function GET(request: NextRequest) {
  const data = await buildStatus(request);
  return NextResponse.json(googleAuthService.buildStatusResponse(data), {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
