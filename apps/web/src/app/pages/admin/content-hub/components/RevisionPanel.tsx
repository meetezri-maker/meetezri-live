/**
 * Revision history.
 *
 * Revisions are append-only: restoring APPLIES a snapshot and writes a NEW revision, so history
 * is never rewritten. The confirmation says so, because "restore" reads like "undo" and people
 * reasonably expect undo to remove things.
 *
 * A full visual diff is Version Two and is deliberately absent.
 */

import { useState } from 'react';
import { History, RotateCcw } from 'lucide-react';
import { adminBtnSecondary, adminCardStatic } from '@/app/admin';
import { cn } from '@/lib/utils';
import { useContentHubRevisions, useRestoreRevision } from '@/lib/queries/contentHubQueries';
import { ConfirmActionDialog } from './ConfirmActionDialog';

const TRIGGER_LABEL: Record<string, string> = {
  manual_save: 'Saved',
  transition: 'Status change',
  restore: 'Restored',
};

export interface RevisionPanelProps {
  contentId: string;
  /** The concurrency token a restore must carry. */
  currentUpdatedAt: string;
}

export function RevisionPanel({ contentId, currentUpdatedAt }: RevisionPanelProps) {
  const { data, isLoading, isError } = useContentHubRevisions(contentId);
  const restore = useRestoreRevision(contentId);
  const [pending, setPending] = useState<number | null>(null);

  return (
    <div className={cn(adminCardStatic, 'p-6')}>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--admin-text)]">
        <History aria-hidden="true" className="h-4 w-4" />
        Revision history
      </h2>

      {isLoading ? (
        <p role="status" className="text-sm text-[var(--admin-text-secondary)]">
          Loading revisions…
        </p>
      ) : isError ? (
        <p role="alert" className="text-sm text-[var(--admin-text-secondary)]">
          Could not load revisions.
        </p>
      ) : (data?.items.length ?? 0) === 0 ? (
        <p className="text-sm text-[var(--admin-text-secondary)]">
          No revisions yet. An explicit save or a status change creates one — autosave does not.
        </p>
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {data!.items.map((revision) => (
            <li key={revision.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <p className="text-sm text-[var(--admin-text)]">
                  <span className="font-medium">#{revision.revisionNumber}</span>{' '}
                  {TRIGGER_LABEL[revision.trigger] ?? revision.trigger}
                  <span className="text-[var(--admin-text-muted)]"> · {revision.statusAtCapture}</span>
                </p>
                <p className="text-xs text-[var(--admin-text-muted)]">
                  {revision.createdByName ?? 'Unknown'} ·{' '}
                  {new Date(revision.createdAt).toLocaleString()}
                  {revision.changeSummary ? ` · ${revision.changeSummary}` : ''}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPending(revision.revisionNumber)}
                aria-label={`Restore revision ${revision.revisionNumber}`}
                className={cn(adminBtnSecondary, 'inline-flex items-center gap-1.5')}
              >
                <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
                Restore
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmActionDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={`Restore revision ${pending ?? ''}?`}
        body="The saved content from that revision replaces what is in the editor now. History is not rewritten — this creates a NEW revision recording the restore, and the original stays untouched."
        confirmLabel="Restore"
        isSubmitting={restore.isPending}
        onConfirm={() => {
          if (pending !== null) {
            restore.mutate(
              { revisionNumber: pending, expectedUpdatedAt: currentUpdatedAt },
              { onSettled: () => setPending(null) },
            );
          }
        }}
      />
    </div>
  );
}
