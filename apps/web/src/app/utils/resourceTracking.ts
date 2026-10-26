/**
 * EZRI — RESOURCE USAGE TRACKING
 * Track user interactions with safety resources; persisted via API → Postgres for analytics.
 */

import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';

/** Local write state: `synced` rows are on the server, `failed` rows exist only in this browser. */
export type ResourceInteractionSyncStatus = 'pending' | 'synced' | 'failed';

export interface ResourceInteraction {
  id: string;
  resourceId: string;
  resourceName: string;
  resourceType:
    | 'crisis_line'
    | 'text_line'
    | 'emergency'
    | 'support_group'
    | 'trusted_contact';
  interactionType: 'view' | 'call' | 'text' | 'visit' | 'share' | 'copy';
  timestamp: string;
  sessionId?: string;
  safetyState?: string;
  userId?: string;
  syncStatus?: ResourceInteractionSyncStatus;
  /** Server row id once the POST succeeded. */
  serverId?: string;
}

export interface ResourceAnalytics {
  resourceId: string;
  totalViews: number;
  totalClicks: number;
  totalCalls: number;
  totalTexts: number;
  totalVisits: number;
  firstInteraction?: string;
  lastInteraction?: string;
  averageTimeToInteract?: number;
}

type InteractionSet = ResourceInteraction[];

/**
 * Per-account local mirror. The legacy unscoped key (`ezri_resource_interactions`) is never read:
 * its records carry no reliable owner, so they cannot be attributed to whoever is signed in.
 */
const LOCAL_KEY_PREFIX = 'ezri_resource_interactions:';
const ANONYMOUS_BUCKET = 'anonymous';
const MAX_LOCAL_INTERACTIONS = 500;

/** Fired on `window` when a tracked write settles; `detail.userId` is the account it belongs to. */
export const RESOURCE_INTERACTION_SETTLED_EVENT = 'ezri:resource-interaction-settled';

function localKeyFor(userId: string | null | undefined): string {
  return `${LOCAL_KEY_PREFIX}${userId || ANONYMOUS_BUCKET}`;
}

