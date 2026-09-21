import { degreesToRadians } from "../../mappings/avatarBlendshapeConfig";
import { clamp } from "../../utils/clamp";
import { BehaviorRandom } from "../behaviour/naturalism/BehaviorRandom";
import {
  SpeechPerformanceConductor,
  defaultStateCharacter,
  silentPerformanceIntent,
  type ConductorTuning,
  type PerformanceIntentFrame,
  type PerformanceStateCharacter
} from "./SpeechPerformanceConductor";
import { SpeakingMotorController, type MotorOutput, type MotorTuning } from "./SpeakingMotorController";
import { ProsodyTrack, neutralProsody, type ProsodyFrame } from "./SpeechProsody";
import { TalkingHeadSpeakingAdapter, neutralModulation, type TalkingHeadOutput, type TalkingHeadTuning } from "./TalkingHeadSpeakingAdapter";
import { PauseDampingTrack, modulationFrom } from "./TalkingHeadSpeechModulator";
import {
  buildSpeechPerformancePlan,
  type SpeechPerformancePlan,
} from "./SpeechPerformancePlan";
import {
  SpeakingGestureDirector,
  neutralSpeakingGestureIntent,
  type SpeakingGestureIntent,
  type SpeakingMotionProfile
} from "./SpeakingGestureDirector";
import type { HeadMotionDebugState, HeadRotationTarget } from "../../types/facialAnimation";
import type { TimedPause, TimedPhoneme } from "../../types/avatarPayload";

export interface RotationLimits {
  pitch: number;
  yaw: number;
  roll: number;
}

export interface SpeakingHeadMotionConfig {
  enabled: boolean;
  fadeInSeconds: number;
  fadeOutSeconds: number;
  headLimits: RotationLimits;
  neckLimits: RotationLimits;
  drift: {
    yawAmplitude: number;
    pitchAmplitude: number;
    rollAmplitude: number;
    frequencies: { yaw: number; pitch: number; roll: number };
    stillnessStrength: number;
    /**
     * Window of the trailing high-pass that pulls the drift back toward centre, in
     * seconds. 0 disables it and reproduces the uncorrected drift exactly.
     *
     * P3 measured the uncorrected layer sitting on one side of centre for 13.9 s —
     * 37% of the audit clip. Neither term is at fault on its own: the yaw lattice
     * happens to hold five consecutive same-sign cells (16.7 s) and the direction
     * term five consecutive same-sign windows (15 s). Zero-mean noise has no
     * restoring force, so a long one-sided run is a property of the process, not of
     * this seed — a different seed moves the lean, it does not remove it.
     *
     * Subtracting the signal's own trailing mean removes any offset sustained
     * longer than the window while leaving the faster motion intact, so the bound
     * holds by construction rather than by luck. Deliberately NOT another random
     * oscillator: it is a filter on the drift that already exists.
     */
    centeringSeconds: number;
    /** Samples used to estimate that trailing mean. Ignored when centering is off. */
    centeringSamples: number;
    /**
     * Interpolate the 3 s direction term instead of stepping it.
     *
     * The stepped form is the single largest discontinuity in the drift layer: the
     * eight biggest single-frame yaw steps all land exactly on a multiple of 3 s,
     * the largest at 0.624 deg/frame against a 99th-percentile ordinary step of
     * 0.084 deg/frame — 7.4x, or about 37 deg/s. Interpolating reads the SAME
     * random values off the SAME lattice and only crossfades between them, so this
     * introduces no new randomness. false reproduces the step exactly.
     */
    directionInterpolated: boolean;
  };
  energy: {
    influence: number;
    smoothing: number;
    minScale: number;
    maxScale: number;
    /**
     * Smooth the speech-activity gate before it scales the emitted pose.
     *
     * `activationWeight` multiplies the whole head POSITION by the per-frame speech
     * envelope. On the audit clip that envelope moves by up to 0.476 between
     * consecutive frames, which shows up as 614 yaw direction reversals in 36 s
     * against 36 with the gate held constant, and a 99th-percentile frame step 6.8x
     * larger. That is the mechanical, buzzing quality — not the drift itself.
     *
     * true finally reads `smoothing`, which every preset has always declared and no
     * code has ever consumed. false leaves the gate raw, exactly as before.
     */
    smoothActivation: boolean;
  };
  emphasis: {
    enabled: boolean;
    activationRate: number;
    minPitch: number;
    maxPitch: number;
    minDuration: number;
    maxDuration: number;
    minimumSpacing: number;
  };
  phrase: {
    enabled: boolean;
    activationRate: number;
    pauseThreshold: number;
    sentencePauseThreshold: number;
    duration: number;
    settleStrength: number;
    yawOffset: number;
    pitchOffset: number;
    rollOffset: number;
  };
  neckFollow: { pitch: number; yaw: number; roll: number };
  idleBlend: { speaking: number; rest: number };
}

export interface SpeakingMotionInput {
  /**
   * Suppress the emitted head/neck pose while keeping every other behaviour of this
   * controller intact. Set per model; see `AvatarModelConfig.speakingHeadMotion`.
   */
  stabilize?: boolean;
  deltaSeconds: number;
  audioTimeSeconds: number;
  durationSeconds: number;
  speechActive: boolean;
  paused: boolean;
  seed: string | number;
  speechActivity: number;
  audioEnergy?: number;
  /**
   * §P18. When present, the conversational gesture director owns the speaking
   * pose and the periodic drift plus energy scaling are bypassed entirely.
   * `null`/absent reproduces the previous behaviour exactly.
   */
  speakingMotionProfile?: SpeakingMotionProfile | null;
  /** FINAL CONVERGENCE. When present, the conductor owns the speaking head. */
  conductorTuning?: ConductorTuning | null;
  /**
   * The §P17 state character, so the same anchor is delivered differently under
   * WARM_ATTENTIVE and SERIOUS_FOCUSED. Ignored unless `conductorTuning` is set.
   */
  performanceCharacter?: PerformanceStateCharacter | null;
  /**
   * A frame already resolved by `resolveIntent`, shared with the face and gaze
   * consumers.
   *
   * Supplying it is what makes "one shared performance interpretation" literal
   * rather than merely reproducible: every consumer reads the SAME object, so
   * no consumer can be one frame stale or resolved against a different clock.
   * Omitted, this controller resolves its own — identical, because `resolve` is
   * a pure function of the clock, the plan and the character.
   */
  performanceIntent?: PerformanceIntentFrame | null;
  /**
   * FINAL MOTOR SPEECH. When present the head is INTEGRATED from motor drive
   * rather than eased toward a target, and both the §P18 gesture director and
   * the target-driven conductor branch are bypassed entirely — layering momentum
   * on top of a target system would give the head two owners.
   */
  motorTuning?: MotorTuning | null;
  /**
   * Orientation and angular velocity handed over by the idle layer at speech
   * onset, so the motor continues an existing trajectory instead of starting an
   * animation. Radians and radians/second.
   */
  motorAdopt?: { orientation: HeadRotationTarget; velocity: HeadRotationTarget } | null;
  /**
   * TALKINGHEAD SPEECH TEST. When present the upstream-derived adapter is the
   * sole speaking head authority and every other branch in this controller is
   * bypassed — including FINAL MOTOR SPEECH, the P18/P18.1/P18.2 director and
   * the target-driven conductor path.
   */
  talkingHeadTuning?: TalkingHeadTuning | null;
}

