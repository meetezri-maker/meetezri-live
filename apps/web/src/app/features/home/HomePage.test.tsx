import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes, StaticRouter, useLocation } from "react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { SUBSCRIPTION_PLANS } from "@/app/utils/subscriptionPlans";

const createGuestSubscription = vi.fn();
vi.mock("@/lib/api", () => ({
  api: { billing: { createGuestSubscription: (...args: unknown[]) => createGuestSubscription(...args) } },
}));

import { HomePage } from "./HomePage";
import { createGuestCheckoutUrl } from "./homeActions";
import {
  FEATURE_SLOTS,
  FEATURES_BUBBLE,
  FEATURES_STAGE,
  HIW_STAGE,
  PIN_QUERIES,
  bubbleReach,
  clusterClears,
  featuresStageMetrics,
  howItWorksStageMetrics,
  movingGap,
  placeFeatureBubbles,
} from "./layoutModes";
import { measureTrack, trackX } from "./components/EverydayLifeSection";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const homeCss = readFileSync(join(__dirname, "home.css"), "utf8");

// Every case renders the full homepage, which can pass the 5s default under a parallel run.
vi.setConfig({ testTimeout: 20_000 });

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  globalThis.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  Object.defineProperty(window, "scrollTo", { configurable: true, value: vi.fn() });
});

