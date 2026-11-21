/**
 * IN-MEMORY MOCK of the Conversations service — preview only.
 *
 * - No network, no Supabase, no Ezri, no AI. Nothing leaves the browser tab.
 * - State lives in memory; a page refresh resets it (by design, nothing is persisted).
 * - Companion replies are a fixed, neutral, clearly-labelled simulated message.
 */
import { resolveConversationCompanion } from "./conversationCompanions";
import { deriveConversationTitle, sortConversationsByRecent, toPreviewExcerpt } from "./conversationList";
import {
  ConversationServiceError,
  type ConversationService,
  type ConversationsSnapshot,
  type SendMessageInput,
} from "./conversationService";
import type { PreviewSeed } from "./mocks/previewConversations";
import type { ConversationMessage, ConversationSummary } from "./types";

/** Fixed simulated reply. Neutral on purpose — it must never read as real guidance. */
export const MOCK_REPLY_TEXT =
  "This is a simulated preview reply. Solace companion replies aren’t connected in this preview, so nothing you write here is read or saved.";

export function mockWelcomeMessage(displayName: string): string {
  return `Hi, I’m ${displayName}. I’m here to listen, reflect, and support you. What would you like to talk about today?`;
}

export interface MockConversationServiceOptions {
  seed?: PreviewSeed;
  /** Simulated latency before a new conversation opens (the "Preparing your chat" moment). */
  createDelayMs?: number;
  /** Simulated latency before the companion reply. */
  replyDelayMs?: number;
  /** Test hook: force a send to fail. */
  shouldFail?: (content: string) => boolean;
  now?: () => number;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ConversationServiceError("ABORTED", "Cancelled"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new ConversationServiceError("ABORTED", "Cancelled"));
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function createMockConversationService(options: MockConversationServiceOptions = {}): ConversationService {
  const createDelayMs = options.createDelayMs ?? 450;
  const replyDelayMs = options.replyDelayMs ?? 900;
  const now = options.now ?? (() => Date.now());

  let conversations: ConversationSummary[] = sortConversationsByRecent(options.seed?.conversations ?? []);
  let messagesById: Record<string, ConversationMessage[]> = { ...(options.seed?.messagesById ?? {}) };
  let typingIds: string[] = [];
  let sequence = 0;
  const listeners = new Set<() => void>();
  const inFlight = new Set<string>();

  let snapshot: ConversationsSnapshot = { conversations, messagesById, typingIds };
  const publish = () => {
    snapshot = { conversations, messagesById, typingIds };
    listeners.forEach((listener) => listener());
  };

  const nextId = (prefix: string) => `${prefix}-${now().toString(36)}-${(sequence += 1)}`;
  const iso = () => new Date(now()).toISOString();

  const findConversation = (id: string) => conversations.find((c) => c.id === id) ?? null;

  const appendMessage = (message: ConversationMessage) => {
    messagesById = {
      ...messagesById,
      [message.conversationId]: [...(messagesById[message.conversationId] ?? []), message],
    };
  };

  const replaceMessage = (message: ConversationMessage) => {
    messagesById = {
      ...messagesById,
      [message.conversationId]: (messagesById[message.conversationId] ?? []).map((m) =>
        m.id === message.id ? message : m
      ),
    };
  };

  const touchConversation = (id: string, patch: Partial<ConversationSummary>) => {
    conversations = sortConversationsByRecent(
      conversations.map((c) => (c.id === id ? { ...c, ...patch } : c))
    );
  };

  const setTyping = (id: string, typing: boolean) => {
    typingIds = typing ? [...typingIds.filter((t) => t !== id), id] : typingIds.filter((t) => t !== id);
  };

  /** Delivers `userMessage` and produces the simulated reply. */
  async function deliver(userMessage: ConversationMessage, signal?: AbortSignal): Promise<ConversationMessage> {
    const { conversationId } = userMessage;
    inFlight.add(conversationId);
    setTyping(conversationId, true);
    publish();
    try {
      await wait(replyDelayMs, signal);
      if (options.shouldFail?.(userMessage.content)) {
        throw new ConversationServiceError("SEND_FAILED", "The preview could not deliver this message.");
      }
      replaceMessage({ ...userMessage, status: "complete" });
      const reply: ConversationMessage = {
        id: nextId("msg"),
        conversationId,
        role: "assistant",
        content: MOCK_REPLY_TEXT,
        createdAt: iso(),
        status: "complete",
      };
      appendMessage(reply);
      touchConversation(conversationId, {
        preview: toPreviewExcerpt(reply.content),
        updatedAt: reply.createdAt,
        lastMessageAt: reply.createdAt,
      });
      return reply;
    } catch (error) {
      replaceMessage({ ...userMessage, status: "failed" });
      throw error instanceof ConversationServiceError
        ? error
        : new ConversationServiceError("SEND_FAILED", "The preview could not deliver this message.");
    } finally {
      inFlight.delete(conversationId);
      setTyping(conversationId, false);
      publish();
    }
  }

  return {
    kind: "mock",
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async listConversations() {
      return conversations;
    },
    async getConversation(id) {
      return findConversation(id);
    },
    async listMessages(conversationId) {
      return messagesById[conversationId] ?? [];
    },
    async createConversation({ companionKey }) {
      await wait(createDelayMs);
      const companion = resolveConversationCompanion(companionKey);
      const createdAt = iso();
      const conversation: ConversationSummary = {
        id: nextId("local"),
        companionKey,
        title: `New chat with ${companion.displayName}`,
        preview: "",
        createdAt,
        updatedAt: createdAt,
        lastMessageAt: createdAt,
      };
      const welcome: ConversationMessage = {
        id: nextId("msg"),
        conversationId: conversation.id,
        role: "assistant",
        content: mockWelcomeMessage(companion.displayName),
        createdAt,
        status: "complete",
      };
      conversation.preview = toPreviewExcerpt(welcome.content);
      conversations = sortConversationsByRecent([conversation, ...conversations]);
      messagesById = { ...messagesById, [conversation.id]: [welcome] };
      publish();
      return conversation;
    },
    async sendMessage({ conversationId, content, signal }: SendMessageInput) {
      const text = content.trim();
      if (!text) throw new ConversationServiceError("EMPTY_MESSAGE", "Write a message first.");
      const conversation = findConversation(conversationId);
      if (!conversation) throw new ConversationServiceError("NOT_FOUND", "This conversation isn’t available.");
      if (inFlight.has(conversationId)) {
        throw new ConversationServiceError("BUSY", "Please wait for the current reply.");
      }
      const hadUserMessage = (messagesById[conversationId] ?? []).some((m) => m.role === "user");
      const userMessage: ConversationMessage = {
        id: nextId("msg"),
        conversationId,
        role: "user",
        content: text,
        createdAt: iso(),
        status: "pending",
      };
      appendMessage(userMessage);
      const derived = hadUserMessage ? "" : deriveConversationTitle(text);
      touchConversation(conversationId, {
        ...(derived ? { title: derived } : {}),
        preview: toPreviewExcerpt(text),
        updatedAt: userMessage.createdAt,
        lastMessageAt: userMessage.createdAt,
      });
      return deliver(userMessage, signal);
    },
    async retryMessage(messageId) {
      const message = Object.values(messagesById)
        .flat()
        .find((m) => m.id === messageId);
      if (!message || message.role !== "user" || message.status !== "failed") {
        throw new ConversationServiceError("NOT_FOUND", "There is nothing to retry.");
      }
      if (inFlight.has(message.conversationId)) {
        throw new ConversationServiceError("BUSY", "Please wait for the current reply.");
      }
      const pending = { ...message, status: "pending" as const };
      replaceMessage(pending);
      return deliver(pending);
    },
  };
}
