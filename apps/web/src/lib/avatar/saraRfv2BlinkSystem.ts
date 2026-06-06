import {
  SARA_RFV2_BLINK_TUNING,
  SARA_RFV2_EXPRESSION_CAPS,
  SARA_RFV2_MORPH_NAMES,
} from "./saraRfv2Config";
import { SARA_RFV2_FLAGS } from "./saraRfv2FeatureFlags";

/**
 * Sara RFv2 blink system foundation only.
 *
 * Disabled by Sara RFv2 flags and not wired into ThreeAvatar, ActiveSession,
 * Sara V2 live rendering, or any production execution path. Future runtime
 * phases may consume the returned blink targets; the current Sara live path
 * remains unchanged.
 */

export type SaraRfv2BlinkPresenceState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking";

export interface SaraRfv2BlinkState {
  readonly enabled: boolean;
  readonly isBlinking: boolean;
  readonly blinkProgress: number;
  readonly blinkStrengthLeft: number;
  readonly blinkStrengthRight: number;
  readonly nextBlinkAtMs: number;
  readonly blinkStartedAtMs: number;
  readonly blinkDurationMs: number;
  readonly lastBlinkAtMs: number;
  readonly doubleBlinkQueued: boolean;
  readonly partialBlink: boolean;
}

export interface ScheduleNextSaraBlinkArgs {
  readonly nowMs: number;
  readonly state: SaraRfv2BlinkState;
  readonly presenceState?: SaraRfv2BlinkPresenceState;
}

export interface ScheduleNextSaraBlinkResult {
  readonly state: SaraRfv2BlinkState;
  readonly nextBlinkAtMs: number;
  readonly debug: {
    readonly enabled: boolean;
    readonly reason?: string;
    readonly presenceState: SaraRfv2BlinkPresenceState;
    readonly delayRangeMs: readonly [number, number];
    readonly delayMs: number;
  };
}

export interface UpdateSaraRfv2BlinkSystemArgs {
  readonly state: SaraRfv2BlinkState;
  readonly nowMs: number;
  readonly presenceState: SaraRfv2BlinkPresenceState;
  readonly speaking?: boolean;
}

export interface UpdateSaraRfv2BlinkSystemResult {
  readonly state: SaraRfv2BlinkState;
  readonly targets: {
    readonly eyeBlinkLeft: number;
    readonly eyeBlinkRight: number;
  };
  readonly debug: {
    readonly enabled: boolean;
    readonly reason?: string;
    readonly presenceState: SaraRfv2BlinkPresenceState;
    readonly isBlinking: boolean;
    readonly blinkProgress: number;
    readonly partialBlink: boolean;
    readonly doubleBlinkQueued: boolean;
    readonly nextBlinkAtMs: number;
  };
}

export interface SaraRfv2BlinkValidationResult {
  readonly valid: boolean;
  readonly warnings: string[];
}

const ZERO_BLINK_TARGETS = {
  eyeBlinkLeft: 0,
  eyeBlinkRight: 0,
} as const;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function pickRangeValue(range: readonly [number, number]): number {
  const min = Math.min(range[0], range[1]);
  const max = Math.max(range[0], range[1]);
  return min + (max - min) * Math.random();
}

function getDelayRangeForPresence(
  presenceState: SaraRfv2BlinkPresenceState,
): readonly [number, number] {
  if (presenceState === "speaking") {
    return SARA_RFV2_BLINK_TUNING.speakingDelayRangeMs;
  }
  if (presenceState === "listening" || presenceState === "thinking") {
    return SARA_RFV2_BLINK_TUNING.listeningDelayRangeMs;
  }
  return SARA_RFV2_BLINK_TUNING.idleDelayRangeMs;
}

function createBlinkDebug(
  state: SaraRfv2BlinkState,
  presenceState: SaraRfv2BlinkPresenceState,
  reason?: string,
): UpdateSaraRfv2BlinkSystemResult["debug"] {
  return {
    enabled: SARA_RFV2_FLAGS.blinkSystem,
    reason,
    presenceState,
    isBlinking: state.isBlinking,
    blinkProgress: state.blinkProgress,
    partialBlink: state.partialBlink,
    doubleBlinkQueued: state.doubleBlinkQueued,
    nextBlinkAtMs: state.nextBlinkAtMs,
  };
}

