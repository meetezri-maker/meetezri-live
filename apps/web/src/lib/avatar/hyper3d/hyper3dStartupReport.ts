/**
 * HYPER3D WELCOME-STARTUP REPORT — DEV ONLY. Phase 2G.1C.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 * The facts needed to locate the welcome startup stall are already recorded, but
 * they live in four independent surfaces that were built at different times:
 *
 *     __solaceHyper3dPath              host loop, frame split, long tasks,
 *                                      renderer.info, GLB timeline, welcome
 *                                      startup stamps
 *     __solaceHyper3dWelcomeLipSync    the welcome turn's phonemes and every
 *                                      audible rendered frame
 *     __solaceSessionProtocolTrace     what the socket delivered and what
 *                                      ActiveSession did with it
 *     __solaceHyper3dLiveTiming        the live clock/timeline diagnostics
 *
 * Reading a stall out of those by hand means aligning four clocks by eye, which
 * is how the previous captures ended up with claims nobody could check. This
 * module JOINS them, once, on demand, and prints the exact tables Phase 2G.1C
 * asks for.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IT DOES NOT DO
 * ─────────────────────────────────────────────────────────────────────────────
 * It records nothing and changes nothing. Every value is copied from a surface
 * that was already written by the code that took the decision; this file only
 * arranges and classifies. The classification rules are constants below, stated
 * in the output, so a reader can disagree with a verdict without re-deriving the
 * numbers.
 *
 * It is inert outside DEV: `installHyper3dStartupReport` returns immediately and
 * nothing is published.
 */

import {
  getHyper3dPathReport,
  type Hyper3dFrameTiming,
  type Hyper3dLongTask,
  type Hyper3dRendererSnapshot,
} from "./hyper3dPathDiagnostics";
import type {
  Hyper3dFullFrameRecord,
  Hyper3dWelcomeLipSyncDiagnostics,
} from "./hyper3dLiveSpeechAdapter";
import type { RealtimeTrace } from "../../ezri/realtimeTrace";

const DEV = Boolean(import.meta.env?.DEV);

/**
 * A gap is attributed to one side only when that side owns at least this much of
 * it. Below the threshold on both sides the gap is MIXED and stays unattributed
 * — the alternative is a confident label on a 50/50 split.
 */
const DOMINANCE = 0.6;
/** Section 8's threshold: every startup gap above this is reported. */
const GAP_THRESHOLD_MS = 100;

export type Hyper3dStartupGapClass =
  | "A: PREVIOUS-RENDER-DOMINANT"
  | "B: PREVIOUS-ENGINE-DOMINANT"
  | "C: OUTSIDE-TICK + LONGTASK"
  | "D: OUTSIDE-TICK UNEXPLAINED"
  | "E: MIXED";

export type Hyper3dStartupGap = {
  frame: number;
  gapStartMs: number;
  gapEndMs: number;
  rawDeltaMs: number;
  /** `tickEnd[n−1] − tickEntry[n−1]`, i.e. the PREVIOUS frame's own work. */
  previousInTickMs: number | null;
  /** `tickEntry[n] − tickEnd[n−1]`: everything this loop did not own. */
  outsideAfterPreviousTickMs: number | null;
  previousEngineUpdateMs: number | null;
  previousRendererRenderMs: number | null;
  longTaskOverlapMs: number;
  longTasks: Hyper3dLongTask[];
  programsAtGap: number | null;
  audioContextTimeAtGapEnd: number | null;
  responseClockAtGapEnd: number | null;
  visibility: string;
  hasFocus: boolean;
  classification: Hyper3dStartupGapClass;
  /** Why that class, in one line, from the numbers above. */
  reason: string;
};

export type Hyper3dStartupStep = {
  label: string;
  atMs: number | null;
  /** Milliseconds since the previous step that has a stamp. */
  sincePreviousMs: number | null;
};

