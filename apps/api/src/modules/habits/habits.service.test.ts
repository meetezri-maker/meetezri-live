const mockPrisma = {
  profiles: { findUnique: jest.fn() },
  habits: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  habit_logs: {
    create: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
};

jest.mock("../../lib/prisma", () => ({
  __esModule: true,
  default: mockPrisma,
}));

import { createHabit, getHabits, updateHabit, deleteHabit } from "./habits.service";

describe("habits.service", () => {
  const userId = "user-1";
  const habitId = "habit-1";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a habit for an existing profile", async () => {
    mockPrisma.profiles.findUnique.mockResolvedValue({ id: userId });
    mockPrisma.habits.create.mockResolvedValue({ id: habitId });
    const created = await createHabit(userId, { name: "Meditate", frequency: "daily" });
    expect(created).toEqual({ id: habitId });
  });

  it("lists habits by user", async () => {
    mockPrisma.habits.findMany.mockResolvedValue([{ id: habitId }]);
    const result = await getHabits(userId);
    expect(result).toEqual([{ id: habitId }]);
  });

  it("updates habit only when owned", async () => {
    mockPrisma.habits.findFirst.mockResolvedValue({ id: habitId, user_id: userId });
    mockPrisma.habits.update.mockResolvedValue({ id: habitId, name: "Updated" });
    const updated = await updateHabit(userId, habitId, { name: "Updated" });
    expect(updated).toEqual({ id: habitId, name: "Updated" });
  });

  it("deletes habit only when owned", async () => {
    mockPrisma.habits.findFirst.mockResolvedValue({ id: habitId, user_id: userId });
    mockPrisma.habits.delete.mockResolvedValue({ id: habitId });
    await deleteHabit(userId, habitId);
    expect(mockPrisma.habits.delete).toHaveBeenCalledWith({ where: { id: habitId } });
  });
});
