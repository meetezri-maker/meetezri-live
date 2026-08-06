/**
 * Content Hub — framework-independent validation and derivation helpers.
 *
 * The single source of truth for every document-level rule. The API (zod v3) and the web app
 * (zod v4) both call these from `.superRefine()`, so the drift-prone logic exists exactly once
 * and only primitive field-shape checks are duplicated.
 *
 * NO DEPENDENCIES: no zod, React, Prisma, Fastify, DOM or browser APIs. Pure functions only.
 */

import {
  ALLOWED_LINK_PROTOCOLS,
  BLOCKED_LINK_PROTOCOLS,
  CONTENT_BODY_VERSION,
  CONTENT_LIMITS,
  CONTENT_STATUSES,
  CONTENT_TYPES,
  PUBLIC_CONTENT_LABEL,
  RESERVED_SLUGS,
} from './constants';
import {
  TYPE_RESTRICTED_BLOCKS,
  type ContentBlock,
  type ContentBody,
  type InlineContent,
} from './blocks';
import type { ContentType, PublicContentLabel } from './types';
import { isRouteKey } from './routeRegistry';

// ─── Result shape ────────────────────────────────────────────────────────────

export interface ValidationIssue {
  /** Stable machine-readable code, e.g. `direct_answer.not_first`. */
  code: string;
  message: string;
  /** Dotted path to the offending value, e.g. `blocks[3].items`. */
  path?: string;
  /** Block id, when the issue belongs to a specific block. */
  blockId?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

function ok(errors: ValidationIssue[], warnings: ValidationIssue[]): ValidationResult {
  return { valid: errors.length === 0, errors, warnings };
}

// ─── Labels & enums ──────────────────────────────────────────────────────────

/** The only supported way to turn an internal type into public-facing text. */
export function publicLabelFor(contentType: ContentType): PublicContentLabel {
  return PUBLIC_CONTENT_LABEL[contentType];
}

export function isContentType(value: unknown): value is ContentType {
  return typeof value === 'string' && (CONTENT_TYPES as readonly string[]).includes(value);
}

export function isContentStatus(value: unknown): boolean {
  return typeof value === 'string' && (CONTENT_STATUSES as readonly string[]).includes(value);
}

// ─── URLs ────────────────────────────────────────────────────────────────────

/**
 * Whether an external URL is safe to render.
 *
 * Parsed rather than pattern-matched, so `JaVaScRiPt:`, whitespace padding and encoded variants
 * are all normalised by the URL parser before the protocol is checked.
 */
export function isSafeExternalUrl(value: unknown): boolean {
  if (typeof value !== 'string' || value.trim() === '') return false;

  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return false;
  }

  const protocol = parsed.protocol.toLowerCase();
  if ((BLOCKED_LINK_PROTOCOLS as readonly string[]).includes(protocol)) return false;
  return (ALLOWED_LINK_PROTOCOLS as readonly string[]).includes(protocol);
}

/** Absolute http/https only — used for `source.url` and `canonical_url_override`. */
export function isAbsoluteHttpUrl(value: unknown): boolean {
  if (typeof value !== 'string' || value.trim() === '') return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Whether an image URL is hosted somewhere we permit.
 *
 * The caller supplies the allow-list because the API knows the Supabase host and the web app
 * knows its origin; hard-coding either here would be wrong in one of them.
 */
export function isAllowedImageUrl(value: unknown, allowedHosts: readonly string[]): boolean {
  if (!isAbsoluteHttpUrl(value)) return false;
  try {
    const host = new URL(String(value).trim()).host.toLowerCase();
    return allowedHosts.some((allowed) => host === allowed.toLowerCase());
  } catch {
    return false;
  }
}

// ─── Slugs ───────────────────────────────────────────────────────────────────

/**
 * Normalise arbitrary text into a slug.
 *
 * Accents are stripped via NFD decomposition rather than a character map, so this behaves for
 * any Latin-script input rather than only the ones someone remembered to list.
 */
export function normaliseSlug(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, CONTENT_LIMITS.maxSlugLength)
    .replace(/-$/, '');
}

export function isReservedSlug(slug: string): boolean {
  return (RESERVED_SLUGS as readonly string[]).includes(slug);
}

export type SlugRejectionReason = 'empty' | 'reserved' | 'invalid';

/**
 * Validate an already-normalised slug.
 *
 * Deliberately does NOT check database availability — that needs a query and belongs to the
 * service layer.
 */
