import type { NaturalismBlinkConfig } from "../../../mappings/naturalismPresets";
import type { BlinkDebugState, BlinkPhase } from "../../../types/behaviorNaturalism";
import { clamp } from "../../../utils/clamp";
import { smoothstep } from "../../../utils/easing";
import type { BehaviorRandom } from "./BehaviorRandom";

interface EyeShape {
  start: number;
  close: number;
  hold: number;
  open: number;
  strength: number;
}

interface BlinkInstance {
  left: EyeShape;
  right: EyeShape;
  /** Second blink of a double blink, scheduled at creation time. */
  second?: { left: EyeShape; right: EyeShape };
}

/**
 * Everything this class is told about speech, resolved by the caller (§10).
 *
 * All offsets are relative to now, so this class keeps its own clock and never has
 * to reconcile it with payload time. `undefined` means no boundary information is
 * available, and is the case that must reproduce pre-§10 scheduling exactly.
 */
export interface BlinkBoundaryBias {
  /** Seconds until speech next stops. */
  secondsToNextStart: number;
  pullProbability: number;
  reachSeconds: number;
  minimumLeadSeconds: number;
  jitter: { min: number; max: number };
}

/**
 * Blink as an explicit state machine.
 *
 * Closing is always faster than opening, both eyes stay visually coordinated,
 * the lids always return fully to open, and blinking is never cancelled by
 * speech. Scheduling happens once per completed blink so replay and resume can
 * never duplicate a timer.
 */
export class BlinkStateMachine {
  private time = 0;
  private nextBlinkAt = 0;
  private instance?: BlinkInstance;
  private phase: BlinkPhase = "waiting";
  private lastInterval = 0;
  private lastScheduledAt = 0;
  private lastClose = 0;
  private lastOpen = 0;
  private left = 0;
  private right = 0;
  private count = 0;
  private forcedPending = false;

  constructor(private random: BehaviorRandom) {}

  reset(config: NaturalismBlinkConfig, time = 0) {
    this.time = time;
    this.instance = undefined;
    this.phase = "waiting";
    this.left = 0;
    this.right = 0;
    this.count = 0;
    this.forcedPending = false;
    this.lastInterval = 0;
    this.lastClose = 0;
    this.lastOpen = 0;
    this.schedule(config);
  }

  /** Requests a blink at the next opportunity without cancelling an active one. */
  force() {
    this.forcedPending = true;
  }

  /** True while lids are moving; used so speech start never truncates a blink. */
  isActive() {
    return Boolean(this.instance);
  }

  update(config: NaturalismBlinkConfig, deltaSeconds: number, enabled: boolean, boundary?: BlinkBoundaryBias, speaking = false) {
    this.time += deltaSeconds;

    if (!enabled) {
      // Let an in-flight blink finish rather than freezing a half-closed lid.
      if (!this.instance) {
        this.left = 0;
        this.right = 0;
        this.phase = "waiting";
        this.nextBlinkAt = this.time + 1;
        return;
      }
    }

    if (!this.instance && (this.forcedPending || this.time >= this.nextBlinkAt)) {
      this.start(config);
      this.forcedPending = false;
    }

    if (!this.instance) {
      this.left = 0;
      this.right = 0;
      this.phase = "waiting";
      return;
    }

    const instance = this.instance;
    this.left = Math.max(this.sample(instance.left), instance.second ? this.sample(instance.second.left) : 0);
    this.right = Math.max(this.sample(instance.right), instance.second ? this.sample(instance.second.right) : 0);
    this.phase = this.resolvePhase(instance);

    if (this.time > this.endTime(instance)) {
      this.instance = undefined;
      this.left = 0;
      this.right = 0;
      this.phase = "waiting";
      this.count += 1;
      this.schedule(config, boundary, speaking);
    }
  }

  values() {
    return { left: this.left, right: this.right };
  }

  debug(): BlinkDebugState {
    return {
      phase: this.phase,
      lastIntervalSeconds: this.lastInterval,
      nextBlinkInSeconds: Math.max(0, this.nextBlinkAt - this.time),
      lastCloseSeconds: this.lastClose,
      lastOpenSeconds: this.lastOpen,
      leftValue: this.left,
      rightValue: this.right,
      doubleBlinkPending: Boolean(this.instance?.second),
      blinkCount: this.count
    };
  }

  private schedule(config: NaturalismBlinkConfig, boundary?: BlinkBoundaryBias, speaking = false) {
    const roll = this.random.next("blink-interval-kind");
    const interval =
      roll < config.longIntervalProbability
        ? this.random.fromRange("blink-interval", config.longInterval)
        : roll < config.longIntervalProbability + config.shortIntervalProbability
          ? this.random.fromRange("blink-interval", config.shortInterval)
          : this.random.fromRange("blink-interval", config.interval);
    // Speaking shortens the wait (§12). Applied to the sampled draw rather than to
    // the config ranges, so the long/short/normal mix and its spread are untouched
    // and the coefficient of variation is provably unchanged.
    const scaled = interval * (speaking ? config.speakingIntervalScale : 1);
    this.lastInterval = scaled;
    this.lastScheduledAt = this.time;
    this.nextBlinkAt = this.time + this.biasToBoundary(scaled, boundary);
  }

