const mockPrisma = {
  profiles: {
    findUnique: jest.fn(),
  },
  notifications: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  mood_entries: {
    findFirst: jest.fn(),
  },
  journal_entries: {
    findFirst: jest.fn(),
  },
};

jest.mock("../../lib/prisma", () => ({
  __esModule: true,
  default: mockPrisma,
}));

import { notificationsService } from "./notifications.service";

describe("notifications.service streak reminders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Math, "random").mockReturnValue(0);
    mockPrisma.profiles.findUnique.mockResolvedValue({
      notification_preferences: {
        pushEnabled: true,
        moodCheckIns: true,
        journalPrompts: true,
      },
    });
    mockPrisma.notifications.findMany.mockResolvedValue([]);
    mockPrisma.notifications.create.mockResolvedValue({ id: "notification-1" });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("creates a mood streak warning when the latest check-in was yesterday", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    mockPrisma.mood_entries.findFirst.mockResolvedValue({ created_at: yesterday });

    const result = await notificationsService.ensureStreakRiskReminder("user-1", "mood");

    expect(mockPrisma.notifications.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user_id: "user-1",
        type: "reminder",
        title: "Your streak is on the line. don’t miss today’s check-in.",
        message: "Check in with your mood today so you do not lose your streak.",
        metadata: expect.objectContaining({
          streakType: "mood",
          reminderKind: "streak-risk",
        }),
      }),
    });
    expect(result).toEqual({ id: "notification-1" });
  });

  it("creates a journal streak warning when the latest entry was yesterday", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    mockPrisma.journal_entries.findFirst.mockResolvedValue({ created_at: yesterday });

    await notificationsService.ensureStreakRiskReminder("user-1", "journal");

    expect(mockPrisma.notifications.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user_id: "user-1",
        type: "reminder",
        title: "Last chance to keep your streak going. log today’s entry now!",
        message: "Write in your journal today so you do not lose your streak.",
        metadata: expect.objectContaining({
          streakType: "journal",
        }),
      }),
    });
  });

  it("skips creating a reminder when the user already checked in today", async () => {
    mockPrisma.mood_entries.findFirst.mockResolvedValue({ created_at: new Date() });

    const result = await notificationsService.ensureStreakRiskReminder("user-1", "mood");

    expect(mockPrisma.notifications.create).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("skips creating a reminder when mood notifications are disabled", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    mockPrisma.profiles.findUnique.mockResolvedValue({
      notification_preferences: {
        pushEnabled: true,
        moodCheckIns: false,
      },
    });
    mockPrisma.mood_entries.findFirst.mockResolvedValue({ created_at: yesterday });

    const result = await notificationsService.ensureStreakRiskReminder("user-1", "mood");

    expect(mockPrisma.notifications.create).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("skips creating another reminder when a streak-risk reminder already exists today", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    mockPrisma.mood_entries.findFirst.mockResolvedValue({ created_at: yesterday });
    mockPrisma.notifications.findMany.mockResolvedValue([
      {
        id: "notification-1",
        metadata: {
          reminderKind: "streak-risk",
          streakType: "mood",
        },
      },
    ]);

    const result = await notificationsService.ensureStreakRiskReminder("user-1", "mood");

    expect(mockPrisma.notifications.create).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});
