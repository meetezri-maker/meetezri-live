import { DEFAULT_AI_COMPANIONS, matchDefaultCompanionByAvatarName } from "@meetezri/shared";

import { DEFAULT_SELECTABLE_COMPANION_NAME } from "./companionAvailability";

import {
  companionCardImageUrl,
  effectiveAvatarImageUrlFromDb,
  tryResolveCompanionPortraitUrl,
} from "./companionModelUrl";

/** Lobby companion list — card portraits from `public/avatars/` (same as Session Lobby). */
export type LobbyAvatar = {
  personality: string;
  id: string;
  name: string;
  emoji: string;
  description: string;
  cardImage?: string;
};

/**
 * The "Male • 30-35 years" line on companion cards, or `null` when neither part
 * exists. Identical output to the old inline template whenever both parts are
 * present (the original four); companions with no approved gender or age range
 * (Bianca, Damian, Sasha) render no line instead of " •  years".
 */
export function companionMetaLine(gender: string, ageRange: string): string | null {
  const parts = [gender.trim(), ageRange.trim() ? `${ageRange.trim()} years` : ""].filter(Boolean);
  return parts.length ? parts.join(" • ") : null;
}

/** Hide junk rows from admin / lobby (manual "test" avatars, etc.). */
export function isPlaceholderAvatarName(name: string): boolean {
  const t = name.trim().toLowerCase();
  if (!t) return true;
  if (["test", "dummy", "placeholder", "demo", "sample"].includes(t)) return true;
  if (/^test\s*\d*$/i.test(t)) return true;
  return false;
}

/**
 * Build lobby cards from `GET /ai-avatars` (active companions). Falls back to static list if API empty.
 * Keeps portraits in sync with filenames in `public/avatars/` via `findLobbyAvatar` / `resolveCompanionPortraitUrl`.
 */
export function lobbyAvatarsFromApiRows(
  rows: Array<{
    id?: string;
    name: string;
    is_active?: boolean | null;
    image_url?: string | null;
    description?: string | null;
    personality?: string | null;
  }>
): LobbyAvatar[] {
  const active = rows.filter(
    (r) => r.is_active !== false && r.name && !isPlaceholderAvatarName(r.name)
  );
  return active.map((r) => {
    const name = r.name.trim();
    const lobby = findLobbyAvatar(r.name);
    const rawUrl =
      typeof r.image_url === "string"
        ? effectiveAvatarImageUrlFromDb(r.image_url.trim())
        : "";

    const cardImage: string | undefined = rawUrl
      ? rawUrl
      : tryResolveCompanionPortraitUrl(r.name) ?? lobby?.cardImage ?? undefined;

    const personalityFromDb =
      typeof r.personality === "string" && r.personality.trim()
        ? r.personality.trim()
        : lobby?.personality?.trim() || "";

    const canon = matchDefaultCompanionByAvatarName(name);
    const descriptionForCard = canon
      ? canon.lobbyTagline
      : (r.description || lobby?.description || "");

    return {
      id: r.id ?? r.name,
      name: r.name,
      emoji: "",
      personality: personalityFromDb.slice(0, 280),
      description: descriptionForCard.slice(0, 160),
      cardImage,
    };
  });
}

/** Default lobby list — the companions in `DEFAULT_AI_COMPANIONS` (`@meetezri/shared`), in that order. */
export const LOBBY_AVATARS: LobbyAvatar[] = DEFAULT_AI_COMPANIONS.map((c) => ({
  id: c.id,
  name: c.name,
  emoji: "",
  description: c.lobbyTagline,
  personality: c.personality,
  cardImage: companionCardImageUrl(c.portraitPng),
}));

/** Older profile/session labels → canonical `LOBBY_AVATARS.name` after the PNG rename. */
const LEGACY_LOBBY_NAME: Record<string, string> = {
  "alex rivera": "Alex",
  "sarah mitchell": "Sara Mitchell",
  "sara mitchell": "Sara Mitchell",
  "maya chen": "maya chen",
  /** Short ids from older onboarding / clients */
  maya: "maya chen",
  alex: "Alex",
  jordan: "Jordan Taylor",
  sarah: "Sara Mitchell",
  sara: "Sara Mitchell",
  bianca: "Bianca",
  damian: "Damian",
  sasha: "Sasha",
};

/** Match DB / profile name to a lobby companion (exact id/name, then legacy full names). */
export function findLobbyAvatar(name: string | null | undefined): LobbyAvatar | undefined {
  const n = (name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\.png$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  if (!n) return undefined;
  const direct =
    LOBBY_AVATARS.find((a) => a.name.toLowerCase() === n) ??
    LOBBY_AVATARS.find((a) => a.id.toLowerCase() === n);
  if (direct) return direct;
  const mapped = LEGACY_LOBBY_NAME[n];
  if (mapped) {
    const m = mapped.toLowerCase();
    return (
      LOBBY_AVATARS.find((a) => a.name.toLowerCase() === m) ??
      LOBBY_AVATARS.find((a) => a.id.toLowerCase() === m)
    );
  }
  return undefined;
}

/**
 * Same resolution as Session Lobby, with the two misses kept apart:
 *
 *   absent (empty) name   the default companion, `DEFAULT_SELECTABLE_COMPANION_NAME`
 *                         (Andre) — the approved default for "nothing chosen yet".
 *   unrecognised name     a NEUTRAL card carrying that name and no portrait. Before
 *                         2026-10-23 this returned `LOBBY_AVATARS[0]`, which put
 *                         Frankie's card under any name this build did not know.
 */
export function lobbyAvatarByName(name: string): LobbyAvatar {
  const found = findLobbyAvatar(name);
  if (found) return found;
  const trimmed = (name ?? "").trim();
  if (!trimmed) {
    return findLobbyAvatar(DEFAULT_SELECTABLE_COMPANION_NAME) ?? LOBBY_AVATARS[0];
  }
  return { id: "", name: trimmed, emoji: "", description: "", personality: "", cardImage: undefined };
}
