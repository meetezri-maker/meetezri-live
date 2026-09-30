import { describe, expect, it } from "vitest";
import type { AvatarPhonemeTimeline } from "../avatarMorphTypes";
import {
  createLiveSpeechTimeline,
  phonemeTimeDomainForAssociation,
  type PhonemeTimeDomain,
} from "./liveSpeechTimeline";
import { createSolaceAudioClock } from "./solaceAudioClock";
import { normalizeLivePhoneme } from "./phonemeNormalization";

/**
 * Phase 1 integration guards. These prove the SEAM — timeline conversion,
 * deduplication, cancellation, clock mapping — and nothing else. The avatar-test
 * calibration suite is deliberately NOT migrated.
 */

const timelineOf = (
  phonemes: Array<{ phoneme: string; start: number; end?: number; raw?: string }>,
  sentence = "hello",
): AvatarPhonemeTimeline => ({
  sentence,
  sentiment: null,
  phonemeFormat: "timestamped",
  phonemes: phonemes.map((p) => ({
    phoneme: p.phoneme,
    rawPhoneme: p.raw ?? p.phoneme,
    start: p.start,
    end: p.end,
  })),
});

const chunk = (
  startTime: number,
  durationSeconds: number,
  timeline: AvatarPhonemeTimeline | null,
  chunkIndex: number | null,
  contextTimeAtAppend = startTime - 0.1,
  leadInSeconds = 0,
  phonemeTimeDomain: PhonemeTimeDomain = "audible-onset",
) => ({
  audioContextStartTime: startTime,
  durationSeconds,
  leadInSeconds,
  phonemeTimeDomain,
  timeline,
  chunkIndex,
  sentence: timeline?.sentence ?? "",
  contextTimeAtAppend,
});

describe("live speech timeline — chunk → response conversion", () => {
  it("offsets chunk-relative phoneme times onto the response timeline", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();

    // The brief's worked example: chunk scheduled at 12.500, CH at 0.120–0.220.
    t.appendScheduledChunk(
      chunk(12.5, 1.0, timelineOf([{ phoneme: "CH", start: 0.12, end: 0.22 }]), 0),
    );

    const [first] = t.getPayload().phonemes;
    expect(first.phoneme).toBe("CH");
    expect(first.start_time).toBeCloseTo(0.12, 6);
    expect(first.end_time).toBeCloseTo(0.22, 6);
    expect(t.getOrigin()).toBe(12.5);
  });

  it("keeps the second chunk aligned to its own scheduled start", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();
    t.appendScheduledChunk(
      chunk(12.5, 1.0, timelineOf([{ phoneme: "AA", start: 0, end: 0.3 }]), 0),
    );
    t.appendScheduledChunk(
      chunk(13.5, 0.8, timelineOf([{ phoneme: "IY", start: 0.1, end: 0.25 }]), 1),
    );

    const phonemes = t.getPayload().phonemes;
    expect(phonemes).toHaveLength(2);
    // Chunk 2 starts 1.0 s after the origin, so its 0.10 s phoneme lands at 1.10.
    expect(phonemes[1].start_time).toBeCloseTo(1.1, 6);
    expect(phonemes[1].end_time).toBeCloseTo(1.25, 6);
    expect(t.getAudioDuration()).toBeCloseTo(1.8, 6);
  });

  it("grows audio_duration so the clock never clamps mid-response", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();
    t.appendScheduledChunk(
      chunk(5, 0.5, timelineOf([{ phoneme: "M", start: 0, end: 0.2 }]), 0),
    );
    expect(t.getAudioDuration()).toBeCloseTo(0.5, 6);
    t.appendScheduledChunk(
      chunk(5.5, 0.7, timelineOf([{ phoneme: "N", start: 0, end: 0.2 }]), 1),
    );
    expect(t.getAudioDuration()).toBeCloseTo(1.2, 6);
  });

  it("advances audio_duration for a chunk that carries audio but no phonemes", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();
    const result = t.appendScheduledChunk(chunk(2, 0.6, null, 0));
    expect(result.accepted).toBe(false);
    expect(t.getAudioDuration()).toBeCloseTo(0.6, 6);

    // The next chunk must still land past the silent one.
    t.appendScheduledChunk(
      chunk(2.6, 0.4, timelineOf([{ phoneme: "S", start: 0, end: 0.2 }]), 1),
    );
    expect(t.getPayload().phonemes[0].start_time).toBeCloseTo(0.6, 6);
  });

  it("clips phonemes into their own chunk so chunks cannot overlap", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();
    // A phoneme whose end runs past the chunk's audible duration.
    t.appendScheduledChunk(
      chunk(0, 0.3, timelineOf([{ phoneme: "AA", start: 0.1, end: 0.9 }]), 0),
    );
    t.appendScheduledChunk(
      chunk(0.3, 0.3, timelineOf([{ phoneme: "IY", start: 0, end: 0.2 }]), 1),
    );
    const [a, b] = t.getPayload().phonemes;
    expect(a.end_time).toBeCloseTo(0.3, 6);
    expect(b.start_time).toBeCloseTo(0.3, 6);
    expect(b.start_time).toBeGreaterThanOrEqual(a.end_time);
  });

  it("emits phonemes in non-decreasing start order", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();
    t.appendScheduledChunk(
      chunk(
        0,
        1,
        timelineOf([
          { phoneme: "HH", start: 0, end: 0.1 },
          { phoneme: "EH", start: 0.1, end: 0.25 },
          { phoneme: "L", start: 0.25, end: 0.4 },
        ]),
        0,
      ),
    );
    const phonemes = t.getPayload().phonemes;
    for (let i = 1; i < phonemes.length; i += 1) {
      expect(phonemes[i].start_time).toBeGreaterThanOrEqual(
        phonemes[i - 1].start_time,
      );
      expect(phonemes[i].end_time).toBeGreaterThan(phonemes[i].start_time);
    }
  });
});

