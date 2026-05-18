/**
 * EZRI — RESOURCE USAGE TRACKING
 * Track user interactions with safety resources; persisted via API → Postgres for analytics.
 */

import { api } from '@/lib/api';

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

const LOCAL_KEY = 'ezri_resource_interactions';

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
 */
export function trackResourceInteraction(
  resourceId: string,
  resourceName: string,
  resourceType: ResourceInteraction['resourceType'],
  interactionType: ResourceInteraction['interactionType'],
  contextSessionId?: string,
  safetyState?: string
): void {
  const interaction: ResourceInteraction = {
    id: `interaction_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    resourceId,
    resourceName,
    resourceType,
    interactionType,
    timestamp: new Date().toISOString(),
    sessionId: contextSessionId,
    safetyState,
    userId: getCurrentUserId(),
  };

  const stored = localStorage.getItem(LOCAL_KEY);
  const interactions: ResourceInteraction[] = stored ? JSON.parse(stored) : [];
  interactions.unshift(interaction);
  const trimmed = interactions.slice(0, 500);
  localStorage.setItem(LOCAL_KEY, JSON.stringify(trimmed));

  void api.safetyResourceInteractions
    .record({
      resource_id: resourceId,
      resource_name: resourceName,
      resource_type: resourceType,
      interaction_type: interactionType,
      context_session_id: contextSessionId,
      safety_state: safetyState,
    })
    .catch(() => {
      /* offline / session edge cases — kept in localStorage */
    });
}

export function getResourceInteractions(): ResourceInteraction[] {
  const stored = localStorage.getItem(LOCAL_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function getResourceInteractionHistory(resourceId: string): ResourceInteraction[] {
  return getResourceInteractions().filter((i) => i.resourceId === resourceId);
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

export function getResourceAnalytics(resourceId: string): ResourceAnalytics {
  return getResourceAnalyticsFromInteractions(resourceId, getResourceInteractionHistory(resourceId));
}

export function getAllResourceAnalytics(
  interactions: InteractionSet = getResourceInteractions()
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
  interactions: InteractionSet = getResourceInteractions()
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
  interactions: InteractionSet = getResourceInteractions()
): number {
  const analytics = getResourceAnalyticsFromInteractions(resourceId, interactions);

  if (analytics.totalViews === 0) return 0;

  const ctr = (analytics.totalClicks / analytics.totalViews) * 100;
  const ctrWeight = 0.7;
  const volumeWeight = 0.3;
  const volumeScore = Math.min((analytics.totalClicks / 50) * 100, 100);
  const score = ctr * ctrWeight + volumeScore * volumeWeight;

  return Math.round(Math.min(score, 100));
}

export function getInteractionsBySafetyState(
  interactions: InteractionSet = getResourceInteractions()
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
  interactions: InteractionSet = getResourceInteractions()
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
  interactions: InteractionSet = getResourceInteractions()
): ResourceInteraction[] {
  return interactions.filter((interaction) => {
    const date = new Date(interaction.timestamp);
    return date >= startDate && date <= endDate;
  });
}

export function exportResourceAnalytics(
  interactions: InteractionSet = getResourceInteractions()
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

export function cleanupOldInteractions(): void {
  const interactions = getResourceInteractions();
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const filtered = interactions.filter((interaction) => new Date(interaction.timestamp) >= ninetyDaysAgo);

  localStorage.setItem(LOCAL_KEY, JSON.stringify(filtered));
}

function getCurrentUserId(): string {
  try {
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
      const user = JSON.parse(currentUser) as { id?: string };
      return user.id || 'anonymous';
    }
  } catch {
    /* ignore */
  }
  return 'anonymous';
}
