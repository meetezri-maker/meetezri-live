import { canonicalCompanionDisplayName, companionDisplayName } from "@meetezri/shared";

/**
 * The name sent to the agent as WebSocket `avatar_name=` — the member-facing
 * display name of THIS session's companion (`Sara Mitchell` → `Romy`).
 *
 * Takes the session's stored companion label (config / restored session
 * identity), never a model filename, voice id or the profile's current pick.
 * The stored canonical identity is untouched; this is a display-only mapping.
 *
 * Returns null when the session has no companion identity, so the caller omits
 * the parameter instead of sending an empty value or another companion's name.
 * Admin-created companions keep their own name, as in the UI.
 */
export function resolveEzriAvatarName(companionLabel: string | null | undefined): string | null {
  const raw = typeof companionLabel === "string" ? companionLabel : "";
  if (canonicalCompanionDisplayName(raw) === "Not set") return null;
  const name = companionDisplayName(raw).trim();
  return name || null;
}
