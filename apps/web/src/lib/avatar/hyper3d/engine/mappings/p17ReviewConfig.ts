import type { NaturalismPresenceConfig } from "./naturalismPresets";
import type { PerformanceStateId } from "../engine/behaviour/naturalism/PerformanceStateDirector";
import type { PerformanceSettings } from "../engine/behaviour/IdleExpressionController";
import type { SpeakingMotionProfileId } from "../engine/animation/SpeakingGestureDirector";
import type { ConductorTuningId } from "../engine/animation/SpeechPerformanceConductor";
import type { MotorTuningId } from "../engine/animation/SpeakingMotorController";
import type { TalkingHeadTuningId } from "../engine/animation/TalkingHeadSpeakingAdapter";
import { idleEngagementConfigs, type IdleEngagementConfig } from "../engine/behaviour/naturalism/IdleGazeEngagement";

/**
 * §P17 hardware-review configurations, in one place.
 *
 * These live outside the panel component so the tests can assert the exact
 * values the buttons apply rather than pattern-matching JSX. A review button
 * that renders but applies the wrong configuration is the failure mode a
 * source-text assertion cannot catch.
 */

/** The P16 orientation architecture, accepted by hardware review. */
export const P16_MAX_PRESENCE: NaturalismPresenceConfig = {
  scale: 26,
  restingMigration: 0.65,
  postureDwellFraction: 1,
  postureRecoveryFloor: 0.45,
  postureRecoveryRestShare: 0.45,
  restingYawDegrees: 8,
  restingPitchDegrees: 4,
  returnToUserProbability: 0.45,
  neckShare: 0.35,
  neckLeadSeconds: 0.1,
  followerHz: 0.45,
  responseScale: 1,
  holdScale: 2,
  gazeLeadsProbability: 0.55,
  gazeLeadSeconds: 0.25,
  eyesOnlyProbability: 0.3
};

/**
 * The selected P17 head response.
 *
 * 1.2 gives 24.9% faster settling with the yaw range preserved to within 0.3%
 * and the neck range bit-identical; only the follower's natural frequency
 * changes, so the system stays critically damped.
 */
export const P17_RESPONSE_SCALE = 1.2;

/** P16's architecture at the faster P17 response. Range and neck are unchanged. */
export const P17_MAX_PRESENCE: NaturalismPresenceConfig = {
  ...P16_MAX_PRESENCE,
  responseScale: P17_RESPONSE_SCALE
};

/** Director on at full review strength. */
export const P17_PERFORMANCE: PerformanceSettings = {
  enabled: true,
  intensity: 1,
  holdScale: 1,
  hold: null
};

/** The same configuration with one state pinned for inspection. */
export const p17Hold = (hold: PerformanceStateId): PerformanceSettings => ({ ...P17_PERFORMANCE, hold });


/**
 * §P17.1 MAX VISUAL FIX.
 *
 * Same architecture as P17 MAX PERFORMANCE — the director on, P16's accepted
 * orientation at scale 26, the selected response of 1.2. What changed is the
 * STATE COMPOSITION inside `PerformanceStateDirector`, not this configuration:
 * the eyelid support was cut from a sustained 30-42% blink to 3-11%, and the
 * lower face gained `mouthUpperUp`, `noseSneer` and `mouthShrugLower`.
 *
 * It is a separate export rather than an alias so a reviewer can A/B P17 and
 * P17.1 from the panel, and so the tests can assert they are the same
 * orientation configuration driving a different face.
 */
export const P171_MAX_VISUAL: PerformanceSettings = { ...P17_PERFORMANCE };
export const P171_MAX_PRESENCE: NaturalismPresenceConfig = { ...P17_MAX_PRESENCE };

/** The two states P17.1 exists to correct. */
export const p171Hold = (hold: Extract<PerformanceStateId, "WARM_ATTENTIVE" | "SOFT_SMILE">): PerformanceSettings =>
  ({ ...P171_MAX_VISUAL, hold });


