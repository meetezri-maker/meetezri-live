/** Lip-sync openness from transcript position (no Three.js — safe for orchestrator bundle). */
export function getSpeechOpennessAt(text: string, idx: number): number {
  if (!text || idx < 0 || idx >= text.length) return 0.1;
  const window = text
    .slice(Math.max(0, idx - 1), Math.min(text.length, idx + 4))
    .toLowerCase();
  let score = 0;

  for (const ch of window) {
    if ("aeiou".includes(ch)) score += 1.0;
    else if ("yw".includes(ch)) score += 0.55;
    else if ("fvszxj".includes(ch)) score += 0.45;
    else if ("rlntdkg".includes(ch)) score += 0.35;
    else if ("bmp".includes(ch)) score -= 0.5;
    else if (ch === " " || ch === "," || ch === "." || ch === "!" || ch === "?")
      score -= 0.35;
  }

  const normalized = (score + 1.5) / 4.5;
  return Math.min(0.92, Math.max(0.02, normalized));
}

export function extractJordanSentimentCompound(
  sentiment: unknown,
): number | undefined {
  if (!sentiment || typeof sentiment !== "object") {
    return undefined;
  }

  const record = sentiment as Record<string, unknown>;
  const candidates = [record.compound, record.score, record.polarity, record.value];
  const numeric = candidates.find((value) => typeof value === "number");

  return typeof numeric === "number" ? numeric : undefined;
}
