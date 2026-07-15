import { SARA_V3_AVATAR_DEFINITION } from "./saraV3Config";
import { SARA_V3_ATTENTION_REFRESH_CONFIG } from "./saraV3BehaviorConfig";
import { applySaraV3MorphValues } from "./saraV3MorphBinding";
import { writeSaraV3AttentionRefreshDiagnostics } from "./saraV3Diagnostics";
import type {
  SaraV3AttentionRefreshCombination,
  SaraV3AttentionRefreshState,
  SaraV3BindingSet,
  SaraV3EyeRuntimeState,
  SaraV3GazeControllerState,
  SaraV3RuntimeMode,
} from "./saraV3Types";

/**
 * EXPERIMENT — SaraV3 idle "Attention Refresh".
 *
 * A coordinated idle micro-event that runs on its OWN 5–10s schedule, entirely
 * separate from the existing micro-smile / brow events (which are untouched) and
 * from the blink cadence. It exists to test whether small, *coordinated* idle
 * facial motion reads as more alive than the current frozen resting face — the
 * smile amplitude is deliberately left exactly as it is for this experiment.
 *
 * When it fires it randomly picks one of four natural combinations, so it never
 * runs the same sequence twice:
 *
 *   A ~40%  blink only
 *   B ~30%  blink + tiny brow + tiny cheek
 *   C ~20%  blink + tiny brow + tiny cheek + tiny eyeball refocus
 *   D ~10%  tiny eyeball refocus only
 *
 * Onsets are staged (config): blink at 0 ms, brows at ~40 ms, cheeks at ~80 ms,
 * eyeball refocus at ~120 ms. Brows peak before cheeks; the eyeball returns to
 * center before the face fully relaxes; the whole event lasts ~600–700 ms.
 *
 * Ownership (kept isolated — this module is not a general morph writer):
 *   - Blink: DELEGATED to the eye runtime. This module only re-arms the next
 *     blink (`eyeState.nextBlinkAtMs = now`) so the blink keeps its own natural
 *     per-blink asymmetry/target variety and its normal cadence otherwise. It
 *     never writes eyeBlink morphs and never changes blink timing logic.
 *   - Brow + cheek: returned as additive targets routed into C2's `scheduledMicro`
 *     slot (summed with the existing idle events, damped by the expression
 *     runtime). This module does not write them directly.
 *   - Eyeball refocus: the ONLY morph this module writes directly. It layers a
 *     tiny signed offset on top of the C8 gaze value (read from the gaze state)
 *     and clamps the sum to the shared gaze safety bound. It only writes while a
 *     refocus is in flight, so the C8 gaze controller stays the sole eyeball
 *     writer at every other moment — the controller file itself is never modified.
 *
 * Idle-only: nothing fires, is scheduled, or is written outside `idle`. Gated by
 * `SARA_V3_ATTENTION_REFRESH_CONFIG.enabled`; when disabled it no-ops and idle is
 * byte-identical to pre-experiment. Never touches smile amplitude, breathing,
 * listening/thinking/speaking, viseme/jaw/lip-sync, the emotion coordinator, or
 * the transition engine.
 */

// Peaks/influence run intentionally visible on the weak-deforming current GLB.
const TEMP_ASSET_COMPENSATION = true;

const map = SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function clampSigned(value: number, max: number) {
  return Math.min(max, Math.max(-max, value));
}

