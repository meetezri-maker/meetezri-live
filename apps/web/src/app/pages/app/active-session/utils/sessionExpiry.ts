/**
 * Session time-limit rules for the live session page.
 *
 * Two limits can end a session: the length the member selected in the lobby ("duration") and the
 * account balance they started with ("credits"). Both are measured against the same active-time
 * clock, which only runs while the session is live and not paused.
 */

export type SessionExpiryReason = "duration" | "credits";

export interface SessionExpiryInput {
  /** Active seconds elapsed (excludes paused time). */
  elapsedSeconds: number;
  /** Selected session length in seconds; null when the session has none. */
  selectedLimitSeconds: number | null;
  /** Account balance at session start in seconds; null until loaded. */
  accountCreditsSeconds: number | null;
  /** False while the selected length is still being recovered, so no limit is guessed. */
  selectedLimitResolved: boolean;
}

export function resolveSessionExpiry({
  elapsedSeconds,
  selectedLimitSeconds,
  accountCreditsSeconds,
  selectedLimitResolved,
}: SessionExpiryInput): SessionExpiryReason | null {
  if (!selectedLimitResolved) return null;
  if (selectedLimitSeconds !== null && elapsedSeconds >= selectedLimitSeconds) return "duration";
  if (accountCreditsSeconds !== null && elapsedSeconds >= accountCreditsSeconds) return "credits";
  return null;
}

/**
 * Active seconds for a running (unpaused) stretch of the session, measured from the wall clock so
 * throttled or delayed timer callbacks do not lose time. A clock that moves backwards never
 * reduces elapsed time.
 */
export function activeSegmentElapsedSeconds(
  segmentBaseSeconds: number,
  segmentStartMs: number,
  nowMs: number,
): number {
  return segmentBaseSeconds + Math.max(0, Math.floor((nowMs - segmentStartMs) / 1000));
}

/**
 * Runs every cleanup step even when an earlier one throws; returns the names of steps that failed.
 */
export function runCleanupSteps(steps: ReadonlyArray<readonly [string, () => void]>): string[] {
  const failed: string[] = [];
  for (const [name, step] of steps) {
    try {
      step();
    } catch (error) {
      failed.push(name);
      console.warn(`[ActiveSession] cleanup step "${name}" failed:`, error);
    }
  }
  return failed;
}

/**
 * Calls `send` until it succeeds, at most `delaysMs.length + 1` times, stopping early on errors
 * `shouldRetry` rejects. Retrying is safe because the server finalizes a session once and ignores
 * later end requests.
 */
export async function sendWithRetry(
  send: () => Promise<unknown>,
  delaysMs: readonly number[] = [500, 1500],
  wait: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => window.setTimeout(resolve, ms)),
  shouldRetry: (error: unknown) => boolean = () => true,
): Promise<boolean> {
  for (let attempt = 0; ; attempt++) {
    try {
      await send();
      return true;
    } catch (error) {
      if (attempt >= delaysMs.length || !shouldRetry(error)) {
        console.error("[ActiveSession] Session end request failed:", error);
        return false;
      }
      await wait(delaysMs[attempt]);
    }
  }
}

/** Network failures and server errors are worth retrying; auth and validation errors are not. */
export function isRetryableEndError(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status === "number") return status >= 500 || status === 408 || status === 429;
  return error instanceof TypeError;
}

/** Server session row says this session can no longer be resumed. */
export function isPersistedSessionClosed(
  session: { status?: unknown; ended_at?: unknown } | null | undefined,
): boolean {
  if (!session) return true;
  return session.status === "completed" || Boolean(session.ended_at);
}

/** Selected length of a persisted session that is still live, in minutes. */
export function persistedSelectedMinutes(
  session: { status?: unknown; duration_minutes?: unknown } | null | undefined,
): number | null {
  if (!session || session.status !== "active") return null;
  const minutes = session.duration_minutes;
  return typeof minutes === "number" && minutes > 0 ? minutes : null;
}

const ENDED_SESSION_KEY = "ezri_ended_session_id";

/**
 * Remembers, for this tab, the session that just ended. A reload of the same URL then refuses to
 * reopen it even before the server has processed the end request sent while unloading.
 */
export function rememberEndedSession(sessionId: string | null): void {
  if (!sessionId) return;
  try {
    window.sessionStorage.setItem(ENDED_SESSION_KEY, sessionId);
  } catch {
    /* ignore */
  }
}

export function wasSessionEndedInThisTab(sessionId: string | null): boolean {
  if (!sessionId) return false;
  try {
    return window.sessionStorage.getItem(ENDED_SESSION_KEY) === sessionId;
  } catch {
    return false;
  }
}
