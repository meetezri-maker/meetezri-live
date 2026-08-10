/**
 * Regression: "Could not load content" on the admin editor.
 *
 * WHAT HAPPENED. The Week 1 import called `replaceLinks` directly and stored relations (`cta`,
 * `reference`) that are not in `LINK_RELATIONS`. The route BODY schema would have rejected them,
 * but the service did not, so they persisted. `adminContentDetailSchema` — which Fastify uses to
 * validate the RESPONSE of `GET /api/admin/content/:id` — does contain the enum, so every read of
 * those records failed response validation and returned 500. The editor rendered its generic
 * "Could not load this content."
 *
 * The list endpoint was unaffected because it does not include links, and the public/preview
 * serializer was unaffected because `publicLinkSchema.relation` is a plain string. That is why
 * the Phase 5B preview verification passed while the editor was broken.
 *
 * These tests assert the two halves of the fix at the boundary that actually failed:
 *   1. the response schema accepts a realistically incomplete, in-review, Week-1-shaped record;
 *   2. the service refuses to persist a relation the response schema cannot serialise.
 */

import { LINK_RELATIONS, type ContentType } from '@meetezri/shared';
import { adminContentDetailSchema } from '../content-hub.schema';
import { WEEK1_ASSETS } from '../week1/week1-content';

/** A detail payload shaped exactly like what `getContent` returns for an imported Week 1 item. */
function detailFor(ref: string) {
  const asset = WEEK1_ASSETS.find((a) => a.editorialRef === ref)!;

  return {
    id: '26ee725d-d6e3-44b9-9093-ab70084d925b',
    editorialRef: asset.editorialRef,
    contentType: asset.contentType as ContentType,
    publicLabel: asset.publicLabel,
    slug: asset.slug,
    title: asset.title,
    // The state Phase 5B left them in.
    status: 'in_review' as const,
    approvals: { founder: 'pending', marketing: 'pending', seo: 'pending' },
    schedule: { scheduled: false, overdue: false },
    scheduledFor: null,
    tags: asset.tags,
    pillar: asset.pillar,
    week: asset.week,
    // Deliberately unresolved by the import — the editor must open regardless.
    author: null,
    readingTimeMinutes: 6,
    wordCount: 1302,
    publishedAt: null,
    updatedAt: '2026-08-09T10:00:00.000Z',
    createdAt: '2026-08-09T09:00:00.000Z',
    metaDescription: asset.metaDescription,
    featuredImageUrl: null,
    featuredImageAlt: null,
    body: asset.body,
    typeFields: asset.typeFields,
    editorial: asset.editorial,
    canonicalUrlOverride: null,
    robotsDirective: 'index,follow',
    reviewer: null,
    reviewedAt: null,
    firstPublishedAt: null,
    currentRevisionNumber: 1,
    createdBy: '6874e034-a3e9-45a0-835f-cfe21fdda65d',
    updatedBy: '6874e034-a3e9-45a0-835f-cfe21fdda65d',
    links: asset.links.map((link, index) => ({
      id: `0000000${index}-0000-4000-8000-00000000000${index}`,
      targetKind: link.targetKind,
      targetContentId: link.targetKind === 'content' ? '4085de42-9b76-4b42-b73d-4cdfaf0b3b3e' : null,
      targetRoute: link.targetRoute ?? null,
      anchorText: link.anchorText,
      relation: link.relation,
      sortOrder: index,
      targetTitle: link.targetKind === 'content' ? 'Another Week 1 item' : null,
      targetSlug: link.targetKind === 'content' ? 'another-week-1-item' : null,
      targetStatus: link.targetKind === 'content' ? ('in_review' as const) : null,
      targetPublicLabel: link.targetKind === 'content' ? 'Insight' : null,
      routeLabel: link.targetKind === 'route' ? 'Talk It Out' : null,
      routeHref: link.targetKind === 'route' ? '/how-it-works' : null,
    })),
    approvalActors: [],
  };
}