export interface SpeakingMotionOutput {
  head: HeadRotationTarget;
  neck: HeadRotationTarget;
  weight: number;
  /** §P18 adds `p18:<profile>:<gesture>` so the panel can name the live gesture. */
  activeLayer: "none" | "speech-drift" | "phrase-settle" | "emphasis" | "stabilized" | `p18:${string}` | `final:${string}` | `motor:${string}` | `talkinghead:${string}`;
  debug: HeadMotionDebugState;
}

interface PhraseEvent {
  index: number;
  time: number;
  duration: number;
  type: "short-pause" | "phrase-pause" | "sentence-end";
  direction: -1 | 0 | 1;
}

interface EmphasisEvent {
  index: number;
  time: number;
  duration: number;
  pitch: number;
}

const zero = (): HeadRotationTarget => ({ pitch: 0, yaw: 0, roll: 0 });
const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / Math.max(0.0001, edge1 - edge0));
  return t * t * (3 - 2 * t);
};
const hashSeed = (seed: string | number) => {
  const text = String(seed);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};
const random01 = (seed: number, salt: number) => {
  let value = (seed + Math.imul(salt + 1, 374761393)) >>> 0;
  value = Math.imul(value ^ (value >>> 15), 2246822519) >>> 0;
  value = Math.imul(value ^ (value >>> 13), 3266489917) >>> 0;
  return ((value ^ (value >>> 16)) >>> 0) / 0xffffffff;
};
const signed = (seed: number, salt: number) => random01(seed, salt) * 2 - 1;
const valueNoise = (time: number, frequency: number, seed: number, salt: number) => {
  const position = time * frequency;
  const index = Math.floor(position);
  const t = position - index;
  const a = signed(seed, salt + index * 97);
  const b = signed(seed, salt + (index + 1) * 97);
  return a + (b - a) * smoothstep(0, 1, t);
};

/** Salt and period of the yaw direction bias. Shared by both forms so they agree. */
const DIRECTION_SALT = 400;
const DIRECTION_PERIOD_SECONDS = 3;
const DIRECTION_SCALE = 0.16;

/**
 * The slow yaw direction bias.
 *
 * `interpolated` crossfades between the SAME two lattice values the stepped form
 * jumps between — `signed(seed, 400 + n)` and `signed(seed, 400 + n + 1)` — so at
 * every multiple of the period the two forms return exactly the same number and
 * the interpolated form adds no randomness of its own. It only removes the jump.
 */
const directionBias = (time: number, seed: number, interpolated: boolean) => {
  const position = time / DIRECTION_PERIOD_SECONDS;
  const index = Math.floor(position);
  if (!interpolated) return signed(seed, DIRECTION_SALT + index) * DIRECTION_SCALE;
  const a = signed(seed, DIRECTION_SALT + index);
  const b = signed(seed, DIRECTION_SALT + index + 1);
  return (a + (b - a) * smoothstep(0, 1, position - index)) * DIRECTION_SCALE;
};
const clampAxis = (rotation: HeadRotationTarget, limits: RotationLimits): HeadRotationTarget => ({
  pitch: clamp(rotation.pitch, -limits.pitch, limits.pitch),
  yaw: clamp(rotation.yaw, -limits.yaw, limits.yaw),
  roll: clamp(rotation.roll, -limits.roll, limits.roll)
});
const add = (a: HeadRotationTarget, b: HeadRotationTarget): HeadRotationTarget => ({
  pitch: a.pitch + b.pitch,
  yaw: a.yaw + b.yaw,
  roll: a.roll + b.roll
});
const scale = (rotation: HeadRotationTarget, weight: number): HeadRotationTarget => ({
  pitch: rotation.pitch * weight,
  yaw: rotation.yaw * weight,
  roll: rotation.roll * weight
});

export const baselineSpeakingHeadMotionConfig: SpeakingHeadMotionConfig = {
  enabled: true,
  fadeInSeconds: 0.24,
  fadeOutSeconds: 0.48,
  headLimits: { pitch: degreesToRadians(3), yaw: degreesToRadians(2), roll: degreesToRadians(1) },
  neckLimits: { pitch: degreesToRadians(1.1), yaw: degreesToRadians(0.8), roll: degreesToRadians(0.35) },
  drift: {
    yawAmplitude: degreesToRadians(0.9),
    pitchAmplitude: degreesToRadians(0.65),
    rollAmplitude: degreesToRadians(0.32),
    frequencies: { yaw: 0.19, pitch: 0.31, roll: 0.13 },
    stillnessStrength: 0,
    centeringSeconds: 0,
    centeringSamples: 9,
    directionInterpolated: false
  },
  energy: { influence: 0.24, smoothing: 8, minScale: 1, maxScale: 1.24, smoothActivation: false },
  emphasis: {
    enabled: true,
    activationRate: 0.28,
    minPitch: degreesToRadians(0.75),
    maxPitch: degreesToRadians(1.55),
    minDuration: 0.32,
    maxDuration: 0.46,
    minimumSpacing: 1.15
  },
  phrase: {
    enabled: true,
    activationRate: 1,
    pauseThreshold: 0.22,
    sentencePauseThreshold: 0.6,
    duration: 0.45,
    settleStrength: 0.34,
    yawOffset: degreesToRadians(0.45),
    pitchOffset: degreesToRadians(0.29),
    rollOffset: degreesToRadians(0.11)
  },
  neckFollow: { pitch: 0.32, yaw: 0.28, roll: 0.24 },
  idleBlend: { speaking: 0.28, rest: 1 }
};

