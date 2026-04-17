import { findLobbyAvatar } from "./lobbyAvatars";

/**
 * Map `profiles.selected_avatar` to Session Lobby companion name, "Not set", or "Other".
 * Keeps admin analytics aligned with the user-facing avatar list.
 */
export function canonicalCompanionLabelForAdmin(raw: string): string {
  const trimmed = raw
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!trimmed) return "Not set";
  const lower = trimmed.toLowerCase();
  if (lower === "not set" || lower === "default avatar") return "Not set";

  const lobby = findLobbyAvatar(trimmed);
  if (lobby) return lobby.name;

  return "Other";
}

export function mergeCompanionAvatarCountsClient(
  rows: Array<{ name: string; c: number }>
): Array<{ name: string; count: number }> {
  const merged = new Map<string, number>();
  for (const r of rows) {
    const label = canonicalCompanionLabelForAdmin(r.name === "Not set" ? "" : r.name);
    merged.set(label, (merged.get(label) ?? 0) + r.c);
  }
  return [...merged.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}
