import {
  SARA_RFV2_EXPRESSION_CAPS,
  SARA_RFV2_IDLE_TUNING,
  SARA_RFV2_LISTENING_TUNING,
  SARA_RFV2_MORPH_NAMES,
} from "./saraRfv2Config";
import { SARA_RFV2_FLAGS } from "./saraRfv2FeatureFlags";

/**
 * Sara RFv2 expression layer foundation only.
 *
 * Disabled by Sara RFv2 flags and not wired into ThreeAvatar, ActiveSession,
 * Sara V2 live rendering, or any production execution path. Future runtime
 * phases may consume the returned facial expression targets; the current Sara
 * live path remains unchanged.
 */

export type SaraRfv2Mood = "happy" | "sad" | "neutral";
export type SaraRfv2ExpressionPresenceState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking";

export interface SaraRfv2ExpressionTargets {
  readonly smile: number;
  readonly browLift: number;
  readonly browInnerUp: number;
  readonly cheekSquint: number;
  readonly eyeLook: number;
  readonly sadness: number;
}

export interface SaraRfv2ExpressionState {
  readonly enabled: false;
  readonly mood: SaraRfv2Mood;
  readonly presenceState: SaraRfv2ExpressionPresenceState;
  readonly activeExpressions: Readonly<Partial<SaraRfv2ExpressionTargets>>;
  readonly lastUpdatedAtMs: number;
}

export interface ComputeSaraRfv2ExpressionTargetsArgs {
  readonly mood: SaraRfv2Mood;
  readonly presenceState: SaraRfv2ExpressionPresenceState;
  readonly speaking: boolean;
  readonly listening: boolean;
  readonly thinking: boolean;
  readonly intensity?: number;
}

export interface ComputeSaraRfv2ExpressionTargetsResult {
  readonly targets: SaraRfv2ExpressionTargets;
  readonly activeExpression: string;
  readonly debug: {
    readonly enabled: boolean;
    readonly reason?: string;
    readonly mood: SaraRfv2Mood;
    readonly presenceState: SaraRfv2ExpressionPresenceState;
    readonly intensity: number;
  };
}

export interface UpdateSaraRfv2ExpressionLayerArgs {
  readonly state: SaraRfv2ExpressionState;
  readonly mood: SaraRfv2Mood;
  readonly presenceState: SaraRfv2ExpressionPresenceState;
  readonly speaking: boolean;
  readonly nowMs: number;
}

export interface UpdateSaraRfv2ExpressionLayerResult {
  readonly state: SaraRfv2ExpressionState;
  readonly targets: SaraRfv2ExpressionTargets;
  readonly debug: ComputeSaraRfv2ExpressionTargetsResult["debug"];
}

export interface SaraRfv2ExpressionValidationResult {
  readonly valid: boolean;
  readonly warnings: string[];
}

