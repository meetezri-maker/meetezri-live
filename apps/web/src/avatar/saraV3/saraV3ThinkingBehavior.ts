import { SARA_V3_AVATAR_DEFINITION } from "./saraV3Config";
import { SARA_V3_THINKING_BEHAVIOR_CONFIG } from "./saraV3BehaviorConfig";
import { writeSaraV3ThinkingBehaviorDiagnostics } from "./saraV3Diagnostics";
import type {
  SaraV3GazeIntent,
  SaraV3RuntimeMode,
  SaraV3ThinkingBehaviorState,
  SaraV3ThinkingEventPhase,
  SaraV3ThinkingEventType,
} from "./saraV3Types";

/**
 * C6 — SaraV3 thinking personality behavior layer.
 *
 * A coordinator, not a morph writer. While C1 state is `thinking` it produces
 * two additive contributions that flow through the C2 layer stack:
 *
 *   - a stable concentration BASELINE → C2 `stateExpression` (via the runtime's
 *     `stateExpressionTargets` override), replacing the static
 *     `expressionConfig.thinking` base while C6 is enabled.
 *   - rare MICRO-EVENTS → C2 `scheduledMicro`: a brow shift (with a touch of
 *     cheek emphasis) or a lip-press beat, on a randomized fade-in/hold/fade-out.
 *
 * Emotional read is "processing", not "upset":
 *   - smile is near zero and there is NEVER a smile event;
 *   - mouthFrown / sad appear only at trace baseline levels and never pulse;
 *   - the load-bearing cues are brow engagement and lip compression.
 *
 * Because C6 owns `scheduledMicro` while active, the smile runtime's generic
 * thinking smile events (which still get scheduled) are simply not routed — so
 * no positive smile can appear in thinking, without touching the smile runtime.
 *
 * Gaze: thinking should briefly disengage, but C6 deliberately writes NO gaze
 * morph — that would create a second gaze writer alongside the eye runtime. It
 * publishes a declarative `gazeIntent` for the future C8 gaze controller instead.
 * Head tilt/nod is deferred to C9.
 *
 * All tuning lives in `thinkingBehaviorConfig`. Those values are TEMP
 * current-asset compensation (the current GLB deforms weakly) and must be
 * re-tuned lower once the updated GLB arrives.
 */

// The thinking tuning is intentionally high to compensate for the current GLB's
// weak morph deformation on a client demo. Re-tune against the new asset.
const TEMP_ASSET_COMPENSATION = true;

const map = SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap;

