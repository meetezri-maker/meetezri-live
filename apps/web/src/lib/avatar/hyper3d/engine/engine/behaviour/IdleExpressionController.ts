import { idleExpressionEventIds, idleExpressionProfiles, type IdleExpressionEventId, type IdleExpressionProfile } from "../../mappings/idleExpressionProfiles";
import { defaultNaturalismPresetId, getNaturalismPreset, type NaturalismPresenceConfig, type NaturalismPresetId } from "../../mappings/naturalismPresets";
import type { PerformanceStateId } from "./naturalism/PerformanceStateDirector";

/** §P17 performance director settings. Developer-only; `null` is production. */
export interface PerformanceSettings {
  enabled: boolean;
  /** Multiplier on every state's face amplitudes. */
  intensity: number;
  /** Multiplier on every state's hold duration. */
  holdScale: number;
  /** Pin one state for review, bypassing the scheduler. */
  hold: PerformanceStateId | null;
}
import type { AvatarModelId } from "../../mappings/avatarModelConfig";
import type { BlendshapePose, HeadRotationTarget, IdleExpressionDebugState } from "../../types/facialAnimation";
import { clamp } from "../../utils/clamp";
import { smoothstep } from "../../utils/easing";
import { exponentialSmoothingAlpha } from "../../utils/lerp";
import { SeededRandom } from "../../utils/seededRandom";
import { HumanBehaviorController } from "./naturalism/HumanBehaviorController";
import type { PerformanceIntentFrame } from "../animation/SpeechPerformanceConductor";
import type { IdleEngagementConfig } from "./naturalism/IdleGazeEngagement";
import type { SpeechBoundaryProximity } from "../timeline/SpeechBoundaryTimeline";

/**
 * §P15 diagnostic expression intensity. Every field is a MULTIPLIER on an
 * existing amplitude, so all-1 reproduces P14 exactly and nothing new is
 * scheduled — the event architecture, spacing and randomness are untouched and
 * only how far each channel travels changes.
 *
 * Developer-only. `P15 MAX EXPRESSIONS` sets these; production leaves them at 1.
 */
export interface ExpressionIntensity {
  /** Corner (`mouthSmile*`) contribution of the speaking warmth pulse. */
  smile: number;
  /** Cheek (`cheekSquint*`) contribution, speaking and idle. */
  cheek: number;
  /** Eyelid support carried by warmth — the only channel that reaches the eyes. */
  eyelid: number;
  /** Overall speaking brow emphasis. */
  brow: number;
  /** `browInnerUp` share of that emphasis. */
  browInner: number;
  /** `browOuterUp*` share of that emphasis. */
  browOuter: number;
  /** Idle micro-expression amplitude. */
  idle: number;
  /** Left/right lead-to-follow spread. 1 keeps the shipped 0.94 follow ratio. */
  asymmetry: number;
  /** Expression attack rate. >1 is faster. */
  attack: number;
  /** Expression release rate. >1 is faster. */
  release: number;
}

export const neutralExpressionIntensity: ExpressionIntensity = {
  smile: 1, cheek: 1, eyelid: 1, brow: 1, browInner: 1, browOuter: 1, idle: 1, asymmetry: 1, attack: 1, release: 1
};

export const isNeutralExpressionIntensity = (v: ExpressionIntensity) =>
  (Object.keys(neutralExpressionIntensity) as (keyof ExpressionIntensity)[]).every((k) => v[k] === 1);

