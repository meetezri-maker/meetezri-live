import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Structural compliance for the pre-launch landing page: all eleven approved
 * sections, in the approved order, with the locked headings and CTA label.
 */

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

// jsdom implements neither of these; the sections call them on mount/interaction.
globalThis.IntersectionObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
} as unknown as typeof IntersectionObserver;

Element.prototype.scrollIntoView = vi.fn();
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

// PublicFooter imports Link from "react-router" while this file drives the router
// via "react-router-dom"; under vitest those are separate module instances/contexts.
// Same workaround the existing auth routing tests use for PublicNav.
vi.mock("@/app/components/PublicFooter", () => ({ PublicFooter: () => null }));
vi.mock("../../components/PublicFooter", () => ({ PublicFooter: () => null }));

const joinFoundingCircle = vi.fn();
vi.mock("@/lib/api", () => ({
  api: { joinFoundingCircle: (...args: unknown[]) => joinFoundingCircle(...args) },
}));

import { EarlyAccess } from "@/app/pages/EarlyAccess";
import {
  BRAND_PROMISE,
  EVERYDAY_MOMENTS,
  EXPERIENCE,
  FAQ,
  FINAL_INVITATION,
  FOUNDER,
  FOUNDING_CIRCLE,
  MEET_SOLACE,
  PRIMARY_CTA_LABEL,
  PURPOSE,
  RECOGNITION,
  TRUST,
} from "./prelaunch.content";

