import { describe, expect, it } from "vitest";
import {
  resolveCompanionVoiceGender,
  resolveVoiceLabelForCompanion,
  resolveVoiceSelectionForCompanion,
  voiceOptionsForCompanion,
} from "./voiceForCompanion";

/**
 * VOICE OPTIONS ARE FILTERED BY COMPANION.
 *
 * Sara and Maya are offered female voices only; Alex and Jordan male only. The
 * category comes from the existing classification, and the match from each
 * option's own `gender` metadata — nothing here reads a voice's label.
 */

/** The lobby's catalogue, as `VOICE_CATALOGUE` declares it. */
const CATALOGUE = [
  { id: "voice1", name: "Voice 1", description: "Warm and friendly", gender: "Female", demoFile: "voice1female.wav" },
  { id: "voice2", name: "Voice 2", description: "Calm and reassuring", gender: "Male", demoFile: "voice2male.wav" },
  { id: "voice3", name: "Voice 3", description: "Professional and clear", gender: "Female", demoFile: "voice3female.wav" },
  { id: "voice4", name: "Voice 4", description: "Gentle and soothing", gender: "Male", demoFile: "voice4male.wav" },
] as const;

const names = (options: readonly { name: string }[]) => options.map((o) => o.name);

describe("voiceOptionsForCompanion", () => {
  it.each([
    ["Sara Mitchell", ["Voice 1", "Voice 3"]],
    ["sarah", ["Voice 1", "Voice 3"]],
    ["Maya Chen", ["Voice 1", "Voice 3"]],
    ["maya", ["Voice 1", "Voice 3"]],
    ["Alex", ["Voice 2", "Voice 4"]],
    ["Alex Rivera", ["Voice 2", "Voice 4"]],
    ["Jordan Taylor", ["Voice 2", "Voice 4"]],
    ["jordan", ["Voice 2", "Voice 4"]],
  ])("%s is offered %j", (avatar, expected) => {
    expect(names(voiceOptionsForCompanion(avatar, CATALOGUE))).toEqual(expected);
  });

  it("never offers the opposite category", () => {
    for (const female of ["Sara Mitchell", "Maya Chen"]) {
      expect(voiceOptionsForCompanion(female, CATALOGUE).every((v) => v.gender === "Female")).toBe(true);
    }
    for (const male of ["Alex", "Jordan Taylor"]) {
      expect(voiceOptionsForCompanion(male, CATALOGUE).every((v) => v.gender === "Male")).toBe(true);
    }
  });

  /**
   * An unresolved companion must not be guessed at. Returning nothing is what
   * lets the lobby show its loading state instead of the wrong half of the
   * catalogue while the profile is still arriving.
   */
  it.each([undefined, null, "", "   ", "Someone Else"])("resolves %o to no options", (label) => {
    expect(voiceOptionsForCompanion(label as string | undefined, CATALOGUE)).toEqual([]);
    expect(resolveCompanionVoiceGender(label as string | undefined)).toBeNull();
  });

  it("reads each option's gender metadata, not its name", () => {
    const oddlyNamed = [
      { id: "a", name: "Thunder", gender: "Female" },
      { id: "b", name: "Blossom", gender: "Male" },
    ];
    expect(names(voiceOptionsForCompanion("Maya Chen", oddlyNamed))).toEqual(["Thunder"]);
    expect(names(voiceOptionsForCompanion("Alex", oddlyNamed))).toEqual(["Blossom"]);
  });
});

