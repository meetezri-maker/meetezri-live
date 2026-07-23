import { ProgressReportSection, ProgressReportStat } from "./ProgressReportSection";
import { formatSignedPoints, pluralize } from "./progress-report.utils";
import type { ProgressReport } from "./progress-report.types";

/**
 * Activity that happened INSIDE the selected period (distinct from the all-time
 * snapshot above). All values come from the backend as-is.
 */
export function ProgressReportSummary({
  summary,
  periodLabel,
}: {
  summary: ProgressReport["periodSummary"];
  periodLabel: string;
}) {
  const consistency =
    summary.overallConsistencyRate === null ? "Not available" : `${summary.overallConsistencyRate}%`;

  return (
    <ProgressReportSection
      title="Period Summary"
      caption={`What changed during: ${periodLabel}.`}
      headingId="report-period-summary"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ProgressReportStat
          label={pluralize(summary.completedGoals, "Goal completed", "Goals completed")}
          value={summary.completedGoals}
        />
        <ProgressReportStat
          label={pluralize(
            summary.completedAchievements,
            "Personal Achievement completed",
            "Personal Achievements completed"
          )}
          value={summary.completedAchievements}
        />
        <ProgressReportStat
          label={pluralize(summary.totalCheckIns, "Check-in", "Check-ins")}
          value={summary.totalCheckIns}
        />
        <ProgressReportStat
          label={pluralize(summary.activeCheckInDays, "Active check-in day", "Active check-in days")}
          value={summary.activeCheckInDays}
        />
        <ProgressReportStat
          label="Overall consistency"
          value={consistency}
          hint="Based on completed check-ins compared with expected check-ins for fixed-frequency items."
        />
        <ProgressReportStat
          label={pluralize(summary.pointsEarned, "Point earned", "Points earned")}
          value={summary.pointsEarned}
        />
        <ProgressReportStat
          label="Tracked progress change"
          value={`${formatSignedPoints(summary.totalProgressChange)} percentage ${pluralize(
            Math.abs(summary.totalProgressChange),
            "point"
          )}`}
        />
      </div>
    </ProgressReportSection>
  );
}
