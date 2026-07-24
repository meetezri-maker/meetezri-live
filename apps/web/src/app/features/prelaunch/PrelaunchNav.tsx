import { useCallback, useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "@/app/components/BrandLogo";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, PRIMARY_CTA_LABEL } from "./prelaunch.content";
import { useFoundingMemberSignup } from "./FoundingMemberSignupContext";

/**
 * Pre-launch navigation.
 *
 * Transparent over the hero, then transitions into the same premium glass
 * treatment `PublicNav` uses once the visitor scrolls. Items map to sections on
 * this page rather than other routes, so the ad landing experience stays whole.
 */
export function PrelaunchNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { openSignup } = useFoundingMemberSignup();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToSection = useCallback((targetId: string) => {
    setMobileOpen(false);
    const target = document.getElementById(targetId);
    if (!target) return;

    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    target.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
    // Keyboard users continue from the section they just jumped to.
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,box-shadow] duration-500",
        scrolled || mobileOpen
          ? "border-b border-white/[0.08] bg-[#070815]/75 shadow-[inset_0_-1px_0_rgba(233,30,99,0.14)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[#070815]/60"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => scrollToSection(NAV_ITEMS[0].targetId)}
          className="relative z-10 flex shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          aria-label="Solace — back to top"
        >
          <BrandLogo heightClass="h-10" variant="onDark" />
        </button>

        <nav
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 text-sm font-normal tracking-wide text-violet-100/80 lg:flex"
          aria-label="Primary"
        >
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => scrollToSection(item.targetId)}
              className="rounded-md pb-1 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="relative z-10 hidden lg:flex">
          <button
            type="button"
            onClick={() => openSignup("nav")}
            className="landing-cta-glow rounded-full bg-gradient-to-r from-[#E91E63] to-[#9C27B0] px-6 py-2.5 text-[13px] font-medium text-white transition-transform hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050816]"
          >
            {PRIMARY_CTA_LABEL}
          </button>
        </div>

        <button
          type="button"
          className="relative z-10 flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 lg:hidden"
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
          aria-controls="prelaunch-mobile-menu"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
        </button>
      </div>

      {mobileOpen ? (
        <div
          id="prelaunch-mobile-menu"
          className="border-t border-white/[0.06] bg-[#070812]/95 px-4 py-4 backdrop-blur-xl lg:hidden"
        >
          <nav className="flex flex-col gap-1 text-sm text-violet-100/85" aria-label="Primary">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => scrollToSection(item.targetId)}
                className="rounded-lg px-2 py-3 text-left transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                openSignup("nav_mobile");
              }}
              className="landing-cta-glow mt-2 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#E91E63] to-[#9C27B0] px-6 py-3 text-center text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            >
              {PRIMARY_CTA_LABEL}
            </button>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
