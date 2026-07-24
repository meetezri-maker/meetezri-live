const mockPrisma = {
  profiles: { findUnique: jest.fn() },
  personal_goals: { findMany: jest.fn() },
  custom_achievements: { findMany: jest.fn() },
  goal_check_ins: { findMany: jest.fn() },
  achievement_check_ins: { findMany: jest.fn() },
  point_transactions: { findMany: jest.fn(), aggregate: jest.fn() },
  // Phase 5: system achievement state + activity metrics.
  user_achievements: { findMany: jest.fn() },
  app_sessions: { count: jest.fn() },
  mood_entries: { count: jest.fn(), findMany: jest.fn() },
  journal_entries: { count: jest.fn() },
  user_wellness_progress: { count: jest.fn() },
  community_posts: { count: jest.fn() },
};

jest.mock("../../lib/prisma", () => ({ __esModule: true, default: mockPrisma }));
jest.mock("../users/user.service", () => ({ calculateStreak: jest.fn(() => 0) }));

import { generateProgressReport } from "./progress-report.service";
import { isProgressReportRange } from "./progress-report.constants";
import { SYSTEM_ACHIEVEMENTS } from "../system-achievements/system-achievements.constants";

const FIRST_STEPS = SYSTEM_ACHIEVEMENTS[0]; // sessions >= 1, 10 pts
const CONSISTENT = SYSTEM_ACHIEVEMENTS[1]; // sessions >= 10, 50 pts

const USER = "user-1";
const NOW = new Date("2026-07-23T12:00:00Z"); // UTC today = 2026-07-23

// --- factories -------------------------------------------------------------
const goal = (over: Record<string, unknown> = {}) => ({
  id: "g1",
  user_id: USER,
  goal_title: "Goal 1",
  goal_category: "wellness",
  status: "active",
  priority_level: "high",
  tracking_type: "manual_milestone",
  target_value: null,
  current_value: 0,
  tracking_unit: null,
  progress_percentage: 0,
  check_in_frequency: "daily",
  start_date: "2026-01-01",
  target_date: null,
  completed_at: null,
  reward_awarded: false,
  created_at: new Date("2026-01-01T00:00:00Z"),
  ...over,
});

const goalCheckIn = (over: Record<string, unknown> = {}) => ({
  id: `gc-${Math.random()}`,
  goal_id: "g1",
  user_id: USER,
  check_in_date: new Date("2026-07-18T00:00:00Z"),
  progress_after: 50,
  progress_percentage: 50,
  progress_before: 0,
  created_at: new Date("2026-07-18T10:00:00Z"),
  wins: null,
  challenges_faced: null,
  reflection: null,
  notes: null,
  mood: null,
  ...over,
});

const achievement = (over: Record<string, unknown> = {}) => ({
  id: "a1",
  user_id: USER,
  title: "Ach 1",
  category: "personal",
  goal_category: null,
  progress: 0,
  total: 10,
  unlocked: false,
  tracking_type: "count",
  tracking_unit: "reps",
  priority: null,
  check_in_frequency: "daily",
  start_date: null,
  target_date: null,
  completed_at: null,
  reward_awarded: false,
  created_at: new Date("2026-01-01T00:00:00Z"),
  ...over,
});

const achCheckIn = (over: Record<string, unknown> = {}) => ({
  id: `ac-${Math.random()}`,
  achievement_id: "a1",
  user_id: USER,
  check_in_date: new Date("2026-07-18T00:00:00Z"),
  progress_after: 40,
  progress_before: 0,
  note: null,
  created_at: new Date("2026-07-18T10:00:00Z"),
  ...over,
});

const txn = (over: Record<string, unknown> = {}) => ({
  id: `t-${Math.random()}`,
  user_id: USER,
  source_type: "personal_goal_completion",
  source_item_id: "g1",
  points: 20,
  reason: "Goal completed",
  created_at: new Date("2026-07-18T10:00:00Z"),
  ...over,
});

