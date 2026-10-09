/**
 * `/sitemap.xml` and `/robots.txt`.
 *
 * The sitemap lists only what a search engine should actually be offered: the marketing routes
 * this project already exposes publicly, `/resources`, and every published resource whose stored
 * robots directive permits indexing.
 *
 * Everything else is excluded by construction rather than by filtering: the resource rows come
 * from the public read seam, which already returns published, non-deleted content only. Draft,
 * in-review, approved-but-unpublished, unpublished, archived and soft-deleted content is not
 * reachable from here, so it cannot be listed by mistake.
 */

import { PUBLIC_SEO_REGISTRY, absoluteUrl, toIsoDate } from '@meetezri/public-content';
import type { PublicCard } from '../content-hub/content-hub.public.schema';

export interface SitemapEntry {
  path: string;
  lastModified?: string | null;
  changeFrequency?: 'daily' | 'weekly' | 'monthly';
  priority?: string;
}

/** Static sitemap eligibility comes from the shared public SEO registry. */
export const STATIC_PUBLIC_ROUTES: SitemapEntry[] = PUBLIC_SEO_REGISTRY
  .filter((entry) => entry.indexable && entry.sitemap)
  .map((entry) => ({
    path: entry.path,
    changeFrequency: entry.sitemap!.changeFrequency,
    priority: entry.sitemap!.priority,
  }));

/** XML text escaping. Applied to every value, including paths — slugs are user-authored. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** A resource is listed only when its STORED robots directive allows indexing. */
export function isIndexable(robots: string | null | undefined): boolean {
  return !String(robots ?? 'index,follow')
    .toLowerCase()
    .includes('noindex');
}

export interface BuildSitemapInput {
  origin: string;
  /** Published cards, already filtered to indexable ones by the caller. */
  resources: Array<PublicCard & { robots?: string }>;
}

export function buildSitemap({ origin, resources }: BuildSitemapInput): string {
  const entries: SitemapEntry[] = [
    ...STATIC_PUBLIC_ROUTES,
    { path: '/resources', changeFrequency: 'daily', priority: '0.9' },
    ...resources.map((card) => ({
      path: `/resources/${card.slug}`,
      lastModified: card.updatedAt ?? card.publishedAt,
      changeFrequency: 'monthly' as const,
      priority: '0.7',
    })),
  ];

  const urls = entries
    .map((entry) => {
      const lastmod = toIsoDate(entry.lastModified ?? null);
      return [
        '  <url>',
        `    <loc>${escapeXml(absoluteUrl(origin, entry.path))}</loc>`,
        lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
        entry.changeFrequency ? `    <changefreq>${entry.changeFrequency}</changefreq>` : null,
        entry.priority ? `    <priority>${entry.priority}</priority>` : null,
        '  </url>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

/**
 * `robots.txt`.
 *
 * AI crawlers are NOT blocked. Answer-engine visibility is the stated product goal for this
 * content, and blocking GPTBot or ClaudeBot while publishing content designed to be cited would
 * be working against it. No crawler-specific content rules are added — every agent gets the same
 * instructions, which is also what makes the parity guarantee in the renderer meaningful.
 *
 * Admin, member-app, onboarding and auth paths are disallowed. That is a crawl-budget and
 * hygiene measure, not a security control: these routes are already protected server-side, and
 * robots.txt is a public file that must not read as a map of interesting targets.
 */
export function buildRobots(origin: string): string {
  return `# Solace
User-agent: *
Allow: /
Allow: /resources
Disallow: /admin
Disallow: /app
Disallow: /onboarding
Disallow: /login
Disallow: /signup
Disallow: /auth
Disallow: /reset-password
Disallow: /verify-email
Disallow: /forgot-password
Disallow: /invite
Disallow: /_public
Disallow: /profile
Disallow: /error
Disallow: /dev

Sitemap: ${absoluteUrl(origin, '/sitemap.xml')}
`;
}
