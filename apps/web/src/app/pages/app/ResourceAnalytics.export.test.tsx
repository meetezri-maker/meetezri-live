import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PdfUnsupportedTextError } from '@/lib/pdf/pdfText';
import type { ResourceAnalyticsPdfSnapshot } from './resource-analytics/resourceAnalyticsReport';

const h = vi.hoisted(() => ({
  list: vi.fn(),
  createPdf: vi.fn(),
  authState: { current: null as null | { user: { id: string } | null; profile: null; isLoading: boolean } },
  toast: { loading: vi.fn(), dismiss: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));
vi.mock('@/lib/api', () => ({ api: { safetyResourceInteractions: { list: h.list, record: vi.fn() } } }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: vi.fn() } } }));
vi.mock('@/app/contexts/AuthContext', () => ({ useAuth: () => h.authState.current }));
vi.mock('sonner', () => ({ toast: h.toast }));
vi.mock('./resource-analytics/resourceAnalyticsPdf', () => ({ createResourceAnalyticsPdf: h.createPdf }));
// The Radix select does not open in jsdom; a native select exercises the same onValueChange.
vi.mock('@/app/solace', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  SolaceSelect: ({ id, value, onValueChange, options, ariaLabel, disabled }: { id?: string; value: string; onValueChange: (v: string) => void; options: Array<{ value: string; label: string }>; ariaLabel?: string; disabled?: boolean }) => (
    <select id={id} aria-label={ariaLabel} value={value} disabled={disabled} onChange={(e) => onValueChange(e.target.value)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
}));

import { ResourceAnalyticsPage } from './ResourceAnalytics';

const NOW = new Date('2026-11-04T10:00:00.000Z');
const DAY = 86_400_000;
const signIn = (id: string | null, isLoading = false) => {
  h.authState.current = { user: id ? { id } : null, profile: null, isLoading };
};
const serverRow = (id: string, daysAgo: number, resource_id = '988', interaction_type = 'call', resource_name = `Resource ${resource_id}`) => ({
  id, resource_id, resource_name, resource_type: 'crisis_line', interaction_type, context_session_id: null, safety_state: 'normal',
  created_at: new Date(NOW.getTime() - daysAgo * DAY).toISOString(),
});
const ROWS = [
  serverRow('s1', 1), serverRow('s2', 2, '988', 'view'), serverRow('s3', 3, 'text-1', 'text'),
  serverRow('s4', 20, 'grp', 'view', 'সহায়তা গোষ্ঠী'), serverRow('s5', 60, 'old', 'visit'),
];
const inRange = (r: { created_at: string }, p: { from?: string; to?: string }) => (!p.from || r.created_at >= p.from) && (!p.to || r.created_at <= p.to);

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

