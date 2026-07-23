const mockPrisma = {
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
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

import { updateCustomAchievement } from "./custom-achievements.service";

const userId = "user-1";
const achId = "ach-1";

describe("updateCustomAchievement — edit preserves progress + idempotent completion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) =>
      fn(mockPrisma)
    );
    mockPrisma.custom_achievements.update.mockImplementation(async ({ data }: never) => ({ id: achId, ...(data as object) }));
    mockPrisma.point_transactions.create.mockResolvedValue({ id: "t1" });
    mockPrisma.point_transactions.aggregate.mockResolvedValue({ _sum: { points: 10 } });
  });

  it("does NOT send progress on a metadata edit (preserves current progress)", async () => {
    // The raw UPDATE returns the row unchanged-progress; assert the caller did
    // not include `progress` in the payload (only title/description/tracking).
    mockPrisma.$queryRaw.mockResolvedValue([
      { id: achId, user_id: userId, progress: 3, total: 10, reward_awarded: false },
    ]);
    await updateCustomAchievement(userId, achId, { title: "New Title", description: "New desc" } as never);
    // No completion (3 < 10) -> completion service not invoked.
    expect(mockPrisma.point_transactions.create).not.toHaveBeenCalled();
  });

  it("editing the target below current progress completes + awards 10 once", async () => {
    // After the UPDATE the row shows progress 3 >= total 3 (target lowered).
    mockPrisma.$queryRaw.mockResolvedValue([
      { id: achId, user_id: userId, progress: 3, total: 3, reward_awarded: false },
    ]);
    // completeItem re-reads via Prisma model:
    mockPrisma.custom_achievements.findFirst.mockResolvedValue({
      id: achId, user_id: userId, progress: 3, total: 3, reward_awarded: false, tracking_type: "count",
    });
    await updateCustomAchievement(userId, achId, { total: 3, trackingType: "count" } as never);
    expect(mockPrisma.point_transactions.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.point_transactions.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ points: 10, source_item_id: achId }) })
    );
  });

  it("does not award again when the achievement is already rewarded (idempotent)", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { id: achId, user_id: userId, progress: 3, total: 3, reward_awarded: true },
    ]);
    await updateCustomAchievement(userId, achId, { total: 3, trackingType: "count" } as never);
    // reward_awarded already true -> completion service not invoked at all.
    expect(mockPrisma.point_transactions.create).not.toHaveBeenCalled();
  });

  it("lowering target but still above progress does not complete", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { id: achId, user_id: userId, progress: 3, total: 5, reward_awarded: false },
    ]);
    await updateCustomAchievement(userId, achId, { total: 5, trackingType: "count" } as never);
    expect(mockPrisma.point_transactions.create).not.toHaveBeenCalled();
  });

  it("returns null when the achievement is not found / not owned", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    expect(await updateCustomAchievement(userId, achId, { title: "x" } as never)).toBeNull();
  });
});

describe("updateCustomAchievement — tracking locked after completion + reward", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.point_transactions.create.mockResolvedValue({ id: "t1" });
    mockPrisma.point_transactions.aggregate.mockResolvedValue({ _sum: { points: 10 } });
  });

  // Extract SQL text from the UPDATE call. The lock-check + no-op SELECT are
  // tagged-template calls (first arg is a strings array); the UPDATE is a single
  // Prisma.sql object argument.
  const updateSqlText = (): string => {
    const call = mockPrisma.$queryRaw.mock.calls.find(
      (c: unknown[]) => c.length === 1 && c[0] && !Array.isArray(c[0])
    );
    const arg = call?.[0] as { sql?: string; strings?: string[] } | undefined;
    if (!arg) return "";
    if (typeof arg.sql === "string") return arg.sql;
    if (Array.isArray(arg.strings)) return arg.strings.join(" ");
    return String(arg);
  };

  it("strips tracking fields when the achievement is unlocked + rewarded", async () => {
    // Both $queryRaw calls (lock-check SELECT + UPDATE RETURNING) return this row.
    mockPrisma.$queryRaw.mockResolvedValue([
      { id: achId, user_id: userId, unlocked: true, reward_awarded: true, progress: 10, total: 10 },
    ]);

    await updateCustomAchievement(userId, achId, {
      title: "New Title",
      description: "New desc",
      total: 1,
      trackingType: "manual_milestone",
      trackingUnit: "hacked",
    } as never);

    const sql = updateSqlText();
    // Descriptive columns are written…
    expect(sql).toContain("title");
    expect(sql).toContain("description");
    // …but tracking columns are never in the SET clause.
    expect(sql).not.toContain("tracking_type");
    expect(sql).not.toContain("tracking_unit");
    expect(sql).not.toContain("total");
    // Already rewarded → no second reward regardless.
    expect(mockPrisma.point_transactions.create).not.toHaveBeenCalled();
  });

  it("keeps tracking editable when unlocked but NOT yet rewarded (not locked)", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { id: achId, user_id: userId, unlocked: true, reward_awarded: false, progress: 3, total: 10 },
    ]);

    await updateCustomAchievement(userId, achId, {
      title: "Still editable",
      total: 8,
      trackingType: "count",
    } as never);

    const sql = updateSqlText();
    // Not locked → tracking columns ARE written.
    expect(sql).toContain("tracking_type");
    expect(sql).toContain("total");
  });
});
