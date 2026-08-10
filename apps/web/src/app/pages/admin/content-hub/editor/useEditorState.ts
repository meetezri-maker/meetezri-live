/**
 * Editor state: autosave, concurrency and dirty tracking.
 *
 * Kept out of the component so the rules are testable and stated in one place:
 *
 *   - Autosave is for DRAFT-LIKE content only. A published item is edited live, so it is only
 *     ever changed by an explicit save (backend refuses autosave on published items anyway).
 *   - Autosave never creates a revision; explicit save always does.
 *   - A stale `expectedUpdatedAt` stops autosave dead and raises a conflict, rather than
 *     retrying and overwriting whoever won the race.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { isApiError, type ContentHubDetail, type ContentHubUpdateBody } from '@/lib/api';

export const AUTOSAVE_DEBOUNCE_MS = 2000;

export type SaveState =
  | { kind: 'idle' }
  | { kind: 'dirty' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: string }
  | { kind: 'error'; message: string };

export interface ConflictInfo {
  currentUpdatedAt: string | null;
  updatedBy: string | null;
}

export interface UseEditorStateOptions {
  content: ContentHubDetail | undefined;
  save: (body: ContentHubUpdateBody) => Promise<ContentHubDetail>;
}

export function useEditorState({ content, save }: UseEditorStateOptions) {
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  /** The concurrency token. Advances on every successful save. */
  const tokenRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const pendingRef = useRef<(() => ContentHubUpdateBody) | null>(null);
  /** Serialises saves, so a queued one reads the token the previous save returned. */
  const queueRef = useRef<Promise<ContentHubDetail | null>>(Promise.resolve(null));

  /**
   * Adopt the server's concurrency token, including when it moves after we loaded.
   *
   * This used to be `if (tokenRef.current === null)` — latched once on first load and never
   * refreshed. That made the editor page uniquely fragile: an approval, a status transition, a
   * schedule change or a link replace all bump `content_items.updated_at` server-side, the detail
   * query refetches with the new value, and the editor carried on holding the pre-change token.
   * The next save then failed the optimistic-concurrency check against a change the editor had
   * itself just made. The review queue never hit this because it holds no token at all — which is
   * exactly why approving from outside the editor worked and approving from inside did not.
   *
   * WHEN THE EDITOR IS DIRTY THE TOKEN IS LEFT ALONE. From here a moved timestamp is
   * indistinguishable between "the workflow action I just took" and "a colleague saved the body",
   * and silently adopting it in the second case would overwrite their work. Keeping the stale
   * token means the conflict dialog still fires, which is the behaviour that protects them.
   */
  useEffect(() => {
    if (!content) return;
    if (tokenRef.current === null) {
      tokenRef.current = content.updatedAt;
      return;
    }
    if (isDirty || saveState.kind === 'saving') return;

    /**
     * FORWARD ONLY.
     *
     * A successful save advances the token immediately, while the detail query still holds the
     * pre-save payload for a moment. Without this comparison the next render would hand back that
     * older timestamp and roll the token backwards — turning the very next save into a spurious
     * conflict. Only a genuinely newer server version is adopted.
     */
    const current = tokenRef.current ? Date.parse(tokenRef.current) : 0;
    const incoming = Date.parse(content.updatedAt);
    if (Number.isFinite(incoming) && incoming > current) tokenRef.current = content.updatedAt;
  }, [content, isDirty, saveState.kind]);

  /** Published items never autosave — the backend refuses it, and so does the editor. */
  const autosaveAllowed = !!content && content.status !== 'published';

  const runSave = useCallback(
    async (buildBody: () => ContentHubUpdateBody, createRevision: boolean) => {
      /**
       * SAVES ARE SERIALISED, and this is the whole fix for the false "Someone else changed this
       * content" on Author/Reviewer.
       *
       * `saveNow` cancels the autosave TIMER, but it cannot cancel an autosave that has already
       * fired and is in flight. Both requests then read the same `tokenRef` and send the same
       * `expectedUpdatedAt`: the first consumes it, the server advances `updated_at`, and the
       * second comes back 409 STALE_UPDATE — a conflict with nobody.
       *
       * It surfaced on Author and Reviewer because those are dropdowns. A pick followed by a click
       * on Save lands inside the two-second debounce far more often than typing does, where every
       * keystroke pushes the timer out again.
       *
       * Waiting for the in-flight save means the second one reads the token the first just
       * returned. Optimistic concurrency is untouched — a genuine external edit still 409s.
       */
      // A CHAIN, not a single slot: three overlapping saves must each wait for the one before it.
      // Awaiting a shared "current" promise would let the second and third both wake on the first
      // and read the same token, which is the bug this exists to prevent.
      const previous = queueRef.current;
      const attempt = (async () => {
        await previous.catch(() => undefined);

        const token = tokenRef.current;
        if (!token) return null;

        setSaveState({ kind: 'saving' });
        return save({ ...buildBody(), expectedUpdatedAt: token, createRevision });
      })();

      queueRef.current = attempt;

      try {
        const result = await attempt;
        if (!result) return null;
        tokenRef.current = result.updatedAt;
        setIsDirty(false);
        setSaveState({ kind: 'saved', at: result.updatedAt });
        return result;
      } catch (error) {
        if (isApiError(error) && error.code === 'STALE_UPDATE') {
          // Stop autosave immediately: retrying would either fail forever or, worse, succeed
          // against a token that no longer represents what the user is looking at.
          if (timerRef.current) window.clearTimeout(timerRef.current);
          pendingRef.current = null;
          const details = (error.body?.details ?? {}) as Record<string, unknown>;
          setConflict({
            currentUpdatedAt: (details.currentUpdatedAt as string) ?? null,
            updatedBy: (details.updatedBy as string) ?? null,
          });
          setSaveState({ kind: 'error', message: 'Someone else changed this content.' });
          return null;
        }

        const message = isApiError(error) ? error.message : 'Could not save. Your changes are still here.';
        setSaveState({ kind: 'error', message });
        return null;
      }
    },
    [save],
  );

  /** Mark dirty and schedule an autosave (draft-like content only). */
  const markDirty = useCallback(
    (buildBody: () => ContentHubUpdateBody) => {
      setIsDirty(true);
      setSaveState((current) => (current.kind === 'saving' ? current : { kind: 'dirty' }));

      if (!autosaveAllowed || conflict) return;

      pendingRef.current = buildBody;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        const build = pendingRef.current;
        pendingRef.current = null;
        if (build) void runSave(build, false);
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [autosaveAllowed, conflict, runSave],
  );

  /** Explicit save — always creates a revision, and cancels any pending autosave. */
  const saveNow = useCallback(
    async (buildBody: () => ContentHubUpdateBody) => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      pendingRef.current = null;
      return runSave(buildBody, true);
    },
    [runSave],
  );

  /** After reloading the server version, adopt its token and clear the conflict. */
  const resolveConflict = useCallback((freshUpdatedAt: string) => {
    tokenRef.current = freshUpdatedAt;
    setConflict(null);
    setIsDirty(false);
    setSaveState({ kind: 'idle' });
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return {
    saveState,
    isDirty,
    conflict,
    autosaveAllowed,
    markDirty,
    saveNow,
    resolveConflict,
    /** Exposed so the conflict dialog can show what the editor is holding. */
    currentToken: tokenRef.current,
  };
}

/**
 * Warn before losing unsaved work.
 *
 * Only `beforeunload` is wired here — in-app navigation is guarded by the editor rendering a
 * confirmation when a link is followed while dirty. React Router v7's blocker API is not used
 * because this app mounts `BrowserRouter` directly (`.cursorrules`), and a data-router blocker
 * would not apply.
 */
export function useUnsavedChangesWarning(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);
}
