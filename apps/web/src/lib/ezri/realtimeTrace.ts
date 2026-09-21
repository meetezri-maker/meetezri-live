/**
 * DEV-ONLY SESSION PROTOCOL TRACE.
 *
 * Published as `window.__solaceSessionProtocolTrace` (and, for continuity, the
 * same object as `window.__solaceHyper3dRealtimeTrace`). ONE object.
 *
 *   events     bounded raw receive log, recorded at the socket boundary BEFORE
 *              the client parser interprets anything
 *   lifecycle  bounded log of what ActiveSession did with that data: pending
 *              metadata before/after, which function cleared it, how binary
 *              audio was associated, what the scheduler and Hyper3D received,
 *              pipeline idle, playback_done, PCM start
 *
 * It never stores audio bytes, base64 payloads, user ids or session ids.
 * Every function is a no-op outside DEV; call sites also guard argument
 * construction with `REALTIME_TRACE_ENABLED`, so production evaluates nothing.
 */

const DEV = import.meta.env.DEV === true;

/**
 * Call sites guard argument construction with this, so production never
 * evaluates diagnostic arguments before the functions' own DEV check.
 */
export const REALTIME_TRACE_ENABLED = DEV;
const MAX_EVENTS = 200;
const MAX_LIFECYCLE = 200;
const MAX_SENTENCE = 120;

export type RealtimePhonemeShape = "timestamped" | "string" | "mixed" | "empty" | "absent" | "other";

type TraceValue = string | number | boolean | null;

export type RealtimeTraceEvent = {
  sequence: number;
  receivedAt: number;
  wallClock: string;
  kind: "json" | "binary";
  eventType: string;
  /** `step.status`, when present. */
  status: string | null;
  chunk_index: number | string | null;
  chunkIndexType: string;
  sentence: string | null;
  hasAvatarData: boolean;
  /** Shape of the `phonemes` field: timestamped objects, flat strings, … */
  avatarDataType: RealtimePhonemeShape;
  phonemeFieldPresent: boolean;
  phonemeCount: number;
  firstPhoneme: string | null;
  lastPhoneme: string | null;
  firstStart: number | null;
  lastEnd: number | null;
  hasAudioPayload: boolean;
  audioPayloadType: string | null;
  audioPayloadLength: number | null;
  sentimentPresent: boolean;
  ttsDone: boolean;
  /** Any top-level field that looks like an identifier, with its value. */
  idFields: Record<string, TraceValue>;
  /** transcription: which sides were present. */
  transcriptionSides: string | null;
  keys: string[];
};

export type RealtimeLifecycleStage =
  | "avatar_data_routed"
  | "audio_start_pending_metadata"
  | "pending_cleared"
  | "binary_audio_paired"
  | "scheduler_enqueue"
  | "chunk_scheduled"
  | "hyper3d_append"
  | "scheduler_pipeline_idle"
  | "playback_done_attempt"
  | "pcm_streaming_started";

export type RealtimeLifecycleEvent = {
  sequence: number;
  at: number;
  stage: RealtimeLifecycleStage;
  detail: Record<string, TraceValue>;
};

export type RealtimeTrace = {
  version: 2;
  connection: {
    wsHost: string | null;
    brainProvider: string | null;
    ttsProvider: string | null;
    sttProvider: string | null;
    voice: string | null;
    providerSentInQuery: boolean;
    voiceSentInQuery: boolean;
  };
  counts: {
    messages: number;
    avatarData: number;
    avatarDataWithPhonemes: number;
    avatarDataTimestamped: number;
    avatarDataUntimed: number;
    avatarDataWithAudioB64: number;
    audioStart: number;
    binaryAudio: number;
    ttsDone: number;
    messagesWithIdFields: number;
    heartbeatOrDebug: number;
  };
  events: RealtimeTraceEvent[];
  lifecycle: RealtimeLifecycleEvent[];
};

let sequence = 0;

const trace: RealtimeTrace = {
  version: 2,
  connection: {
    wsHost: null,
    brainProvider: null,
    ttsProvider: null,
    sttProvider: null,
    voice: null,
    providerSentInQuery: false,
    voiceSentInQuery: false,
  },
  counts: {
    messages: 0,
    avatarData: 0,
    avatarDataWithPhonemes: 0,
    avatarDataTimestamped: 0,
    avatarDataUntimed: 0,
    avatarDataWithAudioB64: 0,
    audioStart: 0,
    binaryAudio: 0,
    ttsDone: 0,
    messagesWithIdFields: 0,
    heartbeatOrDebug: 0,
  },
  events: [],
  lifecycle: [],
};

