import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { parseCsv } from '@/test/parseCsv';

const h = vi.hoisted(() => {
  const impl: Record<string, (...args: unknown[]) => unknown> = {};
  // Unknown API calls resolve to [] so unrelated widgets on the page can mount.
  const mk = (path: string[]): unknown =>
    new Proxy(function () {}, {
      get(_t, k) {
        if (k === 'then' || typeof k === 'symbol') return undefined;
        const key = [...path, String(k)].join('.');
        return impl[key] ?? mk([...path, String(k)]);
      },
      apply: () => Promise.resolve([]),
    });
  return {
    impl,
    api: mk([]),
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
    auth: { current: { user: { id: 'user-a' }, profile: { id: 'user-a', subscription_plan: 'pro', streak_days: 3 } } },
  };
});

vi.mock('@/lib/api', () => ({ api: h.api }));
vi.mock('@/app/contexts/AuthContext', () => ({ useAuth: () => h.auth.current }));
vi.mock('sonner', () => ({ toast: h.toast }));
vi.mock('@/app/solace', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  // Native stand-in for the Radix select so tests can change the range.
  SolaceSelect: ({ value, onValueChange, options, ariaLabel }: {
    value: string; onValueChange: (v: string) => void; options: Array<{ value: string; label: string }>; ariaLabel?: string;
  }) => (
    <select aria-label={ariaLabel} value={value} onChange={(e) => onValueChange(e.target.value)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
}));

import { Progress } from './Progress';

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const NOW = new Date(2026, 9, 28, 15, 0);
const iso = (m: number, d: number, hr = 12) => new Date(2026, m, d, hr).toISOString();
const talk = (m: number, d: number) => ({ started_at: iso(m, d), ended_at: iso(m, d, 13) });

let downloads: Array<{ name: string; blob: Blob }> = [];
let lastBlob: Blob | null = null;
const readBlob = (b: Blob) =>
  new Promise<string>((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.readAsText(b);
  });

function seed() {
  h.impl['wellness.getProgress'] = async () => [{ toolId: 'box', toolTitle: 'Box Breathing', sessionsCompleted: 2, totalSeconds: 120 }];
  h.impl['wellness.getStats'] = async () => ({
    weeklyProgress: [{ name: 'Week 1', sessions: 0, mood: 0, wellness: 0 }],
    wellnessScore: [{ subject: 'Emotional', A: 50, fullMark: 100 }],
    monthlyActivity: [{ month: 'Oct', value: 1 }],
  });
  h.impl['moods.getMyMoods'] = async () => [{ created_at: iso(9, 2), mood: 'calm', intensity: 5 }];
  h.impl['journal.getAll'] = async () => [{ created_at: iso(9, 3) }];
  h.impl['sleep.getEntries'] = async () => [];
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW });
  for (const k of Object.keys(h.impl)) delete h.impl[k];
  Object.values(h.toast).forEach((fn) => fn.mockReset());
  h.auth.current = { user: { id: 'user-a' }, profile: { id: 'user-a', subscription_plan: 'pro', streak_days: 3 } };
  downloads = [];
  URL.createObjectURL = vi.fn((b: Blob) => { lastBlob = b; return 'blob:test'; }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    if (lastBlob) downloads.push({ name: this.download, blob: lastBlob });
  });
  seed();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const renderPage = () => render(<MemoryRouter><Progress /></MemoryRouter>);
const exportButton = () => screen.findByRole('button', { name: /Export progress report as CSV/i }, { timeout: 10000 });
async function exportedRows() {
  await waitFor(() => expect(downloads).toHaveLength(1));
  const rows = parseCsv(await readBlob(downloads[0].blob));
  return { rows, find: (s: string, m: string) => rows.find((r) => r[0] === s && r[1] === m) };
}

describe('Progress CSV export (page)', () => {
  it('fetches the complete talk list when the page list hit the API cap', async () => {
    const capped = Array.from({ length: 200 }, (_, i) => talk(9, 1 + (i % 27)));
    const full = [...capped, ...Array.from({ length: 50 }, (_, i) => talk(9, 1 + (i % 27)))];
    const list = vi.fn(async (params?: { limit?: number }) => (params?.limit ? capped : full));
    h.impl['sessions.list'] = list;

    renderPage();
    fireEvent.click(await exportButton());
    const { find, rows } = await exportedRows();

    expect(list).toHaveBeenLastCalledWith();
    expect(find('Summary', 'Talks completed')?.slice(2, 4)).toEqual(['250', 'talks']);
    expect(find('Summary', 'Talks completed')?.[5]).toBe('Complete');
    expect(rows.find((r) => r[0] === 'Completeness')?.[1]).toBe('Complete');
    expect(downloads[0].name).toBe('solace-progress-this-month-2026-10-28.csv');
  });

  it('labels talks as a lower bound when the complete list cannot be loaded', async () => {
    const capped = Array.from({ length: 200 }, (_, i) => talk(9, 1 + (i % 27)));
    h.impl['sessions.list'] = vi.fn(async (params?: { limit?: number }) => {
      if (params?.limit) return capped;
      throw new Error('network');
    });

    renderPage();
    fireEvent.click(await exportButton());
    const { find, rows } = await exportedRows();
    expect(find('Summary', 'Talks completed')?.[5]).toMatch(/^Lower bound/);
    expect(rows.find((r) => r[0] === 'Completeness')?.[1]).toMatch(/^Partial/);
  });

  it('exports a failed journal source as Unavailable, not 0', async () => {
    h.impl['sessions.list'] = async () => [talk(9, 5)];
    h.impl['journal.getAll'] = async () => { throw new Error('403'); };

    renderPage();
    fireEvent.click(await exportButton());
    const { find } = await exportedRows();
    expect(find('Summary', 'Journal entries')?.[2]).toBe('');
    expect(find('Summary', 'Journal entries')?.[5]).toBe('Unavailable: could not be loaded');
    expect(find('Summary', 'Mood check-ins')?.[2]).toBe('1');
  });

  it('cancels when the range changes while the complete talk list is loading', async () => {
    const capped = Array.from({ length: 200 }, (_, i) => talk(9, 1 + (i % 27)));
    let release: (rows: unknown[]) => void = () => {};
    h.impl['sessions.list'] = (params?: { limit?: number }) =>
      params?.limit ? Promise.resolve(capped) : new Promise((r) => { release = r; });

    renderPage();
    const button = await exportButton();
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'last_month' } });
    await act(async () => release(capped));

    await waitFor(() => expect(h.toast.info).toHaveBeenCalled());
    expect(downloads).toHaveLength(0);
    expect(button).not.toBeDisabled();
  });

  it("refuses to export another account's loaded data", async () => {
    h.impl['sessions.list'] = async () => [talk(9, 5)];
    const { rerender } = renderPage();
    await exportButton();
    h.auth.current = { user: { id: 'user-b' }, profile: { id: 'user-b', subscription_plan: 'pro', streak_days: 0 } };
    rerender(<MemoryRouter><Progress /></MemoryRouter>);

    fireEvent.click(await exportButton());
    await waitFor(() => expect(h.toast.error).toHaveBeenCalled());
    expect(downloads).toHaveLength(0);
  });
});