export const candidateSpeakingHeadMotionConfigs = {
  conservative: {
    ...baselineSpeakingHeadMotionConfig,
    fadeInSeconds: 0.3,
    fadeOutSeconds: 0.62,
    headLimits: { pitch: degreesToRadians(3), yaw: degreesToRadians(2.5), roll: degreesToRadians(1) },
    neckLimits: { pitch: degreesToRadians(1), yaw: degreesToRadians(0.9), roll: degreesToRadians(0.4) },
    drift: {
      yawAmplitude: degreesToRadians(1.35),
      pitchAmplitude: degreesToRadians(0.95),
      rollAmplitude: degreesToRadians(0.42),
      frequencies: { yaw: 0.28, pitch: 0.36, roll: 0.2 },
      stillnessStrength: 0.18,
      centeringSeconds: 0,
      centeringSamples: 9,
      directionInterpolated: false
    },
    energy: { influence: 0.18, smoothing: 7, minScale: 0.9, maxScale: 1.16, smoothActivation: false },
    emphasis: {
      enabled: true,
      activationRate: 0.22,
      minPitch: degreesToRadians(0.95),
      maxPitch: degreesToRadians(1.55),
      minDuration: 0.34,
      maxDuration: 0.5,
      minimumSpacing: 2.4
    },
    phrase: {
      enabled: true,
      activationRate: 0.35,
      pauseThreshold: 0.24,
      sentencePauseThreshold: 0.62,
      duration: 0.42,
      settleStrength: 0.3,
      yawOffset: degreesToRadians(0.35),
      pitchOffset: degreesToRadians(0.24),
      rollOffset: degreesToRadians(0.1)
    },
    neckFollow: { pitch: 0.24, yaw: 0.25, roll: 0.18 },
    idleBlend: { speaking: 0.25, rest: 1 }
  },
  balanced: {
    ...baselineSpeakingHeadMotionConfig,
    fadeInSeconds: 0.32,
    fadeOutSeconds: 0.68,
    headLimits: { pitch: degreesToRadians(3), yaw: degreesToRadians(2.75), roll: degreesToRadians(1) },
    neckLimits: { pitch: degreesToRadians(1), yaw: degreesToRadians(1.1), roll: degreesToRadians(0.45) },
    drift: {
      yawAmplitude: degreesToRadians(2.1),
      pitchAmplitude: degreesToRadians(1.32),
      rollAmplitude: degreesToRadians(0.55),
      frequencies: { yaw: 0.3, pitch: 0.38, roll: 0.22 },
      stillnessStrength: 0.26,
      centeringSeconds: 0,
      centeringSamples: 9,
      directionInterpolated: false
    },
    energy: { influence: 0.22, smoothing: 6, minScale: 0.9, maxScale: 1.22, smoothActivation: false },
    emphasis: {
      enabled: true,
      activationRate: 0.12,
      minPitch: degreesToRadians(1.05),
      maxPitch: degreesToRadians(1.85),
      minDuration: 0.36,
      maxDuration: 0.52,
      minimumSpacing: 5.2
    },
    phrase: {
      enabled: true,
      activationRate: 0.45,
      pauseThreshold: 0.24,
      sentencePauseThreshold: 0.6,
      duration: 0.48,
      settleStrength: 0.34,
      yawOffset: degreesToRadians(0.55),
      pitchOffset: degreesToRadians(0.34),
      rollOffset: degreesToRadians(0.16)
    },
    neckFollow: { pitch: 0.28, yaw: 0.34, roll: 0.22 },
    idleBlend: { speaking: 0.22, rest: 1 }
  },
  expressive: {
    ...baselineSpeakingHeadMotionConfig,
    fadeInSeconds: 0.28,
    fadeOutSeconds: 0.72,
    headLimits: { pitch: degreesToRadians(3), yaw: degreesToRadians(3), roll: degreesToRadians(1) },
    neckLimits: { pitch: degreesToRadians(1.05), yaw: degreesToRadians(1.2), roll: degreesToRadians(0.5) },
    drift: {
      yawAmplitude: degreesToRadians(2.15),
      pitchAmplitude: degreesToRadians(1.55),
      rollAmplitude: degreesToRadians(0.72),
      frequencies: { yaw: 0.32, pitch: 0.42, roll: 0.24 },
      stillnessStrength: 0.22,
      centeringSeconds: 0,
      centeringSamples: 9,
      directionInterpolated: false
    },
    energy: { influence: 0.26, smoothing: 6, minScale: 0.9, maxScale: 1.28, smoothActivation: false },
    emphasis: {
      enabled: true,
      activationRate: 0.24,
      minPitch: degreesToRadians(1.25),
      maxPitch: degreesToRadians(2.25),
      minDuration: 0.34,
      maxDuration: 0.54,
      minimumSpacing: 2
    },
    phrase: {
      enabled: true,
      activationRate: 0.55,
      pauseThreshold: 0.22,
      sentencePauseThreshold: 0.58,
      duration: 0.52,
      settleStrength: 0.38,
      yawOffset: degreesToRadians(0.72),
      pitchOffset: degreesToRadians(0.44),
      rollOffset: degreesToRadians(0.22)
    },
    neckFollow: { pitch: 0.32, yaw: 0.38, roll: 0.26 },
    idleBlend: { speaking: 0.2, rest: 1 }
  }
} satisfies Record<string, SpeakingHeadMotionConfig>;

export const defaultSpeakingHeadMotionConfig: SpeakingHeadMotionConfig = candidateSpeakingHeadMotionConfigs.balanced;

/**
 * How a model drives the procedural speaking head. See `AvatarModelConfig`.
 *
 * - `free`       the historical drift layer, uncorrected. Every model's default.
 * - `stabilized` §8: emitted pose suppressed, head held still while speaking.
 * - `centered`   §15: drift with the three P3 corrections below.
 */
export type SpeakingHeadMotionMode = "free" | "stabilized" | "centered";

/**
 * The P3 speaking-head configuration: same layer, three mechanism corrections, and
 * the amplitude put back afterwards.
 *
 * The corrections and the amplitudes have to travel together, which is why this is
 * one function rather than three config edits. Centring is a high-pass: it removes
 * the slow components the drift's energy is concentrated in, so with the amplitudes
 * left alone the head range collapses from 1.51 deg to 0.63 deg and reads as still.
 * The multipliers below restore the range; they are stated as multipliers rather
 * than as absolute degrees so it stays visible that this is compensation for a
 * filter and not a decision to move the head more.
 *
 * Measured on `david-natural-speech-paragraph` over 40 seeds, against the
 * uncorrected layer on the same clip and seeds:
 *
 * | | uncorrected | centered |
 * |---|---|---|
 * | longest visible one-sided lean, mean | 5.89 s | **2.47 s** |
 * | longest visible one-sided lean, worst seed | **15.12 s** | **2.97 s** |
 * | seeds leaning one way for over 5 s | 23/40 | **0/40** |
 * | yaw range, mean | 2.70 deg | 2.09 deg |
 * | largest single-frame yaw step | 1.185 deg | **0.156 deg** |
 * | yaw direction reversals | 614 | 375 |
 *
 * The worst case is what matters here. The uncorrected layer's lean is bounded by
 * nothing — a different seed moves it, it does not remove it — while the centred
 * layer's is bounded by `centeringSeconds` by construction.
 *
 * Honest cost: the momentary peak offset goes UP slightly (0.52 -> 0.64 deg mean of
 * the 2 s posture mean). The head reaches a slightly larger offset and stops
 * holding it, which is the trade this pass wanted.
 */
