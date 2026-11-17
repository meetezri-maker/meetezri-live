import { describe, expect, it } from "vitest";
import type { AvatarPhonemeTimeline } from "../avatarMorphTypes";
import { createLiveSpeechTimeline } from "./liveSpeechTimeline";
import { createHyper3dLiveSpeechAdapter, measureAudibleSpeechEnd } from "./hyper3dLiveSpeechAdapter";
import type { TimedPhoneme } from "./liveAvatarPayload";

/**
 * TRAILING QUIET AUDIO — streamed (`sentence-relative`) replies.
 *
 * A live capture showed each sentence's last chunk ending in quiet, non-zero
 * audio (254 ms and 433 ms) before the injected all-zero chunk, and the mouth
 * articulating across it. These tests pin the fix: phonemes end where speech
 * energy ends, while the audio, the clock and every chunk offset stay as they were.
 */

const SR = 24000;
const ORIGIN = 100;

/** Deterministic signal builders: rms is what the detector measures. */
function segment(seconds: number, kind: "speech" | "quiet" | "fricative" | "softFricative" | "zero"): number[] {
  const n = Math.round(seconds * SR);
  const out = new Array<number>(n);
  let seed = 12345;
  const noise = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return (seed / 2147483648) * 2 - 1; // uniform [-1, 1): rms = 1/sqrt(3)
  };
  for (let i = 0; i < n; i += 1) {
    if (kind === "speech") out[i] = 0.14 * Math.sin((2 * Math.PI * 220 * i) / SR); // rms ~0.1
    else if (kind === "quiet") out[i] = 0.0052 * noise(); // rms ~0.003, like the captured tails
    else if (kind === "fricative") out[i] = 0.0208 * noise(); // rms ~0.012: a soft /s/
    else if (kind === "softFricative") out[i] = 0.0104 * noise(); // rms ~0.006: a very soft /f/
    else out[i] = 0;
  }
  return out;
}
const bufferOf = (...parts: number[][]) => {
  const samples = Float32Array.from(parts.flat());
  return { sampleRate: SR, length: samples.length, numberOfChannels: 1, getChannelData: () => samples };
};
const seconds = (buffer: { length: number }) => buffer.length / SR;

describe("measureAudibleSpeechEnd", () => {
  it("cuts a quiet tail at the last speech energy plus the 50 ms pad", () => {
    const b = bufferOf(segment(0.2, "speech"), segment(0.3, "quiet"));
    expect(measureAudibleSpeechEnd(b, 0, seconds(b))!).toBeCloseTo(0.25, 2);
  });

  it("keeps a chunk that is speech to its end", () => {
    const b = bufferOf(segment(0.5, "speech"));
    expect(measureAudibleSpeechEnd(b, 0, seconds(b))).toBeCloseTo(0.5, 6);
  });

  it("does not cut a quiet stretch shorter than the minimum tail", () => {
    const b = bufferOf(segment(0.44, "speech"), segment(0.06, "quiet"));
    expect(measureAudibleSpeechEnd(b, 0, seconds(b))).toBeCloseTo(0.5, 6);
  });

  it("keeps a soft final /s/ above the speech floor as speech", () => {
    const b = bufferOf(segment(0.2, "speech"), segment(0.15, "fricative"), segment(0.3, "quiet"));
    // speech + /s/ = 0.35 s; the pad adds 50 ms on top of the /s/, not of the vowel.
    expect(measureAudibleSpeechEnd(b, 0, seconds(b))!).toBeCloseTo(0.4, 2);
  });

  it("does not cut a short, very soft final /f/", () => {
    const b = bufferOf(segment(0.4, "speech"), segment(0.08, "softFricative"));
    expect(measureAudibleSpeechEnd(b, 0, seconds(b))).toBeCloseTo(0.48, 6);
  });

  it("reports a chunk with no sustained speech energy as null", () => {
    const b = bufferOf(segment(0.5, "quiet"));
    expect(measureAudibleSpeechEnd(b, 0, seconds(b))).toBeNull();
  });

  it("measures from the audible start, after the skipped lead-in", () => {
    const b = bufferOf(segment(0.2, "zero"), segment(0.3, "speech"), segment(0.3, "quiet"));
    expect(measureAudibleSpeechEnd(b, 0.2, 0.6)!).toBeCloseTo(0.35, 2);
  });

  it("cannot measure without a usable buffer", () => {
    expect(measureAudibleSpeechEnd(null, 0, 0.5)).toBeUndefined();
    // Lead-in consumes the whole buffer: nothing audible left to measure.
    expect(measureAudibleSpeechEnd(bufferOf(segment(0.02, "speech")), 0.02, 0.02)).toBeUndefined();
  });

  it("judges a chunk shorter than three windows by whole-chunk RMS: quiet is null", () => {
    const b = bufferOf(segment(0.022, "quiet"));
    expect(measureAudibleSpeechEnd(b, 0, seconds(b))).toBeNull();
  });

  it("keeps a short audible chunk whole", () => {
    const b = bufferOf(segment(0.022, "speech"));
    expect(measureAudibleSpeechEnd(b, 0, seconds(b))).toBeCloseTo(0.022, 6);
    const soft = bufferOf(segment(0.022, "fricative")); // rms ~0.012, above the floor
    expect(measureAudibleSpeechEnd(soft, 0, seconds(soft))).toBeCloseTo(0.022, 6);
  });
});