const NEUTRAL_TARGETS: SaraRfv2ExpressionTargets = {
  smile: 0,
  browLift: 0,
  browInnerUp: 0,
  cheekSquint: 0,
  eyeLook: 0,
  sadness: 0,
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function averageRange(range: readonly [number, number]): number {
  return (range[0] + range[1]) / 2;
}

function expressionFlagsEnabled(): boolean {
  return (
    SARA_RFV2_FLAGS.listeningExpressions ||
    SARA_RFV2_FLAGS.speakingExpressions ||
    SARA_RFV2_FLAGS.emotionLayer
  );
}

function capTargets(targets: SaraRfv2ExpressionTargets): SaraRfv2ExpressionTargets {
  return {
    smile: clamp(targets.smile, 0, SARA_RFV2_EXPRESSION_CAPS.mouthSmile),
    browLift: clamp(targets.browLift, 0, SARA_RFV2_EXPRESSION_CAPS.eyeLook),
    browInnerUp: clamp(targets.browInnerUp, 0, SARA_RFV2_EXPRESSION_CAPS.eyeLook),
    cheekSquint: clamp(targets.cheekSquint, 0, SARA_RFV2_EXPRESSION_CAPS.cheekSquint),
    eyeLook: clamp(targets.eyeLook, 0, SARA_RFV2_EXPRESSION_CAPS.eyeLook),
    sadness: clamp(targets.sadness, 0, SARA_RFV2_EXPRESSION_CAPS.sad),
  };
}

function scaleTargets(
  targets: SaraRfv2ExpressionTargets,
  intensity: number,
): SaraRfv2ExpressionTargets {
  return capTargets({
    smile: targets.smile * intensity,
    browLift: targets.browLift * intensity,
    browInnerUp: targets.browInnerUp * intensity,
    cheekSquint: targets.cheekSquint * intensity,
    eyeLook: targets.eyeLook * intensity,
    sadness: targets.sadness * intensity,
  });
}

function resolvePresencePreset(
  args: ComputeSaraRfv2ExpressionTargetsArgs,
): { activeExpression: string; targets: SaraRfv2ExpressionTargets } {
  if (args.speaking || args.presenceState === "speaking") {
    return {
      activeExpression: "speaking",
      targets: {
        smile: 0.032,
        browLift: 0.012,
        browInnerUp: 0.008,
        cheekSquint: 0.016,
        eyeLook: 0.018,
        sadness: 0,
      },
    };
  }

  if (args.listening || args.presenceState === "listening") {
    return {
      activeExpression: "listening",
      targets: {
        smile: averageRange(SARA_RFV2_LISTENING_TUNING.smileWarmthRange),
        browLift: averageRange(SARA_RFV2_LISTENING_TUNING.browLiftRange),
        browInnerUp: 0.018,
        cheekSquint: averageRange(SARA_RFV2_LISTENING_TUNING.cheekSupportRange),
        eyeLook: 0.024,
        sadness: 0,
      },
    };
  }

  if (args.thinking || args.presenceState === "thinking") {
    return {
      activeExpression: "thinking",
      targets: {
        smile: 0.014,
        browLift: 0.018,
        browInnerUp: 0.016,
        cheekSquint: 0.01,
        eyeLook: 0.026,
        sadness: 0,
      },
    };
  }

  return {
    activeExpression: "idle",
    targets: {
      smile: averageRange(SARA_RFV2_IDLE_TUNING.smileWarmthRange),
      browLift: 0.004,
      browInnerUp: 0,
      cheekSquint: averageRange(SARA_RFV2_IDLE_TUNING.cheekSupportRange),
      eyeLook: 0.01,
      sadness: 0,
    },
  };
}

function applyMoodPreset(
  mood: SaraRfv2Mood,
  base: SaraRfv2ExpressionTargets,
): { activeExpression: string | null; targets: SaraRfv2ExpressionTargets } {
  if (mood === "happy") {
    return {
      activeExpression: "happy",
      targets: {
        ...base,
        smile: Math.max(base.smile, 0.072),
        cheekSquint: Math.max(base.cheekSquint, 0.04),
        browLift: Math.max(base.browLift, 0.018),
        sadness: 0,
      },
    };
  }

  if (mood === "sad") {
    return {
      activeExpression: "sad",
      targets: {
        ...base,
        smile: Math.min(base.smile, 0.012),
        browLift: Math.max(base.browLift, 0.018),
        browInnerUp: Math.max(base.browInnerUp, 0.024),
        cheekSquint: Math.min(base.cheekSquint, 0.012),
        sadness: SARA_RFV2_EXPRESSION_CAPS.sad,
      },
    };
  }

  return {
    activeExpression: null,
    targets: base,
  };
}

export function createSaraRfv2ExpressionState(): SaraRfv2ExpressionState {
  return {
    enabled: false,
    mood: "neutral",
    presenceState: "idle",
    activeExpressions: {},
    lastUpdatedAtMs: 0,
  };
}

export function computeSaraRfv2ExpressionTargets(
  args: ComputeSaraRfv2ExpressionTargetsArgs,
): ComputeSaraRfv2ExpressionTargetsResult {
  const intensity = clamp(args.intensity ?? 1, 0, 1);

  if (!expressionFlagsEnabled()) {
    return {
      targets: NEUTRAL_TARGETS,
      activeExpression: "neutral",
      debug: {
        enabled: false,
        reason: "Sara RFv2 expression layer disabled by feature flags.",
        mood: args.mood,
        presenceState: args.presenceState,
        intensity,
      },
    };
  }

  const presencePreset = resolvePresencePreset(args);
  const moodPreset = applyMoodPreset(args.mood, presencePreset.targets);
  const activeExpression = moodPreset.activeExpression ?? presencePreset.activeExpression;

  return {
    targets: scaleTargets(moodPreset.targets, intensity),
    activeExpression,
    debug: {
      enabled: true,
      mood: args.mood,
      presenceState: args.presenceState,
      intensity,
    },
  };
}

export function updateSaraRfv2ExpressionLayer(
  args: UpdateSaraRfv2ExpressionLayerArgs,
): UpdateSaraRfv2ExpressionLayerResult {
  const computed = computeSaraRfv2ExpressionTargets({
    mood: args.mood,
    presenceState: args.presenceState,
    speaking: args.speaking,
    listening: args.presenceState === "listening",
    thinking: args.presenceState === "thinking",
  });
  const state: SaraRfv2ExpressionState = {
    ...args.state,
    enabled: false,
    mood: args.mood,
    presenceState: args.presenceState,
    activeExpressions: computed.targets,
    lastUpdatedAtMs: args.nowMs,
  };

  return {
    state,
    targets: computed.targets,
    debug: computed.debug,
  };
}

export function validateSaraRfv2ExpressionConfig():
  SaraRfv2ExpressionValidationResult {
  const warnings: string[] = [];
  const requiredMorphs = [
    SARA_RFV2_MORPH_NAMES.mouth.smileLeft,
    SARA_RFV2_MORPH_NAMES.mouth.smileRight,
    SARA_RFV2_MORPH_NAMES.cheeks.squintLeft,
    SARA_RFV2_MORPH_NAMES.cheeks.squintRight,
    SARA_RFV2_MORPH_NAMES.eyes.lookUpLeft,
    SARA_RFV2_MORPH_NAMES.eyes.lookUpRight,
    SARA_RFV2_MORPH_NAMES.emotions.sad,
  ];

  requiredMorphs.forEach((name) => {
    if (!name || typeof name !== "string") {
      warnings.push("Sara RFv2 expression morph names must be non-empty strings.");
    }
  });

  const caps: Array<[string, number]> = [
    ["mouthSmile", SARA_RFV2_EXPRESSION_CAPS.mouthSmile],
    ["cheekSquint", SARA_RFV2_EXPRESSION_CAPS.cheekSquint],
    ["eyeLook", SARA_RFV2_EXPRESSION_CAPS.eyeLook],
    ["sad", SARA_RFV2_EXPRESSION_CAPS.sad],
  ];

  caps.forEach(([label, value]) => {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      warnings.push(`Sara RFv2 expression cap ${label} must be between 0 and 1.`);
    }
  });

  if (
    !Array.isArray(SARA_RFV2_IDLE_TUNING.smileWarmthRange) ||
    SARA_RFV2_IDLE_TUNING.smileWarmthRange[1] <
      SARA_RFV2_IDLE_TUNING.smileWarmthRange[0]
  ) {
    warnings.push("Sara RFv2 idle smile warmth range must be valid.");
  }

  if (
    !Array.isArray(SARA_RFV2_LISTENING_TUNING.smileWarmthRange) ||
    SARA_RFV2_LISTENING_TUNING.smileWarmthRange[1] <
      SARA_RFV2_LISTENING_TUNING.smileWarmthRange[0]
  ) {
    warnings.push("Sara RFv2 listening smile warmth range must be valid.");
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}
