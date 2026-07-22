import { describe, it, expect } from 'vitest';
import { combineAndFilter, combinedItemKey, type CombinedItem } from './combinedItems';

type Item = CombinedItem<{ t: string }, { t: string }>;

const goals: Item[] = [
  { itemType: 'goal', id: 'g1', data: { t: 'Goal 1' } },
  { itemType: 'goal', id: 'g2', data: { t: 'Goal 2' } },
];
const achievements: Item[] = [
  { itemType: 'achievement', id: '1', data: { t: 'Predefined 1' } }, // predefined id
  { itemType: 'achievement', id: 'c-uuid', data: { t: 'Custom' } }, // custom id
];

describe('combineAndFilter (All / Goals / Achievements)', () => {
  it('All shows goals AND achievements (goals first)', () => {
    const out = combineAndFilter(goals, achievements, 'all');
    expect(out).toHaveLength(4);
    expect(out.slice(0, 2).every((i) => i.itemType === 'goal')).toBe(true);
    expect(out.slice(2).every((i) => i.itemType === 'achievement')).toBe(true);
  });

  it('Goals shows only goals', () => {
    const out = combineAndFilter(goals, achievements, 'goals');
    expect(out).toHaveLength(2);
    expect(out.every((i) => i.itemType === 'goal')).toBe(true);
  });

  it('Achievements shows only achievements (custom + predefined)', () => {
    const out = combineAndFilter(goals, achievements, 'achievements');
    expect(out).toHaveLength(2);
    expect(out.every((i) => i.itemType === 'achievement')).toBe(true);
  });
});

describe('combinedItemKey — stable, collision-proof keys', () => {
  it('prefixes by item type so ids cannot collide across types', () => {
    const goalKey = combinedItemKey({ itemType: 'goal', id: '1', data: { t: 'g' } });
    const achKey = combinedItemKey({ itemType: 'achievement', id: '1', data: { t: 'a' } });
    expect(goalKey).toBe('goal:1');
    expect(achKey).toBe('achievement:1');
    expect(goalKey).not.toBe(achKey); // same raw id, different keys
  });

  it('produces unique keys across a mixed list', () => {
    const keys = combineAndFilter(goals, achievements, 'all').map(combinedItemKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(['goal:g1', 'goal:g2', 'achievement:1', 'achievement:c-uuid']);
  });
});
