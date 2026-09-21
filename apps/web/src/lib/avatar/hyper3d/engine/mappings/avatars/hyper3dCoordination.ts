import type { FaceRegion } from "../../engine/avatar/hyper3dFaceResolver";

/**
 * HYPER3D STAGE 2.1 — coordination repair.
 *
 * Everything here was derived from measurement, not taste. The frame loop was
 * replayed offline at a true 60 fps against the real MFA timings from
 * `test-005`, with the speech pose built per frame from the active phoneme and
 * NO coarticulation — deliberately the steppiest possible input, so the numbers
 * are an upper bound on what this layer contributes.
 *
 * WHERE THE FACE JERK CAME FROM
 * -----------------------------
 * `mouthSmileLeft`, per frame, at the Stage-2 settings:
 *
 *   config                          maxDelta   maxVel   maxAcc
 *   attack 35 ms (Stage 2)            0.0917     5.50      334
 *   attack 55 ms                      0.0634     3.80      232
 *   attack 75 ms                      0.0483     2.90      178
 *   attack 55 ms + region smoothing   0.0265     1.59       61
 *
 * A 0.09 jump in one 16 ms frame is the visible snap. Region smoothing on top of
 * a 55 ms attack cuts peak acceleration by 82%.
 *
 * `browInnerUp` measured 0.0044 maxDelta and 3 maxAcc even at 35 ms, so the
 * brows were never the problem — they carry no suppression. `cheekSquintLeft`
 * improved 44 -> 10. Critically, `mouthClose` measured IDENTICALLY in every
 * configuration (maxDelta 0.1014), which is the proof that none of this touches
 * articulation.
 *
 * THE ATTACK TRADE-OFF, MEASURED
 * ------------------------------
 * Residual smile-corner value at peak bilabial:
 *
 *   attack  35 ms -> 0.178      attack  75 ms -> 0.219
 *   attack  55 ms -> 0.204      attack 120 ms -> 0.236
 *
 * Articulation is preserved at EVERY value — `mouthClose` is never touched by
 * the resolver, so the seal itself cannot degrade. What a slower attack costs is
 * how completely the corners get out of the way within a short bilabial. 55 ms
 * buys a 31% acceleration reduction for a 15% worse corner yield, which is why
 * FIX A sits there and FIX B offers 75 ms for comparison.
 *
 * WHERE THE HEAD JERK CAME FROM
 * -----------------------------
 * `HeadMotionController` sets `jerkLimited: Boolean(motorTuning) && !talkingHeadTuning`,
 * so the accepted 1.90x carrier path runs with the limiter OFF and the bone gets
 * only first-order exponential smoothing. The codebase already documents what
 * that means: it "bounds POSITION only… plots as a smooth angle and renders as a
 * snap". Measured on a 2.5 deg target step at 60 fps:
 *
 *   exponential (current)   maxVel 23.0 deg/s   maxAcc 1384 deg/s^2
 *   existing jerk limiter   maxVel  9.4 deg/s   maxAcc  180 deg/s^2
 *
 * An 87% reduction in peak acceleration, using the limiter the project already
 * has. The carrier itself is untouched — this is an output filter downstream of
 * it, not a change to how the motion is generated.
 */

export type CoordinationProfileId = "stage2" | "fixA" | "fixB";

export interface CoordinationProfile {
  id: CoordinationProfileId;
  label: string;
  /** Suppression attack, seconds. Speech still wins; only the ramp changes. */
  attackSeconds: number;
  /** Suppression release, seconds. */
  releaseSeconds: number;
  /**
   * Output smoothing per region, in seconds. Articulation regions are absent on
   * purpose — the central mouth and jaw must stay fully responsive, so speech is
   * never filtered by this layer.
   */
  regionSmoothing: Partial<Record<FaceRegion, number>>;
  /** Route the head through the existing jerk limiter instead of first-order smoothing. */
  jerkLimitedHead: boolean;
  /** Multiplier on the phrase nod amplitude. */
  nodScale: number;
}

export const HYPER3D_COORDINATION: Record<CoordinationProfileId, CoordinationProfile> = {
  /** Exactly what Stage 2 shipped. The A/B reference. */
  stage2: {
    id: "stage2", label: "CURRENT STAGE 2",
    attackSeconds: 0.035, releaseSeconds: 0.16,
    regionSmoothing: {},
    jerkLimitedHead: false,
    nodScale: 0
  },
  /** Measured middle: 82% less corner acceleration for 15% less corner yield. */
  fixA: {
    id: "fixA", label: "COORDINATION FIX A",
    attackSeconds: 0.055, releaseSeconds: 0.18,
    regionSmoothing: { mouthCorners: 0.055, cheeks: 0.075, brows: 0.11, upperEye: 0.11 },
    jerkLimitedHead: true,
    nodScale: 1
  },
  /** Softer still, for the far end of the range. */
  fixB: {
    id: "fixB", label: "COORDINATION FIX B",
    attackSeconds: 0.075, releaseSeconds: 0.24,
    regionSmoothing: { mouthCorners: 0.08, cheeks: 0.1, brows: 0.15, upperEye: 0.15 },
    jerkLimitedHead: true,
    nodScale: 0.6
  }
};