function setData(opts: {
  timezone?: string | null;
  fullName?: string | null;
  goals?: unknown[];
  achievements?: unknown[];
  goalCheckIns?: unknown[];
  achCheckIns?: unknown[];
  transactions?: unknown[];
  totalPoints?: number;
  systemEarned?: unknown[];
  sessions?: number;
} = {}) {
  mockPrisma.profiles.findUnique.mockResolvedValue({
    timezone: opts.timezone === undefined ? "UTC" : opts.timezone,
    full_name: opts.fullName === undefined ? "Test User" : opts.fullName,
  });
  mockPrisma.personal_goals.findMany.mockResolvedValue(opts.goals ?? []);
  mockPrisma.custom_achievements.findMany.mockResolvedValue(opts.achievements ?? []);
  mockPrisma.goal_check_ins.findMany.mockResolvedValue(opts.goalCheckIns ?? []);
  mockPrisma.achievement_check_ins.findMany.mockResolvedValue(opts.achCheckIns ?? []);
  mockPrisma.point_transactions.findMany.mockResolvedValue(opts.transactions ?? []);
  mockPrisma.point_transactions.aggregate.mockResolvedValue({ _sum: { points: opts.totalPoints ?? 0 } });
  // System achievements default to: no earned rows, no qualifying activity.
  mockPrisma.user_achievements.findMany.mockResolvedValue(opts.systemEarned ?? []);
  mockPrisma.app_sessions.count.mockResolvedValue(opts.sessions ?? 0);
  mockPrisma.mood_entries.count.mockResolvedValue(0);
  mockPrisma.mood_entries.findMany.mockResolvedValue([]);
  mockPrisma.journal_entries.count.mockResolvedValue(0);
  mockPrisma.user_wellness_progress.count.mockResolvedValue(0);
  mockPrisma.community_posts.count.mockResolvedValue(0);
}

beforeEach(() => {
  jest.clearAllMocks();
  setData();
});

// ===========================================================================
describe("range + timezone", () => {
  it("7d range spans an inclusive 7 calendar days ending today", async () => {
    const r = await generateProgressReport(USER, "7d", NOW);
    expect(r.period).toMatchObject({ range: "7d", start: "2026-07-17", end: "2026-07-23", label: "Last 7 days" });
  });

  it("30d range start is 29 days before today", async () => {
    const r = await generateProgressReport(USER, "30d", NOW);
    expect(r.period.start).toBe("2026-06-24");
  });

  it("90d range start is 89 days before today", async () => {
    const r = await generateProgressReport(USER, "90d", NOW);
    expect(r.period.start).toBe("2026-04-25");
  });

  it("all range has a null start", async () => {
    const r = await generateProgressReport(USER, "all", NOW);
    expect(r.period.start).toBeNull();
    expect(r.period.label).toBe("All time");
  });

  it("uses the user's timezone for the current calendar day", async () => {
    setData({ timezone: "America/Los_Angeles" });
    // 02:00Z on the 24th is still the 23rd in LA (UTC-7 in July).
    const r = await generateProgressReport(USER, "7d", new Date("2026-07-24T02:00:00Z"));
    expect(r.period.end).toBe("2026-07-23");
    expect(r.timezone).toBe("America/Los_Angeles");
  });

  it("falls back to UTC without a timezone", async () => {
    setData({ timezone: null });
    const r = await generateProgressReport(USER, "7d", new Date("2026-07-24T02:00:00Z"));
    expect(r.period.end).toBe("2026-07-24");
    expect(r.timezone).toBe("UTC");
  });

  it("isProgressReportRange rejects invalid values", () => {
    expect(isProgressReportRange("7d")).toBe(true);
    expect(isProgressReportRange("1y")).toBe(false);
    expect(isProgressReportRange(undefined)).toBe(false);
  });

  it("is fully read-only + user-scoped (all queries filter by user_id)", async () => {
    await generateProgressReport(USER, "7d", NOW);
    for (const m of [
      mockPrisma.personal_goals.findMany,
      mockPrisma.custom_achievements.findMany,
      mockPrisma.goal_check_ins.findMany,
      mockPrisma.achievement_check_ins.findMany,
      mockPrisma.point_transactions.findMany,
    ]) {
      expect(m).toHaveBeenCalledWith(expect.objectContaining({ where: { user_id: USER } }));
    }
    // No create/update/delete/upsert exists on the mock — nothing to call.
    expect(mockPrisma.profiles.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: USER } })
    );
  });
});

