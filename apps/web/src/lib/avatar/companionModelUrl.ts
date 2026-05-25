import { DEFAULT_AVATAR_MODEL_URL, getVitePublicBaseUrl } from "./avatarModelUrl";
import { SARA_AVATAR_DEFINITION } from "./configs/saraConfig";

/**
 * Use DB `image_url` only when it is a real URL or path to an image file.
 * Legacy rows may store a single emoji — those are ignored so portraits resolve from `public/avatars/<Name>.png`.
 */
export function effectiveAvatarImageUrlFromDb(
  raw: string | null | undefined
): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/")) return s;
  if (s.startsWith("data:")) return s;
  if (/\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(s)) return s;
  return "";
}

/** Canonical companion id for URLs, tuning, and assets (keep in sync with view tuning). */
export type CompanionCanonicalId = "alex" | "sarah" | "maya" | "jordan";

/** GLB/PNG filenames under `public/avatars/` (spaces encoded for URLs). */
function avatarAssetFile(fileName: string): string {
  return `${getVitePublicBaseUrl()}avatars/${encodeURIComponent(fileName)}`;
}

/** Build-time list of `public/avatars/*.png` — add a file there and it is picked up automatically. */
const portraitPngGlobKeys = Object.keys(
  import.meta.glob("../../../public/avatars/*.png", { eager: false })
);

/** Canonical portrait files — names in admin / DB should match the stem (e.g. `Alex` ↔ Alex.png). */
const FALLBACK_AVATAR_PORTRAIT_PNG_FILES = [
  "Alex.png",
  "jordan Taylor.png",
  "maya chen.png",
  "Sara Mitchell.png",
] as const;

function pngBasenamesFromPublicFolder(): string[] {
  const fromGlob = portraitPngGlobKeys
    .map((key) => {
      const normalized = key.replace(/\\/g, "/");
      const tail = normalized.split("/").pop() ?? "";
      return tail.endsWith(".png") ? tail : "";
    })
    .filter(Boolean);
  return [...new Set([...fromGlob, ...FALLBACK_AVATAR_PORTRAIT_PNG_FILES])];
}

/**
 * Resolve portrait URL when `public/avatars/<Display Name>.png` exists (case-insensitive stem match).
 * Keep the AI avatar **name** in admin aligned with the PNG filename (e.g. `Granny.png` ↔ name "Granny").
 */
export function portraitUrlFromAvatarsFolderFile(
  displayName: string | null | undefined
): string | null {
  const k = (displayName ?? "").trim().toLowerCase();
  if (!k) return null;
  for (const file of pngBasenamesFromPublicFolder()) {
    const stem = file.replace(/\.png$/i, "").trim().toLowerCase();
    if (stem === k) return avatarAssetFile(file);
  }
  return null;
}

/**
 * Companions that use a 3D GLB in the live session (`ActiveSession`).
 * Sarah uses the legacy GLB path; Jordan/RFv2 uses morph-only GLB mode.
 */
export function companionSessionUses3dModel(
  avatarLabel: string | null | undefined
): boolean {
  const id = normalizeCompanionId(avatarLabel);
  return id === "sarah" || id === "jordan";
}

/** RFv2-style avatars are morph-driven and should not use facial bone mouth fallback. */
export function companionSessionUsesRfv2Morphs(
  avatarLabel: string | null | undefined
): boolean {
  const id = normalizeCompanionId(avatarLabel);
  return id === "jordan";
}

/**
 * Portrait URL: first match a PNG in `public/avatars/`, then legacy aliases (older full names → same files).
 * Returns `null` if nothing matches (caller shows a placeholder instead of a wrong face).
 */
export function tryResolveCompanionPortraitUrl(
  avatarLabel: string | null | undefined
): string | null {
  const fromFolder = portraitUrlFromAvatarsFolderFile(avatarLabel);
  if (fromFolder) return fromFolder;

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
      return null;
  }
}

/** Static portrait (PNG under `public/avatars/`) for lobby + 2D-only session view. */
export function resolveCompanionPortraitUrl(
  avatarLabel: string | null | undefined
): string {
  return (
    tryResolveCompanionPortraitUrl(avatarLabel) ?? companionCardImageUrl("Alex.png")
  );
}

export function normalizeCompanionId(
  avatarLabel: string | null | undefined
): CompanionCanonicalId | null {
  const k = (avatarLabel ?? "").trim().toLowerCase();
  if (k === "alex" || k === "alex rivera") return "alex";
  if (
    k === "sara" ||
    k === "sara mitchell" ||
    k === "sarah" ||
    k === "sarah mitchell"
  ) {
    return "sarah";
  }
  if (k === "maya chen" || k === "maya") return "maya";
  if (k === "jordan taylor" || k === "jordan") return "jordan";
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
     return "/avatars/SaraMitchell.glb";
    case "maya":
      return avatarAssetFile("maya chen.glb");
    case "jordan":
      return "/avatars/jordanTaylor.glb";
    default:
      return DEFAULT_AVATAR_MODEL_URL;
  }
}

/** Public URL for a companion card image in the lobby (PNG under `public/avatars/`). */
export function companionCardImageUrl(fileName: string): string {
  return avatarAssetFile(fileName);
}

/** Rectangular picker card — tall frame so bust PNGs show full head (not cropped at crown). */
export const companionCardPortraitFrameClass =
  "relative w-full shrink-0 overflow-hidden bg-gradient-to-b from-zinc-800/45 via-zinc-900/65 to-black/70 aspect-[3/4] min-h-[9.25rem] sm:min-h-[10.75rem]";

/** Focus slightly above vertical center — lobby PNGs place faces below the file top. */
export const companionCardPortraitImgClass =
  "size-full object-cover object-[50%_5%]";

/** Circular avatars (onboarding, change-avatar, chips). */
export const companionRoundPortraitImgClass = "object-cover object-[50%_12%]";
