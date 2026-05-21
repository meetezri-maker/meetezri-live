import {
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";

export type MoodPatternPeriod = "this_week" | "last_week" | "last_month";

export const MOOD_PATTERN_PERIOD_OPTIONS: { value: MoodPatternPeriod; label: string }[] = [
  { value: "this_week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "last_month", label: "Last month" },
];

export function moodPatternPeriodBounds(period: MoodPatternPeriod, now = new Date()): {
  start: Date;
  end: Date;
} {
  const today = startOfDay(now);

  if (period === "this_week") {
    return { start: subDays(today, 6), end: endOfDay(now) };
  }
  if (period === "last_week") {
    return { start: subDays(today, 13), end: endOfDay(subDays(today, 7)) };
  }
  const prevMonth = subMonths(now, 1);
  return { start: startOfMonth(prevMonth), end: endOfMonth(prevMonth) };
}

export function filterMoodEntriesInPeriod(
  entries: MoodEntryLite[],
  period: MoodPatternPeriod,
  now = new Date(),
): MoodEntryLite[] {
  const { start, end } = moodPatternPeriodBounds(period, now);
  return entries.filter((e) => {
    const d = new Date(e.created_at);
    return !Number.isNaN(d.getTime()) && d >= start && d <= end;
  });
}

export function topMoodKeyInEntries(entries: MoodEntryLite[]): { count: number; topKey: string } {
  if (entries.length === 0) return { count: 0, topKey: "" };
  const counts = new Map<string, number>();
  for (const e of entries) {
    const key = String(e.mood ?? "")
      .toLowerCase()
      .trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let bestKey = "";
  let bestCount = 0;
  for (const [k, c] of counts) {
    if (c > bestCount) {
      bestCount = c;
      bestKey = k;
    }
  }
  return { count: entries.length, topKey: bestKey };
}

export function intensitySeriesForPeriod(
  entries: MoodEntryLite[],
  period: MoodPatternPeriod,
  now = new Date(),
): { day: string; avg: number; short: string }[] {
  const { start, end } = moodPatternPeriodBounds(period, now);
  const byDay = new Map<string, number[]>();
  for (const e of entries) {
    const d = new Date(e.created_at);
    if (Number.isNaN(d.getTime()) || d < start || d > end) continue;
    const k = format(startOfDay(d), "yyyy-MM-dd");
    const v = typeof e.intensity === "number" && Number.isFinite(e.intensity) ? e.intensity : 5;
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(v);
  }

  const days = eachDayOfInterval({ start, end });
  const shortFmt = period === "last_month" ? "MMM d" : "EEE";

  return days.map((d) => {
    const k = format(d, "yyyy-MM-dd");
    const arr = byDay.get(k);
    const avg = arr?.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    return {
      day: k,
      avg: Math.round(avg * 10) / 10,
      short: format(d, shortFmt),
    };
  });
}

export interface MoodEntryLite {
  mood: string;
  created_at: string;
  intensity?: number | null;
}

export function computeCheckInStreak(entries: MoodEntryLite[]): number {
  if (entries.length === 0) return 0;
  const days = new Set<string>();
  for (const e of entries) {
    const d = new Date(e.created_at);
    if (Number.isNaN(d.getTime())) continue;
    days.add(format(startOfDay(d), "yyyy-MM-dd"));
  }
  let cursor = startOfDay(new Date());
  const key = (d: Date) => format(d, "yyyy-MM-dd");
  if (!days.has(key(cursor))) {
    cursor = subDays(cursor, 1);
    if (!days.has(key(cursor))) return 0;
  } else {
    cursor = startOfDay(new Date());
  }
  let streak = 0;
  while (days.has(key(cursor))) {
    streak++;
    cursor = subDays(cursor, 1);
  }
  return streak;
}

/** @deprecated Use intensitySeriesForPeriod(entries, "this_week") */
export function weeklyIntensitySeries(entries: MoodEntryLite[]) {
  return intensitySeriesForPeriod(entries, "this_week");
}