describe("live speech timeline — stable turn identity", () => {
  it("keeps performance_seed fixed while audio_duration grows", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();
    const seed = t.getTurnIdentity();

    t.appendScheduledChunk(
      chunk(0, 1, timelineOf([{ phoneme: "AA", start: 0, end: 0.4 }]), 0),
    );
    const afterChunk1 = t.getPayload();
    t.appendScheduledChunk(
      chunk(1, 1.4, timelineOf([{ phoneme: "IY", start: 0, end: 0.4 }]), 1),
    );
    const afterChunk2 = t.getPayload();

    // The duration grew; the seed did not.
    expect(afterChunk2.audio_duration).toBeGreaterThan(afterChunk1.audio_duration);
    expect(afterChunk1.performance_seed).toBe(seed);
    expect(afterChunk2.performance_seed).toBe(seed);
    // The composition the accepted runtime would otherwise have hashed.
    expect(`${afterChunk1.id}:${undefined}:${afterChunk1.audio_duration}`).not.toBe(
      `${afterChunk2.id}:${undefined}:${afterChunk2.audio_duration}`,
    );
  });

  it("issues a new identity per turn and per cancellation", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();
    const first = t.getTurnIdentity();
    t.beginTurn();
    const second = t.getTurnIdentity();
    t.cancel();
    const third = t.getTurnIdentity();

    expect(second).not.toBe(first);
    expect(third).not.toBe(second);
  });

  it("declares live-stream audio ownership instead of inventing a URL", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();
    t.appendScheduledChunk(
      chunk(0, 1, timelineOf([{ phoneme: "AA", start: 0, end: 0.4 }]), 0),
    );
    const payload = t.getPayload();

    expect(payload.audio_owned_by).toBe("live-stream");
    expect("audio_url" in payload).toBe(false);
  });
});

describe("live speech timeline — deduplication", () => {
  it("ignores a repeated chunk_index", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();
    const tl = timelineOf([{ phoneme: "P", start: 0, end: 0.1 }]);
    expect(t.appendScheduledChunk(chunk(0, 0.5, tl, 3)).accepted).toBe(true);
    const second = t.appendScheduledChunk(chunk(0, 0.5, tl, 3));
    expect(second.accepted).toBe(false);
    expect(second.accepted === false && second.reason).toBe("duplicate");
    expect(t.getPayload().phonemes).toHaveLength(1);
    expect(t.getStats().duplicateChunks).toBe(1);
  });

  it("falls back to scheduled start + sentence when chunk_index is absent", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();
    const tl = timelineOf([{ phoneme: "B", start: 0, end: 0.1 }], "same line");
    expect(t.appendScheduledChunk(chunk(4.25, 0.5, tl, null)).accepted).toBe(true);
    expect(t.appendScheduledChunk(chunk(4.25, 0.5, tl, null)).accepted).toBe(false);
    expect(t.getPayload().phonemes).toHaveLength(1);
  });

  it("refuses a chunk that would regress the schedule", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();
    t.appendScheduledChunk(
      chunk(10, 1, timelineOf([{ phoneme: "K", start: 0, end: 0.2 }]), 0),
    );
    const back = t.appendScheduledChunk(
      chunk(9, 1, timelineOf([{ phoneme: "G", start: 0, end: 0.2 }]), 1),
    );
    expect(back.accepted).toBe(false);
    expect(back.accepted === false && back.reason).toBe("non-monotonic");
    expect(t.getPayload().phonemes).toHaveLength(1);
  });
});

