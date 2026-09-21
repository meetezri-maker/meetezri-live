import { clamp } from "../../utils/clamp";
import { resolveFacialCuePose } from "../../mappings/facialCueToBlendshape";
import { avatarModelConfigs, type AvatarModelId } from "../../mappings/avatarModelConfig";
import { getPhonemeProfile } from "../../mappings/phonemeToBlendshape";
import type { SupportedPhoneme } from "../../mappings/phonemeAliases";
import { neutralSpeechProfile } from "../../mappings/neutralSpeechProfile";
import type { AvatarPayload, FacialCueType } from "../../types/avatarPayload";
import type {
  BlendshapePose,
  ChannelPose,
  HeadMotionPose,
  HeadNeckDiagnosticSettings,
  PhonemePoseDefinition,
  PhonemeTuningOverrides,
  TimelineDebugState
} from "../../types/facialAnimation";
import { HeadMotionController } from "../behaviour/HeadMotionController";
import { IdleExpressionController, defaultIdleExpressionSettings, type IdleExpressionSettings } from "../behaviour/IdleExpressionController";
import { idleExpressionProfiles } from "../../mappings/idleExpressionProfiles";
import { SpeechGestureController } from "../behaviour/SpeechGestureController";
import { EmotionEngine } from "../emotion/EmotionEngine";
import { CoarticulationEngine } from "../lipsync/CoarticulationEngine";
import { normalizePhoneme } from "../lipsync/PhonemeNormalizer";
import { SpeechEnvelope } from "../lipsync/SpeechEnvelope";
import { TimelineCursor } from "../timeline/TimelineCursor";
import { SpeechBoundaryTimeline } from "../timeline/SpeechBoundaryTimeline";
import { FacialPoseMixer } from "./FacialPoseMixer";
import {
  CoordinatedSpeechDeformationController,
  applySpeechDeformationSettings,
  defaultSpeechDeformationSettings,
  type SpeechDeformationMode,
  type SpeechDeformationSettings
} from "../animation/CoordinatedSpeechDeformationController";
import { deriveTransitionIntent } from "../lipsync/SpeechTransitionIntent";
import { coordinatedOwnedChannels, getSpeechDeformationProfile } from "../../mappings/speechDeformationProfiles";
import type { SpeakingMotionProfile } from "../animation/SpeakingGestureDirector";
import { defaultStateCharacter, stateCharacters, type ConductorTuning, type PerformanceIntentFrame } from "../animation/SpeechPerformanceConductor";
import type { MotorOutput, MotorTuning } from "../animation/SpeakingMotorController";
import type { TalkingHeadOutput, TalkingHeadTuning } from "../animation/TalkingHeadSpeakingAdapter";
import type { ProsodyFrame } from "../animation/SpeechProsody";
import type { HeadRotationTarget } from "../../types/facialAnimation";
import type { SpeechPerformancePlan } from "../animation/SpeechPerformancePlan";
import type { PerformanceStateId } from "../behaviour/naturalism/PerformanceStateDirector";

export interface AvatarFrameState {
  targetPose: BlendshapePose;
  outputPose: BlendshapePose;
  headMotion: HeadMotionPose;
  /**
   * FINAL CONVERGENCE. The one shared performance frame this tick was built
   * from, or `null` when the conductor is off. Surfaced so the review panel can
   * show that head, neck, gaze and face are reading the same anchor rather than
   * asserting it.
   */
  performanceIntent: PerformanceIntentFrame | null;
  performancePlan: SpeechPerformancePlan | null;
  /** FINAL MOTOR SPEECH: live motor state and the prosody that shaped it. */
  motor: MotorOutput | null;
  prosody: ProsodyFrame | null;
  /** TALKINGHEAD SPEECH TEST: live adapter output, or null when inactive. */
  talkingHead: TalkingHeadOutput | null;
  /** Gaze angles for the eye geometry path, in degrees. */
  gazeYawDegrees: number;
  gazePitchDegrees: number;
  debug: TimelineDebugState;
  channels: ChannelPose[];
  /**
   * Structural drive signals for the lower-face bone prototype.
   *
   * Produced here rather than in the renderer so the bones read the same
   * per-frame value the morphs do, from the same coarticulation weights, with no
   * clock or smoothing of their own. In `morph-only` nothing consumes it.
   */
  lowerFaceIntent: LowerFaceIntent;
}

