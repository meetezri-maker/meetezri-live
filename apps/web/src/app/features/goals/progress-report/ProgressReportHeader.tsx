import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { GOALS_ACHIEVEMENTS_PATH } from "./progress-report.routes";
import { formatReportDate } from "./progress-report.utils";

/**
 * Report page header: title, optional user name, period label, generated date,
 * and a neutral description. A back action returns to Goals & Achievements.
 *
 * The PDF export action lives with the report controls (beside the range
 * selector) directly below this header.
 */
export function ProgressReportHeader({
  displayName,
  periodLabel,
  generatedAt,
}: {
  displayName: string | null;
  periodLabel: string;
  generatedAt: string;
}) {
  const generated = formatReportDate(generatedAt);

  return (
    <header className="space-y-4">
      <Link
        to={GOALS_ACHIEVEMENTS_PATH}
        className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-100"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        Back to Goals &amp; Achievements
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-2">
          <h1 className="font-serif text-2xl font-semibold text-white sm:text-3xl">Progress Report</h1>
          <p className="text-sm text-zinc-300">
            {displayName ? <span className="font-medium text-white">{displayName}</span> : null}
            {displayName ? <span aria-hidden> · </span> : null}
            <span>{periodLabel}</span>
            {generated ? (
              <>
                <span aria-hidden> · </span>
                <span>Generated {generated}</span>
              </>
            ) : null}
          </p>
          <p className="max-w-2xl text-sm leading-relaxed text-zinc-400">
            A summary of your Goals, Personal Achievements, check-ins, rewards, and progress during
            this period.
          </p>
        </div>
      </div>
    </header>
  );
}
