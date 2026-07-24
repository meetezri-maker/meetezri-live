const mockPrisma = {
  $transaction: jest.fn(),
  app_sessions: { count: jest.fn() },
  mood_entries: { count: jest.fn(), findMany: jest.fn() },
  journal_entries: { count: jest.fn() },
  user_wellness_progress: { count: jest.fn() },
  community_posts: { count: jest.fn() },
  user_achievements: { findMany: jest.fn(), upsert: jest.fn() },
  achievements: { upsert: jest.fn() },
  point_transactions: { findMany: jest.fn(), create: jest.fn() },
};

jest.mock("../../lib/prisma", () => ({ __esModule: true, default: mockPrisma }));
// Reuse the real streak helper's contract without importing the heavy user module.
jest.mock("../users/user.service", () => ({ calculateStreak: jest.fn(() => 0) }));

import {
  evaluateSystemAchievements,
  listSystemAchievementStates,
  getSystemAchievementMetrics,
} from "./system-achievements.service";
import { SYSTEM_ACHIEVEMENTS } from "./system-achievements.constants";
import { calculateStreak } from "../users/user.service";

const USER = "user-1";
const FIRST_STEPS = SYSTEM_ACHIEVEMENTS[0]; // sessions >= 1, 10 pts
const CONSISTENT = SYSTEM_ACHIEVEMENTS[1]; // sessions >= 10, 50 pts

function setMetrics(over: Partial<Record<string, number>> = {}) {
  mockPrisma.app_sessions.count.mockResolvedValue(over.sessions ?? 0);
  mockPrisma.mood_entries.count.mockResolvedValue(over.moods ?? 0);
  mockPrisma.journal_entries.count.mockResolvedValue(over.journals ?? 0);
  mockPrisma.user_wellness_progress.count.mockResolvedValue(over.wellness ?? 0);
  mockPrisma.community_posts.count.mockResolvedValue(over.community ?? 0);
  mockPrisma.mood_entries.findMany.mockResolvedValue([]);
  (calculateStreak as jest.Mock).mockReturnValue(over.streak ?? 0);
}

beforeEach(() => {
  jest.clearAllMocks();
  setMetrics();
  mockPrisma.user_achievements.findMany.mockResolvedValue([]);
  mockPrisma.point_transactions.findMany.mockResolvedValue([]);
  mockPrisma.user_achievements.upsert.mockResolvedValue({ user_id: USER });
  mockPrisma.achievements.upsert.mockResolvedValue({});
  mockPrisma.point_transactions.create.mockResolvedValue({ id: "t1" });
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) =>
    fn(mockPrisma)
  );
});

describe("metrics are derived server-side and user-scoped", () => {
  it("counts every metric for the authenticated user only", async () => {
    setMetrics({ sessions: 3, moods: 9, journals: 2, wellness: 6, community: 1, streak: 12 });
    const m = await getSystemAchievementMetrics(USER);
    expect(m).toEqual({
      sessions_completed: 3,
      mood_checkins: 9,
      journal_entries: 2,
      wellness_exercises: 6,
      community_posts: 1,
      streak_days: 12,
    });
    for (const spy of [
      mockPrisma.app_sessions.count,
      mockPrisma.mood_entries.count,
      mockPrisma.journal_entries.count,
      mockPrisma.user_wellness_progress.count,
    ]) {
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ user_id: USER }) }));
    }
    expect(mockPrisma.community_posts.count).toHaveBeenCalledWith({
      where: { user_id: USER, deleted_at: null },
    });
  });
});

