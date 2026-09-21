import type { BlendshapePose } from "../../types/facialAnimation";
import {
  calibrateHyper3dMorph,
  hyper3dExpressions,
  hyper3dGazeCalibration,
  hyper3dGazePose,
  hyper3dMorphCalibration
} from "../../mappings/avatars/hyper3dCalibration";
import { ARTICULATION_REFERENCE } from "./hyper3dFaceResolver";

/**
 * HYPER3D FACIAL LIVELINESS PASS.
 *
 * Hardware accepted the `threejs-talking-avatar` HEAD at 3.0x and rejected the
 * imported speaking brows, found the imported blink unnatural and found the
 * imported gaze invisible. This module holds everything that pass added, and
 * NOTHING it holds can reach the head: it produces morph influences only, and
 * the head/neck bone command is resolved elsewhere and is untouched.
 *
 * It holds the PRODUCTION warmth mapping and the DEVELOPER-MODE probes:
 *
 *   SPEAKING WARMTH        production. The inferred affect mapped onto the
 *                          ACCEPTED Hyper3D expression vocabulary, at one locked
 *                          strength, floored so it never switches off mid-phrase
 *   MANUAL GAZE PROBES     developer mode. LOOK LEFT/CENTER/RIGHT/UP/DOWN through
 *                          the SAME `hyper3dGazePose` adapter the runtime uses
 *   MANUAL NATURAL BLINK   developer mode. One clean symmetric blink on the SAME
 *                          blink morphs
 *
 * No new animation engine, no second smile rig, no random scheduler.
 */

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

const smoothstep01 = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------------------
// REPO SEMANTIC AFFECT -> the accepted Hyper3D expression vocabulary
// ---------------------------------------------------------------------------

/**
 * The custom SPEAKING WARMTH envelope is GONE.
 *
 * It passed hardware as directional proof — "a little smile makes the avatar
 * feel more alive" — but it was our own envelope over one authored pose. It is
 * replaced by upstream's real semantic affect: `inferPerformanceIntent` chooses
 * the affect, `planSemanticAffectEnvelope` shapes it, `AFFECT_TARGETS` gives the
 * channel values, and upstream's own staggered per-region timing delivers it.
 * All of that lives in `upstream/threejs-talking-avatar/`. What is left HERE is
 * only the rig mapping and the articulation yield.
 */

/**
 * Upstream's affect channels are GNM morph weights on a 0-1 scale where 1 is
 * that channel's full deflection. Writing them straight onto Hyper3D would put a
 * `warm` smile at 0.72 — past the accepted HYPER3D HAPPY (0.45) and near the
 * channel cap.
 *
 * So each upstream channel is mapped onto the ACCEPTED VOCABULARY'S OWN SCALE,
 * using the accepted full-affect entries as the reference for 1.0:
 * `happy` for the positive family and `curious` for the lid widening. Upstream's
 * `warm` peak then lands at mouthSmile 0.324 and cheekSquint 0.312 — between the
 * accepted GENTLE SMILE (0.22) and HAPPY (0.45). Visibly warm, not a grin, and
 * every value is anchored to a pose hardware has already reviewed.
 */
/**
 * Exported so `hyper3dPerformanceBaseline.ts` can hold it under the regression
 * contract. Visibility only — no value here changed when it was exported.
 */
