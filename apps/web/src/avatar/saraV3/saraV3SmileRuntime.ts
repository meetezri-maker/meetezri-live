import { SARA_V3_AVATAR_DEFINITION } from "./saraV3Config";
import { writeSaraV3SmileDiagnostics } from "./saraV3Diagnostics";
import type {
  SaraV3EyeRuntimeState,
  SaraV3RuntimeMode,
  SaraV3SmileRuntimeState,
} from "./saraV3Types";

type SmilePhase = "idle" | "fadeIn" | "hold" | "fadeOut";

const TOTAL_BLINK_MS =
  SARA_V3_AVATAR_DEFINITION.saraV3.blinkConfig.closeMs +
  SARA_V3_AVATAR_DEFINITION.saraV3.blinkConfig.holdMs +
  SARA_V3_AVATAR_DEFINITION.saraV3.blinkConfig.openMs;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(progress: number) {
  const x = clamp01(progress);
  return x * x * (3 - 2 * x);
}

function getSmileIntervalRange(activePresenceState: SaraV3RuntimeMode) {
  switch (activePresenceState) {
    case "listening":
      return { minIntervalMs: 4000, maxIntervalMs: 7000 };
    case "thinking":
      return { minIntervalMs: 7000, maxIntervalMs: 12000 };
    case "speaking":
      return { minIntervalMs: 8000, maxIntervalMs: 12000 };
    case "idle":
    default:
      return { minIntervalMs: 5000, maxIntervalMs: 9000 };
  }
}

function nextSmileDelayMs(activePresenceState: SaraV3RuntimeMode) {
  const { minIntervalMs, maxIntervalMs } = getSmileIntervalRange(activePresenceState);
  return minIntervalMs + Math.random() * (maxIntervalMs - minIntervalMs);
}