/**
 * §P18 speaking-motion review configurations.
 *
 * `speakingIdleFloor` is the load-bearing value. The P16 idle head, isolated
 * during speech, reached 2.442 deg of yaw against the speaking controller's
 * 0.313 and carried the 415 reversals/min that read as a metronome. Suppressing
 * it to 0 during established speech is what removes the sway; the gesture
 * profile is what puts conversational motion back.
 *
 * A floor sweep of 0 / 0.05 / 0.10 / 0.15 found no measurable difference once
 * the neck compensation was weighted, so 0 is used — the simplest value the
 * evidence supports.
 */
export const P18_IDLE_FLOOR = 0;

export interface P18ReviewConfig {
  id: "off" | "conservative" | "natural" | "expressive" | "final" | "final-strong" | "motor" | "motor-max" | "talkinghead" | "talkinghead-max" | "talkinghead-115" | "talkinghead-130" | "talkinghead-hybrid" | "talkinghead-locked" | "talkinghead-center" | "talkinghead-center-gaze"
    | "th-final-13" | "th-final-14" | "th-final-15" | "th-final-16"
    | "th-final-165" | "th-final-170" | "th-final-175"
    | "hyper3d-175" | "hyper3d-190" | "hyper3d-200" | "hyper3d-210"
    | "hyper3d-coordination" | "hyper3d-presence";
  label: string;
  /** `null` restores the previous oscillator AND the P16 bleed, for A/B. */
  profileId: SpeakingMotionProfileId | null;
  speakingIdleFloor: number | null;
  /**
   * FINAL CONVERGENCE. When set, the conductor owns the speaking performance and
   * `profileId` is ignored — `SpeakingHeadMotionController` returns on the
   * conductor branch before the §P18 director is consulted, so the two can never
   * both schedule head emphasis.
   */
  conductorTuningId: ConductorTuningId | null;
  /**
   * FINAL MOTOR SPEECH. When set, the head is INTEGRATED from motor drive and
   * both `profileId` and the target-driven conductor branch are bypassed — the
   * motor branch in `SpeakingHeadMotionController` returns before either is
   * reached, so momentum is never layered on top of a target system.
   */
  motorTuningId: MotorTuningId | null;
  /**
   * TALKINGHEAD SPEECH TEST. When set, the upstream-derived adapter is the sole
   * speaking head authority: `profileId`, `conductorTuningId` and
   * `motorTuningId` are all bypassed by the branch that reads this.
   */
  talkingHeadTuningId: TalkingHeadTuningId | null;
}

