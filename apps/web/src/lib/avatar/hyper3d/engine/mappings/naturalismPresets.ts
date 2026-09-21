import type { BehaviorRange } from "../types/behaviorNaturalism";

export type NaturalismPresetId = "current" | "natural-a" | "natural-b" | "natural-c" | "accepted";

export interface NaturalismBlinkConfig {
  interval: BehaviorRange;
  longInterval: BehaviorRange;
  longIntervalProbability: number;
  shortInterval: BehaviorRange;
  shortIntervalProbability: number;
  close: BehaviorRange;
  hold: BehaviorRange;
  open: BehaviorRange;
  strength: number;
  strengthVariation: BehaviorRange;
  doubleBlinkProbability: number;
  doubleBlinkGap: BehaviorRange;
  /** Left/right start difference in seconds. */
  startOffset: BehaviorRange;
  /** Left/right strength difference as a fraction of the blink strength. */
  strengthAsymmetry: BehaviorRange;
  /**
   * Multiplier on the sampled blink interval while the avatar is speaking (§12).
   *
   * Below 1 means blinks come closer together during speech, which is the direction
   * real speakers go: roughly 17 blinks/min at rest against roughly 26/min in
   * conversation. Before this existed, `BlinkStateMachine` took no speaking input at
   * all and blinked at an identical rate either way.
   *
   * A CONSTANT multiplier is the point, not an implementation shortcut. Coefficient
   * of variation is scale-invariant, so scaling every draw cannot by itself reduce
   * the irregularity of the timing: the three-way long/short/normal mix and its
   * spread survive intact. Adding a speaking-only fixed interval, or raising the rate
   * by narrowing the ranges, would both have flattened exactly the irregularity that
   * keeps blinking from reading as a metronome.
   *
   * Measured end to end the CV does move slightly — 0.365 to 0.402 while speaking —
   * because §10's boundary jitter is an absolute offset, so it is proportionally
   * larger against shorter intervals. The direction is toward more irregularity, not
   * less, which is the safe side.
   */
  speakingIntervalScale: number;
}

export interface NaturalismGazeConfig {
  userFocusHold: BehaviorRange;
  /** Occasional longer settle on the user, so holds are not periodic. */
  longFocusHold: BehaviorRange;
  longFocusHoldProbability: number;
  briefThoughtProbability: number;
  briefThoughtDuration: BehaviorRange;
  softReturnDuration: BehaviorRange;
  yawDegrees: BehaviorRange;
  pitchDegrees: BehaviorRange;
  maxYawDegrees: number;
  maxPitchDegrees: number;
  /** Very small always-on drift around the current target, in degrees. */
  driftDegrees: number;
  driftCycle: BehaviorRange;
  microSaccadeAmplitude: number;
  microSaccadeInterval: BehaviorRange;
  microSaccadeDuration: number;
  /** Minimum change required before a new target is accepted. */
  minTargetChangeDegrees: number;
  /**
   * Exponent biasing glance magnitude toward small. 1 is uniform; higher values
   * make most shifts tiny, medium ones rare and large ones very rare.
   */
  shiftMagnitudeBias: number;
  /**
   * Ceiling on how long the eyes may go without a glance, in seconds (§P8).
   * 0 disables it, which is what every preset except `accepted` uses so the A/B
   * history stays comparable.
   *
   * This is a bound on the tail, not a rate. `briefThoughtProbability` already
   * decides how often a glance happens; this only intervenes in the sessions
   * where the dice never came up, which measurement showed to be roughly one in
   * five over a 37 s clip. When it fires it takes the ordinary brief-thought
   * path, so the glance is the same shape and size as any other.
   */
  maxSecondsWithoutGlance: number;
  /** Delay before the single settling micro-saccade that follows a return. */
  settleDelay: BehaviorRange;
  speakingScale: number;
  smoothingSpeed: number;
  /** Softer damping used while easing back to the user. */
  returnSmoothingSpeed: number;
  morphPerDegree: number;
}

export interface NaturalismStillnessConfig {
  normal: BehaviorRange;
  occasional: BehaviorRange;
  occasionalProbability: number;
  probabilityAfterEvent: number;
  densityWindowSeconds: number;
  densityThreshold: number;
  densityProbabilityBoost: number;
  densityDurationBoost: number;
}

export interface NaturalismExpressionConfig {
  interval: BehaviorRange;
  postSpeechDelay: BehaviorRange;
  amplitudeScale: number;
  ordinaryAsymmetry: BehaviorRange;
  occasionalAsymmetry: BehaviorRange;
  occasionalAsymmetryProbability: number;
  cooldownScale: number;
  /** How many recent events are remembered for repetition prevention. */
  historyLength: number;
}

