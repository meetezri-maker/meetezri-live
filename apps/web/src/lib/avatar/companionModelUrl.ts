import { DEFAULT_AVATAR_MODEL_URL, getVitePublicBaseUrl } from "./avatarModelUrl";

/** Canonical companion id for URLs, tuning, and assets (keep in sync with view tuning). */
export type CompanionCanonicalId = "alex" | "sarah" | "maya" | "jordan";

/** GLB/PNG filenames under `public/avatars/` (spaces encoded for URLs). */
function avatarAssetFile(fileName: string): string {
  return `${getVitePublicBaseUrl()}avatars/${encodeURIComponent(fileName)}`;
}

/**
 * Companions that use a 3D GLB in the live session (`ActiveSession`).
 * Only Sarah uses GLB; Jordan and everyone else use a static PNG portrait (no GLB).
 */
export function companionSessionUses3dModel(
  avatarLabel: string | null | undefined
): boolean {
  const id = normalizeCompanionId(avatarLabel);
  return id === "sarah";
}

/** Static portrait (PNG under `public/avatars/`) for lobby + 2D-only session view. */
export function resolveCompanionPortraitUrl(
  avatarLabel: string | null | undefined
): string {
  const id = normalizeCompanionId(avatarLabel);
  switch (id) {
    case "alex":
      return companionCardImageUrl("Alex.png");
    case "sarah":
      return companionCardImageUrl("Sara Mitchell.png");
    case "maya":
      return companionCardImageUrl("maya chen.png");
    case "jordan":
      return companionCardImageUrl("jordan Taylor.png");
    default:
      return companionCardImageUrl("Alex.png");
  }
}

export function normalizeCompanionId(
  avatarLabel: string | null | undefined
): CompanionCanonicalId | null {
  const k = (avatarLabel ?? "").trim().toLowerCase();
  if (k === "alex" || k === "alex rivera") return "alex";
  if (
    k === "sarah" ||
    k === "sarah mitchell" ||
    k === "sara" ||
    k === "sara mitchell"
  ) {
    return "sarah";
  }
  if (k === "maya" || k === "maya chen") return "maya";
  if (k === "jordan" || k === "jordan taylor") return "jordan";
  return null;
}

/**
 * Map profile / session avatar labels to GLB URLs under `public/`.
 * Add entries as you drop `Name.glb` into `public/avatars/`.
 */
export function resolveCompanionModelUrl(
  avatarLabel: string | null | undefined
): string {
  const id = normalizeCompanionId(avatarLabel);
  switch (id) {
    case "alex":
      return avatarAssetFile("Alex.glb");
    case "sarah":
      return avatarAssetFile("Sara Mitchell.glb");
    case "maya":
      return avatarAssetFile("maya chen.glb");
    case "jordan":
      return DEFAULT_AVATAR_MODEL_URL;
    default:
      return DEFAULT_AVATAR_MODEL_URL;
  }
}

/** Public URL for a companion card image in the lobby (PNG under `public/avatars/`). */
export function companionCardImageUrl(fileName: string): string {
  return avatarAssetFile(fileName);
}
