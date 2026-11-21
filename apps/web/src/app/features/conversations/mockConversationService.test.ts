import { describe, expect, it, vi } from "vitest";
import { ConversationServiceError } from "./conversationService";
import { createMockConversationService, MOCK_REPLY_TEXT } from "./mockConversationService";
import { buildPreviewSeed } from "./mocks/previewConversations";

const fast = (extra: Parameters<typeof createMockConversationService>[0] = {}) =>
  createMockConversationService({ createDelayMs: 0, replyDelayMs: 0, ...extra });

describe("mock conversation service", () => {
  it("creates a conversation with the companion's identity and a preview welcome", async () => {
    const service = fast();
    const created = await service.createConversation({ companionKey: "Maya Chen" });
    expect(created.companionKey).toBe("Maya Chen");
    expect(created.title).toBe("New chat with Tessa");
    const [welcome] = await service.listMessages(created.id);
    expect(welcome.role).toBe("assistant");
    expect(welcome.content).toMatch(/^Hi, I’m Tessa\./);
    expect(service.getSnapshot().conversations[0].id).toBe(created.id);
  });

  it("appends the user message then a fixed simulated reply, in order", async () => {
    const service = fast();
    const { id } = await service.createConversation({ companionKey: "Alex" });
    const reply = await service.sendMessage({ conversationId: id, content: "  Hello there  " });
    const messages = service.getSnapshot().messagesById[id];
    expect(messages.map((m) => m.role)).toEqual(["assistant", "user", "assistant"]);
    expect(messages[1]).toMatchObject({ content: "Hello there", status: "complete" });
    expect(reply.content).toBe(MOCK_REPLY_TEXT);
    expect(reply.content).toMatch(/simulated preview reply/i);
  });

  it("titles the conversation from the first user message only", async () => {
    const service = fast();
    const { id } = await service.createConversation({ companionKey: "Alex" });
    await service.sendMessage({ conversationId: id, content: "work has been a lot this week" });
    await service.sendMessage({ conversationId: id, content: "something else entirely" });
    expect((await service.getConversation(id))?.title).toBe("Work has been a lot this week");
  });

  it("rejects empty and whitespace-only messages without storing them", async () => {
    const service = fast();
    const { id } = await service.createConversation({ companionKey: "Alex" });
    await expect(service.sendMessage({ conversationId: id, content: "   \n " })).rejects.toMatchObject({
      code: "EMPTY_MESSAGE",
    });
    expect(service.getSnapshot().messagesById[id]).toHaveLength(1);
  });

  it("rejects a second send while a reply is in flight (duplicate submission)", async () => {
    const service = createMockConversationService({ createDelayMs: 0, replyDelayMs: 20 });
    const { id } = await service.createConversation({ companionKey: "Alex" });
    const first = service.sendMessage({ conversationId: id, content: "one" });
    await expect(service.sendMessage({ conversationId: id, content: "two" })).rejects.toMatchObject({ code: "BUSY" });
    await first;
    expect(service.getSnapshot().messagesById[id].filter((m) => m.role === "user")).toHaveLength(1);
  });

  it("reports typing while the simulated reply is pending", async () => {
    const service = createMockConversationService({ createDelayMs: 0, replyDelayMs: 20 });
    const { id } = await service.createConversation({ companionKey: "Alex" });
    const pending = service.sendMessage({ conversationId: id, content: "hi" });
    expect(service.getSnapshot().typingIds).toContain(id);
    await pending;
    expect(service.getSnapshot().typingIds).not.toContain(id);
  });

  it("cancels on abort: no reply, the message is marked failed", async () => {
    const service = createMockConversationService({ createDelayMs: 0, replyDelayMs: 50 });
    const { id } = await service.createConversation({ companionKey: "Alex" });
    const controller = new AbortController();
    const pending = service.sendMessage({ conversationId: id, content: "hi", signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "ABORTED" });
    const messages = service.getSnapshot().messagesById[id];
    expect(messages.at(-1)).toMatchObject({ role: "user", status: "failed" });
  });

  it("marks failures and retries them in place", async () => {
    let failures = 1;
    const service = fast({ shouldFail: () => failures-- > 0 });
    const { id } = await service.createConversation({ companionKey: "Alex" });
    await expect(service.sendMessage({ conversationId: id, content: "hi" })).rejects.toBeInstanceOf(
      ConversationServiceError
    );
    const failed = service.getSnapshot().messagesById[id].at(-1)!;
    expect(failed.status).toBe("failed");
    await service.retryMessage(failed.id);
    const messages = service.getSnapshot().messagesById[id];
    expect(messages.filter((m) => m.role === "user")).toHaveLength(1);
    expect(messages.at(-2)).toMatchObject({ id: failed.id, status: "complete" });
    expect(messages.at(-1)?.role).toBe("assistant");
  });

  it("keeps conversations independent and orders by most recent activity", async () => {
    let clock = 1_000_000;
    const service = fast({ now: () => (clock += 1000) });
    const a = await service.createConversation({ companionKey: "Alex" });
    const b = await service.createConversation({ companionKey: "Bianca" });
    await service.sendMessage({ conversationId: a.id, content: "for A" });
    const snap = service.getSnapshot();
    expect(snap.conversations.map((c) => c.id)).toEqual([a.id, b.id]);
    expect(snap.messagesById[b.id]).toHaveLength(1);
    expect(snap.messagesById[a.id].some((m) => m.content === "for A")).toBe(true);
  });

  it("notifies subscribers and returns not-found for unknown ids", async () => {
    const service = fast({ seed: buildPreviewSeed() });
    const listener = vi.fn();
    service.subscribe(listener);
    await service.createConversation({ companionKey: "Sasha" });
    expect(listener).toHaveBeenCalled();
    expect(await service.getConversation("nope")).toBeNull();
    await expect(service.sendMessage({ conversationId: "nope", content: "x" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