export const AFFECT_REFERENCE = {
  mouthSmile: hyper3dExpressions.happy.pose.mouthSmileLeft ?? 0.45,
  cheekSquint: hyper3dExpressions.happy.pose.cheekSquintLeft ?? 0.38,
  mouthDimple: hyper3dExpressions.happy.pose.mouthDimpleLeft ?? 0.22,
  /**
   * EYE SOFTENING — the conversion that decides whether the eye joins the face.
   *
   * ─────────────────────────────────────────────────────────────────────────
   * ROUND ONE, and why it was not enough.
   * ─────────────────────────────────────────────────────────────────────────
   * Upstream's `eyeSquint` carries a real, moving signal. Mapped against the
   * accepted `happy` pose value of 0.14 it resolved to 0.055, under
   * `eyeSquintLeft`'s measured `usefulMin` of 0.10, so it rendered on **0 of
   * 1796 speaking frames**. That was corrected by SOLVING the reference so the
   * runtime PEAK lands exactly on the accepted pose:
   *
   *     0.271 (measured peak) x 0.36 x 1.45 = 0.141   <- accepted 0.14
   *
   * ─────────────────────────────────────────────────────────────────────────
   * ROUND TWO. Anchoring the PEAK on the threshold's far side is the defect.
   * ─────────────────────────────────────────────────────────────────────────
   * Hardware, comparing against the target: the mouth moves considerably while
   * the eyes appear comparatively unchanged. Measured through the production
   * stack with the real per-sentence semantics, the eye softening renders on
   *
   *     warm 9 %   positive 10 %   concerned 7 %   emphatic 4 %
   *
   * of speaking frames. The signal is there and it survives calibration — what
   * it does not do is clear `usefulMin` often enough to be PERCEIVED. Anchoring
   * the peak at 0.141 puts the signal's p90 at 0.093, a hair UNDER the 0.10 the
   * channel needs to render at all, so only the extreme top decile ever reaches
   * the rig. A cue that appears on one frame in eleven is not participation.
   *
   * This is the fifth rung of the diagnostic ladder — exists upstream, survives
   * calibration, clears `usefulMin`, survives yield, RENDERS FOR ENOUGH OF THE
   * PHRASE — and it is the only rung the whole-face audit found failing.
   *
   * ─────────────────────────────────────────────────────────────────────────
   * THE CORRECTION, by a stopping rule rather than a taste judgement.
   * ─────────────────────────────────────────────────────────────────────────
   * The reference is the value that puts the warm signal's own MEDIAN exactly on
   * the channel's render threshold:
   *
   *     p50 0.098 x 0.70 x 1.45 = 0.100   <- `eyeSquintLeft.usefulMin`
   *
   * so the softening is present for about half of a warm phrase and absent for
   * the quieter half, still varying 2.4x across it. Measured share, before and
   * after: warm 9 % -> 48 %, positive 10 % -> 31 %, concerned 7 % -> 43 %,
   * emphatic 4 % -> 37 %.
   *
   * THE PEAK is 0.246, which is 1.76x the accepted `happy` pose but only 55 % of
   * the channel's own `naturalMax` of 0.45 — 0.85 mm of lower-lid travel against
   * the 11.27 mm of a blink, so it is 7.5 % of a blink's movement. The accepted
   * vocabulary remains the reference for a HELD expression; this is a speaking
   * conversion, and a speaking face tightens the lower lid less than a posed one
   * but does it far more often.
   *
   * WHAT MAKES THIS SAFE, and it is structural rather than a tuning margin: the
   * term is multiplied by upstream's semantic `eyeSquint`, which is EXACTLY ZERO
   * on the neutral and question fixtures at every reference value tested from
   * 0.36 to 1.00. A neutral sentence cannot acquire an eye softening from this
   * change, because there is nothing to scale.
   *
   * NOT CHANGED: `eyeBlink`, which is where `RESTING_LID_CLOSURE` writes and
   * which stays independently owned and frozen. This is the LOWER lid.
   */
  eyeSquint: 0.7,
  eyeWide: hyper3dExpressions.curious.pose.eyeWideLeft ?? 0.14
} as const;

/**
 * THE PRODUCTION AFFECT REQUEST.
 *
 * Upstream infers affect from two inputs: the assistant's own text, and
 * `requestedAffect(userText)` — a regex over what the conversation partner asked
 * for, in their own words. Our payload carries no user turn, so this supplies
 * one, and it is a PRODUCTION CONSTANT rather than a review text box: the
 * delivery this avatar is meant to give is fixed, and letting a reviewer retype
 * it made the shipped expression depend on the panel.
 *
 * Upstream resolves this string to `affect: warm, intensity 0.80, confidence
 * 0.96, source: requested-emotion` — its real path, used as designed. The spoken
 * text alone resolves to `neutral, intensity 0.32`, which is correct for
 * affectively flat prose and renders as no warmth at all.
 */