export const withCenteredDrift = (config: SpeakingHeadMotionConfig): SpeakingHeadMotionConfig => ({
  ...config,
  drift: {
    ...config.drift,
    // 8 s keeps everything faster than about 0.125 Hz — the band conversational
    // head motion actually lives in — and removes the slower wander. 6 s cost too
    // much of the motion; 12 s let the lean back out to 3.4 s.
    centeringSeconds: 8,
    centeringSamples: 9,
    directionInterpolated: true,
    yawAmplitude: config.drift.yawAmplitude * 3.6,
    pitchAmplitude: config.drift.pitchAmplitude * 2,
    rollAmplitude: config.drift.rollAmplitude * 5.5
  },
  energy: { ...config.energy, smoothActivation: true }
});

export class SpeakingHeadMotionController {
  private seed = hashSeed("default");
  /**
   * §P18 conversational gesture layer.
   *
   * When a profile is supplied this REPLACES the drift and energy terms below
   * rather than adding to them — see `update()`. Leaving the oscillator running
   * underneath would keep the 415 reversals/min and 0.955 alternation rate that
   * made the shipped motion read as a metronome.
   */
  private gestures = new SpeakingGestureDirector(new BehaviorRandom("p18-speaking"));
  /**
   * FINAL CONVERGENCE. When a conductor tuning is supplied this owns the
   * speaking head outright and the P18/P18.1/P18.2 gesture director is not
   * consulted at all — two systems scheduling head emphasis is the architecture
   * this replaces.
   */
  private conductor = new SpeechPerformanceConductor();
  /**
   * FINAL MOTOR SPEECH. Persistent across frames and deliberately so: it is the
   * only stateful thing in this controller besides the activity gate, because
   * momentum IS state. Everything that decides what to do with it — the plan,
   * the conductor, the prosody track — stays a pure function of the audio clock.
   */
  private motor = new SpeakingMotorController();
  /**
   * TALKINGHEAD SPEECH TEST. Stateful in exactly the way upstream is: it owns an
   * animation queue, morph slots and its own clock.
   */
  private talkingHead = new TalkingHeadSpeakingAdapter();
  private lastTalkingHead: TalkingHeadOutput | null = null;
  /** Whether the adapter owned the head last frame, for rising/falling-edge reset. */
  private talkingHeadEngaged = false;
  /** HYBRID. Pause damping from the real phoneme timeline, sampled by clock. */
  private pauseDamping = new PauseDampingTrack();
  private prosody = new ProsodyTrack();
  private lastProsody: ProsodyFrame = neutralProsody;
  private lastMotor: MotorOutput | null = null;
  private motorEngaged = false;
  /**
   * Seconds since speech stopped while the motor was still moving.
   *
   * Speech ending is not the motion ending. Without this the controller's
   * `disabled` early-return dropped the entire speaking contribution to zero in
   * ONE frame — measured on the composed bone at speech end: pitch 0.681 deg to
   * 0, a 4,345 deg/s^3 jerk spike, the largest single discontinuity in the clip
   * and precisely the mode-switch snap this pass exists to remove.
   */
  private releaseElapsed = -1;
  private lastIntent: PerformanceIntentFrame = { ...silentPerformanceIntent };
  private gestureIntent: SpeakingGestureIntent = { ...neutralSpeakingGestureIntent };
  private lastPhraseIndex = -1;
  private lastEmphasisIndex = -1;
  private phraseEvents: PhraseEvent[] = [];
  private emphasisEvents: EmphasisEvent[] = [];
  private lastDebug: HeadMotionDebugState;
  /**
   * Smoothed speech-activity gate. The only piece of frame-to-frame state in this
   * class, and it is deliberately confined to the GATE rather than the pose: the
   * drift, the phrase settle and the emphasis all remain pure functions of
   * `audioTimeSeconds`, so a seek still lands on exactly the pose that time owns.
   * `seek()` clears it so scrubbing cannot carry a stale gate across a jump.
   */
  private activityGate = -1;

  constructor(private config: SpeakingHeadMotionConfig = defaultSpeakingHeadMotionConfig) {
    this.lastDebug = this.neutralDebug("default");
  }

  configure(config: SpeakingHeadMotionConfig) {
    this.config = config;
  }

  setTimeline(options: { seed: string | number; phonemes: TimedPhoneme[]; pauses?: TimedPause[]; durationSeconds: number; text?: string }) {
    this.activityGate = -1;
    this.seed = hashSeed(options.seed);
    this.phraseEvents = this.buildPhraseEvents(options.phonemes, options.pauses ?? [], options.durationSeconds);
    // §P18 derives its own phrase structure from the phoneme timeline.
    this.gestures.setTimeline(options.phonemes);
    this.gestures.reset(0);
    // The plan is built ONCE, before playback, from the utterance itself.
    this.conductor.setPlan(buildSpeechPerformancePlan(options.text, options.phonemes, options.durationSeconds));
    // How the sentence was actually delivered. Precomputed for the same reason
    // the plan is: every read stays a pure function of the audio clock.
    this.prosody = new ProsodyTrack(options.phonemes, options.durationSeconds);
    this.pauseDamping = new PauseDampingTrack(options.phonemes, options.durationSeconds);
    this.motor.reset();
    this.motorEngaged = false;
    this.releaseElapsed = -1;
    this.talkingHead.reset(options.seed);
    this.lastTalkingHead = null;
    this.talkingHeadEngaged = false;
    this.emphasisEvents = this.buildEmphasisEvents(options.phonemes);
    this.lastDebug = this.neutralDebug(options.seed);
  }

  reset(reason = "manual") {
    this.activityGate = -1;
    this.motor.reset();
    this.motorEngaged = false;
    this.releaseElapsed = -1;
    this.talkingHead.reset(this.seed);
    this.lastTalkingHead = null;
    this.talkingHeadEngaged = false;
    this.gestures.reset(0);
    this.gestureIntent = { ...neutralSpeakingGestureIntent };
    this.lastPhraseIndex = -1;
    this.lastEmphasisIndex = -1;
    this.lastDebug = { ...this.neutralDebug(this.seed), activeLayer: `reset:${reason}` };
  }

  /** The live §P18 intent, for the dev panel. */
  speakingGestureIntent() {
    return this.gestureIntent;
  }

  /** The live conductor intent and plan, for the panel and diagnostics. */
  performanceIntent() {
    return this.lastIntent;
  }

