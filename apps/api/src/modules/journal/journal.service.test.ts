const mockPrisma = {
  journal_entries: {
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
  createJournalEntry,
  getJournalEntries,
  updateJournalEntry,
  deleteJournalEntry,
} from "./journal.service";

describe("journal.service", () => {
  const userId = "user-1";
  const id = "journal-1";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a journal entry", async () => {
    mockPrisma.journal_entries.create.mockResolvedValue({ id });
    const created = await createJournalEntry(userId, { content: "entry" });
    expect(mockPrisma.journal_entries.create).toHaveBeenCalled();
    expect(created).toEqual({ id });
  });

  it("lists journal entries for a user", async () => {
    mockPrisma.journal_entries.findMany.mockResolvedValue([{ id }]);
    const result = await getJournalEntries(userId);
    expect(mockPrisma.journal_entries.findMany).toHaveBeenCalledWith({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
    });
    expect(result).toEqual([{ id }]);
  });

  it("updates a journal entry only when owned by user", async () => {
    mockPrisma.journal_entries.findFirst.mockResolvedValue({ id, user_id: userId });
    mockPrisma.journal_entries.update.mockResolvedValue({ id, title: "updated" });
    const result = await updateJournalEntry(userId, id, { title: "updated" });
    expect(result).toEqual({ id, title: "updated" });
  });

  it("deletes a journal entry only when owned by user", async () => {
    mockPrisma.journal_entries.findFirst.mockResolvedValue({ id, user_id: userId });
    mockPrisma.journal_entries.delete.mockResolvedValue({ id });
    await deleteJournalEntry(userId, id);
    expect(mockPrisma.journal_entries.delete).toHaveBeenCalledWith({ where: { id } });
  });
});
