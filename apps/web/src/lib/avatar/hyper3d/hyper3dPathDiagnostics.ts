/**
 * HYPER3D RESOLUTION-PATH DIAGNOSTICS — DEV ONLY.
 *
 * "The old avatar is on screen" has eight possible causes and they are not
 * distinguishable by looking at the picture: the flag never reached the bundle,
 * the dev server was not restarted, no factory was registered, the GLB 404'd,
 * the GLB parsed but failed a binding check, the controller threw, the first
 * frame threw, or the context was lost. Each of those ends the same way — the
 * seam latches and the existing Solace avatar renders.
 *
 * So each step records what it actually did, here, and the whole path can be
 * read back in one object:
 *
 *     window.__solaceHyper3dPath
 *
 * This module is inert in production builds (`publish` is a no-op) and holds no
 * reference to anything it records, so it cannot keep a scene, a renderer or a
 * texture alive. It makes no decisions — every value is written by the code that
 * already took the decision.
 */

const DEV = Boolean(import.meta.env?.DEV);

export type Hyper3dPathBranch = "pending" | "hyper3d" | "existing-solace-avatar";

export type Hyper3dPathPhase =
  | "not-started"
  | "glb-fetch"
  | "gltf-parse"
  | "morph-validation"
  | "bone-validation"
  | "material-setup"
  | "eye-adapter"
  | "teeth-jaw"
  | "controller-init"
  | "frame-evaluation"
  | "webgl-context"
  | "complete";

export type Hyper3dPathReport = {
  /** The raw `import.meta.env` string, exactly as the bundle received it. */
  flagRawValue: string | null;
  flagResolved: boolean;
  selectedBranch: Hyper3dPathBranch;
  factoryRegistered: boolean;
  initAttempted: boolean;
  /** `/avatars/female_2291.glb` — attempted / succeeded. */
  productionAssetAttempted: boolean;
  productionAssetLoaded: boolean;
  /** `/avatars/female_229.glb` — the fallback asset inside the engine. */
  legacyAssetAttempted: boolean;
  legacyAssetLoaded: boolean;
  assetUrl: string | null;
  /** How far initialization got before it either finished or threw. */
  furthestPhase: Hyper3dPathPhase;
  failedPhase: Hyper3dPathPhase | null;
  validationPassed: boolean | null;
  fellBackToSolaceAvatar: boolean;
  fallbackReason: string | null;
  /** The host's own stage label, when the host is what failed. */
  hostFailureStage: string | null;
  framesRendered: number;
  /** Everything notable, in order, with timestamps. */
  events: Array<{ atMs: number; note: string }>;
  /** Phase 2G.1B: live loop counters for the CURRENTLY mounted host. DEV only. */
  loop: Hyper3dLoopDiagnostics;
  /**
   * Phase 2G.1C: the GLB startup timeline, which outlives a host remount and so
   * does NOT live in `loop` (which resets with each host).
   */
  assetTimeline: Hyper3dAssetTimeline;
  /**
   * Phase 2G.1C: what the WELCOME turn did around the startup window, recorded
   * so the three architecture-audit risks can be checked against THIS
   * reproduction instead of argued from the architecture.
   */
  welcomeStartup: Hyper3dWelcomeStartup;
};

/**
 * Phase 2G.1C — the welcome turn's own startup facts. OBSERVATION ONLY: nothing
 * here is read by any scheduling, association or rendering decision.
 */
export type Hyper3dWelcomeStartup = {
  /** B2 — the reorder-buffer reset the special welcome release performs. */
  releaseResetAtMs: number | null;
  releaseResetReason: string | null;
  /** The first welcome chunk Hyper3D was handed, at `onChunkScheduled`. */
  firstChunkScheduledAtMs: number | null;
  /** `chunk.scheduledAtMs` — when the SCHEDULER handed it over. */
  firstChunkHandoffAtMs: number | null;
  /** B1 — was `avatar_data` on the queue item at the moment of the handoff? */
  firstChunkHadAvatarData: boolean | null;
  firstChunkRawPhonemeFormat: string | null;
  firstChunkTimedPhonemeCount: number | null;
  firstChunkAppendResult: string | null;
  firstChunkAudioContextStartTime: number | null;
  audioContextTimeAtFirstSchedule: number | null;
  /** `audioContextStartTime − currentTime` at the handoff, ms. Negative = late. */
  firstChunkLeadMs: number | null;
  responseOriginContextTime: number | null;
  /**
   * B1 — `avatar_data` attached to an item that had ALREADY been scheduled, so
   * Hyper3D's `onChunkScheduled` had already run against the un-repaired item.
   */
  lateAvatarDataAfterScheduleCount: number;
  lateAvatarDataAfterScheduleAtMs: number[];
  /** The first render frame that observed AUDIBLE welcome audio. */
  firstAudibleFrameAtMs: number | null;
  firstAudibleResponseClock: number | null;
};

/**
 * Phase 2G.1C — the avatar startup interval, split as far as GLTFLoader permits
 * WITHOUT modifying the loader. See `boundaryNote` for what each stamp means and
 * where the split is genuinely unavailable.
 */
