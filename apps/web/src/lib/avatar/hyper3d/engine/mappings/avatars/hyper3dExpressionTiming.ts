import type { BlendshapePose } from "../../types/facialAnimation";

/**
 * HYPER3D STAGE 2 — phrase-level expression timing.
 *
 * The rule this enforces is the one the brief is most emphatic about: an
 * expression lives across a PHRASE, not across a word and certainly not across a
 * syllable. A human does not smile on every positive word, so the envelope has
 * exactly one rise and one fall for the whole phrase — it is not driven by
 * phonemes, stress, or word boundaries, and it cannot pulse.
 *
 * Nothing here classifies emotion. The expression and the phrase window are
 * supplied by the review mode as deterministic test cues; proving the animation
 * mechanism is the point of Stage 2, and intent detection is a later problem.
 */

export interface ExpressionTimingProfile {
  /** Seconds the expression begins BEFORE the phrase starts. */
  anticipationSeconds: number;
  /** Seconds to reach full value once it has begun. */
  attackSeconds: number;
  /** Seconds the expression is held past the end of the phrase before releasing. */
  holdSeconds: number;
  /** Seconds to fall back to nothing. */
  releaseSeconds: number;
}

/**
 * Per-expression profiles. These differ on purpose: a curious brow arrives
 * before the question is finished being asked, concern settles in more slowly
 * and lingers, and surprise is by nature abrupt and short.
 */
export const HYPER3D_EXPRESSION_TIMING: Record<string, ExpressionTimingProfile> = {
  warm: { anticipationSeconds: 0.22, attackSeconds: 0.42, holdSeconds: 0.35, releaseSeconds: 0.70 },
  happy: { anticipationSeconds: 0.18, attackSeconds: 0.34, holdSeconds: 0.40, releaseSeconds: 0.65 },
  attentive: { anticipationSeconds: 0.30, attackSeconds: 0.50, holdSeconds: 0.45, releaseSeconds: 0.80 },
  curious: { anticipationSeconds: 0.34, attackSeconds: 0.30, holdSeconds: 0.30, releaseSeconds: 0.55 },
  thoughtful: { anticipationSeconds: 0.30, attackSeconds: 0.55, holdSeconds: 0.55, releaseSeconds: 0.90 },
  serious: { anticipationSeconds: 0.26, attackSeconds: 0.45, holdSeconds: 0.50, releaseSeconds: 0.75 },
  concerned: { anticipationSeconds: 0.28, attackSeconds: 0.55, holdSeconds: 0.60, releaseSeconds: 0.95 },
  surprise: { anticipationSeconds: 0.06, attackSeconds: 0.14, holdSeconds: 0.18, releaseSeconds: 0.45 }
};

export const defaultTimingProfile: ExpressionTimingProfile = HYPER3D_EXPRESSION_TIMING.warm;

const smoothstep = (t: number) => {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return k * k * (3 - 2 * k);
};

/**
 * The phrase envelope, 0..1.
 *
 * One rise, one plateau, one fall. Deterministic: the same clock and window
 * always give the same value, with no randomness and no per-word term.
 */
export const expressionEnvelope = (
  clock: number,
  phraseStart: number,
  phraseEnd: number,
  profile: ExpressionTimingProfile
): number => {
  const begin = phraseStart - profile.anticipationSeconds;
  const full = begin + profile.attackSeconds;
  const holdUntil = phraseEnd + profile.holdSeconds;
  const done = holdUntil + profile.releaseSeconds;
  if (clock <= begin || clock >= done) return 0;
  if (clock < full) return smoothstep((clock - begin) / Math.max(1e-6, profile.attackSeconds));
  if (clock <= holdUntil) return 1;
  return 1 - smoothstep((clock - holdUntil) / Math.max(1e-6, profile.releaseSeconds));
};

/**
 * Facial emphasis, Stage 2 scope only.
 *
 * A brief lift ON TOP of the current expression rather than a replacement for
 * it: the brief's requirement is "WARM baseline + emphasis -> slightly stronger
 * warm face -> return to WARM". So this returns a MULTIPLIER applied to the
 * expression's own channels, which is what makes it blend rather than override —
 * an emphasis on a concerned face intensifies concern, it does not add a smile.
 *
 * Head and gaze coordination are explicitly NOT part of this; that is Stage 3.
 */
export interface EmphasisWindow {
  start: number;
  end: number;
  /** Peak extra fraction, e.g. 0.25 = up to 25% stronger. */
  strength: number;
  attackSeconds: number;
  releaseSeconds: number;
}

/** Which regions an emphasis is allowed to touch. Deliberately not the lips. */
export const EMPHASIS_CHANNEL_PATTERN = /^(brow|cheek|mouthSmile|mouthDimple)/;

export const emphasisGain = (clock: number, window: EmphasisWindow | null): number => {
  if (!window) return 0;
  const { start, end, attackSeconds, releaseSeconds, strength } = window;
  if (clock <= start - attackSeconds || clock >= end + releaseSeconds) return 0;
  if (clock < start) return strength * smoothstep((clock - (start - attackSeconds)) / Math.max(1e-6, attackSeconds));
  if (clock <= end) return strength;
  return strength * (1 - smoothstep((clock - end) / Math.max(1e-6, releaseSeconds)));
};

/**
 * Applies the phrase envelope and any emphasis to an authored expression pose.
 *
 * Emphasis multiplies only the brow, cheek and corner channels the expression
 * ALREADY uses, so it can never introduce a channel the expression did not
 * author — that is what keeps it a stronger version of the same face.
 */
export const applyExpressionTiming = (
  pose: BlendshapePose,
  envelope: number,
  emphasis: number,
  caps: Record<string, number> = {}
): BlendshapePose => {
  const out: BlendshapePose = {};
  for (const [channel, value] of Object.entries(pose)) {
    const boosted = EMPHASIS_CHANNEL_PATTERN.test(channel) ? value * (1 + emphasis) : value;
    const scaled = boosted * envelope;
    const cap = caps[channel];
    const capped = cap === undefined ? scaled : Math.min(scaled, cap);
    if (capped > 1e-5) out[channel] = capped;
  }
  return out;
};
