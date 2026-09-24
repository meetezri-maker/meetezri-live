import type { Hyper3dLiveInputs } from "./hyper3dEngineFactory";
import {
  registerHyper3dEngineFactory,
  registerHyper3dPlaybackClock,
} from "./hyper3dEngineRegistry";
import {
  recordHyper3dAssetTimeline,
  recordHyper3dPath,
  registerHyper3dAudioProbe,
} from "./hyper3dPathDiagnostics";
import type { Hyper3dLiveSpeechAdapter } from "./hyper3dLiveSpeechAdapter";

/**
 * THE MISSING HALF OF THE REGISTRY SEAM.
 *
 * `hyper3dEngineRegistry` was written in Phase 2A with a docstring that says
 * "Phase 2B calls this once, at module load, from the engine's own entry point".
 * That turned out not to be possible as written, and the reason is worth stating
 * rather than working around silently:
 *
 *   `createHyper3dEngineFactory` is a factory OF a factory. It closes over
 *   `Hyper3dLiveInputs` — the growing live payload, the response-relative
 *   acoustic frames and a change signal — and all three come from the Phase 1
 *   live-speech adapter, which is created per session inside `ActiveSession`.
 *   At module load there is no session and therefore nothing to close over.
 *
 * So registration happens where the adapter exists, and this module is the one
 * place that knows how to turn an adapter into the engine's input contract.
 * Nothing about accepted behaviour is expressed here: no tuning, no mappings, no
 * timing, no appearance. It is an adapter-to-contract shim and a single
 * `registerHyper3dEngineFactory` call.
 */

/**
 * The engine re-plans whenever this number changes, so it is read EVERY FRAME
 * and must be allocation-free.
 *
 * The adapter already publishes two stable-identity signals:
 *
 *   `getPayload()`        returns the same object until the timeline changes —
 *                         `liveSpeechTimeline` rebuilds it on `beginTurn`, on an
 *                         accepted chunk append and on cancel, and not otherwise.
 *   `getAcousticFrames()` returns the live array; frames are appended as the
 *                         scheduler's decoded buffers are analysed.
 *
 * Comparing payload IDENTITY and frame COUNT costs two property reads and no
 * allocation. `getTimelineStats()` would be the obvious alternative and is the
 * wrong one — it builds an object (and an `Object.fromEntries`) per call, which
 * at 60 fps is garbage the avatar does not need to make.
 *
 * The counter only ever increments, so a payload rebuilt to an identical shape
 * still forces a re-plan. That is the safe direction: re-planning too often
 * costs work, re-planning too late shows the wrong performance.
 */
function createRevisionSignal(adapter: Hyper3dLiveSpeechAdapter): () => number {
  let revision = 0;
  let lastPayload: unknown = null;
  let lastFrameCount = -1;
  return () => {
    const payload = adapter.getPayload();
    const frameCount = adapter.getAcousticFrames().length;
    if (payload !== lastPayload || frameCount !== lastFrameCount) {
      lastPayload = payload;
      lastFrameCount = frameCount;
      revision += 1;
    }
    return revision;
  };
}

/** The engine's input contract, read off the live adapter. */
export function hyper3dLiveInputsFromAdapter(
  adapter: Hyper3dLiveSpeechAdapter,
): Hyper3dLiveInputs {
  return {
    shouldCaptureReviewFrame: () => adapter.shouldCaptureReviewFrame(),
    noteControllerCreated: () => adapter.noteControllerCreated(),
    recordReviewFrame: (frame) => adapter.recordEngineFrame(frame),
    recordLipSyncFrame: (trace) => adapter.recordLipSyncFrame(trace),
    getPayload: () => adapter.getPayload(),
    getAcousticFrames: () => adapter.getAcousticFrames(),
    getRevision: createRevisionSignal(adapter),
    getSentencePlans: () => adapter.getSentencePlans(),
    resolveSentencePlanAt: (time) => adapter.resolveSentencePlanAt(time),
    freezeSentencePlans: () => adapter.freezeSentencePlans(),
    getSentencePlannerStats: () => adapter.getSentencePlannerStats(),
    noteSentencePlanConsumed: (index, revision) =>
      adapter.noteSentencePlanConsumed(index, revision),
  };
}

