import { SARA_RFV2_EXPRESSION_CAPS } from "./saraRfv2Config";
import { SARA_RFV2_FLAGS } from "./saraRfv2FeatureFlags";
import {
  createSaraRfv2PhonemeState,
  updateSaraRfv2PhonemeDriver,
  validateSaraRfv2PhonemeDriverConfig,
  type SaraRfv2PhonemeState,
  type SaraRfv2PhonemeTimelineItem,
} from "./saraRfv2PhonemeDriver";
import {
  createSaraRfv2BlinkState,
  updateSaraRfv2BlinkSystem,
  validateSaraRfv2BlinkConfig,
  type SaraRfv2BlinkState,
} from "./saraRfv2BlinkSystem";
import {
  createSaraRfv2ExpressionState,
  updateSaraRfv2ExpressionLayer,
  validateSaraRfv2ExpressionConfig,
  type SaraRfv2ExpressionPresenceState,
  type SaraRfv2ExpressionState,
  type SaraRfv2ExpressionTargets,
  type SaraRfv2Mood,
} from "./saraRfv2ExpressionLayer";
import {
  createSaraBehaviorTimingState,
  updateSaraBehaviorTimingScheduler,
  type SaraBehaviorTimingState,
} from "./saraBehaviorTimingScheduler";

/**
 * Sara RFv2 runtime adapter scaffold only.
 *
 * Foundation only: this adapter is not wired into ThreeAvatar, ActiveSession,
 * Sara V2 live rendering, or any production execution path. All Sara RFv2
 * flags are disabled, and the current Sara live path remains Sara V2 /
 * legacyHybrid. A future phase may wire this behind a private dev flag only.
 *
 * Future conflict priority order:
 * 1. Blink targets override expression eye blink targets.
 * 2. Phoneme visemes override generic mouth expression targets.
 * 3. Expression smile can support but not override active viseme.
 * 4. Behavior scheduler can modulate expression intensity only.
 * 5. Safety caps from saraRfv2Config always win.
 */

export interface SaraRfv2RuntimeState {
  readonly enabled: false;
  readonly phonemeState: SaraRfv2PhonemeState;
  readonly blinkState: SaraRfv2BlinkState;
  readonly expressionState: SaraRfv2ExpressionState;
  readonly behaviorState: SaraBehaviorTimingState;
  readonly lastUpdatedAtMs: number;
}

export interface UpdateSaraRfv2RuntimeAdapterArgs {
  readonly state: SaraRfv2RuntimeState;
  readonly timeline: readonly SaraRfv2PhonemeTimelineItem[];
  readonly audioCurrentTime: number;
  readonly speaking: boolean;
  readonly presenceState: SaraRfv2ExpressionPresenceState;
  readonly mood: SaraRfv2Mood;
  readonly nowMs: number;
}

export interface SaraRfv2RuntimeTargets {
  readonly morphs: Record<string, number>;
  readonly bones: Record<string, number>;
  readonly debug: Record<string, unknown>;
}

export interface UpdateSaraRfv2RuntimeAdapterResult {
  readonly state: SaraRfv2RuntimeState;
  readonly targets: SaraRfv2RuntimeTargets;
  readonly debug: {
    readonly enabled: false;
    readonly reason: string;
    readonly flags: typeof SARA_RFV2_FLAGS;
    readonly modules?: Record<string, unknown>;
  };
}

export interface SaraRfv2RuntimeAdapterValidationResult {
  readonly valid: boolean;
  readonly warnings: string[];
}

