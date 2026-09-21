import type { SpeakingMotionProfile } from "../animation/SpeakingGestureDirector";
import type { SpeechPerformancePlan } from "../animation/SpeechPerformancePlan";
import { silentPerformanceIntent, type ConductorTuning, type PerformanceIntentFrame, type PerformanceStateCharacter } from "../animation/SpeechPerformanceConductor";
import type { MotorTuning } from "../animation/SpeakingMotorController";
import type { TalkingHeadTuning } from "../animation/TalkingHeadSpeakingAdapter";
import type { HeadRotationTarget } from "../../types/facialAnimation";
import { avatarBoneConfig, degreesToRadians } from "../../mappings/avatarBlendshapeConfig";
import type { AvatarPayload, FacialCueType } from "../../types/avatarPayload";
import type {
  HeadMotionDebugState,
  HeadMotionPose,
  HeadNeckDiagnosticSettings,
  SpeechEnvelopeState
} from "../../types/facialAnimation";
import { evaluateHeadNeckDiagnostic } from "../animation/HeadNeckTransformDiagnostic";
import {
  baselineSpeakingHeadMotionConfig,
  candidateSpeakingHeadMotionConfigs,
  defaultSpeakingHeadMotionConfig,
  SpeakingHeadMotionController,
  withCenteredDrift,
  type SpeakingHeadMotionMode
} from "../animation/SpeakingHeadMotionController";

const zero = () => ({ pitch: 0, yaw: 0, roll: 0 });
const neutralSpeakingDebug = (enabled = true, seed = "none"): HeadMotionDebugState => ({
  enabled,
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
  idleBlendWeight: defaultSpeakingHeadMotionConfig.idleBlend.speaking,
  stillnessWeight: 0,
  phraseState: "none",
  emphasisState: "none",
  seed
});
export const neutralHeadMotion = (): HeadMotionPose => ({
  head: zero(),
  neck: zero(),
  active: false,
  manualActive: false,
  speaking: neutralSpeakingDebug()
});

type NaturalSpeakingMotionPreset = "baseline" | "candidate-a" | "candidate-b" | "candidate-c" | "accepted";

const configForPreset = (preset: NaturalSpeakingMotionPreset | undefined) => {
  if (preset === "baseline") return baselineSpeakingHeadMotionConfig;
  if (preset === "candidate-a") return candidateSpeakingHeadMotionConfigs.conservative;
  if (preset === "candidate-c") return candidateSpeakingHeadMotionConfigs.expressive;
  return candidateSpeakingHeadMotionConfigs.balanced;
};

/**
 * The centred variant is derived from whichever preset is selected, not hard-coded,
 * so the dev panel's four speaking-motion presets keep working on the corrected
 * model. Built once per (preset, mode) pair rather than per frame: `withCenteredDrift`
 * allocates, and `configure()` runs on every evaluate.
 */
const configCache = new Map<string, SpeakingHeadMotionConfigEntry>();
interface SpeakingHeadMotionConfigEntry {
  free: ReturnType<typeof configForPreset>;
  centered: ReturnType<typeof configForPreset>;
}
const configFor = (preset: NaturalSpeakingMotionPreset | undefined, mode: SpeakingHeadMotionMode) => {
  const key = preset ?? "accepted";
  let entry = configCache.get(key);
  if (!entry) {
    const free = configForPreset(preset);
    entry = { free, centered: withCenteredDrift(free) };
    configCache.set(key, entry);
  }
  return mode === "centered" ? entry.centered : entry.free;
};

interface ActiveCue {
  type: FacialCueType;
  intensity: number;
}

export class HeadMotionController {
  private lastPerformanceIntent: PerformanceIntentFrame = { ...silentPerformanceIntent };
  private speaking = new SpeakingHeadMotionController(defaultSpeakingHeadMotionConfig);
  private seed = "none";

