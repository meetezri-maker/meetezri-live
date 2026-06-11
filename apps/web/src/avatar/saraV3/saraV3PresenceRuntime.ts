import * as THREE from "three";
import { SARA_V3_AVATAR_DEFINITION } from "./saraV3Config";
import { applySaraV3MorphValues } from "./saraV3MorphBinding";
import { writeSaraV3Diagnostics } from "./saraV3Diagnostics";
import type { SaraV3BindingSet, SaraV3PresenceState, SaraV3RuntimeMode } from "./saraV3Types";

export function createSaraV3PresenceState(): SaraV3PresenceState {
  return {
    nextBlinkAtMs: 0,
    blinkStartedAtMs: null,
    blinkValue: 0,
    currentMode: "idle",
  };
}

function nextBlinkTime(nowMs: number) {
  const { minIntervalMs, maxIntervalMs } = SARA_V3_AVATAR_DEFINITION.saraV3.blinkConfig;
  return nowMs + minIntervalMs + Math.random() * (maxIntervalMs - minIntervalMs);
}

export function updateSaraV3PresenceRuntime(args: {
  state: SaraV3PresenceState;
  bindings: SaraV3BindingSet;
  nowMs: number;
  dt: number;
  isSpeaking: boolean;
  isListening: boolean;
  isThinking: boolean;
}) {
  const mode: SaraV3RuntimeMode = args.isSpeaking
    ? "speaking"
    : args.isThinking
      ? "thinking"
      : args.isListening
        ? "listening"
        : "idle";
  args.state.currentMode = mode;
  const config = SARA_V3_AVATAR_DEFINITION.saraV3.presenceConfig;
  const targetSet = config[mode];
  const nextValues: Record<string, number> = {};
  Object.entries(targetSet).forEach(([name, target]) => {
    const firstBinding = args.bindings.get(name)?.[0];
    const current = firstBinding?.mesh.morphTargetInfluences?.[firstBinding.index] ?? 0;
    nextValues[name] = THREE.MathUtils.damp(current, target, config.blendSpeed, args.dt);
  });

  if (args.state.nextBlinkAtMs === 0) {
    args.state.nextBlinkAtMs = nextBlinkTime(args.nowMs);
  }
  if (args.state.blinkStartedAtMs == null && args.nowMs >= args.state.nextBlinkAtMs) {
    args.state.blinkStartedAtMs = args.nowMs;
  }
  if (args.state.blinkStartedAtMs != null) {
    const { closeMs, holdMs, openMs, max } = SARA_V3_AVATAR_DEFINITION.saraV3.blinkConfig;
    const elapsed = args.nowMs - args.state.blinkStartedAtMs;
    if (elapsed <= closeMs) {
      args.state.blinkValue = (elapsed / closeMs) * max;
    } else if (elapsed <= closeMs + holdMs) {
      args.state.blinkValue = max;
    } else if (elapsed <= closeMs + holdMs + openMs) {
      const releaseElapsed = elapsed - closeMs - holdMs;
      args.state.blinkValue = max * (1 - releaseElapsed / openMs);
    } else {
      args.state.blinkValue = 0;
      args.state.blinkStartedAtMs = null;
      args.state.nextBlinkAtMs = nextBlinkTime(args.nowMs);
    }
  }
  nextValues[SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.eyeBlinkLeft] = args.state.blinkValue;
  nextValues[SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.eyeBlinkRight] = args.state.blinkValue;
  applySaraV3MorphValues(args.bindings, nextValues);
  writeSaraV3Diagnostics({
    presenceState: mode,
  });
}
