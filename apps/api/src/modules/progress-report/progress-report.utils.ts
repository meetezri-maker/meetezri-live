/**
 * Pure, timezone-aware date helpers for the progress report. All calendar-day
 * logic is done on `YYYY-MM-DD` strings so it matches the check-in calendar-day
 * model (see gamification/calendar.ts) and never depends on the server's local
 * timezone. These functions are deterministic and unit-testable.
 */
import { userCalendarDate } from "../gamification/calendar";
import type { CheckInFrequency } from "./progress-report.constants";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** The user's current calendar date (YYYY-MM-DD) for `now`. */
export function todayInTimezone(timezone: string | null | undefined, now: Date): string {
  return userCalendarDate(timezone, now);
}

/** The calendar date (YYYY-MM-DD) of a timestamp in the user's timezone. */
export function timestampToCalendarDate(
  timezone: string | null | undefined,
  value: Date | string
): string {
  return userCalendarDate(timezone, new Date(value));
}

/**
 * Format a date-only DB value (Prisma `@db.Date`, stored at UTC midnight) as
 * YYYY-MM-DD without applying any timezone shift.
 */
export function dateOnlyToYmd(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

/** Validate + normalize a YYYY-MM-DD string; returns null for blank/invalid. */
export function parseYmd(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!YMD.test(trimmed)) return null;
  const t = Date.parse(`${trimmed}T00:00:00Z`);
  return Number.isNaN(t) ? null : trimmed;
}

/** Add (or subtract) whole calendar days to a YYYY-MM-DD string. */
export function addCalendarDays(ymd: string, delta: number): string {
  const ms = Date.parse(`${ymd}T00:00:00Z`) + delta * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Signed calendar-day difference `to - from` (both YYYY-MM-DD). */
export function diffCalendarDays(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Inclusive calendar-day count from start..end (0 when end precedes start). */
export function inclusiveDayCount(start: string, end: string): number {
  return Math.max(0, diffCalendarDays(start, end) + 1);
}

/** True when `ymd` falls in [start, end]; a null start means "no lower bound". */
export function isWithinRange(ymd: string, start: string | null, end: string): boolean {
  if (ymd > end) return false;
  if (start !== null && ymd < start) return false;
  return true;
}

/** Lexicographic max/min for YYYY-MM-DD strings (valid because zero-padded). */
export function maxYmd(a: string, b: string): string {
  return a >= b ? a : b;
}
export function minYmd(a: string, b: string): string {
  return a <= b ? a : b;
}

/**
 * Expected check-ins for a frequency across an inclusive calendar-day window.
 * Returns null for `custom` (no deterministic expectation in v1).
 */
export function expectedCheckIns(frequency: CheckInFrequency, activeWindowDays: number): number | null {
  const days = Math.max(0, activeWindowDays);
  switch (frequency) {
    case "daily":
      return days;
    case "twice_weekly":
      return Math.round((days * 2) / 7);
    case "weekly":
      return Math.round(days / 7);
    case "custom":
    default:
      return null;
  }
}

/** Item consistency: min(100, round(actual / max(1, expected) * 100)); null for custom. */
export function consistencyRate(actual: number, expected: number | null): number | null {
  if (expected === null) return null;
  return Math.min(100, Math.round((actual / Math.max(1, expected)) * 100));
}

/** Normalize a stored frequency value to a known CheckInFrequency (unknown -> custom). */
export function normalizeFrequency(value: unknown): CheckInFrequency {
  if (value === "daily" || value === "twice_weekly" || value === "weekly") return value;
  return "custom";
}

/** Singular/plural helper for the deterministic closing summary. */
export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : plural ?? `${singular}s`;
}
