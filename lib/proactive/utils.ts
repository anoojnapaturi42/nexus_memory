export function nowIso() {
  return new Date().toISOString();
}

export function createProactiveId(prefix: string) {
  const random = globalThis.crypto?.randomUUID?.().replace(/-/g, "").slice(0, 8) ?? Math.random().toString(16).slice(2, 10);
  return `${prefix}_${Date.now()}_${random}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function toDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed);
}

export function hoursBetween(left: string, right: string) {
  return (Date.parse(right) - Date.parse(left)) / 3_600_000;
}

export function formatRelativeHours(hours: number) {
  if (hours < 0) return `${Math.abs(Math.round(hours))}h ago`;
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m away`;
  return `${Math.round(hours)}h away`;
}
