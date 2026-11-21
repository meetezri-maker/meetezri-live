import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { createApiConversationService } from "./apiConversationService";
import type { ConversationService, ConversationsSnapshot } from "./conversationService";
import { conversationsSource } from "./conversationsFlag";
import { createMockConversationService } from "./mockConversationService";
import { buildPreviewSeed } from "./mocks/previewConversations";

let defaultService: ConversationService | null = null;

/**
 * The app-wide service: one instance per page load, so list and thread routes (and quick chat)
 * share state while the member moves between them.
 *
 * Which one is chosen by `VITE_CONVERSATIONS_SOURCE` (see `conversationsSource`), and only matters
 * while `VITE_CONVERSATIONS_ENABLED` is on — otherwise nothing in this module is mounted:
 * - "preview" (default): the in-memory simulation. Seed history in development builds only.
 * - "api": the authenticated Solace API with real companion replies.
 */
export function getDefaultConversationService(): ConversationService {
  if (!defaultService) {
    defaultService =
      conversationsSource() === "api"
        ? createApiConversationService()
        : createMockConversationService({ seed: import.meta.env.DEV ? buildPreviewSeed() : undefined });
  }
  return defaultService;
}

const ConversationServiceContext = createContext<ConversationService | null>(null);

/** Optional override (tests, future real adapter). Without it the default preview service is used. */
export function ConversationServiceProvider({
  service,
  children,
}: {
  service: ConversationService;
  children: ReactNode;
}) {
  return <ConversationServiceContext.Provider value={service}>{children}</ConversationServiceContext.Provider>;
}

export function useConversationService(): ConversationService {
  return useContext(ConversationServiceContext) ?? getDefaultConversationService();
}

export function useConversationsSnapshot(): ConversationsSnapshot {
  const service = useConversationService();
  return useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot);
}