export type Hyper3dStartupReport = {
  capturedAtMs: number;
  hyper3dRan: boolean;
  /** Section A. */
  startupTimeline: Hyper3dStartupStep[];
  /** Section B — the first frames, in order. */
  frames: Hyper3dFrameTiming[];
  framesTimed: number;
  /** Section C. */
  gaps: Hyper3dStartupGap[];
  rendererSnapshots: Hyper3dRendererSnapshot[];
  longTasks: {
    supported: boolean;
    observing: boolean;
    buffered: boolean;
    error: string | null;
    observedCount: number;
    entries: Hyper3dLongTask[];
  };
  /** Section D. */
  audio: {
    timedPhonemesPresentAtScheduling: boolean | null;
    rawAvatarDataPresentAtScheduling: boolean | null;
    rawPhonemeFormatAtScheduling: string | null;
    timedPhonemeCountAtScheduling: number | null;
    appendResult: string | null;
    firstPhonemeTimelineTime: number | null;
    lastPhonemeTimelineTime: number | null;
    responseOriginContextTime: number | null;
    firstRenderedResponseClock: number | null;
    lastRenderedResponseClock: number | null;
    totalAudibleDurationSeconds: number | null;
    audibleRenderedFrames: number;
  };
  /** Section E. */
  auditRisks: {
    b1LateMetadataRace: { verdict: Verdict; evidence: string[] };
    b2WelcomeResetRace: { verdict: Verdict; evidence: string[] };
    b3ShowcaseLowerFace: { verdict: Verdict; evidence: string[] };
  };
  /** What this capture CANNOT establish. Travels with the data on purpose. */
  limitations: string[];
};

export type Verdict = "YES" | "NO" | "UNPROVEN";

type WelcomeSurface = Hyper3dWelcomeLipSyncDiagnostics | undefined;

function readWindow<T>(key: string): T | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as Record<string, T | undefined>)[key];
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

function step(label: string, atMs: number | null): Hyper3dStartupStep {
  return { label, atMs, sincePreviousMs: null };
}

/** Fills `sincePreviousMs` against the previous STAMPED step, and orders by time. */
function sequence(steps: Hyper3dStartupStep[]): Hyper3dStartupStep[] {
  const stamped = steps.filter((entry) => entry.atMs !== null);
  const unstamped = steps.filter((entry) => entry.atMs === null);
  stamped.sort((a, b) => (a.atMs as number) - (b.atMs as number));
  let previous: number | null = null;
  for (const entry of stamped) {
    entry.sincePreviousMs = previous === null ? null : round2((entry.atMs as number) - previous);
    previous = entry.atMs as number;
  }
  return [...stamped, ...unstamped];
}

function overlapMs(
  task: Hyper3dLongTask,
  startMs: number,
  endMs: number,
): number {
  const taskEnd = task.startTime + task.duration;
  return Math.max(0, Math.min(endMs, taskEnd) - Math.max(startMs, task.startTime));
}

function classifyGap(gap: Omit<Hyper3dStartupGap, "classification" | "reason">): {
  classification: Hyper3dStartupGapClass;
  reason: string;
} {
  const raw = gap.rawDeltaMs;
  const inTick = gap.previousInTickMs;
  const outside = gap.outsideAfterPreviousTickMs;

  if (inTick === null || outside === null) {
    return {
      classification: "E: MIXED",
      reason:
        "the previous frame's split is missing (the first timed frame, or a tick that threw), so the gap cannot be attributed",
    };
  }

  if (inTick / raw >= DOMINANCE) {
    const engine = gap.previousEngineUpdateMs ?? 0;
    const render = gap.previousRendererRenderMs ?? 0;
    if (render / inTick >= DOMINANCE) {
      return {
        classification: "A: PREVIOUS-RENDER-DOMINANT",
        reason: `previous tick owned ${round2((inTick / raw) * 100)}% of the gap and renderer.render owned ${round2((render / inTick) * 100)}% of that tick`,
      };
    }
    if (engine / inTick >= DOMINANCE) {
      return {
        classification: "B: PREVIOUS-ENGINE-DOMINANT",
        reason: `previous tick owned ${round2((inTick / raw) * 100)}% of the gap and engine.update owned ${round2((engine / inTick) * 100)}% of that tick`,
      };
    }
    return {
      classification: "E: MIXED",
      reason: `previous tick owned ${round2((inTick / raw) * 100)}% of the gap but neither engine.update (${round2(engine)} ms) nor renderer.render (${round2(render)} ms) dominated it`,
    };
  }

  if (outside / raw >= DOMINANCE) {
    if (gap.longTaskOverlapMs > 0) {
      return {
        classification: "C: OUTSIDE-TICK + LONGTASK",
        reason: `${round2((outside / raw) * 100)}% of the gap was outside the tick and ${round2(gap.longTaskOverlapMs)} ms of it is covered by ${gap.longTasks.length} long task(s)`,
      };
    }
    return {
      classification: "D: OUTSIDE-TICK UNEXPLAINED",
      reason: `${round2((outside / raw) * 100)}% of the gap was outside the tick and NO long task overlaps it — note that a missing Long Task entry does not prove the thread or the compositor was idle`,
    };
  }

  return {
    classification: "E: MIXED",
    reason: `the gap split ${round2(inTick)} ms in-tick / ${round2(outside)} ms outside, with neither side above ${DOMINANCE * 100}%`,
  };
}

