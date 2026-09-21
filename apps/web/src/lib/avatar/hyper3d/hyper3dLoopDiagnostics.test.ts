import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  __resetHyper3dPathForTests,
  countHyper3dAppendAttempt,
  countHyper3dAppendSkip,
  countHyper3dAppendSuccess,
  countHyper3dEngineUpdate,
  countHyper3dOrchestratorFrame,
  countHyper3dRafCallback,
  countHyper3dRecorderCall,
  countHyper3dRender,
  getHyper3dPathReport,
  markHyper3dHeartbeatStopped,
  recordHyper3dHeartbeat,
  recordHyper3dLoopFrame,
  recordHyper3dVisibilityEvent,
  resetHyper3dLoopDiagnostics,
} from "./hyper3dPathDiagnostics";
import { createHyper3dLiveSpeechAdapter } from "./hyper3dLiveSpeechAdapter";
import { createHyper3dMouthTrace } from "./hyper3dFrameOrchestrator";
import type { AvatarPhonemeTimeline } from "../avatarMorphTypes";

/**
 * PHASE 2G.1B — proves the loop counters are independent, bounded and
 * observational, and that the host's delta clamp is untouched.
 */

const frame = (overrides: Partial<Parameters<typeof recordHyper3dLoopFrame>[0]> = {}) =>
  recordHyper3dLoopFrame({
    performanceNow: 1000,
    rawDeltaMs: 16.7,
    clampedDeltaSeconds: 0.0167,
    engineStatus: "running",
    ...overrides,
  });

