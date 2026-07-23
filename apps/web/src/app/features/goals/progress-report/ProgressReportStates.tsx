import { Link } from "react-router-dom";
import { AlertCircle, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { achievementsEmptyState } from "@/app/pages/app/achievements/achievementsUi";
import { GOALS_ACHIEVEMENTS_PATH } from "./progress-report.routes";

const backLinkClass =
  "inline-flex min-h-[44px] items-center justify-center rounded-full border border-white/12 bg-white/[0.06] px-5 text-sm font-semibold text-zinc-100 transition hover:border-fuchsia-400/25 hover:bg-white/[0.09]";

/**
 * Whole-report error state. Never surfaces raw error objects or stack traces;
 * retry re-runs the query's refetch. Unauthorized responses are handled by the
 * existing auth/session layer (ProtectedRoute + API client).
 */
export function ProgressReportErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      data-testid="report-error-state"
      className={cn(achievementsEmptyState, "border-red-400/25 px-6")}
    >
      <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-400/70" aria-hidden />
      <h2 className="font-serif text-xl font-semibold text-white">
        We couldn’t load your Progress Report.
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
        Please try again. Your Goals and Achievements data has not been changed.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button type="button" data-testid="report-retry" onClick={onRetry} className={backLinkClass}>
          Try again
        </button>
        <Link to={GOALS_ACHIEVEMENTS_PATH} className="text-sm font-medium text-zinc-400 hover:text-zinc-100">
          Back to Goals &amp; Achievements
        </Link>
      </div>
    </div>
  );
}

/** Whole-report empty state: nothing is being tracked yet. */
export function ProgressReportEmptyState() {
  return (
    <div data-testid="report-empty-state" className={cn(achievementsEmptyState, "px-6")}>
      <Trophy className="mx-auto mb-4 h-14 w-14 text-fuchsia-400/35" aria-hidden />
      <h2 className="font-serif text-xl font-semibold text-white">Nothing to report yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
        Your Progress Report will appear here once you begin tracking a Goal or Personal
        Achievement.
      </p>
      <div className="mt-6 flex justify-center">
        <Link to={GOALS_ACHIEVEMENTS_PATH} className={backLinkClass}>
          Back to Goals &amp; Achievements
        </Link>
      </div>
    </div>
  );
}
