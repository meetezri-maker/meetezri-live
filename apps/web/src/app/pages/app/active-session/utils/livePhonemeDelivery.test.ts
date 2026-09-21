import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EzriRealtimeClient, type EzriAvatarData } from "@/lib/ezri/realtimeClient";
import type { EzriAudioSource } from "@/lib/ezri/audio";
import { EzriWsAudioScheduler } from "@/lib/ezri/wsAudioScheduler";
import { __resetRealtimeTraceForTests } from "@/lib/ezri/realtimeTrace";
import {
  createHyper3dLiveSpeechAdapter,
  type Hyper3dScheduledChunk,
} from "@/lib/avatar/hyper3d/hyper3dLiveSpeechAdapter";
import type { LiveChunkAppendResult } from "@/lib/avatar/hyper3d/liveSpeechTimeline";
import {
  retainCurrentResponseAvatarData,
  takeCurrentResponseAvatarData,
  takePendingAvatarData,
  type PendingAvatarDataEntry,
} from "./pendingAvatarData";
import { hyper3dTimelineForScheduledChunk } from "./hyper3dChunkTimeline";

/**
 * PHASE 2F.2 — PHONEME ASSOCIATION SAFETY.
 *
 * BACKEND SHAPES are the deployed ones (public Space `meetezri/ezri-ai-agent`,
 * `app/api/websockets.py`, revision 19a81a65):
 *
 *   greeting   L166-196    warmup_done, step:speaking, transcription{ai},
 *                          avatar_data{chunk_index:0, timed}, audio_start{wav}, <binary>, tts_done
 *   comfort    L1084-1107  transcription{ai}, avatar_data{chunk_index:0, ["S","T","IH1"," ",…]},
 *                          audio_start{wav}, <binary>, tts_done
 *   batch      L1310-1404  step:speaking, audio_start{wav}, avatar_data{chunk_index:n, timed, audio_b64}…, tts_done
 *   streaming  L1315-1361  audio_start{pcm_s16le}, avatar_data{timed|[], audio_b64}…, tts_done
 *   search     L1237-1263  step:searching, audio_start{wav}, <binary>          (no avatar_data)
 *   interrupt  L969-970    tts_done, interrupt
 *
 * OWNERSHIP. No response id exists and `chunk_index` restarts at 0 per
 * response, so metadata is owned by the RESPONSE EPOCH: a counter advanced by
 * the lifecycle handlers ActiveSession already has (status, warmup, step,
 * transcription, tts_done, interrupt) and NOT by `audio_start`.
 *
 * The session mirror reproduces ONLY ActiveSession's metadata/audio handlers in
 * their order and calls the same extracted functions. `hyper3dCommitted: false`
 * is the existing-avatar (Sarah) path, which must equal the pre-2F.1 behaviour.
 */

class MinimalBlob {
  readonly size: number;
  readonly type: string;
  private readonly bytes: Uint8Array;
  constructor(parts: Array<Uint8Array | ArrayBuffer>, options?: { type?: string }) {
    const chunks = parts.map((part) => (part instanceof Uint8Array ? part : new Uint8Array(part)));
    this.bytes = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0));
    let offset = 0;
    for (const chunk of chunks) {
      this.bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    this.size = this.bytes.byteLength;
    this.type = options?.type ?? "";
  }
  async arrayBuffer() {
    return this.bytes.buffer.slice(this.bytes.byteOffset, this.bytes.byteOffset + this.bytes.byteLength);
  }
}

class FakeSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static last: FakeSocket | null = null;
  readyState = FakeSocket.OPEN;
  binaryType = "blob";
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(readonly url: string) {
    FakeSocket.last = this;
  }
  send() {}
  close() {}
  json(message: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
  binary(bytes: ArrayBuffer) {
    this.onmessage?.({ data: bytes });
  }
}

class FakeAudioBuffer {
  private readonly data: Float32Array;
  constructor(readonly duration: number, readonly sampleRate = 24000) {
    this.data = new Float32Array(Math.max(1, Math.round(duration * sampleRate)));
    this.data.fill(0.4);
  }
  get length() {
    return this.data.length;
  }
  get numberOfChannels() {
    return 1;
  }
  getChannelData() {
    return this.data;
  }
}

