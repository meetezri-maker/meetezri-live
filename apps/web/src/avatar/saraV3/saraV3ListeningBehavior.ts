import { SARA_V3_AVATAR_DEFINITION } from "./saraV3Config";
import { SARA_V3_LISTENING_BEHAVIOR_CONFIG } from "./saraV3BehaviorConfig";
import { writeSaraV3ListeningBehaviorDiagnostics } from "./saraV3Diagnostics";
import type {
  SaraV3ListeningBehaviorState,
  SaraV3ListeningEventPhase,
  SaraV3ListeningEventType,
  SaraV3RuntimeMode,
} from "./saraV3Types";

/**
 * C5 — SaraV3 listening personality behavior layer.
 *
 * A coordinator, not a morph writer. While C1 state is `listening` it produces
 * two additive contributions that flow through the C2 layer stack:
 *
 *   - a stable attentive BASELINE → C2 `stateExpression` (via the runtime's
 *     `stateExpressionTargets` override), replacing the static
 *     `expressionConfig.listening` base while C5 is enabled.
 *   - rare ACKNOWLEDGEMENT pulses (a soft symmetric smile beat or a brow lift)
 *     → C2 `scheduledMicro`, with a short randomized fade-in / hold / fade-out.
 *
 * Eye attention (comfortable eye contact + tiny refocus) is left to the existing
 * shared eyeLook drift; C5 adds no eye behavior and no head motion (deferred to
 * C8/C9). It never touches blink, viseme/jaw/lip-sync, the sentiment gate, or the
 * idle layer, and contributes nothing outside `listening`.
 *
 * All tuning lives in `listeningBehaviorConfig`. Those values are TEMP
 * current-asset compensation (the current GLB deforms weakly) and must be
 * re-tuned lower once the updated GLB arrives.
 */

// The listening tuning is intentionally high to compensate for the current GLB's
// weak morph deformation on a client demo. Flip to false only as documentation
// once real-strength values are dialed in against the new asset.
const TEMP_ASSET_COMPENSATION = true;

const map = SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap;

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

// Each acknowledgement samples its own peak in [70%, 100%] of the configured
// value, so repeated events never land on the exact same strength. Sampled once
// at event start and held for the whole envelope — never re-rolled per frame.
const MAGNITUDE_JITTER_FLOOR = 0.7;

function sampleMagnitude(peak: number) {
  return randomBetween(peak * MAGNITUDE_JITTER_FLOOR, peak);
}

function nextEventDelayMs() {
  const ack = SARA_V3_AVATAR_DEFINITION.saraV3.listeningBehaviorConfig.acknowledgement;
  return randomBetween(ack.minIntervalMs, ack.maxIntervalMs);
}

export function createSaraV3ListeningBehaviorState(): SaraV3ListeningBehaviorState {
  return {
    wasListening: false,
    enteredAtMs: null,
    timeInListeningMs: 0,
    nextEventAtMs: 0,
    eventStartedAtMs: null,
    eventType: "none",
    eventFadeInMs: 0,
    eventHoldMs: 0,
    eventFadeOutMs: 0,
    eventSmilePeak: 0,
    eventCheekPeak: 0,
    eventEyebrowPeak: 0,
    stateExpressionTargets: {},
    scheduledMicroTargets: {},
  };
}

function resolveEventPhase(
  state: SaraV3ListeningBehaviorState,
  nowMs: number
): { phase: SaraV3ListeningEventPhase; strength: number; done: boolean } {
  if (state.eventStartedAtMs == null) return { phase: "inactive", strength: 0, done: false };
  const elapsed = nowMs - state.eventStartedAtMs;
  if (elapsed <= state.eventFadeInMs) {
    return { phase: "fadeIn", strength: smoothstep(elapsed / Math.max(1, state.eventFadeInMs)), done: false };
  }
  if (elapsed <= state.eventFadeInMs + state.eventHoldMs) {
    return { phase: "hold", strength: 1, done: false };
  }
  if (elapsed <= state.eventFadeInMs + state.eventHoldMs + state.eventFadeOutMs) {
    const t = (elapsed - state.eventFadeInMs - state.eventHoldMs) / Math.max(1, state.eventFadeOutMs);
    return { phase: "fadeOut", strength: 1 - smoothstep(t), done: false };
  }
  return { phase: "inactive", strength: 0, done: true };
}

/**
 * Runs once per frame, before the expression runtime. `activeMode` is the
 * authoritative C1 effective mode (equivalently `presence.currentMode`).
 *
 * Returns `active` (C5 enabled AND currently listening) plus the two routed
 * layer inputs. When `active` is false the maps are empty and the caller should
 * fall back to the pre-C5 sources (static config base + smile-runtime events).
 */
