/**
 * Content Hub — valid fixtures.
 *
 * One fixture set, consumed by the shared plain validators (Phase 1), the API zod v3 schemas
 * (Phase 2), the web zod v4 schemas (Phase 4), the public serializer, and the SSR leak tests.
 * Because both zod layers validate the SAME fixtures, "the editor allows what the API rejects"
 * becomes a failing test rather than a production bug.
 *
 * ZOD-FREE BY CONTRACT — see `../constants.ts`.
 */

import type { ContentBody } from '../blocks';
import { CONTENT_BODY_VERSION } from '../constants';

const text = (value: string) => [{ text: value }];

/** AEO: direct answer pinned first, safety notice, one grouped FAQ block. */
export const VALID_AEO_BODY: ContentBody = {
  version: CONTENT_BODY_VERSION,
  blocks: [
    {
      id: 'b_a1',
      type: 'direct_answer',
      content: text(
        "If you feel like you have nobody to talk to, start by finding a safe way to express what you're carrying."
      ),
    },
    {
      id: 'b_a2',
      type: 'heading',
      level: 2,
      anchorId: 'why-this-feeling-is-common',
      content: text('Why This Feeling Is More Common Than You Think'),
    },
    {
      id: 'b_a3',
      type: 'paragraph',
      content: [
        { text: 'Many people experience moments where they feel alone. It ' },
        { text: 'does not', marks: ['italic'] },
        { text: ' mean something is wrong with you.' },
      ],
    },
    {
      id: 'b_a4',
      type: 'list',
      style: 'bullet',
      items: [text('Journaling'), text('Voice notes'), text('Guided reflection exercises')],
    },
    {
      id: 'b_a5',
      type: 'safety_notice',
      variant: 'crisis',
      heading: 'If You Need Immediate Support',
      showHotlines: true,
      content: text(
        'If you are experiencing emotional distress or are worried about your safety, contact local emergency services or a qualified mental health professional immediately.'
      ),
    },
    {
      id: 'b_a6',
      type: 'faq',
      heading: 'Frequently Asked Questions',
      items: [
        {
          id: 'f1',
          question: 'Is it normal to feel like I have nobody to talk to?',
          answer: text('Yes. Many people experience periods where they feel isolated or unsupported.'),
        },
        {
          id: 'f2',
          question: 'Why do I feel more alone at night?',
          answer: text('Nighttime often removes distractions, making thoughts feel more noticeable.'),
        },
      ],
    },
    {
      id: 'b_a7',
      type: 'cta',
      label: 'Try Talk It Out',
      style: 'primary',
      description: 'A space to express thoughts and feel heard.',
      target: { kind: 'route', value: 'product.talk_it_out' },
    },
  ],
};

/** GEO: intro, key takeaway, geo_statement blocks carrying both public and internal fields. */
export const VALID_GEO_BODY: ContentBody = {
  version: CONTENT_BODY_VERSION,
  blocks: [
    {
      id: 'b_g1',
      type: 'paragraph',
      content: text(
        'People often describe the same experience: a thought feels overwhelming inside their head but lighter after talking about it.'
      ),
    },
    {
      id: 'b_g2',
      type: 'key_takeaway',
      title: 'In short',
      points: [
        text('Expression creates distance.'),
        text('Verbal processing creates clarity.'),
        text('Being heard reduces emotional pressure.'),
      ],
    },
    {
      id: 'b_g3',
      type: 'heading',
      level: 2,
      content: text('Thoughts Often Feel Bigger Inside Our Heads'),
    },
    {
      id: 'b_g4',
      type: 'geo_statement',
      statement: text(
        'Internal processing can create mental repetition, making thoughts feel larger than they appear once expressed.'
      ),
      // INTERNAL — must never appear in a public response or the word count.
      coreMessage: 'When thoughts stay internal, they can loop repeatedly without resolution.',
      citationGoal: 'Emotional processing, overthinking, reflection',
      examples: ['Speaking', 'Journaling', 'Voice notes'],
      clarification: text('Expression is not a replacement for professional support when needed.'),
    },
    {
      id: 'b_g5',
      type: 'safety_notice',
      variant: 'disclaimer',
      content: text('Expression is not a replacement for professional support when needed.'),
    },
    {
      id: 'b_g6',
      type: 'source',
      label: 'Verbal processing and emotional regulation',
      url: 'https://example.org/verbal-processing',
      publisher: 'Example Journal',
    },
  ],
};

