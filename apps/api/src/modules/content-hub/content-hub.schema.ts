/**
 * Content Hub — ADMIN Zod v3 schemas.
 *
 * The API owns these. `packages/shared` stays zod-free (it is on v3 while the web app is on v4, so
 * a shared schema instance would put two runtimes in one bundle — see plan §2.4.1). The shared
 * package supplies TypeScript types, constants and the plain validators; this file wraps them.
 *
 * DOCUMENT-LEVEL RULES ARE NOT REIMPLEMENTED HERE. `validateContentBody` from the shared package
 * is called inside `.superRefine()`, so the drift-prone logic exists exactly once and the web
 * layer (Phase 4) can call the same function from its own v4 schema.
 *
 * PUBLIC RESPONSES LIVE IN `content-hub.public.schema.ts` — deliberately a separate file built
 * from scratch rather than an admin schema with fields omitted, so a new admin field is never
 * public by accident.
 */

import { z } from 'zod';
import {
  APPROVAL_GATES,
  APPROVAL_STATES,
  CONTENT_LIMITS,
  CONTENT_STATUSES,
  CONTENT_TYPES,
  LINK_RELATIONS,
  LINK_TARGET_KINDS,
  REVISION_TRIGGERS,
  ROBOTS_DIRECTIVES,
  isRouteKey,
  normaliseTags,
  validateContentBody,
  type ContentType,
} from '@meetezri/shared';

// ─── Primitives ──────────────────────────────────────────────────────────────

export const contentTypeSchema = z.enum(CONTENT_TYPES);
export const contentStatusSchema = z.enum(CONTENT_STATUSES);
export const approvalStateSchema = z.enum(APPROVAL_STATES);
export const approvalGateSchema = z.enum(APPROVAL_GATES);
export const robotsDirectiveSchema = z.enum(ROBOTS_DIRECTIVES);
export const revisionTriggerSchema = z.enum(REVISION_TRIGGERS);
export const linkTargetKindSchema = z.enum(LINK_TARGET_KINDS);
export const linkRelationSchema = z.enum(LINK_RELATIONS);

export const safeErrorResponseSchema = z.object({
  statusCode: z.number(),
  error: z.string(),
  code: z.string().optional(),
  message: z.string(),
});

export const uuidParamsSchema = z.object({ id: z.string().uuid() });

/**
 * Tags are normalised (not merely validated) so `Anxiety`, `anxiety ` and `ANXIETY` converge
 * before they reach the database — which is what keeps a future migration to a term table a
 * `SELECT DISTINCT unnest(tags)` rather than a data-cleaning project.
 */
export const tagsSchema = z
  .array(z.string())
  .max(CONTENT_LIMITS.maxTags * 3, 'Too many tags supplied.')
  .transform((tags) => normaliseTags(tags))
  .refine((tags) => tags.length <= CONTENT_LIMITS.maxTags, {
    message: `At most ${CONTENT_LIMITS.maxTags} tags are allowed.`,
  });

// ─── Inline content & blocks ─────────────────────────────────────────────────

const inlineLinkSchema = z.object({
  kind: z.enum(['content', 'route', 'external']),
  value: z.string().min(1),
});

const inlineSpanSchema = z.object({
  text: z.string(),
  marks: z.array(z.enum(['bold', 'italic', 'code'])).optional(),
  link: inlineLinkSchema.optional(),
});

export const inlineContentSchema = z.array(inlineSpanSchema).max(CONTENT_LIMITS.maxInlineSpans);

const blockIdSchema = z.string().min(1).max(64);

/**
 * Per-block shapes.
 *
 * Deliberately permissive at the FIELD level — cardinality, ordering and cross-block rules are
 * the shared validator's job (see `contentBodySchema` below). Duplicating them here is how the
 * two would drift.
 */
