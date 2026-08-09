/**
 * Public delivery against REAL PostgreSQL.
 *
 * Proves the whole path end to end:
 *
 *     database row → public read seam → serializer → shared renderer → HTML
 *
 * The unit tests hand the renderer a hand-written fixture. These hand it whatever the database
 * and the serializer actually produce, which is the only way to catch a column that stopped being
 * selected, a serializer field that changed name, or a status filter that stopped filtering.
 *
 * Nothing is mocked.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { VALID_AEO_BODY, VALID_GEO_BODY, VALID_SEO_BODY } from '@meetezri/shared';
import prisma from '../../../lib/prisma';
import {
  setApprovalGate,
  transitionContent,
} from '../../content-hub/content-hub.publish.service';
import {
  createContent,
  replaceLinks,
  updateContent,
  type Actor,
} from '../../content-hub/content-hub.service';
import { renderRoutes } from '../render.routes';
import { resetAssetManifestCache } from '../assetManifest';
import { ALL_SENTINELS, FORBIDDEN_TERMS } from './fixtures';

jest.setTimeout(60_000);

const createdContentIds: string[] = [];
const createdProfileIds: string[] = [];

let SUPER: Actor;
let app: FastifyInstance;

async function makeProfile(): Promise<string> {
  const id = randomUUID();
  await prisma.users.create({
    data: { id, email: `render-${id.slice(0, 8)}@integration.test`, is_sso_user: false, is_anonymous: false },
  });
  // `select` is required — `profiles.signup_source` is declared in schema.prisma but created by
  // no Prisma migration (documented drift; see test-integration/factories.ts).
  await prisma.profiles.create({
    data: { id, email: `render-${id.slice(0, 8)}@integration.test`, full_name: 'Render Tester' },
    select: { id: true },
  });
  createdProfileIds.push(id);
  return id;
}

type ContentType = 'aeo_answer' | 'geo_article' | 'seo_blog';

async function newDraft(contentType: ContentType, title: string) {
  const created = await createContent({ contentType, title } as never, SUPER);
  createdContentIds.push(created.id);
  return created;
}

async function currentUpdatedAt(id: string) {
  const row = await prisma.content_items.findUniqueOrThrow({ where: { id } });
  return row.updated_at.toISOString();
}

/**
 * A fully populated draft.
 *
 * Every internal field carries a SENTINEL, so the disclosure assertions are checking real stored
 * data rather than a fixture that merely claims to have internal values.
 */
async function seedDraft(contentType: ContentType, title: string) {
  const draft = await newDraft(contentType, title);

  const body =
    contentType === 'aeo_answer'
      ? VALID_AEO_BODY
      : contentType === 'geo_article'
        ? VALID_GEO_BODY
        : VALID_SEO_BODY;

  const typeFields =
    contentType === 'aeo_answer'
      ? {
          primary_question: 'What should I do?',
          snippet_answer: 'Express what you are carrying.',
          featured_snippet_target: 'SENTINEL-KPI-TARGET',
        }
      : contentType === 'geo_article'
        ? {
            core_concept: 'Talking helps',
            citation_summary: 'A citable summary.',
            key_statements: ['One.'],
          }
        : {};

  await updateContent(
    draft.id,
    {
      metaDescription: 'A meta description that is comfortably inside the fifty to one sixty range.',
      body,
      typeFields,
      authorId: SUPER.id,
      // Unique per item — `editorial_ref` has a unique constraint — but keeps the sentinel as a
      // prefix, so a `not.toContain('W1-SENTINEL-REF')` assertion still catches a leak.
      editorialRef: `W1-SENTINEL-REF-${randomUUID().slice(0, 8)}`,
      tags: ['sentinel-internal-tag'],
      editorial: {
        editorial_notes: 'SENTINEL-INTERNAL-EDITORIAL-NOTE',
        kpi_target: 'SENTINEL-KPI-TARGET',
      },
      expectedUpdatedAt: await currentUpdatedAt(draft.id),
      createRevision: false,
    } as never,
    SUPER
  );

  return draft.id;
}

