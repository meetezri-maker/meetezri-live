/**
 * Content Hub — PUBLIC SERIALIZER. The primary disclosure control.
 *
 * ALLOW-LISTS ONLY, AT THREE LEVELS. Never deny-lists — a deny-list makes every future field
 * public by default, and the one someone forgets is the one that leaks.
 *
 *   1. COLUMN level  — the read service never SELECTs `editorial`, approval states,
 *                      `scheduled_for`, `created_by`/`updated_by`, `deleted_at`,
 *                      `current_revision_number`, `tags` or `editorial_ref`.
 *   2. TYPE-FIELD    — `type_fields` passes through a per-content-type allow-list.
 *   3. BLOCK-FIELD   — each block type is rebuilt field by field, so internal fields inside a
 *                      PUBLIC block (`geo_statement.coreMessage`, `.citationGoal`) are dropped.
 *
 * NOTHING IS SPREAD. There is no `...block` or `...row` anywhere below: every emitted property is
 * written out by hand. That is what makes "an unknown future field is public by default"
 * impossible rather than merely unlikely.
 *
 * RLS DOES NOT HELP HERE. RLS filters rows, not fields — an anon SELECT on a published row would
 * still return `editorial`. This module is the field-level control, and `0012_content_hub_rls.sql`
 * says so explicitly.
 */

import {
  PUBLIC_CONTENT_BASE_PATH,
  PUBLIC_CONTENT_LABEL,
  isSafeExternalUrl,
  resolveRouteHref,
  resolveRouteLabel,
  type ContentType,
  type InlineContent,
} from '@meetezri/shared';
import type { PublicBlock, PublicCard, PublicDetail } from './content-hub.public.schema';

// ─── Inline content ──────────────────────────────────────────────────────────

/** Resolves an internal content id to its CURRENT slug, so a slug change never orphans a link. */
export type SlugResolver = (contentId: string) => string | null;

/** Marks are narrowed to the allow-list, not merely filtered — anything else is dropped. */
type PublicMark = 'bold' | 'italic' | 'code';
type PublicSpan = { text: string; marks?: PublicMark[]; link?: { href: string; external: boolean } };

function serializeInline(content: unknown, resolveSlug: SlugResolver): PublicSpan[] {
  if (!Array.isArray(content)) return [];

  const out: PublicSpan[] = [];

  for (const raw of content) {
    if (typeof raw !== 'object' || raw === null) continue;
    const span = raw as { text?: unknown; marks?: unknown; link?: { kind?: string; value?: string } };
    if (typeof span.text !== 'string') continue;

    const emitted: PublicSpan = { text: span.text };

    if (Array.isArray(span.marks)) {
      const marks = span.marks.filter(
        (m): m is PublicMark => m === 'bold' || m === 'italic' || m === 'code'
      );
      if (marks.length > 0) emitted.marks = marks;
    }

    const href = resolveLinkHref(span.link, resolveSlug);
    if (href) emitted.link = href;

    out.push(emitted);
  }

  return out;
}

function resolveLinkHref(
  link: { kind?: string; value?: string } | undefined,
  resolveSlug: SlugResolver
): { href: string; external: boolean } | null {
  if (!link || typeof link.value !== 'string') return null;

  if (link.kind === 'content') {
    const slug = resolveSlug(link.value);
    // An unpublished or missing target renders as plain text rather than a dead link.
    return slug ? { href: `${PUBLIC_CONTENT_BASE_PATH}/${slug}`, external: false } : null;
  }

  if (link.kind === 'route') {
    const href = resolveRouteHref(link.value);
    return href ? { href, external: false } : null;
  }

  if (link.kind === 'external') {
    // Unsafe protocols (javascript:, data:) are dropped, not escaped.
    return isSafeExternalUrl(link.value) ? { href: link.value, external: true } : null;
  }

  return null;
}

// ─── Blocks ──────────────────────────────────────────────────────────────────

export interface SerializeBodyContext {
  resolveSlug: SlugResolver;
  /** Cards for `related_content` blocks in `auto` mode. */
  relatedCards?: PublicCard[];
}