describe("live speech timeline — cancellation", () => {
  it("drops every phoneme from cancelled audio", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();
    t.appendScheduledChunk(
      chunk(0, 1, timelineOf([{ phoneme: "AA", start: 0, end: 0.5 }]), 0),
    );
    expect(t.getPayload().phonemes).toHaveLength(1);

    t.cancel();
    expect(t.getPayload().phonemes).toHaveLength(0);
    expect(t.getOrigin()).toBeNull();
    expect(t.getAudioDuration()).toBe(0);
  });

  it("re-origins on a late chunk that still plays after cancellation", () => {
    // Cancellation must not latch. Solace's scheduler already guarantees that a
    // chunk belonging to CANCELLED audio never reaches this module
    // (`stop()` bumps sessionId before `source.start()`), so a chunk that does
    // arrive here is audio that genuinely plays — e.g. the late chunk Solace
    // flushes after `onPipelineIdle` — and it must get lip-sync, not silence.
    const t = createLiveSpeechTimeline();
    t.beginTurn();
    t.appendScheduledChunk(
      chunk(1, 1, timelineOf([{ phoneme: "AA", start: 0, end: 0.5 }]), 0),
    );
    t.cancel();

    const late = t.appendScheduledChunk(
      chunk(30, 1, timelineOf([{ phoneme: "IY", start: 0, end: 0.5 }]), 0),
    );
    expect(late.accepted).toBe(true);
    expect(t.getOrigin()).toBe(30);
    // The cancelled turn's phoneme is gone; only the new one remains.
    expect(t.getPayload().phonemes).toHaveLength(1);
    expect(t.getPayload().phonemes[0].phoneme).toBe("IY");
    expect(t.getPayload().phonemes[0].start_time).toBeCloseTo(0, 6);
  });

  it("gives the cancelled turn's chunk ids no hold over the next turn", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();
    t.appendScheduledChunk(
      chunk(1, 1, timelineOf([{ phoneme: "AA", start: 0, end: 0.5 }]), 0),
    );
    t.cancel();
    // Same chunk_index, new turn — must not be swallowed as a duplicate.
    expect(
      t.appendScheduledChunk(
        chunk(30, 1, timelineOf([{ phoneme: "IY", start: 0, end: 0.5 }]), 0),
      ).accepted,
    ).toBe(true);
  });

  it("accepts chunks again once a new turn begins", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();
    t.cancel();
    t.beginTurn();
    expect(
      t.appendScheduledChunk(
        chunk(20, 1, timelineOf([{ phoneme: "AA", start: 0, end: 0.5 }]), 0),
      ).accepted,
    ).toBe(true);
    expect(t.getOrigin()).toBe(20);
  });
});