class FakeAudioContext {
  currentTime = 12;
  state: AudioContextState = "running";
  destination = {} as AudioNode;
  sampleRate = 24000;
  createGain() {
    return { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} };
  }
  createAnalyser() {
    return { fftSize: 1024, smoothingTimeConstant: 0, connect() {}, getByteTimeDomainData() {} };
  }
  createBufferSource() {
    return { buffer: null, onended: null, connect() {}, start() {}, stop() {} };
  }
  createBuffer(_channels: number, length: number, rate: number) {
    return new FakeAudioBuffer(length / rate, rate);
  }
  async decodeAudioData(bytes: ArrayBuffer) {
    return new FakeAudioBuffer(new DataView(bytes).getFloat64(32, true)) as unknown as AudioBuffer;
  }
  async resume() {}
}

/** RIFF/WAVE frame carrying its duration, as `send_bytes(wav)`. */
function wavBytes(durationSeconds: number): ArrayBuffer {
  const bytes = new Uint8Array(64);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  bytes.set([0x57, 0x41, 0x56, 0x45], 8);
  new DataView(bytes.buffer).setFloat64(32, durationSeconds, true);
  return bytes.buffer;
}
const toBase64 = (bytes: Uint8Array) => {
  let text = "";
  for (let i = 0; i < bytes.length; i += 1) text += String.fromCharCode(bytes[i]);
  return btoa(text);
};
const wavBase64 = (durationSeconds: number) => toBase64(new Uint8Array(wavBytes(durationSeconds)));
/** Raw int16 PCM (streaming path): non-RIFF bytes, 24 kHz mono. */
const pcmBase64 = (durationSeconds: number) => {
  const bytes = new Uint8Array(Math.round(durationSeconds * 24000) * 2);
  for (let i = 0; i < bytes.length; i += 2) bytes[i] = 0x40;
  return toBase64(bytes);
};

const timed = (count: number, offset = 0) =>
  Array.from({ length: count }, (_, i) => ({
    phoneme: ["HH", "AY", "M", "S", "EH", "R", "AH"][i % 7],
    start: +(offset + i * 0.1).toFixed(3),
    end: +(offset + (i + 1) * 0.1).toFixed(3),
  }));
const SENTIMENT = { compound: 0, pos: 0, neu: 1, neg: 0 };
const GREETING = "Hi, I'm Sarah. How are you feeling today?";
const COMFORT = "Still there?";
const COMFORT_FLAT = ["S", "T", "IH1", "L", " ", "DH", "EH1", "R", " "];

type QueueItem = {
  subtitle: string;
  audio: EzriAudioSource;
  avatarData: EzriAvatarData | null;
  prePermissionWelcome?: boolean;
  sessionGreeting?: boolean;
  metadataAssociation?: string;
};

type Handoff = {
  sentence: string;
  associationMethod: string | null;
  chunk: Hyper3dScheduledChunk;
  result: LiveChunkAppendResult;
};

