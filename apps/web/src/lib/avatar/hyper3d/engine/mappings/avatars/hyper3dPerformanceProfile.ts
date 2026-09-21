/**
 * HYPER3D FINAL SPEAKING PERFORMANCE — tuning profile.
 *
 * Every number the speaking-head architecture uses lives here rather than being
 * scattered through the planner, the state machine or the solver. That is the
 * point of the file: hardware review changes values in ONE place, and no
 * behaviour is encoded as a constant sitting next to the code that reads it.
 *
 * These are INITIAL HARDWARE VALUES. They are review starting points, not
 * signed-off production numbers — the accepted face/speech calibration in
 * `hyper3dCalibration.ts` is the locked thing, and nothing here touches it.
 *
 * Units are degrees and seconds throughout. Sign convention matches the accepted
 * Hyper3D axis mapping proven in `hyper3dCalibration.ts`:
 *
 *   +pitch = chin down      +yaw = turn to the character's left      +roll = tilt
 *
 * No axis remap and no sign flip is applied anywhere downstream of this file.
 */

/**
 * Amplitude bands.
 *
 * `normal*` is what the planner is allowed to ASK for. `hard*Cap` is what the
 * runtime will physically permit at the bone, enforced after planning and again
 * before the bone write. The gap between them is deliberate headroom for a
 * gesture stacked on a phrase pose — a nod at the bottom of a phrase that already
 * leans down still has to stay inside the cap, and it does because the apex is
 * clamped at construction rather than being discovered at the bone.
 */
export const HYPER3D_MOTION_PROFILE = {
  normalYawMax: 2.5,
  normalPitchMax: 1.5,
  normalRollMax: 0.7,

  hardYawCap: 4.0,
  hardPitchCap: 3.0,
  hardRollCap: 1.25
} as const;

/** Prominence-gesture amplitudes, in degrees of pitch. Positive = chin down. */
export const HYPER3D_NOD_PROFILE = {
  micro: 0.75,
  normal: 1.25,
  strong: 1.75,
  /** No gesture apex may travel further than this from its onset pose. */
  hardCap: 2.2
} as const;

/**
 * Deadband.
 *
 * If a newly planned target sits inside this of the pose the head is already
 * holding, the move is not worth making: it would read as a twitch rather than
 * an intention, and it would break the quiet holds the whole architecture exists
 * to produce. The state machine stays in HOLD and records the reason.
 */
export const HYPER3D_DEADBAND = {
  yaw: 0.2,
  pitch: 0.15,
  roll: 0.1
} as const;

/**
 * Phrase-pose timing.
 *
 * A move is slow enough to read as a decision. `settleFraction` is the tail of
 * the travel handed to the SETTLE state — the move covers the rest — so SETTLE
 * is a real, visible arrival rather than a state that exists only on paper.
 */
export const HYPER3D_PHRASE_TIMING = {
  moveMinSeconds: 0.35,
  moveMaxSeconds: 0.65,
  settleMinSeconds: 0.1,
  settleMaxSeconds: 0.25,
  /** Portion of the total travel left for SETTLE to complete. */
  settleFraction: 0.1,
  /** Quiet after the last phrase before the head releases toward rest. */
  tailHoldSeconds: 0.25
} as const;

/**
 * Gesture timing.
 *
 * The downstroke ENDS on the acoustic apex — a nod that starts on the stressed
 * syllable lands late. The return is longer than the downstroke, which is what
 * makes a nod read as a nod rather than a bounce.
 */
export const HYPER3D_GESTURE_TIMING = {
  downMinSeconds: 0.18,
  downMaxSeconds: 0.28,
  returnMinSeconds: 0.22,
  returnMaxSeconds: 0.38,
  settleSeconds: 0.12,
  /** Portion of the return travel left for SETTLE. */
  settleFraction: 0.1,
  /**
   * Minimum quiet between the end of one gesture's settle and the onset of the
   * next. A secondary constraint only: phrase structure is the primary one, and
   * a gesture that would run into a phrase transition is dropped regardless of
   * how much refractory time has passed.
   */
  refractorySeconds: 1.5
} as const;

/**
 * Phrase segmentation thresholds, applied to MFA/silence timing.
 *
 * `minSilenceSeconds` is the floor for calling a gap a pause at all — below it
 * the gap is ordinary inter-phone silence, not structure. `phraseBreakSeconds`
 * separates a SHORT pause (a breath inside a phrase; the head holds through it)
 * from a LONGER pause (a real phrase boundary; the head may move).
 */
export const HYPER3D_SEGMENTATION = {
  minSilenceSeconds: 0.12,
  phraseBreakSeconds: 0.28,
  /** A fragment shorter than this is merged into its neighbour rather than posed. */
  minPhraseSeconds: 0.35
} as const;

