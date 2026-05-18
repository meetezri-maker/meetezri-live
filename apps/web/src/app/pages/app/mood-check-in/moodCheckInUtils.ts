import { format, startOfDay, subDays } from "date-fns";

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

export function weeklyIntensitySeries(entries: MoodEntryLite[]) {
  const byDay = new Map<string, number[]>();
  for (const e of entries) {
    const d = new Date(e.created_at);
    if (Number.isNaN(d.getTime())) continue;
    const k = format(startOfDay(d), "yyyy-MM-dd");
    const v = typeof e.intensity === "number" && Number.isFinite(e.intensity) ? e.intensity : 5;
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(v);
  }
  const out: { day: string; avg: number; short: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = subDays(startOfDay(new Date()), i);
    const k = format(d, "yyyy-MM-dd");
    const arr = byDay.get(k);
    const avg = arr?.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    out.push({
      day: k,
      avg: Math.round(avg * 10) / 10,
      short: format(d, "EEE"),
    });
  }
  return out;
}