export interface IdleExpressionSettings {
  enabled: boolean;
  seed: string;
  frozen: boolean;
  intensity: number;
  blinkOnly: boolean;
  gazeOnly: boolean;
  microExpressionsOnly: boolean;
  headMotionOnly: boolean;
  selectedForcedEvent: IdleExpressionEventId;
  forceEventToken: number;
  /** Coordinated human behaviour layer. Only profiles that opt in are affected. */
  naturalismEnabled: boolean;
  naturalismPreset: NaturalismPresetId;
  silentBehaviorIntensity: number;
  speakingBehaviorIntensity: number;
  blinkEnabled: boolean;
  gazeEnabled: boolean;
  microExpressionsEnabled: boolean;
  headBehaviorEnabled: boolean;
  asymmetryEnabled: boolean;
  /** §P15 diagnostic amplitude multipliers. All 1 in production. */
  expressionIntensity: ExpressionIntensity;
  /**
   * §P16 idle presence override. `null` uses the preset's own value, which is
   * the neutral P15 block, so production is unaffected.
   */
  idlePresence: NaturalismPresenceConfig | null;
  /** §P17 performance director. `null` reproduces P16 exactly. */
  performance: PerformanceSettings | null;
  /** IDLE ENGAGEMENT. Viewer-anchored idle gaze; `null` keeps today's behaviour. */
  idleEngagement: IdleEngagementConfig | null;
  /** §P18. Overrides `speakingIdleFloor` on the resolved preset. `null` = preset value. */
  speakingIdleFloor: number | null;
  /** Model-specific safety scale for expression amplitude. Blink is exempt. */
  safetyScale: number;
  forceGazeShiftToken: number;
}

export const defaultIdleExpressionSettings: IdleExpressionSettings = {
  enabled: true,
  seed: "avatar-idle-2026",
  frozen: false,
  intensity: 1,
  blinkOnly: false,
  gazeOnly: false,
  microExpressionsOnly: false,
  headMotionOnly: false,
  selectedForcedEvent: "gentle-acknowledgment",
  forceEventToken: 0,
  naturalismEnabled: true,
  naturalismPreset: defaultNaturalismPresetId,
  silentBehaviorIntensity: 1,
  speakingBehaviorIntensity: 1,
  blinkEnabled: true,
  gazeEnabled: true,
  microExpressionsEnabled: true,
  headBehaviorEnabled: true,
  asymmetryEnabled: true,
  expressionIntensity: neutralExpressionIntensity,
  idlePresence: null,
  performance: null,
  idleEngagement: null,
  speakingIdleFloor: null,
  safetyScale: 1,
  forceGazeShiftToken: 0
};

interface BlinkEvent {
  start: number;
  close: number;
  hold: number;
  open: number;
  secondStart?: number;
  asymmetry: number;
}
interface GazeTarget {
  yawDegrees: number;
  pitchDegrees: number;
}
interface ActiveEvent {
  id: IdleExpressionEventId;
  start: number;
  entry: number;
  hold: number;
  exit: number;
}
interface EvaluateOptions {
  modelId: AvatarModelId;
  deltaSeconds: number;
  profile?: IdleExpressionProfile;
  settings: IdleExpressionSettings;
  speechActive: boolean;
  activePhoneme: boolean;
  manualFaceOverride: boolean;
  nativeVisemeDebugActive: boolean;
  expressionPreviewActive: boolean;
  headSupported: boolean;
  /** Speech envelope activity, used for phrase-level speaking emphasis. */
  speechEnergy?: number;
  /**
   * Channels the coordinated speech layer owns exclusively while speech is active.
   * Passed straight to the behaviour layer; undefined and empty both mean "nothing
   * is protected", which is the case for every model whose speech profile is off.
   */
  protectedChannels?: ReadonlySet<string>;
  /** Phrase-level side chosen by the coordinated speech layer. */
  speechAsymmetrySide?: "left" | "right" | "balanced";
  /** Hold this layer's head and neck still while speaking; see the behaviour layer. */
  stabilizeHeadDuringSpeech?: boolean;
  /**
   * Sentence/phrase boundary proximity, derived once per frame by `AvatarController`.
   *
   * Read only on the naturalism path. The legacy path below is the shipped
   * `miniface-male` idle behaviour and is deliberately left untouched — see the
   * model-scope decision in §10 of `docs/FEMALE_REALISM_REMEDIATION.md`.
   */
  speechBoundary?: SpeechBoundaryProximity;
  /**
   * FINAL CONVERGENCE. The one performance frame resolved for this clock, passed
   * straight through to the face and gaze consumers in `HumanBehaviorController`.
   */
  speechPerformance?: PerformanceIntentFrame | null;
  /** TALKINGHEAD SPEECH TEST. Eye direction from the upstream adapter. */
  talkingHeadGaze?: { yaw: number; pitch: number } | null;
  /** IDLE ENGAGEMENT. Viewer-anchored idle gaze; `null` is the previous behaviour. */
  idleEngagement?: IdleEngagementConfig | null;
}
interface IdleExpressionOutput {
  pose: BlendshapePose;
  head: HeadRotationTarget;
  neck: HeadRotationTarget;
  active: boolean;
  /** True when the coordinated layer owns speaking upper-face behaviour. */
  ownsSpeakingUpperFace: boolean;
  /** Gaze angles for the eye geometry path, in degrees. */
  gazeYawDegrees: number;
  gazePitchDegrees: number;
  debug: IdleExpressionDebugState;
}

