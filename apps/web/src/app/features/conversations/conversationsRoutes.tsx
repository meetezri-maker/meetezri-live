import { lazy, type ReactElement } from "react";
import { CONVERSATIONS_ROUTE_PATTERN, isConversationsEnabled } from "./conversationsFlag";

const ConversationsPage = lazy(() =>
  import("./ConversationsPage").then((module) => ({ default: module.ConversationsPage }))
);

interface ConversationsRouteElement {
  path: typeof CONVERSATIONS_ROUTE_PATTERN;
  element: ReactElement;
}

/**
 * Member routes for the Conversations Module, mapped inside the `<AppLayout />` block in
 * `App.tsx` (so they inherit `ProtectedRoute` and the member shell) and before the `/app/*`
 * fallback. One pattern covers both `/app/conversations` and `/app/conversations/:conversationId`.
 * When the flag is off this is empty and both paths fall through to the existing fallback.
 */
export function getConversationsRouteElements(
  enabled: boolean = isConversationsEnabled()
): readonly ConversationsRouteElement[] {
  return enabled ? [{ path: CONVERSATIONS_ROUTE_PATTERN, element: <ConversationsPage /> }] : [];
}
