import { DEFAULT_AVATAR_MODEL_URL, getVitePublicBaseUrl } from "./avatarModelUrl";
import { SARA_V2_MODEL_URL } from "./configs/saraV2Config";
import { SARA_V3_MODEL_URL, useSaraV3ForSara } from "@/avatar/saraV3";

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
export type CompanionCanonicalId =
  | "alex"
  | "sarah"
  | "maya"
  | "jordan"
  | "bianca"
  | "damian"
  | "sasha";
export type CompanionAvatarRuntime =
  | "alex"
  | "maya"
  | "jordan"
  | "legacyHybridSara"
  | "saraV3"
  | "bianca"
  | "damian"
  | "sasha";

/**
 * The legacy-model URL for a companion that HAS no legacy model (Bianca,
 * Damian, Sasha). Empty on purpose: it can never load a file, so a gap in the
 * routing cannot quietly put another companion's GLB on screen. Nothing should
 * reach it — those companions are in `COMPANIONS_WITHOUT_LEGACY_MODEL`.
 */
export const NO_LEGACY_MODEL_URL = "";

/**
 * NEUTRAL PORTRAIT for a non-empty companion label this build does not
 * recognise. Faceless on purpose: before 2026-10-23 an unknown label fell back
 * to `Alex.png`, which put Frankie's face on someone else's card. An ABSENT
 * selection is a different case and still resolves to the default companion
 * at the call sites (`DEFAULT_SELECTABLE_COMPANION_NAME`).
 */
export const NEUTRAL_COMPANION_PORTRAIT_URL =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 375 419">' +
      '<defs><radialGradient id="g" cx="50%" cy="38%" r="70%">' +
      '<stop offset="0" stop-color="#3b2a63"/><stop offset="1" stop-color="#120f24"/>' +
      "</radialGradient></defs>" +
      '<rect width="375" height="419" fill="url(#g)"/></svg>',
  );

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
  "Bianca.png",
  "Damian.png",
  "Sasha.png",
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
 * Companions that use a 3D model in the live session (`ActiveSession`).
 *
 * EVERY RECOGNISED COMPANION — the original four since the Hyper3D four-avatar
 * integration, and Bianca, Damian and Sasha since 2026-10-23 (Hyper3D only, no
 * legacy model; see `COMPANIONS_WITHOUT_LEGACY_MODEL`). Sarah routes to SaraV3
 * or legacy Sara via config and Jordan/RFv2 uses morph-only GLB mode; Alex and
 * Maya Chen have a `public/avatars/` GLB of their own (`Alex.glb`,
 * `maya chen.glb`) which `resolveCompanionModelUrl` has always returned and
 * which `ThreeAvatar` loads by URL like any other.
 *
 * This gate is what mounts `AvatarRuntimeSwitch` at all, so it has to open for
 * a companion before Hyper3D can reach them. The two are deliberately separate
 * questions: this one asks "does this companion render in 3D", the seam asks
 * "which runtime and which asset", and a companion can answer yes here and
 * still fall back to the existing avatar there.
 */
export function companionSessionUses3dModel(
  avatarLabel: string | null | undefined
): boolean {
  return normalizeCompanionId(avatarLabel) !== null;
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
    case "bianca":
      return companionCardImageUrl("Bianca.png");
    case "damian":
      return companionCardImageUrl("Damian.png");
    case "sasha":
      return companionCardImageUrl("Sasha.png");
    default:
      return null;
  }
}

/**
 * Static portrait (PNG under `public/avatars/`) for lobby + 2D-only session view.
 *
 * A NON-EMPTY label this build does not recognise gets
 * `NEUTRAL_COMPANION_PORTRAIT_URL`, never another companion's face.
 *
 * An EMPTY label keeps its previous result, `Alex.png`, unchanged. Its only
 * caller is a live session that has lost its companion identity — a known gap
 * tracked separately (see HYPER3D_SEVEN_COMPANION_AUDIT.md §6) and deliberately
 * not changed here. Profile-level callers never pass an empty label: they
 * resolve an absent selection to `DEFAULT_SELECTABLE_COMPANION_NAME` first.
 */
export function resolveCompanionPortraitUrl(
  avatarLabel: string | null | undefined
): string {
  const known = tryResolveCompanionPortraitUrl(avatarLabel);
  if (known) return known;
  if (!(avatarLabel ?? "").trim()) return companionCardImageUrl("Alex.png");
  return NEUTRAL_COMPANION_PORTRAIT_URL;
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
  if (k === "bianca") return "bianca";
  if (k === "damian") return "damian";
  if (k === "sasha") return "sasha";
  return null;
}

export function resolveCompanionAvatarRuntime(
  avatarLabel: string | null | undefined
): CompanionAvatarRuntime | null {
  const id = normalizeCompanionId(avatarLabel);
  if (!id) return null;
  if (id === "sarah") {
    return useSaraV3ForSara ? "saraV3" : "legacyHybridSara";
  }
  return id;
}

/**
 * Map profile / session avatar labels to GLB URLs under `public/`.
 * Add entries as you drop `Name.glb` into `public/avatars/`.
 */
export function resolveCompanionModelUrl(
  avatarLabel: string | null | undefined
): string {
  const id = normalizeCompanionId(avatarLabel);
  const runtime = resolveCompanionAvatarRuntime(avatarLabel);
  switch (runtime) {
    case "alex":
      return avatarAssetFile("Alex.glb");
    case "legacyHybridSara":
      return SARA_V2_MODEL_URL;
    case "saraV3":
      return SARA_V3_MODEL_URL;
    case "maya":
      return avatarAssetFile("maya chen.glb");
    case "jordan":
      return "/avatars/jordanTaylor.glb";
    case "bianca":
    case "damian":
    case "sasha":
      return NO_LEGACY_MODEL_URL;
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
