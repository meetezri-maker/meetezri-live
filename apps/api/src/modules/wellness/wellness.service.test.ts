const mockPrisma = {
  wellness_tools: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  favorite_wellness_tools: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  user_wellness_progress: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  wellness_challenges: {
    findMany: jest.fn(),
  },
  mood_entries: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  journal_entries: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  sleep_entries: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  user_challenge_participation: {
    findMany: jest.fn(),
    upsert: jest.fn(),
  },
  $queryRaw: jest.fn(),
};

const mockSharedCache = {
  sharedDel: jest.fn().mockResolvedValue(undefined),
  sharedGetJson: jest.fn().mockResolvedValue(null),
  sharedSetJson: jest.fn().mockResolvedValue(undefined),
};

jest.mock("../../lib/prisma", () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock("../../lib/sharedCache", () => mockSharedCache);

jest.mock("../system-achievements/system-achievements.triggers", () => ({
  onUserActivity: jest.fn().mockResolvedValue(null),
}));

import {
  createWellnessTool,
  getWellnessTools,
  updateWellnessTool,
  deleteWellnessTool,
  completeWellnessSession,
  getWellnessChallengesForUserDashboard,
} from "./wellness.service";

describe("wellness.service", () => {
  const userId = "user-1";
  const toolId = "tool-1";

  beforeEach(() => {
    jest.clearAllMocks();
    mockSharedCache.sharedGetJson.mockResolvedValue(null);
    mockSharedCache.sharedSetJson.mockResolvedValue(undefined);
    mockPrisma.$queryRaw.mockResolvedValue([{ total: BigInt(0) }]);
  });

  it("creates a wellness tool", async () => {
    mockPrisma.wellness_tools.create.mockResolvedValue({ id: toolId });
    const created = await createWellnessTool({
      title: "Breathing",
      category: "Meditation",
      is_premium: false,
      status: "draft",
    });
    expect(created).toEqual({ id: toolId });
  });

  it("lists wellness tools", async () => {
    mockPrisma.wellness_tools.findMany.mockResolvedValue([]);
    const tools = await getWellnessTools(userId);
    expect(Array.isArray(tools)).toBe(true);
  });

  it("updates a wellness tool", async () => {
    mockPrisma.wellness_tools.update.mockResolvedValue({ id: toolId, title: "Updated" });
    const updated = await updateWellnessTool(toolId, { title: "Updated" });
    expect(updated).toEqual({ id: toolId, title: "Updated" });
  });

  it("deletes a wellness tool", async () => {
    mockPrisma.wellness_tools.delete.mockResolvedValue({ id: toolId });
    await deleteWellnessTool(toolId);
    expect(mockPrisma.wellness_tools.delete).toHaveBeenCalledWith({ where: { id: toolId } });
  });

  it("completes session only when owned by user", async () => {
    mockPrisma.user_wellness_progress.findFirst.mockResolvedValue({ id: "p1", user_id: userId });
    mockPrisma.user_wellness_progress.update.mockResolvedValue({ id: "p1", user_id: userId });
    const result = await completeWellnessSession(userId, "p1", 300, 5);
    expect(result).toEqual({ id: "p1", user_id: userId });
  });

  it("batches dashboard challenge progress reads without changing challenge semantics", async () => {
    const dashboardUserId = "dashboard-user-batched";
    const now = new Date();
    const start = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const end = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
    const inWindow = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const outOfWindow = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const challenge = (
      id: string,
      title: string,
      goal_criteria: Record<string, unknown>,
      category: string | null = null
    ) => ({
      id,
      title,
      description: `${title} description`,
      category,
      start_date: start,
      end_date: end,
      reward_points: 10,
      goal_criteria,
    });

    mockPrisma.wellness_challenges.findMany.mockResolvedValue([
      challenge("c-check", "Daily check in", { metric: "mood_streak", target: 3 }),
      challenge("c-meditation", "Meditation minutes", { metric: "meditation_sessions", target: 5 }),
      challenge("c-journal", "Journal reflection", { metric: "journal_entries", target: 4 }, "journaling"),
      challenge("c-breath", "Breath reset", { metric: "breathing", target: 3 }),
      challenge("c-wellness", "Wellness warrior", { metric: "wellness_sessions", target: 10 }),
      challenge("c-sleep", "Sleep nights", { metric: "sleep_nights", target: 2 }),
      challenge("c-mood", "Mood notes", { metric: "mood_entries", target: 5 }),
      challenge("c-completed", "Completed challenge", { metric: "journal_entries", target: 5 }),
      challenge("c-partial", "Partial challenge", { metric: "sleep_nights", target: 5 }),
      challenge("c-draft", "Draft challenge", { metric: "mood_entries", target: 5, status: "draft" }),
    ]);

    mockPrisma.mood_entries.findMany
      .mockResolvedValueOnce([
        { created_at: new Date(now) },
        { created_at: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      ])
      .mockResolvedValueOnce([
        { created_at: inWindow },
        { created_at: inWindow },
        { created_at: outOfWindow },
      ]);

    mockPrisma.user_challenge_participation.findMany.mockResolvedValue([
      { challenge_id: "c-completed", progress: 1, is_completed: true },
      { challenge_id: "c-partial", progress: 3, is_completed: false },
    ]);
    mockPrisma.user_wellness_progress.findMany.mockResolvedValue([
      { completed_at: inWindow, wellness_tools: { category: "Meditation" } },
      { completed_at: inWindow, wellness_tools: { category: "Meditation" } },
      { completed_at: inWindow, wellness_tools: { category: "Relaxation" } },
      { completed_at: outOfWindow, wellness_tools: { category: "Meditation" } },
    ]);
    mockPrisma.journal_entries.findMany.mockResolvedValue([
      { created_at: inWindow },
      { created_at: outOfWindow },
    ]);
    mockPrisma.sleep_entries.findMany.mockResolvedValue([
      { created_at: inWindow },
      { created_at: outOfWindow },
    ]);
    mockPrisma.user_challenge_participation.upsert.mockResolvedValue({});

    const result = await getWellnessChallengesForUserDashboard(dashboardUserId);

    expect(result.challenges.map((c: { id: string }) => c.id)).toEqual([
      "c-check",
      "c-meditation",
      "c-journal",
      "c-breath",
      "c-wellness",
      "c-sleep",
      "c-mood",
      "c-completed",
      "c-partial",
    ]);
    expect(result.challenges.map((c: { progress: number }) => c.progress)).toEqual([
      2,
      2,
      1,
      1,
      3,
      1,
      2,
      5,
      3,
    ]);
    expect(result.challenges.find((c: { id: string }) => c.id === "c-completed").isCompleted).toBe(true);
    expect(result.challenges.find((c: { id: string }) => c.id === "c-partial").isJoined).toBe(true);

    expect(mockPrisma.user_wellness_progress.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.journal_entries.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.sleep_entries.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.mood_entries.findMany).toHaveBeenCalledTimes(2);
    expect(mockPrisma.user_wellness_progress.count).not.toHaveBeenCalled();
    expect(mockPrisma.journal_entries.count).not.toHaveBeenCalled();
    expect(mockPrisma.sleep_entries.count).not.toHaveBeenCalled();
    expect(mockPrisma.mood_entries.count).not.toHaveBeenCalled();
  });

});
