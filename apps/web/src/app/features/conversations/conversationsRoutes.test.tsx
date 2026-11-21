import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/app/components/ProtectedRoute";
import { getConversationsRouteElements } from "./conversationsRoutes";
import { isConversationThreadPath } from "./conversationsFlag";

let authState: Record<string, unknown>;

vi.mock("@/app/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

function signedIn() {
  return {
    user: { id: "member-1", email_confirmed_at: "2026-06-20T00:00:00Z" },
    profile: {
      onboarding_completed: true,
      signup_type: "plan",
      subscription_plan: "core",
      email_verified: true,
      role: "user",
    },
    profileStatus: "ready",
    isLoading: false,
    hasRole: () => true,
    signOut: vi.fn(),
    refreshProfile: vi.fn(),
  };
}

/** Mirrors the App.tsx structure: ProtectedRoute → member routes → `/app/*` fallback. */
function renderApp(enabled: boolean, path = "/app/conversations") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        <Route
          element={
            <Suspense fallback={<div>Loading</div>}>
              <ProtectedRoute>
                <Outlet />
              </ProtectedRoute>
            </Suspense>
          }
        >
          <Route path="/app/dashboard" element={<div>Dashboard page</div>} />
          {getConversationsRouteElements(enabled).map(({ path: p, element }) => (
            <Route key={p} path={p} element={element} />
          ))}
          <Route path="/app/*" element={<div>Coming soon fallback</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

// The page is lazy-loaded; first transform of the chunk can exceed the 1s default.
const LAZY = { timeout: 15000 };

describe("Conversations route registration", () => {
  beforeEach(() => {
    authState = signedIn();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("registers nothing when the flag is off", () => {
    expect(getConversationsRouteElements(false)).toEqual([]);
  });

  it.each(["/app/conversations", "/app/conversations/preview-1"])(
    "falls through to the existing fallback for %s when the flag is off",
    (path) => {
      renderApp(false, path);
      expect(screen.getByText("Coming soon fallback")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Conversations" })).toBeNull();
      expect(screen.queryByText("A Lighter Mind")).toBeNull();
    }
  );

  it("renders the list for a signed-in member when the flag is on", async () => {
    renderApp(true);
    expect(await screen.findByRole("heading", { level: 1, name: "Conversations" }, LAZY)).toBeInTheDocument();
    expect(screen.queryByText("Coming soon fallback")).toBeNull();
  });

  it("renders a thread deep link when the flag is on", async () => {
    renderApp(true, "/app/conversations/preview-1");
    expect(await screen.findByRole("heading", { level: 2, name: "Tessa" }, LAZY)).toBeInTheDocument();
  });

  it("keeps route protection: a signed-out visitor is sent to login", () => {
    authState = { ...signedIn(), user: null, profile: null };
    renderApp(true, "/app/conversations/preview-1");
    expect(screen.getByText("Login page")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Conversations" })).toBeNull();
  });

  it("leaves other member routes unchanged with the flag on", () => {
    renderApp(true, "/app/dashboard");
    expect(screen.getByText("Dashboard page")).toBeInTheDocument();
  });
});

describe("isConversationThreadPath", () => {
  it("matches thread routes only, and only when enabled", () => {
    expect(isConversationThreadPath("/app/conversations/abc", true)).toBe(true);
    expect(isConversationThreadPath("/app/conversations/abc/", true)).toBe(true);
    expect(isConversationThreadPath("/app/conversations", true)).toBe(false);
    expect(isConversationThreadPath("/app/conversations-other/abc", true)).toBe(false);
    expect(isConversationThreadPath("/app/active-session", true)).toBe(false);
    expect(isConversationThreadPath("/app/conversations/abc", false)).toBe(false);
  });

  it("defaults to the flag", () => {
    vi.stubEnv("VITE_CONVERSATIONS_ENABLED", "");
    expect(isConversationThreadPath("/app/conversations/abc")).toBe(false);
    vi.stubEnv("VITE_CONVERSATIONS_ENABLED", "true");
    expect(isConversationThreadPath("/app/conversations/abc")).toBe(true);
  });
});
