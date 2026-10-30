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
    auth: { current: { user: { id: 'user-a' }, profile: { id: 'user-a', subscription_plan: 'pro', streak_days: 3 } } as {
      user: { id: string } | null;
      profile: { id: string; subscription_plan: string; streak_days: number } | null;
    } },
    createPdf: vi.fn(),
    pdfModuleLoaded: false,
  };
});

vi.mock('@/lib/api', () => ({ api: h.api }));
vi.mock('@/app/contexts/AuthContext', () => ({ useAuth: () => h.auth.current }));
vi.mock('sonner', () => ({ toast: h.toast }));
// The PDF module (jsPDF + fonts) is only loaded when a PDF is requested.
vi.mock('./progress/progressExportPdf', () => {
  h.pdfModuleLoaded = true;
  return {
    createProgressPdf: h.createPdf,
    progressPdfFileName: (range: string) => `progress-${range}.pdf`,
  };
});
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

import userEvent from '@testing-library/user-event';
import { Progress } from './Progress';
import { PdfUnsupportedTextError } from '@/lib/pdf/pdfText';

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
  h.createPdf.mockReset();
  h.createPdf.mockResolvedValue({ doc: { output: () => new Blob(['%PDF'], { type: 'application/pdf' }) } });
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
const exportButton = () => screen.findByRole('button', { name: /^Export progress report$/i }, { timeout: 10000 });
/** Opens the Export Report menu and picks a format, as a user would. */
async function chooseExport(item: 'Download CSV' | 'Download PDF') {
  const user = userEvent.setup();
  const button = await exportButton();
  await waitFor(() => expect(button).not.toBeDisabled());
  await user.click(button);
  await user.click(await screen.findByRole('menuitem', { name: item }));
  return button;
}
const pdfDone = (resolveWith: (v: unknown) => void) => resolveWith({ doc: { output: () => new Blob(['%PDF']) } });
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
    await chooseExport('Download CSV');
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
    await chooseExport('Download CSV');
    const { find, rows } = await exportedRows();
    expect(find('Summary', 'Talks completed')?.[5]).toMatch(/^Lower bound/);
    expect(rows.find((r) => r[0] === 'Completeness')?.[1]).toMatch(/^Partial/);
  });

  it('exports a failed journal source as Unavailable, not 0', async () => {
    h.impl['sessions.list'] = async () => [talk(9, 5)];
    h.impl['journal.getAll'] = async () => { throw new Error('403'); };

    renderPage();
    await chooseExport('Download CSV');
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
    const button = await chooseExport('Download CSV');
    await waitFor(() => expect(button).toBeDisabled());
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'last_month' } });
    await act(async () => release(capped));

    await waitFor(() => expect(h.toast.info).toHaveBeenCalled());
    expect(downloads).toHaveLength(0);
    expect(button).not.toBeDisabled();
  });

  it('downloads the CSV without loading the PDF engine or fonts', async () => {
    h.impl['sessions.list'] = async () => [talk(9, 5)];
    renderPage();
    await chooseExport('Download CSV');
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(h.pdfModuleLoaded).toBe(false);
  });

  it("refuses to export another account's loaded data", async () => {
    h.impl['sessions.list'] = async () => [talk(9, 5)];
    const { rerender } = renderPage();
    await exportButton();
    h.auth.current = { user: { id: 'user-b' }, profile: { id: 'user-b', subscription_plan: 'pro', streak_days: 0 } };
    rerender(<MemoryRouter><Progress /></MemoryRouter>);

    await chooseExport('Download CSV');
    await waitFor(() => expect(h.toast.error).toHaveBeenCalled());
    expect(downloads).toHaveLength(0);
  });
});

