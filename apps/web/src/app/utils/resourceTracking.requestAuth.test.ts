import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Uses the real API client and request path; only Supabase and fetch are replaced.
const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession, signOut: vi.fn() } },
}));

import { getResourceInteractions, trackResourceInteraction } from './resourceTracking';

const sessionFor = (id: string) => ({ data: { session: { user: { id }, access_token: `token-${id}` } } });

describe('resource interaction write authentication', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    getSession.mockReset();
    fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: 'srv-1', resource_id: '988', interaction_type: 'call', created_at: '2026-10-20T10:00:00.000Z' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends with the captured account's token even if another account's session is live when the request is built", async () => {
    // First read (the ownership check) sees A; every later read sees B, as if B signed in
    // between the check and the API client building its headers.
    getSession.mockResolvedValueOnce(sessionFor('user-a')).mockResolvedValue(sessionFor('user-b'));

    await trackResourceInteraction('988', '988 Lifeline', 'crisis_line', 'call', undefined, 'normal', 'user-a');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/safety-resource-interactions$/);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-user-a');
    expect(getResourceInteractions('user-a')[0]).toMatchObject({ syncStatus: 'synced', serverId: 'srv-1' });
  });

  it('does not send when the live session already belongs to a different account', async () => {
    getSession.mockResolvedValue(sessionFor('user-b'));

    await trackResourceInteraction('988', '988 Lifeline', 'crisis_line', 'call', undefined, 'normal', 'user-a');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(getResourceInteractions('user-a')[0].syncStatus).toBe('failed');
  });
});