export interface LowerFaceIntent {
  /**
   * Bilabial closure demand, 0..1: the coordinated layer's overlap-resolved
   * closure envelope multiplied by the bilabial share of the coarticulation
   * weights.
   *
   * The envelope supplies the anticipation and the release shaping that §14
   * already tuned; the share makes it exactly zero on every non-bilabial, so an
   * F or a T cannot drive it however hard it constricts.
   */
  bilabialClosure: number;
  /** The unshaped share, kept separate so a diagnostic can tell the two apart. */
  bilabialShare: number;
  /** The resolved closure envelope before the bilabial gate. */
  closureEnvelope: number;
}

interface ActiveCueState {
  type: FacialCueType;
  intensity: number;
}

interface EvaluateOptions {
  modelId?: AvatarModelId;
  idleExpressionSettings?: IdleExpressionSettings;
  nativeVisemeDebugActive?: boolean;
  headSupported?: boolean;
  playbackActive?: boolean;
  debugPose?: BlendshapePose;
  debugCue?: FacialCueType;
  calibrationEnabled?: boolean;
  speakingHeadMotionEnabled?: boolean;
  audioPlaying?: boolean;
  paused?: boolean;
  transformDiagnostic?: HeadNeckDiagnosticSettings;
  naturalSpeakingMotionPreset?: "baseline" | "candidate-a" | "candidate-b" | "candidate-c" | "accepted";
  /** §P18 conversational speaking motion. `null` keeps the previous oscillator. */
  speakingMotionProfile?: SpeakingMotionProfile | null;
  /** FINAL CONVERGENCE conductor tuning. `null` keeps the P18.2 director. */
  conductorTuning?: ConductorTuning | null;
  /** Live sentence-local conductor plan; absent preserves the static path. */
  livePerformancePlan?: SpeechPerformancePlan | null;
  /** Sentence-local audio clock for that plan; lip sync keeps response time. */
  livePerformanceClock?: number;
  /** FINAL MOTOR SPEECH. When set, the head is integrated rather than eased. */
  motorTuning?: MotorTuning | null;
  /** TALKINGHEAD SPEECH TEST. When set, the upstream adapter owns head and gaze. */
  talkingHeadTuning?: TalkingHeadTuning | null;
  /** "legacy" bypasses the coordinated layer for A/B comparison. */
  speechDeformationMode?: SpeechDeformationMode;
  /** Dev-panel global scalar for the coordinated layer. */
  speechDeformationStrength?: number;
  /** Deterministic seed for speech asymmetry. */
  speechDeformationSeed?: number;
  /** Dev-panel overrides. Undefined in production. */
  speechDeformationSettings?: SpeechDeformationSettings;
  /**
   * SPEECH / PHONEME TUNING — live per-phoneme morph overrides from the dev
   * panel. Undefined or empty in production, and empty is a STRICT NO-OP: the
   * shipped profile object is returned by identity, so no allocation, no pose
   * change and no timing change occurs. See `resolveSpeechProfile`.
   */
  phonemeTuningOverrides?: PhonemeTuningOverrides;
}

const emptyPose: BlendshapePose = {};
const emptyWeights = {
  previous: 0,
  current: 0,
  next: 0,
  previousContribution: 0,
  currentContribution: 0,
  nextContribution: 0,
  effectiveLookBehind: 0,
  effectiveLookAhead: 0,
  closurePreservation: false
};
const neutralEnvelope = {
  phonemeActivation: 0,
  jawEnergy: 0,
  lipEnergy: 0,
  speechActivity: 0,
  pauseActivity: 0
};

const clearPose = (pose: BlendshapePose) => {
  for (const key in pose) delete pose[key];
};
const hasPoseValues = (pose?: BlendshapePose) => {
  if (!pose) return false;
  for (const key in pose) if (pose[key] > 0) return true;
  return false;
};

