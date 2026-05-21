import { format, startOfDay, subDays } from "date-fns";
import type { MoodEntryLite } from "@/app/pages/app/mood-check-in/moodCheckInUtils";
import type { BrainHealthClarityRange, BrainHealthRailTimeFilter } from "./BrainHealthRightRail";
import type { MentalClimate } from "./brainHealthPersistedTypes";

export interface BrainHealthSessionLite {
  started_at: string | null;
  created_at: string;
  status?: string;
}

export interface BrainHealthSleepLite {
  wake_time: string;
  quality_rating: number | null;
}

export interface BrainHealthBrainLoad {
  noise: number;
  pressure: number;
  clarity: number;
}

function parseDate(value: string): Date | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function rangeStartForFilter(filter: BrainHealthRailTimeFilter): Date {
  const today = startOfDay(new Date());
  if (filter === "today") return today;
  if (filter === "last_month") return subDays(today, 29);
  return subDays(today, 6);
}

export function railFilterDayCount(filter: BrainHealthRailTimeFilter): number {
  if (filter === "last_month") return 30;
  return 7;
}

function railFilterPeriodLabel(filter: BrainHealthRailTimeFilter): string {
  if (filter === "today") return "today";
  if (filter === "last_month") return "in the last 30 days";
  return "in the last 7 days";
}

export function rangeStartForClarity(range: BrainHealthClarityRange): Date {
  const today = startOfDay(new Date());
  if (range === "today") return today;
  if (range === "last_month") return subDays(today, 29);
  return subDays(today, 6);
}

export function clarityChartDayCount(range: BrainHealthClarityRange): number {
  if (range === "last_month") return 30;
  return 7;
}

export function buildClarityChartSeries(
  moods: MoodEntryLite[],
  range: BrainHealthClarityRange
): Array<{ label: string; clarity: number }> {
  const start = rangeStartForClarity(range);
  const days = clarityChartDayCount(range);
  const byDay = new Map<string, number[]>();

  for (const m of moods) {
    const d = parseDate(m.created_at);
    if (d == null || !isOnOrAfter(d, start)) continue;
    const k = format(startOfDay(d), "yyyy-MM-dd");
    const v = typeof m.intensity === "number" && Number.isFinite(m.intensity) ? m.intensity : 5;
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(v);
  }

  const today = startOfDay(new Date());
  const series: Array<{ label: string; clarity: number }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = subDays(today, i);
    const k = format(d, "yyyy-MM-dd");
    const arr = byDay.get(k);
    const avg = arr?.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const clarity = avg > 0 ? Math.round(Math.min(100, Math.max(8, avg * 10))) : 0;
    const label =
      days > 14
        ? format(d, "d")
        : format(d, "EEE").charAt(0).toUpperCase();
    series.push({ label, clarity });
  }

  return series;
}

export function isOnOrAfter(date: Date, start: Date): boolean {
  return date.getTime() >= start.getTime();
}

export function parseMoodEntries(raw: unknown): MoodEntryLite[] {
  const rows = Array.isArray(raw) ? raw : Array.isArray((raw as { items?: unknown })?.items) ? (raw as { items: unknown[] }).items : [];
  const out: MoodEntryLite[] = [];
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const created = typeof r.created_at === "string" ? r.created_at : "";
    const mood = typeof r.mood === "string" ? r.mood : "";
    if (!created || !mood) continue;
    const intensity = typeof r.intensity === "number" ? r.intensity : undefined;
    out.push({ created_at: created, mood, intensity });
  }
  return out;
}

export function parseSleepEntries(raw: unknown): BrainHealthSleepLite[] {
  const rows = Array.isArray(raw) ? raw : [];
  return rows
    .map((row) => {
      const r = row as Record<string, unknown>;
      const wake = typeof r.wake_time === "string" ? r.wake_time : "";
      if (!wake) return null;
      const q = typeof r.quality_rating === "number" ? r.quality_rating : null;
      return { wake_time: wake, quality_rating: q };
    })
    .filter((e): e is BrainHealthSleepLite => e != null);
}

export function parseSessions(raw: unknown): BrainHealthSessionLite[] {
  const rows = Array.isArray(raw) ? raw : Array.isArray((raw as { items?: unknown })?.items) ? (raw as { items: unknown[] }).items : [];
  const out: BrainHealthSessionLite[] = [];
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const created = typeof r.created_at === "string" ? r.created_at : "";
    if (!created) continue;
    out.push({
      created_at: created,
      started_at: typeof r.started_at === "string" ? r.started_at : null,
      status: typeof r.status === "string" ? r.status : undefined,
    });
  }
  return out;
}

function moodsInRange(moods: MoodEntryLite[], start: Date): MoodEntryLite[] {
  return moods.filter((m) => {
    const d = parseDate(m.created_at);
    return d != null && isOnOrAfter(d, start);
  });
}

