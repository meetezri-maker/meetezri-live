/**
 * Stable public Resource clusters.
 *
 * Slugs are the durable editorial identifier available to every consumer. Database ids are
 * intentionally absent, and membership is static so an unpublished row can never leak merely by
 * appearing in a query result. Public readers still pass through the published/indexable filters.
 */
export const RESOURCE_TOPIC_CLUSTERS = {
  talking_and_support: [
    'someone-to-talk-to-at-night',
    'what-should-i-do-when-i-have-nobody-to-talk-to',
    'why-talking-through-thoughts-can-make-them-feel-lighter',
  ],
  honest_self_reflection: [
    'how-to-have-an-honest-conversation-with-yourself',
    'understanding-honest-conversations-with-yourself',
    'questions-about-honest-conversations-with-yourself',
  ],
  habits_and_consistency: [
    'small-daily-habits-vs-motivation',
    'questions-about-small-daily-habits-motivation-and-consistency',
    'small-steps-create-lasting-change-how-daily-habits-build-consistency-over-time',
  ],
  everyday_stress: [
    'everyday-stress-mental-load',
    'everyday-stress-mental-load-emotional-resilience',
    'manage-everyday-stress-before-overwhelm',
  ],
  busy_mind_and_mental_load: [
    'attention-switching-mental-load-everyday-wellbeing',
    'busy-mind-attention-mental-load-questions',
    'why-does-my-mind-feel-so-busy',
  ],
  everyday_overthinking: [
    'anticipation-and-mental-attention',
    'why-do-i-keep-thinking-about-small-things',
    'why-do-i-overthink-small-things',
  ],
  replaying_conversations: [
    'replaying-conversations-and-everyday-reflection',
    'why-do-i-keep-replaying-conversations-in-my-head',
    'why-do-i-replay-conversations',
  ],
  communication_and_reflection_bridge: [
    'questions-about-everyday-conversations',
    'why-do-people-keep-things-to-themselves',
    'why-do-we-keep-things-to-ourselves',
    'replaying-conversations-and-everyday-reflection',
  ],
} as const;

export type ResourceTopicClusterKey = keyof typeof RESOURCE_TOPIC_CLUSTERS;

export function resourceClusterKeysForSlug(slug: string): ResourceTopicClusterKey[] {
  return (Object.entries(RESOURCE_TOPIC_CLUSTERS) as Array<
    [ResourceTopicClusterKey, readonly string[]]
  >)
    .filter(([, slugs]) => slugs.includes(slug))
    .map(([key]) => key);
}

/** Ordered union: primary cluster first, bridge membership second, no duplicate slugs. */
export function relatedClusterSlugs(slug: string): string[] {
  const seen = new Set<string>([slug]);
  const related: string[] = [];

  for (const key of resourceClusterKeysForSlug(slug)) {
    for (const candidate of RESOURCE_TOPIC_CLUSTERS[key]) {
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      related.push(candidate);
    }
  }

  return related;
}

export function isKnownResourceSlug(slug: string): boolean {
  return resourceClusterKeysForSlug(slug).length > 0;
}
