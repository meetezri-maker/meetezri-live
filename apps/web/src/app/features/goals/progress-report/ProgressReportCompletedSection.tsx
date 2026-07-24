import { CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { achievementsCard } from "@/app/pages/app/achievements/achievementsUi";
import { ProgressReportEmptyLine, ProgressReportSection } from "./ProgressReportSection";
import {
  TRACKING_METHOD_LABELS,
  formatNumericProgress,
  formatReportDate,
  originLabel,
  pluralize,
} from "./progress-report.utils";
import type { ProgressReportCompletion } from "./progress-report.types";

const TYPE_LABEL: Record<ProgressReportCompletion["itemType"], string> = {
  goal: "Goal Completed",
  achievement: "Personal Achievement Completed",
};

/**
 * Items completed inside the period. Restrained, positive treatment — no
 * confetti or celebration animation. Reward points come from the ledger.
 */
export function ProgressReportCompletedSection({
  completions,
}: {
  completions: ProgressReportCompletion[];
}) {
  return (
    <ProgressReportSection title="Completed During This Period" headingId="report-completed">
      {completions.length === 0 ? (
        <ProgressReportEmptyLine>
          No Goals or Personal Achievements were completed during this period.
        </ProgressReportEmptyLine>
      ) : (
        <ul data-testid="report-completed-list" className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {completions.map((c) => {
            const finalValue = formatNumericProgress(
              c.trackingType,
              c.finalCurrentValue,
              c.finalTargetValue,
              null
            );
            const date = formatReportDate(c.completedAt);
            return (
              <li
                key={`${c.itemType}:${c.itemId}`}
                className={cn(achievementsCard, "min-w-0 space-y-2 rounded-2xl p-4")}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-emerald-300/90">
                    <CheckCircle className="h-3.5 w-3.5" aria-hidden />
                    {TYPE_LABEL[c.itemType]}
                  </p>
                  <span
                    data-testid="report-completed-origin"
                    className="rounded-full border border-white/[0.1] bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400"
                  >
                    {originLabel(c.origin)}
                  </span>
                </div>
                <h3 className="break-words text-sm font-semibold text-white">{c.title}</h3>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                  {date ? (
                    <p>
                      <span className="text-zinc-500">Completed: </span>
                      {date}
                    </p>
                  ) : null}
                  <p>
                    <span className="text-zinc-500">Reward: </span>
                    <span className="tabular-nums">
                      {c.rewardPointsAwarded} {pluralize(c.rewardPointsAwarded, "point")}
                    </span>
                  </p>
                  <p>
                    <span className="text-zinc-500">Tracking: </span>
                    {TRACKING_METHOD_LABELS[c.trackingType]}
                  </p>
                  {finalValue ? (
                    <p>
                      <span className="text-zinc-500">Final: </span>
                      {finalValue}
                    </p>
                  ) : (
                    <p>
                      <span className="text-zinc-500">Final: </span>
                      100%
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </ProgressReportSection>
  );
}