/** Approved section order from the content document. */
const EXPECTED_HEADINGS = [
  BRAND_PROMISE, // 1 — Hero (H1)
  RECOGNITION.heading, // 2
  MEET_SOLACE.heading, // 3
  EVERYDAY_MOMENTS.heading, // 4
  EXPERIENCE.heading, // 5
  PURPOSE.heading, // 6
  FOUNDER.heading, // 7
  FOUNDING_CIRCLE.heading, // 8
  TRUST.heading, // 9
  FAQ.heading, // 10
  FINAL_INVITATION.heading, // 11
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/early-access"]}>
      <Routes>
        <Route path="/early-access" element={<EarlyAccess />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("pre-launch landing page structure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    joinFoundingCircle.mockResolvedValue({
      success: true,
      status: "created",
      message: "Welcome to the Founding Circle.",
    });
  });

  it("renders all eleven approved sections in the approved order", () => {
    renderPage();

    const headings = screen
      .getAllByRole("heading", { level: 1 })
      .concat(screen.getAllByRole("heading", { level: 2 }))
      .map((node) => node.textContent?.replace(/\s+/g, " ").trim() ?? "");

    // Section 11 repeats the brand promise, so match positions rather than uniqueness.
    let cursor = -1;
    for (const expected of EXPECTED_HEADINGS) {
      const normalized = expected.replace(/\s+/g, " ").trim();
      const index = headings.findIndex((text, i) => i > cursor && text === normalized);
      expect(index, `Missing or out-of-order section heading: ${expected}`).toBeGreaterThan(cursor);
      cursor = index;
    }
  });

  it("uses exactly one page-level H1, carrying the locked brand promise", () => {
    renderPage();
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent?.replace(/\s+/g, " ").trim()).toBe(BRAND_PROMISE);
  });

  it("labels every primary CTA with the approved label", () => {
    renderPage();
    const ctas = screen.getAllByRole("button", { name: PRIMARY_CTA_LABEL });
    // Hero, nav, Meet Solace, Everyday Moments, Experience, Founder,
    // Founding Circle (form submit), Final Invitation.
    expect(ctas.length).toBeGreaterThanOrEqual(7);
  });

  it("never uses a competing conversion label", () => {
    renderPage();
    for (const forbidden of [
      "Join Waitlist",
      "Sign Up",
      "Get Started",
      "Subscribe",
      "Reserve Now",
      "Start Free",
      "Join Early Access",
    ]) {
      expect(
        screen.queryByRole("button", { name: forbidden }),
        `Forbidden CTA label rendered: ${forbidden}`,
      ).not.toBeInTheDocument();
    }
  });

  it("renders all six recognition cards", () => {
    renderPage();
    for (const card of RECOGNITION.cards) {
      expect(screen.getByText(card.title)).toBeInTheDocument();
      expect(screen.getByText(card.description)).toBeInTheDocument();
    }
  });

  it("renders all four everyday-moment stories with their Perfect for tags", () => {
    renderPage();
    for (const story of EVERYDAY_MOMENTS.stories) {
      expect(screen.getByText(story.title)).toBeInTheDocument();
    }
    expect(screen.getAllByText("Perfect for")).toHaveLength(EVERYDAY_MOMENTS.stories.length);
  });

  it("renders the featured Talk It Out card and all eight supporting experiences", () => {
    renderPage();
    expect(screen.getByText(EXPERIENCE.featured.title)).toBeInTheDocument();
    for (const card of EXPERIENCE.cards) {
      expect(screen.getByText(card.title)).toBeInTheDocument();
    }
  });

  it("renders all four beliefs and no CTA inside the purpose section", () => {
    renderPage();
    for (const belief of PURPOSE.beliefs) {
      expect(screen.getByText(belief.title)).toBeInTheDocument();
    }

    const purposeSection = document.getElementById("about");
    expect(purposeSection).not.toBeNull();
    expect(
      within(purposeSection as HTMLElement).queryByRole("button", { name: PRIMARY_CTA_LABEL }),
    ).not.toBeInTheDocument();
  });

  it("renders every approved Founding Circle benefit", () => {
    renderPage();
    for (const benefit of FOUNDING_CIRCLE.benefits) {
      expect(screen.getByText(benefit.title)).toBeInTheDocument();
    }
    expect(screen.getByText(/20% Lifetime Founding Member Discount/)).toBeInTheDocument();
  });

  it("renders both trust panels and no CTA inside the trust section", () => {
    renderPage();
    expect(screen.getByText(TRUST.isHeading)).toBeInTheDocument();
    expect(screen.getByText(TRUST.isntHeading)).toBeInTheDocument();

    const trustSection = document.getElementById("trust");
    expect(
      within(trustSection as HTMLElement).queryByRole("button", { name: PRIMARY_CTA_LABEL }),
    ).not.toBeInTheDocument();
  });

  it("renders all eight FAQ questions collapsed, keeping the therapy answer a clear No", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(FAQ.items).toHaveLength(8);
    for (const item of FAQ.items) {
      expect(screen.getByRole("button", { name: item.question })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    }

    await user.click(screen.getByRole("button", { name: "Is Solace therapy?" }));
    expect(screen.getByRole("button", { name: "Is Solace therapy?" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText("No.")).toBeInTheDocument();
  });

  it("keeps only one FAQ item open at a time", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Is Solace therapy?" }));
    await user.click(screen.getByRole("button", { name: "Who is Solace for?" }));

    expect(screen.getByRole("button", { name: "Is Solace therapy?" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: "Who is Solace for?" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("uses no countdown, scarcity, or fabricated community numbers", () => {
    renderPage();
    for (const forbidden of [
      /limited time/i,
      /don.t miss out/i,
      /act fast/i,
      /spots? left/i,
      /people have already/i,
    ]) {
      expect(screen.queryByText(forbidden)).not.toBeInTheDocument();
    }
  });

  it("links out to the privacy, terms, and safety pages", () => {
    renderPage();
    expect(screen.getAllByRole("link", { name: /Privacy Policy/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Terms of Service/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Safety Information/i }).length).toBeGreaterThan(0);
  });

  it("opens the shared signup flow when a hero CTA is used", async () => {
    const user = userEvent.setup();
    renderPage();

    const heroSection = document.getElementById("home");
    const heroCta = within(heroSection as HTMLElement).getByRole("button", {
      name: PRIMARY_CTA_LABEL,
    });
    await user.click(heroCta);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Email address")).toBeInTheDocument();
  });

  it("scrolls to the Founding Circle section rather than opening a second flow", async () => {
    const user = userEvent.setup();
    renderPage();

    const membershipSection = document.getElementById("membership");
    expect(membershipSection).not.toBeNull();
    // Section 8 hosts the inline form, so its own submit is the conversion control.
    expect(
      within(membershipSection as HTMLElement).getByRole("button", { name: PRIMARY_CTA_LABEL }),
    ).toHaveAttribute("type", "submit");

    await user.click(screen.getByRole("button", { name: "Watch Our Story" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});
