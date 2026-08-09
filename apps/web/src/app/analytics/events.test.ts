import { beforeEach, describe, expect, it, vi } from "vitest";
import { sanitizeMarketingEventProperties, trackMarketingEvent } from "./events";
import { trackGa4Event } from "./ga4";
import { trackMetaCustomEvent, trackMetaEvent } from "./meta";

vi.mock("./config", () => ({
  canInitializeAnalytics: () => true,
}));

vi.mock("./ga4", () => ({
  trackGa4Event: vi.fn(),
}));

vi.mock("./meta", () => ({
  trackMetaCustomEvent: vi.fn(),
  trackMetaEvent: vi.fn(),
}));

describe("marketing event facade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps only the approved property allowlist", () => {
    expect(
      sanitizeMarketingEventProperties({
        origin: "hero",
        status: "created",
        signup_type: "founding_member",
        plan_tier: "founding",
        checkout_type: "subscription",
        email: "person@example.com",
        random: "ignored",
      }),
    ).toEqual({
      origin: "hero",
      status: "created",
      signup_type: "founding_member",
      plan_tier: "founding",
      checkout_type: "subscription",
    });
  });

  it("drops forbidden keys and sensitive-looking values before provider calls", () => {
    trackMarketingEvent("early_access_cta_click", {
      origin: "pricing?session_id=secret",
      status: "ok",
      email: "person@example.com",
      name: "Alex",
      userId: "user-1",
      message: "private text",
      token: "access_token=secret",
    });

    expect(trackGa4Event).toHaveBeenCalledWith("early_access_cta_click", { status: "ok" });
    expect(trackMetaCustomEvent).toHaveBeenCalledWith("EarlyAccessCtaClick", { status: "ok" });
    expect(JSON.stringify(vi.mocked(trackGa4Event).mock.calls)).not.toContain("person@example.com");
    expect(JSON.stringify(vi.mocked(trackMetaCustomEvent).mock.calls)).not.toContain("private text");
  });

  it("maps standard Lead and CompleteRegistration events without advanced fields", () => {
    trackMarketingEvent("generate_lead", {
      origin: "early_access_form",
      status: "created",
      email: "person@example.com",
    });
    trackMarketingEvent("signup_complete", { signup_type: "email" });

    expect(trackGa4Event).toHaveBeenNthCalledWith(1, "generate_lead", {
      origin: "early_access_form",
      status: "created",
    });
    expect(trackMetaEvent).toHaveBeenNthCalledWith(1, "Lead", {
      origin: "early_access_form",
      status: "created",
    });
    expect(trackGa4Event).toHaveBeenNthCalledWith(2, "sign_up", { signup_type: "email" });
    expect(trackMetaEvent).toHaveBeenNthCalledWith(2, "CompleteRegistration", { signup_type: "email" });
  });
});