/** `count` contiguous backend phonemes over `span` s; the last labels are F AY V S. */
function backendPhonemes(count: number, span: number): AvatarPhonemeTimeline["phonemes"] {
  const labels = ["HH", "AH", "L", "OW", "M", "AA", "B", "IY", "P", "EH", "N", "D"];
  const tail = ["F", "AY", "V", "S"];
  const step = span / count;
  return Array.from({ length: count }, (_, i) => {
    const label = i >= count - tail.length ? tail[i - (count - tail.length)] : labels[i % labels.length];
    return { phoneme: label, rawPhoneme: label, start: +(i * step).toFixed(4), end: +((i + 1) * step).toFixed(4) };
  });
}

/** One streamed chunk: `speechEnd` is what the adapter would measure (undefined = not measured). */
type Chunk = { duration: number; phonemes?: AvatarPhonemeTimeline["phonemes"]; speechEnd?: number | null; zero?: boolean };

function stream(chunks: Chunk[], options: { ignoreSpeechEnd?: boolean } = {}) {
  const timeline = createLiveSpeechTimeline();
  timeline.beginTurn();
  const offsets: number[] = [];
  let t = ORIGIN;
  chunks.forEach((c, i) => {
    const result = timeline.appendScheduledChunk({
      audioContextStartTime: t,
      durationSeconds: c.duration,
      leadInSeconds: 0,
      phonemeTimeDomain: "sentence-relative",
      timeline: c.phonemes ? { sentence: `s${i}`, sentiment: null, phonemeFormat: "timestamped", phonemes: c.phonemes } : null,
      chunkIndex: i,
      sentence: c.phonemes ? `s${i}` : "",
      // Streaming arrives well ahead of playback, as in the live capture.
      contextTimeAtAppend: ORIGIN - 1,
      digitalSilence: c.zero === true,
      ...(options.ignoreSpeechEnd ? {} : { speechEndSeconds: c.speechEnd }),
    });
    offsets.push(result.accepted ? result.chunkOffsetSeconds : t - ORIGIN);
    t += c.duration;
  });
  return { timeline, offsets, phonemes: timeline.getPayload().phonemes };
}

const lastEnd = (phonemes: readonly TimedPhoneme[]) => phonemes[phonemes.length - 1].end_time;
const activeAt = (phonemes: readonly TimedPhoneme[], t: number) =>
  phonemes.find((p) => t >= p.start_time && t < p.end_time);
const expectOrderedAndWhole = (phonemes: readonly TimedPhoneme[], count: number) => {
  expect(phonemes).toHaveLength(count);
  for (let i = 0; i < phonemes.length; i += 1) {
    expect(phonemes[i].end_time - phonemes[i].start_time).toBeGreaterThan(0);
    if (i > 0) expect(phonemes[i].start_time).toBeGreaterThanOrEqual(phonemes[i - 1].end_time - 1e-9);
  }
};
const ofSentence = (phonemes: readonly TimedPhoneme[], chunkIndex: number) =>
  phonemes.filter((p) => p.id.includes(`-s${chunkIndex}-`));

/** A final sentence: 0.3 s first chunk, speech chunks, a 0.5 s last chunk with `tail` s of quiet, then 250 ms zero. */
const finalSentence = (tail: number, measured = true): Chunk[] => [
  { duration: 0.3, phonemes: backendPhonemes(24, 2.3), speechEnd: measured ? 0.3 : undefined },
  ...Array.from({ length: 16 }, () => ({ duration: 0.1, speechEnd: measured ? 0.1 : undefined })),
  { duration: 0.5, speechEnd: measured ? 0.5 - tail : undefined },
  { duration: 0.25, zero: true },
];

