import { beforeEach, describe, expect, it, vi } from "vitest";
import { trackMarketingEvent } from "@/app/analytics";
import { trackPrelaunchEvent } from "./prelaunch.analytics";

vi.mock("@/app/analytics", () => ({
  trackMarketingEvent: vi.fn(),
}));

describe("prelaunch analytics bridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as unknown as { dataLayer?: unknown[] }).dataLayer;
  });

  it("preserves existing dataLayer pushes", () => {
    const dataLayer: Array<Record<string, unknown>> = [];
    (window as unknown as { dataLayer: unknown[] }).dataLayer = dataLayer;

    trackPrelaunchEvent("founding_member_cta_clicked", { origin: "hero" });

    expect(dataLayer).toEqual([{ event: "founding_member_cta_clicked", origin: "hero" }]);
  });

  it("maps only approved Phase 1 acquisition events to the central facade", () => {
    trackPrelaunchEvent("founding_member_cta_clicked", { origin: "hero" });
    trackPrelaunchEvent("founding_member_form_started", { origin: "modal" });
    trackPrelaunchEvent("founder_video_opened", { origin: "story" });

    expect(trackMarketingEvent).toHaveBeenNthCalledWith(1, "early_access_cta_click", { origin: "hero" });
    expect(trackMarketingEvent).toHaveBeenNthCalledWith(2, "early_access_form_open", { origin: "modal" });
    expect(trackMarketingEvent).toHaveBeenNthCalledWith(3, "founder_video_open", { origin: "story" });
  });

  it("fires Lead only after successful founding member submission", () => {
    trackPrelaunchEvent("founding_member_form_submitted", { origin: "form" });
    trackPrelaunchEvent("founding_member_submission_failed", { origin: "form", status: "failed" });
    trackPrelaunchEvent("founding_member_submission_succeeded", { origin: "form", status: "created" });

    expect(trackMarketingEvent).toHaveBeenCalledTimes(1);
    expect(trackMarketingEvent).toHaveBeenCalledWith("generate_lead", {
      origin: "form",
      status: "created",
    });
  });
});
