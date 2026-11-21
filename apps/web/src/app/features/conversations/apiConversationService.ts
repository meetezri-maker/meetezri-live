/**
 * REAL Conversations service — the authenticated Solace API (`/api/conversations`).
 *
 * Implements the same `ConversationService` contract as the in-memory preview, so the existing
 * Conversations UI is unchanged: components still read one snapshot and call the same methods.
 *
 * - Identity: the Supabase access token is sent as a Bearer header; the API derives the member from
 *   it. Nothing here sends a user id, history, or companion to Ezri — the server decides all three.
 * - Streaming: `sendMessage` reads the API's SSE response (`start`, `status`, `delta`, `done`,
 *   `error`) with fetch + a stream reader (EventSource cannot POST or send auth headers). The reply
 *   grows in place as an assistant message with status "streaming".
 * - Retry: each send carries a `client_message_id`; re-sending a failed message reuses it, which
 *   the API treats as a retry rather than a duplicate.
 * - Welcome line: the greeting shown at the top of a thread is UI copy, never stored or sent to
 *   the companion (the API stores no synthetic messages).
 */
import { resolveConversationCompanion } from "./conversationCompanions";
import { sortConversationsByRecent, toPreviewExcerpt } from "./conversationList";
import {
  ConversationServiceError,
  type ConversationService,
  type ConversationsSnapshot,
  type SendMessageInput,
} from "./conversationService";
import type { ConversationMessage, ConversationSummary } from "./types";

// ---------------------------------------------------------------------------------------------
// Wire types (snake_case, as the API returns them)
// ---------------------------------------------------------------------------------------------

interface ApiSummary {
  id: string;
  companion_key: string;
  title: string;
  preview: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
}

interface ApiMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  status: "pending" | "complete" | "interrupted" | "failed";
  created_at: string;
}

const LIST_LIMIT = 50;
const MESSAGES_LIMIT = 100;

export function welcomeText(displayName: string): string {
  return `Hi, I’m ${displayName}. I’m here to listen, reflect, and support you. What would you like to talk about today?`;
}

const welcomeId = (conversationId: string) => `welcome-${conversationId}`;

function toSummary(row: ApiSummary): ConversationSummary {
  return {
    id: row.id,
    companionKey: row.companion_key,
    title: row.title,
    preview: row.preview,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessageAt: row.last_message_at,
  };
}

function toMessage(row: ApiMessage): ConversationMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
    // A reply that is still in flight elsewhere (another tab) shows as pending; an interrupted
    // assistant row is shown as delivered text.
    status: row.status === "interrupted" ? "complete" : row.status,
  };
}

function welcomeMessage(conversation: ConversationSummary): ConversationMessage {
  return {
    id: welcomeId(conversation.id),
    conversationId: conversation.id,
    role: "assistant",
    content: welcomeText(resolveConversationCompanion(conversation.companionKey).displayName),
    createdAt: conversation.createdAt,
    status: "complete",
  };
}

function newClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // RFC 4122 v4 fallback for very old browsers.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Incremental SSE parser for the API's `event:` / `data:` frames. Comments (`: ping`) are dropped. */
export class SseEventParser {
  private buffer = "";

  push(text: string): Array<{ event: string; data: string }> {
    this.buffer += text.replace(/\r\n/g, "\n");
    const out: Array<{ event: string; data: string }> = [];
    let index: number;
    while ((index = this.buffer.indexOf("\n\n")) >= 0) {
      const frame = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + 2);
      let event = "message";
      const data: string[] = [];
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
      }
      if (data.length) out.push({ event, data: data.join("\n") });
    }
    return out;
  }
}

/** Member-facing text for API error codes returned before streaming starts. */
export function messageForCode(
  code: string | undefined,
  status: number,
  details: { resets_at?: unknown } = {}
): string {
  switch (code) {
    case "REPLY_IN_PROGRESS":
      return "Please wait for the current reply.";
    case "RATE_LIMITED":
      return "You’re sending messages quickly. Please try again shortly.";
    // Phase 5 — plan eligibility and daily allowance (enforced by the API).
    case "TRIAL_EXPIRED":
      return "Your trial has expired. Upgrade your plan to keep chatting.";
    case "SUBSCRIPTION_NOT_ELIGIBLE":
      return "Your membership has ended. Renew your plan to keep chatting.";
    case "PLAN_NOT_ELIGIBLE":
      return "Text chat is unavailable on your current plan.";
    case "DAILY_LIMIT_REACHED": {
      const resets = typeof details.resets_at === "string" ? new Date(details.resets_at) : null;
      const at =
        resets && !Number.isNaN(resets.getTime())
          ? ` It resets at ${resets.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}.`
          : " It resets at midnight.";
      return `You’ve reached your daily chat limit.${at}`;
    }
    case "TOO_MANY_IN_FLIGHT":
      return "Please wait for your other conversations to reply.";
    case "CONVERSATION_NOT_FOUND":
      return "This conversation isn’t available.";
    case "CONVERSATIONS_UNAVAILABLE":
      return "Conversations aren’t available right now. Please try again later.";
    case "DUPLICATE_MESSAGE":
      return "This message was already sent.";
    default:
      return status === 401
        ? "Your session has expired. Please sign in again."
        : "Something went wrong. Please try again.";
  }
}

