import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Outlet, Route, Routes, useLocation } from "react-router-dom";
import type { SafetyState } from "@/app/types/safety";
import { ConversationServiceProvider } from "../ConversationsServiceContext";
import { ConversationsPage } from "../ConversationsPage";
import { CONVERSATIONS_ROUTE_PATTERN } from "../conversationsFlag";
import { DESKTOP_QUERY } from "../hooks/useMediaQuery";
import { MOCK_REPLY_TEXT } from "../mockConversationService";
import { stubMatchMedia, testService } from "../testUtils";
import { QuickChat } from "./QuickChat";

// Subscribable like the real SafetyContext, so a state change re-renders consumers.
const safety = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  let state = "NORMAL";
  return {
    get: () => state,
    set: (next: string) => {
      state = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});
vi.mock("@/app/contexts/SafetyContext", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useSafety: () => ({ currentState: useSyncExternalStore(safety.subscribe, safety.get, safety.get) }),
  };
});
let safetyState: SafetyState = "NORMAL";

vi.setConfig({ testTimeout: 20000 });
const SLOW = { timeout: 8000 };

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

/** Minimal member shell: page outlet + quick chat, like AppLayout. */
function Shell() {
  return (
    <>
      <nav aria-label="Test pages">
        <Link to="/app/journal">Journal page</Link>
        <Link to="/app/mood-checkin">Mood page</Link>
        <Link to="/app/session-lobby">Talk It Out page</Link>
      </nav>
      <Outlet />
      <QuickChat />
    </>
  );
}

function renderShell(path = "/app/journal", service = testService({ seeded: false })) {
  safety.set(safetyState);
  const ui = (
    <ConversationServiceProvider service={service}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<Shell />}>
            <Route path={CONVERSATIONS_ROUTE_PATTERN} element={<ConversationsPage />} />
            <Route path="/app/*" element={<p>Member page</p>} />
          </Route>
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </ConversationServiceProvider>
  );
  const result = render(ui);
  return { ...result, service, rerenderShell: () => result.rerender(ui) };
}

const launcher = () => screen.queryByRole("button", { name: /^Start a (new )?conversation$/ });
const location = () => screen.getByTestId("location").textContent;

async function startWith(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(launcher()!);
  const dialog = await screen.findByRole("dialog", { name: "Start a Conversation" });
  await user.click(within(dialog).getByRole("button", { name }));
  await user.click(within(dialog).getByRole("button", { name: new RegExp(`start chat with ${name}`, "i") }));
  return screen.findByRole("dialog", { name: `Quick chat with ${name}` }, SLOW);
}

beforeEach(() => {
  safetyState = "NORMAL";
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Quick chat visibility", () => {
  it("shows the launcher on ordinary member pages", () => {
    renderShell("/app/journal");
    expect(launcher()).toBeInTheDocument();
  });

  it.each(["/app/conversations", "/app/session-lobby", "/app/active-session", "/app/emergency-resources", "/app/settings/appearance"])(
    "hides the launcher on %s",
    (path) => {
      renderShell(path);
      expect(launcher()).toBeNull();
    }
  );

  it.each<SafetyState>(["HIGH_RISK", "SAFETY_MODE", "COOLDOWN"])("hides the launcher in %s", (state) => {
    safetyState = state;
    renderShell("/app/journal");
    expect(launcher()).toBeNull();
  });

  it("keeps the launcher during ELEVATED_CONCERN", () => {
    safetyState = "ELEVATED_CONCERN";
    renderShell("/app/journal");
    expect(launcher()).toBeInTheDocument();
  });
});

