import type { HeadRotationTarget } from "./facialAnimation";

/** Authoritative external behaviour state. Exactly one is active per frame. */
export type AvatarBehaviorState =
  | "silent-listening"
  | "entering-speech"
  | "speaking"
  | "returning-to-listening";

/** Internal listening detail, only meaningful while the external state is silent-listening. */
export type ListeningSubstate =
  | "user-focus"
  | "quiet-stillness"
  | "brief-thought"
  | "micro-expression"
  | "soft-return";

export type BlinkPhase = "waiting" | "closing" | "holding" | "opening";
export type GazeMode = "user-focus" | "brief-thought" | "soft-return";

export interface BehaviorRange {
  min: number;
  max: number;
}

export interface BlinkDebugState {
  phase: BlinkPhase;
  lastIntervalSeconds: number;
  nextBlinkInSeconds: number;
  lastCloseSeconds: number;
  lastOpenSeconds: number;
  leftValue: number;
  rightValue: number;
  doubleBlinkPending: boolean;
  blinkCount: number;
}

export interface GazeDebugState {
  mode: GazeMode;
  targetYawDegrees: number;
  targetPitchDegrees: number;
  currentYawDegrees: number;
  currentPitchDegrees: number;
  /** Clamped settled gaze the head-follow logic actually reads. */
  committedYawDegrees: number;
  previousDirection: "left" | "right" | "center";
  holdRemainingSeconds: number;
  microSaccadeActive: boolean;
  amplitudeScale: number;
}

export interface StillnessDebugState {
  active: boolean;
  remainingSeconds: number;
  recentEventCount: number;
  lastDurationSeconds: number;
}

export interface BehaviorMemoryDebugState {
  recentEvents: string[];
  lastEventSide: "left" | "right" | "none";
  lastGazeDirection: "left" | "right" | "center";
  lastHeadDirection: "left" | "right" | "center";
  secondsSinceMeaningfulMotion: number;
  secondsSinceSpeechEnded: number;
  eventDensity: number;
}

export interface HumanBehaviorDebugState {
  enabled: boolean;
  presetId: string;
  seed: string;
  behaviorState: AvatarBehaviorState;
  listeningSubstate: ListeningSubstate;
  speechTransitionWeight: number;
  blink: BlinkDebugState;
  gaze: GazeDebugState;
  stillness: StillnessDebugState;
  memory: BehaviorMemoryDebugState;
  currentEvent?: string;
  currentEventPhase: string;
  currentEventSide: "left" | "right" | "none";
  nextEventInSeconds: number;
  headTarget: HeadRotationTarget;
  neckTarget: HeadRotationTarget;
  /** Head yaw contributed by gaze follow only, in degrees. Excludes posture drift. */
  headFollowDegrees: number;
  /** Head yaw contributed by slow posture drift only, in degrees. */
  headPostureDegrees: number;
  speakingBrowWeight: number;
  speakingSmileWeight: number;
  /**
   * Warmth handed to the coordinated speech layer instead of written (§P14).
   * Already scaled by behaviour intensity, safety scale, transition weight and
   * the model's speech gain — it is the exact amount the old direct write
   * produced before it was discarded.
   */
  speakingWarmth: { smile: number; cheek: number; lowerFace: number };
  /**
   * FINAL CONVERGENCE readout: what the conducted face and gaze applied this
   * frame, and the eyelid split the awake-eye gate is judged on.
   *
   * `stateEyelid` and `blinkEyelid` are reported SEPARATELY from `finalEyelid`
   * because that separation is the fix: a sustained support value and a blink
   * are different acts sharing one channel, and a merged number cannot show
   * which one is holding the lid down.
   */
  conducted: {
    active: boolean;
    gazeMode: string;
    gazeYawBias: number;
    gazePitchBias: number;
    gazeStability: number;
    browInner: number;
    browOuter: number;
    cheek: number;
    smile: number;
    lowerFace: number;
    stateEyelid: number;
    blinkEyelid: number;
    finalEyelid: number;
  };
  /** IDLE ENGAGEMENT state, or `null` when the viewer anchor is inactive. */
  idleEngagement: { engaged: boolean; breakActive: boolean; compensationDegrees: number } | null;
  /** §P17 stage trace, straight out of HumanBehaviorController before any merge. */
  stageTrace: { cheekLeft: number; smileLeft: number; browInnerUp: number };
  /** §P17 performance director state, for the dev panel and diagnostics. */
  performance: {
    state: string;
    previous: string | null;
    timeInState: number;
    nextTransitionIn: number;
    held: string | null;
    cheek: number; eyelid: number; browInner: number; browOuter: number; smile: number; asymmetry: number;
    upperLip: number; nasolabial: number; lowerLip: number;
    headYawBias: number; headPitchBias: number; headRollBias: number;
  };
  /**
   * Sides the current speech brow emphasis and warmth pulses lead on. While the
   * coordinated speech layer is running both follow its phrase-level side, so a
   * disagreement between these and `speechDeformation.asymmetrySide` is a real
   * defect rather than a display detail.
   */
  speakingBrowSide: "left" | "right";
  speakingWarmthSide: "left" | "right";
  /**
   * Which of the two firing reasons produced the pulse currently playing (§10).
   *
   * `"energy"` is the original loud-onset trigger; `"boundary"` is the sentence/phrase
   * trigger added in §10. Exposed because the pooled coordination metric cannot tell
   * the two streams apart: adding events inside silences necessarily raises the
   * POOLED mean distance to word starts even when every pre-existing event still sits
   * exactly where it did. Splitting by reason is the only way to check §9 Finding 2's
   * actual requirement — that the word-start correlation is preserved rather than
   * traded away — so `whole-face-coordination-diagnostics.mjs` scores each reason
   * separately. `null` when no pulse is playing.
   */
  speakingBrowReason: "energy" | "boundary" | null;
  speakingWarmthReason: "energy" | "boundary" | null;
  /** The side handed down by the coordinated speech layer, if any. */
  speechAsymmetrySide: "left" | "right" | "balanced";
  /** Channels this layer is currently withholding because speech owns them. */
  protectedChannels: string[];
  idleMouthFade: number;
  activeCanonicalChannels: string[];
}
