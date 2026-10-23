import { describe, expect, it } from "vitest";
import {
  DEFAULT_AI_COMPANIONS,
  canonicalCompanionDisplayName,
  companionDisplayName,
  matchDefaultCompanionByAvatarName,
} from "@meetezri/shared";
import {
  NEUTRAL_COMPANION_PORTRAIT_URL,
  NO_LEGACY_MODEL_URL,
  companionSessionUses3dModel,
  normalizeCompanionId,
  resolveCompanionAvatarRuntime,
  resolveCompanionModelUrl,
  resolveCompanionPortraitUrl,
  tryResolveCompanionPortraitUrl,
} from "./companionModelUrl";
import {
  LOBBY_AVATARS,
  companionMetaLine,
  findLobbyAvatar,
  lobbyAvatarByName,
} from "./lobbyAvatars";
import {
  DEFAULT_SELECTABLE_COMPANION_NAME,
  isCompanionComingSoon,
  resolveCompanionForProfileSave,
} from "./companionAvailability";
import {
  COMPANIONS_WITHOUT_LEGACY_MODEL,
  HYPER3D_COMPANION_ASSETS,
  companionHasNoLegacyModel,
  resolveHyper3dCompanionAsset,
} from "./hyper3d/hyper3dCompanionAssets";
import {
  HYPER3D_ASSET_URLS,
  hyper3dBackupAssetFor,
} from "./hyper3d/engine/mappings/avatars/hyper3dAssetSelection";
import {
  providerVoiceIdForOption,
  resolveCompanionVoiceGender,
  resolveEzriWsVoiceForCompanion,
  resolveVoiceLabelForCompanion,
  resolveVoiceSelectionForCompanion,
  voiceOptionsForCompanion,
} from "@/lib/ezri/voiceForCompanion";
import { resolveEzriAvatarName } from "@/lib/ezri/avatarNameForCompanion";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SEVEN COMPANIONS, EACH RESOLVED EXPLICITLY (2026-10-23).
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * One row per companion, and every resolver asked about it. The rows are the
 * approved table; nothing here is derived from a filename or guessed from a
 * name.
 */
const SEVEN = [
  { stored: "Alex", id: "alex", display: "Frankie", asset: "hyper3d_frankie", glb: "/avatars/hyper3d/frankie.glb", backup: "hyper3d_perm", portrait: "Alex.png", voice: "male", legacy: false },
  { stored: "Jordan Taylor", id: "jordan", display: "Andre", asset: "hyper3d_jordan", glb: "/avatars/hyper3d/jordan.glb", backup: null, portrait: "jordan%20Taylor.png", voice: "male", legacy: true },
  { stored: "Maya Chen", id: "maya", display: "Tessa", asset: "hyper3d_sara", glb: "/avatars/hyper3d/sara.glb", backup: null, portrait: "maya%20chen.png", voice: "female", legacy: true },
  { stored: "Sara Mitchell", id: "sarah", display: "Romy", asset: "hyper3d_arfv2", glb: "/avatars/hyper3d/arfv2.glb", backup: "hyper3d_romy_backup", portrait: "Sara%20Mitchell.png", voice: "female", legacy: false },
  { stored: "Bianca", id: "bianca", display: "Bianca", asset: "hyper3d_bianca", glb: "/avatars/hyper3d/bianca.glb", backup: null, portrait: "Bianca.png", voice: "female", legacy: false },
  { stored: "Damian", id: "damian", display: "Damian", asset: "hyper3d_damian", glb: "/avatars/hyper3d/damian.glb", backup: null, portrait: "Damian.png", voice: "male", legacy: false },
  { stored: "Sasha", id: "sasha", display: "Sasha", asset: "hyper3d_sasha", glb: "/avatars/hyper3d/sasha.glb", backup: null, portrait: "Sasha.png", voice: "female", legacy: false },
] as const;

const NEW_THREE = SEVEN.filter((c) => ["bianca", "damian", "sasha"].includes(c.id));

