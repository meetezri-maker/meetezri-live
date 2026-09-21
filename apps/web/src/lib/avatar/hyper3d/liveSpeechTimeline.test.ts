import { describe, expect, it } from "vitest";
import type { AvatarPhonemeTimeline } from "../avatarMorphTypes";
import { createLiveSpeechTimeline } from "./liveSpeechTimeline";
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
) => ({
  audioContextStartTime: startTime,
  durationSeconds,
  leadInSeconds: 0,
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
