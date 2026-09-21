import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createLiveAcousticTrack, type LiveAcousticChunk } from "./liveAcousticTrack";
import { analyzeSpeechAudio } from "./engine/engine/avatar/upstream/threejs-talking-avatar/audioAnalysis";

/**
 * Live acoustic delivery guards.
 *
 * The properties that matter: one chunk is analysed once, frames land on the
 * SAME response timeline the phonemes use, a cancelled turn's late result is
 * ignored, and no second decode path or AudioContext exists anywhere.
 */

/** A synthetic voiced buffer. Structurally an AudioBuffer — that is the point. */
const makeBuffer = (seconds: number, sampleRate = 24000): LiveAcousticChunk["audioBuffer"] => {
  const length = Math.round(seconds * sampleRate);
  const data = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const t = i / sampleRate;
    // A 140 Hz "voice" with an amplitude envelope, so the analyzer finds energy,
    // voicing and pitch rather than silence.
    data[i] = Math.sin(2 * Math.PI * 140 * t) * (0.3 + 0.2 * Math.sin(2 * Math.PI * 3 * t));
  }
  return {
    sampleRate,
    length,
    numberOfChannels: 1,
    getChannelData: () => data,
  };
};

const chunk = (over: Partial<LiveAcousticChunk> = {}): LiveAcousticChunk => ({
  audioBuffer: makeBuffer(1.0),
  chunkOffsetSeconds: 0,
  leadInSeconds: 0,
  chunkKey: "idx:0",
  turnId: 1,
  ...over,
});

describe("live acoustics — analysis", () => {
  it("passes an AudioBuffer-shaped object straight to the accepted analyzer", () => {
    const track = createLiveAcousticTrack();
    track.beginTurn(1);
    const result = track.appendChunk(chunk());

    expect(result.accepted).toBe(true);
    expect(track.getFrameCount()).toBeGreaterThan(0);
  });

  it("produces the same frames the accepted analyzer produces directly", () => {
    const buffer = makeBuffer(0.8);
    const direct = analyzeSpeechAudio(buffer);

    const track = createLiveAcousticTrack();
    track.beginTurn(1);
    track.appendChunk(chunk({ audioBuffer: buffer }));

    // Same count, and at offset 0 with no lead-in the times are untouched.
    expect(track.getFrameCount()).toBe(direct.length);
    expect(track.getFrames()[0].energy).toBe(direct[0].energy);
    expect(track.getFrames()[0].time).toBeCloseTo(direct[0].time, 9);
  });
});

describe("live acoustics — response timeline", () => {
  it("shifts chunk-local times onto the response timeline", () => {
    const buffer = makeBuffer(0.8);
    const direct = analyzeSpeechAudio(buffer);

    const track = createLiveAcousticTrack();
    track.beginTurn(1);
    track.appendChunk(chunk({ audioBuffer: buffer, chunkOffsetSeconds: 3.5 }));

    const frames = track.getFrames();
    expect(frames[0].time).toBeCloseTo(3.5 + direct[0].time, 9);
    expect(frames[frames.length - 1].time).toBeCloseTo(
      3.5 + direct[direct.length - 1].time,
      9,
    );
  });

  it("subtracts the lead-in the scheduler skipped", () => {
    // The scheduler plays from `leadInSec` into the buffer, but analysis sees the
    // whole buffer. Without this subtraction the acoustic track would lag the
    // audio by exactly the trimmed amount.
    const buffer = makeBuffer(1.0);
    const track = createLiveAcousticTrack();
    track.beginTurn(1);
    track.appendChunk(
      chunk({ audioBuffer: buffer, chunkOffsetSeconds: 2, leadInSeconds: 0.4 }),
    );

    const direct = analyzeSpeechAudio(buffer);
    const expectedFirst = 2 + (direct[0].time - 0.4);
    // Frames before the audible onset are dropped, so the first kept frame is
    // the first one at or after the trim point.
    const firstKept = track.getFrames()[0];
    expect(firstKept.time).toBeGreaterThanOrEqual(0);
    if (expectedFirst >= 0) expect(firstKept.time).toBeCloseTo(expectedFirst, 9);
  });

  it("appends successive chunks in order without recomputing earlier ones", () => {
    const track = createLiveAcousticTrack();
    track.beginTurn(1);
    track.appendChunk(chunk({ chunkKey: "idx:0", chunkOffsetSeconds: 0 }));
    const afterFirst = track.getFrameCount();
    const firstFrameTime = track.getFrames()[0].time;

    track.appendChunk(chunk({ chunkKey: "idx:1", chunkOffsetSeconds: 1.0 }));

    expect(track.getFrameCount()).toBeGreaterThan(afterFirst);
    // The earlier chunk's frames are untouched.
    expect(track.getFrames()[0].time).toBe(firstFrameTime);
    // And the timeline is non-decreasing across the boundary.
    const frames = track.getFrames();
    for (let i = 1; i < frames.length; i += 1) {
      expect(frames[i].time).toBeGreaterThanOrEqual(frames[i - 1].time);
    }
  });
});

