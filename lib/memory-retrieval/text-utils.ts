import type { Memory } from "@/types/domain";

const TOKEN_SPLIT_RE = /[^a-z0-9]+/g;

export function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

export function tokenize(value: string) {
  return normalizeText(value)
    .split(TOKEN_SPLIT_RE)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

export function uniqueTokens(values: string[]) {
  return [...new Set(values)];
}

export function buildMemoryText(memory: Memory) {
  return [
    memory.content,
    memory.sourceApp,
    memory.tags.join(" "),
    memory.relatedEntityIds.join(" "),
  ]
    .join(" ")
    .trim();
}

export function buildQueryText(query: string) {
  return query.trim();
}

export function buildMemorySignature(memory: Memory) {
  return normalizeText(`${memory.content}|${memory.sourceApp}|${[...memory.tags].sort().join(",")}`);
}
