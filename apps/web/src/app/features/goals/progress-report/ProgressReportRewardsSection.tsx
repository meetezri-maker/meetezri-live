import { ProgressReportEmptyLine, ProgressReportSection, ProgressReportStat } from "./ProgressReportSection";
import { formatReportDate, pluralize, rewardSourceLabel } from "./progress-report.utils";
import type { ProgressReport } from "./progress-report.types";

/**
 * Points earned in the period plus the ledger rows behind them. Points are
 * never recalculated from completion counts — they are the backend's values.
 */
export function ProgressReportRewardsSection({
  rewards,
  snapshot,
  completions,
}: {
  rewards: ProgressReport["rewards"];
  snapshot: ProgressReport["currentSnapshot"];
  completions: ProgressReport["completedDuringPeriod"];
}) {
  // Related item title, when the backend already returned it in this report.
  const titleByItemId = new Map<string, string>();
  for (const c of completions) titleByItemId.set(c.itemId, c.title);

  return (
    <ProgressReportSection title="Rewards and Level Progress" headingId="report-rewards">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ProgressReportStat
          label={pluralize(rewards.pointsEarned, "Point earned", "Points earned")}
          value={rewards.pointsEarned}
        />
        <ProgressReportStat label="Current level" value={snapshot.currentLevel} />
        <ProgressReportStat
          label="Points into level"
          value={`${snapshot.pointsIntoLevel} / ${snapshot.pointsRequiredForNextLevel}`}
          hint={`${snapshot.pointsRemainingToNextLevel} ${pluralize(
            snapshot.pointsRemainingToNextLevel,
            "point"
          )} to next level`}
        />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Reward transactions</h3>
        {rewards.transactions.length === 0 ? (
          <ProgressReportEmptyLine>
            No rewards were earned during this period.
          </ProgressReportEmptyLine>
        ) : (
          <ul data-testid="report-reward-transactions" className="space-y-2">
            {rewards.transactions.map((t) => {
              const date = formatReportDate(t.date);
              const relatedTitle = titleByItemId.get(t.sourceItemId);
              return (
                <li
                  key={t.id}
                  className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3"
                >
                  <div className="min-w-0">
                    <p className="break-words text-sm text-zinc-200">
                      {rewardSourceLabel(t.sourceType)}
                    </p>
                    {relatedTitle ? (
                      <p className="break-words text-xs text-zinc-500">{relatedTitle}</p>
                    ) : null}
                    {date ? <p className="text-xs text-zinc-500">{date}</p> : null}
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-emerald-300/90">
                    +{t.points} {pluralize(t.points, "point")}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ProgressReportSection>
  );
}