function mountSession(options: { hyper3dCommitted: boolean; permissionsGranted?: boolean }) {
  const ctx = new FakeAudioContext();
  const permissionsGranted = options.permissionsGranted ?? true;
  let epoch = 0;
  let pending: Array<PendingAvatarDataEntry<EzriAvatarData>> = [];
  let binarySeq = 0;
  let greetingSeen = false;
  let chunkSeq = 0;
  const reorder: Record<number, QueueItem> = {};
  let nextExpected = 0;
  const prePermissionQueue: QueueItem[] = [];
  const chunkMap = new Map<string, QueueItem>();
  const scheduled: Array<Promise<void>> = [];
  const scheduledItems: QueueItem[] = [];
  const handoffs: Handoff[] = [];

  const adapter = createHyper3dLiveSpeechAdapter({
    getContextTime: () => ctx.currentTime,
    isPipelineActive: () => true,
  });

  const scheduler = new EzriWsAudioScheduler({
    onChunkScheduled: (meta, timing) => {
      const item = meta.chunkId ? chunkMap.get(meta.chunkId) : undefined;
      if (!item) return;
      const chunk: Hyper3dScheduledChunk = {
        audioContextStartTime: timing.audioContextStartTime,
        durationMs: timing.durationMs,
        leadInSec: timing.leadInSec ?? 0,
        ...hyper3dTimelineForScheduledChunk(item.avatarData, timing.durationMs / 1000),
        chunkIndex: typeof item.avatarData?.chunk_index === "number" ? item.avatarData.chunk_index : null,
        sentence: item.avatarData?.sentence?.trim() || item.subtitle.trim(),
        scheduledAtMs: 0,
        audioBuffer: null,
        isWelcome: item.prePermissionWelcome === true || item.sessionGreeting === true,
        associationMethod: item.metadataAssociation ?? null,
      };
      const result = adapter.onChunkScheduled(chunk);
      handoffs.push({ sentence: chunk.sentence, associationMethod: chunk.associationMethod ?? null, chunk, result });
    },
  });
  scheduler.bindAudioContext(ctx as unknown as AudioContext);
  const stopSpy = vi.spyOn(scheduler, "stop");
  const ttsDoneSpy = vi.spyOn(scheduler, "setTtsDoneReceived");

  const scheduleChunk = (item: QueueItem) => {
    const chunkId = `c${chunkSeq++}`;
    chunkMap.set(chunkId, item);
    scheduledItems.push(item);
    scheduled.push(scheduler.schedule(item.audio, { subtitle: item.subtitle, chunkId }));
  };

  // ActiveSession `resetWsAudioReorderBuffer`.
  const resetReorder = (atAudioStart: boolean) => {
    for (const key of Object.keys(reorder)) delete reorder[Number(key)];
    nextExpected = 0;
    pending =
      atAudioStart && options.hyper3dCommitted ? retainCurrentResponseAvatarData(pending, epoch).kept : [];
    binarySeq = 0;
    adapter.beginTurn();
  };

  const client = new EzriRealtimeClient({
    onStatus: () => {
      epoch += 1;
    },
    onWarmupStart: () => {
      epoch += 1;
    },
    onWarmupDone: () => {
      epoch += 1;
    },
    onAssistantText: () => {
      epoch += 1;
    },
    onUserTranscript: () => {
      epoch += 1;
    },
    onPipelineStep: () => {
      epoch += 1;
    },
    onSpeakingStart: () => {
      epoch += 1;
      resetReorder(false);
      scheduler.resetForNewTurn();
    },
    onAudioStart: (info) => {
      resetReorder(true);
      scheduler.setAudioFormat(info.format, info.sampleRate);
    },
    onTtsDone: () => {
      epoch += 1;
      if (permissionsGranted) scheduler.setTtsDoneReceived();
    },
    onInterrupt: () => {
      epoch += 1;
      // `stopPlaybackAndCooldown` only runs when playback was active; the
      // stricter case (nothing playing, no client clear) is exercised here.
      if (scheduler.isPipelineActive()) {
        scheduler.stop();
        pending = [];
        binarySeq = 0;
      }
    },
    onAvatarData: (data) => {
      if (data.audio_b64) {
        const index = typeof data.chunk_index === "number" ? data.chunk_index : nextExpected;
        reorder[index] = {
          subtitle: data.sentence?.trim() || "…",
          audio: { kind: "base64", base64: data.audio_b64, mimeType: "audio/wav" },
          avatarData: data,
          metadataAssociation: "bundled",
        };
        while (reorder[nextExpected]) {
          const item = reorder[nextExpected];
          delete reorder[nextExpected];
          scheduleChunk(item);
          nextExpected += 1;
        }
      }
      pending.push({
        data,
        receivedAt: 0,
        chunkIndex: typeof data.chunk_index === "number" ? data.chunk_index : null,
        responseEpoch: epoch,
      });
    },
    onAudio: (audio) => {
      const audioEpoch = epoch;
      const seq = binarySeq++;
      let paired: EzriAvatarData | null = null;
      let method = "no-metadata";
      if (options.hyper3dCommitted) {
        const result = takeCurrentResponseAvatarData(pending, seq, audioEpoch);
        paired = result.entry?.data ?? null;
        method = result.method;
      } else {
        const entry = takePendingAvatarData(pending, seq);
        paired = entry?.data ?? null;
        method = entry ? (entry.chunkIndex === seq ? "exact-index" : "existing-fifo") : "no-metadata";
      }
      const item: QueueItem = {
        subtitle: paired?.sentence?.trim() || "…",
        audio,
        avatarData: paired,
        prePermissionWelcome: !permissionsGranted,
        sessionGreeting: !greetingSeen,
        metadataAssociation: method,
      };
      greetingSeen = true;
      if (!permissionsGranted) prePermissionQueue.push(item);
      else scheduleChunk(item);
    },
  });
  client.connect({
    wsBase: "wss://meetezri-ezri-ai-agent.hf.space/api/v1/ws/active",
    userid: "test-user",
    sessionId: "test-session",
    brainProvider: "openai",
    ttsProvider: "together_ai",
    sttProvider: "openai_realtime",
    voice: "tara",
  });
  const socket = FakeSocket.last!;
  const settle = () => Promise.all(scheduled);

  return { socket, settle, scheduledItems, handoffs, scheduler, stopSpy, ttsDoneSpy, pendingSize: () => pending.length };
}

