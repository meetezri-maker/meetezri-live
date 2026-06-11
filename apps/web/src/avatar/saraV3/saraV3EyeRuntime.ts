import { SARA_V3_AVATAR_DEFINITION } from "./saraV3Config";
import { applySaraV3MorphValues } from "./saraV3MorphBinding";
import { writeSaraV3EyeDiagnostics } from "./saraV3Diagnostics";
import type { SaraV3BindingSet, SaraV3EyeRuntimeState, SaraV3RuntimeMode } from "./saraV3Types";

function getBlinkIntervalRange(activePresenceState: SaraV3RuntimeMode) {
  switch (activePresenceState) {
    case "listening":
      return { minIntervalMs: 2800, maxIntervalMs: 5200 };
    case "thinking":
      return { minIntervalMs: 2200, maxIntervalMs: 4500 };
    case "speaking":
      return { minIntervalMs: 3000, maxIntervalMs: 6000 };
    case "idle":
    default:
      return { minIntervalMs: 3500, maxIntervalMs: 6500 };
  }
}

function nextBlinkDelayMs(activePresenceState: SaraV3RuntimeMode) {
  const { minIntervalMs, maxIntervalMs } = getBlinkIntervalRange(activePresenceState);
  return minIntervalMs + Math.random() * (maxIntervalMs - minIntervalMs);
}

function scheduleNextBlink(nowMs: number, activePresenceState: SaraV3RuntimeMode) {
  const delayMs = nextBlinkDelayMs(activePresenceState);
  return {
    nextBlinkAtMs: nowMs + delayMs,
    nextBlinkDelayMs: delayMs,
  };
}

function nextBlinkAsymmetry() {
  const { asymmetryMax } = SARA_V3_AVATAR_DEFINITION.saraV3.blinkConfig;
  return (Math.random() * 2 - 1) * asymmetryMax;
}

function easeInOutSine(progress: number) {
  const clamped = clamp01(progress);
  return -(Math.cos(Math.PI * clamped) - 1) / 2;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function createSaraV3EyeRuntimeState(): SaraV3EyeRuntimeState {
  return {
    nextBlinkAtMs: 0,
    blinkStartedAtMs: null,
    blinkValue: 0,
    blinkAsymmetry: 0,
    leftBlinkTarget: 0,
    rightBlinkTarget: 0,
    nextBlinkDelayMs: 0,
    appliedEyeMorphs: {},
    coordinatedMorphs: {},
  };
}

export function updateSaraV3EyeRuntime(args: {
  state: SaraV3EyeRuntimeState;
  bindings: SaraV3BindingSet;
  activePresenceState: SaraV3RuntimeMode;
  nowMs: number;
}) {
  if (args.state.nextBlinkAtMs === 0) {
    const nextBlink = scheduleNextBlink(args.nowMs, args.activePresenceState);
    args.state.nextBlinkAtMs = nextBlink.nextBlinkAtMs;
    args.state.nextBlinkDelayMs = nextBlink.nextBlinkDelayMs;
  }

  if (args.state.blinkStartedAtMs == null && args.nowMs >= args.state.nextBlinkAtMs) {
    args.state.blinkStartedAtMs = args.nowMs;
    args.state.blinkAsymmetry = nextBlinkAsymmetry();
    const targetVariation = Math.random() * 0.08 - 0.04;
    args.state.leftBlinkTarget = clamp01(0.82 + targetVariation + Math.max(0, args.state.blinkAsymmetry));
    args.state.rightBlinkTarget = clamp01(0.78 - targetVariation + Math.max(0, -args.state.blinkAsymmetry));
  }

  let blinkPhase: "idle" | "closing" | "hold" | "opening" = "idle";
  let blinkProgress = 0;

  if (args.state.blinkStartedAtMs != null) {
    const { closeMs, holdMs, openMs } = SARA_V3_AVATAR_DEFINITION.saraV3.blinkConfig;
    const elapsed = args.nowMs - args.state.blinkStartedAtMs;
    if (elapsed <= closeMs) {
      blinkPhase = "closing";
      blinkProgress = clamp01(elapsed / closeMs);
      args.state.blinkValue = easeInOutSine(blinkProgress);
    } else if (elapsed <= closeMs + holdMs) {
      blinkPhase = "hold";
      blinkProgress = clamp01((elapsed - closeMs) / Math.max(1, holdMs));
      args.state.blinkValue = 1;
    } else if (elapsed <= closeMs + holdMs + openMs) {
      const releaseElapsed = elapsed - closeMs - holdMs;
      blinkPhase = "opening";
      blinkProgress = clamp01(releaseElapsed / openMs);
      args.state.blinkValue = 1 - easeInOutSine(blinkProgress);
    } else {
      args.state.blinkValue = 0;
      args.state.blinkStartedAtMs = null;
      args.state.leftBlinkTarget = 0;
      args.state.rightBlinkTarget = 0;
      const nextBlink = scheduleNextBlink(args.nowMs, args.activePresenceState);
      args.state.nextBlinkAtMs = nextBlink.nextBlinkAtMs;
      args.state.nextBlinkDelayMs = nextBlink.nextBlinkDelayMs;
      args.state.blinkAsymmetry = 0;
      blinkPhase = "idle";
      blinkProgress = 0;
    }
  }

  const blinkBase = args.state.blinkValue;
  const leftBlink = args.state.leftBlinkTarget * blinkBase;
  const rightBlink = args.state.rightBlinkTarget * blinkBase;
  const appliedEyeMorphs = {
    [SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.eyeBlinkLeft]: leftBlink,
    [SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.eyeBlinkRight]: rightBlink,
  };
  const blinkSupportWeight = blinkPhase === "opening" ? 1 - blinkProgress : blinkBase > 0 ? 1 : 0;
  const eyebrowBlinkSupport = blinkBase > 0 ? -(0.006 + blinkSupportWeight * 0.006) : 0;
  const cheekBlinkSupport = blinkBase > 0 ? 0.002 + blinkSupportWeight * 0.004 : 0;
  const coordinatedMorphs = {
    [SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.cheekLeft]: cheekBlinkSupport,
    [SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.cheekRight]: cheekBlinkSupport,
    [SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.eyebrows]: eyebrowBlinkSupport,
  };

  applySaraV3MorphValues(args.bindings, appliedEyeMorphs);

  args.state.appliedEyeMorphs = appliedEyeMorphs;
  args.state.coordinatedMorphs = coordinatedMorphs;

  writeSaraV3EyeDiagnostics({
    nextBlinkAtMs: args.state.nextBlinkAtMs,
    blinkActive: args.state.blinkStartedAtMs != null,
    blinkValue: blinkBase,
    blinkPhase,
    blinkProgress,
    leftBlinkTarget: args.state.leftBlinkTarget,
    rightBlinkTarget: args.state.rightBlinkTarget,
    eyebrowBlinkSupport,
    cheekBlinkSupport,
    nextBlinkDelayMs: args.state.nextBlinkDelayMs,
    appliedEyeMorphs,
    coordinatedMorphs,
  });
}