export const p18Review: Record<P18ReviewConfig["id"], P18ReviewConfig> = {
  off: { id: "off", label: "P18.2 OFF", profileId: null, speakingIdleFloor: null, conductorTuningId: null, motorTuningId: null, talkingHeadTuningId: null },
  /** P18.1's pause-driven scheduling, kept as the real A/B baseline. */
  conservative: { id: "conservative", label: "P18.1 BASELINE", profileId: "p181-baseline", speakingIdleFloor: P18_IDLE_FLOOR, conductorTuningId: null, motorTuningId: null, talkingHeadTuningId: null },
  natural: { id: "natural", label: "P18.2 IN-PHRASE", profileId: "natural", speakingIdleFloor: P18_IDLE_FLOOR, conductorTuningId: null, motorTuningId: null, talkingHeadTuningId: null },
  expressive: { id: "expressive", label: "P18.2 STRONG", profileId: "expressive", speakingIdleFloor: P18_IDLE_FLOOR, conductorTuningId: null, motorTuningId: null, talkingHeadTuningId: null },
  /**
   * FINAL CONVERGENCE. `profileId` is deliberately null as well as ignored, so
   * that a future reader cannot conclude the P18.2 director is still involved.
   */
  final: { id: "final", label: "FINAL COORDINATED SPEECH", profileId: null, speakingIdleFloor: P18_IDLE_FLOOR, conductorTuningId: "natural", motorTuningId: null, talkingHeadTuningId: null },
  "final-strong": { id: "final-strong", label: "FINAL STRONG", profileId: null, speakingIdleFloor: P18_IDLE_FLOOR, conductorTuningId: "strong", motorTuningId: null, talkingHeadTuningId: null },
  /**
   * FINAL MOTOR SPEECH. The conductor still resolves — gaze and face need the
   * shared intent — but the head and neck INTEGRATE its drive instead of easing
   * toward its angles, and the final composed bone is jerk-limited.
   */
  motor: { id: "motor", label: "FINAL MOTOR SPEECH", profileId: null, speakingIdleFloor: P18_IDLE_FLOOR, conductorTuningId: "natural", motorTuningId: "natural", talkingHeadTuningId: null },
  "motor-max": { id: "motor-max", label: "MOTOR DEBUG MAX", profileId: null, speakingIdleFloor: P18_IDLE_FLOOR, conductorTuningId: "strong", motorTuningId: "strong", talkingHeadTuningId: null },
  /**
   * TALKINGHEAD SPEECH TEST. Everything of ours that generates speaking head
   * motion is off — no gesture profile, no conductor, no motor. The adapter is
   * alone, which is the only way the A/B answers the question it is asked.
   */
  talkinghead: { id: "talkinghead", label: "TALKINGHEAD SPEECH TEST", profileId: null, speakingIdleFloor: P18_IDLE_FLOOR, conductorTuningId: null, motorTuningId: null, talkingHeadTuningId: "native" },
  "talkinghead-max": { id: "talkinghead-max", label: "TALKINGHEAD MAX", profileId: null, speakingIdleFloor: P18_IDLE_FLOOR, conductorTuningId: null, motorTuningId: null, talkingHeadTuningId: "max" },
  /**
   * Cadence A/B. `conductorTuningId` stays null on these three so they are the
   * pure carrier — the only variable between them is how fast the trajectory
   * evolves.
   */
  "talkinghead-115": { id: "talkinghead-115", label: "TALKINGHEAD 1.15x", profileId: null, speakingIdleFloor: P18_IDLE_FLOOR, conductorTuningId: null, motorTuningId: null, talkingHeadTuningId: "faster" },
  "talkinghead-130": { id: "talkinghead-130", label: "TALKINGHEAD 1.30x", profileId: null, speakingIdleFloor: P18_IDLE_FLOOR, conductorTuningId: null, motorTuningId: null, talkingHeadTuningId: "fastest" },
  /**
   * HYBRID. The carrier plus speech modulation.
   *
   * `conductorTuningId` is set here and ONLY here among the TalkingHead modes,
   * because the hybrid needs the shared performance frame — but only its scalar
   * emphasis reaches the carrier, and the branch that consumes it returns before
   * any of our head controllers is reached. The same frame keeps driving face
   * intensity, so head, gaze and face share one intention strength.
   */
  "talkinghead-hybrid": { id: "talkinghead-hybrid", label: "TALKINGHEAD HYBRID", profileId: null, speakingIdleFloor: P18_IDLE_FLOOR, conductorTuningId: "natural", motorTuningId: null, talkingHeadTuningId: "hybrid" },
  /**
   * The locked carrier and its two fixes.
   *
   * `conductorTuningId` is null on all three: the hybrid's semantic modulation
   * did not beat the plain carrier on hardware, so it is not in the production
   * candidate. These differ from each other in exactly one thing each.
   */
  "talkinghead-locked": { id: "talkinghead-locked", label: "TALKINGHEAD 1.30x LOCKED", profileId: null, speakingIdleFloor: P18_IDLE_FLOOR, conductorTuningId: null, motorTuningId: null, talkingHeadTuningId: "locked" },
  "talkinghead-center": { id: "talkinghead-center", label: "TALKINGHEAD CENTER FIX", profileId: null, speakingIdleFloor: P18_IDLE_FLOOR, conductorTuningId: null, motorTuningId: null, talkingHeadTuningId: "centerFix" },
  "talkinghead-center-gaze": { id: "talkinghead-center-gaze", label: "TALKINGHEAD CENTER + GAZE FIX", profileId: null, speakingIdleFloor: P18_IDLE_FLOOR, conductorTuningId: null, motorTuningId: null, talkingHeadTuningId: "centerGazeFix" },
  /**
   * The final cadence sweep. Identical in every respect except the speaking
   * tuning's `cadence`; `conductorTuningId` stays null so no hybrid modulation
   * reaches any of them.
   */
  "th-final-13": { id: "th-final-13", label: "TH FINAL 1.30x", profileId: null, speakingIdleFloor: P18_IDLE_FLOOR, conductorTuningId: null, motorTuningId: null, talkingHeadTuningId: "thFinal13" },
  "th-final-14": { id: "th-final-14", label: "TH FINAL 1.40x", profileId: null, speakingIdleFloor: P18_IDLE_FLOOR, conductorTuningId: null, motorTuningId: null, talkingHeadTuningId: "thFinal14" },
  "th-final-15": { id: "th-final-15", label: "TH FINAL 1.50x", profileId: null, speakingIdleFloor: P18_IDLE_FLOOR, conductorTuningId: null, motorTuningId: null, talkingHeadTuningId: "thFinal15" },
  "th-final-16": { id: "th-final-16", label: "TH FINAL 1.60x LOCKED", profileId: null, speakingIdleFloor: P18_IDLE_FLOOR, conductorTuningId: null, motorTuningId: null, talkingHeadTuningId: "thFinal16" },
  /** Micro speed tuning on the locked 1.60x. Only `talkingHeadTuningId` differs. */
  "th-final-165": { id: "th-final-165", label: "TH FINAL 1.65x", profileId: null, speakingIdleFloor: P18_IDLE_FLOOR, conductorTuningId: null, motorTuningId: null, talkingHeadTuningId: "thFinal165" },
  "th-final-170": { id: "th-final-170", label: "TH FINAL 1.70x", profileId: null, speakingIdleFloor: P18_IDLE_FLOOR, conductorTuningId: null, motorTuningId: null, talkingHeadTuningId: "thFinal170" },
  "th-final-175": { id: "th-final-175", label: "TH FINAL 1.75x", profileId: null, speakingIdleFloor: P18_IDLE_FLOOR, conductorTuningId: null, motorTuningId: null, talkingHeadTuningId: "thFinal175" },

  /**
   * PRESENCE PASS — Hyper3D hardware review set.
   *
   * The four cadence entries differ from each other in ONE field: the
   * `talkingHeadTuningId`, which itself differs only in `cadence`. Same
   * `speakingIdleFloor`, same null conductor, same null motor profile. That makes
   * the A/B a speed test and nothing else, as the brief requires.
   */
  "hyper3d-175": { id: "hyper3d-175", label: "HYPER3D CURRENT 1.75", profileId: null, speakingIdleFloor: P18_IDLE_FLOOR, conductorTuningId: null, motorTuningId: null, talkingHeadTuningId: "thFinal175" },
  "hyper3d-190": { id: "hyper3d-190", label: "HYPER3D 1.90", profileId: null, speakingIdleFloor: P18_IDLE_FLOOR, conductorTuningId: null, motorTuningId: null, talkingHeadTuningId: "thFinal190" },
  "hyper3d-200": { id: "hyper3d-200", label: "HYPER3D 2.00", profileId: null, speakingIdleFloor: P18_IDLE_FLOOR, conductorTuningId: null, motorTuningId: null, talkingHeadTuningId: "thFinal200" },
  "hyper3d-210": { id: "hyper3d-210", label: "HYPER3D 2.10", profileId: null, speakingIdleFloor: P18_IDLE_FLOOR, conductorTuningId: null, motorTuningId: null, talkingHeadTuningId: "thFinal210" },

  /**
   * Coordination. The conductor is switched ON alongside the carrier, which is an
   * already-supported combination (`talkinghead-hybrid` does the same): the
   * TalkingHead carrier keeps sole authority over the HEAD, while the conductor
   * supplies the performance intent that the behaviour layer turns into
   * coordinated brow, cheek and mouth warmth — and the carrier's gaze is fed back
   * in as `talkingHeadGaze` so the eyes belong to the same moment. No second
   * expression engine is introduced.
   *
   * Cadence defaults to 1.90x, the middle of the expected winning window. The
   * review panel lets the cadence be re-pointed once hardware picks one.
   */
  "hyper3d-coordination": { id: "hyper3d-coordination", label: "HYPER3D COORDINATION", profileId: null, speakingIdleFloor: P18_IDLE_FLOOR, conductorTuningId: "hyper3dCoordinated", motorTuningId: null, talkingHeadTuningId: "thFinal190" },

  /**
   * Full presence. Coordination plus a non-zero `speakingIdleFloor`, so a share
   * of the idle exploratory head survives established speech instead of being
   * fully suppressed. `P18_IDLE_FLOOR` is 0, which is what makes the face and
   * head go still between events; 0.18 keeps a small amount alive without the
   * head wandering during a sentence.
   */
  /** LOCKED — THE ACCEPTED HYPER3D BASELINE. head speed PASS, coordination MUCH
   *  BETTER, presence PASS, unwanted drift NONE. Pinned by hyper3dAcceptedBaseline.test.ts. */
  "hyper3d-presence": { id: "hyper3d-presence", label: "HYPER3D FULL PRESENCE", profileId: null, speakingIdleFloor: 0.18, conductorTuningId: "hyper3dCoordinated", motorTuningId: null, talkingHeadTuningId: "thFinal190" }
};

