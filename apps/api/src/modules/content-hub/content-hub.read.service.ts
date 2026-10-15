/**
 * Content Hub — PUBLIC READ SEAM.
 *
 * ============================================================================
 * HARD RULE: THIS FILE CONTAINS THE ONLY PRISMA READS FOR PUBLIC OUTPUT.
 * ============================================================================
 *
 * No public route, serializer, related-content resolver, preview handler, sitemap builder or
 * (Phase 8) SSR renderer may query `content_items` for public output by any other path. A direct
 * `prisma.content_items.findFirst()` in a public code path is a review-blocking defect, not a
 * style preference — see CONTENT_HUB_IMPLEMENTATION_PLAN.md §8.3.2, and the guard test in
 * `__tests__/content-hub.architecture.test.ts` which asserts this file is the sole call site.
 *
 * WHY IT MATTERS: v1 serves published content from the LIVE row (published items are edited
 * live — plan §8.3). v2 will serve the published REVISION SNAPSHOT instead. That upgrade is a
 * change inside `loadPublishedRow` alone; the renderer, templates, schemas and API contract do
 * not move. Every bypass is a place that migration would silently keep serving live rows.
 *
 * COLUMN-LEVEL ALLOW-LIST: the `select` blocks below are the first of the serializer's three
 * layers. `editorial`, approval states, `scheduled_for`, `tags`, `editorial_ref`, `created_by`,
 * `updated_by`, `deleted_at` and `current_revision_number` are never selected, so they cannot be
 * leaked by a downstream mistake.
 */

import {
  PUBLIC_CONTENT_LABEL,
  relatedClusterSlugs,
  type ContentType,
} from '@meetezri/shared';
import prisma from '../../lib/prisma';
import {
  serializeCard,
  serializeDetail,
  type CardSource,
  type DetailSource,
  type LinkSource,
} from './content-hub.serializer';
import type { PublicCard, PublicDetail } from './content-hub.public.schema';

/** Published + not deleted. The ONLY definition of "publicly visible". */
const PUBLIC_WHERE = { status: 'published', deleted_at: null } as const;

/** Card columns. No body, no internal fields. */
const CARD_SELECT = {
  slug: true,
  content_type: true,
  title: true,
  meta_description: true,
  featured_image_url: true,
  featured_image_alt: true,
  reading_time_minutes: true,
  published_at: true,
  first_published_at: true,
} as const;

/** Detail columns — cards plus the public body and rendering metadata. */
const DETAIL_SELECT = {
  ...CARD_SELECT,
  id: true,
  pillar: true,
  body: true,
  type_fields: true,
  canonical_url_override: true,
  robots_directive: true,
  reviewed_at: true,
} as const;

export interface PublicListQuery {
  page: number;
  pageSize: number;
  /** Public label — mapped to the internal type here, never accepted as an internal string. */
  type?: string;
}

export interface PublicListResult {
  items: PublicCard[];
  total: number;
  page: number;
  pageSize: number;
}

/** Public label -> internal type. The public API never accepts an internal type string. */
function internalTypeForLabel(label: string | undefined): ContentType | undefined {
  if (!label) return undefined;
  const entry = (Object.entries(PUBLIC_CONTENT_LABEL) as Array<[ContentType, string]>).find(
    ([, value]) => value === label
  );
  return entry?.[0];
}

/**
 * Published list, newest first.
 *
 * There is deliberately no `status` parameter: published-only is a property of this function, not
 * a client-supplied filter that could be widened by a crafted query string.
 */
export async function resolvePublishedList(query: PublicListQuery): Promise<PublicListResult> {
  const contentType = internalTypeForLabel(query.type);
  const where = { ...PUBLIC_WHERE, ...(contentType ? { content_type: contentType } : {}) };
  const take = Math.min(Math.max(query.pageSize, 1), 24);
  const skip = (Math.max(query.page, 1) - 1) * take;

  const [rows, total] = await Promise.all([
    prisma.content_items.findMany({
      where,
      select: CARD_SELECT,
      orderBy: [{ published_at: 'desc' }, { title: 'asc' }],
      take,
      skip,
    }),
    prisma.content_items.count({ where }),
  ]);

  return {
    items: rows.map((row) => serializeCard(row as CardSource)),
    total,
    page: query.page,
    pageSize: take,
  };
}

