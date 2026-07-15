import { SARA_V3_AVATAR_DEFINITION } from "./saraV3Config";
import { SARA_V3_EMOTION_COORDINATOR_CONFIG } from "./saraV3BehaviorConfig";
import { writeSaraV3EmotionCoordinatorDiagnostics } from "./saraV3Diagnostics";
import type {
  SaraV3EmotionCoordinatorDecision,
  SaraV3EmotionDirection,
  SaraV3EmotionPersonality,
  SaraV3RuntimeMode,
  SaraV3SentimentDirection,
} from "./saraV3Types";

/**
 * C10 — SaraV3 unified emotion coordination engine ("the conductor").
 *
 * C10 is NOT another emotion generator. Every emotional signal already exists:
 * C3 (speaking sentiment), C4 (idle), C5 (listening), C6 (thinking), C7
 * (speaking body language), C8 (gaze). C10 only prevents those systems from
 * producing a contradictory face (e.g. an idle smile surviving under strong
 * concern, or a C7 emphasis smile stacking onto a concern sentence).
 *
 * It OWNS NO MORPHS. It emits a normalized DECISION: a set of per-channel scalar
 * multipliers (1 = unchanged). The caller multiplies the SURROUNDING behavior
 * layers (stateExpression / scheduledMicro / idleBaseline) by those scales via
 * `scaleSaraV3EmotionTargets` before handing them to the C2 expression runtime —
 * so ownership, layer order, and the single final writer are all untouched.
 *
 * Responsibility split (explicit):
 *   - C3 OWNS emotional polarity and magnitude. Its `emotionOverlay` layer is
 *     already built at the sentiment magnitude, so C10 passes it through
 *     UNSCALED — re-scaling it here by the same normalized magnitude would
 *     double-amplify C3's own overlay.
 *   - C10 coordinates the surrounding layers (idle/listening/thinking/speaking
 *     personality + their micro-events) so they never contradict C3's polarity
 *     (e.g. an idle/engaged smile surviving under concern).
 *
 * Priority (Task 3): speaking-sentiment > speaking-body-language > listening >
 * thinking > idle. Exactly ONE state personality owns the face, and that owner
 * is the authoritative C1 mode — sentiment NEVER changes ownership, it only
 * shapes the emotional polarity of the channels while speaking (C3 is
 * speaking-scoped). Because C1 states are mutually exclusive per frame and C3 is
 * speaking-only, no two personalities are ever simultaneously active; residual
 * cross-state overlap during transitions is C11's concern, not C10's.
 *
 * Neutral / disabled → every scale resolves to 1, so the output is
 * byte-identical to the validated C3–C8 behavior (no polarity flips, no forbidden
 * morphs, no ownership changes).
 *
 * All tuning lives in `emotionCoordinatorConfig`; the boost magnitudes are TEMP
 * current-asset compensation for the weak-deforming GLB.
 */

// Boost magnitudes are intentionally high to compensate for the current GLB's
// weak morph deformation on a client demo. Re-tune against the new asset.
const TEMP_ASSET_COMPENSATION = true;

const map = SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap;

function clamp(value: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, value));
}
function clamp01(value: number) {
  return clamp(value, 0, 1);
}

// ── Channel → member morphs. This is the ONLY place C10 maps a logical channel
// to concrete morph names; the scale helper below never invents a morph. Note
// `eyebrows` (browScale) and `eyeSquint*` (eyeScale) are deliberately distinct
// channels; eyeScale never touches the C8 gaze eyeball morphs (not listed here).
const SMILE_MORPHS = new Set<string>([map.smileLeft, map.smileRight]);
const FROWN_MORPHS = new Set<string>([map.frownLeft, map.frownRight]);
const CHEEK_MORPHS = new Set<string>([map.cheekLeft, map.cheekRight]);
const EYE_MORPHS = new Set<string>([map.eyeSquintLeft, map.eyeSquintRight]);
const BROW_MORPHS = new Set<string>([map.eyebrows]);
const SAD_MORPHS = new Set<string>([map.sad]);
const PRESS_MORPHS = new Set<string>([map.mouthPressLeft, map.mouthPressRight]);

function channelScaleFor(
  morphName: string,
  d: SaraV3EmotionCoordinatorDecision
): number {
  if (SMILE_MORPHS.has(morphName)) return d.smileScale;
  if (FROWN_MORPHS.has(morphName)) return d.frownScale;
  if (CHEEK_MORPHS.has(morphName)) return d.cheekScale;
  if (EYE_MORPHS.has(morphName)) return d.eyeScale;
  if (BROW_MORPHS.has(morphName)) return d.browScale;
  if (SAD_MORPHS.has(morphName)) return d.sadScale;
  if (PRESS_MORPHS.has(morphName)) return d.mouthPressScale;
  return 1; // any other morph (incl. anything unknown) passes through untouched
}

/**
 * Returns a scaled copy of an expression target map per the coordinator decision.
 * Owns no morphs — it only multiplies existing values by their channel scale.
 *
 * - `undefined` in → `undefined` out (preserves the "use static config" path in
 *   the expression runtime; never fabricates a map).
 * - decision disabled OR all scales 1 → values are unchanged (× 1.0 is exact for
 *   doubles), so the downstream damp is byte-identical to pre-C10.
 * - Blink support is intentionally never passed through here — it is blink-owned.
 */
export function scaleSaraV3EmotionTargets(
  targets: Readonly<Record<string, number>> | undefined,
  decision: SaraV3EmotionCoordinatorDecision
): Record<string, number> | undefined {
  if (targets === undefined) return undefined;
  const out: Record<string, number> = {};
  for (const [name, value] of Object.entries(targets)) {
    const scale = decision.enabled ? channelScaleFor(name, decision) : 1;
    out[name] = value * scale;
  }
  return out;
}