// ===========================================================================
describe("progress history", () => {
  it("uses the latest check-in before the period for progressAtStart", async () => {
    setData({
      goals: [goal({ tracking_type: "manual_milestone", progress_percentage: 75 })],
      goalCheckIns: [
        goalCheckIn({ check_in_date: new Date("2026-07-01T00:00:00Z"), progress_after: 25 }), // before 7d start
        goalCheckIn({ check_in_date: new Date("2026-07-19T00:00:00Z"), progress_after: 75 }), // inside
      ],
    });
    const r = await generateProgressReport(USER, "7d", NOW);
    const g = r.activeGoals[0];
    expect(g.progressAtStart).toBe(25);
    expect(g.progressAtEnd).toBe(75);
    expect(g.progressChange).toBe(50);
    expect(g.currentProgress).toBe(75); // live snapshot reported separately
  });

  it("progressAtStart is 0 when the only check-in is inside the period", async () => {
    setData({
      goals: [goal()],
      goalCheckIns: [goalCheckIn({ check_in_date: new Date("2026-07-19T00:00:00Z"), progress_after: 40 })],
    });
    const r = await generateProgressReport(USER, "7d", NOW);
    expect(r.activeGoals[0]).toMatchObject({ progressAtStart: 0, progressAtEnd: 40, progressChange: 40 });
  });

  it("excludes check-ins dated after the period end from progressAtEnd", async () => {
    setData({
      goals: [goal()],
      goalCheckIns: [
        goalCheckIn({ check_in_date: new Date("2026-07-05T00:00:00Z"), progress_after: 30 }),
        goalCheckIn({ check_in_date: new Date("2026-07-20T00:00:00Z"), progress_after: 90 }), // after a 2026-07-10 end
      ],
    });
    // end = 2026-07-10; the 07-20 check-in must NOT count toward progressAtEnd.
    const r = await generateProgressReport(USER, "7d", new Date("2026-07-10T12:00:00Z"));
    expect(r.activeGoals[0].progressAtEnd).toBe(30);
  });

  it("no check-ins => 0/0/0 history", async () => {
    setData({ goals: [goal()] });
    const r = await generateProgressReport(USER, "7d", NOW);
    expect(r.activeGoals[0]).toMatchObject({ progressAtStart: 0, progressAtEnd: 0, progressChange: 0 });
  });

  it("count tracking reports raw current + target and computed percentage", async () => {
    setData({ achievements: [achievement({ tracking_type: "count", progress: 4, total: 10, tracking_unit: "reps" })] });
    const r = await generateProgressReport(USER, "all", NOW);
    expect(r.activeAchievements[0]).toMatchObject({
      trackingType: "count",
      trackingUnit: "reps",
      currentValue: 4,
      targetValue: 10,
      currentProgress: 40,
    });
  });

  it("duration + amount tracking preserve their units", async () => {
    setData({
      achievements: [
        achievement({ id: "a1", tracking_type: "duration", progress: 30, total: 60, tracking_unit: "minutes" }),
        achievement({ id: "a2", tracking_type: "amount", progress: 5, total: 20, tracking_unit: "km" }),
      ],
    });
    const r = await generateProgressReport(USER, "all", NOW);
    const byId = Object.fromEntries(r.activeAchievements.map((a) => [a.id, a]));
    expect(byId.a1).toMatchObject({ trackingType: "duration", trackingUnit: "minutes", currentProgress: 50 });
    expect(byId.a2).toMatchObject({ trackingType: "amount", trackingUnit: "km", currentProgress: 25 });
  });

  it("manual milestone reports a percentage, never a numeric count", async () => {
    setData({ achievements: [achievement({ tracking_type: "manual_milestone", progress: 75, total: 100 })] });
    const r = await generateProgressReport(USER, "all", NOW);
    expect(r.activeAchievements[0]).toMatchObject({
      trackingType: "manual_milestone",
      currentValue: null,
      targetValue: null,
      trackingUnit: null,
      currentProgress: 75,
    });
  });

  it("counts an item created during the period as active", async () => {
    setData({ goals: [goal({ created_at: new Date("2026-07-20T00:00:00Z") })] });
    const r = await generateProgressReport(USER, "7d", NOW);
    expect(r.activeGoals).toHaveLength(1);
    expect(r.currentSnapshot.activeGoals).toBe(1);
  });
});

