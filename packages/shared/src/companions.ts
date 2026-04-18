/**
 * Canonical AI companion labels — aligned with Session Lobby (`LOBBY_AVATARS` in web).
 * Maps arbitrary `profiles.selected_avatar` values to one official display name or "Not set" / "Other".
 */

import { DEFAULT_AI_COMPANIONS } from './defaultAiCompanions';

const LEGACY_AVATAR_LABEL: Record<string, string> = {
  'alex rivera': 'Alex',
  'sarah mitchell': 'Sara Mitchell',
  'sara mitchell': 'Sara Mitchell',
  'maya chen': 'maya chen',
};

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

  const direct =
    DEFAULT_AI_COMPANIONS.find((a) => a.name.toLowerCase() === n) ??
    DEFAULT_AI_COMPANIONS.find((a) => a.id.toLowerCase() === n);
  if (direct) return direct.name;

  const legacy = LEGACY_AVATAR_LABEL[n];
  if (legacy) return legacy;

  return undefined;
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
