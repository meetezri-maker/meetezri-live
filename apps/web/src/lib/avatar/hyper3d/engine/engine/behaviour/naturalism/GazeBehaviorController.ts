import type { NaturalismGazeConfig } from "../../../mappings/naturalismPresets";
import type { GazeDebugState, GazeMode } from "../../../types/behaviorNaturalism";
import { clamp } from "../../../utils/clamp";
import { smoothstep } from "../../../utils/easing";
import { exponentialSmoothingAlpha } from "../../../utils/lerp";
import type { BehaviorRandom } from "./BehaviorRandom";

type Direction = "left" | "right" | "center";

/**
 * Everything this class is told about speech, resolved by the caller (§10).
 *
 * Relative to now, like the blink equivalent, and `undefined` when no boundary
 * information exists — which must reproduce pre-§10 mode advancement exactly.
 */
export interface GazeBoundaryBias {
  /** Seconds until speech next stops. */
  secondsToNextStart: number;
  windowSeconds: number;
  /** Multiplier on `briefThoughtProbability`, at its full value on the boundary. */
  probabilityGain: number;
  /**
   * How far a hold may be STRETCHED so that it expires on a boundary instead of
   * shortly before one.
   *
   * Deliberately a deferral and not an advance. Cutting holds short to reach a
   * boundary was the first design, and measured over 16 seeds it raised the gaze-shift
   * count from 90 to between 103 and 144 depending on the window, because ending holds
   * early means more holds per clip. The apparent improvement in mean distance to a
   * boundary was mostly that extra volume, and distance to SENTENCE boundaries did not
   * improve at all. Stretching instead leaves the number of holds unchanged — each one
   * still ends exactly once — and only moves where the shift lands.
   */
  deferSeconds: number;
}

/** 1 on the boundary, easing linearly to 0 at the edge of the window. */
const boundaryNearness = (bias: GazeBoundaryBias | undefined) => {
  if (!bias || bias.windowSeconds <= 0) return 0;
  const { secondsToNextStart } = bias;
  if (!Number.isFinite(secondsToNextStart) || secondsToNextStart < 0 || secondsToNextStart > bias.windowSeconds) return 0;
  return 1 - secondsToNextStart / bias.windowSeconds;
};

const directionOf = (yaw: number, threshold: number): Direction =>
  yaw > threshold ? "right" : yaw < -threshold ? "left" : "center";

/**
 * Human gaze with three modes and no continuous scanning.
 *
 * The default is a long, stable hold near the user. Movement away is a discrete
 * decision with a bounded duration, and the way back is a gradual soft return
 * rather than a snap to exact centre. Micro-saccades are short discrete pulses,
 * not a per-frame oscillator.
 */
export class GazeBehaviorController {
  private time = 0;
  private mode: GazeMode = "user-focus";
  private modeEndsAt = 0;
  private targetYaw = 0;
  private targetPitch = 0;
  private currentYaw = 0;
  private currentPitch = 0;
  private lastDirection: Direction = "center";
  private lastSign: -1 | 0 | 1 = 0;
  private driftPhase = 0;
  /** Quiet holds keep glances small rather than suppressing them. */
  private stillnessActive = false;
  private driftCycle = 8;
  private microSaccadeAt = 0;
  private microSaccadeUntil = -1;
  private microSaccadeYaw = 0;
  private microSaccadePitch = 0;
  /** Offset contributed by the active expression event, applied on top of the mode target. */
  private eventYaw = 0;
  private eventPitch = 0;
  /** Last time a boundary ended a hold early, so one boundary can only do it once. */
  private boundaryAdvanceAt = -999;
  /** When the eyes last committed to a glance, for the section P8 tail ceiling. */
  private lastGlanceAt = 0;
  private wasSpeaking = false;
  private speakingNow = false;
  /** Last frame's autonomous damping. 1 until a conductor asks otherwise. */
  private autonomousScale = 1;

  constructor(private random: BehaviorRandom) {}

  reset(config: NaturalismGazeConfig, time = 0) {
    this.time = time;
    this.mode = "user-focus";
    this.targetYaw = 0;
    this.targetPitch = 0;
    this.currentYaw = 0;
    this.currentPitch = 0;
    this.lastDirection = "center";
    this.lastSign = 0;
    this.stillnessActive = false;
    this.eventYaw = 0;
    this.eventPitch = 0;
    this.microSaccadeUntil = -1;
    this.microSaccadeYaw = 0;
    this.microSaccadePitch = 0;
    this.boundaryAdvanceAt = -999;
    this.lastGlanceAt = time;
    this.wasSpeaking = false;
    this.speakingNow = false;
    this.autonomousScale = 1;
    this.driftPhase = this.random.range("gaze-drift-phase", 0, Math.PI * 2);
    this.driftCycle = this.random.fromRange("gaze-drift-cycle", config.driftCycle);
    this.modeEndsAt = time + this.holdDuration(config);
    this.microSaccadeAt = time + this.random.fromRange("gaze-micro", config.microSaccadeInterval);
  }

