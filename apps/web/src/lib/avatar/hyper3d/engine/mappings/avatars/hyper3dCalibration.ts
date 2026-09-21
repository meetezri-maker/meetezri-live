import type { BlendshapePose } from "../../types/facialAnimation";

/**
 * Hyper3D USC calibration profile.
 *
 * This exists so the asset can be calibrated WITHOUT touching any global
 * controller value. Nothing here changes speech timing, MFA alignment, the
 * TalkingHead carrier, blink scheduling, idle logic or performance state. The
 * controller emits exactly what it always emitted; this table is the last thing
 * applied before the morph is written, and it only scales and caps by SEMANTIC
 * NAME. Female.228 never reaches this file.
 *
 * Every number below is derived from geometry measured on the shipped
 * `additional_body.fbx`, not estimated. Units are the asset's own centimetres,
 * reported here in millimetres (1 model unit = 10 mm).
 *
 * The two facts that drive most of the calibration:
 *
 * 1. **This asset is much stronger than Female.228.** `jawOpen` travels 35.19 mm
 *    and opens the lips by 37.5 mm at influence 1.0 — a scream. `mouthSmile`
 *    widens the mouth 33% at 1.0. Almost nothing here should ever be driven to
 *    1.0, so the calibration is mostly about REDUCING controller output rather
 *    than compensating for weak geometry. That is the opposite of the Female.228
 *    problem and is why its compensation recipes are deliberately not reused.
 *
 * 2. **`mouthClose` is authored with true ARKit semantics**: it is the delta that
 *    re-closes the lips while the jaw is open (peak +25.28 mm upward, against
 *    `jawOpen`'s -32.92 mm downward). Driven alone past ~0.12 it pushes the lower
 *    lip THROUGH the upper one — measured lip gap goes 4.20 mm at rest, 0.15 mm
 *    at influence 0.10, then back up to 4.31 mm at 0.20 and 8.57 mm at 0.30 as
 *    the lower lip overshoots. It therefore gets the smallest gain and the
 *    tightest cap in the table.
 */

/**
 * HYPER3D ACCEPTED BASELINE — LOCKED after hardware review.
 *
 * Hardware signed off on this exact configuration:
 *
 *   head speed              PASS
 *   coordination            MUCH BETTER
 *   presence                PASS
 *   unwanted head drift     NONE
 *
 * These four values, the calibration table below, the presence baseline, the
 * `hyper3dCoordinated` conductor timing and the naturalism gains in
 * `idleExpressionProfiles` are all regression-protected by
 * `src/tests/hyper3dAcceptedBaseline.test.ts`, which pins them EXACTLY.
 *
 * Do not retune any of it unless a future hardware test shows a clear
 * regression. If one of those tests fails, the fix is to find out what changed —
 * not to update the expected number. A new value needs a new hardware sign-off.
 */
export const HYPER3D_ACCEPTED_BASELINE = {
  /** The review preset hardware accepted. */
  reviewPresetId: "hyper3d-presence",
  /** TalkingHead CENTER + GAZE carrier, at the accepted speed. */
  talkingHeadTuningId: "thFinal190",
  cadence: 1.9,
  /** Coordination timing: gaze 0 ms, head +45, brow +70, cheek +95. */
  conductorTuningId: "hyper3dCoordinated",
  /** Keeps a share of the idle exploratory head alive through established speech. */
  speakingIdleFloor: 0.18
} as const;

export type MorphVerdict = "PASS" | "WEAK" | "BROKEN";

export interface Hyper3dMorphCalibration {
  /** Peak vertex travel at influence 1.0, in millimetres, measured on the FBX. */
  travelMM: number;
  /** Multiplier applied to the controller's output for this channel. */
  gain: number;
  /** Hard ceiling on the final influence. Production safety, not a suggestion. */
  cap: number;
  /** Smallest influence that produces a visible change on hardware. */
  usefulMin: number;
  /** Largest influence that still reads as a real face. */
  naturalMax: number;
  /** Largest influence that is legible but theatrical. Above this it distorts. */
  exaggeratedMax: number;
  verdict: MorphVerdict;
  note: string;
}