export type Hyper3dAssetTimeline = {
  url: string | null;
  /** The React host's mount effect — the first instant the avatar exists at all. */
  hostMountedAtMs: number | null;
  /** The registered factory wrapper was CALLED: the host asked for an engine. */
  engineFactoryRequestedAtMs: number | null;
  /** `import("./hyper3dEngineFactory")` — the engine CHUNK, not the GLB. */
  engineModuleImportStartedAtMs: number | null;
  engineModuleImportCompletedAtMs: number | null;
  /** Immediately before `loader.load(...)` is called. */
  loadStartedAtMs: number | null;
  /** The LAST `onProgress` event GLTFLoader delivered (network read progress). */
  lastProgressAtMs: number | null;
  progressLoaded: number | null;
  progressTotal: number | null;
  progressEvents: number;
  /** `onLoad` — parse AND dependent image/texture decode are already finished. */
  loaderOnLoadAtMs: number | null;
  /** After Solace's own binding checks passed. */
  bindingValidatedAtMs: number | null;
  /** After engine setup finished and the handle was returned. */
  engineReadyAtMs: number | null;
  /** Entry of the host's FIRST rAF tick that did real work. */
  firstTickAtMs: number | null;
  /** Immediately after the first `renderer.render(...)` returned. */
  firstRenderCompletedAtMs: number | null;
  /**
   * `PerformanceResourceTiming` for the GLB — the authoritative network boundary,
   * read from the browser rather than inferred.
   */
  resourceTiming: {
    startTime: number;
    requestStart: number;
    responseStart: number;
    responseEnd: number;
    duration: number;
    transferSize: number | null;
    encodedBodySize: number | null;
    decodedBodySize: number | null;
  } | null;
  boundaryNote: string;
};

/** Phase 2G.1C — one fully split frame. All stamps come from `performance.now()`. */
export type Hyper3dFrameTiming = {
  frame: number;
  tickEntryMs: number;
  rawDeltaMs: number;
  /** `tickEntry[n] − tickEnd[n−1]`. null on the first timed frame. */
  outsideTickMs: number | null;
  /** `tickEnd[n] − tickEntry[n]`, where tickEnd is immediately after render. */
  inTickMs: number | null;
  engineUpdateMs: number | null;
  rendererRenderMs: number | null;
  /** inTick − engineUpdate − rendererRender: context setup and the counters. */
  otherInTickMs: number | null;
  engineOrchestratorMs: number | null;
  engineMorphWriteMs: number | null;
  /** engineUpdate − orchestrator − morphWrite: plan rebuild, trace, eyes, bones. */
  engineOtherMs: number | null;
  /**
   * `rawDeltaMs − (inTickMs[n−1] + outsideTickMs[n])`. These boundaries are
   * adjacent by construction, so this is float noise (~0) or the split is wrong.
   */
  selfCheckResidualMs: number | null;
  documentVisibilityState: string;
  documentHasFocus: boolean;
  /**
   * `AudioContext.currentTime` and the response clock, read at TICK ENTRY — the
   * END of the gap this frame's `rawDeltaMs` measures. Null when no audio probe
   * is registered (no session) or the response has no origin yet.
   */
  audioContextTime: number | null;
  responseClockSeconds: number | null;
};

export type Hyper3dLongTask = {
  startTime: number;
  duration: number;
  name: string;
  attribution: Array<{
    name: string;
    entryType: string;
    containerType: string;
    containerName: string;
    containerId: string;
    containerSrc: string;
  }>;
};

export type Hyper3dRendererSnapshot = {
  frame: number;
  atMs: number;
  programs: number | null;
  calls: number | null;
  triangles: number | null;
  lines: number | null;
  points: number | null;
  geometries: number | null;
  textures: number | null;
};

export type Hyper3dLoopSample = {
  performanceNow: number;
  rawDeltaMs: number;
  clampedDeltaSeconds: number;
  documentVisibilityState: string;
  documentHidden: boolean;
  documentHasFocus: boolean;
  engineStatus: string;
  audioContextTime: number | null;
  responseClockSeconds: number | null;
};

export type Hyper3dLoopGap = {
  gapStartPerformanceNow: number;
  gapEndPerformanceNow: number;
  rawDeltaMs: number;
  visibilityBefore: string;
  visibilityAfter: string;
  focusBefore: boolean;
  focusAfter: boolean;
  /** Read at the gap's END — the tick that finally ran. */
  audioContextTimeAtGapEnd: number | null;
  responseClockAtGapEnd: number | null;
};