function publish() {
  if (typeof window === "undefined") return;
  const target = window as unknown as Record<string, unknown>;
  target.__solaceSessionProtocolTrace = trace;
  target.__solaceHyper3dRealtimeTrace = trace;
}

function push<T>(list: T[], item: T, cap: number) {
  list.push(item);
  if (list.length > cap) list.shift();
}

const now = () => (typeof performance !== "undefined" ? Math.round(performance.now()) : Date.now());

function phonemeLabel(item: unknown): string | null {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    const label = (item as Record<string, unknown>).phoneme;
    return typeof label === "string" ? label : null;
  }
  return null;
}

const timeOf = (item: unknown, key: "start" | "end"): number | null => {
  if (!item || typeof item !== "object") return null;
  const value = (item as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

/** Classifies the raw `phonemes` field without interpreting or repairing it. */
export function describeRawPhonemes(value: unknown): {
  shape: RealtimePhonemeShape;
  count: number;
  first: string | null;
  last: string | null;
  firstStart: number | null;
  lastEnd: number | null;
} {
  const none = { count: 0, first: null, last: null, firstStart: null, lastEnd: null };
  if (value === undefined) return { shape: "absent", ...none };
  const list = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? Object.values(value as Record<string, unknown>)
      : null;
  if (!list) return { shape: "other", ...none };
  if (list.length === 0) return { shape: "empty", ...none };
  let timed = 0;
  let strings = 0;
  for (const item of list) {
    if (typeof item === "string") strings += 1;
    else if (item && typeof item === "object" && typeof (item as Record<string, unknown>).start === "number") timed += 1;
  }
  const shape: RealtimePhonemeShape =
    timed === list.length ? "timestamped" : strings === list.length ? "string" : timed + strings > 0 ? "mixed" : "other";
  return {
    shape,
    count: list.length,
    first: phonemeLabel(list[0]),
    last: phonemeLabel(list[list.length - 1]),
    firstStart: timeOf(list[0], "start"),
    lastEnd: timeOf(list[list.length - 1], "end"),
  };
}

export function traceRealtimeConnect(info: {
  url: string;
  brainProvider: string;
  ttsProvider: string;
  sttProvider: string;
  voice: string;
}): void {
  if (!DEV) return;
  let host: string | null = null;
  let query: URLSearchParams | null = null;
  try {
    const parsed = new URL(info.url);
    host = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
    query = parsed.searchParams;
  } catch {
    /* diagnostics only */
  }
  trace.connection = {
    wsHost: host,
    brainProvider: info.brainProvider,
    ttsProvider: info.ttsProvider,
    sttProvider: info.sttProvider,
    voice: info.voice,
    providerSentInQuery: query?.get("tts_provider") === info.ttsProvider,
    voiceSentInQuery: query?.get("voice") === info.voice,
  };
  publish();
}

const blankEvent = (kind: RealtimeTraceEvent["kind"], eventType: string): RealtimeTraceEvent => ({
  sequence: ++sequence,
  receivedAt: now(),
  wallClock: new Date().toISOString(),
  kind,
  eventType,
  status: null,
  chunk_index: null,
  chunkIndexType: "absent",
  sentence: null,
  hasAvatarData: false,
  avatarDataType: "absent",
  phonemeFieldPresent: false,
  phonemeCount: 0,
  firstPhoneme: null,
  lastPhoneme: null,
  firstStart: null,
  lastEnd: null,
  hasAudioPayload: false,
  audioPayloadType: null,
  audioPayloadLength: null,
  sentimentPresent: false,
  ttsDone: false,
  idFields: {},
  transcriptionSides: null,
  keys: [],
});

/** A binary frame. Only its length and sniffed MIME type are recorded. */
export function traceRealtimeBinary(byteLength: number, mimeType: string): void {
  if (!DEV) return;
  trace.counts.messages += 1;
  trace.counts.binaryAudio += 1;
  const event = blankEvent("binary", "binary");
  event.hasAudioPayload = true;
  event.audioPayloadType = `binary:${mimeType}`;
  event.audioPayloadLength = byteLength;
  push(trace.events, event, MAX_EVENTS);
  publish();
}

const AUDIO_FIELDS = ["audio_b64", "audioBase64", "audio_base64", "audio", "audio_url", "audioUrl"] as const;
const ID_FIELD = /(^id$|_id$|Id$|^uuid$)/;

/** A parsed JSON frame, recorded BEFORE the client's parser interprets it. */
export function traceRealtimeJson(msg: Record<string, unknown>): void {
  if (!DEV) return;
  const eventType = typeof msg.type === "string" ? msg.type : "(no type)";
  // The backend sends `debug` (mic RMS) every 100 ms and `pong` on every ping.
  // Counted, not logged, so they cannot push the welcome out of the ring buffer.
  if (eventType === "debug" || eventType === "pong") {
    trace.counts.messages += 1;
    trace.counts.heartbeatOrDebug += 1;
    publish();
    return;
  }
  const phonemes = describeRawPhonemes(msg.phonemes);
  const audioField = AUDIO_FIELDS.find((name) => typeof msg[name] === "string" && (msg[name] as string).length > 0);
  const rawIndex = msg.chunk_index;
  const hasAvatarData = eventType === "avatar_data";

  trace.counts.messages += 1;
  if (hasAvatarData) {
    trace.counts.avatarData += 1;
    if (phonemes.count > 0) trace.counts.avatarDataWithPhonemes += 1;
    if (phonemes.shape === "timestamped") trace.counts.avatarDataTimestamped += 1;
    if (phonemes.shape === "string" || phonemes.shape === "mixed") trace.counts.avatarDataUntimed += 1;
    if (typeof msg.audio_b64 === "string" && msg.audio_b64.length > 0) trace.counts.avatarDataWithAudioB64 += 1;
  }
  if (eventType === "audio_start") trace.counts.audioStart += 1;
  if (eventType === "tts_done") trace.counts.ttsDone += 1;

  const idFields: Record<string, TraceValue> = {};
  for (const key of Object.keys(msg)) {
    if (!ID_FIELD.test(key)) continue;
    const value = msg[key];
    idFields[key] =
      typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : String(value);
  }
  if (Object.keys(idFields).length > 0) trace.counts.messagesWithIdFields += 1;

  const sentence =
    typeof msg.sentence === "string"
      ? msg.sentence
      : typeof msg.text === "string"
        ? msg.text
        : typeof msg.ai === "string"
          ? msg.ai
          : typeof msg.user === "string"
            ? msg.user
            : null;

  const event = blankEvent("json", eventType);
  event.status = typeof msg.status === "string" ? msg.status : null;
  event.chunk_index = typeof rawIndex === "number" || typeof rawIndex === "string" ? rawIndex : null;
  event.chunkIndexType = rawIndex === undefined ? "absent" : typeof rawIndex;
  event.sentence = sentence === null ? null : sentence.slice(0, MAX_SENTENCE);
  event.hasAvatarData = hasAvatarData;
  event.avatarDataType = phonemes.shape;
  event.phonemeFieldPresent = "phonemes" in msg;
  event.phonemeCount = phonemes.count;
  event.firstPhoneme = phonemes.first;
  event.lastPhoneme = phonemes.last;
  event.firstStart = phonemes.firstStart;
  event.lastEnd = phonemes.lastEnd;
  event.hasAudioPayload = Boolean(audioField);
  event.audioPayloadType = audioField ? `json:${audioField}` : null;
  event.audioPayloadLength = audioField ? (msg[audioField] as string).length : null;
  event.sentimentPresent = msg.sentiment !== undefined && msg.sentiment !== null;
  event.ttsDone = eventType === "tts_done";
  event.idFields = idFields;
  event.transcriptionSides =
    eventType === "transcription"
      ? [typeof msg.user === "string" ? "user" : null, typeof msg.ai === "string" ? "ai" : null]
          .filter(Boolean)
          .join("+") || "none"
      : null;
  event.keys = Object.keys(msg);
  push(trace.events, event, MAX_EVENTS);
  publish();
}

/** What ActiveSession did with the data. Observational only. */
export function traceRealtimeAssociation(
  stage: RealtimeLifecycleStage,
  detail: RealtimeLifecycleEvent["detail"],
): void {
  if (!DEV) return;
  push(trace.lifecycle, { sequence: ++sequence, at: now(), stage, detail }, MAX_LIFECYCLE);
  publish();
}

/** Test-only. */
export function __getRealtimeTraceForTests(): RealtimeTrace {
  return trace;
}

export function __resetRealtimeTraceForTests(): void {
  sequence = 0;
  trace.events.length = 0;
  trace.lifecycle.length = 0;
  for (const key of Object.keys(trace.counts) as Array<keyof RealtimeTrace["counts"]>) trace.counts[key] = 0;
}