/** Neutral decision: every scale 1 (used when disabled or emotionally neutral). */
function neutralDecision(
  enabled: boolean,
  personality: SaraV3EmotionPersonality
): SaraV3EmotionCoordinatorDecision {
  return {
    enabled,
    activePersonality: personality,
    emotionDirection: "neutral",
    emotionIntensity: 0,
    positiveWeight: 0,
    concernWeight: 0,
    smileScale: 1,
    browScale: 1,
    cheekScale: 1,
    eyeScale: 1,
    frownScale: 1,
    sadScale: 1,
    mouthPressScale: 1,
  };
}

/**
 * Computes the per-frame coordination decision.
 *
 * Consumes only OUTPUTS of the other layers:
 *   - the authoritative C1 mode (`activeMode`) → the sole face owner;
 *   - C3's resolved `sentimentDirection` + `sentimentMagnitude` (normalized
 *     0..1) → the emotional polarity/intensity, applied ONLY while speaking.
 */
export function updateSaraV3EmotionCoordinator(args: {
  enabled: boolean;
  activeMode: SaraV3RuntimeMode;
  sentimentDirection: SaraV3SentimentDirection;
  sentimentMagnitude: number;
}): SaraV3EmotionCoordinatorDecision {
  const cfg = SARA_V3_AVATAR_DEFINITION.saraV3.emotionCoordinatorConfig;
  const personality: SaraV3EmotionPersonality = args.activeMode;

  // Disabled → identity decision (byte-identical rollback).
  if (!args.enabled) {
    const d = neutralDecision(false, personality);
    writeDiagnostics(args.activeMode, d);
    return d;
  }

  // Sentiment is speaking-scoped (C3 only runs while speaking). Ownership never
  // moves — sentiment only colors the channels of the speaking personality.
  const speaking = args.activeMode === "speaking";
  const direction: SaraV3EmotionDirection = speaking ? args.sentimentDirection : "neutral";
  const weight = speaking ? clamp01(args.sentimentMagnitude) : 0;

  if (direction === "neutral" || weight === 0) {
    const d = neutralDecision(true, personality);
    writeDiagnostics(args.activeMode, d);
    return d;
  }

  const hi = cfg.maxExpressiveness;
  const clampScale = (x: number) => clamp(x, 0, hi);

  let smileScale = 1;
  let browScale = 1;
  let cheekScale = 1;
  let eyeScale = 1;
  let frownScale = 1;
  let sadScale = 1;
  let mouthPressScale = 1;
  let positiveWeight = 0;
  let concernWeight = 0;

  if (direction === "concern") {
    concernWeight = weight;
    // Kill the smile, reduce (not kill) the engaged cues, keep/boost empathy.
    smileScale = clampScale(1 - weight * cfg.concernSmileSuppression);
    cheekScale = clampScale(1 - weight * cfg.concernCheekReduction);
    eyeScale = clampScale(1 - weight * cfg.concernEyeReduction);
    browScale = clampScale(1 - weight * cfg.concernBrowReduction);
    frownScale = clampScale(1 + weight * cfg.concernFrownBoost);
    sadScale = clampScale(1 + weight * cfg.concernSadBoost);
    mouthPressScale = clampScale(1 + weight * cfg.mouthPressBoost);
  } else {
    // positive
    positiveWeight = weight;
    // Amplify the warm channels, retire the opposing ones.
    smileScale = clampScale(1 + weight * cfg.positiveSmileBoost);
    cheekScale = clampScale(1 + weight * cfg.positiveCheekBoost);
    eyeScale = clampScale(1 + weight * cfg.positiveEyeBoost);
    frownScale = clampScale(1 - weight * cfg.positiveFrownSuppression);
    sadScale = clampScale(1 - weight * cfg.positiveSadSuppression);
    mouthPressScale = clampScale(1 - weight * cfg.positiveMouthPressSuppression);
    // brow stays neutral under positive.
  }

  const emotionIntensity = Math.max(positiveWeight, concernWeight);

  const decision: SaraV3EmotionCoordinatorDecision = {
    enabled: true,
    activePersonality: personality,
    emotionDirection: direction,
    emotionIntensity,
    positiveWeight,
    concernWeight,
    smileScale,
    browScale,
    cheekScale,
    eyeScale,
    frownScale,
    sadScale,
    mouthPressScale,
  };
  writeDiagnostics(args.activeMode, decision);
  return decision;
}

function writeDiagnostics(mode: SaraV3RuntimeMode, d: SaraV3EmotionCoordinatorDecision) {
  const scales: Record<string, number> = {
    smile: d.smileScale,
    brow: d.browScale,
    cheek: d.cheekScale,
    eye: d.eyeScale,
    frown: d.frownScale,
    sad: d.sadScale,
    mouthPress: d.mouthPressScale,
  };
  const suppressedChannels: string[] = [];
  const attenuatedChannels: string[] = [];
  const boostedChannels: string[] = [];
  for (const [name, s] of Object.entries(scales)) {
    if (s === 0) suppressedChannels.push(name);
    else if (s < 1) attenuatedChannels.push(name);
    else if (s > 1) boostedChannels.push(name);
  }
  writeSaraV3EmotionCoordinatorDiagnostics({
    enabled: d.enabled,
    currentState: mode,
    activePersonality: d.activePersonality,
    emotionDirection: d.emotionDirection,
    emotionIntensity: d.emotionIntensity,
    positiveWeight: d.positiveWeight,
    concernWeight: d.concernWeight,
    scales,
    suppressedChannels,
    attenuatedChannels,
    boostedChannels,
    tempAssetCompensation: TEMP_ASSET_COMPENSATION,
  });
}
