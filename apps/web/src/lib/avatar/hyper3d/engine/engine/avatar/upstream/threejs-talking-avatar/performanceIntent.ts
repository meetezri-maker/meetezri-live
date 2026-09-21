/**
 * ADAPTED FROM THIRD-PARTY SOURCE — DO NOT TREAT AS OURS.
 *
 *   upstream repo   https://github.com/majidmanzarpour/threejs-talking-avatar
 *   upstream commit 61ab8e3b1a14946b245926ac1b12e4f387b656ab
 *   upstream file   demo/src/speech/PerformanceIntent.ts
 *   licence         Apache License 2.0
 *
 * THE NON-LLM PATH ONLY.
 *
 * Upstream gets its affect from three places, and they are not equal:
 *
 *   A. `[[face:…]]` and `[[perform:…]]` directives emitted by its local LLM.
 *      NOT PORTED. We have no LLM in this pipeline, and the brief is explicit
 *      that a semantic directive must not be faked. `parsePerformanceDirective`
 *      and `parsePerformanceActionDirective` are therefore absent, and with them
 *      the whole `PerformanceAction` gesture vocabulary (nod, shake, smile,
 *      glance_left/right, …) and its valence/arousal/dominance channels.
 *
 *   B. `requestedAffect(userText)` — a REQUEST in the conversation partner's own
 *      words ("sound happy", "act concerned"). PORTED VERBATIM. This is a plain
 *      regex over a text turn, not a model output. Our payload carries no user
 *      turn, so the review panel supplies it instead of a conversation partner
 *      does. That is upstream's own `requested-emotion` source used as designed;
 *      it is not a fabricated LLM field.
 *
 *   C. `textualAffect(assistantText)` — inference from the spoken text itself.
 *      PORTED VERBATIM. This works from our payload `text` today with no extra
 *      input of any kind.
 *
 * Everything below is B and C, copied verbatim.
 */

export const PERFORMANCE_AFFECTS = [
  "neutral",
  "warm",
  "surprise",
  "question",
  "concerned",
  "emphatic"
] as const;

export type PerformanceAffect = (typeof PERFORMANCE_AFFECTS)[number];

export const PERFORMANCE_DISCOURSE_ACTS = [
  "statement",
  "affirmation",
  "negation",
  "question",
  "request",
  "warning",
  "appreciation"
] as const;

export type PerformanceDiscourseAct = (typeof PERFORMANCE_DISCOURSE_ACTS)[number];

/**
 * `llm-directive` is retained in the union for fidelity to upstream's type, but
 * nothing in this port can ever produce it — the directive parsers are not here.
 */
export type PerformanceIntentSource =
  | "llm-directive"
  | "requested-emotion"
  | "contextual-fallback"
  | "text-fallback";

export interface PerformanceIntent {
  readonly affect: PerformanceAffect;
  readonly intensity: number;
  readonly discourseAct: PerformanceDiscourseAct;
  readonly confidence: number;
  readonly source: PerformanceIntentSource;
}

