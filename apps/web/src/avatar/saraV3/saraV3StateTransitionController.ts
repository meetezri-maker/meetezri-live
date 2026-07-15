import { SARA_V3_AVATAR_DEFINITION } from "./saraV3Config";
import { SARA_V3_TRANSITION_ENGINE_CONFIG } from "./saraV3BehaviorConfig";
import { writeSaraV3TransitionDiagnostics } from "./saraV3Diagnostics";
import type {
  SaraV3RuntimeMode,
  SaraV3TransitionEasing,
  SaraV3TransitionState,
} from "./saraV3Types";

/**
 * C11 — SaraV3 cross-state transition engine.
 *
 * Makes handoffs between the four behavior states (idle / listening / thinking /
 * speaking) feel intentional. It creates NO new expression and NO new behavior
 * event — it only crossfades the EXISTING state baselines between the outgoing
 * and incoming state over a config-driven, per-edge window, then hands the
 * blended baseline back to the C2 `stateExpression` slot. It OWNS NO MORPHS and
 * never replaces the authoritative C1 current state (that still comes from the
 * presence resolver); it only adds transition metadata around the state change.
 *
 * Deliberately NOT touched by C11 (already handled elsewhere):
 *   - Scheduled micro-events — the per-state modules already cancel the old
 *     scheduler on exit and never fire on entry; the residual value damps out via
 *     the C2 expression damp. C11 must not blend two schedulers, so it leaves
 *     `scheduledMicro` entirely alone.
 *   - Gaze — C8 already cancels prior-state gaze events, keeps the applied value,
 *     damps toward the new target (no snap), and reschedules with an entry delay.
 *     C11 adds no gaze metadata and no second gaze writer.
 *   - Emotion overlay (C3), contradiction suppression (C10), and lip-sync/viseme
 *     timing (Workstream B) — all unchanged.
 *
 * Crossfade: `blended[m] = from[m]·(1 − eased) + to[m]·eased`, where `from` is a
 * snapshot of the outgoing displayed baseline (so rapid re-transitions continue
 * from wherever the face visually is), `to` is the live incoming baseline, and
 * `eased` is the configured curve of clamped progress `(now − startedAt)/dur`.
 *
 * Rollback: when the engine is disabled, or on any frame with no active
 * transition, the controller returns `blendActive: false` and the caller uses
 * its normal (pre-C11) baseline — so those frames are byte-identical to pre-C11.
 */

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(x: number) {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
}