export const HYPER3D_PRODUCTION_AFFECT_REQUEST = "please sound warm and friendly";

/**
 * FINAL WARMTH STRENGTH — one value, no levels.
 *
 * The WARM 1 / 2 / 3 bracket did its job and is gone. It was an AMPLITUDE
 * bracket, and amplitude turned out not to be the mismatch: upstream's affect
 * envelope decayed to a 0.13 residue after 1.5 s and stayed there, so at every
 * level the face was neutral for 96 % of the clip. That is fixed in
 * `performance.ts` by running upstream's envelope PER PHRASE with a speaking
 * floor, which changes what the amplitude is multiplying.
 *
 * Against that corrected envelope, and the accepted Hyper3D vocabulary
 * (GENTLE SMILE 0.22 · HAPPY 0.45 · channel cap 0.55), 1.45 puts:
 *
 *   speaking median `mouthSmileLeft`   ~0.22   the accepted GENTLE SMILE
 *   phrase-apex peak                   ~0.35   between GENTLE SMILE and HAPPY
 *   pause floor                        ~0.10   present, well below a smile
 *
 * — a mild engaged set that is always there, lifts a little at each phrase, and
 * softens into every pause. It is deliberately short of HAPPY: a permanent
 * expression must sit below the amplitude an OCCASIONAL one is allowed.
 */
export const HYPER3D_WARMTH_SCALE = 1.45;

export const HYPER3D_WARMTH = {
  scale: HYPER3D_WARMTH_SCALE,
  /**
   * How much of the warmth survives a full bilabial seal or a fully rounded
   * vowel. The brief: "Do not make warmth disappear completely between words."
   * The unfloored yield reaches EXACTLY zero on every P/B/M and every rounded
   * vowel, which is a visible flicker of the whole mid-face several times a
   * second. A real smile does not switch off to say /b/ — the corners relax and
   * the cheeks stay up — so the yield is floored rather than removed, and the
   * floor is higher for the cheeks, which barely fight the lips at all.
   */
  mouthYieldFloor: 0.4,
  cheekYieldFloor: 0.72
} as const;

/**
 * Channels the affect layer is allowed to touch. Mouth CORNERS, cheeks and lids.
 *
 * Deliberately absent: `jawOpen`, `mouthClose`, `mouthFunnel`, `mouthPucker`,
 * `mouthPress*`, `mouthRoll*`, `mouthShrug*`, `mouthFrown*`, `mouthUpperUp*`,
 * `mouthLowerDown*`, `mouthLeft/Right`. OUR MFA LIP SYNC OWNS THE CENTRAL MOUTH
 * AND JAW, and this layer cannot reach them because it never names them.
 *
 * Also absent: every brow channel. Brows stay OFF — see `affectBrowPose`.
 */
export const HYPER3D_AFFECT_CHANNELS = [
  "mouthSmileLeft",
  "mouthSmileRight",
  "cheekSquintLeft",
  "cheekSquintRight",
  "mouthDimpleLeft",
  "mouthDimpleRight",
  "eyeSquintLeft",
  "eyeSquintRight",
  "eyeWideLeft",
  "eyeWideRight"
] as const;

/**
 * Upstream affect channels with NO Hyper3D equivalent this layer will use.
 *
 * `surpriseMouth`, `concernMouth`, `curiosityMouth` and `emphasisMouth` are
 * upstream's CENTRAL-mouth affect shapes. Our MFA lip sync owns that region, and
 * the accepted Hyper3D vocabulary expresses those affects through `mouthPress*`
 * and `mouthFrown*`, which are also central. They are dropped rather than
 * redirected onto some other channel, and reported so the gap is visible.
 *
 * Consequence, stated plainly: with brows off and the central mouth reserved,
 * only the POSITIVE affect family (`warm`) has Hyper3D channels left to express
 * itself through. `concerned` and `emphatic` are brow-and-central-mouth affects
 * on this asset and will render as very nearly nothing.
 */