/**
 * The HC1 calibration table.
 *
 * `usefulMin` is the influence at which travel reaches ~0.35 mm, which is the
 * point a facial change becomes visible at the head-framed camera distance.
 * `naturalMax` and `exaggeratedMax` come from the measured aperture/width
 * ladders (see the P/B/M and smile tables in the pass notes).
 */
export const hyper3dMorphCalibration: Record<string, Hyper3dMorphCalibration> = {
  // ---- jaw ------------------------------------------------------------------
  jawOpen: {
    travelMM: 35.19, gain: 0.7, cap: 0.55, usefulMin: 0.02, naturalMax: 0.4, exaggeratedMax: 0.55, verdict: "PASS",
    // Lip gap: 0.25 -> 13.6 mm, 0.35 -> 17.3 mm, 0.5 -> 23.0 mm, 1.0 -> 41.7 mm.
    // Conversational AA sits near 15-18 mm, so the canonical AA demand of 0.5
    // becomes 0.35. The cap allows a shout but not a dislocated jaw.
    note: "Very strong. 1.0 is a 41.7 mm gape. Canonical AA (0.5) is scaled to 0.35 = 17.3 mm."
  },
  jawForward: { travelMM: 10.13, gain: 0.8, cap: 0.4, usefulMin: 0.04, naturalMax: 0.3, exaggeratedMax: 0.4, verdict: "PASS", note: "Clean forward slide; rarely needed above 0.3." },
  jawLeft: { travelMM: 9.39, gain: 0.8, cap: 0.35, usefulMin: 0.04, naturalMax: 0.25, exaggeratedMax: 0.35, verdict: "PASS", note: "Lateral jaw; symmetric with jawRight to 1.1%." },
  jawRight: { travelMM: 9.29, gain: 0.8, cap: 0.35, usefulMin: 0.04, naturalMax: 0.25, exaggeratedMax: 0.35, verdict: "PASS", note: "Lateral jaw; symmetric with jawLeft to 1.1%." },

  // ---- bilabial seal --------------------------------------------------------
  mouthClose: {
    travelMM: 34.65, gain: 0.11, cap: 0.18, usefulMin: 0.03, naturalMax: 0.12, exaggeratedMax: 0.18, verdict: "PASS",
    // Measured seal ladder at jaw 0: 0.10 -> 0.15 mm gap (sealed), 0.15 -> 2.19,
    // 0.20 -> 4.31 (back to rest), 0.30 -> 8.57 (lower lip through upper).
    // Canonical P/B/M demand is 0.78/0.84/0.96, so gain 0.11 lands them on
    // 0.086/0.092/0.106 — inside the sealing band — and the cap forbids
    // overshoot. Verified end-to-end through the real profile: P 0.65 mm,
    // B 0.66 mm, M 2.10 mm of residual lip gap against a 4.20 mm rest.
    // Gain 0.125 was tried first and pushed M to 0.115, which measured 2.69 mm:
    // past the optimum and already re-opening.
    note: "ARKit semantics: counteracts jawOpen. Optimum 0.10 (0.15 mm gap); overshoots above ~0.12. Smallest gain in the table by design."
  },
  mouthPressLeft: {
    travelMM: 4.65, gain: 1, cap: 0.9, usefulMin: 0.08, naturalMax: 0.6, exaggeratedMax: 0.9, verdict: "WEAK",
    note: "Weak: the pair only closes 1.66 mm at 1.0 and cannot seal alone. Correct role is lateral compression alongside mouthClose."
  },
  mouthPressRight: {
    travelMM: 3.69, gain: 1.26, cap: 0.9, usefulMin: 0.08, naturalMax: 0.6, exaggeratedMax: 0.9, verdict: "WEAK",
    note: "Weak, and 21% shorter travel than the left. Gain 1.26 = 4.65/3.69 side-balance so a bilabial is not lopsided."
  },

  // ---- rounding -------------------------------------------------------------
  mouthFunnel: {
    travelMM: 13.19, gain: 0.5, cap: 0.5, usefulMin: 0.03, naturalMax: 0.45, exaggeratedMax: 0.6, verdict: "PASS",
    // On this asset funnel is an OPENER first and a rounder second (+18.3 mm of
    // lip gap at 1.0), which is the opposite of `mouthPucker`. At the canonical
    // gain it dominated U/OO and held the mouth 11.57 mm open — nearly an AA.
    // Halved so rounding comes from pucker, which protrudes 11.2 mm forward while
    // changing the gap by only +0.1 mm. O keeps a real funnel; U closes down.
    note: "Strong, but it OPENS the lips (+18.3 mm at 1.0) rather than only rounding them. Held at 0.5 gain so pucker leads U/OO."
  },
  mouthPucker: {
    travelMM: 13.11, gain: 1, cap: 0.75, usefulMin: 0.04, naturalMax: 0.6, exaggeratedMax: 0.75, verdict: "PASS",
    note: "Excellent: protrudes 11.2 mm forward while changing lip gap by only +0.1 mm. Clean U/OO without opening the mouth."
  },

  // ---- lip shaping ----------------------------------------------------------
  mouthSmileLeft: {
    travelMM: 16.19, gain: 1, cap: 0.55, usefulMin: 0.03, naturalMax: 0.45, exaggeratedMax: 0.7, verdict: "PASS",
    // Width ladder from a 47.43 mm rest: 0.15 -> 49.8, 0.35 -> 53.0, 0.5 -> 55.4,
    // 1.0 -> 63.3 mm (+33%), which is a rictus. Corner lift 1.46/3.42/4.88/9.76 mm.
    note: "Strong and clean; 0.1% asymmetry with the right. 1.0 is a 33%-wider joker grin, hence the 0.55 cap."
  },
  mouthSmileRight: { travelMM: 16.21, gain: 1, cap: 0.55, usefulMin: 0.03, naturalMax: 0.45, exaggeratedMax: 0.7, verdict: "PASS", note: "Matches the left to 0.1% — no side-balance needed." },
  mouthDimpleLeft: { travelMM: 9.95, gain: 1, cap: 0.45, usefulMin: 0.04, naturalMax: 0.3, exaggeratedMax: 0.45, verdict: "PASS", note: "Real corner-pocket geometry. Female.228 had none of this." },
  mouthDimpleRight: { travelMM: 9.18, gain: 1.08, cap: 0.45, usefulMin: 0.04, naturalMax: 0.3, exaggeratedMax: 0.45, verdict: "PASS", note: "8% shorter than the left; gain 1.08 balances the pair." },
  mouthStretchLeft: { travelMM: 10.39, gain: 1.07, cap: 0.6, usefulMin: 0.04, naturalMax: 0.45, exaggeratedMax: 0.6, verdict: "PASS", note: "Widens WITHOUT lifting the corners (lift -0.30 mm at 0.2) — the correct EE mechanism, not smile." },
  mouthStretchRight: { travelMM: 11.08, gain: 1, cap: 0.6, usefulMin: 0.04, naturalMax: 0.45, exaggeratedMax: 0.6, verdict: "PASS", note: "Pure horizontal stretch; 6.6% longer than the left, which gain 1.07 on the left balances." },
  mouthLowerDownLeft: { travelMM: 4.64, gain: 1.3, cap: 0.7, usefulMin: 0.08, naturalMax: 0.5, exaggeratedMax: 0.7, verdict: "WEAK", note: "Weak lower-lip drop; boosted 1.3x so F/V and AA still read." },
  mouthLowerDownRight: { travelMM: 4.24, gain: 1.42, cap: 0.7, usefulMin: 0.08, naturalMax: 0.5, exaggeratedMax: 0.7, verdict: "WEAK", note: "Weak and 9% shorter than the left; 1.42 = 1.3 x side-balance." },
  mouthUpperUpLeft: { travelMM: 7.53, gain: 1, cap: 0.6, usefulMin: 0.05, naturalMax: 0.45, exaggeratedMax: 0.6, verdict: "PASS", note: "Reveals the upper teeth; the F/V partner to mouthLowerDown." },
  mouthUpperUpRight: { travelMM: 7.47, gain: 1, cap: 0.6, usefulMin: 0.05, naturalMax: 0.45, exaggeratedMax: 0.6, verdict: "PASS", note: "Matches the left to 0.8%." },
  mouthShrugUpper: {
    travelMM: 6.42, gain: 0.7, cap: 0.35, usefulMin: 0.05, naturalMax: 0.25, exaggeratedMax: 0.35, verdict: "WEAK",
    note: "Opens the lip gap +6.3 mm at 1.0 — it fights a seal rather than helping it. Held low deliberately."
  },
  mouthShrugLower: { travelMM: 11.31, gain: 0.9, cap: 0.5, usefulMin: 0.04, naturalMax: 0.4, exaggeratedMax: 0.5, verdict: "PASS", note: "Strong lower-lip raise; only +1.4 mm of gap, so it is seal-friendly." },
  mouthRollUpper: { travelMM: 12.29, gain: 0.9, cap: 0.5, usefulMin: 0.03, naturalMax: 0.4, exaggeratedMax: 0.5, verdict: "PASS", note: "Rolls the upper lip in over the teeth." },
  mouthRollLower: { travelMM: 13.51, gain: 0.9, cap: 0.5, usefulMin: 0.03, naturalMax: 0.4, exaggeratedMax: 0.5, verdict: "PASS", note: "Strong lower-lip tuck; the natural F/V mechanism on this asset." },
  mouthFrownLeft: { travelMM: 5.77, gain: 1.08, cap: 0.5, usefulMin: 0.06, naturalMax: 0.35, exaggeratedMax: 0.5, verdict: "PASS", note: "Moderate; 8% shorter than the right, balanced by gain." },
  mouthFrownRight: { travelMM: 6.25, gain: 1, cap: 0.5, usefulMin: 0.06, naturalMax: 0.35, exaggeratedMax: 0.5, verdict: "PASS", note: "Moderate corner depressor." },

  // ---- cheeks / nose --------------------------------------------------------
  cheekSquintLeft: { travelMM: 5.79, gain: 1.15, cap: 0.6, usefulMin: 0.06, naturalMax: 0.45, exaggeratedMax: 0.6, verdict: "PASS", note: "Identical travel to the right. Modest lift, so a small boost keeps the Duchenne cue readable." },
  cheekSquintRight: { travelMM: 5.79, gain: 1.15, cap: 0.6, usefulMin: 0.06, naturalMax: 0.45, exaggeratedMax: 0.6, verdict: "PASS", note: "Byte-for-byte symmetric with the left — no balance term needed." },
  noseSneerLeft: { travelMM: 10.18, gain: 0.75, cap: 0.35, usefulMin: 0.04, naturalMax: 0.25, exaggeratedMax: 0.35, verdict: "PASS", note: "Strong enough to look like disgust quickly; held down deliberately." },
  noseSneerRight: { travelMM: 10.24, gain: 0.75, cap: 0.35, usefulMin: 0.04, naturalMax: 0.25, exaggeratedMax: 0.35, verdict: "PASS", note: "Symmetric with the left to 0.6%." },
  cheekPuff: { travelMM: 11.46, gain: 0.8, cap: 0.4, usefulMin: 0.05, naturalMax: 0.3, exaggeratedMax: 0.4, verdict: "PASS", note: "Present and strong — Female.228 had no working cheekPuff at all." },

  // ---- brows ----------------------------------------------------------------
  browInnerUp: { travelMM: 6.75, gain: 1, cap: 0.6, usefulMin: 0.05, naturalMax: 0.45, exaggeratedMax: 0.6, verdict: "PASS", note: "Single combined channel on this asset (Female.228 splits L/R). Drives the curious/concerned cue." },
  browOuterUpLeft: { travelMM: 7.02, gain: 1, cap: 0.6, usefulMin: 0.05, naturalMax: 0.45, exaggeratedMax: 0.6, verdict: "PASS", note: "Healthy outer-brow lift." },
  browOuterUpRight: { travelMM: 6.76, gain: 1.04, cap: 0.6, usefulMin: 0.05, naturalMax: 0.45, exaggeratedMax: 0.6, verdict: "PASS", note: "4% shorter than the left; balanced by gain." },
  browDownLeft: {
    travelMM: 7.31, gain: 0.85, cap: 0.45, usefulMin: 0.05, naturalMax: 0.3, exaggeratedMax: 0.45, verdict: "PASS",
    note: "Real geometry here, unlike Female.228 where both browDown targets were empty. Reads as anger fast, so capped low."
  },
  browDownRight: { travelMM: 6.61, gain: 0.94, cap: 0.45, usefulMin: 0.05, naturalMax: 0.3, exaggeratedMax: 0.45, verdict: "PASS", note: "10% shorter than the left; 0.94 = 0.85 x side-balance." },

  // ---- eyes -----------------------------------------------------------------
  eyeBlinkLeft: {
    travelMM: 11.27, gain: 1.05, cap: 1, usefulMin: 0.05, naturalMax: 1, exaggeratedMax: 1, verdict: "PASS",
    note: "The one channel that must reach 1.0 — a blink has to fully close. 5% shorter than the right, hence gain 1.05."
  },
  eyeBlinkRight: { travelMM: 11.85, gain: 1, cap: 1, usefulMin: 0.05, naturalMax: 1, exaggeratedMax: 1, verdict: "PASS", note: "Full closure at 1.0. Carries the lash cards with it (10.75 mm), so lids and lashes stay together." },
  eyeSquintLeft: { travelMM: 3.46, gain: 1.2, cap: 0.6, usefulMin: 0.1, naturalMax: 0.45, exaggeratedMax: 0.6, verdict: "WEAK", note: "Only 3.46 mm; boosted so the smile's lower-lid tightening still registers." },
  eyeSquintRight: { travelMM: 3.02, gain: 1.37, cap: 0.6, usefulMin: 0.1, naturalMax: 0.45, exaggeratedMax: 0.6, verdict: "WEAK", note: "Weakest expression channel on the asset; 1.37 = 1.2 x side-balance." },
  eyeWideLeft: { travelMM: 4.28, gain: 1.1, cap: 0.5, usefulMin: 0.08, naturalMax: 0.35, exaggeratedMax: 0.5, verdict: "WEAK", note: "Modest lid raise; easily reads as startled, so capped at 0.5." },
  eyeWideRight: { travelMM: 3.55, gain: 1.33, cap: 0.5, usefulMin: 0.08, naturalMax: 0.35, exaggeratedMax: 0.5, verdict: "WEAK", note: "17% shorter than the left; 1.33 = 1.1 x side-balance." }
};

