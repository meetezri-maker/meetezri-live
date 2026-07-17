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

export interface MemberNavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

/** Single source of truth for member navigation (desktop sidebar + mobile drawer). */
export const MEMBER_NAV_ITEMS: MemberNavItem[] = [
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

/**
 * Resolve which navigation item owns `pathname`.
 *
 * `/app/dashboard` only matches exactly so that nested routes below it do not
 * light up Home. When several items match, the longest path wins, which keeps
 * `/app/settings/achievements` on Achievements rather than Settings.
 */
export function findActiveNavPath(
  pathname: string,
  items: MemberNavItem[] = MEMBER_NAV_ITEMS
): string | null {
  const matches = (path: string) =>
    pathname === path || (path !== "/app/dashboard" && pathname.startsWith(`${path}/`));

  return items
    .filter((item) => matches(item.path))
    .reduce<string | null>(
      (best, item) => (best === null || item.path.length > best.length ? item.path : best),
      null
    );
}
