import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { onAuthIdentityReset } from "@/lib/authIdentityEvents";
import { createApiConversationService } from "./apiConversationService";
import {
  ConversationServiceError,
  type ConversationService,
  type ConversationsSnapshot,
} from "./conversationService";
import { conversationsSource } from "./conversationsFlag";
import { createMockConversationService } from "./mockConversationService";
import { buildPreviewSeed } from "./mocks/previewConversations";

/**
 * ACCOUNT ISOLATION. Conversation data belongs to exactly one authenticated user.
 *
 * There is at most one live service, and it is OWNED by a user id. When the signed-in user changes
 * — or nobody is signed in — the previous service is disposed immediately: every pending request
 * and active stream (Conversations page and Quick Chat) is aborted, its data is dropped, and it can
 * never publish state again. The next user always starts from an empty service and loads their own
 * data from the API. AuthContext also signals sign-out / account changes (`onAuthIdentityReset`),
 * which disposes the service even when no Conversations component is mounted.
 *
 * The page and Quick Chat share the owner's single service, so a thread is the same everywhere.
 * Which implementation is used is chosen by `VITE_CONVERSATIONS_SOURCE` (see `conversationsSource`):
 * "preview" (default, in-memory simulation; seed history in development builds only) or "api".
 */

let current: { ownerId: string; service: ConversationService } | null = null;

function createServiceFor(ownerId: string): ConversationService {
  return conversationsSource() === "api"
    ? createApiConversationService({ ownerId })
    : createMockConversationService({ ownerId, seed: import.meta.env.DEV ? buildPreviewSeed() : undefined });
}

/** Dispose the current owner's service (sign-out, account switch). Safe to call repeatedly. */
export function resetConversationServices(): void {
  const previous = current;
  current = null;
  previous?.service.dispose?.();
}

// Sign-out or account change anywhere (including another tab) drops the previous owner's data.
onAuthIdentityReset(resetConversationServices);

/**
 * Placeholder while ownership is unknown (signed out / signing in). It holds no data, reports the
 * list as loading so nothing — not even an empty state — is rendered for an unknown owner, and
 * refuses every operation.
 */
function createInertService(kind: ConversationService["kind"]): ConversationService {
  const snapshot: ConversationsSnapshot = { conversations: [], messagesById: {}, typingIds: [], listStatus: "loading" };
  const refuse = async (): Promise<never> => {
    throw new ConversationServiceError("ABORTED", "You’re not signed in.");
  };
  return {
    kind,
    ownerId: null,
    disposed: false,
    getSnapshot: () => snapshot,
    subscribe: () => () => undefined,
    listConversations: async () => [],
    getConversation: async () => null,
    listMessages: async () => [],
    createConversation: refuse,
    sendMessage: refuse,
    retryMessage: refuse,
  };
}

const inertServices: Record<ConversationService["kind"], ConversationService> = {
  api: createInertService("api"),
  mock: createInertService("mock"),
};

/**
 * The service for `userId`, created on first use and disposed as soon as another user (or no
 * user) asks. Never returns a service owned by anyone else.
 */
export function getConversationServiceForUser(userId: string | null | undefined): ConversationService {
  if (!userId) {
    resetConversationServices();
    return inertServices[conversationsSource() === "api" ? "api" : "mock"];
  }
  if (current && current.ownerId === userId && !current.service.disposed) return current.service;
  resetConversationServices();
  current = { ownerId: userId, service: createServiceFor(userId) };
  return current.service;
}

const ConversationServiceContext = createContext<ConversationService | null>(null);

/** Optional override (tests). Without it, the signed-in user's own service is used. */
export function ConversationServiceProvider({
  service,
  children,
}: {
  service: ConversationService;
  children: ReactNode;
}) {
  return <ConversationServiceContext.Provider value={service}>{children}</ConversationServiceContext.Provider>;
}

function useAuthenticatedUserId(): string | null {
  try {
    return useAuth().user?.id ?? null;
  } catch {
    // Rendered outside AuthProvider (isolated component tests): no owner, so no data.
    return null;
  }
}

export function useConversationService(): ConversationService {
  const override = useContext(ConversationServiceContext);
  const userId = useAuthenticatedUserId();
  return override ?? getConversationServiceForUser(userId);
}

export function useConversationsSnapshot(): ConversationsSnapshot {
  const service = useConversationService();
  return useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot);
}
