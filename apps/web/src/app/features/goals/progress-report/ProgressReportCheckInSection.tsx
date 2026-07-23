import { ProgressReportSection, ProgressReportStat } from "./ProgressReportSection";
import { ITEM_TYPE_LABELS, pluralize } from "./progress-report.utils";
import type { ProgressReport } from "./progress-report.types";

/**
 * Check-in activity for the period. Streaks are deliberately NOT reconstructed
 * here — the backend does not return a verified streak value.
 */
export function ProgressReportCheckInSection({
  activity,
}: {
  activity: ProgressReport["checkInActivity"];
}) {
  const most = activity.mostConsistentItem;

  return (
    <ProgressReportSection title="Check-In Activity" headingId="report-checkin-activity">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ProgressReportStat
          label={pluralize(activity.totalCheckIns, "Total check-in", "Total check-ins")}
          value={activity.totalCheckIns}
        />
        <ProgressReportStat
          label={pluralize(activity.activeDays, "Active day", "Active days")}
          value={activity.activeDays}
        />
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
        <h3 className="text-sm font-semibold text-white">Most consistent item</h3>
        {most ? (
          <div className="mt-1.5 space-y-0.5">
            <p className="break-words text-sm text-zinc-200">{most.title}</p>
            <p className="text-xs text-zinc-400">
              {ITEM_TYPE_LABELS[most.itemType]} ·{" "}
              <span className="tabular-nums">{most.rate}%</span> consistency
            </p>
          </div>
        ) : (
          <p className="mt-1.5 text-sm text-zinc-400">
            Consistency is not available for the current custom-frequency items.
          </p>
        )}
      </div>
    </ProgressReportSection>
  );
}
