const mockPrisma = {
  personal_goals: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock("../../lib/prisma", () => ({
  __esModule: true,
  default: mockPrisma,
}));

import { updateGoal, updateGoalStatus, DirectCompletionError } from "./goals.service";

const userId = "user-1";

describe("completion path guards (only the completion service can complete)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.personal_goals.update.mockResolvedValue({ id: "g" });
  });

  it("rejects setting status=completed via updateGoalStatus", async () => {
    // Unique id per test to avoid the module-level getGoalById cache.
    mockPrisma.personal_goals.findFirst.mockResolvedValue({ id: "g-a", user_id: userId, status: "active" });
    await expect(updateGoalStatus(userId, "g-a", { status: "completed" } as never)).rejects.toBeInstanceOf(
      DirectCompletionError
    );
    expect(mockPrisma.personal_goals.update).not.toHaveBeenCalled();
  });

  it("rejects setting status=completed via updateGoal patch", async () => {
    mockPrisma.personal_goals.findFirst.mockResolvedValue({ id: "g-b", user_id: userId, status: "active" });
    await expect(updateGoal(userId, "g-b", { status: "completed" } as never)).rejects.toBeInstanceOf(
      DirectCompletionError
    );
    expect(mockPrisma.personal_goals.update).not.toHaveBeenCalled();
  });

  it("allows non-completion status transitions (e.g. paused)", async () => {
    mockPrisma.personal_goals.findFirst.mockResolvedValue({ id: "g-c", user_id: userId, status: "active" });
    await updateGoalStatus(userId, "g-c", { status: "paused" } as never);
    expect(mockPrisma.personal_goals.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "paused" }) })
    );
  });

  it("does not treat an already-completed goal as a new completion", async () => {
    mockPrisma.personal_goals.findFirst.mockResolvedValue({ id: "g-d", user_id: userId, status: "completed" });
    await updateGoalStatus(userId, "g-d", { status: "completed" } as never);
    expect(mockPrisma.personal_goals.update).toHaveBeenCalled();
  });
});
