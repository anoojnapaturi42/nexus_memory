import { NextRequest, NextResponse } from "next/server";
import { googleWorkspaceSyncService } from "@/services/google/workspace-sync.service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const data = await googleWorkspaceSyncService.syncWorkspace(request);
  return NextResponse.json(
    {
      status: "success",
      data,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