describe("final sentence completion", () => {
  it("ends the last phoneme where speech ends, not where the quiet tail ends", () => {
    const before = stream(finalSentence(0.4, false));
    const after = stream(finalSentence(0.4));
    // Speech: 0.3 + 1.6 + 0.1 = 2.0 s; the tail runs to 2.4 s; zero chunk to 2.65 s.
    expect(lastEnd(before.phonemes)).toBeCloseTo(2.4, 6);
    expect(lastEnd(after.phonemes)).toBeCloseTo(2.0, 6);
    expectOrderedAndWhole(after.phonemes, 24);
    for (let t = 2.0; t < 2.65; t += 0.005) expect(activeAt(after.phonemes, t)).toBeUndefined();
  });

  it("keeps audio duration and every chunk offset exactly as before", () => {
    const before = stream(finalSentence(0.4, false));
    const after = stream(finalSentence(0.4));
    expect(after.timeline.getAudioDuration()).toBe(before.timeline.getAudioDuration());
    expect(after.timeline.getAudioDuration()).toBeCloseTo(2.65, 6);
    expect(after.offsets).toEqual(before.offsets);
  });

  it("keeps the soft final consonants F, AY, V, S, each with real duration", () => {
    const tail = stream(finalSentence(0.4)).phonemes.slice(-4);
    expect(tail.map((p) => p.phoneme)).toEqual(["F", "AY", "V", "S"]);
    for (const p of tail) expect(p.end_time - p.start_time).toBeGreaterThan(0.05);
  });

  it("does not cut a quiet stretch the detector kept as speech", () => {
    // The detector reports the full chunk for a short tail; nothing moves.
    expect(lastEnd(stream(finalSentence(0)).phonemes)).toBeCloseTo(2.4, 6);
  });

  it("an unmeasured stream is byte-identical to the previous behaviour", () => {
    const chunks = finalSentence(0.4, false);
    expect(stream(chunks).phonemes).toEqual(stream(chunks, { ignoreSpeechEnd: true }).phonemes);
  });
});

describe("multi-chunk and multi-sentence timing", () => {
  it("does not move the next sentence's start", () => {
    const reply = (measured: boolean): Chunk[] => [
      ...finalSentence(0.3, measured),
      { duration: 0.3, phonemes: backendPhonemes(20, 1.6), speechEnd: measured ? 0.3 : undefined },
      ...Array.from({ length: 12 }, () => ({ duration: 0.1, speechEnd: measured ? 0.1 : undefined })),
      { duration: 0.25, zero: true },
    ];
    const before = stream(reply(false));
    const after = stream(reply(true));
    const second = finalSentence(0.3).length;
    expect(after.offsets).toEqual(before.offsets);
    const s1 = ofSentence(after.phonemes, 0);
    const s2 = ofSentence(after.phonemes, second);
    expect(lastEnd(s1)).toBeCloseTo(2.1, 6); // 2.4 s of PCM minus 0.3 s of tail
    expect(s2[0].start_time).toBeCloseTo(after.offsets[second], 9);
    expect(s2[0].start_time).toBe(ofSentence(before.phonemes, second)[0].start_time);
    expectOrderedAndWhole(after.phonemes, 44);
  });

  it("a natural pause inside a sentence does not end it: later speech extends again", () => {
    const chunks: Chunk[] = [
      { duration: 0.3, phonemes: backendPhonemes(30, 2.6), speechEnd: 0.3 },
      ...Array.from({ length: 8 }, () => ({ duration: 0.1, speechEnd: 0.1 })),
      { duration: 0.2, speechEnd: 0.05 }, // speech fades into the pause
      { duration: 0.3, speechEnd: null }, // the pause itself: no energy
      ...Array.from({ length: 10 }, () => ({ duration: 0.1, speechEnd: 0.1 })),
      { duration: 0.4, speechEnd: 0.1 }, // the final quiet tail
      { duration: 0.25, zero: true },
    ];
    const { phonemes } = stream(chunks);
    // Speech resumes at 1.6 s and ends at 2.6 + 0.1 = 2.7 s.
    expect(lastEnd(phonemes)).toBeCloseTo(2.7, 6);
    expect(phonemes.some((p) => p.start_time > 1.6)).toBe(true);
    expectOrderedAndWhole(phonemes, 30);
  });

  it("quiet continuation chunks after speech do not extend articulation", () => {
    const chunks: Chunk[] = [
      { duration: 0.3, phonemes: backendPhonemes(20, 1.9), speechEnd: 0.3 },
      ...Array.from({ length: 12 }, () => ({ duration: 0.1, speechEnd: 0.1 })),
      { duration: 0.2, speechEnd: null },
      { duration: 0.2, speechEnd: null },
      { duration: 0.25, zero: true },
    ];
    const { phonemes } = stream(chunks);
    expect(lastEnd(phonemes)).toBeCloseTo(1.5, 6);
    expectOrderedAndWhole(phonemes, 20);
  });

  it("a sentence with no measured energy anywhere keeps the previous behaviour", () => {
    const quiet: Chunk[] = [
      { duration: 0.3, phonemes: backendPhonemes(16, 1.4), speechEnd: null },
      ...Array.from({ length: 10 }, () => ({ duration: 0.1, speechEnd: null })),
      { duration: 0.25, zero: true },
    ];
    const unmeasured = quiet.map((c) => ({ ...c, speechEnd: undefined }));
    expect(stream(quiet).phonemes).toEqual(stream(unmeasured).phonemes);
    expect(lastEnd(stream(quiet).phonemes)).toBeCloseTo(1.3, 6);
  });

  it("a final sentence closed by a following sentence (no zero chunk) also ends at speech", () => {
    const chunks: Chunk[] = [
      ...finalSentence(0.4).filter((c) => !c.zero),
      { duration: 0.3, phonemes: backendPhonemes(10, 0.8), speechEnd: 0.3 },
    ];
    const { phonemes } = stream(chunks);
    expect(lastEnd(ofSentence(phonemes, 0))).toBeCloseTo(2.0, 6);
  });
});

