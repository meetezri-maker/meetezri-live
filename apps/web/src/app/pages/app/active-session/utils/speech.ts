import { readSentimentCompoundRaw } from "@/lib/avatar/avatarExpressionUtils";

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

/**
 * Legacy Jordan sentiment compound. The generic numeric extraction now lives in
 * `avatarExpressionUtils.readSentimentCompoundRaw`; this is a thin shim that
 * preserves the exact historical contract (`number | undefined`, unclamped, NaN
 * passthrough) for the Jordan behavior scheduler. Do not add clamping/null here
 * — that would change Jordan's visible behavior. (avatarExpressionUtils only
 * imports `three` as a type, so this keeps speech.ts free of a runtime Three
 * dependency.)
 */
export function extractJordanSentimentCompound(
  sentiment: unknown,
): number | undefined {
  return readSentimentCompoundRaw(sentiment);
}
