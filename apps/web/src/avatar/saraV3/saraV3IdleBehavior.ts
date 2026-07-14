import { SARA_V3_AVATAR_DEFINITION } from "./saraV3Config";
import { SARA_V3_IDLE_BEHAVIOR_CONFIG } from "./saraV3BehaviorConfig";
import { writeSaraV3IdleBehaviorDiagnostics } from "./saraV3Diagnostics";
import type {
  SaraV3EyeRuntimeState,
  SaraV3IdleBehaviorState,
  SaraV3IdleEventPhase,
  SaraV3IdleEventType,
  SaraV3RuntimeMode,
  SaraV3SmileRuntimeState,
} from "./saraV3Types";

/**
 * C4 — SaraV3 idle personality behavior layer.
 *
 * This is a *coordinator*, not a new morph writer. It reuses the idle systems
 * that already exist and are visually validated:
 *
 *   - breathing swell, micro-smile events, brow-lift events → `saraV3SmileRuntime`
 *   - eyeball glances → `saraV3EyeRuntime`
 *
 * All C4 does on top of those is:
 *   1. Formalize idle entry/exit off the authoritative C1 state (the presence
 *      mode, which C1 keeps byte-identical to `behavior.currentState`).
 *   2. Route the smile runtime's already-computed output into the two C2 layer
 *      slots the audit reserved for C4 — continuous breathing → `idleBaseline`,
 *      discrete smile/brow events → `scheduledMicro`. The two always sum to the
 *      pre-C4 combined output, so the final face is numerically unchanged; only
 *      the layer attribution (and the diagnostics that read it) becomes explicit.
 *   3. Emit development-only diagnostics.
 *
 * The one behavioral improvement (fresh micro-smile timing on idle re-entry, no
 * instant smile on entry) lives in `saraV3SmileRuntime` where the timer state
 * is, also gated by `SARA_V3_IDLE_BEHAVIOR_CONFIG.enabled`. Brow and eyeball
 * glance schedules already self-reset on idle exit and re-randomize on entry.
 *
 * C4 never adds targets outside idle, never touches blink/viseme/jaw/lip-sync,
 * and adds no head or gaze controller (deferred to C8/C9).
 */

export function createSaraV3IdleBehaviorState(): SaraV3IdleBehaviorState {
  return {
    wasIdle: false,
    idleEnteredAtMs: null,
    timeInIdleMs: 0,
    idleBaselineTargets: {},
    scheduledMicroTargets: {},
  };
}

function maxAbs(targets: Readonly<Record<string, number>>): number {
  let max = 0;
  for (const value of Object.values(targets)) {
    const abs = Math.abs(value);
    if (abs > max) max = abs;
  }
  return max;
}

/** Derive the current idle brow-event envelope phase from its timers. */
function resolveBrowPhase(
  smileState: SaraV3SmileRuntimeState,
  nowMs: number
): SaraV3IdleEventPhase {
  if (smileState.browStartedAtMs == null) return "inactive";
  const elapsed = nowMs - smileState.browStartedAtMs;
  if (elapsed <= smileState.browFadeInMs) return "fadeIn";
  if (elapsed <= smileState.browFadeInMs + smileState.browHoldMs) return "hold";
  return "fadeOut";
}

/**
 * Runs once per frame, AFTER `updateSaraV3SmileRuntime` (so the smile split is
 * current) and BEFORE `updateSaraV3ExpressionRuntime`. Returns the two routed
 * layer inputs for the expression runtime; it writes no morphs itself.
 *
 * `activeMode` is the authoritative effective mode resolved by the C1 behavior
 * state machine (equivalently `presence.currentMode`). Idle-only: everything
 * this function contributes is empty in listening/thinking/speaking.
 */