describe("phoneme normalization", () => {
  it("accepts the supported set unchanged", () => {
    const result = normalizeLivePhoneme("AA");
    expect(result).toEqual({ supported: true, phoneme: "AA", exact: true });
  });

  it("strips one ARPABET stress digit", () => {
    expect(normalizeLivePhoneme("AH0")).toEqual({
      supported: true,
      phoneme: "AH",
      exact: false,
    });
    expect(normalizeLivePhoneme("EY1")).toEqual({
      supported: true,
      phoneme: "EY",
      exact: false,
    });
  });

  it("applies the accepted alias table", () => {
    expect(normalizeLivePhoneme("H")).toMatchObject({ phoneme: "HH" });
    expect(normalizeLivePhoneme("silence")).toMatchObject({ phoneme: "SIL" });
    expect(normalizeLivePhoneme("ng")).toMatchObject({ phoneme: "NG" });
  });

  it("strips a viseme_ prefix", () => {
    expect(normalizeLivePhoneme("viseme_AA")).toMatchObject({ phoneme: "AA" });
  });

  it("reports an unknown label instead of guessing a similar one", () => {
    expect(normalizeLivePhoneme("spn")).toEqual({ supported: false, raw: "spn" });
    expect(normalizeLivePhoneme("QQ")).toEqual({ supported: false, raw: "QQ" });
  });

  it("drops unknown phonemes from the timeline and records them", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();
    t.appendScheduledChunk(
      chunk(
        0,
        1,
        timelineOf([
          { phoneme: "AA", start: 0, end: 0.2 },
          { phoneme: "spn", raw: "spn", start: 0.2, end: 0.4 },
        ]),
        0,
      ),
    );
    expect(t.getPayload().phonemes).toHaveLength(1);
    expect(t.getStats().unknownLabels).toEqual({ spn: 1 });
  });
});

describe("solace audio clock", () => {
  const makeClock = (t: ReturnType<typeof createLiveSpeechTimeline>) => {
    let contextTime = 0;
    let active = true;
    return {
      setContextTime: (value: number) => {
        contextTime = value;
      },
      setActive: (value: boolean) => {
        active = value;
      },
      clock: createSolaceAudioClock({
        getContextTime: () => contextTime,
        getOriginContextTime: () => t.getOrigin(),
        getAudioDuration: () => t.getAudioDuration(),
        isPipelineActive: () => active,
      }),
    };
  };

  it("reports zero before the first chunk is scheduled", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();
    const { clock } = makeClock(t);
    expect(clock.getCurrentTime()).toBe(0);
    expect(clock.isPlaying()).toBe(false);
  });

  it("maps context time onto response time", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();
    t.appendScheduledChunk(
      chunk(12.5, 1, timelineOf([{ phoneme: "CH", start: 0.12, end: 0.22 }]), 0),
    );
    const { clock, setContextTime } = makeClock(t);

    setContextTime(12.62);
    expect(clock.getCurrentTime()).toBeCloseTo(0.12, 6);
    expect(clock.isPlaying()).toBe(true);
  });

  it("puts the phoneme and the audible sample at the same time", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();
    t.appendScheduledChunk(
      chunk(12.5, 1, timelineOf([{ phoneme: "CH", start: 0.12, end: 0.22 }]), 0),
    );
    const { clock, setContextTime } = makeClock(t);
    const [ch] = t.getPayload().phonemes;

    // Mid-phoneme in the AudioContext domain...
    setContextTime(12.5 + 0.17);
    const now = clock.getCurrentTime();
    // ...must fall inside the same phoneme in the Hyper3D domain.
    expect(now).toBeGreaterThanOrEqual(ch.start_time);
    expect(now).toBeLessThan(ch.end_time);
  });

  it("freezes at the end of the timeline instead of running past it", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();
    t.appendScheduledChunk(
      chunk(0, 0.5, timelineOf([{ phoneme: "AA", start: 0, end: 0.4 }]), 0),
    );
    const { clock, setContextTime } = makeClock(t);
    setContextTime(9);
    expect(clock.getCurrentTime()).toBeCloseTo(0.5, 6);
  });

  it("stops reporting playback after cancellation", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();
    t.appendScheduledChunk(
      chunk(0, 1, timelineOf([{ phoneme: "AA", start: 0, end: 0.5 }]), 0),
    );
    const { clock, setContextTime } = makeClock(t);
    setContextTime(0.25);
    expect(clock.isPlaying()).toBe(true);

    t.cancel();
    expect(clock.isPlaying()).toBe(false);
    expect(clock.getCurrentTime()).toBe(0);
  });
});

/**
 * ESTIMATED-SPAN RESCALE.
 *
 * Bundled `together_ai` phoneme times are rule-based durations laid end to end
 * across the whole decoded buffer, not measured acoustic times. Every bundled
 * chunk in the real captures reads:
 *
 *     firstStart ≈ 0 · lastEnd ≈ decodedDuration · no gap between phonemes
 *
 * so the numbers carry PROPORTION, not absolute time, and the conversion onto
 * the audible window is a linear rescale.
 *
 * The figures below are live-captured `together_ai` chunks, so the arithmetic is
 * the real contract rather than a constructed one:
 *
 *   idx  0: decoded 1.792  leadIn 0.540  audible 1.252   11 phonemes
 *   idx  6: decoded 1.621  leadIn 0.790  audible 0.831   worst observed ratio
 *
 * Both earlier readings of this contract lost exactly `leadIn / decoded` of each
 * chunk — 19.5% across a 20-chunk reply. Treating the times as audible-local
 * collapsed the tail; subtracting the lead-in collapsed the head. The rescale
 * loses nothing, which is what these tests hold.
 */
