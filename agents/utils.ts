export function nowIso() {
  return new Date().toISOString();
}

export function createAgentId(prefix: string) {
  const random = globalThis.crypto?.randomUUID?.().replace(/-/g, "").slice(0, 8) ?? Math.random().toString(16).slice(2, 10);
  return `${prefix}_${Date.now()}_${random}`;
}

export function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

export function extractJsonObject<T>(text: string): T | null {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fencedMatch?.[1] ?? text;
  const match = candidate.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}