/**
 * HC5 gaze.
 *
 * Hyper3D has no usable eye bones (Eye_L/Eye_R carry 0.0909 fallback weights) and
 * `EyeGeometryController` cannot be used because every region shares one mesh.
 * Gaze therefore runs on the native eyeLook morphs, whose true rotation was
 * measured by best-fit against the eyeball vertex ring:
 *
 *   eyeLookIn/Out  = 22.02 deg of eyeball rotation at influence 1.0
 *   eyeLookUp/Down = 13.24 deg at influence 1.0
 *
 * Both sides agree to within 0.01 deg, so one constant serves both eyes.
 */
export const hyper3dGazeCalibration = {
  /** Measured degrees of real eyeball rotation per unit of influence. */
  degreesPerUnitHorizontal: 22.02,
  degreesPerUnitVertical: 13.24,
  /**
   * Amplification of the controller's gaze intent, mirroring the role
   * `eyeGeometry.gazeScale` plays for Female.228. The intent itself is untouched.
   */
  gazeScale: 3.2,
  /** Rails in DEGREES of real eye rotation, applied before the morph conversion. */
  maxYawDegrees: 14,
  maxPitchUpDegrees: 7,
  /**
   * Downward gaze gets its own, tighter rail. `eyeLookDown` moves the eyelid and
   * lash cards far more than the eyeball (9.48 mm on the face and 8.59 mm on the
   * lashes against 3.81 mm for eyeLookUp), so a symmetric pitch rail would read
   * as drooping, sleepy lids rather than a downward glance.
   */
  maxPitchDownDegrees: 4.5,
  /** Absolute ceiling on any single eyeLook influence. */
  cap: 0.7
} as const;