describe("live speech timeline — estimated-span rescale", () => {
  /** A contiguous span of `count` equal phonemes filling `[0, span]`. */
  const evenSpan = (count: number, span: number) =>
    Array.from({ length: count }, (_, i) => ({
      phoneme: i % 2 === 0 ? "AA" : "S",
      start: (i * span) / count,
      end: ((i + 1) * span) / count,
    }));

  // idx 0, as captured.
  const IDX0 = { decoded: 1.792, leadIn: 0.54, audible: 1.252, count: 11 };

  it("1: maps the span onto the audible window, both boundaries exact", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();

    const result = t.appendScheduledChunk(
      chunk(
        10,
        IDX0.audible,
        timelineOf(evenSpan(IDX0.count, IDX0.decoded)),
        0,
        9.9,
        IDX0.leadIn,
        "estimated-span",
      ),
    );

    expect(result).toMatchObject({ accepted: true, appendedPhonemes: IDX0.count });
    const times = t.getPayload().phonemes.map((p) => [p.start_time, p.end_time]);
    // First phoneme at the voice onset, last phoneme exactly at the audible end.
    expect(times[0][0]).toBeCloseTo(0, 6);
    expect(times[times.length - 1][1]).toBeCloseTo(IDX0.audible, 6);
  });

  it("2: keeps every phoneme — the 19.5% loss is gone", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();

    const result = t.appendScheduledChunk(
      chunk(
        10,
        IDX0.audible,
        timelineOf(evenSpan(IDX0.count, IDX0.decoded)),
        0,
        9.9,
        IDX0.leadIn,
        "estimated-span",
      ),
    );

    // Under the lead-in subtraction this same chunk appended 8 of 11: phonemes
    // 0, 1 and 2 fell below zero and were counted as droppedDegenerate.
    expect(result).toMatchObject({
      accepted: true,
      appendedPhonemes: 11,
      droppedDegenerate: 0,
      droppedUnknown: 0,
      clampedOverlaps: 0,
    });
    expect(t.getStats().droppedDegenerate).toBe(0);
  });

  it("3: preserves proportion — each phoneme keeps its share of the span", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();

    const source = evenSpan(IDX0.count, IDX0.decoded);
    t.appendScheduledChunk(
      chunk(10, IDX0.audible, timelineOf(source), 0, 9.9, IDX0.leadIn, "estimated-span"),
    );

    const out = t.getPayload().phonemes;
    expect(out).toHaveLength(source.length);
    source.forEach((item, i) => {
      expect(out[i].start_time / IDX0.audible).toBeCloseTo(item.start / IDX0.decoded, 6);
      expect(out[i].end_time / IDX0.audible).toBeCloseTo(item.end / IDX0.decoded, 6);
    });
  });

  it("4: stays contiguous and monotonic after rescaling", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();

    t.appendScheduledChunk(
      chunk(
        10,
        IDX0.audible,
        timelineOf(evenSpan(IDX0.count, IDX0.decoded)),
        0,
        9.9,
        IDX0.leadIn,
        "estimated-span",
      ),
    );

    const out = t.getPayload().phonemes;
    for (let i = 1; i < out.length; i += 1) {
      expect(out[i].start_time).toBeCloseTo(out[i - 1].end_time, 6);
      expect(out[i].start_time).toBeGreaterThanOrEqual(out[i - 1].start_time);
    }
  });

  it("5: reports the scale it applied", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();

    const result = t.appendScheduledChunk(
      chunk(
        10,
        IDX0.audible,
        timelineOf(evenSpan(IDX0.count, IDX0.decoded)),
        0,
        9.9,
        IDX0.leadIn,
        "estimated-span",
      ),
    );

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.timeScale).toBeCloseTo(IDX0.audible / IDX0.decoded, 6);
    // The scale is exactly the fraction the old models threw away.
    expect(1 - result.timeScale).toBeCloseTo(IDX0.leadIn / IDX0.decoded, 6);
  });

  it("6: survives the worst observed ratio with nothing dropped", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();

    // idx 6: leadIn 0.790 of a 1.621 s buffer, so only 0.831 s is audible — 49%
    // of the chunk is trimmed silence. Both earlier models lost half the chunk.
    const result = t.appendScheduledChunk(
      chunk(
        5,
        0.831,
        timelineOf([
          { phoneme: "S", start: 0, end: 0.5 },
          { phoneme: "EH", start: 0.5, end: 1.1 },
          { phoneme: "R", start: 1.1, end: 1.621 },
        ]),
        0,
        4.9,
        0.79,
        "estimated-span",
      ),
    );

    expect(result).toMatchObject({ accepted: true, appendedPhonemes: 3, droppedDegenerate: 0 });
    const scale = 0.831 / 1.621;
    const times = t.getPayload().phonemes.map((p) => [p.start_time, p.end_time]);
    expect(times[0]).toEqual([expect.closeTo(0, 6), expect.closeTo(0.5 * scale, 6)]);
    expect(times[1]).toEqual([expect.closeTo(0.5 * scale, 6), expect.closeTo(1.1 * scale, 6)]);
    expect(times[2]).toEqual([expect.closeTo(1.1 * scale, 6), expect.closeTo(0.831, 6)]);
    expect(times[2][1]).toBeLessThanOrEqual(0.831);
  });

  it("7: a final phoneme with no `end` still runs to the audible end, never collapses", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();

    // No `end` on the last item, so the span is ill-defined (0.9 against 1.252 s
    // of audio): the rescale degrades to the identity and the trailing phoneme
    // keeps the audible-end fallback it has always had.
    const result = t.appendScheduledChunk(
      chunk(
        10,
        1.252,
        timelineOf([
          { phoneme: "AA", start: 0, end: 0.9 },
          { phoneme: "S", start: 0.9 },
        ]),
        0,
        9.9,
        0.54,
        "estimated-span",
      ),
    );

    expect(result).toMatchObject({ accepted: true, appendedPhonemes: 2, droppedDegenerate: 0 });
    if (!result.accepted) return;
    expect(result.timeScale).toBe(1);
    const out = t.getPayload().phonemes;
    expect(out[0].start_time).toBeCloseTo(0, 6);
    expect(out[0].end_time).toBeCloseTo(0.9, 6);
    expect(out[1].start_time).toBeCloseTo(0.9, 6);
    expect(out[1].end_time).toBeCloseTo(1.252, 6);
  });

  it("7b: a mid-sequence phoneme with no `end` takes the next start, rescaled", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();

    t.appendScheduledChunk(
      chunk(
        10,
        1.252,
        timelineOf([
          { phoneme: "AA", start: 0 },
          { phoneme: "S", start: 0.896, end: 1.792 },
        ]),
        0,
        9.9,
        0.54,
        "estimated-span",
      ),
    );

    const out = t.getPayload().phonemes;
    expect(out).toHaveLength(2);
    expect(out[0].end_time).toBeCloseTo(0.626, 6);
    expect(out[1].start_time).toBeCloseTo(0.626, 6);
    expect(out[1].end_time).toBeCloseTo(1.252, 6);
  });

  it("8: degrades to the identity when the span does not cover the audio", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();

    // A truncated sequence: 0.22 s of phonemes against 1.0 s of audio. Stretching
    // it 4.5x would be inventing timing, so the conversion stays a pure offset.
    const result = t.appendScheduledChunk(
      chunk(12.5, 1.0, timelineOf([{ phoneme: "CH", start: 0.12, end: 0.22 }]), 0, 12.4, 0, "estimated-span"),
    );

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.timeScale).toBe(1);
    const [first] = t.getPayload().phonemes;
    expect(first.start_time).toBeCloseTo(0.12, 6);
    expect(first.end_time).toBeCloseTo(0.22, 6);
  });

  it("9: stays response-global across chunks with different scales, with no drift", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();

    // idx 0: audible 1.252 from context 10, span 1.792.
    t.appendScheduledChunk(
      chunk(
        10,
        1.252,
        timelineOf([
          { phoneme: "AA", start: 0, end: 0.9 },
          { phoneme: "IY", start: 0.9, end: 1.792 },
        ]),
        0,
        9.9,
        0.54,
        "estimated-span",
      ),
    );
    // idx 4: starts where idx 0's audible window ends, a different ratio.
    const second = t.appendScheduledChunk(
      chunk(
        11.252,
        1.574,
        timelineOf([{ phoneme: "OW", start: 0, end: 2.304 }]),
        1,
        11.2,
        0.73,
        "estimated-span",
      ),
    );

    expect(second).toMatchObject({ accepted: true, appendedPhonemes: 1 });
    const times = t.getPayload().phonemes.map((p) => [p.start_time, p.end_time]);
    expect(times[0][0]).toBeCloseTo(0, 6);
    // The seam: chunk 1's only phoneme spans chunk 0's audible end to its own.
    expect(times[2][0]).toBeCloseTo(1.252, 6);
    expect(times[2][1]).toBeCloseTo(1.252 + 1.574, 6);
    for (let i = 1; i < times.length; i += 1) {
      expect(times[i][0]).toBeGreaterThanOrEqual(times[i - 1][0] - 1e-9);
    }
    expect(t.getPayload().audio_duration).toBeCloseTo(1.252 + 1.574, 6);
    expect(t.getStats().droppedDegenerate).toBe(0);
  });

  it("10: leaves an audible-onset chunk bit-identical to the pure offset", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();

    // The original worked example, unchanged. No rescale, no shift.
    const result = t.appendScheduledChunk(
      chunk(12.5, 1.0, timelineOf([{ phoneme: "CH", start: 0.12, end: 0.22 }]), 0, 12.4, 0.3, "audible-onset"),
    );

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.timeScale).toBe(1);
    const [first] = t.getPayload().phonemes;
    expect(first.start_time).toBeCloseTo(0.12, 6);
    expect(first.end_time).toBeCloseTo(0.22, 6);
    expect(t.getStats().droppedDegenerate).toBe(0);
  });

  it("11: the lead-in is never applied to phoneme times", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();

    const source = timelineOf(evenSpan(6, 1.792));
    const withLeadIn = createLiveSpeechTimeline();
    withLeadIn.beginTurn();

    t.appendScheduledChunk(chunk(10, 1.252, source, 0, 9.9, 0, "estimated-span"));
    withLeadIn.appendScheduledChunk(chunk(10, 1.252, source, 0, 9.9, 0.54, "estimated-span"));

    // Same span, same audible window, wildly different lead-in → same output.
    expect(t.getPayload().phonemes.map((p) => [p.start_time, p.end_time])).toEqual(
      withLeadIn.getPayload().phonemes.map((p) => [p.start_time, p.end_time]),
    );
  });
});

