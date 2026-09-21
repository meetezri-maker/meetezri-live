import { behaviorEventLibrary, type BehaviorEventDefinition } from "../../../mappings/behaviorEventLibrary";
import type { IdleExpressionEventId, IdleExpressionProfile } from "../../../mappings/idleExpressionProfiles";
import type { NaturalismPreset } from "../../../mappings/naturalismPresets";
import type {
  AvatarBehaviorState,
  HumanBehaviorDebugState,
  ListeningSubstate
} from "../../../types/behaviorNaturalism";
import { neutralExpressionIntensity, type ExpressionIntensity } from "../IdleExpressionController";
import {
  PerformanceStateDirector,
  neutralPerformanceIntent,
  type PerformanceIntent,
  type PerformanceStateId
} from "./PerformanceStateDirector";
import type { BlendshapePose, HeadRotationTarget } from "../../../types/facialAnimation";
import { clamp } from "../../../utils/clamp";
import { smoothstep } from "../../../utils/easing";
import { exponentialSmoothingAlpha } from "../../../utils/lerp";
import { BehaviorMemory, type BehaviorSide } from "./BehaviorMemory";
import { BehaviorRandom } from "./BehaviorRandom";
import { BlinkStateMachine, type BlinkBoundaryBias } from "./BlinkStateMachine";
import { ExpressionEventPlayer } from "./ExpressionEventPlayer";
import { GazeBehaviorController, writeGazeMorphs, type GazeBoundaryBias } from "./GazeBehaviorController";
import type { PerformanceIntentFrame } from "../../animation/SpeechPerformanceConductor";
import { IdleGazeEngagement, type IdleEngagementConfig } from "./IdleGazeEngagement";
import type { SpeechBoundaryProximity } from "../../timeline/SpeechBoundaryTimeline";
import { minimumJerkShape } from "../../animation/SpeakingGestureDirector";

const degreesToRadians = (degrees: number) => (degrees * Math.PI) / 180;
const zeroHead = (): HeadRotationTarget => ({ pitch: 0, yaw: 0, roll: 0 });

/** Maps a canonical morph name onto its per-model gain channel. */
const gainForMorph = (name: string, gain: { brow: number; cheek: number; smile: number; eye: number }) => {
  if (name.startsWith("brow")) return gain.brow;
  if (name.startsWith("cheek")) return gain.cheek;
  if (name.startsWith("mouthSmile")) return gain.smile;
  if (name.startsWith("eye")) return gain.eye;
  return 1;
};

/** Which of the two §10 firing reasons produced a brow/warmth pulse. */
type EmphasisReason = "energy" | "boundary" | null;

/** Idle head envelope. The speaking controller stays the primary owner during speech. */
const idleHeadLimits = { pitch: degreesToRadians(1.3), yaw: degreesToRadians(1.7), roll: degreesToRadians(1.1) };

export interface HumanBehaviorToggles {
  blink: boolean;
  gaze: boolean;
  microExpressions: boolean;
  headBehavior: boolean;
  asymmetry: boolean;
}

export interface HumanBehaviorUpdateOptions {
  deltaSeconds: number;
  preset: NaturalismPreset;
  profile: IdleExpressionProfile;
  toggles: HumanBehaviorToggles;
  /** Overall behaviour intensity from the developer panel. */
  intensity: number;
  /** Model-specific safety scale applied to expression amplitude only. */
  safetyScale: number;
  silentIntensity: number;
  speakingIntensity: number;
  speechActive: boolean;
  speechEnergy: number;
  headSupported: boolean;
  /** Blocks all behaviour output while another system owns the face. */
  blocked: boolean;
  /**
   * Channels another controller owns exclusively while speech is active.
   *
   * Empty by default, and empty for any model whose speech profile is disabled, so
   * this is a no-op unless a coordinated speech layer is actually running. While
   * the behaviour state is `speaking` or `entering-speech` this controller writes
   * none of them — see the enforcement sweep in `update()`.
   */
  protectedChannels?: ReadonlySet<string>;
  /** §P15 diagnostic amplitude multipliers. All 1 in production. */
  expressionIntensity?: ExpressionIntensity;
  /**
   * §P17 performance director. `null`/absent leaves every state amplitude at
   * zero and reproduces P16 exactly.
   */
  performance?: { enabled: boolean; intensity: number; holdScale: number; hold: PerformanceStateId | null } | null;
  /**
   * Phrase-level side chosen by the coordinated speech layer, or "balanced" when it
   * is not running. While speaking this is the authoritative side for brow emphasis
   * and warmth, so the mouth and the upper face lean the same way within a phrase.
   */
  speechAsymmetrySide?: "left" | "right" | "balanced";
  /**
   * Hold this layer's head and neck still while speaking.
   *
   * Only the head and neck: blink, gaze, resting face, micro-expressions and the
   * speaking brow/warmth emphasis are untouched, so the face keeps animating on a
   * head that does not drift. The fade is the one this controller already owns —
   * `transitionWeight`, which smoothsteps up over `speech.startBlendSeconds` on
   * entry and back down over `speech.endFullReturnSeconds` on exit — so no second
   * smoothing system is introduced and there is no step at either boundary.
   */
  stabilizeHeadDuringSpeech?: boolean;
  /**
   * Sentence/phrase boundary proximity for this frame, or undefined when the payload
   * carries none (§10).
   *
   * This is the speech input §9 found blink and gaze to be missing entirely. It is
   * a bias on scheduling, never a trigger: nothing downstream fires deterministically
   * on a boundary, and `undefined` reproduces pre-§10 behaviour exactly on every
   * path that reads it.
   */
  speechBoundary?: SpeechBoundaryProximity;
  /**
   * FINAL CONVERGENCE. The shared performance frame for THIS audio clock.
   *
   * Resolved once per frame by `AvatarController` and handed to the head, the
   * neck, the gaze and the face, so every consumer is expressing the same anchor
   * of the same sentence at the same instant. `null`/absent leaves every path
   * below arithmetically inert and reproduces P18.2 exactly.
   */
  speechPerformance?: PerformanceIntentFrame | null;
  /**
   * TALKINGHEAD SPEECH TEST. Eye direction from the upstream adapter, normalised
   * to [-1,1] as its morphs are, or `null` when the experiment is inactive.
   *
   * Replaces this layer's own gaze DIRECTION while speaking, because upstream
   * solves eye direction from the live head orientation and that coupling is the
   * thing under test — running our gaze scheduler alongside it would not be a
   * reproduction. Blink is deliberately untouched: it stays ours, and so does
   * the §P17.1 awake-lid ceiling, because upstream's eye-contact path writes
   * look morphs only and never `eyeBlink`.
   */
  talkingHeadGaze?: { yaw: number; pitch: number } | null;
  /**
   * IDLE ENGAGEMENT. When present, the eyes are anchored on the viewer while
   * idle and compensate for head orientation. `null` is the previous behaviour:
   * the gaze scheduler's output used directly, with no viewer anchor.
   */
  idleEngagement?: IdleEngagementConfig | null;
}

export interface HumanBehaviorOutput {
  pose: BlendshapePose;
  head: HeadRotationTarget;
  neck: HeadRotationTarget;
  /** Final gaze angles for the eye geometry path. */
  gazeYawDegrees: number;
  gazePitchDegrees: number;
  active: boolean;
  /** True while this controller owns the speaking upper face. */
  ownsSpeakingUpperFace: boolean;
  debug: HumanBehaviorDebugState;
}

interface HeadSample {
  time: number;
  head: HeadRotationTarget;
}

/**
 * Single coordinated performance layer for the female avatar.
 *
 * One state machine, one scheduler, one seeded random source and one behaviour
 * memory drive blink, gaze, eye/head coordination, micro-expressions, resting
 * face and speaking upper-face emphasis. It emits a pose plus head and neck
 * targets; it never writes morph influences or bone transforms itself.
 */
export class HumanBehaviorController {
  private random = new BehaviorRandom("avatar-behaviour");
  /**
   * §P17. The performance authority. It writes nothing itself — it publishes an
   * intention, and the write paths in THIS controller execute it, so the face
   * still has exactly one writer per channel.
   */
  private director = new PerformanceStateDirector(this.random);
  private intent: PerformanceIntent = { ...neutralPerformanceIntent };
  private blink = new BlinkStateMachine(this.random);
  private gaze = new GazeBehaviorController(this.random);
  private events = new ExpressionEventPlayer(this.random);
  private memory = new BehaviorMemory();

  private time = 0;
  private state: AvatarBehaviorState = "silent-listening";
  private substate: ListeningSubstate = "user-focus";
  private stateEnteredAt = 0;
  private transitionWeight = 0;
  private mouthFade = 1;
  /** The conducted gaze bias applied this frame, for the review readout. */
  private conductedGaze: { yaw: number; pitch: number; mode: string; stability: number } =
    { yaw: 0, pitch: 0, mode: "engaged", stability: 0 };
  /** The conducted face amplitudes applied this frame, for the review readout. */
  private conductedFace = { browInner: 0, browOuter: 0, cheek: 0, smile: 0, lowerFace: 0, eyelid: 0 };
  /** IDLE ENGAGEMENT. The single idle gaze authority; inert unless configured. */
  private engagement = new IdleGazeEngagement(this.random.seed);
  private lastEngagement: { engaged: boolean; breakActive: boolean; compensationDegrees: number } | null = null;

  private stillnessUntil = 0;
  private lastStillnessDuration = 0;
  private nextEventAt = 0;

  private postureTarget = { yaw: 0, pitch: 0, roll: 0 };
  /** §P28 side-pose easing: the drawn pose split into bias, home and excursion. */
  private postureBias = { yaw: 0, pitch: 0, roll: 0 };
  private postureRest = { yaw: 0, pitch: 0, roll: 0 };
  private postureExcursion = { yaw: 0, pitch: 0, roll: 0 };
  private postureHoldFrom = -999;
  /**
   * §P16 presence state.
   *
   * `resting` is where the head considers "at ease" to be, and it MIGRATES.
   * P15 redrew `postureTarget` around zero on every hold expiry, so the head
   * always travelled back through centre and the idle read as front-locked.
   *
   * `orientVelocity` exists so a new target arriving mid-turn is blended from
   * the CURRENT velocity rather than restarting from rest — the difference
   * between a head that redirects and a head that stutters.
   */
  private resting = { yaw: 0, pitch: 0 };
  private orientVelocity = { yaw: 0, pitch: 0, roll: 0 };
  private neckCurrent = { yaw: 0, pitch: 0, roll: 0 };
  private neckTarget = { yaw: 0, pitch: 0, roll: 0 };
  private neckArrivesAt = -999;
  /** Idle weight applied to the neck, so speaking suppression reaches it too. */
  private neckIdleWeight = 1;
  private headHoldsUntil = -999;
  private gazeLeadUntil = -999;
  private eyesOnlyUntil = -999;
  private postureCurrent = { yaw: 0, pitch: 0, roll: 0 };
  private postureHoldUntil = 0;
  private postureSign: -1 | 0 | 1 = 0;

