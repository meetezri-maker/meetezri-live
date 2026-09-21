import type { AvatarPayload, TimedPhoneme, TimedPause } from "../../types/avatarPayload";

/**
 * Phoneme lookup for one payload.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS WAS REWRITTEN (streaming compatibility, not tuning)
 * ─────────────────────────────────────────────────────────────────────────────
 * The previous implementation was three array scans per frame, one of which
 * copied the whole array:
 *
 *   activePhoneme    phonemes.find(...)                 O(n) from index 0
 *   previousPhoneme  [...phonemes].reverse().find(...)  O(n) + a full COPY
 *   nextPhoneme      phonemes.find(...)                 O(n) from index 0
 *
 * On the static payloads this project ships — tens of phonemes, fixed length —
 * that is invisible. On a LIVE Solace response the phoneme array grows with
 * every scheduled audio chunk across a whole multi-sentence turn, so the copy
 * becomes an unbounded per-frame allocation and the scans grow with the reply.
 *
 * This version keeps ONE monotonic index and answers all three questions from
 * it. SEMANTICS ARE UNCHANGED — every method returns exactly what the scanning
 * implementation returned, for every input, including out-of-order and
 * out-of-range times. Nothing about phoneme timing, coarticulation, or the
 * values any consumer reads is affected; only how the same phoneme is found.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE INVARIANT
 * ─────────────────────────────────────────────────────────────────────────────
 * `index` is the position of the first phoneme whose `end_time > time`.
 *
 * Payload phonemes are ordered by `start_time` and may not overlap by more than
 * the schema's 5 ms tolerance, so `end_time` is non-decreasing and that position
 * is a lower bound: the ONLY phoneme that can contain `time` is the one at
 * `index`, and everything before it has already finished.
 *
 * `locate` walks the index to the frame's time. Forward playback advances it by
 * a step or two per frame; a backward seek walks it back the same way. Both
 * loops are bounded by the distance actually travelled, never by the array
 * length, and neither allocates.
 */
export class TimelineCursor {
  private index = 0;
  /** The same idea for the pause track, read once per frame alongside the phonemes. */
  private pauseIndex = 0;

  constructor(private payload: AvatarPayload) {}

  /**
   * Point the cursor at a new payload without losing its position.
   *
   * A live response REPLACES the payload object every time a chunk is appended.
   * Rebuilding the cursor would send the index back to 0 and re-walk the whole
   * reply on the next frame, which is the cost this class exists to avoid.
   * Appended phonemes only ever extend the array past the current index, so the
   * index stays meaningful; `locate` re-derives it from the clock on every
   * lookup regardless, so even a completely different payload self-corrects.
   */
  setPayload(payload: AvatarPayload) {
    this.payload = payload;
    if (this.index > payload.phonemes.length) this.index = payload.phonemes.length;
    if (this.pauseIndex > payload.pauses.length) this.pauseIndex = payload.pauses.length;
  }

  seek(time: number) { return Math.min(this.payload.audio_duration, Math.max(0, time)); }

  /** Move `index` to the first phoneme whose `end_time > time`, and return it. */
  private locate(time: number) {
    const phonemes = this.payload.phonemes;
    const length = phonemes.length;
    if (this.index > length) this.index = length;
    while (this.index < length && phonemes[this.index].end_time <= time) this.index += 1;
    while (this.index > 0 && phonemes[this.index - 1].end_time > time) this.index -= 1;
    return this.index;
  }

  activePhoneme(time: number): TimedPhoneme | undefined {
    const candidate = this.payload.phonemes[this.locate(time)];
    // `locate` guarantees `candidate.end_time > time`, so containment reduces to
    // the start edge — the same test the old `find` predicate applied.
    return candidate && time >= candidate.start_time ? candidate : undefined;
  }

  previousPhoneme(time: number): TimedPhoneme | undefined {
    const phonemes = this.payload.phonemes;
    const at = this.locate(time);
    const candidate = phonemes[at];
    const active = candidate && time >= candidate.start_time ? candidate : undefined;
    const boundary = active?.start_time ?? time;
    // The last phoneme that has finished by `boundary` — what the reversed scan
    // returned. Everything at or after `at` ends later than `time`, and so later
    // than `boundary`, which is why the search can start just below the cursor
    // and walks back only over phonemes that straddle the boundary.
    for (let i = at - 1; i >= 0; i -= 1) {
      if (phonemes[i].end_time <= boundary) return phonemes[i];
    }
    return undefined;
  }

  nextPhoneme(time: number): TimedPhoneme | undefined {
    const phonemes = this.payload.phonemes;
    // The first phoneme starting strictly after `time`. It is at or after the
    // cursor, because everything below the cursor has already ended.
    for (let i = this.locate(time); i < phonemes.length; i += 1) {
      if (phonemes[i].start_time > time) return phonemes[i];
    }
    return undefined;
  }

  activePause(time: number): TimedPause | undefined {
    const pauses = this.payload.pauses;
    const length = pauses.length;
    if (this.pauseIndex > length) this.pauseIndex = length;
    while (this.pauseIndex < length && pauses[this.pauseIndex].end_time <= time) this.pauseIndex += 1;
    while (this.pauseIndex > 0 && pauses[this.pauseIndex - 1].end_time > time) this.pauseIndex -= 1;
    const candidate = pauses[this.pauseIndex];
    return candidate && time >= candidate.start_time ? candidate : undefined;
  }

  phonemeProgress(time: number, phoneme?: TimedPhoneme) { return phoneme ? (time - phoneme.start_time) / Math.max(.001, phoneme.end_time - phoneme.start_time) : 0; }
}