/**
 * §P16. Idle orientation with presence: a resting orientation that MIGRATES
 * rather than a target that is redrawn around zero, plus the neck coupling and
 * the critically-damped follower that make the turn read as anatomical.
 */
export interface NaturalismPresenceConfig {
  /** Multiplier on the posture amplitudes and on the idle head clamp. 1 = P15. */
  scale: number;
  /**
   * How much of a new orientation is a migration of the RESTING orientation
   * rather than an excursion from centre. 0 reproduces P15's redraw-around-zero.
   */
  restingMigration: number;
  /** How far the resting orientation itself may wander from true centre, in degrees. */
  restingYawDegrees: number;
  restingPitchDegrees: number;
  /** Chance a given orientation change returns toward the user instead of away. */
  returnToUserProbability: number;
  /** Share of a yaw change carried by the neck rather than the head. */
  neckShare: number;
  /** Seconds the neck leads the head by, so the turn starts at the base. */
  neckLeadSeconds: number;
  /** Natural frequency of the critically damped orientation follower, in Hz. */
  followerHz: number;
  /**
   * §P17 multiplier on `followerHz`. 1 is the P16 speed. Raising it shortens
   * the settling time of a critically damped system without changing where it
   * settles, so range and smoothness are preserved by construction.
   */
  responseScale: number;
  /** Multiplier on how long an orientation is held once reached. */
  holdScale: number;
  /** Chance an orientation change is preceded by a gaze shift the head then follows. */
  gazeLeadsProbability: number;
  /** Seconds the head waits after the eyes commit, when gaze leads. */
  gazeLeadSeconds: number;
  /** Chance an orientation change is eyes-only and the head never follows. */
  eyesOnlyProbability: number;
  /**
   * Fraction of each posture hold spent at the FULL drawn excursion before the
   * head starts easing back toward its resting orientation. 1 holds the whole
   * interval, which is the pre-existing behaviour; 0.8 leaves the side pose 20%
   * earlier.
   *
   * `postureTarget` used to be drawn once and held flat for the entire 10-22
   * s interval (`postureHold` 5-11 s at `holdScale` 2), so a migrated
   * resting orientation plus a full excursion parked the head out to one side
   * for the whole of it. That is the "stays there too long" complaint.
   *
   * This shortens the DWELL without touching the REACH: the excursion is still
   * drawn at full size and the head still arrives at the same peak, and the
   * redraw cadence is untouched so the motion does not get busier. Attribution
   * ruled out every alternative. `followerHz` moved the dwell by 2% — against a
   * target that does not move, follower speed cannot change where the head
   * sits. Halving `postureHold` and dropping `holdScale` both shorten the dwell
   * and both buy it with a 24% higher peak yaw and 50-67% more travel.
   * `restingMigration` and `returnToUserProbability` work in the other
   * direction but cut peak yaw 6-12%, and a continuous decay of `resting` cut
   * the yaw range 16% because it fights the migration walk down to a smaller
   * stationary spread. Every one of them is an amplitude change; this is not.
   */
  postureDwellFraction: number;
  /**
   * Where the eased excursion lands, as a fraction of its drawn size. It is a
   * return PART OF the way home, never to centre: the head settles onto its own
   * migrated resting orientation plus a residual lean, so the recovery reads as
   * relaxing out of a pose rather than snapping to front-locked. Fixed across
   * the review modes so they differ in timing alone.
   */
  postureRecoveryFloor: number;
  /**
   * Fraction of the migrated RESTING orientation the head keeps at the end of
   * the recovery, alongside `postureRecoveryFloor` for the excursion.
   *
   * Easing the excursion alone barely moves the dwell — dropping its floor from
   * 0.45 to 0.2 changed mean side dwell by 0.4 points — because most of the
   * time spent out to one side is the migrated home underneath it, not the
   * excursion on top. Coming partway off the home as well is what actually
   * shortens the pose.
   *
   * This eases only the RENDERED target. `resting` itself is left alone, so the
   * migration random walk keeps its own statistics and the next pose is still
   * drawn from the full home — which is precisely why yaw range and peak
   * survive here where a continuous decay of `resting` cost 16% of the range.
   */
  postureRecoveryRestShare: number;
}