const zeroHead = (): HeadRotationTarget => ({ pitch: 0, yaw: 0, roll: 0 });
const hashSeed = (seed: string) => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
const range = (random: SeededRandom, value: { min: number; max: number }) => random.range(value.min, value.max);
const addPose = (out: BlendshapePose, pose: BlendshapePose, weight: number) => {
  if (weight <= 0) return;
  for (const [name, value] of Object.entries(pose)) {
    if (name.startsWith("viseme_")) continue;
    out[name] = clamp((out[name] ?? 0) + value * weight);
  }
};
const scaleHead = (head: HeadRotationTarget | undefined, weight: number): HeadRotationTarget => ({
  pitch: (head?.pitch ?? 0) * weight,
  yaw: (head?.yaw ?? 0) * weight,
  roll: (head?.roll ?? 0) * weight
});
const addHead = (a: HeadRotationTarget, b: HeadRotationTarget): HeadRotationTarget => ({ pitch: a.pitch + b.pitch, yaw: a.yaw + b.yaw, roll: a.roll + b.roll });
const eventPhase = (event: ActiveEvent | undefined, time: number) => {
  if (!event) return { phase: "none" as const, weight: 0 };
  const local = time - event.start;
  if (local < 0) return { phase: "pending" as const, weight: 0 };
  if (local < event.entry) return { phase: "entry" as const, weight: smoothstep(0, event.entry, local) };
  if (local < event.entry + event.hold) return { phase: "hold" as const, weight: 1 };
  const exitTime = local - event.entry - event.hold;
  if (exitTime < event.exit) return { phase: "exit" as const, weight: 1 - smoothstep(0, event.exit, exitTime) };
  return { phase: "done" as const, weight: 0 };
};

export class IdleExpressionController {
  private random = new SeededRandom(1);
  private modelId: AvatarModelId = "miniface-male";
  private seed = "";
  private time = 0;
  private lastSpeechActive = false;
  private timeSinceSpeechEnded = 999;
  private blendWeight = 0;
  private blink?: BlinkEvent;
  private nextBlink = 0;
  private gaze: GazeTarget = { yawDegrees: 0, pitchDegrees: 0 };
  private gazeTarget: GazeTarget = { yawDegrees: 0, pitchDegrees: 0 };
  private nextGaze = 0;
  private activeEvent?: ActiveEvent;
  private nextEvent = 0;
  private forceEventToken = 0;
  private forcedBlinkFrames = 0;
  private breathCycleSeconds = 4.8;
  private driftCycleSeconds = 5;
  private driftPhase = 0;
  private human = new HumanBehaviorController();
  private humanPresetId: NaturalismPresetId = defaultNaturalismPresetId;
  private lastGazeShiftToken = 0;

  reset(modelId = this.modelId, seed = this.seed, time = 0) {
    this.modelId = modelId;
    this.seed = seed;
    this.random = new SeededRandom(hashSeed(`${modelId}:${seed}`));
    this.time = time;
    this.lastSpeechActive = false;
    this.timeSinceSpeechEnded = 999;
    this.blendWeight = 0;
    this.blink = undefined;
    this.gaze = { yawDegrees: 0, pitchDegrees: 0 };
    this.gazeTarget = { yawDegrees: 0, pitchDegrees: 0 };
    this.activeEvent = undefined;
    this.nextBlink = 0;
    this.nextGaze = 0;
    this.nextEvent = 0;
    this.forceEventToken = 0;
    this.forcedBlinkFrames = 0;
    const profile = idleExpressionProfiles[modelId];
    this.breathCycleSeconds = range(this.random, profile.breathing.cycleSeconds);
    this.driftCycleSeconds = range(this.random, profile.headMotion.driftCycleSeconds);
    this.driftPhase = this.random.range(0, Math.PI * 2);
    this.scheduleBlink(profile);
    this.scheduleGaze(profile);
    this.scheduleEvent(profile, true);
    this.lastGazeShiftToken = 0;
    // The coordinated layer always resets with the controller so model switches,
    // replays and remounts can never leave a stale timer or half-closed lid.
    this.human.reset(getNaturalismPreset(this.humanPresetId), `${modelId}:${seed}`, time);
  }