/**
 * HC4 head and neck.
 *
 * The bone axes were PROVEN to match before any amplitude was considered. At
 * rest, world-space directions of each bone's local axes:
 *
 *   Head_M  local +X -> world (1.000, 0.001, -0.001)   [BoneController pitch]
 *           local +Y -> world (-0.001, 0.999, 0.041)   [BoneController yaw]
 *           local +Z -> world (0.001, -0.041, 0.999)   [BoneController roll]
 *   Neck_M  local +X -> world (1.000, 0.000, 0.000)
 *           local +Y -> world (0.000, 0.975, 0.221)
 *           local +Z -> world (0.000, -0.221, 0.975)
 *
 * `BoneController.applyBone` builds Euler(pitch=X, yaw=Y, roll=Z, "XYZ") in bone
 * local space and post-multiplies it onto the rest quaternion. Every axis lands
 * on its intended world axis with a positive sign, so **no axis remap and no sign
 * flip is required** and the approved carrier output applies unchanged.
 *
 * Head_M is a child of Neck_M (same topology as Female.228's neck_01 -> head), so
 * neck rotation propagates into the head exactly as the existing
 * `neckContribution` split already assumes — there is no double-rotation to undo.
 * Rest local pitch is -10.44 deg on the head and +10.48 deg on the neck; these
 * cancel, and `applyBone` preserves them by composing onto `originalQuaternion`.
 *
 * The scales below are therefore all 1.0: the approved TalkingHead CENTER + GAZE
 * 1.75x output is applied AS IS, which is what the brief asks for. They exist as
 * the single place to adjust if hardware review says the motion reads too large
 * or too small, without touching the carrier.
 */