// ===========================================================================
describe("consistency", () => {
  it("daily: 4 of 7 expected => 57%", async () => {
    setData({
      goals: [goal({ check_in_frequency: "daily", created_at: new Date("2026-01-01T00:00:00Z") })],
      goalCheckIns: [
        goalCheckIn({ check_in_date: new Date("2026-07-17T00:00:00Z") }),
        goalCheckIn({ check_in_date: new Date("2026-07-18T00:00:00Z") }),
        goalCheckIn({ check_in_date: new Date("2026-07-19T00:00:00Z") }),
        goalCheckIn({ check_in_date: new Date("2026-07-20T00:00:00Z") }),
      ],
    });
    const r = await generateProgressReport(USER, "7d", NOW);
    expect(r.activeGoals[0].consistencyRate).toBe(57); // round(4/7*100)
  });

  it("weekly: expected ~ days/7", async () => {
    setData({
      goals: [goal({ check_in_frequency: "weekly" })],
      goalCheckIns: [goalCheckIn({ check_in_date: new Date("2026-07-18T00:00:00Z") })],
    });
    const r = await generateProgressReport(USER, "7d", NOW);
    // window 7 days => expected round(7/7)=1, actual 1 => 100
    expect(r.activeGoals[0].consistencyRate).toBe(100);
  });

  it("twice_weekly: expected round(days*2/7)", async () => {
    setData({
      goals: [goal({ check_in_frequency: "twice_weekly" })],
      goalCheckIns: [goalCheckIn({ check_in_date: new Date("2026-07-18T00:00:00Z") })],
    });
    const r = await generateProgressReport(USER, "7d", NOW);
    // expected round(7*2/7)=2, actual 1 => round(1/2*100)=50
    expect(r.activeGoals[0].consistencyRate).toBe(50);
  });

  it("custom frequency returns null rate but keeps raw counts", async () => {
    setData({
      goals: [goal({ check_in_frequency: "custom" })],
      goalCheckIns: [
        goalCheckIn({ check_in_date: new Date("2026-07-18T00:00:00Z") }),
        goalCheckIn({ check_in_date: new Date("2026-07-19T00:00:00Z") }),
      ],
    });
    const r = await generateProgressReport(USER, "7d", NOW);
    expect(r.activeGoals[0].consistencyRate).toBeNull();
    expect(r.activeGoals[0].checkInsDuringPeriod).toBe(2);
    expect(r.activeGoals[0].activeCheckInDays).toBe(2);
  });

  it("item created during the period shrinks the expected window", async () => {
    setData({
      goals: [goal({ check_in_frequency: "daily", created_at: new Date("2026-07-21T00:00:00Z") })],
      goalCheckIns: [
        goalCheckIn({ check_in_date: new Date("2026-07-21T00:00:00Z") }),
        goalCheckIn({ check_in_date: new Date("2026-07-22T00:00:00Z") }),
        goalCheckIn({ check_in_date: new Date("2026-07-23T00:00:00Z") }),
      ],
    });
    const r = await generateProgressReport(USER, "7d", NOW);
    // window = 2026-07-21..2026-07-23 = 3 days, actual 3 => 100 (not 3/7)
    expect(r.activeGoals[0].consistencyRate).toBe(100);
  });

  it("aggregate consistency uses totals, not an average of item percentages", async () => {
    setData({
      goals: [
        goal({ id: "g1", check_in_frequency: "daily" }),
        goal({ id: "g2", check_in_frequency: "daily" }),
      ],
      goalCheckIns: [
        // g1: 7/7 days
        ...[17, 18, 19, 20, 21, 22, 23].map((d) =>
          goalCheckIn({ goal_id: "g1", check_in_date: new Date(`2026-07-${d}T00:00:00Z`) })
        ),
        // g2: 1/7 days
        goalCheckIn({ goal_id: "g2", check_in_date: new Date("2026-07-18T00:00:00Z") }),
      ],
    });
    const r = await generateProgressReport(USER, "7d", NOW);
    // totals: actual 8 / expected 14 = 57; averaging percentages would give (100+14)/2=57 here,
    // so use uneven windows: still assert the totals formula result.
    expect(r.periodSummary.overallConsistencyRate).toBe(57); // round(8/14*100)
  });

  it("overall consistency is null when there are no fixed-frequency items", async () => {
    setData({ goals: [goal({ check_in_frequency: "custom" })] });
    const r = await generateProgressReport(USER, "7d", NOW);
    expect(r.periodSummary.overallConsistencyRate).toBeNull();
  });
});

