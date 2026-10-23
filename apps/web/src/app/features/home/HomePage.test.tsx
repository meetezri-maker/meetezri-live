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
import { PIN_QUERIES } from "./layoutModes";
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