export function updateSaraV3ListeningBehavior(args: {
  state: SaraV3ListeningBehaviorState;
  activeMode: SaraV3RuntimeMode;
  nowMs: number;
}): {
  active: boolean;
  stateExpressionTargets: Record<string, number>;
  scheduledMicroTargets: Record<string, number>;
} {
  const { state, nowMs } = args;
  const enabled = SARA_V3_LISTENING_BEHAVIOR_CONFIG.enabled;
  const cfg = SARA_V3_AVATAR_DEFINITION.saraV3.listeningBehaviorConfig;
  const isListening = enabled && args.activeMode === "listening";

  // ── Not listening (or disabled): release and reset for a fresh next entry ──
  if (!isListening) {
    if (state.wasListening) {
      // Leaving listening: stop scheduling and clear timers. In-flight targets
      // are NOT snapped — the expression runtime damps them out smoothly.
      state.eventStartedAtMs = null;
      state.eventType = "none";
      state.nextEventAtMs = 0;
      state.enteredAtMs = null;
      state.timeInListeningMs = 0;
      // Clear the sampled peaks so a stale magnitude can never leak into the
      // next entry — the next acknowledgement resamples them from scratch.
      state.eventSmilePeak = 0;
      state.eventCheekPeak = 0;
      state.eventEyebrowPeak = 0;
      state.stateExpressionTargets = {};
      state.scheduledMicroTargets = {};
    }
    state.wasListening = false;
    writeSaraV3ListeningBehaviorDiagnostics({
      enabled,
      listeningActive: false,
      timeInListeningMs: 0,
      baselineTargets: {},
      currentEventType: "none",
      eventPhase: "inactive",
      eventMagnitude: 0,
      nextEventAtMs: 0,
      stateExpressionTargets: {},
      scheduledMicroTargets: {},
      tempAssetCompensation: TEMP_ASSET_COMPENSATION,
    });
    return { active: false, stateExpressionTargets: {}, scheduledMicroTargets: {} };
  }

  // ── Entering listening: schedule the first event in the future ─────────────
  if (!state.wasListening) {
    state.enteredAtMs = nowMs;
    state.eventStartedAtMs = null;
    state.eventType = "none";
    // First acknowledgement is deliberately delayed — nothing fires on entry.
    state.nextEventAtMs = nowMs + nextEventDelayMs();
  }
  state.wasListening = true;
  state.timeInListeningMs = state.enteredAtMs != null ? nowMs - state.enteredAtMs : 0;

  // ── Acknowledgement scheduler ──────────────────────────────────────────────
  const ack = cfg.acknowledgement;
  if (state.eventStartedAtMs == null && nowMs >= state.nextEventAtMs) {
    const isSmile = Math.random() < ack.smilePulseChance;
    state.eventStartedAtMs = nowMs;
    state.eventType = isSmile ? "smilePulse" : "browLift";
    state.eventFadeInMs = randomBetween(ack.fadeInMs[0], ack.fadeInMs[1]);
    state.eventHoldMs = randomBetween(ack.holdMs[0], ack.holdMs[1]);
    state.eventFadeOutMs = randomBetween(ack.fadeOutMs[0], ack.fadeOutMs[1]);
    state.eventSmilePeak = isSmile ? sampleMagnitude(ack.smilePeak) : 0;
    state.eventCheekPeak = isSmile ? sampleMagnitude(ack.cheekPeak) : 0;
    state.eventEyebrowPeak = isSmile ? 0 : sampleMagnitude(ack.eyebrowPeak);
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
    if (state.eventType === "smilePulse") {
      scheduledMicroTargets[map.smileLeft] = state.eventSmilePeak * strength;
      scheduledMicroTargets[map.smileRight] = state.eventSmilePeak * strength;
      scheduledMicroTargets[map.cheekLeft] = state.eventCheekPeak * strength;
      scheduledMicroTargets[map.cheekRight] = state.eventCheekPeak * strength;
    } else if (state.eventType === "browLift") {
      scheduledMicroTargets[map.eyebrows] = state.eventEyebrowPeak * strength;
    }
  }

  state.stateExpressionTargets = stateExpressionTargets;
  state.scheduledMicroTargets = scheduledMicroTargets;

  let eventMagnitude = 0;
  for (const v of Object.values(scheduledMicroTargets)) {
    eventMagnitude = Math.max(eventMagnitude, Math.abs(v));
  }
  const currentEventType: SaraV3ListeningEventType =
    state.eventStartedAtMs != null ? state.eventType : "none";

  writeSaraV3ListeningBehaviorDiagnostics({
    enabled,
    listeningActive: true,
    timeInListeningMs: state.timeInListeningMs,
    baselineTargets: stateExpressionTargets,
    currentEventType,
    eventPhase: state.eventStartedAtMs != null ? phase : "inactive",
    eventMagnitude,
    nextEventAtMs: state.nextEventAtMs,
    stateExpressionTargets,
    scheduledMicroTargets,
    tempAssetCompensation: TEMP_ASSET_COMPENSATION,
  });

  return { active: true, stateExpressionTargets, scheduledMicroTargets };
}