export type Hyper3dLoopDiagnostics = {
  hostStartedAtMs: number | null;
  /** Counted at each independent stage, so a collapse can be located. */
  rafCallbackCount: number;
  engineUpdateCount: number;
  renderCount: number;
  orchestratorFrameCount: number;
  recordLipSyncFrameCalls: number;
  appendAttempts: number;
  appendSuccesses: number;
  appendSkips: {
    noChunk: number;
    noOrigin: number;
    notAudioActive: number;
    bufferFull: number;
    turnMismatch: number;
    other: number;
  };
  largestRawDeltaMs: number;
  largestGap: Hyper3dLoopGap | null;
  gapsOver100ms: number;
  gapsOver250ms: number;
  gapsOver500ms: number;
  gapsOver1000ms: number;
  longGaps: Hyper3dLoopGap[];
  samples: Hyper3dLoopSample[];
  /** Main-thread heartbeat (setInterval), independent of requestAnimationFrame. */
  heartbeat: {
    running: boolean;
    intervalMs: number;
    ticks: number;
    maxGapMs: number;
    gapsOver250ms: number;
    gapsOver1000ms: number;
    lastTickAtMs: number | null;
  };
  /** visibilitychange / focus / blur / pagehide / pageshow, observed only. */
  visibilityEvents: Array<{
    atMs: number;
    type: string;
    visibilityState: string;
    hasFocus: boolean;
    rafCallbackCountAt: number;
  }>;
  /** Phase 2G.1C: where each frame's wall time actually went. */
  timing: {
    /** Detail is kept for every frame up to this index … */
    detailedFrameLimit: number;
    /** … and, past it, only for frames that were slow. Both share one bound. */
    slowFrameThresholdMs: number;
    frames: Hyper3dFrameTiming[];
    framesTimed: number;
    maxInTickMs: number;
    maxOutsideTickMs: number;
    maxEngineUpdateMs: number;
    maxRendererRenderMs: number;
    maxOtherInTickMs: number;
    maxEngineOrchestratorMs: number;
    maxEngineMorphWriteMs: number;
    sumInTickMs: number;
    sumOutsideTickMs: number;
    inTickOver100ms: number;
    outsideTickOver100ms: number;
    /** The worst residual seen. Anything non-trivial invalidates the split. */
    maxSelfCheckResidualMs: number;
    boundaries: string;
  };
  /**
   * Phase 2G.1C: `longtask` entries. `supported` and `observing` are recorded so
   * that an EMPTY list can be read correctly — absence of entries means nothing
   * unless the observer was actually delivering.
   */
  longTasks: {
    supported: boolean;
    observing: boolean;
    buffered: boolean;
    error: string | null;
    observedCount: number;
    entries: Hyper3dLongTask[];
  };
  /** Phase 2G.1C: `renderer.info` for the first frames. Correlation only. */
  rendererSnapshots: Hyper3dRendererSnapshot[];
};

const MAX_LOOP_SAMPLES = 300;
const MAX_LONG_GAPS = 40;
const MAX_VISIBILITY_EVENTS = 40;
/** Phase 2G.1C bounds. Every one of these lists is a fixed-size ring. */
const DETAILED_FRAME_LIMIT = 24;
const SLOW_FRAME_THRESHOLD_MS = 100;
const MAX_FRAME_TIMINGS = 72;
const MAX_LONG_TASKS = 60;
const MAX_RENDERER_SNAPSHOTS = 10;

// These two notes travel WITH the capture so its limits cannot be read off. They
// are also the only long literals here, so they are gated on the statically
// replaced `import.meta.env.DEV` and fold away entirely in a production build —
// the module's own `DEV` uses optional chaining and cannot be eliminated.
const TIMING_BOUNDARIES = import.meta.env.DEV !== true ? "" :
  "tickEntry = performance.now() at the top of the rAF tick body; " +
  "tickEnd = performance.now() immediately after renderer.render() returned. " +
  "inTickMs = tickEnd − tickEntry. outsideTickMs = tickEntry[n] − tickEnd[n−1], " +
  "so it INCLUDES the DEV diagnostics tail of the previous tick (sub-ms) plus all " +
  "non-tick main-thread work and any time the thread was not running. " +
  "rawDeltaMs = tickEntry[n] − tickEntry[n−1] = inTickMs[n−1] + outsideTickMs[n] " +
  "exactly, which selfCheckResidualMs verifies. engineUpdateMs and rendererRenderMs " +
  "are nested inside inTickMs; orchestrator/morphWrite are nested inside engineUpdateMs.";

const ASSET_BOUNDARY_NOTE = import.meta.env.DEV !== true ? "" :
  "GLTFLoader.load() exposes onProgress (network read) and onLoad (parse AND " +
  "dependent image/texture decode already complete). It does NOT expose the exact " +
  "instant parsing begins, and that is not instrumentable without modifying the " +
  "loader, so fetch-vs-parse is bounded by lastProgressAtMs/resourceTiming.responseEnd " +
  "on one side and loaderOnLoadAtMs on the other, not split precisely. GPU upload and " +
  "shader compilation are in NEITHER interval: they happen at the first draw call.";

