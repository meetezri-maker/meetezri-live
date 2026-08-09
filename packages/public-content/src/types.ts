/**
 * The public view contract.
 *
 * These types describe exactly what the Phase 2 public serializer emits — nothing more. They are
 * declared here rather than imported from the API because this package must be consumable by
 * `apps/web` too, and the two apps cannot import each other.
 *
 * The API owns the RUNTIME truth (`content-hub.public.schema.ts`, which Fastify validates
 * responses against). This file owns the VIEW truth. `content-hub.render.contract.test.ts` in the
 * API asserts the zod-inferred `PublicDetail` is assignable to `PublicResource` below, so the two
 * cannot drift silently: a serializer change that breaks the renderer fails the API type-check.
 *
 * Note what is absent and must stay absent: status, approvals, editorial, editorialRef, tags,
 * scheduledFor, internal ids, and the internal content-type string.
 */

/** The three public labels. The internal type (`aeo_answer`…) is never present. */
export type PublicLabel = 'Answer' | 'Insight' | 'Article';

export interface PublicSpan {
  text: string;
  marks?: Array<'bold' | 'italic' | 'code'>;
  link?: { href: string; external: boolean };
}

export type PublicInline = PublicSpan[];

export interface PublicPerson {
  name: string;
  title: string | null;
  bio: string | null;
  avatarUrl: string | null;
}

export interface PublicResourceCard {
  slug: string;
  label: PublicLabel;
  title: string;
  description: string | null;
  featuredImageUrl: string | null;
  featuredImageAlt: string | null;
  readingTimeMinutes: number | null;
  publishedAt: string | null;
  updatedAt: string | null;
}

export interface PublicResourceLink {
  label: string;
  href: string;
  relation: string;
}

export type PublicBlock =
  | { id: string; type: 'paragraph'; content: PublicInline }
  | { id: string; type: 'heading'; level: number; content: PublicInline; anchorId?: string }
  | { id: string; type: 'list'; style: 'bullet' | 'number'; items: PublicInline[] }
  | { id: string; type: 'quote'; content: PublicInline; attribution?: string }
  | { id: string; type: 'direct_answer'; content: PublicInline }
  | { id: string; type: 'key_takeaway'; title?: string; points: PublicInline[] }
  | {
      id: string;
      type: 'safety_notice';
      variant: 'crisis' | 'disclaimer';
      heading?: string;
      content: PublicInline;
      showHotlines?: boolean;
    }
  | {
      id: string;
      type: 'cta';
      label: string;
      href: string;
      external: boolean;
      description?: string;
      style?: 'primary' | 'secondary';
    }
  | {
      id: string;
      type: 'image';
      url: string;
      alt: string;
      caption?: PublicInline;
      width?: number;
      height?: number;
      credit?: string;
    }
  | { id: string; type: 'divider' }
  | { id: string; type: 'related_content'; heading?: string; items: PublicResourceCard[] }
  | {
      id: string;
      type: 'faq';
      heading?: string;
      items: Array<{ id: string; question: string; answer: PublicInline }>;
    }
  | { id: string; type: 'table'; caption?: string; headers: string[]; rows: PublicInline[][] }
  | {
      id: string;
      type: 'geo_statement';
      /** `coreMessage` and `citationGoal` are INTERNAL and structurally absent. */
      statement: PublicInline;
      examples?: string[];
      clarification?: PublicInline;
    }
  | {
      id: string;
      type: 'source';
      label: string;
      url: string;
      publisher?: string;
      accessedAt?: string;
    };

export interface PublicBody {
  version: number;
  blocks: PublicBlock[];
}

/** Public type-specific fields. Only the explicitly public subset per type. */
export interface PublicTypeFields {
  primaryQuestion?: string;
  snippetAnswer?: string;
  citationSummary?: string;
  keyStatements?: string[];
}

export interface PublicResource {
  slug: string;
  label: PublicLabel;
  title: string;
  description: string | null;
  canonicalPath: string;
  canonicalUrlOverride: string | null;
  robots: string;
  featuredImageUrl: string | null;
  featuredImageAlt: string | null;
  body: PublicBody;
  typeFields: PublicTypeFields;
  author: PublicPerson | null;
  reviewer: PublicPerson | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
  readingTimeMinutes: number | null;
  links: PublicResourceLink[];
  related: PublicResourceCard[];
}

export interface PublicResourceList {
  items: PublicResourceCard[];
  total: number;
  page: number;
  pageSize: number;
}
