/**
 * Content Hub — WEB Zod v4 editor schema, and the second half of the web parity work.
 *
 * DOES NOT IMPORT THE API'S ZOD v3 SCHEMAS. Document rules come from the shared plain validator
 * (`validateContentBody`), which the API also calls, so the editor cannot permit something the
 * server will reject.
 *
 * DRAFT VS PUBLISH is the central distinction: a draft must stay saveable while publish-only
 * fields are incomplete, so publish rules live behind `forPublish` rather than in the field
 * schema.
 */

import { z } from 'zod';
import {
  CONTENT_LIMITS,
  ROBOTS_DIRECTIVES,
  isAbsoluteHttpUrl,
  normaliseSlug,
  normaliseTags,
  validateContentBody,
  validateSlug,
  type ContentBody,
  type ContentType,
  type ValidationIssue,
} from '@meetezri/shared';

/** Which tab an issue belongs to, so the UI can show per-tab error counts. */
export type EditorTab = 'overview' | 'brief' | 'content' | 'seo' | 'links' | 'review';

// ─── Reviewed-on date conversion ─────────────────────────────────────────────

/**
 * `reviewed_at` is a `timestamptz` column, but the editor shows a plain calendar date.
 *
 * The two conversions below bridge that, and they do it with STRING OPERATIONS ONLY — no `Date`
 * is constructed in either direction. That is deliberate:
 *
 *   `new Date('2026-08-10T00:00:00')`  is parsed in LOCAL time, so in UTC+13 it becomes
 *   `2026-08-09T11:00:00Z` and the reviewer's date silently moves back a day. The same class of
 *   bug moves it forward in western timezones. Because nothing here touches `Date`, the day the
 *   reviewer picked is the day that is stored and the day that is shown, in every timezone.
 *
 * Storage is UTC midnight. Both directions agree on that, so a value round-trips exactly.
 */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

/** `<input type="date">` value → the ISO datetime the API requires. `'' | null` → `null`. */
export function dateInputToIso(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  if (DATE_ONLY.test(trimmed)) return `${trimmed}T00:00:00.000Z`;
  // Already a full datetime (a value that skipped the date input) — pass it through untouched
  // rather than mangling it.
  if (ISO_DATETIME.test(trimmed)) return trimmed;
  // Anything else is rejected by the field schema before it reaches here; returning null would
  // silently erase a reviewer's date, so surface it instead.
  return trimmed;
}

/** API ISO datetime → `<input type="date">` value. Never feed a full timestamp to a date input. */
export function isoToDateInput(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  // The first ten characters of an ISO-8601 string are its UTC calendar date, which is exactly
  // what was stored by `dateInputToIso`.
  return trimmed.slice(0, 10);
}

export interface EditorIssue extends ValidationIssue {
  tab: EditorTab;
  severity: 'error' | 'warning';
}

/**
 * Fields that are always required, even for a draft.
 *
 * Deliberately minimal: only what makes a record coherent at all. Everything else is a publish
 * concern.
 */
export const editorDraftSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(200, 'Title must be 200 characters or fewer.'),

  slug: z
    .string()
    .trim()
    .min(1, 'Slug is required.')
    .refine((value) => normaliseSlug(value).length > 0, 'This slug contains no usable characters.')
    .refine((value) => validateSlug(normaliseSlug(value)).reason !== 'reserved', 'That slug is reserved.'),

  metaDescription: z
    .string()
    .trim()
    .max(500, 'Meta description is too long.')
    .optional()
    .or(z.literal('')),

  featuredImageUrl: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine((value) => !value || isAbsoluteHttpUrl(value), 'Image URL must be an absolute http(s) URL.'),

  featuredImageAlt: z.string().trim().max(500).optional().or(z.literal('')),

  pillar: z.string().trim().max(200).optional().or(z.literal('')),

  week: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === '') return undefined;
      const parsed = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    })
    .refine((v) => v === undefined || (Number.isInteger(v) && v >= 1 && v <= 520), 'Week must be 1–520.'),

  tagsInput: z
    .string()
    .optional()
    .refine(
      (value) => normaliseTags((value ?? '').split(/[,\n]/)).length <= CONTENT_LIMITS.maxTags,
      `At most ${CONTENT_LIMITS.maxTags} tags are allowed.`,
    ),

  editorialRef: z.string().trim().max(64).optional().or(z.literal('')),
  authorId: z.string().uuid().optional().or(z.literal('')),
  reviewerId: z.string().uuid().optional().or(z.literal('')),
  /**
   * Held as `YYYY-MM-DD`, because the control is `<input type="date">`.
   *
   * `reviewed_at` is a `timestamptz` column and the API requires a full ISO datetime, so this is
   * converted at the boundary by `toUpdateBody` — not stored in this shape and hoped for.
   */
  reviewedAt: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((value) => !value || DATE_ONLY.test(value), 'Reviewed on must be a calendar date.'),

  canonicalUrlOverride: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine(
      (value) => !value || (isAbsoluteHttpUrl(value) && value.startsWith('https://')),
      'Canonical URL must be an absolute https URL.',
    ),

  robotsDirective: z.enum(ROBOTS_DIRECTIVES),
})
  // Alt text is required whenever an image is set — accessibility, and the publish checklist
  // enforces it server-side too.
  .refine((values) => !values.featuredImageUrl || !!values.featuredImageAlt?.trim(), {
    message: 'Featured image alt text is required when an image URL is set.',
    path: ['featuredImageAlt'],
  });

