/**
 * HYPER3D PERFORMANCE BASELINE — THE ACCEPTED PRODUCTION CONFIGURATION.
 *
 * This file is the CANONICAL RECORD of the Hyper3D speaking performance that
 * passed final visual review against the locked target video
 * (`reference/Hyper3D_Target_Reference_Frame_Pack.zip`).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS FILE IS
 * ─────────────────────────────────────────────────────────────────────────────
 * It holds the EXPECTED VALUES, not the live ones. Nothing reads it at runtime;
 * no render path imports it. `hyper3dPerformanceBaselineContract.test.ts`
 * compares every live constant against the literals here, so a change to any
 * protected value fails the build with the old and new numbers side by side.
 *
 * That is deliberate. A baseline that imported the live constants would agree
 * with itself forever and protect nothing.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HOW TO CHANGE A PROTECTED VALUE
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. change the live constant at its source of truth;
 * 2. change the literal here, in the same commit;
 * 3. state the measurement that justifies it in the pass document under `docs/`.
 *
 * Step 2 is the point: a protected value cannot move silently, and the diff
 * shows a reviewer exactly what was accepted and what replaced it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PROVENANCE — the passes this baseline is the sum of
 * ─────────────────────────────────────────────────────────────────────────────
 *   docs/hyper3d-target-matched-performance.md     head, gaze, blink, lip release
 *   docs/hyper3d-target-face-vowel-convergence.md  resting lid, warmth, vowels
 *   docs/hyper3d-semantic-upper-face.md            semantic brows
 *   docs/hyper3d-facial-coordination.md            eye softening, phrase range
 *
 * Upstream `threejs-talking-avatar` pinned at
 * `61ab8e3b1a14946b245926ac1b12e4f387b656ab`, Apache-2.0.
 */

/** Where each protected value actually lives. The contract reads from these. */
export const HYPER3D_BASELINE_SOURCES = {
  head: "src/engine/avatar/hyper3dThreejsTalkingAvatarHead.ts",
  gaze: "src/engine/avatar/upstream/threejs-talking-avatar/performance.ts",
  blink: "src/engine/avatar/upstream/threejs-talking-avatar/performance.ts",
  lid: "src/engine/avatar/upstream/threejs-talking-avatar/performance.ts",
  warmth: "src/engine/avatar/hyper3dFacialLiveliness.ts",
  affectEnvelope: "src/engine/avatar/upstream/threejs-talking-avatar/performance.ts",
  brows: "src/engine/avatar/hyper3dThreejsTalkingAvatarHead.ts",
  vowels: "src/mappings/avatars/hyper3dVowelProfile.ts",
  bilabial: "src/engine/lipsync/CoarticulationEngine.ts",
  coarticulation: "src/engine/lipsync/CoarticulationEngine.ts",
  oovRepair: "scripts/repair-oov-alignment.mjs",
  calibration: "src/mappings/avatars/hyper3dCalibration.ts"
} as const;

// ---------------------------------------------------------------------------
// PROTECTED CONSTANTS
// ---------------------------------------------------------------------------

/** HEAD — accepted at 3.0x. Timing, beat placement and the 70/30 rig split frozen. */
export const BASELINE_HEAD = {
  motionScale: 3
} as const;

/** GAZE — centre hold dominant, small visible shifts, no large side-look. */
export const BASELINE_GAZE = {
  yawAmplitude: 0.2,
  pitchAmplitude: 0.11,
  holdMinSeconds: 0.34,
  holdRangeSeconds: 0.72,
  gapMinSeconds: 2.6,
  gapRangeSeconds: 3.8,
  firstGapMinSeconds: 1.1,
  firstGapRangeSeconds: 2.2,
  /** The rails the adapter maps onto; 1.0 of gaze unit is `maxYawDegrees`. */
  maxYawDegrees: 14,
  maxPitchUpDegrees: 7,
  maxPitchDownDegrees: 4.5,
  gazeScale: 3.2
} as const;