export function validateSlug(slug: string): { valid: boolean; reason?: SlugRejectionReason } {
  if (typeof slug !== 'string' || slug.length === 0) return { valid: false, reason: 'empty' };

  const normalised = normaliseSlug(slug);

  // Input that normalises to nothing at all ("   ", "!!!") reports `empty` rather than `invalid`:
  // "your slug is blank" is actionable, "your slug is malformed" is not.
  if (normalised === '') return { valid: false, reason: 'empty' };

  if (slug !== normalised) return { valid: false, reason: 'invalid' };
  if (isReservedSlug(slug)) return { valid: false, reason: 'reserved' };
  return { valid: true };
}

// ─── Tags ────────────────────────────────────────────────────────────────────

/**
 * Normalise a tag list.
 *
 * Normalising on write means `Anxiety`, `anxiety ` and `ANXIETY` converge, which is what makes a
 * future migration into a term table a `SELECT DISTINCT unnest(tags)` rather than a data-cleaning
 * project. First-occurrence order is preserved because order is editorial signal.
 */
export function normaliseTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const tag = raw
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, CONTENT_LIMITS.maxTagLength)
      .replace(/-$/, '');

    if (tag === '' || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }

  return out;
}

/** Validate a tag list that has already been normalised. */
export function validateTags(tags: unknown): ValidationResult {
  const errors: ValidationIssue[] = [];

  if (!Array.isArray(tags)) {
    errors.push({ code: 'tags.not_array', message: 'Tags must be an array.', path: 'tags' });
    return ok(errors, []);
  }

  if (tags.length > CONTENT_LIMITS.maxTags) {
    errors.push({
      code: 'tags.too_many',
      message: `At most ${CONTENT_LIMITS.maxTags} tags are allowed.`,
      path: 'tags',
    });
  }

  tags.forEach((tag, index) => {
    if (typeof tag !== 'string') {
      errors.push({ code: 'tags.not_string', message: 'Each tag must be a string.', path: `tags[${index}]` });
      return;
    }
    if (tag.length > CONTENT_LIMITS.maxTagLength) {
      errors.push({
        code: 'tags.too_long',
        message: `Tags may be at most ${CONTENT_LIMITS.maxTagLength} characters.`,
        path: `tags[${index}]`,
      });
    }
    if (tag !== normaliseTags([tag])[0]) {
      errors.push({
        code: 'tags.not_normalised',
        message: 'Tag is not in canonical form.',
        path: `tags[${index}]`,
      });
    }
  });

  if (new Set(tags).size !== tags.length) {
    errors.push({ code: 'tags.duplicate', message: 'Duplicate tags are not allowed.', path: 'tags' });
  }

  return ok(errors, []);
}

// ─── Inline content ──────────────────────────────────────────────────────────

function validateInlineContent(
  content: unknown,
  path: string,
  blockId: string,
  errors: ValidationIssue[]
): void {
  if (!Array.isArray(content)) {
    errors.push({ code: 'inline.not_array', message: 'Inline content must be an array of spans.', path, blockId });
    return;
  }

  if (content.length > CONTENT_LIMITS.maxInlineSpans) {
    errors.push({
      code: 'inline.too_many_spans',
      message: `At most ${CONTENT_LIMITS.maxInlineSpans} inline spans are allowed.`,
      path,
      blockId,
    });
  }

  content.forEach((span, index) => {
    if (typeof span !== 'object' || span === null || typeof (span as { text?: unknown }).text !== 'string') {
      errors.push({ code: 'inline.invalid_span', message: 'Each span must have text.', path: `${path}[${index}]`, blockId });
      return;
    }

    const link = (span as { link?: { kind?: string; value?: string } }).link;
    if (!link) return;

    if (link.kind === 'external' && !isSafeExternalUrl(link.value)) {
      errors.push({
        code: 'inline.unsafe_link',
        message: 'External links must use http, https, mailto or tel.',
        path: `${path}[${index}].link`,
        blockId,
      });
    }
    if (link.kind === 'route' && !isRouteKey(link.value)) {
      errors.push({
        code: 'inline.unknown_route',
        message: `Unknown route key: ${String(link.value)}`,
        path: `${path}[${index}].link`,
        blockId,
      });
    }
  });
}

// ─── Word count & reading time ───────────────────────────────────────────────

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

function inlineText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  return content
    .map((span) =>
      typeof span === 'object' && span !== null && typeof (span as { text?: unknown }).text === 'string'
        ? (span as { text: string }).text
        : ''
    )
    .join(' ');
}

/**
 * Words a reader actually reads.
 *
 * Deliberately EXCLUDES internal fields (`coreMessage`, `citationGoal`), block ids, URLs and
 * image metadata — none of which is read. Including them would inflate reading time and make the
 * SEO word-count target meaningless.
 */