function sleepInRange(entries: BrainHealthSleepLite[], start: Date): BrainHealthSleepLite[] {
  return entries.filter((e) => {
    const d = parseDate(e.wake_time);
    return d != null && isOnOrAfter(d, start);
  });
}

function sessionsInRange(sessions: BrainHealthSessionLite[], start: Date): BrainHealthSessionLite[] {
  return sessions.filter((s) => {
    const t = s.started_at ?? s.created_at;
    const d = parseDate(t);
    return d != null && isOnOrAfter(d, start);
  });
}

function averageIntensity(moods: MoodEntryLite[]): number | null {
  const vals = moods
    .map((m) => (typeof m.intensity === "number" && Number.isFinite(m.intensity) ? m.intensity : null))
    .filter((v): v is number => v != null);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function averageSleepQuality(entries: BrainHealthSleepLite[]): number | null {
  const vals = entries.map((e) => e.quality_rating).filter((q): q is number => q != null && Number.isFinite(q));
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Local time from an API timestamp (viewer's timezone). */
function parseLocalDate(iso: string): Date | null {
  return parseDate(iso);
}

/** e.g. 1:23 PM — matches actual log time, not a rounded hour band. */
function formatLocalTime(d: Date): string {
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const mm = minutes.toString().padStart(2, "0");
  return `${hour12}:${mm} ${period}`;
}

function isSameLocalMinute(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate() &&
    a.getHours() === b.getHours() &&
    a.getMinutes() === b.getMinutes()
  );
}

/** Earliest → latest actual log times in the filter range. */
function formatLoggedTimeRange(times: Date[]): string {
  const sorted = [...times].sort((a, b) => a.getTime() - b.getTime());
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const startLabel = formatLocalTime(first);
  const endLabel = formatLocalTime(last);
  if (sorted.length === 1 || isSameLocalMinute(first, last)) {
    return startLabel;
  }
  return `${startLabel} – ${endLabel}`;
}

export function computeFocusWindow(
  sessions: BrainHealthSessionLite[],
  moods: MoodEntryLite[],
  filter: BrainHealthRailTimeFilter
): { time: string; line: string } {
  const start = rangeStartForFilter(filter);
  const rangeSessions = sessionsInRange(sessions, start);
  const rangeMoods = moodsInRange(moods, start);

  const sessionTimes = rangeSessions
    .map((s) => parseLocalDate(s.started_at ?? s.created_at))
    .filter((d): d is Date => d != null);

  const moodTimes = rangeMoods
    .map((m) => parseLocalDate(m.created_at))
    .filter((d): d is Date => d != null);

  const times = sessionTimes.length > 0 ? sessionTimes : moodTimes;
  const period = railFilterPeriodLabel(filter);
  const fromSessions = sessionTimes.length > 0;

  if (times.length === 0) {
    return {
      time: "—",
      line:
        filter === "last_month"
          ? "Complete a Talk It Out session or mood check-in this month to see your focus window."
          : filter === "today"
            ? "Log a Talk It Out session or mood check-in today to see your focus window."
            : "Complete a Talk It Out session or mood check-in this week to see your focus window.",
    };
  }

  const timeLabel = formatLoggedTimeRange(times);

  if (fromSessions) {
    return {
      time: timeLabel,
      line:
        sessionTimes.length === 1
          ? `When you started your Talk It Out session ${period}.`
          : `Earliest to latest Talk It Out session ${period} (${sessionTimes.length} logged).`,
    };
  }

  return {
    time: timeLabel,
    line:
      moodTimes.length === 1
        ? `When you completed your mood check-in ${period}.`
        : `Earliest to latest mood check-in ${period} (${moodTimes.length} logged).`,
  };
}

export function computeCognitiveEnergy(
  moods: MoodEntryLite[],
  mentalClimate: MentalClimate,
  filter: BrainHealthRailTimeFilter
): { label: string; hint: string } {
  const start = rangeStartForFilter(filter);
  const rangeMoods = moodsInRange(moods, start);
  const avg = averageIntensity(rangeMoods);

  const period =
    filter === "today" ? "today" : filter === "last_month" ? "this month" : "this week";

  if (avg != null) {
    if (avg >= 7.5) {
      return {
        label: "High — activated",
        hint: `Average mood intensity ${avg.toFixed(1)}/10 ${period} — pace breaks help energy settle.`,
      };
    }
    if (avg <= 4.5) {
      return {
        label: "Low — tender",
        hint: `Average mood intensity ${avg.toFixed(1)}/10 ${period} — protect bandwidth where you can.`,
      };
    }
    return {
      label: "Medium — receptive",
      hint: `Average mood intensity ${avg.toFixed(1)}/10 ${period} — attention comes in softer waves.`,
    };
  }

  if (mentalClimate === "clear" || mentalClimate === "steady") {
    return { label: "Medium — receptive", hint: "From your current climate selection on this page." };
  }
  if (mentalClimate === "heavy" || mentalClimate === "foggy") {
    return { label: "Low — tender", hint: "From your current climate selection on this page." };
  }
  if (mentalClimate === "overfull" || mentalClimate === "scattered" || mentalClimate === "restless") {
    return { label: "High — scattered", hint: "From your current climate selection on this page." };
  }
  return { label: "Medium", hint: "Log a mood check-in to replace this estimate with your real average." };
}

export function computeMentalRecovery(
  sleepEntries: BrainHealthSleepLite[],
  brainClarity: number,
  filter: BrainHealthRailTimeFilter
): { label: string; hint: string } {
  const start = rangeStartForFilter(filter);
  const inRange = sleepInRange(sleepEntries, start);
  const avgQ = averageSleepQuality(inRange);

  const sleepPeriod =
    filter === "today"
      ? "from your latest log"
      : filter === "last_month"
        ? "over the last 30 days"
        : "over the last 7 days";

  if (avgQ != null) {
    if (avgQ >= 4) {
      return {
        label: "Supported",
        hint: `Sleep quality averaged ${avgQ.toFixed(1)}/5 ${sleepPeriod}.`,
      };
    }
    if (avgQ >= 2.5) {
      return {
        label: "Recovering",
        hint: `Sleep quality averaged ${avgQ.toFixed(1)}/5 ${sleepPeriod}.`,
      };
    }
    return {
      label: "Needs attention",
      hint: `Sleep quality averaged ${avgQ.toFixed(1)}/5 ${sleepPeriod}.`,
    };
  }

  if (brainClarity < 48) {
    return { label: "Needs attention", hint: "Based on your reflection inputs — log sleep to refine this." };
  }
  if (brainClarity < 62) {
    return { label: "Recovering", hint: "Based on your reflection inputs — log sleep to refine this." };
  }
  return { label: "Supported", hint: "Based on your reflection inputs — log sleep to refine this." };
}

export function computeClarityPercent(
  brainLoad: BrainHealthBrainLoad,
  moods: MoodEntryLite[],
  clarityRange: BrainHealthClarityRange
): number {
  const start = rangeStartForClarity(clarityRange);
  const rangeMoods = moodsInRange(moods, start);
  const avg = averageIntensity(rangeMoods);
  const fromReflection = brainLoad.clarity;
  if (avg == null) return fromReflection;
  const fromMood = Math.round(Math.min(90, Math.max(12, avg * 10)));
  return Math.round(fromReflection * 0.45 + fromMood * 0.55);
}

export function hasBrainHealthReflectionSignal(params: {
  selectedLoadsCount: number;
  reflectionChoicesCount: number;
  reflectionFlowComplete: boolean;
  selectedPath: boolean;
  moodsInPeriod: number;
  sleepLogsInPeriod: number;
}): boolean {
  return (
    params.reflectionFlowComplete ||
    params.selectedLoadsCount > 0 ||
    params.reflectionChoicesCount > 0 ||
    params.selectedPath ||
    params.moodsInPeriod > 0 ||
    params.sleepLogsInPeriod > 0
  );
}

/** Eight normalized points (0–1) for sparklines from daily averages. */
export function dailySparklinePoints(
  moods: MoodEntryLite[],
  start: Date,
  days = 7
): number[] {
  const byDay = new Map<string, number[]>();
  for (const m of moods) {
    const d = parseDate(m.created_at);
    if (d == null || !isOnOrAfter(d, start)) continue;
    const k = format(startOfDay(d), "yyyy-MM-dd");
    const v = typeof m.intensity === "number" && Number.isFinite(m.intensity) ? m.intensity : 5;
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(v);
  }

  const today = startOfDay(new Date());
  const points: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = subDays(today, i);
    const k = format(d, "yyyy-MM-dd");
    const arr = byDay.get(k);
    const avg = arr?.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    points.push(avg > 0 ? Math.min(1, avg / 10) : 0.12);
  }
  return points;
}

export function sessionCountSparkline(
  sessions: BrainHealthSessionLite[],
  start: Date,
  days = 7
): number[] {
  const counts = new Array(days).fill(0) as number[];
  const today = startOfDay(new Date());
  for (const s of sessions) {
    const d = parseDate(s.started_at ?? s.created_at);
    if (d == null || !isOnOrAfter(d, start)) continue;
    for (let i = 0; i < days; i++) {
      const day = subDays(today, days - 1 - i);
      if (format(startOfDay(d), "yyyy-MM-dd") === format(day, "yyyy-MM-dd")) {
        counts[i] = (counts[i] ?? 0) + 1;
        break;
      }
    }
  }
  const max = Math.max(1, ...counts);
  return counts.map((c) => (c > 0 ? 0.2 + (c / max) * 0.8 : 0.1));
}
