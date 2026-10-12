import type { FacialRegion, MergeStrategy } from "../types/facialAnimation";
import type { AvatarModelId } from "./avatarModelConfig";
import { hyper3dPresenceBaseline } from "./avatars/hyper3dCalibration";

export const EXPECTED_MINIFACE_BLENDSHAPES = [
  "jawOpen", "jawForward", "jawLeft", "jawRight", "mouthClose", "mouthFunnel", "mouthPucker",
  "mouthSmileLeft", "mouthSmileRight", "mouthFrownLeft", "mouthFrownRight", "mouthStretchLeft",
  "mouthStretchRight", "mouthPressLeft", "mouthPressRight", "mouthLowerDownLeft", "mouthLowerDownRight",
  "mouthUpperUpLeft", "mouthUpperUpRight", "mouthRollLower", "mouthRollUpper", "mouthShrugLower",
  "mouthShrugUpper", "cheekPuff", "cheekSquintLeft", "cheekSquintRight", "browDownLeft",
  "browDownRight", "browInnerUp", "browOuterUpLeft", "browOuterUpRight", "eyeBlinkLeft",
  "eyeBlinkRight", "eyeSquintLeft", "eyeSquintRight", "eyeWideLeft", "eyeWideRight", "eyeLookDownLeft",
  "eyeLookDownRight", "eyeLookUpLeft", "eyeLookUpRight", "eyeLookInLeft", "eyeLookInRight",
  "eyeLookOutLeft", "eyeLookOutRight"
] as const;

export type MinifaceBlendshape = typeof EXPECTED_MINIFACE_BLENDSHAPES[number];

export const avatarRestPose: Record<MinifaceBlendshape, number> = Object.fromEntries(
  EXPECTED_MINIFACE_BLENDSHAPES.map((name) => [name, 0])
) as Record<MinifaceBlendshape, number>;

export const avatarMorphSafeMaximums: Record<MinifaceBlendshape, number> = Object.fromEntries(
  EXPECTED_MINIFACE_BLENDSHAPES.map((name) => [name, 1])
) as Record<MinifaceBlendshape, number>;

export const clampAvatarMorph = (name: string, value: number) => {
  const safeMaximum = avatarMorphSafeMaximums[name as MinifaceBlendshape] ?? 1;
  return Math.min(Math.max(value, 0), safeMaximum);
};

export const avatarBoneConfig = {
  headBoneNames: ["Head"],
  neckBoneNames: ["Neck"],
  smoothingSpeed: 10,
  automatic: {
    headPitchDeg: 2.25,
    neckPitchDeg: 0.9,
    headYawDeg: 1.4,
    neckYawDeg: 0.65,
    headRollDeg: 1.2,
    neckRollDeg: 0.5
  },
  manual: {
    headPitchDeg: 4.5,
    neckPitchDeg: 1.8,
    headYawDeg: 3.2,
    neckYawDeg: 1.2,
    headRollDeg: 4.5,
    neckRollDeg: 1.8
  }
} as const;

export const degreesToRadians = (degrees: number) => (degrees * Math.PI) / 180;

const byPrefix = (name: string): FacialRegion => {
  if (name.startsWith("jaw")) return "jaw";
  if (name.startsWith("brow")) return "brow";
  if (name.startsWith("eyeLook")) return "gaze";
  if (name.startsWith("eye")) return "eyes";
  if (name.startsWith("cheek")) return "cheeks";
  return "mouth";
};

export const blendshapeRegions: Record<string, FacialRegion> = Object.fromEntries(
  EXPECTED_MINIFACE_BLENDSHAPES.map((name) => [name, byPrefix(name)])
);

export const regionMergeStrategy: Record<FacialRegion, MergeStrategy> = {
  jaw: "boundedAdd",
  mouth: "boundedAdd",
  brow: "boundedAdd",
  eyes: "max",
  cheeks: "boundedAdd",
  gaze: "weightedAverage",
  head: "add"
};

