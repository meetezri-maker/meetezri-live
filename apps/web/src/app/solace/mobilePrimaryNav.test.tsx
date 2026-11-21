import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { buildMemberNavItems } from "./memberNav";
import { getMobilePrimaryNav, isMobileTabActive } from "./mobilePrimaryNav";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

const labels = (enabled: boolean) => getMobilePrimaryNav({ conversationsEnabled: enabled }).tabs.map((t) => t.label);

describe("mobile primary navigation config", () => {
  it("keeps the pre-Conversations bar exactly when the flag is off", () => {
    const nav = getMobilePrimaryNav({ conversationsEnabled: false });
    expect(nav.tabs.map((t) => [t.label, t.path])).toEqual([
      ["Home", "/app/dashboard"],
      ["Talk", "/app/session-lobby"],
      ["Reflect", "/app/progress"],
      ["Journal", "/app/journal"],
    ]);
  });

  it("uses the approved order when enabled: Home, Talk, Conversations, Journal (+ More)", () => {
    expect(labels(true)).toEqual(["Home", "Talk", "Conversations", "Journal"]);
    const paths = getMobilePrimaryNav({ conversationsEnabled: true }).tabs.map((t) => t.path);
    expect(paths).not.toContain("/app/progress");
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("keeps Progress reachable from the More drawer list in both states", () => {
    for (const conversationsEnabled of [true, false]) {
      expect(buildMemberNavItems({ conversationsEnabled }).map((i) => i.path)).toContain("/app/progress");
    }
  });

  it("marks Conversations active on its thread routes; others match exactly", () => {
    expect(isMobileTabActive("/app/conversations", "/app/conversations")).toBe(true);
    expect(isMobileTabActive("/app/conversations", "/app/conversations/abc")).toBe(true);
    expect(isMobileTabActive("/app/journal", "/app/journal")).toBe(true);
    expect(isMobileTabActive("/app/journal", "/app/journal/42")).toBe(false);
  });
});

describe("MobileBottomNav rendering", () => {
  async function renderNav(flag: string, path = "/app/dashboard") {
    vi.resetModules();
    vi.stubEnv("VITE_CONVERSATIONS_ENABLED", flag);
    const { MobileBottomNav } = await import("@/app/components/MobileBottomNav");
    render(
      <MemoryRouter initialEntries={[path]}>
        <MobileBottomNav />
      </MemoryRouter>
    );
  }

  const tabNames = () => {
    const links = screen.getAllByRole("link").map((a) => a.textContent);
    const more = screen.getByRole("button", { name: /open navigation menu/i });
    return [...links, more.textContent];
  };

  it("renders Home, Talk, Conversations, Journal, More when enabled", async () => {
    await renderNav("true");
    expect(tabNames()).toEqual(["Home", "Talk", "Conversations", "Journal", "More"]);
    expect(screen.getByRole("link", { name: "Conversations" })).toHaveAttribute("href", "/app/conversations");
  });

  it("renders the unchanged bar when disabled", async () => {
    await renderNav("");
    expect(tabNames()).toEqual(["Home", "Talk", "Reflect", "Journal", "More"]);
    expect(screen.queryByRole("link", { name: "Conversations" })).toBeNull();
  });

  it("highlights More on Progress when enabled, and Progress opens from the drawer", async () => {
    const user = userEvent.setup();
    await renderNav("true", "/app/progress");
    const more = screen.getByRole("button", { name: /open navigation menu/i });
    expect(more.querySelector(".solace-mobile-nav-tab--active")).not.toBeNull();
    await user.click(more);
    const drawer = await screen.findByRole("navigation", { name: /member navigation/i });
    expect(within(drawer).getByRole("link", { name: "Progress" })).toHaveAttribute("href", "/app/progress");
  });

  it("highlights the Conversations tab on the list route", async () => {
    await renderNav("true", "/app/conversations");
    const tab = screen.getByRole("link", { name: "Conversations" });
    expect(tab.querySelector(".solace-mobile-nav-tab--active")).not.toBeNull();
  });
});