/**
 * Rebuild one block from an explicit field list.
 *
 * Returns `null` for unknown block types — an unrecognised type is dropped rather than passed
 * through, so a body written by a newer version cannot smuggle fields into a public response.
 */
function serializeBlock(raw: unknown, ctx: SerializeBodyContext): PublicBlock | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const block = raw as Record<string, any>;
  const id = typeof block.id === 'string' ? block.id : null;
  if (!id || typeof block.type !== 'string') return null;

  const inline = (value: unknown) => serializeInline(value, ctx.resolveSlug);

  switch (block.type) {
    case 'paragraph':
      return { id, type: 'paragraph', content: inline(block.content) };

    case 'heading':
      return {
        id,
        type: 'heading',
        level: typeof block.level === 'number' ? block.level : 2,
        content: inline(block.content),
        ...(typeof block.anchorId === 'string' ? { anchorId: block.anchorId } : {}),
      };

    case 'list':
      return {
        id,
        type: 'list',
        style: block.style === 'number' ? 'number' : 'bullet',
        items: Array.isArray(block.items) ? block.items.map(inline) : [],
      };

    case 'quote':
      return {
        id,
        type: 'quote',
        content: inline(block.content),
        ...(typeof block.attribution === 'string' ? { attribution: block.attribution } : {}),
      };

    case 'direct_answer':
      return { id, type: 'direct_answer', content: inline(block.content) };

    case 'key_takeaway':
      return {
        id,
        type: 'key_takeaway',
        ...(typeof block.title === 'string' ? { title: block.title } : {}),
        points: Array.isArray(block.points) ? block.points.map(inline) : [],
      };

    case 'safety_notice':
      return {
        id,
        type: 'safety_notice',
        variant: block.variant === 'crisis' ? 'crisis' : 'disclaimer',
        ...(typeof block.heading === 'string' ? { heading: block.heading } : {}),
        content: inline(block.content),
        ...(typeof block.showHotlines === 'boolean' ? { showHotlines: block.showHotlines } : {}),
      };

    case 'cta': {
      const target = block.target as { kind?: string; value?: string } | undefined;
      const resolved = resolveLinkHref(target, ctx.resolveSlug);
      // A CTA whose target does not resolve is dropped rather than rendered as a dead button.
      if (!resolved) return null;
      return {
        id,
        type: 'cta',
        label: typeof block.label === 'string' ? block.label : '',
        href: resolved.href,
        external: resolved.external,
        ...(typeof block.description === 'string' ? { description: block.description } : {}),
        ...(block.style === 'secondary' ? { style: 'secondary' as const } : {}),
      };
    }

    case 'image':
      if (typeof block.url !== 'string' || typeof block.alt !== 'string') return null;
      return {
        id,
        type: 'image',
        url: block.url,
        alt: block.alt,
        ...(block.caption ? { caption: inline(block.caption) } : {}),
        ...(typeof block.width === 'number' ? { width: block.width } : {}),
        ...(typeof block.height === 'number' ? { height: block.height } : {}),
        // `license` is deliberately not emitted in v1 — no UI consumes it yet.
        ...(typeof block.credit === 'string' ? { credit: block.credit } : {}),
      };

    case 'divider':
      return { id, type: 'divider' };

    case 'related_content':
      return {
        id,
        type: 'related_content',
        ...(typeof block.heading === 'string' ? { heading: block.heading } : {}),
        // Cards are supplied already-filtered to published items by the read service.
        items: ctx.relatedCards ?? [],
      };

    case 'faq':
      return {
        id,
        type: 'faq',
        ...(typeof block.heading === 'string' ? { heading: block.heading } : {}),
        items: Array.isArray(block.items)
          ? block.items
              .filter((item: any) => item && typeof item.question === 'string')
              .map((item: any) => ({
                id: typeof item.id === 'string' ? item.id : '',
                question: item.question,
                answer: inline(item.answer),
              }))
          : [],
      };

    case 'table':
      return {
        id,
        type: 'table',
        ...(typeof block.caption === 'string' ? { caption: block.caption } : {}),
        headers: Array.isArray(block.headers) ? block.headers.map((h: unknown) => String(h)) : [],
        rows: Array.isArray(block.rows)
          ? block.rows.map((row: unknown) => (Array.isArray(row) ? row.map(inline) : []))
          : [],
      };

    case 'geo_statement':
      // coreMessage and citationGoal are INTERNAL. They are not read here, so they cannot be
      // emitted — the block is rebuilt from the public fields only.
      return {
        id,
        type: 'geo_statement',
        statement: inline(block.statement),
        ...(Array.isArray(block.examples)
          ? { examples: block.examples.map((e: unknown) => String(e)) }
          : {}),
        ...(block.clarification ? { clarification: inline(block.clarification) } : {}),
      };

    case 'source':
      if (typeof block.url !== 'string' || !isSafeExternalUrl(block.url)) return null;
      return {
        id,
        type: 'source',
        label: typeof block.label === 'string' ? block.label : block.url,
        url: block.url,
        ...(typeof block.publisher === 'string' ? { publisher: block.publisher } : {}),
        ...(typeof block.accessedAt === 'string' ? { accessedAt: block.accessedAt } : {}),
      };

    default:
      // Unknown block type — dropped, never passed through.
      return null;
  }
}

