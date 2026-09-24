import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetDeferredAnalyticsScriptsForTests } from "./deferredScript";
import { resetGa4ForTests, trackGa4Event, trackGa4PageView } from "./ga4";
import { resetMetaForTests, trackMetaCustomEvent, trackMetaPageView } from "./meta";

vi.mock("./config", () => ({
  getAnalyticsConfig: () => ({
    gaMeasurementId: "G-TEST123",
    metaPixelId: "123456789",
    productionHostnames: ["www.talktosolace2.ai"],
  }),
}));

type IdleCallback = () => void;

interface TestWindow extends Window {
  requestIdleCallback?: (callback: IdleCallback, options?: { timeout?: number }) => number;
  dataLayer?: unknown[];
  gtag?: unknown;
  fbq?: { queue?: unknown[] };
  _fbq?: unknown;
}

const getTestWindow = () => window as TestWindow;

describe("deferred analytics script loading", () => {
  let idleCallbacks: IdleCallback[];

  beforeEach(() => {
    idleCallbacks = [];
    document.head.innerHTML = "";
    resetGa4ForTests();
    resetMetaForTests();
    resetDeferredAnalyticsScriptsForTests();

    const target = getTestWindow();
    delete target.dataLayer;
    delete target.gtag;
    delete target.fbq;
    delete target._fbq;
    target.requestIdleCallback = vi.fn((callback: IdleCallback) => {
      idleCallbacks.push(callback);
      return idleCallbacks.length;
    });
  });

  it("queues GA4 page and CTA events before appending gtag.js", () => {
    trackGa4PageView("/", "Home");
    trackGa4Event("early_access_cta_click", { origin: "hero" });

    expect(document.querySelector("script[data-solace-ga4]")).toBeNull();
    expect(idleCallbacks).toHaveLength(1);
    expect(getTestWindow().dataLayer).toEqual([
      ["js", expect.any(Date)],
      ["config", "G-TEST123", { send_page_view: false }],
      ["event", "page_view", { page_path: "/", page_title: "Home" }],
      ["event", "early_access_cta_click", { origin: "hero" }],
    ]);

    idleCallbacks[0]();

    const script = document.querySelector<HTMLScriptElement>("script[data-solace-ga4]");
    expect(script?.async).toBe(true);
    expect(script?.src).toContain("https://www.googletagmanager.com/gtag/js?id=G-TEST123");
  });

  it("queues Meta page and CTA events before appending fbevents.js", () => {
    trackMetaPageView("/");
    trackMetaCustomEvent("EarlyAccessCtaClick", { origin: "hero" });

    expect(document.querySelector("script[data-solace-meta]")).toBeNull();
    expect(idleCallbacks).toHaveLength(1);
    expect(getTestWindow().fbq?.queue).toEqual([
      ["init", "123456789", {}],
      ["track", "PageView", { page_path: "/" }],
      ["trackCustom", "EarlyAccessCtaClick", { origin: "hero" }],
    ]);

    idleCallbacks[0]();

    const script = document.querySelector<HTMLScriptElement>("script[data-solace-meta]");
    expect(script?.async).toBe(true);
    expect(script?.src).toBe("https://connect.facebook.net/en_US/fbevents.js");
  });

  it("does not schedule or append duplicate provider scripts", () => {
    trackGa4PageView("/", "Home");
    trackGa4PageView("/pricing", "Pricing");
    trackMetaPageView("/");
    trackMetaPageView("/pricing");

    expect(idleCallbacks).toHaveLength(2);

    idleCallbacks.forEach((callback) => callback());
    idleCallbacks.forEach((callback) => callback());

    expect(document.querySelectorAll("script[data-solace-ga4]")).toHaveLength(1);
    expect(document.querySelectorAll("script[data-solace-meta]")).toHaveLength(1);
  });
});
