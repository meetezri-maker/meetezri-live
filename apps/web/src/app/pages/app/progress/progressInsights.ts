import {
  eachDayOfInterval,
  eachWeekOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";

export type ProgressTimeRange = "all" | "last_month" | "this_month" | "this_week";

export const PROGRESS_TIME_RANGE_OPTIONS: { value: ProgressTimeRange; label: string }[] = [
  { value: "all", label: "All Time" },
  { value: "last_month", label: "Last Month" },
  { value: "this_month", label: "This Month" },
  { value: "this_week", label: "This Week" },
];

export interface DatedRow {
  created_at?: string;
  started_at?: string;
  ended_at?: string | null;
  completed_at?: string;
}

export function progressRangeBounds(range: ProgressTimeRange, now = new Date()): {
  start: Date;
  end: Date;
} {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (range === "this_week") {
    return {
      start: startOfWeek(now, { weekStartsOn: 1 }),
      end,
    };
  }
  if (range === "this_month") {
    return { start: startOfMonth(now), end };
  }
  if (range === "last_month") {
    const prev = subMonths(now, 1);
    return { start: startOfMonth(prev), end: endOfMonth(prev) };
  }
  return { start: new Date(0), end };
}

export function parseProgressDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = parseISO(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function rowDate(row: DatedRow): Date | null {
  return (
    parseProgressDate(row.completed_at) ??
    parseProgressDate(row.created_at) ??
    parseProgressDate(row.started_at) ??
    null
  );
}

export function isWithinProgressRange(
  iso: string | undefined | null,
  range: ProgressTimeRange,
  now = new Date()
): boolean {
  const date = parseProgressDate(iso);
  if (!date) return false;
  const { start, end } = progressRangeBounds(range, now);
  return isWithinInterval(date, { start, end });
}

export function filterByProgressRange<T extends DatedRow>(
  rows: T[],
  range: ProgressTimeRange,
  now = new Date()
): T[] {
  const { start, end } = progressRangeBounds(range, now);
  return rows.filter((row) => {
    const date = rowDate(row);
    return date ? isWithinInterval(date, { start, end }) : false;
  });
}

export type MoodTone = "positive" | "neutral" | "difficult";

const DIFFICULT_MOOD_KEYS = new Set([
  "sad",
  "angry",
  "anxious",
  "overwhelmed",
  "heavy",
  "nervous",
  "stressed",
  "fear",
  "tired",
]);

const POSITIVE_MOOD_KEYS = new Set([
  "happy",
  "calm",
  "excited",
  "hopeful",
  "grateful",
  "confident",
  "motivated",
  "peaceful",
  "joy",
]);

export function moodTone(mood: string, intensity: number): MoodTone {
  const key = mood.trim().toLowerCase();
  if (POSITIVE_MOOD_KEYS.has(key) || intensity >= 7) return "positive";
  if (DIFFICULT_MOOD_KEYS.has(key) || intensity <= 4) return "difficult";
  return "neutral";
}

export interface EmotionalBalancePoint {
  label: string;
  positive: number;
  neutral: number;
  difficult: number;
}

export interface MoodInsightRow {
  created_at: string;
  mood: string;
  intensity: number;
}

export function buildEmotionalBalanceSeries(
  moods: MoodInsightRow[],
  range: ProgressTimeRange,
  now = new Date()
): EmotionalBalancePoint[] {
  const inRange = filterByProgressRange(
    moods.map((m) => ({ ...m, created_at: m.created_at })),
    range,
    now
  );

  if (inRange.length === 0) return [];

  const { start, end } = progressRangeBounds(range, now);

  if (range === "this_week") {
    const days = eachDayOfInterval({ start, end });
    return days.map((day) => {
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);
      const bucket = inRange.filter((m) => {
        const d = parseProgressDate(m.created_at);
        return d && isWithinInterval(d, { start: day, end: dayEnd });
      });
      return countTones(bucket, format(day, "EEE"));
    });
  }

  if (range === "this_month" || range === "last_month") {
    const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
    return weeks.map((weekStart, i) => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const bucket = inRange.filter((m) => {
        const d = parseProgressDate(m.created_at);
        return d && isWithinInterval(d, { start: weekStart, end: weekEnd });
      });
      return countTones(bucket, `Wk ${i + 1}`);
    });
  }

  // all time — monthly buckets for last 6 months
  const points: EmotionalBalancePoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(now, i));
    const monthEnd = endOfMonth(monthStart);
    const bucket = inRange.filter((m) => {
      const d = parseProgressDate(m.created_at);
      return d && isWithinInterval(d, { start: monthStart, end: monthEnd });
    });
    points.push(countTones(bucket, format(monthStart, "MMM")));
  }
  return points;
}

