/**
 * Content Hub — PUBLIC Zod v3 response schemas.
 *
 * BUILT FROM SCRATCH, NOT DERIVED FROM THE ADMIN SCHEMAS. This file deliberately does not import
 * or `.omit()` anything from `content-hub.schema.ts`: deriving public shapes from admin shapes
 * means every future admin field is public by default until someone remembers to exclude it.
 * Here, a new field is private until someone explicitly adds it.
 *
 * Because Fastify validates responses, these schemas are also the LAST LINE OF DEFENCE: if the
 * serializer ever leaked an internal field, the response would fail validation and surface as a
 * server error rather than a silent disclosure.
 *
 * Fields that must NEVER appear below: `editorial`, approval states, `scheduled_for`, `status`,
 * `created_by`/`updated_by`, `deleted_at`, `current_revision_number`, `tags`, `editorial_ref`,
 * internal `type_fields` values, and the internal content type string.
 */

import { z } from 'zod';
import { PUBLIC_CONTENT_LABEL } from '@meetezri/shared';

/** The three public labels. The internal type string is never serialised. */
export const publicLabelSchema = z.enum([
  PUBLIC_CONTENT_LABEL.aeo_answer,
  PUBLIC_CONTENT_LABEL.geo_article,
  PUBLIC_CONTENT_LABEL.seo_blog,
]);

export const publicErrorSchema = z.object({
  statusCode: z.number(),
  error: z.string(),
  code: z.string().optional(),
  message: z.string(),
});

/** Byline. Only what a reader sees — never the account email or role. */
export const publicPersonSchema = z
  .object({
    name: z.string(),
    title: z.string().nullable(),
    bio: z.string().nullable(),
    avatarUrl: z.string().nullable(),
  })
  .nullable();