  private gazeAwaySince = -1;
  private headFollowTarget = 0;
  private headFollowCurrent = 0;
  private headFollowArmedAt = -1;
  private headHistory: HeadSample[] = [];

  private breathPhase = 0;
  private breathCycle = 4.8;
  private breathsRemaining = 4;

  private browEmphasis = { start: -999, peak: 0, side: 1 as 1 | -1, reason: null as EmphasisReason };
  /** Last brow pulse of EITHER reason. The boundary path yields to this. */
  private lastEmphasisAt = -999;
  /** Last brow pulse of the energy reason only, so the boundary path cannot suppress it. */
  private lastEnergyEmphasisAt = -999;
  private warmth = { start: -999, smile: 0, cheek: 0, duration: 0, side: 1 as 1 | -1, reason: null as EmphasisReason };
  /**
   * The warmth this frame WOULD have written, reported for the coordinated layer
   * to merge (§P14).
   *
   * `mouthSmile*` and `cheekSquint*` are protected while speaking, so the write
   * below is dropped and always was — P14 measured that disabling this scheduler
   * outright changed not one frame of either channel. Reporting the amount lets
   * the single owner apply it without a second writer appearing.
   */
  private reportedWarmth = { smile: 0, cheek: 0, lowerFace: 0 };
  /** Last warmth pulse of EITHER reason. */
  private lastWarmthAt = -999;
  /** Last warmth pulse of the energy reason only. */
  private lastEnergyWarmthAt = -999;
  private energyAboveAt = -999;
  /** Boundary the §10 emphasis trigger has already had its one attempt at. */
  private boundaryEmphasisIndex = -1;

  private pose: BlendshapePose = {};
  private head: HeadRotationTarget = zeroHead();
  private neck: HeadRotationTarget = zeroHead();

  get seed() {
    return this.random.seed;
  }

  get behaviorState() {
    return this.state;
  }

  reset(preset: NaturalismPreset, seed: string, time = 0) {
    this.random.reseed(seed);
    this.time = time;
    this.state = "silent-listening";
    this.substate = "user-focus";
    this.stateEnteredAt = time;
    this.transitionWeight = 0;
    this.mouthFade = 1;
    this.stillnessUntil = 0;
    this.lastStillnessDuration = 0;
    this.postureTarget = { yaw: 0, pitch: 0, roll: 0 };
    this.resting = { yaw: 0, pitch: 0 };
    this.orientVelocity = { yaw: 0, pitch: 0, roll: 0 };
    this.neckCurrent = { yaw: 0, pitch: 0, roll: 0 };
    this.neckTarget = { yaw: 0, pitch: 0, roll: 0 };
    this.neckArrivesAt = -999;
    this.neckIdleWeight = 1;
    this.headHoldsUntil = -999;
    this.gazeLeadUntil = -999;
    this.eyesOnlyUntil = -999;
    this.director.reset(time);
    this.intent = { ...neutralPerformanceIntent };
    this.postureCurrent = { yaw: 0, pitch: 0, roll: 0 };
    this.postureHoldUntil = time + this.random.fromRange("posture-hold", preset.head.postureHold);
    this.postureSign = 0;
    this.gazeAwaySince = -1;
    this.headFollowTarget = 0;
    this.headFollowCurrent = 0;
    this.headFollowArmedAt = -1;
    this.headHistory = [];
    this.breathPhase = this.random.range("breath-phase", 0, Math.PI * 2);
    this.breathCycle = this.random.fromRange("breath-cycle", { min: 4.1, max: 5.6 });
    this.breathsRemaining = 4;
    this.browEmphasis = { start: -999, peak: 0, side: 1, reason: null };
    this.lastEmphasisAt = -999;
    this.lastEnergyEmphasisAt = -999;
    this.warmth = { start: -999, smile: 0, cheek: 0, duration: 0, side: 1, reason: null };
    this.reportedWarmth = { smile: 0, cheek: 0, lowerFace: 0 };
    this.lastWarmthAt = -999;
    this.lastEnergyWarmthAt = -999;
    this.energyAboveAt = -999;
    this.boundaryEmphasisIndex = -1;
    this.memory.reset(time);
    this.blink.reset(preset.blink, time);
    this.gaze.reset(preset.gaze, time);
    this.events.reset(time);
    // The first expression waits out the same settling delay used after speech.
    this.nextEventAt = time + this.random.fromRange("event-settle", preset.expression.postSpeechDelay);
    this.pose = {};
    this.head = zeroHead();
    this.neck = zeroHead();
  }

  forceBlink() {
    this.blink.force();
  }

  forceGazeShift(preset: NaturalismPreset) {
    this.gaze.forceShift(preset.gaze);
  }

  centerGaze(preset: NaturalismPreset) {
    this.gaze.recenter(preset.gaze);
  }

  forceEvent(preset: NaturalismPreset, id: IdleExpressionEventId) {
    const definition = behaviorEventLibrary[id];
    if (!definition) return;
    this.startEvent(preset, definition, true);
  }

  update(options: HumanBehaviorUpdateOptions): HumanBehaviorOutput {
    const { preset, deltaSeconds } = options;
    this.time += deltaSeconds;

    this.updateState(preset, options.speechActive, deltaSeconds);

    const speaking = this.state === "speaking" || this.state === "entering-speech";
    const behaviourIntensity =
      clamp(options.intensity, 0, 2) * (speaking ? clamp(options.speakingIntensity, 0, 2) : clamp(options.silentIntensity, 0, 2));

    // Boundary bias is resolved once here and handed to the leaf schedulers, so
    // `BlinkStateMachine` and `GazeBehaviorController` stay unaware of presets and
    // of payload time and receive only offsets from the current instant (§10).
    const boundary = options.speechBoundary;
    const boundaryConfig = preset.speech.boundary;
    const blinkBias: BlinkBoundaryBias | undefined = boundary
      ? {
          secondsToNextStart: boundary.secondsToNextStart,
          pullProbability: boundaryConfig.blinkPullProbability,
          reachSeconds: boundaryConfig.blinkReachSeconds,
          minimumLeadSeconds: boundaryConfig.blinkMinimumLeadSeconds,
          jitter: boundaryConfig.blinkJitter
        }
      : undefined;
    const gazeBias: GazeBoundaryBias | undefined = boundary
      ? {
          secondsToNextStart: boundary.secondsToNextStart,
          windowSeconds: boundaryConfig.gazeWindowSeconds,
          probabilityGain: boundaryConfig.gazeProbabilityGain,
          deferSeconds: boundaryConfig.gazeDeferSeconds
        }
      : undefined;

    // Blinking is deliberately outside the expression safety scale so the lids
    // can reach full closure and full reopening on every model.
    // `speaking` is the same state the upper-face emphasis reads, so blink rate and
    // brow emphasis agree about when speech is happening (§12).
    this.blink.update(preset.blink, deltaSeconds, options.toggles.blink && !options.blocked, blinkBias, speaking);

    const stillnessActive = this.time < this.stillnessUntil;
    this.updateScheduler(preset, options, stillnessActive);

    const eventOutput = this.events.update(deltaSeconds);

    /**
     * FINAL CONVERGENCE gaze consumer.
     *
     * The eyes read the SAME anchor as the head, not the head's angle. There is
     * no second speaking gaze scheduler: `GazeBehaviorController` keeps its own
     * blinking-adjacent life — micro-saccades, the slow drift, its boundary
     * bias — and the conductor arrives as a bias on top plus a damping term, so
     * the shared speaking intention is dominant while bounded natural variation
     * survives underneath it.
     *
     * The bias goes through `setEventOffset`, the injection point the idle event
     * layer already uses. That is deliberate: it is inside `committedYawDegrees`,
     * so the §P8/§P16 head-follow sees the conducted gaze and the head keeps
     * agreeing with the eyes, and it is clamped by the same envelope, so a
     * conducted offset can never push past the configured gaze limit.
     *
     * Scoped to `speaking` so idle gaze is untouched — the P16 freeze.
     */
    const conducted = speaking ? options.speechPerformance ?? null : null;
    this.conductedGaze = conducted
      ? { yaw: conducted.gazeYawBias, pitch: conducted.gazePitchBias, mode: conducted.gazeMode, stability: conducted.gazeStability }
      : { yaw: 0, pitch: 0, mode: "engaged", stability: 0 };
    this.gaze.setEventOffset(
      eventOutput.gazeYawDegrees + this.conductedGaze.yaw * this.transitionWeight,
      eventOutput.gazePitchDegrees + this.conductedGaze.pitch * this.transitionWeight
    );

    const gazeScale = 1 - this.transitionWeight * (1 - preset.gaze.speakingScale);
    const gazeAngles = this.gaze.update({
      config: preset.gaze,
      deltaSeconds,
      enabled: options.toggles.gaze && !options.blocked,
      stillnessActive,
      amplitudeScale: gazeScale,
      eventOwnsGaze: eventOutput.phase !== "none" && Boolean(behaviorEventLibrary[this.events.currentId() ?? "neutral-reset"]?.gaze),
      speaking,
      boundary: gazeBias,
      /**
       * Viewer stabilization. During a committed emphasis a speaker's eyes stop
       * wandering and hold the listener; this damps the gaze layer's OWN target
       * and drift toward that, and nothing else. Micro-saccades are excluded by
       * the controller, because eyes that are perfectly still are the other
       * failure mode. Faded by `transitionWeight` so entering speech cannot snap
       * the eyes.
       */
      autonomousScale: 1 - 0.75 * this.conductedGaze.stability * this.transitionWeight
    });

    /**
     * TALKINGHEAD gaze override. Direction only, and only while speaking, so
     * idle gaze and the P16 behaviour outside speech are untouched.
     */
    const thGaze = speaking ? options.talkingHeadGaze ?? null : null;

    /**
     * IDLE ENGAGEMENT — the single idle gaze authority.
     *
     * Takes whatever the wandering above proposed and re-expresses it around the
     * viewer, subtracting head orientation so that moving the head no longer
     * moves the gaze. Idle only: while speaking the TalkingHead solve owns the
     * eyes, and that arrangement is already approved.
     *
     * Head orientation is LAST frame's, because `updateHead` runs after this. At
     * 60 Hz that is 16 ms against a 100 ms eye lag, and the alternative is a
     * circular dependency — the head-follow reads the gaze.
     */
    const idleEngagementConfig = !speaking && !options.blocked ? options.idleEngagement ?? null : null;
    let engagementGaze: { yawDegrees: number; pitchDegrees: number } | null = null;
    if (idleEngagementConfig) {
      this.engagement.configure(idleEngagementConfig);
      const solved = this.engagement.update(
        deltaSeconds,
        this.head.yaw * (180 / Math.PI),
        this.head.pitch * (180 / Math.PI),
        gazeAngles.yawDegrees,
        gazeAngles.pitchDegrees
      );
      engagementGaze = { yawDegrees: solved.yawDegrees, pitchDegrees: solved.pitchDegrees };
      this.lastEngagement = {
        engaged: solved.engaged, breakActive: solved.breakActive,
        compensationDegrees: solved.compensationDegrees
      };
    } else {
      this.lastEngagement = null;
    }

    const finalGaze = thGaze
      ? {
          yawDegrees: clamp(thGaze.yaw, -1, 1) * preset.gaze.maxYawDegrees,
          pitchDegrees: clamp(thGaze.pitch, -1, 1) * preset.gaze.maxPitchDegrees
        }
      : engagementGaze
        ? {
            yawDegrees: clamp(engagementGaze.yawDegrees, -preset.gaze.maxYawDegrees, preset.gaze.maxYawDegrees),
            pitchDegrees: clamp(engagementGaze.pitchDegrees, -preset.gaze.maxPitchDegrees, preset.gaze.maxPitchDegrees)
          }
        : gazeAngles;

    this.updateBreathing(deltaSeconds);
    this.updateSpeechUpperFace(preset, options);

    const pose: BlendshapePose = {};
    if (!options.blocked) {
      this.writeRestingFace(pose, options, behaviourIntensity);
      this.writeBlink(pose, options);
      if (options.toggles.gaze) writeGazeMorphs(pose, finalGaze.yawDegrees, finalGaze.pitchDegrees, preset.gaze.morphPerDegree);
      if (options.toggles.microExpressions) this.writeEventPose(pose, eventOutput.pose, options, behaviourIntensity);
      this.writeSpeechUpperFace(pose, preset, options, behaviourIntensity);
      this.writeConductedFace(pose, preset, options, behaviourIntensity);
    }

    // Speech-channel exclusivity, enforced rather than documented.
    //
    // The coordinated speech layer's header claims sole ownership of
    // `femaleSpeechProfile.supportedChannels` during speech. It never got it: the
    // warmth writer above puts mouthSmile*/cheekSquint* into the same channels and
    // FacialPoseMixer sums them (boundedAdd for mouth and cheeks), so the two
    // systems added rather than one arbitrating. One sweep here is the contract:
    // every writer in this controller is subject to it, not just the one that
    // motivated it, because "single owner" has to hold for the whole layer to mean
    // anything.
    //
    // The cut applies from `speaking`, NOT from `entering-speech`, and that is a
    // measured decision rather than a looser reading of the contract.
    //
    // Cutting at `entering-speech` — the first frame speech is detected — was tried
    // first. It drops whatever the idle layer was holding in one frame: measured at
    // 0.0092 for the resting baseline alone, but **0.34-0.36 on cheekSquint** when a
    // micro-expression is still playing as speech starts, against 0.96 for a full
    // blink on this asset. That is a visible pop, and it is worse than the problem
    // being fixed.
    //
    // Nothing extra is needed to avoid it, because the fade already exists: every
    // writer above scales its protected-channel output by `1 - transitionWeight`
    // (`nonMouth`) or `mouthFade`, both of which reach zero exactly when
    // `entering-speech` becomes `speaking`. So the entry blend is already a
    // monotone decay to zero over `preset.speech.startBlendSeconds` (0.24 s) while
    // the coordinated layer attacks the same channels from zero — a bounded
    // crossfade, ending in the exclusivity this sweep then holds absolutely.
    //
    // The warmth pulse is the exception and is skipped outright in
    // `writeSpeechUpperFace`: it scales by `transitionWeight`, so it ramps UP into
    // the handover instead of out of it, and it exists only during speech.
    if (this.state === "speaking" && options.protectedChannels?.size) {
      for (const name of options.protectedChannels) delete pose[name];
    }

    /**
     * §P17. One update per frame, ahead of every consumer, so head, gaze and
     * face all read the SAME intention on the SAME frame. Disabled, the intent
     * stays neutral and every consumer below is arithmetically inert.
     */
    const performance = options.performance;
    if (performance?.enabled) {
      this.director.hold(performance.hold);
      this.intent = this.director.update(deltaSeconds, performance.holdScale, performance.intensity);
    } else {
      this.intent = { ...neutralPerformanceIntent };
    }

    const head = this.updateHead(preset, options, eventOutput.head, stillnessActive, behaviourIntensity, deltaSeconds);
    const neck = this.updateNeck(preset, head, deltaSeconds);

    this.pose = pose;
    this.head = head;
    this.neck = neck;
    this.substate = this.resolveSubstate(stillnessActive, eventOutput.phase !== "none");

    const activeChannels = Object.keys(pose).filter((name) => pose[name] > 0.0005);
    const magnitude = Math.abs(head.pitch) + Math.abs(head.yaw) + Math.abs(head.roll);
    return {
      pose,
      head,
      neck,
      gazeYawDegrees: finalGaze.yawDegrees,
      gazePitchDegrees: finalGaze.pitchDegrees,
      active: activeChannels.length > 0 || magnitude > 1e-6,
      ownsSpeakingUpperFace: true,
      debug: this.buildDebug(preset, options, gazeScale, stillnessActive, eventOutput.phase, activeChannels)
    };
  }