export const hyper3dHeadNeckCalibration = {
  yawScale: 1,
  pitchScale: 1,
  rollScale: 1,
  neckScale: 1
};

// ---------------------------------------------------------------------------
// HC3 expressions
// ---------------------------------------------------------------------------

/**
 * Built from Hyper3D's own measured geometry, NOT ported from Female.228.
 *
 * Female.228 needed heavy cheek, nose and upper-lip compensation because its
 * smile geometry was weak and several of its channels were empty. Hyper3D has the
 * opposite problem: `mouthSmile` alone widens the mouth from 47.43 mm to 63.26 mm
 * at influence 1.0. So these compositions are small, and they lean on the smile
 * and dimple channels the asset actually has rather than stacking unrelated
 * morphs to fake a corner pull.
 *
 * Measured result of each (mouth width / corner lift against a 47.43 mm rest):
 *   SOFT   51.64 mm  +2.42 mm
 *   WARM   49.53 mm  +1.26 mm
 *   HAPPY  56.12 mm  +4.97 mm
 */
export interface Hyper3dExpression {
  id: string;
  label: string;
  pose: BlendshapePose;
  note: string;
}

export const hyper3dExpressions: Record<string, Hyper3dExpression> = {
  soft: {
    id: "soft",
    label: "HYPER3D SOFT SMILE",
    pose: { mouthSmileLeft: 0.22, mouthSmileRight: 0.22, cheekSquintLeft: 0.18, cheekSquintRight: 0.18, mouthDimpleLeft: 0.1, mouthDimpleRight: 0.1 },
    note: "Mouth 51.64 mm (+8.9%), corners +2.42 mm. Smile-led with a real dimple; no nose or upper-lip padding."
  },
  warm: {
    id: "warm",
    label: "HYPER3D WARM",
    pose: { mouthSmileLeft: 0.12, mouthSmileRight: 0.12, cheekSquintLeft: 0.1, cheekSquintRight: 0.1, browOuterUpLeft: 0.12, browOuterUpRight: 0.12 },
    note: "Mouth 49.53 mm (+4.4%), corners +1.26 mm. Attentive rather than smiling; the brow does most of the work."
  },
  happy: {
    id: "happy",
    label: "HYPER3D HAPPY",
    pose: { mouthSmileLeft: 0.45, mouthSmileRight: 0.45, cheekSquintLeft: 0.38, cheekSquintRight: 0.38, mouthDimpleLeft: 0.22, mouthDimpleRight: 0.22, browInnerUp: 0.15, eyeSquintLeft: 0.14, eyeSquintRight: 0.14 },
    note: "Mouth 56.12 mm (+18%), corners +4.97 mm. Cheek and a light lower-lid tighten carry the Duchenne cue."
  },
  curious: {
    id: "curious",
    label: "HYPER3D CURIOUS",
    pose: { browInnerUp: 0.34, browOuterUpLeft: 0.26, browOuterUpRight: 0.26, eyeWideLeft: 0.14, eyeWideRight: 0.14, mouthSmileLeft: 0.06, mouthSmileRight: 0.06, jawOpen: 0.03 },
    note: "Brow-led as specified, with only a 6% mouth change so it reads as interest and not as a smile."
  },
  serious: {
    id: "serious",
    label: "HYPER3D SERIOUS",
    pose: { browDownLeft: 0.26, browDownRight: 0.26, mouthPressLeft: 0.16, mouthPressRight: 0.2, mouthFrownLeft: 0.08, mouthFrownRight: 0.08 },
    note: "Brow-led focus. Carries NO eyelid term on purpose — adding eyeBlink or eyeSquint here is what makes a focused face read as sleepy."
  },
  thoughtful: {
    id: "thoughtful",
    label: "HYPER3D THOUGHTFUL",
    pose: { browInnerUp: 0.22, browOuterUpLeft: 0.2, browDownRight: 0.1, mouthPressLeft: 0.12, mouthLeft: 0.06 },
    note: "Asymmetric, which this geometry supports: separate L/R brow targets plus a directional mouthLeft (18.49 mm of real travel)."
  }
};