const INACTIVE_GAZE_INTENT: SaraV3GazeIntent = {
  active: false,
  direction: "none",
  strength: 0,
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(progress: number) {
  const x = clamp01(progress);
  return x * x * (3 - 2 * x);
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

// Each micro-event samples its own peak in [70%, 100%] of the configured value,
// so repeated events never land on the exact same strength. Sampled once at
// event start and held for the whole envelope — never re-rolled per frame.
const MAGNITUDE_JITTER_FLOOR = 0.7;

function sampleMagnitude(peak: number) {
  return randomBetween(peak * MAGNITUDE_JITTER_FLOOR, peak);
}

function nextEventDelayMs() {
  const ev = SARA_V3_AVATAR_DEFINITION.saraV3.thinkingBehaviorConfig.microEvent;
  return randomBetween(ev.minIntervalMs, ev.maxIntervalMs);
}

export function createSaraV3ThinkingBehaviorState(): SaraV3ThinkingBehaviorState {
  return {
    wasThinking: false,
    enteredAtMs: null,
    timeInThinkingMs: 0,
    nextEventAtMs: 0,
    eventStartedAtMs: null,
    eventType: "none",
    eventFadeInMs: 0,
    eventHoldMs: 0,
    eventFadeOutMs: 0,
    eventEyebrowPeak: 0,
    eventCheekPeak: 0,
    eventLipPressPeak: 0,
    stateExpressionTargets: {},
    scheduledMicroTargets: {},
  };
}

function resolveEventPhase(
  state: SaraV3ThinkingBehaviorState,
  nowMs: number
): { phase: SaraV3ThinkingEventPhase; strength: number; done: boolean } {
  if (state.eventStartedAtMs == null) return { phase: "inactive", strength: 0, done: false };
  const elapsed = nowMs - state.eventStartedAtMs;
  if (elapsed <= state.eventFadeInMs) {
    return {
      phase: "fadeIn",
      strength: smoothstep(elapsed / Math.max(1, state.eventFadeInMs)),
      done: false,
    };
  }
  if (elapsed <= state.eventFadeInMs + state.eventHoldMs) {
    return { phase: "hold", strength: 1, done: false };
  }
  if (elapsed <= state.eventFadeInMs + state.eventHoldMs + state.eventFadeOutMs) {
    const t =
      (elapsed - state.eventFadeInMs - state.eventHoldMs) / Math.max(1, state.eventFadeOutMs);
    return { phase: "fadeOut", strength: 1 - smoothstep(t), done: false };
  }
  return { phase: "inactive", strength: 0, done: true };
}

/**
 * Runs once per frame, before the expression runtime. `activeMode` is the
 * authoritative C1 effective mode (equivalently `presence.currentMode`).
 *
 * Returns `active` (C6 enabled AND currently thinking) plus the two routed layer
 * inputs and the declarative gaze intent. When `active` is false the maps are
 * empty and the caller falls back to the pre-C6 sources.
 */
export function updateSaraV3ThinkingBehavior(args: {
  state: SaraV3ThinkingBehaviorState;
  activeMode: SaraV3RuntimeMode;
  nowMs: number;
}): {
  active: boolean;
  stateExpressionTargets: Record<string, number>;
  scheduledMicroTargets: Record<string, number>;
  gazeIntent: SaraV3GazeIntent;
} {
  const { state, nowMs } = args;
  const enabled = SARA_V3_THINKING_BEHAVIOR_CONFIG.enabled;
  const cfg = SARA_V3_AVATAR_DEFINITION.saraV3.thinkingBehaviorConfig;
  const isThinking = enabled && args.activeMode === "thinking";

  // ── Not thinking (or disabled): release and reset for a fresh next entry ────
  if (!isThinking) {
    if (state.wasThinking) {
      // Leaving thinking: stop scheduling and clear timers. In-flight targets are
      // NOT snapped — the expression runtime damps them out smoothly, so nothing
      // carries into speaking/listening/idle.
      state.eventStartedAtMs = null;
      state.eventType = "none";
      state.nextEventAtMs = 0;
      state.enteredAtMs = null;
      state.timeInThinkingMs = 0;
      // Clear the sampled peaks so a stale magnitude can never leak into the
      // next entry — the next micro-event resamples them from scratch.
      state.eventEyebrowPeak = 0;
      state.eventCheekPeak = 0;
      state.eventLipPressPeak = 0;
      state.stateExpressionTargets = {};
      state.scheduledMicroTargets = {};
    }
    state.wasThinking = false;
    writeSaraV3ThinkingBehaviorDiagnostics({
      enabled,
      thinkingActive: false,
      timeInThinkingMs: 0,
      baselineTargets: {},
      currentEventType: "none",
      eventPhase: "inactive",
      eventMagnitude: 0,
      nextEventAtMs: 0,
      stateExpressionTargets: {},
      scheduledMicroTargets: {},
      gazeIntent: INACTIVE_GAZE_INTENT,
      tempAssetCompensation: TEMP_ASSET_COMPENSATION,
    });
    return {
      active: false,
      stateExpressionTargets: {},
      scheduledMicroTargets: {},
      gazeIntent: INACTIVE_GAZE_INTENT,
    };
  }

  // ── Entering thinking: schedule the first event into the future ─────────────
  if (!state.wasThinking) {
    state.enteredAtMs = nowMs;
    state.eventStartedAtMs = null;
    state.eventType = "none";
    // Nothing fires on entry — the baseline alone carries the first moment.
    state.nextEventAtMs = nowMs + nextEventDelayMs();
  }
  state.wasThinking = true;
  state.timeInThinkingMs = state.enteredAtMs != null ? nowMs - state.enteredAtMs : 0;

  // ── Micro-event scheduler (never a smile, never a concern pulse) ────────────
  const ev = cfg.microEvent;
  if (state.eventStartedAtMs == null && nowMs >= state.nextEventAtMs) {
    const isBrow = Math.random() < ev.browShiftChance;
    state.eventStartedAtMs = nowMs;
    state.eventType = isBrow ? "browShift" : "lipPress";
    state.eventFadeInMs = randomBetween(ev.fadeInMs[0], ev.fadeInMs[1]);
    state.eventHoldMs = randomBetween(ev.holdMs[0], ev.holdMs[1]);
    state.eventFadeOutMs = randomBetween(ev.fadeOutMs[0], ev.fadeOutMs[1]);
    state.eventEyebrowPeak = isBrow ? sampleMagnitude(ev.eyebrowPeak) : 0;
    state.eventCheekPeak = isBrow ? sampleMagnitude(ev.cheekPeak) : 0;
    state.eventLipPressPeak = isBrow ? 0 : sampleMagnitude(ev.lipPressPeak);
  }

  const { phase, strength, done } = resolveEventPhase(state, nowMs);
  if (done) {
    state.eventStartedAtMs = null;
    state.eventType = "none";
    state.nextEventAtMs = nowMs + nextEventDelayMs();
  }

  // ── Route outputs into the C2 slots ────────────────────────────────────────
  const stateExpressionTargets: Record<string, number> = { ...cfg.base };

  const scheduledMicroTargets: Record<string, number> = {};
  if (state.eventStartedAtMs != null && strength > 0) {
    if (state.eventType === "browShift") {
      scheduledMicroTargets[map.eyebrows] = state.eventEyebrowPeak * strength;
      scheduledMicroTargets[map.cheekLeft] = state.eventCheekPeak * strength;
      scheduledMicroTargets[map.cheekRight] = state.eventCheekPeak * strength;
    } else if (state.eventType === "lipPress") {
      scheduledMicroTargets[map.mouthPressLeft] = state.eventLipPressPeak * strength;
      scheduledMicroTargets[map.mouthPressRight] = state.eventLipPressPeak * strength;
    }
  }

  state.stateExpressionTargets = stateExpressionTargets;
  state.scheduledMicroTargets = scheduledMicroTargets;

  let eventMagnitude = 0;
  for (const v of Object.values(scheduledMicroTargets)) {
    eventMagnitude = Math.max(eventMagnitude, Math.abs(v));
  }
  const currentEventType: SaraV3ThinkingEventType =
    state.eventStartedAtMs != null ? state.eventType : "none";

  const gazeIntent: SaraV3GazeIntent = cfg.gazeIntent.emitIntent
    ? { active: true, direction: cfg.gazeIntent.direction, strength: cfg.gazeIntent.strength }
    : INACTIVE_GAZE_INTENT;

  writeSaraV3ThinkingBehaviorDiagnostics({
    enabled,
    thinkingActive: true,
    timeInThinkingMs: state.timeInThinkingMs,
    baselineTargets: stateExpressionTargets,
    currentEventType,
    eventPhase: state.eventStartedAtMs != null ? phase : "inactive",
    eventMagnitude,
    nextEventAtMs: state.nextEventAtMs,
    stateExpressionTargets,
    scheduledMicroTargets,
    gazeIntent,
    tempAssetCompensation: TEMP_ASSET_COMPENSATION,
  });

  return { active: true, stateExpressionTargets, scheduledMicroTargets, gazeIntent };
}