function createLoopDiagnostics(): Hyper3dLoopDiagnostics {
  return {
    hostStartedAtMs: null,
    rafCallbackCount: 0,
    engineUpdateCount: 0,
    renderCount: 0,
    orchestratorFrameCount: 0,
    recordLipSyncFrameCalls: 0,
    appendAttempts: 0,
    appendSuccesses: 0,
    appendSkips: { noChunk: 0, noOrigin: 0, notAudioActive: 0, bufferFull: 0, turnMismatch: 0, other: 0 },
    largestRawDeltaMs: 0,
    largestGap: null,
    gapsOver100ms: 0,
    gapsOver250ms: 0,
    gapsOver500ms: 0,
    gapsOver1000ms: 0,
    longGaps: [],
    samples: [],
    heartbeat: {
      running: false,
      intervalMs: 100,
      ticks: 0,
      maxGapMs: 0,
      gapsOver250ms: 0,
      gapsOver1000ms: 0,
      lastTickAtMs: null,
    },
    visibilityEvents: [],
    timing: {
      detailedFrameLimit: DETAILED_FRAME_LIMIT,
      slowFrameThresholdMs: SLOW_FRAME_THRESHOLD_MS,
      frames: [],
      framesTimed: 0,
      maxInTickMs: 0,
      maxOutsideTickMs: 0,
      maxEngineUpdateMs: 0,
      maxRendererRenderMs: 0,
      maxOtherInTickMs: 0,
      maxEngineOrchestratorMs: 0,
      maxEngineMorphWriteMs: 0,
      sumInTickMs: 0,
      sumOutsideTickMs: 0,
      inTickOver100ms: 0,
      outsideTickOver100ms: 0,
      maxSelfCheckResidualMs: 0,
      boundaries: TIMING_BOUNDARIES,
    },
    longTasks: {
      supported: false,
      observing: false,
      buffered: false,
      error: null,
      observedCount: 0,
      entries: [],
    },
    rendererSnapshots: [],
  };
}

function createWelcomeStartup(): Hyper3dWelcomeStartup {
  return {
    releaseResetAtMs: null,
    releaseResetReason: null,
    firstChunkScheduledAtMs: null,
    firstChunkHandoffAtMs: null,
    firstChunkHadAvatarData: null,
    firstChunkRawPhonemeFormat: null,
    firstChunkTimedPhonemeCount: null,
    firstChunkAppendResult: null,
    firstChunkAudioContextStartTime: null,
    audioContextTimeAtFirstSchedule: null,
    firstChunkLeadMs: null,
    responseOriginContextTime: null,
    lateAvatarDataAfterScheduleCount: 0,
    lateAvatarDataAfterScheduleAtMs: [],
    firstAudibleFrameAtMs: null,
    firstAudibleResponseClock: null,
  };
}