  /** Returns the gaze toward the user without snapping. */
  recenter(config: NaturalismGazeConfig) {
    this.mode = "soft-return";
    this.targetYaw = 0;
    this.targetPitch = 0;
    this.modeEndsAt = this.time + this.random.fromRange("gaze-return", config.softReturnDuration);
  }

  /** Forces an immediate brief-thought shift; used by the developer panel. */
  forceShift(config: NaturalismGazeConfig) {
    this.enterBriefThought(config);
  }

  setEventOffset(yawDegrees: number, pitchDegrees: number) {
    this.eventYaw = yawDegrees;
    this.eventPitch = pitchDegrees;
  }

  update(options: {
    config: NaturalismGazeConfig;
    deltaSeconds: number;
    enabled: boolean;
    /** Protected quiet period: holds the current target, drift and blinking continue. */
    stillnessActive: boolean;
    /** 1 while silent, reduced while speaking. */
    amplitudeScale: number;
    /** Blocks new gaze decisions while an expression owns the eyes. */
    eventOwnsGaze: boolean;
    /**
     * Whether speech is active, for the section P8 tail ceiling only.
     *
     * The ceiling is scoped to speech because that is where the fixed stare was
     * measured and where it can be afforded. While silent the eyes already
     * glance often enough that the p90 calmness bound in `femaleEyeAmplitude`
     * has almost no headroom, and forcing extra idle glances pushes both that
     * bound and the eye clamp — measured at every ceiling from 12 s to 25 s.
     * While speaking the same glance renders at `speakingScale`, so it costs far
     * less of the same budget.
     */
    speaking: boolean;
    /** Sentence/phrase boundary proximity, or undefined when the payload has none (§10). */
    boundary?: GazeBoundaryBias;
    /**
     * FINAL CONVERGENCE. Damps this controller's OWN wandering, 1 = untouched.
     *
     * Applied to the autonomous glance target and the slow drift only. The event
     * offset — which is how the conductor's gaze intent arrives — is deliberately
     * exempt, so stabilizing the eyes cannot also cancel the deliberate look the
     * conductor asked for. Micro-saccades are exempt too: a speaker holding a
     * listener's eye is still, not frozen, and removing the saccades is what
     * makes a stabilized gaze read as a stare.
     */
    autonomousScale?: number;
  }) {
    const { config, deltaSeconds } = options;
    this.time += deltaSeconds;

    // The ceiling counts time without a glance WITHIN a stretch of speech, so it
    // restarts when speech begins. Counting from the clip start would fire a
    // glance at almost every speech onset, which is the patterning this pass is
    // meant to avoid.
    if (options.speaking !== this.wasSpeaking) {
      this.wasSpeaking = options.speaking;
      if (options.speaking) this.lastGlanceAt = this.time;
    }

    const nearness = boundaryNearness(options.boundary);
    /**
     * A hold that would expire just BEFORE a boundary is stretched to land on it (§10).
     *
     * Bounded so this stays a bias on an existing decision rather than a new trigger
     * path: only from `user-focus`, only forward in time, only by up to `deferSeconds`,
     * and only once per boundary. `advanceMode` still decides what actually happens
     * when the stretched hold does expire, and still usually decides to extend it.
     */
    this.deferHoldToBoundary(options.enabled, options.eventOwnsGaze, options.boundary);

    if (!options.enabled) {
      this.targetYaw = 0;
      this.targetPitch = 0;
    } else if (!options.eventOwnsGaze && this.time >= this.modeEndsAt) {
      // A quiet hold protects the face and the head, not the eyes. Someone
      // listening quietly still moves their eyes; freezing them is what made the
      // avatar feel like it was waiting rather than listening. During stillness
      // the eyes stay active but every glance is kept small.
      this.stillnessActive = options.stillnessActive;
      this.speakingNow = options.speaking;
      this.advanceMode(config, nearness, options.boundary);
    }

    // Easing back to the user is deliberately slower than moving away, so the
    // return reads as subconscious rather than mechanical.
    const speed = this.mode === "soft-return" ? config.returnSmoothingSpeed : config.smoothingSpeed;
    const alpha = exponentialSmoothingAlpha(speed, deltaSeconds);
    this.currentYaw += (this.targetYaw - this.currentYaw) * alpha;
    this.currentPitch += (this.targetPitch - this.currentPitch) * alpha;

    if (options.enabled && !options.eventOwnsGaze && this.time >= this.microSaccadeAt) {
      this.microSaccadeUntil = this.time + config.microSaccadeDuration;
      this.microSaccadeYaw = this.random.range("gaze-micro-yaw", -1, 1) * config.microSaccadeAmplitude;
      this.microSaccadePitch = this.random.range("gaze-micro-pitch", -1, 1) * config.microSaccadeAmplitude * 0.6;
      this.microSaccadeAt = this.time + this.random.fromRange("gaze-micro", config.microSaccadeInterval);
    }

    const scale = options.enabled ? clamp(options.amplitudeScale, 0, 1) : 0;
    // Stored rather than passed, so `committedYawDegrees` reports the same eye
    // the renderer draws and the head-follow cannot chase a damped-away target.
    this.autonomousScale = clamp(options.autonomousScale ?? 1, 0, 1);
    const auto = this.autonomousScale;
    const drift = Math.sin((this.time / this.driftCycle) * Math.PI * 2 + this.driftPhase) * config.driftDegrees;
    const micro = this.time < this.microSaccadeUntil ? 1 : 0;

    const yaw = clamp(
      (this.currentYaw * auto + this.eventYaw) * scale + drift * auto * scale + this.microSaccadeYaw * micro * scale,
      -config.maxYawDegrees,
      config.maxYawDegrees
    );
    const pitch = clamp(
      (this.currentPitch * auto + this.eventPitch) * scale + drift * 0.4 * auto * scale + this.microSaccadePitch * micro * scale,
      -config.maxPitchDegrees,
      config.maxPitchDegrees
    );
    return { yawDegrees: yaw, pitchDegrees: pitch };
  }

