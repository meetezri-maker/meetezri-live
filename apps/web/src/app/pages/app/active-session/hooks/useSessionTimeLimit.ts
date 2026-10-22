import { useEffect, useRef, type MutableRefObject } from "react";

import {
  activeSegmentElapsedSeconds,
  resolveSessionExpiry,
  type SessionExpiryInput,
  type SessionExpiryReason,
} from "../utils/sessionExpiry";

/**
 * Counts active session seconds while `running` (live, unpaused, not ended). Each running stretch
 * is measured from the wall clock, so background-tab throttling cannot slow the count, while time
 * spent paused is never counted.
 */
export function useActiveSessionTimer(
  running: boolean,
  sessionTimeRef: MutableRefObject<number>,
  isEndingRef: MutableRefObject<boolean>,
  setSessionTime: (seconds: number) => void,
): void {
  useEffect(() => {
    if (!running) return;

    const segmentStartMs = Date.now();
    const segmentBaseSeconds = sessionTimeRef.current;
    const timer = window.setInterval(() => {
      if (isEndingRef.current) return;
      const next = activeSegmentElapsedSeconds(segmentBaseSeconds, segmentStartMs, Date.now());
      if (next === sessionTimeRef.current) return;
      // Keep accurate time in a ref (no React render), and the UI timer in sync.
      sessionTimeRef.current = next;
      setSessionTime(next);
    }, 1000);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);
}

/** Calls `onExpire` once, the first time a session limit is reached, unless the session already ended. */
export function useSessionExpiry(
  input: SessionExpiryInput & {
    ended: boolean;
    onExpire: (reason: SessionExpiryReason) => void;
  },
): void {
  const firedRef = useRef(false);
  const onExpireRef = useRef(input.onExpire);
  onExpireRef.current = input.onExpire;

  const reason = resolveSessionExpiry(input);
  const { ended } = input;

  useEffect(() => {
    if (!reason || ended || firedRef.current) return;
    firedRef.current = true;
    onExpireRef.current(reason);
  }, [reason, ended]);
}