// ── backend shapes ──────────────────────────────────────────────────────────
const meta = (socket: FakeSocket, sentence: string, phonemes: unknown, chunkIndex = 0) =>
  socket.json({ type: "avatar_data", chunk_index: chunkIndex, sentence, phonemes, sentiment: SENTIMENT });
const audioStart = (socket: FakeSocket, format = "wav") =>
  socket.json({ type: "audio_start", format, sample_rate: 24000 });

function sendGreeting(socket: FakeSocket) {
  socket.json({ type: "warmup_start" });
  socket.json({ type: "warmup_done" });
  socket.json({ type: "step", status: "speaking", message: "Sarah is greeting you..." });
  socket.json({ type: "transcription", ai: GREETING });
  meta(socket, GREETING, timed(8));
  audioStart(socket);
  socket.binary(wavBytes(3.2));
  socket.json({ type: "tts_done" });
}

function sendComfort(socket: FakeSocket) {
  socket.json({ type: "transcription", ai: COMFORT });
  meta(socket, COMFORT, COMFORT_FLAT);
  audioStart(socket);
  socket.binary(wavBytes(1.4));
  socket.json({ type: "tts_done" });
}

beforeEach(() => {
  __resetRealtimeTraceForTests();
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.stubGlobal("Blob", MinimalBlob);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Phase 2F.2 association matrix — Hyper3D runtime committed", () => {
  it("A: meta → audio_start → binary attaches by exact index", async () => {
    const s = mountSession({ hyper3dCommitted: true });
    s.socket.json({ type: "transcription", ai: "A" });
    meta(s.socket, "A", timed(4));
    audioStart(s.socket);
    s.socket.binary(wavBytes(1));
    await s.settle();
    expect(s.scheduledItems[0].avatarData?.sentence).toBe("A");
    expect(s.scheduledItems[0].metadataAssociation).toBe("exact-index");
  });

  it("B: audio_start → meta → binary attaches", async () => {
    const s = mountSession({ hyper3dCommitted: true });
    s.socket.json({ type: "transcription", ai: "B" });
    audioStart(s.socket);
    meta(s.socket, "B", timed(4));
    s.socket.binary(wavBytes(1));
    await s.settle();
    expect(s.scheduledItems[0].avatarData?.sentence).toBe("B");
    expect(s.scheduledItems[0].metadataAssociation).toBe("exact-index");
  });

  it("C: meta A → audio_start → meta B → binary A → binary B associate by explicit index", async () => {
    const s = mountSession({ hyper3dCommitted: true });
    s.socket.json({ type: "transcription", ai: "A B" });
    meta(s.socket, "A", timed(3), 0);
    audioStart(s.socket);
    meta(s.socket, "B", timed(3), 1);
    s.socket.binary(wavBytes(1));
    s.socket.binary(wavBytes(1));
    await s.settle();
    expect(s.scheduledItems.map((item) => item.avatarData?.sentence)).toEqual(["A", "B"]);
    expect(s.scheduledItems.map((item) => item.metadataAssociation)).toEqual(["exact-index", "exact-index"]);
  });

  it("C': an explicit different index never wins through FIFO", async () => {
    const s = mountSession({ hyper3dCommitted: true });
    s.socket.json({ type: "transcription", ai: "X" });
    meta(s.socket, "for chunk 1", timed(3), 1);
    audioStart(s.socket);
    s.socket.binary(wavBytes(1)); // seq 0 — its own metadata never arrived
    await s.settle();
    expect(s.scheduledItems[0].avatarData).toBeNull();
    expect(s.scheduledItems[0].metadataAssociation).toBe("no-metadata");
  });

  it("D: meta A → interrupt (no tts_done, nothing playing) → audio_start B → binary B never gets A", async () => {
    const s = mountSession({ hyper3dCommitted: true });
    s.socket.json({ type: "transcription", ai: "A" });
    meta(s.socket, "A", timed(4));
    s.socket.json({ type: "interrupt" });
    audioStart(s.socket);
    s.socket.binary(wavBytes(1));
    await s.settle();
    expect(s.scheduledItems[0].avatarData).toBeNull();
    expect(s.scheduledItems[0].metadataAssociation).toBe("no-metadata");
  });

  it("E: duplicate meta A cannot contaminate later audio in the same response", async () => {
    const s = mountSession({ hyper3dCommitted: true });
    s.socket.json({ type: "transcription", ai: "A" });
    meta(s.socket, "A", timed(4));
    meta(s.socket, "A", timed(4));
    audioStart(s.socket);
    s.socket.binary(wavBytes(1));
    audioStart(s.socket); // e.g. a second audio frame with no metadata of its own
    s.socket.binary(wavBytes(1));
    await s.settle();
    expect(s.scheduledItems[0].avatarData?.sentence).toBe("A");
    expect(s.scheduledItems[1].avatarData).toBeNull();
    expect(s.pendingSize()).toBe(0);
  });

  it("F: meta A whose audio never arrives, no tts_done, never attaches to response B (search shape)", async () => {
    const s = mountSession({ hyper3dCommitted: true });
    s.socket.json({ type: "transcription", ai: COMFORT });
    meta(s.socket, "A (abandoned)", timed(4));
    // No audio, no tts_done, no client reset. Next response opens.
    s.socket.json({ type: "transcription", user: "hello?" });
    s.socket.json({ type: "step", status: "thinking", message: "Generating response..." });
    s.socket.json({ type: "step", status: "searching", message: "Looking that up" });
    audioStart(s.socket);
    s.socket.binary(wavBytes(1));
    await s.settle();
    expect(s.scheduledItems[0].avatarData).toBeNull();
    expect(s.scheduledItems[0].metadataAssociation).toBe("no-metadata");
  });

  it("F': meta A abandoned, next response B brings its own metadata — B gets B, never A", async () => {
    const s = mountSession({ hyper3dCommitted: true });
    s.socket.json({ type: "transcription", ai: "A" });
    meta(s.socket, "A (abandoned)", timed(4));
    s.socket.json({ type: "transcription", ai: "B" });
    meta(s.socket, "B", timed(4));
    audioStart(s.socket);
    s.socket.binary(wavBytes(1));
    await s.settle();
    expect(s.scheduledItems[0].avatarData?.sentence).toBe("B");
  });

  it("G: audio without metadata does not consume stale metadata", async () => {
    const s = mountSession({ hyper3dCommitted: true });
    s.socket.json({ type: "transcription", ai: "old" });
    meta(s.socket, "old", timed(4));
    s.socket.json({ type: "step", status: "thinking", message: "…" });
    s.socket.binary(wavBytes(1)); // no audio_start in between — pairing itself must reject
    await s.settle();
    expect(s.scheduledItems[0].avatarData).toBeNull();
  });

  it("H: greeting — timestamped metadata reaches the Hyper3D scheduled chunk", async () => {
    const s = mountSession({ hyper3dCommitted: true });
    sendGreeting(s.socket);
    await s.settle();
    const [greeting] = s.handoffs;
    expect(greeting.chunk.isWelcome).toBe(true);
    expect(greeting.associationMethod).toBe("exact-index");
    expect(greeting.chunk.rawPhonemeFormat).toBe("timestamped");
    expect(greeting.chunk.timeline?.phonemes).toHaveLength(8);
    expect(greeting.result).toMatchObject({ accepted: true, appendedPhonemes: 8 });
  });

  it("H': greeting released after the permission gesture keeps its association", async () => {
    const s = mountSession({ hyper3dCommitted: true, permissionsGranted: false });
    sendGreeting(s.socket);
    await s.settle();
    expect(s.scheduledItems).toHaveLength(0); // queued, not scheduled, before permission
  });

  it("I: comfort — audio plays, untimed phonemes are withheld from Hyper3D and diagnosed", async () => {
    const s = mountSession({ hyper3dCommitted: true });
    sendGreeting(s.socket);
    await s.settle();
    sendComfort(s.socket);
    await s.settle();
    const comfort = s.handoffs[1];
    expect(s.scheduledItems[1].avatarData?.phonemes).toEqual(COMFORT_FLAT); // data preserved on the item
    expect(comfort.chunk.rawPhonemeFormat).toBe("string-fallback");
    expect(comfort.chunk.untimedPhonemeCount).toBeGreaterThan(0);
    expect(comfort.chunk.timeline).toBeNull(); // no synthetic timing handed over
    expect(comfort.result).toMatchObject({ accepted: false, reason: "no-phonemes" });
    expect(comfort.chunk.isWelcome).toBe(false);
  });

  it("J: together_ai batch — bundled path unchanged", async () => {
    const s = mountSession({ hyper3dCommitted: true });
    sendGreeting(s.socket);
    await s.settle();
    s.socket.json({ type: "transcription", user: "I'm okay." });
    s.socket.json({ type: "step", status: "thinking", message: "…" });
    s.socket.json({ type: "transcription_chunk", text: "That makes sense." });
    s.socket.json({ type: "step", status: "speaking", message: "Synthesizing audio..." });
    audioStart(s.socket);
    s.socket.json({ type: "avatar_data", chunk_index: 0, sentence: "That makes sense.", phonemes: timed(5), sentiment: SENTIMENT, audio_b64: wavBase64(1.6) });
    s.socket.json({ type: "avatar_data", chunk_index: 1, sentence: "Tell me more.", phonemes: timed(4), sentiment: SENTIMENT, audio_b64: wavBase64(1.2) });
    s.socket.json({ type: "tts_done" });
    await s.settle();
    const reply = s.handoffs.slice(1);
    expect(reply.map((h) => h.associationMethod)).toEqual(["bundled", "bundled"]);
    expect(reply.map((h) => h.result.accepted)).toEqual([true, true]);
  });

  it("K: together_ai_streaming — pcm chunks with timed and empty phonemes unchanged", async () => {
    const s = mountSession({ hyper3dCommitted: true });
    sendGreeting(s.socket);
    await s.settle();
    s.socket.json({ type: "transcription", user: "Hi." });
    s.socket.json({ type: "step", status: "speaking", message: "Synthesizing audio..." });
    audioStart(s.socket, "pcm_s16le");
    s.socket.json({ type: "avatar_data", chunk_index: 0, sentence: "Hello again.", phonemes: timed(5), sentiment: SENTIMENT, audio_b64: pcmBase64(0.5) });
    s.socket.json({ type: "avatar_data", chunk_index: 1, sentence: "", phonemes: [], sentiment: SENTIMENT, audio_b64: pcmBase64(0.5) });
    s.socket.json({ type: "tts_done" });
    await s.settle();
    const [first, second] = s.handoffs.slice(1);
    expect(first.associationMethod).toBe("bundled");
    expect(first.result.accepted).toBe(true);
    expect(second.chunk.rawPhonemeFormat).toBe("empty");
    expect(second.chunk.untimedPhonemeCount).toBe(0);
    expect(second.result).toMatchObject({ accepted: false, reason: "no-phonemes" });
  });
});