describe('the admin detail response schema accepts real Week 1 records', () => {
  it.each([
    ['W1-A001 (Answer, 30 blocks, 5 FAQs, 4 links)', 'W1-A001'],
    ['W1-G001 (Insight, geo_statement blocks with internal fields, 4 links)', 'W1-G001'],
    ['W1-B001 (Article, 133 blocks, 6 FAQs, 5 links, null meta description)', 'W1-B001'],
  ])('serialises %s', (_label, ref) => {
    const result = adminContentDetailSchema.safeParse(detailFor(ref));

    // On failure, surface the offending paths rather than a bare `false`.
    const issues = result.success
      ? []
      : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);

    expect({ ref, issues }).toEqual({ ref, issues: [] });
  });

  it('accepts a null author and a null reviewer', () => {
    const detail = { ...detailFor('W1-A001'), author: null, reviewer: null };
    expect(adminContentDetailSchema.safeParse(detail).success).toBe(true);
  });

  it('accepts a null meta description on an incomplete item', () => {
    const detail = { ...detailFor('W1-B001'), metaDescription: null };
    expect(detail.metaDescription).toBeNull();
    expect(adminContentDetailSchema.safeParse(detail).success).toBe(true);
  });

  it('accepts the in_review status', () => {
    const detail = detailFor('W1-G001');
    expect(detail.status).toBe('in_review');
    expect(adminContentDetailSchema.safeParse(detail).success).toBe(true);
  });

  it('accepts the 133-block body without truncation', () => {
    const detail = detailFor('W1-B001');
    expect((detail.body as { blocks: unknown[] }).blocks).toHaveLength(133);
    expect(adminContentDetailSchema.safeParse(detail).success).toBe(true);
  });

  it('REJECTS the exact relation values that broke production', () => {
    // The guard for the original bug: if either string ever becomes storable again, the editor
    // breaks the same way, and this test is what says so.
    for (const bad of ['cta', 'reference']) {
      const detail = detailFor('W1-A001');
      detail.links[1] = { ...detail.links[1], relation: bad };
      expect({ bad, accepted: adminContentDetailSchema.safeParse(detail).success }).toEqual({
        bad,
        accepted: false,
      });
    }
  });
});

describe('the Week 1 mapping only uses relations the response schema can serialise', () => {
  it('uses valid relations on every link of every asset', () => {
    for (const asset of WEEK1_ASSETS) {
      for (const link of asset.links) {
        expect({
          ref: asset.editorialRef,
          relation: link.relation,
          valid: (LINK_RELATIONS as readonly string[]).includes(link.relation),
        }).toEqual({ ref: asset.editorialRef, relation: link.relation, valid: true });
      }
    }
  });

  it('maps each destination to its matching relation', () => {
    const expected: Record<string, string> = {
      'product.talk_it_out': 'product',
      resource_library: 'resource_library',
      pricing: 'pricing',
    };
    for (const asset of WEEK1_ASSETS) {
      for (const link of asset.links.filter((l) => l.targetKind === 'route')) {
        expect({ key: link.targetRoute, relation: link.relation }).toEqual({
          key: link.targetRoute,
          relation: expected[link.targetRoute!],
        });
      }
    }
    for (const asset of WEEK1_ASSETS) {
      for (const link of asset.links.filter((l) => l.targetKind === 'content')) {
        expect(link.relation).toBe('related_content');
      }
    }
  });
});

/**
 * The service is the seam BOTH the HTTP route and any script go through, so the check has to
 * live there. Before the fix only the route body schema validated `relation`, which is why the
 * import — calling the service directly — could write a row no reader could ever return.
 *
 * Prisma is mocked so this exercises the guard's real behaviour without a database: the only
 * query before the check is the existence lookup.
 */
const mockPrisma = {
  content_items: { findFirst: jest.fn(), findMany: jest.fn() },
  content_links: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn(),
};

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

describe('replaceLinks refuses a relation the reader cannot serialise', () => {
  const SOURCE_ID = '26ee725d-d6e3-44b9-9093-ab70084d925b';
  const actor = { id: '6874e034-a3e9-45a0-835f-cfe21fdda65d', role: 'super_admin' as const };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.content_items.findFirst.mockResolvedValue({ id: SOURCE_ID });
  });

  const routeLink = (relation: string) => [
    {
      targetKind: 'route' as const,
      targetContentId: null,
      targetRoute: 'product.talk_it_out',
      anchorText: 'Talk It Out',
      relation,
      sortOrder: 0,
    },
  ];

  it.each(['cta', 'reference'])('rejects "%s" — the value that broke production', async (bad) => {
    const { replaceLinks } = await import('../content-hub.service');

    await expect(replaceLinks(SOURCE_ID, routeLink(bad) as never, actor)).rejects.toMatchObject({
      code: 'INVALID_LINK',
    });

    // And nothing was written.
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.content_links.createMany).not.toHaveBeenCalled();
  });

  it('names the offending relation and the permitted set in the error', async () => {
    const { replaceLinks } = await import('../content-hub.service');

    await expect(replaceLinks(SOURCE_ID, routeLink('cta') as never, actor)).rejects.toThrow(
      /Unknown link relation: cta.*related_content/s
    );
  });

  it('accepts every relation the enum permits', async () => {
    const { replaceLinks } = await import('../content-hub.service');
    mockPrisma.$transaction.mockResolvedValue(undefined);
    mockPrisma.content_links.findMany.mockResolvedValue([]);

    for (const relation of LINK_RELATIONS) {
      jest.clearAllMocks();
      mockPrisma.content_items.findFirst.mockResolvedValue({ id: SOURCE_ID });
      mockPrisma.$transaction.mockResolvedValue(undefined);

      await replaceLinks(SOURCE_ID, routeLink(relation) as never, actor);
      expect({ relation, wrote: mockPrisma.$transaction.mock.calls.length > 0 }).toEqual({
        relation,
        wrote: true,
      });
    }
  });
});