interface LoadedRow {
  id: string;
  pillar: string | null;
  detail: DetailSource;
}

/**
 * Load one publicly-visible row.
 *
 * THE V2 SWITCH POINT. To serve the published revision snapshot instead of the live row, change
 * this function and nothing else.
 *
 * `allowUnpublished` exists solely for the authenticated admin preview endpoint. It is not
 * reachable from any public route.
 */
async function loadPublishedRow(
  slug: string,
  options: { allowUnpublished?: boolean } = {}
): Promise<LoadedRow | null> {
  const row = await prisma.content_items.findFirst({
    where: options.allowUnpublished ? { slug, deleted_at: null } : { slug, ...PUBLIC_WHERE },
    select: DETAIL_SELECT,
  });

  if (!row) return null;

  return {
    id: row.id,
    pillar: row.pillar,
    detail: row as unknown as DetailSource,
  };
}

/** Same loader, keyed by id. Used only by the admin preview endpoint. */
async function loadRowById(id: string): Promise<LoadedRow | null> {
  const row = await prisma.content_items.findFirst({
    where: { id, deleted_at: null },
    select: DETAIL_SELECT,
  });
  if (!row) return null;
  return {
    id: row.id,
    pillar: row.pillar,
    detail: row as unknown as DetailSource,
  };
}

/**
 * Related resources.
 *
 * Order: manual links -> approved slug cluster -> same pillar for an unclustered legacy item.
 * There is deliberately no latest-published fallback: fewer recommendations are more useful than
 * filling a card row with a topically unrelated article.
 */