describe("Phase 2F.2 — L: Hyper3D NOT committed (existing Sarah behaviour)", () => {
  it("greeting and comfort metadata are cleared at audio_start exactly as before 2F.1", async () => {
    const s = mountSession({ hyper3dCommitted: false });
    sendGreeting(s.socket);
    await s.settle();
    sendComfort(s.socket);
    await s.settle();
    expect(s.scheduledItems.map((item) => item.avatarData)).toEqual([null, null]);
    expect(s.scheduledItems.map((item) => item.subtitle)).toEqual(["…", "…"]);
  });

  it("the original B1.1c pairing (exact → FIFO) is untouched", () => {
    const entry = (chunkIndex: number | null, sentence: string): PendingAvatarDataEntry<EzriAvatarData> => ({
      data: { sentence, phonemes: [], sentiment: null },
      receivedAt: 0,
      chunkIndex,
    });
    const queue = [entry(3, "three"), entry(0, "zero")];
    expect(takePendingAvatarData(queue, 0)?.data.sentence).toBe("zero");
    expect(takePendingAvatarData(queue, 1)?.data.sentence).toBe("three"); // FIFO, regardless of index
    expect(takePendingAvatarData(queue, 2)).toBeNull();
  });

  it("metadata after audio_start still pairs, as it always did", async () => {
    const s = mountSession({ hyper3dCommitted: false });
    audioStart(s.socket);
    meta(s.socket, "B", timed(3));
    s.socket.binary(wavBytes(1));
    await s.settle();
    expect(s.scheduledItems[0].avatarData?.sentence).toBe("B");
  });
});

