/**
 * EZRI — RESOURCE USAGE TRACKING
 * Track user interactions with safety resources for analytics and effectiveness
 */

export interface ResourceInteraction {
  id: string;
  resourceId: string;
  resourceName: string;
  resourceType: 'crisis_line' | 'text_line' | 'emergency' | 'support_group' | 'trusted_contact';
  interactionType: 'view' | 'call' | 'text' | 'visit' | 'share';
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
  averageTimeToInteract?: number; // milliseconds from view to click
}

/**
 * Track a resource interaction
 */
export function trackResourceInteraction(
  resourceId: string,
  resourceName: string,
  resourceType: 'crisis_line' | 'text_line' | 'emergency' | 'support_group' | 'trusted_contact',
  interactionType: 'view' | 'call' | 'text' | 'visit' | 'share',
  sessionId?: string,
  safetyState?: string
): void {
  const interaction: ResourceInteraction = {
    id: `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    resourceId,
    resourceName,
    resourceType,
    interactionType,
    timestamp: new Date().toISOString(),
    sessionId,
    safetyState,
    userId: getCurrentUserId()
  };

  // Save to localStorage
  const stored = localStorage.getItem('ezri_resource_interactions');
  const interactions: ResourceInteraction[] = stored ? JSON.parse(stored) : [];
  interactions.unshift(interaction);

  // Keep last 500 interactions
  const trimmed = interactions.slice(0, 500);
  localStorage.setItem('ezri_resource_interactions', JSON.stringify(trimmed));

  // Log to console (in production, send to analytics service)
  console.log('📊 Resource Interaction:', interaction);
}

/**
 * Get all resource interactions
 */
export function getResourceInteractions(): ResourceInteraction[] {
  const stored = localStorage.getItem('ezri_resource_interactions');
  return stored ? JSON.parse(stored) : [];
}

/**
 * Get interactions for a specific resource
 */
export function getResourceInteractionHistory(resourceId: string): ResourceInteraction[] {
  const allInteractions = getResourceInteractions();
  return allInteractions.filter(i => i.resourceId === resourceId);
}

/**
 * Get analytics for a specific resource
 */
export function getResourceAnalytics(resourceId: string): ResourceAnalytics {
  const interactions = getResourceInteractionHistory(resourceId);

  const analytics: ResourceAnalytics = {
    resourceId,
    totalViews: interactions.filter(i => i.interactionType === 'view').length,
    totalClicks: interactions.filter(i => ['call', 'text', 'visit'].includes(i.interactionType)).length,
    totalCalls: interactions.filter(i => i.interactionType === 'call').length,
    totalTexts: interactions.filter(i => i.interactionType === 'text').length,
    totalVisits: interactions.filter(i => i.interactionType === 'visit').length,
  };

  if (interactions.length > 0) {
    analytics.firstInteraction = interactions[interactions.length - 1].timestamp;
    analytics.lastInteraction = interactions[0].timestamp;
  }

  return analytics;
}

/**
 * Get aggregate analytics for all resources
 */
export function getAllResourceAnalytics(): Record<string, ResourceAnalytics> {
  const interactions = getResourceInteractions();
  const resourceIds = [...new Set(interactions.map(i => i.resourceId))];

  const analytics: Record<string, ResourceAnalytics> = {};
  resourceIds.forEach(id => {
    analytics[id] = getResourceAnalytics(id);
  });

  return analytics;
}

/**
 * Get most used resources
 */
export function getMostUsedResources(limit: number = 5): Array<ResourceAnalytics & { rank: number }> {
  const allAnalytics = getAllResourceAnalytics();
  const sorted = Object.values(allAnalytics)
    .sort((a, b) => b.totalClicks - a.totalClicks)
    .slice(0, limit)
    .map((analytics, index) => ({
      ...analytics,
      rank: index + 1
    }));

  return sorted;
}

/**
 * Get resource effectiveness score (0-100)
 * Based on: views, clicks, and click-through rate
 */
export function getResourceEffectivenessScore(resourceId: string): number {
  const analytics = getResourceAnalytics(resourceId);

  if (analytics.totalViews === 0) return 0;

  // Click-through rate
  const ctr = (analytics.totalClicks / analytics.totalViews) * 100;

  // Weight factors
  const ctrWeight = 0.7; // 70% based on CTR
  const volumeWeight = 0.3; // 30% based on absolute clicks

  // Normalize volume score (cap at 50 clicks = 100 score)
  const volumeScore = Math.min((analytics.totalClicks / 50) * 100, 100);

  // Calculate final score
  const score = (ctr * ctrWeight) + (volumeScore * volumeWeight);

  return Math.round(Math.min(score, 100));
}

/**
 * Get interactions by safety state
 */
export function getInteractionsBySafetyState(): Record<string, number> {
  const interactions = getResourceInteractions();
  const byState: Record<string, number> = {};

  interactions.forEach(interaction => {
    if (interaction.safetyState) {
      byState[interaction.safetyState] = (byState[interaction.safetyState] || 0) + 1;
    }
  });

  return byState;
}

/**
 * Get interactions by resource type
 */
export function getInteractionsByResourceType(): Record<string, number> {
  const interactions = getResourceInteractions();
  const byType: Record<string, number> = {};

  interactions.forEach(interaction => {
    byType[interaction.resourceType] = (byType[interaction.resourceType] || 0) + 1;
  });

  return byType;
}

/**
 * Get interactions by time period
 */
export function getInteractionsByTimePeriod(
  startDate: Date,
  endDate: Date
): ResourceInteraction[] {
  const interactions = getResourceInteractions();
  return interactions.filter(interaction => {
    const date = new Date(interaction.timestamp);
    return date >= startDate && date <= endDate;
  });
}

/**
 * Export analytics data (for admin dashboard or reports)
 */
export function exportResourceAnalytics(): string {
  const analytics = getAllResourceAnalytics();
  const interactions = getResourceInteractions();

  const exportData = {
    exportDate: new Date().toISOString(),
    totalInteractions: interactions.length,
    analytics,
    bySafetyState: getInteractionsBySafetyState(),
    byResourceType: getInteractionsByResourceType(),
    mostUsed: getMostUsedResources(10)
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Clear old interaction data (keep last 90 days)
 */
export function cleanupOldInteractions(): void {
  const interactions = getResourceInteractions();
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const filtered = interactions.filter(interaction => {
    const date = new Date(interaction.timestamp);
    return date >= ninetyDaysAgo;
  });

  localStorage.setItem('ezri_resource_interactions', JSON.stringify(filtered));
  console.log(`🧹 Cleaned up ${interactions.length - filtered.length} old interactions`);
}

/**
 * Get current user ID (helper function)
 */
function getCurrentUserId(): string {
  try {
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
      const user = JSON.parse(currentUser);
      return user.id || 'anonymous';
    }
  } catch (e) {
    console.error('Error getting user ID:', e);
  }
  return 'anonymous';
}
