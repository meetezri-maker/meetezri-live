import { describe, it, expect } from 'vitest';
import {
  ACHIEVEMENT_REWARD_POINTS,
  GOAL_REWARD_POINTS,
  achievementToCard,
  filterCards,
  goalToCard,
  mergeCards,
} from './cardModel';

describe('cardModel — unified view model (entities stay separate)', () => {
  const goalRow = {
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
  };
  const achRow = {
    id: 'a1',
    title: 'Meditate 300 minutes',
    description: 'Calm',
    category: 'personal',
    tracking_type: 'duration',
    total: 300,
    progress: 150,
    unlocked: false,
  };

  it('maps a goal row to a goal card', () => {
    const c = goalToCard(goalRow);
    expect(c.itemType).toBe('goal');
    expect(c.title).toBe('Read 10 books');
    expect(c.trackingType).toBe('count');
    expect(c.targetValue).toBe(10);
    expect(c.currentValue).toBe(3);
    expect(c.progressPercentage).toBe(30);
    expect(c.rewardPoints).toBe(GOAL_REWARD_POINTS);
  });

  it('maps an achievement row to an achievement card and derives %', () => {
    const c = achievementToCard(achRow);
    expect(c.itemType).toBe('achievement');
    expect(c.trackingType).toBe('duration');
    expect(c.progressPercentage).toBe(50); // 150 / 300
    expect(c.rewardPoints).toBe(ACHIEVEMENT_REWARD_POINTS);
  });

  it('maps a manual achievement (progress stores the milestone percentage)', () => {
    const c = achievementToCard({ id: 'a2', title: 'Confidence', tracking_type: 'manual_milestone', total: 100, progress: 75 });
    expect(c.progressPercentage).toBe(75);
    expect(c.targetValue).toBeUndefined();
  });

  it('merges both collections for the combined page', () => {
    const cards = mergeCards([goalRow], [achRow]);
    expect(cards).toHaveLength(2);
    expect(cards.filter((c) => c.itemType === 'goal')).toHaveLength(1);
    expect(cards.filter((c) => c.itemType === 'achievement')).toHaveLength(1);
  });

  it('preserves All / Goals / Achievements filtering', () => {
    const cards = mergeCards([goalRow], [achRow]);
    expect(filterCards(cards, 'all')).toHaveLength(2);
    expect(filterCards(cards, 'goals').every((c) => c.itemType === 'goal')).toBe(true);
    expect(filterCards(cards, 'achievements').every((c) => c.itemType === 'achievement')).toBe(true);
  });

  it('keeps completed items visible (does not drop them)', () => {
    const completed = { ...achRow, id: 'a3', unlocked: true, progress: 300 };
    const cards = mergeCards([], [completed]);
    expect(cards).toHaveLength(1);
    expect(cards[0].status).toBe('completed');
    expect(cards[0].progressPercentage).toBe(100);
  });
});