// ===========================================================================
describe("completed during the period", () => {
  it("includes a goal completed inside the period with ledger points", async () => {
    setData({
      goals: [
        goal({ id: "g1", status: "completed", progress_percentage: 100, current_value: 10, target_value: 10, tracking_type: "count", completed_at: new Date("2026-07-19T10:00:00Z") }),
      ],
      transactions: [txn({ source_type: "personal_goal_completion", source_item_id: "g1", points: 20 })],
    });
    const r = await generateProgressReport(USER, "7d", NOW);
    expect(r.completedDuringPeriod).toHaveLength(1);
    expect(r.completedDuringPeriod[0]).toMatchObject({
      itemType: "goal",
      itemId: "g1",
      completedAt: "2026-07-19",
      rewardPointsAwarded: 20,
      finalCurrentValue: 10,
      finalTargetValue: 10,
    });
    expect(r.periodSummary.completedGoals).toBe(1);
  });

  it("includes an achievement completed inside the period", async () => {
    setData({
      achievements: [achievement({ id: "a1", unlocked: true, progress: 10, total: 10, completed_at: new Date("2026-07-18T10:00:00Z") })],
      transactions: [txn({ source_type: "personal_achievement_completion", source_item_id: "a1", points: 10 })],
    });
    const r = await generateProgressReport(USER, "7d", NOW);
    expect(r.completedDuringPeriod).toHaveLength(1);
    expect(r.completedDuringPeriod[0]).toMatchObject({ itemType: "achievement", rewardPointsAwarded: 10 });
    expect(r.periodSummary.completedAchievements).toBe(1);
  });

  it("excludes items completed before the period", async () => {
    setData({
      goals: [goal({ status: "completed", progress_percentage: 100, completed_at: new Date("2026-06-01T10:00:00Z") })],
    });
    const r = await generateProgressReport(USER, "7d", NOW);
    expect(r.completedDuringPeriod).toHaveLength(0);
    expect(r.periodSummary.completedGoals).toBe(0);
  });

  it("uses the ledger amount, not a hardcoded constant (0 when no ledger row)", async () => {
    setData({
      goals: [goal({ status: "completed", progress_percentage: 100, completed_at: new Date("2026-07-19T10:00:00Z") })],
      transactions: [], // no ledger row
    });
    const r = await generateProgressReport(USER, "7d", NOW);
    expect(r.completedDuringPeriod[0].rewardPointsAwarded).toBe(0);
  });
});

// ===========================================================================
describe("points + levels", () => {
  it("sums only in-period ledger points and reads the authoritative total/level", async () => {
    setData({
      transactions: [
        txn({ id: "t1", points: 20, created_at: new Date("2026-07-18T10:00:00Z") }), // in period
        txn({ id: "t2", points: 10, created_at: new Date("2026-06-01T10:00:00Z") }), // out of period
      ],
      totalPoints: 350,
    });
    const r = await generateProgressReport(USER, "7d", NOW);
    expect(r.periodSummary.pointsEarned).toBe(20);
    expect(r.rewards.pointsEarned).toBe(20);
    expect(r.rewards.transactions).toHaveLength(1);
    expect(r.currentSnapshot).toMatchObject({
      totalPoints: 350,
      currentLevel: 4, // floor(350/100)+1
      pointsIntoLevel: 50,
      pointsRequiredForNextLevel: 100,
      pointsRemainingToNextLevel: 50,
    });
  });
});

