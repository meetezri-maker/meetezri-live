/**
 * Content Hub — public serializer tests.
 *
 * The serializer is the PRIMARY disclosure control, so these tests are deliberately paranoid.
 * The headline assertion is the SENTINEL LEAK GUARD: every internal field is filled with a unique
 * string, the payload is serialized, and the whole JSON is searched for any of them.
 */

import {
  INTERNAL_SENTINELS,
  SENTINEL_BODY,
  VALID_AEO_BODY,
  VALID_GEO_BODY,
} from '@meetezri/shared';
import {
  serializeBody,
  serializeCard,
  serializeDetail,
  serializeLinks,
  serializePerson,
  serializeTypeFields,
} from '../content-hub.serializer';
import { publicDetailSchema } from '../content-hub.public.schema';

const resolveSlug = (id: string) => (id === 'known-id' ? 'a-known-slug' : null);
const resolveTitle = (id: string) => (id === 'known-id' ? 'A Known Title' : null);

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'test-slug',
    content_type: 'geo_article',
    title: 'Test title',
    meta_description: 'A description that is long enough to be plausible for a meta tag.',
    featured_image_url: null,
    featured_image_alt: null,
    reading_time_minutes: 3,
    published_at: new Date('2026-08-01T10:00:00.000Z'),
    first_published_at: new Date('2026-07-01T10:00:00.000Z'),
    body: SENTINEL_BODY,
    type_fields: {},
    canonical_url_override: null,
    robots_directive: 'index,follow',
    reviewed_at: null,
    ...overrides,
  } as never;
}

describe('SENTINEL LEAK GUARD', () => {
  it('emits no internal sentinel value anywhere in the public payload', () => {
    const detail = serializeDetail({
      row: baseRow({
        type_fields: {
          // Internal type fields, all sentinelled.
          core_concept: INTERNAL_SENTINELS.coreConcept,
          supporting_concepts: [INTERNAL_SENTINELS.supportingQuery],
          topics: { primary: INTERNAL_SENTINELS.editorialStrategy },
          // One genuinely public field, to prove the allow-list lets the right thing through.
          citation_summary: 'This summary is public.',
          key_statements: ['A public statement.'],
        },
      }),
      author: null,
      reviewer: null,
      links: [],
      related: [],
      resolveSlug,
      resolveTitle,
    });

    const json = JSON.stringify(detail);

    for (const [name, sentinel] of Object.entries(INTERNAL_SENTINELS)) {
      expect({ name, leaked: json.includes(sentinel) }).toEqual({ name, leaked: false });
    }

    // And the public fields DID survive — otherwise this test would pass trivially.
    expect(json).toContain('This summary is public.');
    expect(json).toContain('A public statement.');
  });

  it('drops geo_statement internal fields while keeping the public ones', () => {
    const body = serializeBody(SENTINEL_BODY, { resolveSlug });
    const geo = body.blocks.find((b) => b.type === 'geo_statement') as Record<string, unknown>;

    expect(geo).toBeDefined();
    expect(geo).not.toHaveProperty('coreMessage');
    expect(geo).not.toHaveProperty('citationGoal');
    expect(geo).toHaveProperty('statement');
  });

  it('never emits editorial, tags, approvals, status or editorial_ref', () => {
    const detail = serializeDetail({
      row: baseRow(),
      author: null,
      reviewer: null,
      links: [],
      related: [],
      resolveSlug,
      resolveTitle,
    });

    for (const forbidden of [
      'editorial',
      'tags',
      'status',
      'founder_approval',
      'marketing_approval',
      'seo_approval',
      'scheduled_for',
      'editorial_ref',
      'editorialRef',
      'created_by',
      'updated_by',
      'deleted_at',
      'current_revision_number',
      'id',
    ]) {
      expect(detail).not.toHaveProperty(forbidden);
    }
  });

  it('never emits the internal content type string', () => {
    const detail = serializeDetail({
      row: baseRow(),
      author: null,
      reviewer: null,
      links: [],
      related: [],
      resolveSlug,
      resolveTitle,
    });
    const json = JSON.stringify(detail);

    for (const internal of ['aeo_answer', 'geo_article', 'seo_blog']) {
      expect(json).not.toContain(internal);
    }
    expect(detail.label).toBe('Insight');
  });

  it('emits no AEO/GEO/SEO terminology in user-visible text', () => {
    const detail = serializeDetail({
      row: baseRow({ content_type: 'aeo_answer', body: VALID_AEO_BODY }),
      author: null,
      reviewer: null,
      links: [],
      related: [],
      resolveSlug,
      resolveTitle,
    });

    // Field NAMES are internal API surface; the check targets rendered VALUES.
    const values: string[] = [];
    const walk = (node: unknown) => {
      if (typeof node === 'string') values.push(node);
      else if (Array.isArray(node)) node.forEach(walk);
      else if (node && typeof node === 'object') Object.values(node).forEach(walk);
    };
    walk(detail);

    for (const value of values) {
      expect(value).not.toMatch(/\b(aeo|geo|seo)\b/i);
    }
  });
});

