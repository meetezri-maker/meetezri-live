import * as THREE from "three";
import { SARA_V3_AVATAR_DEFINITION } from "./saraV3Config";
import { applySaraV3MorphValues } from "./saraV3MorphBinding";
import { writeSaraV3EyeDiagnostics } from "./saraV3Diagnostics";
import type { SaraV3BindingSet, SaraV3EyeRuntimeState, SaraV3RuntimeMode } from "./saraV3Types";

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

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
    nextEyeballAtMs: 0,
    eyeballStartedAtMs: null,
    eyeballMoveMs: 0,
    eyeballHoldMs: 0,
    eyeballReturnMs: 0,
    eyeballTarget: 0,
    eyeballValue: 0,
    lastNowMs: 0,
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

  const isIdle = args.activePresenceState === "idle";

  // Non-idle eyelid/socket micro-drift (eyeLook* morphs on the face skin).
  // Left exactly as before for non-idle modes. In idle it is suppressed to 0
  // so it never combines with the eyeball-gaze movement below.
  const idleEye = SARA_V3_AVATAR_DEFINITION.saraV3.idleEyeConfig;
  let eyeLookUp = 0;
  let eyeLookDown = 0;
  if (idleEye.enabled && !isIdle) {
    const t = args.nowMs / 1000;
    const drift =
      Math.sin(t * idleEye.primarySpeed) * 0.6 +
      Math.sin(t * idleEye.secondarySpeed + 1.3) * 0.4;
    const modeScale = idleEye.modeScale[args.activePresenceState] ?? 1;
    const vertical = drift * idleEye.verticalAmplitude * modeScale;
    eyeLookUp = Math.max(0, vertical);
    eyeLookDown = Math.max(0, -vertical);
  }

  // Idle-only eyeball gaze: scheduled, slow, event-based glances driven through
  // the LeftEyeball/RightEyeball morph targets (which actually rotate the eye
  // meshes). Both eyes share one signed target so they stay coordinated. The
  // value is damped every frame, so it eases in/out during a glance AND eases
  // smoothly back to zero the moment idle ends.
  const eyeballCfg = SARA_V3_AVATAR_DEFINITION.saraV3.idleEyeballConfig;
  let eyeballTargetValue = 0;
  if (eyeballCfg.enabled && isIdle) {
    if (args.state.nextEyeballAtMs === 0) {
      args.state.nextEyeballAtMs =
        args.nowMs + randomBetween(eyeballCfg.minIntervalMs, eyeballCfg.maxIntervalMs);
    }
    // Do not START a new glance mid-blink (avoids driving the eyes during a blink).
    if (
      args.state.eyeballStartedAtMs == null &&
      args.nowMs >= args.state.nextEyeballAtMs &&
      args.state.blinkStartedAtMs == null
    ) {
      args.state.eyeballStartedAtMs = args.nowMs;
      args.state.eyeballMoveMs = randomBetween(eyeballCfg.moveMs[0], eyeballCfg.moveMs[1]);
      args.state.eyeballHoldMs = randomBetween(eyeballCfg.holdMs[0], eyeballCfg.holdMs[1]);
      args.state.eyeballReturnMs = randomBetween(eyeballCfg.returnMs[0], eyeballCfg.returnMs[1]);
      const magnitude = randomBetween(eyeballCfg.minInfluence, eyeballCfg.maxInfluence);
      args.state.eyeballTarget = magnitude * (Math.random() < 0.5 ? -1 : 1);
    }
    let eyeballStrength = 0;
    if (args.state.eyeballStartedAtMs != null) {
      const elapsed = args.nowMs - args.state.eyeballStartedAtMs;
      const moveMs = args.state.eyeballMoveMs;
      const holdMs = args.state.eyeballHoldMs;
      const returnMs = args.state.eyeballReturnMs;
      if (elapsed <= moveMs) {
        eyeballStrength = easeInOutSine(elapsed / Math.max(1, moveMs));
      } else if (elapsed <= moveMs + holdMs) {
        eyeballStrength = 1;
      } else if (elapsed <= moveMs + holdMs + returnMs) {
        eyeballStrength = 1 - easeInOutSine((elapsed - moveMs - holdMs) / Math.max(1, returnMs));
      } else {
        args.state.eyeballStartedAtMs = null;
        args.state.eyeballTarget = 0;
        args.state.nextEyeballAtMs =
          args.nowMs + randomBetween(eyeballCfg.minIntervalMs, eyeballCfg.maxIntervalMs);
        eyeballStrength = 0;
      }
    }
    const blinkReduction = 1 - clamp01(blinkBase) * eyeballCfg.blinkReductionFactor;
    eyeballTargetValue = args.state.eyeballTarget * eyeballStrength * blinkReduction;
  } else {
    // Leaving idle: stop scheduling; the damped value eases back to zero below.
    args.state.eyeballStartedAtMs = null;
    args.state.nextEyeballAtMs = 0;
  }

  const eyeballDtMs = args.state.lastNowMs > 0 ? args.nowMs - args.state.lastNowMs : 16;
  const eyeballDt = Math.min(0.1, Math.max(0, eyeballDtMs / 1000));
  args.state.lastNowMs = args.nowMs;
  args.state.eyeballValue = THREE.MathUtils.damp(
    args.state.eyeballValue,
    eyeballTargetValue,
    eyeballCfg.dampLambda,
    eyeballDt
  );

  const appliedEyeMorphs = {
    [SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.eyeBlinkLeft]: leftBlink,
    [SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.eyeBlinkRight]: rightBlink,
    [SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.eyeLookUpLeft]: eyeLookUp,
    [SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.eyeLookUpRight]: eyeLookUp,
    [SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.eyeLookDownLeft]: eyeLookDown,
    [SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.eyeLookDownRight]: eyeLookDown,
    [SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.leftEyeball]: args.state.eyeballValue,
    [SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.rightEyeball]: args.state.eyeballValue,
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
