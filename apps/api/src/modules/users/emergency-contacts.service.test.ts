const mockPrisma = {
  emergency_contacts: {
    findMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  profiles: {
    findUnique: jest.fn(),
  },
};

jest.mock("../../lib/prisma", () => ({
  __esModule: true,
  default: mockPrisma,
}));

import {
  createEmergencyContact,
  deleteEmergencyContact,
  getEmergencyContacts,
  updateEmergencyContact,
} from "./emergency-contacts.service";

describe("emergency-contacts.service", () => {
  const userId = "user-1";
  const contactId = "contact-1";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates an emergency contact", async () => {
    mockPrisma.emergency_contacts.create.mockResolvedValue({ id: contactId });
    const created = await createEmergencyContact(userId, {
      name: "Jane",
      phone: "123",
      is_trusted: false,
    });
    expect(created).toEqual({ id: contactId });
  });

  it("lists emergency contacts", async () => {
    mockPrisma.emergency_contacts.findMany.mockResolvedValue([{ id: contactId }]);
    const result = await getEmergencyContacts(userId);
    expect(result).toEqual([{ id: contactId }]);
  });

  it("updates only owned contact", async () => {
    mockPrisma.emergency_contacts.findFirst.mockResolvedValue({ id: contactId, user_id: userId });
    mockPrisma.emergency_contacts.update.mockResolvedValue({ id: contactId, name: "Updated" });
    const updated = await updateEmergencyContact(userId, contactId, { name: "Updated" });
    expect(updated).toEqual({ id: contactId, name: "Updated" });
  });

  it("deletes only owned contact", async () => {
    mockPrisma.emergency_contacts.findFirst.mockResolvedValue({ id: contactId, user_id: userId });
    mockPrisma.emergency_contacts.delete.mockResolvedValue({ id: contactId });
    await deleteEmergencyContact(userId, contactId);
    expect(mockPrisma.emergency_contacts.delete).toHaveBeenCalledWith({ where: { id: contactId } });
  });
});
