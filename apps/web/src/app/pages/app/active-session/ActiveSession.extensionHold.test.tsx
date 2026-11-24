import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, forwardRef, type ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Drives the REAL session page (`ActiveSession` + `ActiveSessionView` + the popups) against a fake
 * Ezri client, a fake API and fake media devices. Only the avatar stage is stubbed.
 *
 * This proves the page's wiring. It says nothing about how the real Ezri service behaves.
 */

const h = vi.hoisted(() => ({
  clients: [] as Array<any>,
  schedule: vi.fn(),
  schedulerStop: vi.fn(),
  toastInfo: vi.fn(),
  safetyState: { current: "NORMAL" as string },
  config: { sttProvider: "runpod" },
  sessions: {
    get: vi.fn(),
    end: vi.fn(),
    heartbeat: vi.fn(),
    extend: vi.fn(),
  },
  getCredits: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: "t" } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));

vi.mock("@/lib/api", async () => {
  const fallback: any = new Proxy(() => Promise.resolve([]), {
    get: (_t, p) => (p === "then" ? undefined : fallback),
    apply: () => Promise.resolve([]),
  });
  const known: Record<string, unknown> = { getCredits: h.getCredits, sessions: h.sessions };
  return {
    api: new Proxy(known, { get: (t, p: string) => (p in t ? t[p] : fallback) }),
    isApiError: (e: any) => e?.name === "ApiError",
  };
});

vi.mock("@/app/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", user_metadata: {} },
    profile: { full_name: "Test Member" },
    refreshProfile: async () => {},
    session: { access_token: "t" },
  }),
}));

vi.mock("@/app/contexts/SafetyContext", () => ({
  useSafety: () => ({
    currentState: h.safetyState.current,
    updateState: vi.fn(),
    userRegion: "US",
  }),
}));

vi.mock("@/lib/ezri/config", () => ({
  getEzriConfig: () => ({
    apiBase: "https://ezri.invalid",
    wsBase: "wss://ezri.invalid/ws",
    defaults: { brainProvider: "b", ttsProvider: "t", sttProvider: h.config.sttProvider },
    voice: "v",
  }),
}));

vi.mock("@/lib/ezri/realtimeClient", () => {
  class EzriRealtimeClient {
    status = "disconnected";
    sendPcm = vi.fn();
    sendChat = vi.fn();
    sendPing = vi.fn();
    sendInterrupt = vi.fn(() => true);
    sendPlaybackDone = vi.fn(() => true);
    disconnect = vi.fn(() => this.setStatus("disconnected"));
    constructor(public handlers: any) {
      h.clients.push(this);
    }
    getStatus() {
      return this.status;
    }
    setStatus(next: string) {
      this.status = next;
      this.handlers.onStatus?.(next);
    }
    connect() {
      this.setStatus("connected");
    }
  }
  return { EzriRealtimeClient };
});

vi.mock("@/lib/ezri/wsAudioScheduler", () => ({
  EzriWsAudioScheduler: class {
    constructor() {
      const fns: Record<string, unknown> = { schedule: h.schedule, stop: h.schedulerStop };
      return new Proxy(this, {
        get: (_t, p: string) => (fns[p] ??= vi.fn()),
      });
    }
  },
}));

