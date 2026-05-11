import type { EzriAudioSource } from "./audio";
import { looksLikeBase64, sniffMimeFromBytes } from "./audio";

export type EzriWsStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

export type EzriRealtimeConnectArgs = {
  wsBase: string;
  userid: string;
  sessionId: string;
  brainProvider: string;
  ttsProvider: string;
  sttProvider: string;
  /** TTS voice id for the server (e.g. `af_heart`, `am_echo`, `af_sky`). */
  voice: string;
};

export type EzriAvatarData = {
  sentence: string;
  phonemes: unknown;
  sentiment: unknown;
  chunk_index?: number;
};

export type EzriRealtimeClientHandlers = {
  onStatus?: (status: EzriWsStatus) => void;
  onAssistantText?: (text: string, kind: "partial" | "final") => void;
  /** HF / reference backend: `{ type: "transcription", user, ai }` — user line for the UI. */
  onUserTranscript?: (text: string) => void;
  onAudio?: (audio: EzriAudioSource) => void;
  onTtsDone?: () => void;
  onInterrupt?: () => void;
  /** Fired when the backend commits to speaking (step: speaking) — BEFORE first audio byte.
   *  Use to pause browser STT as early as possible to prevent mis-detection of echo. */
  onSpeakingStart?: () => void;
  /** Backend-computed phonemes + sentiment for each TTS sentence. Useful for lip sync / expressions. */
  onAvatarData?: (data: EzriAvatarData) => void;
  onError?: (error: unknown, context?: any) => void;
  onUnknownMessage?: (raw: unknown) => void;
};

type AnyObj = Record<string, any>;