function createEmptyTargets(debug: Record<string, unknown> = {}): SaraRfv2RuntimeTargets {
  return {
    morphs: {},
    bones: {},
    debug,
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function mergeMorphTargets(
  phonemeTargets: Readonly<Record<string, number>>,
  blinkTargets: Readonly<Record<string, number>>,
  expressionTargets: SaraRfv2ExpressionTargets,
): Record<string, number> {
  const morphs: Record<string, number> = {};

  Object.entries(expressionTargets).forEach(([name, value]) => {
    if (name === "smile") {
      morphs[name] = clamp(value, 0, SARA_RFV2_EXPRESSION_CAPS.mouthSmile);
      return;
    }
    if (name === "cheekSquint") {
      morphs[name] = clamp(value, 0, SARA_RFV2_EXPRESSION_CAPS.cheekSquint);
      return;
    }
    if (name === "sadness") {
      morphs[name] = clamp(value, 0, SARA_RFV2_EXPRESSION_CAPS.sad);
      return;
    }
    morphs[name] = clamp(value, 0, SARA_RFV2_EXPRESSION_CAPS.eyeLook);
  });

  Object.entries(phonemeTargets).forEach(([name, value]) => {
    morphs[name] = value;
  });

  Object.entries(blinkTargets).forEach(([name, value]) => {
    morphs[name] = clamp(value, 0, SARA_RFV2_EXPRESSION_CAPS.blink);
  });

  return morphs;
}

export function createSaraRfv2RuntimeState(): SaraRfv2RuntimeState {
  return {
    enabled: false,
    phonemeState: createSaraRfv2PhonemeState(),
    blinkState: createSaraRfv2BlinkState(),
    expressionState: createSaraRfv2ExpressionState(),
    behaviorState: createSaraBehaviorTimingState(),
    lastUpdatedAtMs: 0,
  };
}

export function updateSaraRfv2RuntimeAdapter(
  args: UpdateSaraRfv2RuntimeAdapterArgs,
): UpdateSaraRfv2RuntimeAdapterResult {
  if (!SARA_RFV2_FLAGS.runtime) {
    return {
      state: {
        ...args.state,
        enabled: false,
        lastUpdatedAtMs: args.nowMs,
      },
      targets: createEmptyTargets({
        runtime: false,
        reason: "Sara RFv2 runtime adapter disabled by feature flag.",
      }),
      debug: {
        enabled: false,
        reason: "Sara RFv2 runtime adapter disabled by feature flag.",
        flags: SARA_RFV2_FLAGS,
      },
    };
  }

  const phoneme = updateSaraRfv2PhonemeDriver({
    state: args.state.phonemeState,
    timeline: args.timeline,
    audioCurrentTime: args.audioCurrentTime,
    speaking: args.speaking,
    nowMs: args.nowMs,
  });
  const blink = updateSaraRfv2BlinkSystem({
    state: args.state.blinkState,
    nowMs: args.nowMs,
    presenceState: args.presenceState,
    speaking: args.speaking,
  });
  const expression = updateSaraRfv2ExpressionLayer({
    state: args.state.expressionState,
    mood: args.mood,
    presenceState: args.presenceState,
    speaking: args.speaking,
    nowMs: args.nowMs,
  });
  const behavior = updateSaraBehaviorTimingScheduler(args.state.behaviorState);

  const state: SaraRfv2RuntimeState = {
    ...args.state,
    enabled: false,
    phonemeState: phoneme.state,
    blinkState: blink.state,
    expressionState: expression.state,
    behaviorState: behavior.state,
    lastUpdatedAtMs: args.nowMs,
  };

  return {
    state,
    targets: {
      morphs: mergeMorphTargets(phoneme.targets, blink.targets, expression.targets),
      bones: {},
      debug: {
        phoneme: phoneme.debug,
        blink: blink.debug,
        expression: expression.debug,
        behavior: behavior.debug,
      },
    },
    debug: {
      enabled: false,
      reason: "Sara RFv2 runtime adapter scaffold only; not wired.",
      flags: SARA_RFV2_FLAGS,
      modules: {
        phoneme: phoneme.debug,
        blink: blink.debug,
        expression: expression.debug,
        behavior: behavior.debug,
      },
    },
  };
}

export function validateSaraRfv2RuntimeAdapter():
  SaraRfv2RuntimeAdapterValidationResult {
  const validations = [
    validateSaraRfv2PhonemeDriverConfig(),
    validateSaraRfv2BlinkConfig(),
    validateSaraRfv2ExpressionConfig(),
  ];
  const warnings = validations.flatMap((result) => result.warnings);

  if (SARA_RFV2_FLAGS.runtime) {
    warnings.push("Sara RFv2 runtime flag should remain disabled during scaffold phases.");
  }

  return {
    valid: validations.every((result) => result.valid) && warnings.length === 0,
    warnings,
  };
}