let downloads: Array<{ name: string; type: string }> = [];
let blobs: Blob[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW });
  localStorage.clear();
  h.list.mockReset();
  h.list.mockImplementation(async (p: { from?: string; to?: string }) => ROWS.filter((r) => inRange(r, p)));
  h.createPdf.mockReset();
  h.createPdf.mockResolvedValue({ bytes: new TextEncoder().encode('%PDF'), pages: 1, emojiReplacedCount: 0 });
  Object.values(h.toast).forEach((fn) => fn.mockReset());
  let toastIds = 0;
  h.toast.loading.mockImplementation((_m: string, o?: { id?: string }) => o?.id ?? `toast-${++toastIds}`);
  signIn('user-a');
  downloads = []; blobs = [];
  URL.createObjectURL = vi.fn((b: Blob) => { blobs.push(b); return `blob:${blobs.length}`; }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push({ name: this.download, type: blobs[blobs.length - 1]?.type ?? '' });
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
function renderPage(c = client()) {
  const ui = () => <QueryClientProvider client={c}><MemoryRouter><ResourceAnalyticsPage /></MemoryRouter></QueryClientProvider>;
  const utils = render(ui());
  return { ...utils, rerenderPage: () => utils.rerender(ui()) };
}
const trigger = () => screen.getByRole('button', { name: /Export insights/i });
const ready = () => waitFor(() => expect(trigger()).not.toBeDisabled());
async function choose(item: 'Download PDF' | 'Download JSON') {
  const user = userEvent.setup();
  await user.click(trigger());
  await user.click(await screen.findByRole('menuitem', { name: item }));
}
const snapshotOf = (call = 0) => h.createPdf.mock.calls[call][0] as ResourceAnalyticsPdfSnapshot;
const optionsOf = (call = 0) => h.createPdf.mock.calls[call][1] as { signal: AbortSignal; onProgress: (p: { fontsLoaded: number; fontsTotal: number }) => void };
const metricOnPage = (label: string) => screen.getByText(label).previousElementSibling?.textContent;
/** As the real client: resolves when `finish` is called, rejects at once with AbortError on abort. */
function pendingPdf() {
  const finishers: Array<() => void> = [];
  h.createPdf.mockImplementation((_s: unknown, o: { signal: AbortSignal }) => new Promise((resolve, reject) => {
    finishers.push(() => resolve({ bytes: new TextEncoder().encode('%PDF'), pages: 1, emojiReplacedCount: 0 }));
    o.signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')));
  }));
  return finishers;
}

describe('Resource Analytics export menu', { timeout: 20000 }, () => {
  it('offers PDF and JSON in the same control; JSON keeps its file name and content', async () => {
    renderPage();
    await ready();
    await choose('Download JSON');
    expect(downloads).toEqual([{ name: 'resource-analytics-2026-11-04.json', type: 'application/json' }]);
    expect(h.createPdf).not.toHaveBeenCalled();
  });

  it('builds the PDF from the same period data the page shows, labelled as server-confirmed', async () => {
    renderPage();
    await ready();
    await choose('Download PDF');
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0]).toEqual({ name: 'solace-resource-analytics-2026-10-05-to-2026-11-04.pdf', type: 'application/pdf' });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:1');
    const s = snapshotOf();
    expect(Object.isFrozen(s)).toBe(true);
    expect(s.source).toBe('server');
    expect(s.warning).toBeNull();
    expect(s.periodLabel).toBe('Last 30 days');
    for (const m of s.metrics) expect(metricOnPage(m.label)).toBe(m.value);
    expect(s.metrics.map((m) => m.value)).toEqual(['4', '2', '50.0%', '3']);
    expect(s.resources.map((r) => r.name)).toEqual(['Resource 988', 'Resource text-1', 'সহায়তা গোষ্ঠী']);
    expect(s.timeZone).toBeTruthy();
    expect(h.toast.loading).toHaveBeenCalledWith('Preparing your PDF…');
    expect(h.toast.dismiss).toHaveBeenCalledWith('toast-1');
  });

  it.each([
    ['7d', 'Last 7 days', 'solace-resource-analytics-2026-10-28-to-2026-11-04.pdf', 3],
    ['90d', 'Last 90 days', 'solace-resource-analytics-2026-08-06-to-2026-11-04.pdf', 5],
    ['all', 'All time', 'solace-resource-analytics-all-time-to-2026-11-04.pdf', 5],
  ])('exports the %s period', { timeout: 60000 }, async (value, label, fileName, total) => {
    renderPage();
    await ready();
    await act(async () => { fireEvent.change(screen.getByLabelText('Date range'), { target: { value } }); });
    await waitFor(() => expect(metricOnPage('Total Interactions')).toBe(String(total)));
    await ready();
    await choose('Download PDF');
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(snapshotOf().periodLabel).toBe(label);
    expect(snapshotOf().metrics[0].value).toBe(String(total));
    expect(downloads[0].name).toBe(fileName);
  });

  it('uses only this account’s browser records, with the warning, when the server request fails', async () => {
    h.list.mockRejectedValue(new Error('offline'));
    localStorage.setItem('ezri_resource_interactions:user-a', JSON.stringify([
      { id: 'interaction_1', resourceId: 'local-1', resourceName: 'Local only', resourceType: 'crisis_line', interactionType: 'call', timestamp: new Date(NOW.getTime() - DAY).toISOString(), userId: 'user-a', syncStatus: 'failed' },
    ]));
    localStorage.setItem('ezri_resource_interactions:user-b', JSON.stringify([
      { id: 'interaction_2', resourceId: 'b-1', resourceName: 'Other account', resourceType: 'crisis_line', interactionType: 'call', timestamp: new Date(NOW.getTime() - DAY).toISOString(), userId: 'user-b', syncStatus: 'failed' },
    ]));
    renderPage();
    await screen.findByText(/Could not reach the server/i);
    await ready();
    await choose('Download PDF');
    await waitFor(() => expect(h.createPdf).toHaveBeenCalled());
    const s = snapshotOf();
    expect(s.source).toBe('browser');
    expect(s.warning).toBe('Could not reach the server. Showing activity saved in this browser only, which may be incomplete.');
    expect(s.resources.map((r) => r.name)).toEqual(['Local only']);
  });

  it('never adds browser records to a successful server response, and an empty one cannot be exported', async () => {
    h.list.mockResolvedValue([]);
    localStorage.setItem('ezri_resource_interactions:user-a', JSON.stringify([
      { id: 'interaction_1', resourceId: 'local-1', resourceName: 'Local only', resourceType: 'crisis_line', interactionType: 'call', timestamp: new Date(NOW.getTime() - DAY).toISOString(), userId: 'user-a', syncStatus: 'pending' },
    ]));
    renderPage();
    await waitFor(() => expect(h.list).toHaveBeenCalled());
    await waitFor(() => expect(metricOnPage('Total Interactions')).toBe('0'));
    expect(trigger()).toBeDisabled();
    expect(h.createPdf).not.toHaveBeenCalled();
  });

  it('is disabled while data loads and while the account is unresolved', async () => {
    let release: (rows: unknown[]) => void = () => {};
    h.list.mockImplementation(() => new Promise((r) => { release = r; }));
    const { rerenderPage } = renderPage();
    await waitFor(() => expect(h.list).toHaveBeenCalled());
    expect(trigger()).toBeDisabled();
    await act(async () => release(ROWS));
    await ready();
    signIn(null, true);
    rerenderPage();
    expect(screen.queryByRole('button', { name: /Export insights/i })).toBeNull();
  });

  it('runs one PDF export at a time', async () => {
    const finish = pendingPdf();
    renderPage();
    await ready();
    await choose('Download PDF');
    await waitFor(() => expect(h.createPdf).toHaveBeenCalledTimes(1));
    expect(trigger()).toBeDisabled();
    expect(trigger()).toHaveAttribute('aria-busy', 'true');
    await userEvent.setup().click(trigger()); // disabled trigger: no second export
    // Even a menu item still on screen (the closing menu) cannot start a second export.
    const lingering = screen.queryByRole('menuitem', { name: 'Download PDF' });
    if (lingering) fireEvent.click(lingering);
    await act(async () => {});
    expect(h.createPdf).toHaveBeenCalledTimes(1);
    expect(h.toast.loading).toHaveBeenCalledTimes(1);
    await act(async () => finish[0]());
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(h.createPdf).toHaveBeenCalledTimes(1);
    await ready();
    expect(trigger()).toHaveAttribute('aria-busy', 'false');
  });

  it.each(['period change', 'account change', 'sign-out', 'unmount'] as const)('cancels PDF preparation on %s: worker stopped, toast cleared, nothing downloaded', async (reason) => {
    pendingPdf();
    const { rerenderPage, unmount } = renderPage();
    await ready();
    await choose('Download PDF');
    await waitFor(() => expect(h.createPdf).toHaveBeenCalledTimes(1));
    if (reason === 'period change') await act(async () => { fireEvent.change(screen.getByLabelText('Date range'), { target: { value: '7d' } }); });
    if (reason === 'account change') { signIn('user-b'); rerenderPage(); }
    if (reason === 'sign-out') { signIn(null); rerenderPage(); }
    if (reason === 'unmount') unmount();
    expect(optionsOf().signal.aborted).toBe(true);
    await waitFor(() => expect(h.toast.dismiss).toHaveBeenCalledWith('toast-1'));
    await act(async () => {});
    expect(downloads).toHaveLength(0);
    expect(h.toast.error).not.toHaveBeenCalled();
  });

  it('a late result from an old export never downloads, nor touches a newer export’s toast or busy state', async () => {
    const finish = pendingPdf();
    // The old export ignores cancellation, as a message already in flight would.
    h.createPdf.mockImplementationOnce((_s: unknown) => new Promise((resolve) => {
      finish.push(() => resolve({ bytes: new TextEncoder().encode('%PDF-old'), pages: 1, emojiReplacedCount: 0 }));
    }));
    const { rerenderPage } = renderPage();
    await ready();
    await choose('Download PDF');
    await waitFor(() => expect(h.createPdf).toHaveBeenCalledTimes(1));
    const oldProgress = optionsOf(0).onProgress;

    signIn('user-b');
    rerenderPage();
    await ready();
    await choose('Download PDF');
    await waitFor(() => expect(h.createPdf).toHaveBeenCalledTimes(2));
    expect(h.toast.loading).toHaveBeenLastCalledWith('Preparing your PDF…');

    const loadingCalls = h.toast.loading.mock.calls.length;
    act(() => oldProgress({ fontsLoaded: 1, fontsTotal: 2 }));
    await act(async () => finish[0]()); // the old export's late completion
    expect(h.toast.loading).toHaveBeenCalledTimes(loadingCalls);
    expect(h.toast.dismiss).not.toHaveBeenCalledWith('toast-2');
    expect(downloads).toHaveLength(0);
    expect(trigger()).toHaveAttribute('aria-busy', 'true');

    act(() => optionsOf(1).onProgress({ fontsLoaded: 1, fontsTotal: 2 }));
    expect(h.toast.loading).toHaveBeenLastCalledWith('Preparing your PDF… downloading fonts (1 of 2)', { id: 'toast-2' });
    await act(async () => finish[1]());
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(h.toast.dismiss).toHaveBeenCalledWith('toast-2');
    await ready();
  });

  it('fails cleanly on unsupported text, fonts/WebAssembly or worker failure, keeping JSON available', async () => {
    renderPage();
    await ready();
    h.createPdf.mockRejectedValueOnce(new PdfUnsupportedTextError(['ߒ'], 'no-glyph'));
    await choose('Download PDF');
    await waitFor(() => expect(h.toast.error).toHaveBeenLastCalledWith(
      "This report includes N'Ko text, which the PDF can't display yet, so the PDF wasn't downloaded. You can download the JSON instead."
    ));
    await ready();
    h.createPdf.mockRejectedValueOnce(new PdfUnsupportedTextError([], 'font-unavailable'));
    await choose('Download PDF');
    await waitFor(() => expect(h.toast.error).toHaveBeenLastCalledWith(
      "The fonts needed for this PDF couldn't be loaded, so it wasn't downloaded. Please check your connection and try again, or download the JSON."
    ));
    await ready();
    h.createPdf.mockRejectedValueOnce(new Error('The PDF worker failed to start or crashed.'));
    await choose('Download PDF');
    await waitFor(() => expect(h.toast.error).toHaveBeenLastCalledWith("We couldn't create the PDF. Please try again, or download the JSON."));
    expect(h.toast.dismiss).toHaveBeenCalledTimes(3);
    expect(downloads).toHaveLength(0);
    await ready();
    await choose('Download JSON');
    expect(downloads).toEqual([{ name: 'resource-analytics-2026-11-04.json', type: 'application/json' }]);
  });

  it('does not store report content or PDFs in browser storage', async () => {
    renderPage();
    await ready();
    const before = JSON.stringify({ ...localStorage });
    await choose('Download PDF');
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(JSON.stringify({ ...localStorage })).toBe(before);
    expect(sessionStorage.length).toBe(0);
  });
});
