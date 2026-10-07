import { useEffect, useRef } from "react";

/**
 * Holds a screen wake lock for as long as `active` is true and the document is
 * visible, so the phone does not dim/lock mid-conversation.
 *
 * `active` is expected to be the session's own "live" state — not microphone
 * activity, audio playback or avatar animation — so the lock survives silence
 * between turns, mute, and whichever avatar runtime is mounted.
 *
 * Browsers release the lock themselves whenever the page stops being visible,
 * so visibility is re-checked on every `visibilitychange` and the lock is
 * re-requested when the user comes back to a session that is still active.
 */
export function useScreenWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const releaseListenerRef = useRef<(() => void) | null>(null);
  /** Non-zero while a request for that generation is in flight. */
  const pendingGenerationRef = useRef(0);
  /** Bumped per effect run so a stale owner can never touch a newer lock. */
  const generationRef = useRef(0);

  useEffect(() => {
    // Screen Wake Lock is unsupported on iOS < 16.4, Firefox and any insecure
    // context — typed as always-present by lib.dom, so widen it before probing.
    const wakeLock: WakeLock | undefined = navigator.wakeLock;
    const generation = (generationRef.current += 1);
    /** True once this owner has torn down; its in-flight work is then worthless. */
    let disposed = false;

    /** Forget our sentinel and stop listening to it, returning what we dropped. */
    const detachSentinel = (): WakeLockSentinel | null => {
      const sentinel = sentinelRef.current;
      const listener = releaseListenerRef.current;
      sentinelRef.current = null;
      releaseListenerRef.current = null;
      if (sentinel && listener) {
        try {
          sentinel.removeEventListener("release", listener);
        } catch {
          /* ignore */
        }
      }
      return sentinel;
    };

    /** Release a sentinel without ever surfacing a rejection. */
    const releaseSentinel = (sentinel: WakeLockSentinel) => {
      void Promise.resolve()
        .then(() => sentinel.release())
        .catch(() => {
          /* already released by the browser — nothing left to do */
        });
    };

    const releaseOwnedLock = () => {
      const sentinel = detachSentinel();
      if (sentinel) releaseSentinel(sentinel);
    };

    const acquireLock = () => {
      if (!wakeLock || typeof wakeLock.request !== "function") return;
      if (disposed || generationRef.current !== generation) return;
      if (document.visibilityState !== "visible") return;
      // Never hold two locks, and never overlap two requests for this owner.
      if (sentinelRef.current || pendingGenerationRef.current === generation) return;

      pendingGenerationRef.current = generation;
      void Promise.resolve()
        .then(() => wakeLock.request("screen"))
        .then((sentinel) => {
          if (pendingGenerationRef.current === generation) {
            pendingGenerationRef.current = 0;
          }
          // Resolved after the session ended, the owner unmounted, a newer
          // session took over, or the page went hidden: this lock is nobody's.
          if (
            disposed ||
            generationRef.current !== generation ||
            sentinelRef.current ||
            document.visibilityState !== "visible"
          ) {
            releaseSentinel(sentinel);
            return;
          }
          const listener = () => {
            // The browser dropped it (tab hidden, OS policy): keep our ref honest.
            if (sentinelRef.current === sentinel) detachSentinel();
          };
          try {
            sentinel.addEventListener("release", listener);
          } catch {
            /* ignore */
          }
          sentinelRef.current = sentinel;
          releaseListenerRef.current = listener;
        })
        .catch(() => {
          // Denied, blocked by permissions policy, or the page hid mid-request.
          if (pendingGenerationRef.current === generation) {
            pendingGenerationRef.current = 0;
          }
        });
    };

    if (!active) {
      releaseOwnedLock();
      return;
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") acquireLock();
      else releaseOwnedLock();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    acquireLock();

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      // Only the current owner releases, so teardown of an old session cannot
      // take down the lock a newer session has already acquired.
      if (generationRef.current === generation) releaseOwnedLock();
    };
  }, [active]);
}
