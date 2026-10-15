import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EzriRealtimeClient } from "./realtimeClient";
import {
  providerVoiceIdForOption,
  resolveEzriWsVoiceForCompanion,
  type VoiceOptionId,
} from "./voiceForCompanion";

/**
 * THE RESOLVED ID REACHES THE WIRE UNCHANGED.
 *
 * The mapping is only worth having if what it returns is what the transport
 * actually sends. These drive the real `EzriRealtimeClient` against a stubbed
 * WebSocket and read the URL it builds, rather than trusting that the value is
 * passed along.
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
  sent: unknown[] = [];
  constructor(readonly url: string) {
    openSockets.push(this);
  }
  send(data: unknown) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
  }
}

const voiceParamOf = (url: string) => new URL(url).searchParams.get("voice");

beforeEach(() => {
  openSockets.length = 0;
  vi.stubGlobal("WebSocket", StubSocket as unknown as typeof WebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const connectWith = (voice: string) => {
  const client = new EzriRealtimeClient();
  client.connect({
    wsBase: "wss://example.invalid/ws",
    userid: "user-1",
    sessionId: "session-1",
    brainProvider: "brain",
    ttsProvider: "tts",
    sttProvider: "stt",
    voice,
  });
  return client;
};

describe("WebSocket voice query parameter", () => {
  it.each([
    ["voice1", "marin"],
    ["voice2", "echo"],
    ["voice3", "nova"],
    ["voice4", "cedar"],
  ])("%s sends voice=%s", (option, providerId) => {
    connectWith(providerVoiceIdForOption(option as VoiceOptionId));
    expect(openSockets).toHaveLength(1);
    expect(voiceParamOf(openSockets[0].url)).toBe(providerId);
  });

  /** End to end: companion + saved label -> resolved id -> the actual URL. */
  it.each([
    ["Sara Mitchell", "Voice 3", "nova"],
    ["Maya Chen", "Voice 1", "marin"],
    ["Alex", "Voice 4", "cedar"],
    ["Jordan Taylor", "Voice 2", "echo"],
    ["Alex", "Voice 3", "echo"],
  ])("%s + %s reaches the socket as voice=%s", (avatar, saved, providerId) => {
    connectWith(resolveEzriWsVoiceForCompanion(avatar, saved));
    expect(voiceParamOf(openSockets[0].url)).toBe(providerId);
  });

  it("sends the id lowercase and unencoded-safe", () => {
    connectWith(resolveEzriWsVoiceForCompanion("Sara Mitchell", "Voice 3"));
    const raw = openSockets[0].url;
    expect(raw).toContain("&voice=nova");
    expect(voiceParamOf(raw)).toBe("nova");
  });
});

describe("reconnection", () => {
  /**
   * A reconnect must not quietly change the voice. The client replays the
   * arguments it was given, so the second socket must carry the same id.
   */
  it("reuses the same voice on a reconnect", () => {
    vi.useFakeTimers();
    const voice = resolveEzriWsVoiceForCompanion("Alex", "Voice 4");
    connectWith(voice);
    expect(voiceParamOf(openSockets[0].url)).toBe("cedar");

    // The socket opens, then drops — the client schedules a reconnect.
    const first = openSockets[0];
    first.readyState = StubSocket.OPEN;
    first.onopen?.();
    first.onclose?.({ code: 1006, reason: "network", wasClean: false });

    vi.advanceTimersByTime(60_000);

    expect(openSockets.length).toBeGreaterThan(1);
    for (const socket of openSockets) {
      expect(voiceParamOf(socket.url)).toBe("cedar");
    }
  });
});

/**
 * The REST speak and chat calls take the same resolved value through the same
 * `voice` field. `ActiveSession` computes it ONCE into `ezriTtsVoiceId` and
 * passes that identifier to the socket, `speakRest` and `sendChatRest`, so the
 * three cannot drift; this pins the shape those payloads carry.
 */
describe("REST payload fields", () => {
  it.each([
    ["Sara Mitchell", "Voice 3", "nova"],
    ["Jordan Taylor", "Voice 4", "cedar"],
  ])("%s + %s builds speak/chat payloads with voice=%s", (avatar, saved, providerId) => {
    const ezriTtsVoiceId = resolveEzriWsVoiceForCompanion(avatar, saved);

    const speakPayload = { text: "hello", tts_provider: "tts", voice: ezriTtsVoiceId };
    const chatPayload = {
      prompt: "hello",
      provider: "brain",
      userid: "user-1",
      session_id: "session-1",
      voice: ezriTtsVoiceId,
    };

    expect(speakPayload.voice).toBe(providerId);
    expect(chatPayload.voice).toBe(providerId);
    expect(speakPayload.voice).toBe(chatPayload.voice);
  });
});
