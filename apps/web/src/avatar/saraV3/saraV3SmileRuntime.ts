import { SARA_V3_AVATAR_DEFINITION } from "./saraV3Config";
import { SARA_V3_IDLE_BEHAVIOR_CONFIG } from "./saraV3BehaviorConfig";
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
      return {
        minIntervalMs:
          SARA_V3_AVATAR_DEFINITION.saraV3.idleMicroMovementConfig.smileEvent.minIntervalMs,
        maxIntervalMs:
          SARA_V3_AVATAR_DEFINITION.saraV3.idleMicroMovementConfig.smileEvent.maxIntervalMs,
      };
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

  if (activePresenceState === "idle") {
    // Idle gets a slightly more noticeable — but still gentle and asymmetric —
    // micro-smile so the resting face reads as alive rather than frozen.
    const smileEvent = SARA_V3_AVATAR_DEFINITION.saraV3.idleMicroMovementConfig.smileEvent;
    return {
      smileFadeInMs: randomBetween(450, 700),
      smileHoldMs: randomBetween(500, 1200),
      smileFadeOutMs: randomBetween(700, 1200),
      smileLeftTarget: randomBetween(smileEvent.smileLeftMax * 0.6, smileEvent.smileLeftMax),
      smileRightTarget: randomBetween(smileEvent.smileRightMax * 0.6, smileEvent.smileRightMax),
      cheekLeftTarget: randomBetween(smileEvent.cheekMax * 0.5, smileEvent.cheekMax),
      cheekRightTarget: randomBetween(smileEvent.cheekMax * 0.5, smileEvent.cheekMax),
    };
  }

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

function nextBrowDelayMs(browConfig: { minIntervalMs: number; maxIntervalMs: number }) {
  return (
    browConfig.minIntervalMs +
    Math.random() * (browConfig.maxIntervalMs - browConfig.minIntervalMs)
  );
}

function createBrowEventTargets(browConfig: {
  fadeInMs: readonly [number, number];
  holdMs: readonly [number, number];
  fadeOutMs: readonly [number, number];
  eyebrowMax: number;
}) {
  return {
    browFadeInMs: randomBetween(browConfig.fadeInMs[0], browConfig.fadeInMs[1]),
    browHoldMs: randomBetween(browConfig.holdMs[0], browConfig.holdMs[1]),
    browFadeOutMs: randomBetween(browConfig.fadeOutMs[0], browConfig.fadeOutMs[1]),
    browTarget: randomBetween(browConfig.eyebrowMax * 0.6, browConfig.eyebrowMax),
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
    nextBrowAtMs: 0,
    browStartedAtMs: null,
    browFadeInMs: 0,
    browHoldMs: 0,
    browFadeOutMs: 0,
    browTarget: 0,
    // C4
    lastActivePresenceState: null,
    smilePhase: "idle",
    smileStrength: 0,
    browEventStrength: 0,
    breathingTargets: {},
    eventTargets: {},
  };
}

/**
 * C4: fresh idle micro-smile delay used on idle (re)entry, drawn from the
 * SaraV3-owned `idleBehaviorConfig.reentrySmileDelayMs` window.
 */
function nextIdleReentrySmileDelayMs() {
  const [min, max] = SARA_V3_AVATAR_DEFINITION.saraV3.idleBehaviorConfig.reentrySmileDelayMs;
  return randomBetween(min, max);
}

