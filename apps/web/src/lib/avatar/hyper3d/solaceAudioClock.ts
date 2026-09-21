/**
 * The Hyper3D audio clock, backed by Solace's existing WebSocket audio scheduler.
 *
 * `AvatarAudioClock` is avatar-test's accepted interface
 * (`avatar-test/src/engine/audio/AudioClock.ts`) and is reproduced here
 * unchanged. It is deliberately three read-only methods and nothing else, and
 * avatar-test already ships a second implementation of it (`StaticAudioClock`)
 * that has no `HTMLAudioElement` at all — so satisfying it from an AudioContext
 * is using the interface as designed, not bending it.
 *
 * This clock OWNS NOTHING. It creates no AudioContext, holds no audio element,
 * starts no timer and no RAF; it reads the scheduler's context time and the
 * live timeline's origin and subtracts. Solace's playback stays authoritative in
 * the strictest sense: if the scheduler is torn down, this clock reports zero
 * rather than continuing on its own.
 */

/** Verbatim from `avatar-test/src/engine/audio/AudioClock.ts`. */
export interface AvatarAudioClock {
  getCurrentTime(): number;
  getDuration(): number;
  isPlaying(): boolean;
}

export type SolaceAudioClockDeps = {
  /** `wsSchedulerRef.current?.getAudioContext()?.currentTime` — or null when torn down. */
  getContextTime: () => number | null;
  /** Response playback origin in the SAME AudioContext domain. Null before chunk 0. */
  getOriginContextTime: () => number | null;
  /** End of the last scheduled chunk, response-relative. Grows as chunks arrive. */
  getAudioDuration: () => number;
  /** `EzriWsAudioScheduler.isPipelineActive()` — decoding, scheduled, or draining. */
  isPipelineActive: () => boolean;
};

export type SolaceAudioClock = AvatarAudioClock & {
  /** Unclamped response time, for diagnostics that need to see the overrun. */
  getRawResponseTime(): number | null;
};

export function createSolaceAudioClock(
  deps: SolaceAudioClockDeps,
): SolaceAudioClock {
  const rawResponseTime = (): number | null => {
    const origin = deps.getOriginContextTime();
    if (origin === null) return null;
    const now = deps.getContextTime();
    if (now === null || !Number.isFinite(now)) return null;
    return now - origin;
  };

  return {
    /**
     * Clamped to `[0, audio_duration]`, which is what the accepted runtime sees
     * from a media element too: `HTMLMediaElement.currentTime` never runs past
     * `duration`, and `TimelineCursor.seek` clamps to the same bounds anyway.
     *
     * The clamp is also what makes the gap between chunks behave correctly. When
     * the clock runs past the last scheduled chunk it FREEZES at the end of the
     * timeline instead of advancing into phoneme-less territory — exactly what
     * Solace's existing `tickClock` does today, where an inactive frame leaves
     * `avatarAudioCurrentTimeRef` untouched so the mouth relaxes.
     */
    getCurrentTime(): number {
      const raw = rawResponseTime();
      if (raw === null) return 0;
      const duration = deps.getAudioDuration();
      if (raw <= 0) return 0;
      return duration > 0 ? Math.min(raw, duration) : 0;
    },

    getDuration(): number {
      return deps.getAudioDuration();
    },

    /**
     * True only while Solace itself says audio is in flight. A turn that has
     * been cancelled clears the origin, so this reports false on the very next
     * read and no stale phoneme can be considered "playing".
     */
    isPlaying(): boolean {
      if (deps.getOriginContextTime() === null) return false;
      return deps.isPipelineActive();
    },

    getRawResponseTime: rawResponseTime,
  };
}
