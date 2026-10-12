import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DEV-ONLY GATING — development versus production behaviour.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHAT THIS PROTECTS. Three separate claims, each with its own failure mode:
 *
 *   1. The availability flags are `import.meta.env.DEV`-FIRST, so no query
 *      parameter and no stored flag can turn a panel on in production. This is
 *      the claim that matters most, because the flags are sticky: a developer
 *      who once visited `?hyper3dArticulationTest=1` carries
 *      `localStorage.hyper3dArticulationTest = "1"` forever, and if that were
 *      enough on its own, every such browser would show the panel in production.
 *
 *   2. The frame orchestrator's pose overrides cannot alter a production frame.
 *
 *   3. The panels reach the tree through exactly ONE dynamic import, so a panel
 *      added directly to `Hyper3DImperativeHost` cannot silently re-enter the
 *      production bundle.
 *
 * HOW PRODUCTION IS SIMULATED. `vi.stubEnv("DEV", false)` plus
 * `vi.resetModules()`, because every availability flag is resolved ONCE at
 * module load (`export const hyper3dArticulationTestAvailable = ...`). Stubbing
 * without resetting would test the already-resolved DEV value and pass for the
 * wrong reason.
 *
 * WHAT THIS CANNOT TEST, stated rather than implied: under vitest
 * `import.meta.env.DEV` is a real property, while in a production BUILD Vite
 * replaces it with the literal `false` and the branches fold away. So these
 * tests prove the RUNTIME gate; the BUNDLE claim is proven separately by
 * scanning `dist/assets` after `npm run build`, and the markers that scan looks
 * for are listed in the report.
 */

const ARTICULATION_FLAG = "hyper3dArticulationTest";
const EYELASH_FLAG = "hyper3dEyelashTest";

beforeEach(() => {
  window.localStorage.clear();
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  window.localStorage.clear();
  vi.resetModules();
});

/** Put both opt-in mechanisms in the "on" position, as a stale browser would. */
function armEveryFlag() {
  window.localStorage.setItem(ARTICULATION_FLAG, "1");
  window.localStorage.setItem(EYELASH_FLAG, "1");
  window.history.replaceState(
    {},
    "",
    `/?${ARTICULATION_FLAG}=1&${EYELASH_FLAG}=1&hyper3dLegacyFbx=1`,
  );
}

describe("availability flags — DEV", () => {
  it("honour the query parameter and the stored flag", async () => {
    vi.stubEnv("DEV", true);
    armEveryFlag();
    const articulation = await import("@/lib/avatar/hyper3d/hyper3dArticulationTest");
    const eyelash = await import("@/lib/avatar/hyper3d/hyper3dEyelashTest");
    expect(articulation.isHyper3dArticulationTestEnabled()).toBe(true);
    expect(eyelash.isHyper3dEyelashTestEnabled()).toBe(true);
    expect(articulation.hyper3dArticulationTestAvailable).toBe(true);
  });

  it("stay off in DEV until a developer opts in", async () => {
    vi.stubEnv("DEV", true);
    window.history.replaceState({}, "", "/");
    const articulation = await import("@/lib/avatar/hyper3d/hyper3dArticulationTest");
    const eyelash = await import("@/lib/avatar/hyper3d/hyper3dEyelashTest");
    expect(articulation.isHyper3dArticulationTestEnabled()).toBe(false);
    expect(eyelash.isHyper3dEyelashTestEnabled()).toBe(false);
  });
});

describe("availability flags — PRODUCTION", () => {
  it("cannot be turned on by a query parameter or a stored flag", async () => {
    /**
     * THE CENTRAL TEST. Both opt-ins armed, production env, and both harnesses
     * must still report unavailable — including the module-load constants the
     * frame path actually reads.
     */
    vi.stubEnv("DEV", false);
    armEveryFlag();
    const articulation = await import("@/lib/avatar/hyper3d/hyper3dArticulationTest");
    const eyelash = await import("@/lib/avatar/hyper3d/hyper3dEyelashTest");
    expect(articulation.isHyper3dArticulationTestEnabled()).toBe(false);
    expect(eyelash.isHyper3dEyelashTestEnabled()).toBe(false);
    expect(articulation.hyper3dArticulationTestAvailable).toBe(false);
    expect(eyelash.hyper3dEyelashTestAvailable).toBe(false);
  });

  it("does not even write the sticky flag through in production", async () => {
    /**
     * The DEV path WRITES a visited query parameter into `localStorage` so the
     * preference survives a reload. Production must not acquire that habit: a
     * production visit to the URL must leave storage exactly as it found it.
     */
    vi.stubEnv("DEV", false);
    window.history.replaceState({}, "", `/?${ARTICULATION_FLAG}=1`);
    const articulation = await import("@/lib/avatar/hyper3d/hyper3dArticulationTest");
    expect(articulation.isHyper3dArticulationTestEnabled()).toBe(false);
    expect(window.localStorage.getItem(ARTICULATION_FLAG)).toBeNull();
  });

  it("keeps the legacy FBX override off whatever the URL says", async () => {
    vi.stubEnv("DEV", false);
    armEveryFlag();
    const selection = await import(
      "@/lib/avatar/hyper3d/engine/mappings/avatars/hyper3dAssetSelection"
    );
    expect(selection.useLegacyHyper3dFbx).toBe(false);
  });

  it("renders no panel even when the panel component is mounted directly", async () => {
    /**
     * The belt to the dynamic import's braces. If a future change mounted a
     * panel statically again, the panel itself must still refuse to render in
     * production — so this asserts the inner gate on its own.
     */
    vi.stubEnv("DEV", false);
    armEveryFlag();
    const { render } = await import("@testing-library/react");
    const { Hyper3DArticulationTestPanel } = await import("./Hyper3DArticulationTestPanel");
    const { Hyper3DEyelashTestPanel } = await import("./Hyper3DEyelashTestPanel");
    const a = render(<Hyper3DArticulationTestPanel />);
    expect(a.container.firstChild).toBeNull();
    const e = render(<Hyper3DEyelashTestPanel />);
    expect(e.container.firstChild).toBeNull();
  });
});

