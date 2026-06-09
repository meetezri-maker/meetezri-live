import { SARA_RFV2_ENABLED, SARA_RFV2_MODEL } from "./saraRfv2Config";
import { ENABLE_SARA_RFV2_RUNTIME, SARA_RFV2_FLAGS } from "./saraRfv2FeatureFlags";
import {
  validateSaraRfv2PhonemeDriverConfig,
  type SaraRfv2PhonemeState,
} from "./saraRfv2PhonemeDriver";
import {
  validateSaraRfv2BlinkConfig,
  type SaraRfv2BlinkState,
} from "./saraRfv2BlinkSystem";
import {
  validateSaraRfv2ExpressionConfig,
  type SaraRfv2ExpressionState,
} from "./saraRfv2ExpressionLayer";
import { type SaraBehaviorTimingState } from "./saraBehaviorTimingScheduler";
import {
  validateSaraRfv2RuntimeAdapter,
  type SaraRfv2RuntimeState,
} from "./saraRfv2RuntimeAdapter";
import {
  SARA_RFV2_FORBIDDEN_MORPHS,
  SARA_RFV2_TARGET_MAP,
  validateSaraRfv2TargetMap,
} from "./saraRfv2TargetMap";
import {
  validateSaraRfv2SmoothingLayer,
  type SaraRfv2SmoothingState,
} from "./saraRfv2SmoothingLayer";

/**
 * Sara RFv2 diagnostics layer.
 *
 * Foundation only. This module is not wired into live runtime, ThreeAvatar,
 * ActiveSession, or Sara V2. It only returns diagnostic objects and never
 * writes to window, logs, creates timers, accesses the DOM, or applies morphs.
 * Sara still uses the current Sara V2 / legacyHybrid path.
 */

export interface SaraRfv2DiagnosticsState {
  readonly enabled: false;
  readonly createdAtMs: number;
  readonly lastUpdatedAtMs: number;
}

export type SaraRfv2ReadinessCategory =
  | "not-ready"
  | "foundation"
  | "integration-ready"
  | "beta-ready";

export interface SaraRfv2Readiness {
  readonly score: number;
  readonly category: SaraRfv2ReadinessCategory;
}

export interface CollectSaraRfv2DiagnosticsArgs {
  readonly runtimeState?: SaraRfv2RuntimeState | null;
  readonly phonemeState?: SaraRfv2PhonemeState | null;
  readonly blinkState?: SaraRfv2BlinkState | null;
  readonly expressionState?: SaraRfv2ExpressionState | null;
  readonly smoothingState?: SaraRfv2SmoothingState | null;
}

export interface SaraRfv2DiagnosticsReport {
  readonly readiness: SaraRfv2Readiness;
  readonly flags: {
    readonly enabled: typeof SARA_RFV2_ENABLED;
    readonly runtimeEnabled: typeof ENABLE_SARA_RFV2_RUNTIME;
    readonly modules: typeof SARA_RFV2_FLAGS;
  };
  readonly phoneme: Record<string, unknown>;
  readonly blink: Record<string, unknown>;
  readonly expressions: Record<string, unknown>;
  readonly smoothing: Record<string, unknown>;
  readonly targetMap: Record<string, unknown>;
  readonly runtime: Record<string, unknown>;
  readonly warnings: string[];
}

const countObjectKeys = (value: unknown): number =>
  value && typeof value === "object" ? Object.keys(value).length : 0;

const summarizeBehaviorState = (
  behaviorState?: SaraBehaviorTimingState,
): Record<string, unknown> => ({
  enabled: behaviorState?.enabled ?? false,
  activeEventCount: behaviorState?.activeEvents.length ?? 0,
  queuedEventCount: behaviorState?.queuedEvents.length ?? 0,
  lastUpdatedAtMs: behaviorState?.lastUpdatedAtMs ?? 0,
});

const collectValidationWarnings = (): string[] => {
  const validations = [
    validateSaraRfv2PhonemeDriverConfig(),
    validateSaraRfv2BlinkConfig(),
    validateSaraRfv2ExpressionConfig(),
    validateSaraRfv2RuntimeAdapter(),
    validateSaraRfv2TargetMap(),
    validateSaraRfv2SmoothingLayer(),
  ];

  return validations.flatMap((validation) => validation.warnings);
};

export function createSaraRfv2DiagnosticsState(): SaraRfv2DiagnosticsState {
  return {
    enabled: false,
    createdAtMs: 0,
    lastUpdatedAtMs: 0,
  };
}

