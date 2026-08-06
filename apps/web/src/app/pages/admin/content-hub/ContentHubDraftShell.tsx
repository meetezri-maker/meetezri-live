/**
 * Content Hub — TEMPORARY draft shell (`/admin/content-hub/:id`).
 *
 * ============================================================================
 * THIS IS A PHASE 3 PLACEHOLDER AND IS REPLACED WHOLESALE IN PHASE 4.
 * ============================================================================
 *
 * It exists only because creating a draft and the review queue both need somewhere to land, and
 * the real six-tab editor is Phase 4. It is READ-ONLY on purpose and says so on screen — a
 * placeholder dressed up as a finished editor is worse than an obviously unfinished one, because
 * someone will try to write into it and lose work.
 *
 * MUST NOT GAIN: an editable body, overview/editorial/SEO forms, links editor, scheduling,
 * publishing controls or revision history. If any of those is wanted, that is Phase 4.
 */

import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Construction } from "lucide-react";
import { AdminLayoutNew } from "@/app/components/AdminLayoutNew";
import {
  adminBtnSecondary,
  adminCardStatic,
  adminPageAtmosphere,
  adminPageGlowTeal,
  adminPageGlowTop,
  adminPageRoot,
  adminPageTitle,
  adminPageVignette,
} from "@/app/admin";
import { useContentHubChecklist, useContentHubDetail } from "@/lib/queries/contentHubQueries";
import { cn } from "@/lib/utils";
import { ApprovalDots } from "./components/ApprovalDots";
import { ChecklistPanel } from "./components/ChecklistPanel";
import { ContentErrorState } from "./components/ContentStates";
import { ContentStatusPill } from "./components/ContentStatusPill";
import { ContentTypeBadge } from "./components/ContentTypeBadge";

export function ContentHubDraftShell() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useContentHubDetail(id);
  const checklist = useContentHubChecklist(id);

  return (
    <AdminLayoutNew>
      <div className={adminPageRoot}>
        <div className={adminPageAtmosphere} aria-hidden="true">
          <div className={adminPageGlowTop} />
          <div className={adminPageGlowTeal} />
          <div className={adminPageVignette} />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl space-y-6 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/admin/content-hub" className={cn(adminBtnSecondary, "inline-flex items-center gap-2")}>
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              All content
            </Link>
            <Link to="/admin/content-hub/review" className={adminBtnSecondary}>
              Review queue
            </Link>
          </div>

          {isLoading ? (
            <div className={cn(adminCardStatic, "p-6")}>
              <p role="status" className="text-sm text-[var(--admin-text-secondary)]">
                Loading content…
              </p>
            </div>
          ) : isError || !data ? (
            <div className={adminCardStatic}>
              <ContentErrorState onRetry={() => void refetch()} message="Could not load this content." />
            </div>
          ) : (
            <>
              <div>
                <h1 className={adminPageTitle}>{data.title}</h1>
                <p className="mt-1 text-sm text-[var(--admin-text-muted)]">/resources/{data.slug}</p>
              </div>

              <div
                role="note"
                className={cn(
                  adminCardStatic,
                  "flex items-start gap-3 border-amber-400/25 bg-amber-400/[0.06] p-4",
                )}
              >
                <Construction aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                <div>
                  <p className="text-sm font-medium text-[var(--admin-text)]">
                    Full content editing is added in Phase 4
                  </p>
                  <p className="mt-1 text-sm text-[var(--admin-text-secondary)]">
                    The draft was created and is safe. This is a temporary read-only summary — the
                    editor, links, scheduling and publishing controls arrive with the next phase.
                  </p>
                </div>
              </div>

              <div className={cn(adminCardStatic, "space-y-4 p-6")}>
                <div className="flex flex-wrap items-center gap-3">
                  <ContentTypeBadge contentType={data.contentType} label={data.publicLabel} />
                  <ContentStatusPill
                    status={data.status}
                    schedule={data.schedule}
                    scheduledFor={data.scheduledFor}
                  />
                </div>

                <dl className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-[var(--admin-text-secondary)]">Reference</dt>
                    <dd className="text-sm text-[var(--admin-text)]">{data.editorialRef ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--admin-text-secondary)]">Pillar</dt>
                    <dd className="text-sm text-[var(--admin-text)]">{data.pillar ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--admin-text-secondary)]">Author</dt>
                    <dd className="text-sm text-[var(--admin-text)]">
                      {data.author?.fullName ?? "Unassigned"}
                    </dd>
                  </div>
                </dl>

                <div>
                  <p className="mb-2 text-sm font-medium text-[var(--admin-text)]">Approvals</p>
                  <ApprovalDots approvals={data.approvals} variant="list" />
                </div>
              </div>

              <div className={cn(adminCardStatic, "p-6")}>
                <h2 className="mb-3 text-sm font-semibold text-[var(--admin-text)]">Publish checklist</h2>
                <ChecklistPanel
                  checklist={checklist.data}
                  isLoading={checklist.isLoading}
                  isError={checklist.isError}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayoutNew>
  );
}