vi.mock("sonner", () => ({
  toast: {
    info: h.toastInfo,
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
  Toaster: () => null,
}));

vi.mock("motion/react", () => {
  const stripMotionProps = ({
    initial: _i,
    animate: _a,
    exit: _e,
    transition: _t,
    whileHover: _h,
    whileTap: _w,
    layout: _l,
    ...rest
  }: Record<string, unknown>) => rest;
  const motion = new Proxy(
    {},
    {
      get: (_t, tag: string) =>
        forwardRef((props: Record<string, unknown>, ref) =>
          createElement(tag, { ...stripMotionProps(props), ref }),
        ),
    },
  );
  return {
    motion,
    AnimatePresence: ({ children }: { children: ReactNode }) => children,
    useReducedMotion: () => true,
  };
});

vi.mock("./components/SessionStage", () => ({ SessionStage: () => null }));

import { ActiveSession } from "./ActiveSession";

class FakeTrack {
  enabled = true;
  readyState = "live";
  stop = vi.fn(() => {
    this.readyState = "ended";
  });
  constructor(readonly kind: string) {}
}

class FakeStream {
  constructor(readonly tracks: FakeTrack[] = []) {}
  getTracks() {
    return this.tracks;
  }
  getAudioTracks() {
    return this.tracks.filter((t) => t.kind === "audio");
  }
  getVideoTracks() {
    return this.tracks.filter((t) => t.kind === "video");
  }
}

const processors: Array<{ onaudioprocess: ((e: unknown) => void) | null }> = [];

class FakeAudioContext {
  state = "running";
  sampleRate = 16_000;
  currentTime = 0;
  destination = {};
  private node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  createGain() {
    return { ...this.node(), gain: { value: 1 } };
  }
  createAnalyser() {
    return {
      ...this.node(),
      fftSize: 256,
      frequencyBinCount: 32,
      getByteFrequencyData: vi.fn(),
      getByteTimeDomainData: vi.fn(),
    };
  }
  createMediaStreamSource() {
    return this.node();
  }
  createScriptProcessor() {
    const processor = { ...this.node(), onaudioprocess: null };
    processors.push(processor);
    return processor;
  }
  createBuffer() {
    return {};
  }
  createBufferSource() {
    return { ...this.node(), buffer: null, start: vi.fn(), stop: vi.fn() };
  }
  async resume() {}
  async close() {
    this.state = "closed";
  }
}

let micTracks: FakeTrack[] = [];

const flush = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
const tick = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

function LobbyStub() {
  const location = useLocation();
  return <div>landed:{location.pathname}</div>;
}

const CREDITS_200_MIN = 200 * 60;

const approval = (limitMinutes: number) => ({
  approved: true,
  replayed: false,
  limit_minutes: limitMinutes,
  limit_seconds: limitMinutes * 60,
  billed_seconds: 60,
  balance_seconds: CREDITS_200_MIN - 60,
  available_seconds: CREDITS_200_MIN - limitMinutes * 60,
});

const apiError = (status: number, body: Record<string, unknown>) =>
  Object.assign(new Error("rejected"), { name: "ApiError", status, body });

async function startSession({
  minutes = 1,
  creditsSeconds = CREDITS_200_MIN,
  actualSeconds,
  eligible = true,
}: {
  minutes?: number;
  creditsSeconds?: number;
  actualSeconds?: number;
  eligible?: boolean | "missing";
} = {}) {
  h.sessions.get.mockResolvedValue({
    status: "active",
    ended_at: null,
    duration_minutes: minutes,
    ...(eligible === "missing" ? {} : { extension_eligible: eligible }),
  });
  h.getCredits.mockResolvedValue({ credits_seconds: creditsSeconds, actual_seconds: actualSeconds });
  window.localStorage.setItem("ezri_media_permissions_u1", "true");

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/app/active-session",
            search: "?sessionId=s1",
            state: { sessionId: "s1", duration: minutes, config: { voice: "v", avatar: "Maya Chen" } },
          },
        ]}
      >
        <Routes>
          <Route path="/app/active-session" element={<ActiveSession />} />
          <Route path="*" element={<LobbyStub />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await flush();
  await flush();

  const client = h.clients[h.clients.length - 1];
  act(() => {
    client.handlers.onWarmupStart?.();
    client.handlers.onSpeakingStart?.();
    client.handlers.onTtsDone?.();
    client.handlers.onWarmupDone?.();
  });
  await flush();
  await flush();
  return client;
}

const reachLimit = (minutes = 1) => tick(minutes * 60_000 + 50);
const audioChunk = () => ({ kind: "blob", blob: new Blob([new Uint8Array(64)]) });
const speakMic = (level = 0.5) => {
  const processor = processors[processors.length - 1];
  act(() => {
    processor.onaudioprocess?.({
      inputBuffer: { getChannelData: () => new Float32Array(4096).fill(level) },
    });
  });
};
const END_LABEL = "End session & return to dashboard";
const addButton = () => screen.queryByRole("button", { name: "Add more time" });
const clickAdd = async () => {
  fireEvent.click(addButton()!);
  await flush();
};
const clickEnd = async () => {
  fireEvent.click(screen.getByRole("button", { name: END_LABEL }));
  await flush();
  await flush();
};

