import { describe, it, expect } from 'vitest';
import { buildAchievementDetail, buildGoalDetail } from './detailView';

describe('buildGoalDetail', () => {
  const goalRaw = {
    id: 'g1',
    goal_title: 'Read 10 books',
    goal_description: 'Reading habit',
    goal_category: 'personal_growth',
    status: 'active',
    tracking_type: 'count',
    target_value: 10,
    current_value: 3,
    tracking_unit: 'books',
    progress_percentage: 30,
    start_date: '2026-07-01',
    target_date: '2026-09-01',
  };

  it('maps general + progress + reward (20) + dates', () => {
    const v = buildGoalDetail(goalRaw);
    expect(v.itemType).toBe('goal');
    expect(v.typeLabel).toBe('Personal Goal');
    expect(v.title).toBe('Read 10 books');
    expect(v.category).toBe('Personal Growth');
    expect(v.description).toBe('Reading habit');
    expect(v.status).toBe('active');
    expect(v.progressPct).toBe(30);
    expect(v.trackingMethodLabel).toBe('Count');
    expect(v.targetValue).toBe(10);
    expect(v.currentValue).toBe(3);
    expect(v.trackingUnit).toBe('books');
    expect(v.startDate).toBe('2026-07-01');
    expect(v.targetDate).toBe('2026-09-01');
    expect(v.rewardPoints).toBe(20);
    expect(v.checkInable).toBe(true);
    expect(v.additional).toEqual([]);
  });

  it('reflects completion + reward awarded', () => {
    const v = buildGoalDetail({ ...goalRaw, status: 'completed', progress_percentage: 100, current_value: 10, completed_at: '2026-08-01T00:00:00Z', reward_awarded: true });
    expect(v.completed).toBe(true);
    expect(v.completedAt).toBe('2026-08-01T00:00:00Z');
    expect(v.rewardAwarded).toBe(true);
  });

  it('omits target/current/unit for a manual goal', () => {
    const v = buildGoalDetail({ id: 'g2', goal_title: 'Confidence', goal_category: 'mental_emotional', status: 'active', tracking_type: 'manual_milestone', progress_percentage: 50 });
    expect(v.targetValue).toBeNull();
    expect(v.currentValue).toBeNull();
    expect(v.trackingUnit).toBeNull();
    expect(v.trackingMethodLabel).toBe('Manual Milestones');
  });
});

describe('buildAchievementDetail', () => {
  const ach = {
    id: 'a1',
    title: 'Meditate 300 minutes',
    description: 'Calm',
    goalCategory: 'Wellness',
    trackingType: 'duration' as const,
    trackingUnit: 'minutes',
    total: 300,
    progress: 150,
    unlocked: false,
    whyItMatters: 'Peace of mind',
    targetOutcome: 'Less stress',
    notes: 'Morning routine',
  };

  it('maps general + progress + reward (10) + additional info', () => {
    const v = buildAchievementDetail(ach, true);
    expect(v.itemType).toBe('achievement');
    expect(v.typeLabel).toBe('Personal Achievement');
    expect(v.category).toBe('Wellness');
    expect(v.progressPct).toBe(50); // 150/300
    expect(v.trackingMethodLabel).toBe('Duration');
    expect(v.targetValue).toBe(300);
    expect(v.currentValue).toBe(150);
    expect(v.trackingUnit).toBe('minutes');
    expect(v.rewardPoints).toBe(10);
    expect(v.checkInable).toBe(true);
    expect(v.additional).toEqual([
      { label: 'Why this achievement matters', value: 'Peace of mind' },
      { label: 'Expected personal impact', value: 'Less stress' },
      { label: 'Supporting notes', value: 'Morning routine' },
    ]);
  });

  it('only shows additional sections that have data', () => {
    const v = buildAchievementDetail({ id: 'a2', title: 'X', trackingType: 'count', total: 5, progress: 1 }, true);
    expect(v.additional).toEqual([]);
  });

  it('a predefined (non-custom) achievement is not check-inable', () => {
    const v = buildAchievementDetail({ id: '1', title: 'First Steps', trackingType: 'count', total: 1, progress: 1, unlocked: true }, false);
    expect(v.checkInable).toBe(false);
    expect(v.completed).toBe(true);
  });

  it('manual achievement uses stored progress as the milestone percentage', () => {
    const v = buildAchievementDetail({ id: 'a3', title: 'Confidence', trackingType: 'manual_milestone', total: 100, progress: 75 }, true);
    expect(v.progressPct).toBe(75);
    expect(v.targetValue).toBeNull();
  });
});
