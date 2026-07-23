import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  achievementsPageFogMid,
  achievementsPageGlowTop,
  achievementsPageRoot,
  achievementsPageVignette,
} from "@/app/pages/app/achievements/achievementsUi";
import { useProgressReportQuery } from "./progress-report.queries";
import { normalizeRange } from "./progress-report.utils";
import type { ProgressReport, ProgressReportRange } from "./progress-report.types";
import { ProgressReportHeader } from "./ProgressReportHeader";
import { ProgressReportRangeSelector } from "./ProgressReportRangeSelector";
import { ProgressReportDownloadButton } from "./ProgressReportDownloadButton";
import { ProgressReportCurrentSnapshot } from "./ProgressReportCurrentSnapshot";
import { ProgressReportSummary } from "./ProgressReportSummary";
import { ProgressReportItemsSection } from "./ProgressReportItemsSection";
import { ProgressReportCompletedSection } from "./ProgressReportCompletedSection";
import { ProgressReportCheckInSection } from "./ProgressReportCheckInSection";
import { ProgressReportWellbeingSection } from "./ProgressReportWellbeingSection";
import { ProgressReportAttentionSection } from "./ProgressReportAttentionSection";
import { ProgressReportRewardsSection } from "./ProgressReportRewardsSection";
import { ProgressReportClosingSummary } from "./ProgressReportClosingSummary";
import { ProgressReportSkeleton } from "./ProgressReportSkeleton";
import { ProgressReportEmptyState, ProgressReportErrorState } from "./ProgressReportStates";

/** A report with no tracked activity at all (page-level empty state). */
function isReportEmpty(report: ProgressReport): boolean {
  return (
    report.activeGoals.length === 0 &&
    report.activeAchievements.length === 0 &&
    report.completedDuringPeriod.length === 0 &&
    report.checkInActivity.totalCheckIns === 0 &&
    report.rewards.transactions.length === 0 &&
    report.currentSnapshot.completedGoalsAllTime === 0 &&
    report.currentSnapshot.completedAchievementsAllTime === 0
  );
}

/**
 * Progress Report page. Read-only: it issues a single GET and performs no
 * mutations. Every displayed value comes from the backend response — no
 * reporting formula is reproduced here.
 */
export function ProgressReportPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Invalid or missing values fall back to 30d without navigating.
  const range = normalizeRange(searchParams.get("range"));

  const { data, isPending, isError, isFetching, refetch } = useProgressReportQuery(range);

  const handleRangeChange = useCallback(
    (next: ProgressReportRange) => {
      const params = new URLSearchParams(searchParams);
      params.set("range", next);
      // Same route — only the query string changes.
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  return (
    <div className={cn(achievementsPageRoot, "relative min-h-full pb-12")}>
      <div className={achievementsPageGlowTop} aria-hidden />
      <div className={achievementsPageFogMid} aria-hidden />
      <div className={achievementsPageVignette} aria-hidden />

      <div className="relative z-10 mx-auto max-w-[1180px] px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        {isPending ? (
          <ProgressReportSkeleton />
        ) : isError ? (
          <ProgressReportErrorState onRetry={() => void refetch()} />
        ) : data ? (
          <div className="space-y-8">
            <ProgressReportHeader
              displayName={data.user.displayName}
              periodLabel={data.period.label}
              generatedAt={data.generatedAt}
            />

            {/* Report controls: range selector (left) + PDF export (right). */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <ProgressReportRangeSelector
                value={range}
                onChange={handleRangeChange}
                isFetching={isFetching}
              />
              <ProgressReportDownloadButton report={data} />
            </div>

            {/* Previously loaded content stays visible while a new range loads. */}
            <div
              className={cn(
                "space-y-8 transition-opacity duration-200",
                isFetching ? "opacity-60" : "opacity-100"
              )}
            >
              {isReportEmpty(data) ? (
                <ProgressReportEmptyState />
              ) : (
                <>
                  <ProgressReportCurrentSnapshot snapshot={data.currentSnapshot} />
                  <ProgressReportSummary
                    summary={data.periodSummary}
                    periodLabel={data.period.label}
                  />
                  <ProgressReportItemsSection
                    title="Active Goals"
                    headingId="report-active-goals"
                    items={data.activeGoals}
                    itemType="goal"
                    emptyMessage="No active Goals."
                    testId="report-active-goals"
                  />
                  <ProgressReportItemsSection
                    title="Active Personal Achievements"
                    headingId="report-active-achievements"
                    items={data.activeAchievements}
                    itemType="achievement"
                    emptyMessage="No active Personal Achievements."
                    testId="report-active-achievements"
                  />
                  <ProgressReportCompletedSection completions={data.completedDuringPeriod} />
                  <ProgressReportCheckInSection activity={data.checkInActivity} />
                  <ProgressReportWellbeingSection entries={data.wellbeingEntries} />
                  <ProgressReportAttentionSection
                    items={data.needsAttention}
                    activeGoals={data.activeGoals}
                    activeAchievements={data.activeAchievements}
                  />
                  <ProgressReportRewardsSection
                    rewards={data.rewards}
                    snapshot={data.currentSnapshot}
                    completions={data.completedDuringPeriod}
                  />
                  <ProgressReportClosingSummary lines={data.closingSummary} />
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default ProgressReportPage;
