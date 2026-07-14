import {
  extractSentimentCompound,
  getSentimentLabel,
  isPositiveSentiment,
  isSadSentiment,
  readSentimentCompoundRaw,
} from "@/lib/avatar/avatarExpressionUtils";
import type { AvatarPhonemeTimeline } from "@/lib/avatar/avatarMorphTypes";
import { SARA_V3_AVATAR_DEFINITION } from "./saraV3Config";
import { writeSaraV3SentimentDiagnostics } from "./saraV3Diagnostics";
import type {
  SaraV3EmotionOverlayState,
  SaraV3SentimentDirection,
  SaraV3SentimentGateResult,
} from "./saraV3Types";

const map = SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap;

type SaraV3SentimentGateConfig = typeof SARA_V3_AVATAR_DEFINITION.saraV3.sentimentGateConfig;

const DEFAULT_CONFIG: SaraV3SentimentGateConfig =
  SARA_V3_AVATAR_DEFINITION.saraV3.sentimentGateConfig;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function neutralResult(
  neutralReason: string,
  rawCompound: number | null,
  clampedCompound: number | null,
  label: string
): SaraV3SentimentGateResult {
  return {
    direction: "neutral",
    targets: {},
    rawCompound,
    clampedCompound,
    label,
    normalizedMagnitude: 0,
    labelNudge: 0,
    finalMagnitude: 0,
    neutralReason,
  };
}

/** Positive overlay: gentle warm smile (+ Duchenne cheek, + safe brow raise). */
function buildPositiveTargets(
  finalMagnitude: number,
  config: SaraV3SentimentGateConfig
): Record<string, number> {
  const r = config.positiveMorphRatios;
  const targets: Record<string, number> = {};
  const smile = finalMagnitude * r.mouthSmile;
  const cheek = finalMagnitude * r.cheekSquint;
  const brow = finalMagnitude * r.eyebrows;
  if (smile > 0) {
    // C3 keeps left/right equal — no asymmetry in this phase.
    targets[map.smileLeft] = smile;
    targets[map.smileRight] = smile;
  }
  if (cheek > 0) {
    targets[map.cheekLeft] = cheek;
    targets[map.cheekRight] = cheek;
  }
  if (brow > 0) {
    targets[map.eyebrows] = brow;
  }
  return targets;
}

/** Concern overlay: soft empathetic concern (frown + faint `sad`), not sadness. */
function buildConcernTargets(
  finalMagnitude: number,
  config: SaraV3SentimentGateConfig
): Record<string, number> {
  const r = config.concernMorphRatios;
  const targets: Record<string, number> = {};
  const frown = finalMagnitude * r.mouthFrown;
  const sad = finalMagnitude * r.sad;
  const brow = finalMagnitude * r.eyebrows;
  if (frown > 0) {
    targets[map.frownLeft] = frown;
    targets[map.frownRight] = frown;
  }
  if (sad > 0) {
    targets[map.sad] = sad;
  }
  // Concern eyebrow direction is unverified on this GLB (ratio 0 in config), so
  // this branch normally contributes nothing — intentionally not guessed.
  if (brow > 0) {
    targets[map.eyebrows] = brow;
  }
  return targets;
}

/**
 * C3 sentiment gate. Converts one sentence's sentiment payload into a neutral
 * result or a bounded speaking-emotion overlay.
 *
 * Formula:
 *   clamped = extractSentimentCompound(sentiment)            // [-1,1] or null
 *   neutral if clamped is null / non-finite / |clamped| < neutralThreshold
 *   direction = sign(clamped)                                // compound only
 *   normMag   = clamp01((|clamped| - threshold) / (1 - threshold))
 *   labelNudge = sameDirectionLabel ? normMag * labelNudgeCap : 0
 *   finalMagnitude = normMag * maxDelta + labelNudge
 *
 * A label can only nudge in the direction the compound already chose; it can
 * never flip polarity, rescue a sub-threshold compound, or turn neutral/negative
 * into a smile (labelNudge is scaled by normMag, which is 0 at threshold).
 */