describe("the shared catalogue", () => {
  it("keeps the original four first, in their order, then appends the new three", () => {
    expect(DEFAULT_AI_COMPANIONS.map((c) => c.name)).toEqual([
      "Alex",
      "Jordan Taylor",
      "Maya Chen",
      "Sara Mitchell",
      "Bianca",
      "Damian",
      "Sasha",
    ]);
    expect(LOBBY_AVATARS.map((a) => a.name)).toEqual(DEFAULT_AI_COMPANIONS.map((c) => c.name));
  });

  it("keeps Andre as the default selectable companion", () => {
    expect(DEFAULT_SELECTABLE_COMPANION_NAME).toBe("Jordan Taylor");
  });

  /** No persona copy was approved for the new three, so none is invented. */
  it.each(NEW_THREE)("$stored carries no invented persona metadata", ({ stored }) => {
    const c = matchDefaultCompanionByAvatarName(stored)!;
    expect(c).toBeDefined();
    expect(c.gender).toBe("");
    expect(c.age_range).toBe("");
    expect(c.personality).toBe("");
    expect(c.specialties).toEqual([]);
    expect(c.voice_type).toBe("");
    expect(c.accent_type).toBe("");
    expect(c.rating).toBeUndefined();
    expect(c.lobbyTagline).toBe("Solace companion");
    expect(c.description).toBe("Solace companion");
  });

  it("leaves the original four's metadata as it was", () => {
    const alex = matchDefaultCompanionByAvatarName("Alex")!;
    expect(alex.personality).toBe("Calm, Patient, Understanding");
    expect(alex.rating).toBe(4.8);
    expect(matchDefaultCompanionByAvatarName("Sara Mitchell")!.accent_type).toBe("British");
  });
});

describe.each(SEVEN)("$stored", (c) => {
  it("resolves its canonical id, aliases and display name", () => {
    expect(normalizeCompanionId(c.stored)).toBe(c.id);
    expect(normalizeCompanionId(c.stored.toUpperCase())).toBe(c.id);
    expect(canonicalCompanionDisplayName(c.stored)).toBe(c.stored);
    expect(canonicalCompanionDisplayName(c.id)).toBe(c.stored);
    expect(companionDisplayName(c.stored)).toBe(c.display);
    expect(findLobbyAvatar(c.stored)?.name).toBe(c.stored);
    expect(findLobbyAvatar(c.id)?.name).toBe(c.stored);
  });

  it("is selectable and saves as itself", () => {
    expect(isCompanionComingSoon(c.stored)).toBe(false);
    expect(resolveCompanionForProfileSave(c.stored, "Jordan Taylor")).toBe(c.stored);
  });

  it("shows its own portrait everywhere", () => {
    const url = tryResolveCompanionPortraitUrl(c.stored);
    expect(url).toBe(`/avatars/${c.portrait}`);
    expect(resolveCompanionPortraitUrl(c.stored)).toBe(url);
    expect(lobbyAvatarByName(c.stored).cardImage).toBe(url);
  });

  it("loads its own Hyper3D file, with only its own backup", () => {
    expect(companionSessionUses3dModel(c.stored)).toBe(true);
    expect(resolveHyper3dCompanionAsset(c.stored)).toBe(c.asset);
    expect(HYPER3D_ASSET_URLS[c.asset]).toBe(c.glb);
    expect(hyper3dBackupAssetFor(c.asset)).toBe(c.backup);
    expect(companionHasNoLegacyModel(c.stored)).toBe(!c.legacy);
  });

  it(`is in the ${c.voice} voice category and sends avatar_name=${c.display}`, () => {
    expect(resolveCompanionVoiceGender(c.stored)).toBe(c.voice);
    expect(resolveEzriAvatarName(c.stored)).toBe(c.display);
  });
});

describe("the new three never borrow another companion's files", () => {
  it.each(NEW_THREE)("$stored has no legacy model URL and never Andre's", ({ stored, id }) => {
    expect(resolveCompanionAvatarRuntime(stored)).toBe(id);
    expect(resolveCompanionModelUrl(stored)).toBe(NO_LEGACY_MODEL_URL);
    expect(resolveCompanionModelUrl(stored)).not.toContain("jordanTaylor");
    expect(COMPANIONS_WITHOUT_LEGACY_MODEL.has(id)).toBe(true);
  });

  it("maps seven companions to seven different files", () => {
    const assets = Object.values(HYPER3D_COMPANION_ASSETS);
    expect(assets).toHaveLength(7);
    expect(new Set(assets).size).toBe(7);
    expect(new Set(assets.map((a) => HYPER3D_ASSET_URLS[a])).size).toBe(7);
  });

  it("leaves Tessa and Andre on their legacy models", () => {
    expect(resolveCompanionModelUrl("Maya Chen")).toBe("/avatars/maya%20chen.glb");
    expect(resolveCompanionModelUrl("Jordan Taylor")).toBe("/avatars/jordanTaylor.glb");
  });
});

/**
 * ABSENT IS NOT UNRECOGNISED. An empty selection still means "the default
 * companion"; a non-empty name this build does not know gets a neutral card,
 * never Frankie's portrait or card.
 */