export function updateSaraV3IdleBehavior(args: {
  state: SaraV3IdleBehaviorState;
  activeMode: SaraV3RuntimeMode;
  smileState: SaraV3SmileRuntimeState;
  eyeState: SaraV3EyeRuntimeState;
  nowMs: number;
}): {
  idleBaselineTargets: Record<string, number>;
  scheduledMicroTargets: Record<string, number>;
  isIdle: boolean;
} {
  const { state, smileState, eyeState, nowMs } = args;
  const enabled = SARA_V3_IDLE_BEHAVIOR_CONFIG.enabled;
  const idleCfg = SARA_V3_AVATAR_DEFINITION.saraV3.idleBehaviorConfig;
  const breathingCfg = SARA_V3_AVATAR_DEFINITION.saraV3.idleMicroMovementConfig.breathing;
  const isIdle = args.activeMode === "idle";

  // ── Idle lifecycle (entry / exit edges) ───────────────────────────────────
  if (isIdle && !state.wasIdle) {
    // Entering idle: start a fresh idle stretch. The smile timer is restarted
    // inside the smile runtime (it owns the timer); here we just mark entry.
    state.idleEnteredAtMs = nowMs;
  } else if (!isIdle && state.wasIdle) {
    // Leaving idle: stop tracking. In-flight idle targets are NOT snapped to
    // zero — the expression runtime damps them out smoothly, and the smile/eye
    // runtimes clear their idle-only schedules on their own.
    state.idleEnteredAtMs = null;
    state.timeInIdleMs = 0;
  }
  state.wasIdle = isIdle;
  state.timeInIdleMs = isIdle && state.idleEnteredAtMs != null ? nowMs - state.idleEnteredAtMs : 0;

  // ── Route the existing outputs into the two C2 slots ───────────────────────
  let idleBaselineTargets: Record<string, number> = {};
  let scheduledMicroTargets: Record<string, number>;

  if (enabled && idleCfg.routeBreathingToIdleBaseline) {
    // Continuous breathing → idleBaseline (idle only; zero elsewhere), discrete
    // smile/brow events → scheduledMicro. Sum is identical to smileAdditiveTargets.
    idleBaselineTargets = isIdle ? { ...smileState.breathingTargets } : {};
    scheduledMicroTargets = { ...smileState.eventTargets };
  } else {
    // C4 disabled (or routing off): pre-C4 grouping — everything in scheduledMicro,
    // idleBaseline empty. Byte-identical to the behavior before C4.
    scheduledMicroTargets = { ...smileState.smileAdditiveTargets };
  }

  state.idleBaselineTargets = idleBaselineTargets;
  state.scheduledMicroTargets = scheduledMicroTargets;

  // ── Diagnostics (development-only) ─────────────────────────────────────────
  const breathingPhase = (nowMs / 1000) * breathingCfg.speed;
  const breathingValue = (Math.sin(breathingPhase) + 1) / 2;

  const smileActive = isIdle && smileState.smilePhase !== "idle";
  const browActive = isIdle && smileState.browEventStrength > 0;
  let currentEventType: SaraV3IdleEventType = "none";
  let eventPhase: SaraV3IdleEventPhase = "inactive";
  if (smileActive) {
    currentEventType = "smile";
    eventPhase = smileState.smilePhase === "idle" ? "inactive" : smileState.smilePhase;
  } else if (browActive) {
    currentEventType = "brow";
    eventPhase = resolveBrowPhase(smileState, nowMs);
  }

  writeSaraV3IdleBehaviorDiagnostics({
    enabled,
    idleActive: isIdle,
    timeInIdleMs: state.timeInIdleMs,
    breathingPhase: isIdle ? breathingPhase % (Math.PI * 2) : 0,
    breathingValue: isIdle ? breathingValue : 0,
    currentEventType,
    eventPhase,
    eventMagnitude: currentEventType === "none" ? 0 : maxAbs(scheduledMicroTargets),
    nextSmileAtMs: smileState.nextSmileAtMs,
    nextBrowAtMs: smileState.nextBrowAtMs,
    gazeActive: isIdle && eyeState.eyeballStartedAtMs != null,
    gazeValue: eyeState.eyeballValue,
    idleBaselineTargets,
    scheduledMicroTargets,
  });

  return { idleBaselineTargets, scheduledMicroTargets, isIdle };
}
