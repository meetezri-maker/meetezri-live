import { Prisma } from "@prisma/client";

const mockPrisma = {
  $transaction: jest.fn(),
  custom_achievements: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  achievement_check_ins: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  profiles: {
    findUnique: jest.fn(),
  },
  point_transactions: {
    create: jest.fn(),
    aggregate: jest.fn(),
  },
};

jest.mock("../../lib/prisma", () => ({
  __esModule: true,
  default: mockPrisma,
}));

import {
  addAchievementCheckIn,
  DuplicateAchievementCheckInError,
} from "./custom-achievements.service";

const userId = "user-1";
const achId = "ach-1";

const p2002 = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "5.22.0",
  });

function achievement(overrides: Record<string, unknown> = {}) {
  return {
    id: achId,
    user_id: userId,
    progress: 0,
    total: 5,
    tracking_type: "count",
    reward_awarded: false,
    ...overrides,
  };
}

describe("achievement check-in (DB-backed, backend-derived progress)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) =>
      fn(mockPrisma)
    );
    mockPrisma.profiles.findUnique.mockResolvedValue({ timezone: "UTC" });
    mockPrisma.achievement_check_ins.create.mockResolvedValue({ id: "ac1" });
    mockPrisma.custom_achievements.update.mockResolvedValue({ id: achId });
    mockPrisma.point_transactions.create.mockResolvedValue({ id: "t1" });
    mockPrisma.point_transactions.aggregate.mockResolvedValue({ _sum: { points: 10 } });
  });

  it("returns null when the achievement is not owned", async () => {
    mockPrisma.custom_achievements.findFirst.mockResolvedValue(null);
    expect(await addAchievementCheckIn(userId, achId, { value: 1 })).toBeNull();
    expect(mockPrisma.achievement_check_ins.create).not.toHaveBeenCalled();
  });

  it("stores check-ins in the achievement_check_ins table (not JSON)", async () => {
    mockPrisma.custom_achievements.findFirst.mockResolvedValue(achievement({ progress: 1, total: 5 }));
    await addAchievementCheckIn(userId, achId, { value: 1, note: "did one" });
    expect(mockPrisma.achievement_check_ins.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user_id: userId,
          achievement_id: achId,
          value_added: 1,
          note: "did one",
        }),
      })
    );
  });

  it("derives COUNT progress from value + target", async () => {
    mockPrisma.custom_achievements.findFirst.mockResolvedValue(achievement({ progress: 1, total: 5 }));
    await addAchievementCheckIn(userId, achId, { value: 1 });
    // (1 + 1) / 5 = 40%
    expect(mockPrisma.achievement_check_ins.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ progress_after: 40 }) })
    );
    expect(mockPrisma.point_transactions.create).not.toHaveBeenCalled();
  });

  it("derives DURATION progress from value + target", async () => {
    mockPrisma.custom_achievements.findFirst.mockResolvedValue(
      achievement({ tracking_type: "duration", progress: 30, total: 60 })
    );
    await addAchievementCheckIn(userId, achId, { value: 15 });
    // (30 + 15) / 60 = 75%
    expect(mockPrisma.achievement_check_ins.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ progress_after: 75 }) })
    );
  });

  it("derives AMOUNT progress from value + target", async () => {
    mockPrisma.custom_achievements.findFirst.mockResolvedValue(
      achievement({ tracking_type: "amount", progress: 200, total: 1000 })
    );
    await addAchievementCheckIn(userId, achId, { value: 50 });
    // (200 + 50) / 1000 = 25%
    expect(mockPrisma.achievement_check_ins.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ progress_after: 25 }) })
    );
  });

  it("derives MANUAL milestone progress (total normalized to 100)", async () => {
    mockPrisma.custom_achievements.findFirst.mockResolvedValue(
      achievement({ tracking_type: "manual_milestone", progress: 0, total: 100 })
    );
    await addAchievementCheckIn(userId, achId, { milestone: "significant_progress" });
    expect(mockPrisma.achievement_check_ins.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ progress_after: 75, milestone: "significant_progress" }),
      })
    );
  });

  it("awards 10 points once when progress reaches 100%", async () => {
    mockPrisma.custom_achievements.findFirst.mockResolvedValue(achievement({ progress: 5, total: 5 }));
    const res = await addAchievementCheckIn(userId, achId, { value: 1 });
    expect(mockPrisma.point_transactions.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.point_transactions.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ points: 10 }) })
    );
    expect((res as { completion: { awarded: boolean } }).completion.awarded).toBe(true);
  });

  it("enforces one check-in per calendar day (DB unique -> error)", async () => {
    mockPrisma.custom_achievements.findFirst.mockResolvedValue(achievement({ progress: 1 }));
    mockPrisma.achievement_check_ins.create.mockRejectedValue(p2002());
    await expect(addAchievementCheckIn(userId, achId, { value: 1 })).rejects.toBeInstanceOf(
      DuplicateAchievementCheckInError
    );
    expect(mockPrisma.custom_achievements.update).not.toHaveBeenCalled();
  });

  it("rolls back the check-in when the achievement update fails", async () => {
    mockPrisma.custom_achievements.findFirst.mockResolvedValue(achievement({ progress: 1 }));
    mockPrisma.custom_achievements.update.mockRejectedValue(new Error("update failed"));
    await expect(addAchievementCheckIn(userId, achId, { value: 1 })).rejects.toThrow("update failed");
  });
});
