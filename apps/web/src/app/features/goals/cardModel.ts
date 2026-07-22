/**
 * Unified frontend view model for the combined Goals & Achievements page.
 *
 * Goals and Achievements remain SEPARATE database entities (personal_goals vs
 * custom_achievements). This module only NORMALIZES their API responses into a
 * shared card shape for display + filtering. It performs no writes and no
 * cross-entity synchronization.
 */
import type { TrackingMethod } from './tracking';

export type GamificationItemType = 'goal' | 'achievement';

export interface GamificationCardItem {
  id: string;
  itemType: GamificationItemType;
  title: string;
  description?: string;
  category?: string;
  status: string;
  trackingType: TrackingMethod;
  targetValue?: number;
  currentValue?: number;
  trackingUnit?: string;
  progressPercentage: number;
  rewardPoints: number;
  startDate?: string;
  targetDate?: string;
  completedAt?: string;
  latestCheckInDate?: string;
}

/** Reward amounts are backend-controlled; these are for informational display only. */
export const GOAL_REWARD_POINTS = 20;
export const ACHIEVEMENT_REWARD_POINTS = 10;

function normalizeTracking(value: unknown): TrackingMethod {
  return value === 'count' || value === 'duration' || value === 'amount' || value === 'manual_milestone'
    ? value
    : 'manual_milestone';
}

function num(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Map a personal_goals API row into the shared card shape. */
export function goalToCard(goal: Record<string, unknown>): GamificationCardItem {
  return {
    id: String(goal.id),
    itemType: 'goal',
    title: String(goal.goal_title ?? ''),
    description: (goal.goal_description as string) || undefined,
    category: (goal.goal_category as string) || undefined,
    status: String(goal.status ?? 'not_started'),
    trackingType: normalizeTracking(goal.tracking_type),
    targetValue: num(goal.target_value),
    currentValue: num(goal.current_value),
    trackingUnit: (goal.tracking_unit as string) || undefined,
    progressPercentage: Math.max(0, Math.min(100, Math.round(num(goal.progress_percentage) ?? 0))),
    rewardPoints: GOAL_REWARD_POINTS,
    startDate: (goal.start_date as string) || undefined,
    targetDate: (goal.target_date as string) || undefined,
    completedAt: (goal.completed_at as string) || undefined,
    latestCheckInDate: (goal.last_check_in_date as string) || undefined,
  };
}

/** Map a custom_achievements API row into the shared card shape. */
export function achievementToCard(a: Record<string, unknown>): GamificationCardItem {
  const total = num(a.total) ?? 1;
  const progress = num(a.progress) ?? 0;
  const trackingType = normalizeTracking(a.tracking_type);
  // Manual achievements store the milestone percentage directly in `progress`.
  const progressPercentage =
    trackingType === 'manual_milestone'
      ? Math.max(0, Math.min(100, Math.round(progress)))
      : total > 0
        ? Math.min(Math.round((progress / total) * 100), 100)
        : 0;
  return {
    id: String(a.id),
    itemType: 'achievement',
    title: String(a.title ?? ''),
    description: (a.description as string) || undefined,
    category: (a.category as string) || undefined,
    status: a.unlocked ? 'completed' : progressPercentage > 0 ? 'active' : 'not_started',
    trackingType,
    targetValue: trackingType === 'manual_milestone' ? undefined : total,
    currentValue: trackingType === 'manual_milestone' ? undefined : progress,
    trackingUnit: (a.tracking_unit as string) || undefined,
    progressPercentage,
    rewardPoints: ACHIEVEMENT_REWARD_POINTS,
    startDate: (a.start_date as string) || undefined,
    targetDate: (a.target_date as string) || undefined,
    completedAt: (a.completed_at as string) || undefined,
    latestCheckInDate: (a.last_check_in_date as string) || undefined,
  };
}

/** Merge normalized goals + achievements for the combined page. */
export function mergeCards(
  goals: Array<Record<string, unknown>>,
  achievements: Array<Record<string, unknown>>
): GamificationCardItem[] {
  return [...goals.map(goalToCard), ...achievements.map(achievementToCard)];
}

export type CardFilter = 'all' | 'goals' | 'achievements';

/** Preserve the existing All / Goals / Achievements filtering. */
export function filterCards(cards: GamificationCardItem[], filter: CardFilter): GamificationCardItem[] {
  if (filter === 'goals') return cards.filter((c) => c.itemType === 'goal');
  if (filter === 'achievements') return cards.filter((c) => c.itemType === 'achievement');
  return cards;
}
