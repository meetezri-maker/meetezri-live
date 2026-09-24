import { afterEach, describe, expect, it } from "vitest";
import { buildHyper3dReplyReport, formatHyper3dReplyReport } from "./hyper3dReplyReport";
import type {
  Hyper3dFullFrameCapture,
  Hyper3dFullFrameRecord,
  Hyper3dMouthStageSample,
} from "./hyper3dLiveSpeechAdapter";

/**
 * A SMOKE TEST, not a measurement.
 *
 * The report is read once, live, at the end of a real conversational test. A
 * throw at that moment costs the whole run, so the paths that matter here are
 * "there is no capture", "a multi-chunk capture renders end to end", and "the
 * lag fit recovers a shift it was given". Nothing below asserts anything about
 * the avatar's real behaviour.
 */

const stage = (jaw: number): Hyper3dMouthStageSample => ({
  jawOpen: jaw,
  mouthClose: 0,
  mouthFunnel: 0,
  mouthPucker: 0,
  mouthMax: jaw,
});

const frame = (responseClock: number, jaw: number, contextTime: number): Hyper3dFullFrameRecord => ({
  frame: 0,
  nowMs: responseClock * 1000,
  contextTime,
  deltaSeconds: 0.016,
  instantFps: 60,
  responseClock,
  chunkLocalClock: responseClock,
  audioActive: true,
  transport: "playing",
  timelineIndex: null,
  phoneme: null,
  phonemeStart: null,
  phonemeEnd: null,
  phonemePosition: null,
  speechActive: true,
  controller: { jawOpen: jaw, mouthClose: 0, mouthFunnel: 0, mouthPucker: 0 },
  final: { jawOpen: jaw, mouthClose: 0, mouthFunnel: 0, mouthPucker: 0 },
  glb: { jawOpen: jaw, mouthClose: 0, mouthFunnel: 0, mouthPucker: 0 },
  teethJawOpen: jaw,
  controllerMaxChannel: "jawOpen",
  controllerMaxValue: jaw,
  presenceOwns: false,
  showcaseActive: false,
  showcaseYieldReason: "speaking",
  isSpeaking: true,
  showcaseOwnsLowerFace: false,
  stages: { seam: stage(jaw), affect: stage(jaw), presence: stage(jaw) },
});

/**
 * An APERIODIC pulse train. A periodic one correlates just as well a whole
 * period out, which is exactly the false peak the tie-break exists to reject —
 * so the fixture must not be periodic or the test proves nothing about the
 * normal case.
 */
const ONSETS = [0.05, 0.31, 0.44, 0.83, 1.02, 1.55, 1.71, 2.14, 2.6, 2.79, 3.28, 3.55, 3.9];
const pulse = (t: number): number => {
  for (const onset of ONSETS) {
    if (t >= onset && t < onset + 0.12) return 1;
  }
  return 0;
};

