import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  __resetHyper3dPathForTests,
  captureHyper3dAssetResourceTiming,
  finishHyper3dLoopFrame,
  getHyper3dPathReport,
  markHyper3dLongTaskObserver,
  recordHyper3dAssetProgress,
  recordHyper3dAssetTimeline,
  recordHyper3dEngineSpans,
  recordHyper3dLongTask,
  recordHyper3dLoopFrame,
  recordHyper3dRendererInfo,
  resetHyper3dLoopDiagnostics,
} from "./hyper3dPathDiagnostics";

/**
 * PHASE 2G.1C — proves the frame split is arithmetically sound, bounded, and
 * observational, and that nothing here can be mistaken for a measurement it did
 * not actually take (a thrown tick, an unsupported observer, an unsplit load).
 */

/** One complete instrumented tick, exactly as the host drives it. */
const tick = (opts: {
  entry: number;
  rawDeltaMs: number;
  outsideTickMs: number | null;
  inTickMs: number;
  engineUpdateMs: number;
  rendererRenderMs: number;
  spans?: { orchestratorMs: number; morphWriteMs: number };
}) => {
  recordHyper3dLoopFrame({
    performanceNow: opts.entry,
    rawDeltaMs: opts.rawDeltaMs,
    clampedDeltaSeconds: Math.min(0.1, opts.rawDeltaMs / 1000),
    engineStatus: "running",
    outsideTickMs: opts.outsideTickMs,
  });
  if (opts.spans) recordHyper3dEngineSpans(opts.spans);
  finishHyper3dLoopFrame({
    inTickMs: opts.inTickMs,
    engineUpdateMs: opts.engineUpdateMs,
    rendererRenderMs: opts.rendererRenderMs,
  });
};