function scheduleNextSmile(nowMs: number, activePresenceState: SaraV3RuntimeMode) {
  return nowMs + nextSmileDelayMs(activePresenceState);
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function createSmileEventTargets(activePresenceState: SaraV3RuntimeMode) {
  const speakingScale = activePresenceState === "speaking" ? 0.35 : 1;
  const thinkingScale = activePresenceState === "thinking" ? 0.55 : 1;
  const scale = speakingScale * thinkingScale;

  return {
    smileFadeInMs: randomBetween(450, 700),
    smileHoldMs: randomBetween(500, 1200),
    smileFadeOutMs: randomBetween(700, 1200),
    smileLeftTarget: randomBetween(0.01, 0.025) * scale,
    smileRightTarget: randomBetween(0.012, 0.028) * scale,
    cheekLeftTarget: randomBetween(0.004, 0.01) * scale,
    cheekRightTarget: randomBetween(0.004, 0.01) * scale,
  };
}

function getBlinkSafeSmileStart(nowMs: number, eyeState: SaraV3EyeRuntimeState) {
  if (eyeState.blinkStartedAtMs != null) {
    return eyeState.blinkStartedAtMs + TOTAL_BLINK_MS + 150;
  }

  if (eyeState.nextBlinkAtMs !== 0 && eyeState.nextBlinkAtMs - nowMs <= 300) {
    return eyeState.nextBlinkAtMs + TOTAL_BLINK_MS + 150;
  }

  return null;
}

export function createSaraV3SmileRuntimeState(): SaraV3SmileRuntimeState {
  return {
    nextSmileAtMs: 0,
    smileStartedAtMs: null,
    smileFadeInMs: 0,
    smileHoldMs: 0,
    smileFadeOutMs: 0,
    smileLeftTarget: 0,
    smileRightTarget: 0,
    cheekLeftTarget: 0,
    cheekRightTarget: 0,
    smileAdditiveTargets: {},
    blockedByBlink: false,
    lastCollisionAvoidedAtMs: null,
  };
}

export function updateSaraV3SmileRuntime(args: {
  state: SaraV3SmileRuntimeState;
  activePresenceState: SaraV3RuntimeMode;
  eyeState: SaraV3EyeRuntimeState;
  nowMs: number;
}) {
  if (args.state.nextSmileAtMs === 0) {
    args.state.nextSmileAtMs = scheduleNextSmile(args.nowMs, args.activePresenceState);
  }

  if (args.state.smileStartedAtMs == null && args.nowMs >= args.state.nextSmileAtMs) {
    const safeStartAt = getBlinkSafeSmileStart(args.nowMs, args.eyeState);
    if (safeStartAt != null) {
      args.state.blockedByBlink = true;
      args.state.lastCollisionAvoidedAtMs = args.nowMs;
      args.state.nextSmileAtMs = safeStartAt + randomBetween(120, 420);
    } else {
      const smileEvent = createSmileEventTargets(args.activePresenceState);
      args.state.smileStartedAtMs = args.nowMs;
      args.state.blockedByBlink = false;
      args.state.smileFadeInMs = smileEvent.smileFadeInMs;
      args.state.smileHoldMs = smileEvent.smileHoldMs;
      args.state.smileFadeOutMs = smileEvent.smileFadeOutMs;
      args.state.smileLeftTarget = smileEvent.smileLeftTarget;
      args.state.smileRightTarget = smileEvent.smileRightTarget;
      args.state.cheekLeftTarget = smileEvent.cheekLeftTarget;
      args.state.cheekRightTarget = smileEvent.cheekRightTarget;
    }
  }

  let smilePhase: SmilePhase = "idle";
  let smileProgress = 0;
  let smileStrength = 0;

  if (args.state.smileStartedAtMs != null) {
    const elapsed = args.nowMs - args.state.smileStartedAtMs;
    if (elapsed <= args.state.smileFadeInMs) {
      smilePhase = "fadeIn";
      smileProgress = clamp01(elapsed / Math.max(1, args.state.smileFadeInMs));
      smileStrength = smoothstep(smileProgress);
    } else if (elapsed <= args.state.smileFadeInMs + args.state.smileHoldMs) {
      smilePhase = "hold";
      smileProgress = clamp01(
        (elapsed - args.state.smileFadeInMs) / Math.max(1, args.state.smileHoldMs)
      );
      smileStrength = 1;
    } else if (
      elapsed <=
      args.state.smileFadeInMs + args.state.smileHoldMs + args.state.smileFadeOutMs
    ) {
      smilePhase = "fadeOut";
      smileProgress = clamp01(
        (elapsed - args.state.smileFadeInMs - args.state.smileHoldMs) /
          Math.max(1, args.state.smileFadeOutMs)
      );
      smileStrength = 1 - smoothstep(smileProgress);
    } else {
      args.state.smileStartedAtMs = null;
      args.state.smileFadeInMs = 0;
      args.state.smileHoldMs = 0;
      args.state.smileFadeOutMs = 0;
      args.state.smileLeftTarget = 0;
      args.state.smileRightTarget = 0;
      args.state.cheekLeftTarget = 0;
      args.state.cheekRightTarget = 0;
      args.state.nextSmileAtMs = scheduleNextSmile(args.nowMs, args.activePresenceState);
      smilePhase = "idle";
      smileProgress = 0;
      smileStrength = 0;
    }
  }

  const blinkCheekReduction = args.eyeState.blinkStartedAtMs != null ? 0.7 : 1;
  const smileAdditiveTargets = {
    [SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.smileLeft]:
      args.state.smileLeftTarget * smileStrength,
    [SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.smileRight]:
      args.state.smileRightTarget * smileStrength,
    [SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.cheekLeft]:
      args.state.cheekLeftTarget * smileStrength * blinkCheekReduction,
    [SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap.cheekRight]:
      args.state.cheekRightTarget * smileStrength * blinkCheekReduction,
  };

  args.state.smileAdditiveTargets = smileAdditiveTargets;

  writeSaraV3SmileDiagnostics({
    nextSmileAtMs: args.state.nextSmileAtMs,
    smileActive: args.state.smileStartedAtMs != null,
    smilePhase,
    smileProgress,
    smileAdditiveTargets,
    blockedByBlink: args.state.blockedByBlink,
    lastCollisionAvoidedAtMs: args.state.lastCollisionAvoidedAtMs,
  });
}
