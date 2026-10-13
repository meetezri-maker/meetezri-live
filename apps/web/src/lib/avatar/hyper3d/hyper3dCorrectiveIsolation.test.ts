import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HYPER3D_EXPERIMENTAL_GLB_FLAG,
  HYPER3D_EXPERIMENTAL_GLB_URL,
  HYPER3D_PRODUCTION_ASSET_ID
} from "./engine/mappings/avatars/hyper3dAssetSelection";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * STAGE 2 §8 — PRODUCTION ISOLATION, CHECKED AGAINST THE BUILD OUTPUT ITSELF.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THE SOURCE IS NOT THE THING TO CHECK. Everything that makes the
 * experimental asset DEV-only is a BUILD property: `import.meta.env.DEV` folding
 * to `false`, the flag reader collapsing to `() => false`, dead branches being
 * dropped, and `public/avatars/experimental/` being pruned from the output. A
 * test that reads the TypeScript can only confirm the intent; whether the
 * intent survived minification is a question about `dist`.
 *
 * So this file reads `dist` when it exists. It is deliberately SKIPPED rather
 * than failed when it does not, because a build is not a precondition for the
 * unit suite — but when CI has built, these are the assertions that actually
 * bind.
 *
 * WHAT WAS MEASURED, on the build this was written against:
 *
 *   readExperimentalFlag        -> `cr=()=>!1`          unconditionally false
 *   the DEV constant            -> `pd=!1`, `gd=pd`     a literal
 *   correctiveLowerLip          -> `correctiveLowerLip:gd`  so: always false
 *   the flag name string        -> ABSENT from all of dist
 *   both experimental GLBs      -> ABSENT from all of dist
 *
 * The experimental URL string itself DOES survive, as one value in the asset-id
 * to URL map. That is expected and harmless: the map is a plain object the
 * production and fallback paths both read, and the only branch that looks the
 * experimental id up is the one behind `cr()`. The asset it points at is not in
 * the deployment, and nothing reachable can ask for it.
 */

const DIST = "dist";
const hasDist = existsSync(join(DIST, "assets"));
const describeDist = hasDist ? describe : describe.skip;

/** Every file under a directory, recursively. */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

