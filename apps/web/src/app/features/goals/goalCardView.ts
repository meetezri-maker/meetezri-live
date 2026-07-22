/**
 * Pure view/mapping helpers for rendering Personal Goal cards on the combined
 * Goals & Achievements page, and for pre-filling the existing goal form when
 * editing. Goals stay a separate entity (personal_goals) from achievements.
 */
import type { TrackingMethod } from './tracking';

export interface GoalCardView {
  id: string;
  title: string;
  category: string; // humanized label
  rawCategory: string; // snake_case goal_category
  trackingType: TrackingMethod;
  isNumeric: boolean;
  currentValue: number;
  targetValue: number | null;
  trackingUnit: string;
  progressPct: number;
  status: string;
  completed: boolean;
  completedAt: string | null;
}

const NUMERIC: TrackingMethod[] = ['count', 'duration', 'amount'];

function normalizeTracking(v: unknown): TrackingMethod {
  return v === 'count' || v === 'duration' || v === 'amount' || v === 'manual_milestone'
    ? v
    : 'manual_milestone';
}

/** Humanize a snake_case goal_category, e.g. "personal_growth" -> "Personal Growth". */
export function humanizeGoalCategory(raw: string): string {
  if (!raw) return 'Personal';
  return raw
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Clamp any number into 0..100 (integer), treating NaN/Infinity as 0. */
function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Build the display view for a personal_goals API row. */
export function goalCardView(g: Record<string, unknown>): GoalCardView {
  const trackingType = normalizeTracking(g.tracking_type);
  const isNumeric = NUMERIC.includes(trackingType);
  const status = String(g.status ?? 'not_started');
  const rawCategory = String(g.goal_category ?? '');
  const currentValue = Number(g.current_value ?? 0);
  const targetValue = g.target_value == null ? null : Number(g.target_value);

  // Single source of truth for the percentage: for numeric tracking with a
  // positive target, ALWAYS derive it from current/target so the label and the
  // progress bar cannot disagree with a stale stored `progress_percentage`
  // (which the backend only updates on check-in). Zero/negative/absent target is
  // handled safely (no divide-by-zero / NaN / Infinity). Manual-milestone goals
  // fall back to the stored percentage (which IS the milestone value).
  const progressPct =
    isNumeric && targetValue != null && targetValue > 0
      ? clampPct((Math.max(0, currentValue) / targetValue) * 100)
      : clampPct(Number(g.progress_percentage) || 0);

  return {
    id: String(g.id),
    title: String(g.goal_title ?? 'Personal Goal'),
    category: humanizeGoalCategory(rawCategory),
    rawCategory,
    trackingType,
    isNumeric,
    currentValue,
    targetValue,
    trackingUnit: (g.tracking_unit as string) || '',
    progressPct,
    status,
    completed: status === 'completed',
    completedAt: (g.completed_at as string) || null,
  };
}

/** Reverse map: goal_category (snake) -> the create/edit form's category enum. */
export function goalCategoryToFormCategory(
  raw: string
): 'Mental' | 'Emotional' | 'Productivity' | 'Relationships' | 'Wellness' {
  switch (raw) {
    case 'mental_emotional':
      return 'Mental';
    case 'social_relationships':
      return 'Relationships';
    case 'daily_productivity':
      return 'Productivity';
    case 'personal_growth':
    case 'wellness':
    default:
      return 'Wellness';
  }
}

/** Reverse map: priority_level (low/medium/high) -> the form's priority enum. */
export function goalPriorityToFormPriority(raw: unknown): 'Low' | 'Medium' | 'High' {
  if (raw === 'high') return 'High';
  if (raw === 'low') return 'Low';
  return 'Medium';
}
