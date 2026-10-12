import { Hyper3DEyelashTestPanel } from "./Hyper3DEyelashTestPanel";
import { Hyper3DArticulationTestPanel } from "./Hyper3DArticulationTestPanel";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EVERY HYPER3D DEV REVIEW PANEL, BEHIND ONE DYNAMIC IMPORT.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS. The panels used to be STATIC imports in
 * `Hyper3DImperativeHost`, mounted unconditionally, each returning `null` unless
 * its own `?hyper3dXTest=1` flag was set. That gated the MOUNT correctly — the
 * availability flags are `import.meta.env.DEV`-first and folded to `false` in a
 * production build, so nothing could ever render — but it did not gate the
 * BUNDLE: the panel components, their mode labels and the whole
 * `HYPER3D_ARTICULATION_TARGETS` table shipped to production as dead weight.
 * Measured before this change, the production `ActiveSession` chunk contained
 * "ARTICULATION TEST", "EYELASH TEST", "34 BASELINE", "regression modes" and
 * every connected-speech sequence id.
 *
 * Collecting them here means `Hyper3DImperativeHost` has exactly ONE
 * `import.meta.env.DEV`-guarded `import()` to drop. Vite replaces that
 * expression with `false` in a production build, the ternary around it folds to
 * `null`, and this module — plus both panels and everything only they reach —
 * never enters the graph.
 *
 * NOT A BEHAVIOUR CHANGE IN DEV. Both panels keep their own availability flags
 * and still render `null` until a reviewer sets the query parameter. This file
 * decides nothing about whether a panel is VISIBLE; it decides only whether its
 * code is downloaded at all. A developer who has not opted in gets the same
 * blank overlay they got before, one dynamic chunk later.
 *
 * ADDING A PANEL. Import it here and render it below — that is the whole
 * contract, and it is the reason this is a list rather than a lazy import per
 * panel. A panel added directly to `Hyper3DImperativeHost` would silently
 * re-enter the production bundle, which `hyper3dDevPanelGating.test.tsx` is
 * written to catch.
 */
export default function Hyper3DDevPanels() {
  return (
    <>
      {/* DEV eyelash review controls. Renders null unless ?hyper3dEyelashTest=1. */}
      <Hyper3DEyelashTestPanel />
      {/* DEV articulation + target-convergence controls. Null unless ?hyper3dArticulationTest=1. */}
      <Hyper3DArticulationTestPanel />
    </>
  );
}
