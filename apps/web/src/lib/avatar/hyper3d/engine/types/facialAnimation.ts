import type { HumanBehaviorDebugState } from "./behaviorNaturalism";

export type BlendshapePose = Record<string, number>;

export type FacialRegion = "jaw" | "mouth" | "brow" | "eyes" | "cheeks" | "gaze" | "head";
export type MergeStrategy = "replace" | "add" | "max" | "multiply" | "boundedAdd" | "weightedAverage";
export type PoseChannel = "rest" | "lipsync" | "emotion" | "facialCue" | "blink" | "gaze" | "speechGesture" | "idle" | "debug";

export interface ChannelPose {
  channel: PoseChannel;
  pose: BlendshapePose;
  weight?: number;
}

export interface MixedPoseResult {
  pose: BlendshapePose;
  channelContributions: Record<string, Partial<Record<PoseChannel, number>>>;
}

export interface HeadRotationTarget {
  pitch: number;
  yaw: number;
  roll: number;
}

export type HeadNeckDiagnosticTarget = "head" | "neck" | "both";
export type HeadNeckDiagnosticPose =
  | "neutral"
  | "yaw-left"
  | "yaw-right"
  | "pitch-down"
  | "pitch-up"
  | "roll-left"
  | "roll-right";

export interface HeadNeckDiagnosticSettings {
  enabled: boolean;
  target: HeadNeckDiagnosticTarget;
  pose: HeadNeckDiagnosticPose;
  sequenceEnabled: boolean;
  showSkeleton: boolean;
}

export interface IdleExpressionDebugState {
  enabled: boolean;
  state: "idle" | "transitioning" | "speaking-reduced" | "blocked";
  time: number;
  timeSinceSpeechEnded: number;
  currentEvent?: string;
  eventPhase: string;
  nextEventInSeconds: number;
  blinkPhase: string;
  nextBlinkInSeconds: number;
  gazeTarget: { yawDegrees: number; pitchDegrees: number };
  headTarget: HeadRotationTarget;
  neckTarget: HeadRotationTarget;
  blendWeight: number;
  randomSeed: string;
  activeCanonicalChannels: string[];
  layerWeights: { blink: number; gaze: number; expression: number; head: number };
  profileLabel: string;
  /** Present only when the coordinated human behaviour layer is active. */
  humanBehavior?: HumanBehaviorDebugState;
}

export interface HeadMotionDebugState {
  enabled: boolean;
  speechActive: boolean;
  paused: boolean;
  weight: number;
  activeLayer: string;
  head: HeadRotationTarget;
  neck: HeadRotationTarget;
  drift: HeadRotationTarget;
  phrase: HeadRotationTarget;
  emphasis: HeadRotationTarget;
  energyMultiplier: number;
  idleBlendWeight: number;
  stillnessWeight: number;
  phraseIndex?: number;
  phraseState: string;
  emphasisIndex?: number;
  emphasisState: string;
  seed: string;
  /** §P18.1 trajectory phase and emphasis level, for the review panel. */
  gesturePhase?: string;
  gestureEmphasis?: number;
  gesturePhraseProgress?: number;
}

export interface HeadNeckDiagnosticDebugState {
  enabled: boolean;
  target: HeadNeckDiagnosticTarget;
  pose: HeadNeckDiagnosticPose;
  sequenceEnabled: boolean;
  sequenceTime: number;
  requestedHead: HeadRotationTarget;
  requestedNeck: HeadRotationTarget;
}

export interface HeadMotionPose {
  head: HeadRotationTarget;
  neck: HeadRotationTarget;
  active: boolean;
  manualActive: boolean;
  diagnosticActive?: boolean;
  /**
   * HYPER3D FINAL SPEAKING HEAD. Which layer produced the `head`/`neck` above.
   *
   * Recorded so ownership is a runtime FACT rather than a claim in a comment:
   * `BoneController` writes it into the bone-writer debug record, so the panel
   * and the regression tests can both read which single layer the rendered
   * rotation came from. Optional, so the female and diagnostic paths are
   * unaffected by its absence.
   */
  owner?: string;
  speaking?: HeadMotionDebugState;
  idle?: IdleExpressionDebugState;
  diagnostic?: HeadNeckDiagnosticDebugState;
  /**
   * FINAL MOTOR SPEECH. Routes the FINAL composed pose through a third-order,
   * jerk-limited follower in `BoneController` instead of the first-order
   * exponential smoothing.
   *
   * Per frame rather than a constructor option so the target-driven baseline
   * keeps its exact previous behaviour and the hardware A/B compares motion
   * GENERATION, not two different output filters.
   */
  jerkLimited?: boolean;
  /**
   * STAGE 2.3. How fast `head`/`neck` are THEMSELVES moving this frame, in
   * radians per second, when the owner knows analytically.
   *
   * Fed forward into `BoneJerkLimiter` so a moving target is tracked without the
   * follower's steady-state lag. Optional and additive: an owner that does not
   * supply it gets exactly the previous behaviour, which is why only the Hyper3D
   * speaking head — the one layer whose trajectory has closed-form derivatives —
   * sets it.
   */
  headVelocity?: HeadRotationTarget;
  neckVelocity?: HeadRotationTarget;
  /** The same, one derivative up: rad/s^2. Supplied with the velocities or not at all. */
  headAcceleration?: HeadRotationTarget;
  neckAcceleration?: HeadRotationTarget;
  /**
   * STAGE 2.2. The two contributions that `head`/`neck` are the SUM of, kept
   * separately so a downstream director can recombine them instead of receiving
   * an already-merged target. Additive and optional: nothing that ignores these
   * changes behaviour, so the female path is unaffected.
   */
  contributions?: {
    speaking: { head: HeadRotationTarget; neck: HeadRotationTarget };
    idle: { head: HeadRotationTarget; neck: HeadRotationTarget };
  };
}