describe("absent versus unrecognised companion", () => {
  it("an absent selection resolves to Andre", () => {
    expect(lobbyAvatarByName("").name).toBe("Jordan Taylor");
    expect(lobbyAvatarByName("   ").name).toBe("Jordan Taylor");
  });

  it.each(["Someone Else", "Biancaa", "Admin Guide"])(
    "an unrecognised name %s keeps its own name and no companion's portrait",
    (name) => {
      const card = lobbyAvatarByName(name);
      expect(card.name).toBe(name);
      expect(card.cardImage).toBeUndefined();
      expect(resolveCompanionPortraitUrl(name)).toBe(NEUTRAL_COMPANION_PORTRAIT_URL);
      expect(resolveCompanionPortraitUrl(name)).not.toContain("Alex.png");
      expect(companionSessionUses3dModel(name)).toBe(false);
      expect(resolveHyper3dCompanionAsset(name)).toBeNull();
    },
  );

  it("the neutral portrait is faceless inline art, not a file", () => {
    expect(NEUTRAL_COMPANION_PORTRAIT_URL.startsWith("data:image/svg+xml")).toBe(true);
  });

  /** A live session that lost its identity is a separate, deliberately unchanged gap. */
  it("an empty session label keeps its previous portrait result", () => {
    expect(resolveCompanionPortraitUrl(undefined)).toBe("/avatars/Alex.png");
  });
});

/** Female: voice1 -> marin, voice3 -> nova. Male: voice2 -> echo, voice4 -> cedar. */
describe("voice categories for the new three", () => {
  const CATALOGUE = [
    { id: "voice1", name: "Voice 1", gender: "Female" },
    { id: "voice2", name: "Voice 2", gender: "Male" },
    { id: "voice3", name: "Voice 3", gender: "Female" },
    { id: "voice4", name: "Voice 4", gender: "Male" },
  ];
  const names = (o: { name: string }[]) => o.map((v) => v.name);

  it("leaves the provider mapping unchanged", () => {
    expect(providerVoiceIdForOption("voice1")).toBe("marin");
    expect(providerVoiceIdForOption("voice2")).toBe("echo");
    expect(providerVoiceIdForOption("voice3")).toBe("nova");
    expect(providerVoiceIdForOption("voice4")).toBe("cedar");
  });

  it.each([
    ["Bianca", ["Voice 1", "Voice 3"]],
    ["Sasha", ["Voice 1", "Voice 3"]],
    ["Damian", ["Voice 2", "Voice 4"]],
  ])("%s is offered only %j", (name, expected) => {
    expect(names(voiceOptionsForCompanion(name, CATALOGUE))).toEqual(expected);
  });

  it.each([
    ["Bianca", "Voice 3", "Voice 3", "nova"],
    ["Sasha", "Voice 1", "Voice 1", "marin"],
    ["Damian", "Voice 4", "Voice 4", "cedar"],
  ])("%s keeps the in-category choice %s", (name, saved, selected, provider) => {
    expect(resolveVoiceSelectionForCompanion(name, CATALOGUE, saved).selected).toBe(selected);
    expect(resolveVoiceLabelForCompanion(name, saved)).toBe(selected);
    expect(resolveEzriWsVoiceForCompanion(name, saved)).toBe(provider);
  });

  it.each([
    ["Bianca", "Voice 4", "Voice 1", "marin"],
    ["Sasha", "Voice 2", "Voice 1", "marin"],
    ["Damian", "Voice 3", "Voice 2", "echo"],
    ["Damian", "Voice 1", "Voice 2", "echo"],
  ])("%s replaces the incompatible saved %s with its category default %s", (name, saved, fallback, provider) => {
    expect(resolveVoiceSelectionForCompanion(name, CATALOGUE, saved).selected).toBe(fallback);
    expect(resolveVoiceLabelForCompanion(name, saved)).toBe(fallback);
    expect(resolveEzriWsVoiceForCompanion(name, saved)).toBe(provider);
  });

  it.each([
    ["Bianca", "marin"],
    ["Sasha", "marin"],
    ["Damian", "echo"],
  ])("%s with no saved voice gets the category default (%s)", (name, provider) => {
    expect(resolveEzriWsVoiceForCompanion(name)).toBe(provider);
  });
});

describe("companionMetaLine", () => {
  it("renders the original format when both parts exist", () => {
    expect(companionMetaLine("Male", "30-35")).toBe("Male • 30-35 years");
  });

  it("renders nothing rather than ' •  years' when neither exists", () => {
    expect(companionMetaLine("", "")).toBeNull();
  });
});
