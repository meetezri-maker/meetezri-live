import {
  buildSpeechPerformancePlan,
  type SpeechPerformancePlan,
} from "./engine/engine/animation/SpeechPerformancePlan";
import type { TimedPhoneme } from "./liveAvatarPayload";

/**
 * LIVE SENTENCE PLANNER — Phase 2C Option A.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY PER-SENTENCE
 * ─────────────────────────────────────────────────────────────────────────────
 * `buildSpeechPerformancePlan` is NON-CAUSAL. It normalizes every clause's
 * expected duration over `totalWords` and `totalSpanSeconds` for the whole
 * utterance, and its DP back-trace starts from the last clause — so clause 0's
 * span assignment depends on the final clause. Re-running it on a growing
 * response would reassign clauses that have already been spoken.
 *
 * The decision was therefore to leave the planner mathematically untouched and
 * change only WHAT IT IS GIVEN: one complete sentence at a time, never a
 * half-finished response. Each sentence is planned in its OWN local time base
 * (starting at 0, exactly as a static payload would be), and the resulting plan
 * is then PLACED at the sentence's scheduled offset on the response timeline.
 *
 *   plan(sentence A) @ offset A  +  plan(sentence B) @ offset B  +  …
 *
 * Nothing about the DP, its costs, weights, probabilities, position formulas or
 * timing constants is modified — this module never reaches inside it. The one
 * accepted consequence, agreed in 2C, is that `positionInUtterance` is now
 * sentence-relative for live turns.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IMMUTABILITY
 * ─────────────────────────────────────────────────────────────────────────────
 * A sentence's plan may be refined while it is still in the future — more of its
 * audio may yet be scheduled — but the instant it starts rendering it FREEZES.
 * After that no later sentence, and no further chunk, can alter it. That is what
 * guarantees sentence B cannot move a clause, a head event or an anchor inside
 * sentence A.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IT NEVER DELAYS AUDIO
 * ─────────────────────────────────────────────────────────────────────────────
 * Planning happens after the scheduler has already committed the chunk's audio
 * (it is driven from `onChunkScheduled`). If a plan is not ready when its audio
 * becomes audible, the audio plays anyway and lip-sync — which is driven by the
 * phoneme timeline, not by this plan — runs regardless. `leadTimeMs` records how
 * far ahead each plan landed so misses are measured rather than assumed.
 */

/** One scheduled audio chunk, as the Phase 1 seam already reports it. */
export type LiveSentenceChunk = {
  /** `avatar_data.sentence`. The real sentence identity from the protocol. */
  sentence: string;
  /** `avatar_data.chunk_index`, used for ordering and de-duplication. */
  chunkIndex: number | null;
  /** Response-relative start of this chunk, from the AudioContext schedule. */
  offsetSeconds: number;
  /** Audible duration of this chunk. */
  durationSeconds: number;
  /** This chunk's phonemes, already converted to RESPONSE-relative seconds. */
  phonemes: TimedPhoneme[];
  /** `performance.now()` when the scheduler handed the chunk over. */
  scheduledAtMs: number;
  /** AudioContext time at which this chunk becomes audible. */
  audibleStartContextTime: number;
  /** AudioContext time sampled immediately after this plan was built. */
  contextTimeAtPlan?: number;
};

export type PlacedSentencePlan = {
  /** Stable within a turn: the sentence's ordinal. */
  index: number;
  identity: string;
  text: string;
  /** Response-relative start — where this sentence's local plan is placed. */
  offsetSeconds: number;
  /** Response-relative end. */
  endSeconds: number;
  localDurationSeconds: number;
  /** The accepted planner's output, in SENTENCE-LOCAL seconds. */
  plan: SpeechPerformancePlan;
  /** The accepted phonemes, translated into sentence-local seconds. */
  localPhonemes: readonly TimedPhoneme[];
  /** Increments only when this sentence is refined before freeze. */
  revision: number;
  /** True once rendering has begun; the plan can no longer change. */
  frozen: boolean;
  chunkCount: number;
  plannedAtMs: number;
  /** ms between the plan being ready and the sentence becoming audible. */
  leadTimeMs: number | null;
};