  setPayload(payload: AvatarPayload) {
    /**
     * STREAMING COMPATIBILITY — SEED INPUT ONLY.
     *
     * The composed seed is stable for a static payload: `id`, `audio_url` and
     * `audio_duration` are all fixed once the file is loaded. It is NOT stable
     * for a live response, whose `audio_duration` grows as each audio chunk is
     * scheduled — every appended chunk would hash a different string and hand
     * the head-motion generators a different random field mid-sentence.
     *
     * A live producer therefore supplies `performance_seed`, fixed for the whole
     * turn. Nothing else changes: same hash, same generators, same amplitudes,
     * same timing, same distributions, same probabilities. A payload without the
     * field composes exactly the string it composed before.
     */
    this.seed = payload.performance_seed ?? `${payload.id}:${payload.audio_url}:${payload.audio_duration}`;
    this.speaking.setTimeline({
      seed: this.seed,
      phonemes: payload.phonemes,
      pauses: payload.pauses,
      durationSeconds: payload.audio_duration,
      // The utterance itself. This is what lets the performance be planned
      // before playback rather than inferred from audio after it starts.
      text: payload.text
    });
  }

  reset(reason = "manual") {
    this.speaking.reset(reason);
  }

  seek(time: number) {
    this.speaking.seek(time);
  }

  pause() {
    this.speaking.pause();
  }

  resume() {
    this.speaking.resume();
  }

  /** The conductor's live intent, so face and gaze can consume the SAME anchor. */
  performanceIntent() {
    return this.lastPerformanceIntent;
  }

  /**
   * The single resolve for a frame. See `SpeakingHeadMotionController.resolveIntent`.
   *
   * Called by `AvatarController` before any consumer runs; the resulting frame
   * is then handed to the face, the gaze and this controller's own head path.
   */
  resolvePerformanceIntent(clock: number, tuning: ConductorTuning, character?: PerformanceStateCharacter) {
    return this.speaking.resolveIntent(clock, tuning, character);
  }

  performancePlan() {
    return this.speaking.performancePlan();
  }

  /** Installs a live sentence-local conductor plan without resetting any motor. */
  setPerformancePlan(plan: SpeechPerformancePlan | null) {
    this.speaking.setPerformancePlan(plan);
  }

  /** Live motor state, prosody and handoff, for the panel and diagnostics. */
  motorState() {
    return this.speaking.motorState();
  }

  prosodyNow() {
    return this.speaking.prosodyNow();
  }

  motorHandoff() {
    return this.speaking.motorHandoff();
  }

  talkingHeadState() {
    return this.speaking.talkingHeadState();
  }