export interface NaturalismHeadConfig {
  /** Fraction of the gaze angle the head reproduces. */
  gazeFollowRatio: number;
  gazeFollowDelay: number;
  gazeFollowThresholdDegrees: number;
  /** Gaze must remain away this long before the head commits. */
  gazeFollowDwell: number;
  neckContribution: number;
  neckDelay: number;
  postureYawDegrees: number;
  posturePitchDegrees: number;
  postureRollDegrees: number;
  postureHold: BehaviorRange;
  postureSmoothingSpeed: number;
  /**
   * §P16 idle presence. All-neutral values reproduce P15 exactly, so this block
   * is inert until a diagnostic configuration raises it.
   *
   * The shipped idle head could not leave centre for two independent reasons:
   * `postureYawDegrees` was 0.34 deg, and a hard clamp of 1.7 deg sat behind it.
   * Neither was measured against the asset — the geometric sweeps in
   * `docs/evidence/p16-idle/range-sweeps.json` accept 15 deg of head yaw with
   * 0.42 mm of hair/scalp mismatch and no neck stretch at all.
   */
  presence: NaturalismPresenceConfig;
  eventScale: number;
  /** Idle head contribution retained while the speaking controller owns the head. */
  speakingIdleContribution: number;
  /**
   * §P18. What fraction of the idle exploratory head survives ESTABLISHED
   * speech. `null` keeps `speakingIdleContribution` and reproduces P16/P17
   * exactly.
   *
   * The P16 idle head was the dominant source of speaking sway: isolated during
   * speech it reached 2.442 deg of yaw against the speaking controller's 0.313,
   * and it carried the 415 reversals/min and 0.955 alternation rate that read as
   * a metronome. P16's own brief said idle may explore but speaking must
   * preserve engagement; this is that rule, enforced. It changes NOTHING while
   * idle — the suppression is gated on the speaking transition weight.
   */
  speakingIdleFloor: number | null;
}

/**
 * How strongly sentence/phrase boundaries bias blink, gaze and brow (§10).
 *
 * Every value here is a BIAS, not a trigger. §9's target is "clusters near pauses
 * like a real speaker", and a deterministic blink-on-every-boundary would score a
 * perfect 0.00 against the landmark while reading as a tell — so each mechanism
 * keeps a probability roll and a jitter window, and none of them can fire twice on
 * the same boundary.
 */
export interface NaturalismBoundaryConfig {
  /** Chance a scheduled blink is pulled onto an upcoming boundary rather than left alone. */
  blinkPullProbability: number;
  /** How far ahead of a scheduled blink a boundary may be to capture it. */
  blinkReachSeconds: number;
  /** A boundary nearer than this is too close to retarget without looking snapped-to. */
  blinkMinimumLeadSeconds: number;
  /** Jitter applied around the boundary, so pulled blinks scatter instead of pinning. */
  blinkJitter: BehaviorRange;
  /** Window around a boundary over which `gazeProbabilityGain` eases from full to 1. */
  gazeWindowSeconds: number;
  /** Multiplier on `briefThoughtProbability` at a boundary, easing to 1 at the window edge. */
  gazeProbabilityGain: number;
  /** How far a gaze hold may be stretched forward to expire on a boundary. */
  gazeDeferSeconds: number;
  /** Window before a boundary in which brow/warmth may take their second firing reason. */
  browWindowSeconds: number;
  /** Chance that window is actually taken, per boundary. Sentence boundaries only. */
  browSentenceProbability: number;
  /** Same, for the shorter phrase-level boundaries. */
  browPhraseProbability: number;
  /** Minimum seconds since the last brow pulse, for the boundary path only. */
  browSpacingSeconds: number;
  /** Minimum seconds since the last warmth pulse, for the boundary path only. */
  warmthSpacingSeconds: number;
  /** Chance a boundary that fires brow emphasis also fires a warmth pulse. */
  warmthBoundaryProbability: number;
}