export class AvatarController {
  private cursor: TimelineCursor;
  /** Built once per payload; queried once per frame alongside the other derivations. */
  private speechBoundaries: SpeechBoundaryTimeline;
  private coarticulation = new CoarticulationEngine();
  private envelope = new SpeechEnvelope();
  private emotions = new EmotionEngine();
  private mixer = new FacialPoseMixer();
  private headMotion = new HeadMotionController();
  private idleExpression = new IdleExpressionController();
  private cuesPose: BlendshapePose = {};
  private activeCues: ActiveCueState[] = [];
  private debugActiveCueTypes: string[] = [];
  /** Protected channels a cue asked for and did not get. Reused; never reallocated. */
  private suppressedCueChannels: string[] = [];
  /**
   * SPEECH / PHONEME TUNING — memoized merge of the shipped profile with the dev
   * panel's live overrides. Keyed on the identity of BOTH inputs, so the merge
   * happens once per edit rather than once per frame.
   */
  private tunedProfileCache?: {
    base: Partial<Record<SupportedPhoneme, PhonemePoseDefinition>>;
    overrides: PhonemeTuningOverrides;
    merged: Partial<Record<SupportedPhoneme, PhonemePoseDefinition>>;
  };
  private channels: ChannelPose[] = [
    { channel: "rest", pose: emptyPose },
    { channel: "emotion", pose: emptyPose },
    { channel: "facialCue", pose: this.cuesPose },
    { channel: "blink", pose: emptyPose },
    { channel: "gaze", pose: emptyPose },
    { channel: "speechGesture", pose: emptyPose },
    { channel: "idle", pose: emptyPose },
    { channel: "lipsync", pose: emptyPose },
    { channel: "debug", pose: emptyPose }
  ];
  speechGesture = new SpeechGestureController();
  /**
   * Coordinated speech deformation. Sits between coarticulation and the mixer, so
   * the canonical flow is unchanged and MorphTargetController stays the sole writer.
   */
  speechDeformation = new CoordinatedSpeechDeformationController();
  /** Built once: the mixer consults it every frame, so it must not be reallocated. */
  private ownedSpeechChannels: ReadonlySet<string> = new Set(coordinatedOwnedChannels);
  /**
   * Last frame's phrase-level warmth, handed forward to the coordinated layer
   * (§P14).
   *
   * One frame late by construction: the behaviour layer runs after the speech
   * layer, and reordering them would mean the behaviour layer could no longer
   * read `asymmetrySide` from the speech layer — a real dependency, against a
   * 16.7 ms lag on a pulse whose attack is 270-600 ms. The lag is not
   * perceptible and the alternative is a circular dependency.
   */
  private carriedWarmth: { smile: number; cheek: number; lowerFace: number } = { smile: 0, cheek: 0, lowerFace: 0 };
  /** Last frame's §P17 state, colouring the next frame's shared resolve. */
  private lastPerformanceState: PerformanceStateId = "ATTENTIVE_NEUTRAL";
  /**
   * FINAL MOTOR SPEECH. Last frame's COMPOSED head pose and its finite-difference
   * velocity, handed to the motor at speech onset so it continues the trajectory
   * the idle layer was already on instead of starting an animation from rest.
   */
  private lastComposedHead: HeadRotationTarget = { pitch: 0, yaw: 0, roll: 0 };
  private lastComposedVelocity: HeadRotationTarget = { pitch: 0, yaw: 0, roll: 0 };
  /**
   * TALKINGHEAD SPEECH TEST. Last frame's adapter gaze.
   *
   * One frame stale by construction: the adapter runs inside the head-motion
   * evaluation, which is after the behaviour layer that consumes its gaze. At
   * 60 Hz that is 16 ms against upstream's own eye-morph smoother, whose time
   * constant is an order of magnitude longer.
   */
  private lastTalkingHeadGaze: { yaw: number; pitch: number } | null = null;
  unknownPhonemes: Record<string, number> = {};

  constructor(private payload: AvatarPayload) {
    this.cursor = new TimelineCursor(payload);
    this.speechBoundaries = new SpeechBoundaryTimeline(payload);
    this.headMotion.setPayload(payload);
  }

  /**
   * Streaming timeline retarget. Lip sync and authored cues see appended data,
   * while every stateful motion controller keeps its current trajectory.
   */
  setLivePayload(payload: AvatarPayload) {
    this.payload = payload;
    this.cursor.setPayload(payload);
    this.speechBoundaries = new SpeechBoundaryTimeline(payload);
  }

  setPayload(payload: AvatarPayload) {
    this.payload = payload;
    // Retarget rather than rebuild: a live response hands over a new payload
    // object every time a chunk is appended, and a fresh cursor would drop its
    // index and re-walk the whole reply on the next frame.
    this.cursor.setPayload(payload);
    this.speechBoundaries = new SpeechBoundaryTimeline(payload);
    this.headMotion.setPayload(payload);
    this.reset();
  }

  reset(time = 0) {
    this.mixer.reset();
    this.coarticulation.reset();
    this.idleExpression.reset(undefined, undefined, time);

    this.headMotion.reset();
    clearPose(this.cuesPose);
    this.activeCues.length = 0;
    this.debugActiveCueTypes.length = 0;
    this.suppressedCueChannels.length = 0;
    this.unknownPhonemes = {};
    // A carried value is one frame of state; a seek must not deliver the warmth
    // of the frame before the jump.
    this.carriedWarmth = { smile: 0, cheek: 0, lowerFace: 0 };
    this.lastPerformanceState = "ATTENTIVE_NEUTRAL";
    this.lastComposedHead = { pitch: 0, yaw: 0, roll: 0 };
    this.lastComposedVelocity = { pitch: 0, yaw: 0, roll: 0 };
    this.lastTalkingHeadGaze = null;
  }