async function approve(id: string) {
  await transitionContent(id, 'submit', SUPER);
  for (const gate of ['founder', 'marketing', 'seo'] as const) {
    await setApprovalGate(id, gate, 'approved', SUPER);
  }
}

async function publish(id: string) {
  await approve(id);
  await transitionContent(id, 'publish', SUPER);
}

beforeAll(async () => {
  process.env.PUBLIC_SITE_ORIGIN = 'https://meetezri.com';
  SUPER = { id: await makeProfile(), role: 'super_admin' };

  app = Fastify();
  await app.register(renderRoutes);
  await app.ready();
});

afterAll(async () => {
  await app.close();
  if (createdContentIds.length > 0) {
    await prisma.content_links.deleteMany({ where: { source_id: { in: createdContentIds } } });
    await prisma.content_items.deleteMany({ where: { id: { in: createdContentIds } } });
  }
  if (createdProfileIds.length > 0) {
    await prisma.audit_logs.deleteMany({ where: { actor_id: { in: createdProfileIds } } });
    await prisma.profiles.deleteMany({ where: { id: { in: createdProfileIds } } });
    await prisma.users.deleteMany({ where: { id: { in: createdProfileIds } } });
  }
});

beforeEach(() => resetAssetManifestCache());

// ─── Published content of each type ──────────────────────────────────────────

describe('a published Answer', () => {
  let slug: string;

  beforeAll(async () => {
    const id = await seedDraft('aeo_answer', `Answer Render ${randomUUID().slice(0, 8)}`);
    await publish(id);
    slug = (await prisma.content_items.findUniqueOrThrow({ where: { id } })).slug;
  });

  it('renders complete HTML with a 200', async () => {
    const response = await app.inject({ method: 'GET', url: `/resources/${slug}` });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('<h1>');
    expect(response.body).toContain('Answer Render');
    expect(response.body).toContain('<link rel="canonical"');
    expect(response.body).toContain('"@type":"Article"');
  });

  it('shows the public label, never the internal type', async () => {
    const { body } = await app.inject({ method: 'GET', url: `/resources/${slug}` });

    expect(body).toContain('class="sol-label">Answer</p>');
    for (const term of FORBIDDEN_TERMS) {
      expect({ term, present: body.includes(term) }).toEqual({ term, present: false });
    }
  });

  it.each(ALL_SENTINELS)('leaks no sentinel (%s) into the HTML', async (sentinel) => {
    const { body } = await app.inject({ method: 'GET', url: `/resources/${slug}` });
    expect(body).not.toContain(sentinel);
  });

  it('appears in the sitemap', async () => {
    const { body } = await app.inject({ method: 'GET', url: '/sitemap.xml' });
    expect(body).toContain(`<loc>https://meetezri.com/resources/${slug}</loc>`);
  });

  it('appears on the index and in the Answers filter', async () => {
    const all = await app.inject({ method: 'GET', url: '/resources' });
    expect(all.body).toContain(`href="/resources/${slug}"`);

    const answers = await app.inject({ method: 'GET', url: '/resources?type=Answer' });
    expect(answers.body).toContain(`href="/resources/${slug}"`);

    const articles = await app.inject({ method: 'GET', url: '/resources?type=Article' });
    expect(articles.body).not.toContain(`href="/resources/${slug}"`);
  });
});

describe('a published Insight', () => {
  let slug: string;

  beforeAll(async () => {
    const id = await seedDraft('geo_article', `Insight Render ${randomUUID().slice(0, 8)}`);
    await publish(id);
    slug = (await prisma.content_items.findUniqueOrThrow({ where: { id } })).slug;
  });

  it('renders as an Insight with an Article schema', async () => {
    const { statusCode, body } = await app.inject({ method: 'GET', url: `/resources/${slug}` });

    expect(statusCode).toBe(200);
    expect(body).toContain('class="sol-label">Insight</p>');
    expect(body).toContain('"@type":"Article"');
    expect(body).not.toContain('"@type":"BlogPosting"');
  });

  it('never renders the internal GEO statement fields', async () => {
    const { body } = await app.inject({ method: 'GET', url: `/resources/${slug}` });

    expect(body).not.toContain('coreMessage');
    expect(body).not.toContain('core_message');
    expect(body).not.toContain('citationGoal');
    expect(body).not.toContain('citation_goal');
  });
});

