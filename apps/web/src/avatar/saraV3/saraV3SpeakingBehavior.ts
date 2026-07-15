import type { AvatarPhonemeTimeline } from "@/lib/avatar/avatarMorphTypes";
import { SARA_V3_AVATAR_DEFINITION } from "./saraV3Config";
import { SARA_V3_SPEAKING_BEHAVIOR_CONFIG } from "./saraV3BehaviorConfig";
import { writeSaraV3SpeakingBehaviorDiagnostics } from "./saraV3Diagnostics";
import type {
  SaraV3GazeIntent,
  SaraV3RuntimeMode,
  SaraV3SentimentDirection,
  SaraV3SpeakingBehaviorState,
  SaraV3SpeakingEventPhase,
  SaraV3SpeakingEventType,
} from "./saraV3Types";

/**
 * C7 — SaraV3 speaking body-language behavior layer.
 *
 * A coordinator, not a morph writer. While C1 state is `speaking` it produces
 * two additive contributions that flow through the C2 layer stack, making Sara
 * look naturally engaged *beyond lip-sync*:
 *
 *   - a stable engaged BASELINE → C2 `stateExpression` (via the runtime's
 *     `stateExpressionTargets` override), replacing the static
 *     `expressionConfig.speaking` base while C7 is enabled: mild cheek support,
 *     small brow activity, very low smile support, slight eye squint. No
 *     frown/sad.
 *   - occasional phrase/sentence-level EMPHASIS pulses → C2 `scheduledMicro`: a
 *     short brow + cheek + eye-squint beat (plus a whisper of smile support when
 *     sentiment is not concern), on a randomized fade-in / hold / fade-out.
 *
 * Emphasis is triggered at sentence/chunk boundaries only — a *new*
 * `AvatarPhonemeTimeline` object reference — never per phoneme, and only ~1 in 3
 * boundaries pass the configured chance. A null timeline while still speaking is
 * a transient gap (held), not a reset. An in-flight pulse is preserved until its
 * envelope completes; a boundary arriving mid-pulse does not restart it.
 *
 * C3 coexistence: C3 owns emotional polarity/sentiment; C7 owns neutral engaged
 * body-language support. C7 never flips or exaggerates C3 — it only *reads* C3's
 * direction to keep out of its way:
 *   - concern → C7 suppresses its own smile support (baseline scaled down, and
 *     the emphasis smile support zeroed) so concern speech stays empathetic;
 *   - positive → C7's emphasis smile support is scaled down so it never stacks
 *     onto C3's positive smile into a grin.
 *
 * C7 writes NO gaze morph (that would be a second gaze writer alongside the eye
 * runtime) and NO head motion. A dedicated speaking gaze is deferred to C8, head
 * motion to C9, and the general emotion engine to C10. It never touches blink,
 * viseme/jaw/lip-sync, the sentiment gate, or the idle/listening/thinking layers.
 *
 * All tuning lives in `speakingBehaviorConfig`. Those values are TEMP
 * current-asset compensation (the current GLB deforms weakly) and must be
 * re-tuned lower once the updated GLB arrives.
 */

// The speaking tuning is intentionally high to compensate for the current GLB's
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

// Each emphasis pulse samples its own peaks in [70%, 100%] of the configured
// values, so repeated pulses never land on the exact same strength. Sampled once
// at pulse start and held for the whole envelope — never re-rolled per frame.
const MAGNITUDE_JITTER_FLOOR = 0.7;

function sampleMagnitude(peak: number) {
  return randomBetween(peak * MAGNITUDE_JITTER_FLOOR, peak);
}

export function createSaraV3SpeakingBehaviorState(): SaraV3SpeakingBehaviorState {
  return {
    wasSpeaking: false,
    enteredAtMs: null,
    timeInSpeakingMs: 0,
    chunkIdentity: null,
    eventStartedAtMs: null,
    eventType: "none",
    eventFadeInMs: 0,
    eventHoldMs: 0,
    eventFadeOutMs: 0,
    eventEyebrowPeak: 0,
    eventCheekPeak: 0,
    eventEyeSquintPeak: 0,
    eventSmilePeak: 0,
    lastChanceRoll: 0,
    lastChanceTriggered: false,
    stateExpressionTargets: {},
    scheduledMicroTargets: {},
  };
}