export function countBodyWords(body: unknown): number {
  const blocks = (body as ContentBody | undefined)?.blocks;
  if (!Array.isArray(blocks)) return 0;

  let words = 0;

  for (const block of blocks as ContentBlock[]) {
    switch (block.type) {
      case 'paragraph':
      case 'quote':
      case 'direct_answer':
        words += countWords(inlineText(block.content));
        break;
      case 'heading':
        words += countWords(inlineText(block.content));
        break;
      case 'list':
        for (const item of block.items ?? []) words += countWords(inlineText(item));
        break;
      case 'key_takeaway':
        if (block.title) words += countWords(block.title);
        for (const point of block.points ?? []) words += countWords(inlineText(point));
        break;
      case 'safety_notice':
        if (block.heading) words += countWords(block.heading);
        words += countWords(inlineText(block.content));
        break;
      case 'cta':
        words += countWords(block.label ?? '');
        if (block.description) words += countWords(block.description);
        break;
      case 'faq':
        if (block.heading) words += countWords(block.heading);
        for (const item of block.items ?? []) {
          words += countWords(item.question ?? '');
          words += countWords(inlineText(item.answer));
        }
        break;
      case 'table':
        if (block.caption) words += countWords(block.caption);
        for (const header of block.headers ?? []) words += countWords(header);
        for (const row of block.rows ?? []) for (const cell of row) words += countWords(inlineText(cell));
        break;
      case 'geo_statement':
        // PUBLIC fields only. coreMessage and citationGoal are internal and are not read.
        words += countWords(inlineText(block.statement));
        for (const example of block.examples ?? []) words += countWords(example);
        if (block.clarification) words += countWords(inlineText(block.clarification));
        break;
      case 'source':
        words += countWords(block.label ?? '');
        if (block.publisher) words += countWords(block.publisher);
        break;
      case 'image':
        // alt/caption/credit are metadata, not body copy.
        break;
      case 'divider':
      case 'related_content':
      default:
        break;
    }
  }

  return words;
}

/** Reading time in whole minutes, never below 1. */
export function readingTimeMinutes(wordCount: number): number {
  if (!Number.isFinite(wordCount) || wordCount <= 0) return 1;
  return Math.max(1, Math.round(wordCount / CONTENT_LIMITS.wordsPerMinute));
}

/** Convenience: both derived values from a body in one pass. */
export function deriveReadingStats(body: unknown): { wordCount: number; readingTimeMinutes: number } {
  const wordCount = countBodyWords(body);
  return { wordCount, readingTimeMinutes: readingTimeMinutes(wordCount) };
}

// ─── Document validation ─────────────────────────────────────────────────────

export interface ValidateBodyOptions {
  contentType?: ContentType;
  /** Applies publish-only rules (currently: a safety notice must exist). */
  forPublish?: boolean;
}

/**
 * Validate the structured body envelope and every document-level rule.
 *
 * Errors block saving; warnings never do. Publish-only rules are gated behind `forPublish` so a
 * half-written draft always remains saveable.
 */
