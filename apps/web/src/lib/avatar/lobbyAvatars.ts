import { companionCardImageUrl, resolveCompanionPortraitUrl } from "./companionModelUrl";

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
    const lobby = findLobbyAvatar(r.name);
    const rawUrl = typeof r.image_url === "string" ? r.image_url.trim() : "";
    const cardImage =
      lobby?.cardImage ??
      (rawUrl && /^https?:\/\//i.test(rawUrl) ? rawUrl : resolveCompanionPortraitUrl(r.name));
    const emoji =
      rawUrl && !/^https?:\/\//i.test(rawUrl)
        ? rawUrl
        : lobby?.emoji ?? "👤";
    return {
      id: r.id ?? r.name,
      name: r.name,
      emoji,
      description: (r.description || lobby?.description || "").slice(0, 160),
      cardImage,
    };
  });
}

export const LOBBY_AVATARS: LobbyAvatar[] = [
  {
    id: "Alex Rivera",
    name: "Alex Rivera",
    emoji: "👨‍⚕️",
    description: "Supportive and empathetic",
    cardImage: companionCardImageUrl("Alex.png"),
  },
  {
    id: "Sarah Mitchell",
    name: "Sarah Mitchell",
    emoji: "👩‍⚕️",
    description: "Warm and understanding",
    /** File on disk is `Sara Mitchell.png` (see companionModelUrl). */
    cardImage: companionCardImageUrl("Sara Mitchell.png"),
  },
  {
    id: "Jordan Taylor",
    name: "Jordan Taylor",
    emoji: "👨‍💼",
    description: "Professional and attentive",
    cardImage: companionCardImageUrl("jordan Taylor.png"),
  },
  {
    id: "Maya chen",
    name: "Maya Chen",
    emoji: "👩‍🦰",
    description: "Kind and patient",
    cardImage: companionCardImageUrl("maya chen.png"),
  },
];

/** Match DB / profile name to a lobby companion without falling back to a default. */
export function findLobbyAvatar(name: string | null | undefined): LobbyAvatar | undefined {
  const n = (name ?? "").trim().toLowerCase();
  if (!n) return undefined;
  return (
    LOBBY_AVATARS.find((a) => a.name.toLowerCase() === n) ??
    LOBBY_AVATARS.find((a) => a.id.toLowerCase() === n) ??
    LOBBY_AVATARS.find((a) => a.name.split(/\s+/)[0]?.toLowerCase() === n)
  );
}

/** Same resolution as Session Lobby — unknown labels map to first companion for preview. */
export function lobbyAvatarByName(name: string): LobbyAvatar {
  return findLobbyAvatar(name) ?? LOBBY_AVATARS[0];
}