describe("Quick chat flow (desktop panel)", () => {
  beforeEach(() => stubMatchMedia({ [DESKTOP_QUERY]: true }));

  it("starts with a chosen companion via Preparing, with the welcome and starters", async () => {
    const user = userEvent.setup();
    const service = testService({ seeded: false, createDelayMs: 300 });
    renderShell("/app/journal", service);
    await user.click(launcher()!);
    const dialog = await screen.findByRole("dialog", { name: "Start a Conversation" });
    expect(within(within(dialog).getByRole("list", { name: "Companions" })).getAllByRole("button")).toHaveLength(7);
    await user.click(within(dialog).getByRole("button", { name: "Romy" }));
    await user.click(within(dialog).getByRole("button", { name: /start chat with romy/i }));
    expect(await screen.findByText("Preparing your chat…", {}, SLOW)).toBeInTheDocument();
    const panel = await screen.findByRole("dialog", { name: "Quick chat with Romy" }, SLOW);
    expect(panel).toHaveAttribute("aria-modal", "false");
    expect(within(panel).getByText(/Hi, I’m Romy\./)).toBeInTheDocument();
    expect(within(panel).getByRole("group", { name: "Suggested conversation starters" })).toBeInTheDocument();
    expect(launcher()).toBeNull(); // the panel replaces the launcher while open
  });

  it("minimize → navigate → resume → expand keeps the same thread and messages (shared service)", async () => {
    const user = userEvent.setup();
    const { service } = renderShell();
    let panel = await startWith(user, "Tessa");
    const conversationId = service.getSnapshot().conversations[0].id;

    await user.type(within(panel).getByRole("textbox", { name: "Message Tessa" }), "From quick chat{Enter}");
    expect(await within(panel).findByText(MOCK_REPLY_TEXT, {}, SLOW)).toBeInTheDocument();

    await user.click(within(panel).getByRole("button", { name: "Minimize chat" }));
    expect(screen.queryByRole("dialog", { name: "Quick chat with Tessa" })).toBeNull();
    expect(screen.getByRole("button", { name: "Resume chat with Tessa" })).toBeInTheDocument();
    expect(launcher()).toHaveFocus();

    await user.click(screen.getByRole("link", { name: "Mood page" }));
    expect(location()).toBe("/app/mood-checkin");
    await user.click(screen.getByRole("button", { name: "Resume chat with Tessa" }));
    panel = screen.getByRole("dialog", { name: "Quick chat with Tessa" });
    expect(within(panel).getByText("From quick chat")).toBeInTheDocument();
    expect(within(panel).getByText(MOCK_REPLY_TEXT)).toBeInTheDocument();

    await user.click(within(panel).getByRole("button", { name: "Open in Conversations" }));
    expect(location()).toBe(`/app/conversations/${conversationId}`);
    const page = await screen.findByRole("region", { name: /Conversation with Tessa/ }, SLOW);
    expect(within(page).getByText("From quick chat")).toBeInTheDocument();
    expect(within(page).getByText(MOCK_REPLY_TEXT)).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Quick chat with Tessa" })).toBeNull();
    expect(launcher()).toBeNull(); // hidden on Conversations pages

    await user.click(screen.getByRole("link", { name: "Journal page" }));
    expect(screen.getByRole("button", { name: "Resume chat with Tessa" })).toBeInTheDocument();
  });

  it("Escape minimizes the desktop panel and returns focus to the launcher", async () => {
    const user = userEvent.setup();
    renderShell();
    await startWith(user, "Andre");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Quick chat with Andre" })).toBeNull();
    expect(screen.getByRole("button", { name: "Resume chat with Andre" })).toBeInTheDocument();
    expect(launcher()).toHaveFocus();
  });

  it("closing dismisses the window and chip but keeps the conversation in the list", async () => {
    const user = userEvent.setup();
    const { service } = renderShell();
    const panel = await startWith(user, "Sasha");
    await user.click(within(panel).getByRole("button", { name: "Close chat" }));
    expect(screen.queryByRole("dialog", { name: "Quick chat with Sasha" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Resume chat/ })).toBeNull();
    expect(launcher()).toHaveAccessibleName("Start a conversation");
    expect(service.getSnapshot().conversations.map((c) => c.companionKey)).toEqual(["Sasha"]);
  });

  it("can resume the minimized thread or start a separate new conversation", async () => {
    const user = userEvent.setup();
    const { service } = renderShell();
    let panel = await startWith(user, "Tessa");
    await user.click(within(panel).getByRole("button", { name: "Minimize chat" }));
    expect(launcher()).toHaveAccessibleName("Start a new conversation");

    panel = await startWith(user, "Frankie");
    expect(within(panel).getByText(/Hi, I’m Frankie\./)).toBeInTheDocument();
    expect(service.getSnapshot().conversations.map((c) => c.companionKey)).toEqual(["Alex", "Maya Chen"]);
  });

  it("tucks away when a voice session starts and comes back as a resume chip", async () => {
    const user = userEvent.setup();
    renderShell();
    await startWith(user, "Bianca");
    await user.click(screen.getByRole("link", { name: "Talk It Out page" }));
    expect(screen.queryByRole("dialog", { name: "Quick chat with Bianca" })).toBeNull();
    expect(launcher()).toBeNull();
    await user.click(screen.getByRole("link", { name: "Journal page" }));
    expect(screen.queryByRole("dialog", { name: "Quick chat with Bianca" })).toBeNull();
    expect(screen.getByRole("button", { name: "Resume chat with Bianca" })).toBeInTheDocument();
  });

  it("hides immediately on a safety escalation and preserves the thread", async () => {
    const user = userEvent.setup();
    renderShell();
    await startWith(user, "Damian");
    act(() => safety.set("HIGH_RISK"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Quick chat with Damian" })).toBeNull());
    expect(launcher()).toBeNull();
    act(() => safety.set("NORMAL"));
    expect(await screen.findByRole("button", { name: "Resume chat with Damian" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Quick chat with Damian" })).toBeNull();
  });
});

describe("Quick chat on mobile (bottom sheet)", () => {
  beforeEach(() => stubMatchMedia({ [DESKTOP_QUERY]: false }));

  it("opens as a modal sheet above the bottom nav; Escape minimizes and restores focus", async () => {
    const user = userEvent.setup();
    renderShell();
    const sheet = await startWith(user, "Tessa");
    expect(sheet).toHaveClass("fixed", "bottom-0", "z-[56]", "solace-app");
    expect(document.querySelector(".z-\\[55\\]")).not.toBeNull(); // backdrop above the z-50 bottom nav
    // Modal: content behind the sheet is hidden from assistive tech while it is open.
    expect(screen.getByRole("navigation", { name: "Test pages", hidden: true }).closest("[aria-hidden=true]")).not.toBeNull();
    await waitFor(() => expect(within(sheet).getByRole("textbox", { name: "Message Tessa" })).toHaveFocus());

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Quick chat with Tessa" })).toBeNull());
    expect(screen.getByRole("button", { name: "Resume chat with Tessa" })).toBeInTheDocument();
    await waitFor(() => expect(launcher()).toHaveFocus());
  });

  it("positions the launcher above the bottom navigation", () => {
    renderShell();
    const stack = screen.getByTestId("quick-chat-launcher");
    expect(stack.className).toMatch(/bottom-\[calc\(var\(--solace-mobile-nav-h/);
    expect(stack).toHaveClass("lg:bottom-6", "lg:right-6", "z-40");
  });
});
