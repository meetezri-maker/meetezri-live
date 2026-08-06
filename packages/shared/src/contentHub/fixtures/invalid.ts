/**
 * Content Hub — invalid fixtures.
 *
 * Each fixture isolates ONE rule so a failure names the rule rather than "the document is bad".
 * `expectedErrorCode` is asserted by the shared validator tests and will be asserted again by the
 * API and web zod layers, which is what proves the three agree.
 *
 * ZOD-FREE BY CONTRACT — see `../constants.ts`.
 */

import type { ContentBody } from '../blocks';
import { CONTENT_BODY_VERSION } from '../constants';

const text = (value: string) => [{ text: value }];

export interface InvalidBodyFixture {
  name: string;
  body: unknown;
  expectedErrorCode: string;
  /** Set when the rule only applies at publish time. */
  forPublish?: boolean;
  contentType?: 'aeo_answer' | 'geo_article' | 'seo_blog';
}

/** Direct answer present but not first — the AEO strategy is "answer first, explanation second". */
export const DIRECT_ANSWER_NOT_FIRST: ContentBody = {
  version: CONTENT_BODY_VERSION,
  blocks: [
    { id: 'b1', type: 'heading', level: 2, content: text('Some heading first') },
    { id: 'b2', type: 'direct_answer', content: text('The answer arrives too late.') },
  ],
};

export const DUPLICATE_BLOCK_IDS: ContentBody = {
  version: CONTENT_BODY_VERSION,
  blocks: [
    { id: 'dupe', type: 'paragraph', content: text('First block.') },
    { id: 'dupe', type: 'paragraph', content: text('Second block with the same id.') },
  ],
};

export const MULTIPLE_FAQ_BLOCKS: ContentBody = {
  version: CONTENT_BODY_VERSION,
  blocks: [
    { id: 'b1', type: 'faq', items: [{ id: 'f1', question: 'First?', answer: text('Yes.') }] },
    { id: 'b2', type: 'faq', items: [{ id: 'f2', question: 'Second?', answer: text('Also yes.') }] },
  ],
};

/** A `geo_statement` on AEO content — blocks are type-restricted. */
export const WRONG_TYPE_BLOCK: ContentBody = {
  version: CONTENT_BODY_VERSION,
  blocks: [
    { id: 'b1', type: 'geo_statement', statement: text('Only valid on geo_article content.') },
  ],
};

/** `javascript:` in an inline link — the primary XSS vector the JSON model is designed to close. */
export const UNSAFE_INLINE_LINK: ContentBody = {
  version: CONTENT_BODY_VERSION,
  blocks: [
    {
      id: 'b1',
      type: 'paragraph',
      content: [
        { text: 'Click ' },
        { text: 'here', link: { kind: 'external', value: 'javascript:alert(1)' } },
      ],
    },
  ],
};

/** A CTA pointing at a route key that is not in the registry. */
export const UNKNOWN_ROUTE_CTA: ContentBody = {
  version: CONTENT_BODY_VERSION,
  blocks: [
    {
      id: 'b1',
      type: 'cta',
      label: 'Go somewhere',
      target: { kind: 'route', value: 'product.does_not_exist' },
    },
  ],
};

/** Valid as a draft; rejected at publish because no safety notice exists. */
export const MISSING_SAFETY_NOTICE: ContentBody = {
  version: CONTENT_BODY_VERSION,
  blocks: [{ id: 'b1', type: 'paragraph', content: text('Ordinary prose with no safety notice.') }],
};

export const BAD_BODY_VERSION = {
  version: 99,
  blocks: [],
};

export const TABLE_ROW_MISMATCH: ContentBody = {
  version: CONTENT_BODY_VERSION,
  blocks: [
    {
      id: 'b1',
      type: 'table',
      headers: ['A', 'B', 'C'],
      rows: [[text('only'), text('two')]],
    },
  ],
};

export const IMAGE_WITHOUT_ALT = {
  version: CONTENT_BODY_VERSION,
  blocks: [{ id: 'b1', type: 'image', url: 'https://example.com/a.png', alt: '' }],
};

/** Tag inputs that must be rejected or normalised away. */
export const INVALID_TAG_INPUTS = {
  tooMany: Array.from({ length: 11 }, (_, i) => `tag-${i}`),
  tooLong: ['a'.repeat(40)],
  duplicates: ['Anxiety', 'anxiety', 'ANXIETY  '],
  emptyAfterNormalisation: ['   ', '!!!', '---'],
  notStrings: [1, null, {}, []],
} as const;

/** Slug inputs and the reason each must be rejected. */
export const INVALID_SLUG_INPUTS = [
  { input: '', reason: 'empty' },
  { input: '   ', reason: 'empty' },
  { input: 'admin', reason: 'reserved' },
  { input: 'sitemap', reason: 'reserved' },
  { input: 'Not A Slug', reason: 'invalid' },
  { input: '-leading-hyphen', reason: 'invalid' },
] as const;

/** The full set, for table-driven tests across all three validation layers. */
export const INVALID_BODY_FIXTURES: InvalidBodyFixture[] = [
  { name: 'direct answer not first', body: DIRECT_ANSWER_NOT_FIRST, expectedErrorCode: 'direct_answer.not_first' },
  { name: 'duplicate block ids', body: DUPLICATE_BLOCK_IDS, expectedErrorCode: 'block.duplicate_id' },
  { name: 'multiple FAQ blocks', body: MULTIPLE_FAQ_BLOCKS, expectedErrorCode: 'faq.too_many' },
  {
    name: 'geo_statement on AEO content',
    body: WRONG_TYPE_BLOCK,
    expectedErrorCode: 'block.wrong_content_type',
    contentType: 'aeo_answer',
  },
  { name: 'unsafe inline link', body: UNSAFE_INLINE_LINK, expectedErrorCode: 'inline.unsafe_link' },
  { name: 'unknown route key on CTA', body: UNKNOWN_ROUTE_CTA, expectedErrorCode: 'cta.unknown_route' },
  {
    name: 'missing safety notice at publish',
    body: MISSING_SAFETY_NOTICE,
    expectedErrorCode: 'safety_notice.required',
    forPublish: true,
  },
  { name: 'bad body version', body: BAD_BODY_VERSION, expectedErrorCode: 'body.bad_version' },
  { name: 'table row length mismatch', body: TABLE_ROW_MISMATCH, expectedErrorCode: 'table.row_length_mismatch' },
  { name: 'image without alt', body: IMAGE_WITHOUT_ALT, expectedErrorCode: 'image.missing_alt' },
];
