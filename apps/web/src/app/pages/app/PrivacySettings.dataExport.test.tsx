import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PdfUnsupportedTextError } from '@/lib/pdf/pdfText';
import type { AccountDataPdfSnapshot } from './privacy-settings/accountDataPdfSnapshot';

type Auth = { user: { id: string } | null; profile: { id: string; privacy_settings: Record<string, unknown> } | null; refreshProfile: () => Promise<void> };
const h = vi.hoisted(() => {
  const refreshProfile = vi.fn();
  // Stable objects per account: the page's effects depend on `profile`.
  const accounts = {
    a: { user: { id: 'user-a' }, profile: { id: 'user-a', privacy_settings: {} }, refreshProfile },
    b: { user: { id: 'user-b' }, profile: { id: 'user-b', privacy_settings: {} }, refreshProfile },
    none: { user: null, profile: null, refreshProfile },
  };
  return {
    accounts,
    auth: { current: accounts.a as Auth },
    getSession: vi.fn(),
    exportUserData: vi.fn(),
    createPdf: vi.fn(),
    writes: { updateProfile: vi.fn().mockResolvedValue({}), deleteAccount: vi.fn() },
    // Stable: the page has effects that depend on the consent context value.
    safety: { updateConsent: vi.fn() },
    toast: { info: vi.fn(), success: vi.fn(), error: vi.fn(), loading: vi.fn(), dismiss: vi.fn() },
  };
});
vi.mock('@/lib/api', () => ({
  api: { exportUserData: h.exportUserData, getKnowledgeTwoFactorStatus: vi.fn().mockResolvedValue({ enabled: false }), ...h.writes },
}));
vi.mock('@/lib/supabase', () => {
  const deep = (path: string): unknown =>
    new Proxy(function () {}, {
      get: (_t, k) => (k === 'then' ? undefined : deep(`${path}.${String(k)}`)),
      apply: () => (path === '.auth.getSession' ? h.getSession() : Promise.resolve({ data: { session: null, sessions: [] }, error: null })),
    });
  return { supabase: deep('') };
});
vi.mock('@/app/contexts/AuthContext', () => ({ useAuth: () => h.auth.current }));
vi.mock('@/app/contexts/SafetyContext', () => ({ useSafetyConsent: () => h.safety }));
vi.mock('sonner', () => ({ toast: h.toast }));
vi.mock('./privacy-settings/accountDataPdf', () => ({ createAccountDataPdf: h.createPdf }));

import { PrivacySettings } from './PrivacySettings';
import { accountDataExportRows, buildAccountDataExportCsv } from './privacy-settings/accountDataExportCsv';
import { accountDataDisplayValue } from './privacy-settings/accountDataPdfSnapshot';

const NOW = new Date(2026, 10, 5, 14, 30);
const payload = {
  exportVersion: 1,
  generatedAt: '2026-11-05T09:30:00.000Z',
  profile: {
    account: { fullName: 'আয়েশা খান', email: 'ayesha@example.test', createdAt: '2026-01-02T03:04:05.000Z', stripe_customer_id: 'cus_1' },
    profile: { dateOfBirth: '1995-04-12', bio: '=1+2 آج میں ٹھیک ہوں', phone: null },
    wellnessPreferences: { goals: ['sleep'], challenges: [] },
    privacySettings: { allowAnalytics: false, marketingEmails: 0 },
    notificationPreferences: { pushEnabled: true },
    emergencyContacts: { consentToContact: true, contacts: [] },
    membership: { name: 'Grow', status: 'active' },
  },
};
const response = (body: unknown = payload) => ({ blob: new Blob([JSON.stringify(body)], { type: 'application/json' }), filename: 'x.json', contentType: 'application/json' });
const sessionFor = (id: string) => ({ data: { session: { access_token: `tok-${id}`, user: { id } } }, error: null });

