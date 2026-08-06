/**
 * Content Hub — shared domain foundation.
 *
 * ZOD-FREE BY CONTRACT. Nothing in this subtree imports zod. `packages/shared` depends on zod v3
 * while `apps/web` uses v4, so exporting a schema instance from here would put two zod runtimes
 * in one bundle. The API and web each build their own schemas from these types and prove
 * agreement by validating the SAME fixtures. See CONTENT_HUB_IMPLEMENTATION_PLAN.md §2.4.1.
 *
 * This barrel is re-exported from `packages/shared/src/index.ts`, matching how every other
 * shared module is exposed.
 */

export {
  ALLOWED_LINK_PROTOCOLS,
  APPROVAL_GATES,
  APPROVAL_STATES,
  BLOCKED_LINK_PROTOCOLS,
  CONTENT_BODY_VERSION,
  CONTENT_LIMITS,
  CONTENT_STATUSES,
  CONTENT_TYPES,
  LINK_RELATIONS,
  LINK_TARGET_KINDS,
  PUBLIC_CONTENT_BASE_PATH,
  PUBLIC_CONTENT_LABEL,
  RESERVED_SLUGS,
  REVISION_TRIGGERS,
  ROBOTS_DIRECTIVES,
} from './constants';

export {
  EDITOR_DISABLED_BLOCKS,
  INTERNAL_BLOCK_FIELDS,
  TYPE_RESTRICTED_BLOCKS,
  isBlockOfType,
  type BlockType,
  type ContentBlock,
  type ContentBody,
  type CtaBlock,
  type DirectAnswerBlock,
  type DividerBlock,
  type FaqBlock,
  type FaqItem,
  type GeoStatementBlock,
  type HeadingBlock,
  type ImageBlock,
  type InlineContent,
  type InlineLink,
  type InlineLinkKind,
  type InlineMark,
  type InlineSpan,
  type KeyTakeawayBlock,
  type ListBlock,
  type ParagraphBlock,
  type QuoteBlock,
  type RelatedContentBlock,
  type SafetyNoticeBlock,
  type SourceBlock,
  type TableBlock,
} from './blocks';

export {
  type AeoTypeFields,
  type ApprovalGate,
  type ApprovalGateStates,
  type ApprovalState,
  type ContentEditorialMetadata,
  type ContentItem,
  type ContentLink,
  type ContentRevision,
  type ContentRevisionSnapshot,
  type ContentStatus,
  type ContentType,
  type ContentTypeFields,
  type GeoTypeFields,
  type LinkRelation,
  type LinkTargetKind,
  type PublicContentLabel,
  type RevisionTrigger,
  type RobotsDirective,
  type ScheduleState,
  type SeoTypeFields,
} from './types';

export {
  ROUTE_KEYS,
  ROUTE_REGISTRY,
  interimRouteKeys,
  isRouteKey,
  resolveRouteHref,
  resolveRouteLabel,
  type RouteKey,
  type RouteRegistryEntry,
} from './routeRegistry';

export {
  countBodyWords,
  deriveReadingStats,
  isAbsoluteHttpUrl,
  isAllowedImageUrl,
  isContentStatus,
  isContentType,
  isReservedSlug,
  isSafeExternalUrl,
  normaliseSlug,
  normaliseTags,
  publicLabelFor,
  readingTimeMinutes,
  validateContentBody,
  validateSlug,
  validateTags,
  type SlugRejectionReason,
  type ValidateBodyOptions,
  type ValidationIssue,
  type ValidationResult,
} from './validate';

export {
  FIXTURE_ROUTE_KEYS,
  INTERNAL_SENTINELS,
  SENTINEL_BODY,
  VALID_AEO_BODY,
  VALID_GEO_BODY,
  VALID_SEO_BODY,
} from './fixtures/valid';

export {
  BAD_BODY_VERSION,
  DIRECT_ANSWER_NOT_FIRST,
  DUPLICATE_BLOCK_IDS,
  IMAGE_WITHOUT_ALT,
  INVALID_BODY_FIXTURES,
  INVALID_SLUG_INPUTS,
  INVALID_TAG_INPUTS,
  MISSING_SAFETY_NOTICE,
  MULTIPLE_FAQ_BLOCKS,
  TABLE_ROW_MISMATCH,
  UNKNOWN_ROUTE_CTA,
  UNSAFE_INLINE_LINK,
  WRONG_TYPE_BLOCK,
  type InvalidBodyFixture,
} from './fixtures/invalid';