describe("resolveVoiceSelectionForCompanion", () => {
  /** Switching WITHIN a category must not disturb a member's choice. */
  it("keeps a compatible selection when the companion changes", () => {
    const { selected } = resolveVoiceSelectionForCompanion("Maya Chen", CATALOGUE, "Voice 3");
    expect(selected).toBe("Voice 3");
  });

  it.each([
    ["Sara Mitchell", "Voice 3", "Voice 3"],
    ["Maya Chen", "Voice 1", "Voice 1"],
    ["Alex", "Voice 4", "Voice 4"],
    ["Jordan Taylor", "Voice 2", "Voice 2"],
  ])("%s keeps the compatible saved voice %s", (avatar, saved, expected) => {
    expect(resolveVoiceSelectionForCompanion(avatar, CATALOGUE, saved).selected).toBe(expected);
  });

  /** Switching ACROSS a category must replace it with the configured default. */
  it.each([
    ["Alex", "Voice 3"],
    ["Jordan Taylor", "Voice 1"],
  ])("%s replaces the female voice %s with the male default", (avatar, saved) => {
    const { selected, options } = resolveVoiceSelectionForCompanion(avatar, CATALOGUE, saved);
    expect(selected).toBe(resolveVoiceLabelForCompanion(avatar, null));
    expect(selected).toBe("Voice 2");
    expect(names(options)).toContain(selected);
  });

  it.each([
    ["Sara Mitchell", "Voice 2"],
    ["Maya Chen", "Voice 4"],
  ])("%s replaces the male voice %s with the female default", (avatar, saved) => {
    const { selected, options } = resolveVoiceSelectionForCompanion(avatar, CATALOGUE, saved);
    expect(selected).toBe(resolveVoiceLabelForCompanion(avatar, null));
    expect(selected).toBe("Voice 1");
    expect(names(options)).toContain(selected);
  });

  /** A restored voice that is not in the catalogue at all is still resolved. */
  it.each([
    ["Sara Mitchell", "Default Voice", "Voice 1"],
    ["Alex", "Voice 99", "Voice 2"],
    ["Jordan Taylor", "", "Voice 2"],
    ["Maya Chen", null, "Voice 1"],
  ])("%s resolves the unusable saved value %o to %s", (avatar, saved, expected) => {
    expect(resolveVoiceSelectionForCompanion(avatar, CATALOGUE, saved).selected).toBe(expected);
  });

  /** The selection is ALWAYS one of the options actually shown. */
  it.each(["Sara Mitchell", "Maya Chen", "Alex", "Jordan Taylor"])(
    "%s never selects a voice it does not display",
    (avatar) => {
      for (const saved of ["Voice 1", "Voice 2", "Voice 3", "Voice 4", "nonsense", ""]) {
        const { options, selected } = resolveVoiceSelectionForCompanion(avatar, CATALOGUE, saved);
        expect(selected).not.toBeNull();
        expect(names(options)).toContain(selected);
      }
    },
  );

  it("selects nothing while the companion is unresolved", () => {
    const { options, selected } = resolveVoiceSelectionForCompanion(undefined, CATALOGUE, "Voice 1");
    expect(options).toEqual([]);
    expect(selected).toBeNull();
  });

  /**
   * A catalogue missing the configured default must still land on a shown
   * option rather than pointing at a voice the member cannot see.
   */
  it("falls back to the first option when the configured default is absent", () => {
    const sparse = [{ id: "v3", name: "Voice 3", gender: "Female" }];
    const { selected } = resolveVoiceSelectionForCompanion("Sara Mitchell", sparse, "Voice 2");
    expect(selected).toBe("Voice 3");
  });

  it("offers nothing when the catalogue has no voice of that category", () => {
    const femaleOnly = [{ id: "v1", name: "Voice 1", gender: "Female" }];
    const { options, selected } = resolveVoiceSelectionForCompanion("Alex", femaleOnly, "Voice 1");
    expect(options).toEqual([]);
    expect(selected).toBeNull();
  });
});

/**
 * THE SERVER-SIDE SAFEGUARD IS UNCHANGED. Filtering the UI does not replace it:
 * whatever reaches the session payload is still reconciled against the
 * companion before it is sent.
 */
describe("the existing session safeguard still holds", () => {
  it.each([
    ["Alex", "Voice 1", "Voice 2"],
    ["Jordan Taylor", "Voice 3", "Voice 2"],
    ["Sara Mitchell", "Voice 2", "Voice 1"],
    ["Maya Chen", "Voice 4", "Voice 1"],
  ])("%s submitted with %s is corrected to %s", (avatar, saved, expected) => {
    expect(resolveVoiceLabelForCompanion(avatar, saved)).toBe(expected);
  });
});
