const mockPrisma = {
  founding_members: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock("../../lib/prisma", () => ({
  __esModule: true,
  default: mockPrisma,
}));

const sendEmail = jest.fn();
const buildFoundingCircleWelcomeEmail = jest.fn(() => ({
  subject: "Welcome to the SOLACE Founding Circle 💜",
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
  FOUNDING_MEMBER_DEFAULT_STATUS,
  FOUNDING_MEMBER_DISCOUNT_PERCENTAGE,
  FOUNDING_MEMBER_EMAIL_SENT_STATUS,
  normalizeEmail,
  registerFoundingMember,
} from "./founding-members.service";
import { foundingMemberSignupBodySchema } from "./founding-members.schema";

describe("founding-members.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.founding_members.findUnique.mockResolvedValue(null);
    mockPrisma.founding_members.create.mockResolvedValue({ id: "fm-1" });
    mockPrisma.founding_members.update.mockResolvedValue({ id: "fm-1" });
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

  /*
   * Regression guard for the delivery bug: the send used to be fire-and-forget
   * (`void`), which the Vercel serverless runtime killed once the response
   * returned. Every row sat at `waiting` forever. These two tests fail if the
   * await is ever removed.
   */
  it("completes the send and the status update before registration resolves", async () => {
    let settled = false;
    sendEmail.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            settled = true;
            resolve({ messageId: "m1", accepted: ["x"], rejected: [] });
          }, 10);
        })
    );

    await registerFoundingMember({ email: "person@example.com" });

    // No microtask draining: awaiting registration is enough.
    expect(settled).toBe(true);
    expect(mockPrisma.founding_members.update).toHaveBeenCalledTimes(1);
  });

  it("logs provider acceptance with safe diagnostics only", async () => {
    sendEmail.mockResolvedValue({ messageId: "m-123", accepted: ["a"], rejected: [] });
    const logger = { error: jest.fn(), info: jest.fn() };

    await registerFoundingMember({ email: "person@example.com" }, logger);

    const [context, message] = logger.info.mock.calls[0];
    expect(message).toBe("Founding Circle welcome email accepted by provider");
    expect(context.messageId).toBe("m-123");
    expect(context.acceptedCount).toBe(1);
    expect(context.rejectedCount).toBe(0);
    expect(context.foundingMemberId).toBe("fm-1");
    expect(context.emailDomain).toBe("example.com");
    // Never the address, the subject, or the body.
    const serialized = JSON.stringify(context);
    expect(serialized).not.toContain("person@example.com");
    expect(serialized).not.toContain("<p>hi</p>");
  });

  it("sends the welcome email to the new member when status is created", async () => {
    const result = await registerFoundingMember({
      email: " Person@Example.COM ",
      firstName: "Alex",
    });

    expect(result.status).toBe("created");
    expect(buildFoundingCircleWelcomeEmail).toHaveBeenCalledTimes(1);
    expect(buildFoundingCircleWelcomeEmail).toHaveBeenCalledWith({ firstName: "Alex" });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    // Normalized address, then subject / html / text straight from the template.
    expect(sendEmail).toHaveBeenCalledWith(
      "person@example.com",
      "Welcome to the SOLACE Founding Circle 💜",
      "<p>hi</p>",
      "hi"
    );
  });

  it("does not send a welcome email when the member already exists", async () => {
    mockPrisma.founding_members.findUnique.mockResolvedValue({ id: "fm-1" });

    const result = await registerFoundingMember({ email: "person@example.com" });

    expect(result.status).toBe("existing");
    expect(buildFoundingCircleWelcomeEmail).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("does not send a welcome email when a concurrent race folds into existing", async () => {
    mockPrisma.founding_members.create.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
    );

    const result = await registerFoundingMember({ email: "person@example.com" });

    expect(result.status).toBe("existing");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("passes no first name to the template when none was submitted", async () => {
    await registerFoundingMember({ email: "person@example.com", firstName: "   " });

    // Blank names normalize to null, and the template applies the "Hi there," fallback.
    expect(buildFoundingCircleWelcomeEmail).toHaveBeenCalledWith({ firstName: undefined });
  });

  it("logs a failed welcome email through the request logger without the address", async () => {
    sendEmail.mockRejectedValue(new Error("smtp down"));
    const logger = { error: jest.fn() };

    const result = await registerFoundingMember({ email: "person@example.com" }, logger);

    expect(result.status).toBe("created");
    expect(logger.error).toHaveBeenCalledTimes(1);

    const [context, message] = logger.error.mock.calls[0];
    expect(message).toBe("Founding Circle welcome email failed");
    expect(context.err).toBeInstanceOf(Error);
    expect(context.template).toBe("founding_circle_welcome");
    // The domain is enough to diagnose an outage; the address itself is not logged.
    expect(context.emailDomain).toBe("example.com");
    expect(JSON.stringify(context)).not.toContain("person@example.com");
  });

  /* ---------------------------------------------------------------- */
  /* Status lifecycle: waiting -> email_sent                            */
  /* ---------------------------------------------------------------- */

  it("creates the row with the waiting status", async () => {
    await registerFoundingMember({ email: "person@example.com" });

    expect(mockPrisma.founding_members.create.mock.calls[0][0].data.status).toBe(
      FOUNDING_MEMBER_DEFAULT_STATUS
    );
    expect(FOUNDING_MEMBER_DEFAULT_STATUS).toBe("waiting");
  });

  it("promotes the exact created row to email_sent once delivery succeeds", async () => {
    mockPrisma.founding_members.create.mockResolvedValue({ id: "fm-42" });

    await registerFoundingMember({ email: "person@example.com" });

    expect(FOUNDING_MEMBER_EMAIL_SENT_STATUS).toBe("email_sent");
    expect(mockPrisma.founding_members.update).toHaveBeenCalledTimes(1);
    // Targeted by database id, never by email.
    expect(mockPrisma.founding_members.update).toHaveBeenCalledWith({
      where: { id: "fm-42" },
      data: { status: FOUNDING_MEMBER_EMAIL_SENT_STATUS },
    });
  });

  it("selects the id on create so the update can target the row", async () => {
    await registerFoundingMember({ email: "person@example.com" });

    expect(mockPrisma.founding_members.create.mock.calls[0][0].select).toEqual({ id: true });
  });

  it("leaves the row at waiting when delivery fails", async () => {
    sendEmail.mockRejectedValue(new Error("smtp down"));
    jest.spyOn(console, "error").mockImplementation(() => {});

    await registerFoundingMember({ email: "person@example.com" });

    // Still findable by a future retry process.
    expect(mockPrisma.founding_members.update).not.toHaveBeenCalled();
  });

  it("does not update the status for an existing member", async () => {
    mockPrisma.founding_members.findUnique.mockResolvedValue({ id: "fm-1" });

    await registerFoundingMember({ email: "person@example.com" });

    expect(sendEmail).not.toHaveBeenCalled();
    expect(mockPrisma.founding_members.update).not.toHaveBeenCalled();
  });

  it("does not update the status when a P2002 race folds into existing", async () => {
    mockPrisma.founding_members.create.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
    );

    await registerFoundingMember({ email: "person@example.com" });

    expect(sendEmail).not.toHaveBeenCalled();
    expect(mockPrisma.founding_members.update).not.toHaveBeenCalled();
  });

  it("still reports success, and never resends, when the status update fails", async () => {
    mockPrisma.founding_members.update.mockRejectedValue(new Error("db unavailable"));
    const logger = { error: jest.fn() };

    const result = await registerFoundingMember({ email: "person@example.com" }, logger);

    expect(result.status).toBe("created");
    // The email did go out; a bookkeeping failure must not trigger a duplicate.
    expect(sendEmail).toHaveBeenCalledTimes(1);

    const [context, message] = logger.error.mock.calls[0];
    expect(message).toBe("Founding Circle status update failed after a successful send");
    expect(context.foundingMemberId).toBe("fm-1");
    expect(context.intendedStatus).toBe(FOUNDING_MEMBER_EMAIL_SENT_STATUS);
    expect(JSON.stringify(context)).not.toContain("person@example.com");
  });

  it("does not swallow a mail failure when no logger was supplied", async () => {
    sendEmail.mockRejectedValue(new Error("smtp down"));
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

    await registerFoundingMember({ email: "person@example.com" });

    expect(consoleError).toHaveBeenCalledWith(
      "Founding Circle welcome email failed",
      expect.objectContaining({ template: "founding_circle_welcome" })
    );
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
