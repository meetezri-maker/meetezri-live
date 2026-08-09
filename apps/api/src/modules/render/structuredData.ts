/**
 * JSON-LD generation.
 *
 * Built ENTIRELY ON THE SERVER from serializer output. Admins never edit raw JSON-LD — a field
 * that lets someone paste arbitrary JSON into the head of a public page is a disclosure and
 * injection surface with no editorial upside.
 *
 * Type mapping, per the approved architecture:
 *
 *   Answer  → Article, plus the FAQPage graph node when a FAQ block is present
 *   Insight → Article
 *   Article → BlogPosting
 *
 * There is deliberately no schema.org type named "AEO" or "GEO" — those are internal strategy
 * names and do not exist in the vocabulary.
 *
 * Realistic expectation, stated because it is easy to over-promise: FAQ markup makes the content
 * machine-readable. It does not guarantee a Google rich result, and Google has substantially
 * narrowed FAQ rich results.
 */

import { absoluteUrl } from '@meetezri/public-content';
import type { PublicDetail } from '../content-hub/content-hub.public.schema';
import { SITE_NAME } from './metadata';

type Json = Record<string, unknown>;

/** Removes null/undefined/empty entries so the emitted graph carries no hollow properties. */
function compact(input: Json): Json {
  const out: Json = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out;
}

function publisher(origin: string): Json {
  return {
    '@type': 'Organization',
    name: SITE_NAME,
    url: absoluteUrl(origin, '/'),
  };
}

/**
 * A person node.
 *
 * `jobTitle` appears only when the serializer actually exposes a title. Manufacturing a
 * credential in structured data would be a factual claim about a real person.
 */
function person(input: { name: string; title: string | null } | null): Json | null {
  if (!input?.name) return null;
  return compact({ '@type': 'Person', name: input.name, jobTitle: input.title });
}

export function breadcrumbList(origin: string, trail: Array<{ name: string; path?: string }>): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, index) =>
      compact({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: crumb.path ? absoluteUrl(origin, crumb.path) : undefined,
      })
    ),
  };
}

/** `Article` for Answer and Insight, `BlogPosting` for Article. */
export function articleTypeFor(label: PublicDetail['label']): 'Article' | 'BlogPosting' {
  return label === 'Article' ? 'BlogPosting' : 'Article';
}

export function articleSchema(origin: string, detail: PublicDetail, canonical: string): Json {
  const author = person(detail.author);
  const reviewer = person(detail.reviewer);

  return {
    '@context': 'https://schema.org',
    ...compact({
      '@type': articleTypeFor(detail.label),
      headline: detail.title,
      // An Answer's snippet answer is the most citable single sentence it has; fall back to the
      // stored meta description for the other two types.
      description: detail.typeFields.snippetAnswer ?? detail.description,
      datePublished: detail.publishedAt,
      dateModified: detail.updatedAt ?? detail.publishedAt,
      author,
      // `reviewedBy` only when a reviewer exists AND a review date does — a reviewer with no
      // review date is an editorial assignment, not a published claim of review.
      reviewedBy: reviewer && detail.reviewedAt ? reviewer : undefined,
      publisher: publisher(origin),
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      image: detail.featuredImageUrl ?? undefined,
      inLanguage: 'en',
      url: canonical,
    }),
  };
}

/**
 * FAQPage, built from the one FAQ block the content model allows.
 *
 * Only emitted when the block has at least one item with both a question and answer text —
 * an empty FAQPage is worse than none.
 */
export function faqSchema(detail: PublicDetail): Json | null {
  const faq = detail.body.blocks.find((block) => block.type === 'faq');
  if (!faq || faq.type !== 'faq') return null;

  const entities = faq.items
    .map((item): Json | null => {
      const answer = item.answer.map((span) => span.text).join('').trim();
      if (!item.question?.trim() || !answer) return null;
      return {
        '@type': 'Question',
        name: item.question.trim(),
        acceptedAnswer: { '@type': 'Answer', text: answer },
      };
    })
    .filter((entity): entity is Json => entity !== null);

  if (entities.length === 0) return null;

  return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: entities };
}

/** Every JSON-LD document for a resource detail page, in emission order. */
export function resourceStructuredData(
  origin: string,
  detail: PublicDetail,
  canonical: string
): Json[] {
  const documents: Json[] = [
    articleSchema(origin, detail, canonical),
    breadcrumbList(origin, [
      { name: 'Home', path: '/' },
      { name: 'Resources', path: '/resources' },
      { name: detail.title },
    ]),
  ];

  const faq = faqSchema(detail);
  if (faq) documents.push(faq);

  return documents;
}

/** `/resources` gets a breadcrumb and a collection node — never an Article node. */
export function libraryStructuredData(origin: string, canonical: string): Json[] {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Solace Resources',
      url: canonical,
      isPartOf: publisher(origin),
    },
    breadcrumbList(origin, [{ name: 'Home', path: '/' }, { name: 'Resources' }]),
  ];
}

/**
 * Serialise a JSON-LD document for a `<script>` tag.
 *
 * `<` is escaped so a title containing `</script>` cannot close the tag early. This is the one
 * place in the public render path where text is written into HTML without React escaping it, so
 * it gets the escaping done explicitly rather than assumed.
 */
export function serialiseJsonLd(document: Json): string {
  return JSON.stringify(document).replace(/</g, '\\u003c');
}
