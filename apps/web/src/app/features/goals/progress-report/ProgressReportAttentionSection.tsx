import { cn } from "@/lib/utils";
import { achievementsCard } from "@/app/pages/app/achievements/achievementsUi";
import { ProgressReportEmptyLine, ProgressReportSection } from "./ProgressReportSection";
import { ITEM_TYPE_LABELS, attentionReasonLabel, formatReportDate } from "./progress-report.utils";
import type { ProgressReport, ProgressReportAttentionItem } from "./progress-report.types";

/**
 * Items the backend flagged. Each item appears ONCE and carries every reason
 * code the backend returned — the client never decides whether a reason applies,
 * it only maps codes to readable labels (unknown codes degrade gracefully).
 */
export function ProgressReportAttentionSection({
  items,
  activeGoals,
  activeAchievements,
}: {
  items: ProgressReportAttentionItem[];
  activeGoals: ProgressReport["activeGoals"];
  activeAchievements: ProgressReport["activeAchievements"];
}) {
  // Look up the item's current progress / target date for context (display only).
  const context = new Map<string, { currentProgress: number; targetDate: string | null }>();
  for (const g of activeGoals) context.set(`goal:${g.id}`, { currentProgress: g.currentProgress, targetDate: g.targetDate });
  for (const a of activeAchievements)
    context.set(`achievement:${a.id}`, { currentProgress: a.currentProgress, targetDate: a.targetDate });

  return (
    <ProgressReportSection title="May Need Attention" headingId="report-attention">
      {items.length === 0 ? (
        <ProgressReportEmptyLine>
          No active items currently need attention based on this report period.
        </ProgressReportEmptyLine>
      ) : (
        <ul data-testid="report-attention-list" className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {items.map((item) => {
            const key = `${item.itemType}:${item.itemId}`;
            const extra = context.get(key);
            const targetDate = formatReportDate(extra?.targetDate ?? null);
            return (
              <li key={key} className={cn(achievementsCard, "min-w-0 space-y-2 rounded-2xl p-4")}>
                <div className="min-w-0 space-y-1">
                  <h3 className="break-words text-sm font-semibold text-white">{item.title}</h3>
                  <p className="text-xs text-zinc-400">
                    {ITEM_TYPE_LABELS[item.itemType]}
                    {extra ? (
                      <>
                        <span aria-hidden> · </span>
                        <span className="tabular-nums">{extra.currentProgress}%</span> current progress
                      </>
                    ) : null}
                    {targetDate ? (
                      <>
                        <span aria-hidden> · </span>
                        Target {targetDate}
                      </>
                    ) : null}
                  </p>
                </div>
                <ul className="flex flex-wrap gap-1.5">
                  {item.reasons.map((reason) => (
                    <li
                      key={reason}
                      className="rounded-full border border-amber-300/25 bg-amber-400/[0.08] px-2.5 py-1 text-[11px] text-amber-200"
                    >
                      {attentionReasonLabel(reason)}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </ProgressReportSection>
  );
}