describe("Phase 2G.1B loop diagnostics", () => {
  beforeEach(() => {
    __resetHyper3dPathForTests();
    resetHyper3dLoopDiagnostics();
  });

  it("counts every stage independently", () => {
    countHyper3dRafCallback();
    countHyper3dRafCallback();
    countHyper3dEngineUpdate();
    countHyper3dRender();
    countHyper3dOrchestratorFrame();
    countHyper3dRecorderCall();
    countHyper3dAppendAttempt();
    countHyper3dAppendSuccess();
    const loop = getHyper3dPathReport().loop;
    expect(loop).toMatchObject({
      rafCallbackCount: 2,
      engineUpdateCount: 1,
      renderCount: 1,
      orchestratorFrameCount: 1,
      recordLipSyncFrameCalls: 1,
      appendAttempts: 1,
      appendSuccesses: 1,
    });
  });

  it("records the RAW delta the clamp hides, and classifies long gaps", () => {
    frame({ performanceNow: 1000, rawDeltaMs: 16.7, clampedDeltaSeconds: 0.0167 });
    frame({ performanceNow: 4000, rawDeltaMs: 3000, clampedDeltaSeconds: 0.1 });
    frame({ performanceNow: 4300, rawDeltaMs: 300, clampedDeltaSeconds: 0.1 });
    const loop = getHyper3dPathReport().loop;
    expect(loop.largestRawDeltaMs).toBe(3000);
    expect(loop.largestGap).toMatchObject({ rawDeltaMs: 3000, gapStartPerformanceNow: 1000, gapEndPerformanceNow: 4000 });
    expect([loop.gapsOver100ms, loop.gapsOver250ms, loop.gapsOver500ms, loop.gapsOver1000ms]).toEqual([2, 2, 1, 1]);
    // The clamped value is recorded as passed, never recomputed.
    expect(loop.samples.map((s) => s.clampedDeltaSeconds)).toEqual([0.0167, 0.1, 0.1]);
    expect(loop.samples.every((s) => typeof s.documentVisibilityState === "string")).toBe(true);
  });

  it("bounds the sample ring, the long-gap list and visibility events", () => {
    for (let i = 0; i < 400; i += 1) frame({ performanceNow: i, rawDeltaMs: 600 });
    for (let i = 0; i < 60; i += 1) recordHyper3dVisibilityEvent("visibilitychange");
    const loop = getHyper3dPathReport().loop;
    expect(loop.samples).toHaveLength(300);
    expect(loop.longGaps).toHaveLength(40);
    expect(loop.visibilityEvents).toHaveLength(40);
    expect(loop.rafCallbackCount).toBe(0); // frames recorded ≠ rAF counted
  });

  it("tracks the heartbeat independently of frames", () => {
    recordHyper3dHeartbeat(101);
    recordHyper3dHeartbeat(1500);
    recordHyper3dHeartbeat(300);
    const beat = getHyper3dPathReport().loop.heartbeat;
    expect(beat).toMatchObject({ running: true, ticks: 3, maxGapMs: 1500, gapsOver250ms: 2, gapsOver1000ms: 1 });
    markHyper3dHeartbeatStopped();
    expect(getHyper3dPathReport().loop.heartbeat.running).toBe(false);
  });

  it("keeps the host's delta clamp exactly as it was", () => {
    const host = readFileSync("src/lib/avatar/hyper3d/hyper3dImperativeHost.ts", "utf8");
    expect(host).toContain("const deltaSeconds = Math.min(0.1, rawDeltaMs / 1000);");
    expect(host.match(/Math\.min\(0\.1,/g)).toHaveLength(1);
  });

  it("classifies recorder skips by the real branches", () => {
    let contextTime = 10;
    let pipelineActive = true;
    const adapter = createHyper3dLiveSpeechAdapter({
      getContextTime: () => contextTime,
      isPipelineActive: () => pipelineActive,
    });
    const trace = createHyper3dMouthTrace();

    // No scheduled chunk yet.
    resetHyper3dLoopDiagnostics();
    trace.timeSeconds = 0;
    adapter.recordLipSyncFrame(trace);
    expect(getHyper3dPathReport().loop.appendSkips.noChunk).toBe(1);
    expect(getHyper3dPathReport().loop.recordLipSyncFrameCalls).toBe(1);

    const timeline: AvatarPhonemeTimeline = {
      sentence: "Hi.",
      sentiment: null,
      phonemeFormat: "timestamped",
      phonemes: [{ phoneme: "AA", rawPhoneme: "AA1", start: 0, end: 0.5 }],
    };
    adapter.beginTurn();
    adapter.onChunkScheduled({
      audioContextStartTime: 10,
      durationMs: 1000,
      leadInSec: 0,
      timeline,
      chunkIndex: 0,
      sentence: "Hi.",
      scheduledAtMs: 0,
      isWelcome: true,
    });

    // Audible frame → attempt + success.
    resetHyper3dLoopDiagnostics();
    contextTime = 10.25;
    trace.timeSeconds = 0.25;
    adapter.recordLipSyncFrame(trace);
    let loop = getHyper3dPathReport().loop;
    expect(loop.appendAttempts).toBe(1);
    expect(loop.appendSuccesses).toBe(1);

    // Pipeline no longer active → audio not active, no append.
    resetHyper3dLoopDiagnostics();
    pipelineActive = false;
    adapter.recordLipSyncFrame(trace);
    loop = getHyper3dPathReport().loop;
    expect(loop.appendSkips.notAudioActive).toBe(1);
    expect(loop.appendAttempts).toBe(0);

    // Cancelled turn clears the origin → stale chunk is not attributed.
    resetHyper3dLoopDiagnostics();
    pipelineActive = true;
    adapter.cancel("test");
    adapter.recordLipSyncFrame(trace);
    expect(getHyper3dPathReport().loop.appendSkips.noOrigin).toBe(1);
  });

  it("observes no-phoneme audio without creating phonemes or timing", () => {
    const adapter = createHyper3dLiveSpeechAdapter({
      getContextTime: () => 5,
      isPipelineActive: () => true,
    });
    adapter.beginTurn();
    const result = adapter.onChunkScheduled({
      audioContextStartTime: 5,
      durationMs: 1200,
      leadInSec: 0,
      timeline: null,
      chunkIndex: 0,
      sentence: "Still there?",
      scheduledAtMs: 0,
    });
    expect(result).toMatchObject({ accepted: false, reason: "no-phonemes" });
    // The timeline still holds no phonemes — nothing was synthesized.
    expect(adapter.getPayload().phonemes).toHaveLength(0);

    resetHyper3dLoopDiagnostics();
    const trace = createHyper3dMouthTrace();
    trace.timeSeconds = 0.1;
    adapter.recordLipSyncFrame(trace);
    const loop = getHyper3dPathReport().loop;
    expect(loop.appendAttempts).toBe(1); // previously invisible
    expect(loop.appendSkips.noChunk).toBe(0);
  });
});