  /**
   * Pulls a freshly sampled interval onto a nearby sentence/phrase boundary (§10).
   *
   * The invariants this class documents are all preserved. Nothing is triggered
   * here — the interval is only moved, so scheduling still happens exactly once per
   * completed blink and speech still never cancels a blink in flight. The pull is a
   * coin flip and lands in a jittered window rather than on the boundary itself,
   * because a blink that fires on cue every time is as much of a tell as one that
   * ignores speech: §9's target is "clusters near pauses", not "pinned to them".
   *
   * Both random draws sit on their own named streams, so a payload that never
   * reaches this branch produces a byte-identical sequence to the pre-§10 code —
   * and when `boundary` is undefined no draw is made at all.
   */
  private biasToBoundary(interval: number, boundary?: BlinkBoundaryBias) {
    if (!boundary) return interval;
    const { secondsToNextStart: target } = boundary;
    if (!Number.isFinite(target)) return interval;
    // Capture only boundaries the blink was already going to be scheduled NEAR, and
    // symmetrically — a boundary may pull the blink earlier or later by up to
    // `reachSeconds`, never from an arbitrary distance.
    //
    // Measured: an asymmetric window ("any boundary between now and interval +
    // reach") pulled almost every blink forward and raised the blink count 28% over
    // the same clip, because a boundary is nearly always closer than the sampled
    // interval. That is a rate change, and §9 found nothing wrong with the rate —
    // only with where the blinks landed. A symmetric window moves blinks without
    // making them more frequent.
    if (target < boundary.minimumLeadSeconds || Math.abs(target - interval) > boundary.reachSeconds) return interval;
    if (!this.random.chance("blink-boundary-pull", boundary.pullProbability)) return interval;
    const jitter = this.random.fromRange("blink-boundary-jitter", boundary.jitter);
    return Math.max(boundary.minimumLeadSeconds, target + jitter);
  }

  private start(config: NaturalismBlinkConfig) {
    const close = this.random.fromRange("blink-close", config.close);
    const hold = this.random.fromRange("blink-hold", config.hold);
    // Opening is always slower than closing, and never shorter than the close phase.
    const open = Math.max(close * 1.35, this.random.fromRange("blink-open", config.open));
    const strength = config.strength * this.random.fromRange("blink-strength", config.strengthVariation);
    // The lead/follow offset is also capped against the close duration. A fixed
    // offset against a fast close would separate the lids far enough to read as
    // a wink rather than one coordinated blink.
    const offset = Math.min(this.random.fromRange("blink-offset", config.startOffset), close * 0.22);
    const asymmetry = this.random.fromRange("blink-asymmetry", config.strengthAsymmetry);
    const leadIsLeft = this.random.next("blink-side") < 0.5;

    this.lastClose = close;
    this.lastOpen = open;
    this.lastInterval = this.time - this.lastScheduledAt;

    const lead: EyeShape = { start: this.time, close, hold, open, strength };
    const follow: EyeShape = {
      start: this.time + offset,
      close,
      hold,
      open,
      strength: strength * (1 - asymmetry)
    };
    const left = leadIsLeft ? lead : follow;
    const right = leadIsLeft ? follow : lead;

    const instance: BlinkInstance = { left, right };
    if (this.random.chance("blink-double", config.doubleBlinkProbability)) {
      const gap = this.random.fromRange("blink-double-gap", config.doubleBlinkGap);
      const secondStart = this.time + close + hold + open + gap;
      // The second blink of a double blink is shorter and softer than the first.
      const shift = (shape: EyeShape): EyeShape => ({
        start: secondStart + (shape.start - this.time),
        close: shape.close * 0.86,
        hold: shape.hold * 0.7,
        open: shape.open * 0.9,
        strength: shape.strength * 0.88
      });
      instance.second = { left: shift(left), right: shift(right) };
    }
    this.instance = instance;
    this.phase = "closing";
  }

  private sample(shape: EyeShape) {
    const local = this.time - shape.start;
    if (local < 0) return 0;
    if (local < shape.close) return smoothstep(0, shape.close, local) * shape.strength;
    if (local < shape.close + shape.hold) return shape.strength;
    const openLocal = local - shape.close - shape.hold;
    if (openLocal < shape.open) return (1 - smoothstep(0, shape.open, openLocal)) * shape.strength;
    return 0;
  }

  private resolvePhase(instance: BlinkInstance): BlinkPhase {
    // Report the phase of whichever eye is still moving, so the trailing eye of
    // an asymmetric blink is never described as already open.
    const shapes = [instance.left, instance.right];
    if (instance.second) shapes.push(instance.second.left, instance.second.right);
    let phase: BlinkPhase = "waiting";
    let best = -1;
    for (const shape of shapes) {
      const local = this.time - shape.start;
      if (local < 0 || local >= shape.close + shape.hold + shape.open) continue;
      const value = this.sample(shape);
      if (value <= best) continue;
      best = value;
      phase = local < shape.close ? "closing" : local < shape.close + shape.hold ? "holding" : "opening";
    }
    return phase;
  }

  private endTime(instance: BlinkInstance) {
    const finish = (shape: EyeShape) => shape.start + shape.close + shape.hold + shape.open;
    return Math.max(
      finish(instance.left),
      finish(instance.right),
      instance.second ? Math.max(finish(instance.second.left), finish(instance.second.right)) : 0
    );
  }
}

export const blinkClamp = (value: number) => clamp(value);