/**
 * Prominence detection.
 *
 * ============================ PROVISIONAL ============================
 * THE WEIGHTS AND THRESHOLDS BELOW ARE PROVISIONAL ENGINEERING VALUES.
 *
 * They are NOT part of the accepted speaking-head architecture and must not be
 * locked, pinned as a baseline, or cited as reviewed. The architecture that IS
 * accepted is the pipeline — planner, single owner, state machine, one
 * trajectory solver, rig distribution. How evidence is weighted into a
 * classification is an open question that needs its own hardware pass and, more
 * than anything, needs real acoustic evidence (see `f0Available`).
 *
 * `provisional: true` is asserted by the test suite precisely so this cannot
 * quietly become an accepted number.
 * =====================================================================
 *
 * Weights combine LOCALLY NORMALIZED evidence. The normalization BASIS is chosen
 * by the detector per phrase — see `hyper3dPerformancePlanner.ts` — because a
 * phrase with only two or three nuclei has no distribution worth normalizing
 * against and pretending otherwise produces confident nonsense.
 */
export const HYPER3D_PROMINENCE = {
  /** PROVISIONAL. Do not lock. See the block comment above. */
  provisional: true,
  /** PROVISIONAL weights. */
  weights: {
    energy: 0.45,
    duration: 0.35,
    position: 0.2
  },
  /** PROVISIONAL thresholds. Deliberately NOT lowered to manufacture events. */
  thresholds: {
    weak: 0.85,
    medium: 1.15,
    strong: 1.55
  },
  /**
   * Absolute floor on any normalization basis. A standard deviation over two
   * points carries no information about which of them is unusual: with n = 2
   * both z-scores are always exactly +/-1 whatever the values were.
   */
  absoluteMinSamples: 3
} as const;

export type Hyper3dProminenceLevel = "NONE" | "WEAK" | "MEDIUM" | "STRONG";

/** Which nod amplitude each prominence level asks for. */
export const HYPER3D_GESTURE_STRENGTH: Record<Hyper3dProminenceLevel, number> = {
  NONE: 0,
  WEAK: HYPER3D_NOD_PROFILE.micro,
  MEDIUM: HYPER3D_NOD_PROFILE.normal,
  STRONG: HYPER3D_NOD_PROFILE.strong
};

/**
 * HYPER3D RIG PROFILE — how one solved head pose is distributed across the two
 * bones.
 *
 * This is a RIG fact, not a planner behaviour. The planner solves a single head
 * orientation and never sees these numbers; they are applied last, after the
 * hard caps, immediately before the bone write. Roll leans further onto the head
 * because Head_M carries the visible tilt and a rolled neck reads as a shrug.
 *
 * Head_M is a child of Neck_M, so neck rotation propagates into the head — the
 * same topology `hyper3dCalibration.ts` documents. These shares are the
 * REQUESTED split of one intention, which is exactly how the accepted
 * `neckContribution` split already behaved.
 */
/**
 * STAGE 2.3 — TEMPORARY RIG-OUTPUT REVIEW MODE.
 *
 * Five fixed bone commands, sent through the SAME final rig application path as
 * a speaking frame: the same `toBoneRadians` conversion, the same
 * `BoneController.apply`, the same jerk-limited follower, the same quaternion
 * composition. Nothing about them is special-cased downstream, which is the
 * whole point — if hardware can see these, the path is proven end to end and any
 * remaining complaint is an amplitude question rather than an output question.
 *
 * Each probe drives ONE bone so the two can be judged separately: the review
 * reported the neck as completely static, and a combined command cannot tell
 * "the neck receives nothing" apart from "the neck receives its 30% and 0.7 deg
 * is too small to see".
 *
 * DIAGNOSTIC ONLY. These bypass the planner, the state machine and the
 * trajectory solver by design, they are not a second animation variant, and they
 * are removed once hardware confirms actual rotation. No production value is
 * read from or written by any of them.
 */
export type Hyper3dRigProbeId = "head-pitch" | "head-yaw" | "head-roll" | "neck-pitch" | "neck-yaw";

export const HYPER3D_RIG_PROBES: Record<
  Hyper3dRigProbeId,
  { id: Hyper3dRigProbeId; label: string; head: { yaw: number; pitch: number; roll: number }; neck: { yaw: number; pitch: number; roll: number } }