export const HYPER3D_UNMAPPED_AFFECT_CHANNELS = [
  "surpriseMouth",
  "concernMouth",
  "curiosityMouth",
  "emphasisMouth"
] as const;

export interface UpstreamAffectFrame {
  readonly smileMouth: number;
  readonly cheekRaise: number;
  readonly eyeSquint: number;
  readonly eyeWiden: number;
  readonly browConcern: number;
  readonly browLift: number;
  readonly browFurrow: number;
}

/**
 * How far affect yields to articulation.
 *
 * A corner pull fights two things: a bilabial seal, where the lips must meet and
 * a smile drags them apart, and a rounded vowel, where the lips must purse and a
 * smile widens them. Both already have an explicit demand signal in the
 * pipeline, so this reads them rather than guessing from the phoneme label.
 *
 * MEASURED CAVEAT, recorded rather than hidden: on the Hyper3D path
 * `lowerFaceIntent.bilabialClosure` is **0 for every frame of the production
 * clip**. It is `closureIntent * bilabialIntent`, and `closureIntent` comes from
 * the coordinated speech-deformation controller, which this asset's profile does
 * not enable. The first factor is therefore inert here and the whole yield is
 * carried by the `rounding` term — which includes `mouthClose`, i.e. the bilabial
 * seal itself, so the behaviour is correct. The parameter is kept because it is
 * live on the Female path and because inventing a substitute signal would be
 * worse than an honest no-op.
 */
export const affectArticulationYield = (
  bilabialClosure: number,
  speechPose: BlendshapePose
): number => {
  /**
   * ───────────────────────────────────────────────────────────────────────────
   * THE SEAL NORMALISATION. Reported by an earlier pass, corrected here.
   * ───────────────────────────────────────────────────────────────────────────
   *
   * THE DEFECT, measured through the production stack over five payloads: at a
   * bilabial the mouth corners gave up 3.3 % of their warmth, against 15.5 % at
   * a rounded vowel. The brief's desired behaviour is that P/B/M yields the
   * corners VISIBLY, so the lips can meet.
   *
   * THE CAUSE was a unit mismatch, not a tuning opinion. This function used to
   * take `max(pucker, funnel, mouthClose)` and normalise all three by the same
   * factor of 2. But the three channels live on completely different scales on
   * this asset:
   *
   *   channel       full articulation      x2 gives
   *   mouthPucker   0.4872 on UW           0.97   -> essentially full yield
   *   mouthFunnel   0.1650 on UW           0.33
   *   mouthClose    0.1014 on M            0.20   -> a FULL SEAL asked for 20 %
   *
   * `mouthClose` has the smallest gain in the calibration table BY DESIGN —
   * 0.11, because the channel counteracts `jawOpen` and overshoots above ~0.12 —
   * so a completely sealed pair of lips only ever reaches 0.101. Multiplying
   * that by 2 asks for a fifth of the yield a full round asks for, and the
   * corners barely move.
   *
   * THE CORRECTION uses the constant the resolver already publishes for exactly
   * this purpose — `ARTICULATION_REFERENCE.seal`, which IS the measured 0.101376
   * of a full seal — instead of the generic x2. Rounding keeps its existing x2,
   * so the accepted O/U behaviour is untouched. Seal and rounding then compete
   * on a common 0..1 scale by MAX, which is what the region resolver next door
   * already does with the same two signals.
   *
   * WHAT THIS DOES NOT DO: it never touches `mouthClose` itself. The seal is
   * produced by `bilabialSeal` in the coarticulation engine and arrives here
   * already resolved; this function only reads it. The lips close exactly as
   * hard as they did, and the P/B/M seal is asserted bit-identical.
   */
  const seal = clamp01((speechPose.mouthClose ?? 0) / ARTICULATION_REFERENCE.seal);
  const rounding = clamp01(
    Math.max(speechPose.mouthPucker ?? 0, speechPose.mouthFunnel ?? 0) * 2
  );
  return clamp01(1 - clamp01(bilabialClosure)) * clamp01(1 - Math.max(seal, rounding));
};