describe("Phase 2F.2 — M/N: lifecycle calls are identical in both runtimes", () => {
  it("interrupt stop() and tts_done hand-off to the scheduler do not depend on the association mode", async () => {
    const counts = [];
    for (const hyper3dCommitted of [false, true]) {
      const s = mountSession({ hyper3dCommitted });
      sendGreeting(s.socket);
      await s.settle();
      s.socket.json({ type: "tts_done" });
      s.socket.json({ type: "interrupt" });
      sendComfort(s.socket);
      await s.settle();
      counts.push({ stop: s.stopSpy.mock.calls.length, ttsDone: s.ttsDoneSpy.mock.calls.length, scheduled: s.scheduledItems.length });
    }
    expect(counts[1]).toEqual(counts[0]);
  });
});

describe("pendingAvatarData pure functions", () => {
  const entry = (epoch: number, chunkIndex: number | null, bundled = false): PendingAvatarDataEntry<EzriAvatarData> => ({
    data: { sentence: `e${epoch}i${chunkIndex}`, phonemes: [], sentiment: null, ...(bundled ? { audio_b64: "AAAA" } : {}) },
    receivedAt: 0,
    chunkIndex,
    responseEpoch: epoch,
  });

  it("retain keeps only current-epoch split metadata and reports why the rest was dropped", () => {
    const result = retainCurrentResponseAvatarData([entry(1, 0), entry(2, 0), entry(2, 1, true)], 2);
    expect(result.kept.map((e) => e.data.sentence)).toEqual(["e2i0"]);
    expect(result.rejectedStale).toBe(1);
    expect(result.rejectedBundled).toBe(1);
  });

  it("take removes stale entries, never pairs bundled entries, and FIFO only covers index-less metadata", () => {
    const queue = [entry(1, 0), entry(2, 0, true), entry(2, null)];
    const result = takeCurrentResponseAvatarData(queue, 0, 2);
    expect(result.rejectedStale).toBe(1);
    expect(result.method).toBe("existing-fifo");
    expect(result.entry?.data.sentence).toBe("e2inull");
    expect(queue.map((e) => e.data.sentence)).toEqual(["e2i0"]); // bundled left for its own lifecycle
  });
});