describe("adapter end to end, real buffers", () => {
  function run(audioFormat: "pcm_s16le" | "wav", withTail: boolean, shortLast?: "quiet" | "speech") {
    const parts: Array<{ samples: number[]; phonemes?: AvatarPhonemeTimeline["phonemes"]; zero?: boolean }> = [
      { samples: segment(0.3, "speech"), phonemes: backendPhonemes(24, 2.3) },
      ...Array.from({ length: 16 }, () => ({ samples: segment(0.1, "speech") })),
      { samples: withTail ? [...segment(0.1, "speech"), ...segment(0.4, "quiet")] : segment(0.5, "speech") },
      // Live reply 3 ended a sentence with a 22 ms chunk before the zero chunk.
      ...(shortLast ? [{ samples: segment(0.022, shortLast) }] : []),
      { samples: segment(0.25, "zero"), zero: true },
    ];
    const adapter = createHyper3dLiveSpeechAdapter({ getContextTime: () => ORIGIN - 1, isPipelineActive: () => true, now: () => 0 });
    adapter.beginTurn();
    let t = ORIGIN;
    parts.forEach((p, i) => {
      const audioBuffer = bufferOf(p.samples);
      adapter.onChunkScheduled({
        audioContextStartTime: t,
        durationMs: seconds(audioBuffer) * 1000,
        leadInSec: 0,
        chunkIndex: i,
        sentence: p.phonemes ? "final" : "",
        scheduledAtMs: 0,
        associationMethod: "bundled",
        audioFormat,
        audioBuffer,
        timeline: p.phonemes ? { sentence: "final", sentiment: null, phonemeFormat: "timestamped", phonemes: p.phonemes } : null,
      } as Parameters<typeof adapter.onChunkScheduled>[0]);
      t += seconds(audioBuffer);
    });
    return { phonemes: adapter.getPayload().phonemes, duration: adapter.getPayload().audio_duration };
  }

  it("streamed reply: articulation ends within the pad of the last speech energy", () => {
    const { phonemes, duration } = run("pcm_s16le", true);
    // Speech energy ends at 2.0 s; the detector pads 50 ms.
    expect(lastEnd(phonemes)).toBeCloseTo(2.05, 2);
    expect(duration).toBeCloseTo(2.65, 6);
    expectOrderedAndWhole(phonemes, 24);
  });

  it("P/B/M and F/V labels all survive the shorter window", () => {
    const labels = run("pcm_s16le", true).phonemes.map((p) => p.phoneme);
    for (const label of ["P", "B", "M", "F", "V"]) {
      expect(labels.filter((l) => l === label).length).toBe(backendPhonemes(24, 2.3).filter((p) => p.phoneme === label).length);
    }
  });

  it("a 22 ms quiet chunk after a trimmed tail does not re-extend articulation", () => {
    const { phonemes, duration } = run("pcm_s16le", true, "quiet");
    expect(lastEnd(phonemes)).toBeCloseTo(2.05, 2);
    expect(duration).toBeCloseTo(2.672, 6); // audio untouched: 2.4 + 0.022 + 0.25
    expectOrderedAndWhole(phonemes, 24);
  });

  it("a 22 ms audible chunk after a quiet tail still extends to its end", () => {
    const { phonemes } = run("pcm_s16le", true, "speech");
    expect(lastEnd(phonemes)).toBeCloseTo(2.422, 6);
    expectOrderedAndWhole(phonemes, 24);
  });

  it("a streamed reply without a tail is unchanged", () => {
    expect(lastEnd(run("pcm_s16le", false).phonemes)).toBeCloseTo(2.4, 6);
  });

  it("the batch WAV path never measures and is identical with or without a tail", () => {
    expect(run("wav", true).phonemes).toEqual(run("wav", false).phonemes);
  });
});
