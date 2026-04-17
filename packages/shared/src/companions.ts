/**
 * Canonical AI companion labels — aligned with Session Lobby (`LOBBY_AVATARS` in web).
 * Maps arbitrary `profiles.selected_avatar` values to one official display name or "Not set" / "Other".
 */

const LOBBY_AVATARS_MIN: Array<{ id: string; name: string }> = [
  { id: 'Alex Rivera', name: 'Alex Rivera' },
  { id: 'Sarah Mitchell', name: 'Sarah Mitchell' },
  { id: 'Jordan Taylor', name: 'Jordan Taylor' },
  /** Card id matches `lobbyAvatars.ts` (lowercase "chen"). */
  { id: 'Maya chen', name: 'Maya Chen' },
];

function normalizeAvatarRaw(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Same resolution order as `findLobbyAvatar` in `apps/web/src/lib/avatar/lobbyAvatars.ts`. */
function findLobbyCompanionName(raw: string): string | undefined {
  const n = normalizeAvatarRaw(raw).toLowerCase();
  if (!n) return undefined;

  return (
    LOBBY_AVATARS_MIN.find((a) => a.name.toLowerCase() === n) ??
    LOBBY_AVATARS_MIN.find((a) => a.id.toLowerCase() === n) ??
    LOBBY_AVATARS_MIN.find((a) => a.name.split(/\s+/)[0]?.toLowerCase() === n)
  )?.name;
}

/**
 * Map stored profile `selected_avatar` to a single label for analytics/admin UI.
 * Returns one of the four lobby companions, "Not set", or "Other".
 */
export function canonicalCompanionDisplayName(raw: string): string {
  const trimmed = normalizeAvatarRaw(raw);
  if (!trimmed) return 'Not set';

  const lower = trimmed.toLowerCase();
  if (lower === 'not set' || lower === 'default avatar') return 'Not set';

  const lobby = findLobbyCompanionName(trimmed);
  if (lobby) return lobby;

  return 'Other';
}

export function mergeCompanionAvatarCounts(
  rows: Array<{ name: string; c: number | bigint }>
): Array<{ name: string; c: bigint }> {
  const merged = new Map<string, number>();
  for (const r of rows) {
    const label = canonicalCompanionDisplayName(r.name === 'Not set' ? '' : r.name);
    merged.set(label, (merged.get(label) ?? 0) + Number(r.c));
  }
  return [...merged.entries()]
    .map(([name, c]) => ({ name, c: BigInt(Math.round(c)) }))
    .sort((a, b) => Number(b.c) - Number(a.c));
}
