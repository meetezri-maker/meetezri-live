/**
 * Content Hub — shared domain foundation tests.
 *
 * These exercise `@meetezri/shared/contentHub`, which has no test runner of its own. They live in
 * the API's Jest project because the API already consumes the built package, so the tests verify
 * the artefact that production actually imports rather than the TypeScript source.
 *
 * Several assertions here guard DECISIONS rather than behaviour — the seven-status rule and the
 * public-label mapping in particular are the kind of thing a later change would quietly undo.
 */

import {
  APPROVAL_GATES,
  APPROVAL_STATES,
  CONTENT_LIMITS,
  CONTENT_STATUSES,
  CONTENT_TYPES,
  INVALID_BODY_FIXTURES,
  INVALID_SLUG_INPUTS,
  INVALID_TAG_INPUTS,
  PUBLIC_CONTENT_LABEL,
  ROUTE_KEYS,
  ROUTE_REGISTRY,
  SENTINEL_BODY,
  VALID_AEO_BODY,
  VALID_GEO_BODY,
  VALID_SEO_BODY,
  countBodyWords,
  deriveReadingStats,
  interimRouteKeys,
  isRouteKey,
  isSafeExternalUrl,
  normaliseSlug,
  normaliseTags,
  publicLabelFor,
  readingTimeMinutes,
  resolveRouteHref,
  validateContentBody,
  validateSlug,
  validateTags,
} from '@meetezri/shared';

describe('content types and public labels', () => {
  it('supports exactly the three internal content types', () => {
    expect([...CONTENT_TYPES]).toEqual(['aeo_answer', 'geo_article', 'seo_blog']);
  });

  it('maps every internal type to its approved public label', () => {
    expect(publicLabelFor('aeo_answer')).toBe('Answer');
    expect(publicLabelFor('geo_article')).toBe('Insight');
    expect(publicLabelFor('seo_blog')).toBe('Article');
  });

  it('never exposes AEO, GEO or SEO in a public label', () => {
    for (const label of Object.values(PUBLIC_CONTENT_LABEL)) {
      expect(label).not.toMatch(/aeo|geo|seo/i);
    }
  });

  it('has a label for every content type', () => {
    for (const type of CONTENT_TYPES) {
      expect(PUBLIC_CONTENT_LABEL[type]).toBeTruthy();
    }
  });
});

describe('status lifecycle', () => {
  it('has exactly seven statuses', () => {
    expect(CONTENT_STATUSES).toHaveLength(7);
  });

  it('matches the approved lifecycle exactly', () => {
    expect([...CONTENT_STATUSES]).toEqual([
      'draft',
      'in_review',
      'changes_requested',
      'approved',
      'published',
      'unpublished',
      'archived',
    ]);
  });

  it('has NO "scheduled" status — scheduling is approved + scheduled_for', () => {
    expect(CONTENT_STATUSES).not.toContain('scheduled');
  });
});

describe('approval gates', () => {
  it('ships the three approved gates', () => {
    expect([...APPROVAL_GATES]).toEqual(['founder', 'marketing', 'seo']);
  });

  it('does NOT include a safety gate (stakeholder sign-off not recorded at Phase 1)', () => {
    expect(APPROVAL_GATES).not.toContain('safety');
  });

  it('uses one state domain for every gate', () => {
    expect([...APPROVAL_STATES]).toEqual(['pending', 'approved', 'changes_requested']);
  });
});

describe('route registry', () => {
  it('exposes the minimum required keys', () => {
    for (const key of ['product.talk_it_out', 'resource_library', 'pricing', 'how_it_works', 'home']) {
      expect(ROUTE_KEYS).toContain(key);
    }
  });

  it('resolves the approved hrefs', () => {
    expect(resolveRouteHref('product.talk_it_out')).toBe('/how-it-works');
    expect(resolveRouteHref('resource_library')).toBe('/resources');
    expect(resolveRouteHref('pricing')).toBe('/pricing');
    expect(resolveRouteHref('how_it_works')).toBe('/how-it-works');
    expect(resolveRouteHref('home')).toBe('/');
  });

  it('flags talk_it_out as an interim mapping so it gets retargeted', () => {
    expect(interimRouteKeys()).toContain('product.talk_it_out');
  });

  it('never points a public route at an authenticated area', () => {
    for (const key of ROUTE_KEYS) {
      const href = ROUTE_REGISTRY[key].href;
      expect(href).not.toMatch(/^\/(app|admin|onboarding)\b/);
    }
  });

  it('rejects unknown keys', () => {
    expect(isRouteKey('product.does_not_exist')).toBe(false);
    expect(resolveRouteHref('nope')).toBeNull();
  });
});