describe('Progress PDF export (page)', () => {
  const capped = () => Array.from({ length: 200 }, (_, i) => talk(9, 1 + (i % 27)));
  const talksRow = (report: { rows: Array<{ metric: string; value: number | null; status: string }> }) =>
    report.rows.find((r) => r.metric === 'Talks completed');

  it('builds the PDF from the same snapshot as the CSV, including the complete talk list', async () => {
    const full = [...capped(), ...Array.from({ length: 50 }, (_, i) => talk(9, 1 + (i % 27)))];
    h.impl['sessions.list'] = vi.fn(async (params?: { limit?: number }) => (params?.limit ? capped() : full));
    renderPage();
    await chooseExport('Download PDF');
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0].name).toBe('progress-this_month.pdf');
    const report = h.createPdf.mock.calls[0][0];
    expect(talksRow(report)).toMatchObject({ value: 250, status: 'Complete' });
    expect(report.rows.find((r: { metric: string }) => r.metric === 'Current streak')?.value).toBe(3);
    expect(report.selected).toBe('This Month (2026-10-01 to 2026-10-28)');
  });

  it('keeps the lower-bound label when the complete talk list fails', async () => {
    h.impl['sessions.list'] = vi.fn(async (params?: { limit?: number }) => {
      if (params?.limit) return capped();
      throw new Error('network');
    });
    renderPage();
    await chooseExport('Download PDF');
    await waitFor(() => expect(downloads).toHaveLength(1));
    const report = h.createPdf.mock.calls[0][0];
    expect(talksRow(report)?.status).toMatch(/^Lower bound/);
    expect(h.toast.warning).toHaveBeenCalled();
  });

  it('runs one export at a time while the PDF is being prepared', async () => {
    h.impl['sessions.list'] = async () => [talk(9, 5)];
    let finish: (v: unknown) => void = () => {};
    h.createPdf.mockImplementation(() => new Promise((r) => { finish = r; }));
    renderPage();
    const button = await chooseExport('Download PDF');
    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveAttribute('aria-busy', 'true');
    await act(async () => pdfDone(finish));
    await waitFor(() => expect(button).not.toBeDisabled());
    expect(h.createPdf).toHaveBeenCalledTimes(1);
    expect(downloads).toHaveLength(1);
  });

  it('cancels when the range changes during generation, and the old request cannot clear a newer export', async () => {
    h.impl['sessions.list'] = async () => [talk(9, 5)];
    const pending: Array<(v: unknown) => void> = [];
    h.createPdf.mockImplementation(() => new Promise((r) => pending.push(r)));
    renderPage();
    const button = await chooseExport('Download PDF');
    await waitFor(() => expect(h.createPdf).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'last_month' } });
    await waitFor(() => expect(button).not.toBeDisabled()); // the abandoned export no longer blocks

    await chooseExport('Download PDF'); // a newer export for Last Month
    await waitFor(() => expect(h.createPdf).toHaveBeenCalledTimes(2));
    await act(async () => pdfDone(pending[0])); // the old one finishes first
    expect(button).toBeDisabled(); // …but does not end the newer export
    expect(downloads).toHaveLength(0);
    expect(h.toast.info).toHaveBeenCalled();

    await act(async () => pdfDone(pending[1]));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0].name).toBe('progress-last_month.pdf');
    expect(button).not.toBeDisabled();
  });

  it('cancels when the account changes or signs out during generation', async () => {
    for (const next of [
      { user: { id: 'user-b' }, profile: { id: 'user-b', subscription_plan: 'pro', streak_days: 0 } },
      { user: null, profile: null },
    ]) {
      h.auth.current = { user: { id: 'user-a' }, profile: { id: 'user-a', subscription_plan: 'pro', streak_days: 3 } };
      h.impl['sessions.list'] = async () => [talk(9, 5)];
      let finish: (v: unknown) => void = () => {};
      h.createPdf.mockImplementation(() => new Promise((r) => { finish = r; }));
      const { rerender, unmount } = renderPage();
      await chooseExport('Download PDF');
      await waitFor(() => expect(h.createPdf).toHaveBeenCalled());
      h.auth.current = next;
      rerender(<MemoryRouter><Progress /></MemoryRouter>);
      await act(async () => pdfDone(finish));
      expect(downloads).toHaveLength(0);
      unmount();
      h.createPdf.mockReset();
    }
  });

  it('downloads nothing if the page is left during generation', async () => {
    h.impl['sessions.list'] = async () => [talk(9, 5)];
    let finish: (v: unknown) => void = () => {};
    h.createPdf.mockImplementation(() => new Promise((r) => { finish = r; }));
    const { unmount } = renderPage();
    await chooseExport('Download PDF');
    await waitFor(() => expect(h.createPdf).toHaveBeenCalled());
    unmount();
    await act(async () => pdfDone(finish));
    expect(downloads).toHaveLength(0);
    expect(h.toast.info).not.toHaveBeenCalled();
  });

  it('explains text the PDF cannot draw without downloading', async () => {
    h.impl['sessions.list'] = async () => [talk(9, 5)];
    h.createPdf.mockRejectedValueOnce(new PdfUnsupportedTextError(['呼'], 'no-glyph'));
    renderPage();
    await chooseExport('Download PDF');
    await waitFor(() =>
      expect(h.toast.error).toHaveBeenCalledWith(
        "Your progress report contains characters the PDF can't display (呼), so it wasn't downloaded. You can download the CSV instead."
      )
    );
    expect(downloads).toHaveLength(0);
  });

  it('keeps the trial restriction: no progress page and no export', async () => {
    h.auth.current = { user: { id: 'user-a' }, profile: { id: 'user-a', subscription_plan: 'trial', streak_days: 0 } };
    renderPage();
    expect(await screen.findByText('Progress tracking is part of Grow')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Export progress report/i })).toBeNull();
  });
});