export function updateSaraV3SmileRuntime(args: {
  state: SaraV3SmileRuntimeState;
  activePresenceState: SaraV3RuntimeMode;
  eyeState: SaraV3EyeRuntimeState;
  nowMs: number;
}) {
  // C4: on entering idle from another mode, restart the micro-smile timer with
  // fresh randomized timing so a smile never fires the instant idle resumes and
  // the cadence never lines up run-to-run. Gated by the C4 flag; when disabled
  // the timer spans modes exactly as it did pre-C4. Idle-only — non-idle smile
  // scheduling is untouched. (Brow + eyeball glances already self-reset on exit.)
  const enteringIdle =
    SARA_V3_IDLE_BEHAVIOR_CONFIG.enabled &&
    args.activePresenceState === "idle" &&
    args.state.lastActivePresenceState !== "idle" &&
    args.state.lastActivePresenceState !== null;
  if (enteringIdle) {
    args.state.nextSmileAtMs = args.nowMs + nextIdleReentrySmileDelayMs();
  }

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

  const idle = args.activePresenceState === "idle";
  const micro = SARA_V3_AVATAR_DEFINITION.saraV3.idleMicroMovementConfig;

  // Idle-only brow relaxation/lift events — subtle, scheduled, never surprised.
  let browEventStrength = 0;
  if (idle) {
    if (args.state.nextBrowAtMs === 0) {
      args.state.nextBrowAtMs = args.nowMs + nextBrowDelayMs(micro.browEvent);
    }
    if (args.state.browStartedAtMs == null && args.nowMs >= args.state.nextBrowAtMs) {
      const browEvent = createBrowEventTargets(micro.browEvent);
      args.state.browStartedAtMs = args.nowMs;
      args.state.browFadeInMs = browEvent.browFadeInMs;
      args.state.browHoldMs = browEvent.browHoldMs;
      args.state.browFadeOutMs = browEvent.browFadeOutMs;
      args.state.browTarget = browEvent.browTarget;
    }
    if (args.state.browStartedAtMs != null) {
      const elapsed = args.nowMs - args.state.browStartedAtMs;
      if (elapsed <= args.state.browFadeInMs) {
        browEventStrength = smoothstep(elapsed / Math.max(1, args.state.browFadeInMs));
      } else if (elapsed <= args.state.browFadeInMs + args.state.browHoldMs) {
        browEventStrength = 1;
      } else if (
        elapsed <=
        args.state.browFadeInMs + args.state.browHoldMs + args.state.browFadeOutMs
      ) {
        browEventStrength =
          1 -
          smoothstep(
            (elapsed - args.state.browFadeInMs - args.state.browHoldMs) /
              Math.max(1, args.state.browFadeOutMs)
          );
      } else {
        args.state.browStartedAtMs = null;
        args.state.browTarget = 0;
        args.state.nextBrowAtMs = args.nowMs + nextBrowDelayMs(micro.browEvent);
        browEventStrength = 0;
      }
    }
  } else {
    // Leaving idle: stop scheduling. Any in-flight additive smoothly damps to
    // zero in the expression runtime; reschedule fresh next time idle resumes.
    args.state.browStartedAtMs = null;
    args.state.nextBrowAtMs = 0;
  }
  const browEventValue = args.state.browTarget * browEventStrength;

  // Idle-only breathing rhythm: very slow, very small swell across the face.
  // Phase-offset per morph so it never reads as a single synchronized pulse.
  let breathSmileLeft = 0;
  let breathSmileRight = 0;
  let breathCheek = 0;
  let breathEyeSquint = 0;
  let breathBrow = 0;
  if (idle) {
    const breathT = args.nowMs / 1000;
    const breathing = micro.breathing;
    const swell = (Math.sin(breathT * breathing.speed) + 1) / 2;
    const swellOffset = (Math.sin(breathT * breathing.speed * 0.53 + 0.8) + 1) / 2;
    breathSmileLeft = breathing.smileAmplitude * swell;
    breathSmileRight = breathing.smileAmplitude * swellOffset;
    breathCheek = breathing.cheekAmplitude * swell;
    breathEyeSquint = breathing.eyeSquintAmplitude * swellOffset;
    breathBrow = breathing.eyebrowAmplitude * Math.sin(breathT * breathing.speed * 0.5 + 1.7);
  }

  const blinkCheekReduction = args.eyeState.blinkStartedAtMs != null ? 0.7 : 1;
  const map = SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap;

  // C4: split the additive output into its continuous "breathing" baseline and
  // its discrete smile/brow event portion. The two maps always sum to the exact
  // same `smileAdditiveTargets` produced pre-C4 — the idle coordinator routes
  // breathing → C2 idleBaseline and events → C2 scheduledMicro without changing
  // the summed result. Non-idle: breathing terms are all zero.
  const eventTargets: Record<string, number> = {
    [map.smileLeft]: args.state.smileLeftTarget * smileStrength,
    [map.smileRight]: args.state.smileRightTarget * smileStrength,
    [map.cheekLeft]: args.state.cheekLeftTarget * smileStrength * blinkCheekReduction,
    [map.cheekRight]: args.state.cheekRightTarget * smileStrength * blinkCheekReduction,
  };
  const breathingTargets: Record<string, number> = {
    [map.smileLeft]: breathSmileLeft,
    [map.smileRight]: breathSmileRight,
    [map.cheekLeft]: breathCheek,
    [map.cheekRight]: breathCheek,
  };
  if (idle) {
    breathingTargets[map.eyeSquintLeft] = breathEyeSquint;
    breathingTargets[map.eyeSquintRight] = breathEyeSquint;
    breathingTargets[map.eyebrows] = breathBrow;
    eventTargets[map.eyebrows] = browEventValue;
  }

  const smileAdditiveTargets: Record<string, number> = {};
  for (const key of new Set([
    ...Object.keys(breathingTargets),
    ...Object.keys(eventTargets),
  ])) {
    smileAdditiveTargets[key] = (breathingTargets[key] ?? 0) + (eventTargets[key] ?? 0);
  }

  args.state.smileAdditiveTargets = smileAdditiveTargets;
  args.state.breathingTargets = breathingTargets;
  args.state.eventTargets = eventTargets;
  args.state.smilePhase = smilePhase;
  args.state.smileStrength = smileStrength;
  args.state.browEventStrength = browEventStrength;
  args.state.lastActivePresenceState = args.activePresenceState;

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
