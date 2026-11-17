import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The real lobby's duration picker while a session is starting: progress feedback, one start at a
 * time, no dismissal mid-start, and recovery after a failure. All API calls are mocked; only the
 * hero layout is stubbed.
 */

const h = vi.hoisted(() => ({
  create: vi.fn(),
  startScheduled: vi.fn(),
  list: vi.fn(),
  getCredits: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({ supabase: { auth: {} } }));

vi.mock("@/lib/api", () => {
  const fallback: any = new Proxy(() => Promise.resolve([]), {
    get: (_t, p) => (p === "then" ? undefined : fallback),
    apply: () => Promise.resolve([]),
  });
  const sessions = new Proxy(
    { create: h.create, startScheduled: h.startScheduled, list: h.list } as Record<string, unknown>,
    { get: (t, p: string) => (p in t ? t[p] : fallback) },
  );
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
  TalkItOutLobbyLayout: ({
    setSelectedMode,
    setShowMinutesPicker,
    upcomingSessions,
    onSelectUpcomingRow,
    onOpenSchedule,
  }: any) => (
    <div>
      <button
        type="button"
        onClick={() => {
          setSelectedMode("now");
          setShowMinutesPicker(true);
        }}
      >
        open picker
      </button>
      {/* Stands in for the real layout's "Schedule a Talk", which only calls onOpenSchedule. */}
      <button type="button" onClick={() => onOpenSchedule()}>
        schedule a talk
      </button>
      {(upcomingSessions ?? []).map((s: any) => (
        <button key={s.id} type="button" onClick={() => onSelectUpcomingRow(s)}>
          upcoming {s.id}
        </button>
      ))}
    </div>
  ),
}));

import { SessionLobby } from "./SessionLobby";

function Landed() {
  const location = useLocation();
  return (
    <div>
      landed:{location.pathname}
      {location.search}
      <span data-testid="landed-state">{JSON.stringify(location.state)}</span>
    </div>
  );
}

const apiError = (status: number, message: string, code?: string) =>
  Object.assign(new Error(message), { name: "ApiError", status, code, body: { code } });

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderLobby() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/app/session-lobby"]}>
        <Routes>
          <Route path="/app/session-lobby" element={<SessionLobby />} />
          <Route path="*" element={<Landed />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const startButton = () =>
  screen.getByRole("button", { name: /Let.s Talk Now|Starting your session|Still starting/ }) as HTMLButtonElement;
const dialog = () => screen.queryByRole("dialog", { name: "Choose talk duration" });
const preset = (minutes: number) =>
  screen.getByRole("button", { name: new RegExp(`^${minutes}\\s*minutes$`) }) as HTMLButtonElement;
const selectedBadge = () => screen.getByText(/^Selected:/).textContent;
const scheduleHeading = () => screen.queryByRole("heading", { name: "Schedule a Talk" });

/**
 * The picker's exit animation keeps a closing dialog in the DOM for a while, so "still open" is
 * only meaningful after that period. `CLOSE_WINDOW_MS` is the same window the unguarded-close
 * tests below use to prove a real close does complete, so both directions are measured alike.
 */
const CLOSE_WINDOW_MS = 800;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function expectPickerStaysOpen() {
  await act(async () => {
    await sleep(CLOSE_WINDOW_MS);
  });
  expect(dialog()).not.toBeNull();
}
async function expectPickerCloses() {
  await waitFor(() => expect(dialog()).toBeNull(), { timeout: CLOSE_WINDOW_MS });
}

async function openPicker() {
  const view = renderLobby();
  fireEvent.click(await screen.findByRole("button", { name: "open picker" }));
  await screen.findByRole("dialog", { name: "Choose talk duration" });
  await waitFor(() => expect(startButton().disabled).toBe(false));
  return view;
}

/** Opens the picker and clicks Start with `create` left pending. */
async function startPending() {
  const pending = deferred<any>();
  h.create.mockReturnValueOnce(pending.promise);
  const view = await openPicker();
  fireEvent.click(startButton());
  await waitFor(() => expect(h.create).toHaveBeenCalledTimes(1));
  return { ...pending, view };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.getCredits.mockResolvedValue({ credits_seconds: 200 * 60 });
  h.list.mockResolvedValue([]);
  window.localStorage.clear();
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("SessionLobby duration picker while starting", () => {
  it("shows the spinner and progress label immediately, with accessible busy state", async () => {
    h.create.mockReturnValueOnce(new Promise(() => {}));
    await openPicker();
    fireEvent.click(startButton());

    const button = screen.getByRole("button", { name: /Starting your session\.\.\./ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.querySelector(".animate-spin")).not.toBeNull();
    expect(dialog()?.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("status").textContent).toBe("Starting your session...");
  });

  it("cannot be activated repeatedly", async () => {
    await startPending();
    const button = startButton();
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.doubleClick(button);
    expect(h.create).toHaveBeenCalledTimes(1);
  });

  it("guards concurrent entry points, including the minutes-held Retry toast", async () => {
    h.create.mockRejectedValueOnce(
      apiError(409, "Your minutes are being held.", "MINUTES_HELD_BY_ANOTHER_SESSION"),
    );
    await openPicker();
    fireEvent.click(startButton());
    await waitFor(() => expect(h.toastError).toHaveBeenCalled());
    const retry = h.toastError.mock.calls[0][1].action.onClick as () => void;

    h.create.mockReturnValueOnce(new Promise(() => {}));
    // Two synchronous entries before React can re-render: only the first may start.
    act(() => {
      retry();
      retry();
    });
    fireEvent.click(startButton());
    await waitFor(() => expect(h.create).toHaveBeenCalledTimes(2));
    await sleep(20);
    expect(h.create).toHaveBeenCalledTimes(2);
  });

  it("ignores an outside click while starting", async () => {
    await startPending();
    fireEvent.click(screen.getByTestId("talk-duration-overlay"));
    await expectPickerStaysOpen();
    expect(startButton().disabled).toBe(true);
  });

  it("ignores Escape while starting", async () => {
    await startPending();
    fireEvent.keyDown(window, { key: "Escape" });
    await expectPickerStaysOpen();
  });

  it("keeps X and Cancel from dismissing while starting, and lets them dismiss once it settles", async () => {
    const pending = await startPending();
    const close = screen.getByRole("button", { name: "Close" }) as HTMLButtonElement;
    const cancel = screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement;
    expect(close.disabled).toBe(true);
    expect(cancel.disabled).toBe(true);
    fireEvent.click(close);
    fireEvent.click(cancel);
    await expectPickerStaysOpen();

    await act(async () => pending.reject(new Error("Network down")));
    await waitFor(() => expect(close.disabled).toBe(false));
    fireEvent.click(cancel);
    await expectPickerCloses();
  });

  it("does not let Schedule a Talk switch modes or close the picker while starting", async () => {
    const pending = await startPending();
    fireEvent.click(screen.getByRole("button", { name: "schedule a talk" }));
    await expectPickerStaysOpen();
    expect(scheduleHeading()).toBeNull();

    // Once the start settles, scheduling works as before.
    await act(async () => pending.reject(new Error("Network down")));
    await waitFor(() => expect(startButton().disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "schedule a talk" }));
    await expectPickerCloses();
    expect(await screen.findByRole("heading", { name: "Schedule a Talk" })).toBeTruthy();
  });

  it("locks the duration choices while starting", async () => {
    await startPending();
    const before = selectedBadge();

    expect(preset(30).disabled).toBe(true);
    fireEvent.click(preset(30));
    const input = screen.getByPlaceholderText("e.g. 22") as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement).disabled).toBe(true);
    const freeFlow = screen.getByRole("button", { name: /Free flow/ }) as HTMLButtonElement;
    expect(freeFlow.disabled).toBe(true);
    fireEvent.click(freeFlow);

    expect(selectedBadge()).toBe(before);
  });

  it("keeps showing the submitted duration when the balance refresh comes back lower", async () => {
    await openPicker();
    expect(selectedBadge()).toContain("20 min");
    // The start's authoritative balance refresh reports only 10 minutes.
    h.getCredits.mockResolvedValueOnce({ credits_seconds: 10 * 60 });
    const pending = deferred<any>();
    h.create.mockReturnValueOnce(pending.promise);
    fireEvent.click(startButton());
    await waitFor(() => expect(h.create).toHaveBeenCalledTimes(1));
    expect(h.create.mock.calls[0][0].duration_minutes).toBe(20);

    await act(async () => {
      await sleep(50);
    });
    expect(selectedBadge()).toContain("20 min");

    // Outside startup the existing clamp to the balance still applies.
    await act(async () => pending.reject(new Error("Insufficient balance window")));
    await waitFor(() => expect(selectedBadge()).toContain("10 min"));
  });

  it("restores the controls after a failure, keeps the duration and allows a retry", async () => {
    await openPicker();
    fireEvent.click(preset(30));
    expect(selectedBadge()).toContain("30 min");

    h.create.mockRejectedValueOnce(new Error("Network down"));
    fireEvent.click(startButton());

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/didn't start/);
    expect(h.toastError).toHaveBeenCalledWith("Network down");
    expect(h.toastError).toHaveBeenCalledTimes(1);
    expect(dialog()).not.toBeNull();
    expect(selectedBadge()).toContain("30 min");
    const button = screen.getByRole("button", { name: /Let.s Talk Now/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(button.getAttribute("aria-busy")).toBe("false");
    expect((screen.getByRole("button", { name: "Close" }) as HTMLButtonElement).disabled).toBe(false);
    expect(preset(20).disabled).toBe(false);

    // Retrying clears the error and sends the same duration.
    h.create.mockResolvedValueOnce({ id: "s-retry", duration_minutes: 30, config: {} });
    fireEvent.click(button);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(await screen.findByText(/landed:\/app\/active-session/)).toBeTruthy();
    expect(h.create.mock.calls[1][0].duration_minutes).toBe(30);
  });

  it("keeps normal dismissal when not starting", async () => {
    await openPicker();
    fireEvent.click(screen.getByTestId("talk-duration-overlay"));
    await expectPickerCloses();

    fireEvent.click(screen.getByRole("button", { name: "open picker" }));
    await screen.findByRole("dialog", { name: "Choose talk duration" });
    fireEvent.keyDown(window, { key: "Escape" });
    await expectPickerCloses();

    fireEvent.click(screen.getByRole("button", { name: "open picker" }));
    await screen.findByRole("dialog", { name: "Choose talk duration" });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await expectPickerCloses();
  });

  it("never paints the previous error when the picker reopens", async () => {
    await openPicker();
    h.create.mockRejectedValueOnce(new Error("Network down"));
    fireEvent.click(startButton());
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await expectPickerCloses();

    // Record every node inserted while reopening: an error cleared only by a later effect would
    // still be committed (painted and announced) once, and would show up here.
    const insertedAlerts: Element[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches('[role="alert"]')) insertedAlerts.push(node);
          insertedAlerts.push(...Array.from(node.querySelectorAll('[role="alert"]')));
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    fireEvent.click(screen.getByRole("button", { name: "open picker" }));
    await screen.findByRole("dialog", { name: "Choose talk duration" });
    await act(async () => {
      await sleep(50);
    });
    observer.disconnect();

    expect(insertedAlerts).toHaveLength(0);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("navigates exactly as before on success", async () => {
    const pending = await startPending();
    expect(h.create).toHaveBeenCalledWith({
      type: "instant",
      duration_minutes: 20,
      config: expect.objectContaining({ voice: expect.anything(), avatar: expect.anything() }),
    });
    pending.resolve({ id: "s-ok", duration_minutes: 20, config: { foo: "bar" } });

    expect(await screen.findByText(/landed:\/app\/active-session\?sessionId=s-ok/)).toBeTruthy();
    const state = JSON.parse(screen.getByTestId("landed-state").textContent || "{}");
    expect(state).toMatchObject({ sessionId: "s-ok", duration: 20, config: { foo: "bar" } });
    expect(window.localStorage.getItem("ezri_active_session_id")).toBe("s-ok");
  });
});

describe("SessionLobby duration picker keyboard focus", () => {
  it("moves focus into the dialog while starting and keeps Tab and focus from leaving it", async () => {
    await openPicker();
    startButton().focus();
    h.create.mockReturnValueOnce(new Promise(() => {}));
    fireEvent.click(startButton());
    await waitFor(() => expect(h.create).toHaveBeenCalled());

    const panel = dialog() as HTMLElement;
    expect(document.activeElement).toBe(panel);

    const tabAllowed = fireEvent.keyDown(document.activeElement as Element, { key: "Tab" });
    const shiftTabAllowed = fireEvent.keyDown(document.activeElement as Element, {
      key: "Tab",
      shiftKey: true,
    });
    expect(tabAllowed).toBe(false);
    expect(shiftTabAllowed).toBe(false);
    expect(document.activeElement).toBe(panel);

    // Focus that lands on the lobby behind the overlay is pulled back into the dialog.
    act(() => {
      screen.getByRole("button", { name: "schedule a talk" }).focus();
    });
    expect(document.activeElement).toBe(panel);

    // Escape is still handled (and still ignored) while focus is held.
    fireEvent.keyDown(window, { key: "Escape" });
    await expectPickerStaysOpen();
  });

  it("returns focus to Start after a failure and stops holding focus", async () => {
    await openPicker();
    const pending = deferred<any>();
    h.create.mockReturnValueOnce(pending.promise);
    fireEvent.click(startButton());
    await waitFor(() => expect(document.activeElement).toBe(dialog()));

    await act(async () => pending.reject(new Error("Network down")));
    await screen.findByRole("alert");
    const start = screen.getByRole("button", { name: /Let.s Talk Now/ });
    expect(document.activeElement).toBe(start);

    // Not starting any more: Tab is left to the browser and focus may move freely.
    expect(fireEvent.keyDown(start, { key: "Tab" })).toBe(true);
    const presetButton = preset(30);
    act(() => presetButton.focus());
    expect(document.activeElement).toBe(presetButton);
  });
});

describe("SessionLobby slow-start notice", () => {
  const stillStarting = () => screen.queryByText("Still starting your session...", { selector: "button *, button" });

  it("appears after 10 seconds of a pending start, and not before", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const pending = await startPending();

    act(() => {
      vi.advanceTimersByTime(9_000);
    });
    expect(screen.getByRole("button", { name: /^Starting your session\.\.\./ })).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.getByRole("button", { name: /Still starting your session\.\.\./ })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Still starting your session...");
    expect(dialog()).not.toBeNull();

    pending.resolve({ id: "slow-1", duration_minutes: 20, config: {} });
    expect(await screen.findByText(/landed:\/app\/active-session/)).toBeTruthy();
  });

  it("leaves no stale loading text after a slow start fails, and a retry starts a fresh timer", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const first = await startPending();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(stillStarting()).not.toBeNull();

    await act(async () => first.reject(new Error("Network down")));
    await screen.findByRole("alert");
    expect(stillStarting()).toBeNull();
    expect(screen.queryByText(/Starting your session/)).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("");
    expect(screen.getByRole("button", { name: /Let.s Talk Now/ })).toBeTruthy();

    // Retry: the notice must not carry over, and its timer starts again from zero.
    const second = deferred<any>();
    h.create.mockReturnValueOnce(second.promise);
    fireEvent.click(startButton());
    await waitFor(() => expect(h.create).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: /^Starting your session\.\.\./ })).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(9_000);
    });
    expect(stillStarting()).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(stillStarting()).not.toBeNull();
  });

  it("clears its timer when the lobby unmounts mid-start", async () => {
    const setSpy = vi.spyOn(window, "setTimeout");
    const clearSpy = vi.spyOn(window, "clearTimeout");
    const { view } = await startPending();

    const slowCall = setSpy.mock.calls.findIndex((call) => call[1] === 10_000);
    expect(slowCall).toBeGreaterThanOrEqual(0);
    const timerId = setSpy.mock.results[slowCall].value;
    expect(clearSpy).not.toHaveBeenCalledWith(timerId);

    view.unmount();
    expect(clearSpy).toHaveBeenCalledWith(timerId);
  });
});

