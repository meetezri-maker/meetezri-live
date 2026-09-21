import type { AvatarPhonemeTimeline } from "../avatarMorphTypes";
import {
  ACCEPTED_LIVE_BEHAVIOUR,
  ACCEPTED_LIVE_BEHAVIOUR_SETTINGS,
  ACCEPTED_LIVE_LANGUAGE,
  ACCEPTED_LIVE_PHONEME_INTENSITY,
  ACCEPTED_LIVE_PLAYBACK,
  type LiveAvatarPayload,
  type TimedPhoneme,
} from "./liveAvatarPayload";
import { normalizeLivePhoneme } from "./phonemeNormalization";

/**
 * LIVE SPEECH TIMELINE — chunk-relative phoneme times → response-relative times.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ONE INVARIANT
 * ─────────────────────────────────────────────────────────────────────────────
 * A phoneme reported at Hyper3D time X corresponds to the audio sample audible
 * at Hyper3D time X. Everything below exists to hold that, and nothing here is
 * allowed to move audio to make it easier.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CLOCK DOMAIN
 * ─────────────────────────────────────────────────────────────────────────────
 * `EzriWsAudioScheduler` schedules every chunk on ONE shared `AudioContext` and
 * reports the FINAL `source.start()` time synchronously through
 * `onChunkScheduled` (`lib/ezri/wsAudioScheduler.ts:366`). That AudioContext
 * timeline is the authoritative clock and this module never creates another.
 *
 * `audioContextStartTime` is the AUDIBLE onset, not the buffer start: the
 * scheduler measures each chunk's leading digital silence (`computeLeadInSec`,
 * windowed RMS) and skips it via `source.start(when, leadInSec)`, and everything
 * it models downstream uses `audibleDuration`. Solace's backend phoneme times
 * are speech-relative with t=0 at that same voice onset. The two therefore share
 * an origin per chunk and the conversion is a pure offset:
 *
 *     chunkOffset  = audioContextStartTime − responsePlaybackOrigin
 *     start_time   = chunkOffset + chunkRelativeStart
 *     end_time     = chunkOffset + chunkRelativeEnd
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RESPONSE ORIGIN
 * ─────────────────────────────────────────────────────────────────────────────
 * The accepted runtime reads an utterance-relative clock: `TimelineCursor.seek`
 * clamps to `[0, payload.audio_duration]` and every `TimedPhoneme` is expressed
 * from the utterance start. So the raw AudioContext time (which is session
 * uptime, often hundreds of seconds) can never be handed over directly. The
 * origin is the scheduled start of the FIRST chunk of the turn, captured once
 * and then immutable for that turn.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS MODULE MUST NOT DO
 * ─────────────────────────────────────────────────────────────────────────────
 *  - never buffer the response: each chunk is converted on arrival
 *  - never wait for phonemes: audio is already scheduled before we are called
 *  - never rewrite timing that has been published (append-only, forward-only)
 *  - never synthesize timing when the backend supplied real timing
 *  - never map an unknown phoneme onto a similar-looking one
 */

/** Ordering slack, matching the accepted schema's overlap tolerance. */
const OVERLAP_TOLERANCE_SECONDS = 0.005;

/** Below this a phoneme cannot be rendered meaningfully; it is dropped, not stretched. */
const MIN_PHONEME_SECONDS = 0.001;

export type LiveChunkAppendInput = {
  /**
   * `onChunkScheduled` → `timing.audioContextStartTime`. AudioContext seconds,
   * audible onset, post underrun-bump and post lead-in trim.
   */
  audioContextStartTime: number;
  /** `timing.durationMs / 1000` — the AUDIBLE duration the scheduler modelled. */
  durationSeconds: number;
  /** `computeLeadInSec` result, carried for diagnostics only. Never applied twice. */
  leadInSeconds: number;
  /** Chunk-relative phonemes, as already normalized by `normalizeAvatarPhonemeTimeline`. */
  timeline: AvatarPhonemeTimeline | null;
  /** `avatar_data.chunk_index` when the backend supplied one. */
  chunkIndex: number | null;
  /** `avatar_data.sentence`, used for payload text and as a dedup fallback. */
  sentence: string;
  /** `AudioContext.currentTime` sampled at append — for natural look-ahead stats. */
  contextTimeAtAppend: number;
};

