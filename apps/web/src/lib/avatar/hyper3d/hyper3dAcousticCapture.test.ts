import { describe, expect, it } from "vitest";
import { createHyper3dLiveSpeechAdapter } from "./hyper3dLiveSpeechAdapter";
import type { AvatarPhonemeTimeline } from "../avatarMorphTypes";

/**
 * DIAGNOSTIC PLUMBING — the exported reply report must still carry the acoustic
 * frames that were analysed during the turn.
 *
 * `__solaceHyper3dReply()` calls `refreshDiagnosticsAcoustics()` unconditionally
 * at export time, which is normally long after the turn ended. `acoustics` is
 * turn-scoped and was emptied by the `beginTurn` / `cancel` that finalized the
 * capture, so an unguarded refresh replaced the finalized copy with an empty
 * array — a live `acousticFrameCount` in the thousands exported as
 * `acoustic reference frames: 0`.
 *
 * This is diagnostics only: nothing here touches playback, phoneme timing,
 * articulation or the runtime animation path.
 */

/** 300 ms of voiced-looking audio: enough that the analyzer returns real frames. */
function toneBuffer(seconds = 0.3, sampleRate = 24000) {
  const length = Math.round(seconds * sampleRate);
  const data = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const t = i / sampleRate;
    data[i] = 0.5 * Math.sin(2 * Math.PI * 140 * t) + 0.2 * Math.sin(2 * Math.PI * 280 * t);
  }
  return {
    sampleRate,
    length,
    numberOfChannels: 1,
    getChannelData: () => data,
  };
}

const TIMELINE: AvatarPhonemeTimeline = {
  sentence: "Hello there.",
  sentiment: null,
  phonemeFormat: "timestamped",
  phonemes: [
    { phoneme: "AA", rawPhoneme: "AA1", start: 0, end: 0.15 },
    { phoneme: "E", rawPhoneme: "EH1", start: 0.15, end: 0.3 },
  ],
};

type Capture = { acousticFrames: unknown[]; finalized: boolean } | null;

function normalCapture(): Capture {
  const surface = (window as unknown as Record<string, { fullFrame?: { normal?: Capture } } | undefined>)
    .__solaceHyper3dWelcomeLipSync;
  return surface?.fullFrame?.normal ?? null;
}

describe("hyper3d acoustic capture plumbing", () => {
  it("keeps a finalized capture's acoustic frames when the report refreshes after the turn", async () => {
    const adapter = createHyper3dLiveSpeechAdapter({
      getContextTime: () => 10,
      isPipelineActive: () => true,
    });

    adapter.beginTurn();
    adapter.onChunkScheduled({
      audioContextStartTime: 10,
      durationMs: 300,
      leadInSec: 0,
      timeline: TIMELINE,
      chunkIndex: 0,
      sentence: "Hello there.",
      scheduledAtMs: 0,
      isWelcome: false,
      audioBuffer: toneBuffer(),
      associationMethod: "bundled",
    });

    // `acoustics.appendChunk` runs on a `setTimeout(0)`, off the scheduler path.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const during = normalCapture();
    expect(during).not.toBeNull();
    const analysed = adapter.getAcousticFrames().length;
    expect(analysed).toBeGreaterThan(0);

    // End of turn: finalize copies the frames, then the turn-scoped analyser is emptied.
    adapter.cancel("end-of-turn");
    const finalized = normalCapture();
    expect(finalized?.finalized).toBe(true);
    expect(finalized?.acousticFrames.length).toBe(analysed);
    expect(adapter.getAcousticFrames().length).toBe(0);

    // What `buildHyper3dReplyReport()` does at export time. Without the guard in
    // `copyAcousticsIntoCapture` this wiped the copy above and the report read 0.
    adapter.refreshDiagnosticsAcoustics();
    expect(normalCapture()?.acousticFrames.length).toBe(analysed);
  });

  it("still refreshes a capture whose turn is still current", async () => {
    const adapter = createHyper3dLiveSpeechAdapter({
      getContextTime: () => 20,
      isPipelineActive: () => true,
    });

    adapter.beginTurn();
    adapter.onChunkScheduled({
      audioContextStartTime: 20,
      durationMs: 300,
      leadInSec: 0,
      timeline: TIMELINE,
      chunkIndex: 0,
      sentence: "Hello there.",
      scheduledAtMs: 0,
      isWelcome: false,
      audioBuffer: toneBuffer(),
      associationMethod: "bundled",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const capture = normalCapture();
    expect(capture?.finalized).toBe(false);
    // The live path fills the capture through the refresh, not through finalize.
    adapter.refreshDiagnosticsAcoustics();
    expect(normalCapture()?.acousticFrames.length).toBe(adapter.getAcousticFrames().length);
    expect(normalCapture()?.acousticFrames.length).toBeGreaterThan(0);
  });
});