export function computeSaraRfv2Readiness(): SaraRfv2Readiness {
  const validations = [
    validateSaraRfv2PhonemeDriverConfig(),
    validateSaraRfv2BlinkConfig(),
    validateSaraRfv2ExpressionConfig(),
    validateSaraRfv2RuntimeAdapter(),
    validateSaraRfv2TargetMap(),
    validateSaraRfv2SmoothingLayer(),
  ];
  const validCount = validations.filter((validation) => validation.valid).length;
  const baseScore = Math.round((validCount / validations.length) * 70);
  const scaffoldScore = SARA_RFV2_MODEL.url ? 10 : 0;
  const targetMapScore = validateSaraRfv2TargetMap().valid ? 10 : 0;
  const disabledSafetyScore =
    !SARA_RFV2_ENABLED && !ENABLE_SARA_RFV2_RUNTIME && !SARA_RFV2_FLAGS.runtime
      ? 10
      : 0;
  const score = Math.min(100, baseScore + scaffoldScore + targetMapScore + disabledSafetyScore);

  if (score >= 90 && SARA_RFV2_FLAGS.runtime) {
    return { score, category: "beta-ready" };
  }

  if (score >= 80) {
    return { score, category: "integration-ready" };
  }

  if (score >= 50) {
    return { score, category: "foundation" };
  }

  return { score, category: "not-ready" };
}

export function collectSaraRfv2Diagnostics(
  args: CollectSaraRfv2DiagnosticsArgs,
): SaraRfv2DiagnosticsReport {
  const readiness = computeSaraRfv2Readiness();
  const phonemeValidation = validateSaraRfv2PhonemeDriverConfig();
  const blinkValidation = validateSaraRfv2BlinkConfig();
  const expressionValidation = validateSaraRfv2ExpressionConfig();
  const targetMapValidation = validateSaraRfv2TargetMap();
  const runtimeValidation = validateSaraRfv2RuntimeAdapter();
  const smoothingValidation = validateSaraRfv2SmoothingLayer();
  const warnings = collectValidationWarnings();

  return {
    readiness,
    flags: {
      enabled: SARA_RFV2_ENABLED,
      runtimeEnabled: ENABLE_SARA_RFV2_RUNTIME,
      modules: SARA_RFV2_FLAGS,
    },
    phoneme: {
      enabled: args.phonemeState?.enabled ?? false,
      activePhoneme: args.phonemeState?.activePhoneme ?? null,
      activeViseme: args.phonemeState?.activeViseme ?? "viseme_rest",
      targetCount: countObjectKeys(args.phonemeState?.targets),
      lastSpeechTime: args.phonemeState?.lastSpeechTime ?? 0,
      lastUpdatedAtMs: args.phonemeState?.lastUpdatedAtMs ?? 0,
      validation: phonemeValidation,
    },
    blink: {
      enabled: args.blinkState?.enabled ?? false,
      isBlinking: args.blinkState?.isBlinking ?? false,
      blinkProgress: args.blinkState?.blinkProgress ?? 0,
      nextBlinkAtMs: args.blinkState?.nextBlinkAtMs ?? 0,
      partialBlink: args.blinkState?.partialBlink ?? false,
      doubleBlinkQueued: args.blinkState?.doubleBlinkQueued ?? false,
      validation: blinkValidation,
    },
    expressions: {
      enabled: args.expressionState?.enabled ?? false,
      mood: args.expressionState?.mood ?? "neutral",
      presenceState: args.expressionState?.presenceState ?? "idle",
      activeExpressionCount: countObjectKeys(args.expressionState?.activeExpressions),
      lastUpdatedAtMs: args.expressionState?.lastUpdatedAtMs ?? 0,
      validation: expressionValidation,
    },
    smoothing: {
      enabled: args.smoothingState?.enabled ?? false,
      valueCount: countObjectKeys(args.smoothingState?.values),
      velocityCount: countObjectKeys(args.smoothingState?.velocities),
      lastUpdatedAtMs: args.smoothingState?.lastUpdatedAtMs ?? 0,
      validation: smoothingValidation,
    },
    targetMap: {
      visemeCount: Object.keys(SARA_RFV2_TARGET_MAP.visemes).length,
      mouthCount: Object.keys(SARA_RFV2_TARGET_MAP.mouth).length,
      eyeCount: Object.keys(SARA_RFV2_TARGET_MAP.eyes).length,
      expressionCount: Object.keys(SARA_RFV2_TARGET_MAP.expressions).length,
      forbiddenMorphs: SARA_RFV2_FORBIDDEN_MORPHS,
      validation: targetMapValidation,
    },
    runtime: {
      enabled: args.runtimeState?.enabled ?? false,
      lastUpdatedAtMs: args.runtimeState?.lastUpdatedAtMs ?? 0,
      behavior: summarizeBehaviorState(args.runtimeState?.behaviorState),
      validation: runtimeValidation,
    },
    warnings,
  };
}
