import type { BehaviorEventDefinition } from "../../../mappings/behaviorEventLibrary";
import type { IdleExpressionEventId } from "../../../mappings/idleExpressionProfiles";
import type { BehaviorMemoryDebugState } from "../../../types/behaviorNaturalism";

export type BehaviorSide = "left" | "right" | "none";
export type BehaviorDirection = "left" | "right" | "center";

/**
 * Short-term behaviour memory.
 *
 * Prevents the two failure modes that make procedural faces read as machines:
 * repeating the same event or the same side, and letting unrelated events stack
 * onto the same frame.
 */
export class BehaviorMemory {
  private recent: IdleExpressionEventId[] = [];
  private lastRunAt = new Map<IdleExpressionEventId, number>();
  private eventTimes: number[] = [];
  private activeConflicts = new Map<string, number>();
  lastSide: BehaviorSide = "none";
  private sideRun = 0;
  lastGazeDirection: BehaviorDirection = "center";
  lastHeadDirection: BehaviorDirection = "center";
  lastMeaningfulMotionAt = 0;
  speechEndedAt = -999;

  reset(time = 0) {
    this.recent = [];
    this.lastRunAt.clear();
    this.eventTimes = [];
    this.activeConflicts.clear();
    this.lastSide = "none";
    this.sideRun = 0;
    this.lastGazeDirection = "center";
    this.lastHeadDirection = "center";
    this.lastMeaningfulMotionAt = time;
    this.speechEndedAt = -999;
  }

  /** True when the event may start now. */
  canRun(definition: BehaviorEventDefinition, time: number, cooldownScale: number, historyLength: number) {
    const lastRun = this.lastRunAt.get(definition.id);
    if (lastRun !== undefined && time - lastRun < definition.cooldown * cooldownScale) return false;
    // Never run the same event twice consecutively.
    if (historyLength > 0 && this.recent.length && this.recent[this.recent.length - 1] === definition.id) return false;
    for (const group of definition.conflictGroups) {
      const busyUntil = this.activeConflicts.get(group);
      if (busyUntil !== undefined && time < busyUntil) return false;
    }
    return true;
  }

  recordEvent(definition: BehaviorEventDefinition, time: number, durationSeconds: number, historyLength: number) {
    this.lastRunAt.set(definition.id, time);
    this.eventTimes.push(time);
    this.recent.push(definition.id);
    while (historyLength > 0 && this.recent.length > historyLength) this.recent.shift();
    if (historyLength === 0) this.recent = [];
    for (const group of definition.conflictGroups) this.activeConflicts.set(group, time + durationSeconds);
    this.lastMeaningfulMotionAt = time;
  }

  recordSide(side: BehaviorSide) {
    if (side === "none") return;
    this.sideRun = side === this.lastSide ? this.sideRun + 1 : 1;
    this.lastSide = side;
  }

  /** Chooses a side while refusing to favour one side across a session. */
  pickSide(preferred: BehaviorSide): BehaviorSide {
    if (this.sideRun >= 2 && preferred === this.lastSide) return preferred === "left" ? "right" : "left";
    return preferred;
  }

  /** Number of events inside the density window, used to schedule extra stillness. */
  density(time: number, windowSeconds: number) {
    this.eventTimes = this.eventTimes.filter((value) => time - value <= windowSeconds);
    return this.eventTimes.length;
  }

  recentEvents() {
    return [...this.recent];
  }

  debug(time: number, windowSeconds: number): BehaviorMemoryDebugState {
    return {
      recentEvents: this.recentEvents(),
      lastEventSide: this.lastSide,
      lastGazeDirection: this.lastGazeDirection,
      lastHeadDirection: this.lastHeadDirection,
      secondsSinceMeaningfulMotion: Math.max(0, time - this.lastMeaningfulMotionAt),
      secondsSinceSpeechEnded: Math.max(0, time - this.speechEndedAt),
      eventDensity: this.density(time, windowSeconds)
    };
  }
}