function capture(options: {
  chunks: number;
  /** Seconds the VISUAL leads the audio. 0 = perfectly aligned. */
  visualLeadSeconds: number;
  /** A deliberate seam error between chunk 0 and chunk 1, seconds. */
  seamErrorSeconds?: number;
}): Hyper3dFullFrameCapture {
  const chunkSeconds = 2;
  const total = chunkSeconds * options.chunks;
  const frames: Hyper3dFullFrameRecord[] = [];
  for (let t = 0; t < total; t += 1 / 60) {
    // The visual leads by `visualLeadSeconds`: it shows at t what audio does later.
    frames.push(frame(t, pulse(t + options.visualLeadSeconds), 10 + t));
  }
  const acousticFrames: Array<{ time: number; energy: number; voicing: number }> = [];
  for (let t = 0; t < total; t += 0.01) {
    acousticFrames.push({ time: t, energy: pulse(t), voicing: 1 });
  }
  return {
    kind: "normal",
    turnId: 7,
    finalized: true,
    truncatedFrames: 0,
    chunks: Array.from({ length: options.chunks }, (_, index) => ({
      chunkIndex: index,
      sentence: `chunk ${index}`,
      rawPhonemeFormat: "timestamped" as const,
      timestampsExplicit: true,
      audioB64Present: false,
      associationMethod: "exact-index",
      audioContextStartTime:
        10 + index * chunkSeconds + (index > 0 ? (options.seamErrorSeconds ?? 0) : 0),
      durationMs: chunkSeconds * 1000,
      leadInSec: 0,
      scheduledAtMs: index * 100,
      expectedAudibleEndContextTime: 10 + (index + 1) * chunkSeconds,
      responseOffsetSeconds: index * chunkSeconds,
      decodedDurationSeconds: chunkSeconds,
      decodedSampleRate: 24000,
      decodedChannels: 1,
      appendResult: "accepted",
      appendedPhonemes: 2,
      backendPhonemes: [
        { index: 0, phoneme: "M", rawPhoneme: "M", start: 0, end: 0.2, duration: 0.2 },
        { index: 1, phoneme: "AA", rawPhoneme: "AA", start: 0.2, end: 0.4, duration: 0.2 },
      ],
      backendFirstStart: 0,
      backendLastEnd: 0.4,
      backendPhonemeCount: 2,
    })),
    timelinePhonemes: Array.from({ length: options.chunks * 5 }, (_, index) => ({
      index,
      phoneme: index % 2 === 0 ? "M" : "AA",
      rawPhoneme: null,
      start: index * 0.2,
      end: index * 0.2 + 0.2,
      duration: 0.2,
    })),
    responseOriginContextTime: 10,
    frames,
    acousticFrames,
    viewport: null,
  };
}

function publish(value: Hyper3dFullFrameCapture | null): void {
  (window as unknown as Record<string, unknown>).__solaceHyper3dWelcomeLipSync = {
    fullFrame: { welcome: null, normal: value },
  };
}

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__solaceHyper3dWelcomeLipSync;
});

describe("Hyper3D normal-reply report", () => {
  it("says so, without throwing, when no normal turn has been captured", () => {
    publish(null);
    const report = buildHyper3dReplyReport();
    expect(report.available).toBe(false);
    expect(report.unavailableReason).toContain("NORMAL");
    expect(() => formatHyper3dReplyReport(report)).not.toThrow();
  });

  it("renders a multi-chunk capture end to end", () => {
    publish(capture({ chunks: 3, visualLeadSeconds: 0 }));
    const report = buildHyper3dReplyReport();
    expect(report.available).toBe(true);
    expect(report.chunkCount).toBe(3);
    expect(report.boundaries).toHaveLength(2);
    expect(report.articulation.controllerEqualsFinal).toBe(true);
    expect(report.articulation.finalEqualsGlb).toBe(true);
    // responseClock is exactly contextTime − origin in the fixture.
    expect(report.clock.maxAbsDeltaMs).toBe(0);
    expect(report.landmarks.length).toBeGreaterThan(0);
    const text = formatHyper3dReplyReport(report);
    expect(text).toContain("## G. CHUNK BOUNDARIES");
    expect(text).toContain("## H/I. SYNC MEASUREMENT");
  });

  it("recovers a visual lead it was given, with the documented sign", () => {
    publish(capture({ chunks: 2, visualLeadSeconds: 0.1 }));
    const fit = buildHyper3dReplyReport().sync.visualVsAudio.overall;
    expect(fit.leadMs).not.toBeNull();
    // Positive = early. The grid is 10 ms and the search step 5 ms.
    expect(fit.leadMs as number).toBeGreaterThan(80);
    expect(fit.leadMs as number).toBeLessThan(120);
  });

  it("reports an aligned capture as having no lead", () => {
    publish(capture({ chunks: 2, visualLeadSeconds: 0 }));
    const fit = buildHyper3dReplyReport().sync.visualVsAudio.overall;
    expect(Math.abs(fit.leadMs as number)).toBeLessThanOrEqual(20);
  });

  it("flags a chunk boundary whose audio seam and timeline seam disagree", () => {
    publish(capture({ chunks: 2, visualLeadSeconds: 0, seamErrorSeconds: 0.25 }));
    const boundary = buildHyper3dReplyReport().boundaries[0];
    expect(boundary.audioSeamMs).toBe(250);
    expect(boundary.note).toContain("does not match");
  });
});
