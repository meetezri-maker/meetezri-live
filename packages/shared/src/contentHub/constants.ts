/**
 * Content Hub — domain constants.
 *
 * ZOD-FREE BY CONTRACT. Nothing under `contentHub/` may import zod: `packages/shared` depends on
 * zod v3 while `apps/web` uses v4, so a schema instance exported from here would put two zod
 * runtimes in one bundle. The API (v3) and the web app (v4) each build their own schemas from
 * these types and validate against the shared fixtures. See CONTENT_HUB_IMPLEMENTATION_PLAN.md
 * §2.4.1.
 */

/** Internal content types. Never rendered publicly — see `PUBLIC_CONTENT_LABEL`. */
export const CONTENT_TYPES = ['aeo_answer', 'geo_article', 'seo_blog'] as const;

/**
 * Lifecycle statuses. Exactly seven.
 *
 * There is deliberately no `scheduled` status: scheduling is `status === 'approved'` with a
 * non-null `scheduled_for`, surfaced as a derived badge. An eighth value would split
 * "editorially ready" across two states that could drift apart.
 */
export const CONTENT_STATUSES = [
  'draft',
  'in_review',
  'changes_requested',
  'approved',
  'published',
  'unpublished',
  'archived',
] as const;

/** Per-gate approval state. */
export const APPROVAL_STATES = ['pending', 'approved', 'changes_requested'] as const;

/**
 * Approval gates required before publication.
 *
 * `safety` is intentionally ABSENT: the fourth safety/clinical gate is recommended in the plan
 * (§8.9) but stakeholder sign-off was not recorded as of Phase 1. Adding it later is additive —
 * one entry here, one column, one checklist rule.
 */
export const APPROVAL_GATES = ['founder', 'marketing', 'seo'] as const;

/** Robots directives an item may carry. */
export const ROBOTS_DIRECTIVES = ['index,follow', 'noindex,follow', 'noindex,nofollow'] as const;

/** Why a revision was captured. */
export const REVISION_TRIGGERS = ['manual_save', 'transition', 'restore'] as const;

/** What a content link points at. */
export const LINK_TARGET_KINDS = ['content', 'route'] as const;

/** Editorial intent of a link. */
export const LINK_RELATIONS = ['related_content', 'product', 'resource_library', 'pricing'] as const;

/**
 * Internal type -> public label. The ONLY place this mapping exists.
 *
 * No component may render `content_type` directly; doing so is how "AEO"/"GEO"/"SEO" leaks onto
 * the public site.
 */
export const PUBLIC_CONTENT_LABEL = {
  aeo_answer: 'Answer',
  geo_article: 'Insight',
  seo_blog: 'Article',
} as const;

/** Public route namespace for published content. */
export const PUBLIC_CONTENT_BASE_PATH = '/resources';

/** Slugs that may not be used, because they would collide with current or foreseeable routes. */
export const RESERVED_SLUGS = [
  'index',
  'new',
  'search',
  'page',
  'feed',
  'rss',
  'sitemap',
  'admin',
  'api',
  'preview',
  'all',
  'tag',
  'category',
] as const;

/** Document, tag and inline limits enforced by the shared validators. */
export const CONTENT_LIMITS = {
  maxBlocks: 500,
  maxInlineSpans: 200,
  maxFaqBlocks: 1,
  maxSafetyNoticeBlocks: 2,
  maxCtaBlocks: 3,
  maxDirectAnswerBlocks: 1,
  maxTags: 10,
  maxTagLength: 32,
  maxSlugLength: 80,
  minMetaDescription: 50,
  maxMetaDescription: 160,
  /** Average adult reading speed, words per minute. */
  wordsPerMinute: 220,
} as const;

/** Link protocols permitted in inline content and source blocks. */
export const ALLOWED_LINK_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'] as const;

/** Protocols rejected outright — these are the XSS vectors. */
export const BLOCKED_LINK_PROTOCOLS = ['javascript:', 'data:', 'vbscript:', 'file:'] as const;

/** Current structured-body envelope version. */
export const CONTENT_BODY_VERSION = 1;
