import * as THREE from "three";
import { SARA_V3_AVATAR_DEFINITION } from "./saraV3Config";
import { SARA_V3_GAZE_CONTROLLER_CONFIG } from "./saraV3BehaviorConfig";
import { applySaraV3MorphValues } from "./saraV3MorphBinding";
import { writeSaraV3GazeDiagnostics } from "./saraV3Diagnostics";
import type {
  SaraV3BindingSet,
  SaraV3GazeControllerState,
  SaraV3GazeEventPhase,
  SaraV3GazeIntent,
  SaraV3GazeMode,
  SaraV3RuntimeMode,
} from "./saraV3Types";

/**
 * C8 — SaraV3 unified gaze controller.
 *
 * The single authoritative owner of every gaze morph across all four C1 states.
 * Before C8 the gaze was fragmented across two oddly-scoped blocks inside the eye
 * runtime: `idleEyeConfig` (a slow `eyeLookUp/Down` drift that ran only when NOT
 * idle) and `idleEyeballConfig` (scheduled `LeftEyeball`/`RightEyeball` glances
 * that ran only DURING idle). This controller consolidates both into one place
 * with per-state behavior, and consumes the declarative `gazeIntent` metadata
 * that C6 (thinking) and C7 (speaking) publish but that nothing used to read.
 *
 * Ownership contract:
 *   - Owns ONLY gaze targets: `eyeLookUp/Down{Left,Right}` (vertical) and
 *     `LeftEyeball`/`RightEyeball` (horizontal). It never writes visemes, jaw,
 *     blink, expression, smile, or any other morph.
 *   - Blink stays owned by the eye runtime. When this controller is enabled the
 *     eye runtime writes ONLY blink, so gaze has exactly one writer. When
 *     disabled (rollback) this controller does not run and the eye runtime's
 *     legacy gaze blocks drive the morphs exactly as before.
 *
 * Morph-direction assumptions (verified against the current GLB, see config):
 *   - HORIZONTAL: `LeftEyeball`/`RightEyeball` are each a single SIGNED morph on
 *     the separate eye mesh; positive/negative rotates the eyeball to one side.
 *     Both eyes are driven with the IDENTICAL signed scalar, so they can never
 *     diverge or cross. Underlying delta is large (~0.42), so influence is tiny.
 *   - VERTICAL: `eyeLookUp*` and `eyeLookDown*` are NON-NEGATIVE eyelid/socket
 *     morphs. One signed scalar is split: up = max(0, v), down = max(0, -v),
 *     applied identically to left and right (mirrored).
 *
 * Safety: both channels are clamped to configured bounds and damped every frame
 * (frame-rate independent), so gaze is coordinated, never crossed, never
 * over-rotated, never oscillating, and never snapped. On state changes the
 * in-flight event is cancelled and the applied value eases toward the new
 * state's target from its current position (no snap to center).
 *
 * All tuning lives in `gazeConfig`. Influence magnitudes are TEMP current-asset
 * compensation for the weak-deforming current GLB — re-tune after the new GLB.
 */

// Influence magnitudes are intentionally high to compensate for the current
// GLB's weak morph deformation on a client demo. Re-tune against the new asset.
const TEMP_ASSET_COMPENSATION = true;

const map = SARA_V3_AVATAR_DEFINITION.saraV3.morphNameMap;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function clampSigned(value: number, max: number) {
  return Math.min(max, Math.max(-max, value));
}

