import type { SafetyState } from "@/app/types/safety";

/**
 * Member routes where the floating quick-chat launcher (and any open quick chat) must not appear.
 * A path matches when it equals an entry or sits below it (`entry/...`).
 *
 * - Conversations pages already offer "Start a New Conversation".
 * - Voice/video sessions and the lobby: never compete with a live session.
 * - Safety surfaces (emergency resources, cooldown, wellness/safety plan, emergency contacts,
 *   emergency notification history): never cover a critical safety action.
 * - Appearance settings: its sticky Save bar sits where the launcher would.
 */
export const QUICK_CHAT_HIDDEN_PATHS: readonly string[] = [
  "/app/conversations",
  "/app/active-session",
  "/app/session-lobby",
  "/app/emergency-resources",
  "/app/crisis-resources",
  "/app/settings/cooldown-screen",
  "/app/settings/wellness-plan",
  "/app/settings/safety-plan",
  "/app/settings/emergency-contacts",
  "/app/settings/emergency-notifications",
  // Same NotificationHistory screen as emergency-notifications, reachable by a second path.
  "/app/settings/notification-history",
  "/app/settings/appearance",
];

/** Safety states that suppress quick chat. ELEVATED_CONCERN deliberately keeps it available. */
export const QUICK_CHAT_HIDDEN_SAFETY_STATES: readonly SafetyState[] = ["HIGH_RISK", "SAFETY_MODE", "COOLDOWN"];

function onHiddenPath(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return QUICK_CHAT_HIDDEN_PATHS.some((hidden) => path === hidden || path.startsWith(`${hidden}/`));
}

/**
 * Whether quick chat may show. Only ordinary member pages (`/app/...`) qualify, so onboarding,
 * authentication and public pages are excluded even if the shell were ever reused for them.
 */
export function isQuickChatAllowed(pathname: string, safetyState: SafetyState, enabled: boolean): boolean {
  if (!enabled) return false;
  if (!pathname.startsWith("/app/")) return false;
  if (onHiddenPath(pathname)) return false;
  return !QUICK_CHAT_HIDDEN_SAFETY_STATES.includes(safetyState);
}
