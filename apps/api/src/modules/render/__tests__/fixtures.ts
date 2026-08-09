/**
 * Public render fixtures.
 *
 * Every fixture carries SENTINEL VALUES for internal fields that must never reach public output.
 * The disclosure tests search the FINAL RENDERED HTML for these strings rather than trusting the
 * TypeScript types — a type says what should happen, a substring search over the bytes on the
 * wire says what did.
 */

import type { PublicCard, PublicDetail } from '../../content-hub/content-hub.public.schema';

/**
 * Strings that must never appear in any public byte.
 *
 * If one of these shows up in rendered HTML, JSON-LD, a meta tag or the sitemap, something
 * bypassed the serializer.
 */
export const SENTINELS = {
  editorialRef: 'W1-SENTINEL-REF',
  editorialNote: 'SENTINEL-INTERNAL-EDITORIAL-NOTE',
  tag: 'SENTINEL-INTERNAL-TAG',
  coreMessage: 'SENTINEL-GEO-CORE-MESSAGE',
  citationGoal: 'SENTINEL-GEO-CITATION-GOAL',
  kpi: 'SENTINEL-KPI-TARGET',
  authorEmail: 'sentinel-author@internal.example',
  profileId: '00000000-dead-4000-8000-00000000beef',
  scheduledFor: '2099-01-01T00:00:00.000Z',
  approvalGate: 'SENTINEL-APPROVAL-FOUNDER',
} as const;

export const ALL_SENTINELS = Object.values(SENTINELS);

/** Internal type strings and strategy names that must never be publicly visible. */
export const FORBIDDEN_TERMS = ['aeo_answer', 'geo_article', 'seo_blog', 'AEO', 'GEO'] as const;

export function card(overrides: Partial<PublicCard> = {}): PublicCard {
  return {
    slug: 'what-to-do-when-you-cannot-sleep',
    label: 'Answer',
    title: 'What should I do when I cannot sleep?',
    description: 'Practical, gentle steps for the nights when sleep will not come.',
    featuredImageUrl: null,
    featuredImageAlt: null,
    readingTimeMinutes: 4,
    publishedAt: '2026-03-12T09:00:00.000Z',
    updatedAt: '2026-03-14T09:00:00.000Z',
    ...overrides,
  };
}

export function answerDetail(overrides: Partial<PublicDetail> = {}): PublicDetail {
  return {
    slug: 'what-to-do-when-you-cannot-sleep',
    label: 'Answer',
    title: 'What should I do when I cannot sleep?',
    description: 'Practical, gentle steps for the nights when sleep will not come.',
    canonicalPath: '/resources/what-to-do-when-you-cannot-sleep',
    canonicalUrlOverride: null,
    robots: 'index,follow',
    featuredImageUrl: 'https://cdn.example.com/sleep.png',
    featuredImageAlt: 'A dim bedroom at night',
    body: {
      version: 1,
      blocks: [
        {
          id: 'b1',
          type: 'direct_answer',
          content: [{ text: 'Get out of bed, keep the lights low, and do something dull.' }],
        },
        {
          id: 'b2',
          type: 'heading',
          level: 2,
          content: [{ text: 'Why lying there makes it worse' }],
          anchorId: 'why-lying-there',
        },
        {
          id: 'b3',
          type: 'paragraph',
          content: [
            { text: 'Your brain learns from repetition. ' },
            { text: 'Read more', link: { href: '/resources/sleep-and-anxiety', external: false } },
          ],
        },
        {
          id: 'b4',
          type: 'faq',
          heading: 'Common questions',
          items: [
            {
              id: 'f1',
              question: 'Should I check the time?',
              answer: [{ text: 'No — clock-watching raises the pressure to fall asleep.' }],
            },
          ],
        },
        {
          id: 'b5',
          type: 'cta',
          label: 'See how Solace works',
          href: '/how-it-works',
          external: false,
          description: 'Somewhere calm to talk it through.',
        },
      ],
    },
    typeFields: {
      primaryQuestion: 'What should I do when I cannot sleep?',
      snippetAnswer: 'Get out of bed, keep the lights low, and do something dull until you feel sleepy.',
    },
    author: {
      name: 'Dr Amara Reid',
      title: 'Clinical psychologist',
      bio: 'Writes about sleep and anxiety.',
      avatarUrl: 'https://cdn.example.com/amara.png',
    },
    reviewer: { name: 'Sam Okafor', title: null, bio: null, avatarUrl: null },
    reviewedAt: '2026-03-13T09:00:00.000Z',
    publishedAt: '2026-03-12T09:00:00.000Z',
    updatedAt: '2026-03-14T09:00:00.000Z',
    readingTimeMinutes: 4,
    links: [{ label: 'Sleep and anxiety', href: '/resources/sleep-and-anxiety', relation: 'related_content' }],
    related: [card({ slug: 'sleep-and-anxiety', title: 'Sleep and anxiety', label: 'Insight' })],
    ...overrides,
  };
}

export function insightDetail(overrides: Partial<PublicDetail> = {}): PublicDetail {
  return answerDetail({
    slug: 'why-talking-helps',
    label: 'Insight',
    title: 'Why talking things through helps',
    typeFields: {
      citationSummary: 'Talking aloud reorganises a worry into a sequence, which makes it smaller.',
      keyStatements: ['Naming a feeling reduces its intensity.', 'Structure beats rumination.'],
    },
    body: {
      version: 1,
      blocks: [
        {
          id: 'g1',
          type: 'geo_statement',
          statement: [{ text: 'Talking aloud reorganises a worry into a sequence.' }],
          examples: ['Describing a deadline out loud', 'Explaining a row to a friend'],
          clarification: [{ text: 'This is not a substitute for therapy.' }],
        },
        { id: 'g2', type: 'source', label: 'Sample study', url: 'https://example.org/study', publisher: 'Example Journal' },
      ],
    },
    ...overrides,
  });
}

export function articleDetail(overrides: Partial<PublicDetail> = {}): PublicDetail {
  return answerDetail({
    slug: 'a-guide-to-difficult-conversations',
    label: 'Article',
    title: 'A guide to difficult conversations',
    typeFields: {},
    body: {
      version: 1,
      blocks: [
        { id: 'a1', type: 'paragraph', content: [{ text: 'Difficult conversations are a skill.' }] },
        { id: 'a2', type: 'heading', level: 2, content: [{ text: 'Prepare' }] },
        { id: 'a3', type: 'heading', level: 2, content: [{ text: 'Open' }] },
        { id: 'a4', type: 'heading', level: 2, content: [{ text: 'Close' }] },
        {
          id: 'a5',
          type: 'table',
          caption: 'What to say',
          headers: ['Instead of', 'Try'],
          rows: [[[{ text: 'You always…' }], [{ text: 'I noticed…' }]]],
        },
      ],
    },
    ...overrides,
  });
}