  /**
   * Resolves the shared intent for a clock WITHOUT advancing anything.
   *
   * The one resolve per frame. `AvatarController` calls this before any
   * consumer runs and hands the result to all of them, so head, neck, gaze and
   * face are reading the same anchor on the same frame by construction rather
   * than by coincidence.
   */
  resolveIntent(clock: number, tuning: ConductorTuning, character: PerformanceStateCharacter = defaultStateCharacter) {
    return this.conductor.resolve(clock, tuning, character);
  }

  performancePlan() {
    return this.conductor.currentPlan();
  }

  /** Live-only plan handoff. Assignment is stateless and never resets motion. */
  setPerformancePlan(plan: SpeechPerformancePlan | null) {
    this.conductor.setPlan(plan);
  }

  /** Live motor state and prosody, for the review panel and the diagnostics. */
  motorState() {
    return this.lastMotor;
  }

  prosodyNow() {
    return this.lastProsody;
  }

  /** Orientation and velocity for the idle layer to continue after speech. */
  motorHandoff() {
    return this.motorEngaged ? this.motor.handoff() : null;
  }

  /** Live TalkingHead adapter output, for the review panel and diagnostics. */
  talkingHeadState() {
    return this.lastTalkingHead;
  }

  seek(_timeSeconds: number) {
    // The pose is a pure function of time; only the gate carries state, and it must
    // not survive a jump. Previously a no-op, which was harmless while nothing here
    // was stateful.
    this.activityGate = -1;
    /**
     * A seek is a discontinuity in the AUDIO, so the motor must not carry
     * momentum across it — that would be velocity from a moment that no longer
     * precedes this one. Re-adopted from the idle layer on the next frame.
     */
    this.motor.reset();
    this.motorEngaged = false;
    this.releaseElapsed = -1;
    this.talkingHead.reset(this.seed);
    this.lastTalkingHead = null;
    this.talkingHeadEngaged = false;
    this.gestures.reset(_timeSeconds);
  }
  pause() {}
  resume() {}

  /**
   * The speech-activity gate, smoothed when the model asks for it.
   *
   * First frame seeds the filter with the sample itself rather than with zero, so
   * enabling smoothing cannot introduce a fade-in the raw path did not have.
   */
  private gate(activity: number, deltaSeconds: number) {
    if (!this.config.energy.smoothActivation) {
      this.activityGate = activity;
      return activity;
    }
    if (this.activityGate < 0) this.activityGate = activity;
    const alpha = 1 - Math.exp(-Math.max(0, deltaSeconds) * this.config.energy.smoothing);
    this.activityGate += (activity - this.activityGate) * alpha;
    return this.activityGate;
  }

  /**
   * Removes any offset the drift has held for longer than `centeringSeconds`.
   *
   * `centred = raw - lowpass(raw)`, where the low pass is a Hann-weighted mean of
   * the drift SHAPE resampled around `time`. Two properties are deliberate:
   *
   * - **Stateless.** The estimate is computed by re-evaluating the same pure
   *   function, never accumulated across frames. A one-pole filter would have been
   *   cheaper and would have made the emitted pose depend on playback history, so a
   *   seek or a scrub would land somewhere that timestamp does not own.
   * - **Symmetric, therefore zero phase.** The window spans
   *   `[t - W/2, t + W/2]`. Sampling ahead of `time` is legitimate precisely because
   *   the drift is analytic in time rather than a causal stream, and it is what
   *   keeps this a clean subtraction: a trailing-only window lags the signal by half
   *   its length, and `raw - laggedMean` overshoots rather than centring. Measured,
   *   a trailing boxcar INFLATED the pitch range from 1.18 to 1.61 deg while the
   *   symmetric kernel leaves it alone.
   *
   * Hann rather than uniform weights for the same reason: a boxcar's sidelobes
   * re-introduce ripple at the frequencies the drift actually lives at.
   *
   * Sampling reaches past t = 0 into negative time, which the noise handles (its
   * lattice index is a floor), so there is no startup transient to special-case.
   */
  private centre(shape: (time: number) => HeadRotationTarget, time: number): HeadRotationTarget {
    const { centeringSeconds: window, centeringSamples } = this.config.drift;
    const current = shape(time);
    if (window <= 0) return current;
    const samples = Math.max(3, Math.round(centeringSamples));
    const mean = zero();
    let totalWeight = 0;
    for (let i = 0; i < samples; i += 1) {
      const position = i / (samples - 1);
      const weight = 0.5 - 0.5 * Math.cos(2 * Math.PI * position);
      if (weight <= 0) continue;
      const offset = shape(time + window * (position - 0.5));
      mean.pitch += offset.pitch * weight;
      mean.yaw += offset.yaw * weight;
      mean.roll += offset.roll * weight;
      totalWeight += weight;
    }
    if (totalWeight <= 0) return current;
    return {
      pitch: current.pitch - mean.pitch / totalWeight,
      yaw: current.yaw - mean.yaw / totalWeight,
      roll: current.roll - mean.roll / totalWeight
    };
  }

