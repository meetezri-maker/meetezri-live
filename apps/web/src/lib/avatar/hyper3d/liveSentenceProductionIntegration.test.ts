import { describe, expect, it, vi } from "vitest";
import type { AvatarPhonemeTimeline } from "../avatarMorphTypes";
import { createHyper3dLiveSpeechAdapter } from "./hyper3dLiveSpeechAdapter";
import { AvatarController } from "./engine/engine/avatar/AvatarController";
import { conductorTunings } from "./engine/engine/animation/SpeechPerformanceConductor";

const timelineOf = (sentence: string): AvatarPhonemeTimeline => ({
  sentence,
  sentiment: null,
  phonemeFormat: "timestamped",
  phonemes: [
    { phoneme: "HH", rawPhoneme: "HH", start: 0, end: 0.12 },
    { phoneme: "EH", rawPhoneme: "EH", start: 0.12, end: 0.28 },
    { phoneme: "L", rawPhoneme: "L", start: 0.28, end: 0.42 },
    { phoneme: "OW", rawPhoneme: "OW", start: 0.42, end: 0.7 },
  ],
});

const scheduled = (
  sentence: string,
  chunkIndex: number,
  audioContextStartTime: number,
  scheduledAtMs = 1000,
) => ({
  audioContextStartTime,
  durationMs: 1000,
  leadInSec: 0,
  timeline: timelineOf(sentence),
  chunkIndex,
  sentence,
  scheduledAtMs,
});

