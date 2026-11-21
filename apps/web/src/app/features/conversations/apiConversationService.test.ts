/**
 * API conversation service — mocked fetch only (no network, no AI, no Supabase).
 */
import { describe, expect, it, vi } from "vitest";
import { createApiConversationService, messageForCode, SseEventParser, welcomeText } from "./apiConversationService";
import { ConversationServiceError } from "./conversationService";

const CONV = "11111111-1111-4111-8111-111111111111";
const T0 = "2026-11-20T10:00:00.000Z";

const summary = (overrides: Record<string, unknown> = {}) => ({
  id: CONV,
  companion_key: "Sara Mitchell",
  title: "New chat with Romy",
  preview: "",
  created_at: T0,
  updated_at: T0,
  last_message_at: T0,
  ...overrides,
});

const apiMessage = (id: string, role: "user" | "assistant", content: string, status = "complete") => ({
  id,
  conversation_id: CONV,
  role,
  content,
  status,
  created_at: T0,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function sse(frames: string[], opts: { hang?: boolean } = {}) {
  const encoder = new TextEncoder();
  let i = 0;
  return new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        if (i < frames.length) controller.enqueue(encoder.encode(frames[i++]));
        else if (opts.hang) return new Promise(() => undefined);
        else controller.close();
      },
    }),
    { status: 200, headers: { "Content-Type": "text/event-stream; charset=utf-8" } }
  );
}

const ev = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

function setup(handlers: Record<string, Handler | Handler[]>) {
  const calls: Array<{ key: string; url: string; init: RequestInit }> = [];
  const queues = new Map<string, Handler[]>(
    Object.entries(handlers).map(([k, v]) => [k, Array.isArray(v) ? [...v] : [v]])
  );
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const path = url.replace("https://api.example/api", "").split("?")[0];
    const key = `${init.method ?? "GET"} ${path}`;
    calls.push({ key, url, init });
    const queue = queues.get(key);
    if (!queue?.length) throw new Error(`unexpected request ${key}`);
    const handler = queue.length > 1 ? queue.shift()! : queue[0];
    return handler(url, init);
  });
  const service = createApiConversationService({
    apiBase: "https://api.example/api/",
    fetchImpl: fetchImpl as unknown as typeof fetch,
    getAccessToken: async () => "token-123",
  });
  return { service, calls, fetchImpl };
}

describe("SseEventParser", () => {
  it("parses event/data frames split across chunks and drops comments", () => {
    const parser = new SseEventParser();
    expect(parser.push("event: del")).toEqual([]);
    expect(parser.push('ta\ndata: {"text":"Hi"}\n\n: ping\n\nevent: done\r\ndata: {}\r\n\r\n')).toEqual([
      { event: "delta", data: '{"text":"Hi"}' },
      { event: "done", data: "{}" },
    ]);
  });
});

