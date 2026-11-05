import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Uses the real API client; only Supabase and fetch are replaced.
const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession, signOut: vi.fn() } } }));

import { api } from './api';

describe('api.exportUserData', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    getSession.mockReset().mockResolvedValue({ data: { session: { access_token: 'token-live', user: { id: 'user-live' } } } });
    fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
      return new Response('{"exportVersion":1}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const call = () => fetchMock.mock.calls[0] as [string, RequestInit];

  it('without options (admin export) reads the current session, as before, with a GET and no signal', async () => {
    const { blob } = await api.exportUserData();
    expect(await blob.text()).toBe('{"exportVersion":1}');
    const [url, init] = call();
    expect(url).toMatch(/\/users\/export$/);
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-live');
    expect(init.signal).toBeUndefined();
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it('sends with the pinned token, not whichever session is live, and passes the signal', async () => {
    const controller = new AbortController();
    await api.exportUserData({ accessToken: 'token-pinned', signal: controller.signal });
    const [, init] = call();
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-pinned');
    expect(init.signal).toBe(controller.signal);
    expect(getSession).not.toHaveBeenCalled();
  });

  it('rejects with AbortError when the signal is aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(api.exportUserData({ accessToken: 'token-pinned', signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
});
