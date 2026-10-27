import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { parseCsv } from '@/test/parseCsv';

const h = vi.hoisted(() => ({
  getMyMoods: vi.fn(),
  getAll: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  auth: { current: { user: { id: 'user-a' }, profile: { id: 'user-a', subscription_plan: 'pro' } } },
}));

vi.mock('@/lib/api', () => ({
  api: { moods: { getMyMoods: h.getMyMoods }, journal: { getAll: h.getAll } },
}));
vi.mock('@/app/contexts/AuthContext', () => ({ useAuth: () => h.auth.current }));
vi.mock('sonner', () => ({ toast: h.toast }));

import { MoodHistory } from './MoodHistory';

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const NOW = new Date(2026, 9, 28, 15, 0); // Wed; week = Mon 26 Oct – Sun 1 Nov
const iso = (d: number, hr = 12) => new Date(2026, 9, d, hr).toISOString();

let downloads: Array<{ name: string; blob: Blob }> = [];
let lastBlob: Blob | null = null;
const readBlob = (b: Blob) =>
  new Promise<string>((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.readAsText(b);
  });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW });
  h.getMyMoods.mockReset();
  h.getAll.mockReset();
  Object.values(h.toast).forEach((fn) => fn.mockReset());
  h.auth.current = { user: { id: 'user-a' }, profile: { id: 'user-a', subscription_plan: 'pro' } };
  downloads = [];
  URL.createObjectURL = vi.fn((b: Blob) => { lastBlob = b; return 'blob:test'; }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    if (lastBlob) downloads.push({ name: this.download, blob: lastBlob });
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const renderPage = () => render(<MemoryRouter><MoodHistory /></MemoryRouter>);
async function clickExport() {
  const button = await screen.findByRole('button', { name: /^Export$/ });
  await waitFor(() => expect(button).not.toBeDisabled());
  fireEvent.click(button);
}

describe('Mood History CSV export (page)', () => {
  it('downloads the week with plain-text journal notes and a check-in intensity of 0', async () => {
    h.getMyMoods.mockResolvedValue([
      { id: 'm1', created_at: iso(27, 9), mood: 'calm', intensity: 0, activities: ['walk'], notes: 'ok' },
      { id: 'm0', created_at: iso(20), mood: 'sad', intensity: 2, activities: [], notes: 'last week' },
    ]);
    h.getAll.mockResolvedValue([
      { id: 'j1', created_at: iso(28, 8), mood_tags: ['happy'], content: '<p>Good day.</p><ul><li>Walked</li></ul>' },
    ]);
    renderPage();
    await clickExport();

    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0].name).toBe('solace-mood-history-2026-10-26-to-2026-11-01.csv');
    const rows = parseCsv(await readBlob(downloads[0].blob));
    const headerAt = rows.findIndex((r) => r[0] === 'Date');
    const data = rows.slice(headerAt + 1);
    expect(data.map((r) => [r[2], r[5], r[7]])).toEqual([
      ['Mood check-in', '0', 'ok'],
      ['Journal entry', '', 'Good day.\n\n- Walked'],
    ]);
    expect(h.toast.warning).not.toHaveBeenCalled();
  });

  it('exports a partial file and says so when journals fail', async () => {
    h.getMyMoods.mockResolvedValue([{ id: 'm1', created_at: iso(27), mood: 'calm', intensity: 6 }]);
    h.getAll.mockRejectedValue(new Error('500'));
    renderPage();
    await clickExport();

    await waitFor(() => expect(downloads).toHaveLength(1));
    const text = await readBlob(downloads[0].blob);
    expect(text).toContain('Partial: journal entries could not be loaded');
    expect(h.toast.warning).toHaveBeenCalled();
  });

  it('does not download when mood check-ins fail, even with journal entries', async () => {
    h.getMyMoods.mockRejectedValue(new Error('500'));
    h.getAll.mockResolvedValue([{ id: 'j1', created_at: iso(27), mood_tags: ['happy'], content: '<p>x</p>' }]);
    renderPage();
    await clickExport();

    await waitFor(() => expect(h.toast.error).toHaveBeenCalled());
    expect(downloads).toHaveLength(0);
  });

  it('explains an empty week instead of silently doing nothing', async () => {
    h.getMyMoods.mockResolvedValue([{ id: 'm0', created_at: iso(10), mood: 'calm', intensity: 5 }]);
    h.getAll.mockResolvedValue([]);
    renderPage();
    await clickExport();

    await waitFor(() => expect(h.toast.info).toHaveBeenCalledWith('There are no mood entries in this period to export.'));
    expect(downloads).toHaveLength(0);
  });

  it("refuses to export data loaded for a different account", async () => {
    h.getMyMoods.mockResolvedValue([{ id: 'm1', created_at: iso(27), mood: 'calm', intensity: 6 }]);
    h.getAll.mockResolvedValue([]);
    const { rerender } = renderPage();
    await screen.findByRole('button', { name: /^Export$/ });
    await waitFor(() => expect(screen.getByRole('button', { name: /^Export$/ })).not.toBeDisabled());
    h.auth.current = { user: { id: 'user-b' }, profile: { id: 'user-b', subscription_plan: 'pro' } };
    rerender(<MemoryRouter><MoodHistory /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /^Export$/ }));

    await waitFor(() => expect(h.toast.error).toHaveBeenCalled());
    expect(downloads).toHaveLength(0);
  });
});