function countTones(
  rows: MoodInsightRow[],
  label: string
): EmotionalBalancePoint {
  let positive = 0;
  let neutral = 0;
  let difficult = 0;
  for (const row of rows) {
    const tone = moodTone(row.mood, row.intensity);
    if (tone === "positive") positive++;
    else if (tone === "difficult") difficult++;
    else neutral++;
  }
  return { label, positive, neutral, difficult };
}

export interface GrowthAreaRow {
  label: string;
  value: number;
  color: string;
}

export interface ProgressActivityInput {
  moods: MoodInsightRow[];
  journals: { created_at: string }[];
  sessions: { started_at?: string; ended_at?: string | null }[];
  sleep: { created_at: string; quality_rating?: number | null }[];
  wellnessCompletions: { completed_at?: string }[];
}

export function computeAreasOfGrowth(
  data: ProgressActivityInput,
  range: ProgressTimeRange,
  now = new Date(),
  /** When per-completion dates are unavailable (aggregated wellness API). */
  wellnessSessionCountOverride?: number
): GrowthAreaRow[] {
  const moods = filterByProgressRange(
    data.moods.map((m) => ({ ...m, created_at: m.created_at })),
    range,
    now
  );
  const journals = filterByProgressRange(data.journals, range, now);
  const sessions = filterByProgressRange(data.sessions, range, now).filter(
    (s) => s.ended_at
  );
  const sleep = filterByProgressRange(data.sleep, range, now);
  const wellnessCount =
    wellnessSessionCountOverride ??
    filterByProgressRange(data.wellnessCompletions, range, now).length;

  const avgMood =
    moods.length > 0
      ? moods.reduce((sum, m) => sum + (m.intensity || 0), 0) / moods.length
      : 0;
  const emotional = Math.round(Math.min(avgMood * 10, 100));

  const { start, end } = progressRangeBounds(range, now);
  const daySpan = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
  );
  const activeDays = new Set<string>();
  const markDay = (iso?: string | null) => {
    const d = parseProgressDate(iso);
    if (d) activeDays.add(format(d, "yyyy-MM-dd"));
  };
  moods.forEach((m) => markDay(m.created_at));
  journals.forEach((j) => markDay(j.created_at));
  sessions.forEach((s) => markDay(s.started_at));
  if (wellnessCount > 0) {
    markDay(end.toISOString());
  }
  const consistency = Math.round(
    Math.min(100, (activeDays.size / Math.min(daySpan, 30)) * 100)
  );

  const reflectionTarget = Math.max(2, Math.ceil(daySpan / 14));
  const reflection = Math.round(
    Math.min(100, (journals.length / reflectionTarget) * 100)
  );

  const mindfulnessTarget = Math.max(3, Math.ceil(daySpan / 10));
  const mindfulness = Math.round(
    Math.min(100, (wellnessCount / mindfulnessTarget) * 100)
  );

  const sleepRated = sleep.filter((s) => (s.quality_rating ?? 0) > 0);
  const avgSleep =
    sleepRated.length > 0
      ? sleepRated.reduce((sum, s) => sum + (s.quality_rating ?? 0), 0) /
        sleepRated.length
      : 0;
  const sleepQuality = Math.round(Math.min(avgSleep * 10, 100));

  return [
    {
      label: "Emotional Awareness",
      value: emotional,
      color: "bg-gradient-to-r from-purple-500 to-purple-400",
    },
    {
      label: "Consistency",
      value: consistency,
      color: "bg-gradient-to-r from-pink-500 to-pink-400",
    },
    {
      label: "Self Reflection",
      value: reflection,
      color: "bg-gradient-to-r from-cyan-500 to-cyan-400",
    },
    {
      label: "Mindfulness",
      value: mindfulness,
      color: "bg-gradient-to-r from-amber-500 to-amber-400",
    },
    {
      label: "Sleep Quality",
      value: sleepQuality,
      color: "bg-gradient-to-r from-green-500 to-green-400",
    },
  ];
}

export function computeGrowthScore(areas: GrowthAreaRow[]): number {
  if (areas.length === 0) return 0;
  const avg = areas.reduce((sum, a) => sum + a.value, 0) / areas.length;
  return Math.round(avg);
}

export interface JourneyMilestoneSeed {
  id: string;
  title: string;
  description: string;
  occurredAt: Date;
  pill: string;
  pillColor: string;
  tone: "milestone" | "streak" | "reflection" | "insight" | "achievement";
}

