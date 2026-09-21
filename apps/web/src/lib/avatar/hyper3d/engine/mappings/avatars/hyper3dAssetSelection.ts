/**
 * WHICH HYPER3D ASSET THE `hyper3d-usc` SLOT LOADS.
 *
 * PRODUCTION: `female_2291.glb`. It replaced `female_229.glb` on 2026-09-14 for
 * its corrected eyeballs; see `docs/FEMALE_2291_MIGRATION_AUDIT.md` for the
 * byte-level structural diff and the measurements behind the eye adapter.
 *
 * `female_229.glb` stays shipped as a HIDDEN PRODUCTION FALLBACK, not a dev
 * rollback. The migration audit accepted one known asset difference into
 * production — the teeth arch sits ~7.9 mm further back and `Teeth.JawOpen`
 * travels 1.53x as far — so the previous asset has to remain one reload away in
 * a production build, without a rebuild and without appearing in the avatar
 * picker. That is the whole reason this resolution is NOT behind
 * `import.meta.env.DEV`, unlike `useLegacyHyper3dFbx` below.
 *
 * Activate the fallback with either of:
 *
 *   ?hyper3dLegacyGlb=1              (URL query; also stored, so it survives)
 *   localStorage.hyper3dLegacyGlb=1  (sticky until cleared)
 *
 * and return to production with `?hyper3dLegacyGlb=0`, which CLEARS the stored
 * preference rather than only overriding it for one page view — otherwise an
 * operator who had pinned the fallback would silently keep it forever.
 *
 * PRIORITY: explicit query parameter, then the stored preference, then the
 * production default.
 *
 * SWAPPING ASSETS SWAPS NOTHING ELSE. Both assets run the same lip-sync engine,
 * expression system, Active Presence, lighting profile, skin profile and hair
 * pipeline. What differs between them is only what an asset can differ in: the
 * GLB that loads, and the eye-rest compatibility constant that cancels that
 * asset's own authored neutral. See `avatarModelConfig`'s `hyper3d-usc` entry.
 *
 * Resolved ONCE at module load, because `avatarModelConfigs` is a module-level
 * constant: a mid-session toggle needs a reload, which is the correct cost for
 * swapping the asset under a live scene graph. The one exception is the
 * automatic load-failure fallback, which is a runtime override applied over this
 * selection — see `AvatarCanvas`.
 */
export type Hyper3dAssetId = "female_2291" | "female_229";

/** How the active asset was chosen. Surfaced in DEV diagnostics only. */
export type Hyper3dAssetSource = "default" | "query" | "localStorage" | "load-failure";

export const HYPER3D_PRODUCTION_ASSET_ID: Hyper3dAssetId = "female_2291";
export const HYPER3D_LEGACY_ASSET_ID: Hyper3dAssetId = "female_229";

export const HYPER3D_GLB_URL = "/avatars/female_2291.glb";
export const HYPER3D_LEGACY_GLB_URL = "/avatars/female_229.glb";

export const HYPER3D_ASSET_URLS: Readonly<Record<Hyper3dAssetId, string>> = {
  female_2291: HYPER3D_GLB_URL,
  female_229: HYPER3D_LEGACY_GLB_URL
};

/** The flag name, in both the query string and `localStorage`. */
export const HYPER3D_LEGACY_GLB_FLAG = "hyper3dLegacyGlb";

export interface Hyper3dAssetSelection {
  assetId: Hyper3dAssetId;
  url: string;
  source: Hyper3dAssetSource;
  /** True when the legacy asset is active, whatever chose it. */
  legacy: boolean;
}

const selectionFor = (assetId: Hyper3dAssetId, source: Hyper3dAssetSource): Hyper3dAssetSelection => ({
  assetId,
  url: HYPER3D_ASSET_URLS[assetId],
  source,
  legacy: assetId === HYPER3D_LEGACY_ASSET_ID
});

/**
 * Reads the query parameter, then the stored preference, then falls back to the
 * production default.
 *
 * A query parameter is WRITTEN THROUGH to storage in both directions — `=1`
 * pins the fallback, `=0` clears it — so an operator recovering a production
 * session does not have to carry the parameter on every subsequent navigation,
 * and a session that was pinned to the fallback can be released with one URL.
 *
 * Every storage access is guarded: a blocked storage API, a sandboxed iframe or
 * an exotic location must never decide the avatar, and must never throw on the
 * module-load path that every other config constant depends on.
 */
export const resolveHyper3dAsset = (): Hyper3dAssetSelection => {
  try {
    if (typeof window === "undefined") return selectionFor(HYPER3D_PRODUCTION_ASSET_ID, "default");
    const query = new URLSearchParams(window.location.search).get(HYPER3D_LEGACY_GLB_FLAG);
    if (query !== null) {
      const wantsLegacy = query !== "0" && query !== "false";
      try {
        if (wantsLegacy) window.localStorage?.setItem(HYPER3D_LEGACY_GLB_FLAG, "1");
        else window.localStorage?.removeItem(HYPER3D_LEGACY_GLB_FLAG);
      } catch {
        // Storage is optional. The query parameter still decides THIS session.
      }
      return selectionFor(wantsLegacy ? HYPER3D_LEGACY_ASSET_ID : HYPER3D_PRODUCTION_ASSET_ID, "query");
    }
    if (window.localStorage?.getItem(HYPER3D_LEGACY_GLB_FLAG) === "1") {
      return selectionFor(HYPER3D_LEGACY_ASSET_ID, "localStorage");
    }
  } catch {
    // Fall through to the production default.
  }
  return selectionFor(HYPER3D_PRODUCTION_ASSET_ID, "default");
};

/** The asset this session loads, resolved once. */
export const hyper3dAssetSelection: Hyper3dAssetSelection = resolveHyper3dAsset();

/**
 * DEV-ONLY FBX ROLLBACK, DEFAULT OFF, and unrelated to the GLB fallback above.
 *
 * The legacy `additional_body.fbx` stays reachable for one reason only — putting
 * it beside the GLB during a migration review. Nothing in the production UI
 * exposes it, and in a production build the flag cannot be turned on at all
 * because the whole resolution is behind `import.meta.env.DEV`.
 *
 *   ?hyper3dLegacyFbx=1              (URL query, survives a reload)
 *   localStorage.hyper3dLegacyFbx=1  (sticky until cleared)
 */
export const HYPER3D_LEGACY_FBX_URL = "/avatars/hyper3d/USCBasicPack/additional_body.fbx";

const readLegacyFlag = (): boolean => {
  /**
   * `import.meta.env?.DEV`, not `import.meta.env.DEV`: this module is reachable
   * from `avatarModelConfigs`, which the acceptance-gate script bundles with
   * rolldown and runs in plain node. There is no Vite there, `import.meta.env`
   * is undefined, and the un-guarded read throws at module load — taking the
   * gate down before it measures anything.
   *
   * Behaviour under Vite is unchanged: `DEV` is defined and decides as before.
   * Outside it, undefined is falsy, which is the same answer a production build
   * gives — the flag is off.
   */
  if (!import.meta.env?.DEV) return false;
  try {
    if (typeof window === "undefined") return false;
    const query = new URLSearchParams(window.location.search).get("hyper3dLegacyFbx");
    if (query !== null) return query !== "0" && query !== "false";
    return window.localStorage?.getItem("hyper3dLegacyFbx") === "1";
  } catch {
    // A blocked storage API or an exotic location must never decide the avatar.
    return false;
  }
};

/** `false` in production, and `false` in dev unless a developer opts in. */
export const useLegacyHyper3dFbx: boolean = readLegacyFlag();
