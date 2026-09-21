import {
  analyzeSpeechAudio,
  type SpeechAcousticFrame,
} from "./engine/engine/avatar/upstream/threejs-talking-avatar/audioAnalysis";

/**
 * LIVE ACOUSTIC TRACK — the accepted head performance's missing input.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 * The accepted production head source refuses to plan without an acoustic track:
 *
 *     // hyper3dThreejsTalkingAvatarHead.ts:409
 *     if (!input.acousticFrames.length) return null;
 *
 * and a null plan holds head and neck at rest AND nulls `frame`, which is what
 * semantic affect is read from — so no warmth, eye softening, cheek response or
 * semantic brows would render either.
 *
 * In avatar-test those frames come from fetching and decoding `payload.audio_url`.
 * A live Solace payload has no URL: `EzriWsAudioScheduler` owns the audio, and
 * re-decoding is forbidden. So this module analyses the buffer the scheduler has
 * ALREADY decoded and is ALREADY playing.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IT DOES NOT DO
 * ─────────────────────────────────────────────────────────────────────────────
 *  - no fetch, no decode, no AudioContext, no player
 *  - no adapter: `AudioBuffer` structurally satisfies the accepted analyzer's
 *    own `PcmAudioLike` contract, so the buffer is passed straight through
 *  - no mutation, and no retention: the buffer reference is dropped the moment
 *    its frames are extracted (§11). Only the compact frames are kept.
 *  - no second cancellation system: turn identity comes from the caller, the
 *    same identity the phoneme timeline already uses.
 */

/** Frames plus the response-relative window they cover. */
export type LiveAcousticAppendResult =
  | {
      accepted: true;
      chunkKey: string;
      frameCount: number;
      chunkOffsetSeconds: number;
      /** ms spent inside `analyzeSpeechAudio` for this chunk. */
      analysisMs: number;
    }
  | {
      accepted: false;
      chunkKey: string;
      reason: "duplicate" | "stale-turn" | "empty" | "no-buffer";
    };

export type LiveAcousticStats = {
  turnId: number;
  chunkCount: number;
  frameCount: number;
  duplicateChunks: number;
  staleResults: number;
  analysisMs: number[];
  /** audibleStart − analysisComplete, in ms. Positive means ready in time. */
  leadTimesMs: number[];
};

export type LiveAcousticChunk = {
  /** The scheduler's already-decoded buffer. Read, never retained. */
  audioBuffer: Pick<AudioBuffer, "sampleRate" | "length" | "numberOfChannels" | "getChannelData">;
  /** Response-relative start of this chunk (same conversion phonemes use). */
  chunkOffsetSeconds: number;
  /** Leading silence the scheduler skipped, so analysis time aligns with audio. */
  leadInSeconds: number;
  /** Stable chunk identity — the SAME key the phoneme timeline dedups on. */
  chunkKey: string;
  /** Turn identity, so a late result from a cancelled turn can be dropped. */
  turnId: number;
};

export type LiveAcousticTrack = ReturnType<typeof createLiveAcousticTrack>;

export function createLiveAcousticTrack(deps: { now?: () => number } = {}) {
  const now = deps.now ?? (() => performance.now());

  let turnId = 0;
  let frames: SpeechAcousticFrame[] = [];
  let chunkCount = 0;
  let duplicateChunks = 0;
  let staleResults = 0;
  const seenChunkKeys = new Set<string>();
  const analysisMs: number[] = [];
  const leadTimesMs: number[] = [];

  return {
    beginTurn(nextTurnId: number) {
      turnId = nextTurnId;
      frames = [];
      chunkCount = 0;
      duplicateChunks = 0;
      staleResults = 0;
      seenChunkKeys.clear();
      analysisMs.length = 0;
      leadTimesMs.length = 0;
    },

    /**
     * Barge-in / teardown. Future acoustic frames are discarded along with the
     * turn; a late analysis result is rejected by its `turnId`, not by a second
     * cancellation mechanism.
     */
    cancel(nextTurnId: number) {
      turnId = nextTurnId;
      frames = [];
      chunkCount = 0;
      seenChunkKeys.clear();
    },

    getTurnId: () => turnId,
    /** The accepted analyzer's own frame type, response-relative. */
    getFrames: (): readonly SpeechAcousticFrame[] => frames,
    getFrameCount: () => frames.length,

    /**
     * Analyse one already-decoded chunk and append its frames.
     *
     * The buffer is read here and NOT stored: `analyzeSpeechAudio` returns
     * compact frames and the reference goes out of scope with this call.
     */
    appendChunk(chunk: LiveAcousticChunk): LiveAcousticAppendResult {
      if (chunk.turnId !== turnId) {
        staleResults += 1;
        return { accepted: false, chunkKey: chunk.chunkKey, reason: "stale-turn" };
      }
      if (seenChunkKeys.has(chunk.chunkKey)) {
        duplicateChunks += 1;
        return { accepted: false, chunkKey: chunk.chunkKey, reason: "duplicate" };
      }
      if (!chunk.audioBuffer || chunk.audioBuffer.length === 0) {
        return { accepted: false, chunkKey: chunk.chunkKey, reason: "no-buffer" };
      }

      const startedAt = now();
      // Straight through: `AudioBuffer` already satisfies `PcmAudioLike`.
      const local = analyzeSpeechAudio(chunk.audioBuffer);
      const elapsed = now() - startedAt;

      if (local.length === 0) {
        seenChunkKeys.add(chunk.chunkKey);
        return { accepted: false, chunkKey: chunk.chunkKey, reason: "empty" };
      }

      /**
       * Onto the SAME response timeline the phonemes use.
       *
       *   responseTime = chunkOffset + (localTime − leadIn)
       *
       * `leadIn` is subtracted because the scheduler skips that much of the head
       * of the buffer via `source.start(when, offset)`. Analysis sees the whole
       * buffer including the silence, so without this the acoustic track would
       * sit later than the audio by exactly the trimmed amount.
       */
      for (const frame of local) {
        const responseTime = chunk.chunkOffsetSeconds + (frame.time - chunk.leadInSeconds);
        if (responseTime < 0) continue;
        frames.push({ ...frame, time: responseTime });
      }

      seenChunkKeys.add(chunk.chunkKey);
      chunkCount += 1;
      analysisMs.push(elapsed);

      return {
        accepted: true,
        chunkKey: chunk.chunkKey,
        frameCount: local.length,
        chunkOffsetSeconds: chunk.chunkOffsetSeconds,
        analysisMs: elapsed,
      };
    },

    /** Records `audibleStart − analysisComplete`; positive means ready in time. */
    noteLeadTime(leadMs: number) {
      leadTimesMs.push(leadMs);
    },

    getStats(): LiveAcousticStats {
      return {
        turnId,
        chunkCount,
        frameCount: frames.length,
        duplicateChunks,
        staleResults,
        analysisMs: [...analysisMs],
        leadTimesMs: [...leadTimesMs],
      };
    },
  };
}