/**
 * The three-button hardware A/B for the final pass.
 *
 * Each entry is the WHOLE configuration, not a fragment: the speaking mode, the
 * P16 orientation architecture and the §P17 director together. A reviewer
 * pressing one button gets a self-consistent avatar, which is the thing the
 * previous panels could not offer — the P17 presence and the P18 speaking mode
 * were separate controls and most combinations of them were not configurations
 * anyone had evaluated.
 */
export interface FinalReviewConfig {
  id: "old" | "p182" | "final" | "motor" | "motorMax" | "talkingHead" | "talkingHeadMax" | "talkingHead115" | "talkingHead130" | "talkingHeadHybrid" | "talkingHeadLocked" | "talkingHeadCenter" | "talkingHeadCenterGaze"
    | "thFinal13" | "thFinal14" | "thFinal15" | "thFinal16"
    | "thFinal165" | "thFinal170" | "thFinal175";
  label: string;
  description: string;
  speaking: P18ReviewConfig;
  presence: NaturalismPresenceConfig | null;
  performance: PerformanceSettings | null;
}

export const finalReview: Record<FinalReviewConfig["id"], FinalReviewConfig> = {
  /** Pre-P18 shipped behaviour: the oscillator, the P16 idle bleed, no director. */
  old: {
    id: "old",
    label: "OLD SPEECH",
    description: "Pre-P18 oscillator, P16 idle bleeding into speech, no performance director.",
    speaking: p18Review.off,
    presence: null,
    performance: null
  },
  /**
   * The target-driven baseline, kept as a REAL runtime path for the A/B.
   *
   * Same audio, same face, same gaze, same §P17 state as FINAL MOTOR SPEECH —
   * only the head/neck motion GENERATION differs. That is what makes the
   * comparison about the architecture rather than about two different amounts
   * of movement.
   */
  p182: {
    id: "p182",
    label: "P18.2 TARGET-DRIVEN",
    description: "Target angles with eased interpolation. Smooth position, stepping intention.",
    speaking: p18Review.natural,
    presence: P171_MAX_PRESENCE,
    performance: P171_MAX_VISUAL
  },
  /** Persistent, jerk-limited motor dynamics. The pass this configuration is for. */
  motor: {
    id: "motor",
    label: "FINAL MOTOR SPEECH",
    description: "Continuous momentum. Speech applies forces; nothing schedules a gesture.",
    speaking: p18Review.motor,
    presence: P171_MAX_PRESENCE,
    performance: P171_MAX_VISUAL
  },
  /**
   * TALKINGHEAD SPEECH TEST — met4citizen/TalkingHead's own speaking behaviour.
   *
   * Same audio, same GLB, same lip-sync, same §P17/§P17.1 face, same camera.
   * Only head, neck and gaze generation changes, which is what makes this a
   * valid experiment rather than a different avatar.
   */
  talkingHead: {
    id: "talkingHead",
    label: "TALKINGHEAD SPEECH TEST",
    description: "Upstream TalkingHead speaking behaviour: random targets, sigmoid easing, gaze solved from head.",
    speaking: p18Review.talkinghead,
    presence: P171_MAX_PRESENCE,
    performance: P171_MAX_VISUAL
  },
  /**
   * THE FINAL SPEED SWEEP.
   *
   * Hardware accepted CENTER + GAZE and asked only for more speed. All four are
   * the same configuration; the only difference is how quickly the carrier
   * travels through the identical stroke.
   */
  thFinal13: {
    id: "thFinal13",
    label: "TH FINAL 1.30x",
    description: "Approved CENTER + GAZE carrier at 1.30x cadence. Only the travel time changes.",
    speaking: p18Review["th-final-13"],
    presence: P171_MAX_PRESENCE,
    performance: P171_MAX_VISUAL
  },
  thFinal14: {
    id: "thFinal14",
    label: "TH FINAL 1.40x",
    description: "Approved CENTER + GAZE carrier at 1.40x cadence. Only the travel time changes.",
    speaking: p18Review["th-final-14"],
    presence: P171_MAX_PRESENCE,
    performance: P171_MAX_VISUAL
  },
  thFinal15: {
    id: "thFinal15",
    label: "TH FINAL 1.50x",
    description: "Approved CENTER + GAZE carrier at 1.50x cadence. Only the travel time changes.",
    speaking: p18Review["th-final-15"],
    presence: P171_MAX_PRESENCE,
    performance: P171_MAX_VISUAL
  },
  thFinal16: {
    id: "thFinal16",
    label: "TH FINAL 1.60x LOCKED",
    description: "The approved speaking baseline. Control for the micro speed sweep.",
    speaking: p18Review["th-final-16"],
    presence: P171_MAX_PRESENCE,
    performance: P171_MAX_VISUAL
  },
  thFinal165: {
    id: "thFinal165",
    label: "TH FINAL 1.65x",
    description: "The locked 1.60x performance played 1.65x. Cadence is the only difference.",
    speaking: p18Review["th-final-165"],
    presence: P171_MAX_PRESENCE,
    performance: P171_MAX_VISUAL
  },
  thFinal170: {
    id: "thFinal170",
    label: "TH FINAL 1.70x",
    description: "The locked 1.60x performance played 1.70x. Cadence is the only difference.",
    speaking: p18Review["th-final-170"],
    presence: P171_MAX_PRESENCE,
    performance: P171_MAX_VISUAL
  },
  thFinal175: {
    id: "thFinal175",
    label: "TH FINAL 1.75x",
    description: "The locked 1.60x performance played 1.75x. Cadence is the only difference.",
    speaking: p18Review["th-final-175"],
    presence: P171_MAX_PRESENCE,
    performance: P171_MAX_VISUAL
  },
  /**
   * THE APPROVED CARRIER. Hardware chose 1.30x as closest to the reference.
   *
   * The three entries here differ by exactly one thing each, so the hardware A/B
   * can attribute whatever it sees: locked is the approved baseline, centre adds
   * the evolving rest, centre+gaze adds the head-derived gaze made dominant.
   */
  talkingHeadLocked: {
    id: "talkingHeadLocked",
    label: "TALKINGHEAD 1.30x LOCKED",
    description: "The approved carrier, unchanged. Baseline for the two fixes.",
    speaking: p18Review["talkinghead-locked"],
    presence: P171_MAX_PRESENCE,
    performance: P171_MAX_VISUAL
  },
  talkingHeadCenter: {
    id: "talkingHeadCenter",
    label: "TALKINGHEAD CENTER FIX",
    description: "Locked carrier plus a slowly evolving speaking rest. No return to global centre.",
    speaking: p18Review["talkinghead-center"],
    presence: P171_MAX_PRESENCE,
    performance: P171_MAX_VISUAL
  },
  talkingHeadCenterGaze: {
    id: "talkingHeadCenterGaze",
    label: "TALKINGHEAD CENTER + GAZE FIX",
    description: "Both fixes: evolving rest, and head-derived gaze dominant with natural under-compensation and lag.",
    speaking: p18Review["talkinghead-center-gaze"],
    presence: P171_MAX_PRESENCE,
    performance: P171_MAX_VISUAL
  },
  /** Cadence A/B: the same carrier, evolving 15 % faster. */
  talkingHead115: {
    id: "talkingHead115",
    label: "TALKINGHEAD 1.15x",
    description: "The carrier at 1.15x cadence. Same shapes, same amplitude, played through sooner.",
    speaking: p18Review["talkinghead-115"],
    presence: P171_MAX_PRESENCE,
    performance: P171_MAX_VISUAL
  },
  /** Cadence A/B: 30 % faster. Raises the reversal rate proportionally. */
  talkingHead130: {
    id: "talkingHead130",
    label: "TALKINGHEAD 1.30x",
    description: "The carrier at 1.30x cadence. Faster still; reversal rate rises with it.",
    speaking: p18Review["talkinghead-130"],
    presence: P171_MAX_PRESENCE,
    performance: P171_MAX_VISUAL
  },
  /**
   * THE HYBRID. TalkingHead's physical motion, shaped by the sentence.
   *
   * Speech never creates a stroke here; it can only lengthen, deepen or quieten
   * one the carrier is already making. See `TalkingHeadSpeechModulator`.
   */
  talkingHeadHybrid: {
    id: "talkingHeadHybrid",
    label: "TALKINGHEAD HYBRID",
    description: "Carrier at 1.15x plus bounded speech modulation. Emphasis shapes motion already underway.",
    speaking: p18Review["talkinghead-hybrid"],
    presence: P171_MAX_PRESENCE,
    performance: P171_MAX_VISUAL
  },
  /** The same adapter with the FINAL bone rotation scaled. Timing is untouched. */
  talkingHeadMax: {
    id: "talkingHeadMax",
    label: "TALKINGHEAD MAX",
    description: "The same TalkingHead motion, amplified for visibility. Identical timing and easing.",
    speaking: p18Review["talkinghead-max"],
    presence: P171_MAX_PRESENCE,
    performance: P171_MAX_VISUAL
  },
  /** The same architecture at review amplitude, for recording and inspection. */
  motorMax: {
    id: "motorMax",
    label: "MOTOR DEBUG MAX",
    description: "Motor dynamics at review amplitude. For recording, not production.",
    speaking: p18Review["motor-max"],
    presence: P171_MAX_PRESENCE,
    performance: P171_MAX_VISUAL
  },
  /**
   * Everything the final pass adds, in one press:
   *   plan + conductor      `conductorTuningId: "natural"`
   *   head + neck consumer  the conductor branch in SpeakingHeadMotionController
   *   gaze consumer         conducted bias + stabilization in HumanBehaviorController
   *   face consumer         writeConductedFace, brow/lid direct, warmth reported
   *   P17 state integration `performance` on, feeding the state character
   *   P17.1 awake eyes      the state composition, plus the awake lid ceiling
   *   P16 speaking suppress `speakingIdleFloor: 0`
   *   P15 hair              always on; it is asset wiring, not a review toggle
   */
  final: {
    id: "final",
    label: "FINAL COORDINATED SPEECH",
    description: "One planned performance timeline. Head, neck, gaze and face consume the same anchor.",
    speaking: p18Review.final,
    presence: P171_MAX_PRESENCE,
    performance: P171_MAX_VISUAL
  }
};