describe('slug normalisation', () => {
  it('lowercases, hyphenates and trims', () => {
    expect(normaliseSlug('  What Should I Do?  ')).toBe('what-should-i-do');
  });

  it('strips accents rather than dropping the characters', () => {
    expect(normaliseSlug('Café Über Señor')).toBe('cafe-uber-senor');
  });

  it('collapses consecutive separators and trims hyphens', () => {
    expect(normaliseSlug('--a///b   c--')).toBe('a-b-c');
  });

  it('caps length at the configured maximum without a trailing hyphen', () => {
    const slug = normaliseSlug('word '.repeat(60));
    expect(slug.length).toBeLessThanOrEqual(CONTENT_LIMITS.maxSlugLength);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('is idempotent', () => {
    const once = normaliseSlug('Some Title Here');
    expect(normaliseSlug(once)).toBe(once);
  });

  it('rejects reserved, empty and non-canonical slugs with the right reason', () => {
    // validateSlug judges an ALREADY-NORMALISED value, so it is given the raw input here: its
    // job is to catch a caller that skipped normalisation or supplied a reserved word.
    for (const { input, reason } of INVALID_SLUG_INPUTS) {
      const result = validateSlug(input);
      expect({ input, valid: result.valid }).toEqual({ input, valid: false });
      expect({ input, reason: result.reason }).toEqual({ input, reason });
    }
  });

  it('accepts a well-formed slug', () => {
    expect(validateSlug('what-should-i-do-when-i-have-nobody-to-talk-to')).toEqual({ valid: true });
  });
});

describe('tag normalisation', () => {
  it('lowercases, trims and hyphenates whitespace', () => {
    expect(normaliseTags(['  Sleep Health  '])).toEqual(['sleep-health']);
  });

  it('removes duplicates while preserving first-occurrence order', () => {
    expect(normaliseTags(INVALID_TAG_INPUTS.duplicates)).toEqual(['anxiety']);
    expect(normaliseTags(['zebra', 'apple', 'zebra'])).toEqual(['zebra', 'apple']);
  });

  it('drops entries that normalise to nothing', () => {
    expect(normaliseTags(INVALID_TAG_INPUTS.emptyAfterNormalisation)).toEqual([]);
  });

  it('ignores non-string entries instead of throwing', () => {
    expect(normaliseTags(INVALID_TAG_INPUTS.notStrings)).toEqual([]);
  });

  it('truncates over-long tags to the limit', () => {
    const [tag] = normaliseTags(INVALID_TAG_INPUTS.tooLong);
    expect(tag.length).toBe(CONTENT_LIMITS.maxTagLength);
  });

  it('strips accents and unsupported characters', () => {
    expect(normaliseTags(['Anxiété!!', 'self_care'])).toEqual(['anxiete', 'selfcare']);
  });

  it('rejects more than the maximum number of tags', () => {
    const result = validateTags(normaliseTags(INVALID_TAG_INPUTS.tooMany));
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain('tags.too_many');
  });

  it('accepts a normalised list', () => {
    expect(validateTags(['anxiety', 'sleep-health']).valid).toBe(true);
  });
});

describe('URL safety', () => {
  it('rejects javascript: and data: however they are cased or padded', () => {
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeExternalUrl('JaVaScRiPt:alert(1)')).toBe(false);
    expect(isSafeExternalUrl('  javascript:alert(1)  ')).toBe(false);
    expect(isSafeExternalUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
    expect(isSafeExternalUrl('vbscript:msgbox(1)')).toBe(false);
    expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false);
  });

  it('accepts the allowed protocols', () => {
    expect(isSafeExternalUrl('https://example.com/a')).toBe(true);
    expect(isSafeExternalUrl('http://example.com')).toBe(true);
    expect(isSafeExternalUrl('mailto:someone@example.com')).toBe(true);
    expect(isSafeExternalUrl('tel:+441234567890')).toBe(true);
  });

  it('rejects malformed input rather than throwing', () => {
    expect(isSafeExternalUrl('not a url')).toBe(false);
    expect(isSafeExternalUrl('')).toBe(false);
    expect(isSafeExternalUrl(null)).toBe(false);
  });
});

describe('body validation — valid fixtures', () => {
  it('accepts the AEO fixture', () => {
    const result = validateContentBody(VALID_AEO_BODY, { contentType: 'aeo_answer' });
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('accepts the GEO fixture', () => {
    const result = validateContentBody(VALID_GEO_BODY, { contentType: 'geo_article' });
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('accepts the SEO fixture', () => {
    const result = validateContentBody(VALID_SEO_BODY, { contentType: 'seo_blog' });
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('accepts the valid fixtures at publish time too', () => {
    for (const [name, body, type] of [
      ['aeo', VALID_AEO_BODY, 'aeo_answer'],
      ['geo', VALID_GEO_BODY, 'geo_article'],
      ['seo', VALID_SEO_BODY, 'seo_blog'],
    ] as const) {
      const result = validateContentBody(body, { contentType: type, forPublish: true });
      expect({ name, errors: result.errors }).toEqual({ name, errors: [] });
    }
  });
});

describe('body validation — invalid fixtures', () => {
  it.each(INVALID_BODY_FIXTURES.map((f) => [f.name, f] as const))(
    'rejects: %s',
    (_name, fixture) => {
      const result = validateContentBody(fixture.body, {
        contentType: fixture.contentType,
        forPublish: fixture.forPublish,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.map((e) => e.code)).toContain(fixture.expectedErrorCode);
    }
  );

  it('treats a missing safety notice as a draft warning but a publish error', () => {
    const body = INVALID_BODY_FIXTURES.find((f) => f.expectedErrorCode === 'safety_notice.required')!.body;

    const draft = validateContentBody(body, {});
    expect(draft.valid).toBe(true);
    expect(draft.warnings.map((w) => w.code)).toContain('safety_notice.missing');

    const publish = validateContentBody(body, { forPublish: true });
    expect(publish.valid).toBe(false);
    expect(publish.errors.map((e) => e.code)).toContain('safety_notice.required');
  });

  it('allows a direct answer when it is genuinely first', () => {
    expect(VALID_AEO_BODY.blocks[0].type).toBe('direct_answer');
    expect(validateContentBody(VALID_AEO_BODY, { contentType: 'aeo_answer' }).valid).toBe(true);
  });

  it('rejects a geo_statement on SEO content as well as AEO', () => {
    const body = INVALID_BODY_FIXTURES.find((f) => f.expectedErrorCode === 'block.wrong_content_type')!.body;
    const result = validateContentBody(body, { contentType: 'seo_blog' });
    expect(result.errors.map((e) => e.code)).toContain('block.wrong_content_type');
  });
});

describe('word count and reading time', () => {
  it('excludes internal geo_statement fields from the count', () => {
    const withInternal = countBodyWords(SENTINEL_BODY);

    const stripped = {
      ...SENTINEL_BODY,
      blocks: SENTINEL_BODY.blocks.map((block) =>
        block.type === 'geo_statement'
          ? { ...block, coreMessage: undefined, citationGoal: undefined }
          : block
      ),
    };

    // Removing the internal fields must not change the count — proof they were never counted.
    expect(countBodyWords(stripped)).toBe(withInternal);
  });

  it('counts public prose across block types', () => {
    expect(countBodyWords(VALID_SEO_BODY)).toBeGreaterThan(0);
    expect(countBodyWords(VALID_AEO_BODY)).toBeGreaterThan(countBodyWords({ version: 1, blocks: [] }));
  });

  it('counts FAQ questions and answers', () => {
    const withFaq = countBodyWords({
      version: 1,
      blocks: [
        {
          id: 'b1',
          type: 'faq',
          items: [{ id: 'f1', question: 'One two three', answer: [{ text: 'four five' }] }],
        },
      ],
    });
    expect(withFaq).toBe(5);
  });

  it('counts table cells and headers', () => {
    const words = countBodyWords({
      version: 1,
      blocks: [
        {
          id: 'b1',
          type: 'table',
          headers: ['Alpha', 'Beta'],
          rows: [[[{ text: 'one' }], [{ text: 'two' }]]],
        },
      ],
    });
    expect(words).toBe(4);
  });

  it('ignores dividers, image metadata and block ids', () => {
    const words = countBodyWords({
      version: 1,
      blocks: [
        { id: 'a-very-long-block-id-with-many-words', type: 'divider' },
        { id: 'b2', type: 'image', url: 'https://example.com/a.png', alt: 'alt text here', caption: [{ text: 'cap' }] },
      ],
    });
    expect(words).toBe(0);
  });

  it('never reports less than one minute', () => {
    expect(readingTimeMinutes(0)).toBe(1);
    expect(readingTimeMinutes(1)).toBe(1);
    expect(readingTimeMinutes(-5)).toBe(1);
  });

  it('rounds to the nearest minute at 220 wpm', () => {
    expect(readingTimeMinutes(220)).toBe(1);
    expect(readingTimeMinutes(440)).toBe(2);
    expect(readingTimeMinutes(550)).toBe(3);
  });

  it('derives both values together', () => {
    const stats = deriveReadingStats(VALID_SEO_BODY);
    expect(stats.wordCount).toBeGreaterThan(0);
    expect(stats.readingTimeMinutes).toBe(readingTimeMinutes(stats.wordCount));
  });
});