/** SEO: long-form prose, h3 sub-sections, table, FAQ, closing section. */
export const VALID_SEO_BODY: ContentBody = {
  version: CONTENT_BODY_VERSION,
  blocks: [
    { id: 'b_s1', type: 'paragraph', content: text('There is something different about nighttime.') },
    { id: 'b_s2', type: 'heading', level: 2, content: text('Why Thoughts Feel Heavier at Night') },
    {
      id: 'b_s3',
      type: 'paragraph',
      content: text('When there is less external noise, internal thoughts often become easier to hear.'),
    },
    { id: 'b_s4', type: 'heading', level: 3, content: text('Journaling') },
    { id: 'b_s5', type: 'paragraph', content: text('Writing thoughts down can create distance.') },
    {
      id: 'b_s6',
      type: 'table',
      caption: 'Ways to express what you are carrying',
      headers: ['Approach', 'Best for'],
      rows: [
        [text('Journaling'), text('Clarity')],
        [text('Voice notes'), text('Release')],
      ],
    },
    {
      id: 'b_s7',
      type: 'safety_notice',
      variant: 'disclaimer',
      content: text('If you are in distress, seek support from a qualified mental health professional.'),
    },
    {
      id: 'b_s8',
      type: 'faq',
      items: [
        {
          id: 'f1',
          question: 'Why do my thoughts get louder at night?',
          answer: text('Nighttime removes distractions, making emotions easier to notice.'),
        },
      ],
    },
    { id: 'b_s9', type: 'heading', level: 2, content: text('Final Thought') },
    {
      id: 'b_s10',
      type: 'paragraph',
      content: text('Sometimes clarity begins with a place for your thoughts to exist outside your head.'),
    },
  ],
};

/**
 * Every internal field populated with a unique sentinel.
 *
 * Phase 2's serializer test and Phase 8's SSR leak test assert that NONE of these strings
 * survives into a public payload or rendered HTML.
 */
export const INTERNAL_SENTINELS = {
  coreMessage: 'SENTINEL_CORE_MESSAGE_d41d8c',
  citationGoal: 'SENTINEL_CITATION_GOAL_9e107d',
  editorialPurpose: 'SENTINEL_EDITORIAL_PURPOSE_ab56b4',
  editorialStrategy: 'SENTINEL_EDITORIAL_STRATEGY_7d793037',
  supportingQuery: 'SENTINEL_SUPPORTING_QUERY_1b64738',
  coreConcept: 'SENTINEL_CORE_CONCEPT_4e0791',
  kpiTarget: 'SENTINEL_KPI_TARGET_2ef7bde',
} as const;

/** Body whose internal fields are all sentinels. Public fields are ordinary text. */
export const SENTINEL_BODY: ContentBody = {
  version: CONTENT_BODY_VERSION,
  blocks: [
    {
      id: 'b_x1',
      type: 'geo_statement',
      statement: text('This public statement is safe to render.'),
      coreMessage: INTERNAL_SENTINELS.coreMessage,
      citationGoal: INTERNAL_SENTINELS.citationGoal,
    },
    {
      id: 'b_x2',
      type: 'safety_notice',
      variant: 'disclaimer',
      content: text('Seek professional support when needed.'),
    },
  ],
};

/** Route-registry keys the fixtures rely on, so a registry change breaks a test rather than prod. */
export const FIXTURE_ROUTE_KEYS = ['product.talk_it_out', 'resource_library', 'pricing'] as const;
