import type * as THREE from "three";

/**
 * THE PHASE 2B INSERTION POINT.
 *
 * The accepted Hyper3D engine — `AvatarController`, the lipsync/behaviour/
 * emotion/timeline modules, the mappings and every tuning constant — takes no
 * React dependency. avatar-test mounts and ticks it through react-three-fiber 9,
 * which requires React 19; Solace is React 18 and renders avatars imperatively.
 * Option 3 keeps BOTH intact by replacing only the mounting layer.
 *
 * This module is the boundary between the two halves:
 *
 *   Solace owns   the canvas, renderer, scene, camera, resize, RAF, disposal,
 *                 failure isolation, and the playback clock (Phase 1 adapter).
 *   The engine    owns everything about how the avatar looks and behaves, and
 *                 is driven once per frame through `update`.
 *
 * Nothing about accepted behaviour is expressed here — no tuning, no mappings,
 * no timing. Phase 2B registers a factory; until then none is registered, the
 * host reports `unavailable`, and the seam keeps the existing Solace avatar on
 * screen. That is why this file can exist before the engine is ported.
 */

/** Conversation state, as Solace already represents it. Read-only for the engine. */
export type Hyper3dConversationState = {
  isSpeaking: boolean;
  isListening: boolean;
  isThinking: boolean;
};

/** Everything one animation frame hands the engine. Allocated once and reused. */
export type Hyper3dFrameContext = {
  /**
   * Response-relative seconds from the Solace audio clock — the SAME clock the
   * WebSocket audio scheduler plays on. The engine must treat this as
   * authoritative and must never derive its own.
   */
  timeSeconds: number;
  deltaSeconds: number;
  /** Wall clock, for behaviour that is not tied to speech playback. */
  elapsedSeconds: number;
  conversation: Hyper3dConversationState;
  /** Mouth drive level from the analyser tap (same scale ThreeAvatar receives). */
  audioLevel: number;
};

export type Hyper3dEngineInit = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  /** Aborts a slow or superseded load; the host signals this on unmount. */
  signal: AbortSignal;
};

export type Hyper3dEngineHandle = {
  /**
   * Called once per animation frame, before `renderer.render`.
   *
   * Must not throw. If it does, the host catches it, stops the loop and falls
   * back to the existing Solace avatar — the session and its audio continue.
   */
  update(context: Hyper3dFrameContext): void;
  /** Must be safe to call more than once and after a failed init. */
  dispose(): void;
};

/**
 * Builds the engine against a scene the host already created.
 *
 * Async because the accepted runtime loads a GLB and its textures. A rejection
 * is a normal, handled outcome: the host reports it and the seam falls back.
 */
export type Hyper3dEngineFactory = (
  init: Hyper3dEngineInit,
) => Promise<Hyper3dEngineHandle>;

let factory: Hyper3dEngineFactory | null = null;
let playbackClock: (() => number) | null = null;
let runtimeCommitted = false;

/**
 * Phase 2B calls this once, at module load, from the engine's own entry point.
 * Registration is intentionally imperative and global: the host must be able to
 * ask "is the engine present?" without importing it, so that an unported or
 * failed-to-load engine cannot drag the session down with it.
 */
export function registerHyper3dEngineFactory(next: Hyper3dEngineFactory): void {
  factory = next;
}

export function getHyper3dEngineFactory(): Hyper3dEngineFactory | null {
  return factory;
}

/** Per-session continuous AudioContext clock registered beside its factory. */
export function registerHyper3dPlaybackClock(clock: () => number): void {
  playbackClock = clock;
}

export function getHyper3dPlaybackClock(): (() => number) | null {
  return playbackClock;
}

/**
 * Whether `AvatarRuntimeSwitch` — the ONE place the flag is resolved — has
 * committed the Hyper3D branch (false before commit, after a fallback latch and
 * after unmount). Written only by the seam; read where live metadata association
 * must follow the mounted avatar without consulting the flag a second time.
 */
export function setHyper3dRuntimeCommitted(active: boolean): void {
  runtimeCommitted = active;
}

export function isHyper3dRuntimeCommitted(): boolean {
  return runtimeCommitted;
}

/** Test-only reset. Not used by application code. */
export function __resetHyper3dEngineFactoryForTests(): void {
  factory = null;
  playbackClock = null;
  runtimeCommitted = false;
}