export type EditorFormValues = z.input<typeof editorDraftSchema>;

/** Which tab owns which field, for per-tab error counts and focus-the-bad-tab behaviour. */
const FIELD_TAB: Record<string, EditorTab> = {
  title: 'overview',
  slug: 'overview',
  pillar: 'overview',
  week: 'overview',
  tagsInput: 'overview',
  editorialRef: 'overview',
  authorId: 'overview',
  reviewerId: 'overview',
  reviewedAt: 'overview',
  metaDescription: 'seo',
  featuredImageUrl: 'seo',
  featuredImageAlt: 'seo',
  canonicalUrlOverride: 'seo',
  robotsDirective: 'seo',
};

export function tabForField(field: string): EditorTab {
  return FIELD_TAB[field] ?? 'overview';
}

export interface DocumentValidationResult {
  /** Blocks saving. Currently only structural body problems. */
  errors: EditorIssue[];
  /** Blocks publishing but not saving. */
  publishBlockers: EditorIssue[];
  warnings: EditorIssue[];
}

/**
 * Validate the document body twice: once as a draft and once as if publishing.
 *
 * The difference between the two runs is exactly the set of publish-only problems, which is what
 * lets the UI say "this is fine to save, but it will block publishing".
 */
export function validateDocument(
  body: ContentBody,
  contentType: ContentType,
): DocumentValidationResult {
  const draft = validateContentBody(body, { contentType });
  const publish = validateContentBody(body, { contentType, forPublish: true });

  const draftCodes = new Set(draft.errors.map((issue) => `${issue.code}:${issue.blockId ?? ''}`));

  const errors: EditorIssue[] = draft.errors.map((issue) => ({
    ...issue,
    tab: 'content',
    severity: 'error',
  }));

  const publishBlockers: EditorIssue[] = publish.errors
    .filter((issue) => !draftCodes.has(`${issue.code}:${issue.blockId ?? ''}`))
    .map((issue) => ({ ...issue, tab: 'content', severity: 'error' }));

  const warnings: EditorIssue[] = draft.warnings.map((issue) => ({
    ...issue,
    tab: 'content',
    severity: 'warning',
  }));

  return { errors, publishBlockers, warnings };
}

/** Form values → the API's PATCH body, applying shared normalisation exactly once. */
export function toUpdateBody(
  values: EditorFormValues,
  extras: {
    body?: ContentBody;
    typeFields?: Record<string, unknown>;
    editorial?: Record<string, unknown>;
    expectedUpdatedAt: string;
    createRevision: boolean;
    confirmSlugChange?: boolean;
    changeSummary?: string;
  },
) {
  const tags = normaliseTags((values.tagsInput ?? '').split(/[,\n]/));

  return {
    title: values.title,
    slug: normaliseSlug(values.slug),
    metaDescription: values.metaDescription?.trim() || null,
    featuredImageUrl: values.featuredImageUrl?.trim() || null,
    featuredImageAlt: values.featuredImageAlt?.trim() || null,
    pillar: values.pillar?.trim() || null,
    week: values.week === undefined || values.week === '' ? null : Number(values.week),
    tags,
    editorialRef: values.editorialRef?.trim() || null,
    authorId: values.authorId || null,
    reviewerId: values.reviewerId || null,
    // Date input (`2026-08-10`) → the ISO datetime the API's `z.string().datetime()` requires.
    reviewedAt: dateInputToIso(values.reviewedAt),
    canonicalUrlOverride: values.canonicalUrlOverride?.trim() || null,
    robotsDirective: values.robotsDirective,
    ...(extras.body ? { body: extras.body } : {}),
    ...(extras.typeFields ? { typeFields: extras.typeFields } : {}),
    ...(extras.editorial ? { editorial: extras.editorial } : {}),
    expectedUpdatedAt: extras.expectedUpdatedAt,
    createRevision: extras.createRevision,
    ...(extras.confirmSlugChange ? { confirmSlugChange: true } : {}),
    ...(extras.changeSummary ? { changeSummary: extras.changeSummary } : {}),
  };
}
