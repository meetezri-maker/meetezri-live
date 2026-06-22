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
import { useMemo } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { formatSubscriptionPlanLabel } from "@/app/pages/app/profile/profileUi";
import { cn } from "@/lib/utils";

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

  const displayName =
    (typeof profile?.full_name === "string" && profile.full_name.trim()) ||
    user?.email?.split("@")[0] ||
    "Friend";
  const firstName = displayName.split(" ")[0] || "Friend";
  const profileAvatarUrl =
    typeof profile?.avatar_url === "string" && profile.avatar_url.trim()
      ? profile.avatar_url.trim()
      : null;
  const profileInitial = (displayName[0] || "?").toUpperCase();
  const subscriptionPlan =
    typeof profile?.subscription_plan === "string" ? profile.subscription_plan : undefined;
  const planLabel = formatSubscriptionPlanLabel(subscriptionPlan);

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col gap-1 overflow-y-auto overscroll-y-contain px-2 pb-3 pt-2",
        "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      )}
    >
     

      {mainNav.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.path);
        return (
          <Link key={item.path} to={item.path} className="block">
            <motion.div
              whileHover={{ x: 2 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "solace-sidebar-nav flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all duration-300",
                active
                  ? "solace-sidebar-nav--active"
                  : "text-[rgba(255,255,255,0.55)] hover:bg-white/[0.04] hover:text-[rgba(255,255,255,0.82)]"
              )}
            >
              <Icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0",
                  active ? "solace-sidebar-nav-icon--active" : "text-zinc-500"
                )}
              />
              <span className="truncate">{item.label}</span>
            </motion.div>
          </Link>
        );
      })}

      <div className="mt-auto space-y-3 border-t border-white/[0.06] pt-3">
        <div className="solace-sidebar-profile rounded-xl border border-white/[0.06] bg-[linear-gradient(180deg,rgba(18,18,40,0.55)_0%,rgba(10,10,24,0.75)_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_28px_-10px_rgba(139,92,246,0.15)]">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-violet-500/30 to-cyan-500/15">
              {profileAvatarUrl ? (
                <img
                  src={profileAvatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-sm font-semibold text-white"
                  aria-hidden
                >
                  {profileInitial}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-100">{firstName}</p>
              {subscriptionPlan ? (
                <span className="mt-0.5 inline-block rounded-full border border-violet-400/25 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-violet-200/90">
                  {planLabel}
                </span>
              ) : (
                <p className="truncate text-[11px] text-zinc-500">{user?.email}</p>
              )}
            </div>
          </div>
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

      </div>
    </div>
  );
}
