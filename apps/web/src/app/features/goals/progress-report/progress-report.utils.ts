/**
 * Display-only helpers for the Progress Report.
 *
 * These NEVER recompute report values. They only format backend-provided data
 * (labels, dates, signs, safe visual widths) for presentation.
 */
import {
  PROGRESS_REPORT_RANGES,
  type ProgressReportAttentionReason,
  type ProgressReportItemType,
  type ProgressReportRange,
  type ProgressReportTrackingType,
} from "./progress-report.types";

export const DEFAULT_RANGE: ProgressReportRange = "30d";

export const RANGE_OPTIONS: Array<{ value: ProgressReportRange; label: string }> = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "all", label: "All Time" },
];

/** Coerce an arbitrary URL value to a supported range, falling back to 30d. */
export function normalizeRange(value: unknown): ProgressReportRange {
  return (PROGRESS_REPORT_RANGES as readonly string[]).includes(value as string)
    ? (value as ProgressReportRange)
    : DEFAULT_RANGE;
}

/** Display text for the four tracking methods. */
export const TRACKING_METHOD_LABELS: Record<ProgressReportTrackingType, string> = {
  count: "Count",
  duration: "Duration",
  amount: "Amount",
  manual_milestone: "Milestone-based",
};

/** Display text for backend attention reason codes (display mapping only). */
export const ATTENTION_REASON_LABELS: Record<ProgressReportAttentionReason, string> = {
  overdue: "Past target date",
  approaching_target: "Target date is approaching",
  no_recent_check_ins: "No recent check-ins",
  no_progress_during_period: "No progress recorded during this period",
};

/** Safe label for a reason code, including unknown future codes. */
export function attentionReasonLabel(reason: string): string {
  return (
    ATTENTION_REASON_LABELS[reason as ProgressReportAttentionReason] ?? humanizeCode(reason)
  );
}

export const ITEM_TYPE_LABELS: Record<ProgressReportItemType, string> = {
  goal: "Goal",
  achievement: "Personal Achievement",
};

/** Friendly labels for known point-ledger source types. */
const REWARD_SOURCE_LABELS: Record<string, string> = {
  personal_goal_completion: "Goal completion",
  personal_achievement_completion: "Personal Achievement completion",
};

/** Never expose a raw technical code; unknown codes degrade to readable text. */
export function rewardSourceLabel(sourceType: string): string {
  return REWARD_SOURCE_LABELS[sourceType] ?? humanizeCode(sourceType);
}

/** snake_case / kebab-case -> "Sentence case" fallback for unknown codes. */
export function humanizeCode(code: string): string {
  const cleaned = String(code ?? "").replace(/[_-]+/g, " ").trim();
  if (!cleaned) return "Reward";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/** Format a YYYY-MM-DD (or ISO) value for display; returns null when unusable. */
export function formatReportDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const iso = value.length <= 10 ? `${value}T12:00:00` : value;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Signed percentage-point text, e.g. "+32" / "-5" / "0". */
export function formatSignedPoints(change: number): string {
  if (change > 0) return `+${change}`;
  return String(change);
}

/** "1 day" / "2 days" style helper for report copy. */
export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : plural ?? `${singular}s`;
}

/**
 * Visual-only bar width. This is a direct display ratio of backend values and
 * carries no business meaning. Always clamped to 0..100.
 */
export function visualPercent(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

/** Clamp a backend percentage for safe bar rendering (no meaning change). */
export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

/** Humanize a stored status/priority/category token for display. */
export function humanizeToken(value: string | null | undefined): string | null {
  if (!value) return null;
  return humanizeCode(value);
}

/**
 * "18 / 25 workouts" for numeric tracking. Returns null for manual milestones
 * or when values are unavailable, so the UI never invents a fake fraction.
 */
export function formatNumericProgress(
  trackingType: ProgressReportTrackingType,
  currentValue: number | null,
  targetValue: number | null,
  trackingUnit: string | null
): string | null {
  if (trackingType === "manual_milestone") return null;
  if (currentValue == null || targetValue == null) return null;
  const unit = trackingUnit ? ` ${trackingUnit}` : "";
  return `${currentValue} / ${targetValue}${unit}`;
}
