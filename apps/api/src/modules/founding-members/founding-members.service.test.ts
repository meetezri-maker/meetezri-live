const mockPrisma = {
  founding_members: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

jest.mock("../../lib/prisma", () => ({
  __esModule: true,
  default: mockPrisma,
}));

const sendEmail = jest.fn();
const buildFoundingCircleWelcomeEmail = jest.fn(() => ({
  subject: "Welcome to the Solace Founding Circle",
  html: "<p>hi</p>",
  text: "hi",
}));

jest.mock("../email/email.service", () => ({
  emailService: {
    sendEmail: (...a: unknown[]) => sendEmail(...a),
    buildFoundingCircleWelcomeEmail: (...a: unknown[]) =>
      buildFoundingCircleWelcomeEmail(...(a as [])),
  },
}));

import {
  FOUNDING_MEMBER_DISCOUNT_PERCENTAGE,
  normalizeEmail,
  registerFoundingMember,
} from "./founding-members.service";
import { foundingMemberSignupBodySchema } from "./founding-members.schema";

describe("founding-members.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.founding_members.findUnique.mockResolvedValue(null);
    mockPrisma.founding_members.create.mockResolvedValue({ id: "fm-1" });
    sendEmail.mockResolvedValue({ messageId: "m1" });
  });

  it("normalizes email casing and surrounding whitespace", () => {
    expect(normalizeEmail(" User@Example.com ")).toBe("user@example.com");
  });

  it("creates a new lead with the approved Founding Member defaults", async () => {
    const result = await registerFoundingMember({
      email: " Person@Example.COM ",
      firstName: "  Alex  ",
    });

    expect(result).toEqual({
      success: true,
      status: "created",
      message: "Welcome to the Founding Circle.",
    });

    const data = mockPrisma.founding_members.create.mock.calls[0][0].data;
    expect(data.email).toBe("person@example.com");
    expect(data.first_name).toBe("Alex");
    expect(data.status).toBe("waiting");
    expect(data.source).toBe("prelaunch_landing_page");
    expect(data.founding_member).toBe(true);
    expect(data.discount_percentage).toBe(FOUNDING_MEMBER_DISCOUNT_PERCENTAGE);
  });

  it("stores UTM attribution fields", async () => {
    await registerFoundingMember({
      email: "person@example.com",
      utmSource: "instagram",
      utmMedium: "paid_social",
      utmCampaign: "solace_prelaunch",
      utmContent: "founder_video",
      utmTerm: null,
      referrer: "https://example.com",
      landingPage: "/early-access",
      campaign: "solace_prelaunch",
      consentSource: "prelaunch_founding_member_form",
    });

    const data = mockPrisma.founding_members.create.mock.calls[0][0].data;
    expect(data.utm_source).toBe("instagram");
    expect(data.utm_medium).toBe("paid_social");
    expect(data.utm_campaign).toBe("solace_prelaunch");
    expect(data.utm_content).toBe("founder_video");
    expect(data.utm_term).toBeNull();
    expect(data.referrer).toBe("https://example.com");
    expect(data.landing_page).toBe("/early-access");
    expect(data.consent_source).toBe("prelaunch_founding_member_form");
  });

  it("treats a known email as success without writing a duplicate", async () => {
    mockPrisma.founding_members.findUnique.mockResolvedValue({ id: "fm-1" });

    const result = await registerFoundingMember({ email: "PERSON@example.com" });

    expect(result).toEqual({
      success: true,
      status: "existing",
      message: "You are already part of the Founding Circle.",
    });
    expect(mockPrisma.founding_members.create).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("folds a concurrent unique-constraint race into the existing response", async () => {
    mockPrisma.founding_members.create.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
    );

    const result = await registerFoundingMember({ email: "person@example.com" });

    expect(result.status).toBe("existing");
    expect(result.success).toBe(true);
  });

  it("rethrows unexpected database errors", async () => {
    mockPrisma.founding_members.create.mockRejectedValue(new Error("connection lost"));

    await expect(registerFoundingMember({ email: "person@example.com" })).rejects.toThrow(
      "connection lost"
    );
  });

  it("still reports success when the confirmation email fails", async () => {
    sendEmail.mockRejectedValue(new Error("smtp down"));
    jest.spyOn(console, "error").mockImplementation(() => {});

    const result = await registerFoundingMember({ email: "person@example.com" });

    expect(result.status).toBe("created");
    expect(mockPrisma.founding_members.create).toHaveBeenCalled();
  });

  it("truncates oversized attribution values instead of storing them whole", async () => {
    await registerFoundingMember({
      email: "person@example.com",
      utmCampaign: "x".repeat(400),
    });

    const data = mockPrisma.founding_members.create.mock.calls[0][0].data;
    expect(data.utm_campaign).toHaveLength(255);
  });

  it("stores an empty optional first name as null", async () => {
    await registerFoundingMember({ email: "person@example.com", firstName: "   " });

    const data = mockPrisma.founding_members.create.mock.calls[0][0].data;
    expect(data.first_name).toBeNull();
  });
});

describe("foundingMemberSignupBodySchema", () => {
  it("accepts a minimal payload with only an email", () => {
    const parsed = foundingMemberSignupBodySchema.parse({ email: "person@example.com" });
    expect(parsed.email).toBe("person@example.com");
  });

  it("rejects a malformed email", () => {
    const result = foundingMemberSignupBodySchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing email", () => {
    const result = foundingMemberSignupBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects an oversized first name", () => {
    const result = foundingMemberSignupBodySchema.safeParse({
      email: "person@example.com",
      firstName: "a".repeat(200),
    });
    expect(result.success).toBe(false);
  });

  it("rejects an oversized attribution value", () => {
    const result = foundingMemberSignupBodySchema.safeParse({
      email: "person@example.com",
      utmSource: "a".repeat(500),
    });
    expect(result.success).toBe(false);
  });

  it("trims whitespace around the submitted email", () => {
    const parsed = foundingMemberSignupBodySchema.parse({ email: "  person@example.com  " });
    expect(parsed.email).toBe("person@example.com");
  });
});