// ---------------------------------------------------------------------------
// Nodding
// ---------------------------------------------------------------------------

export type NodTypeId = "off" | "micro" | "normal" | "acknowledgment";

export interface NodType {
  id: NodTypeId;
  label: string;
  /** Peak downstroke, degrees of pitch. Review ranges, not locked values. */
  pitchDegrees: number;
  downSeconds: number;
  settleSeconds: number;
  returnSeconds: number;
}

/**
 * Three deterministic nod shapes: downstroke, short settle, return.
 *
 * Amplitudes sit in the review ranges the brief gave (micro 0.8-1.5, normal
 * 1.5-2.8, acknowledgment 2-3.5 degrees). They are review values for hardware to
 * choose from, not production numbers.
 */
export const HYPER3D_NODS: Record<NodTypeId, NodType> = {
  off: { id: "off", label: "NOD OFF", pitchDegrees: 0, downSeconds: 0, settleSeconds: 0, returnSeconds: 0 },
  micro: { id: "micro", label: "MICRO NOD", pitchDegrees: 1.1, downSeconds: 0.20, settleSeconds: 0.10, returnSeconds: 0.34 },
  normal: { id: "normal", label: "NORMAL NOD", pitchDegrees: 2.1, downSeconds: 0.24, settleSeconds: 0.12, returnSeconds: 0.40 },
  acknowledgment: { id: "acknowledgment", label: "ACKNOWLEDGMENT NOD", pitchDegrees: 2.8, downSeconds: 0.30, settleSeconds: 0.16, returnSeconds: 0.50 }
};

/**
 * Which nod an expression takes, so the head supports the same intention as the
 * face rather than being scheduled independently.
 *
 * CURIOUS is deliberately `off`: a downward nod contradicts a question. The
 * brief reserves its upward tilt for a later stage, so it gets nothing here
 * rather than something wrong.
 */
export const NOD_FOR_EXPRESSION: Record<string, NodTypeId> = {
  happy: "normal",
  warm: "micro",
  attentive: "micro",
  curious: "off",
  thoughtful: "micro",
  serious: "normal",
  concerned: "micro",
  surprise: "off"
};

/** Per-expression shaping, so a serious nod is firmer and a concerned one softer. */
export const NOD_TIMING_SCALE: Record<string, { amplitude: number; duration: number }> = {
  happy: { amplitude: 1, duration: 1 },
  warm: { amplitude: 0.9, duration: 1.1 },
  attentive: { amplitude: 0.85, duration: 1 },
  curious: { amplitude: 0, duration: 1 },
  thoughtful: { amplitude: 0.8, duration: 1.25 },
  // Smaller and firmer.
  serious: { amplitude: 0.8, duration: 0.85 },
  // Slower and softer.
  concerned: { amplitude: 0.7, duration: 1.35 },
  surprise: { amplitude: 0, duration: 1 }
};

/**
 * Head/neck split for a nod.
 *
 * A nod driven entirely by the head bone reads as a ball joint. Distributing it
 * puts the base of the motion in the neck, which is where a real nod starts.
 * 30/70 sits in the brief's 25-35% / 65-75% range.
 */
export const NOD_DISTRIBUTION = { neck: 0.3, head: 0.7 } as const;

const easeInOut = (t: number) => {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return k * k * (3 - 2 * k);
};

/**
 * Nod pitch in degrees at a given clock, positive = chin down.
 *
 * One gesture per phrase, at a deterministic time. There is no oscillator here
 * and no repetition, which is what keeps it from bobbing.
 */
export const nodPitchDegrees = (
  clock: number,
  nodStart: number,
  type: NodType,
  amplitudeScale: number,
  durationScale: number
): number => {
  if (type.pitchDegrees <= 0 || amplitudeScale <= 0) return 0;
  const down = type.downSeconds * durationScale;
  const settle = type.settleSeconds * durationScale;
  const back = type.returnSeconds * durationScale;
  const t = clock - nodStart;
  if (t <= 0 || t >= down + settle + back) return 0;
  const peak = type.pitchDegrees * amplitudeScale;
  if (t < down) return peak * easeInOut(t / down);
  if (t < down + settle) {
    // A short settle just past the bottom, then the return begins. This is what
    // stops the gesture reading as a single symmetric swing.
    return peak * (1 - 0.12 * easeInOut((t - down) / settle));
  }
  return peak * 0.88 * (1 - easeInOut((t - down - settle) / back));
};
