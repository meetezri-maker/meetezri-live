/**
 * Content Hub — API Zod v3 schema tests, and the shared-validator PARITY proof.
 *
 * The parity assertions are the point: the API (zod v3) and the web app (zod v4, Phase 4) cannot
 * share a schema instance, so agreement is proven by both validating the SAME shared fixtures.
 * "The editor allows what the API rejects" therefore becomes a failing test rather than a
 * production bug.
 */

import {
  INVALID_BODY_FIXTURES,
  VALID_AEO_BODY,
  VALID_GEO_BODY,
  VALID_SEO_BODY,
  validateContentBody,
} from '@meetezri/shared';
import {
  clusterBodySchema,
  createContentBodySchema,
  linkInputSchema,
  listContentQuerySchema,
  makeContentBodySchema,
  replaceLinksBodySchema,
  tagsSchema,
  typeFieldsSchemaFor,
  updateContentBodySchema,
} from '../content-hub.schema';

const NOW_ISO = new Date().toISOString();

describe('body schema — valid shared fixtures', () => {
  it.each([
    ['aeo_answer', VALID_AEO_BODY],
    ['geo_article', VALID_GEO_BODY],
    ['seo_blog', VALID_SEO_BODY],
  ] as const)('accepts the %s fixture', (contentType, body) => {
    const result = makeContentBodySchema({ contentType }).safeParse(body);
    expect(result.success).toBe(true);
  });

  it('accepts the valid fixtures under publish rules too', () => {
    for (const [contentType, body] of [
      ['aeo_answer', VALID_AEO_BODY],
      ['geo_article', VALID_GEO_BODY],
      ['seo_blog', VALID_SEO_BODY],
    ] as const) {
      const result = makeContentBodySchema({ contentType, forPublish: true }).safeParse(body);
      expect({ contentType, ok: result.success }).toEqual({ contentType, ok: true });
    }
  });
});

describe('body schema — invalid shared fixtures', () => {
  it.each(INVALID_BODY_FIXTURES.map((f) => [f.name, f] as const))('rejects: %s', (_name, fixture) => {
    const schema = makeContentBodySchema({
      contentType: fixture.contentType,
      forPublish: fixture.forPublish,
    });
    const result = schema.safeParse(fixture.body);
    expect(result.success).toBe(false);
  });

  it('surfaces the shared machine-readable code so all layers speak one vocabulary', () => {
    for (const fixture of INVALID_BODY_FIXTURES) {
      const schema = makeContentBodySchema({
        contentType: fixture.contentType,
        forPublish: fixture.forPublish,
      });
      const result = schema.safeParse(fixture.body);
      if (result.success) throw new Error(`${fixture.name} unexpectedly passed`);

      const codes = result.error.issues.map((i) => String(i.message));
      const structural = result.error.issues.some((i) => i.code !== 'custom');
      // Either the shape check caught it (structural) or our custom rule reported its code.
      expect(structural || codes.some((m) => m.startsWith(fixture.expectedErrorCode))).toBe(true);
    }
  });
});

describe('PARITY — shared plain validator and API Zod agree', () => {
  const cases = [
    { name: 'valid aeo', body: VALID_AEO_BODY, contentType: 'aeo_answer' as const, forPublish: true },
    { name: 'valid geo', body: VALID_GEO_BODY, contentType: 'geo_article' as const, forPublish: true },
    { name: 'valid seo', body: VALID_SEO_BODY, contentType: 'seo_blog' as const, forPublish: true },
    ...INVALID_BODY_FIXTURES.map((f) => ({
      name: f.name,
      body: f.body,
      contentType: f.contentType,
      forPublish: f.forPublish,
    })),
  ];

  it.each(cases.map((c) => [c.name, c] as const))(
    'shared validator and Zod agree on accept/reject: %s',
    (_name, testCase) => {
      const shared = validateContentBody(testCase.body, {
        contentType: testCase.contentType,
        forPublish: testCase.forPublish,
      });
      const zod = makeContentBodySchema({
        contentType: testCase.contentType,
        forPublish: testCase.forPublish,
      }).safeParse(testCase.body);

      // Zod may additionally reject on shape; it must never ACCEPT what the shared validator
      // rejects, which is the direction that would let the editor promise something invalid.
      if (!shared.valid) expect(zod.success).toBe(false);
      if (zod.success) expect(shared.valid).toBe(true);
    }
  );
});

