import { Prisma } from "@prisma/client";

const mockPrisma = {
  $transaction: jest.fn(),
  personal_goals: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  custom_achievements: {
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

import { completeItem } from "./completion.service";
import {
  PERSONAL_ACHIEVEMENT_COMPLETION_POINTS,
  PERSONAL_GOAL_COMPLETION_POINTS,
  POINT_SOURCE_TYPES,
} from "./rewards.constants";

const userId = "user-1";

const p2002 = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "5.22.0",
  });

function setTotal(points: number) {
  mockPrisma.point_transactions.aggregate.mockResolvedValue({ _sum: { points } });
}

describe("gamification/completion.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Run the interactive transaction against the mock client.
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) =>
      fn(mockPrisma)
    );
    mockPrisma.personal_goals.update.mockImplementation(async ({ data }: never) => ({ id: "goal-1", ...(data as object) }));
    mockPrisma.custom_achievements.update.mockImplementation(async ({ data }: never) => ({ id: "ach-1", ...(data as object) }));
  });

  it("awards exactly 20 points when a goal reaches 100%", async () => {
    mockPrisma.personal_goals.findFirst.mockResolvedValue({
      id: "goal-1",
      user_id: userId,
      progress_percentage: 100,
      reward_awarded: false,
      tracking_type: "manual_milestone",
    });
    mockPrisma.point_transactions.create.mockResolvedValue({ id: "t1" });
    setTotal(PERSONAL_GOAL_COMPLETION_POINTS);

    const res = await completeItem({ userId, itemType: "personal_goal", itemId: "goal-1" });

    expect(res.completed).toBe(true);
    expect(res.awarded).toBe(true);
    expect(res.points?.totalPoints).toBe(20);
    expect(mockPrisma.point_transactions.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.point_transactions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          points: PERSONAL_GOAL_COMPLETION_POINTS,
          source_type: POINT_SOURCE_TYPES.PERSONAL_GOAL_COMPLETION,
          source_item_id: "goal-1",
          user_id: userId,
        }),
      })
    );
  });

  it("awards exactly 10 points when an achievement reaches 100%", async () => {
    mockPrisma.custom_achievements.findFirst.mockResolvedValue({
      id: "ach-1",
      user_id: userId,
      progress: 5,
      total: 5,
      reward_awarded: false,
    });
    mockPrisma.point_transactions.create.mockResolvedValue({ id: "t2" });
    setTotal(PERSONAL_ACHIEVEMENT_COMPLETION_POINTS);

    const res = await completeItem({ userId, itemType: "personal_achievement", itemId: "ach-1" });

    expect(res.awarded).toBe(true);
    expect(res.points?.totalPoints).toBe(10);
    expect(mockPrisma.point_transactions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ points: PERSONAL_ACHIEVEMENT_COMPLETION_POINTS }),
      })
    );
  });

  it("does not award points before 100%", async () => {
    mockPrisma.personal_goals.findFirst.mockResolvedValue({
      id: "goal-1",
      user_id: userId,
      progress_percentage: 50,
      reward_awarded: false,
      tracking_type: "manual_milestone",
    });
    setTotal(0);

    const res = await completeItem({ userId, itemType: "personal_goal", itemId: "goal-1" });

    expect(res.completed).toBe(false);
    expect(res.reason).toBe("not_complete");
    expect(res.awarded).toBe(false);
    expect(mockPrisma.point_transactions.create).not.toHaveBeenCalled();
    expect(mockPrisma.personal_goals.update).not.toHaveBeenCalled();
  });

  it("cannot award the same item twice (reward_awarded already true)", async () => {
    mockPrisma.personal_goals.findFirst.mockResolvedValue({
      id: "goal-1",
      user_id: userId,
      progress_percentage: 100,
      reward_awarded: true,
      tracking_type: "manual_milestone",
    });
    setTotal(PERSONAL_GOAL_COMPLETION_POINTS);

    const res = await completeItem({ userId, itemType: "personal_goal", itemId: "goal-1" });

    expect(res.awarded).toBe(false);
    expect(res.alreadyRewarded).toBe(true);
    expect(res.points?.totalPoints).toBe(20);
    expect(mockPrisma.point_transactions.create).not.toHaveBeenCalled();
  });

  it("concurrent completion cannot duplicate the reward (ledger P2002 wins)", async () => {
    mockPrisma.personal_goals.findFirst.mockResolvedValue({
      id: "goal-1",
      user_id: userId,
      progress_percentage: 100,
      reward_awarded: false,
      tracking_type: "manual_milestone",
    });
    // The losing racer's insert violates the unique constraint.
    mockPrisma.point_transactions.create.mockRejectedValue(p2002());
    setTotal(PERSONAL_GOAL_COMPLETION_POINTS); // only ONE row exists

    const res = await completeItem({ userId, itemType: "personal_goal", itemId: "goal-1" });

    expect(res.awarded).toBe(false);
    expect(res.alreadyRewarded).toBe(true);
    expect(res.points?.totalPoints).toBe(20); // not 40
  });

  it("rejects completion of an item the user does not own", async () => {
    mockPrisma.personal_goals.findFirst.mockResolvedValue(null);

    const res = await completeItem({ userId, itemType: "personal_goal", itemId: "someone-elses" });

    expect(res.reason).toBe("not_found");
    expect(res.item).toBeNull();
    expect(mockPrisma.point_transactions.create).not.toHaveBeenCalled();
    // Ownership is enforced in the query: findFirst was scoped by user_id.
    expect(mockPrisma.personal_goals.findFirst).toHaveBeenCalledWith({
      where: { id: "someone-elses", user_id: userId },
    });
  });
});
