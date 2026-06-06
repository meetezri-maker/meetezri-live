/**
 * Sara RFv2 behavior timing scheduler scaffold only.
 *
 * This module is not wired into the live runtime. Sara still uses the current
 * Sara V2 / legacyHybrid path. Do not activate this scheduler until a later
 * explicit phase.
 */

export interface SaraBehaviorTimingEvent {
  readonly id: string;
  readonly type: string;
  readonly scheduledAtMs: number;
  readonly startsAtMs: number;
  readonly endsAtMs: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface SaraBehaviorTimingState {
  readonly enabled: false;
  readonly activeEvents: readonly SaraBehaviorTimingEvent[];
  readonly queuedEvents: readonly SaraBehaviorTimingEvent[];
  readonly lastUpdatedAtMs: number;
}

export interface SaraBehaviorTimingUpdateResult {
  readonly state: SaraBehaviorTimingState;
  readonly activeEvents: readonly SaraBehaviorTimingEvent[];
  readonly queuedEvents: readonly SaraBehaviorTimingEvent[];
  readonly newEvents: readonly SaraBehaviorTimingEvent[];
  readonly debug: {
    readonly enabled: false;
    readonly reason: "Sara RFv2 scheduler scaffold only; not wired.";
  };
}

export function createSaraBehaviorTimingState(): SaraBehaviorTimingState {
  return {
    enabled: false,
    activeEvents: [],
    queuedEvents: [],
    lastUpdatedAtMs: 0,
  };
}

export function updateSaraBehaviorTimingScheduler(
  state: SaraBehaviorTimingState,
): SaraBehaviorTimingUpdateResult {
  return {
    state,
    activeEvents: [],
    queuedEvents: [],
    newEvents: [],
    debug: {
      enabled: false,
      reason: "Sara RFv2 scheduler scaffold only; not wired.",
    },
  };
}
