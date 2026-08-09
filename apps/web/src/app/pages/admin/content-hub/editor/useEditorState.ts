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

  useEffect(() => {
    if (content && tokenRef.current === null) tokenRef.current = content.updatedAt;
  }, [content]);

  /** Published items never autosave — the backend refuses it, and so does the editor. */
  const autosaveAllowed = !!content && content.status !== 'published';

  const runSave = useCallback(
    async (buildBody: () => ContentHubUpdateBody, createRevision: boolean) => {
      const token = tokenRef.current;
      if (!token) return null;

      setSaveState({ kind: 'saving' });
      try {
        const result = await save({ ...buildBody(), expectedUpdatedAt: token, createRevision });
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
