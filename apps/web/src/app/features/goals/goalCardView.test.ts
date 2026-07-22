import { describe, it, expect } from 'vitest';
import {
  goalCardView,
  goalCategoryToFormCategory,
  goalPriorityToFormPriority,
  humanizeGoalCategory,
} from './goalCardView';

const smokeTestGoal = {
  id: 'f9556627-d5c4-4cd6-bbde-a759d4224222',
  goal_title: 'Smoke Test Goal',
  goal_category: 'personal_growth',
  status: 'not_started',
  tracking_type: 'count',
  target_value: 10,
  current_value: 1,
  progress_percentage: 10,
  tracking_unit: 'workouts',
};

describe('goalCardView — goal card display fields (Task fix)', () => {
  it('exposes every required card field for a numeric goal', () => {
    const g = goalCardView(smokeTestGoal);
    expect(g.id).toBe('f9556627-d5c4-4cd6-bbde-a759d4224222');
    expect(g.title).toBe('Smoke Test Goal');
    expect(g.category).toBe('Personal Growth'); // humanized
    expect(g.status).toBe('not_started');
    expect(g.currentValue).toBe(1);
    expect(g.targetValue).toBe(10);
    expect(g.trackingUnit).toBe('workouts');
    expect(g.trackingType).toBe('count');
    expect(g.isNumeric).toBe(true);
    expect(g.progressPct).toBe(10);
    expect(g.completed).toBe(false);
  });

  it('marks a completed goal correctly', () => {
    const g = goalCardView({ ...smokeTestGoal, status: 'completed', progress_percentage: 100, current_value: 10, completed_at: '2026-07-22T00:00:00Z' });
    expect(g.completed).toBe(true);
    expect(g.progressPct).toBe(100);
    expect(g.completedAt).toBe('2026-07-22T00:00:00Z');
  });

  it('handles a manual-milestone goal (no numeric target)', () => {
    const g = goalCardView({ id: 'x', goal_title: 'Confidence', goal_category: 'mental_emotional', status: 'active', tracking_type: 'manual_milestone', progress_percentage: 50 });
    expect(g.isNumeric).toBe(false);
    expect(g.targetValue).toBeNull();
    expect(g.progressPct).toBe(50);
    expect(g.category).toBe('Mental Emotional');
  });

  it('clamps progress to 0..100', () => {
    // Numeric goal well over target -> 100 (not the stale stored value).
    expect(goalCardView({ ...smokeTestGoal, current_value: 999, target_value: 10 }).progressPct).toBe(100);
  });
});

describe('progressPct is DERIVED from current/target (not the stale stored field)', () => {
  const base = { id: 'g', goal_title: 'G', goal_category: 'personal_growth', status: 'active', tracking_type: 'count' };

  it('current 1 / target 1 renders 100%', () => {
    expect(goalCardView({ ...base, current_value: 1, target_value: 1, progress_percentage: 10 }).progressPct).toBe(100);
  });

  it('current 1 / target 10 renders 10%', () => {
    expect(goalCardView({ ...base, current_value: 1, target_value: 10, progress_percentage: 99 }).progressPct).toBe(10);
  });

  it('recalculates after editing target 10 -> 1 even if stored progress is stale (10)', () => {
    // Simulates the exact reported bug: stored progress_percentage is stale at 10
    // but current(1)/target(1) must render 100%.
    const beforeEdit = goalCardView({ ...base, current_value: 1, target_value: 10, progress_percentage: 10 });
    expect(beforeEdit.progressPct).toBe(10);
    const afterEdit = goalCardView({ ...base, current_value: 1, target_value: 1, progress_percentage: 10 });
    expect(afterEdit.progressPct).toBe(100);
  });

  it('clamps at 100% when current exceeds target', () => {
    expect(goalCardView({ ...base, current_value: 50, target_value: 10, progress_percentage: 0 }).progressPct).toBe(100);
  });

  it('a zero target does not produce NaN or Infinity', () => {
    const v = goalCardView({ ...base, current_value: 5, target_value: 0, progress_percentage: 42 }).progressPct;
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBe(42); // falls back to the (clamped) stored value, no divide-by-zero
  });

  it('a negative target does not produce NaN or Infinity', () => {
    const v = goalCardView({ ...base, current_value: 5, target_value: -3, progress_percentage: 0 }).progressPct;
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBe(0);
  });
});

describe('edit pre-fill reverse maps', () => {
  it('maps goal_category back to the form category enum', () => {
    expect(goalCategoryToFormCategory('mental_emotional')).toBe('Mental');
    expect(goalCategoryToFormCategory('social_relationships')).toBe('Relationships');
    expect(goalCategoryToFormCategory('daily_productivity')).toBe('Productivity');
    expect(goalCategoryToFormCategory('wellness')).toBe('Wellness');
    expect(goalCategoryToFormCategory('personal_growth')).toBe('Wellness');
  });

  it('maps priority_level back to the form priority enum', () => {
    expect(goalPriorityToFormPriority('high')).toBe('High');
    expect(goalPriorityToFormPriority('low')).toBe('Low');
    expect(goalPriorityToFormPriority('medium')).toBe('Medium');
    expect(goalPriorityToFormPriority(undefined)).toBe('Medium');
  });

  it('humanizes categories', () => {
    expect(humanizeGoalCategory('personal_growth')).toBe('Personal Growth');
    expect(humanizeGoalCategory('')).toBe('Personal');
  });
});
