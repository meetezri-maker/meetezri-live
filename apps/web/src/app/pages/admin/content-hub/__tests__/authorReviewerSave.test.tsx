/**
 * Author / Reviewer edits, driven through the real fields.
 *
 * `saveSerialisation.test.ts` covers the hook in isolation. This file reproduces the reported
 * sequence at the level the user actually performs it: pick a person from the dropdown, click Save,
 * and watch for "Someone else changed this content" when nobody else touched the record.
 *
 * The harness mirrors `ContentHubEditor`'s wiring exactly — `useForm` + `form.reset` keyed on
 * `[id, updatedAt]`, `useEditorState`, `toUpdateBody`, and `onChange={touch}` on every field —
 * because the bug lived in how those pieces interact, not in any one of them.
 */

import { useCallback, useEffect, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, api: { admin: { getUsers: vi.fn() } } };
});

const { api, ApiError } = await import('@/lib/api');
const { OverviewTab } = await import('../tabs/OverviewTab');
const { useEditorState, AUTOSAVE_DEBOUNCE_MS } = await import('../editor/useEditorState');
const { toUpdateBody, isoToDateInput } = await import('../schema/contentHubEditor.schema');

type ContentHubDetail = import('@/lib/api').ContentHubDetail;
type ContentHubUpdateBody = import('@/lib/api').ContentHubUpdateBody;
type EditorFormValues = import('../schema/contentHubEditor.schema').EditorFormValues;

const mockApi = api as unknown as { admin: { getUsers: ReturnType<typeof vi.fn> } };

const ROSALIND = {
  id: '6874e034-a3e9-45a0-835f-cfe21fdda65d',
  full_name: 'Rosalind Mitchell',
  email: 'r@example.com',
  role: 'super_admin',
  avatar_url: null,
};
const SAIF = {
  id: 'c6b3e17c-f7a0-4f26-b0d9-875147fa8776',
  full_name: 'Saif Ali',
  email: 's@example.com',
  role: 'therapist',
  avatar_url: null,
};

const T0 = '2026-08-10T10:00:00.000Z';

function detail(overrides: Partial<ContentHubDetail> = {}): ContentHubDetail {
  return {
    id: 'c1',
    title: 'What should I do when I cannot sleep?',
    slug: 'what-should-i-do-when-i-cannot-sleep',
    status: 'in_review',
    contentType: 'aeo_answer',
    updatedAt: T0,
    tags: [],
    body: { version: 1, blocks: [] },
    typeFields: {},
    editorial: {},
    robotsDirective: 'index,follow',
    ...overrides,
  } as unknown as ContentHubDetail;
}

/**
 * A server that enforces optimistic concurrency the way the API does: the token must match the
 * current `updated_at`, and a successful write advances it. Every PATCH body is recorded so the
 * assertions can look at what was actually sent.
 */
function makeServer() {
  let record = detail();
  const patches: ContentHubUpdateBody[] = [];
  /**
   * Holds responses open so a second request can be started while the first is still in flight.
   *
   * Without this the test would await each save to completion and the two requests would never
   * overlap — which is the only condition under which the bug appears.
   */
  let gate: Promise<void> | null = null;
  let openGate: (() => void) | null = null;

  const save = vi.fn(async (input: ContentHubUpdateBody) => {
    patches.push(input);
    if (gate) await gate;
    if (input.expectedUpdatedAt !== record.updatedAt) {
      throw new ApiError('This content was changed by someone else.', 409, {
        code: 'STALE_UPDATE',
        details: { currentUpdatedAt: record.updatedAt },
      });
    }
    record = detail({
      ...record,
      authorId: undefined,
      author: input.authorId ? { id: input.authorId, fullName: 'x' } : null,
      reviewer: input.reviewerId ? { id: input.reviewerId, fullName: 'x' } : null,
      reviewedAt: input.reviewedAt ?? null,
      updatedAt: new Date(Date.parse(record.updatedAt) + 1000).toISOString(),
    } as Partial<ContentHubDetail>);
    return record;
  });

  return {
    save,
    patches,
    /** Stop responding, so the next requests pile up in flight. */
    hold() {
      gate = new Promise<void>((resolve) => {
        openGate = resolve;
      });
    },
    /** Answer everything that is waiting, in arrival order. */
    release() {
      openGate?.();
      gate = null;
      openGate = null;
    },
    get record() {
      return record;
    },
    /** Every token the client sent, in order. */
    get tokens() {
      return patches.map((patch) => patch.expectedUpdatedAt);
    },
    externalEdit() {
      record = detail({ ...record, updatedAt: new Date(Date.parse(record.updatedAt) + 5000).toISOString() } as Partial<ContentHubDetail>);
    },
  };
}