/** Approve, then answer the liveness ping. The reply turn is already closed. */
const approveAndResume = async (client: any, limitMinutes: number) => {
  h.sessions.extend.mockResolvedValueOnce(approval(limitMinutes));
  await clickAdd();
  act(() => client.handlers.onPong());
  await flush();
};

beforeEach(() => {
  h.clients.length = 0;
  processors.length = 0;
  h.safetyState.current = "NORMAL";
  h.config.sttProvider = "runpod";
  vi.clearAllMocks();
  h.sessions.end.mockResolvedValue({ status: "completed" });
  h.sessions.heartbeat.mockResolvedValue({ ok: true });
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"],
  });
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  vi.stubEnv("VITE_SESSION_EXTENSIONS_ENABLED", "true");
  micTracks = [new FakeTrack("audio")];
  vi.stubGlobal("MediaStream", FakeStream);
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => {});
  window.matchMedia = vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(window.navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn(async (c: { audio?: unknown }) =>
        c.audio ? new FakeStream(micTracks) : new FakeStream([new FakeTrack("video")]),
      ),
    },
  });
  HTMLMediaElement.prototype.play = vi.fn(async () => {});
  HTMLMediaElement.prototype.pause = vi.fn();
  HTMLMediaElement.prototype.load = vi.fn();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("feature flag off (default)", () => {
  it("keeps the hard cutoff at the selected limit", async () => {
    vi.stubEnv("VITE_SESSION_EXTENSIONS_ENABLED", "");
    const client = await startSession();

    await reachLimit();
    await flush();

    expect(addButton()).toBeNull();
    expect(screen.getByRole("button", { name: "Return to Dashboard" })).toBeTruthy();
    expect(client.disconnect).toHaveBeenCalled();
    expect(micTracks[0].stop).toHaveBeenCalled();
    expect(h.sessions.end).toHaveBeenCalledTimes(1);
  });
});

describe("account allowlist", () => {
  it("an account off the allowlist keeps the hard cutoff with the flag on", async () => {
    const client = await startSession({ eligible: false });
    await reachLimit();

    expect(addButton()).toBeNull();
    expect(screen.getByRole("button", { name: "Return to Dashboard" })).toBeTruthy();
    expect(client.disconnect).toHaveBeenCalled();
    expect(h.sessions.end).toHaveBeenCalledTimes(1);
    expect(h.sessions.extend).not.toHaveBeenCalled();
  });

  it("keeps the hard cutoff when the server's answer is missing", async () => {
    const client = await startSession({ eligible: "missing" });
    await reachLimit();

    expect(addButton()).toBeNull();
    expect(client.disconnect).toHaveBeenCalled();
  });

  it("an eligible account with 5:00 left sees both buttons and adds five minutes", async () => {
    const client = await startSession({ creditsSeconds: 60 + 300, actualSeconds: 60 + 300 });
    await reachLimit();

    expect(addButton()).toBeTruthy();
    expect(screen.getByRole("button", { name: END_LABEL })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "5 min" }));
    await approveAndResume(client, 6);

    expect(h.sessions.extend).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ add_minutes: 5, expected_limit_minutes: 1 }),
    );
    expect(addButton()).toBeNull();
    expect(micTracks[0].enabled).toBe(true);
  });

  it("removal mid-session stops new time but End still saves once", async () => {
    await startSession();
    await reachLimit();
    h.sessions.extend.mockRejectedValueOnce(apiError(404, { message: "Not found" }));
    await clickAdd();

    expect(addButton()).toBeNull();
    expect(screen.getByRole("alert").textContent).toMatch(/isn't available for this account/);
    expect(screen.queryByText(/enough minutes left/)).toBeNull();
    expect(micTracks[0].enabled).toBe(false);

    await clickEnd();
    expect(h.sessions.end).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/landed:\/app\/dashboard/)).toBeTruthy();
  });
});