const blockSchema = z.discriminatedUnion('type', [
  z.object({ id: blockIdSchema, type: z.literal('paragraph'), content: inlineContentSchema }),
  z.object({
    id: blockIdSchema,
    type: z.literal('heading'),
    level: z.union([z.literal(2), z.literal(3), z.literal(4)]),
    content: inlineContentSchema,
    anchorId: z.string().optional(),
  }),
  z.object({
    id: blockIdSchema,
    type: z.literal('list'),
    style: z.enum(['bullet', 'number']),
    items: z.array(inlineContentSchema).min(1),
  }),
  z.object({
    id: blockIdSchema,
    type: z.literal('quote'),
    content: inlineContentSchema,
    attribution: z.string().optional(),
  }),
  z.object({ id: blockIdSchema, type: z.literal('direct_answer'), content: inlineContentSchema }),
  z.object({
    id: blockIdSchema,
    type: z.literal('key_takeaway'),
    title: z.string().optional(),
    points: z.array(inlineContentSchema).min(1),
  }),
  z.object({
    id: blockIdSchema,
    type: z.literal('safety_notice'),
    variant: z.enum(['crisis', 'disclaimer']),
    heading: z.string().optional(),
    content: inlineContentSchema,
    showHotlines: z.boolean().optional(),
  }),
  z.object({
    id: blockIdSchema,
    type: z.literal('cta'),
    label: z.string().min(1).max(60),
    target: z.object({
      kind: z.enum(['content', 'route', 'external']),
      value: z.string().min(1),
    }),
    description: z.string().max(160).optional(),
    style: z.enum(['primary', 'secondary']).optional(),
  }),
  z.object({
    id: blockIdSchema,
    type: z.literal('image'),
    url: z.string(),
    alt: z.string(),
    caption: inlineContentSchema.optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    credit: z.string().optional(),
    license: z.object({ label: z.string(), url: z.string().optional() }).optional(),
  }),
  z.object({ id: blockIdSchema, type: z.literal('divider') }),
  z.object({
    id: blockIdSchema,
    type: z.literal('related_content'),
    heading: z.string().optional(),
    mode: z.enum(['auto', 'manual']),
    items: z.array(z.string().uuid()).optional(),
  }),
  z.object({
    id: blockIdSchema,
    type: z.literal('faq'),
    heading: z.string().optional(),
    items: z
      .array(
        z.object({
          id: z.string().min(1),
          question: z.string().min(1),
          answer: inlineContentSchema,
        })
      )
      .min(1),
  }),
  z.object({
    id: blockIdSchema,
    type: z.literal('table'),
    caption: z.string().optional(),
    headers: z.array(z.string()).min(1),
    rows: z.array(z.array(inlineContentSchema)),
  }),
  z.object({
    id: blockIdSchema,
    type: z.literal('geo_statement'),
    statement: inlineContentSchema,
    coreMessage: z.string().optional(),
    citationGoal: z.string().optional(),
    examples: z.array(z.string()).optional(),
    clarification: inlineContentSchema.optional(),
  }),
  z.object({
    id: blockIdSchema,
    type: z.literal('source'),
    label: z.string().min(1),
    url: z.string(),
    publisher: z.string().optional(),
    accessedAt: z.string().optional(),
  }),
]);

export interface ContentBodySchemaOptions {
  contentType?: ContentType;
  forPublish?: boolean;
}

/**
 * Body envelope + every document-level rule.
 *
 * The shape check is Zod's; the RULES come from the shared validator, whose machine-readable
 * codes (`direct_answer.not_first`, `block.duplicate_id`, …) are surfaced verbatim so the API,
 * the web layer and the fixtures all speak the same vocabulary.
 */