  // --- behaviour state machine -------------------------------------------------

  private updateState(preset: NaturalismPreset, speechActive: boolean, deltaSeconds: number) {
    const previous = this.state;
    if (speechActive) {
      if (this.state === "silent-listening" || this.state === "returning-to-listening") {
        this.state = "entering-speech";
        this.stateEnteredAt = this.time;
      } else if (this.state === "entering-speech" && this.time - this.stateEnteredAt >= preset.speech.startBlendSeconds) {
        this.state = "speaking";
        this.stateEnteredAt = this.time;
      }
    } else if (this.state === "speaking" || this.state === "entering-speech") {
      this.state = "returning-to-listening";
      this.stateEnteredAt = this.time;
      this.memory.speechEndedAt = this.time;
      // Delay the first idle expression so nothing pounces the moment speech stops.
      this.nextEventAt = Math.max(
        this.nextEventAt,
        this.time + preset.speech.endFullReturnSeconds + this.random.fromRange("event-settle", preset.speech.postSettleDelay)
      );
      // A quiet settling period follows every sentence.
      this.stillnessUntil = Math.max(this.stillnessUntil, this.time + preset.speech.endFullReturnSeconds);
    } else if (this.state === "returning-to-listening" && this.time - this.stateEnteredAt >= preset.speech.endFullReturnSeconds) {
      this.state = "silent-listening";
      this.stateEnteredAt = this.time;
    }
    if (previous !== this.state && this.state === "entering-speech") {
      // Speech start must never cancel a blink or clear the face in one frame.
      this.warmth = { start: -999, smile: 0, cheek: 0, duration: 0, side: 1, reason: null };
    }

    const elapsed = this.time - this.stateEnteredAt;
    if (this.state === "entering-speech") {
      this.transitionWeight = smoothstep(0, Math.max(0.001, preset.speech.startBlendSeconds), elapsed);
      this.mouthFade = 1 - this.transitionWeight;
    } else if (this.state === "speaking") {
      this.transitionWeight = 1;
      this.mouthFade = 0;
    } else if (this.state === "returning-to-listening") {
      this.transitionWeight = 1 - smoothstep(0, Math.max(0.001, preset.speech.endFullReturnSeconds), elapsed);
      this.mouthFade = smoothstep(0, Math.max(0.001, preset.speech.endFacialReturnSeconds), elapsed);
    } else {
      this.transitionWeight = 0;
      this.mouthFade = Math.min(1, this.mouthFade + deltaSeconds * 4);
    }
  }

  private resolveSubstate(stillnessActive: boolean, eventActive: boolean): ListeningSubstate {
    if (this.state === "returning-to-listening") return "soft-return";
    if (eventActive) return "micro-expression";
    if (stillnessActive) return "quiet-stillness";
    const mode = this.gaze.currentMode();
    if (mode === "brief-thought") return "brief-thought";
    if (mode === "soft-return") return "soft-return";
    return "user-focus";
  }

  // --- scheduling --------------------------------------------------------------

  private updateScheduler(preset: NaturalismPreset, options: HumanBehaviorUpdateOptions, stillnessActive: boolean) {
    if (options.blocked || !options.toggles.microExpressions) return;
    if (this.events.isActive()) return;
    if (stillnessActive) return;
    if (this.state !== "silent-listening") return;
    if (this.time < this.nextEventAt) return;

    const definition = this.pickEvent(preset);
    if (!definition) {
      // Nothing is eligible: wait a little rather than retrying every frame.
      this.nextEventAt = this.time + this.random.range("event-retry", 1.2, 2.8);
      return;
    }
    this.startEvent(preset, definition, false);
  }

  private pickEvent(preset: NaturalismPreset): BehaviorEventDefinition | undefined {
    // `preset.expression.historyLength` does not select a different event set: it is
    // already applied downstream, by BehaviorMemory.canRun (which suppresses an
    // immediate repeat) and recordEvent (which bounds the history). The whole
    // library is always the candidate pool.
    const candidates = (Object.keys(behaviorEventLibrary) as IdleExpressionEventId[])
      .map((id) => behaviorEventLibrary[id])
      .filter(
        (definition) =>
          definition.allowedBehaviorStates.includes(this.state) &&
          this.memory.canRun(definition, this.time, preset.expression.cooldownScale, preset.expression.historyLength)
      );
    if (!candidates.length) return undefined;
    const roll = this.random.next("event-pick");
    return candidates[Math.min(candidates.length - 1, Math.floor(roll * candidates.length))];
  }

  private startEvent(preset: NaturalismPreset, definition: BehaviorEventDefinition, forced: boolean) {
    const occasional = this.random.chance("event-asym-kind", preset.expression.occasionalAsymmetryProbability);
    const asymmetry = this.random.fromRange(
      "event-asym",
      occasional ? preset.expression.occasionalAsymmetry : preset.expression.ordinaryAsymmetry
    );
    const preferred: BehaviorSide = this.random.next("event-side") < 0.5 ? "left" : "right";
    const side = this.memory.pickSide(preferred);
    const started = this.events.start(definition, side, asymmetry, preset.expression.amplitudeScale);
    this.memory.recordSide(side);
    this.memory.recordEvent(definition, this.time, started.duration, preset.expression.historyLength);

    const gap = this.random.fromRange("event-interval", preset.expression.interval);
    this.nextEventAt = this.time + started.duration + gap;
    if (!forced) this.maybeScheduleStillness(preset, started.duration);
  }

  private maybeScheduleStillness(preset: NaturalismPreset, afterSeconds: number) {
    const density = this.memory.density(this.time, preset.stillness.densityWindowSeconds);
    const dense = density >= preset.stillness.densityThreshold;
    const probability = preset.stillness.probabilityAfterEvent + (dense ? preset.stillness.densityProbabilityBoost : 0);
    if (!this.random.chance("stillness-roll", probability)) return;
    const long = this.random.chance("stillness-kind", preset.stillness.occasionalProbability);
    const base = this.random.fromRange("stillness-duration", long ? preset.stillness.occasional : preset.stillness.normal);
    const duration = base + (dense ? preset.stillness.densityDurationBoost : 0);
    if (duration <= 0) return;
    this.lastStillnessDuration = duration;
    this.stillnessUntil = this.time + afterSeconds + duration;
    this.nextEventAt = Math.max(this.nextEventAt, this.stillnessUntil);
  }