function smoothstep(progress: number) {
  const x = clamp01(progress);
  return x * x * (3 - 2 * x);
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randomSign() {
  return Math.random() < 0.5 ? -1 : 1;
}

export function createSaraV3AttentionRefreshState(): SaraV3AttentionRefreshState {
  return {
    wasIdle: false,
    nextEventAtMs: 0,
    eventStartedAtMs: null,
    eventDurationMs: 0,
    combination: "none",
    hasBlink: false,
    hasBrowCheek: false,
    hasEyeRefocus: false,
    blinkTriggered: false,
    eyeRefocusSign: 1,
    scheduledMicroTargets: {},
    eyeRefocusOffset: 0,
  };
}

/** Weighted pick of the combination for one fire (see the table above). */
function rollCombination(): SaraV3AttentionRefreshCombination {
  const w = SARA_V3_AVATAR_DEFINITION.saraV3.attentionRefreshConfig.combinationWeights;
  const total = w.a + w.b + w.c + w.d;
  const r = Math.random() * total;
  if (r < w.a) return "A";
  if (r < w.a + w.b) return "B";
  if (r < w.a + w.b + w.c) return "C";
  return "D";
}

/** Shared brow/cheek envelope strength (0..1): fade-in → hold → fade-out. */
function channelEnvelope(elapsedSinceOnset: number): number {
  const cfg = SARA_V3_AVATAR_DEFINITION.saraV3.attentionRefreshConfig;
  const t = elapsedSinceOnset;
  if (t <= 0) return 0;
  if (t <= cfg.fadeInMs) return smoothstep(t / Math.max(1, cfg.fadeInMs));
  if (t <= cfg.fadeInMs + cfg.holdMs) return 1;
  if (t <= cfg.fadeInMs + cfg.holdMs + cfg.fadeOutMs) {
    return 1 - smoothstep((t - cfg.fadeInMs - cfg.holdMs) / Math.max(1, cfg.fadeOutMs));
  }
  return 0;
}

/** Total lifetime (ms) of an event, derived from its selected combination. */
function computeEventDurationMs(hasBrowCheek: boolean, hasEyeRefocus: boolean): number {
  const cfg = SARA_V3_AVATAR_DEFINITION.saraV3.attentionRefreshConfig;
  const browCheekEnd = hasBrowCheek
    ? cfg.cheekDelayMs + cfg.fadeInMs + cfg.holdMs + cfg.fadeOutMs
    : 0;
  const eyeEnd = hasEyeRefocus ? cfg.eyeDelayMs + cfg.eyeRefocusDurationMs : 0;
  // Floor so a blink-only (A) event still occupies a small, self-contained window.
  return Math.max(browCheekEnd, eyeEnd, 300);
}

/**
 * Runs once per frame, AFTER the C8 gaze controller (so it can read this frame's
 * applied eyeball value and layer its refocus on top) and BEFORE the expression
 * runtime (so its brow/cheek targets can be merged into the scheduledMicro slot).
 * `activeMode` is the authoritative C1 effective mode.
 *
 * Returns the additive brow/cheek targets for the scheduledMicro slot. The blink
 * re-arm and eyeball refocus are applied here as side effects (on `eyeState` and
 * the bindings, respectively).
 */
export function updateSaraV3AttentionRefresh(args: {
  state: SaraV3AttentionRefreshState;
  bindings: SaraV3BindingSet;
  activeMode: SaraV3RuntimeMode;
  eyeState: SaraV3EyeRuntimeState;
  gazeState: SaraV3GazeControllerState;
  nowMs: number;
}): { scheduledMicroTargets: Record<string, number>; active: boolean } {
  const { state, eyeState, gazeState, nowMs } = args;
  const enabled = SARA_V3_ATTENTION_REFRESH_CONFIG.enabled;
  const cfg = SARA_V3_AVATAR_DEFINITION.saraV3.attentionRefreshConfig;
  const isIdle = args.activeMode === "idle";

  // ── Idle lifecycle (entry / exit edges) ───────────────────────────────────
  if (enabled && isIdle && !state.wasIdle) {
    // Entering idle: arm the first event into the future so nothing fires on the
    // entry frame, and drop any stale in-flight event from a previous idle stretch.
    state.nextEventAtMs = nowMs + randomBetween(cfg.intervalMinMs, cfg.intervalMaxMs);
    state.eventStartedAtMs = null;
    state.combination = "none";
  } else if (!isIdle && state.wasIdle) {
    // Leaving idle: stop scheduling and drop any in-flight event. The eyeball
    // refocus simply stops being written, so C8 resumes sole ownership; brow/cheek
    // additive targets go empty and the expression runtime damps them out.
    state.nextEventAtMs = 0;
    state.eventStartedAtMs = null;
    state.combination = "none";
    state.eyeRefocusOffset = 0;
    state.scheduledMicroTargets = {};
  }
  state.wasIdle = isIdle;

  // Disabled or not idle: contribute nothing and write nothing (C8 keeps the
  // eyeball; blink cadence is the eye runtime's own). Byte-identical to pre-exp.
  if (!enabled || !isIdle) {
    state.scheduledMicroTargets = {};
    state.eyeRefocusOffset = 0;
    writeSaraV3AttentionRefreshDiagnostics({
      enabled,
      idleActive: isIdle,
      eventActive: false,
      combination: "none",
      elapsedMs: 0,
      eventDurationMs: 0,
      nextEventAtMs: state.nextEventAtMs,
      blinkTriggered: false,
      browValue: 0,
      cheekValue: 0,
      eyeRefocusOffset: 0,
      scheduledMicroTargets: {},
      tempAssetCompensation: TEMP_ASSET_COMPENSATION,
    });
    return { scheduledMicroTargets: {}, active: false };
  }

  // Initialize scheduling on the very first idle frame (no immediate event).
  if (state.nextEventAtMs === 0) {
    state.nextEventAtMs = nowMs + randomBetween(cfg.intervalMinMs, cfg.intervalMaxMs);
  }

  // ── Event scheduler ────────────────────────────────────────────────────────
  if (state.eventStartedAtMs == null && nowMs >= state.nextEventAtMs) {
    const combination = rollCombination();
    const hasBlink = combination === "A" || combination === "B" || combination === "C";
    const hasBrowCheek = combination === "B" || combination === "C";
    const hasEyeRefocus = combination === "C" || combination === "D";
    state.eventStartedAtMs = nowMs;
    state.combination = combination;
    state.hasBlink = hasBlink;
    state.hasBrowCheek = hasBrowCheek;
    state.hasEyeRefocus = hasEyeRefocus;
    state.blinkTriggered = false;
    state.eyeRefocusSign = randomSign();
    state.eventDurationMs = computeEventDurationMs(hasBrowCheek, hasEyeRefocus);
  }

  let browValue = 0;
  let cheekValue = 0;
  let eyeRefocusOffset = 0;
  const scheduledMicroTargets: Record<string, number> = {};

  if (state.eventStartedAtMs != null) {
    const elapsed = nowMs - state.eventStartedAtMs;

    // Blink: re-arm the eye runtime's next blink at event start (t≈0), unless a
    // blink is already in flight. Delegated so the blink keeps its natural variety.
    if (
      state.hasBlink &&
      !state.blinkTriggered &&
      elapsed >= 0 &&
      eyeState.blinkStartedAtMs == null
    ) {
      eyeState.nextBlinkAtMs = nowMs;
      state.blinkTriggered = true;
    } else if (state.hasBlink && !state.blinkTriggered && eyeState.blinkStartedAtMs != null) {
      // A blink is already happening — treat the combination's blink as satisfied.
      state.blinkTriggered = true;
    }

    // Brow + cheek: staged additive envelopes (brows lead the cheeks).
    if (state.hasBrowCheek) {
      browValue = cfg.eyebrowPeak * channelEnvelope(elapsed - cfg.browDelayMs);
      cheekValue = cfg.cheekPeak * channelEnvelope(elapsed - cfg.cheekDelayMs);
      if (browValue > 0) scheduledMicroTargets[map.eyebrows] = browValue;
      if (cheekValue > 0) {
        scheduledMicroTargets[map.cheekLeft] = cheekValue;
        scheduledMicroTargets[map.cheekRight] = cheekValue;
      }
    }

    // Eyeball refocus: tiny out-and-back (sin), never held, returns to center.
    if (state.hasEyeRefocus) {
      const p = clamp01((elapsed - cfg.eyeDelayMs) / Math.max(1, cfg.eyeRefocusDurationMs));
      // sin(π·p) is 0→1→0 across the window, so the eye eases out and back.
      const shape = elapsed >= cfg.eyeDelayMs && p < 1 ? Math.sin(Math.PI * p) : 0;
      eyeRefocusOffset = state.eyeRefocusSign * cfg.eyeRefocusStrength * shape;
    }

    // End of event → reschedule the next one on the own 5–10s window.
    if (elapsed >= state.eventDurationMs) {
      state.eventStartedAtMs = null;
      state.combination = "none";
      state.hasBlink = false;
      state.hasBrowCheek = false;
      state.hasEyeRefocus = false;
      state.nextEventAtMs = nowMs + randomBetween(cfg.intervalMinMs, cfg.intervalMaxMs);
    }
  }

  // ── Apply the eyeball refocus on top of the C8 gaze value ──────────────────
  // Only write while a refocus is actually in flight; otherwise leave the C8
  // controller's write untouched (it stays the sole eyeball owner). The sum is
  // clamped to the shared gaze safety bound so the eyes never over-rotate.
  if (eyeRefocusOffset !== 0) {
    const safety = SARA_V3_AVATAR_DEFINITION.saraV3.gazeConfig.safety;
    const base = gazeState.eyeballTargets[map.leftEyeball] ?? 0;
    const combined = clampSigned(base + eyeRefocusOffset, safety.maxEyeballInfluence);
    applySaraV3MorphValues(args.bindings, {
      [map.leftEyeball]: combined,
      [map.rightEyeball]: combined,
    });
  }

  state.scheduledMicroTargets = scheduledMicroTargets;
  state.eyeRefocusOffset = eyeRefocusOffset;

  const active = state.eventStartedAtMs != null;
  writeSaraV3AttentionRefreshDiagnostics({
    enabled: true,
    idleActive: true,
    eventActive: active,
    combination: state.combination,
    elapsedMs: active && state.eventStartedAtMs != null ? nowMs - state.eventStartedAtMs : 0,
    eventDurationMs: state.eventDurationMs,
    nextEventAtMs: state.nextEventAtMs,
    blinkTriggered: state.blinkTriggered,
    browValue,
    cheekValue,
    eyeRefocusOffset,
    scheduledMicroTargets,
    tempAssetCompensation: TEMP_ASSET_COMPENSATION,
  });

  return { scheduledMicroTargets, active };
}
