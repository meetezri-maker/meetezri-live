import type { BehaviorEventChannel, BehaviorEventDefinition } from "../../../mappings/behaviorEventLibrary";
import type { BlendshapePose, HeadRotationTarget } from "../../../types/facialAnimation";
import { clamp } from "../../../utils/clamp";
import { smoothstep } from "../../../utils/easing";
import type { BehaviorRandom } from "./BehaviorRandom";
import type { BehaviorSide } from "./BehaviorMemory";

/** Canonical morph bases that exist as a Left/Right pair. */
const pairedMorphBases = new Set([
  "mouthSmile",
  "mouthFrown",
  "mouthPress",
  "mouthStretch",
  "mouthUpperUp",
  "mouthLowerDown",
  "mouthDimple",
  "cheekSquint",
  "eyeSquint",
  "eyeWide",
  "eyeBlink",
  "browOuterUp",
  "browDown",
  "noseSneer"
]);

const degreesToRadians = (degrees: number) => (degrees * Math.PI) / 180;

interface ActiveEvent {
  definition: BehaviorEventDefinition;
  start: number;
  enter: number;
  hold: number;
  exit: number;
  side: BehaviorSide;
  asymmetry: number;
  amplitude: number;
}

export interface ExpressionEventOutput {
  pose: BlendshapePose;
  gazeYawDegrees: number;
  gazePitchDegrees: number;
  head: HeadRotationTarget;
  phase: "none" | "entry" | "hold" | "exit";
  weight: number;
}

/**
 * Plays one coordinated micro-expression at a time.
 *
 * Channels enter on their own offsets with a fast-but-soft smoothstep, hold for
 * a variable time, and release more slowly than they entered. Gaze leads and the
 * head trails, so nothing peaks on the same frame.
 */
export class ExpressionEventPlayer {
  private time = 0;
  private active?: ActiveEvent;
  private output: ExpressionEventOutput = {
    pose: {},
    gazeYawDegrees: 0,
    gazePitchDegrees: 0,
    head: { pitch: 0, yaw: 0, roll: 0 },
    phase: "none",
    weight: 0
  };

  constructor(private random: BehaviorRandom) {}

  reset(time = 0) {
    this.time = time;
    this.active = undefined;
    this.output = {
      pose: {},
      gazeYawDegrees: 0,
      gazePitchDegrees: 0,
      head: { pitch: 0, yaw: 0, roll: 0 },
      phase: "none",
      weight: 0
    };
  }

  isActive() {
    return Boolean(this.active);
  }

  currentId() {
    return this.active?.definition.id;
  }

  currentSide(): BehaviorSide {
    return this.active?.side ?? "none";
  }

  /** Total wall time this event will occupy, used for conflict-group bookkeeping. */
  static durationOf(event: { enter: number; hold: number; exit: number }) {
    return event.enter + event.hold + event.exit;
  }

  start(definition: BehaviorEventDefinition, side: BehaviorSide, asymmetry: number, amplitude: number) {
    const enter = this.random.fromRange("event-enter", definition.enterDuration);
    const hold = this.random.fromRange("event-hold", definition.holdDuration);
    const exit = this.random.fromRange("event-exit", definition.exitDuration);
    this.active = {
      definition,
      start: this.time,
      enter,
      hold,
      exit,
      side: definition.asymmetric ? side : "none",
      asymmetry: definition.asymmetric ? asymmetry : 0,
      amplitude
    };
    return { enter, hold, exit, duration: enter + hold + exit + this.maxOffset(definition) };
  }

  cancel() {
    this.active = undefined;
  }