export async function resolveRelated(
  contentId: string,
  slug: string,
  pillar: string | null,
  limit = 3
): Promise<PublicCard[]> {
  const cap = Math.min(Math.max(limit, 1), 3);
  const seen = new Set<string>([contentId]);
  const cards: PublicCard[] = [];
  const isIndexable = (robots: string | null) =>
    !String(robots ?? 'index,follow').toLowerCase().includes('noindex');
  const relatedSelect = { ...CARD_SELECT, id: true, robots_directive: true } as const;

  const manualLinks = await prisma.content_links.findMany({
    where: { source_id: contentId, target_kind: 'content', relation: 'related_content' },
    orderBy: { sort_order: 'asc' },
    select: { target_content_id: true },
  });

  const manualIds = manualLinks
    .map((l) => l.target_content_id)
    .filter((id): id is string => !!id && !seen.has(id));

  if (manualIds.length > 0) {
    const rows = await prisma.content_items.findMany({
      where: { id: { in: manualIds }, ...PUBLIC_WHERE },
      select: relatedSelect,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const id of manualIds) {
      const row = byId.get(id);
      if (!row || !isIndexable(row.robots_directive)) continue;
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      cards.push(serializeCard(row as unknown as CardSource));
      if (cards.length >= cap) break;
    }
  }

  const clusterSlugs = relatedClusterSlugs(slug);
  if (cards.length < cap && clusterSlugs.length > 0) {
    const rows = await prisma.content_items.findMany({
      where: { slug: { in: clusterSlugs }, id: { notIn: [...seen] }, ...PUBLIC_WHERE },
      select: relatedSelect,
    });
    const bySlug = new Map(rows.map((row) => [row.slug, row]));
    for (const candidateSlug of clusterSlugs) {
      const row = bySlug.get(candidateSlug);
      if (!row || !isIndexable(row.robots_directive)) continue;
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      cards.push(serializeCard(row as unknown as CardSource));
      if (cards.length >= cap) break;
    }
  }

  // Legacy content not yet assigned to a cluster may use its exact pillar as the final relevance
  // proxy. Clustered items never broaden back out to pillar/latest merely to fill three cards.
  if (cards.length < cap && clusterSlugs.length === 0 && pillar) {
    const rows = await prisma.content_items.findMany({
      where: { pillar, id: { notIn: [...seen] }, ...PUBLIC_WHERE },
      select: relatedSelect,
      orderBy: { published_at: 'desc' },
    });
    for (const row of rows) {
      if (!isIndexable(row.robots_directive)) continue;
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      cards.push(serializeCard(row as unknown as CardSource));
      if (cards.length >= cap) break;
    }
  }

  return cards.slice(0, cap);
}

/** Batch-resolve link targets to their current slug/title, published only. */
async function loadLinkTargets(links: LinkSource[]) {
  const ids = links
    .filter((l) => l.target_kind === 'content' && l.target_content_id)
    .map((l) => l.target_content_id as string);

  if (ids.length === 0) return new Map<string, { slug: string; title: string }>();

  const rows = await prisma.content_items.findMany({
    where: { id: { in: ids }, ...PUBLIC_WHERE },
    select: { id: true, slug: true, title: true, robots_directive: true },
  });

  return new Map(
    rows
      .filter((row) => !row.robots_directive.toLowerCase().includes('noindex'))
      .map((row) => [row.id, { slug: row.slug, title: row.title }])
  );
}

async function buildDetail(loaded: LoadedRow, robotsOverride?: string): Promise<PublicDetail> {
  const links = (await prisma.content_links.findMany({
    where: { source_id: loaded.id },
    orderBy: { sort_order: 'asc' },
    select: {
      target_kind: true,
      target_content_id: true,
      target_route: true,
      anchor_text: true,
      relation: true,
      sort_order: true,
    },
  })) as LinkSource[];

  const [targets, related] = await Promise.all([
    loadLinkTargets(links),
    resolveRelated(loaded.id, loaded.detail.slug, loaded.pillar, 3),
  ]);

  return serializeDetail({
    row: loaded.detail,
    author: null,
    reviewer: null,
    links,
    related,
    resolveSlug: (id) => targets.get(id)?.slug ?? null,
    resolveTitle: (id) => targets.get(id)?.title ?? null,
    robotsOverride,
  });
}

/**
 * THE public detail entry point.
 *
 * Returns `null` for anything not published — draft, in_review, approved, unpublished, archived
 * or soft-deleted. The caller renders 404, never 403: a 403 confirms the item exists and leaks
 * the editorial pipeline.
 */
export async function resolvePublishedContent(slug: string): Promise<PublicDetail | null> {
  const loaded = await loadPublishedRow(slug);
  return loaded ? buildDetail(loaded) : null;
}

/** Related-only variant, so the detail payload stays independently cacheable. */
export async function resolvePublishedRelated(slug: string, limit: number): Promise<PublicCard[] | null> {
  const loaded = await loadPublishedRow(slug);
  return loaded ? resolveRelated(loaded.id, loaded.detail.slug, loaded.pillar, limit) : null;
}

/** A sitemap row: a public card plus the stored robots directive that decides inclusion. */
export interface SitemapRow extends PublicCard {
  robots: string;
}

/**
 * Every publicly-listable resource, for `/sitemap.xml`.
 *
 * Unpaginated by design — a sitemap is the whole set — but capped, because an unbounded query in
 * a serverless function is how a sitemap route becomes an outage. 5,000 URLs is well inside the
 * 50,000-entry sitemap limit and far beyond the foreseeable content volume; if it is ever
 * reached, the answer is a sitemap index, not a bigger number here.
 *
 * `noindex` items are filtered HERE rather than by the caller, so the exclusion travels with the
 * read seam and cannot be forgotten by a second consumer.
 */
export async function resolveSitemapEntries(): Promise<SitemapRow[]> {
  const rows = await prisma.content_items.findMany({
    where: PUBLIC_WHERE,
    select: { ...CARD_SELECT, robots_directive: true },
    orderBy: [{ published_at: 'desc' }, { title: 'asc' }],
    take: 5000,
  });

  return rows
    .filter((row) => !String(row.robots_directive ?? 'index,follow').toLowerCase().includes('noindex'))
    .map((row) => ({
      ...serializeCard(row as CardSource),
      robots: String(row.robots_directive ?? 'index,follow'),
    }));
}

/**
 * Admin preview.
 *
 * Runs the REAL serializer over non-published content, so previewing also proves nothing internal
 * leaks. Forces `noindex,nofollow` regardless of the stored directive. Authorization is the
 * route's responsibility; this function never appears on a public route.
 */
export async function resolvePreviewContent(id: string): Promise<PublicDetail | null> {
  const loaded = await loadRowById(id);
  return loaded ? buildDetail(loaded, 'noindex,nofollow') : null;
}
