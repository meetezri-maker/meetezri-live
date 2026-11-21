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
  MessageSquareMore,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  CONVERSATIONS_ROUTE_PATH,
  isConversationsEnabled,
} from "@/app/features/conversations/conversationsFlag";

export interface MemberNavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

/** Conversations (text chat) — present only while `VITE_CONVERSATIONS_ENABLED` is on. */
const CONVERSATIONS_NAV_ITEM: MemberNavItem = {
  path: CONVERSATIONS_ROUTE_PATH,
  label: "Conversations",
  icon: MessageSquareMore,
};

const BASE_MEMBER_NAV_ITEMS: MemberNavItem[] = [
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
  { path: "/app/challenges", label: "Wellness Challenges", icon: Trophy },
  { path: "/app/community", label: "Community", icon: Users },
  { path: "/app/billing", label: "Billing & Credits", icon: CreditCard },
  { path: "/app/settings/achievements", label: "Achievements", icon: Trophy },
  { path: "/app/user-profile", label: "Profile", icon: User },
  { path: "/app/settings", label: "Settings", icon: Settings },
  { path: "/app/settings/help-support", label: "Help and Support", icon: LifeBuoy },
];

/**
 * Member navigation for a given feature-flag state. Conversations sits directly after
 * Talk It Out, matching the approved Conversations references; with the flag off the list is
 * exactly the previous one.
 */
export function buildMemberNavItems({
  conversationsEnabled,
}: {
  conversationsEnabled: boolean;
}): MemberNavItem[] {
  if (!conversationsEnabled) return [...BASE_MEMBER_NAV_ITEMS];
  const talkIndex = BASE_MEMBER_NAV_ITEMS.findIndex((item) => item.path === "/app/session-lobby");
  return [
    ...BASE_MEMBER_NAV_ITEMS.slice(0, talkIndex + 1),
    CONVERSATIONS_NAV_ITEM,
    ...BASE_MEMBER_NAV_ITEMS.slice(talkIndex + 1),
  ];
}

/** Single source of truth for member navigation (desktop sidebar + mobile drawer). */
export const MEMBER_NAV_ITEMS: MemberNavItem[] = buildMemberNavItems({
  conversationsEnabled: isConversationsEnabled(),
});

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
