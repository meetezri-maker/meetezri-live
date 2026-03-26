const mockPrisma = {
  wellness_tools: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  favorite_wellness_tools: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  user_wellness_progress: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock("../../lib/prisma", () => ({
  __esModule: true,
  default: mockPrisma,
}));

import {
  createWellnessTool,
  getWellnessTools,
  updateWellnessTool,
  deleteWellnessTool,
  completeWellnessSession,
} from "./wellness.service";

describe("wellness.service", () => {
  const userId = "user-1";
  const toolId = "tool-1";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a wellness tool", async () => {
    mockPrisma.wellness_tools.create.mockResolvedValue({ id: toolId });
    const created = await createWellnessTool({
      title: "Breathing",
      category: "mindfulness",
      is_premium: false,
      status: "draft",
    });
    expect(created).toEqual({ id: toolId });
  });

  it("lists wellness tools", async () => {
    mockPrisma.wellness_tools.findMany.mockResolvedValue([]);
    const tools = await getWellnessTools(userId);
    expect(Array.isArray(tools)).toBe(true);
  });

  it("updates a wellness tool", async () => {
    mockPrisma.wellness_tools.update.mockResolvedValue({ id: toolId, title: "Updated" });
    const updated = await updateWellnessTool(toolId, { title: "Updated" });
    expect(updated).toEqual({ id: toolId, title: "Updated" });
  });

  it("deletes a wellness tool", async () => {
    mockPrisma.wellness_tools.delete.mockResolvedValue({ id: toolId });
    await deleteWellnessTool(toolId);
    expect(mockPrisma.wellness_tools.delete).toHaveBeenCalledWith({ where: { id: toolId } });
  });

  it("completes session only when owned by user", async () => {
    mockPrisma.user_wellness_progress.findFirst.mockResolvedValue({ id: "p1", user_id: userId });
    mockPrisma.user_wellness_progress.update.mockResolvedValue({ id: "p1", user_id: userId });
    const result = await completeWellnessSession(userId, "p1", 300, 5);
    expect(result).toEqual({ id: "p1", user_id: userId });
  });
});
