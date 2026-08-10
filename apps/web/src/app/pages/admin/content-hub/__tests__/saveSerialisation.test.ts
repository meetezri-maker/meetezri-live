/**
 * Regression: false "Someone else changed this content" when editing Author or Reviewer.
 *
 * WHAT HAPPENED. `saveNow` cancels the autosave TIMER, but it cannot cancel an autosave that has
 * already fired and is in flight. Both requests then read the same `tokenRef` and send the same
 * `expectedUpdatedAt`. The first consumes it, the server advances `updated_at`, and the second
 * comes back 409 STALE_UPDATE — a conflict with nobody.
 *
 * It surfaced on Author and Reviewer because those are dropdowns: a pick followed by a click on
 * Save lands inside the two-second debounce far more often than typing does, where every keystroke
 * pushes the timer out again. Nothing about those fields took a different code path.
 *
 * Saves are now serialised, so the second reads the token the first returned. These assert that,
 * and that a GENUINE external edit still conflicts.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorState } from '../editor/useEditorState';
import { ApiError, type ContentHubDetail, type ContentHubUpdateBody } from '@/lib/api';

const T0 = '2026-08-10T10:00:00.000Z';

const detail = (updatedAt: string, status = 'in_review'): ContentHubDetail =>
  ({ id: 'c1', status, updatedAt }) as ContentHubDetail;

const body = (): ContentHubUpdateBody =>
  ({ authorId: 'a-uuid', expectedUpdatedAt: '', createRevision: false }) as ContentHubUpdateBody;

/**
 * A server that enforces optimistic concurrency exactly as the API does: the token must match the
 * current `updated_at`, and a successful write advances it.
 */
function makeServer(start = T0) {
  let current = start;
  const seen: string[] = [];

  const save = vi.fn(async (input: ContentHubUpdateBody) => {
    seen.push(input.expectedUpdatedAt!);
    if (input.expectedUpdatedAt !== current) {
      // A real ApiError instance: `isApiError` is an instanceof check, so a look-alike object is
      // ignored and the conflict branch would never run.
      throw new ApiError('This content was changed by someone else.', 409, {
        code: 'STALE_UPDATE',
        details: { currentUpdatedAt: current },
      });
    }
    current = new Date(Date.parse(current) + 1000).toISOString();
    return detail(current);
  });

  return {
    save,
    seen,
    get current() {
      return current;
    },
    /** Simulates somebody else saving. */
    externalEdit() {
      current = new Date(Date.parse(current) + 5000).toISOString();
    },
  };
}

beforeEach(() => vi.clearAllMocks());

describe('an autosave and a manual save never collide', () => {
  it('lets a manual Save succeed while an autosave is already in flight', async () => {
    const server = makeServer();
    const { result } = renderHook(() => useEditorState({ content: detail(T0), save: server.save }));

    // Both started before either resolves — the exact Author-then-Save timing.
    await act(async () => {
      const first = result.current.saveNow(body);
      const second = result.current.saveNow(body);
      await Promise.all([first, second]);
    });

    expect(server.save).toHaveBeenCalledTimes(2);
    // The second used the token the first returned, not the spent one.
    expect(server.seen[0]).toBe(T0);
    expect(server.seen[1]).not.toBe(T0);
    expect(result.current.saveState.kind).toBe('saved');
    expect(result.current.conflict).toBeNull();
  });

  it('raises no conflict across three overlapping saves', async () => {
    const server = makeServer();
    const { result } = renderHook(() => useEditorState({ content: detail(T0), save: server.save }));

    await act(async () => {
      await Promise.all([
        result.current.saveNow(body),
        result.current.saveNow(body),
        result.current.saveNow(body),
      ]);
    });

    expect(result.current.conflict).toBeNull();
    expect(new Set(server.seen).size).toBe(3);
  });

  it('advances the token from the mutation response, not from a refetch', async () => {
    const server = makeServer();
    // `content` never changes here — only the save response can move the token.
    const { result } = renderHook(() => useEditorState({ content: detail(T0), save: server.save }));

    await act(async () => {
      await result.current.saveNow(body);
    });
    await act(async () => {
      await result.current.saveNow(body);
    });

    expect(server.seen[1]).toBe('2026-08-10T10:00:01.000Z');
    expect(result.current.conflict).toBeNull();
  });

  it('lets an autosave and a manual save both land', async () => {
    vi.useFakeTimers();
    try {
      const server = makeServer();
      const { result } = renderHook(() => useEditorState({ content: detail(T0), save: server.save }));

      act(() => {
        result.current.markDirty(body);
      });
      // The debounce elapses — the autosave is now in flight.
      await act(async () => {
        vi.advanceTimersByTime(2100);
      });

      await act(async () => {
        await result.current.saveNow(body);
      });

      expect(result.current.conflict).toBeNull();
      expect(result.current.saveState.kind).toBe('saved');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('a stale query payload cannot roll the token backwards', () => {
  it('ignores an older updatedAt arriving after a save', async () => {
    const server = makeServer();
    const { result, rerender } = renderHook(
      ({ content }) => useEditorState({ content, save: server.save }),
      { initialProps: { content: detail(T0) } },
    );

    await act(async () => {
      await result.current.saveNow(body);
    });

    // The detail query re-renders with the PRE-save payload before the refetch lands.
    rerender({ content: detail(T0) });

    await act(async () => {
      await result.current.saveNow(body);
    });

    expect(result.current.conflict).toBeNull();
    expect(server.seen[1]).not.toBe(T0);
  });
});

describe('real conflict protection is intact', () => {
  it('still conflicts when somebody else actually changed the record', async () => {
    const server = makeServer();
    const { result } = renderHook(() => useEditorState({ content: detail(T0), save: server.save }));

    server.externalEdit();

    await act(async () => {
      await result.current.saveNow(body);
    });

    expect(result.current.saveState).toEqual({
      kind: 'error',
      message: 'Someone else changed this content.',
    });
    expect(result.current.conflict?.currentUpdatedAt).toBe(server.current);
  });

  it('stops autosave once a conflict is raised', async () => {
    const server = makeServer();
    const { result } = renderHook(() => useEditorState({ content: detail(T0), save: server.save }));
    server.externalEdit();

    await act(async () => {
      await result.current.saveNow(body);
    });
    expect(result.current.conflict).not.toBeNull();

    const callsAtConflict = server.save.mock.calls.length;
    act(() => {
      result.current.markDirty(body);
    });
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(server.save).toHaveBeenCalledTimes(callsAtConflict);
  });

  it('resolves a real conflict by adopting the reloaded server version', async () => {
    const server = makeServer();
    const { result } = renderHook(() => useEditorState({ content: detail(T0), save: server.save }));
    server.externalEdit();

    await act(async () => {
      await result.current.saveNow(body);
    });

    act(() => {
      result.current.resolveConflict(server.current);
    });

    expect(result.current.conflict).toBeNull();

    await act(async () => {
      await result.current.saveNow(body);
    });

    await waitFor(() => expect(result.current.saveState.kind).toBe('saved'));
  });

  it('never retries automatically with a fresh token', async () => {
    // Auto-retrying would defeat the whole point: it would overwrite the other person's edit.
    const server = makeServer();
    const { result } = renderHook(() => useEditorState({ content: detail(T0), save: server.save }));
    server.externalEdit();

    await act(async () => {
      await result.current.saveNow(body);
    });

    expect(server.save).toHaveBeenCalledTimes(1);
  });
});