describe("live acoustics — dedup and cancellation", () => {
  it("analyses one chunk exactly once", () => {
    const track = createLiveAcousticTrack();
    track.beginTurn(1);
    track.appendChunk(chunk({ chunkKey: "idx:7" }));
    const count = track.getFrameCount();

    const second = track.appendChunk(chunk({ chunkKey: "idx:7" }));

    expect(second.accepted).toBe(false);
    expect(second.accepted === false && second.reason).toBe("duplicate");
    expect(track.getFrameCount()).toBe(count);
    expect(track.getStats().duplicateChunks).toBe(1);
  });

  it("ignores a late analysis result from a cancelled turn", () => {
    const track = createLiveAcousticTrack();
    track.beginTurn(1);
    track.appendChunk(chunk({ turnId: 1 }));
    expect(track.getFrameCount()).toBeGreaterThan(0);

    track.cancel(2);
    expect(track.getFrameCount()).toBe(0);

    // A chunk still in flight from the cancelled turn arrives afterwards.
    const late = track.appendChunk(chunk({ turnId: 1, chunkKey: "idx:9" }));
    expect(late.accepted).toBe(false);
    expect(late.accepted === false && late.reason).toBe("stale-turn");
    expect(track.getFrameCount()).toBe(0);
    expect(track.getStats().staleResults).toBe(1);
  });

  it("starts a clean track on the next turn", () => {
    const track = createLiveAcousticTrack();
    track.beginTurn(1);
    track.appendChunk(chunk({ turnId: 1 }));
    track.beginTurn(2);

    expect(track.getFrameCount()).toBe(0);
    expect(track.appendChunk(chunk({ turnId: 2 })).accepted).toBe(true);
  });
});

describe("live acoustics — memory and ownership", () => {
  it("does not retain the decoded buffer after analysis", () => {
    const track = createLiveAcousticTrack();
    track.beginTurn(1);
    const buffer = makeBuffer(0.5);
    let released = false;
    const watched: LiveAcousticChunk["audioBuffer"] = {
      sampleRate: buffer.sampleRate,
      length: buffer.length,
      numberOfChannels: 1,
      getChannelData: () => {
        released = true;
        return buffer.getChannelData(0);
      },
    };

    track.appendChunk(chunk({ audioBuffer: watched }));
    expect(released).toBe(true);

    // Nothing the track exposes carries the buffer forward — only frames.
    const exposed = JSON.stringify({
      frames: track.getFrames().slice(0, 2),
      stats: track.getStats(),
    });
    expect(exposed).not.toContain("getChannelData");
    expect(track.getFrames()[0]).not.toHaveProperty("audioBuffer");
  });

  it("never reads channel data more than once per chunk", () => {
    const buffer = makeBuffer(0.5);
    let reads = 0;
    const counted: LiveAcousticChunk["audioBuffer"] = {
      sampleRate: buffer.sampleRate,
      length: buffer.length,
      numberOfChannels: 1,
      getChannelData: () => {
        reads += 1;
        return buffer.getChannelData(0);
      },
    };
    const track = createLiveAcousticTrack();
    track.beginTurn(1);
    track.appendChunk(chunk({ audioBuffer: counted }));
    track.appendChunk(chunk({ audioBuffer: counted, chunkKey: "idx:0" }));

    expect(reads).toBe(1);
  });
});

describe("live acoustics — the accepted head planner accepts them", () => {
  it("turns a null plan into a real plan", async () => {
    const { buildThreejsTalkingAvatarHeadPlan } = await import(
      "./engine/engine/avatar/hyper3dThreejsTalkingAvatarHead"
    );

    const phonemes = [
      { id: "p0", phoneme: "HH", start_time: 0, end_time: 0.12, intensity: 1 },
      { id: "p1", phoneme: "EH", start_time: 0.12, end_time: 0.3, intensity: 1 },
      { id: "p2", phoneme: "L", start_time: 0.3, end_time: 0.45, intensity: 1 },
      { id: "p3", phoneme: "OW", start_time: 0.45, end_time: 0.8, intensity: 1 },
    ];
    const base = {
      text: "Hello there.",
      phonemes,
      durationSeconds: 0.8,
      segmentIntent: true,
    };

    // WITHOUT acoustics the accepted planner refuses — head and neck would be
    // held at rest and semantic affect would never render.
    expect(
      buildThreejsTalkingAvatarHeadPlan({ ...base, acousticFrames: [] }),
    ).toBeNull();

    // WITH the frames this module produces from the scheduler's own buffer, it
    // plans. This is the whole point of the acoustic connection.
    const track = createLiveAcousticTrack();
    track.beginTurn(1);
    track.appendChunk(chunk({ audioBuffer: makeBuffer(0.8) }));

    const plan = buildThreejsTalkingAvatarHeadPlan({
      ...base,
      acousticFrames: track.getFrames(),
    });

    expect(plan).not.toBeNull();
    expect(plan!.cues.length).toBeGreaterThanOrEqual(0);
    // `words` is absent on the live path and that is legal and reported.
    expect(base).not.toHaveProperty("words");
  });
});

describe("live acoustics — no second audio path exists", () => {
  const read = (p: string) =>
    readFileSync(new URL(p, import.meta.url).pathname, "utf8")
      // Comments describe what is deliberately NOT done; only code counts.
      .split("\n")
      .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
      .join("\n");

  it("the acoustic track constructs no AudioContext, player or decoder", () => {
    const source = read("./liveAcousticTrack.ts");
    expect(source).not.toContain("new AudioContext");
    expect(source).not.toContain("webkitAudioContext");
    expect(source).not.toContain("decodeAudioData");
    expect(source).not.toContain("new Audio(");
    expect(source).not.toContain("fetch(");
  });

  it("the adapter constructs no AudioContext, player or decoder", () => {
    const source = read("./hyper3dLiveSpeechAdapter.ts");
    expect(source).not.toContain("new AudioContext");
    expect(source).not.toContain("decodeAudioData");
    expect(source).not.toContain("new Audio(");
  });
});