/** BLINK — upstream's trajectory, upstream's scheduler with two tuned constants. */
export const BASELINE_BLINK = {
  /** Trajectory: upstream's `sampleEyelid`, unchanged. */
  closeSeconds: 0.052,
  holdSeconds: 0.018,
  openSeconds: 0.105,
  peak: 1,
  /** Scheduler. `boundaryProbability` and the cursor are the two tuned values. */
  boundaryProbability: 0.44,
  cursorMinSeconds: 2.4,
  cursorRangeSeconds: 3.8,
  minSeparationSeconds: 1.15,
  doubleProbability: 0.085,
  snapWindowSeconds: 0.42,
  firstCursorMinSeconds: 1.15,
  firstCursorRangeSeconds: 1.2
} as const;

/** RESTING LID — the eye posture correction, carried on the blink channel. */
export const BASELINE_LID = {
  restingClosure: 0.17,
  widenRelease: 0.32
} as const;

/** WARMTH — one locked strength, floored, with a followed articulation yield. */
export const BASELINE_WARMTH = {
  scale: 1.45,
  mouthYieldFloor: 0.4,
  cheekYieldFloor: 0.72,
  yieldAttackSeconds: 0.035,
  yieldReleaseSeconds: 0.11,
  productionAffectRequest: "please sound warm and friendly",
  /** Region references onto the accepted expression vocabulary's own scale. */
  referenceMouthSmile: 0.45,
  referenceCheekSquint: 0.38,
  referenceMouthDimple: 0.22,
  /**
   * Solved so the warm signal's MEDIAN lands on `eyeSquintLeft`'s 0.10
   * `usefulMin`, which is what makes the cue perceptible across a phrase.
   *
   * Was 0.36, solved instead so the runtime PEAK landed on the accepted `happy`
   * pose's 0.14 — see `eyeSoftening` below for why anchoring the peak was the
   * defect. The other three references still map onto the vocabulary's own
   * scale; only the EYE needed a speaking conversion distinct from its
   * held-expression value.
   */
  referenceEyeSquint: 0.7,
  referenceEyeWide: 0.14
} as const;

/** AFFECT ENVELOPE — per-phrase, floored, gain from upstream's own beat detector. */
export const BASELINE_AFFECT_ENVELOPE = {
  speakingFloor: 0.46,
  phrasePauseSeconds: 0.28,
  phraseGainMin: 0.55,
  phraseGainMax: 1.26
} as const;

/** SEMANTIC BROWS — gated on the same envelope; no prosodic term exists. */
export const BASELINE_BROWS = {
  enabled: true,
  engage: 0.72,
  full: 1.15,
  asymmetry: 0.16,
  attackSeconds: 0.34,
  releaseSeconds: 0.86,
  neutralConcernRest: 0.035,
  referenceOuterUp: 0.62,
  referenceInnerUp: 0.34,
  referenceDown: 0.18
} as const;

/** BILABIAL SEAL — the `"blue backpack"` closure/release fix. */
export const BASELINE_BILABIAL = {
  level: 0.7,
  leadSeconds: 0.045,
  leadPreviousShare: 0.6,
  releaseSeconds: 0.035,
  releaseShare: 0.5,
  /** The P/B/M closure demands the seal sits above. Never to be retuned here. */
  closureP: 0.78,
  closureB: 0.84,
  closureM: 0.96
} as const;

/**
 * COARTICULATION / ENVELOPE — unchanged, and the zero is a MEASURED decision.
 *
 * `ENVELOPE_SUSTAIN_FRACTION` was swept end to end on the production payload.
 * Every non-zero value reduces direction reversals but raises the worst
 * per-frame step (0.4357 -> 0.4992 at 0.45, +15 %) and p99 velocity (+24 %),
 * which is the opposite of the abruptness it would be raised to fix. See
 * `docs/hyper3d-facial-coordination.md` §4.
 */
