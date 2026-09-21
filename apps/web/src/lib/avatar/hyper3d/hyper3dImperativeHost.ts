import * as THREE from "three";
import {
  getHyper3dEngineFactory,
  type Hyper3dConversationState,
  type Hyper3dEngineHandle,
  type Hyper3dFrameContext,
} from "./hyper3dEngineRegistry";
import {
  countHyper3dFrame,
  countHyper3dEngineUpdate,
  countHyper3dRafCallback,
  countHyper3dRender,
  failHyper3dPhase,
  finishHyper3dLoopFrame,
  markHyper3dPhase,
  markHyper3dHeartbeatStopped,
  markHyper3dLongTaskObserver,
  recordHyper3dHeartbeat,
  recordHyper3dLongTask,
  recordHyper3dLoopFrame,
  recordHyper3dPath,
  recordHyper3dRendererInfo,
  recordHyper3dVisibilityEvent,
  resetHyper3dLoopDiagnostics,
} from "./hyper3dPathDiagnostics";

/**
 * HYPER3D IMPERATIVE HOST — Solace's replacement for react-three-fiber.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 * The accepted Hyper3D engine is framework-agnostic; only its MOUNTING layer is
 * r3f 9, which needs React 19. Solace is React 18 and already renders avatars
 * imperatively (`ThreeAvatar` builds its own `WebGLRenderer`). This host does
 * what r3f's `<Canvas>` and `useFrame` did — create the renderer, scene and
 * camera, keep them sized, drive one animation loop, dispose everything — and
 * nothing else. It knows no tuning, no mappings, no timing.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE NO-CRASH RULE
 * ─────────────────────────────────────────────────────────────────────────────
 * A React error boundary only catches errors thrown during render and commit.
 * Most of the ways an avatar fails are NOT that: a rejected GLB fetch, a texture
 * decode, rig or morph binding inside an async init, a throw from inside
 * `requestAnimationFrame`, a lost WebGL context. React never sees those.
 *
 * So every one of them is caught HERE and turned into one call to `onFailure`.
 * The boundary stays as the backstop for render-phase faults; between them the
 * two cover the list. On any failure the loop stops, resources are released, and
 * the seam swaps back to the existing Solace avatar — audio, the WebSocket and
 * the session are never touched, because this host holds no reference to any of
 * them.
 *
 * `onFailure` fires AT MOST ONCE per host. There is no retry, so there is no
 * reload loop and no way for a failing avatar to restart a session.
 */

export type Hyper3dHostStatus =
  | "idle"
  | "initializing"
  | "running"
  | "unavailable"
  | "failed";

export type Hyper3dHostFailure = {
  /** Which part failed, for diagnostics and the fallback reason string. */
  stage:
    | "webgl-context"
    | "engine-missing"
    | "engine-init"
    | "animation-frame"
    | "context-lost";
  message: string;
  error?: unknown;
};

export type Hyper3dImperativeHostOptions = {
  container: HTMLElement;
  /** Response-relative playback seconds. Phase 1's `SolaceAudioClock`. */
  getPlaybackTime: () => number;
  getConversationState: () => Hyper3dConversationState;
  /** Mouth drive level; the same ref ThreeAvatar reads. */
  getAudioLevel: () => number;
  /** Called at most once. The seam uses it to fall back without a reload. */
  onFailure: (failure: Hyper3dHostFailure) => void;
  onStatusChange?: (status: Hyper3dHostStatus) => void;
};

export type Hyper3dImperativeHost = {
  getStatus(): Hyper3dHostStatus;
  /** Frames rendered since start. Diagnostics only. */
  getFrameCount(): number;
  dispose(): void;
};

/** Phase 2G.1B loop counters. Compiled out of production builds. */
const DEV_LOOP_DIAGNOSTICS = import.meta.env.DEV === true;