  evaluate(options: {
    time: number;
    deltaSeconds: number;
    durationSeconds: number;
    enabled: boolean;
    speakingEnabled: boolean;
    supported: boolean;
    intensity: number;
    envelope: SpeechEnvelopeState;
    activeCues: ActiveCue[];
    activeEmotionNames: string[];
    audioPlaying: boolean;
    paused: boolean;
    diagnostic?: HeadNeckDiagnosticSettings;
    naturalPreset?: NaturalSpeakingMotionPreset;
    /** Which procedural speaking head this model uses. Payload cues are unaffected. */
    speakingHeadMotion?: SpeakingHeadMotionMode;
    /** §P18 conversational speaking motion. `null` keeps the previous oscillator. */
    speakingMotionProfile?: SpeakingMotionProfile | null;
    /** FINAL CONVERGENCE conductor tuning. `null` keeps the P18.2 director. */
    conductorTuning?: ConductorTuning | null;
    /** The §P17 state character colouring this frame's anchors. */
    performanceCharacter?: PerformanceStateCharacter | null;
    /** The frame already resolved for this clock and shared with face and gaze. */
    performanceIntent?: PerformanceIntentFrame | null;
    /** FINAL MOTOR SPEECH. When set, the head is integrated rather than eased. */
    motorTuning?: MotorTuning | null;
    /** Orientation and angular velocity handed over by the idle layer at onset. */
    motorAdopt?: { orientation: HeadRotationTarget; velocity: HeadRotationTarget } | null;
    /** TALKINGHEAD SPEECH TEST. Sole speaking head authority when set. */
    talkingHeadTuning?: TalkingHeadTuning | null;
  }): HeadMotionPose {
    const mode = options.speakingHeadMotion ?? "free";
    this.speaking.configure(configFor(options.naturalPreset, mode));
    if (!options.supported) return neutralHeadMotion();

    if (options.diagnostic?.enabled) {
      const diagnostic = evaluateHeadNeckDiagnostic(options.diagnostic, options.time);
      return {
        active: true,
        manualActive: false,
        diagnosticActive: true,
        head: diagnostic.requestedHead,
        neck: diagnostic.requestedNeck,
        speaking: neutralSpeakingDebug(false, this.seed),
        diagnostic
      };
    }

    const manual = this.manualMotion(options.activeCues);
    if (manual.active) return manual;

    if (!options.enabled || !options.speakingEnabled) {
      return { ...neutralHeadMotion(), speaking: neutralSpeakingDebug(options.speakingEnabled, this.seed) };
    }

    const emotionScale = options.activeEmotionNames.some((name) => name === "calm" || name === "sad")
      ? 0.72
      : options.activeEmotionNames.some((name) => name === "happy" || name === "surprised")
        ? 1.08
        : 1;
    const speechActive = options.audioPlaying && options.time > 0 && options.time < options.durationSeconds;
    const output = this.speaking.update({
      deltaSeconds: options.deltaSeconds,
      audioTimeSeconds: options.time,
      durationSeconds: options.durationSeconds,
      speechActive,
      paused: options.paused,
      seed: this.seed,
      speechActivity: options.envelope.speechActivity,
      audioEnergy: options.envelope.speechActivity * emotionScale * options.intensity,
      // Gated here rather than by skipping `update()`, so the controller keeps
      // advancing its own bookkeeping and stays ready to be re-enabled.
      stabilize: mode === "stabilized",
      speakingMotionProfile: options.speakingMotionProfile ?? null,
      conductorTuning: options.conductorTuning ?? null,
      performanceCharacter: options.performanceCharacter ?? null,
      performanceIntent: options.performanceIntent ?? null,
      motorTuning: options.motorTuning ?? null,
      motorAdopt: options.motorAdopt ?? null,
      talkingHeadTuning: options.talkingHeadTuning ?? null
    });
    this.lastPerformanceIntent = this.speaking.performanceIntent();
    return {
      active: output.weight > 0,
      manualActive: false,
      head: output.head,
      neck: output.neck,
      /**
       * The motor path owns the bone's derivatives, so its composed pose goes
       * through the third-order follower. TALKINGHEAD deliberately does NOT:
       * adding our jerk limiter to it would change the very motion character the
       * A/B exists to judge, so it keeps the first-order smoothing upstream's
       * own output would meet.
       */
      jerkLimited: Boolean(options.motorTuning) && !options.talkingHeadTuning,
      speaking: output.debug
    };
  }

  private manualMotion(cues: ActiveCue[]): HeadMotionPose {
    const cfg = avatarBoneConfig.manual;
    const out = neutralHeadMotion();
    for (const cue of cues) {
      const amount = cue.intensity;
      if (cue.type === "head_nod") {
        out.head.pitch += degreesToRadians(cfg.headPitchDeg) * amount;
        out.neck.pitch += degreesToRadians(cfg.neckPitchDeg) * amount;
      }
      if (cue.type === "head_tilt_left") {
        out.head.roll += degreesToRadians(cfg.headRollDeg) * amount;
        out.neck.roll += degreesToRadians(cfg.neckRollDeg) * amount;
      }
      if (cue.type === "head_tilt_right") {
        out.head.roll -= degreesToRadians(cfg.headRollDeg) * amount;
        out.neck.roll -= degreesToRadians(cfg.neckRollDeg) * amount;
      }
      if (cue.type === "look_left") {
        out.head.yaw += degreesToRadians(cfg.headYawDeg) * 0.35 * amount;
        out.neck.yaw += degreesToRadians(cfg.neckYawDeg) * 0.35 * amount;
      }
      if (cue.type === "look_right") {
        out.head.yaw -= degreesToRadians(cfg.headYawDeg) * 0.35 * amount;
        out.neck.yaw -= degreesToRadians(cfg.neckYawDeg) * 0.35 * amount;
      }
    }
    out.active = Math.abs(out.head.pitch) + Math.abs(out.head.yaw) + Math.abs(out.head.roll) + Math.abs(out.neck.pitch) + Math.abs(out.neck.yaw) + Math.abs(out.neck.roll) > 0;
    out.manualActive = out.active;
    out.speaking = neutralSpeakingDebug(true, this.seed);
    return out;
  }
}
