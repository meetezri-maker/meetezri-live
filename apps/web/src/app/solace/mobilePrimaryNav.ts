import {
  AudioLines,
  BookOpen,
  Ellipsis,
  Home,
  House,
  Menu,
  MessageSquareMore,
  Sparkles,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CONVERSATIONS_ROUTE_PATH } from "@/app/features/conversations/conversationsFlag";

export interface MobilePrimaryTab {
  path: string;
  label: string;
  icon: LucideIcon;
}

export interface MobilePrimaryNav {
  /** Link tabs, in order. The "More" drawer button always follows them. */
  tabs: MobilePrimaryTab[];
  moreIcon: LucideIcon;
}

/** Pre-Conversations bottom bar — unchanged while the flag is off. */
const LEGACY_NAV: MobilePrimaryNav = {
  tabs: [
    { path: "/app/dashboard", icon: Home, label: "Home" },
    { path: "/app/session-lobby", icon: Video, label: "Talk" },
    { path: "/app/progress", icon: Sparkles, label: "Reflect" },
    { path: "/app/journal", icon: BookOpen, label: "Journal" },
  ],
  moreIcon: Menu,
};

/**
 * Approved Conversations bottom bar: Home · Talk · Conversations · Journal · More.
 * Progress ("Reflect") moves into the More drawer, where it is already listed.
 */
const CONVERSATIONS_NAV: MobilePrimaryNav = {
  tabs: [
    { path: "/app/dashboard", icon: House, label: "Home" },
    { path: "/app/session-lobby", icon: AudioLines, label: "Talk" },
    { path: CONVERSATIONS_ROUTE_PATH, icon: MessageSquareMore, label: "Conversations" },
    { path: "/app/journal", icon: BookOpen, label: "Journal" },
  ],
  moreIcon: Ellipsis,
};

export function getMobilePrimaryNav({ conversationsEnabled }: { conversationsEnabled: boolean }): MobilePrimaryNav {
  return conversationsEnabled ? CONVERSATIONS_NAV : LEGACY_NAV;
}

/**
 * Whether a tab is active. Tabs match their exact path, as before; Conversations also owns its
 * thread routes (`/app/conversations/<id>`).
 */
export function isMobileTabActive(tabPath: string, pathname: string): boolean {
  if (pathname === tabPath) return true;
  return tabPath === CONVERSATIONS_ROUTE_PATH && pathname.startsWith(`${CONVERSATIONS_ROUTE_PATH}/`);
}
