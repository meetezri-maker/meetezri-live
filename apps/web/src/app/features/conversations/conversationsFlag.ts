/**
 * Conversations Module (text chat) — frontend availability flag.
 *
 * DEFAULT: OFF. Follows the repository's `VITE_*` env-var convention (see
 * `isSessionExtensionEnabled` in `pages/app/active-session/utils/sessionExtension.ts`).
 * Only the literal values "true" or "1" (case-insensitive, trimmed) enable it; unset, empty or
 * anything else keeps the module out of navigation and unregistered as a route.
 *
 * Deployed environments must leave `VITE_CONVERSATIONS_ENABLED` unset until the module is
 * approved for release. Vite inlines the value at build time.
 */
export function parseConversationsFlag(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const value = raw.trim().toLowerCase();
  return value === "true" || value === "1";
}

export function isConversationsEnabled(): boolean {
  return parseConversationsFlag(import.meta.env.VITE_CONVERSATIONS_ENABLED);
}

/**
 * Data source behind the (already flag-gated) module. Only the literal "api" selects the real,
 * authenticated Solace API; anything else — including unset — keeps the in-memory preview, so
 * turning the module on never silently starts sending member messages to the AI.
 */
export function parseConversationsSource(raw: unknown): "api" | "preview" {
  return typeof raw === "string" && raw.trim().toLowerCase() === "api" ? "api" : "preview";
}

export function conversationsSource(): "api" | "preview" {
  return parseConversationsSource(import.meta.env.VITE_CONVERSATIONS_SOURCE);
}

export const CONVERSATIONS_ROUTE_PATH = "/app/conversations";

/** List and thread share one route (optional segment) so the page — and in-flight state — persists. */
export const CONVERSATIONS_ROUTE_PATTERN = `${CONVERSATIONS_ROUTE_PATH}/:conversationId?`;

/**
 * `/app/conversations/<id>` — the full-screen mobile thread. Used by `AppLayout` to hide the
 * mobile bottom navigation, and only when the module is enabled.
 */
export function isConversationThreadPath(pathname: string, enabled: boolean = isConversationsEnabled()): boolean {
  return enabled && /^\/app\/conversations\/[^/]+\/?$/.test(pathname);
}
