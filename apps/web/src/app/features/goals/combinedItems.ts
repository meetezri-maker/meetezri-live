/**
 * Frontend-only combined display model for the Goals & Achievements page.
 * Backend models stay separate; this only merges/filters for display.
 */
export type GamificationFilter = 'all' | 'goals' | 'achievements';

export type CombinedItem<G, A> =
  | { itemType: 'goal'; id: string; data: G }
  | { itemType: 'achievement'; id: string; data: A };

/**
 * Merge goal items + achievement items into one list, filtered by type:
 *  - 'all'          -> goals + achievements
 *  - 'goals'        -> goals only
 *  - 'achievements' -> achievements only (custom + predefined both live here)
 * Order is stable: goals first, then achievements.
 */
export function combineAndFilter<G, A>(
  goals: Array<CombinedItem<G, A>>,
  achievements: Array<CombinedItem<G, A>>,
  filter: GamificationFilter
): Array<CombinedItem<G, A>> {
  return [
    ...(filter !== 'achievements' ? goals : []),
    ...(filter !== 'goals' ? achievements : []),
  ];
}

/** Collision-proof React key across goals / custom / predefined achievements. */
export function combinedItemKey<G, A>(item: CombinedItem<G, A>): string {
  return `${item.itemType}:${item.id}`;
}
