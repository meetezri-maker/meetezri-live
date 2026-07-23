import { Progress } from "@/app/components/ui/progress";
import { cn } from "@/lib/utils";
import { achievementsCard } from "@/app/pages/app/achievements/achievementsUi";
import {
  ATTENTION_REASON_LABELS,
  TRACKING_METHOD_LABELS,
  clampPercent,
  formatNumericProgress,
  formatReportDate,
  formatSignedPoints,
  humanizeToken,
  pluralize,
} from "./progress-report.utils";
import type { ProgressReportItem, ProgressReportItemType } from "./progress-report.types";

/** Small neutral metadata chip (text carries the meaning, not colour alone). */
function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-zinc-300">
      <span className="text-zinc-500">{label}:</span>
      <span className="break-words">{value}</span>
    </span>
  );
}

/**
 * One active Goal or Personal Achievement. Goals and Achievements deliberately
 * share this card so both sections use identical visual language and no report
 * value is formatted two different ways.
 *
 * Every number shown is backend-provided. The only client math is the progress
 * bar width (a direct display ratio, clamped 0..100).
 */
export function ProgressReportItemCard({
  item,
  itemType,
}: {
  item: ProgressReportItem;
  itemType: ProgressReportItemType;
}) {
  const numeric = formatNumericProgress(
    item.trackingType,
    item.currentValue,
    item.targetValue,
    item.trackingUnit
  );
  const isMilestone = item.trackingType === "manual_milestone";
  const startDate = formatReportDate(item.startDate);
  const targetDate = formatReportDate(item.targetDate);

  const attentionReasons: string[] = [];
  if (item.isOverdue) attentionReasons.push(ATTENTION_REASON_LABELS.overdue);
  if (item.isApproachingTarget) attentionReasons.push(ATTENTION_REASON_LABELS.approaching_target);
  if (item.hasNoRecentCheckIns) attentionReasons.push(ATTENTION_REASON_LABELS.no_recent_check_ins);

  return (
    <article
      data-testid={`report-item-${itemType}`}
      className={cn(achievementsCard, "min-w-0 space-y-4 rounded-2xl p-5")}
    >
      <div className="min-w-0 space-y-2">
        <h3 className="break-words text-[15px] font-semibold text-white">{item.title}</h3>
        <div className="flex flex-wrap gap-1.5">
          {item.category ? <Meta label="Category" value={humanizeToken(item.category) ?? ""} /> : null}
          <Meta label="Status" value={humanizeToken(item.status) ?? item.status} />
          {item.priority ? <Meta label="Priority" value={humanizeToken(item.priority) ?? ""} /> : null}
          <Meta label="Tracking" value={TRACKING_METHOD_LABELS[item.trackingType]} />
        </div>
      </div>

      {/* Current progress — clearly separated from the period change below. */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          Current Progress
        </p>
        <p className="mt-0.5 text-2xl font-semibold tabular-nums text-white">
          {item.currentProgress}%
        </p>
        <Progress
          value={clampPercent(item.currentProgress)}
          aria-label={`${item.title} current progress`}
          className="mt-2 bg-white/[0.08]"
        />
        {numeric ? (
          <p className="mt-2 text-xs text-zinc-300">{numeric}</p>
        ) : isMilestone ? (
          <p className="mt-2 text-xs text-zinc-400">Milestone-based tracking (percentage only)</p>
        ) : null}
      </div>

      {/* Period movement — explicitly labelled so it can't be read as current. */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          Change During This Period
        </p>
        <p className="mt-0.5 text-sm tabular-nums text-zinc-200">
          {item.progressAtStart}% <span aria-hidden>→</span>
          <span className="sr-only">to</span> {item.progressAtEnd}%
        </p>
        <p className="mt-0.5 text-sm font-medium tabular-nums text-zinc-300">
          {formatSignedPoints(item.progressChange)} percentage{" "}
          {pluralize(Math.abs(item.progressChange), "point")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 text-xs text-zinc-400 sm:grid-cols-2">
        <p>
          <span className="text-zinc-500">Check-ins this period: </span>
          <span className="tabular-nums">{item.checkInsDuringPeriod}</span>
        </p>
        <p>
          <span className="text-zinc-500">Active check-in days: </span>
          <span className="tabular-nums">{item.activeCheckInDays}</span>
        </p>
        <p className="sm:col-span-2">
          {item.consistencyRate === null ? (
            <>
              <span className="text-zinc-500">Consistency: </span>
              Custom frequency · {item.activeCheckInDays}{" "}
              {pluralize(item.activeCheckInDays, "check-in day")}
            </>
          ) : (
            <>
              <span className="text-zinc-500">Consistency: </span>
              <span className="tabular-nums">{item.consistencyRate}%</span>
            </>
          )}
        </p>
        {startDate ? (
          <p>
            <span className="text-zinc-500">Start: </span>
            {startDate}
          </p>
        ) : null}
        {targetDate ? (
          <p>
            <span className="text-zinc-500">Target: </span>
            {targetDate}
          </p>
        ) : null}
      </div>

      {attentionReasons.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {attentionReasons.map((reason) => (
            <li
              key={reason}
              className="rounded-full border border-amber-300/25 bg-amber-400/[0.08] px-2.5 py-1 text-[11px] text-amber-200"
            >
              {reason}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