/** Serialize the body, preserving block order and stable ids. */
export function serializeBody(body: unknown, ctx: SerializeBodyContext) {
  const envelope = body as { version?: unknown; blocks?: unknown } | null;
  const blocks = Array.isArray(envelope?.blocks) ? envelope!.blocks : [];

  return {
    version: typeof envelope?.version === 'number' ? envelope.version : 1,
    blocks: blocks
      .map((block) => serializeBlock(block, ctx))
      .filter((block): block is PublicBlock => block !== null),
  };
}

// ─── Type fields ─────────────────────────────────────────────────────────────

/**
 * Per-type public allow-list.
 *
 * Everything absent here is internal: AEO `supporting_queries` and `keywords`, GEO `core_concept`,
 * `supporting_concepts` and `topics`, and every SEO field (`word_count_target`, `funnel_stage`,
 * `keywords`) are all planning metadata and never reach a reader.
 */
export function serializeTypeFields(contentType: ContentType, typeFields: unknown) {
  const source = (typeof typeFields === 'object' && typeFields !== null ? typeFields : {}) as Record<
    string,
    unknown
  >;
  const out: Record<string, unknown> = {};

  if (contentType === 'aeo_answer') {
    if (typeof source.primary_question === 'string') out.primaryQuestion = source.primary_question;
    if (typeof source.snippet_answer === 'string') out.snippetAnswer = source.snippet_answer;
  }

  if (contentType === 'geo_article') {
    if (typeof source.citation_summary === 'string') out.citationSummary = source.citation_summary;
    if (Array.isArray(source.key_statements)) {
      out.keyStatements = source.key_statements.map((s) => String(s));
    }
  }

  // seo_blog exposes no type fields publicly — all of them are planning metadata.

  return out;
}

// ─── People ──────────────────────────────────────────────────────────────────

export interface ProfileLike {
  id: string;
  full_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  role?: string | null;
}

/**
 * Byline / reviewer credit.
 *
 * Emits name, bio and avatar only — never the email, the account id, or the platform role. The
 * `title` slot is reserved for a future editorial profile (plan §15.1) and is null in v1.
 */
export function serializePerson(profile: ProfileLike | null | undefined) {
  if (!profile || !profile.full_name) return null;
  return {
    name: profile.full_name,
    title: null,
    bio: typeof profile.bio === 'string' && profile.bio.trim() !== '' ? profile.bio : null,
    avatarUrl: typeof profile.avatar_url === 'string' ? profile.avatar_url : null,
  };
}

// ─── Cards ───────────────────────────────────────────────────────────────────