/**
 * Register the ported engine for this session's adapter.
 *
 * MUST run before `Hyper3DImperativeHost` mounts. React runs child effects
 * before parent effects, and the host asks the registry SYNCHRONOUSLY inside its
 * own mount effect — so registering from an `ActiveSession` effect would always
 * lose the race and report `engine-missing` on the first mount. The call site
 * therefore runs during `ActiveSession`'s render, beside the adapter's own lazy
 * init, which is ordered before any child renders or mounts.
 *
 * Idempotent: re-registering replaces the factory with one closed over the same
 * adapter, which is why StrictMode's double render is harmless.
 */
export function registerHyper3dLiveEngine(adapter: Hyper3dLiveSpeechAdapter): void {
  const live = hyper3dLiveInputsFromAdapter(adapter);
  registerHyper3dPlaybackClock(() => adapter.getPlaybackTime());

  /**
   * THE ENGINE ITSELF IS LOADED ON DEMAND, and this shim is why the registration
   * can be unconditional.
   *
   * `hyper3dEngineFactory` pulls in the whole accepted runtime plus `GLTFLoader`.
   * Imported statically it lands in the `ActiveSession` chunk and every session
   * downloads it — including every session with the flag OFF, which is all of
   * them today. That is a real cost for code that would never run.
   *
   * The registry contract only requires a FUNCTION to be present synchronously;
   * the host already `await`s the result. So the registered function is this
   * thin wrapper, and the engine is fetched the first time the host actually
   * initializes — which only happens with the flag on. A failed chunk fetch
   * rejects here and the seam falls back exactly as any other init failure does.
   */
  registerHyper3dEngineFactory(async (init) => {
    // Phase 2G.1C: the engine CHUNK's own fetch and evaluate, which precedes the
    // GLB and has never been separated from it. Two stamps around an await that
    // already existed.
    const requestedAtMs = Math.round(globalThis.performance.now());
    recordHyper3dAssetTimeline({
      engineFactoryRequestedAtMs: requestedAtMs,
      engineModuleImportStartedAtMs: requestedAtMs,
    });
    const { createHyper3dEngineFactory } = await import("./hyper3dEngineFactory");
    recordHyper3dAssetTimeline({
      engineModuleImportCompletedAtMs: Math.round(globalThis.performance.now()),
    });
    return createHyper3dEngineFactory(live)(init);
  });

  /**
   * Phase 2G.1C — the render loop's READ-ONLY window onto the audio clocks.
   *
   * The capture has to answer "what was the audio doing during that gap?", and
   * the host holds no audio reference by design. This hands the DEV diagnostics
   * a pure getter over values the adapter already computes. It is registered
   * here because this is the one module that has the adapter and is already the
   * adapter-to-engine shim; nothing but the DEV capture reads it.
   */
  registerHyper3dAudioProbe(() => adapter.getAudioClocks());

  // Phase 2G.1C: publishes the DEV read-back functions. `import.meta.env.DEV` is
  // statically replaced, so a production build drops this branch and never emits
  // the report module at all.
  if (import.meta.env.DEV === true) {
    void import("./hyper3dStartupReport")
      .then((module) => module.installHyper3dStartupReport())
      .catch(() => {
        /* a diagnostics surface must never break a session */
      });
    // The normal-reply read-back. It needs the adapter only to refresh the
    // capture's acoustic frames at export time, which is a copy, not a decision.
    void import("./hyper3dReplyReport")
      .then((module) =>
        module.installHyper3dReplyReport(() => adapter.refreshDiagnosticsAcoustics()),
      )
      .catch(() => {
        /* a diagnostics surface must never break a session */
      });
  }

  recordHyper3dPath({ factoryRegistered: true }, "engine factory registered from the live adapter");
}
