/**
 * Differential regression: approving from INSIDE the editor vs from the review queue.
 *
 * WHAT HAPPENED. `useEditorState` latched the optimistic-concurrency token on first load and
 * never refreshed it (`if (tokenRef.current === null)`). Every workflow action the editor page
 * offers — approval, transition, schedule, link replace — bumps `content_items.updated_at`
 * server-side. The detail query refetched with the new value, but the editor carried on sending
 * the PRE-change token, so the next save failed the concurrency check against a change the editor
 * had itself just made.
 *
 * The review queue holds no token, which is precisely why the same approval succeeded there. That
 * asymmetry is what these tests pin.
 *
 * Assertions are on the `expectedUpdatedAt` each save actually SENDS, not on `currentToken`:
 * the token lives in a ref, so reading it back only reflects the last render, whereas the request
 * body is the contract the server checks.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useEditorState } from '../editor/useEditorState';
import type { ContentHubDetail, ContentHubUpdateBody } from '@/lib/api';

const LOADED_AT = '2026-08-10T10:00:00.000Z';
/** What the server returns after an approval bumps the row. */
const AFTER_APPROVAL = '2026-08-10T10:05:00.000Z';

function detail(updatedAt: string, status = 'in_review'): ContentHubDetail {
  return {
    id: '7d95e2a0-a480-48a2-99ac-3aad2b0946ef',
    status,
    updatedAt,
  } as ContentHubDetail;
}

/** Captures the `expectedUpdatedAt` each save actually sends. */
function makeSave() {
  const sent: Array<string | undefined> = [];
  const save = vi.fn(async (input: ContentHubUpdateBody) => {
    sent.push(input.expectedUpdatedAt);
    return detail(new Date(Date.parse(input.expectedUpdatedAt!) + 1000).toISOString());
  });
  return { save, sent };
}

const body = (): ContentHubUpdateBody =>
  ({ title: 'unchanged', expectedUpdatedAt: '', createRevision: false }) as ContentHubUpdateBody;

describe('the editor adopts a token the server moved', () => {
  it('sends the REFRESHED token after an approval, not the one it loaded with', async () => {
    const { save, sent } = makeSave();
    const { result, rerender } = renderHook(
      ({ content }) => useEditorState({ content, save }),
      { initialProps: { content: detail(LOADED_AT) } },
    );

    // The approval succeeds server-side and the detail query refetches with a newer timestamp.
    rerender({ content: detail(AFTER_APPROVAL) });

    await act(async () => {
      await result.current.saveNow(body);
    });

    // Before the fix this was LOADED_AT — a stale token, and the save failed.
    expect(sent).toEqual([AFTER_APPROVAL]);
  });

  it('uses the loaded token when the server has not moved', async () => {
    const { save, sent } = makeSave();
    const { result } = renderHook(() => useEditorState({ content: detail(LOADED_AT), save }));

    await act(async () => {
      await result.current.saveNow(body);
    });

    expect(sent).toEqual([LOADED_AT]);
  });

  it('keeps advancing the token across its own saves', async () => {
    const { save, sent } = makeSave();
    const { result } = renderHook(() => useEditorState({ content: detail(LOADED_AT), save }));

    await act(async () => {
      await result.current.saveNow(body);
    });
    await act(async () => {
      await result.current.saveNow(body);
    });

    expect(sent[0]).toBe(LOADED_AT);
    // The second save uses the timestamp the first one returned, not the loaded one.
    expect(sent[1]).toBe('2026-08-10T10:00:01.000Z');
  });

  it('adopts a moved token repeatedly, not just once', async () => {
    const { save, sent } = makeSave();
    const { result, rerender } = renderHook(
      ({ content }) => useEditorState({ content, save }),
      { initialProps: { content: detail(LOADED_AT) } },
    );

    // Two workflow actions in a row — e.g. approve two gates before saving.
    rerender({ content: detail(AFTER_APPROVAL) });
    rerender({ content: detail('2026-08-10T10:09:00.000Z') });

    await act(async () => {
      await result.current.saveNow(body);
    });

    expect(sent).toEqual(['2026-08-10T10:09:00.000Z']);
  });
});

describe('optimistic concurrency is still enforced', () => {
  it('does NOT adopt a moved token while the editor holds unsaved work', async () => {
    // Dirty means a moved timestamp could be a colleague's save, not our own approval. Adopting
    // it would overwrite their work; keeping it stale makes the conflict dialog fire instead.
    // `published` disables autosave, so the dirty state is observed without a timer firing.
    const { save, sent } = makeSave();
    const { result, rerender } = renderHook(
      ({ content }) => useEditorState({ content, save }),
      { initialProps: { content: detail(LOADED_AT, 'published') } },
    );

    act(() => {
      result.current.markDirty(body);
    });
    expect(result.current.isDirty).toBe(true);

    rerender({ content: detail(AFTER_APPROVAL, 'published') });

    await act(async () => {
      await result.current.saveNow(body);
    });

    expect(sent).toEqual([LOADED_AT]);
  });

  it('still raises a conflict on a genuinely stale save', async () => {
    const save = vi.fn(async () => {
      throw Object.assign(new Error('This content was changed by someone else.'), {
        name: 'ApiError',
        status: 409,
        code: 'STALE_UPDATE',
        body: { code: 'STALE_UPDATE', details: {} },
      });
    });

    const { result } = renderHook(() => useEditorState({ content: detail(LOADED_AT), save }));

    await act(async () => {
      await result.current.saveNow(body);
    });

    // The conflict path is untouched by the token fix.
    expect(result.current.saveState.kind).toBe('error');
  });
});

describe('unsaved authored work survives a server-side change', () => {
  it('stays dirty when the row is bumped by a workflow action', async () => {
    const { save } = makeSave();
    const { result, rerender } = renderHook(
      ({ content }) => useEditorState({ content, save }),
      { initialProps: { content: detail(LOADED_AT, 'published') } },
    );

    act(() => {
      result.current.markDirty(body);
    });

    rerender({ content: detail(AFTER_APPROVAL, 'published') });

    // The approval must not silently discard the editor's pending changes.
    expect(result.current.isDirty).toBe(true);
  });

  it('does not fire an extra save of its own when the token refreshes', async () => {
    const { save } = makeSave();
    const { rerender } = renderHook(
      ({ content }) => useEditorState({ content, save }),
      { initialProps: { content: detail(LOADED_AT) } },
    );

    rerender({ content: detail(AFTER_APPROVAL) });
    await new Promise((resolve) => setTimeout(resolve, 60));

    // Adopting a token is bookkeeping, not a reason to write.
    expect(save).not.toHaveBeenCalled();
  });
});