export interface CardSource {
  slug: string;
  content_type: string;
  title: string;
  meta_description: string | null;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  reading_time_minutes: number | null;
  published_at: Date | null;
  first_published_at?: Date | null;
}

export function serializeCard(row: CardSource): PublicCard {
  return {
    slug: row.slug,
    label: PUBLIC_CONTENT_LABEL[row.content_type as ContentType],
    title: row.title,
    description: row.meta_description,
    featuredImageUrl: row.featured_image_url,
    featuredImageAlt: row.featured_image_alt,
    readingTimeMinutes: row.reading_time_minutes,
    publishedAt: row.first_published_at ? row.first_published_at.toISOString() : null,
    updatedAt: row.published_at ? row.published_at.toISOString() : null,
  };
}

// ─── Links ───────────────────────────────────────────────────────────────────

export interface LinkSource {
  target_kind: string;
  target_content_id: string | null;
  target_route: string | null;
  anchor_text: string | null;
  relation: string;
  sort_order: number;
}

/**
 * Public links.
 *
 * Content targets resolve to their CURRENT slug; unresolvable targets (unpublished, deleted) are
 * dropped entirely, so a published page can never link into the editorial pipeline.
 */
export function serializeLinks(
  links: LinkSource[],
  resolveSlug: SlugResolver,
  resolveTitle: (contentId: string) => string | null
) {
  return links
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((link) => {
      if (link.target_kind === 'content' && link.target_content_id) {
        const slug = resolveSlug(link.target_content_id);
        if (!slug) return null;
        const label = link.anchor_text ?? resolveTitle(link.target_content_id) ?? slug;
        return { label, href: `${PUBLIC_CONTENT_BASE_PATH}/${slug}`, relation: link.relation };
      }

      if (link.target_kind === 'route' && link.target_route) {
        const href = resolveRouteHref(link.target_route);
        if (!href) return null;
        const label = link.anchor_text ?? resolveRouteLabel(link.target_route) ?? href;
        return { label, href, relation: link.relation };
      }

      return null;
    })
    .filter((link): link is { label: string; href: string; relation: string } => link !== null);
}

// ─── Detail ──────────────────────────────────────────────────────────────────

export interface DetailSource extends CardSource {
  body: unknown;
  type_fields: unknown;
  canonical_url_override: string | null;
  robots_directive: string;
  reviewed_at: Date | null;
}

export interface SerializeDetailInput {
  row: DetailSource;
  author: ProfileLike | null;
  reviewer: ProfileLike | null;
  links: LinkSource[];
  related: PublicCard[];
  resolveSlug: SlugResolver;
  resolveTitle: (contentId: string) => string | null;
  /** Preview forces `noindex,nofollow` regardless of the stored directive. */
  robotsOverride?: string;
}

/** Build the full public detail payload. Every property is written explicitly. */
export function serializeDetail(input: SerializeDetailInput): PublicDetail {
  const { row, resolveSlug, resolveTitle } = input;
  const contentType = row.content_type as ContentType;

  return {
    slug: row.slug,
    label: PUBLIC_CONTENT_LABEL[contentType],
    title: row.title,
    description: row.meta_description,
    canonicalPath: `${PUBLIC_CONTENT_BASE_PATH}/${row.slug}`,
    canonicalUrlOverride: row.canonical_url_override,
    robots: input.robotsOverride ?? row.robots_directive,
    featuredImageUrl: row.featured_image_url,
    featuredImageAlt: row.featured_image_alt,
    body: serializeBody(row.body, { resolveSlug, relatedCards: input.related }),
    typeFields: serializeTypeFields(contentType, row.type_fields),
    author: serializePerson(input.author),
    reviewer: serializePerson(input.reviewer),
    reviewedAt: row.reviewed_at ? row.reviewed_at.toISOString() : null,
    publishedAt: row.first_published_at ? row.first_published_at.toISOString() : null,
    updatedAt: row.published_at ? row.published_at.toISOString() : null,
    readingTimeMinutes: row.reading_time_minutes,
    links: serializeLinks(input.links, resolveSlug, resolveTitle),
    related: input.related,
  };
}