describe("createApiConversationService", () => {
  it("is labelled as the real service and starts idle", () => {
    const { service } = setup({});
    expect(service.kind).toBe("api");
    expect(service.getSnapshot().listStatus).toBe("idle");
  });

  it("lists conversations with the bearer token and maps them to UI types", async () => {
    const { service, calls } = setup({
      "GET /conversations": () => json({ items: [summary({ preview: "latest" })], next_cursor: null }),
    });
    const list = await service.listConversations();
    expect(list).toEqual([
      {
        id: CONV,
        companionKey: "Sara Mitchell",
        title: "New chat with Romy",
        preview: "latest",
        createdAt: T0,
        updatedAt: T0,
        lastMessageAt: T0,
      },
    ]);
    expect(service.getSnapshot().listStatus).toBe("ready");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer token-123");
    // Concurrent callers share one request.
    await service.listConversations();
    expect(calls).toHaveLength(1);
  });

  it("reports a list failure and allows a retry", async () => {
    const { service } = setup({
      "GET /conversations": [() => json({ code: "X" }, 500), () => json({ items: [] })],
    });
    await expect(service.listConversations()).rejects.toBeInstanceOf(ConversationServiceError);
    expect(service.getSnapshot().listStatus).toBe("error");
    await expect(service.listConversations()).resolves.toEqual([]);
  });

  it("creates a conversation with the canonical companion key and shows the welcome line", async () => {
    const { service, calls } = setup({ "POST /conversations": () => json(summary(), 201) });
    const created = await service.createConversation({ companionKey: "Sara Mitchell" });
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ companion_key: "Sara Mitchell" });
    const messages = service.getSnapshot().messagesById[created.id];
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ role: "assistant", content: welcomeText("Romy"), status: "complete" });
  });

  it("loads a thread's saved messages under the welcome line", async () => {
    const { service } = setup({
      "GET /conversations": () => json({ items: [summary()] }),
      [`GET /conversations/${CONV}/messages`]: () =>
        json({ items: [apiMessage("m1", "user", "hi"), apiMessage("m2", "assistant", "Hello.")], next_before: null }),
    });
    await service.listConversations();
    const messages = await service.listMessages(CONV);
    expect(messages.map((m) => m.content)).toEqual([welcomeText("Romy"), "hi", "Hello."]);
  });

  it("fetches a deep-linked conversation that is not in the loaded list", async () => {
    const { service } = setup({ [`GET /conversations/${CONV}`]: () => json(summary({ title: "Deep" })) });
    await expect(service.getConversation(CONV)).resolves.toMatchObject({ id: CONV, title: "Deep" });
    expect(service.getSnapshot().conversations.map((c) => c.id)).toEqual([CONV]);
  });

  it("returns null for an unknown deep link", async () => {
    const { service } = setup({ [`GET /conversations/${CONV}`]: () => json({ code: "CONVERSATION_NOT_FOUND" }, 404) });
    await expect(service.getConversation(CONV)).resolves.toBeNull();
  });

  describe("sendMessage (streaming)", () => {
    async function ready(send: Handler | Handler[]) {
      const ctx = setup({
        "POST /conversations": () => json(summary(), 201),
        [`POST /conversations/${CONV}/messages`]: send,
        [`GET /conversations/${CONV}`]: () => json(summary({ title: "Trouble sleeping" })),
      });
      await ctx.service.createConversation({ companionKey: "Sara Mitchell" });
      return ctx;
    }

    it("streams a reply into a growing 'streaming' message, then stores both messages", async () => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      const encoder = new TextEncoder();
      const frames = [
        ev("start", { user_message: apiMessage("u1", "user", "I can't sleep", "pending") }),
        ev("status", { text: "Let me check." }),
        ev("delta", { text: "That sounds" }),
        ev("delta", { text: " exhausting." }),
      ];
      const { service, calls } = await ready(() => {
        let step = 0;
        return new Response(
          new ReadableStream<Uint8Array>({
            async pull(controller) {
              if (step < frames.length) {
                controller.enqueue(encoder.encode(frames[step++]));
                return;
              }
              await gate;
              controller.enqueue(
                encoder.encode(
                  ev("done", {
                    user_message: apiMessage("u1", "user", "I can't sleep"),
                    assistant_message: apiMessage("a1", "assistant", "That sounds exhausting."),
                  })
                )
              );
              controller.close();
            },
          }),
          { status: 200, headers: { "Content-Type": "text/event-stream" } }
        );
      });

      const sending = service.sendMessage({ conversationId: CONV, content: "  I can't sleep  " });

      // Mid-stream: the user message is stored (server id) and the reply is growing.
      await vi.waitFor(() => {
        const list = service.getSnapshot().messagesById[CONV];
        expect(list[list.length - 1]).toMatchObject({ role: "assistant", content: "That sounds exhausting.", status: "streaming" });
      });
      expect(service.getSnapshot().messagesById[CONV].find((m) => m.role === "user")).toMatchObject({ id: "u1", status: "pending" });
      expect(service.getSnapshot().typingIds).toEqual([]);

      release();
      const reply = await sending;
      expect(reply).toMatchObject({ id: "a1", status: "complete" });
      const list = service.getSnapshot().messagesById[CONV];
      expect(list.map((m) => [m.id, m.status])).toEqual([
        [`welcome-${CONV}`, "complete"],
        ["u1", "complete"],
        ["a1", "complete"],
      ]);
      expect(service.getSnapshot().conversations[0].preview).toBe("That sounds exhausting.");

      // Only content + client id go to the API — never a user id, history, or companion.
      const body = JSON.parse(String(calls.find((c) => c.key.startsWith("POST /conversations/"))!.init.body));
      expect(Object.keys(body).sort()).toEqual(["client_message_id", "content"]);
      expect(body.content).toBe("I can't sleep");
      expect(body.client_message_id).toMatch(/^[0-9a-f-]{36}$/);

      // The server-derived title is picked up afterwards.
      await vi.waitFor(() => expect(service.getSnapshot().conversations[0].title).toBe("Trouble sleeping"));
    });

    it("marks the message failed on an error event and retries it with the same client id", async () => {
      const { service, calls } = await ready([
        () =>
          sse([
            ev("start", { user_message: apiMessage("u1", "user", "hello", "pending") }),
            ev("delta", { text: "Part" }),
            ev("error", { code: "REPLY_FAILED", message: "Your companion couldn’t reply just now. Please try again." }),
          ]),
        () =>
          sse([
            ev("start", { user_message: apiMessage("u2", "user", "hello", "pending") }),
            ev("delta", { text: "Hi!" }),
            ev("done", {
              user_message: apiMessage("u2", "user", "hello"),
              assistant_message: apiMessage("a2", "assistant", "Hi!"),
            }),
          ]),
      ]);

      const error = await service.sendMessage({ conversationId: CONV, content: "hello" }).catch((e) => e);
      expect(error).toBeInstanceOf(ConversationServiceError);
      expect(error.message).toBe("Your companion couldn’t reply just now. Please try again.");
      let list = service.getSnapshot().messagesById[CONV];
      expect(list.map((m) => [m.id, m.status])).toEqual([
        [`welcome-${CONV}`, "complete"],
        ["u1", "failed"],
      ]); // partial reply removed

      await service.retryMessage("u1");
      list = service.getSnapshot().messagesById[CONV];
      expect(list.map((m) => [m.id, m.status])).toEqual([
        [`welcome-${CONV}`, "complete"],
        ["u2", "complete"],
        ["a2", "complete"],
      ]);
      const sends = calls.filter((c) => c.key === `POST /conversations/${CONV}/messages`);
      const ids = sends.map((c) => JSON.parse(String(c.init.body)).client_message_id);
      expect(ids[0]).toBe(ids[1]);
    });

    it("treats a stream that ends without done as a failure", async () => {
      const { service } = await ready(() => sse([ev("start", { user_message: apiMessage("u1", "user", "x", "pending") })]));
      await expect(service.sendMessage({ conversationId: CONV, content: "x" })).rejects.toMatchObject({ code: "SEND_FAILED" });
      expect(service.getSnapshot().messagesById[CONV].find((m) => m.id === "u1")?.status).toBe("failed");
    });

    it.each([
      [409, "REPLY_IN_PROGRESS", "BUSY"],
      [429, "RATE_LIMITED", "SEND_FAILED"],
      [503, "CONVERSATIONS_UNAVAILABLE", "SEND_FAILED"],
      [404, "CONVERSATION_NOT_FOUND", "NOT_FOUND"],
    ])("maps a %i %s response to %s and fails the message", async (status, code, expected) => {
      const { service } = await ready(() => json({ statusCode: status, code, message: "x" }, status));
      await expect(service.sendMessage({ conversationId: CONV, content: "hello" })).rejects.toMatchObject({ code: expected });
      const user = service.getSnapshot().messagesById[CONV].find((m) => m.role === "user");
      expect(user?.status).toBe("failed");
    });

    it.each([
      [403, "TRIAL_EXPIRED", "Your trial has expired. Upgrade your plan to keep chatting."],
      [403, "SUBSCRIPTION_NOT_ELIGIBLE", "Your membership has ended. Renew your plan to keep chatting."],
      [403, "PLAN_NOT_ELIGIBLE", "Text chat is unavailable on your current plan."],
      [429, "RATE_LIMITED", "You’re sending messages quickly. Please try again shortly."],
      [429, "TOO_MANY_IN_FLIGHT", "Please wait for your other conversations to reply."],
    ])("shows a clear message for %i %s (Phase 5)", async (status, code, message) => {
      const { service } = await ready(() => json({ statusCode: status, code, message: "server text" }, status));
      await expect(service.sendMessage({ conversationId: CONV, content: "hello" })).rejects.toMatchObject({
        code: "SEND_FAILED",
        message,
      });
    });

    it("shows the daily limit with its local reset time", async () => {
      const { service } = await ready(() =>
        json({ statusCode: 429, code: "DAILY_LIMIT_REACHED", message: "x", limit: 20, resets_at: "2026-11-21T13:00:00.000Z" }, 429)
      );
      const error = await service.sendMessage({ conversationId: CONV, content: "hello" }).catch((e) => e);
      expect(error.message).toMatch(/^You’ve reached your daily chat limit\. It resets at .+\.$/);
      expect(messageForCode("DAILY_LIMIT_REACHED", 429)).toBe("You’ve reached your daily chat limit. It resets at midnight.");
    });

    it("blocks a second send while a reply is in flight, and empty messages", async () => {
      const { service } = await ready(() => sse([], { hang: true }));
      void service.sendMessage({ conversationId: CONV, content: "first" }).catch(() => undefined);
      await expect(service.sendMessage({ conversationId: CONV, content: "second" })).rejects.toMatchObject({ code: "BUSY" });
      await expect(service.sendMessage({ conversationId: CONV, content: "   " })).rejects.toMatchObject({ code: "EMPTY_MESSAGE" });
    });

    it("cancels on abort and reports ABORTED", async () => {
      const controller = new AbortController();
      const { service } = await ready((_url, init) => {
        return new Promise<Response>((_resolve, reject) => {
          const fail = () => reject(new DOMException("aborted", "AbortError"));
          if (init.signal?.aborted) fail();
          else init.signal?.addEventListener("abort", fail);
        });
      });
      const sending = service.sendMessage({ conversationId: CONV, content: "hello", signal: controller.signal });
      controller.abort();
      await expect(sending).rejects.toMatchObject({ code: "ABORTED" });
    });
  });
});
