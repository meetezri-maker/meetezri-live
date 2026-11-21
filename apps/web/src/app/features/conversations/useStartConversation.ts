import { useCallback, useState } from "react";
import { resolveConversationCompanion } from "./conversationCompanions";
import { useConversationService } from "./ConversationsServiceContext";
import type { ConversationCompanion, ConversationCompanionKey, ConversationSummary } from "./types";

/**
 * The one "start a conversation" flow, shared by the Conversations page and floating quick chat:
 * show "Preparing your chat…" for the chosen companion while the (mock) service creates the thread.
 */
export function useStartConversation() {
  const service = useConversationService();
  const [preparing, setPreparing] = useState<ConversationCompanion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(
    async (companionKey: ConversationCompanionKey): Promise<ConversationSummary | null> => {
      setError(null);
      setPreparing(resolveConversationCompanion(companionKey));
      try {
        return await service.createConversation({ companionKey });
      } catch {
        setError(
          service.kind === "mock"
            ? "The preview couldn’t start a conversation. Please try again."
            : "We couldn’t start a conversation. Please try again."
        );
        return null;
      } finally {
        setPreparing(null);
      }
    },
    [service]
  );

  const clearError = useCallback(() => setError(null), []);

  return { start, preparing, error, clearError };
}
