import { NextRequest, NextResponse } from "next/server";
import { memoryRetrievalService } from "@/services/memory-retrieval-service";
import type { MemorySearchQuery } from "@/types/memory-retrieval";
import type { ApiErrorResponse } from "@/types/api";

export const runtime = "nodejs";

function parseTemporalFilter(input: URLSearchParams) {
  const since = input.get("since");
  const until = input.get("until");
  const normalizedSince = since && !Number.isNaN(Date.parse(since)) ? since : null;
  const normalizedUntil = until && !Number.isNaN(Date.parse(until)) ? until : null;
  return {
    since: normalizedSince,
    until: normalizedUntil,
  };
}

function buildError(message: string, code: string, details?: Record<string, unknown>): ApiErrorResponse {
  return {
    status: "error",
    message,
    code,
    details,
  };
}

async function parseRequest(request: NextRequest): Promise<MemorySearchQuery> {
  if (request.method === "POST") {
    const body = (await request.json().catch(() => null)) as Partial<MemorySearchQuery> | null;
    const since = body?.temporalFilter?.since;
    const until = body?.temporalFilter?.until;
    return {
      query: String(body?.query ?? "").trim(),
      limit: Number.isFinite(body?.limit ?? NaN) ? body?.limit : undefined,
      minImportance: Number.isFinite(body?.minImportance ?? NaN) ? body?.minImportance : undefined,
      temporalFilter: {
        since: since && !Number.isNaN(Date.parse(since)) ? since : null,
        until: until && !Number.isNaN(Date.parse(until)) ? until : null,
      },
    };
  }

  const url = new URL(request.url);
  return {
    query: (url.searchParams.get("q") ?? url.searchParams.get("query") ?? "").trim(),
    limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    minImportance: url.searchParams.get("minImportance") ? Number(url.searchParams.get("minImportance")) : undefined,
    temporalFilter: parseTemporalFilter(url.searchParams),
  };
}

async function handleSearch(request: NextRequest) {
  const query = await parseRequest(request);
  if (!query.query) {
    return NextResponse.json(buildError("missing search query", "MISSING_QUERY"), { status: 400 });
  }

  try {
    const response = await memoryRetrievalService.search(query);
    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      buildError("semantic search failed", "SEARCH_FAILED", {
        reason: error instanceof Error ? error.message : "unknown",
      }),
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handleSearch(request);
}

export async function POST(request: NextRequest) {
  return handleSearch(request);
}
