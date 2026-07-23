import { Progress } from "@/app/components/ui/progress";
import { ProgressReportSection, ProgressReportStat } from "./ProgressReportSection";
import { pluralize, visualPercent } from "./progress-report.utils";
import type { ProgressReport } from "./progress-report.types";

/**
 * Current all-time state, kept visually separate from period activity.
 * Every value is backend-provided; the only client math is the progress bar's
 * visual width (a direct display ratio of pointsIntoLevel / required).
 */
export function ProgressReportCurrentSnapshot({
  snapshot,
}: {
  snapshot: ProgressReport["currentSnapshot"];
}) {
  const barPercent = visualPercent(snapshot.pointsIntoLevel, snapshot.pointsRequiredForNextLevel);

  return (
    <ProgressReportSection
      title="Current Snapshot"
      caption="Your all-time totals, as they stand today."
      headingId="report-current-snapshot"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ProgressReportStat label="Total points" value={snapshot.totalPoints} />
        <ProgressReportStat label="Current level" value={snapshot.currentLevel} />
        <ProgressReportStat label="Active goals" value={snapshot.activeGoals} />
        <ProgressReportStat label="Active personal achievements" value={snapshot.activeAchievements} />
        <ProgressReportStat label="Completed goals (all time)" value={snapshot.completedGoalsAllTime} />
        <ProgressReportStat
          label="Completed achievements (all time)"
          value={snapshot.completedAchievementsAllTime}
        />
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">Progress toward next level</h3>
          <p className="text-sm tabular-nums text-zinc-300">
            {snapshot.pointsIntoLevel} / {snapshot.pointsRequiredForNextLevel} points
          </p>
        </div>
        <Progress
          value={barPercent}
          aria-label={`Progress toward level ${snapshot.currentLevel + 1}`}
          className="mt-3 bg-white/[0.08]"
        />
        <p className="mt-2 text-xs text-zinc-400">
          {snapshot.pointsRemainingToNextLevel}{" "}
          {pluralize(snapshot.pointsRemainingToNextLevel, "point")} remaining to level{" "}
          {snapshot.currentLevel + 1}.
        </p>
      </div>
    </ProgressReportSection>
  );
}
