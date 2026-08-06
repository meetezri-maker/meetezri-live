/**
 * Content Hub — review queue (`/admin/content-hub/review`).
 *
 * Everything in `in_review`, OLDEST FIRST, so the thing that has been waiting longest is at the
 * top rather than buried under whatever was submitted this morning.
 *
 * NO PUBLISH ACTION HERE. The queue clears approval gates only; publishing belongs to Phase 4's
 * Approval & Publishing tab, where the full checklist and confirmation live.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardCheck, ExternalLink } from "lucide-react";
import { AdminLayoutNew } from "@/app/components/AdminLayoutNew";
import { AdminTableSkeletonRows } from "@/app/components/admin/AdminTableSkeleton";
import {
  adminBtnSecondary,
  adminCardStatic,
  adminPageAtmosphere,
  adminPageGlowTeal,
  adminPageGlowTop,
  adminPageRoot,
  adminPageTitle,
  adminPageVignette,
  adminTableWrap,
} from "@/app/admin";
import {
  useContentHubChecklist,
  useContentHubReviewQueue,
  useSetApproval,
} from "@/lib/queries/contentHubQueries";
import { cn } from "@/lib/utils";
import type { ContentHubListItem } from "@/lib/api";
import { ApprovalDialog } from "./components/ApprovalDialog";
import { ApprovalDots } from "./components/ApprovalDots";
import { ChecklistPanel } from "./components/ChecklistPanel";
import { ContentEmptyState, ContentErrorState } from "./components/ContentStates";
import { ContentTypeBadge } from "./components/ContentTypeBadge";

/** Checklist loads only for the expanded row, so the queue does not fire N requests on mount. */
function ChecklistRow({ contentId }: { contentId: string }) {
  const { data, isLoading, isError } = useContentHubChecklist(contentId);
  return (
    <ChecklistPanel checklist={data} isLoading={isLoading} isError={isError} className="pt-1" />
  );
}

