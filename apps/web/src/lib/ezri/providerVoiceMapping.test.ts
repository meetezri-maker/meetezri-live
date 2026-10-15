import { afterEach, describe, expect, it, vi } from "vitest";
import {
  normalizeVoiceOptionId,
  providerVoiceIdForOption,
  resolveCompanionVoiceGender,
  resolveEzriWsVoiceForCompanion,
  resolveVoiceLabelForCompanion,
  resolveVoiceOptionForCompanion,
  voiceOptionGender,
  type VoiceOptionId,
} from "./voiceForCompanion";

/**
 * EXPLICIT PER-OPTION PROVIDER MAPPING.
 *
 *   Voice 1 -> marin   Voice 3 -> nova
 *   Voice 2 -> echo    Voice 4 -> cedar
 *
 * The point of these is that FOUR choices stay four on the wire. The previous
 * resolution collapsed them to two env presets, so Voice 3 sent whatever
 * Voice 1 sent and Voice 4 whatever Voice 2 sent.
 */

const EXPECTED: ReadonlyArray<readonly [VoiceOptionId, string, "female" | "male"]> = [
  ["voice1", "marin", "female"],
  ["voice2", "echo", "male"],
  ["voice3", "nova", "female"],
  ["voice4", "cedar", "male"],
];