export function evaluateSaraV3SentimentGate(
  sentiment: unknown,
  config: SaraV3SentimentGateConfig = DEFAULT_CONFIG
): SaraV3SentimentGateResult {
  const rawCompound = readSentimentCompoundRaw(sentiment) ?? null;
  const clampedCompound = extractSentimentCompound(sentiment);
  const label = getSentimentLabel(sentiment);

  if (clampedCompound === null || !Number.isFinite(clampedCompound)) {
    return neutralResult("no-numeric-compound", rawCompound, clampedCompound, label);
  }
  if (Math.abs(clampedCompound) < config.neutralThreshold) {
    return neutralResult("below-threshold", rawCompound, clampedCompound, label);
  }

  const direction: SaraV3SentimentDirection = clampedCompound > 0 ? "positive" : "concern";
  const span = Math.max(1e-6, 1 - config.neutralThreshold);
  const normalizedMagnitude = clamp01((Math.abs(clampedCompound) - config.neutralThreshold) / span);
  const maxDelta =
    direction === "positive" ? config.maxPositiveDelta : config.maxConcernDelta;
  const sameDirectionLabel =
    direction === "positive" ? isPositiveSentiment(sentiment) : isSadSentiment(sentiment);
  const labelNudge = sameDirectionLabel ? normalizedMagnitude * config.labelNudgeCap : 0;
  const finalMagnitude = normalizedMagnitude * maxDelta + labelNudge;

  const targets =
    direction === "positive"
      ? buildPositiveTargets(finalMagnitude, config)
      : buildConcernTargets(finalMagnitude, config);

  return {
    direction,
    targets,
    rawCompound,
    clampedCompound,
    label,
    normalizedMagnitude,
    labelNudge,
    finalMagnitude,
    neutralReason: null,
  };
}

export function createSaraV3EmotionOverlayState(): SaraV3EmotionOverlayState {
  return {
    targets: {},
    sentenceIdentity: null,
    lastResult: null,
  };
}

function sentenceIdentityLabel(timeline: AvatarPhonemeTimeline | null): string | null {
  if (!timeline) return null;
  const sentence = typeof timeline.sentence === "string" ? timeline.sentence : "";
  return sentence.length > 60 ? `${sentence.slice(0, 60)}…` : sentence;
}

/**
 * C3 per-frame driver for the speaking-emotion overlay.
 *
 * - Evaluates the gate only when the sentence/chunk identity (the timeline
 *   object reference) changes, so it never recomputes sentiment every frame.
 * - Holds the current overlay across frames and short inter-chunk gaps (a null
 *   timeline while still speaking is treated as a transient gap, not a reset).
 * - Clears when disabled or when speaking ends (which also covers session reset,
 *   avatar change, and real turn boundaries — all drop `isSpeaking`).
 *
 * The stored `state.targets` are fed into C2's `emotionOverlayTargets` slot, so
 * transitions between sentences ride the existing expression damping.
 */
export function updateSaraV3SpeakingEmotionOverlay(args: {
  state: SaraV3EmotionOverlayState;
  enabled: boolean;
  isSpeaking: boolean;
  timeline: AvatarPhonemeTimeline | null;
  config?: SaraV3SentimentGateConfig;
}): void {
  const config = args.config ?? DEFAULT_CONFIG;
  const { state } = args;

  if (!args.enabled || !args.isSpeaking) {
    if (state.sentenceIdentity !== null || Object.keys(state.targets).length > 0) {
      state.targets = {};
      state.sentenceIdentity = null;
      state.lastResult = null;
    }
    writeSaraV3SentimentDiagnostics({
      enabled: args.enabled,
      isSpeaking: args.isSpeaking,
      rawCompound: null,
      clampedCompound: null,
      label: "",
      direction: "neutral",
      normalizedMagnitude: 0,
      labelNudge: 0,
      finalMagnitude: 0,
      sentenceIdentity: null,
      emotionOverlayTargets: {},
      neutralReason: args.enabled ? "not-speaking" : "disabled",
    });
    return;
  }

  // Speaking + enabled. A null timeline here is a transient gap — hold.
  if (args.timeline != null && args.timeline !== state.sentenceIdentity) {
    const result = evaluateSaraV3SentimentGate(args.timeline.sentiment, config);
    state.sentenceIdentity = args.timeline;
    state.targets = result.targets;
    state.lastResult = result;
  }

  const r = state.lastResult;
  writeSaraV3SentimentDiagnostics({
    enabled: true,
    isSpeaking: true,
    rawCompound: r?.rawCompound ?? null,
    clampedCompound: r?.clampedCompound ?? null,
    label: r?.label ?? "",
    direction: r?.direction ?? "neutral",
    normalizedMagnitude: r?.normalizedMagnitude ?? 0,
    labelNudge: r?.labelNudge ?? 0,
    finalMagnitude: r?.finalMagnitude ?? 0,
    sentenceIdentity: sentenceIdentityLabel(args.timeline),
    emotionOverlayTargets: state.targets,
    neutralReason: r?.neutralReason ?? null,
  });
}