describe('a published Article', () => {
  let slug: string;

  beforeAll(async () => {
    const id = await seedDraft('seo_blog', `Article Render ${randomUUID().slice(0, 8)}`);
    await publish(id);
    slug = (await prisma.content_items.findUniqueOrThrow({ where: { id } })).slug;
  });

  it('renders as an Article with a BlogPosting schema', async () => {
    const { statusCode, body } = await app.inject({ method: 'GET', url: `/resources/${slug}` });

    expect(statusCode).toBe(200);
    expect(body).toContain('class="sol-label">Article</p>');
    expect(body).toContain('"@type":"BlogPosting"');
  });

  it('never says "SEO Article" or names the internal strategy', async () => {
    const { body } = await app.inject({ method: 'GET', url: `/resources/${slug}` });
    expect(body).not.toMatch(/SEO Article/i);
    expect(body).not.toContain('seo_blog');
  });
});

// ─── Everything that must NOT be public ──────────────────────────────────────

describe('unpublished states all return a real 404', () => {
  async function slugFor(id: string) {
    return (await prisma.content_items.findUniqueOrThrow({ where: { id } })).slug;
  }

  it('404s a draft', async () => {
    const id = await seedDraft('aeo_answer', `Draft Never Public ${randomUUID().slice(0, 8)}`);
    const response = await app.inject({ method: 'GET', url: `/resources/${await slugFor(id)}` });

    expect(response.statusCode).toBe(404);
    expect(response.body).not.toContain('Draft Never Public');
  });

  it('404s an approved-but-unpublished item', async () => {
    const id = await seedDraft('aeo_answer', `Approved Not Live ${randomUUID().slice(0, 8)}`);
    await approve(id);

    const response = await app.inject({ method: 'GET', url: `/resources/${await slugFor(id)}` });
    expect(response.statusCode).toBe(404);
  });

  it('404s an item that was published and then unpublished', async () => {
    const id = await seedDraft('aeo_answer', `Pulled Back ${randomUUID().slice(0, 8)}`);
    await publish(id);
    const slug = await slugFor(id);

    expect((await app.inject({ method: 'GET', url: `/resources/${slug}` })).statusCode).toBe(200);

    await transitionContent(id, 'unpublish', SUPER);

    expect((await app.inject({ method: 'GET', url: `/resources/${slug}` })).statusCode).toBe(404);
  });

  it('404s an archived item', async () => {
    const id = await seedDraft('aeo_answer', `Archived Item ${randomUUID().slice(0, 8)}`);
    await transitionContent(id, 'archive', SUPER);

    const response = await app.inject({ method: 'GET', url: `/resources/${await slugFor(id)}` });
    expect(response.statusCode).toBe(404);
  });

  it('404s a soft-deleted item', async () => {
    const id = await seedDraft('aeo_answer', `Deleted Item ${randomUUID().slice(0, 8)}`);
    await publish(id);
    const slug = await slugFor(id);

    await prisma.content_items.update({ where: { id }, data: { deleted_at: new Date() } });

    expect((await app.inject({ method: 'GET', url: `/resources/${slug}` })).statusCode).toBe(404);
  });

  it('404s a slug that never existed', async () => {
    const response = await app.inject({ method: 'GET', url: '/resources/no-such-slug-anywhere' });
    expect(response.statusCode).toBe(404);
  });

  it('keeps every unpublished state out of the index and the sitemap', async () => {
    const draftId = await seedDraft('aeo_answer', `Hidden From Lists ${randomUUID().slice(0, 8)}`);
    const draftSlug = await slugFor(draftId);

    const index = await app.inject({ method: 'GET', url: '/resources' });
    const sitemap = await app.inject({ method: 'GET', url: '/sitemap.xml' });

    expect(index.body).not.toContain(draftSlug);
    expect(sitemap.body).not.toContain(draftSlug);
  });
});

