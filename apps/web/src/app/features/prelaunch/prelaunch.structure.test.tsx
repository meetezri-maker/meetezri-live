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
  CONTACT_HREF,
  HUMAN_MOMENTS,
  TALK_IT_OUT,
  YOUR_JOURNEY,
  FAQ,
  FOUNDER,
  FOUNDER_VIDEO_TRANSCRIPT,
  HERO,
  FOUNDING_CIRCLE,
  FOUNDING_FORM,
  FOUNDING_MEMBER_DISCOUNT_PERCENTAGE,
  NAV_ITEMS,
  PRIMARY_CTA_LABEL,
  SECTION_IDS,
  TRUST,
} from "./prelaunch.content";

/** The final section order. Every section maps to an approved document page,
 *  except the retained Founding Circle conversion section. */
const EXPECTED_HEADINGS = [
  HERO.headline, // 1 — Hero (H1), Appendix A Page 1
  HUMAN_MOMENTS.heading, // 2 — Human Moments, Appendix A Page 2
  TALK_IT_OUT.heading, // 3 — Talk It Out, Appendix A Page 3
  YOUR_JOURNEY.heading, // 4 — Your Journey, Appendix A Page 4
  FOUNDER.heading, // 5 — Founder, Appendix A Page 5
  FOUNDING_CIRCLE.heading, // 6 — retained conversion section
  TRUST.heading, // 7 — Trust, Appendix A Page 6
  FAQ.heading, // 8 — FAQ, Appendix A Page 7, closing with the final invitation
];