describe("the frame orchestrator's pose overrides", () => {
  it("leave the pose untouched in production, with every flag armed", async () => {
    vi.stubEnv("DEV", false);
    armEveryFlag();
    const articulation = await import("@/lib/avatar/hyper3d/hyper3dArticulationTest");
    const eyelash = await import("@/lib/avatar/hyper3d/hyper3dEyelashTest");

    /**
     * The orchestrator guards each override with `DEV && <available>`. With the
     * availability constants false, selecting a non-runtime state cannot reach
     * the override — and the override functions themselves return the SAME
     * OBJECT for the runtime state, which is what makes a production frame
     * allocation-free as well as unaltered.
     */
    expect(articulation.hyper3dArticulationTestAvailable).toBe(false);
    expect(eyelash.hyper3dEyelashTestAvailable).toBe(false);

    const pose = { jawOpen: 0.31, mouthFunnel: 0.12, eyeBlinkLeft: 0.4 };
    expect(
      articulation.applyHyper3dArticulationTestPose(pose, "runtime", "calibrated", "mid", 1, "held", 1 / 60),
    ).toBe(pose);
    expect(eyelash.applyHyper3dEyelashTestPose(pose, "runtime", 1)).toBe(pose);
  });

  it("runs the accepted 34 SOFT convergence in production, with no override", async () => {
    /**
     * §2 / §3 — PRODUCTION OWNERSHIP. The accepted 34 SOFT values now live on the
     * `hyper3d-usc` transition profile as ordinary configuration, so a production
     * frame reaches them by passing NO override at all.
     *
     * The three assertions are the whole claim:
     *
     *   the profile carries cap 34 and landing 0.5
     *   `null` (what production passes) returns that profile BY IDENTITY
     *   every accepted follower constant beside it is untouched
     *
     * Checked with production env and every DEV flag armed, so this also proves
     * production convergence does not depend on the DEV surface being absent.
     */
    vi.stubEnv("DEV", false);
    armEveryFlag();
    const config = await import("@/lib/avatar/hyper3d/engine/mappings/avatarBlendshapeConfig");
    const accepted = config.getMouthTransitionProfile("hyper3d-usc")!;

    expect(accepted.deadline?.maxSpeed).toBe(34);
    expect(accepted.deadline?.landingExponent).toBe(0.5);
    expect(accepted.deadline?.completion).toBe(config.DEADLINE_COMPLETION);
    expect(accepted.deadline?.tolerance).toBe(config.DEADLINE_TOLERANCE);
    expect(config.HYPER3D_PRODUCTION_DEADLINE).toEqual({ maxSpeed: 34, landingExponent: 0.5 });

    // What a production frame passes, and what it gets back.
    expect(config.resolveMouthDeadline(accepted, null)).toBe(accepted);

    // The accepted follower constants beside it are the ones hardware signed off.
    expect(accepted.lipShapeSpeed).toBe(24);
    expect(accepted.openSpeed).toBe(24);
    expect(accepted.closeSpeed).toBe(9);
    expect(accepted.sealClosureThreshold).toBe(0.5);
    expect(accepted.settle?.speed).toBe(11);
  });

  it("gives no other avatar a deadline, whatever an override asks for", async () => {
    /**
     * §5 — scoped by construction. `female` and `miniface-male` have no
     * transition profile at all, so `resolveMouthDeadline` returns `undefined`
     * for them and the smoother's `mouth?.deadline` gate can never fire.
     */
    vi.stubEnv("DEV", false);
    const config = await import("@/lib/avatar/hyper3d/engine/mappings/avatarBlendshapeConfig");
    expect(Object.keys(config.mouthTransitionProfiles)).toEqual(["hyper3d-usc"]);
    for (const modelId of ["female", "miniface-male"] as const) {
      const profile = config.getMouthTransitionProfile(modelId);
      expect(profile).toBeUndefined();
      expect(config.resolveMouthDeadline(profile, null)).toBeUndefined();
      expect(config.resolveMouthDeadline(profile, { maxSpeed: 44, landingExponent: null })).toBeUndefined();
      expect(config.resolveMouthDeadline(profile, "off")).toBeUndefined();
    }
  });

  it("can still be taken back to the pre-deadline follower by a DEV override", async () => {
    /**
     * §4 — the comparison survives promotion. `"off"` is the only way to reach
     * the follower production replaced, and it must strip the deadline without
     * disturbing anything else on the profile.
     */
    vi.stubEnv("DEV", false);
    const config = await import("@/lib/avatar/hyper3d/engine/mappings/avatarBlendshapeConfig");
    const accepted = config.getMouthTransitionProfile("hyper3d-usc")!;
    const pre = config.resolveMouthDeadline(accepted, "off")!;
    expect(pre.deadline).toBeUndefined();
    expect(pre.openSpeed).toBe(accepted.openSpeed);
    expect(pre.closeSpeed).toBe(accepted.closeSpeed);
    expect(pre.sealClosureThreshold).toBe(accepted.sealClosureThreshold);
    expect(pre.lipShapeSpeed).toBe(accepted.lipShapeSpeed);
    expect(pre.settle).toBe(accepted.settle);
    // Cached, so holding the mode costs no allocation per frame.
    expect(config.resolveMouthDeadline(accepted, "off")).toBe(pre);
  });
});