  /**
   * Settled gaze angle used for head follow. Excludes micro-saccades and drift,
   * and is clamped to the same envelope as the rendered gaze so an expression
   * offset can never push the head past the configured limit.
   */
  committedYawDegrees(config: NaturalismGazeConfig) {
    return clamp(this.currentYaw * this.autonomousScale + this.eventYaw, -config.maxYawDegrees, config.maxYawDegrees);
  }

  currentMode() {
    return this.mode;
  }

  debug(amplitudeScale: number, config: NaturalismGazeConfig): GazeDebugState {
    return {
      mode: this.mode,
      targetYawDegrees: this.targetYaw,
      targetPitchDegrees: this.targetPitch,
      currentYawDegrees: this.currentYaw,
      currentPitchDegrees: this.currentPitch,
      committedYawDegrees: this.committedYawDegrees(config),
      previousDirection: this.lastDirection,
      holdRemainingSeconds: Math.max(0, this.modeEndsAt - this.time),
      microSaccadeActive: this.time < this.microSaccadeUntil,
      amplitudeScale
    };
  }

  /** See the call site in `update()`. Rate-neutral by construction: it never shortens. */
  private deferHoldToBoundary(enabled: boolean, eventOwnsGaze: boolean, boundary?: GazeBoundaryBias) {
    if (!enabled || eventOwnsGaze || !boundary || boundary.deferSeconds <= 0) return;
    if (this.mode !== "user-focus") return;
    const target = boundary.secondsToNextStart;
    if (!Number.isFinite(target) || target < 0) return;
    const holdRemaining = this.modeEndsAt - this.time;
    // Only stretch, and only when the hold was going to end shortly before this
    // boundary anyway. `target > holdRemaining` is what makes this a deferral.
    if (holdRemaining < 0 || target <= holdRemaining || target - holdRemaining > boundary.deferSeconds) return;
    // One deferral per boundary, so a stretched hold is not stretched again on the
    // next frame toward the same boundary.
    if (Math.abs(this.boundaryAdvanceAt - (this.time + target)) < 1e-6) return;
    this.boundaryAdvanceAt = this.time + target;
    this.modeEndsAt = this.time + target;
  }