/** Every anchor the page renders, in order. `about` and `begin` are retired. */
const EXPECTED_SECTION_IDS = [
  "home",
  "human-moments",
  "talk-it-out",
  "your-journey",
  "founder",
  "membership",
  "trust",
  "faq",
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

  it("renders every section in the approved order", () => {
    renderPage();

    const headings = screen
      .getAllByRole("heading", { level: 1 })
      .concat(screen.getAllByRole("heading", { level: 2 }))
      .map((node) => node.textContent?.replace(/\s+/g, " ").trim() ?? "");

    // The FAQ's folded invitation repeats the brand promise, so match positions
    // rather than uniqueness.
    let cursor = -1;
    for (const expected of EXPECTED_HEADINGS) {
      const normalized = expected.replace(/\s+/g, " ").trim();
      const index = headings.findIndex((text, i) => i > cursor && text === normalized);
      expect(index, `Missing or out-of-order section heading: ${expected}`).toBeGreaterThan(cursor);
      cursor = index;
    }
  });

  it("uses exactly one page-level H1, carrying the approved hook", () => {
    renderPage();
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent?.replace(/\s+/g, " ").trim()).toBe(HERO.headline);
  });

  it("keeps the brand promise as the page's closing statement", () => {
    renderPage();
    // It now closes the FAQ rather than a standalone section.
    expect(FAQ.finalHeading).toBe(BRAND_PROMISE);
  });

  it("renders the Hero exactly as Appendix A Page 1 specifies", () => {
    renderPage();

    // The split accent must reassemble into the approved hook, unchanged.
    expect(`${HERO.headlineLead} ${HERO.headlineAccent}`).toBe(HERO.headline);

    expect(screen.getByText(HERO.supportingLine)).toBeInTheDocument();
    expect(screen.getByText(HERO.microcopy)).toBeInTheDocument();

    // Approved truthfulness exception: this page registers Founding Members and
    // grants no immediate access, so the microcopy must not promise otherwise.
    expect(HERO.microcopy).not.toMatch(/start your first conversation/i);
    expect(HERO.microcopy).not.toMatch(/no appointment required/i);

    expect(HERO.trustIndicators).toHaveLength(3);
    for (const indicator of HERO.trustIndicators) {
      expect(screen.getByText(indicator)).toBeInTheDocument();
    }
  });

  it("opens the founder video from the Hero secondary action", async () => {
    const user = userEvent.setup();
    renderPage();

    // Approved exception C3: the product video does not exist yet, so this
    // opens the founder video and must not claim to show the product.
    const trigger = screen.getByRole("button", { name: HERO.secondaryCta });
    expect(HERO.secondaryCta).toBe("Meet the Founder");

    await user.click(trigger);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("labels every primary CTA with the approved label", () => {
    renderPage();
    const ctas = screen.getAllByRole("button", { name: PRIMARY_CTA_LABEL });
    // Hero, nav, Human Moments, Talk It Out, Your Journey, Founder,
    // Founding Circle (form submit), Trust, and the FAQ's folded invitation.
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

  it("renders all four approved Human Moments, in order, with exact copy", () => {
    renderPage();

    expect(HUMAN_MOMENTS.moments).toHaveLength(4);

    const section = document.getElementById("human-moments");
    expect(section).not.toBeNull();

    const titles = [...(section as HTMLElement).querySelectorAll("h3")].map(
      (h) => h.textContent,
    );
    expect(titles).toEqual(HUMAN_MOMENTS.moments.map((m) => m.title));

    for (const moment of HUMAN_MOMENTS.moments) {
      expect(screen.getByText(moment.narrative)).toBeInTheDocument();
    }

    expect(screen.getByText(HUMAN_MOMENTS.supportingLine)).toBeInTheDocument();
    expect(screen.getByText(HUMAN_MOMENTS.transition)).toBeInTheDocument();
  });

  it("presents the Human Moments as a list with decorative imagery only", () => {
    renderPage();

    const section = document.getElementById("human-moments") as HTMLElement;
    expect(section.querySelectorAll("ul > li")).toHaveLength(
      HUMAN_MOMENTS.moments.length,
    );

    const images = [...section.querySelectorAll("img")];
    expect(images).toHaveLength(HUMAN_MOMENTS.moments.length);
    for (const img of images) {
      // Decorative: the title and narrative carry the meaning as text.
      expect(img).toHaveAttribute("alt", "");
      expect(img).toHaveAttribute("loading", "lazy");
      expect(img).toHaveAttribute("width");
      expect(img).toHaveAttribute("height");
    }
  });

  it("keeps the Human Moments conversion on the existing Founding Circle flow", async () => {
    const user = userEvent.setup();
    renderPage();

    const section = document.getElementById("human-moments") as HTMLElement;
    const cta = within(section).getByRole("button", { name: PRIMARY_CTA_LABEL });

    await user.click(cta);

    // The shared signup dialog, not a new conversion path.
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Email address")).toBeInTheDocument();
  });

  it("renders Talk It Out exactly as Appendix A Page 3 specifies", () => {
    renderPage();

    expect(screen.getByText(TALK_IT_OUT.supportingLine)).toBeInTheDocument();
    expect(screen.getByText(TALK_IT_OUT.videoTitle)).toBeInTheDocument();
    expect(screen.getByText(TALK_IT_OUT.videoIntro)).toBeInTheDocument();
    expect(screen.getByText(TALK_IT_OUT.transition)).toBeInTheDocument();

    expect(TALK_IT_OUT.highlights).toHaveLength(6);
    const section = document.getElementById("talk-it-out") as HTMLElement;
    const rendered = [...section.querySelectorAll("ul > li")].map((li) =>
      li.textContent?.trim(),
    );
    expect(rendered).toEqual([...TALK_IT_OUT.highlights]);
  });

  it("exposes exactly one conversion CTA in Talk It Out", async () => {
    const user = userEvent.setup();
    renderPage();

    const section = document.getElementById("talk-it-out") as HTMLElement;
    const ctas = within(section).getAllByRole("button", { name: PRIMARY_CTA_LABEL });

    // Two identical adjacent CTAs read as conversion fatigue; the `experience`
    // origin was retired with the placement it described.
    expect(ctas).toHaveLength(1);

    await user.click(ctas[0]);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Email address")).toBeInTheDocument();
  });

  it("gates the infinite CTA glow behind the reduced-motion guard", () => {
    const { container } = renderPage();

    // The guard class is what the `prefers-reduced-motion` rules in
    // landing-tokens.css hang off; without it the CTA pulse runs regardless.
    const root = container.querySelector(".solace-landing");
    expect(root).toHaveClass("landing-reduced-motion");

    // Every pulsing control sits inside the guarded root.
    const glows = [...container.querySelectorAll(".landing-cta-glow")];
    expect(glows.length).toBeGreaterThan(0);
    for (const glow of glows) {
      expect(root?.contains(glow)).toBe(true);
    }
  });

  it("renders Your Journey exactly as Appendix A Page 4 specifies", () => {
    renderPage();

    expect(YOUR_JOURNEY.steps).toHaveLength(3);

    const section = document.getElementById("your-journey") as HTMLElement;
    expect(section).not.toBeNull();

    // The sequence must be an ordered list, identical on every device.
    const items = section.querySelectorAll("ol > li");
    expect(items).toHaveLength(3);

    const titles = [...section.querySelectorAll("h3")].map((h) => h.textContent);
    expect(titles).toEqual(["Talk It Out", "Reflect", "Grow"]);
    expect(titles).toEqual(YOUR_JOURNEY.steps.map((s) => s.title));

    for (const step of YOUR_JOURNEY.steps) {
      expect(screen.getByText(step.description)).toBeInTheDocument();
    }

    expect(screen.getByText(YOUR_JOURNEY.supportingLine)).toBeInTheDocument();
    expect(screen.getByText(YOUR_JOURNEY.transition)).toBeInTheDocument();
  });

  it("adds no step numerals, progress indicators, or invented outcomes", () => {
    renderPage();

    const section = document.getElementById("your-journey") as HTMLElement;

    // Blueprint 7.5 excludes progress bars, streaks, badges, and counters.
    expect(section.querySelector('[role="progressbar"]')).toBeNull();
    expect(section.querySelector("progress")).toBeNull();

    // Icons are decorative; the titles and descriptions carry the meaning.
    for (const svg of section.querySelectorAll("svg")) {
      expect(svg).toHaveAttribute("aria-hidden", "true");
    }

    // Nothing beyond the approved copy may appear.
    const approved = [
      YOUR_JOURNEY.badge,
      YOUR_JOURNEY.heading,
      YOUR_JOURNEY.supportingLine,
      ...YOUR_JOURNEY.steps.flatMap((s) => [s.title, s.description]),
      YOUR_JOURNEY.transition,
      PRIMARY_CTA_LABEL,
    ];
    let remainder = section.textContent ?? "";
    for (const phrase of [...approved].sort((a, b) => b.length - a.length)) {
      remainder = remainder.split(phrase).join("");
    }
    expect(remainder.replace(/[\s•✓·—-]/g, "")).toBe("");
  });

  it("routes the Your Journey CTA into the existing Founding Circle flow", async () => {
    const user = userEvent.setup();
    renderPage();

    const section = document.getElementById("your-journey") as HTMLElement;
    const cta = within(section).getByRole("button", { name: PRIMARY_CTA_LABEL });

    await user.click(cta);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Email address")).toBeInTheDocument();
  });

  it("renders the Founder frame from Appendix A Page 5", () => {
    renderPage();

    const section = document.getElementById("founder") as HTMLElement;
    expect(section).not.toBeNull();

    expect(screen.getByText(FOUNDER.heading)).toBeInTheDocument();
    expect(screen.getByText(FOUNDER.supportingLine)).toBeInTheDocument();
    expect(screen.getByText(FOUNDER.transition)).toBeInTheDocument();
    expect(FOUNDER.videoTitle).toBe("Meet the Founder");
  });

  it("keeps the founder's name, role, story, and quote intact", () => {
    renderPage();

    const section = document.getElementById("founder") as HTMLElement;
    const text = section.textContent ?? "";

    expect(FOUNDER.name).toBe("Rosalind Mitchell");
    expect(FOUNDER.role).toBe("Founder, Solace");
    expect(text).toContain(FOUNDER.name);
    expect(text).toContain(FOUNDER.role);
    expect(text).toContain(FOUNDER.quote);

    // Every story line survives the reframing.
    expect(FOUNDER.story.length).toBeGreaterThan(0);
    for (const line of FOUNDER.story) {
      expect(text).toContain(line);
    }
  });

  it("shows only the approved video-first content in the founder dialog", async () => {
    const user = userEvent.setup();
    renderPage();

    const section = document.getElementById("founder") as HTMLElement;
    const trigger = within(section).getByRole("button", { name: /play the founder video/i });

    await user.click(trigger);
    const dialog = await screen.findByRole("dialog");

    // Approved contents: header, attribution line, media area, close control.
    expect(within(dialog).getByText(FOUNDER.videoTitle)).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        new RegExp(`${FOUNDER.name}.*${FOUNDER.videoLength}`),
      ),
    ).toBeInTheDocument();
    expect(dialog.querySelector(".aspect-video")).not.toBeNull();
    expect(within(dialog).getByRole("button", { name: /close/i })).toBeInTheDocument();

    // The transcript was deliberately removed from the modal, so neither the
    // heading nor any of its copy may reappear — and nothing may claim it is
    // still present.
    expect(
      within(dialog).queryByRole("heading", { name: /^transcript$/i }),
    ).not.toBeInTheDocument();
    for (const block of FOUNDER_VIDEO_TRANSCRIPT) {
      expect(within(dialog).queryByText(block.heading)).not.toBeInTheDocument();
    }
    expect(dialog.textContent).not.toMatch(/transcript is below/i);
  });

  it("returns focus to the founder video trigger when the dialog closes", async () => {
    const user = userEvent.setup();
    renderPage();

    const section = document.getElementById("founder") as HTMLElement;
    const trigger = within(section).getByRole("button", { name: /play the founder video/i });

    await user.click(trigger);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("keeps exactly one signup form, inline in the Founding Circle section", () => {
    renderPage();

    // A modal-only experience, or a second form, would split the conversion.
    const forms = document.querySelectorAll("form");
    expect(forms).toHaveLength(1);

    const section = document.getElementById("membership") as HTMLElement;
    expect(section.contains(forms[0])).toBe(true);
    expect(within(section).getByLabelText("Email address")).toBeInTheDocument();
    expect(
      within(section).getByRole("button", { name: PRIMARY_CTA_LABEL }),
    ).toHaveAttribute("type", "submit");
  });

  it("retains all six Founding Circle benefits and the 20% discount", () => {
    renderPage();

    const section = document.getElementById("membership") as HTMLElement;
    expect(FOUNDING_CIRCLE.benefits).toHaveLength(6);

    for (const benefit of FOUNDING_CIRCLE.benefits) {
      expect(within(section).getByText(benefit.title)).toBeInTheDocument();
      expect(within(section).getByText(benefit.description)).toBeInTheDocument();
    }

    expect(FOUNDING_MEMBER_DISCOUNT_PERCENTAGE).toBe(20);
    expect(section.textContent).toContain(
      `${FOUNDING_MEMBER_DISCOUNT_PERCENTAGE}% Lifetime Founding Member Discount`,
    );
  });

  it("keeps the consent text and Privacy Policy link with the inline form", () => {
    renderPage();

    const section = document.getElementById("membership") as HTMLElement;
    expect(section.textContent).toContain(FOUNDING_FORM.consent);
    expect(within(section).getByRole("link", { name: /Privacy Policy/i })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });

  it("makes no payment, checkout, or immediate-access claim in the Founding Circle", () => {
    renderPage();

    const section = document.getElementById("membership") as HTMLElement;
    const text = section.textContent ?? "";
    for (const forbidden of [
      /credit card/i,
      /checkout/i,
      /\bpay now\b/i,
      /start talking free/i,
      /create your (free )?account/i,
    ]) {
      expect(text).not.toMatch(forbidden);
    }
    // The truthful pre-launch promise stays.
    expect(text).toMatch(/no payment required today/i);
  });

  it("registers a new Founding Member through the existing API contract", async () => {
    const user = userEvent.setup();
    renderPage();

    const section = document.getElementById("membership") as HTMLElement;
    await user.type(within(section).getByLabelText("Email address"), "new@example.com");
    await user.click(within(section).getByRole("button", { name: PRIMARY_CTA_LABEL }));

    await screen.findByText(FOUNDING_FORM.successHeading);
    expect(joinFoundingCircle).toHaveBeenCalledTimes(1);
    expect(joinFoundingCircle.mock.calls[0][0]).toMatchObject({
      email: "new@example.com",
      consentSource: "prelaunch_founding_member_form",
    });
  });

  it("shows the reassuring state for an address already on the list", async () => {
    joinFoundingCircle.mockResolvedValue({
      success: true,
      status: "existing",
      message: "Already registered.",
    });

    const user = userEvent.setup();
    renderPage();

    const section = document.getElementById("membership") as HTMLElement;
    await user.type(within(section).getByLabelText("Email address"), "again@example.com");
    await user.click(within(section).getByRole("button", { name: PRIMARY_CTA_LABEL }));

    expect(await screen.findByText(FOUNDING_FORM.existingHeading)).toBeInTheDocument();
  });

  it("surfaces an API failure inline without losing the conversion", async () => {
    joinFoundingCircle.mockRejectedValue(new Error("Network unavailable"));

    const user = userEvent.setup();
    renderPage();

    const section = document.getElementById("membership") as HTMLElement;
    await user.type(within(section).getByLabelText("Email address"), "fail@example.com");
    await user.click(within(section).getByRole("button", { name: PRIMARY_CTA_LABEL }));

    const alert = await within(section).findByRole("alert");
    expect(alert).toHaveTextContent("Network unavailable");
    // The form is still there to retry with.
    expect(within(section).getByLabelText("Email address")).toHaveValue("fail@example.com");
  });

  it("no longer renders the product screenshot carousel", () => {
    renderPage();

    // Appendix A makes the video the product demonstration; seven of the nine
    // screens never had an approved asset.
    expect(screen.queryByLabelText("Solace product preview")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Solace product showcase")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Talk It Out preview")).not.toBeInTheDocument();
    expect(screen.queryByText("Inside Solace")).not.toBeInTheDocument();
  });

  it("scrolls from Human Moments to Talk It Out without opening signup", async () => {
    const user = userEvent.setup();
    renderPage();

    const humanMoments = document.getElementById("human-moments") as HTMLElement;
    const scrollCta = within(humanMoments).getByRole("button", {
      name: HUMAN_MOMENTS.secondaryCta,
    });

    await user.click(scrollCta);

    // Navigational only — it must never present the conversion flow.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.getElementById("talk-it-out")).not.toBeNull();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("renders exactly the approved section anchors, with about and begin retired", () => {
    renderPage();

    const rendered = Array.from(document.querySelectorAll("section[id]")).map(
      (node) => node.id,
    );
    expect(rendered).toEqual(EXPECTED_SECTION_IDS);

    // The retired standalone sections leave no anchor behind.
    expect(document.getElementById("about")).toBeNull();
    expect(document.getElementById("begin")).toBeNull();
    expect(Object.values(SECTION_IDS)).not.toContain("about");
    expect(Object.values(SECTION_IDS)).not.toContain("begin");
  });

  it("points every navigation item at a section that exists", () => {
    renderPage();

    expect(NAV_ITEMS.map((item) => `${item.label} -> #${item.targetId}`)).toEqual([
      "Home -> #home",
      "How It Works -> #talk-it-out",
      "Membership -> #membership",
      // "About" now resolves to the founder story; there is no replacement
      // About section and the founder content is not duplicated.
      "About -> #founder",
      "FAQ -> #faq",
    ]);

    for (const item of NAV_ITEMS) {
      expect(document.getElementById(item.targetId), `Dead anchor: #${item.targetId}`).not.toBeNull();
    }
  });

  it("leaves no in-page link pointing at a missing element", () => {
    renderPage();

    const hashes = Array.from(document.querySelectorAll('a[href^="#"]')).map((node) =>
      (node.getAttribute("href") ?? "").slice(1),
    );
    for (const hash of hashes) {
      expect(document.getElementById(hash), `Dead anchor: #${hash}`).not.toBeNull();
    }
  });

  it("renders every approved Founding Circle benefit", () => {
    renderPage();
    for (const benefit of FOUNDING_CIRCLE.benefits) {
      expect(screen.getByText(benefit.title)).toBeInTheDocument();
    }
    expect(screen.getByText(/20% Lifetime Founding Member Discount/)).toBeInTheDocument();
  });

  it("renders Trust exactly as Appendix A Page 6 specifies", () => {
    renderPage();

    const section = document.getElementById("trust") as HTMLElement;
    expect(section).not.toBeNull();

    expect(screen.getByText(TRUST.heading)).toBeInTheDocument();
    expect(screen.getByText(TRUST.supportingLine)).toBeInTheDocument();
    expect(screen.getByText(TRUST.transition)).toBeInTheDocument();

    // Three pillars, in the approved order.
    expect(TRUST.pillars).toHaveLength(3);
    const titles = [...section.querySelectorAll("h3")].map((h) => h.textContent);
    expect(titles).toEqual([
      "Private by Design",
      "You're Always in Control",
      "Support When It Matters Most",
    ]);
    expect(titles).toEqual(TRUST.pillars.map((p) => p.title));

    for (const pillar of TRUST.pillars) {
      expect(within(section).getByText(pillar.description)).toBeInTheDocument();
    }
  });

  it("keeps the Trust legal destinations and gives every link a visible focus style", () => {
    renderPage();

    const section = document.getElementById("trust") as HTMLElement;
    const expected = [
      { label: "Privacy Policy", to: "/privacy" },
      { label: "Terms of Service", to: "/terms" },
      { label: "Safety Information", to: "/privacy#safety" },
    ];

    for (const link of expected) {
      const el = within(section).getByRole("link", { name: link.label });
      expect(el).toHaveAttribute("href", link.to);
      // Focus must stay perceivable: the outline is only removed alongside a
      // replacement ring.
      expect(el.className).toMatch(/focus-visible:ring-2/);
      if (/focus-visible:outline-none/.test(el.className)) {
        expect(el.className).toMatch(/focus-visible:ring-/);
      }
    }
  });

  it("routes the Trust CTA into the Founding Circle flow", async () => {
    const user = userEvent.setup();
    renderPage();

    const section = document.getElementById("trust") as HTMLElement;
    const cta = within(section).getByRole("button", { name: PRIMARY_CTA_LABEL });

    await user.click(cta);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Email address")).toBeInTheDocument();
  });

  it("makes no unsupported privacy, security, clinical, or crisis claim", () => {
    renderPage();

    const text = (document.getElementById("trust") as HTMLElement).textContent ?? "";
    for (const forbidden of [
      /encrypt/i,
      /certifi/i,
      /HIPAA|GDPR|SOC ?2|ISO ?27001/i,
      /compliant|compliance/i,
      /bank[- ]level|military[- ]grade/i,
      /guarantee/i,
      /crisis (resource|intervention|line|support)/i,
      /diagnos/i,
      /\b(therapy|therapist|clinical|medical)\b/i,
      /emergency service/i,
    ]) {
      expect(text, `Unsupported claim matched ${forbidden}`).not.toMatch(forbidden);
    }
    // No decorative security iconography or badges either.
    expect(text).not.toMatch(/[🔒🛡️🏅✅]/u);
  });

  it("renders the approved FAQ questions in order, collapsed, as native buttons", () => {
    renderPage();

    const section = document.getElementById("faq") as HTMLElement;

    // Appendix A's six, plus the retained immediate-help safety disclaimer.
    expect(FAQ.items).toHaveLength(7);
    expect(FAQ.items.map((i) => i.question)).toEqual([
      "What is SOLACE?",
      "Is SOLACE therapy?",
      "What can I talk about?",
      "Are my conversations private?",
      "Do I need to be struggling to use SOLACE?",
      "How do I get started?",
      "What if I need immediate help?",
    ]);

    for (const item of FAQ.items) {
      const trigger = within(section).getByRole("button", { name: item.question });
      // Native button with the full accordion contract — never a clickable div.
      expect(trigger.tagName).toBe("BUTTON");
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(trigger).toHaveAttribute("aria-controls");
    }
  });

  it("keeps the therapy clarification a clear No and opens one item at a time", async () => {
    const user = userEvent.setup();
    renderPage();

    const section = document.getElementById("faq") as HTMLElement;
    const therapy = within(section).getByRole("button", { name: "Is SOLACE therapy?" });

    await user.click(therapy);
    expect(therapy).toHaveAttribute("aria-expanded", "true");
    // The panel the trigger controls must actually exist.
    expect(document.getElementById(therapy.getAttribute("aria-controls") as string)).not.toBeNull();
    expect(
      within(section).getByText(/^No\. SOLACE is not a replacement for therapy/),
    ).toBeInTheDocument();

    const another = within(section).getByRole("button", { name: "What can I talk about?" });
    await user.click(another);
    expect(therapy).toHaveAttribute("aria-expanded", "false");
    expect(another).toHaveAttribute("aria-expanded", "true");
  });

  it("retains the immediate-help safety disclaimer and its resources link", async () => {
    const user = userEvent.setup();
    renderPage();

    const section = document.getElementById("faq") as HTMLElement;
    await user.click(
      within(section).getByRole("button", { name: "What if I need immediate help?" }),
    );

    expect(
      within(section).getByText(/Solace is not the right place to get urgent assistance/),
    ).toBeInTheDocument();
    expect(
      within(section).getByRole("link", { name: /Safety & crisis resources/i }),
    ).toHaveAttribute("href", "/privacy#safety");
  });

  it("folds the final invitation into the FAQ with one CTA and no dead anchor", () => {
    renderPage();

    const section = document.getElementById("faq") as HTMLElement;

    // The standalone section and its anchor are gone.
    expect(document.getElementById("begin")).toBeNull();
    expect(document.querySelectorAll('a[href="#begin"]')).toHaveLength(0);

    // Closing statement and exactly one invitation CTA, inside the FAQ.
    expect(within(section).getByText(BRAND_PROMISE)).toBeInTheDocument();
    expect(
      within(section).getAllByRole("button", { name: PRIMARY_CTA_LABEL }),
    ).toHaveLength(1);

    // No second form and no repeat of the Founding Circle benefits.
    expect(section.querySelector("form")).toBeNull();
    expect(document.querySelectorAll("form")).toHaveLength(1);
    for (const benefit of FOUNDING_CIRCLE.benefits) {
      expect(within(section).queryByText(benefit.title)).not.toBeInTheDocument();
    }
  });

  it("gives every FAQ and final-invitation link a visible focus style", async () => {
    const user = userEvent.setup();
    renderPage();

    const section = document.getElementById("faq") as HTMLElement;
    await user.click(
      within(section).getByRole("button", { name: "Are my conversations private?" }),
    );

    const controls = [
      within(section).getByRole("link", { name: /Read the Privacy Policy/i }),
      within(section).getByRole("link", { name: /Contact Us/i }),
      within(section).getByRole("button", { name: /Learn More/i }),
    ];

    for (const el of controls) {
      expect(el.className).toMatch(/focus-visible:ring-2/);
    }
    expect(within(section).getByRole("link", { name: /Contact Us/i })).toHaveAttribute(
      "href",
      CONTACT_HREF,
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

    await user.click(screen.getByRole("button", { name: HERO.secondaryCta }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});