function buildAudioSection(
  welcome: WelcomeSurface,
): Hyper3dStartupReport["audio"] {
  const path = getHyper3dPathReport();
  const startup = path.welcomeStartup;
  const capture = welcome?.fullFrame.welcome ?? null;
  const phonemes = capture?.timelinePhonemes ?? [];
  const frames: Hyper3dFullFrameRecord[] = capture?.frames ?? [];
  const audible = frames.filter((frame) => frame.audioActive);
  const chunkSeconds = (capture?.chunks ?? []).reduce(
    (total, chunk) => total + chunk.durationMs / 1000,
    0,
  );
  return {
    timedPhonemesPresentAtScheduling:
      startup.firstChunkTimedPhonemeCount === null
        ? null
        : startup.firstChunkTimedPhonemeCount > 0,
    rawAvatarDataPresentAtScheduling: startup.firstChunkHadAvatarData,
    rawPhonemeFormatAtScheduling: startup.firstChunkRawPhonemeFormat,
    timedPhonemeCountAtScheduling: startup.firstChunkTimedPhonemeCount,
    appendResult: startup.firstChunkAppendResult,
    firstPhonemeTimelineTime: phonemes.length > 0 ? phonemes[0].start : null,
    lastPhonemeTimelineTime:
      phonemes.length > 0 ? phonemes[phonemes.length - 1].end : null,
    responseOriginContextTime:
      startup.responseOriginContextTime ?? capture?.responseOriginContextTime ?? null,
    firstRenderedResponseClock: audible.length > 0 ? audible[0].responseClock : null,
    lastRenderedResponseClock:
      audible.length > 0 ? audible[audible.length - 1].responseClock : null,
    totalAudibleDurationSeconds: chunkSeconds > 0 ? round2(chunkSeconds) : null,
    audibleRenderedFrames: audible.length,
  };
}