describeDist("§8 the production build cannot reach the experimental avatar", () => {
  const bundles = walk(join(DIST, "assets")).filter((f) => f.endsWith(".js"));
  const sources = bundles.map((file) => ({ file, text: readFileSync(file, "utf8") }));

  it("ships neither experimental GLB", () => {
    /**
     * The packaging result. Vite copies `publicDir` wholesale, so without the
     * `exclude-experimental-avatars` plugin these two files add 89 MB to every
     * deployment for an asset no production code path can select.
     */
    const all = walk(DIST);
    const experimental = all.filter((f) => /lowerlip-v\d/i.test(f));
    expect(experimental).toEqual([]);
    expect(existsSync(join(DIST, "avatars", "experimental"))).toBe(false);

    // And the assets that MUST ship still do, which is the other half of the claim.
    expect(existsSync(join(DIST, "avatars", "female_2291.glb"))).toBe(true);
    expect(existsSync(join(DIST, "avatars", "female_229.glb"))).toBe(true);
  });

  it("leaves the production and fallback GLBs byte-identical to source", () => {
    for (const name of ["female_2291.glb", "female_229.glb"]) {
      const from = readFileSync(join("public", "avatars", name));
      const to = readFileSync(join(DIST, "avatars", name));
      expect(to.length, name).toBe(from.length);
      expect(to.equals(from), name).toBe(true);
    }
  }, 120_000);

  it("contains no way to name the experimental asset", () => {
    /**
     * The flag is the ONLY input that can select the experimental GLB — there
     * is no other query parameter, storage key or diagnostic field that reaches
     * it. If its name is not in the bundle, no URL and no `localStorage` entry
     * a user can set will activate it, which is the §2 requirement stated as a
     * property of the artifact rather than of the source.
     */
    for (const { file, text } of sources) {
      expect(text.includes(HYPER3D_EXPERIMENTAL_GLB_FLAG), file).toBe(false);
    }
  });

  it("folded the DEV gate to a constant rather than a runtime check", () => {
    /**
     * `readExperimentalFlag` must not merely RETURN false in production — it
     * must have been COMPILED to false, because a surviving runtime check means
     * the branch survived and some future refactor could make it reachable.
     *
     * The signature of success is a zero-argument arrow returning a false
     * literal, next to the one call site that selects the experimental asset.
     */
    const withUrl = sources.filter((s) => s.text.includes(HYPER3D_EXPERIMENTAL_GLB_URL));
    expect(withUrl).toHaveLength(1);
    const { text } = withUrl[0];

    // The flag reader collapsed to a constant-false arrow.
    expect(text).toMatch(/[A-Za-z$_][\w$]*=\(\)=>!1/);
    // No surviving env lookup anywhere in that bundle.
    expect(text).not.toContain("import.meta.env");
    // The experimental selection exists only behind that constant.
    const guarded = /if\(([A-Za-z$_][\w$]*)\(\)\)return [A-Za-z$_][\w$]*\([A-Za-z$_][\w$]*,"dev-experimental"\)/.exec(text);
    expect(guarded, "the dev-experimental branch should be behind a bare predicate call").not.toBeNull();
    const predicate = guarded![1];
    expect(text).toContain(`${predicate}=()=>!1`);
  });

  it("passes correctiveLowerLip into the controller as a literal false", () => {
    /**
     * The second gate, independent of asset selection: even if the experimental
     * GLB were somehow present, the controller is not told to use the corrective
     * profile.
     *
     * FINDING THE RIGHT OCCURRENCE MATTERS. `correctiveLowerLip` appears twice
     * in the bundle — once in the debug object the controller RETURNS, where the
     * value is a local, and once in the options object the orchestrator PASSES.
     * Only the second is the gate. It is anchored by `mouthDeadlineOverride`,
     * which sits beside it in the same options literal, so the anchor is a
     * structural fact about the call rather than a guess about minified names.
     *
     * The value must trace back to a false LITERAL through const assignments,
     * not merely be falsy at runtime: a surviving variable is a surviving code
     * path.
     */
    const anchored = sources.filter((s) =>
      /correctiveLowerLip:(?:[A-Za-z$_][\w$]*|!1),\s*mouthDeadlineOverride:/.test(s.text)
    );
    expect(anchored, "the orchestrator call site should be in exactly one bundle").toHaveLength(1);
    const { file, text } = anchored[0];

    const call = /correctiveLowerLip:([A-Za-z$_][\w$]*|!1),\s*mouthDeadlineOverride:/.exec(text);
    expect(call, file).not.toBeNull();
    let name = call![1];
    if (name === "!1") return;

    const seen = new Set<string>();
    for (let hop = 0; hop < 6; hop += 1) {
      expect(seen.has(name), `cycle while chasing ${call![1]}`).toBe(false);
      seen.add(name);
      const assign = new RegExp(`\\b${name}=(!1|[A-Za-z$_][\\w$]*)[,;)]`).exec(text);
      expect(assign, `${file}: no assignment for ${name} (chain: ${[...seen].join(" -> ")})`)
        .not.toBeNull();
      if (assign![1] === "!1") return;
      name = assign![1];
    }
    throw new Error(`${file}: correctiveLowerLip did not resolve to a false literal`);
  });

  it("passes no deadline override, so production keeps 34 SOFT", () => {
    /**
     * The same call site carries `mouthDeadlineOverride`, and the accepted
     * production baseline is 34 SOFT with no override. A non-null value here
     * would mean a diagnostic mode had leaked into production convergence.
     */
    const { text } = sources.filter((s) => s.text.includes("mouthDeadlineOverride:"))[0];
    const overrides = text.match(/mouthDeadlineOverride:([A-Za-z$_][\w$]*|null)/g) ?? [];
    expect(overrides.length).toBeGreaterThan(0);
    for (const match of overrides) expect(match).toBe("mouthDeadlineOverride:null");
  });
});

