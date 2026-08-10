/**
 * Server render for `/resources` and the 404 page.
 *
 * Same shared components as the SPA. The index is one unified library with public-label filters —
 * never separate AEO/GEO/SEO sections, which would put internal strategy names on a public page.
 */

import { ResourcesLibrary, type PublicLabel } from '@meetezri/public-content';
import type { PublicCard } from '../content-hub/content-hub.public.schema';
import { renderDocument } from './renderDocument';
import { libraryMetadata, notFoundMetadata } from './metadata';
import { libraryStructuredData, breadcrumbList } from './structuredData';
import type { AssetLinks } from './assetManifest';

export interface RenderResourcesIndexInput {
  origin: string;
  items: PublicCard[];
  total: number;
  page: number;
  pageSize: number;
  label: PublicLabel | null;
  assets: AssetLinks;
}

/** `/resources?type=Answer&page=2` — the same shape the SPA produces, so links survive hydration. */
export function libraryHref(params: { label?: PublicLabel | null; page?: number }): string {
  const search = new URLSearchParams();
  if (params.label) search.set('type', params.label);
  if (params.page && params.page > 1) search.set('page', String(params.page));
  const query = search.toString();
  return query ? `/resources?${query}` : '/resources';
}

export function renderResourcesIndex({
  origin,
  items,
  total,
  page,
  pageSize,
  label,
  assets,
}: RenderResourcesIndexInput): string {
  const path = libraryHref({ label, page });
  const metadata = libraryMetadata(origin, { page, label, path });

  return renderDocument({
    metadata,
    structuredData: libraryStructuredData(origin, metadata.canonical),
    assets,
    pathname: '/resources',
    children: (
      <ResourcesLibrary
        items={items}
        total={total}
        page={page}
        pageSize={pageSize}
        activeLabel={label}
        buildHref={libraryHref}
      />
    ),
  });
}

/**
 * The public 404 body.
 *
 * Says nothing about WHY the resource is unavailable. A draft, an unpublished item, an archived
 * item and a slug that never existed all produce this identical page — anything else would let an
 * anonymous visitor probe the editorial pipeline for unreleased titles.
 */
export function renderNotFound({
  origin,
  path,
  assets,
}: {
  origin: string;
  path: string;
  assets: AssetLinks;
}): string {
  return renderDocument({
    metadata: notFoundMetadata(origin, path),
    structuredData: [breadcrumbList(origin, [{ name: 'Home', path: '/' }, { name: 'Not found' }])],
    assets,
    pathname: path,
    children: (
      <div className="sol-page">
        <div className="sol-article">
          <h1>We could not find that page</h1>
          <p className="sol-lede">
            The page you were looking for is not available. It may have moved, or the address may
            be slightly different.
          </p>
          <p>
            <a className="sol-cta-link" href="/resources">
              Browse Solace Resources
            </a>
          </p>
        </div>
      </div>
    ),
  });
}