function createScheduledState(
  state: SaraRfv2BlinkState,
  nowMs: number,
  presenceState: SaraRfv2BlinkPresenceState,
): SaraRfv2BlinkState {
  const durationMs = Math.round(
    pickRangeValue(SARA_RFV2_BLINK_TUNING.blinkDurationMs),
  );
  return {
    ...state,
    enabled: true,
    isBlinking: true,
    blinkProgress: 0,
    blinkStrengthLeft: 0,
    blinkStrengthRight: 0,
    blinkStartedAtMs: nowMs,
    blinkDurationMs: durationMs,
    nextBlinkAtMs: state.nextBlinkAtMs,
    doubleBlinkQueued:
      !state.doubleBlinkQueued &&
      Math.random() < SARA_RFV2_BLINK_TUNING.doubleBlinkChance,
    partialBlink:
      presenceState !== "speaking" &&
      Math.random() < SARA_RFV2_BLINK_TUNING.partialBlinkChance,
  };
}

export function createSaraRfv2BlinkState(): SaraRfv2BlinkState {
  return {
    enabled: false,
    isBlinking: false,
    blinkProgress: 0,
    blinkStrengthLeft: 0,
    blinkStrengthRight: 0,
    nextBlinkAtMs: 0,
    blinkStartedAtMs: 0,
    blinkDurationMs: 0,
    lastBlinkAtMs: 0,
    doubleBlinkQueued: false,
    partialBlink: false,
  };
}

export function scheduleNextSaraBlink(
  args: ScheduleNextSaraBlinkArgs,
): ScheduleNextSaraBlinkResult {
  const presenceState = args.presenceState ?? "idle";
  const delayRangeMs = getDelayRangeForPresence(presenceState);

  if (!SARA_RFV2_FLAGS.blinkSystem) {
    return {
      state: args.state,
      nextBlinkAtMs: args.state.nextBlinkAtMs,
      debug: {
        enabled: false,
        reason: "Sara RFv2 blink system disabled by feature flag.",
        presenceState,
        delayRangeMs,
        delayMs: 0,
      },
    };
  }

  const delayMs = Math.round(pickRangeValue(delayRangeMs));
  const nextBlinkAtMs = args.nowMs + delayMs;
  const state: SaraRfv2BlinkState = {
    ...args.state,
    enabled: true,
    nextBlinkAtMs,
  };

  return {
    state,
    nextBlinkAtMs,
    debug: {
      enabled: true,
      presenceState,
      delayRangeMs,
      delayMs,
    },
  };
}