describe("SessionLobby scheduled start", () => {
  it("still starts the scheduled row in place, with no inline picker error on failure", async () => {
    const at = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    h.list.mockResolvedValue([
      {
        id: "sched-1",
        type: "scheduled",
        status: "scheduled",
        scheduled_at: at,
        created_at: new Date().toISOString(),
        duration_minutes: 20,
        config: {},
      },
    ]);
    renderLobby();
    fireEvent.click(await screen.findByRole("button", { name: "upcoming sched-1" }));

    h.startScheduled.mockRejectedValueOnce(new Error("Only scheduled sessions can be started"));
    fireEvent.click(await screen.findByRole("button", { name: "Start Now" }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("Only scheduled sessions can be started"));
    expect(screen.queryByRole("alert")).toBeNull();

    h.startScheduled.mockResolvedValueOnce({ id: "sched-1", duration_minutes: 20, config: {} });
    const startNow = screen.getByRole("button", { name: "Start Now" }) as HTMLButtonElement;
    await waitFor(() => expect(startNow.disabled).toBe(false));
    fireEvent.click(startNow);
    fireEvent.click(startNow);

    expect(await screen.findByText(/landed:\/app\/active-session\?sessionId=sched-1/)).toBeTruthy();
    expect(h.startScheduled).toHaveBeenCalledTimes(2);
    expect(h.startScheduled).toHaveBeenLastCalledWith("sched-1", { duration_minutes: 20 });
    expect(h.create).not.toHaveBeenCalled();
  });
});