describe("Phase 2G.1C frame split", () => {
  beforeEach(() => {
    __resetHyper3dPathForTests();
    resetHyper3dLoopDiagnostics();
  });

  it("reconstructs rawDelta from the previous tick's work plus the gap", () => {
    // Frame 1 entered at 1000 and spent 700 ms inside the tick.
    tick({ entry: 1000, rawDeltaMs: 16, outsideTickMs: null, inTickMs: 700, engineUpdateMs: 40, rendererRenderMs: 655 });
    // Frame 2 therefore cannot enter before 1700; it enters at 1800.
    tick({ entry: 1800, rawDeltaMs: 800, outsideTickMs: 100, inTickMs: 12, engineUpdateMs: 5, rendererRenderMs: 6 });
    const frames = getHyper3dPathReport().loop.timing.frames;
    expect(frames[0].selfCheckResidualMs).toBeNull(); // no previous tick
    // 800 = 700 (previous in-tick) + 100 (outside). The split is exact.
    expect(frames[1].selfCheckResidualMs).toBe(0);
    expect(getHyper3dPathReport().loop.timing.maxSelfCheckResidualMs).toBe(0);
  });

  it("surfaces a mismatched split instead of hiding it", () => {
    tick({ entry: 1000, rawDeltaMs: 16, outsideTickMs: null, inTickMs: 10, engineUpdateMs: 4, rendererRenderMs: 5 });
    // Claiming a 900 ms gap that neither component accounts for.
    tick({ entry: 1900, rawDeltaMs: 900, outsideTickMs: 100, inTickMs: 10, engineUpdateMs: 4, rendererRenderMs: 5 });
    const timing = getHyper3dPathReport().loop.timing;
    expect(timing.frames[1].selfCheckResidualMs).toBe(790);
    expect(timing.maxSelfCheckResidualMs).toBe(790);
  });

  it("nests the components: render+engine inside the tick, spans inside engine", () => {
    tick({
      entry: 1000,
      rawDeltaMs: 16,
      outsideTickMs: 3,
      inTickMs: 700,
      engineUpdateMs: 40,
      rendererRenderMs: 655,
      spans: { orchestratorMs: 25, morphWriteMs: 9 },
    });
    const frame = getHyper3dPathReport().loop.timing.frames[0];
    expect(frame).toMatchObject({
      inTickMs: 700,
      engineUpdateMs: 40,
      rendererRenderMs: 655,
      otherInTickMs: 5, // 700 − 40 − 655
      engineOrchestratorMs: 25,
      engineMorphWriteMs: 9,
      engineOtherMs: 6, // 40 − 25 − 9
    });
  });

  it("leaves a thrown tick's in-tick fields null rather than guessing", () => {
    // The host opens the frame, then `engine.update` throws: no finish call.
    recordHyper3dLoopFrame({
      performanceNow: 1000,
      rawDeltaMs: 500,
      clampedDeltaSeconds: 0.1,
      engineStatus: "running",
      outsideTickMs: 480,
    });
    const frame = getHyper3dPathReport().loop.timing.frames[0];
    expect(frame.outsideTickMs).toBe(480); // the gap was still measured
    expect(frame.inTickMs).toBeNull();
    expect(frame.rendererRenderMs).toBeNull();
    expect(getHyper3dPathReport().loop.timing.framesTimed).toBe(0);
  });

  it("keeps detail for early frames and for slow ones only, within one bound", () => {
    for (let i = 0; i < 200; i += 1) {
      tick({ entry: 1000 + i * 16, rawDeltaMs: 16, outsideTickMs: 4, inTickMs: 12, engineUpdateMs: 5, rendererRenderMs: 6 });
    }
    const timing = getHyper3dPathReport().loop.timing;
    // 200 fast frames, only the first 24 kept.
    expect(timing.frames).toHaveLength(timing.detailedFrameLimit);
    expect(timing.framesTimed).toBe(200);
    expect(timing.frames.at(-1)?.frame).toBe(24);

    // A late SLOW frame is kept even though it is past the detail limit.
    tick({ entry: 9000, rawDeltaMs: 900, outsideTickMs: 880, inTickMs: 12, engineUpdateMs: 5, rendererRenderMs: 6 });
    expect(getHyper3dPathReport().loop.timing.frames.at(-1)).toMatchObject({ frame: 201, rawDeltaMs: 900 });

    // And a frame that is only slow INSIDE the tick is kept too, exactly once.
    tick({ entry: 9100, rawDeltaMs: 20, outsideTickMs: 5, inTickMs: 300, engineUpdateMs: 8, rendererRenderMs: 290 });
    const frames = getHyper3dPathReport().loop.timing.frames;
    expect(frames.filter((f) => f.frame === 202)).toHaveLength(1);
    expect(frames.at(-1)).toMatchObject({ frame: 202, inTickMs: 300 });
  });

  it("bounds the frame ring under a long run of slow frames", () => {
    for (let i = 0; i < 400; i += 1) {
      tick({ entry: 1000 + i * 500, rawDeltaMs: 500, outsideTickMs: 480, inTickMs: 20, engineUpdateMs: 8, rendererRenderMs: 10 });
    }
    const timing = getHyper3dPathReport().loop.timing;
    expect(timing.frames.length).toBeLessThanOrEqual(72);
    expect(timing.outsideTickOver100ms).toBe(400);
    expect(timing.maxOutsideTickMs).toBe(480);
  });

  it("records observer support so an empty long-task list stays readable", () => {
    markHyper3dLongTaskObserver({
      supported: false,
      observing: false,
      buffered: false,
      error: "longtask is not in PerformanceObserver.supportedEntryTypes",
    });
    const longTasks = getHyper3dPathReport().loop.longTasks;
    // Zero entries AND zero support: the absence proves nothing about the thread.
    expect(longTasks).toMatchObject({ supported: false, observing: false, observedCount: 0 });
    expect(longTasks.entries).toHaveLength(0);
    expect(longTasks.error).toContain("supportedEntryTypes");
  });

  it("captures long tasks with attribution, bounded", () => {
    markHyper3dLongTaskObserver({ supported: true, observing: true, buffered: true, error: null });
    for (let i = 0; i < 80; i += 1) {
      recordHyper3dLongTask({
        startTime: 1000 + i,
        duration: 120 + i,
        name: "self",
        entryType: "longtask",
        attribution: [{ name: "unknown", entryType: "taskattribution", containerType: "window", containerSrc: "" }],
        toJSON: () => ({}),
      } as unknown as PerformanceEntry);
    }
    const longTasks = getHyper3dPathReport().loop.longTasks;
    expect(longTasks.observedCount).toBe(80);
    expect(longTasks.entries).toHaveLength(60);
    expect(longTasks.entries[0].attribution[0]).toMatchObject({ containerType: "window", name: "unknown" });
  });

  it("snapshots renderer.info for the first ten frames only", () => {
    for (let frame = 1; frame <= 15; frame += 1) {
      recordHyper3dRendererInfo(frame, {
        programs: { length: frame < 3 ? frame * 4 : 12 },
        render: { calls: 9, triangles: 120_000, lines: 0, points: 0 },
        memory: { geometries: 11, textures: 14 },
      });
    }
    const snapshots = getHyper3dPathReport().loop.rendererSnapshots;
    expect(snapshots).toHaveLength(10);
    expect(snapshots[0]).toMatchObject({ frame: 1, programs: 4, calls: 9, triangles: 120_000, textures: 14 });
    expect(snapshots.at(-1)?.frame).toBe(10);
  });

  it("survives a renderer that exposes none of those fields", () => {
    recordHyper3dRendererInfo(1, {});
    expect(getHyper3dPathReport().loop.rendererSnapshots[0]).toMatchObject({
      programs: null,
      calls: null,
      textures: null,
    });
  });

  it("records the asset timeline and states where the split is unavailable", () => {
    recordHyper3dAssetTimeline({ url: "/avatars/female_2291.glb", loadStartedAtMs: 14898 });
    recordHyper3dAssetProgress(4_000_000, 9_000_000);
    recordHyper3dAssetProgress(9_000_000, 9_000_000);
    recordHyper3dAssetTimeline({ loaderOnLoadAtMs: 18721, bindingValidatedAtMs: 18743 });
    captureHyper3dAssetResourceTiming("/avatars/female_2291.glb");
    const timeline = getHyper3dPathReport().assetTimeline;
    expect(timeline).toMatchObject({
      url: "/avatars/female_2291.glb",
      loadStartedAtMs: 14898,
      progressEvents: 2,
      progressLoaded: 9_000_000,
      progressTotal: 9_000_000,
      loaderOnLoadAtMs: 18721,
      bindingValidatedAtMs: 18743,
    });
    // The limitation is carried WITH the data, not left to the reader.
    expect(timeline.boundaryNote).toContain("does NOT expose the exact");
    expect(timeline.boundaryNote).toContain("shader compilation");
  });

  it("does not inherit an open frame across a host remount", () => {
    recordHyper3dLoopFrame({
      performanceNow: 1000,
      rawDeltaMs: 16,
      clampedDeltaSeconds: 0.016,
      engineStatus: "running",
      outsideTickMs: 4,
    });
    resetHyper3dLoopDiagnostics();
    // The new host's first frame has no previous tick, so no residual is claimed.
    tick({ entry: 5000, rawDeltaMs: 16, outsideTickMs: null, inTickMs: 10, engineUpdateMs: 4, rendererRenderMs: 5 });
    const frames = getHyper3dPathReport().loop.timing.frames;
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({ frame: 1, selfCheckResidualMs: null });
  });

  it("keeps every 2G.1C stamp behind the DEV loop gate in the host", () => {
    const host = readFileSync("src/lib/avatar/hyper3d/hyper3dImperativeHost.ts", "utf8");
    // The clamp is still the only one, and still untouched.
    expect(host).toContain("const deltaSeconds = Math.min(0.1, rawDeltaMs / 1000);");
    expect(host.match(/Math\.min\(0\.1,/g)).toHaveLength(1);
    // Each timing stamp is a conditional expression, so production pays nothing.
    for (const stamp of ["engineStartMs", "renderStartMs", "renderEndMs"]) {
      expect(host).toContain(`const ${stamp} = DEV_LOOP_DIAGNOSTICS ? performance.now() : 0;`);
    }
    // And the engine's own spans go through globalThis, never the head performer.
    const factory = readFileSync("src/lib/avatar/hyper3d/hyper3dEngineFactory.ts", "utf8");
    expect(factory).toContain("const orchestratorStartMs = DEV_ENGINE_SPANS ? globalThis.performance.now() : 0;");
    expect(factory).not.toMatch(/DEV_ENGINE_SPANS \? performance\.now\(\)/);
  });
});
