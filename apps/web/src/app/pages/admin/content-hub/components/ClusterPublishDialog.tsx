/**
 * Atomic cluster publishing.
 *
 * Exists because a linked set (the Week 1 shape) is cyclic: each item links to the others, so
 * under "every link target must already be published" no member could ever go first. Publishing
 * them together in one transaction is the designed answer.
 *
 * ALL OR NOTHING. The copy says so, the confirm button stays disabled until every member passes,
 * and the server re-validates inside the transaction regardless of what this dialog reported.
 *
 * `org_admin` may validate — preparing a release is safe. Only `super_admin` may publish.
 */

import { useMemo, useState } from 'react';
import { CheckCircle2, Layers, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { adminBtnPrimary, adminBtnSecondary } from '@/app/admin';
import { cn } from '@/lib/utils';
import {
  useContentHubList,
  usePublishCluster,
  useValidateCluster,
} from '@/lib/queries/contentHubQueries';

const MIN_MEMBERS = 2;
const MAX_MEMBERS = 20;

export interface ClusterPublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The item the dialog was opened from — pre-selected. */
  seedId: string;
  role: string;
}

export function ClusterPublishDialog({ open, onOpenChange, seedId, role }: ClusterPublishDialogProps) {
  const isSuperAdmin = role === 'super_admin';
  const [selected, setSelected] = useState<string[]>([seedId]);

  // Only approved items can be cluster members — a cluster relaxes link ordering, never approval.
  const candidates = useContentHubList({ status: 'approved', page: 1, pageSize: 50, sort: 'title', order: 'asc' });
  const validate = useValidateCluster();
  const publish = usePublishCluster();

  const report = validate.data;
  const withinBounds = selected.length >= MIN_MEMBERS && selected.length <= MAX_MEMBERS;
  const canPublish = isSuperAdmin && withinBounds && report?.passed === true;

  const unresolved = useMemo(
    () => (report?.linkResolution ?? []).filter((link) => link.resolution === 'unresolved'),
    [report],
  );

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
    validate.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers aria-hidden="true" className="h-5 w-5" />
            Publish as a cluster
          </DialogTitle>
          <DialogDescription>
            Items that link to each other must go live together. All {selected.length} publish, or
            none do — if any member fails, nothing is written.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <p className="mb-2 text-sm font-medium text-[var(--admin-text)]">
              Members ({selected.length}) — approved items only
            </p>
            {candidates.isLoading ? (
              <p role="status" className="text-sm text-[var(--admin-text-secondary)]">
                Loading approved content…
              </p>
            ) : (candidates.data?.items.length ?? 0) === 0 ? (
              <p className="text-sm text-[var(--admin-text-secondary)]">
                No approved content available.
              </p>
            ) : (
              <ul className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-white/10 p-2">
                {candidates.data!.items.map((item) => (
                  <li key={item.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-white/[0.04]">
                      <input
                        type="checkbox"
                        checked={selected.includes(item.id)}
                        onChange={() => toggle(item.id)}
                        className="h-4 w-4 rounded border-white/20 bg-transparent"
                      />
                      <span className="text-[var(--admin-text)]">{item.title}</span>
                      <span className="text-xs text-[var(--admin-text-muted)]">
                        {item.publicLabel}
                        {item.editorialRef ? ` · ${item.editorialRef}` : ''}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {!withinBounds ? (
              <p className="mt-1 text-xs text-amber-300">
                Select between {MIN_MEMBERS} and {MAX_MEMBERS} items.
              </p>
            ) : null}
          </div>

          {report ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-[var(--admin-text)]">
                {report.passed ? 'Cluster is ready to publish' : 'Cluster cannot publish yet'}
              </p>

              <ul className="space-y-2">
                {report.members.map((member) => (
                  <li key={member.contentId} className="rounded-md border border-white/10 p-3">
                    <p className="flex items-center gap-2 text-sm">
                      {member.passed ? (
                        <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-300" />
                      ) : (
                        <XCircle aria-hidden="true" className="h-4 w-4 text-red-300" />
                      )}
                      <span className="text-[var(--admin-text)]">{member.title}</span>
                      <span className="sr-only">{member.passed ? 'Passed' : 'Failed'}</span>
                      <span className="text-xs text-[var(--admin-text-muted)]">{member.status}</span>
                    </p>
                    {!member.passed ? (
                      <ul className="mt-1.5 space-y-0.5">
                        {member.items
                          .filter((item) => item.blocking && !item.passed)
                          .map((item) => (
                            <li key={item.code} className="text-xs text-red-300">
                              {item.label}
                              {item.details ? ` — ${item.details}` : ''}
                            </li>
                          ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>

              <div className="rounded-md border border-white/10 p-3">
                <p className="mb-1 text-xs uppercase tracking-wide text-[var(--admin-text-muted)]">
                  Cross-link resolution
                </p>
                {report.linkResolution.length === 0 ? (
                  <p className="text-sm text-[var(--admin-text-secondary)]">No internal links.</p>
                ) : (
                  <p className="text-sm text-[var(--admin-text-secondary)]">
                    {report.linkResolution.filter((l) => l.resolution === 'in_cluster').length} resolved
                    within this cluster ·{' '}
                    {report.linkResolution.filter((l) => l.resolution === 'published').length} already
                    published ·{' '}
                    {report.linkResolution.filter((l) => l.resolution === 'route').length} site routes
                    {unresolved.length > 0 ? (
                      <span className="text-red-300"> · {unresolved.length} unresolved</span>
                    ) : null}
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <button type="button" onClick={() => onOpenChange(false)} className={adminBtnSecondary}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => validate.mutate(selected)}
            disabled={!withinBounds || validate.isPending}
            className={adminBtnSecondary}
          >
            {validate.isPending ? 'Validating…' : 'Validate'}
          </button>
          <button
            type="button"
            onClick={() => publish.mutate(selected, { onSuccess: () => onOpenChange(false) })}
            disabled={!canPublish || publish.isPending}
            title={
              !isSuperAdmin
                ? 'Only a super admin can publish a cluster'
                : report?.passed
                  ? undefined
                  : 'Validate the cluster first'
            }
            className={cn(adminBtnPrimary)}
          >
            {publish.isPending ? 'Publishing…' : `Publish ${selected.length} together`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