  // --- pose writers ------------------------------------------------------------

  private writeRestingFace(pose: BlendshapePose, options: HumanBehaviorUpdateOptions, behaviourIntensity: number) {
    const baseline = options.profile.baseline;
    const scale = behaviourIntensity * options.safetyScale;
    const nonMouth = scale * (1 - this.transitionWeight);
    const mouth = scale * this.mouthFade;
    const breath = (Math.sin(this.breathPhase) + 1) * 0.5;
    for (const [name, value] of Object.entries(baseline)) {
      if (name.startsWith("viseme_")) continue;
      const weight = name.startsWith("mouth") ? mouth : nonMouth;
      const amount = value * weight;
      if (amount > 0) pose[name] = clamp((pose[name] ?? 0) + amount);
    }
    const breathing = options.profile.breathing;
    const cheek = breathing.cheekAmplitude * breath * nonMouth;
    const lid = breathing.eyelidAmplitude * breath * nonMouth;
    if (cheek > 0) {
      pose.cheekSquintLeft = clamp((pose.cheekSquintLeft ?? 0) + cheek);
      pose.cheekSquintRight = clamp((pose.cheekSquintRight ?? 0) + cheek);
    }
    if (lid > 0) {
      pose.eyeSquintLeft = clamp((pose.eyeSquintLeft ?? 0) + lid);
      pose.eyeSquintRight = clamp((pose.eyeSquintRight ?? 0) + lid);
    }
  }

  /**
   * The ONE way a non-blink writer may lower the lids.
   *
   * Expression support and blinking share `eyeBlink*` because it is the only
   * channel this asset renders any lid movement through (P15: `eyeSquint`
   * changes the aperture by 0.000 mm). Sharing the channel is unavoidable;
   * sharing the BOUND is what produced the defect. Support is clipped to
   * `awakeLidCeiling`, a blink is never clipped, and `Math.max` means a blink
   * in flight always keeps the deeper value and its authored shape.
   *
   * Traced before the fix: warmth support alone held the lid at 0.160-0.185
   * across 9.5 % of speaking frames, 1.22 s unbroken. See `awakeLidCeiling`.
   */
  private addLidSupport(pose: BlendshapePose, preset: NaturalismPreset, amount: number) {
    if (!(amount > 0)) return;
    const capped = Math.min(amount, preset.speech.awakeLidCeiling);
    if (capped <= 0) return;
    pose.eyeBlinkLeft = Math.max(pose.eyeBlinkLeft ?? 0, clamp(capped));
    // The 0.96 spread is the existing asymmetry, kept so the eyes are not a pair
    // of identical shutters; it is applied after the cap, never to escape it.
    pose.eyeBlinkRight = Math.max(pose.eyeBlinkRight ?? 0, clamp(capped * 0.96));
  }

  private writeBlink(pose: BlendshapePose, options: HumanBehaviorUpdateOptions) {
    if (!options.toggles.blink) return;
    const values = this.blink.values();
    if (values.left > 0) pose.eyeBlinkLeft = Math.max(pose.eyeBlinkLeft ?? 0, clamp(values.left));
    if (values.right > 0) pose.eyeBlinkRight = Math.max(pose.eyeBlinkRight ?? 0, clamp(values.right));
  }

  private writeEventPose(
    pose: BlendshapePose,
    eventPose: BlendshapePose,
    options: HumanBehaviorUpdateOptions,
    behaviourIntensity: number
  ) {
    const directorActive = Boolean(options.performance?.enabled);
    const nonMouth = behaviourIntensity * options.safetyScale * (1 - this.transitionWeight);
    const mouth = behaviourIntensity * options.safetyScale * this.mouthFade;
    const gain = options.profile.naturalism.expressionGain;
    for (const [name, value] of Object.entries(eventPose)) {
      if (name.startsWith("viseme_")) continue;
      const weight = name.startsWith("mouth") ? mouth : nonMouth;
      // The per-model gain converts the normalised event library into travel that
      // is actually visible on this asset.
      /**
       * §P15. Idle amplitude has exactly ONE control, `idle`.
       *
       * The first cut also applied the per-region speaking multipliers here, so
       * a configuration tuned for speech (cheek x3.4) drove the idle events'
       * `cheekSquint` to exactly 1.000 — the channel ceiling — on hundreds of
       * frames. That is not a larger expression, it is a flat one, and it made
       * the combined review configuration unusable. The two paths start from
       * very different amplitudes (idle events run through `expressionGain`,
       * cheek 26; speaking warmth through `speechGain`, cheek 8.5) and cannot
       * share a multiplier.
       */
      const intensity = options.expressionIntensity ?? neutralExpressionIntensity;
      /**
       * §P17. A scheduled warmth event is damped when it disagrees with the
       * active state. Without this the event layer wrote `cheekSquint` up to
       * 0.9 whatever the director intended, and the rendered cheek correlated
       * with the state at r = -0.067 against a shuffled control: the face was
       * contradicting the head. Only the warmth channels are affected — brow
       * and eyelid events keep their own scheduling.
       */
      const warmthChannel = name.startsWith("cheek") || name.startsWith("mouthSmile");
      const compat = warmthChannel ? this.intent.eventWarmth : 1;
      let amount = value * weight * gainForMorph(name, gain) * intensity.idle * compat;
      /**
       * A warmth event may not exceed what the state intends.
       *
       * Damping alone was not enough: the events reach `cheekSquint` 0.9 and
       * even at 0.35 compatibility they still beat a 0.1 state floor, so the
       * rendered cheek tracked the event schedule instead of the performance
       * and correlated with the active state at r = -0.098. Capping at the
       * state's own amplitude makes the state the thing you see, and leaves the
       * event free to shape the approach within it.
       */
      if (warmthChannel && directorActive) {
        const ceiling = (name.startsWith("cheek") ? this.intent.cheek : this.intent.smile) * 1.15;
        amount = Math.min(amount, ceiling);
      }
      if (amount > 0) pose[name] = clamp((pose[name] ?? 0) + amount);
    }

    /**
     * §P17 state expression, written HERE rather than by the director.
     *
     * `Math.max`, not `+=`: a scheduled micro-expression that is already louder
     * than the resting state keeps its own value, so the two cannot stack into
     * a clipped channel. The state is a floor the face sits at, and the events
     * are gestures on top of it.
     *
     * Asymmetry is applied as a lead/follow spread around the same mean rather
     * than by lowering one side, so raising it cannot quietly reduce the
     * expression's overall presence. The lead side migrates between states.
     */
    const perf = this.intent;
    if (perf.cheek > 0 || perf.browInner > 0 || perf.browOuter > 0 || perf.smile > 0 || perf.eyelid > 0 || perf.upperLip > 0 || perf.nasolabial > 0 || perf.lowerLip > 0) {
      const scale = nonMouth;
      const lead = perf.asymmetrySide === 1 ? "Left" : "Right";
      const follow = lead === "Left" ? "Right" : "Left";
      const a = 1 - perf.asymmetry;
      /**
       * Protected channels are skipped ONLY WHILE SPEAKING.
       *
       * `cheekSquintLeft/Right` and `mouthSmileLeft/Right` are in the
       * coordinated layer's `supportedChannels`, and `AvatarController` supplies
       * that set whenever the layer is ACTIVE — which is always, not only while
       * speech is running. Skipping on membership alone therefore dropped the
       * director's cheek and smile on every idle frame: measured intent 0.520
       * arrived as 0.010 (the resting baseline) while `browInnerUp`, which is
       * not in the set, flowed through at 0.200 untouched. That is exactly the
       * "face contradicts the head" symptom, and it was this line.
       *
       * The condition below is the same one the controller already enforces for
       * the wholesale protected-channel sweep in `update()`, so ownership is
       * unchanged rather than newly negotiated: during speech the coordinated
       * layer owns these channels, during idle this controller does — which is
       * already true of the idle event layer writing them.
       */
      const speaking = this.state === "speaking" || this.state === "entering-speech";
      const put = (name: string, amount: number) => {
        if (amount <= 0) return;
        if (speaking && options.protectedChannels?.has(name)) return;
        pose[name] = Math.max(pose[name] ?? 0, clamp(amount));
      };
      put(`cheekSquint${lead}`, perf.cheek * scale);
      put(`cheekSquint${follow}`, perf.cheek * scale * a);
      put(`mouthSmile${lead}`, perf.smile * scale);
      put(`mouthSmile${follow}`, perf.smile * scale * a);
      put("browInnerUp", perf.browInner * scale);
      put(`browOuterUp${lead}`, perf.browOuter * scale);
      put(`browOuterUp${follow}`, perf.browOuter * scale * a);
      /**
       * §P17.1 lower face.
       *
       * The hardware review found the region below the nose dead while the
       * upper face carried the whole expression. `mouthSmile` alone cannot fix
       * that on this asset — P14 measured a symmetric smile netting -0.03 mm of
       * corner lift, and P17.1 confirmed it visually at full drive. These three
       * are the channels that DO move visible tissue down there:
       * `mouthUpperUp` lifts the upper lip, `noseSneer` creates the nasolabial
       * change, `mouthShrugLower` supports the lower lip.
       *
       * They are speech channels, so they are subject to the same
       * speaking-only protection as cheek and smile above: during speech the
       * coordinated layer owns them and this writes nothing.
       */
      put(`mouthUpperUp${lead}`, perf.upperLip * scale);
      put(`mouthUpperUp${follow}`, perf.upperLip * scale * a);
      put(`noseSneer${lead}`, perf.nasolabial * scale);
      put(`noseSneer${follow}`, perf.nasolabial * scale * a);
      put("mouthShrugLower", perf.lowerLip * scale);
      /**
       * Eyelid support goes through `eyeBlink`, which P15 measured as the ONLY
       * channel on this asset that reaches the eyes — `eyeSquint` translates
       * the eyeball 3.5 mm and moves the face 0.0002 mm. Gated on the blink
       * toggle for the same reason P10's support is: a developer who switches
       * blink off expects the lids silent.
       */
      if (options.toggles.blink) this.addLidSupport(pose, options.preset, perf.eyelid * scale);
    }
  }

  private updateBreathing(deltaSeconds: number) {
    this.breathPhase += (deltaSeconds / this.breathCycle) * Math.PI * 2;
    if (this.breathPhase >= Math.PI * 2) {
      this.breathPhase -= Math.PI * 2;
      this.breathsRemaining -= 1;
      if (this.breathsRemaining <= 0) {
        // Re-draw the cycle length so breathing never loops identically.
        this.breathCycle = this.random.fromRange("breath-cycle", { min: 4.1, max: 5.6 });
        this.breathsRemaining = 3 + Math.floor(this.random.next("breath-count") * 3);
      }
    }
  }