  update(input: SpeakingMotionInput): SpeakingMotionOutput {
    const disabled = !this.config.enabled || !input.speechActive || input.paused;

    /**
     * TALKINGHEAD speech-end handoff.
     *
     * Same reason the motor has one: the `disabled` return below terminated the
     * whole contribution in a single frame, measured at 24,607 deg/s^3 on the
     * composed bone. The adapter retires its queue and decays to zero through
     * upstream's own smoother while §P16 fades idle back in.
     */
    if (disabled && this.talkingHeadEngaged && input.talkingHeadTuning && !input.paused) {
      const out = this.talkingHead.release(input.deltaSeconds, input.talkingHeadTuning);
      this.lastTalkingHead = out;
      if (this.talkingHead.settled()) {
        this.talkingHead.reset(this.seed);
        this.talkingHeadEngaged = false;
        this.lastTalkingHead = null;
        return this.output(zero(), zero(), zero(), zero(), 1, 0, 0, "none", input, undefined, undefined);
      }
      const head = clampAxis(out.head, this.config.headLimits);
      const neck = clampAxis(out.neck, this.config.neckLimits);
      return this.output(head, neck, zero(), zero(), 1, 0, 1, "talkinghead:release", input, undefined, undefined, zero());
    }

    /**
     * SPEECH END IS NOT MOTION END.
     *
     * When speech stops with the motor still moving, the integrator keeps
     * running with no drive and full settling damping, so existing momentum
     * dissipates the way a real head's does. `rest` is drawn toward neutral over
     * the same window, so by the time the idle layer has faded back in the motor
     * is already at rest and releasing it is continuous.
     *
     * Placed before the `disabled` return because that return is what caused the
     * defect: it terminated the whole contribution in a single frame.
     */
    if (disabled && this.motorEngaged && input.motorTuning && !input.paused) {
      this.releaseElapsed = this.releaseElapsed < 0 ? 0 : this.releaseElapsed + input.deltaSeconds;
      const motor = this.motor.release(input.deltaSeconds, input.motorTuning);
      this.lastMotor = motor;
      const settled = motor.speedDegrees < 0.02 && Math.abs(motor.head.pitch) < 0.0006 && Math.abs(motor.head.yaw) < 0.0006;
      if (this.releaseElapsed > 2.5 || settled) {
        this.motorEngaged = false;
        this.releaseElapsed = -1;
        return this.output(zero(), zero(), zero(), zero(), 1, 0, 0, "none", input, undefined, undefined);
      }
      const head = clampAxis(motor.head, this.config.headLimits);
      const neck = clampAxis(motor.neck, this.config.neckLimits);
      return this.output(head, neck, zero(), zero(), 1, 0, 1, "motor:release", input, undefined, undefined, zero());
    }
    if (disabled) {
      this.releaseElapsed = -1;
      return this.output(zero(), zero(), zero(), zero(), 1, 0, 0, "none", input, undefined, undefined);
    }
    this.releaseElapsed = -1;

    /**
     * Speaking head motion held still, by request (2026-08-17).
     *
     * Everything below this point is left intact — the config, the phrase and
     * emphasis event tables built by `setTimeline`, the drift noise and the
     * activation envelope — so speaking head movement can be restored or redesigned
     * by clearing one per-model flag. Only the emitted pose is suppressed.
     *
     * No fade is needed here and none is invented: this controller already returns
     * zero whenever `speechActive` is false, so its contribution is zero on both
     * sides of every speech boundary. The motion that DOES need fading during the
     * handover is the idle layer's, and that is handled by the blend it already
     * owns (`HumanBehaviorController`'s `transitionWeight`). `activeLayer` reports
     * "stabilized" so the dev panel shows why the head is still.
     */
    if (input.stabilize) {
      return this.output(zero(), zero(), zero(), zero(), 1, 0, 0, "stabilized", input, undefined, undefined);
    }

    /**
     * TALKINGHEAD SPEECH TEST.
     *
     * First branch, and it returns: when the adapter is active it is the only
     * speaking head authority in the process. Placed above the activation-fade
     * gate for the same reason the motor branch is — a fade would be a
     * multiplication toward zero that upstream does not have — and above the
     * motor and §P18 branches so momentum dynamics can never be layered on top
     * of it. Fidelity before improvement: nothing of ours touches this pose.
     */
    const talkingHeadTuning = input.talkingHeadTuning ?? null;
    if (talkingHeadTuning) {
      /**
       * Rising edge: start the adapter clean.
       *
       * Without this, switching away and back leaves the previous activation's
       * animation queue, morph slots and clock in place, so the second visit
       * continues a performance from a different session. Resetting is also the
       * faithful reading — upstream rebuilds its queue when the state changes.
       */
      if (!this.talkingHeadEngaged) {
        this.talkingHead.reset(this.seed);
        this.talkingHeadEngaged = true;
      }
      /**
       * HYBRID modulation.
       *
       * Shares the same resolved performance frame the face and gaze consumers
       * read, so head, gaze and face express one intention strength — but only
       * its scalar `emphasis` survives. Every head angle the conductor produces
       * is discarded here; the carrier owns the trajectory.
       */
      let modulation = neutralModulation;
      if (talkingHeadTuning.hybrid) {
        const prosodyNow = this.prosody.at(input.audioTimeSeconds);
        this.lastProsody = prosodyNow;
        const intent = input.performanceIntent
          ?? (input.conductorTuning
            ? this.conductor.resolve(
                input.audioTimeSeconds, input.conductorTuning,
                input.performanceCharacter ?? defaultStateCharacter, prosodyNow)
            : null);
        if (intent) this.lastIntent = intent;
        modulation = modulationFrom(intent, prosodyNow, this.pauseDamping.at(input.audioTimeSeconds));
      }
      const out = this.talkingHead.update(input.deltaSeconds, true, talkingHeadTuning, modulation);
      this.lastTalkingHead = out;
      const head = clampAxis(out.head, this.config.headLimits);
      const neck = clampAxis(out.neck, this.config.neckLimits);
      return this.output(head, neck, zero(), zero(), 1, 0, 1, "talkinghead:speaking", input, undefined, undefined, zero());
    }

    /**
     * FINAL MOTOR SPEECH.
     *
     * Placed BEFORE the activation-weight gate as well as before the
     * target-driven branch, so when a motor tuning is supplied nothing else in
     * this controller runs. That is the "no conflicting speaking head scheduler"
     * rule enforced structurally rather than by a flag someone must remember.
     *
     * The position relative to `activationWeight` is load-bearing, not tidiness.
     * That gate multiplies by a fade-out derived from the clip end and returns
     * zero once it is small; with the motor branch below it, the entire speaking
     * contribution was dropped to zero in one frame at `audio_duration` —
     * measured on the composed bone as a 4,762 deg/s^3 spike, the largest
     * discontinuity left in the clip. The motor has no fade by design: a fade is
     * a multiplication toward zero regardless of momentum, which is the same
     * discontinuity-in-intention this pass exists to remove. Continuity at the
     * end comes from `release()` instead.
     */
    if (this.talkingHeadEngaged) {
      // Left the experiment: drop its state so nothing survives to the next visit.
      this.talkingHead.reset(this.seed);
      this.talkingHeadEngaged = false;
      this.lastTalkingHead = null;
    }

    const conductorTuning = input.conductorTuning ?? null;
    const motorTuning = input.motorTuning ?? null;
    if (conductorTuning && motorTuning) {
      const intent = input.performanceIntent
        ?? this.conductor.resolve(
          input.audioTimeSeconds,
          conductorTuning,
          input.performanceCharacter ?? defaultStateCharacter,
          this.prosody.at(input.audioTimeSeconds)
        );
      this.lastIntent = intent;
      this.lastProsody = this.prosody.at(input.audioTimeSeconds);

      /**
       * Speech onset. The motor adopts whatever the head was already doing —
       * orientation AND angular velocity — so entering speech continues a
       * trajectory instead of starting one. Velocity is never zeroed and the
       * head never snaps to a speaking rest.
       */
      if (!this.motorEngaged) {
        const adopt = input.motorAdopt;
        this.motor.adopt(adopt?.orientation ?? zero(), adopt?.velocity ?? zero());
        this.motorEngaged = true;
      }

      const motor = this.motor.update(input.deltaSeconds, intent.drive, motorTuning);
      this.lastMotor = motor;
      /**
       * No fade envelope on this path, deliberately.
       *
       * A fade multiplies the output by a ramp, which is precisely the
       * discontinuity in intention this pass exists to remove: it would scale a
       * moving head toward zero regardless of its momentum. Continuity at both
       * boundaries comes from `adopt` on entry, from settling damping on exit,
       * and from the jerk limiter on the final composed bone.
       */
      const head = clampAxis(motor.head, this.config.headLimits);
      const neck = clampAxis(motor.neck, this.config.neckLimits);
      return this.output(head, neck, zero(), zero(), 1, 0, 1, `motor:${intent.phase}`, input, undefined, undefined, zero());
    }


    const weight = this.activationWeight(
      input.audioTimeSeconds,
      input.durationSeconds,
      this.gate(input.speechActivity, input.deltaSeconds)
    );
    if (weight <= 0.0001) return this.output(zero(), zero(), zero(), zero(), 1, 0, 0, "none", input, undefined, undefined);

    /**
     * §P18. With a profile active the periodic drift and the energy scaling are
     * not computed at all — the gesture director owns the speaking pose. The
     * phrase and emphasis EVENT TABLES are still used, but only as prosodic
     * opportunities, never as amplitudes.
     */
    /**
     * FINAL CONVERGENCE path. Resolved against `audioTimeSeconds` — the audio
     * clock — so shifting the speech timeline shifts the whole performance and
     * a seek lands where it should.
     */
    const tuning = input.conductorTuning ?? null;
    if (tuning) {
      const intent = input.performanceIntent
        ?? this.conductor.resolve(input.audioTimeSeconds, tuning, input.performanceCharacter ?? defaultStateCharacter);
      this.lastIntent = intent;
      const toRad = Math.PI / 180;
      const fade = clamp(
        Math.min(
          smoothstep(0, this.config.fadeInSeconds, input.audioTimeSeconds),
          1 - smoothstep(Math.max(0, input.durationSeconds - this.config.fadeOutSeconds), input.durationSeconds, input.audioTimeSeconds)
        )
      );
      const head = clampAxis(
        scale({ pitch: intent.headPitch * toRad, yaw: intent.headYaw * toRad, roll: intent.headRoll * toRad }, fade),
        this.config.headLimits
      );
      const neck = clampAxis(
        {
          pitch: head.pitch * intent.neckSupport,
          yaw: head.yaw * intent.neckSupport,
          roll: head.roll * intent.neckSupport * 0.6
        },
        this.config.neckLimits
      );
      return this.output(head, neck, zero(), zero(), 1, 0, fade, `final:${intent.phase}`, input, undefined, undefined, zero());
    }

    const profile = input.speakingMotionProfile ?? null;
    if (profile) {
      const phraseNow = this.phraseOffset(input.audioTimeSeconds);
      const emphasisNow = this.emphasisOffset(input.audioTimeSeconds);
      /**
       * Opportunities are derived INSIDE the director from the phoneme
       * timeline and live energy. The old phrase/emphasis tables are still
       * evaluated for the debug readout, but they are not what triggers a
       * gesture — the production payload has an empty pause table, so a
       * director driven by them fired nothing at all.
       */
      const intent = this.gestures.update(input.deltaSeconds, profile, {
        speaking: true,
        audioTime: input.audioTimeSeconds,
        energy: clamp(input.audioEnergy ?? input.speechActivity, 0, 1)
      });
      this.gestureIntent = intent;
      const toRad = Math.PI / 180;
      /**
       * §P18 uses the FADE half of the activation envelope only.
       *
       * `activationWeight` multiplies the fade by the per-frame speech activity,
       * which for the drift layer was intentional. For a conversational gesture
       * it is the puppet coupling this pass exists to remove: it scaled a
       * deliberate nod by whatever the mouth happened to be doing, shrinking a
       * 1.1-2.4 deg micro-nod to about 0.4 deg and modulating it syllable by
       * syllable. The fade still blends the layer in and out across the speech
       * boundary, so entering and leaving speech remains smooth.
       */
      const fade = clamp(
        Math.min(
          smoothstep(0, this.config.fadeInSeconds, input.audioTimeSeconds),
          1 - smoothstep(Math.max(0, input.durationSeconds - this.config.fadeOutSeconds), input.durationSeconds, input.audioTimeSeconds)
        )
      );
      const gHead = clampAxis(
        scale({ pitch: intent.pitch * toRad, yaw: intent.yaw * toRad, roll: intent.roll * toRad }, fade),
        this.config.headLimits
      );
      const gNeck = clampAxis(
        scale({ pitch: intent.neckPitch * toRad, yaw: intent.neckYaw * toRad, roll: intent.neckRoll * toRad }, fade),
        this.config.neckLimits
      );
      return this.output(gHead, gNeck, zero(), zero(), 1, 0, fade, `p18:${intent.profile}:${intent.gesture}`, input, phraseNow?.event, emphasisNow?.event, zero());
    }

    const energy = clamp(input.audioEnergy ?? input.speechActivity, 0, 1);
    const energyScale = clamp(this.config.energy.minScale + energy * this.config.energy.influence, this.config.energy.minScale, this.config.energy.maxScale);
    const phrase = this.phraseOffset(input.audioTimeSeconds);
    const stillness = this.stillnessWeight(input.audioTimeSeconds);
    // Amplitude and direction are separated from the CENTRING below on purpose: the
    // energy scale and the stillness weight are legitimate per-frame modulations of
    // how far the head moves, while centring is about where the middle of that
    // movement sits. Applying the high-pass to the fully scaled vector would let a
    // loud passage drag the estimated centre with it.
    const shape = (time: number): HeadRotationTarget => ({
      pitch: valueNoise(time + 11.3, this.config.drift.frequencies.pitch, this.seed, 10) * this.config.drift.pitchAmplitude,
      yaw:
        (valueNoise(time, this.config.drift.frequencies.yaw, this.seed, 20) +
          directionBias(time, this.seed, this.config.drift.directionInterpolated)) *
        this.config.drift.yawAmplitude,
      roll: valueNoise(time + 31.7, this.config.drift.frequencies.roll, this.seed, 30) * this.config.drift.rollAmplitude
    });
    const centred = this.centre(shape, input.audioTimeSeconds);
    const drift = scale(scale(centred, energyScale), 1 - stillness);
    const emphasis = this.emphasisOffset(input.audioTimeSeconds);
    const layer = emphasis ? "emphasis" : phrase ? "phrase-settle" : "speech-drift";
    const head = clampAxis(scale(add(add(drift, phrase?.rotation ?? zero()), emphasis?.rotation ?? zero()), weight), this.config.headLimits);
    const neck = clampAxis(
      {
        pitch: head.pitch * this.config.neckFollow.pitch,
        yaw: head.yaw * this.config.neckFollow.yaw,
        roll: head.roll * this.config.neckFollow.roll
      },
      this.config.neckLimits
    );
    return this.output(head, neck, drift, phrase?.rotation ?? zero(), energyScale, stillness, weight, layer, input, phrase?.event, emphasis?.event, emphasis?.rotation ?? zero());
  }

