import { describe, it, expect, vi, beforeEach } from 'vitest';

const { record, getSession } = vi.hoisted(() => ({
  record: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: { safetyResourceInteractions: { record } },
}));
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession } },
}));

import {
  getResourceInteractions,
  trackResourceInteraction,
  RESOURCE_INTERACTION_SETTLED_EVENT,
} from './resourceTracking';

const sessionFor = (id: string | null) => ({
  data: { session: id ? { user: { id }, access_token: `t-${id}` } : null },
});

const track = (userId: string | null, interaction: 'call' | 'view' = 'call') =>
  trackResourceInteraction('988', '988 Lifeline', 'crisis_line', interaction, undefined, 'normal', userId);

describe('resourceTracking user isolation', () => {
  beforeEach(() => {
    localStorage.clear();
    record.mockReset();
    getSession.mockReset();
  });

  it('stores interactions under the signed-in account and never returns them to another account', async () => {
    getSession.mockResolvedValue(sessionFor('user-a'));
    record.mockResolvedValue({ id: 'srv-1' });

    await track('user-a');

    expect(record).toHaveBeenCalledWith(expect.objectContaining({ resource_id: '988' }), 't-user-a');

    expect(getResourceInteractions('user-a')).toHaveLength(1);
    expect(getResourceInteractions('user-b')).toEqual([]);
    expect(localStorage.getItem('ezri_resource_interactions')).toBeNull();
  });

  it('ignores the legacy unscoped key', () => {
    localStorage.setItem(
      'ezri_resource_interactions',
      JSON.stringify([
        { id: 'interaction_1', resourceId: 'x', resourceName: 'x', resourceType: 'crisis_line', interactionType: 'view', timestamp: '2026-10-20T10:00:00.000Z', userId: 'anonymous' },
      ])
    );
    expect(getResourceInteractions('user-a')).toEqual([]);
  });

  it('keeps signed-out activity in a separate local bucket and never sends it', async () => {
    // Even if a session appears before the write would be built, it must not claim this event.
    getSession.mockResolvedValue(sessionFor('user-a'));

    await track(null);

    expect(record).not.toHaveBeenCalled();
    expect(getResourceInteractions(null)).toEqual([]);
    expect(getResourceInteractions('user-a')).toEqual([]);
    expect(JSON.parse(localStorage.getItem('ezri_resource_interactions:anonymous') ?? '[]')).toHaveLength(1);
  });

  it('marks a write synced with the server id, or failed when the request fails', async () => {
    getSession.mockResolvedValue(sessionFor('user-a'));
    record.mockResolvedValueOnce({ id: 'srv-1' }).mockRejectedValueOnce(new Error('offline'));

    await track('user-a');
    await track('user-a');

    const rows = getResourceInteractions('user-a');
    expect(rows.map((r) => r.syncStatus).sort()).toEqual(['failed', 'synced']);
    expect(rows.find((r) => r.syncStatus === 'synced')?.serverId).toBe('srv-1');
  });

  it('does not send a write under a different account when the session changed after the click', async () => {
    getSession.mockResolvedValue(sessionFor('user-b'));

    await track('user-a');

    expect(record).not.toHaveBeenCalled();
    expect(getResourceInteractions('user-a')[0].syncStatus).toBe('failed');
    expect(getResourceInteractions('user-b')).toEqual([]);
  });

  it('keeps a slow completion in the original account after a switch', async () => {
    let resolveRecord: (v: unknown) => void = () => {};
    getSession.mockResolvedValue(sessionFor('user-a'));
    record.mockReturnValue(new Promise((r) => { resolveRecord = r; }));
    const settled = vi.fn();
    window.addEventListener(RESOURCE_INTERACTION_SETTLED_EVENT, settled);

    const pending = track('user-a');
    await Promise.resolve();
    // user B signs in on this device before A's write completes
    resolveRecord({ id: 'srv-a' });
    await pending;

    window.removeEventListener(RESOURCE_INTERACTION_SETTLED_EVENT, settled);
    expect(getResourceInteractions('user-a')[0]).toMatchObject({ syncStatus: 'synced', serverId: 'srv-a' });
    expect(getResourceInteractions('user-b')).toEqual([]);
    expect((settled.mock.calls[0][0] as CustomEvent).detail).toEqual({ userId: 'user-a' });
  });
});
