import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildBillingDateModel } from "./billingDate";

const PERIOD_END = "2026-08-30T00:30:00.000Z";
const NOW_BEFORE_PERIOD_END = new Date("2026-08-21T12:00:00.000Z");

describe("billing renewal date model", () => {
  it("uses one canonical paid renewal date for all billing surfaces", () => {
    const model = buildBillingDateModel({
      planId: "pro",
      status: "active",
      nextBillingAt: PERIOD_END,
      endDate: "2026-07-03T00:00:00.000Z",
      now: NOW_BEFORE_PERIOD_END,
    });

    expect(model.lead).toBe("Your membership renews on August 30, 2026.");
    expect(model.fullLabel).toBe("Sunday, August 30, 2026");
    expect(model.longLabel).toBe("August 30, 2026");
    expect(model.cardTitle).toBe("Upcoming renewal");
    expect(model.calendarUrl).toContain("dates=20260830T090000Z/20260830T100000Z");
    expect(model.calendarUrl).toContain("Solace%20%E2%80%94%20plan%20renewal");
  });

  it("does not say a future paid renewal is today", () => {
    const model = buildBillingDateModel({
      planId: "core",
      status: "active",
      nextBillingAt: PERIOD_END,
      now: NOW_BEFORE_PERIOD_END,
    });

    expect(model.lead).not.toContain("today");
    expect(model.lead).toBe("Your membership renews on August 30, 2026.");
  });

  it("says renews today only when the canonical billing date is today", () => {
    const model = buildBillingDateModel({
      planId: "core",
      status: "active",
      nextBillingAt: PERIOD_END,
      now: new Date("2026-08-30T23:30:00.000Z"),
    });

    expect(model.lead).toBe("Your membership renews today.");
  });

  it("does not fabricate a paid renewal date when next_billing_at is unavailable", () => {
    const model = buildBillingDateModel({
      planId: "pro",
      status: "active",
      nextBillingAt: null,
      endDate: "2026-07-03T00:00:00.000Z",
      now: NOW_BEFORE_PERIOD_END,
    });

    expect(model.date).toBeNull();
    expect(model.longLabel).toBeNull();
    expect(model.calendarUrl).toBeNull();
    expect(model.lead).toBe("Renewal date unavailable");
  });

  it("keeps scheduled cancellation wording off renewal copy", () => {
    const model = buildBillingDateModel({
      planId: "pro",
      status: "canceled",
      nextBillingAt: PERIOD_END,
      now: NOW_BEFORE_PERIOD_END,
    });

    expect(model.lead).toBe("Your membership access ends on August 30, 2026.");
    expect(model.cardTitle).toBe("Access until");
    expect(model.lead).not.toContain("renews");
    expect(model.calendarUrl).toContain("membership%20access%20ends");
  });

  it("uses trial-end card copy instead of renewal copy for trials", () => {
    const model = buildBillingDateModel({
      planId: "trial",
      status: "active",
      endDate: PERIOD_END,
      now: NOW_BEFORE_PERIOD_END,
    });

    expect(model.cardTitle).toBe("Trial ends");
    expect(model.lead).toBe("Your trial continues · 9 days remaining.");
    expect(model.lead).not.toContain("renews");
  });

  it("uses UTC calendar days consistently near timezone boundaries", () => {
    const model = buildBillingDateModel({
      planId: "core",
      status: "active",
      nextBillingAt: "2026-08-30T00:05:00.000Z",
      now: new Date("2026-08-29T23:55:00.000Z"),
    });

    expect(model.fullLabel).toBe("Sunday, August 30, 2026");
    expect(model.longLabel).toBe("August 30, 2026");
    expect(model.lead).toBe("Your membership renews on August 30, 2026.");
    expect(model.calendarUrl).toContain("20260830T090000Z");
  });

  it("does not leave the reported July 3 production value in billing UI code", () => {
    const billingPage = readFileSync(resolve(__dirname, "../Billing.tsx"), "utf8");
    const dateHelper = readFileSync(resolve(__dirname, "billingDate.ts"), "utf8");
    const productionBillingCode = `${billingPage}\n${dateHelper}`;

    expect(productionBillingCode).not.toContain("July 3");
    expect(productionBillingCode).not.toContain("2026-07-03");
  });
});