describe("waiting on the popup", () => {
  it("pauses mid-speech without finalizing, and nothing leaves or plays", async () => {
    const client = await startSession();
    act(() => {
      client.handlers.onSpeakingStart();
      client.handlers.onAudio(audioChunk());
    });
    await reachLimit();

    expect(addButton()).toBeTruthy();
    expect(screen.getByRole("button", { name: END_LABEL })).toBeTruthy();
    expect(screen.getByText(/Decide within/)).toBeTruthy();
    expect(h.sessions.end).not.toHaveBeenCalled();
    expect(client.disconnect).not.toHaveBeenCalled();
    expect(micTracks[0].stop).not.toHaveBeenCalled();
    expect(micTracks[0].enabled).toBe(false);
    expect(h.schedulerStop).toHaveBeenCalled();

    client.sendPcm.mockClear();
    h.schedule.mockClear();
    h.sessions.heartbeat.mockClear();
    speakMic();
    act(() => {
      client.handlers.onAudio(audioChunk());
      client.handlers.onAssistantText("late reply", "final");
      client.handlers.onUserTranscript("late words");
    });
    await tick(60_000);
    speakMic();

    expect(client.sendPcm).not.toHaveBeenCalled();
    expect(client.sendChat).not.toHaveBeenCalled();
    expect(h.schedule).not.toHaveBeenCalled();
    expect(h.sessions.heartbeat).not.toHaveBeenCalled();
    // Transport keepalive continues while usage does not.
    expect(client.sendPing).toHaveBeenCalled();
  });

  it("keeps the hard cutoff when the balance cannot cover any more time", async () => {
    const client = await startSession({ creditsSeconds: 90 });
    await reachLimit();

    expect(addButton()).toBeNull();
    expect(h.sessions.end).toHaveBeenCalledTimes(1);
    expect(client.disconnect).toHaveBeenCalled();
  });
});

describe("balances that cannot cover the smallest choice", () => {
  it.each([1, 4])("with %i minutes left, ends and returns to the dashboard", async (left) => {
    const client = await startSession({ creditsSeconds: 60 + left * 60 });
    await reachLimit();

    expect(addButton()).toBeNull();
    expect(client.disconnect).toHaveBeenCalled();
    expect(h.sessions.end).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Return to Dashboard" }));
    await flush();
    await flush();
    expect(screen.getByText(/landed:\/app\/dashboard/)).toBeTruthy();
    expect(h.sessions.end).toHaveBeenCalledTimes(1);
  });

  it("still pauses with exactly the smallest choice available", async () => {
    await startSession({ creditsSeconds: 60 + 5 * 60 });
    await reachLimit();

    expect(addButton()).toBeTruthy();
    expect(screen.getByRole("button", { name: "5 min" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "10 min" })).toBeNull();
    expect(h.sessions.end).not.toHaveBeenCalled();
  });

  it("does not offer five minutes with 4:59 left, even when the rounded balance reads 5:00", async () => {
    const client = await startSession({ creditsSeconds: 60 + 300, actualSeconds: 60 + 299 });
    await reachLimit();

    expect(addButton()).toBeNull();
    expect(client.disconnect).toHaveBeenCalled();
    expect(h.sessions.end).toHaveBeenCalledTimes(1);
  });

  it("offers five minutes with exactly 5:00 left", async () => {
    const client = await startSession({ creditsSeconds: 60 + 300, actualSeconds: 60 + 300 });
    await reachLimit();

    expect(addButton()).toBeTruthy();
    expect(screen.getByRole("button", { name: "5 min" })).toBeTruthy();
    expect(client.disconnect).not.toHaveBeenCalled();
    expect(h.sessions.end).not.toHaveBeenCalled();
  });

  it("explains minutes held by another session and lets Add work as a retry", async () => {
    const client = await startSession();
    await reachLimit();
    h.sessions.extend.mockRejectedValueOnce(
      apiError(409, {
        approved: false,
        code: "MINUTES_HELD_BY_ANOTHER_SESSION",
        available_seconds: 120,
        balance_seconds: 3000,
        limit_minutes: 1,
      }),
    );
    await clickAdd();

    expect(screen.getByRole("alert").textContent).toMatch(/held by another active session/);
    expect(addButton()).toBeTruthy();
    expect(micTracks[0].enabled).toBe(false);
    expect(h.sessions.end).not.toHaveBeenCalled();
    expect(screen.queryByText("landed:/app/billing")).toBeNull();

    await approveAndResume(client, 11);
    expect(addButton()).toBeNull();
    expect(micTracks[0].enabled).toBe(true);
  });

  it("hides Add when another device has used the balance, and End still works", async () => {
    await startSession();
    await reachLimit();
    h.sessions.extend.mockRejectedValueOnce(
      apiError(409, {
        approved: false,
        code: "INSUFFICIENT_BALANCE",
        available_seconds: 200,
        limit_minutes: 1,
      }),
    );
    await clickAdd();

    expect(addButton()).toBeNull();
    expect(screen.getByText(/enough minutes left/)).toBeTruthy();
    await clickEnd();
    expect(h.sessions.end).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/landed:\/app\/dashboard/)).toBeTruthy();
  });
});