function buildAuditRisks(
  welcome: WelcomeSurface,
  trace: RealtimeTrace | undefined,
): Hyper3dStartupReport["auditRisks"] {
  const startup = getHyper3dPathReport().welcomeStartup;
  const capture = welcome?.fullFrame.welcome ?? null;
  const frames: Hyper3dFullFrameRecord[] = capture?.frames ?? [];

  // ── B1: late avatar_data repair on an already-scheduled item ──────────────
  const b1Evidence: string[] = [];
  let b1: Verdict = "UNPROVEN";
  if (startup.firstChunkHadAvatarData === null) {
    b1Evidence.push("no welcome chunk reached Hyper3D's onChunkScheduled in this capture");
  } else {
    b1Evidence.push(
      `avatar_data present on the queue item at onChunkScheduled: ${startup.firstChunkHadAvatarData}`,
      `timed phonemes handed over: ${startup.firstChunkTimedPhonemeCount}`,
      `append result: ${startup.firstChunkAppendResult}`,
      `later repairs onto an ALREADY-scheduled item: ${startup.lateAvatarDataAfterScheduleCount}`,
    );
    if (startup.firstChunkHadAvatarData && (startup.firstChunkTimedPhonemeCount ?? 0) > 0) {
      b1 = "NO";
      b1Evidence.push(
        "the welcome chunk carried timed phonemes at scheduling, so no repair was needed for it",
      );
    } else if (startup.lateAvatarDataAfterScheduleCount > 0) {
      b1 = "YES";
      b1Evidence.push(
        "the welcome was scheduled without usable metadata AND a repair landed on an already-scheduled item, which Hyper3D never rereads",
      );
    }
  }
  const lateRoutes = (trace?.lifecycle ?? []).filter(
    (event) =>
      event.stage === "avatar_data_routed" &&
      String(event.detail.route ?? "").includes("already_scheduled"),
  );
  if (lateRoutes.length > 0) {
    b1Evidence.push(`protocol trace: ${lateRoutes.length} late_attach_to_already_scheduled_item event(s)`);
  }

  // ── B2: the welcome release's reorder-buffer reset ────────────────────────
  const b2Evidence: string[] = [];
  let b2: Verdict = "UNPROVEN";
  if (startup.releaseResetAtMs === null) {
    b2Evidence.push("the special welcome release did not run in this capture");
  } else if (startup.firstChunkScheduledAtMs === null) {
    b2Evidence.push(
      `welcome_release reset at ${startup.releaseResetAtMs} ms, but no welcome chunk reached Hyper3D afterwards`,
    );
  } else {
    const deltaMs = startup.firstChunkScheduledAtMs - startup.releaseResetAtMs;
    b2Evidence.push(
      `welcome_release reset at ${startup.releaseResetAtMs} ms; first Hyper3D handoff at ${startup.firstChunkScheduledAtMs} ms (+${round2(deltaMs)} ms)`,
      `timed phonemes that survived to the handoff: ${startup.firstChunkTimedPhonemeCount}`,
    );
    // The reset only PARTICIPATES if metadata was missing at the handoff that
    // followed it. Metadata that arrived intact proves the reset dropped nothing
    // this welcome needed.
    b2 =
      (startup.firstChunkTimedPhonemeCount ?? 0) > 0
        ? "NO"
        : startup.firstChunkHadAvatarData === false
          ? "YES"
          : "UNPROVEN";
  }
  const clears = (trace?.lifecycle ?? []).filter(
    (event) =>
      event.stage === "pending_cleared" &&
      String(event.detail.via ?? "").includes("welcome_release"),
  );
  for (const clear of clears) {
    b2Evidence.push(
      `protocol trace: pending_cleared via ${clear.detail.via} at ${clear.at} ms, clearedCount=${clear.detail.clearedCount}`,
    );
  }

  // ── B3: showcase ownership of the lower face during welcome speech ────────
  const b3Evidence: string[] = [];
  let b3: Verdict = "UNPROVEN";
  const audible = frames.filter((frame) => frame.audioActive);
  if (audible.length === 0) {
    b3Evidence.push("no audible welcome frame was captured, so ownership cannot be read");
  } else {
    const showcaseOwned = audible.filter((frame) => frame.showcaseOwnsLowerFace);
    const notSpeaking = audible.filter((frame) => frame.isSpeaking === false);
    b3Evidence.push(
      `audible welcome frames: ${audible.length}`,
      `frames where isSpeaking was still false: ${notSpeaking.length}`,
      `frames where the showcase changed a lower-face channel: ${showcaseOwned.length}`,
    );
    if (showcaseOwned.length > 0) {
      b3 = "YES";
      const first = showcaseOwned[0];
      b3Evidence.push(
        `first such frame: responseClock=${round2(first.responseClock)}s isSpeaking=${first.isSpeaking} ` +
          `yieldReason=${first.showcaseYieldReason} controllerJawOpen=${round2(first.controller.jawOpen ?? 0)} ` +
          `finalJawOpen=${round2(first.final.jawOpen ?? 0)} glbJawOpen=${round2(first.glb.jawOpen ?? 0)}`,
      );
    } else {
      b3 = "NO";
      b3Evidence.push("the showcase yielded on every audible welcome frame in this capture");
    }
  }

  return {
    b1LateMetadataRace: { verdict: b1, evidence: b1Evidence },
    b2WelcomeResetRace: { verdict: b2, evidence: b2Evidence },
    b3ShowcaseLowerFace: { verdict: b3, evidence: b3Evidence },
  };
}