afterEach(() => {
  createGuestSubscription.mockReset();
  localStorage.clear();
});

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function renderHome() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("homepage content", () => {
  const html = renderToString(
    <StaticRouter location="/">
      <HomePage />
    </StaticRouter>,
  );
  const text = html.replace(/<[^>]+>/g, " ");

  it("server-renders the whole page with a single H1", () => {
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    for (const id of ["features", "how-it-works", "journey", "about", "pricing", "faq", "contact"]) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  it("ships no placeholder copy, invented testimonials, or unsupported claims", () => {
    for (const forbidden of [
      /lorem ipsum/i,
      /encrypted/i,
      /10,000\+/,
      /4\.9 Rating/,
      /Sarah J\./,
      /Priority AI/i,
      /forever free/i,
      /88%/,
      /tel:/,
      /unsplash|mixkit/,
    ]) {
      expect(text).not.toMatch(forbidden);
      expect(html).not.toMatch(forbidden);
    }
  });

  it("shows membership prices and minutes from the plan configuration", () => {
    const { core, pro, trial } = SUBSCRIPTION_PLANS;
    expect(text).toContain(`$${core.price}`);
    expect(text).toContain(`$${pro.price}`);
    expect(text).toContain(pro.features[0]);
    expect(text).toContain(core.features[0]);
    expect(text).toContain(trial.features[0]);
  });
});

describe("homepage calls to action", () => {
  it("sends every Founding Member CTA and the nav Early Access CTA to the Founding Circle page", () => {
    renderHome();
    const links = screen.getAllByRole("link", { name: /Become a Founding Member|Early Access/ });
    expect(links.length).toBeGreaterThanOrEqual(5);
    for (const link of links) expect(link).toHaveAttribute("href", "/early-access");
  });

  it("starts the free trial through signup with the selected-plan handoff", async () => {
    renderHome();
    fireEvent.click(screen.getByRole("button", { name: /Start Free/ }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/signup"));
    expect(localStorage.getItem("selectedPlan")).toBe("trial");
  });

  it("starts guest checkout for a paid membership and reports failures without navigating", async () => {
    createGuestSubscription.mockRejectedValueOnce(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderHome();
    fireEvent.click(screen.getByRole("button", { name: /Choose Grow/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn.t start checkout/i);
    expect(createGuestSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ plan_type: "core", billing_cycle: "monthly" }),
    );
    expect(localStorage.getItem("selectedPlan")).toBe("core");
  });

  it("builds the same checkout return URLs as the previous homepage", async () => {
    createGuestSubscription.mockResolvedValueOnce({ checkoutUrl: "https://checkout.example/session" });
    await expect(createGuestCheckoutUrl("pro")).resolves.toBe("https://checkout.example/session");
    const [request] = createGuestSubscription.mock.calls[0];
    expect(request).toMatchObject({
      plan_type: "pro",
      successUrl: `${window.location.origin}/signup?postCheckout=1&plan=pro&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${window.location.origin}/#pricing`,
    });
  });

  it("keeps log in, legal, and resource links reachable from the footer", () => {
    renderHome();
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: /Log In/ })).toHaveAttribute("href", "/login");
    for (const href of ["/privacy", "/terms", "/safety", "/resources", "/how-it-works"]) {
      expect(footer.querySelector(`a[href="${href}"]`)).not.toBeNull();
    }
    expect(footer.querySelector('a[href^="mailto:"]')).toHaveAttribute(
      "href",
      "mailto:support@talktosolace2.ai",
    );
  });
});

/** Replaces `window.matchMedia` for one test; returns the restore function. */
function mockMatchMedia(matches: (query: string) => boolean) {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: matches(query),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

describe("homepage layout modes", () => {
  const PIN_CLASS: Record<keyof typeof PIN_QUERIES, string> = {
    features: "features",
    howItWorks: "how-it-works",
    moments: "moments",
    carousel: "carousel",
    journey: "journey",
    conversation: "conversation",
  };

  it("uses the same pin queries in CSS and JavaScript", () => {
    for (const [section, query] of Object.entries(PIN_QUERIES) as [keyof typeof PIN_QUERIES, string][]) {
      const start = homeCss.indexOf(`@media ${query} {`);
      expect(start, section).toBeGreaterThan(-1);
      expect(homeCss.slice(start, start + query.length + 200)).toContain(`.home-pin--${PIN_CLASS[section]}`);
    }
    // The only media blocks that switch a section between layouts are the ones above.
    expect(homeCss.match(/\.home-flow-only \{\s*display: none;/g)).toHaveLength(6);
  });

  it("never pins for visitors who prefer reduced motion", () => {
    for (const query of Object.values(PIN_QUERIES)) {
      for (const branch of query.split(",")) {
        expect(branch).toContain("(prefers-reduced-motion: no-preference)");
      }
    }
  });

  it("server-renders unique element ids", () => {
    const html = renderToString(
      <StaticRouter location="/">
        <HomePage />
      </StaticRouter>,
    );
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("lists every feature and every How It Works step in order in the flow layout", () => {
    const { container } = renderHome();
    const featureItems = container.querySelectorAll("#features .home-flow-only > li");
    const arcLabels = [
      ...container.querySelectorAll("#features .home-pinned-only button[aria-pressed]"),
    ].map((b) => b.getAttribute("aria-label"));
    expect(featureItems).toHaveLength(5);
    expect(
      [...featureItems].map((li) => li.querySelector("h3")?.textContent?.replace(/^\d+/, "").trim()),
    ).toEqual(arcLabels);
    for (const li of featureItems) {
      expect(li.querySelector("img")?.getAttribute("alt")).not.toBe("");
      expect(li.querySelectorAll("ul > li")).toHaveLength(8);
    }

    const steps = container.querySelectorAll("#how-it-works .home-flow-only > li");
    expect(
      [...steps].map((li) => li.querySelector("h3")?.textContent?.replace(/\s+/g, " ").trim()),
    ).toEqual(["Talk It Out", "Journal Thoughts", "Wellness Toolkit"]);
  });

  it("keeps the Moments and conversation content in reading order and exposed to assistive tech", () => {
    const { container } = renderHome();
    const moments = container.querySelectorAll(".home-pin--moments .home-flow-only ol > li");
    expect(moments).toHaveLength(4);
    const pairs = container.querySelectorAll(".home-chat-list > li.home-chat-pair");
    expect(pairs).toHaveLength(4);
    for (const el of [...moments, ...pairs]) {
      expect(el.closest('[aria-hidden="true"]')).toBeNull();
      expect(el.textContent?.trim()).not.toBe("");
    }
  });
});

describe("Moments call to action while pinned", () => {
  it("is inert while faded out, and a focused CTA is never hidden", async () => {
    const restore = mockMatchMedia((q) => q === PIN_QUERIES.moments);
    try {
      const { container } = renderHome();
      const pinned = container.querySelector(".home-pin--moments .home-pinned-only")!;
      const link = [...pinned.querySelectorAll<HTMLAnchorElement>('a[href="/early-access"]')].find(
        (a) => a.closest("[inert]"),
      );
      expect(link).toBeDefined();
      const wrapper = link!.closest<HTMLElement>("[inert]")!;

      fireEvent.focusIn(link!);
      expect(wrapper.hasAttribute("inert")).toBe(false);
      await waitFor(() => expect(wrapper.style.opacity).toBe("1"));

      fireEvent.focusOut(link!, { relatedTarget: document.body });
      expect(wrapper.hasAttribute("inert")).toBe(true);
    } finally {
      restore();
    }
  });

  it("is never inert in the flow layout", () => {
    const { container } = renderHome();
    expect(container.querySelectorAll("[inert]")).toHaveLength(0);
  });
});

describe("homepage mobile menu", () => {
  it("is a non-modal disclosure that closes on Escape, outside clicks, and focus leaving it", async () => {
    renderHome();
    const toggle = screen.getByRole("button", { name: "Open menu" });
    const open = () => {
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      return document.getElementById("home-mobile-menu")!;
    };

    // The panel follows its toggle in the DOM, so Tab moves from the toggle into the links.
    let panel = open();
    expect(toggle.nextElementSibling).toBe(panel);
    const links = within(panel).getAllByRole("link");
    expect(links[0]).toHaveTextContent("Features");
    // No focus trap: Tab on the last link is not intercepted.
    expect(fireEvent.keyDown(links[links.length - 1], { key: "Tab" })).toBe(true);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(toggle);

    open();
    fireEvent.pointerDown(document.body);
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await waitFor(() => expect(document.getElementById("home-mobile-menu")).toBeNull());
    panel = open();
    const [first, second] = within(panel).getAllByRole("link");
    fireEvent.focusOut(first, { relatedTarget: second });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.focusOut(first, {
      relatedTarget: screen.getAllByRole("link", { name: /Early Access/ })[0],
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});

describe("homepage scrolling", () => {
  const modes: [string, (query: string) => boolean][] = [
    ["flow", () => false],
    ["pinned", (query) => query === PIN_QUERIES.features],
  ];
  for (const [mode, matches] of modes) {
    it(`never captures wheel, touch, or key input (${mode} Features)`, () => {
      const restore = mockMatchMedia(matches);
      const types: string[] = [];
      const addWindow = window.addEventListener.bind(window);
      const addDocument = document.addEventListener.bind(document);
      const onWindow = vi.spyOn(window, "addEventListener").mockImplementation((type, ...rest) => {
        types.push(type);
        addWindow(type, ...rest);
      });
      const onDocument = vi.spyOn(document, "addEventListener").mockImplementation((type, ...rest) => {
        types.push(type);
        addDocument(type, ...rest);
      });
      try {
        const { container } = renderHome();
        expect(types.filter((t) => ["wheel", "touchstart", "touchmove", "keydown"].includes(t))).toEqual([]);
        const wheel = new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true });
        container.querySelector("#features")!.dispatchEvent(wheel);
        expect(wheel.defaultPrevented).toBe(false);
      } finally {
        onWindow.mockRestore();
        onDocument.mockRestore();
        restore();
      }
    });
  }
});

describe("everyday life carousel geometry", () => {
  const CARD = 275;
  const GAP = 24;
  const PEAK_SCALE = 1.14;

  for (const viewport of [360, 375, 390, 768, 1024, 1280, 1440]) {
    it(`brings each of the 10 cards fully into view at ${viewport}px`, () => {
      const pad = viewport * 0.1;
      const lefts = Array.from({ length: 10 }, (_, i) => pad + i * (CARD + GAP));
      const trackWidth = pad * 2 + 10 * CARD + 9 * GAP;
      const geometry = measureTrack(viewport, trackWidth, lefts.map((l) => l + CARD / 2));

      // Continuous: the track moves smoothly and monotonically across the whole scroll range.
      let previous = trackX(geometry, 0);
      for (let step = 1; step <= 1000; step++) {
        const x = trackX(geometry, step / 1000);
        expect(x).toBeLessThanOrEqual(previous);
        expect(previous - x).toBeLessThan(5);
        previous = x;
      }

      lefts.forEach((left, i) => {
        const centre = trackX(geometry, geometry.peaks[i]) + left + CARD / 2;
        const half = (CARD * PEAK_SCALE) / 2;
        expect(centre - half, `card ${i + 1}`).toBeGreaterThanOrEqual(0);
        expect(centre + half, `card ${i + 1}`).toBeLessThanOrEqual(viewport);
      });
    });
  }
});

describe("Features layout queries", () => {
  it("leaves every other section's pin query exactly as it was", () => {
    expect(PIN_QUERIES.moments).toBe(
      "(prefers-reduced-motion: no-preference) and (max-width: 1023px) and (min-height: 780px), (prefers-reduced-motion: no-preference) and (min-width: 1024px) and (min-height: 700px)",
    );
    expect(PIN_QUERIES.carousel).toBe(
      "(prefers-reduced-motion: no-preference) and (max-width: 767px) and (min-height: 855px), (prefers-reduced-motion: no-preference) and (min-width: 768px) and (min-height: 820px)",
    );
    expect(PIN_QUERIES.journey).toBe(
      "(prefers-reduced-motion: no-preference) and (max-width: 1023px) and (min-height: 885px), (prefers-reduced-motion: no-preference) and (min-width: 1024px) and (min-height: 640px)",
    );
    expect(PIN_QUERIES.conversation).toBe(
      "(prefers-reduced-motion: no-preference) and (min-width: 1024px) and (min-height: 700px)",
    );
  });

  it("changes only the ≥1280px Features branch; phone, tablet and 1024–1279px stay as they were", () => {
    expect(PIN_QUERIES.features.split(", ")).toEqual([
      "(prefers-reduced-motion: no-preference) and (max-width: 639px) and (min-height: 1090px)",
      "(prefers-reduced-motion: no-preference) and (min-width: 640px) and (max-width: 1023px) and (min-height: 1045px)",
      "(prefers-reduced-motion: no-preference) and (min-width: 1024px) and (max-width: 1279px) and (min-height: 1090px)",
      "(prefers-reduced-motion: no-preference) and (min-width: 1280px) and (min-height: 708px)",
    ]);
  });

  it("guards every Features pin rule with the in-app motion classes and the fit fallback, and no other section", () => {
    const start = homeCss.indexOf(`@media ${PIN_QUERIES.features} {`);
    const end = homeCss.indexOf("\n}\n", start);
    const block = homeCss.slice(start, end);
    const selectors = [...block.matchAll(/^ {2}([^\s{}][^{}]*)\{/gm)].map((m) => m[1].trim());
    expect(selectors).toHaveLength(4);
    for (const selector of selectors) {
      expect(selector.startsWith(
        ':root:not(.reduced-motion):not(.appearance-no-animations) .solace-home .home-pin--features:not([data-features-fit="none"])',
      )).toBe(true);
    }
    // How It Works has its own guards (tested below); no other section has any.
    const hiwStart = homeCss.indexOf(`@media ${PIN_QUERIES.howItWorks} {`);
    const hiwEnd = homeCss.indexOf("\n}\n", hiwStart);
    const outside = (
      homeCss.slice(0, start) + homeCss.slice(end, hiwStart) + homeCss.slice(hiwEnd)
    ).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(outside).not.toContain(".reduced-motion");
    expect(outside).not.toContain("data-features-fit");
    expect(outside).not.toContain("data-hiw-fit");
  });

  it("sizes the arc in CSS with the same numbers the placement maths uses", () => {
    const S = FEATURES_STAGE;
    expect(homeCss).toContain(`height: clamp(${S.arcMin}px, ${S.arcVh * 100}vh, ${S.arcMax}px);`);
    expect(homeCss).toContain(
      `margin-top: clamp(${S.arcTopMin}px, ${S.arcTopVh * 100}vh, ${S.arcTopMax}px);`,
    );
  });
});

describe("Features bubble placement", () => {
  /** Badge (28.5) + gap (8) + heading lines + accent bar and its margin (10). */
  const headingBlock = (viewportHeight: number, lineHeight: number) =>
    28.5 + 8 + (viewportHeight < 900 ? 1 : 2) * 42 * lineHeight + 10;
  const layoutAt = (width: number, height: number, lineHeight: number) => {
    const metrics = featuresStageMetrics({
      viewportWidth: width,
      viewportHeight: height,
      headerClearance: 96,
      headingBlockHeight: headingBlock(height, lineHeight),
    });
    return { metrics, layout: placeFeatureBubbles(FEATURE_SLOTS, metrics.clusterWidth, metrics.clusterHeight) };
  };

  it("arranges every designer step as one outer and one inner bubble in each of two rows, with all eight highlights", () => {
    for (const side of ["left", "right"] as const) {
      FEATURE_SLOTS[side].forEach((slots, step) => {
        expect(slots, `${side} step ${step + 1}`).toHaveLength(4);
        expect(new Set(slots.map((s) => `${s.isUp}-${s.gi}`)).size).toBe(4);
        for (const isUp of [true, false]) {
          const row = slots.filter((s) => s.isUp === isUp);
          expect(row.filter((s) => s.pos < 100), `${side} step ${step + 1}`).toHaveLength(1);
        }
      });
    }
  });

  const cases: [number, number, number][] = [
    [1366, 768, 1.5], [1366, 768, 1.9],
    [1440, 900, 1.5], [1440, 900, 1.9],
    [1536, 864, 1.5], [1536, 864, 1.9],
    [1920, 955, 1.5], [1920, 955, 1.9],
    [1920, 1080, 1.5], [1920, 1080, 1.9],
    [1280, 708, 1.5], [1280, 725, 1.9],
    [2560, 1440, 1.5],
  ];
  for (const [width, height, lineHeight] of cases) {
    it(`fits all eight bubbles per step with full float clearance at ${width}×${height}, line height ${lineHeight}`, () => {
      const { metrics, layout } = layoutAt(width, height, lineHeight);
      expect(layout).not.toBeNull();
      for (const side of ["left", "right"] as const) {
        expect(layout![side]).toHaveLength(5);
        layout![side].forEach((step, i) => {
          expect(step, `${side} step ${i + 1}`).toHaveLength(4);
          expect(clusterClears(step, metrics.clusterWidth, metrics.clusterHeight)).toBe(true);
          for (const bubble of step) {
            expect(bubble.size).toBeGreaterThanOrEqual(FEATURES_BUBBLE.minSize);
            const reach = bubbleReach(bubble.size, bubble.index);
            // Float and satellites stay inside the cluster, which sits inside the stage row.
            expect(bubble.top - reach.up).toBeGreaterThanOrEqual(0);
            expect(bubble.top + bubble.size + reach.down).toBeLessThanOrEqual(metrics.clusterHeight);
          }
          for (let a = 0; a < 4; a++) {
            for (let b = a + 1; b < 4; b++) {
              expect(movingGap(step[a], step[b])).toBeGreaterThanOrEqual(FEATURES_BUBBLE.gap);
            }
          }
        });
      }
      // The screen frame fits the row too.
      const screenHeight = (metrics.screenMaxWidth - 16) / 1.6 + 16;
      expect(screenHeight + FEATURES_STAGE.screenTop).toBeLessThanOrEqual(metrics.rowHeight);
    });
  }

  /** The shortest viewport height (at 1280px wide) where the bubbles fit at `lineHeight`. */
  const shortestFit = (lineHeight: number) => {
    for (let height = 600; height <= 900; height++) {
      if (layoutAt(1280, height, lineHeight).layout) return height;
    }
    return Infinity;
  };

  it("pins from exactly the height where the default line height fits", () => {
    const pinFrom = Number(PIN_QUERIES.features.match(/\(min-width: 1280px\) and \(min-height: (\d+)px\)/)![1]);
    expect(pinFrom).toBe(shortestFit(1.5));
    // Wider viewports do not need more height.
    for (const width of [1366, 1440, 1536, 1920]) {
      expect(layoutAt(width, pinFrom, 1.5).layout, `${width}px`).not.toBeNull();
    }
  });

  it("falls back (no layout) where the loose line height leaves too little room", () => {
    const pinFrom = Number(PIN_QUERIES.features.match(/\(min-width: 1280px\) and \(min-height: (\d+)px\)/)![1]);
    const loose = shortestFit(1.9);
    expect(loose).toBeGreaterThan(pinFrom);
    expect(layoutAt(1280, loose - 1, 1.9).layout).toBeNull();
    expect(layoutAt(1280, loose, 1.9).layout).not.toBeNull();
    console.info(`Features pins from ${pinFrom}px (default line height); loose line height fits from ${loose}px.`);
  });
});

describe("Features section behaviour", () => {
  const setViewport = (width: number, height: number) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
  };
  const original = { width: window.innerWidth, height: window.innerHeight };
  afterEach(() => {
    setViewport(original.width, original.height);
    document.documentElement.classList.remove("reduced-motion", "appearance-no-animations");
  });

  it("keeps the visible space in “Highlighted Features”", () => {
    const { container } = renderHome();
    const heading = container.querySelector("#features h2")!;
    expect(heading.textContent).toBe("Highlighted Features");
    expect(heading.querySelector("br.home-features-heading-break")).not.toBeNull();
  });

  for (const appClass of ["reduced-motion", "appearance-no-animations"]) {
    it(`stops pinning live when the in-app ${appClass} class is added, and pins again when removed`, async () => {
      const restore = mockMatchMedia((q) => q === PIN_QUERIES.features);
      const scrollTo = window.scrollTo as unknown as ReturnType<typeof vi.fn>;
      try {
        const { container } = renderHome();
        const arc = (label: string) =>
          container.querySelector<HTMLButtonElement>(`#features button[aria-label="${label}"]`)!;

        scrollTo.mockClear();
        fireEvent.click(arc("Talk It Out"));
        expect(scrollTo).toHaveBeenCalledTimes(1); // pinned: a step is a scroll position

        document.documentElement.classList.add(appClass);
        await waitFor(() => {
          scrollTo.mockClear();
          fireEvent.click(arc("Wellness Tools"));
          expect(scrollTo).not.toHaveBeenCalled();
          expect(arc("Wellness Tools")).toHaveAttribute("aria-pressed", "true");
        });

        document.documentElement.classList.remove(appClass);
        await waitFor(() => {
          scrollTo.mockClear();
          fireEvent.click(arc("Rest & Habits"));
          expect(scrollTo).toHaveBeenCalledTimes(1);
        });
      } finally {
        restore();
      }
    });
  }

  it("does not pin when the OS asks for reduced motion", async () => {
    const restore = mockMatchMedia(
      (q) => q === PIN_QUERIES.features || q === "(prefers-reduced-motion: reduce)",
    );
    const scrollTo = window.scrollTo as unknown as ReturnType<typeof vi.fn>;
    try {
      const { container } = renderHome();
      const button = container.querySelector<HTMLButtonElement>('#features button[aria-label="Insights & Growth"]')!;
      await waitFor(() => {
        scrollTo.mockClear();
        fireEvent.click(button);
        expect(scrollTo).not.toHaveBeenCalled();
        expect(button).toHaveAttribute("aria-pressed", "true");
      });
    } finally {
      restore();
    }
  });

  it("disconnects its observers and listeners on unmount", () => {
    const listeners = new Map<string, Set<unknown>>();
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === PIN_QUERIES.features,
      media: query,
      addEventListener: (_: string, fn: unknown) => {
        if (!listeners.has(query)) listeners.set(query, new Set());
        listeners.get(query)!.add(fn);
      },
      removeEventListener: (_: string, fn: unknown) => listeners.get(query)?.delete(fn),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    const disconnect = vi.spyOn(MutationObserver.prototype, "disconnect");
    try {
      setViewport(1366, 768);
      const { unmount } = renderHome();
      expect(listeners.get("(prefers-reduced-motion: reduce)")?.size).toBeGreaterThan(0);
      expect(listeners.get(PIN_QUERIES.features)?.size).toBeGreaterThan(0);
      disconnect.mockClear();
      unmount();
      expect(disconnect).toHaveBeenCalled();
      for (const [query, set] of listeners) expect(set.size, query).toBe(0);
    } finally {
      disconnect.mockRestore();
      window.matchMedia = original;
    }
  });

  it("places sized bubbles at ≥1280px, and hands over to the flow layout where they cannot fit", async () => {
    const restore = mockMatchMedia((q) => q === PIN_QUERIES.features);
    try {
      setViewport(1366, 768);
      const { container, unmount } = renderHome();
      const section = container.querySelector<HTMLElement>("#features")!;
      await waitFor(() => {
        const row = section.querySelector<HTMLElement>(".home-pinned-only > div:nth-child(2)")!;
        expect(row.style.height).not.toBe("");
      });
      expect(section).not.toHaveAttribute("data-features-fit");
      unmount();

      setViewport(1366, 560);
      const second = renderHome();
      await waitFor(() =>
        expect(second.container.querySelector("#features")).toHaveAttribute("data-features-fit", "none"),
      );
    } finally {
      restore();
    }
  });
});

describe("How It Works layout", () => {
  /** Measured in the browser at ≥1272px wide (the header's own height, without margins). */
  const measured = {
    default: { headerHeight: 142, stepperHeight: 126, textColumnHeight: 421 },
    loose: { headerHeight: 175, stepperHeight: 139, textColumnHeight: 477 },
  };
  const metricsAt = (viewportHeight: number, lineHeight: keyof typeof measured) =>
    howItWorksStageMetrics({ viewportHeight, headerClearance: 96, ...measured[lineHeight] });
  const pinFrom = () =>
    Number(PIN_QUERIES.howItWorks.match(/\(min-width: 1024px\) and \(min-height: (\d+)px\)/)![1]);
  const block = () => {
    const start = homeCss.indexOf(`@media ${PIN_QUERIES.howItWorks} {`);
    return homeCss.slice(start, homeCss.indexOf("\n}\n", start));
  };

  it("changes only the ≥1024px branch; phone and tablet stay as they were", () => {
    expect(PIN_QUERIES.howItWorks.split(", ").slice(0, 2)).toEqual([
      "(prefers-reduced-motion: no-preference) and (max-width: 639px) and (min-height: 840px)",
      "(prefers-reduced-motion: no-preference) and (min-width: 640px) and (max-width: 1023px) and (min-height: 945px)",
    ]);
  });

  it("guards every pin rule with the in-app motion classes", () => {
    const selectors = [...block().matchAll(/^\s+(:root[^{]*)\{/gm)].map((m) => m[1]);
    expect(selectors.length).toBeGreaterThan(8);
    for (const selector of selectors) {
      expect(selector).toContain(":root:not(.reduced-motion):not(.appearance-no-animations)");
    }
  });

  it("keeps the unfitted stage measurable but invisible, unfocusable and unread", () => {
    const rule = block().match(/\[data-hiw-fit="none"\] \.home-pinned-only \{([^}]*)\}/)![1];
    expect(rule).toContain("visibility: hidden");
    expect(rule).toContain("display: revert-layer");
    expect(rule).toContain("height: 0");
  });

  it("hides the card's copy of the text only where the left column shows it", () => {
    const css = block();
    const hide = css.indexOf(".home-hiw-card-text {");
    const desktop = css.indexOf("@media (min-width: 1024px)");
    expect(desktop).toBeGreaterThan(-1);
    expect(hide).toBeGreaterThan(desktop);
    // Below 1024px the left column is what is hidden, and the card keeps the text.
    const mobile = css.slice(css.indexOf("@media (max-width: 1023px)"), desktop);
    expect(mobile).toContain(".home-hiw-text");
    expect(mobile).not.toContain(".home-hiw-card-text");
  });

  it("uses the same numbers in CSS and the fit maths", () => {
    const S = HIW_STAGE;
    expect(block()).toContain(`margin-top: clamp(${S.gapMin}px, ${S.gapVh * 100}vh, ${S.gapMax}px);`);
    expect(block()).toContain(`top: ${S.cardTop}px;`);
  });

  it("fits the laptop sizes that were measured, with the image in the design's proportions", () => {
    const cases: [number, keyof typeof measured, number][] = [
      [768, "default", 241],
      [900, "default", 320],
      [864, "default", 320],
      [900, "loose", 320],
      [864, "loose", 289],
    ];
    for (const [height, lineHeight, image] of cases) {
      const m = metricsAt(height, lineHeight);
      expect(m.fits, `${height} ${lineHeight}`).toBe(true);
      expect(m.imageHeight, `${height} ${lineHeight}`).toBe(image);
      expect(m.imageWidth / m.imageHeight).toBeCloseTo(460 / 320, 2);
      expect(m.cardsHeight).toBe(HIW_STAGE.cardTop + HIW_STAGE.cardChrome + m.imageHeight);
    }
  });

  it("never sizes the image outside 200–320px", () => {
    for (let height = 500; height <= 1600; height++) {
      const m = metricsAt(height, "default");
      expect(m.imageHeight).toBeLessThanOrEqual(HIW_STAGE.imageMax);
      if (m.fits) expect(m.imageHeight).toBeGreaterThanOrEqual(HIW_STAGE.imageMin);
    }
  });

  it("pins from exactly the height where the default line height fits", () => {
    expect(metricsAt(pinFrom(), "default").fits).toBe(true);
    expect(metricsAt(pinFrom() - 1, "default").fits).toBe(false);
  });

  it("does not fit at 1366×768 with the loose line height, or when the text column is too tall", () => {
    expect(metricsAt(768, "loose").fits).toBe(false);
    expect(
      howItWorksStageMetrics({
        viewportHeight: 800,
        headerClearance: 96,
        headerHeight: 125.6,
        stepperHeight: 126,
        textColumnHeight: 534, // 1024px wide: the left column wraps taller than the cards
      }).fits,
    ).toBe(false);
  });

  describe("in the page", () => {
    const setViewport = (width: number, height: number) => {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
      Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
    };
    const original = { width: window.innerWidth, height: window.innerHeight };
    const offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight")!;
    const stepButton = (root: HTMLElement, name: string) =>
      root.querySelector<HTMLButtonElement>(`#how-it-works button[aria-label="${name}"]`)!;
    const STEP_2 = "Step 02: Journal Thoughts";

    afterEach(() => {
      setViewport(original.width, original.height);
      Object.defineProperty(HTMLElement.prototype, "offsetHeight", offsetHeight);
      document.documentElement.classList.remove("reduced-motion", "appearance-no-animations");
    });

    /** jsdom has no layout: give the stepper a size so the section can measure itself. */
    const giveStepperAHeight = () =>
      Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
        configurable: true,
        get: () => 126,
      });

    it("lists all three steps, each with its text and image, in reading order when stacked", () => {
      const { container } = renderHome();
      const steps = container.querySelectorAll("#how-it-works .home-flow-only > li");
      expect(steps).toHaveLength(3);
      for (const step of steps) {
        const [text, image] = [...step.children];
        expect(text.querySelector("h3")?.textContent?.trim()).not.toBe("");
        expect(text.querySelector("p + h3 + p")?.textContent?.trim()).not.toBe("");
        expect(image.querySelector("img")?.getAttribute("alt")).toBeTruthy();
      }
    });

    it("sizes the cards from what it measured, keeping the image proportions", async () => {
      giveStepperAHeight();
      const restore = mockMatchMedia((q) => q === PIN_QUERIES.howItWorks);
      try {
        setViewport(1366, 768);
        const { container } = renderHome();
        const image = container.querySelector<HTMLElement>("#how-it-works .home-hiw-card img")!
          .parentElement!;
        await waitFor(() => expect(image.style.height).not.toBe(""));
        expect(parseFloat(image.style.width) / parseFloat(image.style.height)).toBeCloseTo(460 / 320, 1);
        expect(container.querySelector("#how-it-works")).not.toHaveAttribute("data-hiw-fit");
      } finally {
        restore();
      }
    });

    it("re-measures after a resize, an image load and a settings change, and back again", async () => {
      giveStepperAHeight();
      const restore = mockMatchMedia((q) => q === PIN_QUERIES.howItWorks);
      try {
        setViewport(1366, 768);
        const { container } = renderHome();
        const section = container.querySelector<HTMLElement>("#how-it-works")!;
        await waitFor(() => expect(section).not.toHaveAttribute("data-hiw-fit"));

        setViewport(1366, 400);
        fireEvent(window, new Event("resize"));
        await waitFor(() => expect(section).toHaveAttribute("data-hiw-fit", "none"));

        setViewport(1366, 768);
        fireEvent.load(section.querySelector("img")!);
        await waitFor(() => expect(section).not.toHaveAttribute("data-hiw-fit"));

        setViewport(1366, 400);
        document.documentElement.classList.add("a11y-lh-loose");
        await waitFor(() => expect(section).toHaveAttribute("data-hiw-fit", "none"));
        document.documentElement.classList.remove("a11y-lh-loose");
      } finally {
        restore();
      }
    });

    for (const appClass of ["reduced-motion", "appearance-no-animations"]) {
      it(`stops pinning and removes the looping rings live with ${appClass}`, async () => {
        const restore = mockMatchMedia((q) => q === PIN_QUERIES.howItWorks);
        const scrollTo = window.scrollTo as unknown as ReturnType<typeof vi.fn>;
        const rings = (root: HTMLElement) =>
          root.querySelectorAll("#how-it-works .home-hiw-stepper .blur-sm").length;
        try {
          const { container } = renderHome();
          expect(rings(container)).toBe(1);
          scrollTo.mockClear();
          fireEvent.click(stepButton(container, STEP_2));
          expect(scrollTo).toHaveBeenCalledTimes(1);

          document.documentElement.classList.add(appClass);
          await waitFor(() => expect(rings(container)).toBe(0));
          scrollTo.mockClear();
          fireEvent.click(stepButton(container, STEP_2));
          expect(scrollTo).not.toHaveBeenCalled();

          document.documentElement.classList.remove(appClass);
          await waitFor(() => expect(rings(container)).toBe(1));
        } finally {
          restore();
        }
      });
    }

    it("does not pin, or loop, when the OS asks for reduced motion", async () => {
      const restore = mockMatchMedia(
        (q) => q === PIN_QUERIES.howItWorks || q === "(prefers-reduced-motion: reduce)",
      );
      const scrollTo = window.scrollTo as unknown as ReturnType<typeof vi.fn>;
      try {
        const { container } = renderHome();
        await waitFor(() =>
          expect(container.querySelectorAll("#how-it-works .home-hiw-stepper .blur-sm")).toHaveLength(0),
        );
        scrollTo.mockClear();
        fireEvent.click(stepButton(container, STEP_2));
        expect(scrollTo).not.toHaveBeenCalled();
      } finally {
        restore();
      }
    });

    it("keeps the step controls as named buttons with the current step marked", () => {
      const { container } = renderHome();
      const buttons = [...container.querySelectorAll<HTMLButtonElement>("#how-it-works .home-hiw-stepper button")];
      expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual([
        "Step 01: Talk It Out",
        "Step 02: Journal Thoughts",
        "Step 03: Wellness Toolkit",
      ]);
      expect(buttons[0]).toHaveAttribute("aria-current", "step");
    });

    it("disconnects everything it observes on unmount", () => {
      const listeners = new Map<string, Set<unknown>>();
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = ((query: string) => ({
        matches: query === PIN_QUERIES.howItWorks,
        media: query,
        addEventListener: (_: string, fn: unknown) => {
          if (!listeners.has(query)) listeners.set(query, new Set());
          listeners.get(query)!.add(fn);
        },
        removeEventListener: (_: string, fn: unknown) => listeners.get(query)?.delete(fn),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })) as unknown as typeof window.matchMedia;
      const disconnect = vi.spyOn(MutationObserver.prototype, "disconnect");
      try {
        const { unmount } = renderHome();
        expect(listeners.get(PIN_QUERIES.howItWorks)?.size).toBeGreaterThan(0);
        disconnect.mockClear();
        unmount();
        expect(disconnect).toHaveBeenCalled();
        for (const [query, set] of listeners) expect(set.size, query).toBe(0);
      } finally {
        disconnect.mockRestore();
        window.matchMedia = originalMatchMedia;
      }
    });
  });
});