describe("approval", () => {
  it("resumes only after the reply turn closes and the socket answers", async () => {
    const client = await startSession();
    act(() => client.handlers.onSpeakingStart());
    await reachLimit();

    h.sessions.extend.mockResolvedValueOnce(approval(11));
    await clickAdd();

    expect(h.sessions.extend).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ expected_limit_minutes: 1, add_minutes: 10, elapsed_seconds: 60 }),
    );
    expect(client.sendPing).toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toMatch(/Time added/);

    act(() => client.handlers.onPong());
    await flush();
    expect(addButton()).toBeTruthy();
    expect(micTracks[0].enabled).toBe(false);

    act(() => client.handlers.onTtsDone());
    await flush();
    expect(addButton()).toBeNull();
    expect(micTracks[0].enabled).toBe(true);
    expect(client.sendPlaybackDone).toHaveBeenCalled();
    expect(h.sessions.end).not.toHaveBeenCalled();
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it("drops delayed replies after resume until the member's next turn", async () => {
    const client = await startSession();
    await reachLimit();
    await approveAndResume(client, 11);

    h.schedule.mockClear();
    act(() => {
      client.handlers.onSpeakingStart();
      client.handlers.onAudio(audioChunk());
      client.handlers.onAssistantText("stale reply", "final");
      // A transcript with no speech sent since resume is left over from before the hold.
      client.handlers.onUserTranscript("stale words");
      client.handlers.onAudio(audioChunk());
    });
    await flush();
    expect(h.schedule).not.toHaveBeenCalled();

    speakMic();
    act(() => {
      client.handlers.onUserTranscript("new words");
      client.handlers.onSpeakingStart();
      client.handlers.onAudio(audioChunk());
      client.handlers.onAssistantText("fresh reply", "final");
    });
    await flush();
    expect(h.schedule).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /end/i }));
    await flush();
    const endConfirm = screen.getAllByRole("button", { name: /end/i }).pop()!;
    fireEvent.click(endConfirm);
    await flush();
    await flush();
    const transcript = JSON.stringify(h.sessions.end.mock.calls[0][3]);
    expect(transcript).not.toMatch(/stale/);
    expect(transcript).toMatch(/new words/);
    expect(transcript).toMatch(/fresh reply/);
  });

  it("continues the timer from the approved limit and offers more time again", async () => {
    const client = await startSession();
    h.sessions.heartbeat.mockClear();
    await reachLimit();
    await approveAndResume(client, 6);
    // The remaining-time readout shows only the newly added time.
    expect(screen.getByText("5:00")).toBeTruthy();

    await tick(4 * 60_000);
    expect(addButton()).toBeNull();
    expect(h.sessions.heartbeat.mock.calls.at(-1)?.[1]).toBeGreaterThan(60);

    await tick(60_000 + 50);
    expect(addButton()).toBeTruthy();

    h.sessions.extend.mockResolvedValueOnce(approval(16));
    await clickAdd();
    expect(h.sessions.extend).toHaveBeenLastCalledWith(
      "s1",
      expect.objectContaining({ expected_limit_minutes: 6, elapsed_seconds: 360 }),
    );
    expect(h.sessions.end).not.toHaveBeenCalled();
  });
});

