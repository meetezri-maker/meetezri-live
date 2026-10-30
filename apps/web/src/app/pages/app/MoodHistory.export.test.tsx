import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { parseCsv } from '@/test/parseCsv';

const h = vi.hoisted(() => ({
  getMyMoods: vi.fn(),
  getAll: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  auth: { current: { user: { id: 'user-a' }, profile: { id: 'user-a', subscription_plan: 'pro' } } as {
    user: { id: string } | null;
    profile: { id: string; subscription_plan: string } | null;
  } },
  createPdf: vi.fn(),
  pdfModuleLoaded: false,
}));

vi.mock('@/lib/api', () => ({
  api: { moods: { getMyMoods: h.getMyMoods }, journal: { getAll: h.getAll } },
}));
vi.mock('@/app/contexts/AuthContext', () => ({ useAuth: () => h.auth.current }));
vi.mock('sonner', () => ({ toast: h.toast }));
// The PDF module (jsPDF + fonts) is only loaded when a PDF is requested.
vi.mock('./mood-history/moodHistoryExportPdf', () => {
  h.pdfModuleLoaded = true;
  return {
    createMoodHistoryPdf: h.createPdf,
    moodHistoryPdfFileName: (p: { start: Date; end: Date }) => `mood-${p.start.getDate()}-to-${p.end.getDate()}.pdf`,
  };
});

import { MoodHistory } from './MoodHistory';
import { PdfUnsupportedTextError } from '@/lib/pdf/pdfText';

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
  h.createPdf.mockReset();
  h.createPdf.mockResolvedValue({ doc: { output: () => new Blob(['%PDF'], { type: 'application/pdf' }) } });
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
/** Opens the Export menu and picks an item, as a user would. */
async function chooseExport(item: 'Download CSV' | 'Download PDF') {
  const user = userEvent.setup();
  const button = await screen.findByRole('button', { name: /^Export$/ });
  await waitFor(() => expect(button).not.toBeDisabled());
  await user.click(button);
  await user.click(await screen.findByRole('menuitem', { name: item }));
}
const clickExport = () => chooseExport('Download CSV');

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
    await clickExport();

    await waitFor(() => expect(h.toast.error).toHaveBeenCalled());
    expect(downloads).toHaveLength(0);
  });

  it('downloads the CSV without loading the PDF engine or fonts', async () => {
    h.getMyMoods.mockResolvedValue([{ id: 'm1', created_at: iso(27), mood: 'calm', intensity: 6 }]);
    h.getAll.mockResolvedValue([]);
    renderPage();
    await clickExport();
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(h.pdfModuleLoaded).toBe(false);
  });
});

describe('Mood History PDF export (page)', () => {
  const load = () => {
    h.getMyMoods.mockResolvedValue([{ id: 'm1', created_at: iso(27), mood: 'calm', intensity: 0, notes: 'ok' }]);
    h.getAll.mockResolvedValue([]);
  };

  it('builds the PDF from the period snapshot taken at click time and downloads it', async () => {
    load();
    renderPage();
    await chooseExport('Download PDF');
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0].name).toBe('mood-26-to-1.pdf'); // Mon 26 Oct – Sun 1 Nov
    expect(downloads[0].blob.type).toBe('application/pdf');
    const report = h.createPdf.mock.calls[0][0];
    expect(report.rows.map((r: { id: string; intensity: number | null }) => [r.id, r.intensity])).toEqual([['m1', 0]]);
    expect(report.period.label).toBe('Week (Mon–Sun)');
  });

  it('runs one export at a time while the PDF is being prepared', async () => {
    load();
    let finish: (v: unknown) => void = () => {};
    h.createPdf.mockImplementation(() => new Promise((r) => { finish = r; }));
    renderPage();
    await chooseExport('Download PDF');
    const button = screen.getByRole('button', { name: /^Export$/ });
    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveAttribute('aria-busy', 'true');
    finish({ doc: { output: () => new Blob(['%PDF']) } });
    await waitFor(() => expect(button).not.toBeDisabled());
    expect(h.createPdf).toHaveBeenCalledTimes(1);
    expect(downloads).toHaveLength(1);
  });

  it('cancels the download if the account changes or signs out during generation', async () => {
    for (const next of [{ user: { id: 'user-b' }, profile: { id: 'user-b', subscription_plan: 'pro' } }, { user: null, profile: null }]) {
      load();
      h.auth.current = { user: { id: 'user-a' }, profile: { id: 'user-a', subscription_plan: 'pro' } };
      let finish: (v: unknown) => void = () => {};
      h.createPdf.mockImplementation(() => new Promise((r) => { finish = r; }));
      const { rerender, unmount } = renderPage();
      await chooseExport('Download PDF');
      await waitFor(() => expect(h.createPdf).toHaveBeenCalled());
      h.auth.current = next;
      rerender(<MemoryRouter><MoodHistory /></MemoryRouter>);
      finish({ doc: { output: () => new Blob(['%PDF']) } });
      await waitFor(() => expect(h.toast.info).toHaveBeenCalledWith(expect.stringMatching(/changed while the PDF was being prepared/)));
      expect(downloads).toHaveLength(0);
      unmount();
      h.toast.info.mockReset();
      h.createPdf.mockReset();
    }
  });

  it('downloads nothing if the page is left during generation', async () => {
    load();
    let finish: (v: unknown) => void = () => {};
    h.createPdf.mockImplementation(() => new Promise((r) => { finish = r; }));
    const { unmount } = renderPage();
    await chooseExport('Download PDF');
    await waitFor(() => expect(h.createPdf).toHaveBeenCalled());
    unmount();
    finish({ doc: { output: () => new Blob(['%PDF']) } });
    await new Promise((r) => setTimeout(r, 0));
    expect(downloads).toHaveLength(0);
    expect(h.toast.info).not.toHaveBeenCalled();
  });

  it('explains text the PDF cannot draw, and a failed primary source, without downloading', async () => {
    load();
    h.createPdf.mockRejectedValueOnce(new PdfUnsupportedTextError(['你'], 'no-glyph'));
    renderPage();
    await chooseExport('Download PDF');
    await waitFor(() =>
      expect(h.toast.error).toHaveBeenCalledWith(
        "Your mood history contains characters the PDF can't display (你), so it wasn't downloaded. You can download the CSV instead."
      )
    );
    expect(downloads).toHaveLength(0);
  });

  it('does not build a PDF when mood check-ins failed to load', async () => {
    h.getMyMoods.mockRejectedValue(new Error('500'));
    h.getAll.mockResolvedValue([{ id: 'j1', created_at: iso(27), mood_tags: ['happy'], content: '<p>x</p>' }]);
    renderPage();
    await chooseExport('Download PDF');
    await waitFor(() => expect(h.toast.error).toHaveBeenCalled());
    expect(h.createPdf).not.toHaveBeenCalled();
  });

  it('keeps the trial restriction: no history and no export', async () => {
    h.auth.current = { user: { id: 'user-a' }, profile: { id: 'user-a', subscription_plan: 'trial' } };
    renderPage();
    expect(await screen.findByText('Mood history is part of Grow')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Export$/ })).toBeNull();
  });
});
