import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** The real lobby's start flow when the server refuses a session. Only the layout is stubbed. */

const h = vi.hoisted(() => ({
  create: vi.fn(),
  getCredits: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({ supabase: { auth: {} } }));

vi.mock("@/lib/api", () => {
  const fallback: any = new Proxy(() => Promise.resolve([]), {
    get: (_t, p) => (p === "then" ? undefined : fallback),
    apply: () => Promise.resolve([]),
  });
  const sessions = new Proxy({ create: h.create } as Record<string, unknown>, {
    get: (t, p: string) => (p in t ? t[p] : fallback),
  });
  const known: Record<string, unknown> = { getCredits: h.getCredits, sessions };
  return {
    api: new Proxy(known, { get: (t, p: string) => (p in t ? t[p] : fallback) }),
    isApiError: (e: any) => e?.name === "ApiError",
  };
});

vi.mock("@/app/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", user_metadata: {} },
    profile: { credits_remaining_seconds: 200 * 60, selected_environment: null },
    isLoading: false,
    refreshProfile: async () => {},
  }),
}));

vi.mock("sonner", () => ({
  toast: { error: h.toastError, success: vi.fn(), info: vi.fn(), warning: vi.fn() },
  Toaster: () => null,
}));

vi.mock("@/lib/avatar/preloadAvatarModel", () => ({ preloadAvatarModel: vi.fn() }));

vi.mock("./talk-it-out/TalkItOutLobbyLayout", () => ({
  TalkItOutLobbyLayout: ({ setSelectedMode, setShowMinutesPicker }: any) => (
    <button
      type="button"
      onClick={() => {
        setSelectedMode("now");
        setShowMinutesPicker(true);
      }}
    >
      open picker
    </button>
  ),
}));

import { SessionLobby } from "./SessionLobby";

function Landed() {
  return <div>landed:{useLocation().pathname}</div>;
}

const apiError = (status: number, message: string, code?: string) =>
  Object.assign(new Error(message), { name: "ApiError", status, code, body: { code } });

const HELD_MESSAGE = "Your minutes are being held by another active session.";

async function submitStart() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/app/session-lobby"]}>
        <Routes>
          <Route path="/app/session-lobby" element={<SessionLobby />} />
          <Route path="*" element={<Landed />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "open picker" }));
  const start = await screen.findByRole("button", { name: /Let.s Talk Now/ });
  await waitFor(() => expect((start as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(start);
  await waitFor(() => expect(h.create).toHaveBeenCalled());
}

beforeEach(() => {
  vi.clearAllMocks();
  h.getCredits.mockResolvedValue({ credits_seconds: 200 * 60 });
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => cleanup());

describe("SessionLobby start refused", () => {
  it("explains held minutes, offers Retry and stays out of Billing", async () => {
    h.create.mockRejectedValueOnce(
      apiError(409, HELD_MESSAGE, "MINUTES_HELD_BY_ANOTHER_SESSION"),
    );
    await submitStart();

    await waitFor(() => expect(h.toastError).toHaveBeenCalled());
    const [message, options] = h.toastError.mock.calls[0];
    expect(message).toBe(HELD_MESSAGE);
    expect(options.action.label).toBe("Retry");
    expect(screen.queryByText(/landed:\/app\/billing/)).toBeNull();

    h.create.mockResolvedValueOnce({ id: "s2", duration_minutes: 20, config: {} });
    options.action.onClick();

    await waitFor(() => expect(h.create).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/landed:\/app\/active-session/)).toBeTruthy();
  });

  it("still sends a genuinely insufficient balance to Billing", async () => {
    h.create.mockRejectedValueOnce(
      apiError(400, "Insufficient credits. You requested 20 minutes for this session."),
    );
    await submitStart();

    expect(await screen.findByText(/landed:\/app\/billing/)).toBeTruthy();
    expect(h.toastError.mock.calls[0][1]?.action).toBeUndefined();
  });
});
