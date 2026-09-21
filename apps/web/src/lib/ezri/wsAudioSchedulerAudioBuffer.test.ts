import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EzriWsAudioScheduler } from "./wsAudioScheduler";

/**
 * Guards for the ONE additive change to the scheduler: `onChunkScheduled` now
 * carries the `AudioBuffer` it already decoded.
 *
 * These exist to prove the exposure is additive — same buffer object, same
 * scheduled start time, same ordering — rather than a new decode path.
 */

type Listener = () => void;

class FakeAudioBuffer {
  constructor(
    readonly duration: number,
    readonly sampleRate = 24000,
    readonly numberOfChannels = 1,
  ) {}
  get length() {
    return Math.round(this.duration * this.sampleRate);
  }
  // Loud enough that computeLeadInSec finds an immediate onset (no trim).
  getChannelData() {
    return new Float32Array(this.length).fill(0.5);
  }
}

const decodedBuffers: FakeAudioBuffer[] = [];
const startedAt: number[] = [];

class FakeAudioContext {
  currentTime = 10;
  state: AudioContextState = "running";
  destination = {} as AudioNode;
  sampleRate = 24000;
  createGain() {
    return { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} };
  }
  createAnalyser() {
    return { fftSize: 1024, smoothingTimeConstant: 0, connect() {}, getByteTimeDomainData() {} };
  }
  createBufferSource() {
    return {
      buffer: null as unknown,
      onended: null as Listener | null,
      connect() {},
      start(when: number) {
        startedAt.push(when);
      },
      stop() {},
    };
  }
  createBuffer(_ch: number, length: number, rate: number) {
    return new FakeAudioBuffer(length / rate, rate);
  }
  async decodeAudioData() {
    const buffer = new FakeAudioBuffer(1.0);
    decodedBuffers.push(buffer);
    return buffer as unknown as AudioBuffer;
  }
  async resume() {}
}

/**
 * A Blob-like carrying a minimal RIFF header, so the scheduler's format sniff
 * takes the WAV path. jsdom's own Blob has no `arrayBuffer()`, which the
 * scheduler calls, so this supplies one.
 */
const wavBlob = () => {
  const bytes = new Uint8Array(64);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  bytes.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"
  return {
    type: "audio/wav",
    size: bytes.byteLength,
    arrayBuffer: async () => bytes.buffer.slice(0),
  } as unknown as Blob;
};

beforeEach(() => {
  decodedBuffers.length = 0;
  startedAt.length = 0;
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("window", {
    ...(globalThis as unknown as Window),
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    AudioContext: FakeAudioContext,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("scheduler exposes its already-decoded AudioBuffer", () => {
  it("hands onChunkScheduled the SAME buffer object it decoded", async () => {
    const seen: Array<{ audioBuffer: AudioBuffer; audioContextStartTime: number }> = [];
    const errors: unknown[] = [];
    const scheduler = new EzriWsAudioScheduler({
      onScheduleError: (error) => errors.push(error),
      onChunkScheduled: (_meta, timing) => {
        seen.push({
          audioBuffer: timing.audioBuffer,
          audioContextStartTime: timing.audioContextStartTime,
        });
      },
    });

    await scheduler.schedule(
      { kind: "blob", blob: wavBlob() },
      { subtitle: "one", chunkId: "c0" },
    );

    expect(errors).toEqual([]);
    expect(seen).toHaveLength(1);
    expect(decodedBuffers).toHaveLength(1);
    // Identity, not equality: no copy, no re-decode, no second buffer.
    expect(seen[0].audioBuffer).toBe(decodedBuffers[0] as unknown as AudioBuffer);
  });

  it("reports the same start time it passed to source.start", async () => {
    const seen: number[] = [];
    const scheduler = new EzriWsAudioScheduler({
      onChunkScheduled: (_meta, timing) => seen.push(timing.audioContextStartTime),
    });

    await scheduler.schedule(
      { kind: "blob", blob: wavBlob() },
      { subtitle: "one", chunkId: "c0" },
    );

    expect(startedAt).toHaveLength(1);
    // The exposure must not have shifted scheduling by so much as a sample.
    expect(seen[0]).toBe(startedAt[0]);
  });

  it("decodes each chunk exactly once", async () => {
    const scheduler = new EzriWsAudioScheduler({ onChunkScheduled: () => {} });
    const blob = { kind: "blob" as const, blob: wavBlob() };

    await scheduler.schedule(blob, { subtitle: "one", chunkId: "c0" });
    await scheduler.schedule(blob, { subtitle: "two", chunkId: "c1" });

    // Two chunks, two decodes — the avatar's analysis adds none.
    expect(decodedBuffers).toHaveLength(2);
  });

  it("keeps chunks in schedule order and advances the timeline by audible duration", async () => {
    const seen: number[] = [];
    const scheduler = new EzriWsAudioScheduler({
      onChunkScheduled: (_meta, timing) => seen.push(timing.audioContextStartTime),
    });
    const blob = { kind: "blob" as const, blob: wavBlob() };

    await scheduler.schedule(blob, { subtitle: "one", chunkId: "c0" });
    await scheduler.schedule(blob, { subtitle: "two", chunkId: "c1" });

    expect(seen[1]).toBeGreaterThan(seen[0]);
    // Each fake buffer is 1.0 s and the onset is immediate, so the second chunk
    // starts one audible second after the first.
    expect(seen[1] - seen[0]).toBeCloseTo(1.0, 6);
  });
});
