import { normalizePhoneme } from "./PhonemeNormalizer";
import { clamp } from "../../utils/clamp";
import type { CoarticulationDebugState } from "../../types/facialAnimation";

/**
 * Derived deformation intent for the coordinated speech layer.
 *
 * This is a pure read of what the existing CoarticulationEngine already produced.
 * It introduces NO timing of its own: every weight here comes from
 * `CoarticulationDebugState`, which the engine computes from the audio-aligned
 * phoneme timestamps. Nothing in this file may consult a clock.
 */
export type SpeechTransitionType =
  | "silence-to-speech"
  | "speech-to-silence"
  | "closure-to-open"
  | "open-to-closure"
  | "rounded-to-closure"
  | "spread-to-rounded"
  | "consonant-cluster"
  | "vowel-to-vowel"
  /**
   * A non-bilabial constriction releasing into, or forming out of, a vowel.
   *
   * These existed only as `"other"` until 2026-08-17, and `"other"` is the one
   * class the coordinated layer's `overlapGain` returns zero for — so S→AH, T→OW,
   * N→AE and F→AA, which are most of connected speech, got no articulatory overlap
   * at all. Measured over the diagnostic sequences: 126 of 439 speaking frames were
   * `"other"`, 0% of them with any overlap.
   */
  | "consonant-to-vowel"
  | "vowel-to-consonant"
  | "other";

export interface SpeechTransitionIntent {
  previousContribution: number;
  currentContribution: number;
  nextContribution: number;
  dominantPhoneme: string | null;
  transitionType: SpeechTransitionType;
  closureIntent: number;
  openingIntent: number;
  roundingIntent: number;
  spreadingIntent: number;
  pressureIntent: number;
  tensionIntent: number;
  /**
   * The bilabial SHARE of the coarticulation weights, 0..1.
   *
   * `closureIntent` cannot gate a bilabial-only mechanism: an F contributes 0.42
   * to it, an alveolar 0.2, a rounded vowel 0.06. This is the fraction of the
   * engine's own weight that currently sits on P, B or M, so it is exactly zero
   * for every non-bilabial by construction rather than by threshold.
   *
   * Like every other field here it is a pure read of `CoarticulationDebugState`,
   * so it inherits the engine's look-ahead: it rises while the previous vowel is
   * still current, which is what makes the upper lip start descending before the
   * seal without anything here consulting a clock.
   */
  bilabialIntent: number;
}

/**
 * Articulatory families, keyed by normalized phoneme.
 *
 * These are phonetic facts about how a sound is produced, not tuning values, so
 * they are shared by every model. Per-model amplitude lives in the profile.
 */
export type PhonemeFamily =
  | "silence"
  | "bilabial"
  | "labiodental"
  | "openVowel"
  | "roundedVowel"
  | "spreadVowel"
  | "midVowel"
  | "alveolar"
  | "postalveolar"
  | "velar"
  | "rhotic"
  | "dental"
  | "other";

const FAMILY: Record<string, PhonemeFamily> = {
  SIL: "silence", SP: "silence",
  P: "bilabial", B: "bilabial", M: "bilabial",
  F: "labiodental", V: "labiodental",
  AA: "openVowel", AH: "openVowel", AE: "openVowel", AW: "openVowel", AY: "openVowel",
  AO: "roundedVowel", OW: "roundedVowel", UH: "roundedVowel", UW: "roundedVowel", OY: "roundedVowel", W: "roundedVowel",
  IY: "spreadVowel", IH: "spreadVowel", EH: "spreadVowel", EY: "spreadVowel",
  ER: "rhotic", R: "rhotic",
  T: "alveolar", D: "alveolar", N: "alveolar", L: "alveolar", S: "alveolar", Z: "alveolar",
  SH: "postalveolar", CH: "postalveolar", JH: "postalveolar", ZH: "postalveolar",
  K: "velar", G: "velar", NG: "velar",
  TH: "dental", DH: "dental",
  Y: "spreadVowel", HH: "other", UX: "roundedVowel"
};

export const familyOf = (phoneme: string | null | undefined): PhonemeFamily => {
  if (!phoneme) return "silence";
  const normalized = normalizePhoneme(phoneme);
  if (!normalized) return "other";
  return FAMILY[normalized] ?? "other";
};

const isVowel = (family: PhonemeFamily) =>
  family === "openVowel" || family === "roundedVowel" || family === "spreadVowel" || family === "midVowel";
const isConsonant = (family: PhonemeFamily) =>
  family !== "silence" && !isVowel(family);

