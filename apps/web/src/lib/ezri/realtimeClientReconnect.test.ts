import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EzriRealtimeClient } from "./realtimeClient";

/**
 * Ending a session calls `disconnect()`. These pin the client behaviour that teardown relies on:
 * once disconnected, neither a pending reconnect nor a late close event opens a new socket.
 */

const sockets: StubSocket[] = [];

class StubSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  readyState = 0;
  binaryType = "arraybuffer";
  onopen: (() => void) | null = null;
  onclose: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onmessage: ((e: unknown) => void) | null = null;
  constructor(readonly url: string) {
    sockets.push(this);
  }
  send() {}
  close() {
    this.readyState = 3;
  }
}

const connectArgs = {
  wsBase: "wss://example.invalid/ws",
  userid: "user-1",
  sessionId: "session-1",
  brainProvider: "brain",
  ttsProvider: "tts",
  sttProvider: "stt",
  voice: "nova",
};

beforeEach(() => {
  sockets.length = 0;
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", StubSocket as unknown as typeof WebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("EzriRealtimeClient after disconnect", () => {
  it("reconnects after an unexpected close while the session is live", () => {
    const client = new EzriRealtimeClient();
    client.connect(connectArgs);
    sockets[0].onclose?.({});
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(2);
  });

  it("cancels a pending reconnect", () => {
    const client = new EzriRealtimeClient();
    client.connect(connectArgs);
    sockets[0].onclose?.({});
    expect(client.getStatus()).toBe("reconnecting");

    client.disconnect();
    vi.advanceTimersByTime(60_000);

    expect(sockets).toHaveLength(1);
    expect(client.getStatus()).toBe("disconnected");
  });

  it("ignores a close event that arrives after disconnect", () => {
    const client = new EzriRealtimeClient();
    client.connect(connectArgs);
    const original = sockets[0];

    client.disconnect();
    original.onclose?.({});
    vi.advanceTimersByTime(60_000);

    expect(sockets).toHaveLength(1);
    expect(client.getStatus()).toBe("disconnected");
  });
});
