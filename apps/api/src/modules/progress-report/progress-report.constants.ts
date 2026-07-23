/**
 * Progress Reporting v1 constants (single source of truth for report tuning).
 *
 * These values are backend-owned. Ranges, inactivity thresholds, and the
 * approaching-target window are defined ONCE here so they can be changed later
 * without hunting through the service.
 */

/** Report schema version. Bump only on a breaking contract change. */
export const PROGRESS_REPORT_VERSION = 1 as const;

/** Supported report ranges (v1). Custom date range is deferred to v1.1. */
export const PROGRESS_REPORT_RANGES = ["7d", "30d", "90d", "all"] as const;
export type ProgressReportRange = (typeof PROGRESS_REPORT_RANGES)[number];

export function isProgressReportRange(value: unknown): value is ProgressReportRange {
  return typeof value === "string" && (PROGRESS_REPORT_RANGES as readonly string[]).includes(value);
}

/** Inclusive calendar-day length for the fixed ranges. */
export const RANGE_DAYS: Record<Exclude<ProgressReportRange, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

/** Human-readable period labels (UI-agnostic — plain text only). */
export const RANGE_LABELS: Record<ProgressReportRange, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  all: "All time",
};

/**
 * Approved v1 rule: a `custom`-frequency item is considered to have no recent
 * check-ins after this many days without one. Named so it can change later.
 */
export const CUSTOM_FREQUENCY_INACTIVITY_DAYS = 14;

/**
 * "No recent check-ins" thresholds (in days) by check-in frequency. An item is
 * flagged when the days since its latest check-in EXCEEDS the threshold.
 */
export const NO_RECENT_CHECKIN_THRESHOLD_DAYS: Record<
  "daily" | "twice_weekly" | "weekly" | "custom",
  number
> = {
  daily: 2,
  twice_weekly: 7,
  weekly: 14,
  custom: CUSTOM_FREQUENCY_INACTIVITY_DAYS,
};

/** Approaching-target window: target date within this many days ahead (inclusive). */
export const APPROACHING_TARGET_DAYS = 7;

/** Recognized fixed (non-custom) check-in frequencies used for consistency math. */
export const FIXED_FREQUENCIES = ["daily", "twice_weekly", "weekly"] as const;
export type FixedFrequency = (typeof FIXED_FREQUENCIES)[number];
export type CheckInFrequency = FixedFrequency | "custom";
