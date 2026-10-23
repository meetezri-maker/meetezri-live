import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { scrollToSection } from "../scroll";
import { EARLY_ACCESS_PATH, LOGIN_PATH, trackEarlyAccessClick } from "../homeActions";
import solaceLogoHorizontal from "../assets/solace-logo-horizontal.webp";

function Logo({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="select-none cursor-pointer rounded-full transition-transform duration-200 hover:scale-[1.03]"
      aria-label="Solace, back to top"
    >
      <img
        src={solaceLogoHorizontal}
        alt=""
        width={480}
        height={170}
        className="h-[34px] sm:h-[40px] w-auto object-contain"
      />
    </button>
  );
}

function ArrowIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 8.3"
      fill="none"
      className={className}
      aria-hidden
      data-home-arrow
      style={{ animation: "solace-home-arrow-bounce 1.2s ease-in-out infinite" }}
    >
      <path
        d="M7.7 0.3 11.7 4c0.2 0.2 0.2 0.5 0 0.7L7.7 8c-0.2 0.2-0.6 0.1-0.6-0.2V5.2H0.5c-0.3 0-0.5-0.2-0.5-0.5V3.6c0-0.3 0.2-0.5 0.5-0.5H7.1V0.5C7.1 0.2 7.5 0.1 7.7 0.3Z"
        fill="currentColor"
      />
    </svg>
  );
}

interface NavItem {
  label: string;
  targetId: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Features", targetId: "features" },
  { label: "How It Works", targetId: "how-it-works" },
  { label: "Journey", targetId: "journey" },
  { label: "Founder", targetId: "about" },
  { label: "Pricing", targetId: "pricing" },
  { label: "FAQ", targetId: "faq" },
];