  // --- speaking upper face -----------------------------------------------------

  private updateSpeechUpperFace(preset: NaturalismPreset, options: HumanBehaviorUpdateOptions) {
    if (options.blocked) return;
    const speaking = this.state === "speaking" || this.state === "entering-speech";
    if (!speaking) return;
    /**
     * FINAL CONVERGENCE. With a conductor active this scheduler stops FIRING.
     *
     * It is the independent speaking expression scheduler the brief rules out:
     * its two reasons — a loud onset after a quiet gap, and an approaching
     * boundary — are decided from energy and from pause structure, so it can and
     * does raise a brow on a word the head is not emphasising. The conducted
     * face reads the same anchor as the head instead.
     *
     * Only the FIRING stops. The envelopes already in flight keep running to
     * their natural end through `writeSpeechUpperFace`, so switching modes
     * mid-utterance cannot drop an expression that is halfway through — and with
     * the conductor off, nothing here changes at all.
     */
    if (options.speechPerformance) return;

    // Reason one: a loud onset after a quiet gap. Unchanged, and deliberately so —
    // §9 measured this at 0.52/0.50 against word starts, which is real coupling
    // worth keeping. §10 adds a second reason, it does not replace this one.
    const energy = clamp(options.speechEnergy, 0, 1);
    const wasQuiet = this.time - this.energyAboveAt >= preset.speech.phraseGapSeconds;
    if (energy >= preset.speech.phraseOnsetEnergy) {
      if (wasQuiet) this.onPhraseOnset(preset, options.speechAsymmetrySide);
      this.energyAboveAt = this.time;
    }

    // Reason two: an approaching sentence or phrase boundary (§10).
    //
    // §9's Finding 2 is that brow and warmth track loudness rather than meaning —
    // 0.93 and 1.05 against sentence ends, i.e. chance, at exactly the landmark
    // where a real speaker's brows are most active. Energy cannot see a sentence
    // ending; it only sees one starting. This is the case it is blind to.
    //
    // Fired slightly BEFORE the boundary, inside `browWindowSeconds`, because the
    // brow leads the end of a phrase rather than following it — and because the
    // behaviour state is still `speaking` there, so the emphasis has somewhere to
    // land. `onPhraseOnset` then applies the same spacing guards and probability
    // rolls as the energy path, so this cannot make the brow busier than the preset
    // allows, and cannot make it deterministic.
    this.updateBoundaryEmphasis(preset, options);
  }

  /** The boundary firing reason for brow emphasis and warmth. See `updateSpeechUpperFace`. */
  private updateBoundaryEmphasis(preset: NaturalismPreset, options: HumanBehaviorUpdateOptions) {
    const boundary = options.speechBoundary;
    if (!boundary) return;
    const config = preset.speech.boundary;
    if (config.browWindowSeconds <= 0) return;
    const { secondsToNextStart } = boundary;
    if (!Number.isFinite(secondsToNextStart) || secondsToNextStart < 0 || secondsToNextStart > config.browWindowSeconds) return;
    // At most one attempt per boundary, whether or not the attempt succeeds.
    if (boundary.nextIndex === this.boundaryEmphasisIndex) return;
    this.boundaryEmphasisIndex = boundary.nextIndex;
    const probability = boundary.kind === "sentence" ? config.browSentenceProbability : config.browPhraseProbability;
    if (!this.random.chance("speech-boundary-emphasis", probability)) return;
    this.emitEmphasis(
      preset,
      options.speechAsymmetrySide,
      "boundary",
      {
        // Shared spacing: a boundary pulse yields to a recent pulse of either reason.
        brow: this.time - this.lastEmphasisAt >= config.browSpacingSeconds,
        warmth: this.time - this.lastWarmthAt >= config.warmthSpacingSeconds
      },
      // Brow is already gated by the per-boundary roll above; see `emitEmphasis`.
      // Warmth keeps a roll of its own, because a smile pulse at every sentence end
      // is more warmth than a speaker actually produces — the first cut fired it on
      // every boundary and raised the warmth event count 64%, which is "more
      // animated", not "more coordinated".
      { brow: 1, warmth: config.warmthBoundaryProbability }
    );
  }

  /**
   * Resolves which side an expression leads on at a phrase onset.
   *
   * During speech the coordinated speech layer has already committed to a
   * phrase-level side for the mouth, derived from its own seeded phrase hash. Two
   * independent draws — this controller's `memory.pickSide()` on one random stream
   * and that hash on another — disagree roughly half the time, which reads as the
   * face being pulled two ways inside one phrase. So the mouth's side wins while it
   * exists, and `memory` still records it so the silent-side history stays honest.
   *
   * "balanced" means the coordinated layer is not running (male, legacy mode, or
   * asymmetry disabled), and then this falls back to the local draw unchanged.
   */
  private resolveSide(key: string, authoritative: "left" | "right" | "balanced" | undefined): BehaviorSide {
    if (authoritative === "left" || authoritative === "right") {
      this.memory.recordSide(authoritative);
      return authoritative;
    }
    const preferred: BehaviorSide = this.random.next(key) < 0.5 ? "left" : "right";
    const side = this.memory.pickSide(preferred);
    this.memory.recordSide(side);
    return side;
  }

  /**
   * The energy firing reason: unchanged spacing, unchanged probability.
   *
   * Its gate reads `lastEnergyEmphasisAt`, which only energy pulses advance, so a
   * boundary pulse can never suppress an energy one. That asymmetry is deliberate and
   * is what keeps §9's measured word-start coupling intact — see `emitEmphasis`.
   */
  private onPhraseOnset(preset: NaturalismPreset, authoritativeSide: "left" | "right" | "balanced" | undefined) {
    this.emitEmphasis(preset, authoritativeSide, "energy", {
      brow: this.time - this.lastEnergyEmphasisAt >= preset.speech.browEmphasisSpacing,
      warmth: this.time - this.lastEnergyWarmthAt >= 4
    });
  }

  /**
   * Brow emphasis and warmth, with both gates decided by the caller.
   *
   * @param allow Whether each pulse is permitted at all. The two firing reasons read
   *   DIFFERENT spacing state, and the asymmetry is the point:
   *
   *   - energy checks `lastEnergyEmphasisAt` / `lastEnergyWarmthAt`, which only energy
   *     pulses advance. The energy stream is therefore bit-identical to its pre-§10
   *     self no matter what the boundary path does.
   *   - boundary checks `lastEmphasisAt` / `lastWarmthAt`, which BOTH paths advance, so
   *     a boundary pulse yields to a recent energy pulse rather than stacking on it.
   *
   *   Sharing one counter, as the first cut did, cost the energy path 43 of its 193
   *   events on the audit clip — a 22% loss — because each boundary pulse started the
   *   2.6 s `browEmphasisSpacing` shadow over the energy trigger. §9's Finding 2 is
   *   explicit that the 0.52 word-start correlation is real coupling to preserve, so
   *   §10 has to be purely additive; spending existing events to buy new ones would
   *   have been a trade dressed up as a fix.
   * @param probability Chance each pulse is taken once `allow` permits it. The energy
   *   path passes the preset values. The boundary path passes 1 for brow, because it
   *   has ALREADY rolled its own per-boundary probability — rolling
   *   `browEmphasisProbability` a second time on top of it was an unintended double
   *   gate that discarded 55% of the events this pass adds.
   */
  private emitEmphasis(
    preset: NaturalismPreset,
    authoritativeSide: "left" | "right" | "balanced" | undefined,
    reason: Exclude<EmphasisReason, null>,
    allow: { brow: boolean; warmth: boolean },
    probability: { brow: number; warmth: number } = {
      brow: preset.speech.browEmphasisProbability,
      warmth: preset.speech.warmthProbability
    }
  ) {
    // Each reason draws from its OWN named streams. `BehaviorRandom` advances each
    // stream independently, so this is what makes the energy stream bit-identical
    // rather than merely statistically similar: sharing the `speech-brow` stream let
    // every boundary roll shift the energy path's subsequent draws, which moved 4 of
    // its 193 events on the audit clip even with the gates fully separated.
    const stream = (name: string) => (reason === "energy" ? name : `${name}-boundary`);
    // The one gate both firing reasons share (P3). Checked before the probability
    // roll, not after, so a pulse suppressed by the refractory does not consume a
    // draw — that is what makes `browRefractorySeconds: 0` byte-identical to the
    // pre-P3 stream rather than merely equivalent in rate.
    const spaced = this.time - this.lastEmphasisAt >= preset.speech.browRefractorySeconds;
    if (allow.brow && spaced && this.random.chance(stream("speech-brow"), probability.brow)) {
      const rare = this.random.chance(stream("speech-brow-rare"), preset.speech.browEmphasisRareProbability);
      const peak = this.random.fromRange(
        stream("speech-brow-peak"),
        rare ? preset.speech.browEmphasisRarePeak : preset.speech.browEmphasisPeak
      );
      const side = this.resolveSide(stream("speech-brow-side"), authoritativeSide);
      this.browEmphasis = { start: this.time, peak, side: side === "right" ? -1 : 1, reason };
      this.lastEmphasisAt = this.time;
      if (reason === "energy") this.lastEnergyEmphasisAt = this.time;
    }
    if (allow.warmth && this.random.chance(stream("speech-warmth"), probability.warmth)) {
      // The warmth side previously came straight off `random.next("speech-warmth-side")`
      // with no memory and no relation to anything else on the face — a third
      // independent side decision, not the second.
      const side = this.resolveSide(stream("speech-warmth-side"), authoritativeSide);
      this.warmth = {
        start: this.time,
        smile: this.random.fromRange(stream("speech-smile"), preset.speech.smileOffset),
        cheek: this.random.fromRange(stream("speech-cheek"), preset.speech.cheekOffset),
        duration: this.random.fromRange(stream("speech-warmth-duration"), preset.speech.warmthDuration),
        side: side === "right" ? -1 : 1,
        reason
      };
      this.lastWarmthAt = this.time;
      if (reason === "energy") this.lastEnergyWarmthAt = this.time;
    }
  }

  private speechBrowWeight(preset: NaturalismPreset, intensity: ExpressionIntensity = neutralExpressionIntensity) {
    const local = this.time - this.browEmphasis.start;
    // §P15: >1 shortens the phase, so "faster attack" reads the way it says.
    const attack = preset.speech.browEmphasisAttack / intensity.attack;
    const hold = preset.speech.browEmphasisHold;
    const release = preset.speech.browEmphasisRelease / intensity.release;
    if (local < 0 || local > attack + hold + release) return 0;
    if (local < attack) return smoothstep(0, attack, local);
    if (local < attack + hold) return 1;
    return 1 - smoothstep(0, release, local - attack - hold);
  }