describe("rejected or failed requests stay paused", () => {
  it("shows a rejection and keeps the mic off", async () => {
    const client = await startSession();
    await reachLimit();
    h.sessions.extend.mockRejectedValueOnce(
      apiError(409, {
        approved: false,
        code: "INSUFFICIENT_BALANCE",
        available_seconds: 400,
        limit_minutes: 1,
      }),
    );
    await clickAdd();

    expect(screen.getByRole("alert").textContent).toMatch(/enough minutes/);
    expect(addButton()).toBeTruthy();
    expect(micTracks[0].enabled).toBe(false);
    expect(h.sessions.end).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "10 min" })).toBeNull();
    expect(screen.getByRole("button", { name: "5 min" })).toBeTruthy();
  });

  it("retries a failed request with the same id so it cannot add time twice", async () => {
    await startSession();
    await reachLimit();
    h.sessions.extend.mockRejectedValue(new TypeError("Failed to fetch"));
    fireEvent.click(addButton()!);
    await tick(3_000);

    expect(h.sessions.extend).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("alert").textContent).toMatch(/still paused/);
    expect(micTracks[0].enabled).toBe(false);
    const firstId = h.sessions.extend.mock.calls[0][1].request_id;

    h.sessions.extend.mockClear();
    h.sessions.extend.mockResolvedValueOnce(approval(11));
    await clickAdd();
    expect(h.sessions.extend.mock.calls[0][1].request_id).toBe(firstId);
  });
});

describe("ending from the hold", () => {
  it("ends and saves when the decision window runs out", async () => {
    const client = await startSession();
    await reachLimit();

    await tick(9 * 60_000);
    expect(addButton()).toBeTruthy();
    expect(h.sessions.end).not.toHaveBeenCalled();

    await tick(61_000);
    await flush();
    expect(h.sessions.end).toHaveBeenCalledTimes(1);
    // Waiting is not usage: the saved duration is frozen at the limit.
    expect(h.sessions.end.mock.calls[0][1]).toBe(60);
    expect(client.disconnect).toHaveBeenCalled();
    expect(micTracks[0].stop).toHaveBeenCalled();
    expect(h.toastInfo).toHaveBeenCalledWith(expect.stringMatching(/ended and been saved/));
    expect(screen.getByText(/landed:\/app\/session-lobby/)).toBeTruthy();
  });

  it("ends and saves when the socket drops, without reconnecting", async () => {
    const client = await startSession();
    await reachLimit();

    act(() => client.setStatus("reconnecting"));
    await flush();
    await flush();

    expect(h.sessions.end).toHaveBeenCalledTimes(1);
    expect(client.disconnect).toHaveBeenCalled();
    expect(addButton()).toBeNull();
    expect(h.toastInfo).toHaveBeenCalledWith(expect.stringMatching(/connection was lost/));
  });

  it("End wins over an approval that arrives late", async () => {
    const client = await startSession();
    await reachLimit();

    const pingsBefore = client.sendPing.mock.calls.length;
    let approve!: (v: unknown) => void;
    h.sessions.extend.mockReturnValueOnce(new Promise((r) => (approve = r)));
    fireEvent.click(addButton()!);
    await flush();
    await clickEnd();
    expect(h.sessions.end).toHaveBeenCalledTimes(1);
    const playbackDoneBefore = client.sendPlaybackDone.mock.calls.length;

    await act(async () => {
      approve(approval(11));
      await vi.advanceTimersByTimeAsync(0);
    });
    act(() => client.handlers.onPong());
    await tick(100);

    expect(micTracks[0].readyState).toBe("ended");
    expect(client.sendPing).toHaveBeenCalledTimes(pingsBefore);
    expect(client.sendPlaybackDone).toHaveBeenCalledTimes(playbackDoneBefore);
    expect(h.sessions.end).toHaveBeenCalledTimes(1);
  });

  it("ends and saves when a safe resume never becomes provable", async () => {
    const client = await startSession();
    act(() => client.handlers.onSpeakingStart());
    await reachLimit();
    h.sessions.extend.mockResolvedValueOnce(approval(11));
    await clickAdd();
    act(() => client.handlers.onPong());

    // The reply turn never closes.
    await tick(20_100);
    await flush();

    expect(h.sessions.end).toHaveBeenCalledTimes(1);
    expect(micTracks[0].readyState).toBe("ended");
    expect(h.toastInfo).toHaveBeenCalledWith(expect.stringMatching(/couldn't safely continue/));
  });

  it("does not resume when the server says the session already ended", async () => {
    await startSession();
    await reachLimit();
    h.sessions.extend.mockRejectedValueOnce(
      apiError(409, { approved: false, code: "SESSION_NOT_ACTIVE", limit_minutes: null }),
    );
    await clickAdd();
    await flush();

    expect(addButton()).toBeNull();
    expect(h.sessions.end).toHaveBeenCalledTimes(1);
    expect(micTracks[0].readyState).toBe("ended");
  });

  it("routes End to the cooldown screen in a high-risk session", async () => {
    await startSession();
    h.safetyState.current = "HIGH_RISK";
    await tick(1_000);
    await reachLimit();

    await clickEnd();

    expect(h.sessions.end).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/landed:\/app\/settings\/cooldown-screen/)).toBeTruthy();
  });
});