/**
 * MAX variants. DIAGNOSTIC ONLY — these bypass `cap` so the asset's true ceiling
 * can be seen on hardware. They are not production poses and nothing selects them
 * automatically.
 */
export const hyper3dExpressionsMax: Record<string, Hyper3dExpression> = {
  softMax: { id: "softMax", label: "HYPER3D SOFT MAX", pose: { mouthSmileLeft: 0.55, mouthSmileRight: 0.55, cheekSquintLeft: 0.5, cheekSquintRight: 0.5, mouthDimpleLeft: 0.35, mouthDimpleRight: 0.35 }, note: "Soft smile pushed to the natural ceiling." },
  happyMax: { id: "happyMax", label: "HYPER3D HAPPY MAX", pose: { mouthSmileLeft: 1, mouthSmileRight: 1, cheekSquintLeft: 1, cheekSquintRight: 1, mouthDimpleLeft: 1, mouthDimpleRight: 1, browInnerUp: 0.6, eyeSquintLeft: 0.6, eyeSquintRight: 0.6 }, note: "Everything at 1.0: mouth 68.91 mm (+45%), corners +11.71 mm. Shows the ceiling; far past usable." },
  curiousMax: { id: "curiousMax", label: "HYPER3D CURIOUS MAX", pose: { browInnerUp: 1, browOuterUpLeft: 1, browOuterUpRight: 1, eyeWideLeft: 1, eyeWideRight: 1 }, note: "Full brow and lid capability." },
  seriousMax: { id: "seriousMax", label: "HYPER3D SERIOUS MAX", pose: { browDownLeft: 1, browDownRight: 1, mouthPressLeft: 1, mouthPressRight: 1, mouthFrownLeft: 0.8, mouthFrownRight: 0.8 }, note: "Full brow-down capability, which Female.228 could not express at all." }
};

