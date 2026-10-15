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
/**
 * ─────────────────────────────────────────────────────────────────────────────
 * THE FOUR-COMPANION ASSETS, ADDED 2026-10-13.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The three ids above are the ORIGINAL SINGLE-AVATAR FAMILY and nothing about
 * them changes: `resolveHyper3dAsset` still resolves within that family alone,
 * the `?hyper3dLegacyGlb` rollback still swaps `female_2291` for `female_229`,
 * and the DEV corrective-morph experiment still gates on `import.meta.env.DEV`.
 *
 * The four below are the per-companion assets. They are NOT reachable from
 * `resolveHyper3dAsset` — they are chosen by companion identity at the seam
 * (`hyper3dCompanionAssets`), which is why an operator flag cannot substitute
 * one companion's model for another's. See `HYPER3D_OPERATOR_SELECTABLE_ASSETS`.
 *
 * ASSET IDS ARE NOT COMPANION IDS. `hyper3d_sara` is the file `sara.glb`, which
 * the application shows as **Maya Chen**; `hyper3d_afr` is `afr.glb`, which the
 * application shows as **Sara Mitchell**. The asset ids are named after the
 * files the designer delivered so that a name here always means a file on disk,
 * and the companion mapping lives in exactly one other place.
 */
export type Hyper3dAssetId =
  | "female_2291"
  | "female_229"
  | "female_2291_lowerlip_v2"
  | "hyper3d_afr"
  | "hyper3d_arfv2"
  | "hyper3d_sara"
  | "hyper3d_perm"
  | "hyper3d_jordan";

/** How the active asset was chosen. Surfaced in DEV diagnostics only. */
export type Hyper3dAssetSource =
  | "default"
  | "query"
  | "localStorage"
  | "load-failure"
  | "dev-experimental";

export const HYPER3D_PRODUCTION_ASSET_ID: Hyper3dAssetId = "female_2291";
export const HYPER3D_LEGACY_ASSET_ID: Hyper3dAssetId = "female_229";

/**
 * STAGE 2 — THE EXPERIMENTAL CORRECTIVE-MORPH ASSET, DEV ONLY.
 *
 * `female_2291.glb` with ONE appended morph target, `mouthLowerDownDeep`. Built
 * by `apps/web/scripts/hyper3d/buildCorrectiveMorph.mjs`; all 51 original
 * morphs, the 14 eyelash sparse accessors, the 875-joint skin, every material
 * and all 18 embedded images are byte-identical to production, which
 * `verifyCorrectiveMorph.mjs` proves accessor by accessor.
 *
 * ITS GATE IS DIFFERENT FROM THE LEGACY FALLBACK'S, and the difference is the
 * point. `hyper3dLegacyGlb` is deliberately reachable in a production build
 * because it is an accepted operational rollback to a shipped asset. This is an
 * EXPERIMENT: it sits behind `import.meta.env.DEV` first, so neither a query
 * parameter nor a stored flag can select it in production.
 */
export const HYPER3D_EXPERIMENTAL_ASSET_ID: Hyper3dAssetId = "female_2291_lowerlip_v2";

export const HYPER3D_GLB_URL = "/avatars/female_2291.glb";
export const HYPER3D_LEGACY_GLB_URL = "/avatars/female_229.glb";
export const HYPER3D_EXPERIMENTAL_GLB_URL = "/avatars/experimental/female_2291-lowerlip-v2.glb";

/** The per-companion assets, delivered 2026-10-12 under `public/avatars/hyper3d/`. */
export const HYPER3D_AFR_GLB_URL = "/avatars/hyper3d/afr.glb";
/**
 * TEMPORARY MODEL TRIAL, 2026-10-16 — `arfv2.glb`, the designer's re-export.
 *
 * A SEPARATE ASSET ID RATHER THAN A NEW URL ON `hyper3d_afr`, because the two
 * files are not interchangeable: `arfv2.glb` renames the hair mesh
 * (`Character.002` -> `Character.001`, so three.js names it `Character001` /
 * `Character001_1`) and its hair material (`Material.005` -> `Hair`). Pointing
 * the existing id at it would leave `hyper3d_afr`'s adapter describing a file
 * it no longer matches, and the restore would be more than one line.
 */
export const HYPER3D_ARFV2_GLB_URL = "/avatars/hyper3d/arfv2.glb";
export const HYPER3D_SARA_GLB_URL = "/avatars/hyper3d/sara.glb";
export const HYPER3D_PERM_GLB_URL = "/avatars/hyper3d/perm.glb";
export const HYPER3D_JORDAN_GLB_URL = "/avatars/hyper3d/jordan.glb";