function safeJsonParse(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function extractText(msg: AnyObj): { text: string; kind: "partial" | "final" } | null {
  const type = typeof msg.type === "string" ? msg.type : "";
  // The reference backend emits lots of UI/progress messages. These are NOT assistant replies.
  // - step: {status, message}
  // - status: {text}
  // - debug/warning: telemetry
  if (type === "step" || type === "status" || type === "debug" || type === "warning") return null;
  // `transcription` is handled in onmessage (user + ai); do not route through here.
  if (type === "transcription") return null;
  const text =
    (typeof msg.text === "string" && msg.text) ||
    (typeof msg.message === "string" && msg.message) ||
    (typeof msg.content === "string" && msg.content) ||
    "";

  const delta =
    (typeof msg.text_delta === "string" && msg.text_delta) ||
    (typeof msg.delta === "string" && msg.delta) ||
    "";

  if (delta) return { text: delta, kind: "partial" };

  if (text) {
    if (type.includes("partial") || type.includes("delta") || msg.is_partial === true) {
      return { text, kind: "partial" };
    }
    return { text, kind: "final" };
  }

  return null;
}

function extractAudio(msg: AnyObj): EzriAudioSource | null {
  const url =
    (typeof msg.audio_url === "string" && msg.audio_url) ||
    (typeof msg.audioUrl === "string" && msg.audioUrl) ||
    (typeof msg.url === "string" && msg.url) ||
    "";
  if (url && /^https?:\/\//i.test(url)) return { kind: "url", url };

  const b64 =
    (typeof msg.audio_base64 === "string" && msg.audio_base64) ||
    (typeof msg.audioBase64 === "string" && msg.audioBase64) ||
    (typeof msg.audio === "string" && looksLikeBase64(msg.audio) ? msg.audio : "") ||
    "";
  if (b64) return { kind: "base64", base64: b64, mimeType: typeof msg.mime_type === "string" ? msg.mime_type : undefined };

  return null;
}

export class EzriRealtimeClient {
  private ws: WebSocket | null = null;
  private status: EzriWsStatus = "disconnected";
  private reconnectAttempt = 0;
  private reconnectTimer: number | null = null;
  private connectArgs: EzriRealtimeConnectArgs | null = null;
  private handlers: EzriRealtimeClientHandlers;
  private manuallyClosed = false;

  constructor(handlers: EzriRealtimeClientHandlers = {}) {
    this.handlers = handlers;
  }

  getStatus(): EzriWsStatus {
    return this.status;
  }

  private setStatus(next: EzriWsStatus) {
    if (this.status === next) return;
    this.status = next;
    this.handlers.onStatus?.(next);
  }

  private clearReconnect() {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  connect(args: EzriRealtimeConnectArgs) {
    this.connectArgs = args;
    this.manuallyClosed = false;
    this.clearReconnect();

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus(this.reconnectAttempt > 0 ? "reconnecting" : "connecting");

    const wsBase = args.wsBase;
    const url =
      `${wsBase}?` +
      `brain_provider=${encodeURIComponent(args.brainProvider)}` +
      `&tts_provider=${encodeURIComponent(args.ttsProvider)}` +
      `&stt_provider=${encodeURIComponent(args.sttProvider)}` +
      `&userid=${encodeURIComponent(args.userid)}` +
      `&session_id=${encodeURIComponent(args.sessionId)}` +
      `&voice=${encodeURIComponent(args.voice)}`;

    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      this.handlers.onError?.(e, { stage: "ws_constructor" });
      this.scheduleReconnect();
      return;
    }

    const ws = this.ws;
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.setStatus("connected");
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        // `Ai/frontend/app.js` always uses audio/mpeg; RunPod may return WAV — sniff magic bytes
        // so the Blob type matches payload (wrong MIME → MediaError on decode).
        const bytes = new Uint8Array(event.data);
        if (bytes.byteLength < 32) {
          this.handlers.onUnknownMessage?.({ _note: "binary_too_small", length: bytes.byteLength });
          return;
        }
        const mimeType = sniffMimeFromBytes(bytes);
        const blob = new Blob([bytes], { type: mimeType });
        this.handlers.onAudio?.({ kind: "blob", blob });
        return;
      }

      const parsed = typeof event.data === "string" ? safeJsonParse(event.data) : null;
      if (!parsed || typeof parsed !== "object") {
        this.handlers.onUnknownMessage?.(event.data);
        return;
      }

      const msg = parsed as AnyObj;

      const errType = typeof msg.type === "string" ? msg.type.toLowerCase() : "";
      if (errType === "error" || errType === "ezri_error") {
        const em =
          (typeof msg.message === "string" && msg.message) ||
          (typeof msg.detail === "string" && msg.detail) ||
          "Ezri server error";
        this.handlers.onError?.(em, { stage: "server_error", raw: msg });
        return;
      }

      if (errType === "tts_done") {
        this.handlers.onTtsDone?.();
        return;
      }

      if (errType === "interrupt") {
        this.handlers.onInterrupt?.();
        return;
      }

      if (errType === "pong") {
        // Heartbeat response — nothing to do, connection is alive
        return;
      }

      // step: speaking → backend committed to speaking, pause STT before first byte arrives.
      if (errType === "step" && typeof msg.status === "string" && msg.status === "speaking") {
        this.handlers.onSpeakingStart?.();
        return;
      }

      // avatar_data → per-sentence phonemes + sentiment for lip sync / expressions.
      if (errType === "avatar_data") {
        this.handlers.onAvatarData?.({
          sentence: typeof msg.sentence === "string" ? msg.sentence : "",
          phonemes: msg.phonemes,
          sentiment: msg.sentiment,
          chunk_index: typeof msg.chunk_index === "number" ? msg.chunk_index : undefined,
        });
        return;
      }

      // Reference `app.js`: append both user and assistant from one message.
      if (errType === "transcription") {
        const audioTn = extractAudio(msg);
        if (audioTn) this.handlers.onAudio?.(audioTn);

        const nested =
          msg.data !== null &&
          typeof msg.data === "object" &&
          !Array.isArray(msg.data)
            ? (msg.data as AnyObj)
            : null;

        const userRaw =
          (typeof msg.user === "string" && msg.user) ||
          (typeof msg.user_text === "string" && msg.user_text) ||
          (typeof msg.userText === "string" && msg.userText) ||
          (nested && typeof nested.user === "string" && nested.user) ||
          (nested && typeof nested.user_text === "string" && nested.user_text) ||
          "";
        const userT = userRaw.trim();

        const aiRaw =
          (typeof msg.ai === "string" && msg.ai) ||
          (typeof msg.assistant === "string" && msg.assistant) ||
          (nested && typeof nested.ai === "string" && nested.ai) ||
          (nested && typeof nested.assistant === "string" && nested.assistant) ||
          "";
        const aiT = aiRaw.trim();

        if (userT) this.handlers.onUserTranscript?.(userT);
        if (aiT) this.handlers.onAssistantText?.(aiT, "final");

        if (!audioTn && !userT && !aiT) {
          this.handlers.onUnknownMessage?.(msg);
        }
        return;
      }

      const audio = extractAudio(msg);
      if (audio) this.handlers.onAudio?.(audio);

      const text = extractText(msg);
      if (text) this.handlers.onAssistantText?.(text.text, text.kind);

      if (!audio && !text) {
        this.handlers.onUnknownMessage?.(msg);
      }
    };

    ws.onerror = (event) => {
      this.handlers.onError?.(event, { stage: "ws_error" });
    };

    ws.onclose = () => {
      this.ws = null;
      if (this.manuallyClosed) {
        this.setStatus("disconnected");
        return;
      }
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    this.clearReconnect();
    this.reconnectAttempt += 1;
    this.setStatus("reconnecting");

    const baseDelay = 1000;
    const cap = 15000;
    const delay = Math.min(cap, baseDelay * Math.pow(2, Math.max(0, this.reconnectAttempt - 1)));

    this.reconnectTimer = window.setTimeout(() => {
      if (this.manuallyClosed) return;
      if (!this.connectArgs) return;
      this.connect(this.connectArgs);
    }, delay);
  }

  sendChat(text: string) {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error("Ezri WebSocket is not connected.");
    }
    ws.send(JSON.stringify({ type: "chat", text }));
  }

  /** Best-effort (matches ping/pcm) — barge-in must not throw if the socket is mid-flush. */
  sendPlaybackDone(): boolean {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    try {
      ws.send(JSON.stringify({ type: "playback_done" }));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Tell the server to cancel the current TTS/brain turn. Reference UI only handles
   * incoming `{type:"interrupt"}`; we also send `source` for logging when supported.
   */
  sendInterrupt(source = "client_barge_in"): boolean {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    try {
      ws.send(JSON.stringify({ type: "interrupt", source }));
      return true;
    } catch {
      return false;
    }
  }

  /** Send a heartbeat ping to prevent HF Space nginx idle-timeout (60 s). */
  sendPing() {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "ping" }));
  }

  /** Send a raw Int16 PCM buffer to the server for backend VAD + STT processing. */
  sendPcm(buffer: ArrayBuffer) {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(buffer);
  }

  disconnect() {
    this.manuallyClosed = true;
    this.clearReconnect();
    try {
      this.ws?.close();
    } catch {}
    this.ws = null;
    this.setStatus("disconnected");
  }
}

