import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";

/**
 * The harness's availability is resolved ONCE at module load, so the flag has to
 * be set before the module is imported. `resetModules` is what makes each case
 * import a fresh copy rather than the previous case's cached one.
 */
const load = async (enabled: boolean) => {
  window.localStorage.clear();
  if (enabled) window.localStorage.setItem("hyper3dArticulationTest", "1");
  document.body.innerHTML = "";
  vi.resetModules();
  const mod = await import("./Hyper3DArticulationTestPanel");
  return mod.Hyper3DArticulationTestPanel;
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("Hyper3DArticulationTestPanel", () => {
  it("renders nothing unless the flag is set", async () => {
    const Panel = await load(false);
    const { container } = render(<Panel />);
    expect(container.firstChild).toBeNull();
  });

  it("prints the final morph values for the selected phoneme", async () => {
    const Panel = await load(true);
    render(<Panel />);
    const panel = screen.getByTestId("hyper3d-articulation-test-panel");
    expect(panel).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "AA" }));
    // AA's production value: pose 0.56 x defaultIntensity 0.90 x jawOpen gain 0.70.
    expect(panel.textContent).toContain("jawOpen");
    expect(panel.textContent).toContain("0.353");

    fireEvent.click(screen.getByRole("button", { name: "UW" }));
    expect(panel.textContent).toContain("mouthPucker");
    // 0.66 x 0.87 = 0.5742, under the 0.75 cap.
    expect(panel.textContent).toContain("0.574");
  });

  it("the authored column drops the asset gain", async () => {
    const Panel = await load(true);
    render(<Panel />);
    const panel = screen.getByTestId("hyper3d-articulation-test-panel");
    fireEvent.click(screen.getByRole("button", { name: "AA" }));
    fireEvent.click(screen.getByRole("button", { name: /AUTHORED/ }));
    // 0.56 x 0.90, with no 0.70 jaw gain applied.
    expect(panel.textContent).toContain("0.504");
  });

  /**
   * THE DEADLINE A/B/C. The control has to be reachable with nothing else
   * selected — it applies to live RUNTIME speech as well as to the
   * connected-speech runner — and the active mode has to be stated on screen, so
   * a reviewer judging video cannot be unsure which mode produced it.
   */
  /**
   * THE HARDWARE A/B. The two primary modes have to be reachable with nothing
   * else selected — they apply to live RUNTIME speech as well as to the
   * connected-speech runner — and the active mode has to be stated on screen, so
   * a reviewer judging video cannot be unsure which mode produced it.
   */
  it("opens on PRODUCTION (34 SOFT) and switches to 34 BASELINE", async () => {
    const Panel = await load(true);
    const {
      setHyper3dDeadlineMode,
      getHyper3dDeadlineMode,
      getHyper3dDeadlineLanding,
      getHyper3dDeadlineMaxSpeed,
    } = await import(
      "@/lib/avatar/hyper3d/hyper3dArticulationTest"
    );
    render(<Panel />);

    /**
     * A fresh module graph opens on PRODUCTION, and the readout proves it is
     * reading the PROFILE rather than a label: 0.5 is the landing exponent the
     * `hyper3d-usc` profile carries, resolved through `resolveMouthDeadline`.
     */
    expect(getHyper3dDeadlineMode()).toBe("production");
    expect(getHyper3dDeadlineMaxSpeed()).toBe(34);
    expect(getHyper3dDeadlineLanding()).toBe(0.5);
    expect(screen.getByTestId("hyper3d-deadline-active-mode").textContent).toBe("PRODUCTION (34 SOFT)");

    fireEvent.click(screen.getByTestId("hyper3d-deadline-mode-d34"));
    expect(getHyper3dDeadlineMode()).toBe("d34");
    expect(getHyper3dDeadlineMaxSpeed()).toBe(34);
    expect(getHyper3dDeadlineLanding()).toBeNull();
    expect(screen.getByTestId("hyper3d-deadline-active-mode").textContent).toBe("34 BASELINE");

    fireEvent.click(screen.getByTestId("hyper3d-deadline-mode-current"));
    expect(getHyper3dDeadlineMode()).toBe("current");
    expect(getHyper3dDeadlineMaxSpeed()).toBeNull();
    expect(screen.getByTestId("hyper3d-deadline-active-mode").textContent).toBe("PRE-DEADLINE");

    fireEvent.click(screen.getByTestId("hyper3d-deadline-mode-production"));
    expect(getHyper3dDeadlineMode()).toBe("production");
    setHyper3dDeadlineMode("production");
  });

  it("keeps the superseded modes reachable but out of the way", async () => {
    const Panel = await load(true);
    const { setHyper3dDeadlineMode, getHyper3dDeadlineMaxSpeed } = await import(
      "@/lib/avatar/hyper3d/hyper3dArticulationTest"
    );
    render(<Panel />);

    // Present for regression, and not in the primary row.
    for (const mode of ["current", "d44", "d34softB", "d34softC"]) {
      expect(screen.getByTestId(`hyper3d-deadline-mode-${mode}`)).toBeTruthy();
    }
    // PRE-DEADLINE strips the production deadline entirely.
    fireEvent.click(screen.getByTestId("hyper3d-deadline-mode-current"));
    expect(getHyper3dDeadlineMaxSpeed()).toBeNull();
    // And 44 is still reachable for regression, above the production cap.
    fireEvent.click(screen.getByTestId("hyper3d-deadline-mode-d44"));
    expect(getHyper3dDeadlineMaxSpeed()).toBe(44);
    setHyper3dDeadlineMode("production");
  });

  it("prints the cap and the landing state", async () => {
    const Panel = await load(true);
    const { setHyper3dDeadlineMode } = await import("@/lib/avatar/hyper3d/hyper3dArticulationTest");
    render(<Panel />);
    const panel = screen.getByTestId("hyper3d-articulation-test-panel");

    // PRODUCTION: capped at 34 with the 0.5 landing, read off the profile.
    expect(panel.textContent).toContain("34");
    expect(panel.textContent).toContain("^0.5");

    // 34 BASELINE: the same cap, landing withdrawn.
    fireEvent.click(screen.getByTestId("hyper3d-deadline-mode-d34"));
    expect(screen.getByTestId("hyper3d-articulation-test-panel").textContent).toContain("OFF");
    setHyper3dDeadlineMode("production");
  });
});
