import { describe, expect, it } from "vitest";
import { createLiveSentencePlanner, type LiveSentenceChunk } from "./liveSentencePlanner";
import { buildSpeechPerformancePlan } from "./engine/engine/animation/SpeechPerformancePlan";
import type { TimedPhoneme } from "./liveAvatarPayload";

/**
 * Phase 2C per-sentence planning guards.
 *
 * The properties that matter are immutability and placement: a later sentence
 * must never be able to change an earlier one, and a sentence's plan must sit
 * exactly where the audio scheduler put its audio.
 */

const LABELS = ["HH", "EH", "L", "OW", "DH", "AH", "K", "AA", "M", "V", "S", "T", "IY", "N", "ER"];

/** Phonemes in RESPONSE-relative seconds, as the Phase 1 seam produces them. */
const phonemesFrom = (offset: number, duration: number, count: number, idPrefix: string): TimedPhoneme[] => {
  const step = duration / count;
  return Array.from({ length: count }, (_, i) => ({
    id: `${idPrefix}-${i}`,
    phoneme: LABELS[i % LABELS.length],
    start_time: offset + i * step,
    end_time: offset + (i + 1) * step,
    intensity: 1,
  }));
};

const chunk = (
  sentence: string,
  chunkIndex: number,
  offsetSeconds: number,
  durationSeconds: number,
  phonemeCount = 12,
): LiveSentenceChunk => ({
  sentence,
  chunkIndex,
  offsetSeconds,
  durationSeconds,
  phonemes: phonemesFrom(offsetSeconds, durationSeconds, phonemeCount, `c${chunkIndex}`),
  scheduledAtMs: 1000 + chunkIndex * 50,
  audibleStartContextTime: 100 + offsetSeconds,
});

const SENTENCE_A = "Hello there, how are you feeling today?";
const SENTENCE_B = "I want to understand what happened, if you can share it.";
const SENTENCE_C = "That sounds genuinely hard.";

describe("per-sentence planning — placement", () => {
  it("places a sentence plan at its scheduled offset, not an estimate", () => {
    const planner = createLiveSentencePlanner();
    planner.beginTurn();
    // A deliberately non-round offset: nothing may round or re-derive it.
    const placed = planner.addScheduledChunk(chunk(SENTENCE_A, 0, 3.4217, 2.1));

    expect(placed).not.toBeNull();
    expect(placed!.offsetSeconds).toBe(3.4217);
    expect(placed!.endSeconds).toBeCloseTo(5.5217, 6);
    expect(placed!.localDurationSeconds).toBeCloseTo(2.1, 6);
  });

  it("plans in sentence-local time, so the planner sees a normal utterance", () => {
    const planner = createLiveSentencePlanner();
    planner.beginTurn();
    const placed = planner.addScheduledChunk(chunk(SENTENCE_A, 0, 9.5, 2.0))!;

    // Local, not response-relative: the plan starts at 0 even though the audio
    // starts at 9.5 s into the turn.
    expect(placed.plan.durationSeconds).toBeCloseTo(2.0, 6);
    for (const clause of placed.plan.clauses) {
      expect(clause.startsAt).toBeGreaterThanOrEqual(0);
      expect(clause.endsAt).toBeLessThanOrEqual(2.0 + 1e-9);
    }
  });

  it("resolves a response time to the owning sentence and its local time", () => {
    const planner = createLiveSentencePlanner();
    planner.beginTurn();
    planner.addScheduledChunk(chunk(SENTENCE_A, 0, 0, 2));
    planner.addScheduledChunk(chunk(SENTENCE_B, 1, 2, 3));

    const inA = planner.resolveAt(1.25)!;
    expect(inA.placed.index).toBe(0);
    expect(inA.localTime).toBeCloseTo(1.25, 6);

    const inB = planner.resolveAt(3.5)!;
    expect(inB.placed.index).toBe(1);
    expect(inB.localTime).toBeCloseTo(1.5, 6);
  });
});

describe("per-sentence planning — immutability", () => {
  it("leaves sentence A's plan byte-identical when sentence B is appended", () => {
    const planner = createLiveSentencePlanner();
    planner.beginTurn();
    planner.addScheduledChunk(chunk(SENTENCE_A, 0, 0, 2.4));
    const beforeB = JSON.stringify(planner.getPlans()[0].plan);

    planner.addScheduledChunk(chunk(SENTENCE_B, 1, 2.4, 3.1));
    planner.addScheduledChunk(chunk(SENTENCE_C, 2, 5.5, 1.6));

    const afterC = JSON.stringify(planner.getPlans()[0].plan);
    expect(afterC).toBe(beforeB);
  });

  it("does not move sentence A's placement when later sentences arrive", () => {
    const planner = createLiveSentencePlanner();
    planner.beginTurn();
    planner.addScheduledChunk(chunk(SENTENCE_A, 0, 1.75, 2.4));
    const a = planner.getPlans()[0];

    planner.addScheduledChunk(chunk(SENTENCE_B, 1, 4.15, 3.1));

    const aAfter = planner.getPlans()[0];
    expect(aAfter.offsetSeconds).toBe(a.offsetSeconds);
    expect(aAfter.endSeconds).toBe(a.endSeconds);
    expect(aAfter.index).toBe(0);
  });

  it("freezes a sentence once its audio has begun rendering", () => {
    const planner = createLiveSentencePlanner();
    planner.beginTurn();
    planner.addScheduledChunk(chunk(SENTENCE_A, 0, 0, 2));
    expect(planner.getPlans()[0].frozen).toBe(false);

    // audibleStartContextTime for offset 0 is 100 in the fixture.
    planner.freezeRenderedBefore(100.5);
    expect(planner.getPlans()[0].frozen).toBe(true);
  });

  it("refuses to re-plan a frozen sentence even if a late chunk claims it", () => {
    const planner = createLiveSentencePlanner();
    planner.beginTurn();
    planner.addScheduledChunk(chunk(SENTENCE_A, 0, 0, 2));
    planner.freezeRenderedBefore(100.5);
    const frozen = JSON.stringify(planner.getPlans()[0].plan);

    // A late chunk carrying the same sentence text arrives after rendering began.
    planner.addScheduledChunk(chunk(SENTENCE_A, 1, 2, 1.5));

    // The rendered sentence is untouched; the late audio opens a new unit rather
    // than rewriting territory that has already been performed.
    expect(JSON.stringify(planner.getPlans()[0].plan)).toBe(frozen);
    expect(planner.getPlans()[0].endSeconds).toBeCloseTo(2, 6);
  });
});