export interface NaturalismSpeechConfig {
  startBlendSeconds: number;
  endFacialReturnSeconds: number;
  endFullReturnSeconds: number;
  postSettleDelay: BehaviorRange;
  browEmphasisProbability: number;
  browEmphasisPeak: BehaviorRange;
  browEmphasisRarePeak: BehaviorRange;
  browEmphasisRareProbability: number;
  browEmphasisSpacing: number;
  /**
   * Hard floor between brow pulses of ANY firing reason, in seconds. 0 is inert and
   * reproduces the pre-P3 stream exactly.
   *
   * §10 gave brow emphasis two firing reasons — a loud onset after a quiet gap, and
   * an approaching sentence boundary — and gave each its OWN spacing counter, so
   * that adding the second could not cost the first any events. That guarantee was
   * kept, and the cost of keeping it is that neither counter can see the other:
   * the effective floor became the smaller of the two (1.1 s), not either one.
   *
   * P3 measured the result at 20.9 brow events per minute — a pulse every 2.9 s,
   * with the forehead visibly active 27% of speaking time. That is the "forehead
   * fires every few seconds" defect, and it is a scheduling problem rather than an
   * amplitude one: both reasons ARE speech-aware (§9 measured the energy reason at
   * 0.52 against word starts and §10 the boundary reason at 0.54 against sentence
   * ends), so neither should be removed.
   *
   * This is the arbitration those two reasons never had. It is deliberately a floor
   * rather than a probability: lowering either probability would thin the events
   * everywhere, including the ones that land well, while a floor only ever removes
   * the pulse that arrives too soon after another one.
   */
  browRefractorySeconds: number;
  /** Peak eyelid-lowering carried by the warmth pulse (§P10). 0 disables it. */
  warmthLidSupport: number;
  /**
   * FINAL CONVERGENCE. Hard ceiling on every NON-BLINK eyelid contribution.
   *
   * P17.1 cut the §P17 director's sustained `eyeBlink` values because the render
   * read as sedated. It fixed the idle composition only: the §P10 warmth lid
   * support lives in this preset and is scaled by `transitionWeight`, so it is
   * active exclusively DURING SPEECH and P17.1 never touched it. Traced on the
   * production paragraph it held `eyeBlink` at 0.160-0.185 for 9.5 % of speaking
   * frames with no blink in flight, in one unbroken 1.22 s stretch — a permanent
   * partial blink, which is precisely the defect the hardware review reported
   * returning while speaking.
   *
   * The fix is architectural rather than a retuned constant. Expression support
   * and blinking are DIFFERENT ACTS that happen to share the only channel this
   * asset renders through, so they get different bounds: support is clipped
   * here, a real blink is never clipped at all and still reaches full closure.
   * Every non-blink writer routes through `HumanBehaviorController.addLidSupport`,
   * so the separation is enforced in one place instead of being a convention.
   *
   * `warmthLidSupport` is deliberately left at its measured §P10 value; this
   * clips the result rather than redefining the mechanism, so P10's evidence and
   * its tests still describe what they measured.
   */
  awakeLidCeiling: number;
  browEmphasisAttack: number;
  browEmphasisHold: number;
  browEmphasisRelease: number;
  /** Energy level that marks a new phrase after a quiet gap. */
  phraseOnsetEnergy: number;
  phraseGapSeconds: number;
  warmthProbability: number;
  smileOffset: BehaviorRange;
  cheekOffset: BehaviorRange;
  warmthDuration: BehaviorRange;
  gazeEventScale: number;
  /** Speech-boundary coupling for blink, gaze and brow/warmth (§10). */
  boundary: NaturalismBoundaryConfig;
}

export interface NaturalismPreset {
  id: NaturalismPresetId;
  label: string;
  notes: string;
  blink: NaturalismBlinkConfig;
  gaze: NaturalismGazeConfig;
  stillness: NaturalismStillnessConfig;
  expression: NaturalismExpressionConfig;
  head: NaturalismHeadConfig;
  speech: NaturalismSpeechConfig;
}

