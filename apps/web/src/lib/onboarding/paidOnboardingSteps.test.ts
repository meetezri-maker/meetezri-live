import { describe, expect, it } from "vitest";
import {
  getPaidOnboardingChecklistStatus,
  isPaidPlanUser,
  isTrialPlanUser,
} from "./paidOnboardingSteps";

describe("isTrialPlanUser", () => {
  it("returns true for trial signup type or subscription", () => {
    expect(isTrialPlanUser({ signup_type: "trial" })).toBe(true);
    expect(isTrialPlanUser({ subscription_plan: "trial" })).toBe(true);
    expect(isTrialPlanUser({ signup_type: "trial", subscription_plan: "core" })).toBe(true);
  });
});

describe("isPaidPlanUser", () => {
  it("returns true for core and pro plans", () => {
    expect(isPaidPlanUser({ subscription_plan: "core" })).toBe(true);
    expect(isPaidPlanUser({ subscription_plan: "pro" })).toBe(true);
    expect(isPaidPlanUser({ signup_type: "plan" })).toBe(true);
  });

  it("returns false for trial users even when signup_type is plan", () => {
    expect(isPaidPlanUser({ subscription_plan: "trial", signup_type: "trial" })).toBe(false);
    expect(isPaidPlanUser({ subscription_plan: "trial", signup_type: "plan" })).toBe(false);
    expect(isPaidPlanUser({ subscription_plan: "trial" })).toBe(false);
  });
});

describe("getPaidOnboardingChecklistStatus", () => {
  it("flags incomplete paid onboarding steps from profile data", () => {
    const result = getPaidOnboardingChecklistStatus(
      {
        subscription_plan: "core",
        full_name: "Alex Morgan",
        timezone: "America/New_York",
        age: "28",
        selected_goals: ["stress"],
        in_therapy: "yes",
        on_medication: "no",
        selected_avatar: "Maya Chen",
        emergency_contact_relationship: "Parent",
        permissions: { camera: false },
        notification_preferences: { dailyCheckIn: true },
      },
      { safetyConsentAgreed: true },
    );

    expect(result.hasIncomplete).toBe(true);
    expect(result.incompleteSteps.map((step) => step.id)).toEqual(
      expect.arrayContaining(["emergency-contact"]),
    );
  });

  it("marks all steps complete when profile data is filled", () => {
    const result = getPaidOnboardingChecklistStatus(
      {
        subscription_plan: "pro",
        full_name: "Alex Morgan",
        timezone: "America/New_York",
        age: "1998-05-12",
        current_mood: "calm",
        selected_goals: ["stress", "sleep"],
        in_therapy: "yes",
        on_medication: "no",
        selected_triggers: ["workload-pressure"],
        selected_avatar: "Maya Chen",
        selected_environment: "twilight",
        emergency_contact_name: "Jamie Morgan",
        emergency_contact_phone: "+14155552671",
        emergency_contact_relationship: "Parent",
        permissions: { camera: true, microphone: true },
        notification_preferences: { dailyCheckIn: true, sessionReminders: true },
      },
      { safetyConsentAgreed: true },
    );

    expect(result.hasIncomplete).toBe(false);
    expect(result.percentComplete).toBe(100);
  });
});