export const smoothingSpeedByRegion: Record<FacialRegion, number> = {
  jaw: 24,
  mouth: 28,
  brow: 9,
  eyes: 48,
  cheeks: 10,
  gaze: 7,
  head: 5
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ASYMMETRIC JAW TRANSITION — the "lips move faster than the voice" fix.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * THE DEFECT, measured over 16 aligned payloads through the real chain. The
 * rendered jaw performs 3.76 open-close CYCLES per second against a corpus
 * syllable rate of 2.92 — it is moving at SEGMENT rate, 29 % faster than the
 * speech it belongs to. During the transitions themselves the jaw carries 63 %
 * of the travel at the median and 89 % at p90, so the dominant visible signal
 * is a ~3.8 Hz vertical oscillation of the whole lower face against a voice
 * whose prosodic rhythm is ~2.9 Hz. That is the report, and it also explains
 * "the lips look like they are moving up and down rather than forming shapes":
 * the aperture IS the signal.
 *
 * THE CAUSE. Every phoneme carries its own `jawOpen` demand and the follower
 * chases all of them, so the jaw dips toward rest for consonants that should
 * not move it. A real jaw is a slow articulator: roughly one open-close cycle
 * per SYLLABLE, with consonant closure made by the tongue and lips while the
 * jaw stays near where the syllable put it.
 *
 * WHY NOT SIMPLY SLOW THE MOUTH. Measured, and it fails exactly as predicted:
 * a global 28 -> 16 costs 16 % of bilabial closure (p90 0.087 -> 0.073), which
 * is the articulation the asset can least afford to lose. Slowing the jaw
 * SYMMETRICALLY protects closure — `mouthClose` is a lip channel and the jaw
 * cannot reach it — but costs 15 % of aperture (AA p90 0.330 -> 0.281) and adds
 * 30 ms of lag to the opening gesture.
 *
 * WHAT SHIPS. The jaw opens at the accepted speed and closes slowly, which is
 * the physiology: opening is ballistic, closing is slower and routinely
 * incomplete between segments. Measured against the accepted Fix 1 baseline:
 *
 *   jaw open-close cycles      3.76 -> 3.09 per second   (syllable rate 2.92)
 *   rendered path rate         31.2 -> 29.0 mm/s
 *   peak velocity p90          77.1 -> 70.9 mm/s
 *   AA aperture p90            0.330 -> 0.331            UNCHANGED
 *   mean vowel jaw             0.142 -> 0.147            +3.5 %
 *   bilabial closure p90       0.087 -> 0.087            UNCHANGED
 *   jaw OPENING lag            42 ms -> 42 ms            UNCHANGED
 *
 * `sealClosureThreshold` is load-bearing and not a safety margin: a bilabial is
 * a contact event and the jaw must arrive. Without it the jaw sits at 0.152
 * through P/B/M instead of 0.112. At or above this `mouthClose` demand the jaw
 * reverts to its ordinary speed, so no closure is ever slowed.
 *
 * PER MODEL, and absent means unchanged. Only `hyper3d-usc` has been measured,
 * and it is the only model this reaches — every other avatar keeps the
 * symmetric `smoothingSpeedByRegion.jaw` it always had.
 */
/**
 * ─────────────────────────────────────────────────────────────────────────────
 * LIP-SHAPE DAMPING — what pays for stronger shapes.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Stronger target poses mean greater geometric travel, and the Fix 2B strength
 * values on their own push the mouth back past the accepted motion baseline —
 * which is the direction the hardware report was already complaining about.
 * Re-damping the lip-SHAPE channels alone absorbs it.
 *
 * SWEPT AGAINST THE SHIPPED POSES, 25 aligned payloads, rendered geometry:
 *
 *   lipSpeed   pathRate   velP90   AA_vis   EH_vis   IY_vis   T_vis
 *   28            34.3      78.9    17.29    11.21    15.67     9.11
 *   26            33.5      77.0    17.20    10.89    15.39     8.98
 *   24            32.7      74.7    17.10    10.81    15.08     8.88   <- shipped
 *   22            31.9      72.4    17.01    10.76    14.71     8.83
 *
 * against the accepted G+I motion baseline of 32.1 / 74.2. 26 was implemented
 * first and measured 33.5 / 77.0 — over the baseline, because the approved
 * value set is richer than the uniform +25 % the prediction was derived from
 * (`IY`'s smile alone rose 125 %, on the largest-travel mouth channel at
 * 16.19 mm). 24 is the value that returns the motion to baseline, and it costs
 * under 2 % of the new geometry: AA 17.20 -> 17.10, EH 10.89 -> 10.81,
 * IY 15.39 -> 15.08, T 8.98 -> 8.88.
 *
 * Bilabial closure p90 is 0.087 at EVERY speed in that sweep, because the seal
 * is not in the set.
 *
 * WHAT IS DELIBERATELY NOT IN THE SET. `jawOpen` and the other jaw channels keep
 * the asymmetric profile above; `mouthClose` and `mouthPress*` keep the accepted
 * mouth speed of 28, because they are the bilabial seal and its lateral
 * compression and a slower seal is the one failure this project has repeatedly
 * refused. The set is the exact list the sweep above was measured with — it is
 * not "the mouth region", and widening it would invalidate those numbers.
 */
export const LIP_SHAPE_CHANNELS: readonly string[] = Object.freeze([
  "mouthFunnel", "mouthPucker",
  "mouthStretchLeft", "mouthStretchRight",
  "mouthSmileLeft", "mouthSmileRight",
  "mouthUpperUpLeft", "mouthUpperUpRight",
  "mouthLowerDownLeft", "mouthLowerDownRight",
  "mouthRollLower", "mouthShrugLower", "mouthShrugUpper"
]);

const LIP_SHAPE_SET: ReadonlySet<string> = new Set(LIP_SHAPE_CHANNELS);
export const isLipShapeChannel = (name: string) => LIP_SHAPE_SET.has(name);

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DEADLINE-AWARE TARGET CONVERGENCE — the "shapes never finish forming" layer.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * THE DEFECT, from the completed coarticulation diagnosis. The follower, not
 * next-phone coarticulation, is what stops a phoneme's shape from arriving:
 *
 *   current pipeline                   median target reach   69 %
 *   coarticulation removed                                   71 %   (+2)
 *   follower removed, instant tracking                      103 %   (+34)
 *
 * and the loss is concentrated in exactly the labels a conversation is made of:
 *
 *   <= 30 ms   35 %      71-100 ms    72 %
 *   31-50 ms   48 %      101-150 ms   78 %
 *   51-70 ms   64 %      > 150 ms     93 %
 *
 * A fixed exponential speed closes a fixed FRACTION of the remaining distance
 * per unit time, so it closes less of it the less time it is given. At
 * `lipShapeSpeed = 24` the residual after a label of length T is `exp(-24 T)`:
 * 49 % of the distance is still outstanding at 30 ms and 30 % at 50 ms. That is
 * the 35 % and 48 % above, and it is arithmetic rather than tuning.
 *
 * THE CORRECTION. The follower is given a FLOOR, not a new speed: the slowest
 * convergence that would still close `completion` of the outstanding distance
 * before the CURRENT label ends.
 *
 *   residual after `remaining` at speed s   exp(-s x remaining)
 *   require residual <= 1 - completion      s >= ln(1 / (1 - completion)) / remaining
 *
 * so with `completion = 0.9`, `required = 2.302585 / remaining`, and the speed
 * actually used is
 *
 *   max( baselineSpeed, min( required, maxSpeed ) )
 *
 * The outer `max` is why this can only ever make a transition faster: when the
 * normal follower is already predicted to arrive, `required` is below it and the
 * baseline is returned unchanged. `required` crosses 24 at 96 ms of remaining
 * label, so a comfortable label is never touched; it reaches the 34 cap at 68 ms
 * and the 44 cap at 52 ms, which is where the reach table says the loss is.
 *
 * WHY A CAP AT ALL (§7 of the brief). A 20 ms label would demand 115, and
 * forcing a 20 ms label to 100 % is not a readable shape, it is a twitch. The cap
 * is the mechanism that declines to chase the impossible, and it is also what
 * bounds the degenerate frame at the very end of a label, where `remaining`
 * approaches zero and `required` diverges.
 *
 * WHAT IS ELIGIBLE, and nothing else is:
 *
 *   `LIP_SHAPE_CHANNELS`   the measured-safe set the lip-shape damping uses
 *   `jawOpen`              while OPENING only
 *
 * `mouthClose` and `mouthPress*` are deliberately absent for the same reason
 * they are absent from `LIP_SHAPE_CHANNELS`: they are the bilabial seal and its
 * lateral compression, their timing is accepted, and this layer is not allowed
 * near it. Jaw CLOSING is absent because `closeSpeed = 9` is Fix G, the measured
 * answer to a jaw that oscillated at segment rate — accelerating the close would
 * re-create precisely the defect G fixed. The sentence settle is absent because a
 * pause has no phoneme and therefore no deadline.
 *
 * APPROACH ONLY, and this is a deliberate narrowing of the brief. A channel is
 * accelerated only while its demand is RISING. The measured defect is an
 * UNDERSHOT PEAK — reach is peak-rendered against peak-demanded — so rising is
 * the whole of it, and the decay side is a lag rather than a missing shape. It
 * also makes the brief's "jawOpen ONLY WHILE OPENING" a case of one uniform rule
 * rather than a second rule, and it is what keeps §6 true: the release ramp at
 * the end of every label is not turned into extra velocity.
 *
 * ARRIVE, THEN STOP CHASING (§6). A channel already within `tolerance` of its
 * target takes the normal follower. 0.02 is the visibility floor of this asset —
 * `hyper3dMorphCalibration.usefulMin` runs 0.02 to 0.08 — so the layer stands
 * down as soon as the remaining error is too small to be seen. Rising, and by
 * more than tolerance, is therefore ONE condition, which is why the two read as
 * one test below. Overshoot is impossible by construction and not by margin: the
 * value is still `lerp(from, to, 1 - exp(-s dt))` under the same clamp, and that
 * is monotone toward `to` for every finite speed.
 *
 * NOT A PRODUCTION DEFAULT. `mouthTransitionProfiles` carries NO `deadline`, so
 * every shipped path is the accepted follower exactly. A cap is supplied per
 * frame by the DEV comparison through `withMouthDeadline`, and only for a model
 * that already has a transition profile — which is `hyper3d-usc` alone.
 */
/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SOFT LANDING — fast when necessary, controlled approach, soft arrival.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * THE DEFECT, measured over the Deadline 34 corpus (4 aligned payloads, 4420
 * accelerated channel-frames). Deadline 34 is not a modulation, it is very
 * nearly a switch:
 *
 *   accelerated frames pinned at the 34 cap            85 %
 *   mean applied speed while accelerating              33.2   (of a 34 cap)
 *
 * and a large share of that energy is spent after the shape has largely formed.
 * Target-relative completion over accelerated frames, `rendered / demanded`:
 *
 *   p10 0.135   p25 0.296   p50 0.492   p75 0.680   p90 0.795
 *
 *   still accelerating past 60 % complete              36 %
 *   past 70 %                                          22 %
 *   past 80 %                                          10 %
 *   already INSIDE the 85 % arrival band                5 %
 *
 * So a third of the assistance is being spent on a shape that is already more
 * than half made, at full cap speed, which is exactly "approaches the target
 * with too much energy". Arrival velocity at the band edge measures p50
 * 6.68 mm/s and p90 22.76 mm/s on the paragraph.
 *
 * THE CORRECTION, and it is one multiplier on the term that already exists:
 *
 *   assistance    = max(0, deadlineSpeed - baselineSpeed)
 *   completion    = from / to
 *   landingWeight = (1 - completion) ^ exponent
 *   speed         = baselineSpeed + assistance x landingWeight
 *
 * WHY `from / to` IS THE NORMALIZATION. Both candidate measures were
 * instrumented before choosing (see `hyper3dArrivalDiagnostics`). The
 * excursion-relative alternative, `(from - origin) / (to - origin)`, puts 25 %
 * of its mass at exactly 0.000 — a SHORT HOP from an already-high value reads as
 * 0 % complete and would be handed full assistance, which is the mechanical
 * short move the complaint is about. `from / to` reads that same hop as 80 %
 * complete and hands it almost nothing. It is also per-channel normalized by
 * construction — the denominator is that channel's own demand, so no raw morph
 * threshold is shared between `jawOpen` and `mouthStretch`, which §5 forbids —
 * and it needs no transition memo, so the follower acquires no new state and
 * there is still exactly one of it.
 *
 * NO DIVIDE BY ZERO, NO CLAMP NEEDED, AND NOT BY MARGIN. The eligibility gate
 * above is `to - from > tolerance` with `from >= 0`, which forces `to > tolerance`
 * — so the denominator is never small — and forces `from < to`, so `completion`
 * is in `[0, 1)` and `landingWeight` in `(0, 1]`. The clamp below is therefore
 * belt and braces against a future caller, not load-bearing arithmetic.
 *
 * NO THRESHOLD, ANYWHERE. `landingWeight` is a continuous function of completion
 * on the whole interval and reaches 0 only AT the target. There is no completion
 * at which assistance jumps, which is what §17's "no hard discontinuity"
 * requires; the three candidates differ only in the exponent, so none of them can
 * introduce one.
 *
 * WHY AN EXPONENT AND NOT A PIECEWISE CURVE. The brief's example bands
 * (0-60 / 60-80 / 80-90 / 90+) are explanatory, and a piecewise curve would put a
 * derivative discontinuity at each knee — a visible change of character mid
 * transition, which is the opposite of a soft landing. One exponent gives the
 * whole family a single monotone curve and one number to review.
 *
 * WHAT IT CANNOT DO. `speed` is bounded below by `baselineSpeed` (the weight is
 * never negative) and above by the unlandedDeadline speed, hence by `maxSpeed`:
 * the landing term can only ever REMOVE assistance, never add any, and never
 * slow the accepted follower. Overshoot stays impossible for the same reason it
 * already was — the step is still `lerp(from, to, 1 - exp(-s dt))`.
 */

/**
 * The three candidates, as exponents, with the assistance each leaves at the
 * completions the measured distribution actually concentrates on:
 *
 *   completion        0.25    0.50    0.68    0.85
 *   A  late/gentle    0.87    0.71    0.57    0.39
 *   B  medium         0.75    0.50    0.32    0.15
 *   C  early/strong   0.56    0.25    0.10    0.02
 *
 * Read as applied speed against a 24 baseline and a 34 cap, i.e. 10 of
 * assistance to spend:
 *
 *   completion        0.25    0.50    0.68    0.85
 *   A                 32.7    31.1    29.7    27.9
 *   B                 31.5    29.0    27.2    25.5
 *   C                 29.6    26.5    25.0    24.2
 *
 * Three, not a sweep, and spread widely enough that the hardware can tell them
 * apart: at the median accelerated frame they are 31.1 / 29.0 / 26.5 against the
 * baseline's flat 34.
 */
export const HYPER3D_LANDING_EXPONENTS = Object.freeze({
  /** A — late, gentle. Holds most assistance until the shape is nearly made. */
  a: 0.5,
  /** B — medium. Assistance falls linearly with remaining target error. */
  b: 1,
  /** C — early, strong. Assistance is mostly gone by half completion. */
  c: 2
});

export interface MouthDeadlineProfile {
  /**
   * Hard ceiling on the convergence speed this layer may demand. The whole of
   * the A/B: 34 and 44 against the accepted 24.
   */
  maxSpeed: number;
  /**
   * Fraction of the outstanding distance to close by the label's end. 0.9 is the
   * "recognizable shape" threshold the reach table is quoted against.
   */
  completion: number;
  /**
   * Target error at or below which the normal follower is enough. The asset's
   * visibility floor, so the layer cannot create velocity nobody can see.
   */
  tolerance: number;
  /**
   * `ln(1 / (1 - completion))`, precomputed by `hyper3dDeadlineProfile` so the
   * frame path takes a divide and no `Math.log`. Derived, never authored.
   */
  residualLog: number;
  /**
   * SOFT LANDING. The exponent on `(1 - completion)`, or ABSENT for the measured
   * Deadline 34 baseline — and absent means the landing arithmetic is not
   * executed at all, so the baseline stays bit-identical rather than
   * numerically close. See the soft-landing note above.
   */
  landingExponent?: number;
}

/** The two caps under comparison. The accepted follower is the absence of one. */
export const HYPER3D_DEADLINE_MAX_SPEEDS = Object.freeze({ d34: 34, d44: 44 });

export const DEADLINE_COMPLETION = 0.9;
export const DEADLINE_TOLERANCE = 0.02;

/**
 * One cap, with the shared completion and tolerance the comparison holds fixed,
 * and optionally a soft-landing exponent.
 *
 * `landingExponent` omitted is the measured Deadline 34 baseline. A non-finite or
 * non-positive exponent is treated as omitted rather than honoured: an exponent
 * of 0 would make `landingWeight` identically 1 and silently disable the landing
 * while claiming to apply one, which is the one failure mode a reviewer could not
 * see on the face.
 */
export const hyper3dDeadlineProfile = (
  maxSpeed: number,
  landingExponent?: number
): MouthDeadlineProfile =>
  Object.freeze({
    maxSpeed,
    completion: DEADLINE_COMPLETION,
    tolerance: DEADLINE_TOLERANCE,
    residualLog: Math.log(1 / (1 - DEADLINE_COMPLETION)),
    ...(landingExponent !== undefined && Number.isFinite(landingExponent) && landingExponent > 0
      ? { landingExponent }
      : null)
  });

/**
 * `LIP_SHAPE_CHANNELS` plus `jawOpen`. `jawOpen`'s direction gate is not here:
 * it lives in `deadlineConvergenceSpeed` with every other channel's, because
 * approach-only is one rule and not a jaw special case.
 */
const DEADLINE_SET: ReadonlySet<string> = new Set([...LIP_SHAPE_CHANNELS, "jawOpen"]);
export const isDeadlineEligibleChannel = (name: string) => DEADLINE_SET.has(name);

/**
 * The convergence speed for one channel on one frame: `baselineSpeed`, raised
 * only as far as arriving on time requires and never past `maxSpeed`.
 *
 * Returns `baselineSpeed` ITSELF whenever the layer does not apply, which is how
 * an ineligible channel, a settled channel and a comfortable label all take the
 * accepted path exactly. A non-finite or non-positive `secondsRemaining` — a
 * zero-length label, a clock that has run past the label, a NaN out of a
 * malformed payload — is one of those cases, so no division by zero and no NaN
 * can reach the smoother.
 */
export const deadlineConvergenceSpeed = (
  channel: string,
  from: number,
  to: number,
  baselineSpeed: number,
  secondsRemaining: number,
  profile: MouthDeadlineProfile
): number => {
  if (!isDeadlineEligibleChannel(channel)) return baselineSpeed;
  // RISING, AND BY MORE THAN THE VISIBILITY FLOOR. One test, two rules: see above.
  if (!(to - from > profile.tolerance)) return baselineSpeed;
  if (!(secondsRemaining > 0) || !Number.isFinite(secondsRemaining)) return baselineSpeed;
  const required = profile.residualLog / secondsRemaining;
  const allowed = required < profile.maxSpeed ? required : profile.maxSpeed;
  if (!(allowed > baselineSpeed)) return baselineSpeed;
  /**
   * SOFT LANDING. Absent is the Deadline 34 baseline and returns here, so the
   * baseline executes exactly the arithmetic it executed before this existed.
   */
  const exponent = profile.landingExponent;
  if (exponent === undefined) return allowed;
  /**
   * `to > tolerance` and `from < to` are both guaranteed by the gate above, so
   * `completion` is already in `[0, 1)`; the clamp protects a future caller
   * rather than this one. `landingWeight` is in `(0, 1]` and reaches 0 only AT
   * the target, which is what makes the curve continuous with no threshold.
   */
  const completion = from / to;
  const remainingShare = 1 - (completion > 0 ? (completion < 1 ? completion : 1) : 0);
  const landingWeight = exponent === 1 ? remainingShare : Math.pow(remainingShare, exponent);
  return baselineSpeed + (allowed - baselineSpeed) * landingWeight;
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SENTENCE-PAUSE SOFT SETTLE.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * THE DEFECT, measured over every internal silence run in nine aligned
 * speech-like fixtures. The TTS already supplies generous pause space — 33 runs,
 * median 830 ms, and `SpeechBoundaryTimeline` reports `insidePause` on 20-30 % of
 * all frames — and the mouth does nothing with it:
 *
 *   median time to full visual rest inside a pause   117 ms
 *   median MINIMUM visible articulation reached      0.00 mm   (fully dead)
 *   residual jaw during sentence pauses              0.001
 *
 * So a fifth to a third of every reply is a dead mouth that collapsed in a
 * tenth of a second and then waited. Meanwhile the upper face IS phrase-aware —
 * `HumanBehaviorController` already pulls blinks toward boundaries and fires brow
 * and warmth emphasis before them — so the two halves of the face were
 * performing on different clocks. That mismatch is the report.
 *
 * THE CORRECTION. During a SENTENCE pause the articulation channels ease toward
 * the accepted resting presence posture instead of toward zero, and hold it.
 * Nothing new is authored: the target IS `hyper3dPresenceBaseline`, by
 * reference, which is the posture Active Presence already holds between events.
 *
 * WHY ONLY SENTENCE PAUSES. The same measurement found three populations —
 * 810-950 ms sentence, 360-450 ms clause, 30-200 ms within-phrase — and the
 * short gaps correctly stay alive today (they never reach rest, 50-92 % of their
 * frames still moving). `SpeechBoundaryTimeline`'s existing 350 ms
 * `SENTENCE_PAUSE_SECONDS` separates them with no overlap, so the trigger is the
 * kind it already computes rather than a new threshold.
 *
 * `speed` 11 reaches 90 % of the settle in ~210 ms, which is the 200-250 ms the
 * review asked for, against the 117 ms collapse it replaces. Re-entry needs no
 * mechanism: the pause ends, the settle releases, and the coarticulation
 * look-ahead that already prepares every phoneme prepares this one.
 */
export interface MouthSettleProfile {
  /** Exponential speed toward the settle posture. 11 ≈ 210 ms to 90 %. */
  speed: number;
  /**
   * The posture to settle ON. Held by reference to the accepted presence
   * baseline so no second neutral face can exist; a channel absent from it
   * settles to 0, slowly.
   */
  target: Readonly<Record<string, number>>;
}

/**
 * The per-model transition CHARACTER: how the jaw travels, how fast lip shapes
 * follow, and what the mouth does in a real sentence pause. Absent means every
 * one of those keeps the behaviour it had before this profile existed.
 */
export interface MouthTransitionProfile {
  /** Speed while the jaw is opening. The accepted `smoothingSpeedByRegion.jaw`. */
  openSpeed: number;
  /** Speed while the jaw is closing and no real closure is demanded. */
  closeSpeed: number;
  /** `mouthClose` demand at or above which closing reverts to `openSpeed`. */
  sealClosureThreshold: number;
  /** Speed for `LIP_SHAPE_CHANNELS`. Omitted keeps `smoothingSpeedByRegion.mouth`. */
  lipShapeSpeed?: number;
  /** Sentence-pause settle. Omitted means the mouth collapses as it always did. */
  settle?: MouthSettleProfile;
  /**
   * Deadline-aware convergence. PRESENT ON `hyper3d-usc` AND NOWHERE ELSE —
   * this is where the accepted 34 SOFT behaviour lives, as ordinary per-model
   * production configuration rather than as a DEV override.
   *
   * Its ABSENCE is the pre-deadline follower exactly, which is what every other
   * model has and what the DEV comparison's `PRE-DEADLINE` mode restores.
   */
  deadline?: MouthDeadlineProfile;
}

/**
 * Keyed by `AvatarModelId`, imported as a TYPE only: `avatarModelConfig`
 * imports this module, so a runtime import here would be a cycle.
 *
 * `hyper3dPresenceBaseline` is a runtime import and deliberately so — the settle
 * target must BE the accepted posture rather than a copy of its numbers.
 */
/**
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ACCEPTED PRODUCTION CONVERGENCE — 34 SOFT.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Hardware selected this configuration over both the pre-deadline follower and
 * Deadline 44, and it is now ordinary production configuration: it lives on the
 * `hyper3d-usc` transition profile below, beside `openSpeed` and `closeSpeed`,
 * and is read by the same code path that reads them. No query parameter, no
 * stored flag and no DEV panel is involved in a production frame.
 *
 *   cap 34            the convergence ceiling the comparison selected
 *   landing 0.5       the soft-landing exponent, `(1 - completion) ^ 0.5`
 *
 * MEASURED AT THESE VALUES, on the four aligned payloads:
 *
 *   median target reach        82.9 % -> 86.2 %   (pre-deadline -> 34 SOFT)
 *   reach <= 70 ms labels      78.8 % -> 82.0 %
 *   final-approach velocity    p50 -13.8 %, p90 -8.3 %   (against 34 BASELINE)
 *   arrival velocity           p50 -22 %, p90 -25 %      (against 34 BASELINE)
 *   rendered path rate         38.76 -> 41.29 mm/s
 *   jaw open-close cycles      1.18 -> 1.18 per second    UNCHANGED
 *   bilabial closure timing    16.7 ms -> 16.7 ms         UNCHANGED
 *   timeline drift             0.000 ms
 *
 * WHY IT IS A `MouthTransitionProfile` FIELD AND NOT A GLOBAL. The profile map
 * is keyed by `AvatarModelId` and only `hyper3d-usc` has an entry, so this
 * cannot reach another avatar even by accident — `getMouthTransitionProfile`
 * returns `undefined` for `female` and `miniface-male`, and the smoother's
 * deadline gate is `mouth?.deadline`. Scoping by construction rather than by a
 * caller's discipline is the same property the jaw asymmetry and the sentence
 * settle already rely on.
 */
export const HYPER3D_PRODUCTION_DEADLINE = Object.freeze({
  /** The convergence ceiling hardware selected. */
  maxSpeed: 34,
  /** The soft-landing exponent hardware selected. */
  landingExponent: 0.5
});

/**
 * HOW A DEV COMPARISON OVERRIDES PRODUCTION, and the only way it can.
 *
 * Three states, because promoting 34 SOFT to production created a third one
 * that did not previously exist:
 *
 *   `null` / absent   use the model's own profile. THE PRODUCTION PATH.
 *   `"off"`           strip the deadline — the pre-deadline follower, which is
 *                     what the comparison's `PRE-DEADLINE` mode shows.
 *   `{ ... }`         replace it, for `34 BASELINE`, `44` and the two rejected
 *                     landing candidates.
 *
 * Before 34 SOFT shipped, "no override" and "no deadline" were the same thing
 * and one nullable number expressed both. They are now different, and conflating
 * them is exactly how a DEV mode would silently become the production default —
 * so the off state is named rather than encoded as a falsy value.
 */
export type MouthDeadlineOverride =
  | null
  | "off"
  | { readonly maxSpeed: number; readonly landingExponent: number | null };

export const mouthTransitionProfiles: Partial<Record<AvatarModelId, MouthTransitionProfile>> = {
  "hyper3d-usc": {
    openSpeed: 24,
    closeSpeed: 9,
    sealClosureThreshold: 0.5,
    lipShapeSpeed: 24,
    settle: { speed: 11, target: hyper3dPresenceBaseline },
    /**
     * THE ACCEPTED 34 SOFT CONVERGENCE, as production configuration.
     *
     * Every value above is untouched by its arrival: the jaw still opens at 24
     * and closes at 9, the seal threshold is still 0.5, lip shapes still follow
     * at 24 and the sentence settle still runs at 11. The deadline layer is a
     * FLOOR on that follower and never a replacement for it — see
     * `deadlineConvergenceSpeed`, which returns `baselineSpeed` itself whenever
     * it does not apply.
     */
    deadline: hyper3dDeadlineProfile(
      HYPER3D_PRODUCTION_DEADLINE.maxSpeed,
      HYPER3D_PRODUCTION_DEADLINE.landingExponent
    )
  }
};

export const getMouthTransitionProfile = (modelId: AvatarModelId | undefined) =>
  (modelId ? mouthTransitionProfiles[modelId] : undefined) ?? undefined;

/**
 * The same transition profile with a deadline cap attached, for the DEV
 * comparison. THE ONLY WAY A DEADLINE CAN EXIST.
 *
 * Three properties, and all three are load-bearing:
 *
 *   `null` RETURNS THE SAME OBJECT. Not a copy with `deadline: undefined` — the
 *   identical reference, so OFF is not merely equivalent to production, it IS
 *   production with no new object anywhere on the frame path.
 *
 *   NO PROFILE, NO DEADLINE. A model without a measured transition profile is
 *   `undefined` and stays `undefined` whatever cap is asked for, which is what
 *   makes this layer structurally `hyper3d-usc`-only rather than only-by-caller.
 *
 *   CACHED PER (profile, cap). The frame path calls this 60 times a second and
 *   must not allocate; the cache is keyed on the profile object so a profile
 *   change cannot be served a stale deadline.
 */
const deadlineProfileCache = new WeakMap<MouthTransitionProfile, Map<string, MouthTransitionProfile>>();

export const withMouthDeadline = (
  profile: MouthTransitionProfile | undefined,
  maxSpeed: number | null | undefined,
  /**
   * SOFT LANDING exponent, or absent for the measured Deadline 34 baseline.
   * Part of the cache key, so a baseline profile and a landed profile are
   * different objects and neither can be served the other.
   */
  landingExponent?: number | null
): MouthTransitionProfile | undefined => {
  if (!profile || maxSpeed === null || maxSpeed === undefined) return profile;
  if (!Number.isFinite(maxSpeed) || maxSpeed <= 0) return profile;
  let byCap = deadlineProfileCache.get(profile);
  if (!byCap) {
    byCap = new Map();
    deadlineProfileCache.set(profile, byCap);
  }
  const landing =
    landingExponent !== null && landingExponent !== undefined && Number.isFinite(landingExponent) && landingExponent > 0
      ? landingExponent
      : undefined;
  const key = landing === undefined ? `${maxSpeed}` : `${maxSpeed}/${landing}`;
  const cached = byCap.get(key);
  if (cached) return cached;
  const built: MouthTransitionProfile = Object.freeze({
    ...profile,
    deadline: hyper3dDeadlineProfile(maxSpeed, landing)
  });
  byCap.set(key, built);
  return built;
};

/**
 * The same profile with its deadline REMOVED — the pre-deadline follower.
 *
 * Only the DEV comparison's `PRE-DEADLINE` mode reaches this, and it exists
 * because promoting 34 SOFT into the profile means "no deadline" is now a
 * DEPARTURE from production rather than its default. Cached, so the mode costs
 * no allocation while it is selected.
 */
const noDeadlineCache = new WeakMap<MouthTransitionProfile, MouthTransitionProfile>();

export const withoutMouthDeadline = (
  profile: MouthTransitionProfile | undefined
): MouthTransitionProfile | undefined => {
  if (!profile || profile.deadline === undefined) return profile;
  const cached = noDeadlineCache.get(profile);
  if (cached) return cached;
  const { deadline: _removed, ...rest } = profile;
  const built: MouthTransitionProfile = Object.freeze({ ...rest });
  noDeadlineCache.set(profile, built);
  return built;
};

/**
 * THE ONE ENTRY POINT THE FRAME PATH USES. Applies a DEV override to a model's
 * profile, or returns that profile untouched when there is none.
 *
 * `null` RETURNS THE PROFILE BY IDENTITY — not a copy — so a production frame
 * allocates nothing and runs the accepted 34 SOFT configuration that the profile
 * itself carries. That is the whole production path: one function call that gives
 * back its own argument.
 *
 * A model with no transition profile stays `undefined` whatever the override
 * says, which is what keeps every other avatar unable to acquire a deadline.
 */
export const resolveMouthDeadline = (
  profile: MouthTransitionProfile | undefined,
  override: MouthDeadlineOverride
): MouthTransitionProfile | undefined => {
  if (!profile || override === null || override === undefined) return profile;
  if (override === "off") return withoutMouthDeadline(profile);
  return withMouthDeadline(profile, override.maxSpeed, override.landingExponent);
};

/**
 * The channels the settle may move. Everything articulation writes, so a pause
 * cannot leave a stale phoneme shape on the face — and nothing else, so brows,
 * cheeks, gaze, blink and the head are untouched by it.
 */
export const MOUTH_SETTLE_CHANNELS: readonly string[] = Object.freeze([
  "jawOpen", "jawForward", "jawLeft", "jawRight",
  "mouthClose", "mouthPressLeft", "mouthPressRight",
  ...LIP_SHAPE_CHANNELS,
  "mouthRollUpper"
]);

const MOUTH_SETTLE_SET: ReadonlySet<string> = new Set(MOUTH_SETTLE_CHANNELS);
export const isMouthSettleChannel = (name: string) => MOUTH_SETTLE_SET.has(name);