  private speechWarmthWeight(intensity: ExpressionIntensity = neutralExpressionIntensity) {
    const local = this.time - this.warmth.start;
    if (local < 0 || this.warmth.duration <= 0 || local > this.warmth.duration) return 0;
    // §P15 shapes the envelope WITHIN the scheduled duration, so a faster attack
    // cannot change how long the pulse occupies the face or how often it fires.
    const attack = (this.warmth.duration * 0.3) / intensity.attack;
    const release = (this.warmth.duration * 0.45) / intensity.release;
    if (local < attack) return smoothstep(0, attack, local);
    if (local < this.warmth.duration - release) return 1;
    return 1 - smoothstep(0, release, local - (this.warmth.duration - release));
  }

  private writeSpeechUpperFace(
    pose: BlendshapePose,
    preset: NaturalismPreset,
    options: HumanBehaviorUpdateOptions,
    behaviourIntensity: number
  ) {
    // Speaking emphasis fades out with the same transition weight as it faded in,
    // so no expression is left frozen on the face after the last phoneme.
    const gain = options.profile.naturalism.speechGain;
    const scale = behaviourIntensity * options.safetyScale * this.transitionWeight;
    if (scale <= 0) return;
    /**
     * §P15 diagnostic multipliers. All 1 in production, so this block is
     * arithmetically inert there: `x * 1` is `x`, and no scheduling, spacing or
     * random draw is touched. Only travel changes.
     */
    const intensity = options.expressionIntensity ?? neutralExpressionIntensity;
    /**
     * The follow side is normally 0.94 of the lead. `asymmetry` widens that
     * spread around the same mean rather than lowering the follow side, so
     * raising it cannot quietly reduce the expression's overall presence.
     */
    const followRatio = clamp(1 - (1 - 0.94) * intensity.asymmetry, 0.5, 1);
    const brow = this.speechBrowWeight(preset, intensity) * this.browEmphasis.peak * scale * gain.brow * intensity.brow;
    if (brow > 0) {
      const lead = this.browEmphasis.side === 1 ? "Left" : "Right";
      const follow = lead === "Left" ? "Right" : "Left";
      pose.browInnerUp = clamp((pose.browInnerUp ?? 0) + brow * 0.72 * intensity.browInner);
      pose[`browOuterUp${lead}`] = clamp((pose[`browOuterUp${lead}`] ?? 0) + brow * intensity.browOuter);
      pose[`browOuterUp${follow}`] = clamp((pose[`browOuterUp${follow}`] ?? 0) + brow * 0.93 * intensity.browOuter * followRatio / 0.94);
    }
    const warmth = this.speechWarmthWeight(intensity);
    if (warmth <= 0) this.reportedWarmth = { smile: 0, cheek: 0, lowerFace: 0 };
    if (warmth > 0) {
      const lead = this.warmth.side === 1 ? "Left" : "Right";
      const follow = lead === "Left" ? "Right" : "Left";
      const smile = this.warmth.smile * warmth * scale * gain.smile * intensity.smile;
      const cheek = this.warmth.cheek * warmth * scale * gain.cheek * intensity.cheek;
      this.reportedWarmth = { smile, cheek, lowerFace: 0 };
      // Warmth is the one contribution here that exists ONLY during speech, so it
      // is the one that persistently collided with the coordinated layer. Skipped
      // per channel rather than as a block: the protected set is a profile value,
      // and a model that owns only some of these channels must still get the rest.
      // Amplitude is why this mattered rather than an abstract ownership rule —
      // at the female speechGain (smile 3.4, cheek 8.5) the warmth peaks reach
      // mouthSmile 0.20 and cheekSquint 0.34 before the idle safety scale, against
      // the coordinated layer's whole corner budget of 0.22 and cheek budget of
      // 0.16. It was not a garnish on the articulated shape; it was larger than it.
      const write = (name: string, amount: number) => {
        if (options.protectedChannels?.has(name)) return;
        pose[name] = clamp((pose[name] ?? 0) + amount);
      };
      write(`mouthSmile${lead}`, smile);
      write(`mouthSmile${follow}`, smile * followRatio);
      write(`cheekSquint${lead}`, cheek);
      write(`cheekSquint${follow}`, cheek * followRatio);
      /**
       * Eyelid support (§P10). The asset's smile reaches the eyes through
       * `cheekSquint`, which moves the lower lid by 0.0116 mm — measurably
       * nothing. This is the only channel that narrows the aperture, so warmth
       * carries a little of it.
       *
       * `Math.max`, not `+=`: `writeBlink` has already run this frame, so adding
       * would deepen an in-progress blink and change its shape. Taking the
       * greater leaves a blink at exactly the value the blink writer chose and
       * lets support apply only when the lid is more open than it asks for.
       *
       * Not routed through `write()` because eyeBlink is not a protected mouth
       * channel and must not be dropped during the coordinated handover — the
       * eyes keep working while the lower face is owned elsewhere.
       */
      /**
       * Gated on the BLINK toggle, not the expression one.
       *
       * The toggle governs the eyelid channel, and a developer who switches
       * blink off to study gaze expects the lids to be silent — the §10 toggle
       * test asserts exactly that. Writing eyelid motion past a disabled eyelid
       * system would make the toggle a half-truth, which is how the first cut of
       * this failed.
       */
      const lidSupport = options.toggles.blink ? warmth * scale * preset.speech.warmthLidSupport * intensity.eyelid : 0;
      // Clipped to the awake ceiling: this is the writer the trace identified.
      this.addLidSupport(pose, preset, lidSupport);
    }
  }

  /**
   * FINAL CONVERGENCE face consumer.
   *
   * The face expresses the SAME anchor as the head, offset in time by the
   * conductor rather than scheduled here. This method makes no decisions: it
   * receives amplitudes and routes each one to whoever owns that channel during
   * speech.
   *
   * OWNERSHIP, unchanged and deliberately so — this is the rule P14 broke and
   * P17 had to restore:
   *
   *   brow    `browInnerUp`/`browOuterUp*` are NOT in the coordinated layer's
   *           `supportedChannels`, so this controller writes them directly.
   *   eyelid  `eyeBlink*` likewise, through `addLidSupport` so the awake ceiling
   *           applies and a real blink still wins.
   *   cheek,  owned by the coordinated speech layer while speech is running, so
   *   smile,  they are REPORTED here and merged there under its ceilings and its
   *   lower   bilabial suppression. Writing them from this side is exactly the
   *   face    collision P14 measured, and it is not re-introduced.
   *
   * Everything scales by `transitionWeight`, the blend this controller already
   * owns, so the conducted face ramps in over `speech.startBlendSeconds` and out
   * over `speech.endFullReturnSeconds`. There is no mode switch to snap at
   * either boundary, and no second smoothing system.
   */
  private writeConductedFace(
    pose: BlendshapePose,
    preset: NaturalismPreset,
    options: HumanBehaviorUpdateOptions,
    behaviourIntensity: number
  ) {
    const intent = options.speechPerformance;
    const speaking = this.state === "speaking" || this.state === "entering-speech";
    if (!intent || !speaking) {
      this.conductedFace = { browInner: 0, browOuter: 0, cheek: 0, smile: 0, lowerFace: 0, eyelid: 0 };
      return;
    }
    const scale = behaviourIntensity * options.safetyScale * this.transitionWeight;
    if (scale <= 0) {
      this.conductedFace = { browInner: 0, browOuter: 0, cheek: 0, smile: 0, lowerFace: 0, eyelid: 0 };
      return;
    }
    const gain = options.profile.naturalism.speechGain;
    const face = intent.face;
    /**
     * The side follows the phrase-level side the coordinated layer already
     * chose, for the same reason the warmth pulse does: two independent draws
     * disagree about half the time and read as the face being pulled two ways
     * inside one phrase.
     */
    const lead = options.speechAsymmetrySide === "right" ? "Right" : "Left";
    const follow = lead === "Left" ? "Right" : "Left";

    const browInner = face.browInner * scale * gain.brow;
    const browOuter = face.browOuter * scale * gain.brow;
    if (browInner > 0) pose.browInnerUp = clamp((pose.browInnerUp ?? 0) + browInner);
    if (browOuter > 0) {
      pose[`browOuterUp${lead}`] = clamp((pose[`browOuterUp${lead}`] ?? 0) + browOuter);
      pose[`browOuterUp${follow}`] = clamp((pose[`browOuterUp${follow}`] ?? 0) + browOuter * 0.94);
    }
    // Awake support only. The ceiling is enforced inside, and a blink still wins.
    if (options.toggles.blink) this.addLidSupport(pose, preset, face.eyelid * scale * gain.eye);

    /**
     * Reported, not written. `AvatarController` carries this to the coordinated
     * layer as `expressionWarmth`, which is the single owner of these channels
     * during speech.
     */
    this.reportedWarmth = {
      smile: face.smile * scale * gain.smile,
      cheek: face.cheek * scale * gain.cheek,
      lowerFace: face.lowerFace * scale
    };
    this.conductedFace = {
      browInner, browOuter,
      cheek: this.reportedWarmth.cheek,
      smile: this.reportedWarmth.smile,
      lowerFace: this.reportedWarmth.lowerFace,
      eyelid: Math.min(face.eyelid * scale * gain.eye, preset.speech.awakeLidCeiling)
    };
  }

  // --- head and neck -----------------------------------------------------------

