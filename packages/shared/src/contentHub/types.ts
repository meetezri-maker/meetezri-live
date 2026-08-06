/**
 * Content Hub — core domain types.
 *
 * ZOD-FREE BY CONTRACT — see `constants.ts`.
 */

import type {
  APPROVAL_GATES,
  APPROVAL_STATES,
  CONTENT_STATUSES,
  CONTENT_TYPES,
  LINK_RELATIONS,
  LINK_TARGET_KINDS,
  PUBLIC_CONTENT_LABEL,
  REVISION_TRIGGERS,
  ROBOTS_DIRECTIVES,
} from './constants';
import type { ContentBody } from './blocks';

export type ContentType = (typeof CONTENT_TYPES)[number];
export type ContentStatus = (typeof CONTENT_STATUSES)[number];
export type ApprovalState = (typeof APPROVAL_STATES)[number];
export type ApprovalGate = (typeof APPROVAL_GATES)[number];
export type RobotsDirective = (typeof ROBOTS_DIRECTIVES)[number];
export type RevisionTrigger = (typeof REVISION_TRIGGERS)[number];
export type LinkTargetKind = (typeof LINK_TARGET_KINDS)[number];
export type LinkRelation = (typeof LINK_RELATIONS)[number];

/** What the public site calls each internal type. */
export type PublicContentLabel = (typeof PUBLIC_CONTENT_LABEL)[ContentType];

/**
 * Type-specific structured data. Mixed public/internal — the split is per field and is enforced
 * by the public serializer (Phase 2), not by this type.
 */
export interface AeoTypeFields {
  primary_question?: string;
  /** Internal — query-targeting intent, never rendered. */
  supporting_queries?: string[];
  /** Public via meta/JSON-LD, not rendered a second time on the page. */
  snippet_answer?: string;
  keywords?: { primary?: string; secondary?: string[] };
}

export interface GeoTypeFields {
  /** Internal — the article's thesis. */
  core_concept?: string;
  supporting_concepts?: string[];
  /** Public — reused as JSON-LD `description`. */
  citation_summary?: string;
  /** Public, ordered. */
  key_statements?: string[];
  topics?: { primary?: string; secondary?: string[] };
}

export interface SeoTypeFields {
  keywords?: { primary?: string; secondary?: string[] };
  /** Internal — compared against derived `word_count`. */
  word_count_target?: string;
  funnel_stage?: string;
}

export type ContentTypeFields = AeoTypeFields | GeoTypeFields | SeoTypeFields;

/**
 * Internal-only editorial metadata.
 *
 * Stored in its own column so the public/internal boundary is structural: the public query never
 * selects it, so a leak requires removing a column from a query rather than forgetting a field
 * in a filter.
 */
export interface ContentEditorialMetadata {
  purpose?: string;
  strategy?: string;
  goal?: string;
  expected_outcome?: string;
  business_goal?: string;
  target_engines?: string[];
  search_intent?: string;
  user_state?: string;
  primary_kpi?: string;
  secondary_kpi?: string;
  citation_friendly?: string;
  aeo_signal?: string;
  geo_signal?: string;
  geo_focus?: string;
  question_coverage?: string;
  objective?: string[];
  /** Qualitative editorial intent (e.g. "AI Citations" -> "Growing Monthly"). Never measured in v1. */
  kpi_targets?: Array<{ metric: string; goal: string }>;
}

/** The three approval gates, keyed by gate name. */
export type ApprovalGateStates = Record<ApprovalGate, ApprovalState>;

/**
 * A content item as the domain sees it.
 *
 * Mirrors the `content_items` table. Optional fields are optional because **a draft may be
 * incomplete** — publish-time requirements are enforced by validation, not by column nullability
 * (which would make creating a draft impossible).
 */
export interface ContentItem {
  id: string;
  editorial_ref?: string | null;
  content_type: ContentType;
  slug: string;
  title: string;
  meta_description?: string | null;
  featured_image_url?: string | null;
  featured_image_alt?: string | null;
  body: ContentBody;
  type_fields: ContentTypeFields;
  canonical_url_override?: string | null;
  robots_directive: RobotsDirective;
  editorial: ContentEditorialMetadata;
  pillar?: string | null;
  week?: number | null;
  tags: string[];
  status: ContentStatus;
  founder_approval: ApprovalState;
  marketing_approval: ApprovalState;
  seo_approval: ApprovalState;
  scheduled_for?: string | null;
  author_id?: string | null;
  reviewer_id?: string | null;
  reviewed_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  first_published_at?: string | null;
  published_at?: string | null;
  reading_time_minutes?: number | null;
  word_count?: number | null;
  current_revision_number: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

/** Immutable snapshot of the authored fields. Excludes identity and derived values by design. */
export interface ContentRevisionSnapshot {
  title: string;
  slug: string;
  meta_description?: string | null;
  featured_image_url?: string | null;
  featured_image_alt?: string | null;
  body: ContentBody;
  type_fields: ContentTypeFields;
  editorial: ContentEditorialMetadata;
  pillar?: string | null;
  week?: number | null;
  tags: string[];
  author_id?: string | null;
  reviewer_id?: string | null;
  reviewed_at?: string | null;
  canonical_url_override?: string | null;
  robots_directive: RobotsDirective;
  status: ContentStatus;
  founder_approval: ApprovalState;
  marketing_approval: ApprovalState;
  seo_approval: ApprovalState;
}

export interface ContentRevision {
  id: string;
  content_id: string;
  revision_number: number;
  snapshot: ContentRevisionSnapshot;
  trigger: RevisionTrigger;
  status_at_capture: ContentStatus;
  change_summary?: string | null;
  created_by?: string | null;
  created_at: string;
}

/**
 * An outbound link. Exactly one of `target_content_id` / `target_route` is set — the table exists
 * (rather than a JSONB array) for the reverse lookup and the publish-time integrity join.
 */
export interface ContentLink {
  id: string;
  source_id: string;
  target_kind: LinkTargetKind;
  target_content_id?: string | null;
  target_route?: string | null;
  anchor_text?: string | null;
  relation: LinkRelation;
  sort_order: number;
  created_at: string;
}

/** Derived scheduling state. Never stored — computed so it cannot drift from `status`. */
export interface ScheduleState {
  scheduled: boolean;
  overdue: boolean;
}