export function createHyper3dImperativeHost(
  options: Hyper3dImperativeHostOptions,
): Hyper3dImperativeHost {
  let status: Hyper3dHostStatus = "idle";
  let disposed = false;
  let failureReported = false;
  let frameId: number | null = null;
  let frameCount = 0;

  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let engine: Hyper3dEngineHandle | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let resizeObserver: ResizeObserver | null = null;

  const abort = new AbortController();
  const startedAtMs = performance.now();
  let lastFrameMs = startedAtMs;

  /**
   * DEV-only loop observation (Phase 2G.1B): page visibility/focus events and a
   * 100 ms main-thread heartbeat that is INDEPENDENT of requestAnimationFrame.
   * Together they separate "the browser stopped calling rAF" from "the main
   * thread was blocked". Neither changes rendering, timing or any browser
   * behaviour; the listeners are passive and removed on teardown.
   */
  let heartbeatId: number | null = null;
  const visibilityListeners: Array<[EventTarget, string, EventListener]> = [];
  /**
   * Phase 2G.1C: `performance.now()` immediately after the previous tick's
   * `renderer.render` returned. The gap between it and the next tick's entry is
   * the time this loop did NOT own — which is the whole question.
   */
  let lastTickEndMs: number | null = null;
  let longTaskObserver: PerformanceObserver | null = null;
  const startLongTaskObserver = () => {
    const supported =
      typeof PerformanceObserver !== "undefined" &&
      Array.isArray(PerformanceObserver.supportedEntryTypes) &&
      PerformanceObserver.supportedEntryTypes.includes("longtask");
    if (!supported) {
      // Recorded explicitly: without this, an empty entry list is unreadable.
      markHyper3dLongTaskObserver({
        supported: false,
        observing: false,
        buffered: false,
        error: "longtask is not in PerformanceObserver.supportedEntryTypes",
      });
      return;
    }
    try {
      longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) recordHyper3dLongTask(entry);
      });
      // `buffered` back-fills tasks from before the observer existed, which is
      // exactly the window the avatar loads in.
      longTaskObserver.observe({ type: "longtask", buffered: true });
      markHyper3dLongTaskObserver({
        supported: true,
        observing: true,
        buffered: true,
        error: null,
      });
    } catch (error) {
      longTaskObserver = null;
      markHyper3dLongTaskObserver({
        supported: true,
        observing: false,
        buffered: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
  const startLoopDiagnostics = () => {
    if (!DEV_LOOP_DIAGNOSTICS || typeof document === "undefined") return;
    resetHyper3dLoopDiagnostics();
    lastTickEndMs = null;
    startLongTaskObserver();
    const attach = (target: EventTarget, type: string) => {
      const listener: EventListener = () => recordHyper3dVisibilityEvent(type);
      target.addEventListener(type, listener);
      visibilityListeners.push([target, type, listener]);
    };
    attach(document, "visibilitychange");
    if (typeof window !== "undefined") {
      attach(window, "focus");
      attach(window, "blur");
      attach(window, "pagehide");
      attach(window, "pageshow");
    }
    let lastBeatMs = performance.now();
    heartbeatId = window.setInterval(() => {
      const nowMs = performance.now();
      recordHyper3dHeartbeat(nowMs - lastBeatMs);
      lastBeatMs = nowMs;
    }, 100);
  };
  const stopLoopDiagnostics = () => {
    if (longTaskObserver) {
      try {
        longTaskObserver.disconnect();
      } catch {
        /* teardown must not throw */
      }
      longTaskObserver = null;
      markHyper3dLongTaskObserver({
        supported: true,
        observing: false,
        buffered: true,
        error: null,
      });
    }
    if (heartbeatId !== null) {
      window.clearInterval(heartbeatId);
      heartbeatId = null;
      markHyper3dHeartbeatStopped();
    }
    for (const [target, type, listener] of visibilityListeners) {
      target.removeEventListener(type, listener);
    }
    visibilityListeners.length = 0;
  };

  /**
   * One frame context, allocated once and mutated in place. The animation loop
   * must not allocate: this runs at display rate for the whole session.
   */
  const frameContext: Hyper3dFrameContext = {
    timeSeconds: 0,
    deltaSeconds: 0,
    elapsedSeconds: 0,
    conversation: { isSpeaking: false, isListening: false, isThinking: false },
    audioLevel: 0,
  };

  const setStatus = (next: Hyper3dHostStatus) => {
    if (status === next) return;
    status = next;
    options.onStatusChange?.(next);
  };

  const fail = (failure: Hyper3dHostFailure) => {
    if (failureReported) return;
    /**
     * A DISPOSED HOST REPORTS NOTHING.
     *
     * `dispose()` aborts the load signal, so an init in flight rejects — with
     * "aborted", not with a fault. Reporting that would latch the seam's
     * one-way fallback on behalf of a host that no longer exists, and the latch
     * lives in `AvatarRuntimeSwitch`, which SURVIVES this host. The user would
     * then see the old avatar for the rest of the session because of a teardown,
     * not a failure.
     *
     * The window is not theoretical: the production GLB is ~43 MB, so any
     * unmount during that load lands here.
     */
    if (disposed) return;
    failureReported = true;
    setStatus(failure.stage === "engine-missing" ? "unavailable" : "failed");
    stopLoop();
    // Report before releasing: the seam wants to swap the avatar immediately,
    // and teardown of a broken context can itself be slow.
    try {
      options.onFailure(failure);
    } catch (callbackError) {
      console.error("[Hyper3D] fallback handler threw:", callbackError);
    }
    releaseResources();
  };

  const stopLoop = () => {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
  };

  const releaseResources = () => {
    stopLoop();
    stopLoopDiagnostics();
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (engine) {
      try {
        engine.dispose();
      } catch (error) {
        console.error("[Hyper3D] engine dispose threw:", error);
      }
      engine = null;
    }
    if (canvas) {
      canvas.removeEventListener("webglcontextlost", onContextLost);
    }
    if (renderer) {
      try {
        renderer.dispose();
        // Frees the GPU context immediately rather than waiting for GC; a
        // session can mount and unmount this repeatedly.
        renderer.forceContextLoss();
      } catch {
        /* a context that is already gone is not an error here */
      }
      renderer = null;
    }
    if (canvas?.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = null;
    scene = null;
    camera = null;
  };

  function onContextLost(event: Event) {
    // Without preventDefault the context can never be restored; we do not
    // attempt restoration, we fall back — that is the no-reload-loop rule.
    event.preventDefault();
    fail({
      stage: "context-lost",
      message: "The WebGL context was lost.",
    });
  }

  const resize = () => {
    if (!renderer || !camera) return;
    const width = options.container.clientWidth;
    const height = options.container.clientHeight;
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const tick = () => {
    if (disposed) return;
    frameId = requestAnimationFrame(tick);
    // DEV counter: every rAF callback, even ones that return early below.
    if (DEV_LOOP_DIAGNOSTICS) countHyper3dRafCallback();
    if (!renderer || !scene || !camera || !engine) return;

    try {
      const nowMs = performance.now();
      // The clamp is UNCHANGED; `rawDeltaMs` only records what it clamps away.
      const rawDeltaMs = nowMs - lastFrameMs;
      const deltaSeconds = Math.min(0.1, rawDeltaMs / 1000);
      lastFrameMs = nowMs;
      if (DEV_LOOP_DIAGNOSTICS) {
        recordHyper3dLoopFrame({
          performanceNow: nowMs,
          rawDeltaMs,
          clampedDeltaSeconds: deltaSeconds,
          engineStatus: status,
          // Phase 2G.1C: wall time between the previous tick's last statement of
          // real work and this one's first. Everything the loop does not own.
          outsideTickMs: lastTickEndMs === null ? null : nowMs - lastTickEndMs,
        });
      }

      const conversation = options.getConversationState();
      frameContext.timeSeconds = options.getPlaybackTime();
      frameContext.deltaSeconds = deltaSeconds;
      frameContext.elapsedSeconds = (nowMs - startedAtMs) / 1000;
      frameContext.conversation.isSpeaking = conversation.isSpeaking;
      frameContext.conversation.isListening = conversation.isListening;
      frameContext.conversation.isThinking = conversation.isThinking;
      frameContext.audioLevel = options.getAudioLevel();

      if (DEV_LOOP_DIAGNOSTICS) countHyper3dEngineUpdate();
      // Phase 2G.1C: three stamps around work that already existed. In a
      // production build `DEV_LOOP_DIAGNOSTICS` is false and these are 0.
      const engineStartMs = DEV_LOOP_DIAGNOSTICS ? performance.now() : 0;
      engine.update(frameContext);
      const renderStartMs = DEV_LOOP_DIAGNOSTICS ? performance.now() : 0;
      renderer.render(scene, camera);
      const renderEndMs = DEV_LOOP_DIAGNOSTICS ? performance.now() : 0;
      if (DEV_LOOP_DIAGNOSTICS) countHyper3dRender();
      frameCount += 1;
      countHyper3dFrame();
      if (DEV_LOOP_DIAGNOSTICS) {
        lastTickEndMs = renderEndMs;
        finishHyper3dLoopFrame({
          inTickMs: renderEndMs - nowMs,
          engineUpdateMs: renderStartMs - engineStartMs,
          rendererRenderMs: renderEndMs - renderStartMs,
        });
        recordHyper3dRendererInfo(frameCount, renderer.info);
      }
    } catch (error) {
      failHyper3dPhase(
        "frame-evaluation",
        error instanceof Error ? error.message : String(error),
      );
      // A throw inside requestAnimationFrame is invisible to React. Catching it
      // here is the only thing standing between an engine bug and a dead
      // session — and the session must survive it.
      fail({
        stage: "animation-frame",
        message:
          error instanceof Error ? error.message : "The avatar animation frame threw.",
        error,
      });
    }
  };

  const start = async () => {
    setStatus("initializing");

    const factory = getHyper3dEngineFactory();
    recordHyper3dPath({ factoryRegistered: Boolean(factory) });
    if (!factory) {
      // Expected until Phase 2B registers the ported engine. Not an error — the
      // seam simply keeps the existing avatar.
      failHyper3dPhase("not-started", "no engine factory registered");
      fail({
        stage: "engine-missing",
        message:
          "No Hyper3D engine is registered in this build; using the existing Solace avatar.",
      });
      return;
    }

    try {
      canvas = document.createElement("canvas");
      canvas.style.display = "block";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      options.container.appendChild(canvas);
      canvas.addEventListener("webglcontextlost", onContextLost);

      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);

      scene = new THREE.Scene();
      // Neutral defaults only. Framing, lighting and environment belong to the
      // accepted engine and are configured by it through `init`, so no accepted
      // appearance decision is reproduced or second-guessed here.
      camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
      resize();
      markHyper3dPhase("webgl-context");
    } catch (error) {
      failHyper3dPhase(
        "webgl-context",
        error instanceof Error ? error.message : String(error),
      );
      fail({
        stage: "webgl-context",
        message:
          error instanceof Error
            ? error.message
            : "WebGL is unavailable in this browser.",
        error,
      });
      return;
    }

    try {
      recordHyper3dPath({ initAttempted: true }, "engine init started");
      const handle = await factory({
        scene,
        camera,
        renderer,
        signal: abort.signal,
      });
      // The host may have been torn down while the GLB was loading.
      if (disposed || abort.signal.aborted) {
        try {
          handle.dispose();
        } catch {
          /* nothing to recover */
        }
        return;
      }
      engine = handle;
    } catch (error) {
      // The factory has already recorded the phase it threw in; this only fills
      // one in when the throw came from somewhere that had not marked itself.
      failHyper3dPhase(
        "controller-init",
        error instanceof Error ? error.message : String(error),
      );
      fail({
        stage: "engine-init",
        message:
          error instanceof Error
            ? error.message
            : "The Hyper3D avatar failed to initialize.",
        error,
      });
      return;
    }

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(options.container);
    }

    setStatus("running");
    startLoopDiagnostics();
    lastFrameMs = performance.now();
    frameId = requestAnimationFrame(tick);
  };

  // Fire and forget: every rejection path inside `start` is already handled by
  // `fail`, and nothing above may reject into an unhandled promise.
  void start();

  return {
    getStatus: () => status,
    getFrameCount: () => frameCount,
    dispose() {
      if (disposed) return;
      disposed = true;
      abort.abort();
      releaseResources();
      setStatus("idle");
    },
  };
}
