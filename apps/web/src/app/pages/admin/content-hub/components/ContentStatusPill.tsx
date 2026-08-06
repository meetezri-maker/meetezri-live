/**
 * Lifecycle status pill.
 *
 * ONE PILL, NEVER TWO. When an approved item carries a planned date the pill reads
 * "Approved · Planned 9 Aug" (or "· Due" when overdue) rather than adding a second badge — the
 * row must never imply an eighth lifecycle state. There is no `scheduled` status.
 *
 * v1 says "Planned", not "Scheduled": `scheduled_for` is an intent with no automation behind it
 * yet (plan §8.7.3). A badge promising automatic publication that will not happen is worse than
 * no badge at all.
 */

import { cn } from "@/lib/utils";
import type { ContentHubScheduleState, ContentHubStatus } from "@/lib/api";

const STATUS_LABEL: Record<ContentHubStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
  published: "Published",
  unpublished: "Unpublished",
  archived: "Archived",
};

const STATUS_STYLE: Record<ContentHubStatus, string> = {
  draft: "border-white/15 bg-white/[0.06] text-zinc-300",
  in_review: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  changes_requested: "border-orange-400/40 bg-orange-400/10 text-orange-200",
  approved: "border-teal-400/30 bg-teal-400/10 text-teal-200",
  published: "border-emerald-400/40 bg-emerald-400/15 text-emerald-200",
  unpublished: "border-zinc-400/25 bg-zinc-400/10 text-zinc-300",
  archived: "border-zinc-500/25 bg-zinc-500/10 text-zinc-400",
};

function formatPlannedDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export interface ContentStatusPillProps {
  status: ContentHubStatus;
  schedule?: ContentHubScheduleState;
  scheduledFor?: string | null;
  className?: string;
}

export function ContentStatusPill({
  status,
  schedule,
  scheduledFor,
  className,
}: ContentStatusPillProps) {
  const isScheduled = !!schedule?.scheduled && !!scheduledFor;
  const isOverdue = isScheduled && !!schedule?.overdue;

  const suffix = isScheduled
    ? `${isOverdue ? "Due" : "Planned"} ${formatPlannedDate(scheduledFor as string)}`
    : null;

  const text = suffix ? `${STATUS_LABEL[status]} · ${suffix}` : STATUS_LABEL[status];

  return (
    <span
      // The full state is in the text, so the pill is never colour-only.
      aria-label={`Status: ${text}`}
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLE[status],
        isOverdue && "border-amber-400/50 text-amber-200",
        className,
      )}
    >
      {text}
    </span>
  );
}
