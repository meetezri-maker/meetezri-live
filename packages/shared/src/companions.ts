/**
 * Canonical AI companion labels — aligned with Session Lobby (`LOBBY_AVATARS` in web).
 * Maps arbitrary `profiles.selected_avatar` values to one official display name or "Not set" / "Other".
 */

import { DEFAULT_AI_COMPANIONS } from './defaultAiCompanions';

/** Legacy full names and onboarding short codes → lobby `name` (must match DEFAULT_AI_COMPANIONS). */
const LEGACY_AVATAR_LABEL: Record<string, string> = {
  'alex rivera': 'Alex',
  'sarah mitchell': 'Sara Mitchell',
  'sara mitchell': 'Sara Mitchell',
  'maya chen': 'maya chen',
  /** Onboarding / older clients sometimes persisted short ids */
  maya: 'maya chen',
  alex: 'Alex',
  jordan: 'Jordan Taylor',
  sarah: 'Sara Mitchell',
  sara: 'Sara Mitchell',
};

function normalizeAvatarRaw(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveDefaultCompanionName(lowerKey: string): string | undefined {
  const hit =
    DEFAULT_AI_COMPANIONS.find((a) => a.name.toLowerCase() === lowerKey) ??
    DEFAULT_AI_COMPANIONS.find((a) => a.id.toLowerCase() === lowerKey);
  return hit?.name;
}

/** Same resolution order as `findLobbyAvatar` in `apps/web/src/lib/avatar/lobbyAvatars.ts`. */
function findLobbyCompanionName(raw: string): string | undefined {
  const trimmed = normalizeAvatarRaw(raw);
  const n = trimmed.toLowerCase();
  if (!n) return undefined;

  const noPng = n.replace(/\.png$/i, '').replace(/[-_]+/g, ' ').trim();

  const direct =
    DEFAULT_AI_COMPANIONS.find((a) => a.name.toLowerCase() === n) ??
    DEFAULT_AI_COMPANIONS.find((a) => a.id.toLowerCase() === n) ??
    DEFAULT_AI_COMPANIONS.find((a) => a.name.toLowerCase() === noPng) ??
    DEFAULT_AI_COMPANIONS.find((a) => a.id.toLowerCase() === noPng);
  if (direct) return direct.name;

  const legacyTarget = LEGACY_AVATAR_LABEL[n] ?? LEGACY_AVATAR_LABEL[noPng];
  if (legacyTarget) {
    const resolved = resolveDefaultCompanionName(legacyTarget.toLowerCase());
    return resolved ?? legacyTarget;
  }

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

/**
 * Human-friendly labels for admin charts (product marketing names where helpful).
 * Internal keys stay canonical for merging; this is display-only.
 */
export function companionAnalyticsChartLabel(canonical: string): string {
  const map: Record<string, string> = {
    Alex: 'Alex Rivera',
    'Jordan Taylor': 'Jordan Taylor',
    'maya chen': 'Maya Chen',
    'Sara Mitchell': 'Sara Mitchell',
    'Not set': 'Not set',
    Other: 'Unrecognized avatar',
  };
  return map[canonical] ?? canonical;
}

export function mergeCompanionAvatarCounts(
  rows: Array<{ name: string; c: number | bigint }>
): Array<{ name: string; c: bigint }> {
  const merged = new Map<string, number>();
  for (const r of rows) {
    const canonical = canonicalCompanionDisplayName(r.name === 'Not set' ? '' : r.name);
    const label = companionAnalyticsChartLabel(canonical);
    merged.set(label, (merged.get(label) ?? 0) + Number(r.c));
  }
  return [...merged.entries()]
    .map(([name, c]) => ({ name, c: BigInt(Math.round(c)) }))
    .sort((a, b) => Number(b.c) - Number(a.c));
}