describe("browser speech recognition", () => {
  class FakeRecognition {
    static last: FakeRecognition;
    onresult: ((e: unknown) => void) | null = null;
    onend: (() => void) | null = null;
    onstart: (() => void) | null = null;
    start = vi.fn(() => this.onstart?.());
    stop = vi.fn();
    abort = vi.fn();
    constructor() {
      FakeRecognition.last = this;
    }
  }

  const finalResult = (text: string) => ({
    resultIndex: 0,
    results: Object.assign([Object.assign([{ transcript: text }], { isFinal: true })], { length: 1 }),
  });

  it("ignores late results while held and resumes listening afterwards", async () => {
    h.config.sttProvider = "browser";
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    const client = await startSession();
    await reachLimit();
    expect(FakeRecognition.last.stop).toHaveBeenCalled();

    act(() => FakeRecognition.last.onresult?.(finalResult("said at the boundary")));
    await tick(5_000);
    expect(client.sendChat).not.toHaveBeenCalled();

    FakeRecognition.last.start.mockClear();
    await approveAndResume(client, 11);
    await tick(100);
    expect(FakeRecognition.last.start).toHaveBeenCalled();
    expect(client.sendPlaybackDone).toHaveBeenCalled();
  });
});

describe("existing flows with the feature on", () => {
  it("manual Pause still stops the timer without the popup", async () => {
    const client = await startSession({ minutes: 5 });
    fireEvent.click(screen.getByRole("button", { name: "Pause session" }));
    await flush();
    await tick(10 * 60_000);

    expect(addButton()).toBeNull();
    expect(client.disconnect).not.toHaveBeenCalled();
    expect(h.sessions.end).not.toHaveBeenCalled();
  });

  it("actual account exhaustion keeps its existing popup and cutoff", async () => {
    const client = await startSession({ minutes: 5, creditsSeconds: 30 });
    await tick(30_050);

    expect(addButton()).toBeNull();
    expect(screen.getByText("Talking Paused")).toBeTruthy();
    expect(screen.getByText("Buy More Minutes")).toBeTruthy();
    expect(client.disconnect).toHaveBeenCalled();
    expect(h.sessions.end).toHaveBeenCalledTimes(1);
  });

  it("route exit from the hold finalizes through the existing keepalive path", async () => {
    const fetchSpy = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchSpy);
    const client = await startSession();
    await reachLimit();

    cleanup();
    await tick(0);

    expect(client.disconnect).toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/sessions/s1/end"),
      expect.objectContaining({ keepalive: true }),
    );
    const body = JSON.parse((fetchSpy.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(body.duration_seconds).toBe(60);
    expect(h.sessions.end).not.toHaveBeenCalled();
    expect(h.toastInfo).not.toHaveBeenCalled();
  });
});