function readLocal(key: string): ResourceInteraction[] {
  try {
    const stored = localStorage.getItem(key);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? (parsed as ResourceInteraction[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(key: string, interactions: ResourceInteraction[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(interactions.slice(0, MAX_LOCAL_INTERACTIONS)));
  } catch {
    /* storage full / unavailable — the server copy is still attempted */
  }
}

function updateLocal(key: string, id: string, patch: Partial<ResourceInteraction>): void {
  writeLocal(
    key,
    readLocal(key).map((i) => (i.id === id ? { ...i, ...patch } : i))
  );
}

/** Map REST rows from `GET /safety-resource-interactions` into client analytics shape (snake_case → camelCase). */
export function mapServerRowsToInteractions(
  rows: Array<Record<string, unknown>>
): ResourceInteraction[] {
  return rows.map((r) => {
    const created = r.created_at;
    const ts =
      typeof created === 'string'
        ? created
        : created instanceof Date
          ? created.toISOString()
          : new Date(String(created)).toISOString();

    return {
      id: String(r.id),
      resourceId: String(r.resource_id),
      resourceName: String(r.resource_name ?? ''),
      resourceType: r.resource_type as ResourceInteraction['resourceType'],
      interactionType: r.interaction_type as ResourceInteraction['interactionType'],
      timestamp: ts,
      sessionId: r.context_session_id ? String(r.context_session_id) : undefined,
      safetyState: r.safety_state ? String(r.safety_state) : undefined,
      userId: undefined,
    };
  });
}

/**
 * Track a resource interaction (local mirror + persisted to database when authenticated).
 *
 * `userId` is the signed-in account at the moment of the interaction (null when signed out).
 * It is captured here, so a write that completes after an account switch still lands in the
 * original account's local bucket and is never sent with another account's session.
 * Returns a promise that settles once the server write has finished (callers may ignore it).
 */
export function trackResourceInteraction(
  resourceId: string,
  resourceName: string,
  resourceType: ResourceInteraction['resourceType'],
  interactionType: ResourceInteraction['interactionType'],
  contextSessionId?: string,
  safetyState?: string,
  userId?: string | null
): Promise<void> {
  const ownerId = userId || null;
  const key = localKeyFor(ownerId);
  const interaction: ResourceInteraction = {
    id: `interaction_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    resourceId,
    resourceName,
    resourceType,
    interactionType,
    timestamp: new Date().toISOString(),
    sessionId: contextSessionId,
    safetyState,
    userId: ownerId ?? ANONYMOUS_BUCKET,
    syncStatus: 'pending',
  };

  writeLocal(key, [interaction, ...readLocal(key)]);

  const settle = (patch: Partial<ResourceInteraction>) => {
    updateLocal(key, interaction.id, patch);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(RESOURCE_INTERACTION_SETTLED_EVENT, { detail: { userId: ownerId } })
      );
    }
  };

  return (async () => {
    try {
      // Signed-out activity stays in this browser only: the endpoint requires a session, and
      // sending without a pinned token would let a session that appears later claim it.
      if (!ownerId) {
        settle({ syncStatus: 'failed' });
        return;
      }
      // Resolve the session once and send with that exact token, so the request is
      // authenticated as the owner even if another account signs in before it is built.
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session?.access_token || session.user?.id !== ownerId) {
        settle({ syncStatus: 'failed' });
        return;
      }
      const created = (await api.safetyResourceInteractions.record(
        {
          resource_id: resourceId,
          resource_name: resourceName,
          resource_type: resourceType,
          interaction_type: interactionType,
          context_session_id: contextSessionId,
          safety_state: safetyState,
        },
        session.access_token
      )) as { id?: unknown } | null;
      settle({
        syncStatus: 'synced',
        serverId: created && typeof created.id === 'string' ? created.id : undefined,
      });
    } catch {
      /* offline / session edge cases — kept in localStorage as an unsynced event */
      settle({ syncStatus: 'failed' });
    }
  })();
}

/** Local interactions recorded for this account. Signed-out or unknown callers get none. */
export function getResourceInteractions(userId: string | null | undefined): ResourceInteraction[] {
  if (!userId) return [];
  return readLocal(localKeyFor(userId)).filter((i) => i.userId === userId);
}

export function getResourceInteractionHistory(
  userId: string | null | undefined,
  resourceId: string
): ResourceInteraction[] {
  return getResourceInteractions(userId).filter((i) => i.resourceId === resourceId);
}

function engagementInteractions(history: InteractionSet): ResourceInteraction[] {
  return history.filter((i) =>
    ['call', 'text', 'visit', 'share', 'copy'].includes(i.interactionType)
  );
}

function getResourceAnalyticsFromInteractions(
  resourceId: string,
  interactions: InteractionSet
): ResourceAnalytics {
  const history = interactions.filter((i) => i.resourceId === resourceId);

  const engaged = engagementInteractions(history);

  const analytics: ResourceAnalytics = {
    resourceId,
    totalViews: history.filter((i) => i.interactionType === 'view').length,
    totalClicks: engaged.length,
    totalCalls: history.filter((i) => i.interactionType === 'call').length,
    totalTexts: history.filter((i) => i.interactionType === 'text').length,
    totalVisits: history.filter((i) => i.interactionType === 'visit').length,
  };

  if (history.length > 0) {
    const sorted = [...history].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    analytics.firstInteraction = sorted[0].timestamp;
    analytics.lastInteraction = sorted[sorted.length - 1].timestamp;
  }

  return analytics;
}

export function getResourceAnalytics(
  userId: string | null | undefined,
  resourceId: string
): ResourceAnalytics {
  return getResourceAnalyticsFromInteractions(
    resourceId,
    getResourceInteractionHistory(userId, resourceId)
  );
}

export function getAllResourceAnalytics(
  interactions: InteractionSet
): Record<string, ResourceAnalytics> {
  const resourceIds = [...new Set(interactions.map((i) => i.resourceId))];
  const analytics: Record<string, ResourceAnalytics> = {};
  resourceIds.forEach((id) => {
    analytics[id] = getResourceAnalyticsFromInteractions(id, interactions);
  });
  return analytics;
}

/** Sort by views + engagements (totalClicks is non-view actions: call, text, visit, share, copy). */
export function getMostUsedResources(
  limit: number = 5,
  interactions: InteractionSet
): Array<ResourceAnalytics & { rank: number }> {
  const allAnalytics = getAllResourceAnalytics(interactions);
  const sorted = Object.values(allAnalytics)
    .map((a) => ({ ...a, _score: a.totalViews + a.totalClicks }))
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score: _discardScore, ...analytics }, index) => ({
      ...analytics,
      rank: index + 1,
    }));

  return sorted;
}

export function getResourceEffectivenessScore(
  resourceId: string,
  interactions: InteractionSet
): number {
  const analytics = getResourceAnalyticsFromInteractions(resourceId, interactions);
  const totalEvents = analytics.totalViews + analytics.totalClicks;

  if (totalEvents === 0) return 0;

  if (analytics.totalViews === 0) {
    const engagementScore = Math.min((analytics.totalClicks / 10) * 100, 85);
    return Math.round(Math.max(engagementScore, 35));
  }

  const ctr = (analytics.totalClicks / analytics.totalViews) * 100;
  const ctrWeight = 0.7;
  const volumeWeight = 0.3;
  const volumeScore = Math.min((analytics.totalClicks / 50) * 100, 100);
  const score = ctr * ctrWeight + volumeScore * volumeWeight;

  return Math.round(Math.min(score, 100));
}

export function getInteractionsBySafetyState(
  interactions: InteractionSet
): Record<string, number> {
  const byState: Record<string, number> = {};
  interactions.forEach((interaction) => {
    if (interaction.safetyState) {
      byState[interaction.safetyState] = (byState[interaction.safetyState] || 0) + 1;
    }
  });
  return byState;
}

export function getInteractionsByResourceType(
  interactions: InteractionSet
): Record<string, number> {
  const byType: Record<string, number> = {};
  interactions.forEach((interaction) => {
    byType[interaction.resourceType] = (byType[interaction.resourceType] || 0) + 1;
  });
  return byType;
}

export function getInteractionsByTimePeriod(
  startDate: Date,
  endDate: Date,
  interactions: InteractionSet
): ResourceInteraction[] {
  return interactions.filter((interaction) => {
    const date = new Date(interaction.timestamp);
    return date >= startDate && date <= endDate;
  });
}

export function exportResourceAnalytics(
  interactions: InteractionSet
): string {
  const analytics = getAllResourceAnalytics(interactions);
  return JSON.stringify(
    {
      exportDate: new Date().toISOString(),
      totalInteractions: interactions.length,
      analytics,
      bySafetyState: getInteractionsBySafetyState(interactions),
      byResourceType: getInteractionsByResourceType(interactions),
      mostUsed: getMostUsedResources(10, interactions),
    },
    null,
    2
  );
}

export function cleanupOldInteractions(userId: string | null | undefined): void {
  if (!userId) return;
  const key = localKeyFor(userId);
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const filtered = readLocal(key).filter((interaction) => new Date(interaction.timestamp) >= ninetyDaysAgo);

  writeLocal(key, filtered);
}
