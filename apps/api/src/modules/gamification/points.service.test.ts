import { Prisma } from "@prisma/client";

const mockPrisma = {
  point_transactions: {
    create: jest.fn(),
    aggregate: jest.fn(),
    findMany: jest.fn(),
  },
};

jest.mock("../../lib/prisma", () => ({
  __esModule: true,
  default: mockPrisma,
}));

import {
  getUserPointsSummary,
  getUserTotalPoints,
  recordPointTransaction,
} from "./points.service";
import { POINT_SOURCE_TYPES } from "./rewards.constants";

const p2002 = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "5.22.0",
  });

describe("gamification/points.service", () => {
  const userId = "user-1";

  beforeEach(() => jest.clearAllMocks());

  it("derives total points from the ledger sum (0 when empty)", async () => {
    mockPrisma.point_transactions.aggregate.mockResolvedValue({ _sum: { points: null } });
    expect(await getUserTotalPoints(userId)).toBe(0);

    mockPrisma.point_transactions.aggregate.mockResolvedValue({ _sum: { points: 130 } });
    expect(await getUserTotalPoints(userId)).toBe(130);
  });

  it("builds a points summary with derived level info", async () => {
    mockPrisma.point_transactions.aggregate.mockResolvedValue({ _sum: { points: 160 } });
    const summary = await getUserPointsSummary(userId);
    expect(summary.totalPoints).toBe(160);
    expect(summary.level).toBe(2);
    expect(summary.levelProgressPercentage).toBe(60);
  });

  it("records a new transaction", async () => {
    mockPrisma.point_transactions.create.mockResolvedValue({ id: "t1" });
    const res = await recordPointTransaction(mockPrisma as never, {
      userId,
      sourceType: POINT_SOURCE_TYPES.PERSONAL_GOAL_COMPLETION,
      sourceItemId: "goal-1",
      points: 20,
      reason: "personal_goal_completion",
    });
    expect(res.inserted).toBe(true);
    expect(mockPrisma.point_transactions.create).toHaveBeenCalledTimes(1);
  });

  it("is idempotent: a duplicate insert (P2002) is a no-op, not a double award", async () => {
    mockPrisma.point_transactions.create.mockRejectedValue(p2002());
    const res = await recordPointTransaction(mockPrisma as never, {
      userId,
      sourceType: POINT_SOURCE_TYPES.PERSONAL_GOAL_COMPLETION,
      sourceItemId: "goal-1",
      points: 20,
      reason: "personal_goal_completion",
    });
    expect(res.inserted).toBe(false);
    expect(res.transaction).toBeNull();
  });

  it("rethrows non-uniqueness errors", async () => {
    mockPrisma.point_transactions.create.mockRejectedValue(new Error("db down"));
    await expect(
      recordPointTransaction(mockPrisma as never, {
        userId,
        sourceType: POINT_SOURCE_TYPES.PERSONAL_GOAL_COMPLETION,
        sourceItemId: "goal-1",
        points: 20,
        reason: "x",
      })
    ).rejects.toThrow("db down");
  });
});