describe("the provider mapping", () => {
  it.each(EXPECTED)("%s maps to %s", (option, providerId) => {
    expect(providerVoiceIdForOption(option)).toBe(providerId);
  });

  it("sends lowercase ids", () => {
    for (const [option, providerId] of EXPECTED) {
      expect(providerVoiceIdForOption(option)).toBe(providerId.toLowerCase());
      expect(voiceOptionGender(option)).toMatch(/^(male|female)$/);
    }
  });

  it("gives every option a distinct id", () => {
    const ids = EXPECTED.map(([, id]) => id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("label and id normalization", () => {
  /** Saved labels and catalogue ids must both resolve, in any casing. */
  it.each([
    ["Voice 1", "voice1"],
    ["voice1", "voice1"],
    ["VOICE 1", "voice1"],
    ["  voice 1  ", "voice1"],
    ["Voice 2", "voice2"],
    ["voice2", "voice2"],
    ["Voice 3", "voice3"],
    ["voice3", "voice3"],
    ["Voice 4", "voice4"],
    ["voice4", "voice4"],
  ])("%o normalizes to %s", (input, expected) => {
    expect(normalizeVoiceOptionId(input)).toBe(expected);
  });

  /**
   * NO SUBSTRING MATCHING. The replaced implementation tested
   * `label.includes("male")`, and **"female" contains "male"** — so every
   * female label also satisfied the male test, and correctness depended on
   * which branch happened to be checked first.
   */
  it.each(["female", "male", "Female Voice", "Male Voice", "Default Voice", "", "   ", "voice 5", "nova"])(
    "%o is not mistaken for an option",
    (input) => {
      expect(normalizeVoiceOptionId(input)).toBeNull();
    },
  );

  it.each([null, undefined])("%o normalizes to null", (input) => {
    expect(normalizeVoiceOptionId(input)).toBeNull();
  });
});

describe("resolution per companion", () => {
  /** A valid in-category choice is preserved and sends its OWN id. */
  it.each([
    ["Sara Mitchell", "Voice 1", "marin"],
    ["Sara Mitchell", "Voice 3", "nova"],
    ["Maya Chen", "Voice 1", "marin"],
    ["Maya Chen", "Voice 3", "nova"],
    ["Alex", "Voice 2", "echo"],
    ["Alex", "Voice 4", "cedar"],
    ["Jordan Taylor", "Voice 2", "echo"],
    ["Jordan Taylor", "Voice 4", "cedar"],
  ])("%s + %s -> %s", (avatar, saved, providerId) => {
    expect(resolveEzriWsVoiceForCompanion(avatar, saved)).toBe(providerId);
  });

  /** Catalogue ids resolve identically to their saved labels. */
  it.each([
    ["Sara Mitchell", "voice3", "nova"],
    ["Alex", "voice4", "cedar"],
    ["Maya Chen", "voice1", "marin"],
    ["Jordan Taylor", "voice2", "echo"],
  ])("%s + catalogue id %s -> %s", (avatar, saved, providerId) => {
    expect(resolveEzriWsVoiceForCompanion(avatar, saved)).toBe(providerId);
  });

  /**
   * THE REGRESSION THIS MAPPING EXISTS TO PREVENT. Voice 3 and Voice 4 must not
   * send the same id as Voice 1 and Voice 2.
   */
  it("does not collapse the four options onto two ids", () => {
    const sara = ["Voice 1", "Voice 3"].map((v) => resolveEzriWsVoiceForCompanion("Sara Mitchell", v));
    const alex = ["Voice 2", "Voice 4"].map((v) => resolveEzriWsVoiceForCompanion("Alex", v));
    expect(new Set([...sara, ...alex]).size).toBe(4);
    expect(sara).toEqual(["marin", "nova"]);
    expect(alex).toEqual(["echo", "cedar"]);
  });

  /** Category safeguards: a cross-category choice is corrected, then mapped. */
  it.each([
    ["Alex", "Voice 1", "echo"],
    ["Alex", "Voice 3", "echo"],
    ["Jordan Taylor", "voice3", "echo"],
    ["Sara Mitchell", "Voice 2", "marin"],
    ["Sara Mitchell", "Voice 4", "marin"],
    ["Maya Chen", "voice4", "marin"],
  ])("%s + incompatible %s falls to the category default %s", (avatar, saved, providerId) => {
    expect(resolveEzriWsVoiceForCompanion(avatar, saved)).toBe(providerId);
  });

  /** A missing or legacy placeholder value uses the category default. */
  it.each([
    ["Sara Mitchell", null, "marin"],
    ["Maya Chen", "", "marin"],
    ["Maya Chen", "Default Voice", "marin"],
    ["Alex", undefined, "echo"],
    ["Jordan Taylor", "Default Voice", "echo"],
  ])("%s + %o uses the category default %s", (avatar, saved, providerId) => {
    expect(resolveEzriWsVoiceForCompanion(avatar, saved as string | null)).toBe(providerId);
  });

  it.each(["sara", "sarah", "maya", "Alex Rivera", "jordan"])(
    "the alias %s resolves through the same mapping",
    (alias) => {
      const gender = resolveCompanionVoiceGender(alias);
      const expected = gender === "female" ? "marin" : "echo";
      expect(resolveEzriWsVoiceForCompanion(alias, null)).toBe(expected);
    },
  );

  /** An unknown companion keeps an explicitly chosen option rather than guessing. */
  it.each([
    ["Voice 3", "nova"],
    ["Voice 4", "cedar"],
    ["voice1", "marin"],
  ])("an unmapped companion still honours the explicit choice %s", (saved, providerId) => {
    expect(resolveEzriWsVoiceForCompanion("Someone Else", saved)).toBe(providerId);
  });

  it("falls back only when neither companion nor voice resolves", () => {
    const configured =
      (import.meta.env.VITE_DEFAULT_EZRI_VOICE as string | undefined)?.trim() || "marin";
    expect(resolveEzriWsVoiceForCompanion("Someone Else", "nonsense")).toBe(configured);
    expect(resolveEzriWsVoiceForCompanion(undefined, undefined)).toBe(configured);
  });
});

/**
 * ENVIRONMENT PRESETS CANNOT COLLAPSE AN EXPLICIT SELECTION.
 *
 * `VITE_EZRI_VOICE_FEMALE` / `VITE_EZRI_VOICE_MALE` used to decide the sent id
 * outright, which is exactly how four options became two on the wire. They are
 * no longer consulted, and these set them to obviously wrong values to prove
 * it: if either still leaked through, every row below would return it.
 */
describe("environment presets no longer override the mapping", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["Sara Mitchell", "Voice 1", "marin"],
    ["Sara Mitchell", "Voice 3", "nova"],
    ["Alex", "Voice 2", "echo"],
    ["Alex", "Voice 4", "cedar"],
  ])("%s + %s still sends %s", (avatar, saved, providerId) => {
    vi.stubEnv("VITE_EZRI_VOICE_FEMALE", "env_female_should_not_win");
    vi.stubEnv("VITE_EZRI_VOICE_MALE", "env_male_should_not_win");
    expect(resolveEzriWsVoiceForCompanion(avatar, saved)).toBe(providerId);
  });

  it("keeps the category default on the mapping, not on the presets", () => {
    vi.stubEnv("VITE_EZRI_VOICE_FEMALE", "env_female_should_not_win");
    vi.stubEnv("VITE_EZRI_VOICE_MALE", "env_male_should_not_win");
    expect(resolveEzriWsVoiceForCompanion("Maya Chen", null)).toBe("marin");
    expect(resolveEzriWsVoiceForCompanion("Jordan Taylor", null)).toBe("echo");
  });

  /** The last-resort fallback is still configurable, for the unresolved case. */
  it("still honours VITE_DEFAULT_EZRI_VOICE when nothing resolves", () => {
    vi.stubEnv("VITE_DEFAULT_EZRI_VOICE", "fallback_voice");
    expect(resolveEzriWsVoiceForCompanion("Someone Else", "nonsense")).toBe("fallback_voice");
  });
});

describe("the option resolver agrees with the label corrector", () => {
  it.each([
    ["Sara Mitchell", "Voice 3", "voice3", "Voice 3"],
    ["Alex", "Voice 4", "voice4", "Voice 4"],
    ["Alex", "Voice 1", "voice2", "Voice 2"],
    ["Sara Mitchell", "Voice 2", "voice1", "Voice 1"],
    ["Maya Chen", "voice3", "voice3", "Voice 3"],
  ])("%s + %s -> option %s / label %s", (avatar, saved, option, label) => {
    expect(resolveVoiceOptionForCompanion(avatar, saved)).toBe(option);
    expect(resolveVoiceLabelForCompanion(avatar, saved)).toBe(label);
  });

  /** The corrected label and the sent id must always describe the same option. */
  it.each(["Sara Mitchell", "Maya Chen", "Alex", "Jordan Taylor"])(
    "%s never shows one voice and sends another",
    (avatar) => {
      for (const saved of ["Voice 1", "Voice 2", "Voice 3", "Voice 4", "voice1", "voice4", "", null]) {
        const label = resolveVoiceLabelForCompanion(avatar, saved);
        const option = normalizeVoiceOptionId(label);
        expect(option).not.toBeNull();
        expect(resolveEzriWsVoiceForCompanion(avatar, saved)).toBe(
          providerVoiceIdForOption(option as VoiceOptionId),
        );
      }
    },
  );

  /** An unrecognised label is still passed through untouched, as before. */
  it("does not rewrite a label it does not recognise", () => {
    expect(resolveVoiceLabelForCompanion("Sara Mitchell", "Default Voice")).toBe("Default Voice");
  });
});