/**
 * HOW FAST THE WARMTH GETS OUT OF THE WAY, AND HOW FAST IT COMES BACK.
 *
 * The raw yield tracks the articulation demand INSTANTANEOUSLY, and since the
 * bilabial seal releases inside one 60 Hz frame — deliberately, so the following
 * vowel is visible immediately — that put a **0.212 single-frame step** on
 * `mouthSmileLeft`, on all 40 bilabials in the clip. The corners snapping back
 * the instant the lips part is exactly the "expression snaps between states"
 * the coordination brief rules out.
 *
 * A real face does not do that either: the corners relax out of the way quickly
 * and return over roughly a tenth of a second. So the yield is followed
 * asymmetrically — fast down, slower up — which leaves the lip release exactly
 * as fast as it was and only changes how the SMILE responds to it.
 *
 * An eased (`smoothstep`) yield curve was tried first and measured WORSE
 * (0.124 against 0.112 worst step), because smoothstep is steeper than a
 * straight line through the middle of its range, which is where most of the
 * traversal happens. The problem was the rate, not the shape.
 */
export const HYPER3D_WARMTH_YIELD_ATTACK_SECONDS = 0.035;
export const HYPER3D_WARMTH_YIELD_RELEASE_SECONDS = 0.11;

/**
 * One-pole follower on the articulation yield. Stateful across frames, so one
 * instance per mounted avatar, reset with the rest of the performance.
 */
export class Hyper3dWarmthYieldFollower {
  private value = 1;

  reset(): void {
    this.value = 1;
  }

  /** `rawYield` is `affectArticulationYield`; returns the followed value. */
  step(rawYield: number, deltaSeconds: number): number {
    const target = clamp01(rawYield);
    const tau =
      target < this.value
        ? HYPER3D_WARMTH_YIELD_ATTACK_SECONDS
        : HYPER3D_WARMTH_YIELD_RELEASE_SECONDS;
    const dt = Math.max(0, Math.min(0.1, deltaSeconds));
    this.value += (target - this.value) * (1 - Math.exp(-dt / Math.max(1e-4, tau)));
    return clamp01(this.value);
  }

  get current(): number {
    return this.value;
  }
}

/**
 * The same yield, floored.
 *
 * Floored so warmth never reaches zero mid-phrase — see `HYPER3D_WARMTH`.
 *
 * Linear in the articulation demand on purpose: an eased curve was measured and
 * made the worst single-frame step LARGER (0.124 against 0.112), because
 * `smoothstep` is steeper in the middle of its range than a straight line and
 * that is where most of the traversal happens.
 */
export const flooredYield = (rawYield: number, floor: number): number =>
  floor + (1 - floor) * clamp01(rawYield);

/**
 * The affect influences to write. Already enveloped and intensity-scaled by the
 * upstream layer; this only maps and yields.
 */
