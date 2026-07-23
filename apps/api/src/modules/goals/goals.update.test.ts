const mockPrisma = {
  $transaction: jest.fn(),
  personal_goals: {
    findFirst: jest.fn(),
    update: jest.fn(),
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

import { updateGoal } from "./goals.service";

const userId = "user-1";
const goalId = "f9556627-d5c4-4cd6-bbde-a759d4224222";

describe("updateGoal — edit target recompute + idempotent completion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) =>
      fn(mockPrisma)
    );
    mockPrisma.personal_goals.update.mockImplementation(async ({ data }: never) => ({ id: goalId, ...(data as object) }));
    mockPrisma.point_transactions.create.mockResolvedValue({ id: "t1" });
    mockPrisma.point_transactions.aggregate.mockResolvedValue({ _sum: { points: 20 } });
  });

  it("editing target 10 -> 1 with current 1 completes the goal and awards 20 once", async () => {
    // 1st findFirst: ownership read (pre-edit target 10). 2nd findFirst: the
    // completion service re-read (post-edit target 1) -> 100%.
    mockPrisma.personal_goals.findFirst
      .mockResolvedValueOnce({ id: goalId, user_id: userId, status: "active", reward_awarded: false, tracking_type: "count", current_value: 1, target_value: 10, progress_percentage: 10 })
      .mockResolvedValue({ id: goalId, user_id: userId, status: "active", reward_awarded: false, tracking_type: "count", current_value: 1, target_value: 1, progress_percentage: 100 });

    await updateGoal(userId, goalId, { tracking_type: "count", target_value: 1 } as never);

    // Progress recomputed to 100 on the update, then completion awards 20 once.
    expect(mockPrisma.personal_goals.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: goalId }, data: expect.objectContaining({ progress_percentage: 100 }) })
    );
    expect(mockPrisma.point_transactions.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.point_transactions.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ points: 20, source_item_id: goalId }) })
    );
  });

  it("does not award a second reward when the goal was already rewarded (idempotent)", async () => {
    mockPrisma.personal_goals.findFirst
      .mockResolvedValueOnce({ id: goalId, user_id: userId, status: "completed", reward_awarded: true, tracking_type: "count", current_value: 1, target_value: 10, progress_percentage: 100 })
      .mockResolvedValue({ id: goalId, user_id: userId, status: "completed", reward_awarded: true, tracking_type: "count", current_value: 1, target_value: 1, progress_percentage: 100 });

    await updateGoal(userId, goalId, { tracking_type: "count", target_value: 1 } as never);

    expect(mockPrisma.point_transactions.create).not.toHaveBeenCalled();
  });

  it("editing target 10 -> 5 with current 1 stays incomplete (20%), no reward", async () => {
    mockPrisma.personal_goals.findFirst.mockResolvedValue({ id: goalId, user_id: userId, status: "active", reward_awarded: false, tracking_type: "count", current_value: 1, target_value: 5, progress_percentage: 10 });

    await updateGoal(userId, goalId, { tracking_type: "count", target_value: 5 } as never);

    expect(mockPrisma.personal_goals.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ progress_percentage: 20 }) })
    );
    expect(mockPrisma.point_transactions.create).not.toHaveBeenCalled();
  });

  it("updates the SAME goal id (never creates a new goal)", async () => {
    mockPrisma.personal_goals.findFirst.mockResolvedValue({ id: goalId, user_id: userId, status: "active", reward_awarded: false, tracking_type: "count", current_value: 0, target_value: 10, progress_percentage: 0 });

    await updateGoal(userId, goalId, { goal_title: "Renamed", tracking_type: "count", target_value: 10 } as never);

    expect(mockPrisma.personal_goals.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: goalId } })
    );
  });

  it("returns null for a goal the user does not own", async () => {
    mockPrisma.personal_goals.findFirst.mockResolvedValue(null);
    expect(await updateGoal(userId, goalId, { goal_title: "x" } as never)).toBeNull();
    expect(mockPrisma.personal_goals.update).not.toHaveBeenCalled();
  });
});

describe("updateGoal — tracking locked after completion + reward", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) =>
      fn(mockPrisma)
    );
    mockPrisma.personal_goals.update.mockImplementation(async ({ data }: never) => ({ id: goalId, ...(data as object) }));
    mockPrisma.point_transactions.create.mockResolvedValue({ id: "t1" });
    mockPrisma.point_transactions.aggregate.mockResolvedValue({ _sum: { points: 20 } });
  });

  it("ignores tracking changes on a completed + rewarded goal (progress unchanged, no re-reward)", async () => {
    mockPrisma.personal_goals.findFirst.mockResolvedValue({
      id: goalId, user_id: userId, status: "completed", reward_awarded: true,
      tracking_type: "count", current_value: 10, target_value: 10, progress_percentage: 100,
    });

    await updateGoal(userId, goalId, {
      goal_description: "New description",
      tracking_type: "manual_milestone",
      target_value: 999,
      tracking_unit: "hacked",
    } as never);

    const data = (mockPrisma.personal_goals.update.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    // Descriptive edit applied…
    expect(data.goal_description).toBe("New description");
    // …but every tracking field is omitted, and progress is never recomputed.
    expect(data.tracking_type).toBeUndefined();
    expect(data.target_value).toBeUndefined();
    expect(data.tracking_unit).toBeUndefined();
    expect(data.progress_percentage).toBeUndefined();
    // No completion path runs → no second reward.
    expect(mockPrisma.point_transactions.create).not.toHaveBeenCalled();
  });

  it("still applies tracking changes when completed but NOT yet rewarded (not locked)", async () => {
    mockPrisma.personal_goals.findFirst.mockResolvedValue({
      id: goalId, user_id: userId, status: "completed", reward_awarded: false,
      tracking_type: "count", current_value: 2, target_value: 10, progress_percentage: 20,
    });

    await updateGoal(userId, goalId, { tracking_type: "count", target_value: 4 } as never);

    const data = (mockPrisma.personal_goals.update.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    // Not locked → target applies and progress recomputes (2/4 = 50%).
    expect(data.progress_percentage).toBe(50);
  });

  it("keeps descriptive-only edits working on a locked goal", async () => {
    mockPrisma.personal_goals.findFirst.mockResolvedValue({
      id: goalId, user_id: userId, status: "completed", reward_awarded: true,
      tracking_type: "count", current_value: 10, target_value: 10, progress_percentage: 100,
    });

    const result = await updateGoal(userId, goalId, { goal_title: "Renamed" } as never);
    expect(result).toBeTruthy();
    const data = (mockPrisma.personal_goals.update.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.goal_title).toBe("Renamed");
  });
});