const naturalB: NaturalismPreset = {
  id: "natural-b",
  label: "Natural B",
  notes: "Balanced human pacing: long calm holds, protected stillness, sparse coordinated events.",
  blink: {
    interval: { min: 2.8, max: 7 },
    longInterval: { min: 7, max: 10 },
    longIntervalProbability: 0.16,
    shortInterval: { min: 1.8, max: 2.6 },
    shortIntervalProbability: 0.1,
    close: { min: 0.065, max: 0.115 },
    hold: { min: 0.015, max: 0.055 },
    open: { min: 0.11, max: 0.2 },
    strength: 1,
    strengthVariation: { min: 0.94, max: 1 },
    doubleBlinkProbability: 0.06,
    doubleBlinkGap: { min: 0.11, max: 0.19 },
    startOffset: { min: 0.005, max: 0.025 },
    strengthAsymmetry: { min: 0, max: 0.04 },
    // 0.75 raises the speaking rate by 1/0.75 = 1.33x. Measured on the audit clip:
    // 9.73 blinks/min while speaking before, against a human conversational figure
    // near 26/min — this closes part of that gap without reaching for it in one
    // step, which the review asked for ("moderately higher").
    speakingIntervalScale: 0.75
  },
  gaze: {
    // Shorter common hold so the eyes do not sit dead between glances, with an
    // occasional long settle so the rhythm never reads as periodic.
    userFocusHold: { min: 2, max: 5 },
    longFocusHold: { min: 6, max: 9 },
    longFocusHoldProbability: 0.26,
    briefThoughtProbability: 0.46,
    briefThoughtDuration: { min: 0.5, max: 1.8 },
    // Slower, softer return so coming back to the user feels subconscious.
    softReturnDuration: { min: 0.45, max: 1.1 },
    yawDegrees: { min: 1.4, max: 5.2 },
    pitchDegrees: { min: 1, max: 2.4 },
    maxYawDegrees: 5.5,
    maxPitchDegrees: 2.4,
    driftDegrees: 0.16,
    driftCycle: { min: 6.5, max: 11 },
    microSaccadeAmplitude: 0.13,
    // Background micro-saccades are now rare; the routine settle happens after a
    // shift instead, so the eyes are never continuously busy.
    microSaccadeInterval: { min: 7, max: 16 },
    microSaccadeDuration: 0.09,
    minTargetChangeDegrees: 0.8,
    shiftMagnitudeBias: 2.8,
    maxSecondsWithoutGlance: 0,
    settleDelay: { min: 0.35, max: 0.95 },
    speakingScale: 0.65,
    smoothingSpeed: 2.2,
    returnSmoothingSpeed: 1.5,
    morphPerDegree: 0.022
  },
  stillness: {
    normal: { min: 2, max: 6 },
    occasional: { min: 6, max: 10 },
    occasionalProbability: 0.26,
    probabilityAfterEvent: 0.55,
    densityWindowSeconds: 22,
    densityThreshold: 3,
    densityProbabilityBoost: 0.3,
    densityDurationBoost: 2.4
  },
  expression: {
    interval: { min: 8, max: 18 },
    postSpeechDelay: { min: 2, max: 5 },
    amplitudeScale: 1,
    ordinaryAsymmetry: { min: 0.02, max: 0.08 },
    occasionalAsymmetry: { min: 0.08, max: 0.15 },
    occasionalAsymmetryProbability: 0.24,
    cooldownScale: 1,
    historyLength: 3
  },
  head: {
    gazeFollowRatio: 0.18,
    gazeFollowDelay: 0.14,
    gazeFollowThresholdDegrees: 2.2,
    gazeFollowDwell: 0.22,
    neckContribution: 0.2,
    neckDelay: 0.12,
    postureYawDegrees: 0.34,
    posturePitchDegrees: 0.24,
    postureRollDegrees: 0.15,
    postureHold: { min: 5, max: 11 },
    postureSmoothingSpeed: 0.55,
    presence: {
      scale: 1, restingMigration: 0, restingYawDegrees: 0, restingPitchDegrees: 0,
      returnToUserProbability: 0.5, neckShare: 0, neckLeadSeconds: 0, followerHz: 0, responseScale: 1,
      holdScale: 1, gazeLeadsProbability: 0, gazeLeadSeconds: 0, eyesOnlyProbability: 0, postureDwellFraction: 1, postureRecoveryFloor: 0.45, postureRecoveryRestShare: 0.45
    },
    eventScale: 0.62,
    speakingIdleContribution: 0.12,
    speakingIdleFloor: null
  },
  speech: {
    startBlendSeconds: 0.24,
    endFacialReturnSeconds: 0.52,
    endFullReturnSeconds: 1,
    postSettleDelay: { min: 2, max: 5 },
    browEmphasisProbability: 0.45,
    browEmphasisPeak: { min: 0.04, max: 0.14 },
    browEmphasisRarePeak: { min: 0.15, max: 0.2 },
    browEmphasisRareProbability: 0.12,
    browEmphasisSpacing: 2.6,
    // Swept over 12 seeds on the audit clip. The curve is smooth, so the value is
    // chosen for what it produces rather than for a knee:
    //
    // | floor | events/min | visible | energy : boundary | shortest gap |
    // |---|---|---|---|---|
    // | 0 (pre-P3) | 20.93 | 26.5% | 106 : 50 | 0.08 s |
    // | 3.0 | 14.49 | 18.7% | 89 : 19 | 3.03 s |
    // | **4.0** | **11.94** | **15.5%** | **73 : 16** | **4.05 s** |
    // | 6.0 | 8.45 | 10.9% | 54 : 9 | 6.05 s |
    //
    // 4 s is one pulse per 5 s of speech, which reads as occasional emphasis rather
    // than a repeating gesture, and both firing reasons still survive in quantity —
    // the point was to stop them stacking, not to remove either. The 0.08 s shortest
    // gap in the pre-P3 row is the defect in one number: two brow pulses five frames
    // apart, one from each reason, neither aware of the other.
    //
    // Amplitude is deliberately NOT part of this. Peak rendered influence is 0.4753
    // at every value in the sweep, because a floor removes whole pulses and never
    // scales one. §16's known fringe occlusion is a reason not to raise the brows;
    // it is not a reason to lower them, and lowering them here would have confounded
    // "fires too often" with "fires too hard".
    browRefractorySeconds: 4,
  /**
   * Peak eyelid-lowering support carried by the warmth pulse (§P10), before the
   * behaviour intensity and safety scale. 0 disables it, which every preset
   * except `accepted` uses so the A/B history stays readable.
   *
   * This is the ONE upper-face dimension P10 found usable. The asset's
   * `eyeSquint*` moves the eyeball and never touches a lid, `browDown*` carries
   * no geometry, and `eyeWide*` moves the forehead instead of opening the eye;
   * the eyelid and forehead bones reach 9 % and 2.5 % of the effect they would
   * need. Only the blink shape at low amplitude narrows the palpebral aperture
   * by a readable amount — 22.7 % at an influence of 0.20 — with the eyeballs
   * measurably still.
   *
   * It is written with `Math.max` against whatever the blink writer already put
   * in the channel, so a blink always wins and its shape is never deepened.
   */
  warmthLidSupport: 0,
    // No support to clip on the base presets; the accepted preset sets both.
    awakeLidCeiling: 1,
    browEmphasisAttack: 0.16,
    browEmphasisHold: 0.12,
    browEmphasisRelease: 0.34,
    phraseOnsetEnergy: 0.38,
    phraseGapSeconds: 0.28,
    warmthProbability: 0.22,
    smileOffset: { min: 0.01, max: 0.06 },
    cheekOffset: { min: 0.005, max: 0.04 },
    warmthDuration: { min: 0.9, max: 2 },
    gazeEventScale: 0.55,
    boundary: {
      blinkPullProbability: 0.62,
      blinkReachSeconds: 2.2,
      blinkMinimumLeadSeconds: 0.12,
      // Asymmetric on purpose: a blink that punctuates a sentence starts just before
      // the speaker stops and finishes inside the silence, so the window leans late.
      blinkJitter: { min: -0.12, max: 0.26 },
      gazeWindowSeconds: 0.5,
      gazeProbabilityGain: 1.6,
      // Swept over 16 seeds against the derived boundary set: 1.2 s barely moved the
      // mean (0.747 -> 0.712) and made distance to SENTENCE boundaries worse; the
      // curve turns sharply between 2.0 and 2.4 and flattens past 3.4. 2.8 s takes
      // most of the available improvement (0.747 -> 0.551 against all boundaries,
      // 1.196 -> 0.837 against sentence boundaries) at an 11% REDUCTION in gaze-shift
      // count, which is the right direction for "more coordinated, not more animated".
      gazeDeferSeconds: 2.8,
      browWindowSeconds: 0.34,
      browSentenceProbability: 0.7,
      // Lower than the sentence figure on purpose. A phrase break is a weaker cue,
      // and firing at every one of them dilutes the sentence-end clustering §9 asked
      // for without adding anything a viewer would read as intent.
      browPhraseProbability: 0.15,
      browSpacingSeconds: 1.1,
      warmthSpacingSeconds: 3.2,
      warmthBoundaryProbability: 0.4
    }
  }
};

