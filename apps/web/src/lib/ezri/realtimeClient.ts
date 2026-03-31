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
};

export type EzriRealtimeClientHandlers = {
  onStatus?: (status: EzriWsStatus) => void;
  onAssistantText?: (text: string, kind: "partial" | "final") => void;
  onAudio?: (audio: EzriAudioSource) => void;
  onTtsDone?: () => void;
  onInterrupt?: () => void;
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
  // HF Space / reference backend sends: { type:"transcription", user:"...", ai:"..." }
  if (type === "transcription") {
    if (typeof msg.ai === "string" && msg.ai.trim()) return { text: msg.ai, kind: "final" };
    // user transcription is handled elsewhere in the app; ignore here
  }
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
      `&session_id=${encodeURIComponent(args.sessionId)}`;

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

  sendPlaybackDone() {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error("Ezri WebSocket is not connected.");
    }
    ws.send(JSON.stringify({ type: "playback_done" }));
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

