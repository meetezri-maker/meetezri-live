/**
 * Progress Report data service — read-only. Aggregates a single authenticated
 * user's Goals + Personal Achievements into the versioned ProgressReport model.
 *
 * Guarantees:
 *  - Every query is scoped by the authenticated user_id (no cross-user joins).
 *  - No writes are performed anywhere in report generation.
 *  - Goal history comes from goal_check_ins; achievement history from
 *    achievement_check_ins. These never overlap (an achievement check-in never
 *    writes a goal row — see the sync_with_goals verification), so a single user
 *    action is counted exactly once.
 *  - Reward amounts come from the point_transactions ledger, never derived.
 */
import prisma from "../../lib/prisma";
import { getUserPointsSummary } from "../gamification/points.service";
import { POINTS_PER_LEVEL } from "../gamification/level.service";
import { computeNumericProgress } from "../gamification/progress.service";
import { POINT_SOURCE_TYPES } from "../gamification/rewards.constants";
import {
  APPROACHING_TARGET_DAYS,
  NO_RECENT_CHECKIN_THRESHOLD_DAYS,
  PROGRESS_REPORT_VERSION,
  RANGE_DAYS,
  RANGE_LABELS,
  type CheckInFrequency,
  type ProgressReportRange,
} from "./progress-report.constants";
import type {
  ProgressReport,
  ProgressReportAttentionItem,
  ProgressReportAttentionReason,
  ProgressReportCompletion,
  ProgressReportItemBase,
  ProgressReportItemType,
  ProgressReportTextEntry,
  ProgressReportTrackingType,
} from "./progress-report.types";
import {
  addCalendarDays,
  consistencyRate,
  dateOnlyToYmd,
  diffCalendarDays,
  expectedCheckIns,
  inclusiveDayCount,
  isWithinRange,
  maxYmd,
  minYmd,
  normalizeFrequency,
  parseYmd,
  pluralize,
  timestampToCalendarDate,
  todayInTimezone,
} from "./progress-report.utils";

// ---------------------------------------------------------------------------
// Internal normalized shapes
// ---------------------------------------------------------------------------

interface NormalizedCheckIn {
  itemId: string;
  itemType: ProgressReportItemType;
  dateStr: string; // user calendar day (YYYY-MM-DD)
  createdAt: Date;
  progressAfter: number;
  wins: string | null;
  challenges: string | null;
  reflection: string | null;
  notes: string | null; // goal notes OR achievement note (neutral)
  mood: string | null;
}

/** A fully-built active item plus internal aggregation fields (never serialized). */
interface BuiltItem {
  item: ProgressReportItemBase;
  itemType: ProgressReportItemType;
  /** Fixed-frequency actual check-ins in the active window (0 for custom). */
  actual: number;
  /** Fixed-frequency expected check-ins (null for custom). */
  expected: number | null;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const clampPct = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));
const text = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
};