describe("the mount site", () => {
  /**
   * Resolved from the vitest working directory (`apps/web`) rather than from
   * `import.meta.url`, which is not a file URL under vitest.
   */
  const COMPONENTS = "src/app/pages/app/active-session/components";
  const hostSource = readFileSync(resolve(COMPONENTS, "Hyper3DImperativeHost.tsx"), "utf8");
  const barrelSource = readFileSync(resolve(COMPONENTS, "Hyper3DDevPanels.tsx"), "utf8");

  it("reaches the panels through exactly one DEV-gated dynamic import", () => {
    /**
     * A SOURCE-LEVEL GUARD, and deliberately so. The bundle claim depends on
     * there being no STATIC path from the host to a panel; a render test cannot
     * see that, because a statically imported panel renders null in production
     * and looks identical. So this reads the file.
     */
    expect(hostSource).toContain('import.meta.env.DEV');
    expect(hostSource).toContain('lazy(() => import("./Hyper3DDevPanels"))');
    // No panel may be imported statically by the host.
    expect(hostSource).not.toMatch(/^import .*TestPanel.*$/m);
    expect(hostSource).not.toContain('from "./Hyper3DArticulationTestPanel"');
    expect(hostSource).not.toContain('from "./Hyper3DEyelashTestPanel"');
  });

  it("keeps every panel inside the barrel, so adding one cannot bypass the gate", () => {
    expect(barrelSource).toContain('from "./Hyper3DEyelashTestPanel"');
    expect(barrelSource).toContain('from "./Hyper3DArticulationTestPanel"');
    expect(barrelSource).toContain("export default function Hyper3DDevPanels");
  });

  it("guards the host's dev subtree on a value that folds to null in production", () => {
    // `const Hyper3DDevPanels = import.meta.env.DEV ? lazy(...) : null;`
    expect(hostSource).toMatch(/const Hyper3DDevPanels\s*=\s*import\.meta\.env\.DEV/);
    expect(hostSource).toContain("{Hyper3DDevPanels ? (");
  });
});

describe("the frame orchestrator source", () => {
  const orchestratorSource = readFileSync(
    resolve("src/lib/avatar/hyper3d/hyper3dFrameOrchestrator.ts"),
    "utf8",
  );

  it("gates every DEV override on the statically foldable DEV constant", () => {
    expect(orchestratorSource).toContain("const DEV = import.meta.env.DEV === true;");
    expect(orchestratorSource).toContain("if (DEV && hyper3dEyelashTestAvailable) {");
    expect(orchestratorSource).toContain("if (DEV && hyper3dArticulationTestAvailable) {");
    expect(orchestratorSource).toContain("DEV && hyper3dArticulationTestAvailable ? getHyper3dDeadlineOverride() : null");
    /**
     * And no override may be reached on an UNGATED availability flag. Matching
     * `if (hyper3dXAvailable)` without the leading `DEV &&` is the regression
     * this is written to catch.
     */
    expect(orchestratorSource).not.toMatch(/if \(hyper3d\w+TestAvailable\)/);
  });
});