/** Joins every surface into one report. Reads only; records nothing. */
export function buildHyper3dStartupReport(): Hyper3dStartupReport {
  const path = getHyper3dPathReport();
  const loop = path.loop;
  const asset = path.assetTimeline;
  const startup = path.welcomeStartup;
  const welcome = readWindow<Hyper3dWelcomeLipSyncDiagnostics>("__solaceHyper3dWelcomeLipSync");
  const trace = readWindow<RealtimeTrace>("__solaceSessionProtocolTrace");

  const timeline = sequence([
    step("host mount", asset.hostMountedAtMs),
    step("engine factory requested", asset.engineFactoryRequestedAtMs),
    step("engine chunk import start", asset.engineModuleImportStartedAtMs),
    step("engine chunk import end", asset.engineModuleImportCompletedAtMs),
    step("GLB load start", asset.loadStartedAtMs),
    step("GLB last network progress", asset.lastProgressAtMs),
    step("GLB onLoad (parse + texture decode complete)", asset.loaderOnLoadAtMs),
    step("binding validation complete", asset.bindingValidatedAtMs),
    step("engine ready (handle returned)", asset.engineReadyAtMs),
    step("host loop started", loop.hostStartedAtMs),
    step("first rAF tick entry", asset.firstTickAtMs),
    step("first renderer.render complete", asset.firstRenderCompletedAtMs),
    step("welcome release reset", startup.releaseResetAtMs),
    step("welcome chunk handed to scheduler", startup.firstChunkHandoffAtMs),
    step("welcome chunk reached Hyper3D", startup.firstChunkScheduledAtMs),
    step("first audible welcome frame rendered", startup.firstAudibleFrameAtMs),
  ]);

  const frames = loop.timing.frames;
  const gaps: Hyper3dStartupGap[] = [];
  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    if (frame.rawDeltaMs <= GAP_THRESHOLD_MS) continue;
    // The PREVIOUS frame must be the immediately preceding one for its split to
    // describe this gap; a ring that dropped entries breaks that adjacency.
    const previous =
      index > 0 && frames[index - 1].frame === frame.frame - 1 ? frames[index - 1] : null;
    const gapStartMs = frame.tickEntryMs - frame.rawDeltaMs;
    const gapEndMs = frame.tickEntryMs;
    const longTasks = loop.longTasks.entries.filter(
      (task) => overlapMs(task, gapStartMs, gapEndMs) > 0,
    );
    const snapshot = [...loop.rendererSnapshots]
      .filter((entry) => entry.atMs <= gapEndMs)
      .pop();
    const base = {
      frame: frame.frame,
      gapStartMs: round2(gapStartMs),
      gapEndMs: round2(gapEndMs),
      rawDeltaMs: frame.rawDeltaMs,
      previousInTickMs: previous?.inTickMs ?? null,
      outsideAfterPreviousTickMs: frame.outsideTickMs,
      previousEngineUpdateMs: previous?.engineUpdateMs ?? null,
      previousRendererRenderMs: previous?.rendererRenderMs ?? null,
      longTaskOverlapMs: round2(
        longTasks.reduce((total, task) => total + overlapMs(task, gapStartMs, gapEndMs), 0),
      ),
      longTasks,
      programsAtGap: snapshot?.programs ?? null,
      audioContextTimeAtGapEnd: frame.audioContextTime,
      responseClockAtGapEnd: frame.responseClockSeconds,
      visibility: frame.documentVisibilityState,
      hasFocus: frame.documentHasFocus,
    };
    gaps.push({ ...base, ...classifyGap(base) });
  }

  const limitations = [
    loop.longTasks.observing
      ? "A long task is only reported when the browser emits one. Its ABSENCE does not prove the main thread, the compositor or the GPU was idle — shader compilation, GPU upload and compositor work are not Long Tasks."
      : `The long-task observer was NOT delivering (supported=${loop.longTasks.supported}, error=${loop.longTasks.error}), so an empty entry list says nothing at all.`,
    "renderer.info.programs rising next to a slow frame is CORRELATION. It does not establish that shader compilation caused that frame.",
    asset.boundaryNote,
    loop.timing.boundaries,
    `Frame detail is kept in full for the first ${loop.timing.detailedFrameLimit} frames and after that only for frames over ${loop.timing.slowFrameThresholdMs} ms, so a gap whose PREVIOUS frame was dropped from the ring is reported with a null split rather than a guess.`,
  ];
  if (loop.timing.maxSelfCheckResidualMs > 1) {
    limitations.push(
      `The frame split does NOT reconcile: worst residual ${loop.timing.maxSelfCheckResidualMs} ms. Treat the in-tick/outside-tick attribution as unreliable in this capture.`,
    );
  }

  return {
    capturedAtMs: Math.round(performance.now()),
    hyper3dRan: path.framesRendered > 0,
    startupTimeline: timeline,
    frames,
    framesTimed: loop.timing.framesTimed,
    gaps,
    rendererSnapshots: loop.rendererSnapshots,
    longTasks: loop.longTasks,
    audio: buildAudioSection(welcome),
    auditRisks: buildAuditRisks(welcome, trace),
    limitations,
  };
}