export function buildJourneyMilestoneSeeds(
  data: ProgressActivityInput & {
    currentStreak: number;
  },
  now = new Date()
): JourneyMilestoneSeed[] {
  const seeds: JourneyMilestoneSeed[] = [];

  const completedSessions = [...data.sessions]
    .filter((s) => s.ended_at && s.started_at)
    .sort(
      (a, b) =>
        (parseProgressDate(a.started_at)?.getTime() ?? 0) -
        (parseProgressDate(b.started_at)?.getTime() ?? 0)
    );
  if (completedSessions[0]?.started_at) {
    const d = parseProgressDate(completedSessions[0].started_at)!;
    seeds.push({
      id: "first-talk",
      title: "First Talk",
      description: "You took the first step and had your first conversation.",
      occurredAt: d,
      pill: "Milestone",
      pillColor: "progress-pill progress-pill--amber",
      tone: "milestone",
    });
  }

  const sortedMoods = [...data.moods].sort(
    (a, b) =>
      (parseProgressDate(a.created_at)?.getTime() ?? 0) -
      (parseProgressDate(b.created_at)?.getTime() ?? 0)
  );
  if (sortedMoods.length >= 10) {
    const tenth = sortedMoods[9];
    const d = parseProgressDate(tenth.created_at);
    if (d) {
      seeds.push({
        id: "mood-explorer",
        title: "Mood Explorer",
        description: "You completed 10 mood check-ins.",
        occurredAt: d,
        pill: "Insight",
        pillColor: "progress-pill progress-pill--pink",
        tone: "insight",
      });
    }
  }

  const sortedJournals = [...data.journals].sort(
    (a, b) =>
      (parseProgressDate(a.created_at)?.getTime() ?? 0) -
      (parseProgressDate(b.created_at)?.getTime() ?? 0)
  );
  if (sortedJournals[0]?.created_at) {
    const d = parseProgressDate(sortedJournals[0].created_at)!;
    seeds.push({
      id: "deep-reflection",
      title: "Deep Reflection",
      description: "You wrote a meaningful journal entry.",
      occurredAt: d,
      pill: "Reflection",
      pillColor: "progress-pill progress-pill--purple",
      tone: "reflection",
    });
  }

  if (data.currentStreak >= 7) {
    seeds.push({
      id: "streak-7",
      title: "7 Day Streak",
      description: "You showed up for yourself 7 days in a row.",
      occurredAt: now,
      pill: "Streak",
      pillColor: "progress-pill progress-pill--orange",
      tone: "streak",
    });
  }

  if (wellnessCount(data) >= 5 || completedSessions.length >= 3) {
    const lastActivity = latestActivityDate(data);
    seeds.push({
      id: "consistency",
      title: "Consistency King",
      description: "You've maintained your wellness habits.",
      occurredAt: lastActivity ?? now,
      pill: "Achievement",
      pillColor: "progress-pill progress-pill--green",
      tone: "achievement",
    });
  }

  return seeds.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
}

function wellnessCount(data: ProgressActivityInput): number {
  return data.wellnessCompletions.length;
}

function latestActivityDate(data: ProgressActivityInput): Date | null {
  const dates: Date[] = [];
  const push = (iso?: string | null) => {
    const d = parseProgressDate(iso);
    if (d) dates.push(d);
  };
  data.moods.forEach((m) => push(m.created_at));
  data.journals.forEach((j) => push(j.created_at));
  data.sessions.forEach((s) => push(s.started_at));
  data.wellnessCompletions.forEach((w) => push(w.completed_at));
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates.map((d) => d.getTime())));
}

export function filterMilestonesByRange(
  seeds: JourneyMilestoneSeed[],
  range: ProgressTimeRange,
  now = new Date()
): JourneyMilestoneSeed[] {
  const { start, end } = progressRangeBounds(range, now);
  return seeds.filter((s) => isWithinInterval(s.occurredAt, { start, end }));
}

export function formatMilestoneDate(date: Date): string {
  return format(date, "MMM d, yyyy");
}

/** Sparkline buckets aligned to the selected range */
export function buildRangeSparkline(
  rows: DatedRow[],
  range: ProgressTimeRange,
  bucketCount = 7,
  now = new Date()
): number[] {
  const filtered = filterByProgressRange(rows, range, now);
  if (filtered.length === 0) return Array(bucketCount).fill(0);

  const { start, end } = progressRangeBounds(range, now);
  const buckets = Array(bucketCount).fill(0);
  const span = end.getTime() - start.getTime();
  if (span <= 0) return [filtered.length, ...Array(bucketCount - 1).fill(0)];

  filtered.forEach((row) => {
    const d = rowDate(row);
    if (!d) return;
    const ratio = (d.getTime() - start.getTime()) / span;
    const idx = Math.min(bucketCount - 1, Math.max(0, Math.floor(ratio * bucketCount)));
    buckets[idx]++;
  });
  return buckets;
}
