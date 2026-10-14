import { describe, expect, it } from "vitest";

import {
  DEFAULT_SELECTABLE_COMPANION_NAME,
  isCompanionComingSoon,
  isSessionEnvironmentComingSoon,
  resolveCompanionForProfileSave,
  resolveEnvironmentForProfileSave,
} from "./companionAvailability";

describe("companionAvailability", () => {
  /**
   * ALL FOUR COMPANIONS ARE SELECTABLE since the Hyper3D four-avatar
   * integration (2026-10-13).
   *
   * Alex and Maya Chen were held back because they had no session avatar to
   * render. Both now have a Hyper3D asset — `perm.glb` and `sara.glb` — and a
   * 3D session path, so the product reason for the gate is gone. Every alias
   * the lobby, onboarding and older profiles can store is checked, because the
   * gate used to catch some of them through a separate fallback-key set and a
   * half-open gate would read as "enabled" while behaving as if it were not.
   */
  it.each([
    "Alex",
    "Alex Rivera",
    "alex",
    "Maya Chen",
    "maya",
    "Jordan Taylor",
    "jordan",
    "Sara Mitchell",
    "sara",
  ])("%s is selectable", (name) => {
    expect(isCompanionComingSoon(name)).toBe(false);
  });

  /** An empty label still means "nothing requested", not "coming soon". */
  it("treats a blank label as no request", () => {
    expect(isCompanionComingSoon("")).toBe(false);
    expect(isCompanionComingSoon(null)).toBe(false);
    expect(isCompanionComingSoon(undefined)).toBe(false);
  });

  /**
   * THE MECHANISM SURVIVES ITS EMPTY LIST. Profile-save still falls back to the
   * last committed value and then to the default, so re-adding an id to
   * `COMING_SOON_COMPANION_IDS` re-hides that companion everywhere exactly as
   * before. Only the membership changed, not the behaviour.
   */
  it("preserves profile-save fallback behavior", () => {
    expect(DEFAULT_SELECTABLE_COMPANION_NAME).toBe("Jordan Taylor");
    expect(resolveCompanionForProfileSave("", "Alex")).toBe("Alex");
    expect(resolveCompanionForProfileSave("", "")).toBe("Jordan Taylor");
    expect(resolveCompanionForProfileSave("Jordan Taylor", "Sara Mitchell")).toBe("Jordan Taylor");
  });

  /** Now that Alex and Maya are selectable, a save of either must persist. */
  it.each(["Alex", "Maya Chen", "Sara Mitchell", "Jordan Taylor"])(
    "persists %s on profile save",
    (name) => {
      expect(resolveCompanionForProfileSave(name, "Jordan Taylor")).toBe(name);
    },
  );

  it("preserves session environment gating", () => {
    expect(isSessionEnvironmentComingSoon("minimal")).toBe(true);
    expect(isSessionEnvironmentComingSoon("custom")).toBe(false);
    expect(resolveEnvironmentForProfileSave("minimal", "current")).toBe("current");
    expect(resolveEnvironmentForProfileSave("custom", "current")).toBe("custom");
  });
});