describe("§2 the DEV gate, exercised directly", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  /**
   * The source-level counterpart to the bundle checks above: with DEV false,
   * neither a query parameter nor a stored preference selects the experimental
   * asset. This runs the REAL resolver with the real inputs, which is the only
   * way to show the flag is inert rather than merely absent from a bundle.
   */
  async function resolveWith(dev: boolean, search: string, stored: string | null) {
    vi.stubEnv("DEV", dev);
    vi.resetModules();
    const original = window.location.search;
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...window.location, search }
    });
    window.localStorage.clear();
    if (stored !== null) window.localStorage.setItem(HYPER3D_EXPERIMENTAL_GLB_FLAG, stored);
    const module = await import("./engine/mappings/avatars/hyper3dAssetSelection");
    const selection = module.resolveHyper3dAsset();
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...window.location, search: original }
    });
    return selection;
  }

  it("ignores the query parameter in production", async () => {
    const selection = await resolveWith(false, `?${HYPER3D_EXPERIMENTAL_GLB_FLAG}=1`, null);
    expect(selection.experimental).toBe(false);
    expect(selection.assetId).toBe(HYPER3D_PRODUCTION_ASSET_ID);
    expect(selection.url).not.toBe(HYPER3D_EXPERIMENTAL_GLB_URL);
  });

  it("ignores a stored preference in production", async () => {
    const selection = await resolveWith(false, "", "1");
    expect(selection.experimental).toBe(false);
    expect(selection.assetId).toBe(HYPER3D_PRODUCTION_ASSET_ID);
  });

  it("does not even write the storage key in production", async () => {
    /**
     * A production visit carrying the parameter must not leave a pinned
     * preference behind that a later DEV session would silently inherit.
     */
    await resolveWith(false, `?${HYPER3D_EXPERIMENTAL_GLB_FLAG}=1`, null);
    expect(window.localStorage.getItem(HYPER3D_EXPERIMENTAL_GLB_FLAG)).toBeNull();
  });

  it("honours the query parameter in DEV, and stores it", async () => {
    const selection = await resolveWith(true, `?${HYPER3D_EXPERIMENTAL_GLB_FLAG}=1`, null);
    expect(selection.experimental).toBe(true);
    expect(selection.url).toBe(HYPER3D_EXPERIMENTAL_GLB_URL);
    expect(window.localStorage.getItem(HYPER3D_EXPERIMENTAL_GLB_FLAG)).toBe("1");
  });

  it("honours a stored preference in DEV, and releases it with =0", async () => {
    const pinned = await resolveWith(true, "", "1");
    expect(pinned.experimental).toBe(true);
    const released = await resolveWith(true, `?${HYPER3D_EXPERIMENTAL_GLB_FLAG}=0`, "1");
    expect(released.experimental).toBe(false);
    expect(released.assetId).toBe(HYPER3D_PRODUCTION_ASSET_ID);
    expect(window.localStorage.getItem(HYPER3D_EXPERIMENTAL_GLB_FLAG)).toBeNull();
  });

  it("keeps the production rollback working in production, which is the contrast", async () => {
    /**
     * `hyper3dLegacyGlb` is DELIBERATELY not DEV-gated: the migration audit
     * accepted a known asset difference into production on condition the
     * previous asset stay one reload away. If a future change gated everything
     * by DEV uniformly, this is the test that would catch it.
     */
    vi.stubEnv("DEV", false);
    vi.resetModules();
    const original = window.location.search;
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...window.location, search: "?hyper3dLegacyGlb=1" }
    });
    window.localStorage.clear();
    const module = await import("./engine/mappings/avatars/hyper3dAssetSelection");
    const selection = module.resolveHyper3dAsset();
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...window.location, search: original }
    });
    expect(selection.legacy).toBe(true);
    expect(selection.experimental).toBe(false);
  });
});
