/**
 * Content Hub list table.
 *
 * Presentational only — it receives rows and renders them. Fetching, filtering and pagination
 * belong to the page.
 *
 * RESPONSIVE: lower-priority columns (reference, slug, tags, author) hide progressively, but
 * title, type, status and actions never do — status must stay understandable at every width.
 */

import { Link } from "react-router-dom";
import { ClipboardCheck, ExternalLink } from "lucide-react";
import { adminTableWrap } from "@/app/admin";
import { cn } from "@/lib/utils";
import type { ContentHubListItem } from "@/lib/api";
import { ApprovalDots } from "./ApprovalDots";
import { ContentStatusPill } from "./ContentStatusPill";
import { ContentTypeBadge } from "./ContentTypeBadge";

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMinutes = Math.round((Date.now() - then) / 60_000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffMinutes < 60 * 24) return `${Math.round(diffMinutes / 60)}h ago`;
  return `${Math.round(diffMinutes / (60 * 24))}d ago`;
}

export interface ContentTableProps {
  items: ContentHubListItem[];
  className?: string;
}

export function ContentTable({ items, className }: ContentTableProps) {
  return (
    <div className={cn(adminTableWrap, "overflow-x-auto", className)}>
      <table className="w-full min-w-[52rem] border-collapse text-sm">
        <caption className="sr-only">Content Hub items</caption>
        <thead>
          <tr className="border-b border-[color:var(--admin-border)] text-left">
            <th scope="col" className="px-4 py-3 font-medium text-[var(--admin-text-secondary)]">
              Title
            </th>
            <th scope="col" className="hidden px-4 py-3 font-medium text-[var(--admin-text-secondary)] xl:table-cell">
              Reference
            </th>
            <th scope="col" className="px-4 py-3 font-medium text-[var(--admin-text-secondary)]">
              Type
            </th>
            <th scope="col" className="px-4 py-3 font-medium text-[var(--admin-text-secondary)]">
              Status
            </th>
            <th scope="col" className="px-4 py-3 font-medium text-[var(--admin-text-secondary)]">
              Approvals
            </th>
            <th scope="col" className="hidden px-4 py-3 font-medium text-[var(--admin-text-secondary)] 2xl:table-cell">
              Tags
            </th>
            <th scope="col" className="hidden px-4 py-3 font-medium text-[var(--admin-text-secondary)] lg:table-cell">
              Author
            </th>
            <th scope="col" className="hidden px-4 py-3 font-medium text-[var(--admin-text-secondary)] md:table-cell">
              Updated
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium text-[var(--admin-text-secondary)]">
              Actions
            </th>
          </tr>
        </thead>

        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className="border-b border-[color:var(--admin-border)] last:border-0 hover:bg-white/[0.02]"
            >
              <td className="px-4 py-3">
                <Link
                  to={`/admin/content-hub/${item.id}`}
                  className="font-medium text-[var(--admin-text)] hover:underline"
                >
                  {item.title}
                </Link>
                <div className="mt-0.5 truncate text-xs text-[var(--admin-text-muted)]">/{item.slug}</div>
              </td>

              <td className="hidden px-4 py-3 text-[var(--admin-text-secondary)] xl:table-cell">
                {item.editorialRef ?? <span className="text-[var(--admin-text-muted)]">—</span>}
              </td>

              <td className="px-4 py-3">
                <ContentTypeBadge contentType={item.contentType} label={item.publicLabel} />
              </td>

              <td className="px-4 py-3">
                <ContentStatusPill
                  status={item.status}
                  schedule={item.schedule}
                  scheduledFor={item.scheduledFor}
                />
              </td>

              <td className="px-4 py-3">
                <ApprovalDots approvals={item.approvals} />
              </td>

              <td className="hidden px-4 py-3 2xl:table-cell">
                {item.tags.length === 0 ? (
                  <span className="text-[var(--admin-text-muted)]">—</span>
                ) : (
                  <span className="flex flex-wrap gap-1">
                    {item.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-[var(--admin-text-secondary)]"
                      >
                        {tag}
                      </span>
                    ))}
                    {item.tags.length > 3 ? (
                      <span className="px-1 text-xs text-[var(--admin-text-muted)]">
                        +{item.tags.length - 3}
                      </span>
                    ) : null}
                  </span>
                )}
              </td>

              <td className="hidden px-4 py-3 text-[var(--admin-text-secondary)] lg:table-cell">
                {item.author?.fullName ?? <span className="text-[var(--admin-text-muted)]">Unassigned</span>}
              </td>

              <td className="hidden px-4 py-3 text-[var(--admin-text-secondary)] md:table-cell">
                <time dateTime={item.updatedAt} title={new Date(item.updatedAt).toLocaleString()}>
                  {formatRelative(item.updatedAt)}
                </time>
              </td>

              <td className="px-4 py-3">
                {/* Only actions that are fully wired in Phase 3 — no dead controls. */}
                <div className="flex items-center justify-end gap-2">
                  <Link
                    to={`/admin/content-hub/${item.id}`}
                    aria-label={`Open ${item.title}`}
                    className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-[var(--admin-text-secondary)] hover:bg-white/[0.06]"
                  >
                    <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                    Open
                  </Link>
                  {item.status === "in_review" ? (
                    <Link
                      to="/admin/content-hub/review"
                      aria-label={`Review ${item.title}`}
                      className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-[var(--admin-text-secondary)] hover:bg-white/[0.06]"
                    >
                      <ClipboardCheck aria-hidden="true" className="h-3.5 w-3.5" />
                      Review
                    </Link>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