/**
 * PATH ISOLATION.
 *
 * Three producers reach this module and they do NOT share a clock domain. The
 * discriminator is the transport the chunk arrived on, which is the identity the
 * delivery tests already assert per path:
 *
 *   bundled together_ai   `audio_b64` on avatar_data  → estimated-span (MEASURED)
 *   split greeting        avatar_data + binary frame  → audible-onset (unconfirmed,
 *                                                       so behaviour preserved)
 *   split comfort         untimed string[]            → never converted at all
 */
describe("live speech timeline — producer path isolation", () => {
  it("maps each transport to its documented clock domain", () => {
    // Bundled together_ai is the only MEASURED path.
    expect(phonemeTimeDomainForAssociation("bundled")).toBe("estimated-span");
    // Every split form keeps the pre-existing, unrescaled behaviour.
    expect(phonemeTimeDomainForAssociation("exact-index")).toBe("audible-onset");
    expect(phonemeTimeDomainForAssociation("existing-fifo")).toBe("audible-onset");
    expect(phonemeTimeDomainForAssociation("no-metadata")).toBe("audible-onset");
    // Absent metadata must never opt into a shift.
    expect(phonemeTimeDomainForAssociation(null)).toBe("audible-onset");
    expect(phonemeTimeDomainForAssociation(undefined)).toBe("audible-onset");
    expect(phonemeTimeDomainForAssociation("something-new")).toBe("audible-onset");
  });

  it("bundled together_ai: rescales the span onto the audible window", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();

    // idx 0 as captured: span 1.792 filling the buffer, 1.252 s audible.
    const result = t.appendScheduledChunk(
      chunk(
        10,
        1.252,
        timelineOf([
          { phoneme: "AA", start: 0, end: 0.896 },
          { phoneme: "IY", start: 0.896, end: 1.792 },
        ]),
        0,
        9.9,
        0.54,
        phonemeTimeDomainForAssociation("bundled"),
      ),
    );

    expect(result).toMatchObject({ accepted: true, appendedPhonemes: 2, droppedDegenerate: 0 });
    const times = t.getPayload().phonemes.map((p) => [p.start_time, p.end_time]);
    expect(times[0]).toEqual([expect.closeTo(0, 6), expect.closeTo(0.626, 6)]);
    expect(times[1]).toEqual([expect.closeTo(0.626, 6), expect.closeTo(1.252, 6)]);
  });

  it("split greeting: is NOT rescaled, and keeps every phoneme", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();

    // The welcome fixture's exact shape: decoded 1.6, leadIn 0.25, audible 1.35,
    // phonemes 0.0 → 1.25 already expressed from the voice onset.
    const result = t.appendScheduledChunk(
      chunk(
        10,
        1.35,
        timelineOf([
          { phoneme: "HH", start: 0.0, end: 0.1 },
          { phoneme: "AY1", start: 0.1, end: 0.35 },
          { phoneme: "M", start: 0.35, end: 0.45 },
          { phoneme: "S", start: 1.1, end: 1.25 },
        ]),
        0,
        9.9,
        0.25,
        phonemeTimeDomainForAssociation("exact-index"),
      ),
    );

    // The first phoneme at 0.0 is NOT pushed into the trimmed silence and dropped.
    expect(result).toMatchObject({ accepted: true, appendedPhonemes: 4, droppedDegenerate: 0 });
    const times = t.getPayload().phonemes.map((p) => [p.start_time, p.end_time]);
    expect(times[0]).toEqual([expect.closeTo(0, 6), expect.closeTo(0.1, 6)]);
    expect(times[3]).toEqual([expect.closeTo(1.1, 6), expect.closeTo(1.25, 6)]);
  });

  it("split comfort: untimed phonemes never reach the conversion", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();

    // The withhold happens upstream (`hyper3dTimelineForScheduledChunk` hands
    // Hyper3D `timeline: null` for a string-fallback chunk), so the timeline sees
    // audio with no phonemes. It must still advance `audio_duration`.
    const result = t.appendScheduledChunk(
      chunk(10, 1.4, null, 0, 9.9, 0.3, phonemeTimeDomainForAssociation("exact-index")),
    );

    expect(result).toMatchObject({ accepted: false, reason: "no-phonemes" });
    expect(t.getPayload().phonemes).toHaveLength(0);
    expect(t.getPayload().audio_duration).toBeCloseTo(1.4, 6);
    expect(t.getStats().droppedDegenerate).toBe(0);
  });

  it("the three paths stay isolated inside one turn", () => {
    const t = createLiveSpeechTimeline();
    t.beginTurn();

    // greeting (split, onset-relative) → comfort (split, untimed) → reply (bundled).
    t.appendScheduledChunk(
      chunk(10, 1.35, timelineOf([{ phoneme: "HH", start: 0, end: 0.1 }]), 0, 9.9, 0.25, "audible-onset"),
    );
    t.appendScheduledChunk(chunk(11.35, 1.4, null, 1, 11.3, 0.3, "audible-onset"));
    t.appendScheduledChunk(
      chunk(
        12.75,
        1.252,
        timelineOf([{ phoneme: "AA", start: 0, end: 1.792 }]),
        2,
        12.7,
        0.54,
        "estimated-span",
      ),
    );

    const times = t.getPayload().phonemes.map((p) => [p.start_time, p.end_time]);
    expect(times).toHaveLength(2);
    // Greeting phoneme unrescaled at the response origin.
    expect(times[0]).toEqual([expect.closeTo(0, 6), expect.closeTo(0.1, 6)]);
    // Reply phoneme rescaled, filling exactly its own chunk's audible window.
    expect(times[1][0]).toBeCloseTo(2.75, 6);
    expect(times[1][1]).toBeCloseTo(2.75 + 1.252, 6);
    expect(t.getStats().droppedDegenerate).toBe(0);
    expect(t.getStats().droppedUnknown).toBe(0);
  });
});