export type LiveSentencePlannerStats = {
  turnId: number;
  sentenceCount: number;
  frozenCount: number;
  /** Plans that were not ready before their sentence became audible. */
  lateplans: number;
  leadTimesMs: number[];
  replanCount: number;
  duplicateChunks: number;
};

type SentenceAccumulator = {
  index: number;
  identity: string;
  text: string;
  offsetSeconds: number;
  endSeconds: number;
  phonemes: TimedPhoneme[];
  chunkKeys: Set<string>;
  chunkCount: number;
  audibleStartContextTime: number;
  firstScheduledAtMs: number;
  plan: SpeechPerformancePlan | null;
  plannedAtMs: number;
  leadTimeMs: number | null;
  frozen: boolean;
  revision: number;
  placed: PlacedSentencePlan | null;
};

export type LiveSentencePlanner = ReturnType<typeof createLiveSentencePlanner>;

export function createLiveSentencePlanner(deps: { now?: () => number } = {}) {
  const now = deps.now ?? (() => performance.now());

  let turnId = 0;
  let sentences: SentenceAccumulator[] = [];
  let open: SentenceAccumulator | null = null;
  let replanCount = 0;
  let duplicateChunks = 0;
  let latePlans = 0;

  const identityOf = (sentence: string) => sentence.trim();

  /**
   * Builds (or rebuilds) one sentence's plan from everything known about it so
   * far, in the sentence's own local time base.
   *
   * The planner is handed local times deliberately: it is the same input shape a
   * static payload gives it, so it behaves exactly as it does in avatar-test.
   * Placement onto the response timeline is this module's job, not the DP's.
   */
  function planSentence(sentence: SentenceAccumulator) {
    if (sentence.frozen) return;
    const localPhonemes = sentence.phonemes.map((p) => ({
      ...p,
      start_time: p.start_time - sentence.offsetSeconds,
      end_time: p.end_time - sentence.offsetSeconds,
    }));
    const localDuration = sentence.endSeconds - sentence.offsetSeconds;
    if (localDuration <= 0) return;
    if (sentence.plan) replanCount += 1;
    sentence.plan = buildSpeechPerformancePlan(
      sentence.text,
      localPhonemes,
      localDuration,
    );
    sentence.revision += 1;
    sentence.plannedAtMs = now();
    sentence.placed = null;
  }

  function setLeadTime(sentence: SentenceAccumulator, leadMs: number) {
    if (sentence.leadTimeMs !== null && sentence.leadTimeMs < 0) latePlans -= 1;
    sentence.leadTimeMs = leadMs;
    sentence.placed = null;
    if (leadMs < 0) latePlans += 1;
  }

  function toPlaced(sentence: SentenceAccumulator): PlacedSentencePlan | null {
    if (!sentence.plan) return null;
    if (sentence.placed) return sentence.placed;
    sentence.placed = {
      index: sentence.index,
      identity: sentence.identity,
      text: sentence.text,
      offsetSeconds: sentence.offsetSeconds,
      endSeconds: sentence.endSeconds,
      localDurationSeconds: sentence.endSeconds - sentence.offsetSeconds,
      plan: sentence.plan,
      localPhonemes: sentence.phonemes.map((p) => ({
        ...p,
        start_time: p.start_time - sentence.offsetSeconds,
        end_time: p.end_time - sentence.offsetSeconds,
      })),
      revision: sentence.revision,
      frozen: sentence.frozen,
      chunkCount: sentence.chunkCount,
      plannedAtMs: sentence.plannedAtMs,
      leadTimeMs: sentence.leadTimeMs,
    };
    return sentence.placed;
  }

  return {
    beginTurn(nextTurnId?: number) {
      turnId = nextTurnId ?? turnId + 1;
      sentences = [];
      open = null;
      replanCount = 0;
      duplicateChunks = 0;
      latePlans = 0;
    },

    /** Barge-in / teardown. Every plan, past and future, is discarded. */
    cancel() {
      sentences = [];
      open = null;
    },

    /**
     * Feed one scheduled chunk.
     *
     * Sentence grouping is by the protocol's own `sentence` identity, NOT by
     * assuming one chunk is one sentence. Solace's client contract documents
     * `avatar_data` as per-sentence and in practice one message carries one
     * sentence and one audio chunk — but the backend is a separate service, so a
     * sentence delivered across several chunks is grouped correctly here rather
     * than silently mis-planned.
     */
    addScheduledChunk(chunk: LiveSentenceChunk): PlacedSentencePlan | null {
      const identity = identityOf(chunk.sentence);
      const chunkKey =
        chunk.chunkIndex !== null && Number.isFinite(chunk.chunkIndex)
          ? `idx:${chunk.chunkIndex}`
          : `t:${chunk.offsetSeconds.toFixed(4)}`;

      const continuesOpen =
        open !== null && identity.length > 0 && open.identity === identity && !open.frozen;

      if (!continuesOpen) {
        // A later sentence can be scheduled while this one is still in the
        // future. Only the authoritative audible boundary freezes a plan.
        open = {
          index: sentences.length,
          identity,
          text: chunk.sentence.trim(),
          offsetSeconds: chunk.offsetSeconds,
          endSeconds: chunk.offsetSeconds + chunk.durationSeconds,
          phonemes: [...chunk.phonemes],
          chunkKeys: new Set([chunkKey]),
          chunkCount: 1,
          audibleStartContextTime: chunk.audibleStartContextTime,
          firstScheduledAtMs: chunk.scheduledAtMs,
          plan: null,
          plannedAtMs: 0,
          leadTimeMs: null,
          frozen: false,
          revision: 0,
          placed: null,
        };
        sentences.push(open);
      } else {
        if (open!.chunkKeys.has(chunkKey)) {
          duplicateChunks += 1;
          return toPlaced(open!);
        }
        open!.chunkKeys.add(chunkKey);
        open!.chunkCount += 1;
        open!.phonemes.push(...chunk.phonemes);
        open!.endSeconds = Math.max(
          open!.endSeconds,
          chunk.offsetSeconds + chunk.durationSeconds,
        );
      }

      planSentence(open!);
      if (chunk.contextTimeAtPlan !== undefined) {
        setLeadTime(
          open!,
          (open!.audibleStartContextTime - chunk.contextTimeAtPlan) * 1000,
        );
      }
      return toPlaced(open!);
    },

    /**
     * Freeze every sentence whose audio has begun.
     *
     * Called from the render tick with the authoritative AudioContext time. This
     * is the boundary §4 requires: a plan that has started rendering is
     * immutable, and a later sentence can never reach back into it.
     */
    freezeRenderedBefore(contextTime: number): number {
      let frozenNow = 0;
      for (const sentence of sentences) {
        if (sentence.frozen) continue;
        if (contextTime >= sentence.audibleStartContextTime) {
          sentence.frozen = true;
          sentence.placed = null;
          frozenNow += 1;
          if (!sentence.plan) {
            // Audible with no plan: the acceptance rule is that audio and
            // lip-sync continue regardless, and the miss is recorded.
            latePlans += 1;
          }
        }
      }
      return frozenNow;
    },

    /** Records how far ahead of audibility each plan landed. */
    noteAudibleStart(sentenceIndex: number, leadMs: number) {
      const sentence = sentences[sentenceIndex];
      if (!sentence) return;
      setLeadTime(sentence, leadMs);
    },

    /** The plan covering a response-relative time, with its local time. */
    resolveAt(responseTime: number): { placed: PlacedSentencePlan; localTime: number } | null {
      for (let i = sentences.length - 1; i >= 0; i -= 1) {
        const sentence = sentences[i];
        if (responseTime >= sentence.offsetSeconds && responseTime < sentence.endSeconds) {
          const placed = toPlaced(sentence);
          if (!placed) return null;
          return { placed, localTime: responseTime - sentence.offsetSeconds };
        }
      }
      return null;
    },

    getPlans(): PlacedSentencePlan[] {
      return sentences.map(toPlaced).filter((p): p is PlacedSentencePlan => p !== null);
    },

    getStats(): LiveSentencePlannerStats {
      return {
        turnId,
        sentenceCount: sentences.length,
        frozenCount: sentences.filter((s) => s.frozen).length,
        lateplans: latePlans,
        leadTimesMs: sentences
          .map((sentence) => sentence.leadTimeMs)
          .filter((lead): lead is number => lead !== null),
        replanCount,
        duplicateChunks,
      };
    },
  };
}
