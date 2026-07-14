import type { SaraV3RuntimeMode } from "./saraV3Types";

/**
 * C1: authoritative behavior states.
 *
 * The four presence modes are 1:1 with `SaraV3RuntimeMode` and are the only
 * states C1 ever *enters* — every downstream subsystem (Eye/Smile/Expression/
 * Viseme) continues to consume a plain `SaraV3RuntimeMode` effective mode.
 *
 * `"transitioning"` is reserved for C11 (the real transition system). It is
 * declared here so later phases can extend the machine without a type churn,
 * but C1 never assigns it and never surfaces it as an effective mode, so no
 * visible expression / blink / gaze / smile / morph behavior changes.
 */
export type SaraV3BehaviorState = SaraV3RuntimeMode | "transitioning";

/**
 * C1: authoritative, additive behavior-state object produced by the state
 * machine. It is metadata *around* the existing presence resolver — it does
 * not itself drive any morphs in C1.
 */
export type SaraV3BehaviorEngineState = {
  /** Current authoritative behavior state (C1: always a `SaraV3RuntimeMode`). */
  currentState: SaraV3BehaviorState;
  /** Prior state, or `null` before the first transition. */
  previousState: SaraV3BehaviorState | null;
  /** Frame-clock timestamp (ms) when `currentState` was entered. */
  enteredAt: number;
  /** Milliseconds elapsed in `currentState` (refreshed every frame). */
  stateElapsed: number;
  /** Human-readable reason for the most recent transition (e.g. "idle->listening"). */
  transitionReason: string | null;
  /**
   * True when a `speaking` turn was cut short directly into another active
   * state (barge-in). Derived purely from the transition itself, so it is safe
   * with today's inputs and never affects the effective mode.
   */
  interrupted: boolean;
  /** Internal: whether the first frame has seeded the initial state. */
  initialized: boolean;
};

/**
 * C1/C12 diagnostics snapshot for the behavior engine. Development-only:
 * written to `window.saraV3BehaviorDiagnostics` under `import.meta.env.DEV`.
 */
export type SaraV3BehaviorDiagnostics = {
  /** The path that produced this frame's effective mode. */
  activePath: "behaviorEngine" | "legacyPresence";
  currentState: SaraV3BehaviorState;
  previousState: SaraV3BehaviorState | null;
  enteredAt: number;
  stateElapsed: number;
  transitionReason: string | null;
  interrupted: boolean;
  /** The `SaraV3RuntimeMode` handed to downstream subsystems this frame. */
  effectiveMode: SaraV3RuntimeMode;
};