  forceBlink(_time: number) {
    this.idleExpression.forceBlink();
  }

  centerGaze() {
    this.idleExpression.centerGaze();
  }

  /**
   * The profile to articulate with, given the dev panel's live overrides.
   *
   * **No overrides means the SAME OBJECT back.** That is the contract this whole
   * feature rests on: with the tuning panel untouched — which is every
   * production run — nothing is allocated, nothing is copied, and the shipped
   * `phonemeToBlendshape` table reaches the coarticulation engine by identity.
   *
   * With overrides, each named phoneme gets a shallow-merged `pose` and every
   * other field (`attack`, `release`, `coarticulationBefore/After`,
   * `defaultIntensity`, `viseme`) is carried through untouched — the panel edits
   * morph WEIGHTS, not phoneme logic. The source tables are never mutated, so
   * RESET is just dropping the overrides.
   *
   * A DIPHTHONG'S GLIDE ENDS TAKE THE OVERRIDE TOO. `glidingPose` reads
   * `onsetPose`/`offglidePose` INSTEAD of `pose` on the five phonemes that
   * declare them, so merging into `pose` alone would leave the tuning panel
   * silently dead on exactly those five. Overriding a channel pins it at BOTH
   * ends, which is what dragging a slider to a value means: that channel stops
   * gliding and holds the value, and every channel the reviewer did not touch
   * keeps its trajectory.
   */
  private resolveSpeechProfile(
    base: Partial<Record<SupportedPhoneme, PhonemePoseDefinition>>,
    overrides?: PhonemeTuningOverrides
  ): Partial<Record<SupportedPhoneme, PhonemePoseDefinition>> {
    if (!overrides) return base;
    const names = Object.keys(overrides);
    if (names.length === 0) return base;
    const cached = this.tunedProfileCache;
    if (cached && cached.base === base && cached.overrides === overrides) return cached.merged;
    const merged: Partial<Record<SupportedPhoneme, PhonemePoseDefinition>> = { ...base };
    for (const name of names) {
      const definition = base[name as SupportedPhoneme];
      if (!definition) continue;
      merged[name as SupportedPhoneme] = {
        ...definition,
        pose: { ...definition.pose, ...overrides[name] },
        ...(definition.onsetPose && definition.offglidePose
          ? {
              onsetPose: { ...definition.onsetPose, ...overrides[name] },
              offglidePose: { ...definition.offglidePose, ...overrides[name] }
            }
          : null)
      };
    }
    this.tunedProfileCache = { base, overrides, merged };
    return merged;
  }

