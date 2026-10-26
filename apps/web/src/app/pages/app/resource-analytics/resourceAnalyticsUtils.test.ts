import { describe, it, expect } from 'vitest';
import type { ResourceInteraction } from '@/app/utils/resourceTracking';
import { selectResourceAnalyticsInteractions } from './resourceAnalyticsUtils';

const ix = (over: Partial<ResourceInteraction>): ResourceInteraction => ({
  id: 'x',
  resourceId: '988',
  resourceName: '988 Lifeline',
  resourceType: 'crisis_line',
  interactionType: 'call',
  timestamp: '2026-10-20T10:00:00.000Z',
  ...over,
});

describe('selectResourceAnalyticsInteractions', () => {
  it('uses only server rows when the server request succeeds, whatever the local sync state', () => {
    const interactions = selectResourceAnalyticsInteractions({
      serverStatus: 'success',
      server: [ix({ id: 'srv-1' })],
      local: [
        ix({ id: 'interaction_1', syncStatus: 'synced', serverId: 'srv-1' }),
        // response lost: the server saved it (srv-1) but the browser recorded a failure
        ix({ id: 'interaction_2', syncStatus: 'failed' }),
        // orphaned: the tab closed before the write settled
        ix({ id: 'interaction_3', syncStatus: 'pending' }),
      ],
    });
    expect(interactions.map((i) => i.id)).toEqual(['srv-1']);
  });

  it('keeps two genuine clicks on the same resource as two events', () => {
    const interactions = selectResourceAnalyticsInteractions({
      serverStatus: 'success',
      server: [
        ix({ id: 'srv-1', timestamp: '2026-10-20T10:00:00.000Z' }),
        ix({ id: 'srv-2', timestamp: '2026-10-20T10:00:01.000Z' }),
      ],
      local: [],
    });
    expect(interactions).toHaveLength(2);
  });

  it('does not revive local history when the server succeeds with no rows', () => {
    const interactions = selectResourceAnalyticsInteractions({
      serverStatus: 'success',
      server: [],
      local: [ix({ id: 'interaction_1', syncStatus: 'failed' }), ix({ id: 'interaction_2', syncStatus: 'pending' })],
    });
    expect(interactions).toEqual([]);
  });

  it('falls back to this account’s local rows only when the server request fails', () => {
    const local = [ix({ id: 'interaction_1', syncStatus: 'synced' }), ix({ id: 'interaction_2', syncStatus: 'failed' })];
    const interactions = selectResourceAnalyticsInteractions({ serverStatus: 'error', server: [], local });
    expect(interactions).toHaveLength(2);
  });

  it('shows nothing while the server request is still pending', () => {
    const interactions = selectResourceAnalyticsInteractions({
      serverStatus: 'pending',
      server: [],
      local: [ix({ id: 'interaction_1', syncStatus: 'failed' })],
    });
    expect(interactions).toEqual([]);
  });
});