> = {
  "head-pitch": { id: "head-pitch", label: "MANUAL HEAD +3 PITCH", head: { yaw: 0, pitch: 3, roll: 0 }, neck: { yaw: 0, pitch: 0, roll: 0 } },
  "head-yaw": { id: "head-yaw", label: "MANUAL HEAD +3 YAW", head: { yaw: 3, pitch: 0, roll: 0 }, neck: { yaw: 0, pitch: 0, roll: 0 } },
  "head-roll": { id: "head-roll", label: "MANUAL HEAD +1 ROLL", head: { yaw: 0, pitch: 0, roll: 1 }, neck: { yaw: 0, pitch: 0, roll: 0 } },
  "neck-pitch": { id: "neck-pitch", label: "MANUAL NECK +3 PITCH", head: { yaw: 0, pitch: 0, roll: 0 }, neck: { yaw: 0, pitch: 3, roll: 0 } },
  "neck-yaw": { id: "neck-yaw", label: "MANUAL NECK +3 YAW", head: { yaw: 0, pitch: 0, roll: 0 }, neck: { yaw: 3, pitch: 0, roll: 0 } }
};

export const HYPER3D_RIG_PROFILE = {
  pitch: { head: 0.7, neck: 0.3 },
  yaw: { head: 0.7, neck: 0.3 },
  roll: { head: 0.8, neck: 0.2 }
} as const;

/**
 * Per-expression character.
 *
 * The active semantic expression is a planner INPUT, so it has to mean
 * something. It scales what the planner asks for; it never introduces a second
 * generator, and it cannot lift anything past the caps above. Unlisted
 * expressions take the neutral entry.
 */
export interface Hyper3dExpressionCharacter {
  /** Multiplier on phrase-pose amplitude. */
  poseAmplitude: number;
  /** Multiplier on gesture amplitude. 0 suppresses gestures entirely. */
  gestureAmplitude: number;
}

export const HYPER3D_EXPRESSION_CHARACTER: Record<string, Hyper3dExpressionCharacter> = {
  neutral: { poseAmplitude: 1, gestureAmplitude: 1 },
  soft: { poseAmplitude: 0.9, gestureAmplitude: 0.9 },
  warm: { poseAmplitude: 0.95, gestureAmplitude: 0.95 },
  happy: { poseAmplitude: 1.1, gestureAmplitude: 1.1 },
  /** A downward nod contradicts a question, so CURIOUS asks for none. */
  curious: { poseAmplitude: 1, gestureAmplitude: 0 },
  serious: { poseAmplitude: 0.85, gestureAmplitude: 1 },
  thoughtful: { poseAmplitude: 0.8, gestureAmplitude: 0.75 },
  concerned: { poseAmplitude: 0.8, gestureAmplitude: 0.7 }
};

export const expressionCharacter = (id: string | null | undefined): Hyper3dExpressionCharacter =>
  HYPER3D_EXPRESSION_CHARACTER[id ?? "neutral"] ?? HYPER3D_EXPRESSION_CHARACTER.neutral;

/**
 * DIAGNOSTIC ONLY — the forced gesture.
 *
 * Hardware has to be able to judge the GESTURE TRAJECTORY on its own, separately
 * from whether the detector fired. So this injects exactly one synthetic
 * prominence event at a known clock, and it goes through the SAME
 * `buildHeadTimeline` -> GESTURE -> SETTLE -> HOLD path as a real one. There is
 * no second nod implementation and no second solver; only the event's origin
 * differs, and it is labelled as such everywhere it appears.
 *
 * The timestamp is calibrated for `test-005`: 4.00 s sits in the long quiet HOLD
 * inside its second phrase (2.05-5.22 s), after that phrase's move has settled
 * at 2.79 s and far enough before the next boundary at 5.54 s that the whole
 * downstroke, return and settle fit. On any other clip the state machine applies
 * its normal rules and may reject it, with the reason recorded.
 *
 * PRODUCTION IS UNAFFECTED: `PHRASE MOTION + PROMINENCE GESTURES` keeps using
 * real detected prominence. This runs only when the diagnostic toggle is on.
 */
export const HYPER3D_DIAGNOSTIC_GESTURE = {
  id: "DIAGNOSTIC-FORCED-GESTURE",
  label: "DIAGNOSTIC: FORCED GESTURE @ 4.00s",
  apexTimeSeconds: 4.0,
  level: "STRONG" as Hyper3dProminenceLevel,
  note: "DIAGNOSTIC ONLY — synthetic prominence event for hardware validation of the gesture trajectory. Not produced by detection."
} as const;

/** The three review modes. No A/B/C tuning variants exist by design. */
export type Hyper3dHeadReviewMode = "off" | "phrase" | "phraseNods";

export const HYPER3D_REVIEW_MODES: Array<{ id: Hyper3dHeadReviewMode; label: string }> = [
  { id: "off", label: "HEAD OFF" },
  { id: "phrase", label: "PHRASE MOTION" },
  { id: "phraseNods", label: "PHRASE MOTION + PROMINENCE GESTURES" }
];