  forceBlink() {
    this.forcedBlinkFrames = 3;
    this.blink = undefined;
    this.nextBlink = this.time;
    this.human.forceBlink();
  }

  centerGaze() {
    this.gazeTarget = { yawDegrees: 0, pitchDegrees: 0 };
    this.nextGaze = this.time + 3;
    this.human.centerGaze(getNaturalismPreset(this.humanPresetId));
  }

  evaluate(options: EvaluateOptions): IdleExpressionOutput {
    const profile = options.profile ?? idleExpressionProfiles[options.modelId];
    const seed = options.settings.seed || defaultIdleExpressionSettings.seed;
    if (this.modelId !== options.modelId || this.seed !== seed) {
      const pendingForcedBlinkFrames = this.forcedBlinkFrames;
      this.reset(options.modelId, seed, 0);
      this.forcedBlinkFrames = Math.max(this.forcedBlinkFrames, pendingForcedBlinkFrames);
    }
    const delta = options.settings.frozen ? 0 : Math.min(Math.max(options.deltaSeconds, 0), 0.1);
    if (options.settings.naturalismPreset && options.settings.naturalismPreset !== this.humanPresetId) {
      this.humanPresetId = options.settings.naturalismPreset;
      this.human.reset(getNaturalismPreset(this.humanPresetId), `${this.modelId}:${seed}`, this.time);
    }
    if (profile.naturalism?.enabled && options.settings.naturalismEnabled !== false) {
      return this.evaluateNaturalism(options, profile, seed, delta);
    }
    this.time += delta;

    const hardBlocked = options.manualFaceOverride || options.nativeVisemeDebugActive || options.expressionPreviewActive || !options.settings.enabled || !profile.enabled;
    const speechActive = options.speechActive || options.activePhoneme;
    if (speechActive) this.timeSinceSpeechEnded = 0;
    else this.timeSinceSpeechEnded += delta;
    if (this.lastSpeechActive && !speechActive) this.scheduleEvent(profile, true);
    this.lastSpeechActive = speechActive;

    const targetWeight = hardBlocked ? 0 : 1;
    const transitionSeconds = targetWeight > this.blendWeight ? profile.transitions.speakingToIdleSeconds : profile.transitions.idleToSpeakingSeconds;
    const alpha = exponentialSmoothingAlpha(1 / Math.max(0.001, transitionSeconds), delta);
    this.blendWeight += (targetWeight - this.blendWeight) * alpha;
    if (this.blendWeight < 0.0001) this.blendWeight = 0;

    if (options.settings.forceEventToken !== this.forceEventToken) {
      this.forceEventToken = options.settings.forceEventToken;
      this.startEvent(profile, options.settings.selectedForcedEvent);
    }
    if (!hardBlocked) this.updateSchedules(profile, speechActive);

    const layers = this.layerWeights(options.settings, speechActive, profile);
    const intensity = clamp(options.settings.intensity) * clamp(options.settings.safetyScale ?? 1) * this.blendWeight;
    const pose: BlendshapePose = {};
    const breath = (Math.sin((this.time / this.breathCycleSeconds) * Math.PI * 2) + 1) * 0.5;
    const baselineWeight = layers.expression * intensity;
    addPose(pose, profile.baseline, baselineWeight);
    addPose(pose, { cheekSquintLeft: profile.breathing.cheekAmplitude * breath, cheekSquintRight: profile.breathing.cheekAmplitude * breath, eyeSquintLeft: profile.breathing.eyelidAmplitude * breath, eyeSquintRight: profile.breathing.eyelidAmplitude * breath }, baselineWeight);

    const rawBlinkValue = this.forcedBlinkFrames > 0 ? profile.blink.strength : this.blinkValue(profile);
    if (this.forcedBlinkFrames > 0) this.forcedBlinkFrames -= 1;
    const blinkValue = layers.blink * rawBlinkValue * intensity;
    if (blinkValue > 0) {
      pose.eyeBlinkLeft = Math.max(pose.eyeBlinkLeft ?? 0, clamp(blinkValue));
      pose.eyeBlinkRight = Math.max(pose.eyeBlinkRight ?? 0, clamp(this.blinkValue(profile, profile.blink.asymmetrySeconds) * layers.blink * intensity));
    }

    const gazeAlpha = exponentialSmoothingAlpha(profile.gaze.smoothingSpeed, delta);
    this.gaze.yawDegrees += (this.gazeTarget.yawDegrees - this.gaze.yawDegrees) * gazeAlpha;
    this.gaze.pitchDegrees += (this.gazeTarget.pitchDegrees - this.gaze.pitchDegrees) * gazeAlpha;
    const micro = Math.sin(this.time * 8.3 + this.driftPhase) * profile.gaze.microSaccade;
    this.writeGazePose(pose, profile, (this.gaze.yawDegrees + micro) * layers.gaze * intensity, this.gaze.pitchDegrees * layers.gaze * intensity);

    const phase = eventPhase(this.activeEvent, this.time);
    if (phase.phase === "done") this.activeEvent = undefined;
    const event = this.activeEvent ? profile.events[this.activeEvent.id] : undefined;
    const eventWeight = phase.weight * layers.expression * intensity;
    if (event) addPose(pose, event.pose, eventWeight);
    if (event?.gaze) this.writeGazePose(pose, profile, event.gaze.yawDegrees * eventWeight, event.gaze.pitchDegrees * eventWeight);

    const driftWeight = layers.head * intensity;
    const driftHead = this.driftHead(profile, breath, driftWeight);
    const eventHead = scaleHead(event?.head, eventWeight * profile.headMotion.eventScale);
    const head = options.headSupported && profile.headMotion.enabled ? addHead(driftHead, eventHead) : zeroHead();
    const neck = options.headSupported && profile.headMotion.enabled ? scaleHead(head, profile.headMotion.neckContribution) : zeroHead();
    const activeChannels = Object.entries(pose).filter(([, value]) => value > 0.0005).map(([name]) => name);
    return {
      pose,
      head,
      neck,
      active: this.blendWeight > 0.001 || Math.abs(head.pitch) + Math.abs(head.yaw) + Math.abs(head.roll) > 0.00001,
      ownsSpeakingUpperFace: false,
      gazeYawDegrees: this.gaze.yawDegrees * layers.gaze * intensity,
      gazePitchDegrees: this.gaze.pitchDegrees * layers.gaze * intensity,
      debug: {
        enabled: options.settings.enabled && profile.enabled,
        state: hardBlocked ? "blocked" : speechActive ? "speaking-reduced" : this.blendWeight > 0.95 ? "idle" : "transitioning",
        time: this.time,
        timeSinceSpeechEnded: this.timeSinceSpeechEnded,
        currentEvent: this.activeEvent?.id,
        eventPhase: phase.phase,
        nextEventInSeconds: Math.max(0, this.nextEvent - this.time),
        blinkPhase: this.blinkPhase(profile),
        nextBlinkInSeconds: Math.max(0, this.nextBlink - this.time),
        gazeTarget: { ...this.gazeTarget },
        headTarget: { ...head },
        neckTarget: { ...neck },
        blendWeight: this.blendWeight,
        randomSeed: `${options.modelId}:${seed}`,
        activeCanonicalChannels: activeChannels,
        layerWeights: layers,
        profileLabel: profile.label
      }
    };
  }