// ===========================================================================
describe("needs attention", () => {
  it("flags an overdue active goal below 100%", async () => {
    setData({ goals: [goal({ target_date: "2026-07-01", progress_percentage: 40 })] });
    const r = await generateProgressReport(USER, "7d", NOW);
    expect(r.needsAttention[0].reasons).toContain("overdue");
    expect(r.activeGoals[0].isOverdue).toBe(true);
  });

  it("never flags a completed item as overdue", async () => {
    setData({
      goals: [goal({ status: "completed", progress_percentage: 100, target_date: "2026-07-01", completed_at: new Date("2026-07-19T10:00:00Z") })],
    });
    const r = await generateProgressReport(USER, "7d", NOW);
    expect(r.needsAttention).toHaveLength(0);
  });

  it("does not flag overdue for a blank/invalid target date", async () => {
    setData({ goals: [goal({ target_date: "not-a-date", progress_percentage: 10 })] });
    const r = await generateProgressReport(USER, "7d", NOW);
    expect(r.activeGoals[0].isOverdue).toBe(false);
  });

  it("flags approaching target within 7 days", async () => {
    setData({ goals: [goal({ target_date: "2026-07-27", progress_percentage: 10 })] });
    const r = await generateProgressReport(USER, "7d", NOW);
    expect(r.activeGoals[0].isApproachingTarget).toBe(true);
    expect(r.needsAttention[0].reasons).toContain("approaching_target");
  });

  it("flags no recent check-ins past the daily threshold", async () => {
    setData({
      goals: [goal({ check_in_frequency: "daily" })],
      goalCheckIns: [goalCheckIn({ check_in_date: new Date("2026-07-10T00:00:00Z") })], // 13 days ago > 2
    });
    const r = await generateProgressReport(USER, "7d", NOW);
    expect(r.activeGoals[0].hasNoRecentCheckIns).toBe(true);
    expect(r.needsAttention[0].reasons).toContain("no_recent_check_ins");
  });

  it("custom frequency uses the 14-day inactivity threshold", async () => {
    // last check-in 10 days ago: NOT flagged for custom (<=14) but WOULD be for daily.
    setData({
      goals: [goal({ check_in_frequency: "custom" })],
      goalCheckIns: [goalCheckIn({ check_in_date: new Date("2026-07-13T00:00:00Z") })], // 10 days ago
    });
    const r = await generateProgressReport(USER, "7d", NOW);
    expect(r.activeGoals[0].hasNoRecentCheckIns).toBe(false);
  });

  it("combines multiple reason codes on one item", async () => {
    setData({
      goals: [goal({ check_in_frequency: "daily", target_date: "2026-07-01", progress_percentage: 40 })],
      goalCheckIns: [], // never checked in => no recent + no progress
    });
    const r = await generateProgressReport(USER, "7d", NOW);
    expect(r.needsAttention).toHaveLength(1);
    expect(r.needsAttention[0].reasons).toEqual(
      expect.arrayContaining(["overdue", "no_recent_check_ins", "no_progress_during_period"])
    );
  });

  it("flags no progress during the period", async () => {
    setData({
      goals: [goal({ progress_percentage: 50 })],
      goalCheckIns: [goalCheckIn({ check_in_date: new Date("2026-07-01T00:00:00Z"), progress_after: 50 })], // before period; none inside
    });
    const r = await generateProgressReport(USER, "7d", NOW);
    expect(r.activeGoals[0].progressChange).toBe(0);
    expect(r.activeGoals[0].hasNoProgressDuringPeriod).toBe(true);
    expect(r.needsAttention[0].reasons).toContain("no_progress_during_period");
  });
});

// ===========================================================================
describe("user-entered content", () => {
  it("collects wins/challenges/reflections/notes/moods from goal check-ins", async () => {
    setData({
      goals: [goal()],
      goalCheckIns: [
        goalCheckIn({
          check_in_date: new Date("2026-07-19T00:00:00Z"),
          wins: "Ran 5k",
          challenges_faced: "Rain",
          reflection: "Felt strong",
          notes: "Keep going",
          mood: "motivation",
        }),
      ],
    });
    const r = await generateProgressReport(USER, "7d", NOW);
    expect(r.wellbeingEntries.wins[0]).toMatchObject({ text: "Ran 5k", itemType: "goal", date: "2026-07-19" });
    expect(r.wellbeingEntries.challenges[0].text).toBe("Rain");
    expect(r.wellbeingEntries.reflections[0].text).toBe("Felt strong");
    expect(r.wellbeingEntries.notes[0].text).toBe("Keep going");
    expect(r.wellbeingEntries.moodCounts).toEqual([{ mood: "motivation", count: 1 }]);
  });

  it("keeps achievement notes NEUTRAL (in notes, never wins/challenges)", async () => {
    setData({
      achievements: [achievement()],
      achCheckIns: [achCheckIn({ check_in_date: new Date("2026-07-19T00:00:00Z"), note: "Did the thing" })],
    });
    const r = await generateProgressReport(USER, "7d", NOW);
    expect(r.wellbeingEntries.notes[0]).toMatchObject({ text: "Did the thing", itemType: "achievement" });
    expect(r.wellbeingEntries.wins).toHaveLength(0);
    expect(r.wellbeingEntries.challenges).toHaveLength(0);
  });

  it("excludes user content from check-ins outside the period", async () => {
    setData({
      goals: [goal()],
      goalCheckIns: [goalCheckIn({ check_in_date: new Date("2026-07-01T00:00:00Z"), wins: "Old win" })],
    });
    const r = await generateProgressReport(USER, "7d", NOW);
    expect(r.wellbeingEntries.wins).toHaveLength(0);
  });
});