  private advanceMode(config: NaturalismGazeConfig, nearness = 0, boundary?: GazeBoundaryBias) {
    if (this.mode === "brief-thought") {
      this.mode = "soft-return";
      this.targetYaw = 0;
      this.targetPitch = 0;
      this.modeEndsAt = this.time + this.random.fromRange("gaze-return", config.softReturnDuration);
      return;
    }
    if (this.mode === "soft-return") {
      this.mode = "user-focus";
      this.modeEndsAt = this.time + this.holdDuration(config);
      // One small settling adjustment shortly after arriving, then stillness.
      this.microSaccadeAt = this.time + this.random.fromRange("gaze-settle", config.settleDelay);
      return;
    }
    // A glance is more likely to start where a speaker's phrase ends (§10). This
    // scales the existing probability rather than adding a second entry point, so
    // the draw count on the `gaze-mode` stream is unchanged and a payload with no
    // boundaries produces the identical sequence.
    const briefThoughtProbability = clamp(
      config.briefThoughtProbability * (1 + ((boundary?.probabilityGain ?? 1) - 1) * nearness),
      0,
      1
    );
    /**
     * The tail ceiling (§P8). Measurement showed roughly one session in five
     * going a whole 37 s clip without the dice ever coming up, which is what
     * read as a fixed stare. This forces the glance the scheduler would
     * otherwise keep declining.
     *
     * Deliberately NOT a second entry point: it routes through the same
     * `enterBriefThought`, so the glance it produces is the same shape, size and
     * duration as any other, and the `gaze-mode` draw is still consumed so the
     * random stream stays aligned with a run where the ceiling never fires.
     */
    const overdue =
      this.speakingNow &&
      config.maxSecondsWithoutGlance > 0 &&
      this.time - this.lastGlanceAt >= config.maxSecondsWithoutGlance;
    const wants = this.random.chance("gaze-mode", briefThoughtProbability);
    if (wants || overdue) {
      this.enterBriefThought(config);
      return;
    }
    // Stay with the user: extend the hold instead of retargeting for no reason.
    this.modeEndsAt = this.time + this.holdDuration(config);
  }

  /** Common short hold, with an occasional long settle so holds are not periodic. */
  private holdDuration(config: NaturalismGazeConfig) {
    return this.random.chance("gaze-hold-kind", config.longFocusHoldProbability)
      ? this.random.fromRange("gaze-hold", config.longFocusHold)
      : this.random.fromRange("gaze-hold", config.userFocusHold);
  }

  private enterBriefThought(config: NaturalismGazeConfig) {
    const sign = this.random.signAvoiding("gaze-side", this.lastSign);
    // Most glances are tiny, medium ones are rare and large ones very rare.
    const bias = this.stillnessActive ? config.shiftMagnitudeBias * 2 : config.shiftMagnitudeBias;
    const roll = Math.pow(this.random.next("gaze-yaw"), bias);
    const magnitude = config.yawDegrees.min + (config.yawDegrees.max - config.yawDegrees.min) * roll;
    const yaw = sign * magnitude;
    // Reject targets that are barely different from where the eyes already are.
    if (Math.abs(yaw - this.currentYaw) < config.minTargetChangeDegrees) {
      this.modeEndsAt = this.time + this.holdDuration(config);
      return;
    }
    // Recorded only once the glance is actually committed. Marking it before the
    // rejection above would let a declined target reset the tail ceiling and buy
    // another full interval of stillness — the opposite of what it is for.
    this.lastGlanceAt = this.time;
    // Downward-side and level shifts read as thought; upward shifts stay rare.
    const upward = this.random.chance("gaze-vertical", 0.22);
    const pitchRoll = Math.pow(this.random.next("gaze-pitch"), config.shiftMagnitudeBias);
    const pitchMagnitude = config.pitchDegrees.min + (config.pitchDegrees.max - config.pitchDegrees.min) * pitchRoll;
    this.targetYaw = yaw;
    this.targetPitch = upward ? pitchMagnitude * 0.6 : -pitchMagnitude * 0.55;
    this.mode = "brief-thought";
    this.lastSign = sign;
    this.lastDirection = directionOf(yaw, 0.5);
    this.modeEndsAt = this.time + this.random.fromRange("gaze-thought", config.briefThoughtDuration);
  }
}

/** Writes a canonical gaze angle into the paired eyeLook morph channels. */
export const writeGazeMorphs = (
  pose: Record<string, number>,
  yawDegrees: number,
  pitchDegrees: number,
  morphPerDegree: number
) => {
  const x = yawDegrees * morphPerDegree;
  const y = pitchDegrees * morphPerDegree;
  const write = (name: string, value: number) => {
    const clamped = clamp(value);
    if (clamped > 0.0001) pose[name] = Math.max(pose[name] ?? 0, clamped);
  };
  // Both eyes always move together: in on one side is out on the other.
  write("eyeLookInLeft", Math.max(0, x));
  write("eyeLookOutRight", Math.max(0, x));
  write("eyeLookOutLeft", Math.max(0, -x));
  write("eyeLookInRight", Math.max(0, -x));
  write("eyeLookUpLeft", Math.max(0, y));
  write("eyeLookUpRight", Math.max(0, y));
  write("eyeLookDownLeft", Math.max(0, -y));
  write("eyeLookDownRight", Math.max(0, -y));
};

export const gazeEase = smoothstep;
