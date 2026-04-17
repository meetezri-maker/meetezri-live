import { companionCardImageUrl } from "./companionModelUrl";

/** Lobby companion list — card portraits from `public/avatars/` (same as Session Lobby). */
export type LobbyAvatar = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  cardImage?: string;
};

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
    cardImage: companionCardImageUrl("sarah mitchell.png"),
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
