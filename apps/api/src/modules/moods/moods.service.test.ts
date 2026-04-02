const mockPrisma = {
  profiles: { update: jest.fn() },
  mood_entries: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

jest.mock("../../lib/prisma", () => ({
  __esModule: true,
  default: mockPrisma,
}));

const ensureStreakRiskReminder = jest.fn();

jest.mock("../notifications/notifications.service", () => ({
  notificationsService: {
    ensureStreakRiskReminder,
  },
}));

import { createMood, getMoodsByUserId, getAllMoods } from "./moods.service";

describe("moods.service", () => {
  const userId = "user-1";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a mood entry", async () => {
    mockPrisma.mood_entries.create.mockResolvedValue({ id: "m1" });
    await createMood(userId, { mood: "happy", intensity: 7, activities: ["walk"], notes: "good day" });
    expect(mockPrisma.profiles.update).toHaveBeenCalled();
    expect(mockPrisma.mood_entries.create).toHaveBeenCalled();
  });

  it("lists user moods ordered by newest first", async () => {
    mockPrisma.mood_entries.findMany.mockResolvedValue([{ id: "m1" }]);
    const result = await getMoodsByUserId(userId);
    expect(ensureStreakRiskReminder).toHaveBeenCalledWith(userId, "mood");
    expect(mockPrisma.mood_entries.findMany).toHaveBeenCalledWith({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
    });
    expect(result).toEqual([{ id: "m1" }]);
  });

  it("lists all moods for admin views", async () => {
    mockPrisma.mood_entries.findMany.mockResolvedValue([{ id: "m2" }]);
    const result = await getAllMoods();
    expect(result).toEqual([{ id: "m2" }]);
  });
});
