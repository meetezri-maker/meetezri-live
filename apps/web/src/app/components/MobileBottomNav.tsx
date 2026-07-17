import { motion } from "motion/react";
import { Link, useLocation } from "react-router";
import { Home, Video, BookOpen, Menu, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MobileNavigationDrawer } from "./MobileNavigationDrawer";
import { findActiveNavPath } from "@/app/solace/memberNav";

interface MobileBottomNavProps {
  /** Tighter bottom bar when Appearance → Compact mode is on */
  compact?: boolean;
}

/** The four primary destinations the bottom bar owns; everything else lives under More. */
const PRIMARY_PATHS = ["/app/dashboard", "/app/session-lobby", "/app/progress", "/app/journal"];

/** Tailwind's `lg` breakpoint, where the bottom bar and drawer give way to the sidebar. */
const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";

/** Reflect → Progress / inner life rhythm (locked mobile reference). */
export function MobileBottomNav({ compact = false }: MobileBottomNavProps) {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const previousPathRef = useRef(location.pathname);

  // Safety net for route changes the drawer links do not handle themselves:
  // programmatic navigation, redirects, and browser back/forward.
  useEffect(() => {
    if (previousPathRef.current !== location.pathname) {
      previousPathRef.current = location.pathname;
      setDrawerOpen(false);
    }
  }, [location.pathname]);

  // `lg:hidden` only hides the drawer visually. Crossing into desktop with it open
  // would leave Radix's scroll lock and focus trap on an invisible dialog, so close it.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const onChange = () => {
      if (mql.matches) setDrawerOpen(false);
    };
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const navItems = [
    { path: "/app/dashboard", icon: Home, label: "Home" },
    { path: "/app/session-lobby", icon: Video, label: "Talk" },
    { path: "/app/progress", icon: Sparkles, label: "Reflect" },
    { path: "/app/journal", icon: BookOpen, label: "Journal" },
  ];

  const activeMemberPath = findActiveNavPath(location.pathname);
  const moreActive =
    drawerOpen || (activeMemberPath !== null && !PRIMARY_PATHS.includes(activeMemberPath));

  const renderTab = (
    { icon: Icon, label }: { icon: typeof Home; label: string },
    isActive: boolean
  ) => (
    <motion.div
      whileTap={{ scale: 0.94 }}
      className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 ${compact ? "py-1" : "py-1.5"}`}
    >
      {isActive && (
        <motion.div
          layoutId="solaceMobileTab"
          className="solace-mobile-nav-indicator absolute -top-px left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full opacity-90"
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
        />
      )}
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-2xl border transition-colors ${
          isActive
            ? "solace-mobile-nav-tab--active"
            : "solace-mobile-nav-tab border-transparent bg-transparent text-[var(--solace-muted)]"
        }`}
      >
        <Icon className={compact ? "h-[18px] w-[18px]" : "h-5 w-5"} aria-hidden />
      </span>
      <span
        className={`truncate font-medium ${
          compact ? "max-w-[4.5rem] text-[10px] leading-tight" : "max-w-[4.75rem] text-[11px]"
        } ${isActive ? "solace-mobile-nav-label--active text-[var(--solace-text)]" : "text-[var(--solace-muted)]"}`}
      >
        {label}
      </span>
    </motion.div>
  );

  return (
    <>
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="solace-mobile-nav solace-app fixed bottom-0 left-0 right-0 z-50 border-t border-[color:var(--solace-border)] bg-[color-mix(in_srgb,var(--solace-bg)_88%,transparent)] shadow-[var(--solace-ds-shadow-cinematic)] backdrop-blur-xl safe-area-pb lg:hidden"
      >
        <div className={`flex items-stretch justify-around px-1 ${compact ? "py-1.5" : "py-2"}`}>
          {navItems.map((item) => (
            <Link key={item.path} to={item.path} className="relative min-w-0 flex-1">
              {renderTab(item, location.pathname === item.path)}
            </Link>
          ))}

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
            aria-haspopup="dialog"
            className="relative min-w-0 flex-1"
          >
            {renderTab({ icon: Menu, label: "More" }, moreActive)}
          </button>
        </div>
      </motion.div>

      <MobileNavigationDrawer open={drawerOpen} onOpenChange={setDrawerOpen} compact={compact} />
    </>
  );
}