describe('a noindex published resource', () => {
  it('renders, but is excluded from the sitemap', async () => {
    const id = await seedDraft('aeo_answer', `Quiet Resource ${randomUUID().slice(0, 8)}`);
    await publish(id);
    await prisma.content_items.update({
      where: { id },
      data: { robots_directive: 'noindex,follow' },
    });
    const slug = (await prisma.content_items.findUniqueOrThrow({ where: { id } })).slug;

    const page = await app.inject({ method: 'GET', url: `/resources/${slug}` });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('<meta name="robots" content="noindex,follow"/>');

    const sitemap = await app.inject({ method: 'GET', url: '/sitemap.xml' });
    expect(sitemap.body).not.toContain(`/resources/${slug}<`);
  });
});

// ─── Links, related content and CTAs ─────────────────────────────────────────

describe('links and related content', () => {
  it('renders a managed-content link to the target’s current slug', async () => {
    const targetId = await seedDraft('geo_article', `Link Target ${randomUUID().slice(0, 8)}`);
    await publish(targetId);
    const targetSlug = (await prisma.content_items.findUniqueOrThrow({ where: { id: targetId } })).slug;

    const sourceId = await seedDraft('aeo_answer', `Link Source ${randomUUID().slice(0, 8)}`);
    await replaceLinks(
      sourceId,
      [
        {
          targetKind: 'content',
          targetContentId: targetId,
          targetRoute: null,
          anchorText: 'Read the insight',
          relation: 'related_content',
          sortOrder: 0,
        },
      ] as never,
      SUPER
    );
    await publish(sourceId);
    const sourceSlug = (await prisma.content_items.findUniqueOrThrow({ where: { id: sourceId } })).slug;

    const { body } = await app.inject({ method: 'GET', url: `/resources/${sourceSlug}` });

    // The link resolves to a slug, never to an internal id — which is what lets a rename be safe.
    expect(body).toContain(`/resources/${targetSlug}`);
    expect(body).not.toContain(targetId);
  });

  it('renders at most three related resources', async () => {
    const id = await seedDraft('aeo_answer', `Related Host ${randomUUID().slice(0, 8)}`);
    await publish(id);
    const slug = (await prisma.content_items.findUniqueOrThrow({ where: { id } })).slug;

    const { body } = await app.inject({ method: 'GET', url: `/resources/${slug}` });
    const relatedSection = body.split('related-heading')[1] ?? '';
    const cards = relatedSection.match(/class="sol-card"/g) ?? [];

    expect(cards.length).toBeLessThanOrEqual(3);
  });

  it('renders a route CTA through the shared registry', async () => {
    // VALID_AEO_BODY carries a CTA targeting `product.talk_it_out`, whose interim mapping is
    // `/how-it-works`. Phase 5A does not build `/talk-it-out`, so this must still resolve.
    const id = await seedDraft('aeo_answer', `Route CTA ${randomUUID().slice(0, 8)}`);
    await publish(id);
    const slug = (await prisma.content_items.findUniqueOrThrow({ where: { id } })).slug;

    const { body } = await app.inject({ method: 'GET', url: `/resources/${slug}` });

    expect(body).toContain('href="/how-it-works"');
    expect(body).not.toContain('product.talk_it_out');
    expect(body).not.toContain('/talk-it-out');
  });
});

// ─── Parity over real data ───────────────────────────────────────────────────

describe('bot and human parity over real data', () => {
  it('serves identical HTML to Chrome, GPTBot, ClaudeBot, PerplexityBot and Googlebot', async () => {
    const id = await seedDraft('seo_blog', `Parity Check ${randomUUID().slice(0, 8)}`);
    await publish(id);
    const slug = (await prisma.content_items.findUniqueOrThrow({ where: { id } })).slug;

    const agents = [
      'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
      'Mozilla/5.0 (compatible; GPTBot/1.1; +https://openai.com/gptbot)',
      'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
      'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    ];

    const bodies: string[] = [];
    for (const ua of agents) {
      const response = await app.inject({
        method: 'GET',
        url: `/resources/${slug}`,
        headers: { 'user-agent': ua },
      });
      expect(response.statusCode).toBe(200);
      bodies.push(response.body);
    }

    expect(new Set(bodies).size).toBe(1);
  });
});
