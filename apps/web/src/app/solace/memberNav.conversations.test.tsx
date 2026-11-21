import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { buildMemberNavItems, findActiveNavPath, MEMBER_NAV_ITEMS } from "./memberNav";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const paths = (items: { path: string }[]) => items.map((item) => item.path);

describe("member navigation — Conversations flag", () => {
  it("omits Conversations when the flag is off, leaving the previous list unchanged", () => {
    const off = buildMemberNavItems({ conversationsEnabled: false });
    expect(paths(off)).not.toContain("/app/conversations");
    expect(paths(off)).toEqual([
      "/app/dashboard",
      "/app/session-lobby",
      "/app/mood-checkin",
      "/app/journal",
      "/app/habit-tracker",
      "/app/sleep-tracker",
      "/app/brain-health",
      "/app/progress",
      "/app/session-history",
      "/app/wellness-tools",
      "/app/challenges",
      "/app/community",
      "/app/billing",
      "/app/settings/achievements",
      "/app/user-profile",
      "/app/settings",
      "/app/settings/help-support",
    ]);
  });

  it("adds Conversations directly after Talk It Out when the flag is on", () => {
    const on = buildMemberNavItems({ conversationsEnabled: true });
    const off = buildMemberNavItems({ conversationsEnabled: false });
    expect(on).toHaveLength(off.length + 1);
    const index = paths(on).indexOf("/app/conversations");
    expect(on[index - 1].path).toBe("/app/session-lobby");
    expect(on[index]).toMatchObject({ label: "Conversations" });
    expect(paths(on).filter((p) => p !== "/app/conversations")).toEqual(paths(off));
  });

  it("does not include Conversations in the default test build (flag unset)", () => {
    expect(paths(MEMBER_NAV_ITEMS)).not.toContain("/app/conversations");
  });

  it("marks Conversations active only when the flag puts it in the list", () => {
    const on = buildMemberNavItems({ conversationsEnabled: true });
    const off = buildMemberNavItems({ conversationsEnabled: false });
    expect(findActiveNavPath("/app/conversations", on)).toBe("/app/conversations");
    expect(findActiveNavPath("/app/conversations/abc", on)).toBe("/app/conversations");
    expect(findActiveNavPath("/app/conversations", off)).toBeNull();
  });
});

describe("mobile drawer — Conversations flag", () => {
  async function renderDrawer(flag: string) {
    vi.resetModules();
    vi.stubEnv("VITE_CONVERSATIONS_ENABLED", flag);
    const { MobileNavigationDrawer } = await import("@/app/components/MobileNavigationDrawer");
    render(
      <MemoryRouter initialEntries={["/app/dashboard"]}>
        <MobileNavigationDrawer open onOpenChange={() => {}} />
      </MemoryRouter>
    );
    // Dynamic import + Radix portal can be slow on loaded runners.
    return within(await screen.findByRole("navigation", { name: /member navigation/i }, { timeout: 8000 }));
  }

  it("lists Conversations in the drawer when enabled", async () => {
    const nav = await renderDrawer("true");
    const link = nav.getByRole("link", { name: "Conversations" });
    expect(link).toHaveAttribute("href", "/app/conversations");
    // Existing destinations are still present.
    expect(nav.getByRole("link", { name: "Talk It Out" })).toBeInTheDocument();
    expect(nav.getByRole("link", { name: "Help and Support" })).toBeInTheDocument();
  });

  it("does not list Conversations in the drawer when disabled", async () => {
    const nav = await renderDrawer("");
    expect(nav.queryByRole("link", { name: "Conversations" })).toBeNull();
    expect(nav.getByRole("link", { name: "Talk It Out" })).toBeInTheDocument();
  });
});
