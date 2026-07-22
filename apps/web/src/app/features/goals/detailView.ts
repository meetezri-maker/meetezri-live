/**
 * Builds the unified read-only detail view-model for the Goal / Achievement
 * detail modal. Goals and achievements stay separate entities; this only
 * normalizes their fields for display. Only the caller decides which sections
 * to render (a section is shown only when it has data).
 */
import { goalCardView, humanizeGoalCategory } from './goalCardView';
import { TRACKING_METHOD_LABELS, type TrackingMethod } from './tracking';

export const GOAL_REWARD_POINTS = 20;
export const ACHIEVEMENT_REWARD_POINTS = 10;

export interface DetailAdditional {
  label: string;
  value: string;
}

export interface DetailView {
  id: string;
  itemType: 'goal' | 'achievement';
  title: string;
  typeLabel: string;
  category: string | null;
  description: string | null;
  status: string;
  completed: boolean;
  progressPct: number;
  trackingMethodLabel: string;
  trackingUnit: string | null;
  targetValue: number | null;
  currentValue: number | null;
  startDate: string | null;
  targetDate: string | null;
  completedAt: string | null;
  rewardPoints: number;
  rewardAwarded: boolean;
  additional: DetailAdditional[];
  /** Whether this item can have backend check-ins (goals + custom achievements). */
  checkInable: boolean;
}

function strOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

/** Build the detail view for a raw personal_goals record. */
export function buildGoalDetail(raw: Record<string, unknown>): DetailView {
  const g = goalCardView(raw);
  return {
    id: g.id,
    itemType: 'goal',
    title: g.title,
    typeLabel: 'Personal Goal',
    category: g.category || null,
    description: strOrNull(raw.goal_description),
    status: g.status,
    completed: g.completed,
    progressPct: g.progressPct,
    trackingMethodLabel: TRACKING_METHOD_LABELS[g.trackingType],
    trackingUnit: g.isNumeric ? g.trackingUnit || null : null,
    targetValue: g.isNumeric ? g.targetValue : null,
    currentValue: g.isNumeric ? g.currentValue : null,
    startDate: strOrNull(raw.start_date),
    targetDate: strOrNull(raw.target_date),
    completedAt: g.completedAt,
    rewardPoints: GOAL_REWARD_POINTS,
    rewardAwarded: Boolean(raw.reward_awarded),
    additional: [],
    checkInable: true,
  };
}

export interface AchievementDetailInput {
  id: string;
  title: string;
  description?: string;
  category?: string;
  goalCategory?: string;
  progress?: number;
  total?: number;
  unlocked?: boolean;
  trackingType?: TrackingMethod;
  trackingUnit?: string;
  startDate?: string;
  targetDate?: string;
  completedAt?: string;
  rewardAwarded?: boolean;
  whyItMatters?: string;
  targetOutcome?: string;
  notes?: string;
}

/** Build the detail view for an achievement. `isCustom` gates check-in history. */
export function buildAchievementDetail(a: AchievementDetailInput, isCustom: boolean): DetailView {
  const tracking = (a.trackingType ?? 'count') as TrackingMethod;
  const isNumeric = tracking === 'count' || tracking === 'duration' || tracking === 'amount';
  const total = Number(a.total ?? 0);
  const progress = Number(a.progress ?? 0);
  const progressPct =
    tracking === 'manual_milestone'
      ? Math.max(0, Math.min(100, Math.round(progress)))
      : total > 0
        ? Math.min(Math.round((progress / total) * 100), 100)
        : 0;

  const additional: DetailAdditional[] = [];
  if (strOrNull(a.whyItMatters)) additional.push({ label: 'Why this achievement matters', value: a.whyItMatters as string });
  if (strOrNull(a.targetOutcome)) additional.push({ label: 'Expected personal impact', value: a.targetOutcome as string });
  if (strOrNull(a.notes)) additional.push({ label: 'Supporting notes', value: a.notes as string });

  return {
    id: a.id,
    itemType: 'achievement',
    title: a.title,
    typeLabel: 'Personal Achievement',
    category: a.goalCategory || (a.category ? humanizeGoalCategory(a.category) : null),
    description: strOrNull(a.description),
    status: a.unlocked ? 'completed' : progressPct > 0 ? 'active' : 'not_started',
    completed: Boolean(a.unlocked),
    progressPct,
    trackingMethodLabel: TRACKING_METHOD_LABELS[tracking],
    trackingUnit: isNumeric ? a.trackingUnit || null : null,
    targetValue: isNumeric ? total || null : null,
    currentValue: isNumeric ? progress : null,
    startDate: strOrNull(a.startDate),
    targetDate: strOrNull(a.targetDate),
    completedAt: strOrNull(a.completedAt),
    rewardPoints: ACHIEVEMENT_REWARD_POINTS,
    rewardAwarded: Boolean(a.rewardAwarded),
    additional,
    checkInable: isCustom,
  };
}