const cell = (value: unknown): string =>
  value === null || value === undefined ? "—" : String(value);

/** The same report as a markdown string, for pasting into the phase write-up. */
export function formatHyper3dStartupReport(report = buildHyper3dStartupReport()): string {
  const lines: string[] = [];
  lines.push(`# Hyper3D welcome startup capture (t=${report.capturedAtMs} ms)`);
  lines.push(`Hyper3D rendered at least one frame: ${report.hyper3dRan}`);

  lines.push("", "## A. STARTUP TIMELINE", "", "| step | performance.now() ms | Δ ms |", "|---|---:|---:|");
  for (const entry of report.startupTimeline) {
    lines.push(`| ${entry.label} | ${cell(entry.atMs)} | ${cell(entry.sincePreviousMs)} |`);
  }

  lines.push(
    "",
    `## B. FRAME TIMINGS (${report.framesTimed} frames timed, ${report.frames.length} kept)`,
    "",
    "| # | entry | rawΔ | outside | inTick | engine | render | other | orch | morph | vis | focus |",
    "|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|",
  );
  for (const frame of report.frames) {
    lines.push(
      `| ${frame.frame} | ${frame.tickEntryMs} | ${frame.rawDeltaMs} | ${cell(frame.outsideTickMs)} | ${cell(frame.inTickMs)} | ` +
        `${cell(frame.engineUpdateMs)} | ${cell(frame.rendererRenderMs)} | ${cell(frame.otherInTickMs)} | ` +
        `${cell(frame.engineOrchestratorMs)} | ${cell(frame.engineMorphWriteMs)} | ${frame.documentVisibilityState} | ${frame.documentHasFocus} |`,
    );
  }

  lines.push(
    "",
    `## C. EVERY GAP > ${GAP_THRESHOLD_MS} MS (${report.gaps.length})`,
    "",
    "| # | gap ms | prevInTick | outside | prevEngine | prevRender | longtask ms | programs | audioCtx | responseClock | vis | focus | class |",
    "|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|",
  );
  for (const gap of report.gaps) {
    lines.push(
      `| ${gap.frame} | ${gap.rawDeltaMs} | ${cell(gap.previousInTickMs)} | ${cell(gap.outsideAfterPreviousTickMs)} | ` +
        `${cell(gap.previousEngineUpdateMs)} | ${cell(gap.previousRendererRenderMs)} | ${gap.longTaskOverlapMs} | ${cell(gap.programsAtGap)} | ` +
        `${cell(gap.audioContextTimeAtGapEnd)} | ${cell(gap.responseClockAtGapEnd)} | ${gap.visibility} | ${gap.hasFocus} | ${gap.classification} |`,
    );
  }
  for (const gap of report.gaps) lines.push(`- frame ${gap.frame}: ${gap.reason}`);

  lines.push("", "## D. AUDIO / PHONEME STATUS", "");
  for (const [key, value] of Object.entries(report.audio)) {
    lines.push(`- ${key}: ${cell(value)}`);
  }

  lines.push("", "## E. AUDIT-RISK OBSERVATION", "");
  const risks: Array<[string, { verdict: Verdict; evidence: string[] }]> = [
    ["B1 late metadata race", report.auditRisks.b1LateMetadataRace],
    ["B2 welcome reset", report.auditRisks.b2WelcomeResetRace],
    ["B3 showcase lower-face ownership", report.auditRisks.b3ShowcaseLowerFace],
  ];
  for (const [label, risk] of risks) {
    lines.push(`### ${label}: ${risk.verdict}`);
    for (const item of risk.evidence) lines.push(`- ${item}`);
  }

  lines.push("", "## LIMITATIONS", "");
  for (const item of report.limitations) lines.push(`- ${item}`);

  return lines.join("\n");
}

/**
 * Publishes the two functions on `window`. Called once per session from the
 * live-engine binding; re-publishing is harmless.
 *
 *     __solaceHyper3dStartupReport()      the joined object
 *     __solaceHyper3dStartupReportText()  the same thing as markdown
 */
export function installHyper3dStartupReport(): void {
  if (!DEV || typeof window === "undefined") return;
  const target = window as unknown as Record<string, unknown>;
  target.__solaceHyper3dStartupReport = buildHyper3dStartupReport;
  target.__solaceHyper3dStartupReportText = () => formatHyper3dStartupReport();
}
