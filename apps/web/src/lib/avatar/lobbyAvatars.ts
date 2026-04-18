import { DEFAULT_AI_COMPANIONS } from "@meetezri/shared";

import {
  companionCardImageUrl,
  effectiveAvatarImageUrlFromDb,
  tryResolveCompanionPortraitUrl,
} from "./companionModelUrl";

/** Lobby companion list — card portraits from `public/avatars/` (same as Session Lobby). */
export type LobbyAvatar = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  cardImage?: string;
};

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
      : lobby?.cardImage ?? tryResolveCompanionPortraitUrl(r.name) ?? undefined;

    return {
      id: r.id ?? r.name,
      name: r.name,
      emoji: "",
      description: (r.description || lobby?.description || "").slice(0, 160),
      cardImage,
    };
  });
}

/** Default lobby list — same four companions as DB seed and `DEFAULT_AI_COMPANIONS` in `@meetezri/shared`. */
export const LOBBY_AVATARS: LobbyAvatar[] = DEFAULT_AI_COMPANIONS.map((c) => ({
  id: c.id,
  name: c.name,
  emoji: "",
  description: c.lobbyTagline,
  cardImage: companionCardImageUrl(c.portraitPng),
}));

/** Older profile/session labels → canonical `LOBBY_AVATARS.name` after the PNG rename. */
const LEGACY_LOBBY_NAME: Record<string, string> = {
  "alex rivera": "Alex",
  "sarah mitchell": "Sara Mitchell",
  "sara mitchell": "Sara Mitchell",
  "maya chen": "maya chen",
};

/** Match DB / profile name to a lobby companion (exact id/name, then legacy full names). */
export function findLobbyAvatar(name: string | null | undefined): LobbyAvatar | undefined {
  const n = (name ?? "").trim().toLowerCase();
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

/** Same resolution as Session Lobby — unknown labels map to first companion for preview. */
export function lobbyAvatarByName(name: string): LobbyAvatar {
  return findLobbyAvatar(name) ?? LOBBY_AVATARS[0];
}