  /**
   * Coordinated human behaviour path.
   *
   * Blink, gaze, eye/head coordination, stillness, micro-expressions, resting
   * face and speaking upper-face emphasis are produced by one scheduler with one
   * seeded random source, then handed to the existing mixer and bone owner.
   */
  private evaluateNaturalism(
    options: EvaluateOptions,
    profile: IdleExpressionProfile,
    seed: string,
    delta: number
  ): IdleExpressionOutput {
    this.time += delta;
    const settings = options.settings;
    const basePreset = getNaturalismPreset(settings.naturalismPreset ?? defaultNaturalismPresetId);
    /**
     * §P16. A shallow override rather than a mutated preset: the preset objects
     * are module singletons shared by every model and every test, and writing
     * to one would leak a diagnostic configuration everywhere.
     */
    const withPresence = settings.idlePresence
      ? { ...basePreset, head: { ...basePreset.head, presence: settings.idlePresence } }
      : basePreset;
    const preset = settings.speakingIdleFloor === null || settings.speakingIdleFloor === undefined
      ? withPresence
      : { ...withPresence, head: { ...withPresence.head, speakingIdleFloor: settings.speakingIdleFloor } };
    const hardBlocked =
      options.manualFaceOverride ||
      options.nativeVisemeDebugActive ||
      options.expressionPreviewActive ||
      !settings.enabled ||
      !profile.enabled;
    const speechActive = options.speechActive || options.activePhoneme;
    if (speechActive) this.timeSinceSpeechEnded = 0;
    else this.timeSinceSpeechEnded += delta;

    if (settings.forceEventToken !== this.forceEventToken) {
      this.forceEventToken = settings.forceEventToken;
      this.human.forceEvent(preset, settings.selectedForcedEvent);
    }
    if ((settings.forceGazeShiftToken ?? 0) !== this.lastGazeShiftToken) {
      this.lastGazeShiftToken = settings.forceGazeShiftToken ?? 0;
      this.human.forceGazeShift(preset);
    }

    const exclusive = settings.blinkOnly || settings.gazeOnly || settings.microExpressionsOnly || settings.headMotionOnly;
    const toggles = {
      blink: (settings.blinkEnabled ?? true) && (!exclusive || settings.blinkOnly),
      gaze: (settings.gazeEnabled ?? true) && (!exclusive || settings.gazeOnly),
      microExpressions: (settings.microExpressionsEnabled ?? true) && (!exclusive || settings.microExpressionsOnly),
      headBehavior: (settings.headBehaviorEnabled ?? true) && (!exclusive || settings.headMotionOnly),
      asymmetry: settings.asymmetryEnabled ?? true
    };

    const output = this.human.update({
      deltaSeconds: delta,
      preset,
      profile,
      toggles,
      intensity: clamp(settings.intensity, 0, 2),
      safetyScale: clamp(settings.safetyScale ?? 1, 0, 2),
      silentIntensity: settings.silentBehaviorIntensity ?? 1,
      speakingIntensity: settings.speakingBehaviorIntensity ?? 1,
      speechActive,
      speechEnergy: options.speechEnergy ?? 0,
      headSupported: options.headSupported,
      blocked: hardBlocked,
      protectedChannels: options.protectedChannels,
      expressionIntensity: settings.expressionIntensity ?? neutralExpressionIntensity,
      performance: settings.performance ?? null,
      speechAsymmetrySide: options.speechAsymmetrySide,
      stabilizeHeadDuringSpeech: options.stabilizeHeadDuringSpeech,
      speechBoundary: options.speechBoundary,
      speechPerformance: options.speechPerformance ?? null,
      talkingHeadGaze: options.talkingHeadGaze ?? null,
      idleEngagement: settings.idleEngagement ?? null
    });

    const behaviour = output.debug;
    this.blendWeight = 1 - behaviour.speechTransitionWeight;
    return {
      pose: output.pose,
      head: output.head,
      neck: output.neck,
      active: output.active,
      ownsSpeakingUpperFace: !hardBlocked && output.ownsSpeakingUpperFace,
      gazeYawDegrees: hardBlocked ? 0 : output.gazeYawDegrees,
      gazePitchDegrees: hardBlocked ? 0 : output.gazePitchDegrees,
      debug: {
        enabled: settings.enabled && profile.enabled,
        state: hardBlocked
          ? "blocked"
          : behaviour.behaviorState === "speaking" || behaviour.behaviorState === "entering-speech"
            ? "speaking-reduced"
            : behaviour.behaviorState === "returning-to-listening"
              ? "transitioning"
              : "idle",
        time: this.time,
        timeSinceSpeechEnded: this.timeSinceSpeechEnded,
        currentEvent: behaviour.currentEvent,
        eventPhase: behaviour.currentEventPhase,
        nextEventInSeconds: behaviour.nextEventInSeconds,
        blinkPhase: behaviour.blink.phase,
        nextBlinkInSeconds: behaviour.blink.nextBlinkInSeconds,
        gazeTarget: { yawDegrees: behaviour.gaze.targetYawDegrees, pitchDegrees: behaviour.gaze.targetPitchDegrees },
        headTarget: { ...output.head },
        neckTarget: { ...output.neck },
        blendWeight: this.blendWeight,
        randomSeed: `${options.modelId}:${seed}`,
        activeCanonicalChannels: behaviour.activeCanonicalChannels,
        layerWeights: {
          blink: toggles.blink ? 1 : 0,
          gaze: toggles.gaze ? behaviour.gaze.amplitudeScale : 0,
          expression: toggles.microExpressions ? 1 - behaviour.speechTransitionWeight : 0,
          head: toggles.headBehavior
        ? 1 - behaviour.speechTransitionWeight * (1 - (options.stabilizeHeadDuringSpeech ? 0 : preset.head.speakingIdleContribution))
        : 0
        },
        profileLabel: profile.label,
        humanBehavior: behaviour
      }
    };
  }