/**
 * PRESENCE PASS — the resting baseline held between explicit events.
 *
 * Why this exists at all. The Hyper3D idle profile inherits the current avatar's
 * values, and measured against THIS asset's geometry every one of them is below
 * the visibility threshold:
 *
 *   channel            inherited   travel     verdict
 *   mouthSmile L/R        0.016    0.26 mm    invisible (usefulMin 0.03)
 *   cheekSquint L/R       0.008    0.05 mm    invisible (usefulMin 0.06)
 *   browInnerUp           0.008    0.05 mm    invisible (usefulMin 0.05)
 *   browOuterUp L/R       0.010    0.07 mm    invisible (usefulMin 0.05)
 *
 * So between events this asset was rendering an entirely still face — the
 * "frozen/blank gaps" the brief describes, with a measured cause rather than a
 * subjective one. The values below sit just ABOVE each channel's measured
 * `usefulMin` and far below its `naturalMax`.
 *
 * Deliberately NOT a smile. At 0.05 the mouth corner travels 0.81 mm and the
 * mouth widens about 1.6% — muscle tone, not an expression. The brief's warning
 * against "constant smiling" is the reason it stops there.
 *
 * The small left/right differences are the "tiny facial asymmetry": a real face
 * is never symmetric at rest. `mouthDimpleLeft` is single-sided on purpose. Both
 * sides of every PAIR still clear their own `usefulMin`, so the asymmetry reads
 * as a difference in degree rather than one side simply not rendering.
 *
 * There is NO eyelid term. The inherited baseline carried eyeSquint 0.006, and
 * with the iris still missing anything that narrows the aperture reads as a dead
 * stare, so the eyes are left fully open.
 */
