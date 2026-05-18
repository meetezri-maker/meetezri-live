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
  { path: "/app/settings/resources", label: "Support", icon: LifeBuoy },
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
        "solace-scroll flex h-full min-h-0 flex-col gap-1 overflow-y-auto overscroll-y-contain px-2 pb-3 pt-2",
        "[scrollbar-gutter:stable]"
      )}
    >
      <div className="px-2 pb-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-zinc-500">Solace</p>
      </div>

      {mainNav.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.path);
        return (
          <Link key={item.path} to={item.path} className="block">
            <motion.div
              whileHover={{ x: 2 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all duration-300",
                active
                  ? "bg-gradient-to-r from-violet-500/18 to-cyan-500/10 text-zinc-50 shadow-[0_0_28px_rgba(139,92,246,0.18),inset_0_0_0_1px_rgba(139,92,246,0.28)]"
                  : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
              )}
            >
              <Icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0",
                  active ? "text-violet-300" : "text-zinc-500"
                )}
              />
              <span className="truncate">{item.label}</span>
            </motion.div>
          </Link>
        );
      })}

      <div className="mt-auto space-y-3 border-t border-white/[0.06] pt-3">
        <div className="rounded-xl border border-white/[0.07] bg-black/25 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-violet-500/30 to-cyan-500/15 text-sm font-medium text-zinc-100">
              {(firstName[0] || "?").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-100">{firstName}</p>
              {premiumish ? (
                <span className="mt-0.5 inline-block rounded-full border border-violet-400/25 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-200/90">
                  Premium
                </span>
              ) : (
                <p className="truncate text-[11px] text-zinc-500">{user?.email}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
          <div>
            <p className="text-xs font-medium text-zinc-200">Focus mode</p>
            <p className="text-[10px] text-zinc-500">Minimize distractions</p>
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