describe("per-sentence planning — the accepted planner is unmodified", () => {
  it("produces exactly what the accepted planner produces for that sentence", () => {
    const planner = createLiveSentencePlanner();
    planner.beginTurn();
    const offset = 7.25;
    const duration = 2.4;
    const c = chunk(SENTENCE_A, 0, offset, duration, 16);
    const placed = planner.addScheduledChunk(c)!;

    // The same call the module makes internally, made here independently.
    //
    // The local duration is taken from the PLACED plan rather than the literal
    // 2.4: the module derives it as `endSeconds - offsetSeconds`, and
    // (7.25 + 2.4) - 7.25 is 2.4000000000000004 in binary floating point. Using
    // the scheduler-derived value is correct — the audio really does end there —
    // so the test matches the module's arithmetic instead of asserting a
    // prettier number the pipeline never produces.
    const expected = buildSpeechPerformancePlan(
      SENTENCE_A,
      c.phonemes.map((p) => ({
        ...p,
        start_time: p.start_time - offset,
        end_time: p.end_time - offset,
      })),
      placed.localDurationSeconds,
    );

    expect(planner.getPlans()[0].plan).toEqual(expected);
  });

  it("groups a multi-chunk sentence before planning it", () => {
    // The protocol documents one avatar_data per sentence, but the backend is a
    // separate service — a sentence split across chunks must be grouped, not
    // planned twice.
    const planner = createLiveSentencePlanner();
    planner.beginTurn();
    planner.addScheduledChunk(chunk(SENTENCE_B, 0, 0, 1.5));
    planner.addScheduledChunk(chunk(SENTENCE_B, 1, 1.5, 1.4));

    const plans = planner.getPlans();
    expect(plans).toHaveLength(1);
    expect(plans[0].chunkCount).toBe(2);
    expect(plans[0].localDurationSeconds).toBeCloseTo(2.9, 6);
  });

  it("ignores a duplicate chunk", () => {
    const planner = createLiveSentencePlanner();
    planner.beginTurn();
    planner.addScheduledChunk(chunk(SENTENCE_A, 0, 0, 2));
    planner.addScheduledChunk(chunk(SENTENCE_A, 0, 0, 2));

    expect(planner.getPlans()[0].chunkCount).toBe(1);
    expect(planner.getStats().duplicateChunks).toBe(1);
  });
});

describe("per-sentence planning — turn lifecycle", () => {
  it("discards every future sentence plan on interruption", () => {
    const planner = createLiveSentencePlanner();
    planner.beginTurn();
    planner.addScheduledChunk(chunk(SENTENCE_A, 0, 0, 2));
    planner.addScheduledChunk(chunk(SENTENCE_B, 1, 2, 3));
    expect(planner.getPlans()).toHaveLength(2);

    planner.cancel();

    expect(planner.getPlans()).toHaveLength(0);
    expect(planner.resolveAt(1)).toBeNull();
  });

  it("starts a fresh planning state on the next turn", () => {
    const planner = createLiveSentencePlanner();
    planner.beginTurn();
    planner.addScheduledChunk(chunk(SENTENCE_A, 0, 0, 2));
    planner.freezeRenderedBefore(100.5);

    planner.beginTurn();
    expect(planner.getPlans()).toHaveLength(0);
    expect(planner.getStats().sentenceCount).toBe(0);

    const placed = planner.addScheduledChunk(chunk(SENTENCE_C, 0, 0, 1.6))!;
    expect(placed.index).toBe(0);
    expect(placed.frozen).toBe(false);
  });

  it("records a plan that was not ready before its audio became audible", () => {
    const planner = createLiveSentencePlanner();
    planner.beginTurn();
    planner.addScheduledChunk(chunk(SENTENCE_A, 0, 0, 2));
    planner.noteAudibleStart(0, -12);
    // Recorded, never fatal: audio plays and lip-sync runs regardless.
    expect(planner.getStats().lateplans).toBe(1);
    expect(planner.getStats().leadTimesMs).toEqual([-12]);
  });
});