export const BASELINE_COARTICULATION = {
  envelopeSustainFraction: 0,
  envelopeLookAheadCarry: 0.35
} as const;

/**
 * AFFRICATES — the `"change"` lip-sync regression.
 *
 * CH and JH are the only CONSONANTS this asset re-authors. They inherited
 * male-table poses written against a full-gain `mouthFunnel`, but funnel runs at
 * 0.5 gain here because it OPENS the lips instead of rounding them — the same
 * reason the vowel pass raised pucker on every rounded vowel. The affricates
 * were never given that compensation, so both rendered sub-millimetre lip
 * movement and "change" read as one wide vowel.
 *
 * Only the two rounding channels moved. Jaw, stretch, intensity, attack,
 * release, coarticulation weights, viseme and category are the male entry's.
 *
 * Measured on the real MFA alignments, in millimetres of lip travel:
 *
 *   word       phoneme   before   after
 *   change     CH        0.78  -> 1.94
 *   change     JH        0.55  -> 1.47
 *   changing   CH        0.78  -> 1.94
 *   changing   JH        0.54  -> 1.45
 *   chose      CH        1.53  -> 1.94
 *   jacket     JH        0.58  -> 1.43
 *
 * See `docs/HYPER3D_CHANGE_LIPSYNC_REGRESSION.md`.
 */
export const BASELINE_AFFRICATES = {
  tunedCount: 2,
  tuned: ["CH", "JH"],
  CH: { jawOpen: 0.12, mouthFunnel: 0.1, mouthPucker: 0.2, mouthStretchLeft: 0.05, mouthStretchRight: 0.05 },
  JH: { jawOpen: 0.11, mouthFunnel: 0.085, mouthPucker: 0.16 },
  /** What they replaced, so the correction stays auditable. */
  previous: {
    CH: { mouthFunnel: 0.18, mouthPucker: 0.08 },
    JH: { mouthFunnel: 0.15, mouthPucker: 0.06 }
  },
  /** The floor every affricate in the family must now clear, in millimetres. */
  protrusionFloorMM: 1.2
} as const;

/** VOWELS — model-specific table; consonants are the male entries by identity. */
export const BASELINE_VOWELS = {
  tunedCount: 15,
  tuned: [
    "AA", "AE", "AH", "AO", "AW", "AY", "EH", "ER",
    "EY", "IH", "IY", "OW", "OY", "UH", "UW"
  ]
} as const;

/** JAW — no global multiplier and no open-vowel gain exist anywhere. */
export const BASELINE_JAW = {
  gain: 0.7,
  cap: 0.55,
  mouthCloseGain: 0.11,
  mouthCloseCap: 0.18
} as const;

// ---------------------------------------------------------------------------
// GOLDEN BEHAVIOURAL OUTPUTS
// ---------------------------------------------------------------------------

/**
 * What the accepted configuration MEASURES on the production payload
 * (`david-natural-speech-paragraph`, 37.256 s).
 *
 * These are the reviewed render, not aspirations. Tolerances are tight enough to
 * catch a behavioural change and loose enough to survive floating-point drift.
 */