export const HYPER3D_ASSET_URLS: Readonly<Record<Hyper3dAssetId, string>> = {
  female_2291: HYPER3D_GLB_URL,
  female_229: HYPER3D_LEGACY_GLB_URL,
  female_2291_lowerlip_v2: HYPER3D_EXPERIMENTAL_GLB_URL,
  hyper3d_afr: HYPER3D_AFR_GLB_URL,
  hyper3d_arfv2: HYPER3D_ARFV2_GLB_URL,
  hyper3d_sara: HYPER3D_SARA_GLB_URL,
  hyper3d_perm: HYPER3D_PERM_GLB_URL,
  hyper3d_jordan: HYPER3D_JORDAN_GLB_URL
};

/**
 * THE ASSETS AN OPERATOR FLAG MAY SELECT, and the reason this list exists.
 *
 * `?hyper3dLegacyGlb=1` and `?hyper3dLowerLipV2=1` were written when Hyper3D
 * rendered ONE companion, so "swap the asset" and "swap the avatar" were the
 * same action. They are no longer: with four companions mapped to four files, a
 * flag that replaced the loaded asset outright would put another person's face
 * on the selected companion's session — silently, and with the correct name and
 * voice still attached.
 *
 * So the rollback flags keep their exact meaning and lose their reach. They
 * resolve only within the single-avatar family below, and the per-companion
 * resolution ignores them entirely. An operator pinning the legacy asset while
 * a Maya Chen session is open now gets Maya Chen, not female_229.
 */
export const HYPER3D_OPERATOR_SELECTABLE_ASSETS: readonly Hyper3dAssetId[] = [
  "female_2291",
  "female_229",
  "female_2291_lowerlip_v2"
];

export const isOperatorSelectableHyper3dAsset = (assetId: Hyper3dAssetId): boolean =>
  HYPER3D_OPERATOR_SELECTABLE_ASSETS.includes(assetId);

/** The flag name, in both the query string and `localStorage`. */
export const HYPER3D_LEGACY_GLB_FLAG = "hyper3dLegacyGlb";

/** The DEV-only flag that selects the corrective-morph asset. */
export const HYPER3D_EXPERIMENTAL_GLB_FLAG = "hyper3dLowerLipV2";

export interface Hyper3dAssetSelection {
  assetId: Hyper3dAssetId;
  url: string;
  source: Hyper3dAssetSource;
  /** True when the legacy asset is active, whatever chose it. */
  legacy: boolean;
  /**
   * True ONLY when the DEV experimental asset is active. The controller reads
   * this to decide whether to articulate with the corrective profile, so a
   * production frame — where it is always false — cannot activate the morph.
   */
  experimental: boolean;
}

const selectionFor = (assetId: Hyper3dAssetId, source: Hyper3dAssetSource): Hyper3dAssetSelection => ({
  assetId,
  url: HYPER3D_ASSET_URLS[assetId],
  source,
  legacy: assetId === HYPER3D_LEGACY_ASSET_ID,
  experimental: assetId === HYPER3D_EXPERIMENTAL_ASSET_ID
});

/**
 * Whether a DEV session has asked for the experimental corrective-morph asset.
 *
 * `import.meta.env?.DEV` FIRST, exactly as `useLegacyHyper3dFbx` below does and
 * unlike `resolveHyper3dAsset`'s legacy branch: Vite replaces that expression
 * with `false` in a production build, so neither the query parameter nor the
 * stored flag is consulted there at all. The optional chaining is load-bearing
 * for the reason the note on `readLegacyFlag` gives — this module is reachable
 * from `avatarModelConfigs`, which the acceptance gate bundles with rolldown and
 * runs in plain node, where `import.meta.env` is undefined.
 */
const readExperimentalFlag = (): boolean => {
  if (!import.meta.env?.DEV) return false;
  try {
    if (typeof window === "undefined") return false;
    const query = new URLSearchParams(window.location.search).get(HYPER3D_EXPERIMENTAL_GLB_FLAG);
    if (query !== null) {
      const wanted = query !== "0" && query !== "false";
      try {
        if (wanted) window.localStorage?.setItem(HYPER3D_EXPERIMENTAL_GLB_FLAG, "1");
        else window.localStorage?.removeItem(HYPER3D_EXPERIMENTAL_GLB_FLAG);
      } catch {
        // The query parameter still decides THIS session.
      }
      return wanted;
    }
    return window.localStorage?.getItem(HYPER3D_EXPERIMENTAL_GLB_FLAG) === "1";
  } catch {
    // A blocked storage API or an exotic location must never decide the avatar.
    return false;
  }
};

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
    /**
     * THE DEV EXPERIMENT WINS WHEN IT IS ASKED FOR, and it can only be asked for
     * in a DEV build. Checked FIRST so a developer who once pinned the legacy
     * fallback is not silently held on it while trying to review the corrective
     * morph — the flag is explicit either way, and in production this call is
     * `false` before it reads anything.
     */
    if (readExperimentalFlag()) return selectionFor(HYPER3D_EXPERIMENTAL_ASSET_ID, "dev-experimental");
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