  evaluate(time: number, deltaSeconds: number, options: EvaluateOptions = {}): AvatarFrameState {
    const playbackActive = options.playbackActive ?? true;
    // Resolved before the emotion and cue channels are built: both consult it to
    // substitute poses whose canonical channel is dead on this model.
    const modelId = options.modelId ?? "miniface-male";
    /**
     * Which procedural head this model uses while speaking (per-model, §8/§15).
     *
     * Two procedural writers reach the head: `SpeakingHeadMotionController` through
     * `HeadMotionController`, and `HumanBehaviorController` through
     * `IdleExpressionController`, whose outputs are summed below. Any mode other
     * than `free` hands the head to the speaking layer alone by holding the idle
     * layer's contribution at zero, so the two can never each own a share of it —
     * that is the same single-owner rule §8 established, kept intact now that the
     * speaking layer moves again. Payload head cues (`head_nod`, `head_tilt_*`,
     * `look_*`) are deliberately NOT gated: they are authored instructions, and
     * `HeadMotionController.manualMotion` returns before the speaking layer anyway.
     */
    const speakingHeadMotion = avatarModelConfigs[modelId].speakingHeadMotion ?? "free";
    const stabilizeIdleHead = speakingHeadMotion !== "free";

    // Each model articulates with poses authored for its own face. Calibration-off
    // still bypasses both, so the neutral A/B reference is unchanged.
    const speechProfile = this.resolveSpeechProfile(
      options.calibrationEnabled === false ? neutralSpeechProfile : getPhonemeProfile(modelId),
      options.phonemeTuningOverrides
    );
    const t = this.cursor.seek(time);
    const current = playbackActive ? this.cursor.activePhoneme(t) : undefined;
    const previous = playbackActive ? this.cursor.previousPhoneme(t) : undefined;
    const next = playbackActive ? this.cursor.nextPhoneme(t) : undefined;
    const pause = playbackActive ? this.cursor.activePause(t) : undefined;
    const normalized = current ? normalizePhoneme(current.phoneme) : undefined;
    if (current && !normalized)
      this.unknownPhonemes[current.phoneme] = (this.unknownPhonemes[current.phoneme] ?? 0) + 1;
    const currentDef = normalized ? speechProfile[normalized] : undefined;
    const intensity = current?.intensity ?? 0;
    const lip = playbackActive
      ? this.payload.behaviour.coarticulation
        ? this.coarticulation.blend({
            time: t,
            current,
            previous,
            next,
            windowSeconds: this.payload.behaviour_settings.coarticulation_window,
            profile: speechProfile
          })
        : {
            pose: currentDef?.pose ?? emptyPose,
            weights: {
              previous: 0,
              current: current ? 1 : 0,
              next: 0,
              previousContribution: 0,
              currentContribution: current ? intensity * (currentDef?.defaultIntensity ?? 0) : 0,
              nextContribution: 0,
              currentPhoneme: current?.phoneme,
              dominantPhoneme: current?.phoneme,
              effectiveLookBehind: 0,
              effectiveLookAhead: 0,
              closurePreservation: false
            }
          }
      : { pose: emptyPose, weights: emptyWeights };
    const envelope = playbackActive
      ? this.envelope.evaluate(lip.pose, Boolean(current), Boolean(pause))
      : neutralEnvelope;
    // --- coordinated speech deformation -----------------------------------
    // Runs on the canonical phoneme pose the CoarticulationEngine produced, before
    // any mixing. It consumes the engine's own timestamp-bounded weights, so it
    // adds no timing of its own.
    //
    // Evaluated here, ahead of the emotion and idle channels, because both of those
    // now need what it decides: which channels are off limits while speech owns
    // them, and which side the phrase leans. Safe to move: its inputs are the
    // phoneme pose, the coarticulation weights, the envelope, the cursor time and
    // the options — nothing derived from the emotion, cue or idle output. Verified
    // by reading `CoordinatedSpeechDeformationController.evaluate()` rather than
    // assumed; the reverse dependency is the new one.
    const speechSettings = options.speechDeformationSettings ?? defaultSpeechDeformationSettings;
    const speechProfileForModel = applySpeechDeformationSettings(
      getSpeechDeformationProfile(modelId),
      speechSettings
    );
    // Debug-only phoneme override. It substitutes the POSE and the derived intent
    // only; the timeline, the audio clock and the phoneme timestamps are never
    // touched, so this cannot alter playback timing.
    const forced = options.speechDeformationSettings?.forcedPhoneme ?? null;
    const forcedDefinition = forced ? speechProfile[normalizePhoneme(forced) ?? "SIL"] : undefined;
    const effectiveLipPose = forcedDefinition ? forcedDefinition.pose : lip.pose;
    const transitionIntent = forcedDefinition
      ? deriveTransitionIntent({
          ...lip.weights,
          previousPhoneme: "SIL",
          currentPhoneme: forced ?? undefined,
          nextPhoneme: undefined,
          previousContribution: 0,
          currentContribution: 1,
          nextContribution: 0,
          dominantPhoneme: forced ?? undefined
        })
      : deriveTransitionIntent(lip.weights);
    const speaking = Boolean(forcedDefinition) || Boolean(current) || envelope.speechActivity > 0.03;
    // Freeze frame holds the last evaluated pose by advancing zero time, so the
    // panel can inspect one frame without the controller settling toward neutral.
    const frozen = Boolean(options.speechDeformationSettings?.freezeFrame);
    const coordinated = this.speechDeformation.evaluate({
      phonemePose: effectiveLipPose,
      previousPhoneme: forcedDefinition ? null : previous?.phoneme ?? null,
      currentPhoneme: forcedDefinition ? forced : current?.phoneme ?? null,
      nextPhoneme: next?.phoneme ?? null,
      phonemeProgress: lip.weights.current,
      speechEnergy: envelope.speechActivity,
      phraseProgress: t,
      isSpeaking: speaking,
      deltaSeconds: frozen ? 0 : deltaSeconds,
      seed: options.speechDeformationSeed ?? speechSettings.seed,
      transitionIntent,
      profile: speechProfileForModel,
      mode: options.speechDeformationMode ?? speechSettings.mode,
      strength: options.speechDeformationStrength ?? speechSettings.strength,
      expressionWarmth: this.carriedWarmth
    });
    const coordinatedActive =
      speechProfileForModel.enabled && (options.speechDeformationMode ?? speechSettings.mode) === "coordinated";
    // Channels the coordinated layer damped itself must skip the mixer's damping —
    // and, since this pass, are also the channels no other layer may write while
    // speech is running. `minifaceMaleSpeechProfile` is disabled and declares no
    // supported channels, so this stays undefined for the male avatar and every
    // downstream guard is a no-op there.
    const ownedChannels = coordinatedActive ? this.ownedSpeechChannels : undefined;
    // "balanced" while the layer is off, in legacy mode or between phrases, which is
    // exactly when the behaviour layer should keep choosing its own side.
    const speechAsymmetrySide = coordinatedActive ? coordinated.debug.asymmetrySide : "balanced";

    const emotion = playbackActive
      ? this.emotions.blend(this.payload.emotions, t, modelId, {
          protectedChannels: ownedChannels,
          isSpeaking: speaking
        })
      : { pose: emptyPose, active: [] };

    clearPose(this.cuesPose);
    this.activeCues.length = 0;
    this.suppressedCueChannels.length = 0;
    if (playbackActive) {
      for (const cue of this.payload.facial_cues) {
        if (t >= cue.start_time && t < cue.end_time) this.addCue(cue.type, cue.intensity, modelId);
      }
    }
    if (options.debugCue) this.addCue(options.debugCue, 1, modelId);
    // Facial cues obey the same speech-channel exclusivity as emotions.
    //
    // A cue is an explicit instruction from the payload author, which is why the
    // previous pass left it unarbitrated while fixing the emotion and behaviour
    // layers. Leaving it there was never the answer, only a deferral: `full_smile`
    // pins mouthSmile* at its authored value through every phoneme in its window —
    // measured at 0.19 on IH, AH, NG and silence alike — so the mouth holds a shape
    // unrelated to what is being articulated, which is the exact defect this whole
    // pass exists to remove. Being author-specified makes it *more* visible, not
    // less wrong.
    //
    // The rule: a cue keeps its full authored strength whenever the avatar is not
    // speaking, and is zeroed on protected channels while it is. Outside speech
    // there is no competing articulation, so the instruction stands unmodified;
    // inside speech the coordinated layer is the single owner of these channels.
    // Same protected set, same binary zero and same gate as `protectLipsync`
    // emotions — deliberately not a second, softer notion of "protected", because
    // the value of this contract is that there is exactly one of them.
    //
    // What that costs, recorded rather than glossed: on female, `full_smile`,
    // `small_smile`, `lip_press` and `cheek_raise` write nothing but protected
    // channels, so they render nothing at all during speech. `brow_lower` and
    // `eye_squint` join them on this model only, because their female overrides are
    // re-pointed onto cheekSquint/noseSneer/mouthPress (the asset has no
    // brow-depression geometry) — on `miniface-male` both keep working, since its
    // protected set is empty. Cues on unprotected channels (`brow_raise`,
    // `eye_widen`, `frown`) and the bone/gaze cues (`head_nod`, `look_*`) are
    // untouched either way. Suppression is reported in the debug state rather than
    // being silent, so a payload author can see the instruction was overridden.
    if (speaking && ownedChannels) {
      for (const name of ownedChannels) {
        if ((this.cuesPose[name] ?? 0) <= 0) continue;
        this.suppressedCueChannels.push(name);
        delete this.cuesPose[name];
      }
    }

    const settings = this.payload.behaviour_settings;
    const behaviour = this.payload.behaviour;
    /**
     * Sentence/phrase boundary proximity for this frame (§10).
     *
     * Derived here, next to `ownedChannels` and `speechAsymmetrySide`, for the same
     * reason those are: three subsystems need the same answer and must not each
     * derive their own. §9's Finding 1 was that `BlinkStateMachine` and
     * `GazeBehaviorController` take no speech input at all and therefore score at
     * chance against every landmark; this is that input, and Finding 2's brow/warmth
     * retargeting reads the same value.
     *
     * `undefined` whenever playback is inactive or the payload carries no boundaries,
     * which is the case every consumer treats as "behave exactly as before".
     */
    const speechBoundary = playbackActive ? this.speechBoundaries.proximityAt(t) : undefined;

    /**
     * FINAL CONVERGENCE — THE ONE RESOLVE.
     *
     * Resolved here, before any consumer runs, and handed to all of them: the
     * face and gaze below, and the head and neck further down. That is what
     * makes "one shared performance interpretation" structural rather than
     * aspirational — no consumer can be a frame stale, read a different clock,
     * or reach a different conclusion, because there is exactly one frame.
     *
     * `t` is the AUDIO clock, the same value the phoneme lookup and the envelope
     * use. Nothing here reads wall time.
     *
     * The state character is last frame's §P17 state. The lag is real and
     * deliberate: the state is chosen by the director INSIDE the behaviour layer
     * that consumes this frame, so a same-frame read would be circular. States
     * hold for seconds and the director already ramps every channel over
     * 0.45-0.78 s, so one frame of staleness at 60 Hz is far below anything the
     * ramps can express.
     */
    const conductorTuning = options.conductorTuning ?? null;
    if ("livePerformancePlan" in options) {
      this.headMotion.setPerformancePlan(options.livePerformancePlan ?? null);
    }
    const performanceClock = options.livePerformanceClock ?? t;
    const performanceIntent = conductorTuning && playbackActive
      ? this.headMotion.resolvePerformanceIntent(performanceClock, conductorTuning, stateCharacters[this.lastPerformanceState] ?? defaultStateCharacter)
      : null;

    const idleExpression = this.idleExpression.evaluate({
      modelId,
      deltaSeconds,
      profile: idleExpressionProfiles[modelId],
      settings: options.idleExpressionSettings ?? { ...defaultIdleExpressionSettings, blinkOnly: true },
      speechActive: Boolean(options.audioPlaying) || Boolean(current) || envelope.speechActivity > 0.03,
      activePhoneme: Boolean(current),
      manualFaceOverride: hasPoseValues(options.debugPose),
      nativeVisemeDebugActive: Boolean(options.nativeVisemeDebugActive),
      expressionPreviewActive: Boolean(options.debugCue),
      headSupported: Boolean(options.headSupported),
      speechEnergy: envelope.speechActivity,
      protectedChannels: ownedChannels,
      speechAsymmetrySide,
      stabilizeHeadDuringSpeech: stabilizeIdleHead,
      speechBoundary,
      speechPerformance: performanceIntent,
      talkingHeadGaze: options.talkingHeadTuning ? this.lastTalkingHeadGaze : null
    });
    this.carriedWarmth = idleExpression.debug?.humanBehavior?.speakingWarmth ?? { smile: 0, cheek: 0, lowerFace: 0 };
    // Fed back into the next frame's resolve; see the note on the one resolve above.
    this.lastPerformanceState = (idleExpression.debug?.humanBehavior?.performance?.state as PerformanceStateId) ?? "ATTENTIVE_NEUTRAL";

    const activeEmotionNames = emotion.active.map((event) => event.emotion);
    // When the coordinated layer owns the speaking upper face, the envelope-driven
    // gesture channel stands down so brows cannot be written by two systems.
    const speechGesture = playbackActive && !idleExpression.ownsSpeakingUpperFace
      ? this.speechGesture.evaluate(
          behaviour.speech_brow_movement,
          behaviour.speech_cheek_movement,
          settings.speech_brow_intensity,
          settings.speech_cheek_intensity,
          envelope,
          activeEmotionNames.some((name) => name === "happy" || name === "surprised") ? 1.25 : 1
        )
      : emptyPose;

    const headMotion = this.headMotion.evaluate({
      time: t,
      deltaSeconds,
      durationSeconds: this.payload.audio_duration,
      enabled: behaviour.automatic_head_movement || Boolean(options.debugCue),
      speakingEnabled: options.speakingHeadMotionEnabled ?? true,
      supported: Boolean(options.headSupported),
      intensity: settings.head_movement_intensity,
      envelope,
      activeCues: this.activeCues,
      activeEmotionNames,
      audioPlaying: options.audioPlaying ?? playbackActive,
      paused: options.paused ?? false,
      diagnostic: options.transformDiagnostic,
      naturalPreset: options.naturalSpeakingMotionPreset,
      speakingMotionProfile: options.speakingMotionProfile ?? null,
      conductorTuning,
      // The SAME object the face and gaze just consumed.
      performanceIntent,
      motorTuning: options.motorTuning ?? null,
      // Previous frame's composed pose and velocity: continuity at speech onset.
      motorAdopt: { orientation: this.lastComposedHead, velocity: this.lastComposedVelocity },
      talkingHeadTuning: options.talkingHeadTuning ?? null,
      speakingHeadMotion
    });

    this.channels[1].pose = emotion.pose;
    this.channels[2].pose = this.cuesPose;
    this.channels[3].pose = emptyPose;
    this.channels[4].pose = emptyPose;
    this.channels[5].pose = speechGesture;
    this.channels[6].pose = idleExpression.pose;
    this.channels[7].pose = coordinated.pose;
    this.channels[8].pose = hasPoseValues(options.debugPose)
      ? (options.debugPose as BlendshapePose)
      : emptyPose;

    const mixed = this.mixer.combine(this.channels);
    const outputPose = this.mixer.smooth(mixed.pose, deltaSeconds, ownedChannels);
    const finalHeadMotion = headMotion.diagnosticActive || headMotion.manualActive
      ? headMotion
      : {
          ...headMotion,
          active: headMotion.active || (Boolean(options.idleExpressionSettings) && idleExpression.active),
          head: {
            pitch: headMotion.head.pitch + idleExpression.head.pitch,
            yaw: headMotion.head.yaw + idleExpression.head.yaw,
            roll: headMotion.head.roll + idleExpression.head.roll
          },
          neck: {
            pitch: headMotion.neck.pitch + idleExpression.neck.pitch,
            yaw: headMotion.neck.yaw + idleExpression.neck.yaw,
            roll: headMotion.neck.roll + idleExpression.neck.roll
          },
          idle: idleExpression.debug,
          /**
           * STAGE 2.2. The head above is the SUM of two independently generated
           * trajectories. Recording them separately lets a downstream director
           * recombine them as one target rather than inheriting the sum; nothing
           * that ignores this field changes behaviour.
           */
          contributions: {
            speaking: { head: { ...headMotion.head }, neck: { ...headMotion.neck } },
            idle: { head: { ...idleExpression.head }, neck: { ...idleExpression.neck } }
          }
        };
    /**
     * Record the composed pose for the next frame's motor handover. Velocity is
     * a finite difference of the COMPOSED head, so what the motor adopts is what
     * the head was visibly doing, not what one layer intended.
     */
    if (deltaSeconds > 1e-4) {
      this.lastComposedVelocity = {
        pitch: (finalHeadMotion.head.pitch - this.lastComposedHead.pitch) / deltaSeconds,
        yaw: (finalHeadMotion.head.yaw - this.lastComposedHead.yaw) / deltaSeconds,
        roll: (finalHeadMotion.head.roll - this.lastComposedHead.roll) / deltaSeconds
      };
    }
    this.lastComposedHead = { ...finalHeadMotion.head };
    this.lastTalkingHeadGaze = options.talkingHeadTuning ? this.headMotion.talkingHeadState()?.gaze ?? null : null;

    this.debugActiveCueTypes.length = 0;
    for (const cue of this.activeCues) this.debugActiveCueTypes.push(cue.type);
    return {
      targetPose: mixed.pose,
      outputPose,
      headMotion: finalHeadMotion,
      /**
       * The shared frame every consumer just read, surfaced for the review
       * panel. `null` whenever the conductor is off, which is production.
       */
      performanceIntent,
      performancePlan: performanceIntent ? this.headMotion.performancePlan() : null,
      motor: this.headMotion.motorState(),
      prosody: this.headMotion.prosodyNow(),
      talkingHead: options.talkingHeadTuning ? this.headMotion.talkingHeadState() : null,
      gazeYawDegrees: idleExpression.gazeYawDegrees,
      gazePitchDegrees: idleExpression.gazePitchDegrees,
      channels: this.channels,
      lowerFaceIntent: {
        // The envelope carries the anticipation and the release; the share is the
        // gate. Multiplying them keeps both properties and adds no third system.
        bilabialClosure: clamp(coordinated.debug.closureIntent * transitionIntent.bilabialIntent),
        bilabialShare: transitionIntent.bilabialIntent,
        closureEnvelope: coordinated.debug.closureIntent
      },
      debug: {
        time: t,
        currentPhoneme: current?.phoneme,
        previousPhoneme: previous?.phoneme,
        nextPhoneme: next?.phoneme,
        currentViseme: currentDef?.viseme,
        phonemeIntensity: intensity,
        activeEmotions: emotion.active,
        activeCues: this.debugActiveCueTypes,
        suppressedCueChannels: this.suppressedCueChannels,
        activePause: pause?.type,
        speechEnvelope: envelope,
        coarticulationWeights: lip.weights,
        unknownPhonemes: this.unknownPhonemes,
        speakingHeadMotion: headMotion.speaking,
        transformDiagnostic: finalHeadMotion.diagnostic,
        idleExpression: idleExpression.debug,
        speechDeformation: coordinated.debug,
        speechTransitionIntent: transitionIntent
      }
    };
  }

  private addCue(type: FacialCueType, intensity: number, modelId: AvatarModelId) {
    this.activeCues.push({ type, intensity });
    const pose = resolveFacialCuePose(type, modelId);
    for (const key in pose)
      this.cuesPose[key] = Math.max(this.cuesPose[key] ?? 0, pose[key] * intensity);
  }
}