  private layerWeights(settings: IdleExpressionSettings, speechActive: boolean, profile: IdleExpressionProfile) {
    const exclusive = settings.blinkOnly || settings.gazeOnly || settings.microExpressionsOnly || settings.headMotionOnly;
    const expressionBase = speechActive ? profile.transitions.speechReducedExpressionWeight : 1;
    const gazeBase = speechActive ? profile.transitions.speechReducedGazeWeight : 1;
    return {
      blink: !exclusive || settings.blinkOnly ? 1 : 0,
      gaze: !exclusive || settings.gazeOnly ? gazeBase : 0,
      expression: (!exclusive || settings.microExpressionsOnly) && !speechActive ? expressionBase : 0,
      head: (!exclusive || settings.headMotionOnly) && !speechActive ? 1 : 0
    };
  }

  private updateSchedules(profile: IdleExpressionProfile, speechActive: boolean) {
    if (this.time >= this.nextBlink && !this.blink) this.startBlink(profile);
    if (this.blink && this.time > this.blinkEnd(this.blink)) {
      this.blink = undefined;
      this.scheduleBlink(profile);
    }
    if (!speechActive && this.time >= this.nextGaze) this.scheduleGaze(profile);
    if (!speechActive && !this.activeEvent && this.time >= this.nextEvent && this.timeSinceSpeechEnded >= 1.5) {
      this.startEvent(profile, this.pickEvent(profile));
      this.scheduleEvent(profile, false);
    }
  }

