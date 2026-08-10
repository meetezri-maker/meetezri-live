/**
 * `/resources` — the public Solace Resources library (SPA route).
 *
 * The server renderer already produced a complete version of this page; this component takes over
 * for client-side navigation and renders the SAME `ResourcesLibrary` from
 * `@meetezri/public-content`, so the markup matches and hydration is quiet.
 *
 * Anonymous route. No `ProtectedRoute`, no auth calls, no member chrome.
 */

import { useSearchParams } from 'react-router-dom';
import { ResourcesLibrary, type PublicLabel } from '@meetezri/public-content';
import { usePublicResources } from '@/lib/queries/publicContentQueries';
import { PublicStyles } from './PublicStyles';
import { ResourcesShell } from './ResourcesShell';
import { clientCanonical, usePublicMeta } from './publicMeta';

const LABELS: PublicLabel[] = ['Answer', 'Insight', 'Article'];

function parseLabel(value: string | null): PublicLabel | null {
  return value && (LABELS as string[]).includes(value) ? (value as PublicLabel) : null;
}

/** Must produce the same strings as `libraryHref` in the server renderer. */
export function libraryHref(params: { label?: PublicLabel | null; page?: number }): string {
  const search = new URLSearchParams();
  if (params.label) search.set('type', params.label);
  if (params.page && params.page > 1) search.set('page', String(params.page));
  const query = search.toString();
  return query ? `/resources?${query}` : '/resources';
}

export function ResourcesIndex() {
  const [searchParams] = useSearchParams();

  const label = parseLabel(searchParams.get('type'));
  const pageParam = Number(searchParams.get('page'));
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1;

  const { data, isLoading, isError, refetch } = usePublicResources({ page, type: label });

  const title = label ? `${label}s — Resources | Solace` : 'Resources | Solace';
  usePublicMeta({
    title,
    description:
      'Clear, careful answers about talking things through, looking after your mental wellbeing, and getting support when you need it.',
    canonical: clientCanonical(libraryHref({ label, page })),
    robots: page === 1 && !label ? 'index,follow' : 'noindex,follow',
  });

  if (isLoading) {
    return (
      <>
        <PublicStyles />
        <ResourcesShell pathname="/resources">
          <div className="sol-page">
            <p role="status">Loading resources…</p>
          </div>
        </ResourcesShell>
      </>
    );
  }

  if (isError || !data) {
    return (
      <>
        <PublicStyles />
        <ResourcesShell pathname="/resources">
          <div className="sol-page">
            <h1>Resources</h1>
            <p role="alert">We could not load the resource library just now.</p>
            <button type="button" className="sol-btn sol-btn-primary" onClick={() => void refetch()}>
              Try again
            </button>
          </div>
        </ResourcesShell>
      </>
    );
  }

  return (
    <>
      <PublicStyles />
      <ResourcesShell pathname="/resources">
        <ResourcesLibrary
        items={data.items}
        total={data.total}
        page={data.page}
        pageSize={data.pageSize}
        activeLabel={label}
        // Plain crawlable anchors, deliberately not router links: a filter or page change is a
        // full navigation, which the Vercel rewrite serves from the renderer. The reader gets
        // complete HTML with correct metadata instead of a client-patched head, and a bot can
        // follow the same link.
          buildHref={libraryHref}
        />
      </ResourcesShell>
    </>
  );
}