function easeInOutSine(progress: number) {
  const x = clamp01(progress);
  return -(Math.cos(Math.PI * x) - 1) / 2;
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randomSign() {
  return Math.random() < 0.5 ? -1 : 1;
}

export function createSaraV3GazeControllerState(): SaraV3GazeControllerState {
  return {
    lastMode: null,
    nextEventAtMs: 0,
    eventStartedAtMs: null,
    eventMoveMs: 0,
    eventHoldMs: 0,
    eventReturnMs: 0,
    eventTargetH: 0,
    eventTargetV: 0,
    appliedH: 0,
    appliedV: 0,
    lastNowMs: 0,
    eyeLookTargets: {},
    eyeballTargets: {},
    gazeMode: "idle",
    sourceIntent: "none",
    eventPhase: "inactive",
    clampApplied: false,
  };
}

/** Sampled shape of one gaze event: envelope durations + signed targets. */
type GazeEventSample = {
  moveMs: number;
  holdMs: number;
  returnMs: number;
  targetH: number;
  targetV: number;
  sourceIntent: string;
};

/**
 * Sample the next gaze event for `mode`. Reads config + the live C6/C7 gaze
 * intents. Randomizes direction/magnitude/durations once, at event start. All
 * signed targets are clamped to the shared safety bounds here so nothing
 * downstream can exceed them.
 */
function sampleEvent(args: {
  mode: SaraV3GazeMode;
  thinkingIntent: SaraV3GazeIntent;
  speakingIntent: SaraV3GazeIntent;
}): GazeEventSample {
  const cfg = SARA_V3_AVATAR_DEFINITION.saraV3.gazeConfig;
  const { safety } = cfg;

  switch (args.mode) {
    case "idle": {
      const c = cfg.idle;
      const magnitude = randomBetween(c.minInfluence, c.maxInfluence) * randomSign();
      const vertical =
        Math.random() < c.verticalChance ? c.verticalInfluence * randomSign() : 0;
      return {
        moveMs: randomBetween(c.moveMs[0], c.moveMs[1]),
        holdMs: randomBetween(c.holdMs[0], c.holdMs[1]),
        returnMs: randomBetween(c.returnMs[0], c.returnMs[1]),
        targetH: clampSigned(magnitude, safety.maxEyeballInfluence),
        targetV: clampSigned(vertical, safety.maxVerticalInfluence),
        sourceIntent: "idle-glance",
      };
    }
    case "listening": {
      const c = cfg.listening;
      const isAway = Math.random() < c.gazeAwayChance;
      const horizontal = (isAway ? c.gazeAwayInfluence : c.horizontalInfluence) * randomSign();
      const vertical = c.verticalInfluence * randomSign();
      return {
        moveMs: randomBetween(c.moveMs[0], c.moveMs[1]),
        holdMs: randomBetween(c.holdMs[0], c.holdMs[1]),
        returnMs: randomBetween(c.returnMs[0], c.returnMs[1]),
        targetH: clampSigned(horizontal, safety.maxEyeballInfluence),
        targetV: clampSigned(vertical, safety.maxVerticalInfluence),
        sourceIntent: isAway ? "listening-gaze-away" : "listening-refocus",
      };
    }
    case "thinking": {
      const c = cfg.thinking;
      // Honor C6 gazeIntent ONLY when active and asking to look "away". Any other
      // value (inactive, "forward", "none") falls back to a subtle drift so a
      // stale/odd intent can never fling the eyes to a bound.
      const awayActive = args.thinkingIntent.active && args.thinkingIntent.direction === "away";
      if (awayActive) {
        const sign = c.horizontalBias === 0 ? randomSign() : Math.sign(c.horizontalBias);
        const horizontal = args.thinkingIntent.strength * c.strengthScale * sign;
        return {
          moveMs: randomBetween(c.moveMs[0], c.moveMs[1]),
          holdMs: randomBetween(c.holdMs[0], c.holdMs[1]),
          returnMs: randomBetween(c.returnMs[0], c.returnMs[1]),
          targetH: clampSigned(horizontal, safety.maxEyeballInfluence),
          targetV: clampSigned(c.verticalInfluence, safety.maxVerticalInfluence),
          sourceIntent: "thinking-intent-away",
        };
      }
      const f = c.fallback;
      return {
        moveMs: randomBetween(f.moveMs[0], f.moveMs[1]),
        holdMs: randomBetween(f.holdMs[0], f.holdMs[1]),
        returnMs: randomBetween(f.returnMs[0], f.returnMs[1]),
        targetH: clampSigned(f.horizontalInfluence * randomSign(), safety.maxEyeballInfluence),
        targetV: clampSigned(f.verticalInfluence, safety.maxVerticalInfluence),
        sourceIntent: "thinking-fallback",
      };
    }
    case "speaking":
    default: {
      const c = cfg.speaking;
      // Re-engaged by default (small refocus). When C7 publishes an active
      // intent, allow a brief emphasis glance sized by its strength.
      const emphasis = args.speakingIntent.active;
      const horizontal = emphasis
        ? args.speakingIntent.strength * c.emphasisStrengthScale * randomSign()
        : c.horizontalInfluence * randomSign();
      return {
        moveMs: randomBetween(c.moveMs[0], c.moveMs[1]),
        holdMs: randomBetween(c.holdMs[0], c.holdMs[1]),
        returnMs: randomBetween(c.returnMs[0], c.returnMs[1]),
        targetH: clampSigned(horizontal, safety.maxEyeballInfluence),
        targetV: clampSigned(c.verticalInfluence * randomSign(), safety.maxVerticalInfluence),
        sourceIntent: emphasis ? "speaking-emphasis" : "speaking-refocus",
      };
    }
  }
}

/** Scheduling window between events for `mode`. */
function intervalRange(mode: SaraV3GazeMode, thinkingAway: boolean): [number, number] {
  const cfg = SARA_V3_AVATAR_DEFINITION.saraV3.gazeConfig;
  switch (mode) {
    case "idle":
      return [cfg.idle.minIntervalMs, cfg.idle.maxIntervalMs];
    case "listening":
      return [cfg.listening.minIntervalMs, cfg.listening.maxIntervalMs];
    case "thinking":
      return thinkingAway
        ? [cfg.thinking.minIntervalMs, cfg.thinking.maxIntervalMs]
        : [cfg.thinking.fallback.minIntervalMs, cfg.thinking.fallback.maxIntervalMs];
    case "speaking":
    default:
      return [cfg.speaking.minIntervalMs, cfg.speaking.maxIntervalMs];
  }
}

/** First-event delay when ENTERING a state (never fires on the entry frame). */
function entryDelayMs(mode: SaraV3GazeMode, thinkingAway: boolean): number {
  const cfg = SARA_V3_AVATAR_DEFINITION.saraV3.gazeConfig;
  if (mode === "thinking" && thinkingAway) {
    return randomBetween(cfg.thinking.entryDelayMs[0], cfg.thinking.entryDelayMs[1]);
  }
  const [min, max] = intervalRange(mode, thinkingAway);
  return randomBetween(min, max);
}

function resolveEventPhase(
  state: SaraV3GazeControllerState,
  nowMs: number
): { phase: SaraV3GazeEventPhase; strength: number; done: boolean } {
  if (state.eventStartedAtMs == null) return { phase: "inactive", strength: 0, done: false };
  const elapsed = nowMs - state.eventStartedAtMs;
  const { eventMoveMs: moveMs, eventHoldMs: holdMs, eventReturnMs: returnMs } = state;
  if (elapsed <= moveMs) {
    return { phase: "move", strength: easeInOutSine(elapsed / Math.max(1, moveMs)), done: false };
  }
  if (elapsed <= moveMs + holdMs) {
    return { phase: "hold", strength: 1, done: false };
  }
  if (elapsed <= moveMs + holdMs + returnMs) {
    const t = (elapsed - moveMs - holdMs) / Math.max(1, returnMs);
    return { phase: "return", strength: 1 - easeInOutSine(t), done: false };
  }
  return { phase: "inactive", strength: 0, done: true };
}

/**
 * Runs once per frame, AFTER the eye runtime (so it can read live blink state)
 * and after the C6/C7 behavior coordinators (so it can read their gaze intents).
 * `activeMode` is the authoritative C1 effective mode.
 *
 * The eye runtime must be gated on the SAME `SARA_V3_GAZE_CONTROLLER_CONFIG`
 * flag so that exactly one of {controller, legacy eye-runtime gaze} writes the
 * gaze morphs. This function is a no-op when the flag is disabled.
 */
export function updateSaraV3GazeController(args: {
  state: SaraV3GazeControllerState;
  bindings: SaraV3BindingSet;
  activeMode: SaraV3RuntimeMode;
  /** C6 declarative gaze intent (published while thinking). */
  thinkingGazeIntent: SaraV3GazeIntent;
  /** C7 declarative gaze intent (inactive by default). */
  speakingGazeIntent: SaraV3GazeIntent;
  /** Live blink value from the eye runtime this frame (0..1). */
  blinkValue: number;
  /** True while a blink envelope is in flight (do not START a glance mid-blink). */
  blinkActive: boolean;
  nowMs: number;
}) {
  const { state, nowMs } = args;
  const enabled = SARA_V3_GAZE_CONTROLLER_CONFIG.enabled;
  const cfg = SARA_V3_AVATAR_DEFINITION.saraV3.gazeConfig;
  const { safety } = cfg;

  // Disabled: do not run and do not write. The eye runtime keeps its legacy gaze
  // blocks (they are gated on the same flag), so behavior matches pre-C8 exactly.
  if (!enabled) {
    state.gazeMode = args.activeMode;
    state.sourceIntent = "disabled";
    writeSaraV3GazeDiagnostics({
      enabled: false,
      gazeActive: false,
      behaviorState: args.activeMode,
      gazeMode: args.activeMode,
      sourceIntent: "disabled",
      targetDirection: { horizontal: 0, vertical: 0 },
      eyeLookValues: {},
      eyeballValues: {},
      eventPhase: "inactive",
      eventStartedAtMs: null,
      eventEndsAtMs: null,
      nextEventAtMs: 0,
      clampApplied: false,
      tempAssetCompensation: TEMP_ASSET_COMPENSATION,
    });
    return;
  }

  const mode: SaraV3GazeMode = args.activeMode;
  const thinkingAway =
    mode === "thinking" &&
    args.thinkingGazeIntent.active &&
    args.thinkingGazeIntent.direction === "away";

  // ── State entry/exit ───────────────────────────────────────────────────────
  // On any state change: cancel the in-flight event (it belonged to the old
  // state), keep the applied value where it is (damp toward the new target — no
  // snap), and schedule the first new event into the future so nothing fires on
  // the entry frame.
  if (state.lastMode !== mode) {
    state.eventStartedAtMs = null;
    state.eventTargetH = 0;
    state.eventTargetV = 0;
    state.eventPhase = "inactive";
    state.nextEventAtMs = nowMs + entryDelayMs(mode, thinkingAway);
    state.lastMode = mode;
  }

  // Initialize scheduling on the very first frame (no immediate event).
  if (state.nextEventAtMs === 0) {
    state.nextEventAtMs = nowMs + entryDelayMs(mode, thinkingAway);
  }

  // ── Event scheduler ────────────────────────────────────────────────────────
  // Never START a new gaze event mid-blink (so the eyes are not driven while the
  // lids are closing), matching the pre-C8 idle-glance guard.
  if (state.eventStartedAtMs == null && nowMs >= state.nextEventAtMs && !args.blinkActive) {
    const sample = sampleEvent({
      mode,
      thinkingIntent: args.thinkingGazeIntent,
      speakingIntent: args.speakingGazeIntent,
    });
    state.eventStartedAtMs = nowMs;
    state.eventMoveMs = sample.moveMs;
    state.eventHoldMs = sample.holdMs;
    state.eventReturnMs = sample.returnMs;
    state.eventTargetH = sample.targetH;
    state.eventTargetV = sample.targetV;
    state.sourceIntent = sample.sourceIntent;
  }

  const { phase, strength, done } = resolveEventPhase(state, nowMs);
  if (done) {
    state.eventStartedAtMs = null;
    state.eventTargetH = 0;
    state.eventTargetV = 0;
    const [min, max] = intervalRange(mode, thinkingAway);
    state.nextEventAtMs = nowMs + randomBetween(min, max);
  }
  state.eventPhase = state.eventStartedAtMs != null ? phase : "inactive";
  if (state.eventStartedAtMs == null) {
    state.sourceIntent = "centered";
  }

  // ── Raw (pre-damp) signed targets ──────────────────────────────────────────
  // Between events the target is center (0,0), so the damp always eases back to
  // neutral — the smooth return.
  const rawTargetH =
    state.eventStartedAtMs != null ? state.eventTargetH * strength : 0;
  const rawTargetV =
    state.eventStartedAtMs != null ? state.eventTargetV * strength : 0;

  // ── Damp toward target (frame-rate independent) ────────────────────────────
  const dtMs = state.lastNowMs > 0 ? nowMs - state.lastNowMs : 16;
  const dt = Math.min(0.1, Math.max(0, dtMs / 1000));
  state.lastNowMs = nowMs;
  state.appliedH = THREE.MathUtils.damp(state.appliedH, rawTargetH, safety.dampLambda, dt);
  state.appliedV = THREE.MathUtils.damp(state.appliedV, rawTargetV, safety.dampLambda, dt);

  // ── Final clamp + blink coupling ───────────────────────────────────────────
  const clampedH = clampSigned(state.appliedH, safety.maxEyeballInfluence);
  const clampedV = clampSigned(state.appliedV, safety.maxVerticalInfluence);
  const clampApplied = clampedH !== state.appliedH || clampedV !== state.appliedV;

  // Reduce eyeball rotation during a blink (preserves pre-C8 idle feel). Applied
  // to the horizontal eyeball channel only, matching the legacy behavior.
  const blinkReduction = 1 - clamp01(args.blinkValue) * safety.blinkReductionFactor;
  const eyeballValue = clampedH * blinkReduction;

  // ── Split vertical into the non-negative up/down pair, mirror L/R ───────────
  const eyeLookUp = Math.max(0, clampedV);
  const eyeLookDown = Math.max(0, -clampedV);

  const eyeLookTargets: Record<string, number> = {
    [map.eyeLookUpLeft]: eyeLookUp,
    [map.eyeLookUpRight]: eyeLookUp,
    [map.eyeLookDownLeft]: eyeLookDown,
    [map.eyeLookDownRight]: eyeLookDown,
  };
  // Both eyeballs share the identical signed value → coordinated, never crossed.
  const eyeballTargets: Record<string, number> = {
    [map.leftEyeball]: eyeballValue,
    [map.rightEyeball]: eyeballValue,
  };

  applySaraV3MorphValues(args.bindings, { ...eyeLookTargets, ...eyeballTargets });

  state.eyeLookTargets = eyeLookTargets;
  state.eyeballTargets = eyeballTargets;
  state.gazeMode = mode;
  state.clampApplied = clampApplied;

  const eventEndsAtMs =
    state.eventStartedAtMs != null
      ? state.eventStartedAtMs + state.eventMoveMs + state.eventHoldMs + state.eventReturnMs
      : null;

  writeSaraV3GazeDiagnostics({
    enabled: true,
    gazeActive: state.eventStartedAtMs != null,
    behaviorState: mode,
    gazeMode: mode,
    sourceIntent: state.sourceIntent,
    targetDirection: { horizontal: rawTargetH, vertical: rawTargetV },
    eyeLookValues: eyeLookTargets,
    eyeballValues: eyeballTargets,
    eventPhase: state.eventPhase,
    eventStartedAtMs: state.eventStartedAtMs,
    eventEndsAtMs,
    nextEventAtMs: state.nextEventAtMs,
    clampApplied,
    tempAssetCompensation: TEMP_ASSET_COMPENSATION,
  });
}