  private scheduleBlink(profile: IdleExpressionProfile) {
    const useLong = this.random.next() < profile.blink.longIntervalProbability;
    this.nextBlink = this.time + range(this.random, useLong ? profile.blink.longInterval : profile.blink.interval);
  }

  private startBlink(profile: IdleExpressionProfile) {
    const close = range(this.random, profile.blink.close);
    const hold = range(this.random, profile.blink.hold);
    const open = range(this.random, profile.blink.open);
    const doubleBlink = this.random.next() < profile.blink.doubleBlinkProbability;
    this.blink = {
      start: this.time,
      close,
      hold,
      open,
      secondStart: doubleBlink ? this.time + close + hold + open + this.random.range(0.09, 0.18) : undefined,
      asymmetry: this.random.range(-profile.blink.asymmetrySeconds, profile.blink.asymmetrySeconds)
    };
  }

  private blinkEnd(blink: BlinkEvent) {
    const duration = blink.close + blink.hold + blink.open;
    return (blink.secondStart ?? blink.start) + duration;
  }

  private blinkValue(profile: IdleExpressionProfile, offset = 0) {
    if (!this.blink) return 0;
    const valueAt = (start: number) => {
      const local = this.time + offset - start;
      if (local < 0) return 0;
      if (local < this.blink!.close) return smoothstep(0, this.blink!.close, local) * profile.blink.strength;
      if (local < this.blink!.close + this.blink!.hold) return profile.blink.strength;
      const openLocal = local - this.blink!.close - this.blink!.hold;
      if (openLocal < this.blink!.open) return (1 - smoothstep(0, this.blink!.open, openLocal)) * profile.blink.strength;
      return 0;
    };
    return Math.max(valueAt(this.blink.start + this.blink.asymmetry), this.blink.secondStart ? valueAt(this.blink.secondStart + this.blink.asymmetry) : 0);
  }

