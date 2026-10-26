import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { list, authState } = vi.hoisted(() => ({
  list: vi.fn(),
  authState: { current: null as null | { user: { id: string } | null; profile: null; isLoading: boolean } },
}));

vi.mock('@/lib/api', () => ({
  api: { safetyResourceInteractions: { list, record: vi.fn() } },
}));
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}));
vi.mock('@/app/contexts/AuthContext', () => ({
  useAuth: () => authState.current,
}));

import { ResourceAnalyticsPage } from './ResourceAnalytics';
import { RESOURCE_INTERACTION_SETTLED_EVENT } from '@/app/utils/resourceTracking';

const NOW = new Date('2026-10-21T10:00:00.000Z');
const signIn = (id: string | null) => {
  authState.current = { user: id ? { id } : null, profile: null, isLoading: false };
};

const serverRow = (id: string, created_at: string, resource_id = '988', interaction_type = 'call') => ({
  id,
  resource_id,
  resource_name: `Resource ${resource_id}`,
  resource_type: 'crisis_line',
  interaction_type,
  context_session_id: null,
  safety_state: 'normal',
  created_at,
});

const localRow = (
  id: string,
  userId: string,
  timestamp: string,
  syncStatus: 'pending' | 'synced' | 'failed',
  resourceId = '988'
) => ({
  id,
  resourceId,
  resourceName: `Resource ${resourceId}`,
  resourceType: 'crisis_line',
  interactionType: 'call',
  timestamp,
  safetyState: 'normal',
  userId,
  syncStatus,
});

const seedLocal = (userKey: string, rows: unknown[]) =>
  localStorage.setItem(`ezri_resource_interactions:${userKey}`, JSON.stringify(rows));

