import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  getTranscript: vi.fn(),
  getSummary: vi.fn(),
  toggleFavorite: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  auth: {
    current: {
      session: { access_token: 't' },
      user: { id: 'user-a' } as { id: string } | null,
      profile: { id: 'user-a', subscription_plan: 'pro', selected_avatar: 'Alex' } as Record<string, unknown> | null,
    },
  },
}));

vi.mock('@/lib/api', () => ({
  api: {
    sessions: {
      list: h.list,
      get: h.get,
      getTranscript: h.getTranscript,
      getSummary: h.getSummary,
      toggleFavorite: h.toggleFavorite,
    },
  },
}));
vi.mock('@/app/contexts/AuthContext', () => ({ useAuth: () => h.auth.current }));
vi.mock('sonner', () => ({ toast: h.toast }));

import { SessionHistory } from './SessionHistory';

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const NOW = new Date(2026, 9, 28, 12, 0);
const at = (d: number, hr: number, m = 0) => new Date(2026, 9, d, hr, m).toISOString();

const sessionRow = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  user_id: 'user-a',
  title: 'Instant Session',
  status: 'completed',
  type: 'instant',
  scheduled_at: null,
  started_at: at(27, 21),
  ended_at: at(27, 21, 20),
  duration_minutes: 30,
  recording_url: null,
  is_favorite: false,
  created_at: at(27, 21),
  updated_at: at(27, 21, 20),
  _count: { session_messages: 2 },
  config: { avatar: 'Maya', summary: 'Instant talk', internal_prompt: 'SECRET CONFIG' },
  ...over,
});

const messages = [
  { role: 'user', content: 'Hello', created_at: at(27, 21, 1) },
  { role: 'assistant', content: 'Hi there', created_at: at(27, 21, 2) },
];

