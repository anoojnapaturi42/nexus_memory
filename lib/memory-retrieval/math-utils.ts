export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function cosineSimilarity(a: number[], b: number[]) {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let index = 0; index < length; index += 1) {
    dot += a[index] * b[index];
    magnitudeA += a[index] * a[index];
    magnitudeB += b[index] * b[index];
  }

  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dot / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

export function jaccardSimilarity(a: string[], b: string[]) {
  const left = new Set(a);
  const right = new Set(b);
  const union = new Set([...left, ...right]);
  if (union.size === 0) return 0;

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }

  return intersection / union.size;
}

export function exponentialRecencyWeight(ageInDays: number, halfLifeDays = 14) {
  const normalizedAge = Math.max(0, ageInDays);
  return Math.exp((-Math.log(2) * normalizedAge) / halfLifeDays);
}

export function frequencyBoost(count: number) {
  return 1 + Math.log1p(Math.max(0, count));
}