export const hyper3dAffectPose = (
  frame: UpstreamAffectFrame,
  bilabialClosure: number,
  speechPose: BlendshapePose,
  scale: number = HYPER3D_WARMTH.scale,
  /**
   * The FOLLOWED articulation yield, from `Hyper3dWarmthYieldFollower`. Omitted
   * in the pure-mapping tests, where the instantaneous yield is what is under
   * test; production always passes the followed value.
   */
  followedYield?: number
): BlendshapePose => {
  const rawYield =
    followedYield ?? affectArticulationYield(bilabialClosure, speechPose);
  const warmth = scale;
  const pose: BlendshapePose = {};
  const put = (name: string, value: number) => {
    const entry = hyper3dMorphCalibration[name];
    // Below the channel's MEASURED useful minimum nothing renders, so writing it
    // would only leave an invisible residue after the release.
    if (value <= (entry?.usefulMin ?? 1e-4)) return;
    pose[name] = Math.min(value, entry?.cap ?? 1);
  };
  // Lids do NOT yield to lip articulation — they are nowhere near the mouth.
  const lid = warmth;
  const mouth = flooredYield(rawYield, HYPER3D_WARMTH.mouthYieldFloor) * warmth;
  const cheek = flooredYield(rawYield, HYPER3D_WARMTH.cheekYieldFloor) * warmth;
  put("mouthSmileLeft", frame.smileMouth * AFFECT_REFERENCE.mouthSmile * mouth);
  put("mouthSmileRight", frame.smileMouth * AFFECT_REFERENCE.mouthSmile * mouth);
  put("mouthDimpleLeft", frame.smileMouth * AFFECT_REFERENCE.mouthDimple * mouth);
  put("mouthDimpleRight", frame.smileMouth * AFFECT_REFERENCE.mouthDimple * mouth);
  put("cheekSquintLeft", frame.cheekRaise * AFFECT_REFERENCE.cheekSquint * cheek);
  put("cheekSquintRight", frame.cheekRaise * AFFECT_REFERENCE.cheekSquint * cheek);
  /**
   * THE EYE SOFTENING. Lids do not yield to lip articulation, so this is the one
   * region that stays coordinated with the smile through a bilabial. It renders
   * only where upstream's signal is strong — see `AFFECT_REFERENCE.eyeSquint`.
   */
  put("eyeSquintLeft", frame.eyeSquint * AFFECT_REFERENCE.eyeSquint * lid);
  put("eyeSquintRight", frame.eyeSquint * AFFECT_REFERENCE.eyeSquint * lid);
  put("eyeWideLeft", frame.eyeWiden * AFFECT_REFERENCE.eyeWide * lid);
  put("eyeWideRight", frame.eyeWiden * AFFECT_REFERENCE.eyeWide * lid);
  return pose;
};

/**
 * NO BROW MAPPING LIVES HERE.
 *
 * There used to be a `hyper3dAffectBrowPoseForReview` — a second brow mapping,
 * computed so the next review could see what semantic brows would do without
 * enabling them. Semantic brows now SHIP, with their own asset-calibrated
 * mapping in `hyper3dThreejsTalkingAvatarHead.ts`, so a second copy is a
 * liability: two tables to tune and only one of them wired to the rig. It is
 * deleted rather than left as a duplicate.
 *
 * This layer writes the mouth corners, cheeks and lids only.
 */

// ---------------------------------------------------------------------------
// MANUAL GAZE PROBES
// ---------------------------------------------------------------------------

export type Hyper3dGazeProbeId = "left" | "center" | "right" | "up" | "down";

/**
 * The five probes, expressed as upstream-domain gaze so they travel the IDENTICAL
 * path a runtime performance frame does: normalised gaze -> degree conversion ->
 * `hyper3dGazePose` -> `eyeLook*` influences. There is no second eye
 * implementation anywhere in this module.
 *
 * Each probe is FULL deflection, so it lands exactly on the existing rails
 * (yaw +/-14 deg, up +7 deg, down -4.5 deg). If both eyeballs visibly travel
 * under these buttons, the mapping is proven and any invisibility at runtime is
 * an amplitude question, not a wiring question.
 */
export const HYPER3D_GAZE_PROBES: Record<Hyper3dGazeProbeId, { gazeX: number; gazeY: number }> = {
  left: { gazeX: -1, gazeY: 0 },
  center: { gazeX: 0, gazeY: 0 },
  right: { gazeX: 1, gazeY: 0 },
  up: { gazeX: 0, gazeY: 1 },
  down: { gazeX: 0, gazeY: -1 }
};

