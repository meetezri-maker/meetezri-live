import { api } from "@/lib/api";
import { getMoodDisplayInfo } from "@/app/pages/app/mood-check-in/moodDisplay";
import { insightLabelForMoodKey } from "@/app/pages/app/mood-check-in/moodCheckInData";
import {
  computeAreasOfGrowth,
  computeGrowthScore,
  moodTone,
  type MoodInsightRow,
  type MoodTone,
} from "@/app/pages/app/progress/progressInsights";
import {
  differenceInCalendarDays,
  differenceInMinutes,
  format,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";

export type CommunityShareKind =
  | "mood"
  | "journal"
  | "wellness"
  | "progress"
  | "achievement"
  | "habit"
  | "sleep"
  | "streak";

export interface CommunityShareItem {
  id: string;
  kind: CommunityShareKind;
  title: string;
  subtitle: string;
  scoreText?: string;
  contentForPost: string;
}

export interface CommunityShareProfileStats {
  streak_days?: number | null;
  stats?: {
    completed_sessions?: number | null;
    total_checkins?: number | null;
    total_journals?: number | null;
  } | null;
}

function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Sleep quality is stored as 0–100% (see sleep.schema quality_rating). */
function formatSleepQualityPercent(rating: number): string {
  const q = Math.round(Math.min(100, Math.max(0, Number(rating))));
  return `${q}%`;
}

function sleepEntryTimestamp(entry: {
  bed_time?: string;
  created_at?: string;
}): string | null {
  const raw = entry.bed_time ?? entry.created_at;
  if (!raw) return null;
  try {
    const parsed = parseISO(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return raw;
  } catch {
    return null;
  }
}

function sleepDurationHours(entry: {
  bed_time?: string;
  wake_time?: string;
  duration_hours?: number | null;
}): number | null {
  if (entry.duration_hours != null && Number.isFinite(Number(entry.duration_hours))) {
    return Math.round(Number(entry.duration_hours) * 10) / 10;
  }
  if (!entry.bed_time || !entry.wake_time) return null;
  try {
    const mins = differenceInMinutes(parseISO(entry.wake_time), parseISO(entry.bed_time));
    if (mins <= 0) return null;
    return Math.round((mins / 60) * 10) / 10;
  } catch {
    return null;
  }
}

interface MoodDaySnapshot {
  date: Date;
  mood: string;
  intensity: number;
  tone: MoodTone;
}

function normalizeMoodKey(mood: string): string {
  return mood.trim().toLowerCase();
}

/** One entry per calendar day (latest check-in that day wins). */
function buildMoodDaySnapshots(rows: MoodInsightRow[]): MoodDaySnapshot[] {
  const byDay = new Map<string, MoodDaySnapshot>();

  const sorted = [...rows].sort(
    (a, b) => parseISO(a.created_at).getTime() - parseISO(b.created_at).getTime(),
  );

  for (const row of sorted) {
    const parsed = parseISO(row.created_at);
    if (Number.isNaN(parsed.getTime())) continue;
    const day = startOfDay(parsed);
    const dayKey = format(day, "yyyy-MM-dd");
    byDay.set(dayKey, {
      date: day,
      mood: row.mood,
      intensity: row.intensity,
      tone: moodTone(row.mood, row.intensity),
    });
  }

  return [...byDay.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Longest run of consecutive calendar days matching `match`. */
function longestConsecutiveMoodDays(
  days: MoodDaySnapshot[],
  match: (d: MoodDaySnapshot) => boolean,
): number {
  const subset = days.filter(match);
  if (subset.length === 0) return 0;

  let best = 1;
  let current = 1;

  for (let i = 1; i < subset.length; i++) {
    const gap = differenceInCalendarDays(subset[i]!.date, subset[i - 1]!.date);
    if (gap === 1) {
      current += 1;
      best = Math.max(best, current);
    } else if (gap > 1) {
      current = 1;
    }
  }

  return best;
}

function longestLabeledMoodStreak(
  days: MoodDaySnapshot[],
): { days: number; label: string; emoji: string } | null {
  const keys = new Set(days.map((d) => normalizeMoodKey(d.mood)));
  let best: { days: number; label: string; emoji: string } | null = null;

  for (const key of keys) {
    const run = longestConsecutiveMoodDays(days, (d) => normalizeMoodKey(d.mood) === key);
    if (!best || run > best.days) {
      const info = getMoodDisplayInfo(key);
      best = {
        days: run,
        label: info?.label ?? insightLabelForMoodKey(key),
        emoji: info?.emoji ?? "💜",
      };
    }
  }

  return best && best.days >= 3 ? best : null;
}

const MIN_MOOD_STREAK_DAYS = 3;
const MIN_CONSISTENCY_DAYS = 7;
const CONSISTENCY_WINDOW_DAYS = 30;
const MIN_POSITIVE_SHARE_RATIO = 0.55;

function buildMoodAchievementItems(rows: MoodInsightRow[]): CommunityShareItem[] {
  const days = buildMoodDaySnapshots(rows);
  if (days.length === 0) return [];

  const items: CommunityShareItem[] = [];

  const checkInStreak = longestConsecutiveMoodDays(days, () => true);
  if (checkInStreak >= MIN_MOOD_STREAK_DAYS) {
    items.push({
      id: "mood-checkin-streak",
      kind: "mood",
      title: "Mood check-in streak",
      subtitle: "Consecutive days logged",
      scoreText: `${checkInStreak}d`,
      contentForPost: `📅 Mood streak: logged how I felt ${checkInStreak} days in a row`,
    });
  }

  const positiveStreak = longestConsecutiveMoodDays(days, (d) => d.tone === "positive");
  if (positiveStreak >= MIN_MOOD_STREAK_DAYS) {
    items.push({
      id: "mood-positive-streak",
      kind: "mood",
      title: "Positive mood streak",
      subtitle: "Consecutive uplifting days",
      scoreText: `${positiveStreak}d`,
      contentForPost: `🌟 Positive mood streak: ${positiveStreak} days in a row of uplifting check-ins`,
    });
  }

  const labeled = longestLabeledMoodStreak(days);
  if (labeled && labeled.days >= MIN_MOOD_STREAK_DAYS) {
    items.push({
      id: `mood-label-streak-${normalizeMoodKey(labeled.label)}`,
      kind: "mood",
      title: `${labeled.label} streak`,
      subtitle: "Same mood, day after day",
      scoreText: `${labeled.days}d`,
      contentForPost: `${labeled.emoji} Longest mood streak: felt ${labeled.label} for ${labeled.days} consecutive days`,
    });
  }

  const windowStart = startOfDay(subDays(new Date(), CONSISTENCY_WINDOW_DAYS));
  const windowDays = days.filter((d) => d.date >= windowStart);
  if (windowDays.length >= MIN_CONSISTENCY_DAYS) {
    const positiveCount = windowDays.filter((d) => d.tone === "positive").length;
    const ratio = positiveCount / windowDays.length;
    if (ratio >= MIN_POSITIVE_SHARE_RATIO) {
      const pct = Math.round(ratio * 100);
      items.push({
        id: "mood-emotional-consistency",
        kind: "mood",
        title: "Emotional consistency",
        subtitle: `Last ${CONSISTENCY_WINDOW_DAYS} days`,
        scoreText: `${pct}%`,
        contentForPost: `💫 Emotional consistency: positive mood on ${positiveCount} of ${windowDays.length} days (${pct}%) over the past month`,
      });
    }
  }

  return items;
}

interface LongestStreakInfo {
  days: number;
  label: string;
  source: "solace" | "habit";
}

function pickLongestStreak(
  profileStreak: number,
  habits: Array<{ name?: string; currentStreak?: number }>,
): LongestStreakInfo | null {
  let bestHabitStreak = 0;
  let bestHabitName = "Habit";
  for (const h of habits) {
    const s = Number(h.currentStreak ?? 0);
    if (s > bestHabitStreak) {
      bestHabitStreak = s;
      bestHabitName = String(h.name ?? "Habit");
    }
  }

  if (profileStreak >= bestHabitStreak && profileStreak > 0) {
    return { days: profileStreak, label: "Solace", source: "solace" };
  }
  if (bestHabitStreak > 0) {
    return { days: bestHabitStreak, label: bestHabitName, source: "habit" };
  }
  return null;
}

function buildAchievementSummary(profile: CommunityShareProfileStats): CommunityShareItem | null {
  const sessions = Number(profile.stats?.completed_sessions ?? 0);
  const moods = Number(profile.stats?.total_checkins ?? 0);
  const journals = Number(profile.stats?.total_journals ?? 0);

  const milestones: string[] = [];
  if (sessions >= 1) milestones.push("First Talk with Solace");
  if (sessions >= 10) milestones.push("10 Talk sessions");
  if (moods >= 7) milestones.push("Mood Master (7+ check-ins)");
  if (journals >= 20) milestones.push("Journaling Pro (20+ entries)");

  if (milestones.length === 0) return null;

  const content = milestones.map((m) => `• ${m}`).join("\n");
  return {
    id: "achievement-summary",
    kind: "achievement",
    title: "Achievements",
    subtitle: `${milestones.length} milestone${milestones.length === 1 ? "" : "s"} unlocked`,
    scoreText: `${milestones.length}`,
    contentForPost: `🏆 Achievements I'm proud of:\n${content}`,
  };
}

export async function fetchCommunityShareItems(
  profile: CommunityShareProfileStats | null | undefined,
): Promise<CommunityShareItem[]> {
  const items: CommunityShareItem[] = [];

  const [moodsRaw, journalsRaw, wellnessProgress, wellnessStats, habitsRaw, sleepRaw, customAchievements] =
    await Promise.all([
      api.moods.getMyMoods().catch(() => []),
      api.journal.getAll().catch(() => []),
      api.wellness.getProgress().catch(() => []),
      api.wellness.getStats().catch(() => null),
      api.habits.getAll().catch(() => []),
      api.sleep.getEntries().catch(() => []),
      api.customAchievements.list().catch(() => []),
    ]);

  const moods = (Array.isArray(moodsRaw) ? moodsRaw : [])
    .map((m: { id?: string; mood: string; intensity: number; notes?: string | null; created_at: string }) => ({
      id: String(m.id ?? m.created_at),
      mood: String(m.mood ?? ""),
      intensity: Number(m.intensity) || 5,
      notes: m.notes,
      created_at: m.created_at,
    }))
    .sort((a, b) => parseISO(b.created_at).getTime() - parseISO(a.created_at).getTime());

  const moodRows: MoodInsightRow[] = moods.map((m) => ({
    created_at: m.created_at,
    mood: m.mood,
    intensity: m.intensity,
  }));
  items.push(...buildMoodAchievementItems(moodRows));

  const journals = (Array.isArray(journalsRaw) ? journalsRaw : [])
    .filter((j: { is_private?: boolean | null }) => j.is_private !== true)
    .map(
      (j: {
        id?: string;
        title?: string | null;
        content?: string | null;
        created_at: string;
        mood_tags?: string[] | null;
      }) => ({
        id: String(j.id ?? j.created_at),
        title: j.title,
        content: j.content,
        created_at: j.created_at,
        mood_tags: j.mood_tags,
      }),
    )
    .sort((a, b) => parseISO(b.created_at).getTime() - parseISO(a.created_at).getTime());

  for (const j of journals.slice(0, 3)) {
    const plain = (j.content ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const preview = plain ? truncate(plain, 140) : "Journal reflection";
    const title = j.title?.trim() || "Journal entry";
    let when = "";
    try {
      when = format(parseISO(j.created_at), "MMM d");
    } catch {
      /* ignore */
    }
    items.push({
      id: `journal-${j.id}`,
      kind: "journal",
      title,
      subtitle: when || "Journal",
      contentForPost: `📔 Journal: ${title}\n"${preview}"`,
    });
  }

  const journalRows = journals.map((j) => ({ created_at: j.created_at }));
  const sleepRows = (Array.isArray(sleepRaw) ? sleepRaw : []).map(
    (s: { bed_time?: string; created_at?: string; quality_rating?: number | null }) => {
      const ts = sleepEntryTimestamp(s);
      return {
        created_at: ts ?? "",
        quality_rating: s.quality_rating,
      };
    },
  );

  const progressList = Array.isArray(wellnessProgress) ? wellnessProgress : [];
  const totalWellnessSessions = progressList.reduce(
    (sum: number, row: { sessionsCompleted?: number }) => sum + Number(row?.sessionsCompleted ?? 0),
    0,
  );

  const wellnessCompletions = progressList.flatMap((row: { sessionsCompleted?: number; lastCompletedAt?: string }) => {
    const n = Number(row?.sessionsCompleted ?? 0);
    if (n <= 0) return [];
    return [{ completed_at: row.lastCompletedAt ?? new Date().toISOString() }];
  });

  const areas = computeAreasOfGrowth(
    {
      moods: moodRows,
      journals: journalRows,
      sessions: [],
      sleep: sleepRows,
      wellnessCompletions,
    },
    "this_month",
    new Date(),
    totalWellnessSessions,
  );
  const growthScore = computeGrowthScore(areas);

  if (growthScore > 0 || areas.some((a) => a.value > 0)) {
    const areaLines = areas
      .filter((a) => a.value > 0)
      .map((a) => `• ${a.label}: ${a.value}%`)
      .join("\n");
    items.push({
      id: "progress-growth",
      kind: "progress",
      title: "Growth score",
      subtitle: "This month",
      scoreText: `${growthScore}%`,
      contentForPost: `📈 My growth score this month: ${growthScore}/100\n${areaLines}`,
    });
  }

  if (totalWellnessSessions > 0) {
    items.push({
      id: "wellness-sessions",
      kind: "wellness",
      title: "Wellness tools",
      subtitle: "Sessions completed",
      scoreText: String(totalWellnessSessions),
      contentForPost: `🧘 Wellness: ${totalWellnessSessions} guided session${totalWellnessSessions === 1 ? "" : "s"} completed`,
    });
  }

  const topTools = [...progressList]
    .filter((row: { sessionsCompleted?: number }) => Number(row?.sessionsCompleted) > 0)
    .sort((a, b) => Number(b.sessionsCompleted) - Number(a.sessionsCompleted))
    .slice(0, 3);

  for (const row of topTools) {
    const name = String(row.toolTitle ?? row.toolName ?? row.name ?? "Wellness tool");
    const count = Number(row.sessionsCompleted ?? 0);
    items.push({
      id: `wellness-tool-${String(row.toolId ?? row.id ?? name)}`,
      kind: "wellness",
      title: name,
      subtitle: "Tool progress",
      scoreText: `${count}`,
      contentForPost: `✨ Wellness — ${name}: ${count} session${count === 1 ? "" : "s"} completed`,
    });
  }

  const statsPayload = wellnessStats as { wellnessScore?: { subject: string; A: number }[] } | null;
  if (Array.isArray(statsPayload?.wellnessScore) && statsPayload.wellnessScore.length > 0) {
    const top = [...statsPayload.wellnessScore].sort((a, b) => Number(b.A) - Number(a.A))[0];
    if (top && Number(top.A) > 0) {
      items.push({
        id: "wellness-focus",
        kind: "wellness",
        title: String(top.subject),
        subtitle: "Strongest wellness area",
        scoreText: `${Math.round(Number(top.A))}%`,
        contentForPost: `💜 Wellness focus: ${top.subject} — ${Math.round(Number(top.A))}%`,
      });
    }
  }

  const habits = Array.isArray(habitsRaw) ? habitsRaw : [];

  const sleepList = (Array.isArray(sleepRaw) ? sleepRaw : [])
    .map(
      (s: {
        bed_time?: string;
        wake_time?: string;
        created_at?: string;
        quality_rating?: number | null;
        duration_hours?: number | null;
      }) => ({
        ...s,
        sortTime: sleepEntryTimestamp(s),
      }),
    )
    .filter((s) => s.sortTime != null)
    .sort((a, b) => parseISO(b.sortTime!).getTime() - parseISO(a.sortTime!).getTime());

  const latestSleep = sleepList[0];
  if (latestSleep && latestSleep.quality_rating != null) {
    const q = Number(latestSleep.quality_rating);
    const qualityLabel = formatSleepQualityPercent(q);
    const hours = sleepDurationHours(latestSleep);
    let when = "";
    try {
      when = format(parseISO(latestSleep.sortTime!), "MMM d");
    } catch {
      /* ignore */
    }
    const durationPart = hours != null ? `${hours}h sleep · ` : "";
    items.push({
      id: `sleep-${latestSleep.sortTime}`,
      kind: "sleep",
      title: "Sleep log",
      subtitle: when || "Latest",
      scoreText: hours != null ? `${hours}h · ${qualityLabel}` : qualityLabel,
      contentForPost: `🌙 Sleep${when ? ` (${when})` : ""}: ${durationPart}quality ${qualityLabel}`,
    });
  }

  const longestStreak = pickLongestStreak(Number(profile?.streak_days ?? 0), habits);
  if (longestStreak) {
    const { days, label, source } = longestStreak;
    items.push({
      id: "longest-streak",
      kind: source === "habit" ? "habit" : "streak",
      title: source === "habit" ? label : "Longest streak",
      subtitle: source === "habit" ? "Best habit streak" : "Solace daily streak",
      scoreText: `${days}d`,
      contentForPost:
        source === "habit"
          ? `🔥 Longest streak: ${days} days on "${label}"`
          : `🔥 Longest streak: ${days} days on Solace`,
    });
  }

  const achievementItem = buildAchievementSummary(profile ?? {});
  if (achievementItem) items.push(achievementItem);

  const unlockedCustom = (Array.isArray(customAchievements) ? customAchievements : []).filter(
    (a: { unlocked?: boolean; progress?: number; total?: number; title?: string }) =>
      a.unlocked === true || Number(a.progress) >= Number(a.total),
  );
  for (const a of unlockedCustom.slice(0, 5)) {
    const title = String(a.title ?? "Personal goal");
    items.push({
      id: `custom-ach-${String(a.id)}`,
      kind: "achievement",
      title,
      subtitle: "Personal achievement",
      contentForPost: `🏅 Achievement unlocked: ${title}`,
    });
  }

  return items;
}

export function composeCommunitySharePost(
  items: CommunityShareItem[],
  selectedIds: string[],
  optionalNote?: string,
): string {
  const selected = items.filter((item) => selectedIds.includes(item.id));
  if (selected.length === 0) return "";

  const lines = ["Sharing from my Solace journey:", "", ...selected.map((item) => item.contentForPost)];
  const note = optionalNote?.trim();
  if (note) {
    lines.push("", note);
  }
  return lines.join("\n");
}
