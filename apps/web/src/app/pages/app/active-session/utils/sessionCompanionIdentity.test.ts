import { describe, expect, it } from "vitest";
import { resolveSessionCompanionLabel } from "./sessionCompanionIdentity";
import { resolveEzriAvatarName } from "@/lib/ezri/avatarNameForCompanion";
import { resolveEzriWsVoiceForCompanion } from "@/lib/ezri/voiceForCompanion";
import { resolveHyper3dCompanionAsset } from "@/lib/avatar/hyper3d/hyper3dCompanionAssets";

/**
 * SESSION-PINNED IDENTITY, for all seven companions. The profile's current
 * selection is not an input, so changing it cannot rename a running session.
 */
const SEVEN = ["Alex", "Jordan Taylor", "Maya Chen", "Sara Mitchell", "Bianca", "Damian", "Sasha"];

describe("resolveSessionCompanionLabel", () => {
  it.each(SEVEN)("router config %s wins", (label) => {
    expect(resolveSessionCompanionLabel(label, { id: "s1", avatar: "Jordan Taylor" }, "s1")).toBe(label);
  });

  it.each(SEVEN)("a refresh restores %s from the identity pinned to this session id", (label) => {
    expect(resolveSessionCompanionLabel(undefined, { id: "s1", avatar: label }, "s1")).toBe(label);
  });

  it("never restores an identity pinned to a different session", () => {
    expect(resolveSessionCompanionLabel(undefined, { id: "old", avatar: "Sasha" }, "s1")).toBeUndefined();
  });

  it("returns undefined, not a default companion, when nothing is known", () => {
    expect(resolveSessionCompanionLabel(undefined, null, "s1")).toBeUndefined();
    expect(resolveSessionCompanionLabel("  ", null, null)).toBeUndefined();
  });

  /**
   * A member starts a Damian session, then picks Bianca in their profile in
   * another tab and refreshes. The profile is not consulted, so the running
   * session's name, voice and model stay Damian's.
   */
  it("a later profile change cannot alter a running session's identity", () => {
    // The profile now says "Bianca"; it is simply not an input.
    const label = resolveSessionCompanionLabel(undefined, { id: "s1", avatar: "Damian" }, "s1");
    expect(label).toBe("Damian");
    expect(resolveEzriAvatarName(label)).toBe("Damian");
    expect(resolveEzriWsVoiceForCompanion(label, "Voice 4")).toBe("cedar");
    expect(resolveHyper3dCompanionAsset(label)).toBe("hyper3d_damian");
  });
});