// ---------------------------------------------------------------------------
// BLINK SHAPE CALIBRATION
// ---------------------------------------------------------------------------

/**
 * BOTH the automatic and the manual blink failed on hardware, which rules out
 * cadence as the sole cause: the same trajectory looked wrong fired by a
 * scheduler and fired by hand. So this is a SHAPE calibration, and deliberately
 * only three versions.
 *
 * All three drive the same `eyeBlinkLeft` / `eyeBlinkRight` morphs, through the
 * same existing calibration, with both eyes exactly synchronised. They differ
 * only in the trajectory, which is what isolates the remaining hypotheses:
 *
 *   CURRENT  the existing path. 52 ms close, 18 ms hold, 105 ms open, peak 1.00.
 *   SOFT     lower peak and a much smoother reopen. Tests (D) excessive lid
 *            compression and (G) the blendshape itself looking wrong at 1.0.
 *   HUMAN    quicker close, a tiny closed interval, slower reopen. Tests
 *            (A) closure too fast, (B) reopen too fast and (C) wrong dwell.
 *
 * Hypothesis (E), asymmetric L/R closure, is already removed from all three.
 * Upstream randomises per-eye strength (left 0.94-1.00, right 0.90-0.98) and the
 * Hyper3D calibration then applies a 1.05 side-balance gain to the LEFT target
 * only, so an upstream blink lands the left lid at ~1.00 and the right at
 * 0.90-0.98 — the right lid never fully closes. Here both eyes request the SAME
 * value at the SAME instant, and the side-balance gain is kept precisely so
 * their VISIBLE TRAVEL matches: at SOFT's 0.88 the influences are 0.924 and
 * 0.880, which measure 10.41 mm and 10.43 mm of lid travel. Equal movement, not
 * equal numbers.
 */
export type Hyper3dBlinkShapeId = "current" | "soft" | "human";

export interface Hyper3dBlinkShape {
  readonly id: Hyper3dBlinkShapeId;
  readonly label: string;
  readonly closeSeconds: number;
  readonly holdSeconds: number;
  readonly openSeconds: number;
  readonly peak: number;
  readonly note: string;
}

export const HYPER3D_BLINK_SHAPES: Record<Hyper3dBlinkShapeId, Hyper3dBlinkShape> = {
  current: {
    id: "current",
    label: "BLINK CURRENT",
    closeSeconds: 0.052,
    holdSeconds: 0.018,
    openSeconds: 0.105,
    peak: 1,
    note: "Upstream's own eyelid shape, unchanged. The reference the other two are judged against."
  },
  soft: {
    id: "soft",
    label: "BLINK SOFT",
    closeSeconds: 0.06,
    holdSeconds: 0.01,
    openSeconds: 0.15,
    peak: 0.88,
    note: "Lower peak closure and a much gentler reopen. If this reads better, the fault is lid compression at 1.0 rather than timing."
  },
  human: {
    id: "human",
    label: "BLINK HUMAN",
    closeSeconds: 0.038,
    holdSeconds: 0.012,
    openSeconds: 0.165,
    peak: 1,
    note: "Quick close, a brief closed interval, distinctly slower reopen. If this reads better, the fault is the close/open ratio rather than the geometry."
  }
};

export const hyper3dBlinkShapeSeconds = (shape: Hyper3dBlinkShape): number =>
  shape.closeSeconds + shape.holdSeconds + shape.openSeconds;

/** The eyelid value of one shape at a given time into the blink, 0-1. */
export const sampleHyper3dBlinkShape = (
  shape: Hyper3dBlinkShape,
  elapsedSeconds: number
): number => {
  const { closeSeconds, holdSeconds, openSeconds, peak } = shape;
  if (elapsedSeconds < 0 || elapsedSeconds >= closeSeconds + holdSeconds + openSeconds) return 0;
  if (elapsedSeconds < closeSeconds) return peak * smoothstep01(elapsedSeconds / closeSeconds);
  if (elapsedSeconds < closeSeconds + holdSeconds) return peak;
  return (
    peak * (1 - smoothstep01((elapsedSeconds - closeSeconds - holdSeconds) / openSeconds))
  );
};