/** The candidate selected after rendering all three. */
export const P18_RECOMMENDED: P18ReviewConfig["id"] = "natural";


/**
 * IDLE ENGAGEMENT review configurations.
 *
 * Separate from `finalReview` because these vary the IDLE/listening behaviour,
 * which is a different question from which speaking carrier to use. The speaking
 * configuration is held at the approved carrier throughout so the comparison is
 * about idle alone.
 */
export interface IdleReviewConfig {
  id:
    | "idleCurrent" | "idleEngaged" | "idleEngagedMax"
    | "idleEngagedCurrent" | "idleReturnEarly" | "idleReturnEarlier";
  label: string;
  description: string;
  speaking: P18ReviewConfig;
  presence: NaturalismPresenceConfig | null;
  performance: PerformanceSettings | null;
  /** `null` is the current behaviour: no viewer anchoring at all. */
  idleEngagement: IdleEngagementConfig | null;
}

/**
 * §P28 side-pose dwell. These differ from `P171_MAX_PRESENCE` in
 * `postureDwellFraction` and in NOTHING else — every angle, span, probability
 * and rate is shared by reference below, so the three modes cannot drift apart
 * on amplitude. `postureRecoveryFloor` and `postureRecoveryRestShare` are held
 * equal across them too, so they differ in TIMING alone.
 *
 * Measured over 6 seeds x 300 s against the CURRENT baseline, paired on the
 * baseline's own excursion intervals:
 *
 * | mode    | fraction | mean side dwell | time to leave pose | reach | worst 5% |
 * |---------|----------|-----------------|--------------------|-------|----------|
 * | CURRENT | 1.00     | --              | --                 | 100%  | 100%     |
 * | EARLY   | 0.80     | -14.3%          | -9.6%              | 99.9% | 98.1%    |
 * | EARLIER | 0.65     | -26.7%          | -23.7%             | 98.7% | 89.5%    |
 *
 * The fraction is the pose duration itself, so EARLY and EARLIER ARE the 20%
 * and 35% reductions the review asked for; the dwell column is the smaller
 * downstream effect on time spent beyond the strong band, because the head is
 * still out there for part of a gradual recovery.
 */