export interface BoneTransformSnapshot {
  localPosition: [number, number, number];
  localEuler: [number, number, number];
  localQuaternion: [number, number, number, number];
  worldQuaternion: [number, number, number, number];
}

export interface BoneWriterDebugState {
  boneName: "Head" | "Neck";
  writer: string;
  /** `HeadMotionPose.owner` for the frame that produced this write, when set. */
  owner?: string;
  timestamp: number;
  frame: number;
  beforeQuaternion: [number, number, number, number];
  afterQuaternion: [number, number, number, number];
}

interface BoneStageDebugState {
  base: BoneTransformSnapshot;
  afterAuthoredAnimation: BoneTransformSnapshot;
  afterIdleContribution: BoneTransformSnapshot;
  afterSpeakingContribution: BoneTransformSnapshot;
  afterDiagnosticContribution: BoneTransformSnapshot;
  afterBoneControllerComposition: BoneTransformSnapshot;
  afterAllAvatarControllers: BoneTransformSnapshot;
  beforeSceneRender: BoneTransformSnapshot;
  deltaFromBase: HeadRotationTarget;
  finalWriter?: BoneWriterDebugState;
}

export interface BoneTransformDebugState {
  eulerOrder: "XYZ";
  requestedHead: HeadRotationTarget;
  requestedNeck: HeadRotationTarget;
  speakingHead: HeadRotationTarget;
  speakingNeck: HeadRotationTarget;
  diagnosticHead: HeadRotationTarget;
  diagnosticNeck: HeadRotationTarget;
  head: BoneStageDebugState;
  neck: BoneStageDebugState;
}

/**
 * SPEECH / PHONEME TUNING — live morph-weight overrides from the dev panel.
 *
 * `{ P: { mouthClose: 0.9 }, AA: { jawOpen: 0.5 } }`. Sparse by construction:
 * only the morphs a reviewer has actually dragged appear, and an empty object
 * is a strict no-op through `AvatarController.resolveSpeechProfile`. It carries
 * WEIGHTS only — attack, release, coarticulation and viseme class are phoneme
 * logic and are not editable from the panel.
 */
export type PhonemeTuningOverrides = Record<string, BlendshapePose>;

export interface PhonemePoseDefinition {
  phoneme: string;
  viseme: string;
  category: "vowel" | "consonant" | "silence";
  pose: BlendshapePose;
  /**
   * WITHIN-PHONEME GLIDE, for diphthongs only.
   *
   * A diphthong is one label with TWO targets. Rendering it from a single
   * `pose` holds one shape for the whole label — measured on `EY` in "change",
   * `mouthStretchLeft` sat at exactly 0.284 for nine consecutive frames — so the
   * sound that is defined by its movement does not move.
   *
   * When both are present the coarticulation engine interpolates `onsetPose` ->
   * `offglidePose` across the phoneme's own progress and uses that in place of
   * `pose`. `pose` stays the phoneme's identity and its temporal MIDPOINT: both
   * ends are authored symmetrically about it, so the mean shape over the label
   * is unchanged and only its trajectory is new.
   *
   * Absent on every other phoneme, which keeps rendering from `pose` exactly as
   * before.
   */
  onsetPose?: BlendshapePose;
  offglidePose?: BlendshapePose;
  attack: number;
  holdBias: number;
  release: number;
  defaultIntensity: number;
  intensityMin: number;
  intensityMax: number;
  jawDominance: number;
  lipDominance: number;
  coarticulationBefore: number;
  coarticulationAfter: number;
  notes: string;
}

export interface SpeechEnvelopeState {
  phonemeActivation: number;
  jawEnergy: number;
  lipEnergy: number;
  speechActivity: number;
  pauseActivity: number;
}

export interface CoarticulationDebugState {
  previous: number;
  current: number;
  next: number;
  previousContribution: number;
  currentContribution: number;
  nextContribution: number;
  previousPhoneme?: string;
  currentPhoneme?: string;
  nextPhoneme?: string;
  dominantPhoneme?: string;
  effectiveLookBehind: number;
  effectiveLookAhead: number;
  closurePreservation: boolean;
}

import type { CoordinatedSpeechDebug } from "../engine/animation/CoordinatedSpeechDeformationController";
import type { SpeechTransitionIntent } from "../engine/lipsync/SpeechTransitionIntent";

export interface TimelineDebugState {
  time: number;
  currentPhoneme?: string;
  previousPhoneme?: string;
  nextPhoneme?: string;
  currentViseme?: string;
  phonemeIntensity: number;
  activeEmotions: Array<{ emotion: string; weight: number }>;
  activeCues: string[];
  /**
   * Protected channels an active cue asked for and did not get, because speech owns
   * them. Empty whenever the avatar is silent or the model has no protected set.
   * Reported so a suppressed authored instruction is visible in the panel rather
   * than silently absent from what renders.
   */
  suppressedCueChannels: string[];
  activePause?: string;
  speechEnvelope: SpeechEnvelopeState;
  coarticulationWeights: CoarticulationDebugState;
  unknownPhonemes: Record<string, number>;
  speakingHeadMotion?: HeadMotionDebugState;
  transformDiagnostic?: HeadNeckDiagnosticDebugState;
  speechDeformation?: CoordinatedSpeechDebug;
  speechTransitionIntent?: SpeechTransitionIntent;
  idleExpression?: IdleExpressionDebugState;
  boneTransforms?: BoneTransformDebugState;
}
