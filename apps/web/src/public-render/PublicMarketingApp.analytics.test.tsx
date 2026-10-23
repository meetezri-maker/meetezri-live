import { act } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { trackGa4PageView } from "@/app/analytics/ga4";
import { trackMetaPageView } from "@/app/analytics/meta";
import { PublicMarketingApp } from "./PublicMarketingApp";

vi.mock("@/app/analytics/config", () => ({
  canInitializeAnalytics: () => true,
}));

vi.mock("@/app/analytics/ga4", () => ({
  trackGa4PageView: vi.fn(),
}));

vi.mock("@/app/analytics/meta", () => ({
  trackMetaPageView: vi.fn(),
}));

function TestPage() {
  return <main>Public test page</main>;
}

let hydratedRoot: Root | undefined;
const reactActEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

describe("public application analytics", () => {
  beforeAll(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, "", "/pricing?utm_source=private#plans");
  });

  afterEach(async () => {
    if (hydratedRoot) {
      await act(async () => hydratedRoot?.unmount());
      hydratedRoot = undefined;
    }
    document.body.innerHTML = "";
    document.head.innerHTML = "";
  });

  it("mounts the shared tracker without emitting during server rendering", () => {
    renderToString(
      <PublicMarketingApp Page={TestPage} pathname="/pricing" mode="server" />,
    );

    expect(trackGa4PageView).not.toHaveBeenCalled();
    expect(trackMetaPageView).not.toHaveBeenCalled();
  });

  it("emits one clean page view during hydration and none for a same-path rerender", async () => {
    const markup = renderToString(
      <PublicMarketingApp Page={TestPage} pathname="/pricing" mode="server" />,
    );
    document.body.innerHTML = `<div id="root">${markup}</div>`;
    const container = document.getElementById("root")!;

    await act(async () => {
      hydratedRoot = hydrateRoot(
        container,
        <PublicMarketingApp Page={TestPage} pathname="/pricing" mode="client" />,
      );
    });

    expect(trackGa4PageView).toHaveBeenCalledTimes(1);
    expect(trackGa4PageView).toHaveBeenCalledWith("/pricing", "Pricing");
    expect(trackMetaPageView).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(trackGa4PageView).mock.calls)).not.toContain("utm_source");
    expect(JSON.stringify(vi.mocked(trackGa4PageView).mock.calls)).not.toContain("#plans");

    await act(async () => {
      hydratedRoot?.render(
        <PublicMarketingApp Page={TestPage} pathname="/pricing" mode="client" />,
      );
    });

    expect(trackGa4PageView).toHaveBeenCalledTimes(1);
    expect(trackMetaPageView).toHaveBeenCalledTimes(1);
  });
});