function renderPage(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  const ui = () => (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ResourceAnalyticsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
  const utils = render(ui());
  return { ...utils, rerenderPage: () => utils.rerender(ui()) };
}

const displayedTotal = () =>
  screen.getByText('Total Interactions').previousElementSibling?.textContent;

let exported: Blob[] = [];
async function exportJson(): Promise<Record<string, any>> {
  exported = [];
  fireEvent.click(screen.getByRole('button', { name: /Export insights/i }));
  expect(exported).toHaveLength(1);
  const text = await new Promise<string>((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.readAsText(exported[0]);
  });
  return JSON.parse(text);
}

// jsdom has no ResizeObserver; the page's charts need one to mount.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW });
  localStorage.clear();
  list.mockReset();
  URL.createObjectURL = vi.fn((b: Blob) => {
    exported.push(b);
    return 'blob:test';
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Resource Analytics user isolation and counting', () => {
  it('uses server rows only, and ignores this account’s local copies, other accounts, legacy and anonymous data', async () => {
    signIn('user-a');
    list.mockResolvedValue([serverRow('srv-1', '2026-10-20T10:00:00.000Z')]);
    seedLocal('user-a', [localRow('interaction_a1', 'user-a', '2026-10-20T09:59:59.850Z', 'synced')]);
    seedLocal('user-b', [localRow('interaction_b1', 'user-b', '2026-10-19T10:00:00.000Z', 'failed', 'b-only')]);
    seedLocal('anonymous', [localRow('interaction_n1', 'anonymous', '2026-10-19T10:00:00.000Z', 'failed', 'anon-only')]);
    localStorage.setItem(
      'ezri_resource_interactions',
      JSON.stringify([localRow('interaction_l1', 'anonymous', '2026-10-19T10:00:00.000Z', 'failed', 'legacy-only')])
    );

    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /Export insights/i })).not.toBeDisabled());

    const json = await exportJson();
    expect(json.totalInteractions).toBe(1);
    expect(Object.keys(json.analytics)).toEqual(['988']);
    expect(json.analytics['988'].totalCalls).toBe(1);
    expect(displayedTotal()).toBe(String(json.totalInteractions));
  });

  it('keeps two genuine repeated clicks as two events', async () => {
    signIn('user-a');
    list.mockResolvedValue([
      serverRow('srv-1', '2026-10-20T10:00:00.000Z'),
      serverRow('srv-2', '2026-10-20T10:00:01.000Z'),
    ]);
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /Export insights/i })).not.toBeDisabled());
    const json = await exportJson();
    expect(json.analytics['988'].totalCalls).toBe(2);
    expect(displayedTotal()).toBe('2');
  });

  it('does not revive local history when the server succeeds with an empty list', async () => {
    signIn('user-a');
    list.mockResolvedValue([]);
    seedLocal('user-a', [
      localRow('interaction_a1', 'user-a', '2026-10-20T10:00:00.000Z', 'synced'),
      localRow('interaction_a2', 'user-a', '2026-10-20T11:00:00.000Z', 'pending'),
    ]);
    renderPage();
    await waitFor(() => expect(list).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('button', { name: /Export insights/i })).toBeDisabled());
    expect(screen.queryByText(/saved in this browser/i)).toBeNull();
  });

  it('counts a write whose response was lost once (server copy only)', async () => {
    signIn('user-a');
    // The server saved the click, but the browser never saw the response and marked it failed.
    list.mockResolvedValue([serverRow('srv-1', '2026-10-20T10:00:00.000Z')]);
    seedLocal('user-a', [localRow('interaction_a1', 'user-a', '2026-10-20T09:59:59.900Z', 'failed')]);
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /Export insights/i })).not.toBeDisabled());
    const json = await exportJson();
    expect(json.totalInteractions).toBe(1);
    expect(displayedTotal()).toBe('1');
    expect(screen.queryByText(/saved in this browser/i)).toBeNull();
  });

  it('shows only server-confirmed activity when an orphaned pending write never reached the server', async () => {
    signIn('user-a');
    // The tab closed before this write settled; the server has no matching row.
    list.mockResolvedValue([serverRow('srv-1', '2026-10-20T10:00:00.000Z')]);
    seedLocal('user-a', [localRow('interaction_a2', 'user-a', '2026-10-21T08:00:00.000Z', 'pending', 'orphan-res')]);
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /Export insights/i })).not.toBeDisabled());
    const json = await exportJson();
    expect(Object.keys(json.analytics)).toEqual(['988']);
    expect(displayedTotal()).toBe('1');
  });

  it('falls back to only this account’s local rows, within the selected period, when the server fails', async () => {
    signIn('user-a');
    list.mockRejectedValue(new Error('offline'));
    seedLocal('user-a', [
      localRow('interaction_a1', 'user-a', '2026-10-20T10:00:00.000Z', 'synced'),
      localRow('interaction_old', 'user-a', '2026-08-01T10:00:00.000Z', 'synced', 'too-old'),
    ]);
    seedLocal('user-b', [localRow('interaction_b1', 'user-b', '2026-10-20T10:00:00.000Z', 'failed', 'b-only')]);
    renderPage();
    await screen.findByText(/Could not reach the server.*this browser only.*may be incomplete/i);
    const json = await exportJson();
    expect(Object.keys(json.analytics)).toEqual(['988']);
    expect(json.totalInteractions).toBe(1);
    expect(displayedTotal()).toBe('1');
  });

  it('clears the previous account on switch and ignores its late response', async () => {
    let resolveA: (rows: unknown[]) => void = () => {};
    list.mockImplementationOnce(() => new Promise((r) => { resolveA = r; }));
    signIn('user-a');
    seedLocal('user-a', [localRow('interaction_a1', 'user-a', '2026-10-20T10:00:00.000Z', 'failed', 'a-only')]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerenderPage } = renderPage(client);

    // B signs in on this device while A's request is still in flight.
    list.mockResolvedValueOnce([serverRow('srv-b', '2026-10-20T12:00:00.000Z', 'b-res')]);
    signIn('user-b');
    rerenderPage();
    await act(async () => {
      resolveA([serverRow('srv-a', '2026-10-20T10:00:00.000Z', 'a-res')]);
    });

    await waitFor(() => expect(screen.getByRole('button', { name: /Export insights/i })).not.toBeDisabled());
    const json = await exportJson();
    expect(Object.keys(json.analytics)).toEqual(['b-res']);
    expect(displayedTotal()).toBe('1');

    // Sign-out leaves nothing to display or export.
    signIn(null);
    rerenderPage();
    expect(screen.queryByRole('button', { name: /Export insights/i })).toBeNull();
  });

  it('re-reads after a pending write for this account settles, and ignores other accounts’ completions', async () => {
    signIn('user-a');
    list.mockResolvedValue([serverRow('srv-1', '2026-10-20T10:00:00.000Z')]);
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /Export insights/i })).not.toBeDisabled());
    const callsBefore = list.mock.calls.length;

    act(() => {
      window.dispatchEvent(new CustomEvent(RESOURCE_INTERACTION_SETTLED_EVENT, { detail: { userId: 'user-b' } }));
    });
    expect(list.mock.calls.length).toBe(callsBefore);

    list.mockResolvedValue([
      serverRow('srv-1', '2026-10-20T10:00:00.000Z'),
      serverRow('srv-2', '2026-10-21T09:00:00.000Z'),
    ]);
    act(() => {
      window.dispatchEvent(new CustomEvent(RESOURCE_INTERACTION_SETTLED_EVENT, { detail: { userId: 'user-a' } }));
    });
    await waitFor(() => expect(displayedTotal()).toBe('2'));
  });
});
