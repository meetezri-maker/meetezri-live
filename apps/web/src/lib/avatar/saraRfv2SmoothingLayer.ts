import {
  SARA_RFV2_EXPRESSION_CAPS,
  SARA_RFV2_FACE_TUNING,
  SARA_RFV2_MORPH_NAMES,
} from "./saraRfv2Config";
import { ENABLE_SARA_RFV2_RUNTIME, SARA_RFV2_FLAGS } from "./saraRfv2FeatureFlags";
import {
  SARA_RFV2_FORBIDDEN_MORPHS,
  SARA_RFV2_TARGET_MAP,
  validateSaraRfv2TargetMap,
} from "./saraRfv2TargetMap";

/**
 * Sara RFv2 smoothing layer.
 *
 * Foundation only. This module is not wired into live runtime, ThreeAvatar,
 * ActiveSession, or Sara V2. It returns target values only and never applies
 * morphs to Three.js objects. Sara still uses the current Sara V2 /
 * legacyHybrid path. Do not activate until a later explicit phase.
 */

export type SaraRfv2TargetClassification =
  | "viseme"
  | "jaw"
  | "blink"
  | "eyeLook"
  | "expression"
  | "cheek"
  | "brow"
  | "unknown";

export type SaraRfv2SmoothingState = {
  enabled: boolean;
  values: Record<string, number>;
  velocities: Record<string, number>;
  lastUpdatedAtMs: number;
};

export const SARA_RFV2_SMOOTHING_SPEEDS = {
  viseme: { attack: 18, release: 22 },
  jaw: { attack: 16, release: 28 },
  blink: { attack: 42, release: 36 },
  expression: { attack: 8, release: 10 },
  eyeLook: { attack: 6, release: 8 },
  cheek: { attack: 8, release: 10 },
  brow: { attack: 8, release: 10 },
  unknown: { attack: 10, release: 12 },
} as const;

export const createSaraRfv2SmoothingState = (): SaraRfv2SmoothingState => ({
  enabled: false,
  values: {},
  velocities: {},
  lastUpdatedAtMs: 0,
});

export const resetSaraRfv2SmoothingState = (): SaraRfv2SmoothingState =>
  createSaraRfv2SmoothingState();