export interface ApiConversationServiceOptions {
  /** Base path, e.g. "/api". Defaults to `VITE_API_URL` or same-origin "/api". */
  apiBase?: string;
  fetchImpl?: typeof fetch;
  getAccessToken?: () => Promise<string | null | undefined>;
}

export function createApiConversationService(options: ApiConversationServiceOptions = {}): ConversationService {
  const apiBase = (options.apiBase ?? (import.meta.env.VITE_API_URL as string | undefined) ?? "/api").replace(/\/+$/, "");
  const fetchImpl: typeof fetch = options.fetchImpl ?? ((input, init) => fetch(input, init));
  // Loaded lazily so the preview (and its tests) never initialise the Supabase client here.
  const getAccessToken =
    options.getAccessToken ??
    (async () => {
      const { supabase } = await import("@/lib/supabase");
      return (await supabase.auth.getSession()).data.session?.access_token;
    });

  let conversations: ConversationSummary[] = [];
  let messagesById: Record<string, ConversationMessage[]> = {};
  let typingIds: string[] = [];
  let listStatus: NonNullable<ConversationsSnapshot["listStatus"]> = "idle";
  let snapshot: ConversationsSnapshot = { conversations, messagesById, typingIds, listStatus };
  const listeners = new Set<() => void>();
  const inFlight = new Set<string>();
  const messagesLoaded = new Set<string>();
  /** Failed user message id -> the client id to retry it with. */
  const retryIds = new Map<string, { clientMessageId: string; content: string }>();
  let listPromise: Promise<ConversationSummary[]> | null = null;

  const publish = () => {
    snapshot = { conversations, messagesById, typingIds, listStatus };
    listeners.forEach((listener) => listener());
  };

  const upsertConversation = (summary: ConversationSummary) => {
    const others = conversations.filter((c) => c.id !== summary.id);
    conversations = sortConversationsByRecent([summary, ...others]);
  };

  const setMessages = (conversationId: string, list: ConversationMessage[]) => {
    messagesById = { ...messagesById, [conversationId]: list };
  };

  const updateMessages = (conversationId: string, fn: (list: ConversationMessage[]) => ConversationMessage[]) => {
    setMessages(conversationId, fn(messagesById[conversationId] ?? []));
  };

  const setTyping = (id: string, typing: boolean) => {
    typingIds = typing ? [...typingIds.filter((t) => t !== id), id] : typingIds.filter((t) => t !== id);
  };

  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    const token = await getAccessToken();
    const headers: Record<string, string> = { Accept: "application/json", ...(init.headers as Record<string, string>) };
    if (init.body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetchImpl(`${apiBase}${path}`, { ...init, headers });
  }

  async function readJson<T>(res: Response): Promise<T> {
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { code?: string };
      const code = res.status === 404 ? "NOT_FOUND" : "SEND_FAILED";
      throw new ConversationServiceError(code, messageForCode(body.code, res.status));
    }
    return (await res.json()) as T;
  }

  async function fetchConversation(id: string): Promise<ConversationSummary | null> {
    const res = await request(`/conversations/${encodeURIComponent(id)}`);
    if (res.status === 404 || res.status === 400) return null;
    const summary = toSummary(await readJson<ApiSummary>(res));
    upsertConversation(summary);
    publish();
    return summary;
  }

  async function streamTurn(
    conversationId: string,
    content: string,
    clientMessageId: string,
    localUserId: string,
    signal?: AbortSignal
  ): Promise<ConversationMessage> {
    inFlight.add(conversationId);
    setTyping(conversationId, true);
    publish();

    let userMessageId = localUserId;
    let streamingId: string | null = null;

    const failUser = () => {
      updateMessages(conversationId, (list) =>
        list
          .filter((m) => m.id !== streamingId)
          .map((m) => (m.id === userMessageId ? { ...m, status: "failed" as const } : m))
      );
      retryIds.set(userMessageId, { clientMessageId, content });
    };

    try {
      let res: Response;
      try {
        res = await request(`/conversations/${encodeURIComponent(conversationId)}/messages`, {
          method: "POST",
          headers: { Accept: "text/event-stream" },
          body: JSON.stringify({ content, client_message_id: clientMessageId }),
          signal,
        });
      } catch {
        failUser();
        if (signal?.aborted) throw new ConversationServiceError("ABORTED", "Cancelled");
        throw new ConversationServiceError("SEND_FAILED", "Couldn’t reach Solace. Check your connection and try again.");
      }

      if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/event-stream")) {
        const body = (await res.json().catch(() => ({}))) as { code?: string; resets_at?: unknown };
        failUser();
        if (body.code === "REPLY_IN_PROGRESS") {
          throw new ConversationServiceError("BUSY", messageForCode(body.code, res.status));
        }
        throw new ConversationServiceError(
          res.status === 404 ? "NOT_FOUND" : "SEND_FAILED",
          messageForCode(body.code, res.status, body)
        );
      }
      if (!res.body) {
        failUser();
        throw new ConversationServiceError("SEND_FAILED", "Something went wrong. Please try again.");
      }

      const parser = new SseEventParser();
      const decoder = new TextDecoder();
      const reader = res.body.getReader();
      let finalReply: ConversationMessage | null = null;
      let streamError: string | null = null;

      try {
        while (!finalReply && !streamError) {
          const { value, done } = await reader.read();
          if (done) break;
          for (const { event, data } of parser.push(decoder.decode(value, { stream: true }))) {
            let payload: any;
            try {
              payload = JSON.parse(data);
            } catch {
              continue;
            }
            if (event === "start" && payload?.user_message) {
              const stored = toMessage(payload.user_message as ApiMessage);
              updateMessages(conversationId, (list) => list.map((m) => (m.id === userMessageId ? stored : m)));
              userMessageId = stored.id;
            } else if (event === "delta" && typeof payload?.text === "string") {
              if (!streamingId) {
                streamingId = `streaming-${clientMessageId}`;
                updateMessages(conversationId, (list) => [
                  ...list,
                  {
                    id: streamingId as string,
                    conversationId,
                    role: "assistant",
                    content: payload.text,
                    createdAt: new Date().toISOString(),
                    status: "streaming",
                  },
                ]);
                setTyping(conversationId, false);
              } else {
                updateMessages(conversationId, (list) =>
                  list.map((m) => (m.id === streamingId ? { ...m, content: m.content + payload.text } : m))
                );
              }
            } else if (event === "done" && payload?.assistant_message) {
              const user = toMessage(payload.user_message as ApiMessage);
              const reply = toMessage(payload.assistant_message as ApiMessage);
              updateMessages(conversationId, (list) => {
                const withoutStream = list.filter((m) => m.id !== streamingId);
                return [...withoutStream.map((m) => (m.id === userMessageId ? user : m)), reply];
              });
              userMessageId = user.id;
              finalReply = reply;
            } else if (event === "error") {
              streamError = typeof payload?.message === "string" ? payload.message : "Something went wrong. Please try again.";
            }
            // `status` events are transient filler ("Let me check…"); the typing indicator covers them.
            publish();
            if (finalReply || streamError) break;
          }
        }
      } catch {
        failUser();
        if (signal?.aborted) throw new ConversationServiceError("ABORTED", "Cancelled");
        throw new ConversationServiceError("SEND_FAILED", "The reply was interrupted. Please try again.");
      } finally {
        if (!finalReply) await reader.cancel().catch(() => undefined);
      }

      if (!finalReply) {
        failUser();
        if (signal?.aborted) throw new ConversationServiceError("ABORTED", "Cancelled");
        throw new ConversationServiceError("SEND_FAILED", streamError ?? "The reply was interrupted. Please try again.");
      }

      const reply: ConversationMessage = finalReply;
      const current = conversations.find((c) => c.id === conversationId);
      if (current) {
        upsertConversation({
          ...current,
          preview: toPreviewExcerpt(reply.content),
          updatedAt: reply.createdAt,
          lastMessageAt: reply.createdAt,
        });
      }
      // The server may have set the title from the first message; refresh quietly.
      void fetchConversation(conversationId).catch(() => undefined);
      return reply;
    } finally {
      inFlight.delete(conversationId);
      setTyping(conversationId, false);
      publish();
    }
  }

  return {
    kind: "api",
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async listConversations() {
      if (listPromise) return listPromise;
      listStatus = "loading";
      publish();
      listPromise = (async () => {
        try {
          const res = await request(`/conversations?limit=${LIST_LIMIT}`);
          const body = await readJson<{ items: ApiSummary[] }>(res);
          // Keep anything created locally while the list was loading.
          const loaded = body.items.map(toSummary);
          const loadedIds = new Set(loaded.map((c) => c.id));
          conversations = sortConversationsByRecent([...loaded, ...conversations.filter((c) => !loadedIds.has(c.id))]);
          listStatus = "ready";
          return conversations;
        } catch (error) {
          listStatus = "error";
          listPromise = null; // allow a later retry
          throw error;
        } finally {
          publish();
        }
      })();
      return listPromise;
    },

    async getConversation(id) {
      const known = conversations.find((c) => c.id === id);
      if (known) return known;
      return fetchConversation(id);
    },

    async listMessages(conversationId) {
      if (messagesLoaded.has(conversationId) || inFlight.has(conversationId)) {
        return messagesById[conversationId] ?? [];
      }
      const conversation = conversations.find((c) => c.id === conversationId) ?? (await fetchConversation(conversationId));
      if (!conversation) throw new ConversationServiceError("NOT_FOUND", "This conversation isn’t available.");
      const res = await request(`/conversations/${encodeURIComponent(conversationId)}/messages?limit=${MESSAGES_LIMIT}`);
      const body = await readJson<{ items: ApiMessage[] }>(res);
      const stored = body.items.map(toMessage);
      // Older pages are not loaded yet (the thread shows the latest 100); the welcome line only
      // belongs above the true start of a thread.
      const list = body.items.length < MESSAGES_LIMIT ? [welcomeMessage(conversation), ...stored] : stored;
      messagesLoaded.add(conversationId);
      // Anything appended locally during the fetch (an in-flight send) stays.
      const existing = messagesById[conversationId] ?? [];
      const storedIds = new Set(list.map((m) => m.id));
      setMessages(conversationId, [...list, ...existing.filter((m) => !storedIds.has(m.id) && m.id !== welcomeId(conversationId))]);
      publish();
      return messagesById[conversationId];
    },

    async createConversation({ companionKey }) {
      const res = await request("/conversations", {
        method: "POST",
        body: JSON.stringify({ companion_key: companionKey }),
      });
      const summary = toSummary(await readJson<ApiSummary>(res));
      upsertConversation(summary);
      setMessages(summary.id, [welcomeMessage(summary)]);
      messagesLoaded.add(summary.id);
      publish();
      return summary;
    },

    async sendMessage({ conversationId, content, signal }: SendMessageInput) {
      const text = content.trim();
      if (!text) throw new ConversationServiceError("EMPTY_MESSAGE", "Write a message first.");
      if (!conversations.some((c) => c.id === conversationId)) {
        throw new ConversationServiceError("NOT_FOUND", "This conversation isn’t available.");
      }
      if (inFlight.has(conversationId)) {
        throw new ConversationServiceError("BUSY", "Please wait for the current reply.");
      }
      const clientMessageId = newClientId();
      const localId = `local-${clientMessageId}`;
      const now = new Date().toISOString();
      updateMessages(conversationId, (list) => [
        ...list,
        { id: localId, conversationId, role: "user", content: text, createdAt: now, status: "pending" },
      ]);
      const current = conversations.find((c) => c.id === conversationId);
      if (current) upsertConversation({ ...current, preview: toPreviewExcerpt(text), updatedAt: now, lastMessageAt: now });
      publish();
      return streamTurn(conversationId, text, clientMessageId, localId, signal);
    },

    async retryMessage(messageId) {
      const retry = retryIds.get(messageId);
      const message = Object.values(messagesById)
        .flat()
        .find((m) => m.id === messageId);
      if (!retry || !message || message.role !== "user" || message.status !== "failed") {
        throw new ConversationServiceError("NOT_FOUND", "There is nothing to retry.");
      }
      if (inFlight.has(message.conversationId)) {
        throw new ConversationServiceError("BUSY", "Please wait for the current reply.");
      }
      retryIds.delete(messageId);
      updateMessages(message.conversationId, (list) =>
        list.map((m) => (m.id === messageId ? { ...m, status: "pending" as const } : m))
      );
      publish();
      return streamTurn(message.conversationId, retry.content, retry.clientMessageId, messageId);
    },
  };
}