describe('type field allow-list', () => {
  it('exposes only the public AEO fields', () => {
    const out = serializeTypeFields('aeo_answer', {
      primary_question: 'What should I do?',
      snippet_answer: 'Try expressing it.',
      supporting_queries: ['internal'],
      keywords: { primary: 'internal' },
    });
    expect(out).toEqual({ primaryQuestion: 'What should I do?', snippetAnswer: 'Try expressing it.' });
  });

  it('exposes only the public GEO fields', () => {
    const out = serializeTypeFields('geo_article', {
      core_concept: 'internal',
      supporting_concepts: ['internal'],
      topics: { primary: 'internal' },
      citation_summary: 'public summary',
      key_statements: ['one', 'two'],
    });
    expect(out).toEqual({ citationSummary: 'public summary', keyStatements: ['one', 'two'] });
  });

  it('exposes NO type fields for SEO — all of them are planning metadata', () => {
    expect(
      serializeTypeFields('seo_blog', {
        keywords: { primary: 'x' },
        word_count_target: '2,200–2,500',
        funnel_stage: 'Awareness',
      })
    ).toEqual({});
  });

  it('drops unknown future fields by default', () => {
    expect(serializeTypeFields('geo_article', { some_future_internal_field: 'secret' })).toEqual({});
  });
});

describe('URL safety', () => {
  it('drops javascript: and data: links rather than rendering them', () => {
    const body = serializeBody(
      {
        version: 1,
        blocks: [
          {
            id: 'b1',
            type: 'paragraph',
            content: [
              { text: 'safe' },
              { text: 'bad', link: { kind: 'external', value: 'javascript:alert(1)' } },
              { text: 'also bad', link: { kind: 'external', value: 'data:text/html,<script>' } },
            ],
          },
        ],
      },
      { resolveSlug }
    );

    const spans = (body.blocks[0] as { content: Array<{ link?: unknown }> }).content;
    expect(spans).toHaveLength(3);
    expect(spans.every((s) => s.link === undefined)).toBe(true);
  });

  it('keeps safe external links', () => {
    const body = serializeBody(
      {
        version: 1,
        blocks: [
          {
            id: 'b1',
            type: 'paragraph',
            content: [{ text: 'ok', link: { kind: 'external', value: 'https://example.com' } }],
          },
        ],
      },
      { resolveSlug }
    );
    const span = (body.blocks[0] as { content: Array<{ link?: { href: string; external: boolean } }> }).content[0];
    expect(span.link).toEqual({ href: 'https://example.com', external: true });
  });

  it('drops a source block with an unsafe url', () => {
    const body = serializeBody(
      { version: 1, blocks: [{ id: 'b1', type: 'source', label: 'x', url: 'javascript:alert(1)' }] },
      { resolveSlug }
    );
    expect(body.blocks).toHaveLength(0);
  });

  it('drops an unknown block type rather than passing it through', () => {
    const body = serializeBody(
      { version: 1, blocks: [{ id: 'b1', type: 'future_block', secret: 'internal' }] },
      { resolveSlug }
    );
    expect(body.blocks).toHaveLength(0);
    expect(JSON.stringify(body)).not.toContain('internal');
  });
});

