/**
 * Server render for `/resources/:slug`.
 *
 * The page body is `ResourceArticle` from `@meetezri/public-content` — the SAME component the SPA
 * and the admin preview render. There is one implementation, so "the preview showed something the
 * public page does not" is not a class of bug that can exist here.
 *
 * Input is `PublicDetail` from the public read seam. This module never touches Prisma, never sees
 * a raw row, and has no way to reach an unpublished record.
 */

import { ResourceArticle } from '@meetezri/public-content';
import type { PublicDetail } from '../content-hub/content-hub.public.schema';
import { renderDocument } from './renderDocument';
import { canonicalFor, resourceMetadata } from './metadata';
import { resourceStructuredData } from './structuredData';
import type { AssetLinks } from './assetManifest';

export interface RenderResourceDetailInput {
  origin: string;
  detail: PublicDetail;
  assets: AssetLinks;
}

export function renderResourceDetail({
  origin,
  detail,
  assets,
}: RenderResourceDetailInput): string {
  const canonical = canonicalFor(origin, detail);

  return renderDocument({
    metadata: resourceMetadata(origin, detail),
    structuredData: resourceStructuredData(origin, detail, canonical),
    assets,
    pathname: detail.canonicalPath,
    // `PublicDetail` is the zod-inferred serializer type; `PublicResource` is the view type.
    // `content-hub.render.contract.test.ts` asserts the two agree, so this cast is checked.
    children: <ResourceArticle resource={detail} />,
  });
}