function easeInOutSine(x: number) {
  const t = clamp01(x);
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function applyEasing(progress: number, easing: SaraV3TransitionEasing) {
  return easing === "smoothstep" ? smoothstep(progress) : easeInOutSine(progress);
}

function capitalize(mode: SaraV3RuntimeMode) {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

/** Resolve the config duration for one edge; falls back to `defaultMs`. */
function resolveDurationMs(from: SaraV3RuntimeMode, to: SaraV3RuntimeMode): number {
  const cfg = SARA_V3_AVATAR_DEFINITION.saraV3.transitionConfig;
  const key = `${from}To${capitalize(to)}`;
  const edge = cfg.edges[key];
  return typeof edge === "number" ? edge : cfg.defaultMs;
}

/** Linear crossfade of two baseline maps over the union of their keys. */
function blendBaselines(
  from: Readonly<Record<string, number>>,
  to: Readonly<Record<string, number>>,
  eased: number
): Record<string, number> {
  const out: Record<string, number> = {};
  const keys = new Set<string>([...Object.keys(from), ...Object.keys(to)]);
  for (const k of keys) {
    const a = from[k] ?? 0;
    const b = to[k] ?? 0;
    out[k] = a + (b - a) * eased;
  }
  return out;
}

export function createSaraV3TransitionState(): SaraV3TransitionState {
  return {
    lastMode: null,
    transitionActive: false,
    transitionFrom: null,
    transitionTo: null,
    transitionStartedAtMs: 0,
    transitionDurationMs: 0,
    transitionProgress: 0,
    easedProgress: 0,
    transitionReason: "none",
    replacementCount: 0,
    fromBaseline: {},
    lastDisplayedBaseline: {},
  };
}

/**
 * Runs once per frame, AFTER the per-state behavior modules have produced this
 * frame's baseline and BEFORE the C2 expression runtime.
 *
 * `currentBaseline` is the resolved stateExpression baseline for the CURRENT
 * (incoming) mode — i.e. the active module's base, or the static
 * `expressionConfig[mode]` when no module owns it. The caller passes it already
 * materialized so idle (which normally sends `undefined`) participates too.
 *
 * Returns the crossfaded baseline to use while a transition is active; otherwise
 * `blendActive: false`, and the caller keeps its normal baseline source.
 */
export function updateSaraV3StateTransition(args: {
  state: SaraV3TransitionState;
  enabled: boolean;
  activeMode: SaraV3RuntimeMode;
  currentBaseline: Readonly<Record<string, number>>;
  /** Optional human-readable reason from C1 (`behavior.transitionReason`). */
  transitionReason?: string | null;
  nowMs: number;
}): { blendActive: boolean; blendedBaseline: Record<string, number> | undefined } {
  const { state, activeMode, currentBaseline, nowMs } = args;
  const cfg = SARA_V3_AVATAR_DEFINITION.saraV3.transitionConfig;

  // ── Disabled: no transition metadata affects output (byte-identical rollback).
  if (!args.enabled) {
    // Keep lastMode roughly in sync so re-enabling mid-session doesn't fire a
    // spurious transition on the first frame, but drive nothing.
    state.lastMode = activeMode;
    state.transitionActive = false;
    state.lastDisplayedBaseline = { ...currentBaseline };
    writeDiagnostics(state, false);
    return { blendActive: false, blendedBaseline: undefined };
  }

  // ── Edge detection ─────────────────────────────────────────────────────────
  // First frame: seed lastMode, no transition (nothing to fade from).
  if (state.lastMode === null) {
    state.lastMode = activeMode;
    state.lastDisplayedBaseline = { ...currentBaseline };
  } else if (activeMode !== state.lastMode) {
    const from = state.lastMode;
    // A newer edge while a transition is still in flight = a safe replacement:
    // fade FROM wherever the face currently is (the last displayed baseline), so
    // there is no snap, and count it. Otherwise start fresh from the outgoing
    // displayed baseline (also `lastDisplayedBaseline`, which in steady state is
    // just the previous mode's baseline).
    if (state.transitionActive) state.replacementCount += 1;
    state.transitionActive = true;
    state.transitionFrom = from;
    state.transitionTo = activeMode;
    state.transitionStartedAtMs = nowMs;
    state.transitionDurationMs = resolveDurationMs(from, activeMode);
    state.transitionProgress = 0;
    state.easedProgress = 0;
    state.transitionReason =
      args.transitionReason && args.transitionReason.length > 0
        ? args.transitionReason
        : `${from}->${activeMode}`;
    state.fromBaseline = { ...state.lastDisplayedBaseline };
    state.lastMode = activeMode;
  }

  // ── Progress + crossfade ───────────────────────────────────────────────────
  let blendActive = false;
  let blendedBaseline: Record<string, number> | undefined;

  if (state.transitionActive) {
    const dur = Math.max(1, state.transitionDurationMs);
    const raw = clamp01((nowMs - state.transitionStartedAtMs) / dur);
    // Monotonic by construction (nowMs only increases, denominator fixed).
    state.transitionProgress = raw;
    state.easedProgress = applyEasing(raw, cfg.easing);

    if (raw >= 1) {
      // Complete: hand back the exact incoming baseline and stop.
      state.transitionActive = false;
      state.transitionProgress = 1;
      state.easedProgress = 1;
      blendActive = true;
      blendedBaseline = { ...currentBaseline };
    } else {
      blendActive = true;
      blendedBaseline = blendBaselines(state.fromBaseline, currentBaseline, state.easedProgress);
    }
  }

  // Remember what we actually displayed this frame (for the next edge's "from").
  state.lastDisplayedBaseline = blendActive
    ? { ...(blendedBaseline as Record<string, number>) }
    : { ...currentBaseline };

  writeDiagnostics(state, blendActive);
  return { blendActive, blendedBaseline };
}

function writeDiagnostics(state: SaraV3TransitionState, blendActive: boolean) {
  writeSaraV3TransitionDiagnostics({
    enabled: SARA_V3_TRANSITION_ENGINE_CONFIG.enabled,
    transitionActive: state.transitionActive,
    fromState: state.transitionFrom,
    toState: state.transitionTo,
    startedAtMs: state.transitionStartedAtMs,
    durationMs: state.transitionDurationMs,
    rawProgress: state.transitionProgress,
    easedProgress: state.easedProgress,
    transitionReason: state.transitionReason,
    replacementCount: state.replacementCount,
    baselineCrossfadeActive: blendActive,
    // C11 provides no gaze metadata — C8's own entry/exit handles gaze transitions.
    gazeTransitionMetadataActive: false,
    // No explicit session-layer barge-in signal is wired (see module docs).
    interruptionSource: "unavailable",
  });
}
