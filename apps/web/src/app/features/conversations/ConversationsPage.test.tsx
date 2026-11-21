import { afterEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DESKTOP_QUERY, WIDE_DESKTOP_QUERY } from "./hooks/useMediaQuery";
import { MOCK_REPLY_TEXT } from "./mockConversationService";
import { renderConversations, stubMatchMedia, testService } from "./testUtils";

afterEach(() => {
  vi.unstubAllGlobals();
});

const historyList = () => screen.getByRole("list", { name: "Conversation history" });
const location = () => screen.getByTestId("location").textContent;
// Headroom for slow, shared runners (WSL, CI under load); the flows themselves take well under a second.
const SLOW = { timeout: 8000 };
vi.setConfig({ testTimeout: 20000 });

describe("Conversations list", () => {
  it("renders the header, subtitle, start button, search and the start state", () => {
    renderConversations();
    expect(screen.getByRole("heading", { level: 1, name: "Conversations" })).toBeInTheDocument();
    expect(screen.getByText("Your text chats with Solace.")).toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toHaveAttribute("placeholder", "Search conversations…");
    expect(screen.getByRole("heading", { level: 2, name: "Start a Conversation" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /start a new conversation/i })).toHaveLength(2);
    expect(screen.getByText("Preview")).toBeInTheDocument();
  });

  it("lists conversations most-recent first with companion, preview and dates", () => {
    renderConversations();
    const items = within(historyList()).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveTextContent("A Lighter Mind");
    expect(items[0]).toHaveTextContent("Today");
    expect(items[0]).toHaveTextContent("With Tessa.");
    expect(items[1]).toHaveTextContent("Yesterday");
  });

  it("shows the empty state when there are no conversations", () => {
    renderConversations("/app/conversations", testService({ seeded: false }));
    expect(screen.getByText("No conversations yet")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Conversation history" })).toBeNull();
  });

  it("searches titles case-insensitively and reports no matches", async () => {
    const user = userEvent.setup();
    renderConversations();
    await user.type(screen.getByRole("searchbox"), "HABITS");
    expect(within(historyList()).getAllByRole("listitem")).toHaveLength(1);
    await user.clear(screen.getByRole("searchbox"));
    await user.type(screen.getByRole("searchbox"), "nothing like this");
    expect(screen.getByText(/No conversations match/)).toBeInTheDocument();
  });
});

describe("Conversation threads and routing", () => {
  it("deep links to a thread with the companion header and history", () => {
    renderConversations("/app/conversations/preview-1");
    const thread = screen.getByRole("region", { name: /Conversation with Tessa/ });
    expect(within(thread).getByRole("heading", { level: 2, name: "Tessa" })).toBeInTheDocument();
    expect(within(thread).getByText("Your Solace companion")).toBeInTheDocument();
    expect(within(thread).getByText(/I've been feeling a bit overwhelmed lately/)).toBeInTheDocument();
    expect(within(historyList()).getByRole("link", { name: /A Lighter Mind/ })).toHaveAttribute("aria-current", "page");
  });

  it("switches threads from the history list", async () => {
    const user = userEvent.setup();
    renderConversations("/app/conversations/preview-1");
    await user.click(within(historyList()).getByRole("link", { name: /Managing Overwhelm/ }));
    expect(location()).toBe("/app/conversations/preview-2");
    expect(screen.getByRole("heading", { level: 2, name: "Andre" })).toBeInTheDocument();
  });

  it("shows a safe not-found state for unknown or reset thread ids", async () => {
    const user = userEvent.setup();
    renderConversations("/app/conversations/does-not-exist");
    expect(screen.getByRole("heading", { name: "This conversation isn’t available" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to Conversations" }));
    expect(location()).toBe("/app/conversations");
  });

  it("returns to the list from a thread's back button", async () => {
    const user = userEvent.setup();
    renderConversations("/app/conversations/preview-1");
    await user.click(screen.getByRole("button", { name: "Back to conversations" }));
    expect(location()).toBe("/app/conversations");
  });
});

describe("New conversation flow", () => {
  it("selects a companion, prepares, opens with a welcome and suggested starters", async () => {
    const user = userEvent.setup();
    const service = testService({ createDelayMs: 400 });
    renderConversations("/app/conversations", service);

    await user.click(screen.getAllByRole("button", { name: /start a new conversation/i })[0]);
    const dialog = await screen.findByRole("dialog");
    const names = within(within(dialog).getByRole("list", { name: "Companions" })).getAllByRole("button");
    expect(names.map((b) => b.textContent)).toEqual(["Romy", "Frankie", "Tessa", "Andre", "Bianca", "Damian", "Sasha"]);
    expect(within(dialog).getByRole("button", { name: "Choose a companion" })).toBeDisabled();

    await user.click(within(dialog).getByRole("button", { name: "Tessa" }));
    expect(within(dialog).getByRole("button", { name: "Tessa" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(dialog).getByRole("button", { name: /start chat with tessa/i }));

    expect(await screen.findByText("Preparing your chat…", {}, SLOW)).toBeInTheDocument();
    const thread = await screen.findByRole("region", { name: /Conversation with Tessa/ }, SLOW);
    expect(location()).toMatch(/^\/app\/conversations\/local-/);
    expect(within(thread).getByText(/Hi, I’m Tessa\. I’m here to listen, reflect, and support you\./)).toBeInTheDocument();

    const starters = within(thread).getByRole("group", { name: "Suggested conversation starters" });
    expect(within(starters).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "I’ve been feeling overwhelmed",
      "I want to gain clarity",
      "I just want to talk",
    ]);
    expect(within(historyList()).getAllByRole("listitem")[0]).toHaveTextContent("New chat with Tessa");
  });

  it("fills the composer from a starter without sending it", async () => {
    const user = userEvent.setup();
    const service = testService();
    const created = await service.createConversation({ companionKey: "Maya Chen" });
    renderConversations(`/app/conversations/${created.id}`, service);

    await user.click(screen.getByRole("button", { name: "I want to gain clarity" }));
    expect(screen.getByRole("textbox", { name: "Message Tessa" })).toHaveValue("I want to gain clarity");
    expect(service.getSnapshot().messagesById[created.id]).toHaveLength(1);
  });

  it("sends a message, shows typing, then the simulated reply, and retitles the thread", async () => {
    const user = userEvent.setup();
    const service = testService({ replyDelayMs: 60 });
    const created = await service.createConversation({ companionKey: "Maya Chen" });
    renderConversations(`/app/conversations/${created.id}`, service);

    await user.type(screen.getByRole("textbox", { name: "Message Tessa" }), "Hello from the preview");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText("Tessa is typing…", {}, SLOW)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Message Tessa" })).toHaveValue("");
    expect(await screen.findByText(MOCK_REPLY_TEXT, {}, SLOW)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Tessa is typing…")).toBeNull(), SLOW);

    const log = screen.getByRole("list", { name: "Messages with Tessa" });
    const items = within(log).getAllByRole("listitem");
    expect(items.map((li) => (li.textContent ?? "").includes("You,"))).toEqual([false, true, false]);
    expect(within(items[1]).getByText("Read")).toBeInTheDocument();
    expect(within(historyList()).getAllByRole("listitem")[0]).toHaveTextContent("Hello from the preview");
    expect(screen.queryByRole("group", { name: "Suggested conversation starters" })).toBeNull();
  });

  it("never sends empty or whitespace-only messages", async () => {
    const user = userEvent.setup();
    const service = testService();
    renderConversations("/app/conversations/preview-1", service);
    const before = service.getSnapshot().messagesById["preview-1"].length;
    const box = screen.getByRole("textbox", { name: "Message Tessa" });
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    await user.type(box, "   ");
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    await user.type(box, "{Enter}");
    expect(service.getSnapshot().messagesById["preview-1"]).toHaveLength(before);
  });

  it("sends with Enter, adds a line with Shift+Enter, and blocks rapid duplicate submits", async () => {
    const user = userEvent.setup();
    // Long reply so the first send is still in flight while the member tries again.
    const service = testService({ replyDelayMs: 10_000 });
    const spy = vi.spyOn(service, "sendMessage");
    const { unmount } = renderConversations("/app/conversations/preview-1", service);
    const box = screen.getByRole("textbox", { name: "Message Tessa" });

    await user.type(box, "line one{Shift>}{Enter}{/Shift}line two");
    expect(box).toHaveValue("line one\nline two");
    await user.type(box, "{Enter}");
    await user.type(box, "again{Enter}");
    await user.click(screen.getByRole("button", { name: "Send message" }));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(box).toHaveValue("again");
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    const users = service.getSnapshot().messagesById["preview-1"].filter((m) => m.role === "user");
    expect(users.map((m) => m.content).slice(-1)).toEqual(["line one\nline two"]);
    unmount(); // aborts the pending simulated reply
    await act(async () => {});
  });

  it("shows a failed message with a working retry", async () => {
    const user = userEvent.setup();
    let failures = 1;
    const service = testService({ shouldFail: () => failures-- > 0 });
    renderConversations("/app/conversations/preview-1", service);
    await user.type(screen.getByRole("textbox", { name: "Message Tessa" }), "please fail once{Enter}");
    expect(await screen.findByText("Not sent")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/could not deliver/i);
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.queryByText("Not sent")).toBeNull());
    expect(screen.getAllByText(MOCK_REPLY_TEXT).length).toBeGreaterThan(0);
  });
});

describe("Responsive structure (class contracts; jsdom has no layout)", () => {
  it("mobile: list screen hides the stage, thread screen hides the list", () => {
    const { unmount } = renderConversations("/app/conversations");
    const stageWrap = screen.getByRole("region", { name: "Start a conversation" }).parentElement!;
    expect(stageWrap).toHaveClass("max-lg:hidden");
    unmount();
    renderConversations("/app/conversations/preview-1");
    const list = screen.getByRole("region", { name: "Conversations" });
    expect(list).toHaveClass("max-lg:hidden");
  });

  it("wide desktop keeps the history column open beside the thread", () => {
    stubMatchMedia({ [DESKTOP_QUERY]: true, [WIDE_DESKTOP_QUERY]: true });
    renderConversations("/app/conversations/preview-1");
    expect(screen.getByRole("region", { name: "Conversations" })).not.toHaveClass("lg:hidden");
    expect(screen.getByRole("button", { name: "Hide conversation list" })).toHaveAttribute("aria-expanded", "true");
  });

  it("compact desktop collapses the history column in a thread, with a control to reopen it", async () => {
    const user = userEvent.setup();
    stubMatchMedia({ [DESKTOP_QUERY]: true, [WIDE_DESKTOP_QUERY]: false });
    renderConversations("/app/conversations/preview-1");
    const list = screen.getByRole("region", { name: "Conversations" });
    expect(list).toHaveClass("lg:hidden");
    const toggle = screen.getByRole("button", { name: "Show conversation list" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", list.id);
    await user.click(toggle);
    expect(list).not.toHaveClass("lg:hidden");
    expect(screen.getByRole("button", { name: "Hide conversation list" })).toBeInTheDocument();
  });

  it("tightens the mobile thread chrome on short landscape screens", () => {
    renderConversations("/app/conversations/preview-1");
    const thread = screen.getByRole("region", { name: /Conversation with Tessa/ });
    expect(thread.querySelector("header")).toHaveClass("max-lg:[@media(max-height:480px)]:py-1");
    expect(within(thread).getByText("Your Solace companion")).toHaveClass("max-lg:[@media(max-height:480px)]:hidden");
    expect(thread.parentElement).toHaveClass("max-lg:[@media(max-height:480px)]:[&>section]:rounded-none");
  });

  it("companion selector is a bottom sheet on phones", async () => {
    const user = userEvent.setup();
    renderConversations();
    await user.click(screen.getAllByRole("button", { name: /start a new conversation/i })[0]);
    expect(await screen.findByRole("dialog")).toHaveClass("max-sm:bottom-0", "max-sm:top-auto");
  });
});
