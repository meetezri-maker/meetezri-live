import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EzriRealtimeClient } from "./realtimeClient";
import { resolveEzriAvatarName } from "./avatarNameForCompanion";

/**
 * THE SESSION'S COMPANION NAME REACHES THE WIRE.
 *
 * Drives the real `EzriRealtimeClient` against a stubbed WebSocket and reads the
 * URL it builds, so these prove what the agent receives — not that the agent
 * then introduces itself by that name (that needs a live session).
 */

const openSockets: StubSocket[] = [];

class StubSocket {
  static OPEN = 1;
  readyState = 0;
  binaryType = "arraybuffer";
  onopen: (() => void) | null = null;
  onclose: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onmessage: ((e: unknown) => void) | null = null;
  constructor(readonly url: string) {
    openSockets.push(this);
  }
  send() {}
  close() {
    this.readyState = 3;
  }
}

const params = (url: string) => new URL(url).searchParams;

beforeEach(() => {
  openSockets.length = 0;
  vi.stubGlobal("WebSocket", StubSocket as unknown as typeof WebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const connectWith = (avatarName: string | null | undefined) => {
  const client = new EzriRealtimeClient();
  client.connect({
    wsBase: "wss://example.invalid/ws",
    userid: "user-1",
    sessionId: "session-1",
    brainProvider: "brain",
    ttsProvider: "tts",
    sttProvider: "stt",
    voice: "nova",
    avatar_name: avatarName,
  });
  return client;
};

describe("resolveEzriAvatarName", () => {
  it.each([
    ["sarah", "Romy"],
    ["Sara Mitchell", "Romy"],
    ["Sarah Mitchell", "Romy"],
    ["maya", "Tessa"],
    ["Maya Chen", "Tessa"],
    ["alex", "Frankie"],
    ["Alex", "Frankie"],
    ["Alex Rivera", "Frankie"],
    ["jordan", "Andre"],
    ["Jordan Taylor", "Andre"],
    ["Bianca", "Bianca"],
    ["bianca", "Bianca"],
    ["Damian", "Damian"],
    ["damian", "Damian"],
    ["Sasha", "Sasha"],
    ["sasha", "Sasha"],
  ])("%s -> %s", (stored, display) => {
    expect(resolveEzriAvatarName(stored)).toBe(display);
  });

  it.each([undefined, null, "", "   ", "Not set", "Default avatar"])(
    "returns null for missing identity (%j) instead of another companion",
    (stored) => {
      expect(resolveEzriAvatarName(stored)).toBeNull();
    },
  );

  it("keeps an admin-created companion's own name", () => {
    expect(resolveEzriAvatarName("Custom Guide")).toBe("Custom Guide");
  });
});

describe("WebSocket avatar_name query parameter", () => {
  it.each([
    ["Sara Mitchell", "Romy"],
    ["Maya Chen", "Tessa"],
    ["Alex", "Frankie"],
    ["Jordan Taylor", "Andre"],
    ["Bianca", "Bianca"],
    ["Damian", "Damian"],
    ["Sasha", "Sasha"],
  ])("%s session connects with avatar_name=%s", (stored, display) => {
    connectWith(resolveEzriAvatarName(stored));
    expect(openSockets).toHaveLength(1);
    const url = openSockets[0].url;
    expect(url).toContain(`&avatar_name=${display}`);
    expect(params(url).get("avatar_name")).toBe(display);
    // Existing params are untouched.
    expect(params(url).get("session_id")).toBe("session-1");
    expect(params(url).get("voice")).toBe("nova");
  });

  it("URL-encodes the name", () => {
    connectWith("Dr. Zoë & Co");
    const url = openSockets[0].url;
    expect(url).toContain(`&avatar_name=${encodeURIComponent("Dr. Zoë & Co")}`);
    expect(params(url).get("avatar_name")).toBe("Dr. Zoë & Co");
  });

  it.each([undefined, null, "", "   "])(
    "omits avatar_name when unresolved (%j) — never empty, never a default",
    (value) => {
      connectWith(value);
      const url = openSockets[0].url;
      expect(url).not.toContain("avatar_name");
      expect(params(url).has("avatar_name")).toBe(false);
    },
  );

  it("an unresolved session identity sends no companion name at all", () => {
    connectWith(resolveEzriAvatarName(undefined));
    const url = openSockets[0].url;
    expect(params(url).has("avatar_name")).toBe(false);
    for (const name of ["Romy", "Tessa", "Frankie", "Andre", "Sara", "Maya"]) {
      expect(url).not.toContain(name);
    }
  });
});

describe("reconnection", () => {
  it.each([
    ["Bianca", "marin"],
    ["Damian", "cedar"],
    ["Sasha", "nova"],
  ])("a %s session reconnects with the same avatar_name and voice=%s", (stored, voice) => {
    vi.useFakeTimers();
    const client = new EzriRealtimeClient();
    client.connect({
      wsBase: "wss://example.invalid/ws",
      userid: "user-1",
      sessionId: "session-1",
      brainProvider: "brain",
      ttsProvider: "tts",
      sttProvider: "stt",
      voice,
      avatar_name: resolveEzriAvatarName(stored),
    });

    const first = openSockets[0];
    first.readyState = StubSocket.OPEN;
    first.onopen?.();
    first.onclose?.({ code: 1006, reason: "network", wasClean: false });
    vi.advanceTimersByTime(60_000);

    expect(openSockets.length).toBeGreaterThan(1);
    for (const socket of openSockets) {
      expect(params(socket.url).get("avatar_name")).toBe(stored);
      expect(params(socket.url).get("voice")).toBe(voice);
    }
  });

  it("reuses avatar_name, session and voice on a reconnect", () => {
    vi.useFakeTimers();
    connectWith(resolveEzriAvatarName("Jordan Taylor"));

    const first = openSockets[0];
    first.readyState = StubSocket.OPEN;
    first.onopen?.();
    first.onclose?.({ code: 1006, reason: "network", wasClean: false });

    vi.advanceTimersByTime(60_000);

    expect(openSockets.length).toBeGreaterThan(1);
    for (const socket of openSockets) {
      const p = params(socket.url);
      expect(p.get("avatar_name")).toBe("Andre");
      expect(p.get("session_id")).toBe("session-1");
      expect(p.get("voice")).toBe("nova");
    }
  });
});