const clone = (preset: NaturalismPreset): NaturalismPreset => structuredClone(preset);

/**
 * Boundary coupling switched fully off.
 *
 * Used by the "Current" preset, whose whole purpose is to reproduce pre-refinement
 * pacing for A/B. Zeroing the three entry points — the blink pull, the gaze window
 * and the brow window — makes every §10 code path unreachable rather than merely
 * unlikely, so "Current" stays a true baseline.
 */
const inertBoundary = (): NaturalismBoundaryConfig => ({
  ...structuredClone(naturalB.speech.boundary),
  blinkPullProbability: 0,
  gazeWindowSeconds: 0,
  gazeDeferSeconds: 0,
  browWindowSeconds: 0,
  browSentenceProbability: 0,
  browPhraseProbability: 0,
  warmthBoundaryProbability: 0
});

/**
 * "Current" reproduces the pre-refinement pacing so the behaviour panel can A/B
 * against the shipped avatar without touching the accepted strength profile.
 */
const current: NaturalismPreset = {
  ...clone(naturalB),
  id: "current",
  label: "Current",
  notes: "Pre-refinement pacing: continuous drift, frequent gaze retargeting, no protected stillness.",
  blink: {
    ...clone(naturalB).blink,
    interval: { min: 2.7, max: 6.2 },
    longInterval: { min: 6.7, max: 9 },
    longIntervalProbability: 0.14,
    shortIntervalProbability: 0,
    close: { min: 0.078, max: 0.125 },
    hold: { min: 0.025, max: 0.065 },
    open: { min: 0.115, max: 0.185 },
    strength: 0.96,
    strengthVariation: { min: 1, max: 1 },
    startOffset: { min: 0.01, max: 0.01 },
    strengthAsymmetry: { min: 0, max: 0 },
    // Pre-refinement pacing blinked at one rate regardless of speech.
    speakingIntervalScale: 1
  },
  gaze: {
    ...clone(naturalB).gaze,
    userFocusHold: { min: 3.4, max: 8 },
    longFocusHoldProbability: 0,
    briefThoughtProbability: 0.64,
    softReturnDuration: { min: 0.45, max: 0.45 },
    shiftMagnitudeBias: 1,
    maxSecondsWithoutGlance: 0,
    settleDelay: { min: 0.12, max: 0.12 },
    returnSmoothingSpeed: 2.2,
    driftDegrees: 0,
    microSaccadeAmplitude: 0.07,
    microSaccadeInterval: { min: 0.12, max: 0.12 },
    microSaccadeDuration: 0.12,
    minTargetChangeDegrees: 0,
    speakingScale: 0.32
  },
  stillness: {
    ...clone(naturalB).stillness,
    normal: { min: 0, max: 0 },
    occasional: { min: 0, max: 0 },
    occasionalProbability: 0,
    probabilityAfterEvent: 0,
    densityProbabilityBoost: 0,
    densityDurationBoost: 0
  },
  expression: {
    ...clone(naturalB).expression,
    interval: { min: 6.2, max: 12.5 },
    ordinaryAsymmetry: { min: 0, max: 0 },
    occasionalAsymmetry: { min: 0, max: 0 },
    occasionalAsymmetryProbability: 0,
    historyLength: 0
  },
  head: {
    ...clone(naturalB).head,
    gazeFollowRatio: 0,
    postureYawDegrees: 0.62,
    posturePitchDegrees: 0.42,
    postureRollDegrees: 0.26,
    postureHold: { min: 4.4, max: 5.9 },
    postureSmoothingSpeed: 3,
    speakingIdleContribution: 0
  },
  speech: {
    ...clone(naturalB).speech,
    startBlendSeconds: 0.24,
    endFacialReturnSeconds: 0.72,
    endFullReturnSeconds: 0.72,
    postSettleDelay: { min: 2, max: 4 },
    browEmphasisProbability: 0,
    warmthProbability: 0,
    // Pre-refinement pacing had no shared floor, and this preset exists to be that
    // baseline. Moot in practice — `browEmphasisProbability: 0` means no pulse ever
    // fires here — but left explicit so "Current" is a true zero on every axis.
    browRefractorySeconds: 0,
    boundary: inertBoundary()
  }
};

