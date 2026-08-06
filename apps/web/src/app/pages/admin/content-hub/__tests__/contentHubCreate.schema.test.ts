/**
 * Content Hub — web Zod v4 create schema, and the first half of the WEB parity proof.
 *
 * The web app (v4) and the API (v3) cannot share a schema instance. Agreement is proven by both
 * validating the same shared inputs and both delegating normalisation to the same shared plain
 * helpers — so what the form shows the user is what the server will store.
 */

import { describe, expect, it } from 'vitest';
import { CONTENT_LIMITS, RESERVED_SLUGS, normaliseSlug, normaliseTags } from '@meetezri/shared';
import {
  contentHubCreateSchema,
  parseTagsInput,
  toCreateBody,
} from '../schema/contentHubCreate.schema';

const base = { contentType: 'aeo_answer' as const, title: 'What should I do?' };

describe('valid input', () => {
  it('accepts the minimum viable form', () => {
    expect(contentHubCreateSchema.safeParse(base).success).toBe(true);
  });

  it('accepts a full form', () => {
    const result = contentHubCreateSchema.safeParse({
      ...base,
      slug: 'what-should-i-do',
      pillar: 'Someone To Talk To',
      week: '1',
      tagsInput: 'anxiety, sleep health',
      editorialRef: 'W1-A001',
      authorId: '11111111-1111-4111-8111-111111111111',
    });
    expect(result.success).toBe(true);
  });
});

describe('title', () => {
  it('requires a title', () => {
    expect(contentHubCreateSchema.safeParse({ ...base, title: '   ' }).success).toBe(false);
  });

  it('rejects an over-long title', () => {
    expect(contentHubCreateSchema.safeParse({ ...base, title: 'x'.repeat(201) }).success).toBe(false);
  });
});

describe('slug — agrees with the shared validator', () => {
  it('accepts a canonical slug', () => {
    expect(contentHubCreateSchema.safeParse({ ...base, slug: 'a-good-slug' }).success).toBe(true);
  });

  it('accepts messy input the shared normaliser can rescue', () => {
    // The server normalises identically, so this must not be a client-side error.
    expect(contentHubCreateSchema.safeParse({ ...base, slug: '  A Good Slug  ' }).success).toBe(true);
    expect(normaliseSlug('  A Good Slug  ')).toBe('a-good-slug');
  });

  it('rejects input that normalises to nothing', () => {
    expect(contentHubCreateSchema.safeParse({ ...base, slug: '!!!' }).success).toBe(false);
  });

  it('rejects every reserved slug', () => {
    for (const reserved of RESERVED_SLUGS) {
      const result = contentHubCreateSchema.safeParse({ ...base, slug: reserved });
      expect({ reserved, ok: result.success }).toEqual({ reserved, ok: false });
    }
  });

  it('rejects a slug that only becomes reserved after normalisation', () => {
    expect(contentHubCreateSchema.safeParse({ ...base, slug: '  Admin  ' }).success).toBe(false);
  });

  it('treats an empty slug as "let the server derive it"', () => {
    expect(contentHubCreateSchema.safeParse({ ...base, slug: '' }).success).toBe(true);
  });
});

describe('week', () => {
  it('accepts a numeric string from the input element', () => {
    const result = contentHubCreateSchema.safeParse({ ...base, week: '3' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.week).toBe(3);
  });

  it('rejects non-integers and out-of-range values', () => {
    for (const week of ['0', '1.5', '999', 'abc']) {
      expect({ week, ok: contentHubCreateSchema.safeParse({ ...base, week }).success }).toEqual({
        week,
        ok: false,
      });
    }
  });

  it('treats an empty field as absent', () => {
    const result = contentHubCreateSchema.safeParse({ ...base, week: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.week).toBeUndefined();
  });
});

describe('tags — uses the shared normaliser', () => {
  it('normalises exactly like the shared helper', () => {
    expect(parseTagsInput('  Sleep Health , ANXIETY, anxiety ')).toEqual(
      normaliseTags(['  Sleep Health ', ' ANXIETY', ' anxiety ']),
    );
    expect(parseTagsInput('  Sleep Health , ANXIETY, anxiety ')).toEqual(['sleep-health', 'anxiety']);
  });

  it('drops entries that normalise to nothing', () => {
    expect(parseTagsInput('  , !!! , ---')).toEqual([]);
  });

  it('accepts exactly the maximum number of tags', () => {
    const tags = Array.from({ length: CONTENT_LIMITS.maxTags }, (_, i) => `tag-${i}`).join(',');
    expect(contentHubCreateSchema.safeParse({ ...base, tagsInput: tags }).success).toBe(true);
  });

  it('rejects more than the maximum AFTER normalisation', () => {
    const tags = Array.from({ length: CONTENT_LIMITS.maxTags + 1 }, (_, i) => `tag-${i}`).join(',');
    expect(contentHubCreateSchema.safeParse({ ...base, tagsInput: tags }).success).toBe(false);
  });

  it('does not count duplicates toward the limit, because they normalise away', () => {
    // 12 raw entries, 2 distinct — must pass.
    const tags = Array.from({ length: 12 }, (_, i) => (i % 2 ? 'Anxiety' : 'anxiety')).join(',');
    expect(contentHubCreateSchema.safeParse({ ...base, tagsInput: tags }).success).toBe(true);
  });
});

describe('editorial reference and author', () => {
  it('rejects an over-long reference', () => {
    expect(contentHubCreateSchema.safeParse({ ...base, editorialRef: 'x'.repeat(65) }).success).toBe(false);
  });

  it('rejects a malformed author id', () => {
    expect(contentHubCreateSchema.safeParse({ ...base, authorId: 'not-a-uuid' }).success).toBe(false);
  });
});

describe('toCreateBody', () => {
  it('normalises once and omits empty optionals', () => {
    const values = contentHubCreateSchema.parse({
      ...base,
      slug: '  What Should I Do?  ',
      tagsInput: 'Anxiety, anxiety',
      pillar: '',
      editorialRef: '',
    });

    expect(toCreateBody(values)).toEqual({
      contentType: 'aeo_answer',
      title: 'What should I do?',
      slug: 'what-should-i-do',
      tags: ['anxiety'],
    });
  });

  it('omits the slug entirely when blank, so the server derives it', () => {
    const values = contentHubCreateSchema.parse({ ...base, slug: '' });
    expect(toCreateBody(values)).not.toHaveProperty('slug');
  });

  it('strips unknown fields — they never reach the API', () => {
    const values = contentHubCreateSchema.parse({ ...base, status: 'published', sneaky: true } as never);
    const body = toCreateBody(values);
    expect(body).not.toHaveProperty('status');
    expect(body).not.toHaveProperty('sneaky');
  });
});