  private updateHead(
    preset: NaturalismPreset,
    options: HumanBehaviorUpdateOptions,
    eventHead: HeadRotationTarget,
    stillnessActive: boolean,
    behaviourIntensity: number,
    deltaSeconds: number
  ): HeadRotationTarget {
    if (!options.headSupported || !options.toggles.headBehavior || options.blocked) {
      this.headHistory.length = 0;
      return zeroHead();
    }

    const presence = preset.head.presence;
    const presenceActive = presence.scale > 1 || presence.restingMigration > 0;

    /**
     * §P28. Leave a side pose EARLIER without making it SMALLER.
     *
     * The excursion is drawn at full size and the head still arrives at the
     * same peak; once `postureDwellFraction` of the hold has elapsed it eases
     * back toward `postureBase` — the migrated resting orientation plus the
     * state's bias — over the remainder, landing at `postureRecoveryFloor` of
     * the drawn excursion. So the return is PART OF the way home rather than to
     * centre, and the redraw cadence is untouched, which is what keeps head
     * travel from rising the way halving `postureHold` did.
     *
     * The eyes-only window (30% of holds) freezes the follower on
     * `postureCurrent` and ignores the target, so a recovery that starts inside
     * one is simply chased when the window closes — later, but still smoothly,
     * and the measurements below already include that case. Gating the ease on
     * it would change eyes-only behaviour, which this pass must not do.
     *
     * Min-jerk rather than a linear or exponential ease: it leaves the dwell
     * with zero velocity AND zero acceleration, so the departure from the pose
     * has no corner in it for the follower to chase, and it arrives at the
     * floor the same way instead of creeping.
     */
    const dwellFraction = presence.postureDwellFraction;
    if (presenceActive && dwellFraction < 1 && !stillnessActive && this.postureHoldFrom > -900) {
      const hold = this.postureHoldUntil - this.postureHoldFrom;
      const dwellEnd = this.postureHoldFrom + hold * dwellFraction;
      if (hold > 1e-4 && this.time > dwellEnd) {
        const tau = clamp((this.time - dwellEnd) / (hold * (1 - dwellFraction)), 0, 1);
        const shape = minimumJerkShape(tau);
        const excFactor = 1 - (1 - presence.postureRecoveryFloor) * shape;
        // The migrated home comes partway back too — see `postureRecoveryRestShare`.
        // `this.resting` is NOT touched, so the next pose is still drawn from
        // the full home and the migration walk keeps its own spread.
        const restFactor = 1 - (1 - presence.postureRecoveryRestShare) * shape;
        this.postureTarget = {
          yaw: this.postureBias.yaw + this.postureRest.yaw * restFactor + this.postureExcursion.yaw * excFactor,
          pitch: this.postureBias.pitch + this.postureRest.pitch * restFactor + this.postureExcursion.pitch * excFactor,
          roll: this.postureBias.roll + this.postureExcursion.roll * excFactor
        };
        // The neck keeps the share it was drawn with, so head and neck ease as
        // one chain instead of the neck holding a pose the head has left.
        this.neckTarget = {
          yaw: this.postureTarget.yaw * presence.neckShare * this.intent.neckSupport,
          pitch: this.postureTarget.pitch * presence.neckShare * 0.6 * this.intent.neckSupport,
          roll: this.postureTarget.roll * presence.neckShare * 0.4 * this.intent.neckSupport
        };
      }
    }

    // Slow posture drift toward held targets, not a continuous oscillator.
    if (!stillnessActive && this.time >= this.postureHoldUntil) {
      const sign = this.random.signAvoiding("posture-side", this.postureSign);
      this.postureSign = sign;
      if (presenceActive) {
        /**
         * §P16. The orientation is drawn around a RESTING orientation that
         * itself migrates, instead of around zero.
         *
         * P15 redrew the target as `sign * range(0.25,1) * amplitude`, so every
         * excursion was measured from mathematical centre and the head passed
         * back through centre between every pair of them. That is the whole
         * front-locked reading, and no amount of extra amplitude fixes it —
         * a larger excursion around zero is still an avatar that keeps
         * returning to dead ahead.
         *
         * `returnToUserProbability` keeps this attentive rather than wandering:
         * a fraction of changes deliberately come back toward the user, so the
         * face is not slowly drifting away over a long listen.
         */
        const returning = this.random.chance("presence-return", presence.returnToUserProbability);
        const yawSpan = presence.restingYawDegrees;
        const pitchSpan = presence.restingPitchDegrees;
        const migrate = presence.restingMigration;
        const targetRestYaw = returning
          ? this.resting.yaw * (1 - migrate)
          : clamp(this.resting.yaw + sign * this.random.range("presence-yaw", 0.3, 1) * yawSpan * migrate, -yawSpan, yawSpan);
        const targetRestPitch = returning
          ? this.resting.pitch * (1 - migrate)
          : clamp(this.resting.pitch + this.random.range("presence-pitch", -1, 1) * pitchSpan * migrate, -pitchSpan, pitchSpan);
        this.resting = { yaw: targetRestYaw, pitch: targetRestPitch };
        const scale = presence.scale;
        /**
         * §P17. The state's orientation bias is ADDED to the P16 target, not
         * substituted for it. P16's amplitude, migration and randomness are
         * untouched — the state leans the whole thing, which is what makes the
         * head look motivated rather than scheduled.
         */
        this.postureTarget = {
          yaw: this.resting.yaw + sign * this.random.range("posture-yaw", 0.25, 1) * preset.head.postureYawDegrees * scale + this.intent.headYawBias,
          pitch: this.resting.pitch + this.random.range("posture-pitch", -1, 1) * preset.head.posturePitchDegrees * scale + this.intent.headPitchBias,
          roll: sign * this.random.range("posture-roll", 0.2, 1) * preset.head.postureRollDegrees * scale + this.intent.headRollBias
        };
        /**
         * The neck carries a share of the YAW and leads the head slightly, so
         * the turn starts at the base of the neck instead of the head pivoting
         * on a stick. Measured as free to choose: at a fixed total yaw, moving
         * 0-50% of it onto the neck changes scalp travel by under 6% and adds
         * no neck stretch (range-sweeps.json).
         */
        this.neckTarget = {
          // §P17 states scale the neck's share of the turn without changing P16's
          // share for a state that does not ask for it (neckSupport defaults to 1).
          yaw: this.postureTarget.yaw * presence.neckShare * this.intent.neckSupport,
          pitch: this.postureTarget.pitch * presence.neckShare * 0.6 * this.intent.neckSupport,
          roll: this.postureTarget.roll * presence.neckShare * 0.4 * this.intent.neckSupport
        };
        this.neckArrivesAt = this.time + presence.neckLeadSeconds;
        // §P28. The drawn pose, decomposed so the ease can return off the home
        // and the excursion by different amounts. Frozen at draw time, matching
        // how `postureTarget` has always been a snapshot of the intent.
        this.postureBias = {
          yaw: this.intent.headYawBias,
          pitch: this.intent.headPitchBias,
          roll: this.intent.headRollBias
        };
        this.postureRest = { yaw: this.resting.yaw, pitch: this.resting.pitch, roll: 0 };
        this.postureExcursion = {
          yaw: this.postureTarget.yaw - this.postureBias.yaw - this.postureRest.yaw,
          pitch: this.postureTarget.pitch - this.postureBias.pitch - this.postureRest.pitch,
          roll: this.postureTarget.roll - this.postureBias.roll
        };
        // Sometimes the eyes go and the head never follows; sometimes they lead it.
        this.eyesOnlyUntil = this.random.chance("presence-eyes-only", presence.eyesOnlyProbability)
          ? this.time + this.random.fromRange("posture-hold", preset.head.postureHold)
          : -999;
        /**
         * The head waits only when the eyes have ACTUALLY gone somewhere.
         *
         * A first cut held the head for `gazeLeadSeconds` on every orientation
         * change regardless of what the eyes were doing, which is a delay with
         * no cause — it reads as hesitation, not as the head following the
         * eyes. Gated on the gaze already being committed away, this is a real
         * eyes-then-head sequence when one occurs and a no-op otherwise.
         */
        const eyesAlreadyAway =
          Math.abs(this.gaze.committedYawDegrees(preset.gaze)) >= preset.head.gazeFollowThresholdDegrees;
        this.gazeLeadUntil =
          eyesAlreadyAway && this.random.chance("presence-gaze-leads", presence.gazeLeadsProbability)
            ? this.time + presence.gazeLeadSeconds
            : -999;
        this.postureHoldUntil =
          this.time + this.random.fromRange("posture-hold", preset.head.postureHold) * presence.holdScale;
        this.postureHoldFrom = this.time;
      } else {
        this.postureTarget = {
          yaw: sign * this.random.range("posture-yaw", 0.25, 1) * preset.head.postureYawDegrees,
          pitch: this.random.range("posture-pitch", -1, 1) * preset.head.posturePitchDegrees,
          roll: sign * this.random.range("posture-roll", 0.2, 1) * preset.head.postureRollDegrees
        };
        this.postureHoldUntil = this.time + this.random.fromRange("posture-hold", preset.head.postureHold);
        this.postureHoldFrom = -999;
      }
      this.memory.lastHeadDirection = sign > 0 ? "right" : "left";
    }

    if (presenceActive && presence.followerHz > 0) {
      /**
       * Critically damped follower, integrated from the CURRENT velocity.
       *
       * A first-order lag (what P15 used) starts every move at maximum speed
       * and decays — the acceleration is discontinuous at the start, which is
       * exactly the jerk the review reported. A critically damped second-order
       * system accelerates and decelerates smoothly, cannot overshoot, and
       * carries its velocity across a re-target, so a new orientation arriving
       * mid-turn redirects the head instead of restarting it.
       */
      /**
       * §P17 objective A: the hardware verdict was "range good, smoothness
       * good, a little slow", so ONLY the follower's natural frequency moves.
       *
       * Raising `w` on a critically damped system shortens the settling time
       * without changing where it settles and without introducing overshoot —
       * the damping ratio stays exactly 1 because the damping term is `2w`. The
       * amplitude, the migrating resting orientation, the neck share and the
       * velocity-preserving retarget are all untouched by construction.
       *
       * The state's own `transitionSpeed` rides on top, so an INTERESTED
       * reaction arrives faster than a THOUGHTFUL one.
       */
      const w = presence.followerHz * (presence.responseScale ?? 1) * this.intent.transitionSpeed * 2 * Math.PI;
      const dt = deltaSeconds;
      const step = (current: number, target: number, velocity: number) => {
        const accel = w * w * (target - current) - 2 * w * velocity;
        const nextVelocity = velocity + accel * dt;
        return { value: current + nextVelocity * dt, velocity: nextVelocity };
      };
      // While the eyes-only window is open the head holds where it is.
      const holding = this.time < this.eyesOnlyUntil || this.time < this.gazeLeadUntil;
      const yawTarget = holding ? this.postureCurrent.yaw : this.postureTarget.yaw;
      const pitchTarget = holding ? this.postureCurrent.pitch : this.postureTarget.pitch;
      const rollTarget = holding ? this.postureCurrent.roll : this.postureTarget.roll;
      const y = step(this.postureCurrent.yaw, yawTarget, this.orientVelocity.yaw);
      const p = step(this.postureCurrent.pitch, pitchTarget, this.orientVelocity.pitch);
      const r = step(this.postureCurrent.roll, rollTarget, this.orientVelocity.roll);
      this.postureCurrent.yaw = y.value; this.orientVelocity.yaw = y.velocity;
      this.postureCurrent.pitch = p.value; this.orientVelocity.pitch = p.velocity;
      this.postureCurrent.roll = r.value; this.orientVelocity.roll = r.velocity;
      // The neck runs the same follower a little ahead of the head.
      const neckActive = this.time >= this.neckArrivesAt - presence.neckLeadSeconds;
      const nAlpha = exponentialSmoothingAlpha(presence.followerHz * 4, deltaSeconds);
      for (const axis of ["yaw", "pitch", "roll"] as const) {
        const target = neckActive && !holding ? this.neckTarget[axis] : this.neckCurrent[axis];
        this.neckCurrent[axis] += (target - this.neckCurrent[axis]) * nAlpha;
      }
    } else {
      const postureAlpha = exponentialSmoothingAlpha(preset.head.postureSmoothingSpeed, deltaSeconds);
      this.postureCurrent.yaw += (this.postureTarget.yaw - this.postureCurrent.yaw) * postureAlpha;
      this.postureCurrent.pitch += (this.postureTarget.pitch - this.postureCurrent.pitch) * postureAlpha;
      this.postureCurrent.roll += (this.postureTarget.roll - this.postureCurrent.roll) * postureAlpha;
    }

    // The head follows gaze only when the eyes commit: past a threshold, held
    // long enough, and after a delay. It never follows a micro-saccade.
    const committed = this.gaze.committedYawDegrees(preset.gaze);
    const away = Math.abs(committed) >= preset.head.gazeFollowThresholdDegrees;
    if (away) {
      if (this.gazeAwaySince < 0) this.gazeAwaySince = this.time;
      if (this.time - this.gazeAwaySince >= preset.head.gazeFollowDwell) {
        if (this.headFollowArmedAt < 0) this.headFollowArmedAt = this.time + preset.head.gazeFollowDelay;
        /**
         * §P16 scales the EXISTING P8 gaze-follow rather than adding a second
         * one. P8's scheduler, thresholds and dwell are untouched; only how far
         * the head carries a committed glance changes.
         */
        if (this.time >= this.headFollowArmedAt) {
          /**
           * IDLE ENGAGEMENT scales this down. The head chasing the eyes is what
           * turns a glance into a disengagement — the two then add in world
           * space — so with the viewer anchored the head may still drift with
           * attention but must not follow every excursion.
           */
          const followScale = options.idleEngagement ? this.engagement.headFollowScale() : 1;
          this.headFollowTarget = committed * preset.head.gazeFollowRatio * Math.max(1, presence.scale * 0.25) * followScale;
        }
      }
    } else {
      this.gazeAwaySince = -1;
      this.headFollowArmedAt = -1;
      // Eyes return first; the head returns more slowly.
      this.headFollowTarget = 0;
    }
    const followAlpha = exponentialSmoothingAlpha(away ? 2.4 : 1.1, deltaSeconds);
    this.headFollowCurrent += (this.headFollowTarget - this.headFollowCurrent) * followAlpha;

    // `speakingIdleContribution` normally leaves a fraction of the idle head alive
    // while speaking (0.12). With stabilisation on, the contribution goes to zero
    // instead — the same expression, the same blend curve, one term changed — so
    // the head arrives at exactly still rather than at slightly-drifting, and gets
    // there on the existing transition rather than on a new one.
    /**
     * §P16. The idle clamp scales with presence.
     *
     * `idleHeadLimits` is 1.7 deg of yaw. It was the SECOND cap on the idle
     * head, behind the 0.34 deg posture amplitude, and leaving it in place
     * would have silently swallowed every increase this pass makes. It is
     * scaled, not removed: at presence scale 1 it is exactly the P15 value.
     */
    const limitScale = Math.max(1, presence.scale);
    const limits = {
      pitch: idleHeadLimits.pitch * limitScale,
      yaw: idleHeadLimits.yaw * limitScale,
      roll: idleHeadLimits.roll * limitScale
    };
    /**
     * §P18. `speakingIdleFloor` replaces the retained idle fraction during
     * ESTABLISHED speech, so the exploratory idle head stops driving the pose
     * while the conversational layer owns it.
     *
     * Deliberately expressed through `transitionWeight`, the blend this
     * controller already uses to fade between listening and speaking — so the
     * suppression inherits that fade in BOTH directions and neither entering
     * nor leaving speech can snap. At `transitionWeight` 0 the expression is
     * arithmetically the old one, which is why idle behaviour is untouched.
     */
    const floor = preset.head.speakingIdleFloor;
    const retained = floor === null ? preset.head.speakingIdleContribution : floor;
    const speakingIdleContribution = options.stabilizeHeadDuringSpeech ? 0 : retained;
    const idleWeight = behaviourIntensity * (1 - this.transitionWeight * (1 - speakingIdleContribution));
    const head: HeadRotationTarget = {
      pitch: clamp(
        degreesToRadians(this.postureCurrent.pitch) * idleWeight + eventHead.pitch * preset.head.eventScale * idleWeight,
        -limits.pitch,
        limits.pitch
      ),
      yaw: clamp(
        degreesToRadians(this.postureCurrent.yaw + this.headFollowCurrent) * idleWeight +
          eventHead.yaw * preset.head.eventScale * idleWeight,
        -limits.yaw,
        limits.yaw
      ),
      roll: clamp(
        degreesToRadians(this.postureCurrent.roll) * idleWeight + eventHead.roll * preset.head.eventScale * idleWeight,
        -limits.roll,
        limits.roll
      )
    };

    /**
     * Remove the share the neck is carrying, so head-plus-neck composes to the
     * orientation that was actually asked for.
     */
    if (presenceActive) {
      /**
       * Scaled by `idleWeight`, like the head it compensates.
       *
       * Unweighted, this term survived the speaking suppression: with the idle
       * head driven to zero the subtraction left `-neckCurrent` behind, so the
       * idle layer still moved the head by 1.56 deg during speech while
       * reporting a zero contribution. The compensation only makes sense in
       * proportion to the head it is compensating.
       */
      head.yaw -= degreesToRadians(this.neckCurrent.yaw) * idleWeight;
      head.pitch -= degreesToRadians(this.neckCurrent.pitch) * idleWeight;
      head.roll -= degreesToRadians(this.neckCurrent.roll) * idleWeight;
      this.neckIdleWeight = idleWeight;
    } else {
      this.neckIdleWeight = 1;
    }

    this.headHistory.push({ time: this.time, head: { ...head } });
    while (this.headHistory.length > 240) this.headHistory.shift();
    return head;
  }