export function updateSaraRfv2BlinkSystem(
  args: UpdateSaraRfv2BlinkSystemArgs,
): UpdateSaraRfv2BlinkSystemResult {
  if (!SARA_RFV2_FLAGS.blinkSystem) {
    return {
      state: args.state,
      targets: ZERO_BLINK_TARGETS,
      debug: createBlinkDebug(
        args.state,
        args.presenceState,
        "Sara RFv2 blink system disabled by feature flag.",
      ),
    };
  }

  const presenceState = args.speaking ? "speaking" : args.presenceState;
  let nextState = args.state;

  if (!nextState.isBlinking && args.nowMs >= nextState.nextBlinkAtMs) {
    nextState = createScheduledState(nextState, args.nowMs, presenceState);
  }

  if (!nextState.isBlinking) {
    return {
      state: nextState,
      targets: ZERO_BLINK_TARGETS,
      debug: createBlinkDebug(nextState, presenceState),
    };
  }

  const durationMs = Math.max(1, nextState.blinkDurationMs);
  const elapsedMs = Math.max(0, args.nowMs - nextState.blinkStartedAtMs);
  const normalizedProgress = clamp(elapsedMs / durationMs, 0, 1);
  const blinkCurve =
    normalizedProgress < 0.5
      ? normalizedProgress * 2
      : (1 - normalizedProgress) * 2;
  const blinkCap = nextState.partialBlink ? 0.42 : SARA_RFV2_EXPRESSION_CAPS.blink;
  const leftStrength = clamp(blinkCurve * blinkCap, 0, SARA_RFV2_EXPRESSION_CAPS.blink);
  const rightLagProgress = clamp((elapsedMs - 12) / durationMs, 0, 1);
  const rightCurve =
    rightLagProgress < 0.5
      ? rightLagProgress * 2
      : (1 - rightLagProgress) * 2;
  const rightStrength = clamp(rightCurve * blinkCap, 0, SARA_RFV2_EXPRESSION_CAPS.blink);

  if (normalizedProgress < 1) {
    const state: SaraRfv2BlinkState = {
      ...nextState,
      blinkProgress: normalizedProgress,
      blinkStrengthLeft: leftStrength,
      blinkStrengthRight: rightStrength,
    };

    return {
      state,
      targets: {
        eyeBlinkLeft: leftStrength,
        eyeBlinkRight: rightStrength,
      },
      debug: createBlinkDebug(state, presenceState),
    };
  }

  if (nextState.doubleBlinkQueued) {
    const doubleBlinkDelayMs = 90;
    const state: SaraRfv2BlinkState = {
      ...nextState,
      isBlinking: false,
      blinkProgress: 0,
      blinkStrengthLeft: 0,
      blinkStrengthRight: 0,
      blinkStartedAtMs: 0,
      blinkDurationMs: 0,
      lastBlinkAtMs: args.nowMs,
      nextBlinkAtMs: args.nowMs + doubleBlinkDelayMs,
      doubleBlinkQueued: false,
      partialBlink: false,
    };

    return {
      state,
      targets: ZERO_BLINK_TARGETS,
      debug: createBlinkDebug(state, presenceState),
    };
  }

  const scheduled = scheduleNextSaraBlink({
    nowMs: args.nowMs,
    state: {
      ...nextState,
      isBlinking: false,
      blinkProgress: 0,
      blinkStrengthLeft: 0,
      blinkStrengthRight: 0,
      blinkStartedAtMs: 0,
      blinkDurationMs: 0,
      lastBlinkAtMs: args.nowMs,
      partialBlink: false,
    },
    presenceState,
  });

  return {
    state: scheduled.state,
    targets: ZERO_BLINK_TARGETS,
    debug: createBlinkDebug(scheduled.state, presenceState),
  };
}

export function validateSaraRfv2BlinkConfig(): SaraRfv2BlinkValidationResult {
  const warnings: string[] = [];
  const blinkLeft = SARA_RFV2_MORPH_NAMES.eyes.blinkLeft;
  const blinkRight = SARA_RFV2_MORPH_NAMES.eyes.blinkRight;

  if (blinkLeft !== "eyeBlinkLeft") {
    warnings.push("Sara RFv2 left blink morph should be eyeBlinkLeft.");
  }
  if (blinkRight !== "eyeBlinkRight") {
    warnings.push("Sara RFv2 right blink morph should be eyeBlinkRight.");
  }

  const ranges: Array<[string, readonly [number, number]]> = [
    ["idleDelayRangeMs", SARA_RFV2_BLINK_TUNING.idleDelayRangeMs],
    ["listeningDelayRangeMs", SARA_RFV2_BLINK_TUNING.listeningDelayRangeMs],
    ["speakingDelayRangeMs", SARA_RFV2_BLINK_TUNING.speakingDelayRangeMs],
    ["blinkDurationMs", SARA_RFV2_BLINK_TUNING.blinkDurationMs],
  ];

  ranges.forEach(([label, range]) => {
    if (
      range.length !== 2 ||
      !Number.isFinite(range[0]) ||
      !Number.isFinite(range[1]) ||
      range[0] <= 0 ||
      range[1] < range[0]
    ) {
      warnings.push(`Sara RFv2 ${label} must be a valid positive range.`);
    }
  });

  const probabilities: Array<[string, number]> = [
    ["doubleBlinkChance", SARA_RFV2_BLINK_TUNING.doubleBlinkChance],
    ["partialBlinkChance", SARA_RFV2_BLINK_TUNING.partialBlinkChance],
  ];

  probabilities.forEach(([label, value]) => {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      warnings.push(`Sara RFv2 ${label} must be between 0 and 1.`);
    }
  });

  return {
    valid: warnings.length === 0,
    warnings,
  };
}
