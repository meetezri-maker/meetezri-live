/**
 * AuthContext clears every per-user client cache on sign-out and on account change (including a
 * change that arrives from another tab via onAuthStateChange), and leaves them alone on a plain
 * token refresh. Synthetic users; Supabase and lib/api are mocked.
 */
import { act, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  listener: null as null | ((event: string, session: unknown) => void),
  clearApiClientCaches: vi.fn(),
  getMe: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: (listener: (event: string, session: unknown) => void) => {
        m.listener = listener;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      updateUser: vi.fn().mockResolvedValue({}),
      signOut: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("@/lib/api", () => ({
  api: { getMe: m.getMe, initProfile: vi.fn(), clearMeCache: vi.fn() },
  isApiError: () => false,
  clearApiClientCaches: m.clearApiClientCaches,
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { onAuthIdentityReset } from "@/lib/authIdentityEvents";
import { AuthProvider, useAuth } from "./AuthContext";

const session = (id: string) => ({
  user: { id, email_confirmed_at: "2026-11-01T00:00:00Z", user_metadata: {} },
  expires_at: Math.floor(Date.now() / 1000) + 3600,
});

let signOutFn: (() => Promise<void>) | null = null;
function Capture() {
  signOutFn = useAuth().signOut;
  return null;
}

function setup() {
  const queryClient = new QueryClient();
  const identityResets = vi.fn();
  const off = onAuthIdentityReset(identityResets);
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/app/dashboard"]}>
        <AuthProvider>
          <Capture />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
  const seed = () => queryClient.setQueryData(["sessions", "list"], [{ id: "account-a-session" }]);
  const cached = () => queryClient.getQueryData(["sessions", "list"]);
  return { queryClient, identityResets, off, seed, cached };
}

describe("AuthContext per-user cache reset", () => {
  beforeEach(() => {
    m.listener = null;
    m.clearApiClientCaches.mockReset();
    m.getMe.mockReset().mockResolvedValue({ id: "x", role: "user", onboarding_completed: true });
    window.history.replaceState({}, "", "/app/dashboard");
  });

  it("does not clear on first sign-in or token refresh of the same user", async () => {
    const t = setup();
    await act(async () => m.listener?.("SIGNED_IN", session("user-a")));
    t.seed();
    await act(async () => m.listener?.("TOKEN_REFRESHED", session("user-a")));
    expect(m.clearApiClientCaches).not.toHaveBeenCalled();
    expect(t.identityResets).not.toHaveBeenCalled();
    expect(t.cached()).toBeDefined();
    t.off();
  });

  it("clears React Query, API caches and conversation state when ANOTHER account signs in (e.g. other tab)", async () => {
    const t = setup();
    await act(async () => m.listener?.("SIGNED_IN", session("user-a")));
    t.seed();
    await act(async () => m.listener?.("SIGNED_IN", session("user-b")));
    expect(m.clearApiClientCaches).toHaveBeenCalledTimes(1);
    expect(t.identityResets).toHaveBeenCalledTimes(1);
    expect(t.cached()).toBeUndefined();
    t.off();
  });

  it("clears everything on SIGNED_OUT (including a sign-out from another tab)", async () => {
    const t = setup();
    await act(async () => m.listener?.("SIGNED_IN", session("user-a")));
    t.seed();
    await act(async () => m.listener?.("SIGNED_OUT", null));
    expect(m.clearApiClientCaches).toHaveBeenCalled();
    expect(t.identityResets).toHaveBeenCalled();
    expect(t.cached()).toBeUndefined();
    t.off();
  });

  it("clears everything when signOut() is called from the app", async () => {
    const t = setup();
    await act(async () => m.listener?.("SIGNED_IN", session("user-a")));
    t.seed();
    await act(async () => signOutFn!());
    expect(m.clearApiClientCaches).toHaveBeenCalled();
    expect(t.identityResets).toHaveBeenCalled();
    expect(t.cached()).toBeUndefined();
    t.off();
  });
});