export const BASELINE_GOLDEN = {
  payloadId: "david-natural-speech-paragraph",
  durationSeconds: 37.256,
  phonemeCount: 401,

  /** Head pose in degrees, after the 3.0x. Identical across four passes. */
  head: {
    yawP50: 0.127,
    yawP90: 0.361,
    yawMax: 1.194,
    pitchP50: 0.655,
    pitchP90: 1.311,
    pitchMax: 1.637,
    tolerance: 0.01
  },

  /** Gaze in degrees of real eyeball rotation. */
  gaze: {
    yawP90: 1.014,
    yawMax: 2.308,
    centreHoldWithinHalfDegree: 0.862,
    tolerance: 0.02
  },

  /** Blink schedule: seeded, deterministic, non-periodic. */
  blink: {
    count: 12,
    times: [1.59, 5.37, 7.81, 11.91, 16.56, 21.73, 24.14, 25.34, 29.75, 31.14, 32.78, 36.64],
    peakClosure: 1,
    tolerance: 0.01
  },

  /** Resting lid, raw (pre-calibration) on the blink channel. */
  lid: {
    p50: 0.164,
    framesAtZero: 0,
    tolerance: 0.01
  },

  /** Semantic brows: selective, three events, long holds. */
  brows: {
    events: 3,
    averageHoldSeconds: 0.79,
    max: 0.0989,
    neutralShareOfSpeakingFrames: 0.918,
    tolerance: 0.02
  },

  /**
   * Warmth: floor preserved, phrase-level range.
   *
   * MOVED BY THE SEAL-NORMALISATION CORRECTION, and this is the reason.
   *
   * These warmth numbers were measured while `affectArticulationYield`
   * normalised `mouthClose` by the same generic x2 it used for `mouthPucker`.
   * `mouthClose` tops out at 0.101 on this asset by design — it has the smallest
   * gain in the calibration table — so a FULL bilabial seal asked for only 20 %
   * of the yield a full round asked for, and the mouth corners barely moved at
   * P/B/M. The corrected normalisation divides the seal by
   * `ARTICULATION_REFERENCE.seal`, the measured 0.101376 of a full closure.
   *
   * Corner yield at P/B/M went 3.3 % -> 20.7 %; at O/U it is unchanged at 16.3 %.
   * The consequence for these golden values is a lower SPEAKING median, because
   * 13.5 % of speaking frames on this clip carry a real seal signal (measured:
   * 100 % of frames with seal > 0.3 are within 60 ms of a P/B/M). The affect
   * layer itself is untouched — the phrase envelope, the scale and both floors
   * are the accepted ones.
   *
   *   speakingSmileP50   0.194 -> 0.159   (-18 %)
   *   speakingSmileMax   0.435 -> 0.408   (-6 %)
   *   phraseSmileSpread  0.222 -> 0.198   (-11 %)
   *   phraseCheekSpread  0.245 -> 0.222   (-9 %; the cheeks have a 0.72 yield
   *                                        floor, so they compress least)
   *   renderingShare     0.997 -> 0.997   (unchanged: warmth is still on
   *                                        essentially every speaking frame)
   */
  warmth: {
    speakingSmileP50: 0.159,
    speakingSmileMax: 0.408,
    phraseSmileSpread: 0.198,
    phraseCheekSpread: 0.222,
    renderingShareOfSpeakingFrames: 0.997,
    tolerance: 0.02
  },

  /**
   * Eye softening: the region the coordination pass brought in.
   *
   * MOVED BY THE WHOLE-FACE COUPLING PASS, and this is the reason.
   *
   * The coordination pass SOLVED `AFFECT_REFERENCE.eyeSquint` so the runtime
   * PEAK landed on the accepted `happy` pose's own 0.14. That put the signal's
   * p90 at 0.093, a hair under `eyeSquintLeft`'s measured 0.10 `usefulMin`, so
   * only the extreme top decile ever reached the rig — 7.5 % of speaking frames
   * here, and 4-10 % across the conversational fixtures. Hardware read the eyes
   * as unchanged while the mouth worked.
   *
   * The reference now puts the warm signal's MEDIAN on the threshold (0.36 ->
   * 0.70), so the cue renders for about half a warm phrase instead of a
   * fifteenth of one.
   *
   *   max                 0.1414 -> 0.2749   (61 % of the channel's naturalMax,
   *                                           0.95 mm against a blink's 11.27)
   *   renderingShare      0.075  -> 0.950    on THIS payload, which carries a
   *                                          forced warm request across all 37 s
   *
   * The conversational fixtures, which resolve each sentence on its own text,
   * render 48 % warm / 43 % concerned / 37 % emphatic / 31 % positive — and
   * 0 % neutral, 0 % question. Where it renders it still varies 2.7x, so this is
   * a live cue at the render floor rather than a held offset.
   */
  eyeSoftening: {
    max: 0.2749,
    renderingShareOfSpeakingFrames: 0.95,
    tolerance: 0.02
  },

  /** Vowel differentiation: median of per-occurrence peaks, calibrated. */
  vowels: {
    aaJawOpen: 0.353,
    uwPucker: 0.574,
    iyStretch: 0.449,
    closestPairDistance: 0.119,
    tolerance: 0.02
  },

  /** Bilabial seal: every P/B/M reaches full closure. */
  bilabial: {
    occurrences: 40,
    allReachFullSeal: true,
    longestStuckClosureSeconds: 0
  },

  /** The OOV repair: `backpack` articulates instead of holding silent. */
  oovRepair: {
    word: "backpack",
    pronunciation: "B AE1 K P AE2 K",
    phonemesInWindow: ["B", "L", "UW", "B", "AE", "K", "P", "AE", "K", "B", "IH"]
  }
} as const;