/** The blink influences to write. Both eyes synchronised, through the calibration. */
export const hyper3dBlinkPose = (
  shape: Hyper3dBlinkShape,
  elapsedSeconds: number
): BlendshapePose => {
  const value = sampleHyper3dBlinkShape(shape, elapsedSeconds);
  if (value <= 1e-4) return {};
  // The side-balance gain stays: `eyeBlinkLeft` travels 5% less per unit, so
  // equal INFLUENCE would not be equal visible closure. Equal visible closure is
  // the point of a synchronised calibration.
  return {
    eyeBlinkLeft: Math.min(1, calibrateHyper3dMorph("eyeBlinkLeft", value)),
    eyeBlinkRight: Math.min(1, calibrateHyper3dMorph("eyeBlinkRight", value))
  };
};

/** One frame-by-frame trace of a blink, for the shape report. */
export interface Hyper3dBlinkTraceRow {
  timeMs: number;
  request: number;
  eyeBlinkLeft: number;
  eyeBlinkRight: number;
  /** Change in requested closure per second — the derivative hypothesis (F). */
  slopePerSecond: number;
}

export const traceHyper3dBlink = (
  shape: Hyper3dBlinkShape,
  stepSeconds = 1 / 120
): Hyper3dBlinkTraceRow[] => {
  const rows: Hyper3dBlinkTraceRow[] = [];
  const total = hyper3dBlinkShapeSeconds(shape);
  let previous = 0;
  for (let t = 0; t <= total + stepSeconds; t += stepSeconds) {
    const request = sampleHyper3dBlinkShape(shape, t);
    const pose = hyper3dBlinkPose(shape, t);
    rows.push({
      timeMs: t * 1000,
      request,
      eyeBlinkLeft: pose.eyeBlinkLeft ?? 0,
      eyeBlinkRight: pose.eyeBlinkRight ?? 0,
      slopePerSecond: (request - previous) / stepSeconds
    });
    previous = request;
  }
  return rows;
};

/**
 * JAW IS PARKED.
 *
 * The OPEN-VOWEL JAW+ experiment (1.25x on AA/AE/AH/AW/AY/EH/ER) was
 * hardware-rejected: it read effectively the same and made P/B/M worse. It has
 * been REMOVED, not merely switched off, so the accepted MFA lip-sync and
 * Hyper3D jaw calibration are the only things that can produce `jawOpen`.
 * Nothing in this module names a jaw channel.
 */

// ---------------------------------------------------------------------------
// gaze telemetry
// ---------------------------------------------------------------------------

/** Everything the panel needs to answer "why are the eyes not moving". */
export interface Hyper3dGazeTrace {
  gazeXRaw: number;
  gazeYRaw: number;
  yawDegrees: number;
  pitchDegrees: number;
  /** After `gazeScale`, i.e. degrees of real eyeball rotation. */
  eyeballYawDegrees: number;
  eyeballPitchDegrees: number;
  influences: BlendshapePose;
  /** The influence a full-rail look would produce, for scale. */
  fullRailInfluence: number;
}

export const traceHyper3dGaze = (
  gazeX: number,
  gazeY: number,
  yawDegrees: number,
  pitchDegrees: number
): Hyper3dGazeTrace => ({
  gazeXRaw: gazeX,
  gazeYRaw: gazeY,
  yawDegrees,
  pitchDegrees,
  eyeballYawDegrees: yawDegrees * hyper3dGazeCalibration.gazeScale,
  eyeballPitchDegrees: pitchDegrees * hyper3dGazeCalibration.gazeScale,
  influences: hyper3dGazePose(yawDegrees, pitchDegrees),
  fullRailInfluence:
    hyper3dGazeCalibration.maxYawDegrees / hyper3dGazeCalibration.degreesPerUnitHorizontal
});
