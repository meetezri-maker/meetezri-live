import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "./AppLayout";

vi.mock("@/app/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "member-1", email: "member@example.test" },
    profile: { full_name: "Member", needs_email_verification: false },
    signOut: vi.fn(),
  }),
}));

vi.mock("@/app/contexts/NotificationsContext", () => ({
  useNotifications: () => ({ unreadCount: 0 }),
}));

// The bar itself is covered by mobilePrimaryNav.test.tsx. Here only AppLayout's decision to mount
// it matters; the stub also avoids Vitest resolving react-router and react-router-dom as separate
// router contexts (Vite dedupes them in the app).
vi.mock("./MobileBottomNav", () => ({
  MobileBottomNav: () => <button type="button">Open navigation menu</button>,
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/app/*" element={<div>Member page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

const bottomNav = () => screen.queryByRole("button", { name: /open navigation menu/i });

describe("AppLayout — mobile bottom nav around Conversations threads", () => {
  it("hides the bottom nav on a full-screen thread and keeps it on the list", () => {
    vi.stubEnv("VITE_CONVERSATIONS_ENABLED", "true");
    const { unmount } = renderAt("/app/conversations/preview-1");
    expect(bottomNav()).toBeNull();
    expect(screen.getByRole("main")).toHaveClass("pb-0");
    unmount();

    renderAt("/app/conversations");
    expect(bottomNav()).not.toBeNull();
  });

  it("restores the bottom nav when navigating from a thread back to the list", async () => {
    vi.stubEnv("VITE_CONVERSATIONS_ENABLED", "true");
    const { Link } = await import("react-router-dom");
    render(
      <MemoryRouter initialEntries={["/app/conversations/preview-1"]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/app/*" element={<Link to="/app/conversations">Back</Link>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(bottomNav()).toBeNull();
    await userEvent.setup().click(screen.getByRole("link", { name: "Back" }));
    expect(await screen.findByRole("button", { name: /open navigation menu/i })).toBeInTheDocument();
  });

  it("hides the global header on mobile only for conversation threads", () => {
    vi.stubEnv("VITE_CONVERSATIONS_ENABLED", "true");
    const { unmount } = renderAt("/app/conversations/preview-1");
    expect(screen.getByRole("banner")).toHaveClass("max-lg:hidden");
    unmount();
    for (const path of ["/app/conversations", "/app/journal", "/app/dashboard", "/app/active-session"]) {
      const view = renderAt(path);
      expect(screen.getByRole("banner")).not.toHaveClass("max-lg:hidden");
      view.unmount();
    }
    vi.stubEnv("VITE_CONVERSATIONS_ENABLED", "");
    renderAt("/app/conversations/preview-1");
    expect(screen.getByRole("banner")).not.toHaveClass("max-lg:hidden");
  });

  it("does not hide the bottom nav for that path when the flag is off", () => {
    vi.stubEnv("VITE_CONVERSATIONS_ENABLED", "");
    renderAt("/app/conversations/preview-1");
    expect(bottomNav()).not.toBeNull();
  });

  it("leaves other routes unchanged: nav on Journal/Progress, none in an active session", () => {
    vi.stubEnv("VITE_CONVERSATIONS_ENABLED", "true");
    for (const path of ["/app/journal", "/app/progress", "/app/session-lobby", "/app/dashboard"]) {
      const { unmount } = renderAt(path);
      expect(bottomNav()).not.toBeNull();
      unmount();
    }
    renderAt("/app/active-session");
    expect(bottomNav()).toBeNull();
  });
});