/** How strongly each family closes, opens, rounds, spreads, presses, tenses. */
const FAMILY_INTENT: Record<PhonemeFamily, {
  closure: number; opening: number; rounding: number; spreading: number; pressure: number; tension: number;
}> = {
  silence:       { closure: 0,    opening: 0,    rounding: 0,    spreading: 0,    pressure: 0,    tension: 0 },
  bilabial:      { closure: 1,    opening: 0,    rounding: 0.1,  spreading: 0,    pressure: 1,    tension: 0.35 },
  labiodental:   { closure: 0.42, opening: 0.18, rounding: 0.08, spreading: 0.06, pressure: 0.62, tension: 0.45 },
  openVowel:     { closure: 0,    opening: 1,    rounding: 0.05, spreading: 0.12, pressure: 0,    tension: 0.08 },
  roundedVowel:  { closure: 0.06, opening: 0.42, rounding: 1,    spreading: 0,    pressure: 0.12, tension: 0.18 },
  spreadVowel:   { closure: 0,    opening: 0.34, rounding: 0,    spreading: 1,    pressure: 0.04, tension: 0.14 },
  midVowel:      { closure: 0,    opening: 0.5,  rounding: 0.15, spreading: 0.2,  pressure: 0,    tension: 0.1 },
  alveolar:      { closure: 0.2,  opening: 0.18, rounding: 0,    spreading: 0.14, pressure: 0.3,  tension: 0.55 },
  postalveolar:  { closure: 0.12, opening: 0.3,  rounding: 0.62, spreading: 0,    pressure: 0.26, tension: 0.5 },
  velar:         { closure: 0.14, opening: 0.28, rounding: 0,    spreading: 0.04, pressure: 0.2,  tension: 0.3 },
  rhotic:        { closure: 0.04, opening: 0.28, rounding: 0.48, spreading: 0,    pressure: 0.1,  tension: 0.3 },
  dental:        { closure: 0.16, opening: 0.22, rounding: 0,    spreading: 0.1,  pressure: 0.34, tension: 0.5 },
  other:         { closure: 0.05, opening: 0.2,  rounding: 0.05, spreading: 0.05, pressure: 0.08, tension: 0.15 }
};

const classify = (
  previous: PhonemeFamily,
  current: PhonemeFamily,
  next: PhonemeFamily
): SpeechTransitionType => {
  if (previous === "silence" && current !== "silence") return "silence-to-speech";
  if (current === "silence" && previous !== "silence") return "speech-to-silence";
  // Look ahead first: what the face is travelling TOWARD dominates the shape it
  // must already be preparing.
  if (current === "bilabial" && (previous === "roundedVowel" || previous === "rhotic")) return "rounded-to-closure";
  if (isVowel(previous) && current === "bilabial") return "open-to-closure";
  if (previous === "bilabial" && isVowel(current)) return "closure-to-open";
  if (previous === "spreadVowel" && current === "roundedVowel") return "spread-to-rounded";
  if (isConsonant(previous) && isConsonant(current)) return "consonant-cluster";
  if (isVowel(previous) && isVowel(current)) return "vowel-to-vowel";
  if (isVowel(current) && next === "bilabial") return "open-to-closure";
  // Non-bilabial consonant against a vowel. Ordered after the bilabial rules above,
  // which are more specific and already claim their pairs.
  if (isConsonant(previous) && isVowel(current)) return "consonant-to-vowel";
  if (isVowel(previous) && isConsonant(current)) return "vowel-to-consonant";
  return "other";
};

/**
 * Blends the three families the engine is already weighting into a single set of
 * articulatory intents.
 *
 * Contributions are used exactly as the CoarticulationEngine reported them, so an
 * intent can only be non-zero while that phoneme is inside its own timestamp
 * window or the engine's declared look-ahead / look-behind.
 */
export const deriveTransitionIntent = (weights: CoarticulationDebugState): SpeechTransitionIntent => {
  const previousFamily = familyOf(weights.previousPhoneme);
  const currentFamily = familyOf(weights.currentPhoneme);
  const nextFamily = familyOf(weights.nextPhoneme);

  const previous = clamp(weights.previousContribution);
  const current = clamp(weights.currentContribution);
  const next = clamp(weights.nextContribution);
  const total = previous + current + next;

  const bilabialShare =
    total <= 0
      ? 0
      : clamp(
          ((previousFamily === "bilabial" ? previous : 0) +
            (currentFamily === "bilabial" ? current : 0) +
            (nextFamily === "bilabial" ? next : 0)) /
            total
        );

  const mix = (pick: (entry: (typeof FAMILY_INTENT)[PhonemeFamily]) => number) => {
    if (total <= 0) return 0;
    return clamp(
      (pick(FAMILY_INTENT[previousFamily]) * previous +
        pick(FAMILY_INTENT[currentFamily]) * current +
        pick(FAMILY_INTENT[nextFamily]) * next) /
        total
    );
  };

  return {
    previousContribution: previous,
    currentContribution: current,
    nextContribution: next,
    dominantPhoneme: weights.dominantPhoneme ?? null,
    transitionType: classify(previousFamily, currentFamily, nextFamily),
    closureIntent: mix((entry) => entry.closure),
    openingIntent: mix((entry) => entry.opening),
    roundingIntent: mix((entry) => entry.rounding),
    spreadingIntent: mix((entry) => entry.spreading),
    pressureIntent: mix((entry) => entry.pressure),
    tensionIntent: mix((entry) => entry.tension),
    bilabialIntent: bilabialShare
  };
};

export const neutralTransitionIntent = (): SpeechTransitionIntent => ({
  previousContribution: 0,
  currentContribution: 0,
  nextContribution: 0,
  dominantPhoneme: null,
  transitionType: "other",
  closureIntent: 0,
  openingIntent: 0,
  roundingIntent: 0,
  spreadingIntent: 0,
  pressureIntent: 0,
  tensionIntent: 0,
  bilabialIntent: 0
});