function isNumericTracking(t: ProgressReportTrackingType): boolean {
  return t === "count" || t === "duration" || t === "amount";
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function generateProgressReport(
  userId: string,
  range: ProgressReportRange,
  now: Date = new Date()
): Promise<ProgressReport> {
  // All reads are strictly scoped to `userId`.
  const [profile, goals, achievements, goalCheckIns, achCheckIns, transactions, pointsSummary] =
    await Promise.all([
      prisma.profiles.findUnique({ where: { id: userId }, select: { timezone: true, full_name: true } }),
      prisma.personal_goals.findMany({ where: { user_id: userId } }),
      prisma.custom_achievements.findMany({ where: { user_id: userId } }),
      prisma.goal_check_ins.findMany({ where: { user_id: userId } }),
      prisma.achievement_check_ins.findMany({ where: { user_id: userId } }),
      prisma.point_transactions.findMany({ where: { user_id: userId } }),
      getUserPointsSummary(userId),
    ]);

  const timezone = profile?.timezone ?? "UTC";
  const end = todayInTimezone(timezone, now); // inclusive period end = user's current calendar date
  const start = range === "all" ? null : addCalendarDays(end, -(RANGE_DAYS[range] - 1));

  // ---- Normalize + index check-ins by item ------------------------------
  const goalCheckInsByItem = new Map<string, NormalizedCheckIn[]>();
  for (const row of goalCheckIns) {
    pushCheckIn(goalCheckInsByItem, {
      itemId: String(row.goal_id),
      itemType: "goal",
      dateStr: row.check_in_date
        ? dateOnlyToYmd(row.check_in_date)
        : timestampToCalendarDate(timezone, row.created_at),
      createdAt: row.created_at,
      progressAfter: row.progress_after != null ? row.progress_after : num(row.progress_percentage),
      wins: text(row.wins),
      challenges: text(row.challenges_faced),
      reflection: text(row.reflection),
      notes: text(row.notes),
      mood: text(row.mood),
    });
  }

  const achCheckInsByItem = new Map<string, NormalizedCheckIn[]>();
  for (const row of achCheckIns) {
    pushCheckIn(achCheckInsByItem, {
      itemId: String(row.achievement_id),
      itemType: "achievement",
      dateStr: dateOnlyToYmd(row.check_in_date),
      createdAt: row.created_at,
      progressAfter: row.progress_after != null ? row.progress_after : 0,
      wins: null,
      challenges: null,
      reflection: null,
      notes: text(row.note), // achievement notes stay NEUTRAL (never wins/challenges)
      mood: null,
    });
  }

  // ---- Ledger: item -> awarded points, plus in-period transactions -------
  const awardedByItem = new Map<string, number>();
  for (const t of transactions) {
    if (
      t.source_type === POINT_SOURCE_TYPES.PERSONAL_GOAL_COMPLETION ||
      t.source_type === POINT_SOURCE_TYPES.PERSONAL_ACHIEVEMENT_COMPLETION
    ) {
      awardedByItem.set(String(t.source_item_id), num(t.points));
    }
  }

  const rewardTransactions = transactions
    .map((t) => ({
      id: String(t.id),
      sourceType: String(t.source_type),
      sourceItemId: String(t.source_item_id),
      points: num(t.points),
      reason: text(t.reason),
      createdAt: new Date(t.created_at).toISOString(),
      date: timestampToCalendarDate(timezone, t.created_at),
    }))
    .filter((t) => isWithinRange(t.date, start, end))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  const pointsEarned = rewardTransactions.reduce((sum, t) => sum + t.points, 0);

  // ---- Build report items + collect cross-cutting data ------------------
  const consistencyAcc = { actual: 0, expected: 0 }; // fixed-frequency totals only
  const attention: ProgressReportAttentionItem[] = [];
  const wins: ProgressReportTextEntry[] = [];
  const challenges: ProgressReportTextEntry[] = [];
  const reflections: ProgressReportTextEntry[] = [];
  const notes: ProgressReportTextEntry[] = [];
  const moodCounts = new Map<string, number>();
  const periodActiveDays = new Set<string>();
  let periodTotalCheckIns = 0;
  let totalProgressChange = 0;

  const activeBuilt: BuiltItem[] = [];

  const collectText = (ci: NormalizedCheckIn, itemTitle: string): void => {
    if (!isWithinRange(ci.dateStr, start, end)) return;
    const base = { date: ci.dateStr, itemId: ci.itemId, itemType: ci.itemType, itemTitle };
    if (ci.wins) wins.push({ text: ci.wins, ...base });
    if (ci.challenges) challenges.push({ text: ci.challenges, ...base });
    if (ci.reflection) reflections.push({ text: ci.reflection, ...base });
    if (ci.notes) notes.push({ text: ci.notes, ...base });
    if (ci.mood) moodCounts.set(ci.mood, (moodCounts.get(ci.mood) ?? 0) + 1);
  };

  // --- Goals ---
  for (const g of goals) {
    const id = String(g.id);
    const status = String(g.status ?? "not_started");
    const trackingType = String(g.tracking_type ?? "manual_milestone") as ProgressReportTrackingType;
    const isNumeric = isNumericTracking(trackingType);
    const frequency = normalizeFrequency(g.check_in_frequency);
    const cis = goalCheckInsByItem.get(id) ?? [];

    for (const ci of cis) collectText(ci, String(g.goal_title ?? ""));
    periodTotalCheckIns += tallyPeriodCheckIns(cis, start, end, periodActiveDays);

    const active = status !== "completed" && status !== "archived";
    if (!active) continue;

    const built = buildItem({
      id,
      itemType: "goal",
      title: String(g.goal_title ?? ""),
      category: text(g.goal_category),
      status,
      priority: text(g.priority_level),
      trackingType,
      trackingUnit: isNumeric ? text(g.tracking_unit) : null,
      currentValue: isNumeric ? num(g.current_value) : null,
      targetValue: isNumeric && g.target_value != null ? num(g.target_value) : null,
      currentProgress: clampPct(num(g.progress_percentage)),
      startDate: parseYmd(g.start_date),
      targetDate: parseYmd(g.target_date),
      rewardAwarded: Boolean(g.reward_awarded),
      frequency,
      checkIns: cis,
      itemCreatedDate: timestampToCalendarDate(timezone, g.created_at),
      start,
      end,
      today: end,
    });
    accumulate(built, consistencyAcc, attention);
    totalProgressChange += built.item.progressChange;
    activeBuilt.push(built);
  }

  // --- Achievements (custom only; predefined are never in custom_achievements) ---
  for (const a of achievements) {
    const id = String(a.id);
    const trackingType = String(a.tracking_type ?? "count") as ProgressReportTrackingType;
    const isNumeric = isNumericTracking(trackingType);
    const isManual = trackingType === "manual_milestone";
    const total = num(a.total);
    const rawProgress = num(a.progress);
    const frequency = normalizeFrequency(a.check_in_frequency);
    const cis = achCheckInsByItem.get(id) ?? [];

    for (const ci of cis) collectText(ci, String(a.title ?? ""));
    periodTotalCheckIns += tallyPeriodCheckIns(cis, start, end, periodActiveDays);

    const active = !a.unlocked;
    if (!active) continue;

    // Numeric achievements store `progress` as the raw current value; manual
    // achievements store `progress` as the 0..100 percentage.
    const currentProgress = isManual
      ? clampPct(rawProgress)
      : total > 0
        ? computeNumericProgress(rawProgress, total)
        : 0;

    const built = buildItem({
      id,
      itemType: "achievement",
      title: String(a.title ?? ""),
      category: text(a.goal_category) ?? text(a.category),
      status: currentProgress > 0 ? "active" : "not_started",
      priority: text(a.priority),
      trackingType,
      trackingUnit: isNumeric ? text(a.tracking_unit) : null,
      currentValue: isNumeric ? rawProgress : null,
      targetValue: isNumeric ? total : null,
      currentProgress,
      startDate: parseYmd(a.start_date),
      targetDate: parseYmd(a.target_date),
      rewardAwarded: Boolean(a.reward_awarded),
      frequency,
      checkIns: cis,
      itemCreatedDate: timestampToCalendarDate(timezone, a.created_at),
      start,
      end,
      today: end,
    });
    accumulate(built, consistencyAcc, attention);
    totalProgressChange += built.item.progressChange;
    activeBuilt.push(built);
  }

  const activeGoalItems = activeBuilt.filter((b) => b.itemType === "goal").map((b) => b.item);
  const activeAchievementItems = activeBuilt.filter((b) => b.itemType === "achievement").map((b) => b.item);

  // ---- Completed during the period (from completed_at only) --------------
  const completedDuringPeriod: ProgressReportCompletion[] = [];
  let completedGoalsInPeriod = 0;
  let completedAchievementsInPeriod = 0;

  for (const g of goals) {
    if (!g.completed_at) continue;
    const day = timestampToCalendarDate(timezone, g.completed_at);
    if (!isWithinRange(day, start, end)) continue;
    completedGoalsInPeriod += 1;
    const trackingType = String(g.tracking_type ?? "manual_milestone") as ProgressReportTrackingType;
    const isNumeric = isNumericTracking(trackingType);
    completedDuringPeriod.push({
      itemType: "goal",
      itemId: String(g.id),
      title: String(g.goal_title ?? ""),
      completedAt: day,
      rewardPointsAwarded: awardedByItem.get(String(g.id)) ?? 0,
      trackingType,
      finalCurrentValue: isNumeric ? num(g.current_value) : null,
      finalTargetValue: isNumeric && g.target_value != null ? num(g.target_value) : null,
    });
  }
  for (const a of achievements) {
    if (!a.completed_at) continue;
    const day = timestampToCalendarDate(timezone, a.completed_at);
    if (!isWithinRange(day, start, end)) continue;
    completedAchievementsInPeriod += 1;
    const trackingType = String(a.tracking_type ?? "count") as ProgressReportTrackingType;
    const isNumeric = isNumericTracking(trackingType);
    completedDuringPeriod.push({
      itemType: "achievement",
      itemId: String(a.id),
      title: String(a.title ?? ""),
      completedAt: day,
      rewardPointsAwarded: awardedByItem.get(String(a.id)) ?? 0,
      trackingType,
      finalCurrentValue: isNumeric ? num(a.progress) : null,
      finalTargetValue: isNumeric ? num(a.total) : null,
    });
  }
  completedDuringPeriod.sort((x, y) =>
    x.completedAt < y.completedAt ? 1 : x.completedAt > y.completedAt ? -1 : 0
  );

  // ---- Snapshot counts --------------------------------------------------
  const completedGoalsAllTime = goals.filter((g) => String(g.status) === "completed").length;
  const completedAchievementsAllTime = achievements.filter((a) => Boolean(a.unlocked)).length;

  // ---- Overall consistency (totals, never averaged item percentages) ----
  const overallConsistencyRate =
    consistencyAcc.expected > 0
      ? Math.min(100, Math.round((consistencyAcc.actual / consistencyAcc.expected) * 100))
      : null;

  // ---- Most consistent item (fixed-frequency only) ----------------------
  let mostConsistentItem: ProgressReport["checkInActivity"]["mostConsistentItem"] = null;
  for (const b of activeBuilt) {
    const rate = b.item.consistencyRate;
    if (rate == null) continue;
    if (mostConsistentItem == null || rate > mostConsistentItem.rate) {
      mostConsistentItem = { itemType: b.itemType, itemId: b.item.id, title: b.item.title, rate };
    }
  }

  // ---- Mood counts (deterministic, label -> count) ----------------------
  const moodCountsArr = [...moodCounts.entries()]
    .map(([mood, count]) => ({ mood, count }))
    .sort((a, b) => b.count - a.count || (a.mood < b.mood ? -1 : 1));

  const totalCheckIns = periodTotalCheckIns;
  const activeCheckInDays = periodActiveDays.size;

  const closingSummary = buildClosingSummary({
    completedGoals: completedGoalsInPeriod,
    completedAchievements: completedAchievementsInPeriod,
    activeCheckInDays,
    pointsEarned,
    totalProgressChange,
  });

  return {
    version: PROGRESS_REPORT_VERSION,
    generatedAt: now.toISOString(),
    timezone,
    period: { range, start, end, label: RANGE_LABELS[range] },
    user: { displayName: profile?.full_name ?? null },
    currentSnapshot: {
      totalPoints: pointsSummary.totalPoints,
      currentLevel: pointsSummary.level,
      pointsIntoLevel: pointsSummary.pointsWithinLevel,
      pointsRequiredForNextLevel: POINTS_PER_LEVEL,
      pointsRemainingToNextLevel: pointsSummary.pointsToNextLevel,
      activeGoals: activeGoalItems.length,
      activeAchievements: activeAchievementItems.length,
      completedGoalsAllTime,
      completedAchievementsAllTime,
    },
    periodSummary: {
      completedGoals: completedGoalsInPeriod,
      completedAchievements: completedAchievementsInPeriod,
      totalCheckIns,
      activeCheckInDays,
      overallConsistencyRate,
      pointsEarned,
      totalProgressChange,
    },
    activeGoals: activeGoalItems,
    activeAchievements: activeAchievementItems,
    completedDuringPeriod,
    checkInActivity: { totalCheckIns, activeDays: activeCheckInDays, mostConsistentItem },
    wellbeingEntries: { wins, challenges, reflections, notes, moodCounts: moodCountsArr },
    needsAttention: attention,
    rewards: { pointsEarned, transactions: rewardTransactions },
    closingSummary,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pushCheckIn(map: Map<string, NormalizedCheckIn[]>, ci: NormalizedCheckIn): void {
  const arr = map.get(ci.itemId);
  if (arr) arr.push(ci);
  else map.set(ci.itemId, [ci]);
}

function sortAsc(cis: NormalizedCheckIn[]): NormalizedCheckIn[] {
  return [...cis].sort((a, b) => {
    if (a.dateStr !== b.dateStr) return a.dateStr < b.dateStr ? -1 : 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

/** Count in-period check-ins for one item, adding distinct days to `periodDays`. */
function tallyPeriodCheckIns(
  cis: NormalizedCheckIn[],
  start: string | null,
  end: string,
  periodDays: Set<string>
): number {
  let count = 0;
  for (const ci of cis) {
    if (isWithinRange(ci.dateStr, start, end)) {
      count += 1;
      periodDays.add(ci.dateStr);
    }
  }
  return count;
}

interface BuildItemParams {
  id: string;
  itemType: ProgressReportItemType;
  title: string;
  category: string | null;
  status: string;
  priority: string | null;
  trackingType: ProgressReportTrackingType;
  trackingUnit: string | null;
  currentValue: number | null;
  targetValue: number | null;
  currentProgress: number;
  startDate: string | null;
  targetDate: string | null;
  rewardAwarded: boolean;
  frequency: CheckInFrequency;
  checkIns: NormalizedCheckIn[];
  itemCreatedDate: string;
  start: string | null;
  end: string;
  today: string;
}

function buildItem(p: BuildItemParams): BuiltItem {
  const sorted = sortAsc(p.checkIns);

  // Progress history (Phase 5). Never uses the live current-progress field.
  let progressAtStart = 0;
  let progressAtEnd: number | null = null;
  for (const ci of sorted) {
    if (p.start !== null && ci.dateStr < p.start) progressAtStart = ci.progressAfter;
    if (ci.dateStr <= p.end) progressAtEnd = ci.progressAfter;
  }
  if (progressAtEnd === null) progressAtEnd = progressAtStart;
  const progressChange = progressAtEnd - progressAtStart;

  // Period check-in counts + distinct active days.
  const periodDates = new Set<string>();
  for (const ci of sorted) if (isWithinRange(ci.dateStr, p.start, p.end)) periodDates.add(ci.dateStr);
  const checkInsDuringPeriod = sorted.filter((ci) => isWithinRange(ci.dateStr, p.start, p.end)).length;

  // Consistency (Phase 8): active window = max(created, periodStart)..min(today, periodEnd).
  const activeWindowStart = p.start === null ? p.itemCreatedDate : maxYmd(p.itemCreatedDate, p.start);
  const activeWindowEnd = minYmd(p.today, p.end);
  const activeWindowDays =
    activeWindowStart > activeWindowEnd ? 0 : inclusiveDayCount(activeWindowStart, activeWindowEnd);
  const actualInWindow = new Set(
    sorted
      .filter((ci) => ci.dateStr >= activeWindowStart && ci.dateStr <= activeWindowEnd)
      .map((ci) => ci.dateStr)
  ).size;
  const expected = expectedCheckIns(p.frequency, activeWindowDays);
  const rate = consistencyRate(actualInWindow, expected);

  // Latest real check-in (for "no recent check-ins"); creation date if never.
  const lastCheckInDate = sorted.length ? sorted[sorted.length - 1].dateStr : null;
  const referenceDate = lastCheckInDate ?? p.itemCreatedDate;
  const daysSinceCheckIn = diffCalendarDays(referenceDate, p.today);
  const hasNoRecentCheckIns = daysSinceCheckIn > NO_RECENT_CHECKIN_THRESHOLD_DAYS[p.frequency];

  // Target-date flags (Phase 11). Blank/invalid target => not flagged.
  const belowComplete = p.currentProgress < 100;
  const isOverdue = p.targetDate !== null && p.targetDate < p.today && belowComplete;
  const approachingEnd = addCalendarDays(p.today, APPROACHING_TARGET_DAYS);
  const isApproachingTarget =
    p.targetDate !== null && p.targetDate >= p.today && p.targetDate <= approachingEnd && belowComplete;
  const hasNoProgressDuringPeriod = progressChange === 0;

  const item: ProgressReportItemBase = {
    id: p.id,
    title: p.title,
    category: p.category,
    status: p.status,
    priority: p.priority,
    trackingType: p.trackingType,
    trackingUnit: p.trackingUnit,
    currentValue: p.currentValue,
    targetValue: p.targetValue,
    currentProgress: p.currentProgress,
    progressAtStart,
    progressAtEnd,
    progressChange,
    checkInsDuringPeriod,
    activeCheckInDays: periodDates.size,
    consistencyRate: rate,
    startDate: p.startDate,
    targetDate: p.targetDate,
    isOverdue,
    isApproachingTarget,
    hasNoRecentCheckIns,
    hasNoProgressDuringPeriod,
    rewardAwarded: p.rewardAwarded,
  };

  return { item, itemType: p.itemType, actual: actualInWindow, expected };
}

/** Fold an item into the fixed-frequency consistency totals + attention list. */
function accumulate(
  built: BuiltItem,
  acc: { actual: number; expected: number },
  attention: ProgressReportAttentionItem[]
): void {
  if (built.expected != null) {
    acc.actual += built.actual;
    acc.expected += built.expected;
  }

  const { item } = built;
  const reasons: ProgressReportAttentionReason[] = [];
  if (item.isOverdue) reasons.push("overdue");
  if (item.isApproachingTarget) reasons.push("approaching_target");
  if (item.hasNoRecentCheckIns) reasons.push("no_recent_check_ins");
  if (item.hasNoProgressDuringPeriod) reasons.push("no_progress_during_period");
  if (reasons.length > 0) {
    attention.push({ itemType: built.itemType, itemId: item.id, title: item.title, reasons });
  }
}

function buildClosingSummary(input: {
  completedGoals: number;
  completedAchievements: number;
  activeCheckInDays: number;
  pointsEarned: number;
  totalProgressChange: number;
}): string[] {
  const lines: string[] = [];
  if (input.completedGoals > 0) {
    lines.push(
      `You completed ${input.completedGoals} ${pluralize(input.completedGoals, "Goal")} during this reporting period.`
    );
  }
  if (input.completedAchievements > 0) {
    lines.push(
      `You completed ${input.completedAchievements} Personal ${pluralize(input.completedAchievements, "Achievement")}.`
    );
  }
  if (input.activeCheckInDays > 0) {
    lines.push(
      `You checked in on ${input.activeCheckInDays} different ${pluralize(input.activeCheckInDays, "day")}.`
    );
  }
  if (input.pointsEarned > 0) {
    lines.push(`You earned ${input.pointsEarned} ${pluralize(input.pointsEarned, "point")}.`);
  }
  if (input.totalProgressChange > 0) {
    lines.push(
      `Your tracked progress increased by ${input.totalProgressChange} percentage ${pluralize(input.totalProgressChange, "point")}.`
    );
  } else if (input.totalProgressChange < 0) {
    const drop = Math.abs(input.totalProgressChange);
    lines.push(`Your tracked progress decreased by ${drop} percentage ${pluralize(drop, "point")}.`);
  }
  if (lines.length === 0) {
    lines.push("No tracked progress activity in this period.");
  }
  return lines;
}