const P28_RETURN_EARLY: NaturalismPresenceConfig = { ...P171_MAX_PRESENCE, postureDwellFraction: 0.8 };
const P28_RETURN_EARLIER: NaturalismPresenceConfig = { ...P171_MAX_PRESENCE, postureDwellFraction: 0.65 };

export const idleReview: Record<IdleReviewConfig["id"], IdleReviewConfig> = {
  idleCurrent: {
    id: "idleCurrent",
    label: "IDLE CURRENT",
    description: "Today's idle: eyes wander independently and the head follows them.",
    speaking: p18Review["th-final-13"],
    presence: P171_MAX_PRESENCE,
    performance: P171_MAX_VISUAL,
    idleEngagement: null
  },
  idleEngaged: {
    id: "idleEngaged",
    label: "IDLE ENGAGED GAZE",
    description: "Eyes anchored on the viewer, compensating for head movement. Head, face and blinks unchanged.",
    speaking: p18Review["th-final-13"],
    presence: P171_MAX_PRESENCE,
    performance: P171_MAX_VISUAL,
    idleEngagement: idleEngagementConfigs.engaged
  },
  idleEngagedMax: {
    id: "idleEngagedMax",
    label: "IDLE ENGAGED GAZE MAX",
    description: "The same idea pushed hard, so the direction can be judged. Not a shipping candidate.",
    speaking: p18Review["th-final-13"],
    presence: P171_MAX_PRESENCE,
    performance: P171_MAX_VISUAL,
    idleEngagement: idleEngagementConfigs.engagedMax
  },
  /**
   * §P28. The approved engaged-gaze idle, varied ONLY in how long a side pose
   * is held. `idleEngagement` is the same object reference in all three, so eye
   * contact is identical by construction rather than by matching numbers.
   *
   * These carry the LOCKED 1.60x speaking carrier rather than the 1.30x the
   * three modes above were authored against, so idle is judged alongside the
   * approved speaking motion. Speaking itself is untouched either way — the
   * dwell easing runs only when not speaking.
   */
  idleEngagedCurrent: {
    id: "idleEngagedCurrent",
    label: "IDLE ENGAGED CURRENT",
    description: "The approved engaged-gaze idle, unchanged. The comparison baseline.",
    speaking: p18Review["th-final-16"],
    presence: P171_MAX_PRESENCE,
    performance: P171_MAX_VISUAL,
    idleEngagement: idleEngagementConfigs.engaged
  },
  idleReturnEarly: {
    id: "idleReturnEarly",
    label: "IDLE RETURN EARLY",
    description: "Side poses held 20% less long before easing back. Same angles, same eye contact.",
    speaking: p18Review["th-final-16"],
    presence: P28_RETURN_EARLY,
    performance: P171_MAX_VISUAL,
    idleEngagement: idleEngagementConfigs.engaged
  },
  idleReturnEarlier: {
    id: "idleReturnEarlier",
    label: "IDLE RETURN EARLIER",
    description: "Side poses held 35% less long. Reaches 98.7% as far on average, 89.5% in the worst twentieth.",
    speaking: p18Review["th-final-16"],
    presence: P28_RETURN_EARLIER,
    performance: P171_MAX_VISUAL,
    idleEngagement: idleEngagementConfigs.engaged
  }
};