function ReviewRow({
  item,
  isExpanded,
  onToggle,
  onOpenApproval,
}: {
  item: ContentHubListItem;
  isExpanded: boolean;
  onToggle: () => void;
  onOpenApproval: () => void;
}) {
  return (
    <>
      <tr className="border-b border-[color:var(--admin-border)]">
        <td className="px-4 py-3">
          <Link
            to={`/admin/content-hub/${item.id}`}
            className="font-medium text-[var(--admin-text)] hover:underline"
          >
            {item.title}
          </Link>
          <div className="mt-0.5 text-xs text-[var(--admin-text-muted)]">/{item.slug}</div>
        </td>

        <td className="px-4 py-3">
          <ContentTypeBadge contentType={item.contentType} label={item.publicLabel} />
        </td>

        <td className="hidden px-4 py-3 text-[var(--admin-text-secondary)] md:table-cell">
          <time dateTime={item.updatedAt} title={new Date(item.updatedAt).toLocaleString()}>
            {new Date(item.updatedAt).toLocaleDateString()}
          </time>
        </td>

        <td className="px-4 py-3">
          <ApprovalDots approvals={item.approvals} />
        </td>

        <td className="hidden px-4 py-3 text-[var(--admin-text-secondary)] lg:table-cell">
          {item.author?.fullName ?? "Unassigned"}
        </td>

        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={isExpanded}
              aria-controls={`checklist-${item.id}`}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-[var(--admin-text-secondary)] hover:bg-white/[0.06]"
            >
              <ClipboardCheck aria-hidden="true" className="h-3.5 w-3.5" />
              {isExpanded ? "Hide checklist" : "Checklist"}
            </button>

            <button
              type="button"
              onClick={onOpenApproval}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-[var(--admin-text-secondary)] hover:bg-white/[0.06]"
            >
              Set approval
            </button>

            <Link
              to={`/admin/content-hub/${item.id}`}
              aria-label={`Open ${item.title}`}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-[var(--admin-text-secondary)] hover:bg-white/[0.06]"
            >
              <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              Open
            </Link>
          </div>
        </td>
      </tr>

      {isExpanded ? (
        <tr id={`checklist-${item.id}`} className="border-b border-[color:var(--admin-border)]">
          <td colSpan={6} className="bg-white/[0.02] px-4 py-4">
            <div className="grid gap-6 lg:grid-cols-2">
              <ChecklistRow contentId={item.id} />
              <div>
                <p className="mb-2 text-sm font-medium text-[var(--admin-text)]">Approvals</p>
                <ApprovalDots approvals={item.approvals} variant="list" />
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function ApprovalDialogHost({
  item,
  onClose,
}: {
  item: ContentHubListItem | null;
  onClose: () => void;
}) {
  // Hook order stays stable: the host always renders, the dialog only opens when there is an item.
  const mutation = useSetApproval(item?.id ?? "");

  if (!item) return null;

  return (
    <ApprovalDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      contentTitle={item.title}
      approvals={item.approvals}
      isSubmitting={mutation.isPending}
      onSubmit={(input) => {
        mutation.mutate(input, { onSuccess: onClose });
      }}
    />
  );
}

export function ContentHubReview() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [approvalItem, setApprovalItem] = useState<ContentHubListItem | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useContentHubReviewQueue();
  const items = data?.items ?? [];

  return (
    <AdminLayoutNew>
      <div className={adminPageRoot}>
        <div className={adminPageAtmosphere} aria-hidden="true">
          <div className={adminPageGlowTop} />
          <div className={adminPageGlowTeal} />
          <div className={adminPageVignette} />
        </div>

        <div className="relative z-10 space-y-6 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className={adminPageTitle}>Review queue</h1>
              <p className="mt-1 text-sm text-[var(--admin-text-secondary)]">
                Content awaiting approval, oldest first.
              </p>
            </div>
            <Link to="/admin/content-hub" className={adminBtnSecondary}>
              All content
            </Link>
          </div>

          {isLoading ? (
            <div className={adminTableWrap}>
              <table className="w-full">
                <tbody>
                  <AdminTableSkeletonRows columns={6} rows={5} />
                </tbody>
              </table>
            </div>
          ) : isError ? (
            <div className={adminCardStatic}>
              <ContentErrorState onRetry={() => void refetch()} />
            </div>
          ) : items.length === 0 ? (
            <div className={adminCardStatic}>
              <ContentEmptyState variant="filtered" />
              <p className="pb-8 text-center text-sm text-[var(--admin-text-secondary)]">
                Nothing is waiting for review right now.
              </p>
            </div>
          ) : (
            <div className={cn(adminCardStatic, "overflow-hidden")}>
              <div className={cn(adminTableWrap, "overflow-x-auto")}>
                <table className="w-full min-w-[44rem] border-collapse text-sm">
                  <caption className="sr-only">Content awaiting review</caption>
                  <thead>
                    <tr className="border-b border-[color:var(--admin-border)] text-left">
                      <th scope="col" className="px-4 py-3 font-medium text-[var(--admin-text-secondary)]">Title</th>
                      <th scope="col" className="px-4 py-3 font-medium text-[var(--admin-text-secondary)]">Type</th>
                      <th scope="col" className="hidden px-4 py-3 font-medium text-[var(--admin-text-secondary)] md:table-cell">Submitted</th>
                      <th scope="col" className="px-4 py-3 font-medium text-[var(--admin-text-secondary)]">Approvals</th>
                      <th scope="col" className="hidden px-4 py-3 font-medium text-[var(--admin-text-secondary)] lg:table-cell">Author</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium text-[var(--admin-text-secondary)]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <ReviewRow
                        key={item.id}
                        item={item}
                        isExpanded={expandedId === item.id}
                        onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        onOpenApproval={() => setApprovalItem(item)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <span className="sr-only" role="status" aria-live="polite">
            {isFetching ? "Updating review queue" : ""}
          </span>
        </div>
      </div>

      <ApprovalDialogHost item={approvalItem} onClose={() => setApprovalItem(null)} />
    </AdminLayoutNew>
  );
}
