const mockPrisma = {
  sleep_entries: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

jest.mock("../../lib/prisma", () => ({
  __esModule: true,
  default: mockPrisma,
}));

import {
  createSleepEntry,
  getSleepEntries,
  updateSleepEntry,
  deleteSleepEntry,
} from "./sleep.service";

describe("sleep.service", () => {
  const userId = "user-1";
  const id = "sleep-1";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a sleep entry", async () => {
    mockPrisma.sleep_entries.create.mockResolvedValue({ id });
    await createSleepEntry(userId, { bed_time: "2026-03-01T22:00:00.000Z", wake_time: "2026-03-02T06:00:00.000Z" });
    expect(mockPrisma.sleep_entries.create).toHaveBeenCalled();
  });

  it("lists sleep entries for a user", async () => {
    mockPrisma.sleep_entries.findMany.mockResolvedValue([{ id }]);
    const result = await getSleepEntries(userId);
    expect(result).toEqual([{ id }]);
  });

  it("updates only owned sleep entries", async () => {
    mockPrisma.sleep_entries.findFirst.mockResolvedValue({ id, user_id: userId });
    mockPrisma.sleep_entries.update.mockResolvedValue({ id, notes: "ok" });
    const updated = await updateSleepEntry(userId, id, { notes: "ok" });
    expect(updated).toEqual({ id, notes: "ok" });
  });

  it("deletes only owned sleep entries", async () => {
    mockPrisma.sleep_entries.findFirst.mockResolvedValue({ id, user_id: userId });
    mockPrisma.sleep_entries.delete.mockResolvedValue({ id });
    await deleteSleepEntry(userId, id);
    expect(mockPrisma.sleep_entries.delete).toHaveBeenCalledWith({ where: { id } });
  });
});
