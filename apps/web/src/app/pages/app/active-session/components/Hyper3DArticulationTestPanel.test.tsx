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
});
