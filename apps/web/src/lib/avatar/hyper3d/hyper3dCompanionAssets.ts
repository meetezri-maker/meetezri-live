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
  /**
   * Alex, shown as Frankie — `frankie.glb` since 2026-10-23.
   *
   * His previous file, `perm.glb` (`hyper3d_perm`), is no longer a primary: it
   * is his declared backup in `HYPER3D_ASSET_BACKUPS`, reached only after this
   * one fails.
   */
  alex: "hyper3d_frankie",
  /** Jordan Taylor — `jordan.glb`. */
  jordan: "hyper3d_jordan",
  /** Bianca — `bianca.glb`. Added 2026-10-23; no backup. */
  bianca: "hyper3d_bianca",
  /** Damian — `damian.glb`. Added 2026-10-23; no backup. */
  damian: "hyper3d_damian",
  /** Sasha — `sasha.glb`. Added 2026-10-23; no backup. */
  sasha: "hyper3d_sasha",
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

/**
 * COMPANIONS WITH NO LEGACY MODEL LEFT, so "fall back to the existing Solace
 * avatar" is not an option for them.
 *
 * `sara-v3.glb` is RETIRED. Romy's models are Hyper3D-authored and carry the
 * 51 ARKit morph targets; the legacy runtimes read a different vocabulary
 * entirely (`saraV3` and `jordan` want `viseme_*`, `maya` and `alex` ship two
 * morphs apiece), so pointing `ThreeAvatar` at one of her files renders a face
 * that never moves — silently, because `saraV3MorphDiscovery` degrades rather
 * than throwing. Showing her the retired sara-v3 instead is the thing this
 * declaration exists to prevent.
 *
 * So when Hyper3D cannot run for one of these companions — the flag is off, or
 * both her assets failed — the seam shows her PORTRAIT, the same
 * `StaticSessionPortrait` the 2D companions already use. Everyone else keeps
 * their existing GLB fallback untouched.
 *
 * FRANKIE (`alex`) JOINED ON 2026-10-23, by decision rather than by necessity.
 * `Alex.glb` still exists, but it is an older, visibly different character
 * with two morph targets, and falling back to it put the wrong-looking man
 * under Frankie's name. His chain is now `frankie.glb` -> `perm.glb` -> his
 * portrait, and with the flag off, his portrait directly.
 *
 * BIANCA, DAMIAN AND SASHA (2026-10-23) never had a legacy model. Their chain
 * is their own Hyper3D file -> their own portrait; with the flag off, their
 * portrait. Without this entry the seam would hand them to `ThreeAvatar`.
 */
export const COMPANIONS_WITHOUT_LEGACY_MODEL: ReadonlySet<CompanionCanonicalId> =
  new Set<CompanionCanonicalId>(["sarah", "alex", "bianca", "damian", "sasha"]);

/** True when this companion has no legacy GLB to fall back to. */
export function companionHasNoLegacyModel(
  rawAvatarLabel: string | undefined | null,
  activeAvatarId?: string | null,
): boolean {
  const id =
    normalizeCompanionId(rawAvatarLabel) ??
    RUNTIME_KEY_TO_COMPANION[(activeAvatarId ?? "").trim()] ??
    normalizeCompanionId(activeAvatarId);
  return id !== null && COMPANIONS_WITHOUT_LEGACY_MODEL.has(id);
}

/** Companions this build can render with Hyper3D. Used by tests and diagnostics. */
export const HYPER3D_MAPPED_COMPANION_IDS = Object.keys(
  HYPER3D_COMPANION_ASSETS,
) as CompanionCanonicalId[];