const naturalA: NaturalismPreset = {
  ...clone(naturalB),
  id: "natural-a",
  label: "Natural A",
  notes: "Calmest option: longer holds, more stillness, fewer expressions, minimal head follow.",
  blink: { ...clone(naturalB).blink, interval: { min: 3.2, max: 7.4 }, longIntervalProbability: 0.2, shortIntervalProbability: 0.06 },
  gaze: {
    ...clone(naturalB).gaze,
    userFocusHold: { min: 2.6, max: 6 },
    longFocusHoldProbability: 0.34,
    briefThoughtProbability: 0.32,
    yawDegrees: { min: 2.5, max: 4.2 },
    pitchDegrees: { min: 1.5, max: 2.1 },
    microSaccadeInterval: { min: 2.2, max: 5.5 },
    speakingScale: 0.55
  },
  stillness: { ...clone(naturalB).stillness, normal: { min: 3, max: 6.5 }, occasionalProbability: 0.34, probabilityAfterEvent: 0.68 },
  expression: { ...clone(naturalB).expression, interval: { min: 7, max: 14 }, amplitudeScale: 0.85, cooldownScale: 1.25 },
  head: { ...clone(naturalB).head, gazeFollowRatio: 0.12, neckContribution: 0.16, postureYawDegrees: 0.26, speakingIdleContribution: 0.08 },
  speech: { ...clone(naturalB).speech, browEmphasisProbability: 0.32, warmthProbability: 0.16, postSettleDelay: { min: 2.6, max: 5 } }
};

