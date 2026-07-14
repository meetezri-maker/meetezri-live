import { updateSaraV3PresenceRuntime } from "./saraV3PresenceRuntime";
import { writeSaraV3BehaviorDiagnostics } from "./saraV3Diagnostics";
import type { SaraV3BehaviorEngineState } from "./saraV3BehaviorTypes";
import type { SaraV3PresenceState } from "./saraV3Types";

export function createSaraV3BehaviorEngineState(): SaraV3BehaviorEngineState {
  return {
    currentState: "idle",
    previousState: null,
    enteredAt: 0,
    stateElapsed: 0,
    transitionReason: null,
    interrupted: false,
    initialized: false,
  };
}

/**
 * C1: authoritative behavior state machine.
 *
 * This is an *additive wrapper* around the existing presence resolver. It does
 * two things and nothing else:
 *
 *  1. Delegates to `updateSaraV3PresenceRuntime` to resolve the effective mode.
 *     That call is byte-identical to the legacy path, so the mode consumed by
 *     every downstream subsystem (Eye/Smile/Expression/Viseme) is unchanged.
 *  2. Performs entry/exit detection to maintain the authoritative behavior-state
 *     metadata (`currentState`, `previousState`, `enteredAt`, `stateElapsed`,
 *     `transitionReason`, `interrupted`).
 *
 * It intentionally does NOT drive any morphs, gaze, blink, smile, or expression
 * targets. The `presence` object it writes remains the single source downstream
 * reads via `presence.currentMode`.
 */
export function updateSaraV3BehaviorStateMachine(args: {
  behavior: SaraV3BehaviorEngineState;
  presence: SaraV3PresenceState;
  isSpeaking: boolean;
  isListening: boolean;
  isThinking: boolean;
  nowMs: number;
}): void {
  const { behavior } = args;

  // 1. Reuse the legacy priority resolver verbatim (speaking > thinking >
  //    listening > idle). This is the authoritative effective mode.
  updateSaraV3PresenceRuntime({
    state: args.presence,
    isSpeaking: args.isSpeaking,
    isListening: args.isListening,
    isThinking: args.isThinking,
  });
  const mode = args.presence.currentMode;

  // 2. Entry/exit detection (metadata only — no visual effect in C1).
  if (!behavior.initialized) {
    behavior.initialized = true;
    behavior.currentState = mode;
    behavior.previousState = null;
    behavior.enteredAt = args.nowMs;
    behavior.transitionReason = "init";
    behavior.interrupted = false;
  } else if (mode !== behavior.currentState) {
    const previous = behavior.currentState;
    behavior.previousState = previous;
    behavior.currentState = mode;
    behavior.enteredAt = args.nowMs;
    behavior.transitionReason = `${previous}->${mode}`;
    // Real interruption/barge-in detection requires an explicit session-layer
    // signal and is deferred to the later transition/interruption phase. Do not
    // infer it from mode changes or the audio clock. C1 keeps this false for all
    // transitions; the field is retained so later phases can wire it without a
    // schema change.
    behavior.interrupted = false;
  }
  behavior.stateElapsed = args.nowMs - behavior.enteredAt;

  writeSaraV3BehaviorDiagnostics({
    activePath: "behaviorEngine",
    currentState: behavior.currentState,
    previousState: behavior.previousState,
    enteredAt: behavior.enteredAt,
    stateElapsed: behavior.stateElapsed,
    transitionReason: behavior.transitionReason,
    interrupted: behavior.interrupted,
    effectiveMode: mode,
  });
}