// ---------------------------------------------------------------------------
// OWNERSHIP INVARIANTS
// ---------------------------------------------------------------------------

/**
 * The structural rules the contract enforces. Each is a statement about WHO may
 * write a region, not about a value — those survive retuning and are what stop
 * two controllers quietly fighting over the same channel.
 */
export const HYPER3D_OWNERSHIP_INVARIANTS = [
  "ONE HEAD OWNER: the threejs-talking-avatar adapter REPLACES the head command; the accepted planner is not sampled on that path.",
  "ONE GAZE OWNER: the eight eyeLook channels are deleted at the write seam and rewritten only from the upstream layer.",
  "ONE BLINK OWNER: eyeBlinkLeft/Right are deleted at the write seam and rewritten only from the upstream layer; the resting lid rides the same channel.",
  "ONE SEMANTIC AFFECT PATH: PerformanceIntent -> planSemanticAffectEnvelope -> AFFECT_TARGETS. No second envelope, no second scheduler.",
  "MFA OWNS CENTRAL SPEECH ARTICULATION: the phoneme timeline is the only source of jaw and central-mouth motion.",
  "SEMANTIC AFFECT CANNOT MODIFY jawOpen / mouthClose / mouthFunnel / mouthPucker: the affect pose never names them.",
  "PROSODIC BROW PULSE CANNOT REACH BROW MORPHS: browPulse is computed and reported, and is absent from every brow target.",
  "P/B/M SEAL REMAINS PROTECTED: the bilabial closure demands and the seal trajectory are untouched by expression.",
  "HYPER3D SPEECH TABLE REMAINS MODEL-SPECIFIC: miniface-male keeps its own reviewed table. Hyper3D re-authors the 15 tuned vowels and the 2 affricates (CH, JH); every other consonant is shared by identity."
] as const;

/**
 * Diagnostic surfaces that MUST stay available and MUST stay inert.
 *
 * The phoneme tuning and avatar view panels are kept deliberately — hardware
 * needs them. The rule is that none of them may alter a production default:
 * every one is empty, null or a pure pass-through until a person acts on it, and
 * a change becomes production only by being promoted into code.
 */
export const HYPER3D_DIAGNOSTIC_CONTRACT = [
  "phonemeTuningOverrides ships {} and is a strict no-op: the controller returns the shipped profile by identity.",
  "avatarViewApi touches the camera and the orbit target only; it reaches no rig, bone, morph or animation value.",
  "hyper3dGazeProbe ships null and hyper3dManualBlinkToken ships 0.",
  "the CoarticulationEngine's envelope and seal overrides are test-only parameters; production passes none of them.",
  "the adapter's gazeAmplitude is a diagnostic multiplier and the render path never passes it."
] as const;