  private updateNeck(preset: NaturalismPreset, head: HeadRotationTarget, _deltaSeconds: number): HeadRotationTarget {
    /**
     * §P16. With presence active the neck LEADS instead of lagging.
     *
     * The shipped neck was a delayed copy of the head at 0.2 — the base of the
     * neck arrived after the skull had already turned, which is the "head
     * rotating on a stick" reading. Anatomically the base initiates and the
     * head completes, so `neckCurrent` runs slightly ahead and the head output
     * is reduced by the same share (see `updateHead`), leaving the COMPOSED
     * rotation equal to the intended orientation rather than 1 + neckShare
     * times it. The bones compose: `head` is a descendant of `neck_01`.
     */
    const presence = preset.head.presence;
    if (presence.scale > 1 || presence.restingMigration > 0) {
      return {
        pitch: degreesToRadians(this.neckCurrent.pitch) * this.neckIdleWeight,
        yaw: degreesToRadians(this.neckCurrent.yaw) * this.neckIdleWeight,
        roll: degreesToRadians(this.neckCurrent.roll) * this.neckIdleWeight
      };
    }
    if (!this.headHistory.length) return zeroHead();
    // The neck reproduces a fraction of the head, delayed in real time.
    const targetTime = this.time - preset.head.neckDelay;
    let sample = this.headHistory[0];
    for (const entry of this.headHistory) {
      if (entry.time <= targetTime) sample = entry;
      else break;
    }
    const source = sample.time <= targetTime ? sample.head : head;
    return {
      pitch: source.pitch * preset.head.neckContribution,
      yaw: source.yaw * preset.head.neckContribution,
      roll: source.roll * preset.head.neckContribution
    };
  }

  // --- debug -------------------------------------------------------------------

  private buildDebug(
    preset: NaturalismPreset,
    options: HumanBehaviorUpdateOptions,
    gazeScale: number,
    stillnessActive: boolean,
    eventPhase: string,
    activeChannels: string[]
  ): HumanBehaviorDebugState {
    return {
      enabled: !options.blocked,
      presetId: preset.id,
      seed: this.random.seed,
      behaviorState: this.state,
      listeningSubstate: this.substate,
      speechTransitionWeight: this.transitionWeight,
      blink: this.blink.debug(),
      gaze: this.gaze.debug(gazeScale, preset.gaze),
      stillness: {
        active: stillnessActive,
        remainingSeconds: Math.max(0, this.stillnessUntil - this.time),
        recentEventCount: this.memory.density(this.time, preset.stillness.densityWindowSeconds),
        lastDurationSeconds: this.lastStillnessDuration
      },
      memory: this.memory.debug(this.time, preset.stillness.densityWindowSeconds),
      currentEvent: this.events.currentId(),
      currentEventPhase: eventPhase,
      currentEventSide: this.events.currentSide(),
      nextEventInSeconds: Math.max(0, this.nextEventAt - this.time),
      headTarget: { ...this.head },
      neckTarget: { ...this.neck },
      headFollowDegrees: this.headFollowCurrent,
      headPostureDegrees: this.postureCurrent.yaw,
      speakingBrowWeight: this.speechBrowWeight(preset) * this.browEmphasis.peak,
      speakingSmileWeight: this.speechWarmthWeight() * this.warmth.smile,
      speakingWarmth: { ...this.reportedWarmth },
      conducted: {
        active: Boolean(options.speechPerformance) && (this.state === "speaking" || this.state === "entering-speech"),
        gazeMode: this.conductedGaze.mode,
        gazeYawBias: this.conductedGaze.yaw,
        gazePitchBias: this.conductedGaze.pitch,
        gazeStability: this.conductedGaze.stability,
        browInner: this.conductedFace.browInner,
        browOuter: this.conductedFace.browOuter,
        cheek: this.conductedFace.cheek,
        smile: this.conductedFace.smile,
        lowerFace: this.conductedFace.lowerFace,
        // The two eyelid sources, kept apart on purpose. See `addLidSupport`.
        stateEyelid: this.conductedFace.eyelid,
        blinkEyelid: this.blink.values().left,
        finalEyelid: this.pose.eyeBlinkLeft ?? 0
      },
      idleEngagement: this.lastEngagement,
      /** §P17 stage trace: what THIS controller put in the pose, before any merge. */
      stageTrace: {
        cheekLeft: this.pose.cheekSquintLeft ?? 0,
        smileLeft: this.pose.mouthSmileLeft ?? 0,
        browInnerUp: this.pose.browInnerUp ?? 0
      },
      performance: {
        state: this.intent.state,
        previous: this.intent.previous,
        timeInState: this.intent.timeInState,
        nextTransitionIn: this.director.nextTransitionIn(),
        held: this.director.heldState(),
        cheek: this.intent.cheek, eyelid: this.intent.eyelid,
        browInner: this.intent.browInner, browOuter: this.intent.browOuter,
        smile: this.intent.smile, asymmetry: this.intent.asymmetry,
        upperLip: this.intent.upperLip, nasolabial: this.intent.nasolabial, lowerLip: this.intent.lowerLip,
        headYawBias: this.intent.headYawBias, headPitchBias: this.intent.headPitchBias, headRollBias: this.intent.headRollBias
      },
      speakingBrowSide: this.browEmphasis.side === 1 ? "left" : "right",
      speakingWarmthSide: this.warmth.side === 1 ? "left" : "right",
      speakingBrowReason: this.browEmphasis.reason,
      speakingWarmthReason: this.warmth.reason,
      speechAsymmetrySide: options.speechAsymmetrySide ?? "balanced",
      protectedChannels:
        this.state === "speaking" || this.state === "entering-speech"
          ? [...(options.protectedChannels ?? [])]
          : [],
      idleMouthFade: this.mouthFade,
      activeCanonicalChannels: activeChannels
    };
  }
}