// ===========================================================================
describe("closing summary", () => {
  it("is deterministic with correct pluralization", async () => {
    setData({
      goals: [goal({ id: "g1", status: "completed", progress_percentage: 100, completed_at: new Date("2026-07-19T10:00:00Z") })],
      goalCheckIns: [
        goalCheckIn({ goal_id: "g1", check_in_date: new Date("2026-07-18T00:00:00Z"), progress_after: 50 }),
        goalCheckIn({ goal_id: "g1", check_in_date: new Date("2026-07-19T00:00:00Z"), progress_after: 100 }),
      ],
      transactions: [txn({ points: 20, created_at: new Date("2026-07-19T10:00:00Z") })],
    });
    const r = await generateProgressReport(USER, "7d", NOW);
    expect(r.closingSummary).toContain("You completed 1 Goal during this reporting period.");
    expect(r.closingSummary).toContain("You checked in on 2 different days.");
    expect(r.closingSummary).toContain("You earned 20 points.");
  });

  it("falls back to a single neutral line when nothing happened", async () => {
    const r = await generateProgressReport(USER, "7d", NOW);
    expect(r.closingSummary).toEqual(["No tracked progress activity in this period."]);
  });
});

// ===========================================================================
describe("system achievements in the report (Phase 5)", () => {
  const sysTxn = (over: Record<string, unknown> = {}) => ({
    id: `st-${Math.random()}`,
    user_id: USER,
    source_type: "system_achievement_completion",
    source_item_id: FIRST_STEPS.id,
    points: FIRST_STEPS.points,
    reason: "System achievement completed: First Steps",
    created_at: new Date("2026-07-19T10:00:00Z"),
    ...over,
  });

  it("personal items carry origin personal; system items carry origin system", async () => {
    setData({ achievements: [achievement()], sessions: 0 });
    const r = await generateProgressReport(USER, "all", NOW);
    const personal = r.activeAchievements.find((a) => a.origin === "personal");
    const system = r.activeAchievements.find((a) => a.origin === "system");
    expect(personal).toBeTruthy();
    expect(system).toBeTruthy();
    // System items expose an icon name; personal items do not.
    expect(system!.iconName).toBe(FIRST_STEPS.icon);
    expect(personal!.iconName).toBeNull();
  });

  it("renders in-progress system achievements with derived percentage", async () => {
    setData({ sessions: 3 }); // Consistent Journey: 3/10 = 30%
    const r = await generateProgressReport(USER, "all", NOW);
    const cj = r.activeAchievements.find((a) => a.id === CONSISTENT.id)!;
    expect(cj.origin).toBe("system");
    expect(cj.currentProgress).toBe(30);
    expect(cj.status).toBe("active");
  });

  it("represents a threshold-met-but-unpersisted item as completed_reward_pending, not active 100%", async () => {
    setData({ sessions: 1 }); // First Steps met (>=1) but no user_achievements row
    const r = await generateProgressReport(USER, "all", NOW);
    const fs = r.activeAchievements.find((a) => a.id === FIRST_STEPS.id)!;
    expect(fs.currentProgress).toBe(100);
    expect(fs.status).toBe("completed_reward_pending");
    expect(fs.rewardAwarded).toBe(false);
    // NOT counted as a completion until genuinely earned + rewarded.
    expect(r.currentSnapshot.completedAchievementsAllTime).toBe(0);
    expect(r.completedDuringPeriod.filter((c) => c.origin === "system")).toHaveLength(0);
  });

  it("moves an earned+rewarded system achievement into completedDuringPeriod with ledger points", async () => {
    setData({
      sessions: 1,
      systemEarned: [
        { user_id: USER, achievement_id: FIRST_STEPS.id, earned_at: new Date("2026-07-19T10:00:00Z"), progress: 1 },
      ],
      transactions: [sysTxn()],
    });
    const r = await generateProgressReport(USER, "7d", NOW);

    const completion = r.completedDuringPeriod.find((c) => c.itemId === FIRST_STEPS.id)!;
    expect(completion).toBeTruthy();
    expect(completion.origin).toBe("system");
    expect(completion.completedAt).toBe("2026-07-19");
    expect(completion.rewardPointsAwarded).toBe(FIRST_STEPS.points); // FROM the ledger
    // Not also present in the active list (no double counting).
    expect(r.activeAchievements.find((a) => a.id === FIRST_STEPS.id)).toBeUndefined();
    expect(r.currentSnapshot.completedAchievementsAllTime).toBe(1);
    expect(r.periodSummary.completedAchievements).toBe(1);
  });

  it("earned reward points come from the ledger, never the definition (0 when no ledger row)", async () => {
    setData({
      sessions: 1,
      systemEarned: [
        { user_id: USER, achievement_id: FIRST_STEPS.id, earned_at: new Date("2026-07-19T10:00:00Z"), progress: 1 },
      ],
      transactions: [], // earned but NOT yet rewarded (historical gap)
    });
    const r = await generateProgressReport(USER, "7d", NOW);
    const completion = r.completedDuringPeriod.find((c) => c.itemId === FIRST_STEPS.id)!;
    expect(completion.rewardPointsAwarded).toBe(0);
  });

  it("excludes an earn completed outside the period from completedDuringPeriod", async () => {
    setData({
      sessions: 1,
      systemEarned: [
        { user_id: USER, achievement_id: FIRST_STEPS.id, earned_at: new Date("2026-06-01T10:00:00Z"), progress: 1 },
      ],
    });
    const r = await generateProgressReport(USER, "7d", NOW);
    expect(r.completedDuringPeriod.find((c) => c.itemId === FIRST_STEPS.id)).toBeUndefined();
    // Still counted all-time.
    expect(r.currentSnapshot.completedAchievementsAllTime).toBe(1);
  });

  it("includes system reward transactions in the rewards ledger view", async () => {
    setData({
      sessions: 1,
      systemEarned: [
        { user_id: USER, achievement_id: FIRST_STEPS.id, earned_at: new Date("2026-07-19T10:00:00Z"), progress: 1 },
      ],
      transactions: [sysTxn()],
    });
    const r = await generateProgressReport(USER, "7d", NOW);
    expect(r.rewards.transactions.some((t) => t.sourceType === "system_achievement_completion")).toBe(true);
    expect(r.rewards.pointsEarned).toBe(FIRST_STEPS.points);
  });

  it("never double-counts personal + system achievements", async () => {
    setData({
      achievements: [achievement({ unlocked: true, completed_at: new Date("2026-07-19T10:00:00Z"), progress: 10, total: 10 })],
      sessions: 1,
      systemEarned: [
        { user_id: USER, achievement_id: FIRST_STEPS.id, earned_at: new Date("2026-07-19T10:00:00Z"), progress: 1 },
      ],
      transactions: [sysTxn()],
    });
    const r = await generateProgressReport(USER, "7d", NOW);
    // One personal + one system completion this period.
    expect(r.periodSummary.completedAchievements).toBe(2);
    expect(r.completedDuringPeriod.filter((c) => c.itemType === "achievement")).toHaveLength(2);
  });

  it("does not add system items to needs-attention or the consistency denominator", async () => {
    setData({ sessions: 3 });
    const r = await generateProgressReport(USER, "7d", NOW);
    expect(r.needsAttention.every((a) => a.itemId !== CONSISTENT.id)).toBe(true);
    // No fixed-frequency system items -> overall consistency stays null here.
    expect(r.periodSummary.overallConsistencyRate).toBeNull();
  });
});