/** Card fields for `/resources`. Note the absence of a body: lists never carry one. */
export const publicCardSchema = z.object({
  slug: z.string(),
  label: publicLabelSchema,
  title: z.string(),
  description: z.string().nullable(),
  featuredImageUrl: z.string().nullable(),
  featuredImageAlt: z.string().nullable(),
  readingTimeMinutes: z.number().nullable(),
  publishedAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const publicListResponseSchema = z.object({
  items: z.array(publicCardSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export const publicListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(24).default(12),
    /**
     * Public LABEL only. There is deliberately no `status` parameter anywhere on the public API —
     * published-only is a property of the service, never a client-supplied filter.
     */
    type: publicLabelSchema.optional(),
  })
  .strip();

export const publicSlugParamsSchema = z.object({
  slug: z.string().min(1).max(200),
});

export const publicRelatedQuerySchema = z
  .object({ limit: z.coerce.number().int().min(1).max(3).default(3) })
  .strip();

/** A rendered link. Content targets carry a resolved current slug, never an id. */
export const publicLinkSchema = z.object({
  label: z.string(),
  href: z.string(),
  relation: z.string(),
});

/**
 * Public block shapes.
 *
 * `z.unknown()` is NOT used for block content: the serializer emits explicit fields and this
 * union re-asserts them, so an unrecognised or internal key cannot ride along inside a block.
 * Note `geo_statement` has no `coreMessage` / `citationGoal`.
 */
const publicInlineSpanSchema = z.object({
  text: z.string(),
  marks: z.array(z.enum(['bold', 'italic', 'code'])).optional(),
  link: z.object({ href: z.string(), external: z.boolean() }).optional(),
});

const publicInlineContentSchema = z.array(publicInlineSpanSchema);

export const publicBlockSchema = z.discriminatedUnion('type', [
  z.object({ id: z.string(), type: z.literal('paragraph'), content: publicInlineContentSchema }),
  z.object({
    id: z.string(),
    type: z.literal('heading'),
    level: z.number(),
    content: publicInlineContentSchema,
    anchorId: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('list'),
    style: z.enum(['bullet', 'number']),
    items: z.array(publicInlineContentSchema),
  }),
  z.object({
    id: z.string(),
    type: z.literal('quote'),
    content: publicInlineContentSchema,
    attribution: z.string().optional(),
  }),
  z.object({ id: z.string(), type: z.literal('direct_answer'), content: publicInlineContentSchema }),
  z.object({
    id: z.string(),
    type: z.literal('key_takeaway'),
    title: z.string().optional(),
    points: z.array(publicInlineContentSchema),
  }),
  z.object({
    id: z.string(),
    type: z.literal('safety_notice'),
    variant: z.enum(['crisis', 'disclaimer']),
    heading: z.string().optional(),
    content: publicInlineContentSchema,
    showHotlines: z.boolean().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('cta'),
    label: z.string(),
    href: z.string(),
    external: z.boolean(),
    description: z.string().optional(),
    style: z.enum(['primary', 'secondary']).optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('image'),
    url: z.string(),
    alt: z.string(),
    caption: publicInlineContentSchema.optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    credit: z.string().optional(),
  }),
  z.object({ id: z.string(), type: z.literal('divider') }),
  z.object({
    id: z.string(),
    type: z.literal('related_content'),
    heading: z.string().optional(),
    items: z.array(publicCardSchema),
  }),
  z.object({
    id: z.string(),
    type: z.literal('faq'),
    heading: z.string().optional(),
    items: z.array(
      z.object({ id: z.string(), question: z.string(), answer: publicInlineContentSchema })
    ),
  }),
  z.object({
    id: z.string(),
    type: z.literal('table'),
    caption: z.string().optional(),
    headers: z.array(z.string()),
    rows: z.array(z.array(publicInlineContentSchema)),
  }),
  z.object({
    id: z.string(),
    type: z.literal('geo_statement'),
    // coreMessage and citationGoal are INTERNAL and structurally absent here.
    statement: publicInlineContentSchema,
    examples: z.array(z.string()).optional(),
    clarification: publicInlineContentSchema.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('source'),
    label: z.string(),
    url: z.string(),
    publisher: z.string().optional(),
    accessedAt: z.string().optional(),
  }),
]);

export const publicBodySchema = z.object({
  version: z.number(),
  blocks: z.array(publicBlockSchema),
});

/** Public type-specific fields. Only the explicitly public subset per type. */
export const publicTypeFieldsSchema = z
  .object({
    /** AEO — the canonical question and the snippet answer used for meta/JSON-LD. */
    primaryQuestion: z.string().optional(),
    snippetAnswer: z.string().optional(),
    /** GEO — the citable summary and ordered statements. */
    citationSummary: z.string().optional(),
    keyStatements: z.array(z.string()).optional(),
  })
  .strip();

export const publicDetailSchema = z.object({
  slug: z.string(),
  label: publicLabelSchema,
  title: z.string(),
  description: z.string().nullable(),
  canonicalPath: z.string(),
  canonicalUrlOverride: z.string().nullable(),
  robots: z.string(),
  featuredImageUrl: z.string().nullable(),
  featuredImageAlt: z.string().nullable(),
  body: publicBodySchema,
  typeFields: publicTypeFieldsSchema,
  author: publicPersonSchema,
  reviewer: publicPersonSchema,
  reviewedAt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  readingTimeMinutes: z.number().nullable(),
  links: z.array(publicLinkSchema),
  related: z.array(publicCardSchema),
});

/** Preview reuses the exact public shape, plus two flags. */
export const previewResponseSchema = publicDetailSchema.extend({
  isPreview: z.literal(true),
  robots: z.literal('noindex,nofollow'),
});

export const publicRelatedResponseSchema = z.object({ items: z.array(publicCardSchema) });

export type PublicCard = z.infer<typeof publicCardSchema>;
export type PublicDetail = z.infer<typeof publicDetailSchema>;
export type PublicBlock = z.infer<typeof publicBlockSchema>;
