/**
 * Daily usage window for text chat: the member's LOCAL calendar day.
 *
 * - Timezone: `profiles.timezone` (IANA, e.g. "Australia/Sydney"), the same field onboarding
 *   collects. Missing or invalid values fall back to UTC — never to the server's local zone.
 * - Boundaries: [local 00:00, next local 00:00), returned as UTC instants for the database query.
 *   DST days are 23 or 25 hours long; both boundaries are computed independently, so they are exact.
 *
 * Changing `profiles.timezone` moves the window; it cannot grant extra messages beyond what one
 * calendar day in the new zone allows, because usage is counted from stored message timestamps.
 */

export const USAGE_FALLBACK_TIME_ZONE = 'UTC';

export function resolveUsageTimeZone(raw: string | null | undefined): string {
  const tz = typeof raw === 'string' ? raw.trim() : '';
  if (!tz) return USAGE_FALLBACK_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(0);
    return tz;
  } catch {
    return USAGE_FALLBACK_TIME_ZONE;
  }
}

/** Wall-clock parts of `instant` in `timeZone`. */
function zonedParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

/** Offset (ms) of `timeZone` from UTC at `instant` (positive east of UTC). */
function offsetAt(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** UTC instant of local midnight for the calendar date (y, m, d) in `timeZone`. */
function localMidnightUtc(year: number, month: number, day: number, timeZone: string): Date {
  const naive = Date.UTC(year, month - 1, day);
  // Two passes settle the offset even when midnight sits next to a DST transition.
  let guess = naive - offsetAt(new Date(naive), timeZone);
  guess = naive - offsetAt(new Date(guess), timeZone);
  return new Date(guess);
}

export interface UsageWindow {
  timeZone: string;
  /** Inclusive start (local 00:00 today), UTC. */
  start: Date;
  /** Exclusive end (local 00:00 tomorrow), UTC — also when the allowance resets. */
  resetsAt: Date;
}

export function usageWindowFor(now: Date, rawTimeZone: string | null | undefined): UsageWindow {
  const timeZone = resolveUsageTimeZone(rawTimeZone);
  const today = zonedParts(now, timeZone);
  const start = localMidnightUtc(today.year, today.month, today.day, timeZone);
  const tomorrow = new Date(Date.UTC(today.year, today.month - 1, today.day + 1));
  const resetsAt = localMidnightUtc(
    tomorrow.getUTCFullYear(),
    tomorrow.getUTCMonth() + 1,
    tomorrow.getUTCDate(),
    timeZone
  );
  return { timeZone, start, resetsAt };
}
