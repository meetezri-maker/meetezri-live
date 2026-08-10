/**
 * `/resources/:slug` — the public resource page (SPA route).
 *
 * One shell for all three public labels; the type-specific emphasis lives inside the shared
 * `ResourceArticle`, not in a separate route. Renders the same component as the server renderer
 * and the admin preview.
 *
 * Anonymous route. A slug that is not published resolves to a 404 body here — the SPA cannot set
 * an HTTP status, which is exactly why the server renderer owns the real 404 and why
 * `vercel.json` routes `/resources/*` there before the SPA ever sees it.
 */

import { useParams } from 'react-router-dom';
import { ResourceArticle } from '@meetezri/public-content';
import { usePublicResource } from '@/lib/queries/publicContentQueries';
import { PublicStyles } from './PublicStyles';
import { ResourcesShell } from './ResourcesShell';
import { clientCanonical, usePublicMeta } from './publicMeta';

export function ResourceDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, isError } = usePublicResource(slug);
  const path = `/resources/${slug ?? ''}`;

  usePublicMeta({
    title: data ? `${data.title} | Solace` : 'Resources | Solace',
    description: data?.description ?? null,
    canonical: data?.canonicalUrlOverride ?? clientCanonical(`/resources/${slug ?? ''}`),
    robots: data?.robots ?? null,
  });

  if (isLoading) {
    return (
      <>
        <PublicStyles />
        <ResourcesShell pathname={path}>
          <div className="sol-page">
            <p role="status">Loading…</p>
          </div>
        </ResourcesShell>
      </>
    );
  }

  // A missing resource and an unpublished one are indistinguishable here on purpose — the API
  // returns 404 for both, so there is nothing to tell apart.
  if (isError || !data) {
    return (
      <>
        <PublicStyles />
        <ResourcesShell pathname={path}>
          <div className="sol-page">
            <div className="sol-article">
              <h1>We could not find that page</h1>
            <p className="sol-lede">
              The page you were looking for is not available. It may have moved, or the address may
              be slightly different.
            </p>
              <p>
                <a className="sol-btn sol-btn-primary" href="/resources">
                  Browse Solace Resources
                </a>
              </p>
            </div>
          </div>
        </ResourcesShell>
      </>
    );
  }

  return (
    <>
      <PublicStyles />
      <ResourcesShell pathname={path}>
        <ResourceArticle resource={data} />
      </ResourcesShell>
    </>
  );
}
