/**
 * Product availability for lobby companions and session talking backgrounds.
 * Used everywhere members can pick an avatar or environment (lobby, onboarding, settings).
 */

import { matchDefaultCompanionByAvatarName } from "@meetezri/shared/defaultAiCompanions";

/**
 * Canonical companion ids from `DEFAULT_AI_COMPANIONS` that cannot be selected.
 *
 * EMPTY since the Hyper3D four-avatar integration (2026-10-13). Alex and Maya
 * Chen were held back because they had no session avatar to render; both now
 * have a Hyper3D asset (`perm.glb` and `sara.glb` respectively) and a 3D
 * session path, so the product reason for the gate is gone.
 *
 * The MECHANISM is kept rather than deleted, because it is the only way to take
 * a companion out of circulation without touching five screens, and because
 * `resolveCompanionForProfileSave` still needs somewhere to look. Adding an id
 * back here re-hides that companion everywhere, as before.
 */
export const COMING_SOON_COMPANION_IDS: readonly string[] = [];

/** Display labels for docs / admin reference. */
export const COMING_SOON_COMPANION_NAMES: readonly string[] = [];

/** All talking-background presets are preview-only for now. */
export const COMING_SOON_SESSION_ENVIRONMENT_VALUES = [
  "beach",
  "forest",
  "mountains",
  "space",
  "minimal",
] as const;

export type ComingSoonSessionEnvironment =
  (typeof COMING_SOON_SESSION_ENVIRONMENT_VALUES)[number];

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
}

/**
 * Fallback keys for labels `matchDefaultCompanionByAvatarName` cannot resolve.
 *
 * Emptied alongside `COMING_SOON_COMPANION_IDS`: leaving "alex" and "maya" here
 * would keep both companions hidden through this path even though the canonical
 * list no longer names them, which is precisely the kind of half-open gate that
 * makes a feature look enabled and behave as if it is not.
 */
const COMING_SOON_COMPANION_FALLBACK_KEYS = new Set<string>([]);

const COMING_SOON_ENVIRONMENT_KEYS = new Set(
  COMING_SOON_SESSION_ENVIRONMENT_VALUES.map((v) => v.toLowerCase()),
);

function isComingSoonCanonicalId(idOrName: string): boolean {
  return COMING_SOON_COMPANION_IDS.some(
    (coming) => coming.toLowerCase() === idOrName.toLowerCase(),
  );
}

/** True when the companion cannot be newly selected (lobby, onboarding, change avatar). */
export function isCompanionComingSoon(nameOrId: string | null | undefined): boolean {
  const raw = (nameOrId ?? "").trim();
  if (!raw) return false;

  const canon = matchDefaultCompanionByAvatarName(raw);
  if (canon) {
    return isComingSoonCanonicalId(canon.id) || isComingSoonCanonicalId(canon.name);
  }

  return COMING_SOON_COMPANION_FALLBACK_KEYS.has(normalizeKey(raw));
}

/** True when the talking background cannot be selected. */
export function isSessionEnvironmentComingSoon(
  value: string | null | undefined,
): boolean {
  const key = (value ?? "").trim().toLowerCase();
  if (!key) return true;
  return COMING_SOON_ENVIRONMENT_KEYS.has(key);
}

export const DEFAULT_SELECTABLE_COMPANION_NAME = "Jordan Taylor";

/** Profile save: reject coming-soon picks; fall back to last good value or Jordan Taylor. */
export function resolveCompanionForProfileSave(
  requested: string,
  currentCommitted: string,
): string {
  const next = requested.trim();
  if (next && !isCompanionComingSoon(next)) return next;
  const prev = currentCommitted.trim();
  if (prev && !isCompanionComingSoon(prev)) return prev;
  return DEFAULT_SELECTABLE_COMPANION_NAME;
}

/** Profile save: environments are not selectable yet — never persist a new value from UI. */
export function resolveEnvironmentForProfileSave(
  requested: string,
  currentCommitted: string,
): string {
  if (isSessionEnvironmentComingSoon(requested)) return currentCommitted;
  return requested;
}
