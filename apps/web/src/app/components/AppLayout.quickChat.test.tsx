import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("@/app/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "member-1" }, profile: { needs_email_verification: false }, signOut: vi.fn() }),
}));
vi.mock("@/app/contexts/NotificationsContext", () => ({
  useNotifications: () => ({ unreadCount: 0 }),
}));
vi.mock("./MobileBottomNav", () => ({ MobileBottomNav: () => null }));
// Stand-in: this file checks only whether AppLayout mounts quick chat (behaviour is in QuickChat.test.tsx).
vi.mock("@/app/features/conversations/quick-chat/QuickChat", () => ({
  QuickChat: ({ compactNav }: { compactNav?: boolean }) => <div data-testid="quick-chat" data-compact={String(compactNav)} />,
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function renderLayout(flag: string) {
  vi.resetModules();
  vi.stubEnv("VITE_CONVERSATIONS_ENABLED", flag);
  const { AppLayout } = await import("./AppLayout");
  render(
    <MemoryRouter initialEntries={["/app/journal"]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/app/*" element={<div>Member page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("AppLayout — quick chat mount", () => {
  it("mounts quick chat (lazily) when Conversations is enabled", async () => {
    await renderLayout("true");
    expect(await screen.findByTestId("quick-chat", {}, { timeout: 8000 })).toHaveAttribute("data-compact", "false");
  });

  it("mounts nothing when Conversations is disabled", async () => {
    await renderLayout("");
    expect(screen.getByText("Member page")).toBeInTheDocument();
    expect(screen.queryByTestId("quick-chat")).toBeNull();
  });
});
