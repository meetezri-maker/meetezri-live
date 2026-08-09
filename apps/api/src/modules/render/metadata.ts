/**
 * Public page metadata.
 *
 * Everything here is DERIVED FROM STORED VALUES. Nothing is synthesised: if a published record
 * has no meta description, the tag is omitted rather than invented, because the publish checklist
 * already blocks publishing without one and quietly generating marketing copy would hide that
 * failure instead of surfacing it.
 *
 * The tag set mirrors `apps/web/src/app/features/prelaunch/usePrelaunchMeta.ts` — the repository's
 * established social metadata pattern — so the public site is consistent rather than inventing a
 * second convention.
 */

import { absoluteUrl } from '@meetezri/public-content';
import type { PublicDetail } from '../content-hub/content-hub.public.schema';

/** Solace's title suffix. One place, so a rename is one edit. */
export const SITE_NAME = 'Solace';

/** Applied to every page title except one that already ends with the site name. */
export function pageTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed.endsWith(SITE_NAME) ? trimmed : `${trimmed} | ${SITE_NAME}`;
}

export interface MetaTag {
  /** `name` or `property`, matching the repo's existing usage per tag. */
  kind: 'name' | 'property' | 'link';
  key: string;
  value: string;
}

export interface PageMetadata {
  title: string;
  canonical: string;
  robots: string;
  description: string | null;
  tags: MetaTag[];
}

/**
 * Canonical URL for a resource.
 *
 * A stored override wins, but only when it is an absolute https URL — a relative or http override
 * would produce a canonical that points somewhere useless, and a canonical is the one tag where
 * being wrong actively harms the page it is on.
 */
export function canonicalFor(origin: string, detail: PublicDetail): string {
  const override = detail.canonicalUrlOverride?.trim();
  if (override && /^https:\/\/\S+$/i.test(override)) return override;
  return absoluteUrl(origin, detail.canonicalPath);
}

export function resourceMetadata(origin: string, detail: PublicDetail): PageMetadata {
  const canonical = canonicalFor(origin, detail);
  const title = pageTitle(detail.title);
  const description = detail.description?.trim() || null;
  const image = detail.featuredImageUrl?.trim() || null;

  const tags: MetaTag[] = [{ kind: 'link', key: 'canonical', value: canonical }];

  if (description) {
    tags.push({ kind: 'name', key: 'description', value: description });
  }

  tags.push({ kind: 'name', key: 'robots', value: detail.robots });

  // Open Graph. `article` for every resource type — they are all dated, authored articles as far
  // as Open Graph is concerned; the public label is a Solace distinction, not an OG one.
  tags.push({ kind: 'property', key: 'og:type', value: 'article' });
  tags.push({ kind: 'property', key: 'og:site_name', value: SITE_NAME });
  tags.push({ kind: 'property', key: 'og:title', value: detail.title });
  if (description) tags.push({ kind: 'property', key: 'og:description', value: description });
  tags.push({ kind: 'property', key: 'og:url', value: canonical });
  if (image) tags.push({ kind: 'property', key: 'og:image', value: image });
  if (detail.featuredImageAlt) {
    tags.push({ kind: 'property', key: 'og:image:alt', value: detail.featuredImageAlt });
  }
  if (detail.publishedAt) {
    tags.push({ kind: 'property', key: 'article:published_time', value: detail.publishedAt });
  }
  if (detail.updatedAt) {
    tags.push({ kind: 'property', key: 'article:modified_time', value: detail.updatedAt });
  }

  // Twitter — the same four properties `usePrelaunchMeta` sets, no more. Inventing unsupported
  // properties would be noise.
  tags.push({
    kind: 'name',
    key: 'twitter:card',
    value: image ? 'summary_large_image' : 'summary',
  });
  tags.push({ kind: 'name', key: 'twitter:title', value: detail.title });
  if (description) tags.push({ kind: 'name', key: 'twitter:description', value: description });
  if (image) tags.push({ kind: 'name', key: 'twitter:image', value: image });

  return { title, canonical, robots: detail.robots, description, tags };
}

const LIBRARY_DESCRIPTION =
  'Clear, careful answers about talking things through, looking after your mental wellbeing, and getting support when you need it.';

/**
 * Metadata for `/resources`.
 *
 * Paginated and filtered views point their canonical at themselves so the pages are not treated
 * as duplicates of page one, but they are marked `noindex,follow`: the index has value as a crawl
 * path, while page 7 of a filter has none as a search result.
 */
export function libraryMetadata(
  origin: string,
  options: { page: number; label: string | null; path: string }
): PageMetadata {
  const canonical = absoluteUrl(origin, options.path);
  const isRoot = options.page === 1 && !options.label;
  const title = isRoot
    ? pageTitle('Resources')
    : pageTitle(options.label ? `${options.label}s — Resources` : `Resources — page ${options.page}`);

  const tags: MetaTag[] = [
    { kind: 'link', key: 'canonical', value: canonical },
    { kind: 'name', key: 'description', value: LIBRARY_DESCRIPTION },
    { kind: 'name', key: 'robots', value: isRoot ? 'index,follow' : 'noindex,follow' },
    { kind: 'property', key: 'og:type', value: 'website' },
    { kind: 'property', key: 'og:site_name', value: SITE_NAME },
    { kind: 'property', key: 'og:title', value: title },
    { kind: 'property', key: 'og:description', value: LIBRARY_DESCRIPTION },
    { kind: 'property', key: 'og:url', value: canonical },
    { kind: 'name', key: 'twitter:card', value: 'summary' },
    { kind: 'name', key: 'twitter:title', value: title },
    { kind: 'name', key: 'twitter:description', value: LIBRARY_DESCRIPTION },
  ];

  return {
    title,
    canonical,
    robots: isRoot ? 'index,follow' : 'noindex,follow',
    description: LIBRARY_DESCRIPTION,
    tags,
  };
}

export function notFoundMetadata(origin: string, path: string): PageMetadata {
  return {
    title: pageTitle('Page not found'),
    canonical: absoluteUrl(origin, path),
    robots: 'noindex,nofollow',
    description: null,
    tags: [{ kind: 'name', key: 'robots', value: 'noindex,nofollow' }],
  };
}