let downloads: Array<{ name: string; type: string; blob: Blob }> = [];
let lastBlob: Blob | null = null;
const readBlob = (b: Blob) => new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result)); fr.readAsText(b); });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW });
  h.auth.current = h.accounts.a;
  h.getSession.mockReset().mockImplementation(async () => sessionFor(h.auth.current.user?.id ?? 'none'));
  h.exportUserData.mockReset().mockImplementation(async () => response());
  h.createPdf.mockReset().mockResolvedValue({ bytes: new TextEncoder().encode('%PDF'), pages: 1, emojiReplacedCount: 0 });
  Object.values(h.toast).forEach((fn) => fn.mockReset());
  let ids = 0;
  h.toast.loading.mockImplementation((_m: string, o?: { id?: string }) => o?.id ?? `toast-${++ids}`);
  Object.values(h.writes).forEach((fn) => fn.mockClear());
  if (!(Blob.prototype as { text?: unknown }).text) (Blob.prototype as { text: () => Promise<string> }).text = function (this: Blob) { return readBlob(this); };
  downloads = [];
  URL.createObjectURL = vi.fn((b: Blob) => { lastBlob = b; return 'blob:account'; }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    if (lastBlob) downloads.push({ name: this.download, type: lastBlob.type, blob: lastBlob });
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

function renderPage() {
  const ui = () => <MemoryRouter><PrivacySettings /></MemoryRouter>;
  const utils = render(ui());
  return { ...utils, rerenderPage: () => utils.rerender(ui()) };
}
const trigger = () => screen.getByRole('button', { name: 'Export data' });
async function choose(item: 'Download PDF' | 'Download CSV') {
  const user = userEvent.setup();
  await waitFor(() => expect(trigger()).not.toBeDisabled());
  await user.click(trigger());
  await user.click(await screen.findByRole('menuitem', { name: item }));
}
const snapshotOf = (call = 0) => h.createPdf.mock.calls[call][0] as AccountDataPdfSnapshot;
const pdfOptionsOf = (call = 0) => h.createPdf.mock.calls[call][1] as { signal: AbortSignal; onProgress: (p: { fontsLoaded: number; fontsTotal: number }) => void };
const fetchOptionsOf = (call = 0) => h.exportUserData.mock.calls[call][0] as { accessToken: string; signal: AbortSignal };
const deferred = <T,>() => { let resolve!: (v: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; };
/** As the real client: resolves when finished, rejects at once with AbortError on abort. */
function pendingPdf() {
  const finish: Array<() => void> = [];
  h.createPdf.mockImplementation((_s: unknown, o: { signal: AbortSignal }) => new Promise((resolve, reject) => {
    finish.push(() => resolve({ bytes: new TextEncoder().encode('%PDF'), pages: 1, emojiReplacedCount: 0 }));
    o.signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')));
  }));
  return finish;
}
const expectNoWrites = () => Object.values(h.writes).forEach((fn) => expect(fn).not.toHaveBeenCalled());

describe('Privacy Settings account data export (PDF and CSV)', { timeout: 20000 }, () => {
  it('describes both formats and what is (and is not) included', () => {
    renderPage();
    expect(screen.getByText(/^Download a PDF or CSV of your account details/)).toBeInTheDocument();
    expect(screen.getByText(/does not include journals, mood check-ins or conversation history/)).toBeInTheDocument();
  });

  it('builds the PDF from the same allowlisted rows as the CSV, for the signed-in account only, with no writes', async () => {
    renderPage();
    await choose('Download PDF');
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0]).toMatchObject({ name: 'solace-account-data-2026-11-05.pdf', type: 'application/pdf' });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:account');
    expect(fetchOptionsOf().accessToken).toBe('tok-user-a');
    const s = snapshotOf();
    expect(Object.isFrozen(s)).toBe(true);
    expect(s.contents).toMatch(/^Account details, profile answers/);
    // Parity with the CSV: same rows, same order, same values (PDF shows formulas as entered).
    const rows = accountDataExportRows(payload).filter((r) => r.section !== 'Export');
    const pdfRows = s.sections.flatMap((sec) => sec.rows.map((r) => [sec.title, r.label, r.value]));
    expect(pdfRows).toEqual(rows.map((r) => [r.section, r.label, accountDataDisplayValue(r.value)]));
    expect(pdfRows).toContainEqual(['Profile', 'About me', '=1+2 آج میں ٹھیک ہوں']);
    expect(pdfRows).toContainEqual(['Privacy settings', 'Marketing emails', '0']);
    expect(JSON.stringify(s)).not.toContain('cus_1');
    expect(h.toast.loading).toHaveBeenCalledWith('Preparing your PDF…');
    expect(h.toast.dismiss).toHaveBeenCalledWith('toast-1');
    expect(h.toast.success).toHaveBeenCalledWith('Your PDF has been downloaded.');
    // The CSV from the same response is unchanged.
    await choose('Download CSV');
    await waitFor(() => expect(downloads).toHaveLength(2));
    expect(downloads[1]).toMatchObject({ name: 'solace-account-data-2026-11-05.csv', type: 'text/csv;charset=utf-8' });
    expect(await readBlob(downloads[1].blob)).toBe(buildAccountDataExportCsv(payload).slice(1)); // FileReader drops the BOM
    expectNoWrites();
    expect(console.error).not.toHaveBeenCalled();
  });

  it.each(['Download PDF', 'Download CSV'] as const)('%s: a failed or unexpected response produces no file and a clear error', async (item) => {
    renderPage();
    h.exportUserData.mockRejectedValueOnce(new Error('HTTP 500'));
    await choose(item);
    await waitFor(() => expect(h.toast.error).toHaveBeenLastCalledWith('Failed to download your data. Please try again.'));
    h.exportUserData.mockResolvedValueOnce(response({ profile: { id: 'x', stripe_customer_id: 'cus_1' } }));
    await choose(item);
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledTimes(2));
    expect(downloads).toHaveLength(0);
    expect(h.createPdf).not.toHaveBeenCalled();
    // No account values reach the console: only the kind of error.
    for (const call of (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls) expect(call.slice(1)).toEqual([expect.stringMatching(/^(Error|SyntaxError|unknown)$/)]);
    await waitFor(() => expect(trigger()).not.toBeDisabled());
  });

  it('never requests data with another account’s session', async () => {
    h.getSession.mockResolvedValueOnce(sessionFor('user-b'));
    renderPage();
    await choose('Download PDF');
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('Failed to download your data. Please try again.'));
    expect(h.exportUserData).not.toHaveBeenCalled();
    expect(downloads).toHaveLength(0);
  });

  it.each(['account change', 'sign-out', 'unmount'] as const)('cancels on %s while the data is loading: request aborted, nothing downloaded', async (reason) => {
    const late = deferred<ReturnType<typeof response>>();
    h.exportUserData.mockImplementationOnce(() => late.promise);
    const { rerenderPage, unmount } = renderPage();
    await choose('Download PDF');
    await waitFor(() => expect(h.exportUserData).toHaveBeenCalledTimes(1));
    if (reason === 'account change') { h.auth.current = h.accounts.b; rerenderPage(); }
    if (reason === 'sign-out') { h.auth.current = h.accounts.none; rerenderPage(); }
    if (reason === 'unmount') unmount();
    expect(fetchOptionsOf().signal.aborted).toBe(true);
    expect(h.toast.dismiss).toHaveBeenCalledWith('toast-1');
    await act(async () => late.resolve(response())); // the old account's data arrives late
    expect(h.createPdf).not.toHaveBeenCalled();
    expect(downloads).toHaveLength(0);
    expect(h.toast.error).not.toHaveBeenCalled();
  });

  it.each(['account change', 'sign-out', 'unmount'] as const)('cancels PDF generation on %s: worker stopped, toast cleared', async (reason) => {
    pendingPdf();
    const { rerenderPage, unmount } = renderPage();
    await choose('Download PDF');
    await waitFor(() => expect(h.createPdf).toHaveBeenCalledTimes(1));
    if (reason === 'account change') { h.auth.current = h.accounts.b; rerenderPage(); }
    if (reason === 'sign-out') { h.auth.current = h.accounts.none; rerenderPage(); }
    if (reason === 'unmount') unmount();
    expect(pdfOptionsOf().signal.aborted).toBe(true);
    await waitFor(() => expect(h.toast.dismiss).toHaveBeenCalledWith('toast-1'));
    await act(async () => {});
    expect(downloads).toHaveLength(0);
    expect(h.toast.error).not.toHaveBeenCalled();
  });

  it('runs one export at a time, whichever format', async () => {
    const finish = pendingPdf();
    renderPage();
    await choose('Download PDF');
    await waitFor(() => expect(h.createPdf).toHaveBeenCalledTimes(1));
    expect(trigger()).toBeDisabled();
    expect(trigger()).toHaveAttribute('aria-busy', 'true');
    const lingering = screen.queryAllByRole('menuitem');
    lingering.forEach((el) => fireEvent.click(el));
    await act(async () => {});
    expect(h.exportUserData).toHaveBeenCalledTimes(1);
    expect(h.toast.loading).toHaveBeenCalledTimes(1);
    await act(async () => finish[0]());
    await waitFor(() => expect(downloads).toHaveLength(1));
    await waitFor(() => expect(trigger()).not.toBeDisabled());
  });

  it('a late response or result from an old export never downloads or touches a newer export', async () => {
    const lateData = deferred<ReturnType<typeof response>>();
    h.exportUserData.mockImplementationOnce(() => lateData.promise);
    const finish = pendingPdf();
    const { rerenderPage } = renderPage();
    await choose('Download PDF');
    await waitFor(() => expect(h.exportUserData).toHaveBeenCalledTimes(1));

    h.auth.current = h.accounts.b;
    rerenderPage();
    await choose('Download PDF'); // account B's export
    await waitFor(() => expect(h.createPdf).toHaveBeenCalledTimes(1));
    expect(fetchOptionsOf(1).accessToken).toBe('tok-user-b');

    const loadingCalls = h.toast.loading.mock.calls.length;
    await act(async () => lateData.resolve(response())); // account A's data, late
    expect(h.createPdf).toHaveBeenCalledTimes(1);
    expect(h.toast.dismiss).not.toHaveBeenCalledWith('toast-2');
    expect(trigger()).toHaveAttribute('aria-busy', 'true');
    act(() => pdfOptionsOf(0).onProgress({ fontsLoaded: 1, fontsTotal: 2 }));
    expect(h.toast.loading).toHaveBeenCalledTimes(loadingCalls + 1);
    expect(h.toast.loading).toHaveBeenLastCalledWith('Preparing your PDF… downloading fonts (1 of 2)', { id: 'toast-2' });
    await act(async () => finish[0]());
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(h.toast.dismiss).toHaveBeenCalledWith('toast-2');
  });

  it('explains unsupported text, font/WebAssembly or worker failure with no PDF, and keeps CSV available', async () => {
    renderPage();
    h.createPdf.mockRejectedValueOnce(new PdfUnsupportedTextError(['ߒ'], 'no-glyph'));
    await choose('Download PDF');
    await waitFor(() => expect(h.toast.error).toHaveBeenLastCalledWith(
      "Your account data includes N'Ko text, which the PDF can't display yet, so the PDF wasn't downloaded. You can download the CSV instead."
    ));
    h.createPdf.mockRejectedValueOnce(new PdfUnsupportedTextError([], 'font-unavailable'));
    await choose('Download PDF');
    await waitFor(() => expect(h.toast.error).toHaveBeenLastCalledWith(
      "The fonts needed for this PDF couldn't be loaded, so it wasn't downloaded. Please check your connection and try again, or download the CSV."
    ));
    h.createPdf.mockRejectedValueOnce(new Error('The PDF worker failed to start or crashed.'));
    await choose('Download PDF');
    await waitFor(() => expect(h.toast.error).toHaveBeenLastCalledWith("We couldn't create the PDF. Please try again, or download the CSV."));
    expect(h.toast.dismiss).toHaveBeenCalledTimes(3);
    expect(downloads).toHaveLength(0);
    await choose('Download CSV');
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0].name).toBe('solace-account-data-2026-11-05.csv');
    expectNoWrites();
  });

  it('stores nothing in browser storage', async () => {
    renderPage();
    const before = JSON.stringify({ ...localStorage });
    await choose('Download PDF');
    await waitFor(() => expect(downloads).toHaveLength(1));
    await choose('Download CSV');
    await waitFor(() => expect(downloads).toHaveLength(2));
    expect(JSON.stringify({ ...localStorage })).toBe(before);
    expect(sessionStorage.length).toBe(0);
  });
});