export function validateContentBody(body: unknown, options: ValidateBodyOptions = {}): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (typeof body !== 'object' || body === null) {
    errors.push({ code: 'body.invalid', message: 'Body must be an object.' });
    return ok(errors, warnings);
  }

  const envelope = body as Partial<ContentBody>;

  if (envelope.version !== CONTENT_BODY_VERSION) {
    errors.push({
      code: 'body.bad_version',
      message: `Body version must be ${CONTENT_BODY_VERSION}.`,
      path: 'version',
    });
  }

  if (!Array.isArray(envelope.blocks)) {
    errors.push({ code: 'body.blocks_not_array', message: 'Body must contain a blocks array.', path: 'blocks' });
    return ok(errors, warnings);
  }

  const blocks = envelope.blocks as ContentBlock[];

  if (blocks.length > CONTENT_LIMITS.maxBlocks) {
    errors.push({
      code: 'body.too_many_blocks',
      message: `At most ${CONTENT_LIMITS.maxBlocks} blocks are allowed.`,
      path: 'blocks',
    });
  }

  // Unique, present block ids.
  const seenIds = new Set<string>();
  blocks.forEach((block, index) => {
    if (typeof block?.id !== 'string' || block.id === '') {
      errors.push({ code: 'block.missing_id', message: 'Every block needs a stable id.', path: `blocks[${index}]` });
      return;
    }
    if (seenIds.has(block.id)) {
      errors.push({
        code: 'block.duplicate_id',
        message: `Duplicate block id: ${block.id}`,
        path: `blocks[${index}].id`,
        blockId: block.id,
      });
    }
    seenIds.add(block.id);
  });

  // Cardinality.
  const countOf = (type: string) => blocks.filter((b) => b?.type === type).length;

  const directAnswers = countOf('direct_answer');
  if (directAnswers > CONTENT_LIMITS.maxDirectAnswerBlocks) {
    errors.push({ code: 'direct_answer.too_many', message: 'Only one direct answer block is allowed.', path: 'blocks' });
  }
  if (directAnswers === 1 && blocks[0]?.type !== 'direct_answer') {
    errors.push({
      code: 'direct_answer.not_first',
      message: 'The direct answer must be the first block.',
      path: 'blocks[0]',
    });
  }

  if (countOf('faq') > CONTENT_LIMITS.maxFaqBlocks) {
    errors.push({ code: 'faq.too_many', message: 'Only one FAQ block is allowed per document.', path: 'blocks' });
  }
  if (countOf('safety_notice') > CONTENT_LIMITS.maxSafetyNoticeBlocks) {
    errors.push({
      code: 'safety_notice.too_many',
      message: `At most ${CONTENT_LIMITS.maxSafetyNoticeBlocks} safety notices are allowed.`,
      path: 'blocks',
    });
  }
  if (countOf('cta') > CONTENT_LIMITS.maxCtaBlocks) {
    errors.push({
      code: 'cta.too_many',
      message: `At most ${CONTENT_LIMITS.maxCtaBlocks} CTAs are allowed.`,
      path: 'blocks',
    });
  }

  // Publish-only rule: crisis-adjacent content must carry a safety notice.
  if (options.forPublish && countOf('safety_notice') === 0) {
    errors.push({
      code: 'safety_notice.required',
      message: 'A safety notice block is required before publishing.',
      path: 'blocks',
    });
  } else if (!options.forPublish && countOf('safety_notice') === 0) {
    warnings.push({
      code: 'safety_notice.missing',
      message: 'This item will need a safety notice before it can be published.',
      path: 'blocks',
    });
  }

  // Type/block compatibility.
  if (options.contentType) {
    for (const [ownerType, restricted] of Object.entries(TYPE_RESTRICTED_BLOCKS)) {
      if (ownerType === options.contentType) continue;
      for (const block of blocks) {
        if (block && restricted.includes(block.type)) {
          errors.push({
            code: 'block.wrong_content_type',
            message: `A "${block.type}" block is only valid on ${ownerType} content.`,
            blockId: block.id,
          });
        }
      }
    }
  }

  // Per-block checks.
  let lastHeadingLevel = 1;
  blocks.forEach((block, index) => {
    if (!block || typeof block.type !== 'string') {
      errors.push({ code: 'block.invalid', message: 'Invalid block.', path: `blocks[${index}]` });
      return;
    }
    const at = `blocks[${index}]`;

    switch (block.type) {
      case 'paragraph':
      case 'quote':
      case 'direct_answer':
        validateInlineContent(block.content, `${at}.content`, block.id, errors);
        break;

      case 'heading': {
        validateInlineContent(block.content, `${at}.content`, block.id, errors);
        if (![2, 3, 4].includes(block.level)) {
          errors.push({ code: 'heading.bad_level', message: 'Heading level must be 2, 3 or 4.', path: `${at}.level`, blockId: block.id });
        } else {
          if (block.level > lastHeadingLevel + 1) {
            warnings.push({
              code: 'heading.level_skip',
              message: `Heading jumps from h${lastHeadingLevel} to h${block.level}.`,
              path: `${at}.level`,
              blockId: block.id,
            });
          }
          lastHeadingLevel = block.level;
        }
        break;
      }

      case 'list':
        if (!Array.isArray(block.items) || block.items.length === 0) {
          errors.push({ code: 'list.empty', message: 'A list needs at least one item.', path: `${at}.items`, blockId: block.id });
        } else {
          block.items.forEach((item: InlineContent, i: number) =>
            validateInlineContent(item, `${at}.items[${i}]`, block.id, errors)
          );
        }
        break;

      case 'key_takeaway':
        if (!Array.isArray(block.points) || block.points.length === 0) {
          errors.push({ code: 'key_takeaway.empty', message: 'A key takeaway needs at least one point.', path: `${at}.points`, blockId: block.id });
        }
        break;

      case 'safety_notice':
        if (block.variant !== 'crisis' && block.variant !== 'disclaimer') {
          errors.push({ code: 'safety_notice.bad_variant', message: 'Safety notice variant must be crisis or disclaimer.', path: `${at}.variant`, blockId: block.id });
        }
        validateInlineContent(block.content, `${at}.content`, block.id, errors);
        break;

      case 'cta': {
        if (typeof block.label !== 'string' || block.label.trim() === '') {
          errors.push({ code: 'cta.missing_label', message: 'A CTA needs a label.', path: `${at}.label`, blockId: block.id });
        }
        const target = block.target;
        if (!target || typeof target.value !== 'string') {
          errors.push({ code: 'cta.missing_target', message: 'A CTA needs a target.', path: `${at}.target`, blockId: block.id });
        } else if (target.kind === 'route' && !isRouteKey(target.value)) {
          errors.push({ code: 'cta.unknown_route', message: `Unknown route key: ${target.value}`, path: `${at}.target`, blockId: block.id });
        } else if (target.kind === 'external' && !isSafeExternalUrl(target.value)) {
          errors.push({ code: 'cta.unsafe_target', message: 'CTA target URL is not permitted.', path: `${at}.target`, blockId: block.id });
        }
        break;
      }

      case 'image':
        if (typeof block.alt !== 'string' || block.alt.trim() === '') {
          errors.push({ code: 'image.missing_alt', message: 'Images require alt text.', path: `${at}.alt`, blockId: block.id });
        }
        if (!isAbsoluteHttpUrl(block.url)) {
          errors.push({ code: 'image.bad_url', message: 'Image URL must be absolute http(s).', path: `${at}.url`, blockId: block.id });
        }
        break;

      case 'related_content':
        if (block.mode === 'manual' && (!Array.isArray(block.items) || block.items.length === 0)) {
          errors.push({ code: 'related_content.missing_items', message: 'Manual related content needs at least one item.', path: `${at}.items`, blockId: block.id });
        }
        break;

      case 'faq': {
        if (!Array.isArray(block.items) || block.items.length === 0) {
          errors.push({ code: 'faq.empty', message: 'An FAQ block needs at least one question.', path: `${at}.items`, blockId: block.id });
          break;
        }
        const faqIds = new Set<string>();
        block.items.forEach((item, i) => {
          if (typeof item?.question !== 'string' || item.question.trim() === '') {
            errors.push({ code: 'faq.missing_question', message: 'Every FAQ item needs a question.', path: `${at}.items[${i}]`, blockId: block.id });
          }
          if (typeof item?.id === 'string') {
            if (faqIds.has(item.id)) {
              errors.push({ code: 'faq.duplicate_item_id', message: `Duplicate FAQ item id: ${item.id}`, path: `${at}.items[${i}].id`, blockId: block.id });
            }
            faqIds.add(item.id);
          }
          validateInlineContent(item?.answer, `${at}.items[${i}].answer`, block.id, errors);
        });
        break;
      }

      case 'table': {
        if (!Array.isArray(block.headers) || block.headers.length === 0) {
          errors.push({ code: 'table.missing_headers', message: 'A table needs headers.', path: `${at}.headers`, blockId: block.id });
          break;
        }
        if (!Array.isArray(block.rows)) {
          errors.push({ code: 'table.missing_rows', message: 'A table needs a rows array.', path: `${at}.rows`, blockId: block.id });
          break;
        }
        block.rows.forEach((row, i) => {
          if (!Array.isArray(row) || row.length !== block.headers.length) {
            errors.push({
              code: 'table.row_length_mismatch',
              message: `Row ${i} has ${Array.isArray(row) ? row.length : 0} cells but the table has ${block.headers.length} columns.`,
              path: `${at}.rows[${i}]`,
              blockId: block.id,
            });
          }
        });
        break;
      }

      case 'geo_statement':
        validateInlineContent(block.statement, `${at}.statement`, block.id, errors);
        if (block.clarification) {
          validateInlineContent(block.clarification, `${at}.clarification`, block.id, errors);
        }
        break;

      case 'source':
        if (typeof block.label !== 'string' || block.label.trim() === '') {
          errors.push({ code: 'source.missing_label', message: 'A source needs a label.', path: `${at}.label`, blockId: block.id });
        }
        if (!isAbsoluteHttpUrl(block.url)) {
          errors.push({ code: 'source.bad_url', message: 'Source URL must be absolute http(s).', path: `${at}.url`, blockId: block.id });
        }
        break;

      case 'divider':
        break;

      default: {
        // Every known block type is handled above, so TypeScript narrows `block` to `never` here.
        // The branch still matters at runtime: untrusted JSON can carry a type we do not know.
        const unknown = block as { type?: unknown; id?: unknown };
        errors.push({
          code: 'block.unknown_type',
          message: `Unknown block type: ${String(unknown.type)}`,
          path: `${at}.type`,
          blockId: typeof unknown.id === 'string' ? unknown.id : undefined,
        });
      }
    }
  });

  return ok(errors, warnings);
}