export default function HomeNavbar() {
  const [activeSection, setActiveSection] = useState<string>("hero");
  const [menuOpen, setMenuOpen] = useState(false);
  const rafRef = useRef<number | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuGroupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const computeActive = () => {
      if (window.scrollY < 240) {
        setActiveSection("hero");
        return;
      }

      const scrollPos = window.scrollY + window.innerHeight * 0.35;

      // Check section bounding boxes in reverse so bottom-most in-view section wins
      for (let i = NAV_ITEMS.length - 1; i >= 0; i--) {
        const item = NAV_ITEMS[i];
        const el = document.getElementById(item.targetId);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPos >= top && scrollPos < top + height) {
            setActiveSection(item.targetId);
            return;
          }
        }
      }
    };

    const handleScroll = () => {
      // Throttle to one DOM read per animation frame
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        computeActive();
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    computeActive();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    // A click or tap anywhere outside the toggle and panel closes the menu; focus stays
    // wherever that click put it.
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuGroupRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [menuOpen]);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    setMenuOpen(false);
    setActiveSection(targetId);
    scrollToSection(targetId);
  };

  return (
    <nav
      className="fixed left-1/2 top-3 sm:top-5 z-50 w-[min(900px,96vw)] lg:w-[min(980px,96vw)] -translate-x-1/2 transition-all duration-300"
      aria-label="Main Navigation"
    >
      <div className="grid grid-cols-[auto_1fr_auto] items-center rounded-full bg-white/92 px-3 sm:px-4 py-[7px] sm:py-[9px] shadow-[0px_12px_36px_rgba(29,29,29,0.1),0px_2px_8px_rgba(233,30,99,0.06)] backdrop-blur-md border border-white/80">
        {/* Left: Logo */}
        <div className="pl-1 sm:pl-2 shrink-0">
          <Logo
            onClick={() => {
              setMenuOpen(false);
              setActiveSection("hero");
              scrollToSection("hero");
            }}
          />
        </div>

        {/* Center: Navigation Links with Animated Pill Indicator (desktop) */}
        <div className="hidden lg:flex min-w-0 items-center justify-center gap-0.5 sm:gap-1 px-1 sm:px-2">
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.targetId;
            return (
              <a
                key={item.label}
                href={`#${item.targetId}`}
                onClick={(e) => handleLinkClick(e, item.targetId)}
                aria-current={isActive ? "location" : undefined}
                className="relative rounded-full px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-[12px] sm:text-[14px] md:text-[14.5px] transition-all duration-200 cursor-pointer select-none shrink-0"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                {/* Luminous Animated Pill Background when Active */}
                {isActive && (
                  <motion.div
                    layoutId="activeNavPill"
                    className="absolute inset-0 rounded-full bg-gradient-to-r from-[#e91e63]/12 via-[#e91e63]/16 to-[#9c27b0]/16 border border-[#e91e63]/30 shadow-[0_2px_14px_rgba(233,30,99,0.18),inset_0_1px_1px_rgba(255,255,255,0.9)]"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}

                {/* Micro Glowing Accent Dot/Bar Underneath */}
                {isActive && (
                  <motion.span
                    layoutId="activeNavIndicatorBar"
                    className="absolute -bottom-[2px] left-1/2 -translate-x-1/2 h-[2.5px] w-4 rounded-full bg-gradient-to-r from-[#e91e63] to-[#9c27b0] shadow-[0_0_8px_rgba(233,30,99,0.85)]"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}

                {/* Button Text */}
                <span
                  className={`relative z-10 block transition-all duration-200 ${
                    isActive
                      ? "bg-gradient-to-r from-[#e91e63] to-[#9c27b0] bg-clip-text text-transparent font-semibold tracking-[-0.01em]"
                      : "text-slate-700 hover:text-black font-medium hover:bg-black/[0.03] rounded-full"
                  }`}
                >
                  {item.label}
                </span>
              </a>
            );
          })}
        </div>

        {/* Phones and tablets: the link row does not fit, so it moves into a menu.
            A non-modal disclosure: the panel follows its toggle in the DOM (so Tab moves from
            the toggle straight into the links), focus is never trapped, and the menu closes on
            Escape, on a click outside it, or when focus moves out of it. */}
        <div
          ref={menuGroupRef}
          className="flex lg:hidden justify-end pr-2"
          onBlur={(e) => {
            if (!menuOpen) return;
            const next = e.relatedTarget as Node | null;
            if (next && !e.currentTarget.contains(next)) setMenuOpen(false);
          }}
        >
          <button
            ref={menuButtonRef}
            type="button"
            aria-expanded={menuOpen}
            aria-controls="home-mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-black/[0.04]"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
              {menuOpen ? (
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              )}
            </svg>
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                id="home-mobile-menu"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-x-0 top-full mt-2 rounded-[24px] border border-white/80 bg-white/95 p-2 text-left shadow-[0px_12px_36px_rgba(29,29,29,0.12)] backdrop-blur-md lg:hidden"
              >
                <ul className="flex flex-col" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  {NAV_ITEMS.map((item) => {
                    const isActive = activeSection === item.targetId;
                    return (
                      <li key={item.label}>
                        <a
                          href={`#${item.targetId}`}
                          onClick={(e) => handleLinkClick(e, item.targetId)}
                          aria-current={isActive ? "location" : undefined}
                          className={`block rounded-[16px] px-4 py-3 text-[15px] ${
                            isActive
                              ? "bg-gradient-to-r from-[#e91e63]/10 to-[#9c27b0]/10 font-semibold text-[#e91e63]"
                              : "font-medium text-slate-700"
                          }`}
                        >
                          {item.label}
                        </a>
                      </li>
                    );
                  })}
                  <li className="mt-1 border-t border-slate-100 pt-1">
                    <Link
                      to={LOGIN_PATH}
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-[16px] px-4 py-3 text-[15px] font-medium text-slate-700"
                    >
                      Log In
                    </Link>
                  </li>
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: Log In + Early Access CTA */}
        <div className="flex items-center justify-end gap-1 shrink-0">
          <Link
            to={LOGIN_PATH}
            className="hidden lg:block rounded-full px-3 py-2 text-[14px] font-medium text-slate-700 transition-colors hover:text-black"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            Log In
          </Link>
          <Link
            to={EARLY_ACCESS_PATH}
            onClick={() => trackEarlyAccessClick("home_nav")}
            className="group relative flex items-center gap-1.5 sm:gap-2 rounded-full bg-gradient-to-r from-[#e91e63] to-[#9c27b0] py-[6px] sm:py-[7px] pl-3 sm:pl-4 pr-[6px] sm:pr-[7px] text-[11.5px] sm:text-[13px] font-semibold text-white shadow-[0px_8px_18px_rgba(233,30,99,0.36)] transition-all duration-200 hover:scale-[1.03] hover:shadow-[0px_10px_24px_rgba(233,30,99,0.48)] active:scale-[0.98] cursor-pointer"
          >
            <span className="tracking-wide">Early Access</span>
            <span className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-200 group-hover:translate-x-[2px]">
              <ArrowIcon className="h-[7px] sm:h-[8px] w-[10px] sm:w-[11px] text-[#1d1d1d]" />
            </span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
