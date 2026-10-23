/** Every in-page anchor the homepage exposes, in page order. */
export const HOME_SECTION_IDS = [
  "hero",
  "companions",
  "features",
  "how-it-works",
  "journey",
  "about",
  "pricing",
  "faq",
  "contact",
] as const;

export type HomeSectionId = (typeof HOME_SECTION_IDS)[number];

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * Smoothly scrolls to a section by element id.
 * Handles both tall scroll-pinned/sticky sections and standard flow sections
 * by computing the optimal scroll position and accounting for the floating navbar.
 */
export function scrollToSection(
  sectionId: string,
  { updateHash = true }: { updateHash?: boolean } = {},
) {
  const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";

  if (sectionId === "hero" || sectionId === "top") {
    window.scrollTo({ top: 0, behavior });
    if (updateHash && window.location.hash) {
      history.pushState(null, "", window.location.pathname + window.location.search);
    }
    return;
  }

  const element = document.getElementById(sectionId);
  if (!element) return;

  const rect = element.getBoundingClientRect();
  const absoluteTop = window.scrollY + rect.top;

  // Pinned sections (a sticky `.home-pin-stage`) must be scrolled to absoluteTop so the stage
  // locks at top:0 with initial scroll progress 0; the stage already clears the navbar.
  // Standard flow sections look best offset by ~70px to clear the floating navbar — including
  // pinnable sections currently laid out in flow, and ones that are merely tall.
  const stage = element.querySelector(".home-pin-stage");
  const isSticky = stage !== null && getComputedStyle(stage).position === "sticky";

  const targetY = isSticky ? absoluteTop : Math.max(0, absoluteTop - 70);

  window.scrollTo({ top: targetY, behavior });

  if (updateHash && window.location.hash !== `#${sectionId}`) {
    history.pushState(null, "", `#${sectionId}`);
  }
}