describe('link resolution', () => {
  it('resolves content links to the CURRENT slug', () => {
    const links = serializeLinks(
      [
        {
          target_kind: 'content',
          target_content_id: 'known-id',
          target_route: null,
          anchor_text: 'Read this',
          relation: 'related_content',
          sort_order: 0,
        },
      ],
      resolveSlug,
      resolveTitle
    );
    expect(links).toEqual([{ label: 'Read this', href: '/resources/a-known-slug', relation: 'related_content' }]);
  });

  it('drops links to unresolvable (unpublished) targets', () => {
    const links = serializeLinks(
      [
        {
          target_kind: 'content',
          target_content_id: 'draft-id',
          target_route: null,
          anchor_text: 'Hidden',
          relation: 'related_content',
          sort_order: 0,
        },
      ],
      resolveSlug,
      resolveTitle
    );
    expect(links).toEqual([]);
  });

  it('resolves route links through the shared registry, including the interim mapping', () => {
    const links = serializeLinks(
      [
        {
          target_kind: 'route',
          target_content_id: null,
          target_route: 'product.talk_it_out',
          anchor_text: null,
          relation: 'product',
          sort_order: 0,
        },
      ],
      resolveSlug,
      resolveTitle
    );
    expect(links).toEqual([{ label: 'Talk It Out', href: '/how-it-works', relation: 'product' }]);
  });

  it('drops an unmapped route key', () => {
    const links = serializeLinks(
      [
        {
          target_kind: 'route',
          target_content_id: null,
          target_route: 'product.nope',
          anchor_text: null,
          relation: 'product',
          sort_order: 0,
        },
      ],
      resolveSlug,
      resolveTitle
    );
    expect(links).toEqual([]);
  });

  it('preserves sort order', () => {
    const links = serializeLinks(
      [
        { target_kind: 'route', target_content_id: null, target_route: 'pricing', anchor_text: 'B', relation: 'pricing', sort_order: 2 },
        { target_kind: 'route', target_content_id: null, target_route: 'home', anchor_text: 'A', relation: 'product', sort_order: 1 },
      ],
      resolveSlug,
      resolveTitle
    );
    expect(links.map((l) => l.label)).toEqual(['A', 'B']);
  });
});

describe('people', () => {
  it('emits name, bio and avatar only — never email or role', () => {
    const person = serializePerson({
      id: 'p1',
      full_name: 'Dr Example',
      bio: 'A bio.',
      avatar_url: 'https://example.com/a.png',
      role: 'super_admin',
    });
    expect(person).toEqual({
      name: 'Dr Example',
      title: null,
      bio: 'A bio.',
      avatarUrl: 'https://example.com/a.png',
    });
    expect(JSON.stringify(person)).not.toContain('super_admin');
  });

  it('returns null when there is no name to show', () => {
    expect(serializePerson(null)).toBeNull();
    expect(serializePerson({ id: 'p1', full_name: null })).toBeNull();
  });
});

describe('body ordering and identity', () => {
  it('preserves block order and stable ids', () => {
    const body = serializeBody(VALID_AEO_BODY, { resolveSlug });
    const sourceIds = VALID_AEO_BODY.blocks.map((b) => b.id);
    const outIds = body.blocks.map((b) => b.id);
    // The CTA targets an existing route key, so every block survives.
    expect(outIds).toEqual(sourceIds);
  });
});

describe('cards and schema conformance', () => {
  it('serializes a card with the public label', () => {
    const card = serializeCard({
      slug: 's',
      content_type: 'aeo_answer',
      title: 'T',
      meta_description: 'D',
      featured_image_url: null,
      featured_image_alt: null,
      reading_time_minutes: 2,
      published_at: new Date('2026-08-01T00:00:00.000Z'),
      first_published_at: new Date('2026-07-01T00:00:00.000Z'),
    });
    expect(card.label).toBe('Answer');
    expect(card.publishedAt).toBe('2026-07-01T00:00:00.000Z');
    expect(card.updatedAt).toBe('2026-08-01T00:00:00.000Z');
  });

  it('produces a payload the public response schema accepts', () => {
    // Fastify validates responses, so this is the last line of defence in production too.
    const detail = serializeDetail({
      row: baseRow({ content_type: 'geo_article', body: VALID_GEO_BODY }),
      author: { id: 'a', full_name: 'Author', bio: null, avatar_url: null },
      reviewer: null,
      links: [],
      related: [],
      resolveSlug,
      resolveTitle,
    });
    const result = publicDetailSchema.safeParse(detail);
    if (!result.success) throw new Error(JSON.stringify(result.error.issues, null, 2));
    expect(result.success).toBe(true);
  });
});