function resolveEventPhase(
  state: SaraV3SpeakingBehaviorState,
  nowMs: number
): { phase: SaraV3SpeakingEventPhase; strength: number; done: boolean } {
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

/** Fresh reset of all per-stretch scheduler state (used on entry and exit). */
function resetSpeakingState(state: SaraV3SpeakingBehaviorState) {
  state.eventStartedAtMs = null;
  state.eventType = "none";
  state.chunkIdentity = null;
  // Clear the sampled peaks so a stale magnitude can never leak into the next
  // entry — the next emphasis pulse resamples them from scratch.
  state.eventEyebrowPeak = 0;
  state.eventCheekPeak = 0;
  state.eventEyeSquintPeak = 0;
  state.eventSmilePeak = 0;
}

function chunkIdentityLabel(timeline: AvatarPhonemeTimeline | null): string | null {
  if (!timeline) return null;
  const sentence = typeof timeline.sentence === "string" ? timeline.sentence : "";
  return sentence.length > 60 ? `${sentence.slice(0, 60)}…` : sentence;
}

/**
 * Runs once per frame, before the expression runtime and AFTER the C3 sentiment
 * overlay (so `sentimentDirection` reflects the current sentence). `activeMode`
 * is the authoritative C1 effective mode (equivalently `presence.currentMode`).
 *
 * Returns `active` (C7 enabled AND currently speaking) plus the two routed layer
 * inputs and the declarative gaze intent. When `active` is false the maps are
 * empty and the caller falls back to the pre-C7 sources (static
 * `expressionConfig.speaking` base + the smile runtime's generic events).
 */
export function updateSaraV3SpeakingBehavior(args: {
  state: SaraV3SpeakingBehaviorState;
  activeMode: SaraV3RuntimeMode;
  /** Phoneme timeline; its object reference identifies the sentence/chunk. */
  timeline: AvatarPhonemeTimeline | null;
  /** C3 sentiment direction seen this frame (drives smile suppression). */
  sentimentDirection: SaraV3SentimentDirection;
  nowMs: number;
}): {
  active: boolean;
  stateExpressionTargets: Record<string, number>;
  scheduledMicroTargets: Record<string, number>;
  gazeIntent: SaraV3GazeIntent;
} {
  const { state, timeline, sentimentDirection, nowMs } = args;
  const enabled = SARA_V3_SPEAKING_BEHAVIOR_CONFIG.enabled;
  const cfg = SARA_V3_AVATAR_DEFINITION.saraV3.speakingBehaviorConfig;
  const isSpeaking = enabled && args.activeMode === "speaking";

  // ── Not speaking (or disabled): release and reset for a fresh next entry ────
  if (!isSpeaking) {
    if (state.wasSpeaking) {
      // Leaving speaking: stop scheduling and clear timers + chunk identity.
      // In-flight targets are NOT snapped — the expression runtime damps them out
      // smoothly, so nothing carries into idle/listening/thinking.
      resetSpeakingState(state);
      state.enteredAtMs = null;
      state.timeInSpeakingMs = 0;
      state.lastChanceRoll = 0;
      state.lastChanceTriggered = false;
      state.stateExpressionTargets = {};
      state.scheduledMicroTargets = {};
    }
    state.wasSpeaking = false;
    writeSaraV3SpeakingBehaviorDiagnostics({
      enabled,
      speakingActive: false,
      timeInSpeakingMs: 0,
      chunkIdentity: null,
      baselineTargets: {},
      currentEventType: "none",
      eventPhase: "inactive",
      eventMagnitude: 0,
      lastChanceRoll: 0,
      lastChanceTriggered: false,
      sentimentDirection,
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

  // ── Entering speaking: baseline applies immediately; no pulse fires on entry ─
  if (!state.wasSpeaking) {
    state.enteredAtMs = nowMs;
    // Stale listening/thinking scheduler state cannot carry over (those are
    // separate coordinators), but reset our own chunk identity so the first real
    // chunk of this reply is evaluated exactly once below.
    resetSpeakingState(state);
    state.lastChanceTriggered = false;
  }
  state.wasSpeaking = true;
  state.timeInSpeakingMs = state.enteredAtMs != null ? nowMs - state.enteredAtMs : 0;

  const em = cfg.emphasis;

  // ── Sentence/chunk-boundary emphasis trigger ────────────────────────────────
  // A new timeline object reference == a new sentence/chunk. Evaluate eligibility
  // once per new chunk, and only when no pulse is in flight (preserve the current
  // pulse until its envelope completes). A null timeline is a transient gap: we
  // hold identity and do not re-trigger.
  if (timeline != null && timeline !== state.chunkIdentity) {
    state.chunkIdentity = timeline;
    if (state.eventStartedAtMs == null) {
      const roll = Math.random();
      const triggered = roll < em.chancePerChunk;
      state.lastChanceRoll = roll;
      state.lastChanceTriggered = triggered;
      if (triggered) {
        state.eventStartedAtMs = nowMs;
        state.eventType = "emphasis";
        state.eventFadeInMs = randomBetween(em.fadeInMs[0], em.fadeInMs[1]);
        state.eventHoldMs = randomBetween(em.holdMs[0], em.holdMs[1]);
        state.eventFadeOutMs = randomBetween(em.fadeOutMs[0], em.fadeOutMs[1]);
        state.eventEyebrowPeak = sampleMagnitude(em.eyebrowPeak);
        state.eventCheekPeak = sampleMagnitude(em.cheekPeak);
        state.eventEyeSquintPeak = sampleMagnitude(em.eyeSquintPeak);
        // Smile support is baked with the C3 direction seen at pulse start:
        // zeroed under concern, scaled down under positive (never a grin).
        let smilePeak = sampleMagnitude(em.smileSupportPeak);
        if (sentimentDirection === "concern") smilePeak = 0;
        else if (sentimentDirection === "positive") smilePeak *= em.positiveSmileScale;
        state.eventSmilePeak = smilePeak;
      }
    }
  }

  const { phase, strength, done } = resolveEventPhase(state, nowMs);
  if (done) {
    state.eventStartedAtMs = null;
    state.eventType = "none";
  }

  // ── Route outputs into the C2 slots ─────────────────────────────────────────
  // Baseline: a copy of the configured base, with smile support suppressed under
  // C3 concern so concern speech stays empathetic (cheek/brow engagement remain).
  const stateExpressionTargets: Record<string, number> = { ...cfg.base };
  if (sentimentDirection === "concern") {
    if (map.smileLeft in stateExpressionTargets)
      stateExpressionTargets[map.smileLeft] *= cfg.concernBaseSmileScale;
    if (map.smileRight in stateExpressionTargets)
      stateExpressionTargets[map.smileRight] *= cfg.concernBaseSmileScale;
  }

  const scheduledMicroTargets: Record<string, number> = {};
  if (state.eventStartedAtMs != null && strength > 0) {
    scheduledMicroTargets[map.eyebrows] = state.eventEyebrowPeak * strength;
    scheduledMicroTargets[map.cheekLeft] = state.eventCheekPeak * strength;
    scheduledMicroTargets[map.cheekRight] = state.eventCheekPeak * strength;
    scheduledMicroTargets[map.eyeSquintLeft] = state.eventEyeSquintPeak * strength;
    scheduledMicroTargets[map.eyeSquintRight] = state.eventEyeSquintPeak * strength;
    if (state.eventSmilePeak > 0) {
      scheduledMicroTargets[map.smileLeft] = state.eventSmilePeak * strength;
      scheduledMicroTargets[map.smileRight] = state.eventSmilePeak * strength;
    }
  }

  state.stateExpressionTargets = stateExpressionTargets;
  state.scheduledMicroTargets = scheduledMicroTargets;

  let eventMagnitude = 0;
  for (const v of Object.values(scheduledMicroTargets)) {
    eventMagnitude = Math.max(eventMagnitude, Math.abs(v));
  }
  const currentEventType: SaraV3SpeakingEventType =
    state.eventStartedAtMs != null ? state.eventType : "none";

  const gazeIntent: SaraV3GazeIntent = cfg.gazeIntent.emitIntent
    ? { active: true, direction: cfg.gazeIntent.direction, strength: cfg.gazeIntent.strength }
    : INACTIVE_GAZE_INTENT;

  writeSaraV3SpeakingBehaviorDiagnostics({
    enabled,
    speakingActive: true,
    timeInSpeakingMs: state.timeInSpeakingMs,
    chunkIdentity: chunkIdentityLabel(timeline),
    baselineTargets: stateExpressionTargets,
    currentEventType,
    eventPhase: state.eventStartedAtMs != null ? phase : "inactive",
    eventMagnitude,
    lastChanceRoll: state.lastChanceRoll,
    lastChanceTriggered: state.lastChanceTriggered,
    sentimentDirection,
    stateExpressionTargets,
    scheduledMicroTargets,
    gazeIntent,
    tempAssetCompensation: TEMP_ASSET_COMPENSATION,
  });

  return { active: true, stateExpressionTargets, scheduledMicroTargets, gazeIntent };
}
