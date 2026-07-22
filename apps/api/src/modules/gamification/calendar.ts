/**
 * User-timezone-aware calendar-day helper. Used to enforce "one check-in per
 * item per user calendar day" against the user's configured timezone rather
 * than server-local time.
 */

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * The calendar date (YYYY-MM-DD) for `now` in the user's timezone. Falls back to
 * UTC when the timezone is missing or invalid.
 */
export function userCalendarDate(
  timezone: string | null | undefined,
  now: Date = new Date()
): string {
  const tz = timezone && isValidTimeZone(timezone) ? timezone : "UTC";
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
