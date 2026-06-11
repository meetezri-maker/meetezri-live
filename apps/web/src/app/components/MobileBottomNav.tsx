import { motion } from "motion/react";
import { Link, useLocation } from "react-router";
import { Home, Video, BookOpen, Menu, Sparkles } from "lucide-react";

interface MobileBottomNavProps {
  /** Tighter bottom bar when Appearance → Compact mode is on */
  compact?: boolean;
}

/** Reflect → Progress / inner life rhythm (locked mobile reference). */
export function MobileBottomNav({ compact = false }: MobileBottomNavProps) {
  const location = useLocation();

  const navItems = [
    { path: "/app/dashboard", icon: Home, label: "Home" },
    { path: "/app/session-lobby", icon: Video, label: "Talk" },
    { path: "/app/progress", icon: Sparkles, label: "Reflect" },
    { path: "/app/journal", icon: BookOpen, label: "Journal" },
    { path: "/app/settings", icon: Menu, label: "More" },
  ];

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="solace-mobile-nav solace-app fixed bottom-0 left-0 right-0 z-50 border-t border-[color:var(--solace-border)] bg-[color-mix(in_srgb,var(--solace-bg)_88%,transparent)] shadow-[var(--solace-ds-shadow-cinematic)] backdrop-blur-xl safe-area-pb lg:hidden"
    >
      <div className={`flex items-stretch justify-around px-1 ${compact ? "py-1.5" : "py-2"}`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.path === "/app/settings"
              ? location.pathname.startsWith("/app/settings")
              : location.pathname === item.path;

          return (
            <Link key={item.path} to={item.path} className="relative min-w-0 flex-1">
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
                  {item.label}
                </span>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
}