  private blinkPhase(profile: IdleExpressionProfile) {
    if (this.forcedBlinkFrames > 0) return "forced";
    if (!this.blink) return "open";
    const local = this.time - this.blink.start;
    if (local < this.blink.close) return "closing";
    if (local < this.blink.close + this.blink.hold) return "hold";
    if (this.blinkValue(profile) > 0) return "opening";
    return "open";
  }

  private scheduleGaze(profile: IdleExpressionProfile) {
    if (this.random.next() < profile.gaze.centerProbability) this.gazeTarget = { yawDegrees: 0, pitchDegrees: 0 };
    else {
      const rare = this.random.next() < profile.gaze.rareProbability;
      this.gazeTarget = {
        yawDegrees: range(this.random, rare ? profile.gaze.rareYawDegrees : profile.gaze.yawDegrees),
        pitchDegrees: range(this.random, profile.gaze.pitchDegrees)
      };
    }
    this.nextGaze = this.time + range(this.random, profile.gaze.interval);
  }

  private writeGazePose(pose: BlendshapePose, profile: IdleExpressionProfile, yawDegrees: number, pitchDegrees: number) {
    const x = yawDegrees * profile.gaze.morphPerDegree * profile.gaze.yawSign;
    const y = pitchDegrees * profile.gaze.morphPerDegree * profile.gaze.pitchSign;
    const write = (name: string, value: number) => {
      const clamped = clamp(value);
      if (clamped > 0.0001) pose[name] = Math.max(pose[name] ?? 0, clamped);
    };
    write("eyeLookInLeft", Math.max(0, x));
    write("eyeLookOutRight", Math.max(0, x));
    write("eyeLookOutLeft", Math.max(0, -x));
    write("eyeLookInRight", Math.max(0, -x));
    write("eyeLookUpLeft", Math.max(0, y));
    write("eyeLookUpRight", Math.max(0, y));
    write("eyeLookDownLeft", Math.max(0, -y));
    write("eyeLookDownRight", Math.max(0, -y));
  }

  private scheduleEvent(profile: IdleExpressionProfile, settling: boolean) {
    this.nextEvent = this.time + range(this.random, settling ? profile.microExpressions.settlingDelay : profile.microExpressions.interval);
  }

  private pickEvent(profile: IdleExpressionProfile) {
    const total = idleExpressionEventIds.reduce((sum, id) => sum + profile.microExpressions.weights[id], 0);
    let cursor = this.random.range(0, total);
    for (const id of idleExpressionEventIds) {
      cursor -= profile.microExpressions.weights[id];
      if (cursor <= 0) return id;
    }
    return "neutral-reset";
  }

  private startEvent(profile: IdleExpressionProfile, id: IdleExpressionEventId) {
    const duration = range(this.random, profile.microExpressions.duration);
    const entry = Math.min(0.42, duration * 0.28);
    const exit = Math.min(0.58, duration * 0.34);
    const hold = Math.max(0.08, duration - entry - exit);
    this.activeEvent = { id, start: this.time, entry, hold, exit };
  }

  private driftHead(profile: IdleExpressionProfile, breath: number, weight: number): HeadRotationTarget {
    if (!profile.headMotion.enabled || weight <= 0) return zeroHead();
    const cycle = (this.time / this.driftCycleSeconds) * Math.PI * 2 + this.driftPhase;
    return {
      pitch: ((Math.sin(cycle) * profile.headMotion.pitchDegrees) + (breath - 0.5) * profile.breathing.headPitchDegrees) * Math.PI / 180 * weight,
      yaw: Math.sin(cycle * 0.63 + 1.7) * profile.headMotion.yawDegrees * Math.PI / 180 * weight,
      roll: Math.sin(cycle * 0.47 + 0.4) * profile.headMotion.rollDegrees * Math.PI / 180 * weight
    };
  }
}