  update(deltaSeconds: number): ExpressionEventOutput {
    this.time += deltaSeconds;
    const pose: BlendshapePose = {};
    const head: HeadRotationTarget = { pitch: 0, yaw: 0, roll: 0 };
    let gazeYaw = 0;
    let gazePitch = 0;
    let maxWeight = 0;
    let phase: ExpressionEventOutput["phase"] = "none";

    const active = this.active;
    if (!active) {
      this.output = { pose, gazeYawDegrees: 0, gazePitchDegrees: 0, head, phase, weight: 0 };
      return this.output;
    }

    for (const channel of active.definition.channels) {
      const weight = this.channelWeight(active, channel.offset, channel.releaseScale ?? 1);
      if (weight <= 0) continue;
      maxWeight = Math.max(maxWeight, weight);
      this.writeChannel(pose, active, channel, weight);
    }

    const gaze = active.definition.gaze;
    if (gaze) {
      // Gaze returns first: its release is shorter than the facial channels.
      const weight = this.channelWeight(active, gaze.offset, gaze.returnsFirst ? 0.62 : 1);
      gazeYaw = gaze.yawDegrees * weight * (active.side === "right" ? -1 : 1);
      gazePitch = gaze.pitchDegrees * weight;
      maxWeight = Math.max(maxWeight, weight);
    }

    const headChannel = active.definition.head;
    if (headChannel) {
      // Head returns last: its release is stretched relative to the face.
      const weight = this.channelWeight(active, headChannel.offset, headChannel.returnsLast ? 1.45 : 1);
      const mirror = active.side === "right" ? -1 : 1;
      head.pitch = degreesToRadians(headChannel.pitchDegrees) * weight * active.amplitude;
      head.yaw = degreesToRadians(headChannel.yawDegrees) * weight * active.amplitude * mirror;
      head.roll = degreesToRadians(headChannel.rollDegrees) * weight * active.amplitude * mirror;
      maxWeight = Math.max(maxWeight, weight);
    }

    phase = this.resolvePhase(active);
    if (phase === "none") this.active = undefined;

    this.output = { pose, gazeYawDegrees: gazeYaw, gazePitchDegrees: gazePitch, head, phase, weight: maxWeight };
    return this.output;
  }

  private channelWeight(active: ActiveEvent, offset: number, releaseScale: number) {
    const local = this.time - active.start - offset;
    if (local <= 0) return 0;
    if (local < active.enter) return smoothstep(0, active.enter, local);
    if (local < active.enter + active.hold) return 1;
    const exitDuration = active.exit * releaseScale;
    const exitLocal = local - active.enter - active.hold;
    if (exitLocal >= exitDuration) return 0;
    // Slower, softer release than the entry.
    return 1 - smoothstep(0, exitDuration, exitLocal);
  }

  private writeChannel(pose: BlendshapePose, active: ActiveEvent, channel: BehaviorEventChannel, weight: number) {
    const base = channel.morph;
    const value = channel.peak * weight * active.amplitude;
    if (!pairedMorphBases.has(base)) {
      pose[base] = clamp(Math.max(pose[base] ?? 0, value));
      return;
    }
    const mode = channel.side ?? "both";
    const primary = active.side === "right" ? "Right" : "Left";
    const secondary = primary === "Left" ? "Right" : "Left";
    const write = (suffix: string, amount: number) => {
      const name = `${base}${suffix}`;
      pose[name] = clamp(Math.max(pose[name] ?? 0, amount));
    };
    if (mode === "primary") write(primary, value * (1 + active.asymmetry));
    else if (mode === "secondary") write(secondary, value * (1 - active.asymmetry));
    else {
      write(primary, value * (1 + active.asymmetry));
      write(secondary, value * (1 - active.asymmetry));
    }
  }

  private resolvePhase(active: ActiveEvent): ExpressionEventOutput["phase"] {
    const local = this.time - active.start;
    const tail = this.maxOffset(active.definition);
    if (local < active.enter + tail) return "entry";
    if (local < active.enter + active.hold + tail) return "hold";
    if (local < active.enter + active.hold + active.exit * 1.45 + tail) return "exit";
    return "none";
  }

  private maxOffset(definition: BehaviorEventDefinition) {
    let max = 0;
    for (const channel of definition.channels) max = Math.max(max, channel.offset);
    if (definition.gaze) max = Math.max(max, definition.gaze.offset);
    if (definition.head) max = Math.max(max, definition.head.offset);
    return max;
  }
}