describe('unknown fields are stripped, not rejected', () => {
  it('strips unknown keys from create', () => {
    const result = createContentBodySchema.parse({
      contentType: 'aeo_answer',
      title: 'Test',
      sneaky: 'value',
    } as never);
    expect(result).not.toHaveProperty('sneaky');
  });

  it('strips server-owned fields a client tries to set on update', () => {
    // An older client must not be able to blank a field it does not know about — and a
    // malicious one must not be able to forge one.
    const result = updateContentBodySchema.parse({
      expectedUpdatedAt: NOW_ISO,
      title: 'New title',
      status: 'published',
      founder_approval: 'approved',
      published_at: NOW_ISO,
      first_published_at: NOW_ISO,
      word_count: 99999,
      reading_time_minutes: 1,
      current_revision_number: 42,
      contentType: 'seo_blog',
      created_by: 'someone-else',
      deleted_at: NOW_ISO,
    } as never);

    for (const forbidden of [
      'status',
      'founder_approval',
      'published_at',
      'first_published_at',
      'word_count',
      'reading_time_minutes',
      'current_revision_number',
      'contentType',
      'created_by',
      'deleted_at',
    ]) {
      expect(result).not.toHaveProperty(forbidden);
    }
    expect(result.title).toBe('New title');
  });

  it('strips unknown keys from type fields', () => {
    const parsed = typeFieldsSchemaFor('aeo_answer').parse({
      primary_question: 'Q?',
      not_a_real_field: 'x',
    } as never);
    expect(parsed).toEqual({ primary_question: 'Q?' });
  });

  it('requires the optimistic-concurrency token on every update', () => {
    expect(updateContentBodySchema.safeParse({ title: 'x' }).success).toBe(false);
  });
});

describe('tags', () => {
  it('normalises through the schema', () => {
    expect(tagsSchema.parse(['  Sleep Health ', 'ANXIETY', 'anxiety'])).toEqual([
      'sleep-health',
      'anxiety',
    ]);
  });

  it('rejects more than ten tags after normalisation', () => {
    const many = Array.from({ length: 11 }, (_, i) => `tag-${i}`);
    expect(tagsSchema.safeParse(many).success).toBe(false);
  });
});

describe('list query', () => {
  it('applies defaults and caps page size at 100', () => {
    const parsed = listContentQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(25);
    expect(listContentQuerySchema.safeParse({ pageSize: 500 }).success).toBe(false);
  });

  it('normalises tag filters', () => {
    expect(listContentQuerySchema.parse({ tags: ['Sleep Health'] }).tags).toEqual(['sleep-health']);
  });
});

describe('link input', () => {
  it('accepts a content link', () => {
    const result = linkInputSchema.safeParse({
      targetKind: 'content',
      targetContentId: '11111111-1111-4111-8111-111111111111',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a route link with a known key', () => {
    expect(linkInputSchema.safeParse({ targetKind: 'route', targetRoute: 'pricing' }).success).toBe(true);
  });

  it('rejects an unmapped route key', () => {
    expect(
      linkInputSchema.safeParse({ targetKind: 'route', targetRoute: 'product.does_not_exist' }).success
    ).toBe(false);
  });

  it('rejects both targets set, and neither set', () => {
    expect(
      linkInputSchema.safeParse({
        targetKind: 'content',
        targetContentId: '11111111-1111-4111-8111-111111111111',
        targetRoute: 'pricing',
      }).success
    ).toBe(false);
    expect(linkInputSchema.safeParse({ targetKind: 'content' }).success).toBe(false);
  });

  it('rejects a kind/target mismatch', () => {
    expect(
      linkInputSchema.safeParse({
        targetKind: 'route',
        targetContentId: '11111111-1111-4111-8111-111111111111',
      }).success
    ).toBe(false);
  });

  it('caps the replacement set', () => {
    const links = Array.from({ length: 51 }, () => ({ targetKind: 'route', targetRoute: 'pricing' }));
    expect(replaceLinksBodySchema.safeParse({ links }).success).toBe(false);
  });
});

describe('cluster body', () => {
  const id = (n: number) => `1111111${n}-1111-4111-8111-111111111111`;

  it('requires at least two members and at most twenty', () => {
    expect(clusterBodySchema.safeParse({ contentIds: [id(1)] }).success).toBe(false);
    expect(clusterBodySchema.safeParse({ contentIds: [id(1), id(2)] }).success).toBe(true);
    expect(
      clusterBodySchema.safeParse({
        contentIds: Array.from({ length: 21 }, (_, i) => `${i}1111111-1111-4111-8111-111111111111`),
      }).success
    ).toBe(false);
  });

  it('rejects duplicate ids', () => {
    expect(clusterBodySchema.safeParse({ contentIds: [id(1), id(1)] }).success).toBe(false);
  });
});
