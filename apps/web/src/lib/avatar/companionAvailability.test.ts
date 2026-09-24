import { describe, expect, it } from "vitest";

import {
  DEFAULT_SELECTABLE_COMPANION_NAME,
  isCompanionComingSoon,
  isSessionEnvironmentComingSoon,
  resolveCompanionForProfileSave,
  resolveEnvironmentForProfileSave,
} from "./companionAvailability";

describe("companionAvailability", () => {
  it("preserves canonical companion availability decisions", () => {
    expect(isCompanionComingSoon("Alex Rivera")).toBe(true);
    expect(isCompanionComingSoon("Maya Chen")).toBe(true);
    expect(isCompanionComingSoon("Jordan Taylor")).toBe(false);
    expect(isCompanionComingSoon("Sara Mitchell")).toBe(false);
  });

  it("preserves profile-save fallback behavior", () => {
    expect(DEFAULT_SELECTABLE_COMPANION_NAME).toBe("Jordan Taylor");
    expect(resolveCompanionForProfileSave("Alex", "Sara Mitchell")).toBe("Sara Mitchell");
    expect(resolveCompanionForProfileSave("", "Alex")).toBe("Jordan Taylor");
    expect(resolveCompanionForProfileSave("Jordan Taylor", "Sara Mitchell")).toBe("Jordan Taylor");
  });

  it("preserves session environment gating", () => {
    expect(isSessionEnvironmentComingSoon("minimal")).toBe(true);
    expect(isSessionEnvironmentComingSoon("custom")).toBe(false);
    expect(resolveEnvironmentForProfileSave("minimal", "current")).toBe("current");
    expect(resolveEnvironmentForProfileSave("custom", "current")).toBe("custom");
  });
});
