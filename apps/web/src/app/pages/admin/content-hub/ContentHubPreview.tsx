/**
 * Preview (`/admin/content-hub/:id/preview`).
 *
 * Renders the payload from `GET /api/admin/content/:id/preview`, which the API builds with the
 * REAL public serializer. It never reads the admin record — so previewing also proves that
 * nothing internal leaks, and the same blocks appear here as will appear publicly.
 *
 * Authenticated (the route is role-guarded) and always `noindex,nofollow`.
 */

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Monitor, Smartphone, Tablet } from 'lucide-react';
import { AdminLayoutNew } from '@/app/components/AdminLayoutNew';
import {
  adminBtnSecondary,
  adminCardStatic,
  adminPageRoot,
} from '@/app/admin';
import { useContentHubPreview } from '@/lib/queries/contentHubQueries';
import { cn } from '@/lib/utils';
import { ResourceArticle } from '@meetezri/public-content';
import { ContentErrorState } from './components/ContentStates';
import { PublicStyles } from '@/app/pages/public/resources/PublicStyles';

const WIDTHS = [
  { id: 'mobile', label: 'Mobile', width: 390, icon: Smartphone },
  { id: 'tablet', label: 'Tablet', width: 768, icon: Tablet },
  { id: 'desktop', label: 'Desktop', width: 1024, icon: Monitor },
] as const;

export function ContentHubPreview() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error, refetch } = useContentHubPreview(id);
  const [widthId, setWidthId] = useState<(typeof WIDTHS)[number]['id']>('desktop');
  const width = WIDTHS.find((w) => w.id === widthId)!;

  return (
    <AdminLayoutNew>
      <div className={cn(adminPageRoot, 'p-4 sm:p-6')}>
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              to={`/admin/content-hub/${id}`}
              className={cn(adminBtnSecondary, 'inline-flex items-center gap-2')}
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Back to editor
            </Link>

            <div role="group" aria-label="Preview width" className="flex gap-1">
              {WIDTHS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setWidthId(option.id)}
                    aria-pressed={widthId === option.id}
                    aria-label={`${option.label} width`}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs',
                      widthId === option.id
                        ? 'bg-white/15 text-[var(--admin-text)]'
                        : 'text-[var(--admin-text-secondary)] hover:bg-white/[0.06]',
                    )}
                  >
                    <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            role="note"
            className="rounded-md border border-amber-400/30 bg-amber-400/[0.08] px-4 py-3 text-sm text-amber-100"
          >
            <strong>Preview</strong> — this page is not published and is marked{' '}
            <code>noindex, nofollow</code>. It shows exactly what the public API would return.
          </div>

          {isLoading ? (
            <p role="status" className="text-sm text-[var(--admin-text-secondary)]">
              Loading preview…
            </p>
          ) : isError || !data ? (
            <div className={adminCardStatic}>
              <ContentErrorState onRetry={() => void refetch()} message="Could not load the preview." error={error} />
            </div>
          ) : (
            <div className="flex justify-center overflow-x-auto">
              <div
                style={{ width: width.width, maxWidth: '100%' }}
                className="rounded-lg border border-white/10 bg-[#07090f]"
              >
                {/*
                  PHASE 5A: the preview now renders the SAME `ResourceArticle` and the SAME
                  stylesheet the public page and the server renderer use. Previously it rendered
                  admin-styled markup that merely resembled the public page, which made "it looked
                  fine in preview" a weaker claim than it sounded.
                */}
                <PublicStyles />
                <ResourceArticle resource={data} />
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayoutNew>
  );
}