const naturalC: NaturalismPreset = {
  ...clone(naturalB),
  id: "natural-c",
  label: "Natural C",
  notes: "Most responsive option: shorter holds, stronger head follow, more frequent speech emphasis.",
  blink: { ...clone(naturalB).blink, interval: { min: 2.8, max: 6.2 }, shortIntervalProbability: 0.14, doubleBlinkProbability: 0.08 },
  gaze: {
    ...clone(naturalB).gaze,
    userFocusHold: { min: 1.8, max: 4.2 },
    longFocusHoldProbability: 0.18,
    briefThoughtProbability: 0.52,
    yawDegrees: { min: 3, max: 5.5 },
    pitchDegrees: { min: 1.6, max: 2.4 },
    speakingScale: 0.75
  },
  stillness: { ...clone(naturalB).stillness, normal: { min: 2, max: 5 }, occasionalProbability: 0.18, probabilityAfterEvent: 0.44 },
  expression: { ...clone(naturalB).expression, interval: { min: 5, max: 10 }, amplitudeScale: 1.15, occasionalAsymmetryProbability: 0.3 },
  head: { ...clone(naturalB).head, gazeFollowRatio: 0.28, neckContribution: 0.24, gazeFollowDelay: 0.1, speakingIdleContribution: 0.18 },
  speech: { ...clone(naturalB).speech, browEmphasisProbability: 0.58, warmthProbability: 0.3, postSettleDelay: { min: 2, max: 4 } }
};

/** Accepted behaviour profile. Natural B was selected as the most natural, not the most active. */
const accepted: NaturalismPreset = (() => {
  const base = clone(naturalB);
  /**
   * P8: the only deviation from Natural B, and it targets the TAIL rather than
   * the rate.
   *
   * At Natural B's settings the scheduler commits to a glance on 46 % of hold
   * expirations, which over a 37 s clip leaves a long tail of sessions where no
   * glance is ever scheduled: measured over 16 seeds, 3 produced zero glances
   * across the whole clip and the median session held within a degree of centre
   * for 17.9 s at a stretch. That tail is what read as a fixed stare.
   *
   * Raising `briefThoughtProbability` was measured first and rejected. It does
   * remove the tail, but it changes every session to fix the one in five that
   * was broken, and at every value from 0.50 upward it pushed the long-standing
   * p90 eye-yaw calmness bound past 5 degrees. A ceiling on time-without-a-glance
   * fixes exactly the sessions that are broken and leaves the rest untouched.
   */
  base.gaze.maxSecondsWithoutGlance = 12;
  /**
   * P10: the only upper-face dimension the asset can actually deliver.
   *
   * Measured on the shipped GLB: `eyeSquint*` changes the palpebral aperture by
   * 0.000 mm while moving the eyeball 0.762 mm, `browDown*` renders nothing at
   * all, and `eyeWide*` opens the lids 0.000 mm while lifting the forehead
   * 1.161 mm. The eyelid bones reach 9.2 % of a readable squint at 14 degrees
   * and the seventeen forehead bones together reach 2.5 % of a brow raise, so
   * neither missing dimension can be restored by bone.
   *
   * What does work is the blink shape held at low amplitude: 22.7 % narrowing at
   * an influence of 0.20, with 0.0001 mm of eyeball travel. Carried by the
   * existing warmth pulse so it inherits that pulse's spacing and randomness
   * rather than introducing a scheduler, and written with `Math.max` so a blink
   * always wins.
   */
  base.speech.warmthLidSupport = 0.28;
  /**
   * 0.10 rendered, against the 0.185 the unclipped warmth support reached.
   *
   * Chosen as the top of the band §P17.1 accepted for the director's own
   * sustained eyelid values (0.03-0.11) after the hardware review, so the two
   * sustained eyelid sources are now bounded consistently instead of one being
   * corrected and the other overlooked. P10 measured 22.7 % narrowing at an
   * influence of 0.20; this is under half of that — present enough to keep the
   * smile reaching the eyes, far short of reading as a half-blink.
   */
  base.speech.awakeLidCeiling = 0.1;
  return { ...base, id: "accepted", label: "Accepted", notes: "Natural B selected as the accepted behaviour profile; P8 added a 12 s glance ceiling and P10 added warmth-carried eyelid support." };
})();

export const naturalismPresets: Record<NaturalismPresetId, NaturalismPreset> = {
  current,
  "natural-a": naturalA,
  "natural-b": naturalB,
  "natural-c": naturalC,
  accepted
};

export const naturalismPresetIds = Object.keys(naturalismPresets) as NaturalismPresetId[];
export const defaultNaturalismPresetId: NaturalismPresetId = "accepted";
export const getNaturalismPreset = (id: NaturalismPresetId) => naturalismPresets[id] ?? naturalismPresets[defaultNaturalismPresetId];