export function makeContentBodySchema(options: ContentBodySchemaOptions = {}) {
  return z
    .object({
      version: z.number().int(),
      blocks: z.array(blockSchema).max(CONTENT_LIMITS.maxBlocks),
    })
    .superRefine((body, ctx) => {
      const result = validateContentBody(body, options);
      for (const issue of result.errors) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${issue.code}: ${issue.message}`,
          path: issue.path ? issue.path.split('.') : [],
          params: { contentHubCode: issue.code, blockId: issue.blockId },
        });
      }
    });
}

export const contentBodySchema = makeContentBodySchema();

// ─── Type-specific fields & editorial metadata ───────────────────────────────

const keywordsSchema = z
  .object({ primary: z.string().optional(), secondary: z.array(z.string()).optional() })
  .strip();

export const aeoTypeFieldsSchema = z
  .object({
    primary_question: z.string().optional(),
    supporting_queries: z.array(z.string()).optional(),
    snippet_answer: z.string().optional(),
    keywords: keywordsSchema.optional(),
  })
  .strip();

export const geoTypeFieldsSchema = z
  .object({
    core_concept: z.string().optional(),
    supporting_concepts: z.array(z.string()).optional(),
    citation_summary: z.string().optional(),
    key_statements: z.array(z.string()).optional(),
    topics: z
      .object({ primary: z.string().optional(), secondary: z.array(z.string()).optional() })
      .strip()
      .optional(),
  })
  .strip();

export const seoTypeFieldsSchema = z
  .object({
    keywords: keywordsSchema.optional(),
    word_count_target: z.string().optional(),
    funnel_stage: z.string().optional(),
  })
  .strip();

/** Selects the right `type_fields` schema. Unknown keys are stripped, never rejected. */
export function typeFieldsSchemaFor(contentType: ContentType) {
  switch (contentType) {
    case 'aeo_answer':
      return aeoTypeFieldsSchema;
    case 'geo_article':
      return geoTypeFieldsSchema;
    case 'seo_blog':
      return seoTypeFieldsSchema;
  }
}

export const editorialMetadataSchema = z
  .object({
    purpose: z.string().optional(),
    strategy: z.string().optional(),
    goal: z.string().optional(),
    expected_outcome: z.string().optional(),
    business_goal: z.string().optional(),
    target_engines: z.array(z.string()).optional(),
    search_intent: z.string().optional(),
    user_state: z.string().optional(),
    primary_kpi: z.string().optional(),
    secondary_kpi: z.string().optional(),
    citation_friendly: z.string().optional(),
    aeo_signal: z.string().optional(),
    geo_signal: z.string().optional(),
    geo_focus: z.string().optional(),
    question_coverage: z.string().optional(),
    objective: z.array(z.string()).optional(),
    kpi_targets: z.array(z.object({ metric: z.string(), goal: z.string() }).strip()).optional(),
  })
  .strip();

// ─── Requests ────────────────────────────────────────────────────────────────

export const listContentQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(200).optional(),
    contentType: contentTypeSchema.optional(),
    status: contentStatusSchema.optional(),
    pillar: z.string().trim().max(200).optional(),
    week: z.coerce.number().int().optional(),
    /** Repeatable `?tags=a&tags=b`, or a single value. */
    tags: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .transform((value) => (value === undefined ? undefined : normaliseTags(Array.isArray(value) ? value : [value]))),
    awaitingApproval: z.coerce.boolean().optional(),
    dueToPublish: z.coerce.boolean().optional(),
    sort: z.enum(['updated_at', 'created_at', 'title', 'published_at']).default('updated_at'),
    order: z.enum(['asc', 'desc']).default('desc'),
  })
  .strip();

export const createContentBodySchema = z
  .object({
    contentType: contentTypeSchema,
    title: z.string().trim().min(1).max(200),
    slug: z.string().trim().max(200).optional(),
    pillar: z.string().trim().max(200).optional(),
    week: z.number().int().optional(),
    tags: tagsSchema.optional(),
    editorialRef: z.string().trim().max(64).optional(),
    authorId: z.string().uuid().optional(),
  })
  .strip();

/**
 * Partial save.
 *
 * DERIVED AND SERVER-OWNED FIELDS ARE ABSENT BY CONSTRUCTION: `status`, approval gates,
 * `scheduled_for`, `published_at`, `first_published_at`, `word_count`, `reading_time_minutes`,
 * `current_revision_number`, `created_by`, `deleted_at` and `content_type` cannot be set here.
 * `.strip()` removes them silently rather than erroring, so an older client cannot blank a field
 * it does not know about — and cannot forge one either.
 */
export const updateContentBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    slug: z.string().trim().max(200).optional(),
    metaDescription: z.string().trim().max(500).nullable().optional(),
    featuredImageUrl: z.string().trim().max(2048).nullable().optional(),
    featuredImageAlt: z.string().trim().max(500).nullable().optional(),
    body: z.unknown().optional(),
    typeFields: z.record(z.unknown()).optional(),
    editorial: z.record(z.unknown()).optional(),
    pillar: z.string().trim().max(200).nullable().optional(),
    week: z.number().int().nullable().optional(),
    tags: tagsSchema.optional(),
    canonicalUrlOverride: z.string().trim().max(2048).nullable().optional(),
    robotsDirective: robotsDirectiveSchema.optional(),
    authorId: z.string().uuid().nullable().optional(),
    reviewerId: z.string().uuid().nullable().optional(),
    reviewedAt: z.string().datetime().nullable().optional(),
    editorialRef: z.string().trim().max(64).nullable().optional(),

    /** Optimistic concurrency token — the `updated_at` the client loaded. */
    expectedUpdatedAt: z.string().datetime(),
    /** Explicit save captures a revision; autosave does not. */
    createRevision: z.boolean().default(false),
    /** Required to change a PUBLISHED slug, so it can never happen as a side effect. */
    confirmSlugChange: z.boolean().optional(),
    changeSummary: z.string().trim().max(500).optional(),
  })
  .strip();

export const transitionBodySchema = z
  .object({
    action: z.enum(['submit', 'withdraw', 'publish', 'unpublish', 'archive', 'restore']),
    reason: z.string().trim().max(500).optional(),
  })
  .strip();

export const approvalParamsSchema = z.object({
  id: z.string().uuid(),
  gate: approvalGateSchema,
});

export const approvalBodySchema = z
  .object({ state: approvalStateSchema, note: z.string().trim().max(500).optional() })
  .strip();

export const scheduleBodySchema = z.object({ scheduledFor: z.string().datetime() }).strip();

export const revisionParamsSchema = z.object({
  id: z.string().uuid(),
  number: z.coerce.number().int().min(1),
});

export const restoreRevisionBodySchema = z
  .object({ expectedUpdatedAt: z.string().datetime() })
  .strip();

export const listRevisionsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strip();

/** One outbound link. The XOR is enforced here AND by a database CHECK. */
export const linkInputSchema = z
  .object({
    targetKind: linkTargetKindSchema,
    targetContentId: z.string().uuid().nullable().optional(),
    targetRoute: z.string().max(100).nullable().optional(),
    anchorText: z.string().trim().max(200).nullable().optional(),
    relation: linkRelationSchema.default('related_content'),
    sortOrder: z.number().int().min(0).default(0),
  })
  .strip()
  .superRefine((link, ctx) => {
    const hasContent = !!link.targetContentId;
    const hasRoute = !!link.targetRoute;

    if (hasContent === hasRoute) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Exactly one of targetContentId or targetRoute must be set.',
      });
      return;
    }
    if (link.targetKind === 'content' && !hasContent) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'targetKind "content" requires targetContentId.' });
    }
    if (link.targetKind === 'route') {
      if (!hasRoute) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'targetKind "route" requires targetRoute.' });
      } else if (!isRouteKey(link.targetRoute)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown route key: ${link.targetRoute}`,
          path: ['targetRoute'],
        });
      }
    }
  });