let downloads: Array<{ name: string; text: Promise<string> }> = [];
let lastBlob: Blob | null = null;
const readBlob = (b: Blob) =>
  new Promise<string>((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.readAsText(b);
  });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW });
  for (const fn of [h.list, h.get, h.getTranscript, h.getSummary, h.toggleFavorite]) fn.mockReset();
  Object.values(h.toast).forEach((fn) => fn.mockReset());
  h.auth.current = {
    session: { access_token: 't' },
    user: { id: 'user-a' },
    profile: { id: 'user-a', subscription_plan: 'pro', selected_avatar: 'Alex' },
  };
  h.list.mockResolvedValue([sessionRow('s1'), sessionRow('s2', { title: 'Second talk', started_at: at(26, 9), created_at: at(26, 9) })]);
  h.get.mockImplementation(async (id: string) => sessionRow(id, id === 's2' ? { title: 'Second talk' } : {}));
  h.getTranscript.mockResolvedValue(messages);
  h.getSummary.mockResolvedValue({ summary: 'AI summary from popup', source: 'ai' });
  downloads = [];
  URL.createObjectURL = vi.fn((b: Blob) => { lastBlob = b; return 'blob:test'; }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    if (lastBlob) downloads.push({ name: this.download, text: readBlob(lastBlob) });
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const renderPage = () => render(<MemoryRouter><SessionHistory /></MemoryRouter>);
const rowButtons = () => screen.findAllByRole('button', { name: 'Download transcript' }, { timeout: 10000 });

describe('Session transcript export (page)', () => {
  it('row icon exports from stored data without calling the summary endpoint', async () => {
    renderPage();
    const [first] = await rowButtons();
    fireEvent.click(first);

    await waitFor(() => expect(downloads).toHaveLength(1));
    const text = await downloads[0].text;
    expect(h.getSummary).not.toHaveBeenCalled();
    expect(h.get).toHaveBeenCalledWith('s1');
    expect(h.getTranscript).toHaveBeenCalledWith('s1');
    expect(downloads[0].name).toBe('solace-session-s1-2026-10-27-transcript.txt');
    expect(text).toContain('Session: Talk It Out session\n');
    expect(text).toMatch(/\nCompanion: Maya[^\n]*\n/); // stored session avatar, not the user's current one
    expect(text).toContain('Saved Summary\nNo saved summary available.\n');
    expect(text).toContain('Duration: 20 min\n');
    expect(text).toContain('Earlier messages from longer sessions may not be available.\n');
    expect(text).toContain('Times shown are when each message was recorded (saved)');
    expect(text).not.toContain('SECRET CONFIG');
    expect(text).not.toContain('Alex');
  });

  it('popup Export Transcript produces the same file; only opening the popup calls getSummary', async () => {
    renderPage();
    const [first] = await rowButtons();
    fireEvent.click(first);
    await waitFor(() => expect(downloads).toHaveLength(1));
    const fromRow = await downloads[0].text;

    fireEvent.click(first.closest('.session-history-row')!);
    const popupButton = await screen.findByRole('button', { name: /Export Transcript/i });
    // Opening the popup generates a summary (existing behaviour, unchanged by this export).
    await waitFor(() => expect(h.getSummary).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 100));
    const summaryCallsBeforeExport = h.getSummary.mock.calls.length;

    fireEvent.click(popupButton);
    await waitFor(() => expect(downloads).toHaveLength(2));
    expect(h.getSummary.mock.calls.length).toBe(summaryCallsBeforeExport); // export added none
    expect(await downloads[1].text).toBe(fromRow);
    expect(downloads[1].name).toBe(downloads[0].name);
  });

  it('ignores repeated clicks while the first export is loading', async () => {
    let release: (v: unknown) => void = () => {};
    h.getTranscript.mockImplementation(() => new Promise((r) => { release = r; }));
    renderPage();
    const [first] = await rowButtons();
    fireEvent.click(first);
    fireEvent.click(first);
    fireEvent.click(first);
    await act(async () => release(messages));

    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(h.getTranscript).toHaveBeenCalledTimes(1);
  });

  it('downloads nothing when the account changes or signs out before the data arrives', async () => {
    for (const next of [{ id: 'user-b' }, null]) {
      let release: (v: unknown) => void = () => {};
      h.getTranscript.mockImplementation(() => new Promise((r) => { release = r; }));
      const { rerender, unmount } = renderPage();
      const [first] = await rowButtons();
      fireEvent.click(first);

      h.auth.current = { ...h.auth.current, user: next, profile: next ? { id: next.id, subscription_plan: 'pro' } : null };
      rerender(<MemoryRouter><SessionHistory /></MemoryRouter>);
      await act(async () => release(messages));

      expect(downloads).toHaveLength(0);
      unmount();
      h.auth.current = { session: { access_token: 't' }, user: { id: 'user-a' }, profile: { id: 'user-a', subscription_plan: 'pro' } };
    }
  });

  it('exports the requested session even if another session is opened meanwhile', async () => {
    let release: (v: unknown) => void = () => {};
    h.getTranscript.mockImplementationOnce(() => new Promise((r) => { release = r; }));
    renderPage();
    const [first, second] = await rowButtons();
    fireEvent.click(first);
    fireEvent.click(second.closest('.session-history-row')!); // open s2 details while s1 loads
    await act(async () => release(messages));

    await waitFor(() => expect(downloads).toHaveLength(1));
    const text = await downloads[0].text;
    expect(text).toContain('Session ID: s1\n');
    expect(text).not.toContain('Second talk');
  });

  it('shows a message instead of downloading an empty conversation', async () => {
    h.getTranscript.mockResolvedValue([{ role: 'system', content: 'internal' }]);
    renderPage();
    fireEvent.click((await rowButtons())[0]);
    await waitFor(() => expect(h.toast.info).toHaveBeenCalledWith('This talk has no saved conversation to export.'));
    expect(downloads).toHaveLength(0);
  });

  it('shows an error and downloads nothing when retrieval fails', async () => {
    h.getTranscript.mockRejectedValue(new Error('500'));
    renderPage();
    fireEvent.click((await rowButtons())[0]);
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith("We couldn't load this transcript. Please try again."));
    expect(downloads).toHaveLength(0);
  });

  it('keeps the trial restriction: no export controls for trial users', async () => {
    h.auth.current = { ...h.auth.current, profile: { id: 'user-a', subscription_plan: 'trial' } };
    renderPage();
    await act(async () => {});
    expect(screen.queryAllByRole('button', { name: 'Download transcript' })).toHaveLength(0);
    expect(h.get).not.toHaveBeenCalled();
  });
});
