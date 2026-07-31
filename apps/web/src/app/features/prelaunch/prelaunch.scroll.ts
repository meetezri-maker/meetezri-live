/**
 * In-page navigation for the pre-launch landing page.
 *
 * Mirrors the behaviour `PrelaunchNav` already implements: smooth scrolling
 * unless the visitor prefers reduced motion, then focus transferred to the
 * destination so keyboard users continue from the section they jumped to
 * rather than from the top of the document (WCAG 2.4.3).
 *
 * `PrelaunchNav` keeps its own copy of this logic for now; unifying the two is
 * a safe follow-up, deliberately left out of this change to avoid touching the
 * navigation while sections are still being converted.
 */
export function scrollToPrelaunchSection(targetId: string): void {
  const target = document.getElementById(targetId);
  if (!target) return;

  const prefersReducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  target.scrollIntoView({
    behavior: prefersReducedMotion ? "auto" : "smooth",
    block: "start",
  });

  // Sections are not natively focusable; -1 makes the destination programmatically
  // focusable without adding it to the tab order.
  target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
}
