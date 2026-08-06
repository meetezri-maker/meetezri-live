/**
 * Content Hub — structured body and block type definitions.
 *
 * The body is JSON, never HTML. Text renders as escaped React children, so the only XSS surface
 * is URLs, which are protocol/host allow-listed by the validators.
 *
 * ZOD-FREE BY CONTRACT — see `constants.ts`.
 */

import type { LINK_TARGET_KINDS } from './constants';

// ─── Inline content ──────────────────────────────────────────────────────────

/** Formatting marks permitted on an inline span. Deliberately no colour, font or size. */
export type InlineMark = 'bold' | 'italic' | 'code';

/** Where an inline link points. Internal links resolve by id, so slug changes never break them. */
export type InlineLinkKind = 'content' | 'route' | 'external';

export interface InlineLink {
  kind: InlineLinkKind;
  /** Content id, route-registry key, or absolute URL depending on `kind`. */
  value: string;
}

/** One run of text with optional formatting. The shared unit of prose across every block. */
export interface InlineSpan {
  text: string;
  marks?: InlineMark[];
  link?: InlineLink;
}

/** Rich text within a block: an ordered list of spans. */
export type InlineContent = InlineSpan[];

// ─── Blocks ──────────────────────────────────────────────────────────────────

export type BlockType =
  | 'paragraph'
  | 'heading'
  | 'list'
  | 'quote'
  | 'direct_answer'
  | 'key_takeaway'
  | 'safety_notice'
  | 'cta'
  | 'image'
  | 'divider'
  | 'related_content'
  | 'faq'
  | 'table'
  | 'geo_statement'
  | 'source';

/**
 * Every block carries a stable id — not an array index.
 *
 * Required for React keys, drag-and-drop identity, heading anchors that survive reordering, and
 * (later) block-level revision diffing that can tell "moved" from "deleted and re-added".
 */
interface BlockBase {
  id: string;
}

export interface ParagraphBlock extends BlockBase {
  type: 'paragraph';
  content: InlineContent;
}

export interface HeadingBlock extends BlockBase {
  type: 'heading';
  /** `1` is forbidden — the page title is the only h1. */
  level: 2 | 3 | 4;
  content: InlineContent;
  /** Derived from the text on first save, then kept stable so fragment links do not break. */
  anchorId?: string;
}

export interface ListBlock extends BlockBase {
  type: 'list';
  style: 'bullet' | 'number';
  /** Flat only — no nesting in v1. */
  items: InlineContent[];
}

export interface QuoteBlock extends BlockBase {
  type: 'quote';
  content: InlineContent;
  attribution?: string;
}

/** AEO only. Max one per document, and it must be the first block. */
export interface DirectAnswerBlock extends BlockBase {
  type: 'direct_answer';
  content: InlineContent;
}

export interface KeyTakeawayBlock extends BlockBase {
  type: 'key_takeaway';
  title?: string;
  points: InlineContent[];
}

/** Required on every published item. Excluded from JSON-LD answer extraction. */
export interface SafetyNoticeBlock extends BlockBase {
  type: 'safety_notice';
  variant: 'crisis' | 'disclaimer';
  heading?: string;
  content: InlineContent;
  /** Renders the existing geo-aware crisis hotline lookup. */
  showHotlines?: boolean;
}

export interface CtaBlock extends BlockBase {
  type: 'cta';
  label: string;
  target: { kind: 'content' | 'route' | 'external'; value: string };
  description?: string;
  style?: 'primary' | 'secondary';
}

/**
 * Schema-valid but NOT offered in the v1 editor palette ("featured image only").
 *
 * `credit` and `license` are reserved now so enabling inline images later is a palette flag, not
 * a body-schema version bump.
 */
export interface ImageBlock extends BlockBase {
  type: 'image';
  url: string;
  /** Required whenever the block is used — accessibility, non-negotiable. */
  alt: string;
  caption?: InlineContent;
  width?: number;
  height?: number;
  credit?: string;
  license?: { label: string; url?: string };
}

export interface DividerBlock extends BlockBase {
  type: 'divider';
}

export interface RelatedContentBlock extends BlockBase {
  type: 'related_content';
  heading?: string;
  mode: 'auto' | 'manual';
  /** Content ids; required when `mode` is `manual`. */
  items?: string[];
}

/** One FAQ block holds every question — grouped so `FAQPage` JSON-LD has a natural unit. */
export interface FaqItem {
  id: string;
  question: string;
  answer: InlineContent;
}

export interface FaqBlock extends BlockBase {
  type: 'faq';
  heading?: string;
  items: FaqItem[];
}

export interface TableBlock extends BlockBase {
  type: 'table';
  caption?: string;
  headers: string[];
  /** Every row must have `headers.length` cells. */
  rows: InlineContent[][];
}

/**
 * GEO only.
 *
 * `statement`, `examples` and `clarification` are PUBLIC. `coreMessage` and `citationGoal` are
 * INTERNAL and must be stripped by the public serializer — which is why serialization is
 * field-level, not block-level.
 */
export interface GeoStatementBlock extends BlockBase {
  type: 'geo_statement';
  statement: InlineContent;
  coreMessage?: string;
  citationGoal?: string;
  examples?: string[];
  clarification?: InlineContent;
}

export interface SourceBlock extends BlockBase {
  type: 'source';
  label: string;
  url: string;
  publisher?: string;
  accessedAt?: string;
}

export type ContentBlock =
  | ParagraphBlock
  | HeadingBlock
  | ListBlock
  | QuoteBlock
  | DirectAnswerBlock
  | KeyTakeawayBlock
  | SafetyNoticeBlock
  | CtaBlock
  | ImageBlock
  | DividerBlock
  | RelatedContentBlock
  | FaqBlock
  | TableBlock
  | GeoStatementBlock
  | SourceBlock;

/** The stored body envelope. `version` is a schema version, not a content revision. */
export interface ContentBody {
  version: number;
  blocks: ContentBlock[];
}

// ─── Per-type block availability ─────────────────────────────────────────────

/** Blocks restricted to one content type. Anything absent here is allowed everywhere. */
export const TYPE_RESTRICTED_BLOCKS: Readonly<Record<string, BlockType[]>> = {
  aeo_answer: ['direct_answer'],
  geo_article: ['geo_statement'],
};

/** Blocks valid in the schema but withheld from the v1 editor palette. */
export const EDITOR_DISABLED_BLOCKS: readonly BlockType[] = ['image'];

/** Fields on public blocks that must never reach a public response. */
export const INTERNAL_BLOCK_FIELDS: Readonly<Partial<Record<BlockType, readonly string[]>>> = {
  geo_statement: ['coreMessage', 'citationGoal'],
};

/** Narrowing helper for the many places that branch on block type. */
export function isBlockOfType<T extends BlockType>(
  block: ContentBlock,
  type: T
): block is Extract<ContentBlock, { type: T }> {
  return block.type === type;
}

/** Keeps `LINK_TARGET_KINDS` referenced so the constant and the type cannot drift apart. */
export type LinkTargetKind = (typeof LINK_TARGET_KINDS)[number];