  private activationWeight(time: number, duration: number, speechActivity: number) {
    const startWeight = smoothstep(0, this.config.fadeInSeconds, time);
    const endWeight = 1 - smoothstep(Math.max(0, duration - this.config.fadeOutSeconds), duration, time);
    return clamp(Math.min(startWeight, endWeight) * clamp(speechActivity * 1.35));
  }

  private phraseOffset(time: number) {
    if (!this.config.phrase.enabled) return undefined;
    const event = this.phraseEvents.find((candidate) => time >= candidate.time && time <= candidate.time + this.config.phrase.duration);
    if (!event) return undefined;
    const progress = (time - event.time) / this.config.phrase.duration;
    const settle = Math.sin(progress * Math.PI) * this.config.phrase.settleStrength;
    return {
      event,
      rotation: {
        pitch: -this.config.phrase.pitchOffset * settle,
        yaw: this.config.phrase.yawOffset * event.direction * settle,
        roll: -this.config.phrase.rollOffset * event.direction * settle
      }
    };
  }

  private stillnessWeight(time: number) {
    if (!this.config.phrase.enabled || this.config.drift.stillnessStrength <= 0) return 0;
    const event = this.phraseEvents.find((candidate) => time >= candidate.time && time <= candidate.time + 0.36);
    if (!event) return 0;
    const progress = (time - event.time) / 0.36;
    return Math.sin(progress * Math.PI) * this.config.drift.stillnessStrength;
  }