export const classifySaraRfv2Target = (
  targetName: string,
): SaraRfv2TargetClassification => {
  if (targetName.startsWith("viseme_")) {
    return "viseme";
  }

  if (targetName === SARA_RFV2_MORPH_NAMES.mouth.jawOpen) {
    return "jaw";
  }

  if (targetName === "eyeBlinkLeft" || targetName === "eyeBlinkRight") {
    return "blink";
  }

  if (targetName.startsWith("eyeLook")) {
    return "eyeLook";
  }

  if (targetName.startsWith("cheekSquint")) {
    return "cheek";
  }

  if (targetName === "eyebrows" || targetName.toLowerCase().includes("brow")) {
    return "brow";
  }

  if (
    targetName === "smile" ||
    targetName === "sad" ||
    targetName.includes("Smile") ||
    targetName.includes("Frown")
  ) {
    return "expression";
  }

  return "unknown";
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const getSaraRfv2TargetCap = (targetName: string): number => {
  const classification = classifySaraRfv2Target(targetName);

  if (classification === "viseme") {
    return SARA_RFV2_FACE_TUNING.visemeMaxStrength;
  }

  if (classification === "jaw") {
    return SARA_RFV2_FACE_TUNING.jawOpenMax;
  }

  if (classification === "blink") {
    return SARA_RFV2_EXPRESSION_CAPS.blink;
  }

  if (classification === "eyeLook") {
    return SARA_RFV2_EXPRESSION_CAPS.eyeLook;
  }

  if (classification === "cheek") {
    return SARA_RFV2_EXPRESSION_CAPS.cheekSquint;
  }

  if (targetName.includes("Smile") || targetName === "smile") {
    return SARA_RFV2_EXPRESSION_CAPS.mouthSmile;
  }

  if (targetName.includes("Frown")) {
    return SARA_RFV2_EXPRESSION_CAPS.mouthFrown;
  }

  if (targetName === "sad") {
    return SARA_RFV2_EXPRESSION_CAPS.sad;
  }

  return 1;
};

const isForbiddenSaraRfv2Morph = (targetName: string): boolean =>
  SARA_RFV2_FORBIDDEN_MORPHS.some(({ morphName }) => morphName === targetName);

const getSmoothingSpeeds = (
  targetName: string,
  attackSpeed?: number,
  releaseSpeed?: number,
): { attack: number; release: number } => {
  const classification = classifySaraRfv2Target(targetName);
  const defaults = SARA_RFV2_SMOOTHING_SPEEDS[classification];

  return {
    attack: attackSpeed ?? defaults.attack,
    release: releaseSpeed ?? defaults.release,
  };
};

const smoothValue = (args: {
  current: number;
  target: number;
  deltaSeconds: number;
  attackSpeed: number;
  releaseSpeed: number;
  maxDeltaPerSecond?: number;
}): number => {
  const { current, target, deltaSeconds, attackSpeed, releaseSpeed, maxDeltaPerSecond } =
    args;
  const speed = target >= current ? attackSpeed : releaseSpeed;
  const blend = 1 - Math.exp(-speed * deltaSeconds);
  const next = current + (target - current) * blend;

  if (!maxDeltaPerSecond || maxDeltaPerSecond <= 0) {
    return next;
  }

  const maxDelta = maxDeltaPerSecond * deltaSeconds;
  const delta = next - current;
  if (Math.abs(delta) <= maxDelta) {
    return next;
  }

  return current + Math.sign(delta) * maxDelta;
};

export const smoothSaraRfv2Targets = (args: {
  state: SaraRfv2SmoothingState;
  rawTargets: Record<string, number>;
  nowMs: number;
  attackSpeed?: number;
  releaseSpeed?: number;
  maxDeltaPerSecond?: number;
  forceEnabled?: boolean;
}): {
  state: SaraRfv2SmoothingState;
  smoothedTargets: Record<string, number>;
  debug: Record<string, unknown>;
} => {
  const {
    state,
    rawTargets,
    nowMs,
    attackSpeed,
    releaseSpeed,
    maxDeltaPerSecond,
    forceEnabled,
  } = args;

  if (!forceEnabled && (!ENABLE_SARA_RFV2_RUNTIME || !SARA_RFV2_FLAGS.runtime)) {
    return {
      state: {
        enabled: false,
        values: {},
        velocities: {},
        lastUpdatedAtMs: nowMs,
      },
      smoothedTargets: {},
      debug: {
        enabled: false,
        reason: "Sara RFv2 smoothing scaffold only; runtime flag is disabled.",
      },
    };
  }

  const deltaSeconds =
    state.lastUpdatedAtMs > 0
      ? Math.max(0, Math.min(0.1, (nowMs - state.lastUpdatedAtMs) / 1000))
      : 1 / 60;
  const nextValues: Record<string, number> = {};
  const nextVelocities: Record<string, number> = {};
  const targetNames = new Set([
    ...Object.keys(state.values),
    ...Object.keys(rawTargets),
  ]);

  for (const targetName of targetNames) {
    if (isForbiddenSaraRfv2Morph(targetName)) {
      continue;
    }

    const cap = getSaraRfv2TargetCap(targetName);
    const rawValue = rawTargets[targetName] ?? 0;
    const target = Math.min(cap, clamp01(rawValue));
    const current = clamp01(state.values[targetName] ?? 0);
    const speeds = getSmoothingSpeeds(targetName, attackSpeed, releaseSpeed);
    const next = smoothValue({
      current,
      target,
      deltaSeconds,
      attackSpeed: speeds.attack,
      releaseSpeed: speeds.release,
      maxDeltaPerSecond,
    });
    const clampedNext = Math.min(cap, clamp01(next));

    if (clampedNext > 0.0001 || target > 0) {
      nextValues[targetName] = clampedNext;
      nextVelocities[targetName] =
        deltaSeconds > 0 ? (clampedNext - current) / deltaSeconds : 0;
    }
  }

  return {
    state: {
      enabled: true,
      values: nextValues,
      velocities: nextVelocities,
      lastUpdatedAtMs: nowMs,
    },
    smoothedTargets: { ...nextValues },
    debug: {
      enabled: true,
      forced: Boolean(forceEnabled),
      targetCount: Object.keys(nextValues).length,
      deltaSeconds,
    },
  };
};

export const validateSaraRfv2SmoothingLayer = (): {
  valid: boolean;
  warnings: string[];
} => {
  const warnings: string[] = [];
  const targetMapValidation = validateSaraRfv2TargetMap();

  if (!targetMapValidation.valid) {
    warnings.push(...targetMapValidation.warnings);
  }

  for (const [classification, speeds] of Object.entries(SARA_RFV2_SMOOTHING_SPEEDS)) {
    if (speeds.attack <= 0 || speeds.release <= 0) {
      warnings.push(`${classification} smoothing speeds must be positive.`);
    }
  }

  const caps = {
    jawOpen: SARA_RFV2_FACE_TUNING.jawOpenMax,
    viseme: SARA_RFV2_FACE_TUNING.visemeMaxStrength,
    blink: SARA_RFV2_EXPRESSION_CAPS.blink,
    smile: SARA_RFV2_EXPRESSION_CAPS.mouthSmile,
    frown: SARA_RFV2_EXPRESSION_CAPS.mouthFrown,
    cheek: SARA_RFV2_EXPRESSION_CAPS.cheekSquint,
    eyeLook: SARA_RFV2_EXPRESSION_CAPS.eyeLook,
    sad: SARA_RFV2_EXPRESSION_CAPS.sad,
  };

  for (const [capName, capValue] of Object.entries(caps)) {
    if (capValue < 0 || capValue > 1) {
      warnings.push(`${capName} cap must be within 0..1.`);
    }
  }

  for (const { morphName } of SARA_RFV2_FORBIDDEN_MORPHS) {
    if (morphName in SARA_RFV2_TARGET_MAP.mouth) {
      warnings.push(`Forbidden morph is present in mouth target map: ${morphName}.`);
    }

    const classification = classifySaraRfv2Target(morphName);
    if (classification !== "unknown") {
      warnings.push(`Forbidden morph should not be classified for smoothing: ${morphName}.`);
    }
  }

  const sampleClassifications = [
    SARA_RFV2_MORPH_NAMES.visemes.aa,
    SARA_RFV2_MORPH_NAMES.mouth.jawOpen,
    SARA_RFV2_MORPH_NAMES.eyes.blinkLeft,
    SARA_RFV2_MORPH_NAMES.eyes.lookUpLeft,
    SARA_RFV2_MORPH_NAMES.mouth.smileLeft,
    SARA_RFV2_MORPH_NAMES.cheeks.squintLeft,
    "eyebrows",
    "notARealTarget",
  ].map(classifySaraRfv2Target);

  if (sampleClassifications.length !== 8) {
    warnings.push("Target classification validation did not complete.");
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
};
