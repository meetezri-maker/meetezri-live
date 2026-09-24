import { describe, expect, it } from "vitest";
import {
  analyzeFullFrameCapture,
  comparePhonemePeaks,
  parseAcceptedVowelJawPeaks,
} from "./hyper3dFrameCaptureAnalysis";
import type { Hyper3dFullFrameCapture, Hyper3dFullFrameRecord } from "./hyper3dLiveSpeechAdapter";

/** Validates the Phase 2G.1 analysis tool's arithmetic on a hand-built capture. Not a measurement. */

const frame = (nowMs: number, responseClock: number, jaw: number): Hyper3dFullFrameRecord => ({
  frame: 0,
  nowMs,
  contextTime: null,
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
  controller: { jawOpen: jaw },
  final: { jawOpen: jaw },
  glb: { jawOpen: jaw },
  teethJawOpen: jaw,
  controllerMaxChannel: "jawOpen",
  controllerMaxValue: jaw,
  presenceOwns: false,
  showcaseActive: false,
  showcaseYieldReason: "speaking",
  isSpeaking: true,
  showcaseOwnsLowerFace: false,
  stages: {
    seam: { jawOpen: jaw, mouthClose: 0, mouthFunnel: 0, mouthPucker: 0, mouthMax: jaw },
    affect: { jawOpen: jaw, mouthClose: 0, mouthFunnel: 0, mouthPucker: 0, mouthMax: jaw },
    presence: { jawOpen: jaw, mouthClose: 0, mouthFunnel: 0, mouthPucker: 0, mouthMax: jaw },
  },
});

const capture = (frames: Hyper3dFullFrameRecord[]): Hyper3dFullFrameCapture => ({
  kind: "welcome",
  turnId: 1,
  finalized: true,
  truncatedFrames: 0,
  chunks: [
    {
      chunkIndex: 0,
      sentence: "test",
      rawPhonemeFormat: "timestamped",
      timestampsExplicit: true,
      audioB64Present: false,
      associationMethod: "exact-index",
      audioContextStartTime: 1,
      durationMs: 400,
      leadInSec: 0.1,
      scheduledAtMs: 0,
      expectedAudibleEndContextTime: 1.4,
      responseOffsetSeconds: 0,
      decodedDurationSeconds: 0.5,
      decodedSampleRate: 24000,
      decodedChannels: 1,
      appendResult: "accepted",
      appendedPhonemes: 2,
      backendPhonemes: [
        { index: 0, phoneme: "AA", rawPhoneme: "AA1", start: 0, end: 0.2, duration: 0.2 },
        { index: 1, phoneme: "S", rawPhoneme: "S", start: 0.2, end: 0.45, duration: 0.25 },
      ],
      backendFirstStart: 0,
      backendLastEnd: 0.45,
      backendPhonemeCount: 2,
    },
  ],
  timelinePhonemes: [
    { index: 0, phoneme: "AA", rawPhoneme: null, start: 0, end: 0.2, duration: 0.2 },
    { index: 1, phoneme: "S", rawPhoneme: null, start: 0.2, end: 0.4, duration: 0.2 },
  ],
  responseOriginContextTime: 1,
  frames,
  acousticFrames: [],
  viewport: null,
});

describe("hyper3dFrameCaptureAnalysis", () => {
  it("measures wall-clock frame gaps, per-phoneme frames and peaks, and the timing domains", () => {
    const analysis = analyzeFullFrameCapture(
      capture([frame(0, 0.05, 0.1), frame(70, 0.12, 0.3), frame(140, 0.25, 0.02)]),
    );
    expect(analysis.frames.count).toBe(3);
    expect(analysis.frames.averageFps).toBeCloseTo(2000 / 140, 6);
    expect(analysis.frames.over66ms).toBe(2);
    expect(analysis.phonemes[0]).toMatchObject({ frames: 2, peakGlbJawOpen: 0.3 });
    expect(analysis.phonemes[1]).toMatchObject({ frames: 1, oneFrame: true, peakGlbJawOpen: 0.02 });
    expect(analysis.identity.controllerEqualsFinal).toBe(true);
    expect(analysis.timing.droppedPhonemes).toBe(0);
    expect(analysis.timing.backendPhonemesEndingBeyondAudible).toBe(1);
    expect(analysis.timing.backendEndMinusAudible).toBeCloseTo(0.05, 6);
    expect(analysis.timing.decodedMinusAudible).toBeCloseTo(0.1, 6);

    const compared = comparePhonemePeaks(analysis, analyzeFullFrameCapture(capture([frame(0, 0.1, 0.4)])));
    expect(compared[0].liveOverReplayGlbJaw).toBeCloseTo(0.75, 6);
  });

  it("parses the accepted jaw column from the measurement table", () => {
    const table = [
      "| AA | 0.315 · 0.035 · 0.018 | **0.353** · 0.035 · 0.018 | more open |",
      "| AE | 0.250 · 0.000 · 0.191 | **0.286 · 0.000 · 0.273** | open |",
      "| EH | 0.138 · 0.043 · 0.147 | 0.149 · 0.043 · **0.196** | mid |",
      "| OY | *(0 occurrences)* | jaw 0.30 | design only |",
    ].join("\n");
    expect(parseAcceptedVowelJawPeaks(table)).toEqual({ AA: 0.353, AE: 0.286, EH: 0.149 });
  });
});