  private emphasisOffset(time: number) {
    if (!this.config.emphasis.enabled) return undefined;
    const event = this.emphasisEvents.find((candidate) => time >= candidate.time && time <= candidate.time + candidate.duration);
    if (!event) return undefined;
    const progress = (time - event.time) / event.duration;
    const prepare = smoothstep(0, 0.28, progress) * 0.18;
    const down = Math.sin(progress * Math.PI);
    const recover = smoothstep(0.62, 1, progress) * 0.12;
    return { event, rotation: { pitch: event.pitch * (down + prepare - recover), yaw: 0, roll: 0 } };
  }

  private buildPhraseEvents(phonemes: TimedPhoneme[], pauses: TimedPause[], duration: number) {
    const events: PhraseEvent[] = [];
    let index = 0;
    const maybePush = (time: number, durationSeconds: number, salt: number) => {
      if (random01(this.seed, salt) > this.config.phrase.activationRate && durationSeconds < this.config.phrase.sentencePauseThreshold) return;
      events.push({
        index,
        time,
        duration: durationSeconds,
        type: durationSeconds >= this.config.phrase.sentencePauseThreshold ? "sentence-end" : "phrase-pause",
        direction: random01(this.seed, 900 + index) > 0.55 ? 1 : -1
      });
      index += 1;
    };
    for (let i = 0; i < phonemes.length - 1; i += 1) {
      const current = phonemes[i];
      const next = phonemes[i + 1];
      const gap = next.start_time - current.end_time;
      const silence = current.phoneme === "SIL" ? current.end_time - current.start_time : 0;
      const pauseDuration = Math.max(gap, silence);
      if (pauseDuration >= this.config.phrase.pauseThreshold && current.end_time > 0.05) maybePush(current.end_time, pauseDuration, 820 + i);
    }
    for (const pause of pauses) {
      const durationSeconds = pause.end_time - pause.start_time;
      if (durationSeconds >= this.config.phrase.pauseThreshold) maybePush(pause.start_time, durationSeconds, 950 + index);
    }
    if (duration > 0) events.push({ index, time: Math.max(0, duration - 0.56), duration: 0.56, type: "sentence-end", direction: 0 });
    return [...events].sort((a, b) => a.time - b.time);
  }

  private buildEmphasisEvents(phonemes: TimedPhoneme[]) {
    const speechPhones = phonemes.filter((phone) => phone.phoneme !== "SIL" && phone.intensity > 0.68);
    const events: EmphasisEvent[] = [];
    let lastTime = -Infinity;
    let index = 0;
    for (const phone of speechPhones) {
      const center = (phone.start_time + phone.end_time) / 2;
      if (center - lastTime < this.config.emphasis.minimumSpacing) continue;
      const chance = random01(this.seed, 1200 + Math.round(center * 100));
      if (chance > this.config.emphasis.activationRate) continue;
      const amount = this.config.emphasis.minPitch + random01(this.seed, 1300 + index) * (this.config.emphasis.maxPitch - this.config.emphasis.minPitch);
      const duration = this.config.emphasis.minDuration + random01(this.seed, 1400 + index) * (this.config.emphasis.maxDuration - this.config.emphasis.minDuration);
      events.push({ index, time: Math.max(0, center - duration * 0.32), duration, pitch: amount });
      lastTime = center;
      index += 1;
    }
    return events;
  }

  private output(
    head: HeadRotationTarget,
    neck: HeadRotationTarget,
    drift: HeadRotationTarget,
    phrase: HeadRotationTarget,
    energyMultiplier: number,
    stillnessWeight: number,
    weight: number,
    activeLayer: SpeakingMotionOutput["activeLayer"],
    input: SpeakingMotionInput,
    phraseEvent?: PhraseEvent,
    emphasisEvent?: EmphasisEvent,
    emphasis: HeadRotationTarget = zero()
  ): SpeakingMotionOutput {
    this.lastDebug = {
      enabled: this.config.enabled,
      speechActive: input.speechActive,
      paused: input.paused,
      weight,
      activeLayer,
      gesturePhase: this.gestureIntent.phase,
      gestureEmphasis: this.gestureIntent.emphasis,
      gesturePhraseProgress: this.gestureIntent.phraseProgress,
      
      head,
      neck,
      drift,
      phrase,
      emphasis,
      energyMultiplier,
      idleBlendWeight: this.config.idleBlend.speaking,
      stillnessWeight,
      phraseIndex: phraseEvent?.index,
      phraseState: phraseEvent?.type ?? "none",
      emphasisIndex: emphasisEvent?.index,
      emphasisState: emphasisEvent ? "active" : "none",
      seed: String(input.seed)
    };
    return { head, neck, weight, activeLayer, debug: this.lastDebug };
  }

  private neutralDebug(seed: string | number): HeadMotionDebugState {
    return {
      enabled: this.config.enabled,
      speechActive: false,
      paused: false,
      weight: 0,
      activeLayer: "none",
      head: zero(),
      neck: zero(),
      drift: zero(),
      phrase: zero(),
      emphasis: zero(),
      energyMultiplier: 1,
      idleBlendWeight: this.config.idleBlend.speaking,
      stillnessWeight: 0,
      phraseState: "none",
      emphasisState: "none",
      seed: String(seed)
    };
  }
}