/**
 * The editor, reduced to the parts this bug runs through.
 *
 * `refetch` stands in for what the mutation's cache invalidation does in the real screen: the
 * detail query comes back with the row the save produced, which re-runs `form.reset`.
 */
function Harness({ server }: { server: ReturnType<typeof makeServer> }) {
  const [data, setData] = useState<ContentHubDetail>(server.record);

  const form = useForm<EditorFormValues>({ defaultValues: { robotsDirective: 'index,follow' } });

  const editorState = useEditorState({
    content: data,
    save: async (payload) => {
      const result = await server.save(payload);
      // The real screen invalidates the detail query here; the refetched row lands a tick later.
      queueMicrotask(() => setData(result));
      return result;
    },
  });

  useEffect(() => {
    form.reset({
      title: data.title,
      slug: data.slug,
      authorId: (data as { author?: { id: string } }).author?.id ?? '',
      reviewerId: (data as { reviewer?: { id: string } }).reviewer?.id ?? '',
      reviewedAt: isoToDateInput(data.reviewedAt),
      robotsDirective: 'index,follow',
      tagsInput: '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.id, data.updatedAt]);

  const buildBody = useCallback(
    (createRevision: boolean) => () =>
      toUpdateBody(form.getValues(), {
        body: { version: 1, blocks: [] },
        expectedUpdatedAt: editorState.currentToken ?? data.updatedAt,
        createRevision,
      }) as unknown as ContentHubUpdateBody,
    [form, editorState.currentToken, data.updatedAt],
  );

  const touch = useCallback(() => {
    editorState.markDirty(buildBody(false));
  }, [editorState, buildBody]);

  return (
    <div>
      <OverviewTab
        form={form}
        content={data}
        slugTouched
        onSlugTouched={() => undefined}
        onChange={touch}
      />
      <button type="button" onClick={() => void editorState.saveNow(buildBody(true))}>
        Save
      </button>
      <p data-testid="save-state">{editorState.saveState.kind}</p>
      <p data-testid="conflict">{editorState.conflict ? 'conflict' : 'none'}</p>
    </div>
  );
}

function renderEditor() {
  const server = makeServer();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <Harness server={server} />
    </QueryClientProvider>,
  );
  return { ...utils, server };
}

/** Lets pending promises and the people query settle without advancing the autosave debounce. */
const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
/** Lets the autosave debounce elapse and its request finish. */
const runAutosave = () => act(async () => { await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS + 100); });

const pick = (labelId: string, value: string) =>
  fireEvent.change(document.getElementById(labelId) as HTMLSelectElement, { target: { value } });

const clickSave = () => act(async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await vi.advanceTimersByTimeAsync(0);
});

/**
 * The reported sequence, timed exactly: the autosave has already LEFT — the timer is spent and the
 * request is in flight — when Save is clicked. Cancelling the timer cannot recall it, so before the
 * fix both requests carried the same `expectedUpdatedAt` and the second came back 409.
 */
async function autosaveInFlightThenSave(server: ReturnType<typeof makeServer>) {
  server.hold();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS + 10);
  });
  expect(server.save).toHaveBeenCalledTimes(1); // the autosave really is out on the wire
  await clickSave();
  await act(async () => {
    server.release();
    await vi.advanceTimersByTimeAsync(50);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mockApi.admin.getUsers.mockResolvedValue([ROSALIND, SAIF]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('picking an Author and saving raises no conflict', () => {
  it('does not report a conflict when nobody else changed the record', async () => {
    const { server } = renderEditor();
    await settle();

    pick('ov-author', ROSALIND.id);
    await autosaveInFlightThenSave(server);

    expect(screen.getByTestId('conflict')).toHaveTextContent('none');
    expect(screen.getByTestId('save-state')).toHaveTextContent('saved');
  });

  it('sends a distinct, current token on every request — never a spent one', async () => {
    const { server } = renderEditor();
    await settle();

    pick('ov-author', ROSALIND.id);
    await autosaveInFlightThenSave(server);

    expect(server.patches.length).toBe(2);
    expect(new Set(server.tokens).size).toBe(server.tokens.length);
    // Not one request was rejected: no PATCH carried a token the server had already consumed.
    expect(server.tokens[0]).toBe(T0);
  });

  it('persists the author the operator picked', async () => {
    const { server } = renderEditor();
    await settle();

    pick('ov-author', ROSALIND.id);
    await runAutosave();

    expect(server.patches.at(-1)?.authorId).toBe(ROSALIND.id);
  });

  it('autosaves an Author pick on its own, with no explicit save', async () => {
    const { server } = renderEditor();
    await settle();

    pick('ov-author', ROSALIND.id);
    await runAutosave();

    expect(server.save).toHaveBeenCalledTimes(1);
    expect(server.patches[0].createRevision).toBe(false);
    expect(screen.getByTestId('conflict')).toHaveTextContent('none');
  });
});

describe('Author and Reviewer together', () => {
  it('carries both ids and conflicts with neither', async () => {
    const { server } = renderEditor();
    await settle();

    pick('ov-author', ROSALIND.id);
    pick('ov-reviewer', SAIF.id);
    await autosaveInFlightThenSave(server);

    expect(screen.getByTestId('conflict')).toHaveTextContent('none');
    expect(server.patches.at(-1)).toMatchObject({ authorId: ROSALIND.id, reviewerId: SAIF.id });
  });

  it('survives a pick, a save, and a second pick on the refreshed token', async () => {
    const { server } = renderEditor();
    await settle();

    pick('ov-author', ROSALIND.id);
    await clickSave();
    await settle();

    // The refetched row has already reset the form by now; the second pick must still save.
    pick('ov-reviewer', SAIF.id);
    await clickSave();
    await settle();

    expect(screen.getByTestId('conflict')).toHaveTextContent('none');
    expect(server.patches.at(-1)).toMatchObject({ authorId: ROSALIND.id, reviewerId: SAIF.id });
  });
});

describe('Reviewed on travels with the person fields', () => {
  it('round-trips a date alongside an Author', async () => {
    const { server } = renderEditor();
    await settle();

    pick('ov-author', ROSALIND.id);
    fireEvent.change(screen.getByLabelText('Reviewed on'), { target: { value: '2026-08-10' } });
    await autosaveInFlightThenSave(server);

    expect(screen.getByTestId('conflict')).toHaveTextContent('none');
    expect(server.patches.at(-1)).toMatchObject({
      authorId: ROSALIND.id,
      reviewedAt: '2026-08-10T00:00:00.000Z',
    });
    // And it comes back to the date input as the same calendar day.
    expect(screen.getByLabelText('Reviewed on')).toHaveValue('2026-08-10');
  });

  it('round-trips a date alongside a Reviewer', async () => {
    const { server } = renderEditor();
    await settle();

    pick('ov-reviewer', SAIF.id);
    fireEvent.change(screen.getByLabelText('Reviewed on'), { target: { value: '2026-01-01' } });
    await autosaveInFlightThenSave(server);

    expect(screen.getByTestId('conflict')).toHaveTextContent('none');
    expect(server.patches.at(-1)).toMatchObject({
      reviewerId: SAIF.id,
      reviewedAt: '2026-01-01T00:00:00.000Z',
    });
  });
});

describe('the refetch that follows a save does not undo the edit', () => {
  it('leaves the picked Author selected after the form is reset from the server row', async () => {
    renderEditor();
    await settle();

    pick('ov-author', ROSALIND.id);
    await clickSave();
    await settle();

    expect(document.getElementById('ov-author')).toHaveValue(ROSALIND.id);
  });
});

describe('an explicit save cancels a pending autosave', () => {
  it('sends one request, not two, when Save is clicked inside the debounce', async () => {
    const { server } = renderEditor();
    await settle();

    pick('ov-author', ROSALIND.id);
    // Save clicked BEFORE the debounce elapses — the timer is cancellable here.
    await clickSave();
    await runAutosave();
    await settle();

    expect(server.save).toHaveBeenCalledTimes(1);
    expect(server.patches[0].createRevision).toBe(true);
  });
});

describe('a genuine external change still conflicts', () => {
  it('shows the conflict when somebody else really did save', async () => {
    const { server } = renderEditor();
    await settle();

    server.externalEdit();
    pick('ov-author', ROSALIND.id);
    await clickSave();
    await settle();

    expect(screen.getByTestId('conflict')).toHaveTextContent('conflict');
    expect(screen.getByTestId('save-state')).toHaveTextContent('error');
  });

  it('stops after the conflict instead of retrying with a fresh token', async () => {
    const { server } = renderEditor();
    await settle();

    server.externalEdit();
    pick('ov-author', ROSALIND.id);
    await clickSave();
    await settle();

    const calls = server.save.mock.calls.length;
    await runAutosave();

    expect(server.save).toHaveBeenCalledTimes(calls);
  });
});