export interface PerformanceIntentInferenceInput {
  readonly userText?: string;
  readonly assistantText: string;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const REQUESTED_AFFECT_PATTERNS: ReadonlyArray<readonly [PerformanceAffect, RegExp]> = [
  [
    "surprise",
    /\b(?:act|look|sound|be|seem|respond|speak|express|show|pretend)\b.{0,32}\b(?:surpris(?:ed|ing)|astonished|amazed|shocked|startled)\b|\bwith (?:a |an )?(?:surpris(?:ed|ing)|astonished|amazed)\b/iu
  ],
  [
    "warm",
    /\b(?:act|look|sound|be|seem|respond|speak|express|show|pretend)\b.{0,32}\b(?:happy|joyful|cheerful|warm|friendly|delighted|excited|smiling)\b|\bwith (?:a )?(?:warmth|joy|delight|smile)\b/iu
  ],
  [
    "concerned",
    /\b(?:act|look|sound|be|seem|respond|speak|express|show|pretend)\b.{0,32}\b(?:sad|concerned|worried|sympathetic|gentle|apologetic)\b|\bwith (?:a )?(?:concern|sadness|sympathy)\b/iu
  ],
  [
    "emphatic",
    /\b(?:act|look|sound|be|seem|respond|speak|express|show|pretend)\b.{0,32}\b(?:serious|stern|angry|firm|emphatic|confident)\b|\bwith (?:a )?(?:serious|stern|firm|emphatic) (?:tone|expression|voice)\b/iu
  ],
  [
    "question",
    /\b(?:act|look|sound|be|seem|respond|speak|express|show|pretend)\b.{0,32}\b(?:curious|inquisitive|questioning|wondering)\b|\bwith (?:a )?(?:curious|inquisitive|questioning) (?:tone|expression|look)\b/iu
  ]
];

const POSITIVE_PATTERN =
  /\b(?:yes|yeah|great|good|glad|happy|love|thanks?|wonderful|excellent|beautiful|relaxing|delight(?:ed|ful)?|absolutely|certainly)\b/iu;
const SURPRISE_PATTERN =
  /\b(?:wow|amazing|astonishing|incredible|unexpected|surpris(?:e|ed|ing)|remarkable)\b/iu;
const CONCERN_PATTERN =
  /\b(?:sorry|unfortunately|concern(?:ed)?|careful|worry|worried|difficult|problem|risk|afraid|cannot|can't|sad)\b/iu;
const EMPHATIC_PATTERN =
  /\b(?:must|never|always|important|definitely|exactly|strongly|crucial|essential)\b/iu;

function normalize(value: string | undefined): string {
  return (value ?? "").normalize("NFKC").replace(/\s+/gu, " ").trim();
}

export function requestedAffect(userText: string): PerformanceAffect | undefined {
  for (const [affect, pattern] of REQUESTED_AFFECT_PATTERNS) {
    if (pattern.test(userText)) return affect;
  }
  return undefined;
}

export function inferDiscourseAct(
  userText: string,
  assistantText: string
): PerformanceDiscourseAct {
  const combined = `${userText} ${assistantText}`;
  if (/\b(?:warning|warn|danger|dangerous|risk|careful|avoid)\b/iu.test(combined)) return "warning";
  if (/\b(?:thank|appreciat|wonderful|beautiful|love)\b/iu.test(assistantText)) {
    return "appreciation";
  }
  if (/\b(?:no|not|never|cannot|can't|won't|do not|don't)\b/iu.test(assistantText)) {
    return "negation";
  }
  if (/\b(?:yes|agree|certainly|absolutely|correct|indeed)\b/iu.test(assistantText)) {
    return "affirmation";
  }
  if (/\?/u.test(assistantText) || /\?/u.test(userText)) return "question";
  if (/\b(?:please|could you|would you|can you|will you)\b/iu.test(userText)) return "request";
  return "statement";
}

/** Affect from the spoken text alone. Works from our payload today. */
export function textualAffect(text: string): PerformanceAffect {
  if (SURPRISE_PATTERN.test(text)) return "surprise";
  if (CONCERN_PATTERN.test(text)) return "concerned";
  if (/\?/u.test(text)) return "question";
  const positive = POSITIVE_PATTERN.test(text);
  if (EMPHATIC_PATTERN.test(text) || (/!/u.test(text) && !positive)) return "emphatic";
  if (positive) return "warm";
  return "neutral";
}

export function inferPerformanceIntent(
  input: PerformanceIntentInferenceInput
): PerformanceIntent {
  const userText = normalize(input.userText);
  const assistantText = normalize(input.assistantText);
  const requested = requestedAffect(userText);
  const affect = requested ?? textualAffect(assistantText);
  const discourseAct = inferDiscourseAct(userText, assistantText);
  const punctuationBoost = /!/u.test(assistantText) ? 0.08 : 0;
  const intensityByAffect: Record<PerformanceAffect, number> = {
    neutral: 0.32,
    warm: 0.72,
    surprise: 0.84,
    question: 0.68,
    concerned: 0.7,
    emphatic: 0.76
  };
  return {
    affect,
    intensity: clamp01(intensityByAffect[affect] + punctuationBoost + (requested ? 0.08 : 0)),
    discourseAct,
    confidence: requested ? 0.96 : affect === "neutral" ? 0.46 : 0.72,
    source: requested ? "requested-emotion" : userText ? "contextual-fallback" : "text-fallback"
  };
}

/** Upstream's intensity contrast curve, applied before any facial amplitude. */
export function calibrateExpressionIntensity(intensity: number): number {
  const value = clamp01(intensity);
  if (value <= 0) return 0;
  const contrasted = clamp01(0.5 + (value - 0.5) * 1.3);
  return clamp01(Math.pow(contrasted, 0.82) * 1.03);
}