export const replaceLinksBodySchema = z.object({ links: z.array(linkInputSchema).max(50) }).strip();

export const clusterBodySchema = z
  .object({
    contentIds: z
      .array(z.string().uuid())
      .min(2, 'A cluster needs at least two members.')
      .max(20, 'A cluster may contain at most twenty members.')
      .refine((ids) => new Set(ids).size === ids.length, { message: 'Duplicate content ids.' }),
  })
  .strip();

// ─── Admin responses ─────────────────────────────────────────────────────────

const approvalSummarySchema = z.object({
  founder: approvalStateSchema,
  marketing: approvalStateSchema,
  seo: approvalStateSchema,
});

const scheduleStateSchema = z.object({ scheduled: z.boolean(), overdue: z.boolean() });

const personSchema = z
  .object({ id: z.string().uuid(), fullName: z.string().nullable(), email: z.string().nullable() })
  .nullable();

export const adminContentListItemSchema = z.object({
  id: z.string().uuid(),
  editorialRef: z.string().nullable(),
  contentType: contentTypeSchema,
  publicLabel: z.string(),
  slug: z.string(),
  title: z.string(),
  status: contentStatusSchema,
  approvals: approvalSummarySchema,
  schedule: scheduleStateSchema,
  scheduledFor: z.string().nullable(),
  tags: z.array(z.string()),
  pillar: z.string().nullable(),
  week: z.number().nullable(),
  author: personSchema,
  readingTimeMinutes: z.number().nullable(),
  wordCount: z.number().nullable(),
  publishedAt: z.string().nullable(),
  updatedAt: z.string(),
  createdAt: z.string(),
});