export type LiveChunkAppendResult =
  | {
      accepted: true;
      chunkKey: string;
      chunkOffsetSeconds: number;
      appendedPhonemes: number;
      droppedUnknown: number;
      droppedDegenerate: number;
      clampedOverlaps: number;
      /** Seconds between this chunk's audible start and the clock at append time. */
      lookAheadSeconds: number;
    }
  | {
      accepted: false;
      chunkKey: string;
      reason: "duplicate" | "non-monotonic" | "no-phonemes" | "invalid-timing";
    };

export type LiveTimelineStats = {
  turnId: number;
  originContextTime: number | null;
  chunkCount: number;
  phonemeCount: number;
  audioDuration: number;
  droppedUnknown: number;
  droppedDegenerate: number;
  clampedOverlaps: number;
  duplicateChunks: number;
  nonMonotonicChunks: number;
  /** Label → occurrences, for the phoneme audit. Unknown labels are never mapped. */
  unknownLabels: Record<string, number>;
  exactLabelMatches: number;
  normalizedLabelMatches: number;
  /** One sample per accepted chunk: chunk audible start − clock at append. */
  lookAheadSamples: number[];
};

export type LiveSpeechTimeline = ReturnType<typeof createLiveSpeechTimeline>;

export function createLiveSpeechTimeline() {
  let turnId = 0;
  /**
   * THE STABLE LIVE-TURN IDENTITY.
   *
   * Created once, here, when a turn begins; retained unchanged through every
   * appended chunk; replaced only by the next `beginTurn()` or `cancel()` —
   * i.e. on completion, cancellation, interruption, or a new turn.
   *
   * It is the payload's `performance_seed`, which is what the accepted
   * `HeadMotionController` hashes for a live payload instead of composing
   * `id:audio_url:audio_duration`. That composition is stable for a static
   * payload but not for a streaming one, whose `audio_duration` grows with every
   * scheduled chunk — so it would hand the head-motion generators a different
   * random field mid-response. Deterministic on purpose: the same turn replays
   * the same performance.
   */
  let turnIdentity = "solace-live-turn-0";
  let origin: number | null = null;

  let phonemes: TimedPhoneme[] = [];
  let audioDuration = 0;
  let lastChunkOffset = -Infinity;
  let chunkCount = 0;
  let phonemeSeq = 0;

  const sentences: string[] = [];
  const seenChunkKeys = new Set<string>();
  const unknownLabels = new Map<string, number>();

  let droppedUnknown = 0;
  let droppedDegenerate = 0;
  let clampedOverlaps = 0;
  let duplicateChunks = 0;
  let nonMonotonicChunks = 0;
  let exactLabelMatches = 0;
  let normalizedLabelMatches = 0;
  let lookAheadSamples: number[] = [];

  /**
   * The payload handed to the runtime. Its identity changes only when the
   * timeline actually changes, so a consumer can cheaply detect "new data"
   * without diffing — and `phonemes` keeps ONE array identity for the whole
   * turn, so appending is O(k) in the chunk's own phonemes and never O(n) in
   * the response.
   */
  let payload: LiveAvatarPayload = buildPayload();

  function buildPayload(): LiveAvatarPayload {
    return {
      version: "1.0",
      id: turnIdentity,
      text: sentences.join(" "),
      language: ACCEPTED_LIVE_LANGUAGE,
      audio_owned_by: "live-stream",
      performance_seed: turnIdentity,
      audio_duration: audioDuration,
      phoneme_set: "arpabet",
      time_unit: "seconds",
      playback: { ...ACCEPTED_LIVE_PLAYBACK },
      phonemes,
      // Solace provides no word tier. Left undefined so the accepted runtime
      // takes its documented fallback rather than being handed invented spans.
      words: undefined,
      emotions: [],
      facial_cues: [],
      pauses: [],
      behaviour: ACCEPTED_LIVE_BEHAVIOUR,
      behaviour_settings: ACCEPTED_LIVE_BEHAVIOUR_SETTINGS,
      markers: [],
      metadata: {
        avatar_id: "hyper3d-usc",
        created_at: new Date(0).toISOString(),
        source: "solace-live-ws",
        description:
          "Live Solace WebSocket TTS turn. Audio is owned by EzriWsAudioScheduler; this payload carries timing only.",
      },
    };
  }

  function resetState(nextTurnId: number) {
    turnId = nextTurnId;
    turnIdentity = `solace-live-turn-${nextTurnId}`;
    origin = null;
    phonemes = [];
    audioDuration = 0;
    lastChunkOffset = -Infinity;
    chunkCount = 0;
    phonemeSeq = 0;
    sentences.length = 0;
    seenChunkKeys.clear();
    unknownLabels.clear();
    droppedUnknown = 0;
    droppedDegenerate = 0;
    clampedOverlaps = 0;
    duplicateChunks = 0;
    nonMonotonicChunks = 0;
    exactLabelMatches = 0;
    normalizedLabelMatches = 0;
    lookAheadSamples = [];
    payload = buildPayload();
  }

  function chunkKeyFor(input: LiveChunkAppendInput): string {
    // `chunk_index` is the backend's own per-turn ordinal and is what the audio
    // reorder buffer already keys on (ActiveSession `wsAudioReorderBufferRef`),
    // so it is the protocol's real chunk identity. When it is absent the
    // scheduled start time is unique by construction — the scheduler's
    // `nextStartTime` strictly advances — and the sentence disambiguates a
    // same-instant retry.
    return input.chunkIndex !== null && Number.isFinite(input.chunkIndex)
      ? `idx:${input.chunkIndex}`
      : `t:${input.audioContextStartTime.toFixed(4)}|${input.sentence}`;
  }

  return {
    /** Start a new assistant turn. Everything from the previous turn is dropped. */
    beginTurn(): number {
      resetState(turnId + 1);
      return turnId;
    },

    /**
     * Barge-in / teardown. Clears the timeline so no phoneme belonging to
     * cancelled audio can keep animating.
     *
     * It deliberately does NOT latch against further appends. Solace already
     * owns that guarantee and owns it at the only place it can be enforced:
     * `EzriWsAudioScheduler.stop()` bumps `sessionId` synchronously, and
     * `scheduleInner`'s last `session !== this.sessionId` check is followed by
     * straight-line synchronous code through `source.start()` into
     * `onChunkScheduled`. A chunk belonging to cancelled audio therefore never
     * reaches this module at all.
     *
     * Adding a second latch here would not add safety, and it would cost
     * correctness: a late chunk that arrives after `onPipelineIdle` — which is
     * real, which Solace flushes through `flushWsAudioQueue`, and whose audio
     * genuinely plays — would be refused and that span would go silent-faced.
     * Following the existing interruption semantics means trusting the existing
     * guard.
     */
    cancel(): void {
      resetState(turnId + 1);
    },

    getTurnId: () => turnId,
    /** The stable performance seed for the current turn. */
    getTurnIdentity: () => turnIdentity,
    getOrigin: () => origin,
    getAudioDuration: () => audioDuration,
    getPayload: () => payload,
    getPhonemeCount: () => phonemes.length,

    /**
     * Convert one scheduled chunk into response-relative time and append it.
     *
     * Called from `onChunkScheduled`, which the scheduler fires AFTER
     * `source.start()`. This function therefore cannot delay playback: by the
     * time it runs, the audio for this chunk is already committed to the
     * AudioContext timeline at a start time this code never sees before it is
     * final.
     */
    appendScheduledChunk(input: LiveChunkAppendInput): LiveChunkAppendResult {
      const chunkKey = chunkKeyFor(input);

      if (seenChunkKeys.has(chunkKey)) {
        duplicateChunks += 1;
        return { accepted: false, chunkKey, reason: "duplicate" };
      }
      if (
        !Number.isFinite(input.audioContextStartTime) ||
        !Number.isFinite(input.durationSeconds) ||
        input.durationSeconds <= 0
      ) {
        return { accepted: false, chunkKey, reason: "invalid-timing" };
      }

      const source = input.timeline?.phonemes ?? [];
      if (source.length === 0) {
        // No lip-sync data for this chunk. The audio still plays — Solace owns
        // it — and `audio_duration` still has to advance past it, or the clock
        // would clamp and the next chunk's phonemes would never be reached.
        seenChunkKeys.add(chunkKey);
        if (origin === null) origin = input.audioContextStartTime;
        const offset = input.audioContextStartTime - origin;
        if (offset + input.durationSeconds > audioDuration) {
          audioDuration = offset + input.durationSeconds;
        }
        lastChunkOffset = Math.max(lastChunkOffset, offset);
        chunkCount += 1;
        const trimmedSentence = input.sentence.trim();
        if (trimmedSentence) sentences.push(trimmedSentence);
        payload = buildPayload();
        return { accepted: false, chunkKey, reason: "no-phonemes" };
      }

      if (origin === null) origin = input.audioContextStartTime;
      const chunkOffset = input.audioContextStartTime - origin;

      // The scheduler advances `nextStartTime` by each chunk's audible duration,
      // so offsets are monotonic by construction. A regression would mean the
      // schedule was rebuilt underneath us; rewriting published timing to absorb
      // it is explicitly out of bounds, so the chunk is refused and reported.
      if (chunkOffset < lastChunkOffset) {
        nonMonotonicChunks += 1;
        return { accepted: false, chunkKey, reason: "non-monotonic" };
      }

      const chunkEnd = chunkOffset + input.durationSeconds;
      let appended = 0;
      let localDroppedUnknown = 0;
      let localDroppedDegenerate = 0;
      let localClamped = 0;
      // Only ever compared against phonemes appended during THIS call, so
      // nothing already published can be moved.
      let cursor = phonemes.length > 0 ? phonemes[phonemes.length - 1].end_time : 0;

      for (let i = 0; i < source.length; i += 1) {
        const item = source[i];
        // Normalize from the RAW backend label when it survived upstream:
        // Solace's own `normalizePhonemeLabel` already strips digits and
        // non-A–Z, and re-running that over its output would hide a stress digit
        // the audit needs to see.
        const result = normalizeLivePhoneme(item.rawPhoneme ?? item.phoneme);
        if (!result.supported) {
          localDroppedUnknown += 1;
          unknownLabels.set(result.raw, (unknownLabels.get(result.raw) ?? 0) + 1);
          continue;
        }
        if (result.exact) exactLabelMatches += 1;
        else normalizedLabelMatches += 1;

        const rawStart = chunkOffset + item.start;
        const rawEnd =
          item.end != null
            ? chunkOffset + item.end
            : chunkOffset + (source[i + 1]?.start ?? input.durationSeconds);

        // Clip into the chunk's own audible window. This is the guard that makes
        // cross-chunk overlap impossible without touching anything published:
        // the next chunk starts at or after this chunk's end.
        let start = Math.min(Math.max(rawStart, chunkOffset), chunkEnd);
        let end = Math.min(Math.max(rawEnd, start), chunkEnd);

        if (start < cursor - OVERLAP_TOLERANCE_SECONDS) {
          start = cursor;
          if (end < start) end = start;
          localClamped += 1;
        }

        if (end - start < MIN_PHONEME_SECONDS) {
          localDroppedDegenerate += 1;
          continue;
        }

        phonemeSeq += 1;
        phonemes.push({
          id: `t${turnId}-p${phonemeSeq}`,
          phoneme: result.phoneme,
          start_time: start,
          end_time: end,
          intensity: ACCEPTED_LIVE_PHONEME_INTENSITY,
        });
        cursor = end;
        appended += 1;
      }

      seenChunkKeys.add(chunkKey);
      chunkCount += 1;
      lastChunkOffset = chunkOffset;
      if (chunkEnd > audioDuration) audioDuration = chunkEnd;
      droppedUnknown += localDroppedUnknown;
      droppedDegenerate += localDroppedDegenerate;
      clampedOverlaps += localClamped;

      const trimmedSentence = (input.timeline?.sentence || input.sentence).trim();
      if (trimmedSentence) sentences.push(trimmedSentence);

      const lookAheadSeconds =
        input.audioContextStartTime - input.contextTimeAtAppend;
      lookAheadSamples.push(lookAheadSeconds);

      payload = buildPayload();

      return {
        accepted: true,
        chunkKey,
        chunkOffsetSeconds: chunkOffset,
        appendedPhonemes: appended,
        droppedUnknown: localDroppedUnknown,
        droppedDegenerate: localDroppedDegenerate,
        clampedOverlaps: localClamped,
        lookAheadSeconds,
      };
    },

    /** Response-relative seconds for an AudioContext time. `null` before the first chunk. */
    toResponseTime(contextTime: number): number | null {
      if (origin === null) return null;
      return contextTime - origin;
    },

    getStats(): LiveTimelineStats {
      return {
        turnId,
        originContextTime: origin,
        chunkCount,
        phonemeCount: phonemes.length,
        audioDuration,
        droppedUnknown,
        droppedDegenerate,
        clampedOverlaps,
        duplicateChunks,
        nonMonotonicChunks,
        unknownLabels: Object.fromEntries(unknownLabels),
        exactLabelMatches,
        normalizedLabelMatches,
        lookAheadSamples: [...lookAheadSamples],
      };
    },
  };
}
