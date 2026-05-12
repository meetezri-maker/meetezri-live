import { Link, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import {
  Home,
  Video,
  Heart,
  BookOpen,
  Target,
  Moon,
  Brain,
  TrendingUp,
  Clock,
  Sparkles,
  Users,
  CreditCard,
  Trophy,
  Settings,
  LifeBuoy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { cn } from "@/lib/utils";

const FOCUS_KEY = "solace_focus_mode";

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

const mainNav: NavItem[] = [
  { path: "/app/dashboard", label: "Home", icon: Home },
  { path: "/app/session-lobby", label: "Talk It Out", icon: Video },
  { path: "/app/mood-checkin", label: "Mood", icon: Heart },
  { path: "/app/journal", label: "Journal", icon: BookOpen },
  { path: "/app/habit-tracker", label: "Habit Tracker", icon: Target },
  { path: "/app/sleep-tracker", label: "Sleep Tracker", icon: Moon },
  { path: "/app/brain-health", label: "Brain Health", icon: Brain },
  { path: "/app/progress", label: "Progress", icon: TrendingUp },
  { path: "/app/session-history", label: "Talk It Out History", icon: Clock },
  { path: "/app/wellness-tools", label: "Wellness Tools", icon: Sparkles },
  { path: "/app/community", label: "Community", icon: Users },
  { path: "/app/billing", label: "Billing & Credits", icon: CreditCard },
  { path: "/app/settings/achievements", label: "Achievements", icon: Trophy },
  { path: "/app/settings", label: "Settings", icon: Settings },
  { path: "/app/settings/help-support", label: "Support", icon: LifeBuoy },
];

export function SolaceSidebar() {
  const location = useLocation();
  const { profile, user } = useAuth();
  const [focusMode, setFocusMode] = useState(false);

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(FOCUS_KEY);
      setFocusMode(v === "1");
    } catch {
      setFocusMode(false);
    }
  }, []);

  const setFocus = useCallback((next: boolean) => {
    setFocusMode(next);
    try {
      window.localStorage.setItem(FOCUS_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent("solace-focus-mode", { detail: { enabled: next } }));
  }, []);

  const isActive = useMemo(
    () => (path: string) =>
      location.pathname === path ||
      (path !== "/app/dashboard" && location.pathname.startsWith(`${path}/`)),
    [location.pathname]
  );

  const firstName = profile?.full_name?.split(" ")[0] || "Friend";
  const premiumish =
    ["pro", "core", "active"].includes(String(profile?.subscription_plan || "").toLowerCase()) ||
    String(profile?.subscription_status || "").toLowerCase() === "active";

  return (
    <div
      className={cn(
        "solace-scroll flex h-full min-h-0 flex-col gap-0.5 overflow-y-auto overscroll-y-contain px-2.5 pb-4 pt-3",
        "[scrollbar-gutter:stable]"
      )}
    >
      <div className="px-2.5 pb-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-zinc-600/95">Solace</p>
      </div>

      {mainNav.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.path);
        return (
          <Link key={item.path} to={item.path} className="block">
            <motion.div
              whileHover={{ x: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "flex items-center gap-3 rounded-[0.85rem] px-3 py-2.5 text-[13.5px] transition-colors duration-500",
                active
                  ? "bg-gradient-to-r from-violet-500/15 to-cyan-500/8 text-zinc-50 shadow-[0_0_36px_-8px_rgba(109,40,217,0.22),inset_0_0_0_1px_rgba(139,92,246,0.22)]"
                  : "text-zinc-500/95 hover:bg-white/[0.035] hover:text-zinc-300/95"
              )}
            >
              <Icon
                className={cn(
                  "h-[17px] w-[17px] shrink-0 transition-colors duration-500",
                  active ? "text-violet-300/95" : "text-zinc-600/90"
                )}
              />
              <span className="truncate font-normal tracking-tight">{item.label}</span>
            </motion.div>
          </Link>
        );
      })}

      <div className="mt-auto space-y-3.5 border-t border-white/[0.045] pt-4">
        <div className="rounded-[1rem] border border-white/[0.06] bg-gradient-to-br from-black/30 to-black/18 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_48px_-28px_rgba(0,0,0,0.55)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-gradient-to-br from-violet-500/25 to-cyan-500/12 text-[13px] font-medium text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              {(firstName[0] || "?").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-medium tracking-tight text-zinc-100/95">
                {firstName}
              </p>
              {premiumish ? (
                <span className="mt-1 inline-block rounded-full border border-violet-400/20 bg-violet-500/[0.09] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-violet-200/80">
                  Premium
                </span>
              ) : (
                <p className="truncate text-[11px] text-zinc-600/95">{user?.email}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-[0.85rem] border border-white/[0.055] bg-black/18 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <div>
            <p className="text-[12.5px] font-medium text-zinc-300/95">Focus mode</p>
            <p className="text-[10px] leading-relaxed text-zinc-600/90">Minimize distractions</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={focusMode}
            onClick={() => setFocus(!focusMode)}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50",
              focusMode ? "bg-violet-500/50" : "bg-zinc-700/80"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-zinc-100 shadow transition-transform duration-300",
                focusMode && "translate-x-5 bg-white"
              )}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
