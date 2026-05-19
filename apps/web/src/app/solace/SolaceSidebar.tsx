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
  User,
  Settings,
  LifeBuoy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { DASHBOARD_IMAGES } from "@/lib/solace/dashboardImages";

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
  { path: "/app/user-profile", label: "Profile", icon: User },
  { path: "/app/settings", label: "Settings", icon: Settings },
  { path: "/app/settings/help-support", label: "Help and Support", icon: LifeBuoy },
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

  const isActive = useMemo(() => {
    const matches = (path: string) =>
      location.pathname === path ||
      (path !== "/app/dashboard" && location.pathname.startsWith(`${path}/`));

    const activeItem = mainNav
      .filter((item) => matches(item.path))
      .reduce<NavItem | null>(
        (best, item) => (!best || item.path.length > best.path.length ? item : best),
        null
      );

    return (path: string) => activeItem?.path === path;
  }, [location.pathname]);

  const firstName = profile?.full_name?.split(" ")[0] || "Friend";
  const profileAvatarSrc =
    typeof profile?.avatar_url === "string" && profile.avatar_url.trim()
      ? profile.avatar_url.trim()
      : DASHBOARD_IMAGES.userAvatar;
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
                  ? "bg-gradient-to-r from-violet-500/20 to-fuchsia-500/10 text-[rgba(255,255,255,0.96)] shadow-[0_0_32px_rgba(139,92,246,0.22),inset_0_0_0_1px_rgba(167,139,250,0.32)]"
                  : "text-[rgba(255,255,255,0.55)] hover:bg-white/[0.04] hover:text-[rgba(255,255,255,0.82)]"
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
        <div className="rounded-xl border border-white/[0.06] bg-[linear-gradient(180deg,rgba(18,18,40,0.55)_0%,rgba(10,10,24,0.75)_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_28px_-10px_rgba(139,92,246,0.15)]">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-violet-500/30 to-cyan-500/15">
              <img
                src={profileAvatarSrc}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
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

        {location.pathname === "/app/wellness-tools" && (
          <motion.div
            className="rounded-xl border border-white/[0.07] bg-black/28 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_24px_rgba(139,92,246,0.08)]"
            aria-label="Gentle reminder"
          >
            <p className="text-xs font-medium tracking-tight text-zinc-100">Take a breath</p>
            <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">You&apos;ve got this.</p>
            <div
              className="mt-2.5 h-[3px] w-full overflow-hidden rounded-full bg-white/[0.06]"
              aria-hidden
            >
              <div className="h-full w-[42%] rounded-full bg-gradient-to-r from-fuchsia-500/90 via-violet-500 to-cyan-400/80 shadow-[0_0_14px_rgba(236,72,153,0.45)]" />
            </div>
          </motion.div>
        )}

        {(location.pathname === "/app/user-profile" || location.pathname.startsWith("/app/user-profile?")) && (
          <div
            className="relative overflow-hidden rounded-xl border border-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_32px_-8px_rgba(139,92,246,0.2)]"
            aria-label="Supportive reminder"
          >
            <img
              src="/community/scene-forest.jpg"
              alt=""
              className="absolute inset-0 h-full w-full object-cover brightness-[0.55] saturate-[1.05]"
              width={320}
              height={180}
            />
            <div
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,10,35,0.25)_0%,rgba(8,8,20,0.88)_72%)]"
              aria-hidden
            />
            <motion.div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_30%_85%,rgba(251,191,36,0.16),transparent_55%)]"
              aria-hidden
            />
            <div className="relative px-3.5 py-3.5">
              <p className="text-[11px] font-medium tracking-wide text-[rgba(255,255,255,0.92)]">You matter here.</p>
              <p className="mt-1.5 text-[10px] leading-relaxed text-[rgba(255,255,255,0.62)]">
                Your wellness journey is important. We&apos;re here with you, every step.
              </p>
            </div>
          </div>
        )}
        {location.pathname.startsWith("/app/settings") && (
          <motion.div
            className="relative overflow-hidden rounded-xl border border-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_32px_-8px_rgba(139,92,246,0.2)]"
            aria-label="Privacy sanctuary reminder"
          >
            <img
              src="/community/scene-forest.jpg"
              alt=""
              className="absolute inset-0 h-full w-full object-cover brightness-[0.5] saturate-[1.08]"
              width={320}
              height={180}
            />
            <div
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,10,35,0.2)_0%,rgba(8,8,20,0.9)_72%)]"
              aria-hidden
            />
            <motion.div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_30%_85%,rgba(251,191,36,0.18),transparent_55%)]"
              aria-hidden
            />
            <div className="relative px-3.5 py-3.5">
              <p className="text-[11px] font-medium tracking-wide text-[rgba(255,255,255,0.92)]">
                Your sanctuary. Your story. Your safe space.
              </p>
              <p className="mt-1.5 text-[10px] leading-relaxed text-[rgba(255,255,255,0.58)]">
                Take a breath. Your privacy and emotional safety matter here.
              </p>
            </div>
          </motion.div>
        )}


      </div>
    </div>
  );
}