export const listContentResponseSchema = z.object({
  items: z.array(adminContentListItemSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export const adminLinkSchema = z.object({
  id: z.string().uuid(),
  targetKind: linkTargetKindSchema,
  targetContentId: z.string().uuid().nullable(),
  targetRoute: z.string().nullable(),
  anchorText: z.string().nullable(),
  relation: linkRelationSchema,
  sortOrder: z.number(),
  /** Hydrated so the admin UI can show link health without a second round trip. */
  targetTitle: z.string().nullable(),
  targetSlug: z.string().nullable(),
  targetStatus: contentStatusSchema.nullable(),
  targetPublicLabel: z.string().nullable(),
  routeLabel: z.string().nullable(),
  routeHref: z.string().nullable(),
});

export const linksResponseSchema = z.object({ links: z.array(adminLinkSchema) });

export const inboundLinkSchema = z.object({
  id: z.string().uuid(),
  sourceId: z.string().uuid(),
  sourceTitle: z.string(),
  sourceSlug: z.string(),
  sourceStatus: contentStatusSchema,
  relation: linkRelationSchema,
  anchorText: z.string().nullable(),
});

export const inboundLinksResponseSchema = z.object({ links: z.array(inboundLinkSchema) });

const approvalActorSchema = z.object({
  gate: approvalGateSchema,
  state: approvalStateSchema,
  actorId: z.string().nullable(),
  actorName: z.string().nullable(),
  at: z.string().nullable(),
});

export const adminContentDetailSchema = adminContentListItemSchema.extend({
  metaDescription: z.string().nullable(),
  featuredImageUrl: z.string().nullable(),
  featuredImageAlt: z.string().nullable(),
  body: z.unknown(),
  typeFields: z.record(z.unknown()),
  editorial: z.record(z.unknown()),
  canonicalUrlOverride: z.string().nullable(),
  robotsDirective: z.string(),
  reviewer: personSchema,
  reviewedAt: z.string().nullable(),
  firstPublishedAt: z.string().nullable(),
  currentRevisionNumber: z.number(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
  links: z.array(adminLinkSchema),
  approvalActors: z.array(approvalActorSchema),
});

/**
 * Response of `POST /:id/transition`.
 *
 * This route used to declare its 200 inline as a RAW JSON SCHEMA
 * (`{ type: 'object', properties: { … } }`) while the app serialises with
 * `fastify-type-provider-zod`. That compiler calls `safeParse` on whatever it is handed; given a
 * plain object it takes the `properties` branch and then throws
 * `TypeError: schema.safeParse is not a function` — AFTER the transaction has committed. Every
 * successful transition therefore returned a 500 even though the status change, the revision and
 * the audit event had all landed. Declaring it as Zod, like every other route in this module, is
 * the whole fix.
 */
export const transitionResponseSchema = z.object({
  status: contentStatusSchema,
  revisionNumber: z.number(),
});

export const checklistItemSchema = z.object({
  code: z.string(),
  label: z.string(),
  passed: z.boolean(),
  blocking: z.boolean(),
  details: z.string().optional(),
});

export const checklistResponseSchema = z.object({
  passed: z.boolean(),
  items: z.array(checklistItemSchema),
});

export const revisionSummarySchema = z.object({
  id: z.string().uuid(),
  revisionNumber: z.number(),
  trigger: revisionTriggerSchema,
  statusAtCapture: contentStatusSchema,
  changeSummary: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdByName: z.string().nullable(),
  createdAt: z.string(),
});

export const listRevisionsResponseSchema = z.object({
  items: z.array(revisionSummarySchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export const revisionDetailSchema = revisionSummarySchema.extend({ snapshot: z.unknown() });

export const clusterMemberReportSchema = z.object({
  contentId: z.string().uuid(),
  editorialRef: z.string().nullable(),
  title: z.string(),
  status: contentStatusSchema,
  passed: z.boolean(),
  items: z.array(checklistItemSchema),
});

export const clusterValidationResponseSchema = z.object({
  passed: z.boolean(),
  members: z.array(clusterMemberReportSchema),
  linkResolution: z.array(
    z.object({
      sourceId: z.string().uuid(),
      target: z.string(),
      resolution: z.enum(['published', 'in_cluster', 'route', 'unresolved']),
    })
  ),
});

export const clusterPublishResponseSchema = z.object({
  clusterId: z.string().uuid(),
  published: z.array(z.object({ id: z.string().uuid(), revisionNumber: z.number() })),
});

export type ListContentQuery = z.infer<typeof listContentQuerySchema>;
export type CreateContentInput = z.infer<typeof createContentBodySchema>;
export type UpdateContentInput = z.infer<typeof updateContentBodySchema>;
export type TransitionInput = z.infer<typeof transitionBodySchema>;
export type LinkInput = z.infer<typeof linkInputSchema>;
export type ChecklistItem = z.infer<typeof checklistItemSchema>;