function createAssetTimeline(): Hyper3dAssetTimeline {
  return {
    url: null,
    hostMountedAtMs: null,
    engineFactoryRequestedAtMs: null,
    engineModuleImportStartedAtMs: null,
    engineModuleImportCompletedAtMs: null,
    loadStartedAtMs: null,
    lastProgressAtMs: null,
    progressLoaded: null,
    progressTotal: null,
    progressEvents: 0,
    loaderOnLoadAtMs: null,
    bindingValidatedAtMs: null,
    engineReadyAtMs: null,
    firstTickAtMs: null,
    firstRenderCompletedAtMs: null,
    resourceTiming: null,
    boundaryNote: ASSET_BOUNDARY_NOTE,
  };
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Phase 2G.1C — a READ-ONLY window onto the two audio clocks, so the render
 * loop can be correlated with audio without the host importing anything from
 * the audio or adapter layers. The probe is registered by the live-engine
 * binding, which already holds the adapter; it is called at most once per frame
 * and nothing it returns influences rendering, scheduling or timing.
 */
export type Hyper3dAudioProbe = () => {
  contextTime: number | null;
  responseClock: number | null;
};

let audioProbe: Hyper3dAudioProbe | null = null;

export function registerHyper3dAudioProbe(probe: Hyper3dAudioProbe | null): void {
  if (!DEV) return;
  audioProbe = probe;
}

const NO_AUDIO = { contextTime: null, responseClock: null };

function readAudioProbe(): { contextTime: number | null; responseClock: number | null } {
  if (!audioProbe) return NO_AUDIO;
  try {
    return audioProbe();
  } catch {
    // A diagnostics read must never be able to break a frame.
    return NO_AUDIO;
  }
}

const visibilityState = (): string =>
  typeof document === "undefined" ? "unavailable" : document.visibilityState;
const documentHidden = (): boolean => (typeof document === "undefined" ? false : document.hidden);
const documentHasFocus = (): boolean => {
  if (typeof document === "undefined" || typeof document.hasFocus !== "function") return false;
  try {
    return document.hasFocus();
  } catch {
    return false;
  }
};

const report: Hyper3dPathReport = {
  flagRawValue: null,
  flagResolved: false,
  selectedBranch: "pending",
  factoryRegistered: false,
  initAttempted: false,
  productionAssetAttempted: false,
  productionAssetLoaded: false,
  legacyAssetAttempted: false,
  legacyAssetLoaded: false,
  assetUrl: null,
  furthestPhase: "not-started",
  failedPhase: null,
  validationPassed: null,
  fellBackToSolaceAvatar: false,
  fallbackReason: null,
  hostFailureStage: null,
  framesRendered: 0,
  events: [],
  loop: createLoopDiagnostics(),
  assetTimeline: createAssetTimeline(),
  welcomeStartup: createWelcomeStartup(),
};

const PHASE_ORDER: readonly Hyper3dPathPhase[] = [
  "not-started",
  "webgl-context",
  "glb-fetch",
  "gltf-parse",
  "morph-validation",
  "bone-validation",
  "material-setup",
  "eye-adapter",
  "teeth-jaw",
  "controller-init",
  "frame-evaluation",
  "complete",
];

function publish() {
  if (!DEV || typeof window === "undefined") return;
  (window as unknown as Record<string, unknown>).__solaceHyper3dPath = report;
}

/** Record a step. Every field is optional; only what is passed is written. */
export function recordHyper3dPath(patch: Partial<Hyper3dPathReport>, note?: string): void {
  Object.assign(report, patch);
  if (note) {
    report.events.push({ atMs: Math.round(performance.now()), note });
    // Bounded: a pathological retry loop must not grow this without limit.
    if (report.events.length > 64) report.events.shift();
  }
  publish();
}

/**
 * Advance the phase marker. Monotonic — a later call with an EARLIER phase does
 * not rewind `furthestPhase`, so the record shows how far init actually got even
 * after the failure path runs its own cleanup.
 */
export function markHyper3dPhase(phase: Hyper3dPathPhase): void {
  if (PHASE_ORDER.indexOf(phase) > PHASE_ORDER.indexOf(report.furthestPhase)) {
    report.furthestPhase = phase;
  }
  publish();
}

/** The phase marker at the moment of a throw — the first real failure reason. */
export function failHyper3dPhase(phase: Hyper3dPathPhase, note: string): void {
  if (!report.failedPhase) report.failedPhase = phase;
  recordHyper3dPath({}, `FAILED at ${phase}: ${note}`);
}

export function countHyper3dFrame(): void {
  report.framesRendered += 1;
  // Only the first frame matters for "did it ever draw"; after that this is a
  // counter read on demand, so republishing every frame would be pure waste.
  if (report.framesRendered === 1) {
    markHyper3dPhase("complete");
    // Called immediately after `renderer.render(...)` returned, so this is the
    // real end of the first draw — GPU upload and shader compile included.
    report.assetTimeline.firstRenderCompletedAtMs = Math.round(performance.now());
    recordHyper3dPath({}, "first frame rendered");
  }
}

export function getHyper3dPathReport(): Readonly<Hyper3dPathReport> {
  return report;
}

// ── Phase 2G.1B loop diagnostics ────────────────────────────────────────────
// Counters only. No logging, no allocation on the steady path beyond one bounded
// ring slot per frame, and nothing here influences rendering or timing.

/** A newly mounted host owns the counters, so they describe ONE host. */
export function resetHyper3dLoopDiagnostics(): void {
  if (!DEV) return;
  report.loop = createLoopDiagnostics();
  report.loop.hostStartedAtMs = Math.round(performance.now());
  // Phase 2G.1C: the per-frame split carries state between ticks, so a new host
  // must not inherit the previous one's open frame.
  pendingTiming = null;
  pendingTimingKept = false;
  pendingEngineSpans = null;
  lastInTickRawMs = null;
  timedFrameIndex = 0;
  publish();
}

export function countHyper3dRafCallback(): void {
  if (!DEV) return;
  report.loop.rafCallbackCount += 1;
}

export function countHyper3dEngineUpdate(): void {
  if (!DEV) return;
  report.loop.engineUpdateCount += 1;
}

export function countHyper3dRender(): void {
  if (!DEV) return;
  report.loop.renderCount += 1;
}

export function countHyper3dOrchestratorFrame(): void {
  if (!DEV) return;
  report.loop.orchestratorFrameCount += 1;
}

export type Hyper3dRecorderSkipReason = keyof Hyper3dLoopDiagnostics["appendSkips"];

export function countHyper3dRecorderCall(): void {
  if (!DEV) return;
  report.loop.recordLipSyncFrameCalls += 1;
}

export function countHyper3dAppendAttempt(): void {
  if (!DEV) return;
  report.loop.appendAttempts += 1;
}

export function countHyper3dAppendSuccess(): void {
  if (!DEV) return;
  report.loop.appendSuccesses += 1;
}

export function countHyper3dAppendSkip(reason: Hyper3dRecorderSkipReason): void {
  if (!DEV) return;
  report.loop.appendSkips[reason] += 1;
}

/**
 * One host frame. `rawDeltaMs` is the UNCLAMPED gap; the host's own
 * `Math.min(0.1, …)` clamp is untouched and passed in as `clampedDeltaSeconds`.
 */
export function recordHyper3dLoopFrame(sample: {
  performanceNow: number;
  rawDeltaMs: number;
  clampedDeltaSeconds: number;
  engineStatus: string;
  /** Phase 2G.1C: `tickEntry[n] − tickEnd[n−1]`, null on the first timed frame. */
  outsideTickMs?: number | null;
}): void {
  if (!DEV) return;
  const loop = report.loop;
  const visibility = visibilityState();
  const hasFocus = documentHasFocus();
  // ONE probe read per frame, shared by the sample, the frame split and any gap.
  const audio = readAudioProbe();
  openFrameTiming(sample, visibility, hasFocus, audio);
  const entry: Hyper3dLoopSample = {
    performanceNow: Math.round(sample.performanceNow),
    rawDeltaMs: Math.round(sample.rawDeltaMs * 100) / 100,
    clampedDeltaSeconds: sample.clampedDeltaSeconds,
    documentVisibilityState: visibility,
    documentHidden: documentHidden(),
    documentHasFocus: hasFocus,
    engineStatus: sample.engineStatus,
    audioContextTime: audio.contextTime,
    responseClockSeconds: audio.responseClock,
  };
  loop.samples.push(entry);
  if (loop.samples.length > MAX_LOOP_SAMPLES) loop.samples.shift();

  if (sample.rawDeltaMs > loop.largestRawDeltaMs) loop.largestRawDeltaMs = entry.rawDeltaMs;
  if (sample.rawDeltaMs > 100) {
    loop.gapsOver100ms += 1;
    if (sample.rawDeltaMs > 250) loop.gapsOver250ms += 1;
    if (sample.rawDeltaMs > 500) loop.gapsOver500ms += 1;
    if (sample.rawDeltaMs > 1000) loop.gapsOver1000ms += 1;
    const previous = loop.samples[loop.samples.length - 2];
    const gap: Hyper3dLoopGap = {
      gapStartPerformanceNow: Math.round(sample.performanceNow - sample.rawDeltaMs),
      gapEndPerformanceNow: entry.performanceNow,
      rawDeltaMs: entry.rawDeltaMs,
      visibilityBefore: previous?.documentVisibilityState ?? "unknown",
      visibilityAfter: visibility,
      focusBefore: previous?.documentHasFocus ?? false,
      focusAfter: hasFocus,
      audioContextTimeAtGapEnd: audio.contextTime,
      responseClockAtGapEnd: audio.responseClock,
    };
    loop.longGaps.push(gap);
    if (loop.longGaps.length > MAX_LONG_GAPS) loop.longGaps.shift();
    if (!loop.largestGap || gap.rawDeltaMs > loop.largestGap.rawDeltaMs) loop.largestGap = gap;
  }
}

// ── Phase 2G.1C frame split ─────────────────────────────────────────────────
// One frame is opened at the top of the tick (when only `rawDeltaMs` and
// `outsideTickMs` are knowable) and closed after the render (when the in-tick
// spans are). Nothing here decides anything; every number is measured by the
// code that already ran the work.

let pendingTiming: Hyper3dFrameTiming | null = null;
let pendingTimingKept = false;
let pendingEngineSpans: { orchestratorMs: number; morphWriteMs: number } | null = null;
/** Unrounded, so the self-check measures the split and not the rounding. */
let lastInTickRawMs: number | null = null;
let timedFrameIndex = 0;

function keepFrameTiming(timing: Hyper3dFrameTiming): void {
  const frames = report.loop.timing.frames;
  frames.push(timing);
  if (frames.length > MAX_FRAME_TIMINGS) frames.shift();
}

function openFrameTiming(
  sample: { performanceNow: number; rawDeltaMs: number; outsideTickMs?: number | null },
  visibility: string,
  hasFocus: boolean,
  audio: { contextTime: number | null; responseClock: number | null },
): void {
  const timing = report.loop.timing;
  timedFrameIndex += 1;
  if (report.assetTimeline.firstTickAtMs === null) {
    report.assetTimeline.firstTickAtMs = Math.round(sample.performanceNow);
  }
  const outside = sample.outsideTickMs ?? null;
  const residual =
    outside !== null && lastInTickRawMs !== null
      ? sample.rawDeltaMs - (lastInTickRawMs + outside)
      : null;
  const entry: Hyper3dFrameTiming = {
    frame: timedFrameIndex,
    tickEntryMs: round2(sample.performanceNow),
    rawDeltaMs: round2(sample.rawDeltaMs),
    outsideTickMs: outside === null ? null : round2(outside),
    inTickMs: null,
    engineUpdateMs: null,
    rendererRenderMs: null,
    otherInTickMs: null,
    engineOrchestratorMs: null,
    engineMorphWriteMs: null,
    engineOtherMs: null,
    selfCheckResidualMs: residual === null ? null : round2(residual),
    documentVisibilityState: visibility,
    documentHasFocus: hasFocus,
    audioContextTime: audio.contextTime,
    responseClockSeconds: audio.responseClock,
  };
  if (outside !== null) {
    timing.sumOutsideTickMs = round2(timing.sumOutsideTickMs + outside);
    if (outside > timing.maxOutsideTickMs) timing.maxOutsideTickMs = round2(outside);
    if (outside > SLOW_FRAME_THRESHOLD_MS) timing.outsideTickOver100ms += 1;
  }
  if (residual !== null && Math.abs(residual) > timing.maxSelfCheckResidualMs) {
    timing.maxSelfCheckResidualMs = round2(Math.abs(residual));
  }
  pendingTiming = entry;
  pendingEngineSpans = null;
  // Keep every early frame, and any frame already known to be slow. A frame that
  // only turns out to be slow INSIDE the tick is kept when it closes.
  pendingTimingKept =
    timedFrameIndex <= DETAILED_FRAME_LIMIT || sample.rawDeltaMs > SLOW_FRAME_THRESHOLD_MS;
  if (pendingTimingKept) keepFrameTiming(entry);
}

/**
 * Phase 2G.1C — the in-tick spans, recorded after the render returned. A tick
 * that throws never calls this, so its entry keeps `inTickMs: null` rather than
 * quietly reporting a shorter frame.
 */
export function finishHyper3dLoopFrame(detail: {
  inTickMs: number;
  engineUpdateMs: number;
  rendererRenderMs: number;
}): void {
  if (!DEV) return;
  const entry = pendingTiming;
  lastInTickRawMs = detail.inTickMs;
  if (!entry) return;
  pendingTiming = null;

  const other = detail.inTickMs - detail.engineUpdateMs - detail.rendererRenderMs;
  entry.inTickMs = round2(detail.inTickMs);
  entry.engineUpdateMs = round2(detail.engineUpdateMs);
  entry.rendererRenderMs = round2(detail.rendererRenderMs);
  entry.otherInTickMs = round2(other);
  if (pendingEngineSpans) {
    const engineOther =
      detail.engineUpdateMs - pendingEngineSpans.orchestratorMs - pendingEngineSpans.morphWriteMs;
    entry.engineOrchestratorMs = round2(pendingEngineSpans.orchestratorMs);
    entry.engineMorphWriteMs = round2(pendingEngineSpans.morphWriteMs);
    entry.engineOtherMs = round2(engineOther);
    pendingEngineSpans = null;
  }

  const timing = report.loop.timing;
  timing.framesTimed += 1;
  timing.sumInTickMs = round2(timing.sumInTickMs + detail.inTickMs);
  if (detail.inTickMs > timing.maxInTickMs) timing.maxInTickMs = entry.inTickMs;
  if (detail.engineUpdateMs > timing.maxEngineUpdateMs) timing.maxEngineUpdateMs = entry.engineUpdateMs;
  if (detail.rendererRenderMs > timing.maxRendererRenderMs) {
    timing.maxRendererRenderMs = entry.rendererRenderMs;
  }
  if (other > timing.maxOtherInTickMs) timing.maxOtherInTickMs = entry.otherInTickMs ?? 0;
  if ((entry.engineOrchestratorMs ?? 0) > timing.maxEngineOrchestratorMs) {
    timing.maxEngineOrchestratorMs = entry.engineOrchestratorMs ?? 0;
  }
  if ((entry.engineMorphWriteMs ?? 0) > timing.maxEngineMorphWriteMs) {
    timing.maxEngineMorphWriteMs = entry.engineMorphWriteMs ?? 0;
  }
  if (detail.inTickMs > SLOW_FRAME_THRESHOLD_MS) {
    timing.inTickOver100ms += 1;
    if (!pendingTimingKept) keepFrameTiming(entry);
  }
  pendingTimingKept = false;
}

/**
 * Phase 2G.1C — the two spans that already had clean boundaries inside
 * `engine.update`: the orchestrator resolve, and the final GLB morph write.
 * Called once per update, immediately after the write.
 */
export function recordHyper3dEngineSpans(spans: {
  orchestratorMs: number;
  morphWriteMs: number;
}): void {
  if (!DEV) return;
  pendingEngineSpans = spans;
}

/**
 * Phase 2G.1C — `renderer.info` for the first frames. This is CORRELATION data:
 * a growing program count sits next to a slow frame, it does not explain it.
 */
export function recordHyper3dRendererInfo(frame: number, info: unknown): void {
  if (!DEV) return;
  const snapshots = report.loop.rendererSnapshots;
  if (snapshots.length >= MAX_RENDERER_SNAPSHOTS) return;
  const source = info as {
    programs?: { length?: number } | null;
    render?: { calls?: number; triangles?: number; lines?: number; points?: number };
    memory?: { geometries?: number; textures?: number };
  } | null;
  snapshots.push({
    frame,
    atMs: Math.round(performance.now()),
    programs: source?.programs?.length ?? null,
    calls: source?.render?.calls ?? null,
    triangles: source?.render?.triangles ?? null,
    lines: source?.render?.lines ?? null,
    points: source?.render?.points ?? null,
    geometries: source?.memory?.geometries ?? null,
    textures: source?.memory?.textures ?? null,
  });
}

/** Phase 2G.1C — one `longtask` entry, with whatever attribution the browser gave. */
export function recordHyper3dLongTask(entry: PerformanceEntry): void {
  if (!DEV) return;
  const longTasks = report.loop.longTasks;
  longTasks.observedCount += 1;
  const source = entry as PerformanceEntry & {
    attribution?: Array<{
      name?: string;
      entryType?: string;
      containerType?: string;
      containerName?: string;
      containerId?: string;
      containerSrc?: string;
    }>;
  };
  longTasks.entries.push({
    startTime: round2(entry.startTime),
    duration: round2(entry.duration),
    name: entry.name,
    attribution: (source.attribution ?? []).map((item) => ({
      name: item.name ?? "",
      entryType: item.entryType ?? "",
      containerType: item.containerType ?? "",
      containerName: item.containerName ?? "",
      containerId: item.containerId ?? "",
      containerSrc: item.containerSrc ?? "",
    })),
  });
  if (longTasks.entries.length > MAX_LONG_TASKS) longTasks.entries.shift();
}

/** Support and delivery state, so an empty `entries` list can be read honestly. */
export function markHyper3dLongTaskObserver(state: {
  supported: boolean;
  observing: boolean;
  buffered: boolean;
  error: string | null;
}): void {
  if (!DEV) return;
  Object.assign(report.loop.longTasks, state);
  publish();
}

// ── Phase 2G.1C asset timeline ──────────────────────────────────────────────

export function recordHyper3dAssetTimeline(patch: Partial<Hyper3dAssetTimeline>): void {
  Object.assign(report.assetTimeline, patch);
  publish();
}

/** GLTFLoader `onProgress`: network read progress. Counted, never logged. */
export function recordHyper3dAssetProgress(loaded: number, total: number): void {
  const timeline = report.assetTimeline;
  timeline.progressEvents += 1;
  timeline.lastProgressAtMs = Math.round(performance.now());
  timeline.progressLoaded = loaded;
  timeline.progressTotal = total;
}

/**
 * The browser's own network record for the GLB — the authoritative fetch
 * boundary. Read once, after the load resolved, so the entry exists.
 */
export function captureHyper3dAssetResourceTiming(url: string): void {
  if (typeof performance === "undefined" || typeof performance.getEntriesByType !== "function") {
    return;
  }
  try {
    const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const match = entries.filter((entry) => entry.name.includes(url)).pop();
    if (!match) return;
    report.assetTimeline.resourceTiming = {
      startTime: round2(match.startTime),
      requestStart: round2(match.requestStart),
      responseStart: round2(match.responseStart),
      responseEnd: round2(match.responseEnd),
      duration: round2(match.duration),
      transferSize: match.transferSize ?? null,
      encodedBodySize: match.encodedBodySize ?? null,
      decodedBodySize: match.decodedBodySize ?? null,
    };
    publish();
  } catch {
    /* diagnostics must never break a load */
  }
}

/** Phase 2G.1C — welcome-turn startup facts. Merged; never interpreted here. */
export function recordHyper3dWelcomeStartup(patch: Partial<Hyper3dWelcomeStartup>): void {
  if (!DEV) return;
  Object.assign(report.welcomeStartup, patch);
  publish();
}

/**
 * B1 observation: `avatar_data` was attached to a queue item that had already
 * been scheduled, i.e. AFTER Hyper3D's `onChunkScheduled` ran for it.
 */
export function noteHyper3dLateAvatarDataAfterSchedule(): void {
  if (!DEV) return;
  const welcome = report.welcomeStartup;
  welcome.lateAvatarDataAfterScheduleCount += 1;
  welcome.lateAvatarDataAfterScheduleAtMs.push(Math.round(performance.now()));
  if (welcome.lateAvatarDataAfterScheduleAtMs.length > 16) {
    welcome.lateAvatarDataAfterScheduleAtMs.shift();
  }
  publish();
}

/** visibilitychange / focus / blur / pagehide / pageshow. Observation only. */
export function recordHyper3dVisibilityEvent(type: string): void {
  if (!DEV) return;
  const loop = report.loop;
  loop.visibilityEvents.push({
    atMs: Math.round(performance.now()),
    type,
    visibilityState: visibilityState(),
    hasFocus: documentHasFocus(),
    rafCallbackCountAt: loop.rafCallbackCount,
  });
  if (loop.visibilityEvents.length > MAX_VISIBILITY_EVENTS) loop.visibilityEvents.shift();
  publish();
}

/** Main-thread heartbeat tick, driven by a 100 ms timer — never by rAF. */
export function recordHyper3dHeartbeat(actualGapMs: number): void {
  if (!DEV) return;
  const beat = report.loop.heartbeat;
  beat.running = true;
  beat.ticks += 1;
  beat.lastTickAtMs = Math.round(performance.now());
  if (actualGapMs > beat.maxGapMs) beat.maxGapMs = Math.round(actualGapMs);
  if (actualGapMs > 250) beat.gapsOver250ms += 1;
  if (actualGapMs > 1000) beat.gapsOver1000ms += 1;
}

export function markHyper3dHeartbeatStopped(): void {
  if (!DEV) return;
  report.loop.heartbeat.running = false;
}

/** Test-only. Application code never calls this. */
export function __resetHyper3dPathForTests(): void {
  Object.assign(report, {
    flagRawValue: null,
    flagResolved: false,
    selectedBranch: "pending" as Hyper3dPathBranch,
    factoryRegistered: false,
    initAttempted: false,
    productionAssetAttempted: false,
    productionAssetLoaded: false,
    legacyAssetAttempted: false,
    legacyAssetLoaded: false,
    assetUrl: null,
    furthestPhase: "not-started" as Hyper3dPathPhase,
    failedPhase: null,
    validationPassed: null,
    fellBackToSolaceAvatar: false,
    fallbackReason: null,
    hostFailureStage: null,
    framesRendered: 0,
    loop: createLoopDiagnostics(),
    assetTimeline: createAssetTimeline(),
    welcomeStartup: createWelcomeStartup(),
    events: [],
  });
  audioProbe = null;
  pendingTiming = null;
  pendingTimingKept = false;
  pendingEngineSpans = null;
  lastInTickRawMs = null;
  timedFrameIndex = 0;
}
