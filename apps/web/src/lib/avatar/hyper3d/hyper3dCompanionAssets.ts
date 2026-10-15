import {
  normalizeCompanionId,
  type CompanionCanonicalId,
} from "@/lib/avatar/companionModelUrl";
import type { Hyper3dAssetId } from "./engine/mappings/avatars/hyper3dAssetSelection";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * WHICH COMPANION LOADS WHICH HYPER3D FILE. THE ONLY PLACE THIS IS DECIDED.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * THREE KINDS OF NAME, DELIBERATELY NOT INTERCHANGEABLE:
 *
 *   companion id    `sarah` | `maya` | `alex` | `jordan` — what
 *                   `normalizeCompanionId` already produces from a display name.
 *   display name    "Sara Mitchell", "Maya Chen", "Alex", "Jordan Taylor" —
 *                   what the member sees, what the DB stores, what picks the
 *                   voice. NOT changed by anything here.
 *   asset id        `hyper3d_afr` and friends — a FILE on disk.
 *
 * THE MAPPING IS NOT GUESSABLE FROM FILENAMES, and the confirmed assignment
 * crosses over twice. `afr.glb` is Sara Mitchell; `sara.glb` is MAYA CHEN. The
 * file names are the designer's working labels for appearance, not companion
 * names, and `afr.glb` is specifically the designer's updated `female_2291`
 * with its hair and outfit fixed — which is why it takes over the companion
 * female_2291 was rendering. Anyone reading a filename and inferring a
 * companion will get two of the four wrong, so nothing in this codebase infers:
 * it reads this table.
 *
 * AN UNMAPPED COMPANION GETS NO HYPER3D ASSET AND NO AVATAR SUBSTITUTE. The
 * lookup returns `null`, the seam keeps that companion on its existing runtime,
 * and the Hyper3D host is never mounted — so an unrecognised id cannot quietly
 * load somebody else's face under the right name and the right voice. That is
 * the one failure mode a four-avatar mapping makes possible, and it is the one
 * this returns `null` to prevent.
 */
export const HYPER3D_COMPANION_ASSETS: Readonly<
  Record<CompanionCanonicalId, Hyper3dAssetId>
> = {
  /**
   * Sara Mitchell — TEMPORARY MODEL TRIAL on `arfv2.glb` (2026-10-16).
   *
   * Her canonical id, display label, voice and personality are untouched; only
   * the file behind her changes. RESTORE: put `"hyper3d_afr"` back here. That
   * one word is the whole switch — `hyper3d_afr` and its adapter are still
   * present and unmodified.
   */
  sarah: "hyper3d_arfv2",
  /** Maya Chen — `sara.glb`. The filename is the designer's label, not the companion. */
  maya: "hyper3d_sara",
  /** Alex — `perm.glb`. */
  alex: "hyper3d_perm",
  /** Jordan Taylor — `jordan.glb`. */
  jordan: "hyper3d_jordan",
};

/**
 * Runtime keys that `ActiveSession` may pass as `activeAvatarId` instead of a
 * display name.
 *
 * `SessionStage` builds `activeAvatarId` as
 * `resolvedAvatarKey ?? fixedViewportConfig?.avatarId ?? companionCanonicalId`,
 * and `resolvedAvatarKey` comes from `resolveCompanionAvatarRuntime` — so for
 * Sara the live value is `"saraV3"`, which `normalizeCompanionId` does not
 * recognise. These are the keys that are NOT already canonical ids.
 */
const RUNTIME_KEY_TO_COMPANION: Readonly<Record<string, CompanionCanonicalId>> = {
  sara: "sarah",
  saraV3: "sarah",
  legacyHybridSara: "sarah",
};

/**
 * The Hyper3D asset for a companion, or `null` when that companion has none.
 *
 * `rawAvatarLabel` is authoritative: it is `config.avatar` verbatim, the same
 * value `ActiveSession` feeds to `normalizeCompanionId`. `activeAvatarId` is
 * consulted second so the lookup still holds when a caller supplies only the
 * runtime key.
 */
export function resolveHyper3dCompanionAsset(
  rawAvatarLabel: string | undefined | null,
  activeAvatarId?: string | null,
): Hyper3dAssetId | null {
  const fromLabel = normalizeCompanionId(rawAvatarLabel);
  if (fromLabel) return HYPER3D_COMPANION_ASSETS[fromLabel];

  const key = (activeAvatarId ?? "").trim();
  if (!key) return null;

  const viaRuntimeKey = RUNTIME_KEY_TO_COMPANION[key];
  if (viaRuntimeKey) return HYPER3D_COMPANION_ASSETS[viaRuntimeKey];

  const fromId = normalizeCompanionId(key);
  return fromId ? HYPER3D_COMPANION_ASSETS[fromId] : null;
}

/** Companions this build can render with Hyper3D. Used by tests and diagnostics. */
export const HYPER3D_MAPPED_COMPANION_IDS = Object.keys(
  HYPER3D_COMPANION_ASSETS,
) as CompanionCanonicalId[];