describe("reward issuance", () => {
  it("awards points when a system achievement threshold is met", async () => {
    setMetrics({ sessions: 1 });
    const res = await evaluateSystemAchievements(USER);

    expect(res.newlyRewarded).toContain(FIRST_STEPS.id);
    expect(res.pointsAwarded).toBe(FIRST_STEPS.points);
    expect(mockPrisma.point_transactions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user_id: USER,
          source_type: "system_achievement_completion",
          source_item_id: FIRST_STEPS.id,
          points: FIRST_STEPS.points,
        }),
      })
    );
  });

  it("writes the correct ledger source type and source item id", async () => {
    setMetrics({ sessions: 10 });
    await evaluateSystemAchievements(USER);
    const ids = mockPrisma.point_transactions.create.mock.calls.map(
      (c: any[]) => c[0].data.source_item_id
    );
    expect(ids).toEqual(expect.arrayContaining([FIRST_STEPS.id, CONSISTENT.id]));
    for (const call of mockPrisma.point_transactions.create.mock.calls) {
      expect(call[0].data.source_type).toBe("system_achievement_completion");
    }
  });

  it("persists the earned row alongside the reward", async () => {
    setMetrics({ sessions: 1 });
    await evaluateSystemAchievements(USER);
    expect(mockPrisma.user_achievements.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id_achievement_id: { user_id: USER, achievement_id: FIRST_STEPS.id } },
      })
    );
  });

  it("does not award when the threshold is not met", async () => {
    setMetrics({ sessions: 0 });
    const res = await evaluateSystemAchievements(USER);
    expect(res.newlyRewarded).toHaveLength(0);
    expect(mockPrisma.point_transactions.create).not.toHaveBeenCalled();
  });

  it("awards exactly once — a second run adds no ledger row", async () => {
    setMetrics({ sessions: 1 });
    await evaluateSystemAchievements(USER);
    expect(mockPrisma.point_transactions.create).toHaveBeenCalledTimes(1);

    // Second run: earned + ledger rows now exist.
    jest.clearAllMocks();
    setMetrics({ sessions: 1 });
    mockPrisma.user_achievements.findMany.mockResolvedValue([
      { user_id: USER, achievement_id: FIRST_STEPS.id, earned_at: new Date(), progress: 1 },
    ]);
    mockPrisma.point_transactions.findMany.mockResolvedValue([
      { source_item_id: FIRST_STEPS.id },
    ]);
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));

    const res2 = await evaluateSystemAchievements(USER);
    expect(res2.newlyRewarded).toHaveLength(0);
    expect(res2.pointsAwarded).toBe(0);
    expect(mockPrisma.point_transactions.create).not.toHaveBeenCalled();
  });

  it("is idempotent at the DB level when a duplicate insert races through", async () => {
    setMetrics({ sessions: 1 });
    // Ledger read shows nothing, but the INSERT hits the unique constraint.
    const p2002 = Object.assign(new Error("dup"), { code: "P2002" });
    Object.setPrototypeOf(p2002, Object.getPrototypeOf(new Error()));
    mockPrisma.point_transactions.create.mockRejectedValue(p2002);

    // recordPointTransaction only swallows PrismaClientKnownRequestError; a plain
    // error must surface rather than silently losing the reward.
    await expect(evaluateSystemAchievements(USER)).rejects.toBeTruthy();
  });

  it("keeps completion and reward atomic (one transaction per achievement)", async () => {
    setMetrics({ sessions: 1 });
    await evaluateSystemAchievements(USER);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("does not write anything in dryRun mode", async () => {
    setMetrics({ sessions: 10, moods: 7 });
    const res = await evaluateSystemAchievements(USER, { dryRun: true });

    expect(res.pointsAwarded).toBe(FIRST_STEPS.points + CONSISTENT.points + SYSTEM_ACHIEVEMENTS[2].points);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.point_transactions.create).not.toHaveBeenCalled();
    expect(mockPrisma.user_achievements.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.achievements.upsert).not.toHaveBeenCalled();
  });

  it("scopes every read to the requesting user (no cross-user exposure)", async () => {
    setMetrics({ sessions: 1 });
    await listSystemAchievementStates(USER);
    expect(mockPrisma.user_achievements.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ user_id: USER }) })
    );
    expect(mockPrisma.point_transactions.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ user_id: USER }) })
    );
  });
});

describe("read-only state listing", () => {
  it("reports unlocked only from the persisted row, never from the metric alone", async () => {
    // Metric met, but no persisted earn -> NOT unlocked (no silent completion).
    setMetrics({ sessions: 50 });
    const states = await listSystemAchievementStates(USER);
    const first = states.find((s) => s.definition.id === FIRST_STEPS.id)!;
    expect(first.unlocked).toBe(false);
    expect(first.rewarded).toBe(false);
    expect(first.progress).toBe(FIRST_STEPS.threshold); // capped at threshold
  });

  it("reflects persisted earned + rewarded state", async () => {
    setMetrics({ sessions: 1 });
    const earnedAt = new Date("2026-07-19T10:00:00Z");
    mockPrisma.user_achievements.findMany.mockResolvedValue([
      { user_id: USER, achievement_id: FIRST_STEPS.id, earned_at: earnedAt, progress: 1 },
    ]);
    mockPrisma.point_transactions.findMany.mockResolvedValue([{ source_item_id: FIRST_STEPS.id }]);

    const states = await listSystemAchievementStates(USER);
    const first = states.find((s) => s.definition.id === FIRST_STEPS.id)!;
    expect(first.unlocked).toBe(true);
    expect(first.rewarded).toBe(true);
    expect(first.earnedAt).toEqual(earnedAt);
  });

  it("performs no writes", async () => {
    setMetrics({ sessions: 99, moods: 99, journals: 99, wellness: 99, community: 99, streak: 99 });
    await listSystemAchievementStates(USER);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.point_transactions.create).not.toHaveBeenCalled();
    expect(mockPrisma.user_achievements.upsert).not.toHaveBeenCalled();
  });
});
