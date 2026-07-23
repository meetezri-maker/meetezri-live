import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { achievementsCategoryPill } from "@/app/pages/app/achievements/achievementsUi";
import { RANGE_OPTIONS } from "./progress-report.utils";
import type { ProgressReportRange } from "./progress-report.types";

/**
 * Accessible segmented control for the report period. Uses the existing pill
 * styling; wraps on small screens so it never overflows horizontally.
 */
export function ProgressReportRangeSelector({
  value,
  onChange,
  isFetching,
}: {
  value: ProgressReportRange;
  onChange: (range: ProgressReportRange) => void;
  isFetching: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        role="group"
        aria-label="Report period"
        className="flex flex-wrap gap-2 rounded-full border border-white/12 bg-white/[0.04] p-1"
      >
        {RANGE_OPTIONS.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              data-testid={`report-range-${option.value}`}
              onClick={() => onChange(option.value)}
              className={cn(achievementsCategoryPill(active), "px-4")}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/* Subtle refresh indication — the loaded report stays visible. */}
      <p
        role="status"
        aria-live="polite"
        className={cn(
          "inline-flex items-center gap-2 text-xs text-zinc-400 transition-opacity",
          isFetching ? "opacity-100" : "opacity-0"
        )}
      >
        {isFetching ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Updating report…
          </>
        ) : null}
      </p>
    </div>
  );
}