describe("Phase 2E live sentence production integration", () => {
  it("plans from the scheduler-derived offset and resolves sentence-local time", () => {
    let contextTime = 9.75;
    const adapter = createHyper3dLiveSpeechAdapter({
      getContextTime: () => contextTime,
      isPipelineActive: () => true,
      now: () => 1000,
    });
    adapter.beginTurn();
    adapter.onChunkScheduled(scheduled("Hello there.", 0, 10));

    const [placed] = adapter.getSentencePlans();
    expect(placed.offsetSeconds).toBe(0);
    expect(placed.localDurationSeconds).toBe(1);
    expect(placed.localPhonemes[0].start_time).toBe(0);
    expect(adapter.resolveSentencePlanAt(0.5)?.localTime).toBe(0.5);
    expect(adapter.getSentencePlannerStats().leadTimesMs).toEqual([250]);
  });

  it("deduplicates before planning and missing plans never block audio duration", () => {
    const adapter = createHyper3dLiveSpeechAdapter({
      getContextTime: () => 0,
      isPipelineActive: () => true,
    });
    adapter.beginTurn();
    const first = scheduled("One sentence.", 0, 1);
    adapter.onChunkScheduled(first);
    adapter.onChunkScheduled(first);
    expect(adapter.getSentencePlans()).toHaveLength(1);
    expect(adapter.getDiagnostics().sentencePlanning.duplicateChunks).toBe(1);

    adapter.beginTurn();
    const result = adapter.onChunkScheduled({
      ...scheduled("", 0, 2),
      timeline: null,
      sentence: "",
    });
    expect(result).toMatchObject({ accepted: false, reason: "no-phonemes" });
    expect(adapter.getPayload().audio_duration).toBe(1);
    expect(adapter.getSentencePlans()).toHaveLength(0);
  });

  it("freezes at audible onset and later chunks cannot mutate rendered history", () => {
    let contextTime = 19.8;
    const adapter = createHyper3dLiveSpeechAdapter({
      getContextTime: () => contextTime,
      isPipelineActive: () => true,
      now: () => 1000,
    });
    adapter.beginTurn();
    adapter.onChunkScheduled(scheduled("Keep this immutable.", 0, 20));
    const before = JSON.stringify(adapter.getSentencePlans()[0]);

    contextTime = 20;
    adapter.freezeSentencePlans();
    adapter.onChunkScheduled(scheduled("A later sentence.", 1, 21));

    const after = adapter.getSentencePlans()[0];
    expect(after.frozen).toBe(true);
    expect(JSON.stringify({ ...after, frozen: false })).toBe(before);
  });

  it("places a permission-delayed welcome on the scheduler clock and produces mouth articulation", () => {
    let contextTime = 49.75;
    const adapter = createHyper3dLiveSpeechAdapter({
      getContextTime: () => contextTime,
      isPipelineActive: () => true,
      now: () => 1000,
    });

    adapter.beginTurn();
    const result = adapter.onChunkScheduled({
      ...scheduled("Welcome to Solace.", 0, 50),
      isWelcome: true,
    });
    expect(result).toMatchObject({ accepted: true, chunkOffsetSeconds: 0 });

    contextTime = 50.2;
    adapter.setStatus("playing");
    adapter.sampleClock();

    const diagnostics = adapter.getDiagnostics();
    expect(diagnostics.responseOriginContextTime).toBe(50);
    expect(diagnostics.hyper3dTime).toBeCloseTo(0.2, 6);
    expect(diagnostics.currentPhoneme?.phoneme).toBe("EH");

    const controller = new AvatarController(adapter.getPayload());
    const active = adapter.resolveSentencePlanAt(0.2)!;
    const frame = controller.evaluate(0.2, 1 / 60, {
      modelId: "hyper3d-usc",
      playbackActive: true,
      conductorTuning: conductorTunings.natural,
      livePerformancePlan: active.placed.plan,
      livePerformanceClock: active.localTime,
    });

    const mouthEnergy =
      (frame.outputPose.jawOpen ?? 0) +
      (frame.outputPose.mouthClose ?? 0) +
      (frame.outputPose.mouthFunnel ?? 0) +
      (frame.outputPose.mouthPucker ?? 0);
    expect(frame.debug.currentPhoneme).toBe("EH");
    expect(mouthEnergy).toBeGreaterThan(0.01);
  });

  it("cancellation discards old plans and the next turn starts clean", () => {
    const adapter = createHyper3dLiveSpeechAdapter({
      getContextTime: () => 0,
      isPipelineActive: () => false,
    });
    adapter.beginTurn();
    adapter.onChunkScheduled(scheduled("Old turn.", 0, 1));
    const firstTurn = adapter.getSentencePlannerStats().turnId;

    adapter.cancel("interrupted");
    expect(adapter.getSentencePlans()).toHaveLength(0);
    expect(adapter.resolveSentencePlanAt(0.2)).toBeNull();

    adapter.beginTurn();
    adapter.onChunkScheduled(scheduled("New turn.", 0, 2));
    expect(adapter.getSentencePlannerStats().turnId).toBeGreaterThan(firstTurn);
    expect(adapter.getSentencePlans()[0].text).toBe("New turn.");
  });

  it("retargets live lip sync and installs the sentence plan without controller reset", () => {
    const adapter = createHyper3dLiveSpeechAdapter({
      getContextTime: () => 0,
      isPipelineActive: () => true,
    });
    adapter.beginTurn();
    const controller = new AvatarController(adapter.getPayload());
    const reset = vi.spyOn(controller, "reset");

    adapter.onChunkScheduled(scheduled("Hello there.", 0, 1));
    controller.setLivePayload(adapter.getPayload());
    const active = adapter.resolveSentencePlanAt(0.2)!;
    const frame = controller.evaluate(0.2, 1 / 60, {
      modelId: "hyper3d-usc",
      playbackActive: true,
      conductorTuning: conductorTunings.natural,
      livePerformancePlan: active.placed.plan,
      livePerformanceClock: active.localTime,
    });

    expect(reset).not.toHaveBeenCalled();
    expect(frame.debug.currentPhoneme).toBe("EH");
    expect(frame.performancePlan).toBe(active.placed.plan);
    expect(frame.performanceIntent).not.toBeNull();
  });
});
