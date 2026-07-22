import { Prisma } from "@prisma/client";

const mockPrisma = {
  $transaction: jest.fn(),
  personal_goals: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  profiles: {
    findUnique: jest.fn(),
  },
  goal_check_ins: {
    create: jest.fn(),
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

import { addGoalCheckIn, DuplicateCheckInError } from "./goals.service";

const userId = "user-1";
const goalId = "goal-1";

const p2002 = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "5.22.0",
  });

function goal(overrides: Record<string, unknown> = {}) {
  return {
    id: goalId,
    user_id: userId,
    status: "active",
    reward_awarded: false,
    progress_percentage: 0,
    tracking_type: "count",
    current_value: 0,
    target_value: 10,
    ...overrides,
  };
}

describe("goal check-in (backend-derived progress, value/milestone)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) =>
      fn(mockPrisma)
    );
    mockPrisma.profiles.findUnique.mockResolvedValue({ timezone: "UTC" });
    mockPrisma.goal_check_ins.create.mockResolvedValue({ id: "c1", created_at: new Date() });
    mockPrisma.personal_goals.update.mockResolvedValue({ id: goalId });
    mockPrisma.point_transactions.create.mockResolvedValue({ id: "t1" });
    mockPrisma.point_transactions.aggregate.mockResolvedValue({ _sum: { points: 20 } });
  });

  it("returns null when the goal is not owned", async () => {
    mockPrisma.personal_goals.findFirst.mockResolvedValue(null);
    expect(await addGoalCheckIn(userId, goalId, { value: 1 })).toBeNull();
    expect(mockPrisma.goal_check_ins.create).not.toHaveBeenCalled();
  });

  it("derives COUNT progress from the submitted value + stored target", async () => {
    mockPrisma.personal_goals.findFirst.mockResolvedValue(goal({ current_value: 2, target_value: 10 }));
    await addGoalCheckIn(userId, goalId, { value: 3 });
    // (2 + 3) / 10 = 50%
    expect(mockPrisma.goal_check_ins.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ progress_after: 50, value_added: 3, progress_percentage: 50 }),
      })
    );
    expect(mockPrisma.point_transactions.create).not.toHaveBeenCalled();
  });

  it("derives DURATION progress (e.g. minutes)", async () => {
    mockPrisma.personal_goals.findFirst.mockResolvedValue(
      goal({ tracking_type: "duration", current_value: 30, target_value: 60 })
    );
    await addGoalCheckIn(userId, goalId, { value: 15 });
    expect(mockPrisma.goal_check_ins.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ progress_after: 75 }) })
    );
  });

  it("derives AMOUNT progress (e.g. dollars)", async () => {
    mockPrisma.personal_goals.findFirst.mockResolvedValue(
      goal({ tracking_type: "amount", current_value: 200, target_value: 1000 })
    );
    await addGoalCheckIn(userId, goalId, { value: 50 });
    expect(mockPrisma.goal_check_ins.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ progress_after: 25 }) })
    );
  });

  it("derives MANUAL milestone progress and stores the milestone", async () => {
    mockPrisma.personal_goals.findFirst.mockResolvedValue(
      goal({ tracking_type: "manual_milestone", current_value: 0, target_value: null })
    );
    await addGoalCheckIn(userId, goalId, { milestone: "making_progress" });
    expect(mockPrisma.goal_check_ins.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ progress_after: 50, milestone: "making_progress" }),
      })
    );
  });

  it("rejects a check-in with neither value nor milestone (client percentage is not accepted)", async () => {
    mockPrisma.personal_goals.findFirst.mockResolvedValue(goal());
    await expect(addGoalCheckIn(userId, goalId, {} as never)).rejects.toThrow();
    expect(mockPrisma.goal_check_ins.create).not.toHaveBeenCalled();
  });

  it("awards 20 points once when progress reaches 100%", async () => {
    mockPrisma.personal_goals.findFirst.mockResolvedValue(
      goal({ current_value: 10, target_value: 10, progress_percentage: 100 })
    );
    const res = await addGoalCheckIn(userId, goalId, { value: 1 });
    expect(mockPrisma.point_transactions.create).toHaveBeenCalledTimes(1);
    const completion = (res as { completion: { awarded: boolean; points: { totalPoints: number } } }).completion;
    expect(completion.awarded).toBe(true);
    expect(completion.points.totalPoints).toBe(20);
  });

  it("enforces one check-in per calendar day (DB unique -> DuplicateCheckInError)", async () => {
    mockPrisma.personal_goals.findFirst.mockResolvedValue(goal());
    mockPrisma.goal_check_ins.create.mockRejectedValue(p2002());
    await expect(addGoalCheckIn(userId, goalId, { value: 1 })).rejects.toBeInstanceOf(
      DuplicateCheckInError
    );
    expect(mockPrisma.personal_goals.update).not.toHaveBeenCalled();
  });

  it("rolls back the check-in when the goal update fails", async () => {
    mockPrisma.personal_goals.findFirst.mockResolvedValue(goal());
    mockPrisma.personal_goals.update.mockRejectedValue(new Error("update failed"));
    await expect(addGoalCheckIn(userId, goalId, { value: 1 })).rejects.toThrow("update failed");
  });
});