/** LOCKED — accepted on hardware (presence PASS). See HYPER3D_ACCEPTED_BASELINE. */
export const hyper3dPresenceBaseline: BlendshapePose = {
  // usefulMin 0.03
  mouthSmileLeft: 0.05,
  mouthSmileRight: 0.042,
  // usefulMin 0.06 — BOTH sides must clear it. A first draft used 0.062/0.055
  // and put the right cheek under the threshold, which would have rendered a
  // one-sided lift rather than the intended micro-asymmetry.
  cheekSquintLeft: 0.068,
  cheekSquintRight: 0.06,
  // usefulMin 0.05
  browInnerUp: 0.05,
  browOuterUpLeft: 0.058,
  browOuterUpRight: 0.051,
  // usefulMin 0.04, single-sided on purpose
  mouthDimpleLeft: 0.04
};

// ---------------------------------------------------------------------------
// application
// ---------------------------------------------------------------------------

const clamp01 = (v: number) => Math.min(Math.max(Number.isFinite(v) ? v : 0, 0), 1);

/** The calibrated influence for one channel. Unknown names pass through clamped. */
export const calibrateHyper3dMorph = (name: string, value: number, bypassCaps = false) => {
  const entry = hyper3dMorphCalibration[name];
  if (!entry) return clamp01(value);
  if (bypassCaps) return clamp01(value);
  return Math.min(clamp01(value * entry.gain), entry.cap);
};

/**
 * Applies the calibration to a whole pose.
 *
 * This is the entire HC2 adapter: it is keyed by semantic morph name, never by
 * index, and it does not add, remove or re-time any channel. What the speech
 * controller decided to say is exactly what arrives here.
 */
export const calibrateHyper3dPose = (pose: BlendshapePose, bypassCaps = false): BlendshapePose => {
  const out: BlendshapePose = {};
  for (const [name, value] of Object.entries(pose)) {
    const calibrated = calibrateHyper3dMorph(name, value, bypassCaps);
    if (calibrated > 0) out[name] = calibrated;
  }
  return out;
};

/**
 * Converts the existing gaze intent into native eyeLook influences.
 *
 * Takes the SAME `gazeYawDegrees` / `gazePitchDegrees` the rest of the pipeline
 * produces, so head/gaze coordination is unchanged — only the mechanism that
 * renders it differs. Positive yaw looks to the character's left, positive pitch
 * looks up.
 */
export const hyper3dGazePose = (yawDegrees: number, pitchDegrees: number): BlendshapePose => {
  const c = hyper3dGazeCalibration;
  const yaw = Math.max(-c.maxYawDegrees, Math.min(c.maxYawDegrees, yawDegrees * c.gazeScale));
  const rawPitch = pitchDegrees * c.gazeScale;
  const pitch = Math.max(-c.maxPitchDownDegrees, Math.min(c.maxPitchUpDegrees, rawPitch));
  const pose: BlendshapePose = {};
  const put = (name: string, v: number) => {
    const clamped = Math.min(Math.abs(v), c.cap);
    if (clamped > 1e-4) pose[name] = clamped;
  };
  const h = Math.abs(yaw) / c.degreesPerUnitHorizontal;
  // Looking to the character's left: the left eye rotates outward (temporally),
  // the right eye inward (nasally). Both eyes therefore turn the same way.
  if (yaw > 0) { put("eyeLookOutLeft", h); put("eyeLookInRight", h); }
  else if (yaw < 0) { put("eyeLookInLeft", h); put("eyeLookOutRight", h); }
  const v = Math.abs(pitch) / c.degreesPerUnitVertical;
  if (pitch > 0) { put("eyeLookUpLeft", v); put("eyeLookUpRight", v); }
  else if (pitch < 0) { put("eyeLookDownLeft", v); put("eyeLookDownRight", v); }
  return pose;
};
