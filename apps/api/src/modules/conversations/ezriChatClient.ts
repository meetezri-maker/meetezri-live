/**
 * Server-side client for Ezri's text-chat endpoints. The browser never calls Ezri for text chat:
 * identity, history and companion are decided here, from Solace's own data.
 *
 * Contract (verified against the Ezri source in Phase 0, `app/api/endpoints.py`):
 *   POST {base}/api/v1/chat/stream  -> SSE: `data: {"text": "..."}`, `data: {"status": "..."}`,
 *                                      terminated by `data: [DONE]`. No error event exists: a
 *                                      failure mid-stream simply closes the connection, so a
 *                                      stream without [DONE] is treated as an error here.
 *   POST {base}/api/v1/chat         -> JSON `{ "response": "..." }` (non-streaming fallback).
 *
 * Text chunks arrive whitespace-stripped; Ezri itself rebuilds the reply with " ".join(chunks)
 * (`ezri_brain.py`), so deltas are re-joined with a single space. `status` events are spoken filler
 * ("Let me check on that…") that Ezri excludes from what it stores; they are surfaced as transient
 * status only and never become part of the reply.
 *
 * Nothing from Ezri's error bodies is forwarded to members or logs (they can contain raw
 * exception text).
 */

export type EzriTransport = 'stream' | 'json';

export interface EzriChatConfig {
  baseUrl: string;
  provider: string;
  transport: EzriTransport;
  timeoutMs: number;
  /** Sent as `X-Ezri-Service-Key` when set. Ezri does not enforce it yet (release blocker S2). */
  serviceToken?: string;
}

export type EzriChatErrorCode =
  | 'EZRI_NOT_CONFIGURED'
  | 'EZRI_HTTP_ERROR'
  | 'EZRI_NETWORK_ERROR'
  | 'EZRI_STREAM_INCOMPLETE'
  | 'EZRI_EMPTY_REPLY'
  | 'EZRI_TIMEOUT'
  | 'ABORTED';

export class EzriChatError extends Error {
  constructor(
    readonly code: EzriChatErrorCode,
    message: string,
    readonly httpStatus?: number
  ) {
    super(message);
    this.name = 'EzriChatError';
  }
}

export interface EzriHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface EzriChatRequest {
  prompt: string;
  /** Verified Solace user id (JWT `sub`). Never taken from the browser. */
  userId: string;
  /** Unique per conversation (`text_<conversationId>`); never "default" (Ezri caches by it). */
  sessionId: string;
  /** Prior turns only, oldest first; the current prompt is sent separately. */
  history: EzriHistoryItem[];
  /** Member-facing companion name Ezri recognises (Romy, Frankie, …). */
  avatarName: string;
  countryCode?: string | null;
  timezone?: string | null;
}

export type EzriChatEvent = { type: 'delta'; text: string } | { type: 'status'; text: string };

const DEFAULT_TIMEOUT_MS = 55_000;

function parseTimeout(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 5_000 && n <= 900_000 ? Math.floor(n) : DEFAULT_TIMEOUT_MS;
}

/** Reads configuration from the API environment. Returns null when Ezri is not configured. */
export function readEzriChatConfig(env: NodeJS.ProcessEnv = process.env): EzriChatConfig | null {
  const baseUrl = (env.CONVERSATIONS_EZRI_BASE_URL ?? '').trim().replace(/\/+$/, '');
  if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) return null;
  const transport = (env.CONVERSATIONS_TRANSPORT ?? '').trim().toLowerCase() === 'json' ? 'json' : 'stream';
  const serviceToken = (env.EZRI_SERVICE_TOKEN ?? '').trim();
  return {
    baseUrl,
    provider: (env.CONVERSATIONS_EZRI_PROVIDER ?? '').trim() || 'runpod',
    transport,
    timeoutMs: parseTimeout(env.CONVERSATIONS_REPLY_TIMEOUT_MS),
    ...(serviceToken ? { serviceToken } : {}),
  };
}

export function buildEzriPayload(req: EzriChatRequest, config: EzriChatConfig, stream: boolean) {
  return {
    prompt: req.prompt,
    provider: config.provider,
    userid: req.userId,
    session_id: req.sessionId,
    history: req.history.map((h) => ({ role: h.role, content: h.content })),
    avatar_name: req.avatarName,
    ...(req.countryCode ? { country_code: req.countryCode } : {}),
    ...(req.timezone ? { timezone: req.timezone } : {}),
    stream,
  };
}

/**
 * Incremental SSE frame parser. Feed raw text; it returns complete `data:` payloads. Handles frames
 * split across network chunks and both \n\n and \r\n\r\n separators.
 */
export class SseDataParser {
  private buffer = '';

  push(text: string): string[] {
    this.buffer += text.replace(/\r\n/g, '\n');
    const out: string[] = [];
    let index: number;
    while ((index = this.buffer.indexOf('\n\n')) >= 0) {
      const frame = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + 2);
      const data = frame
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).replace(/^ /, ''))
        .join('\n');
      if (data) out.push(data);
    }
    return out;
  }
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

interface RequestOptions {
  config: EzriChatConfig;
  /** Aborts when the member disconnects. */
  signal?: AbortSignal;
  onEvent?: (event: EzriChatEvent) => void;
  fetchImpl?: FetchLike;
}

/**
 * Sends one turn to Ezri and resolves with the complete reply text. Emits `delta` events whose
 * text is ready to append (separator included), so the client can simply concatenate.
 */
export async function requestEzriReply(req: EzriChatRequest, options: RequestOptions): Promise<string> {
  const { config, onEvent } = options;
  const fetchImpl: FetchLike = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const stream = config.transport === 'stream';

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, config.timeoutMs);
  const onOuterAbort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener('abort', onOuterAbort, { once: true });

  const abortError = () =>
    timedOut
      ? new EzriChatError('EZRI_TIMEOUT', 'The companion took too long to reply.')
      : new EzriChatError('ABORTED', 'The request was cancelled.');

  try {
    let res: Response;
    try {
      res = await fetchImpl(`${config.baseUrl}/api/v1/chat${stream ? '/stream' : ''}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: stream ? 'text/event-stream' : 'application/json',
          ...(config.serviceToken ? { 'X-Ezri-Service-Key': config.serviceToken } : {}),
        },
        body: JSON.stringify(buildEzriPayload(req, config, stream)),
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) throw abortError();
      throw new EzriChatError('EZRI_NETWORK_ERROR', 'The companion service could not be reached.');
    }

    if (!res.ok) {
      // Drain without reading the body into anything we keep or log.
      await res.body?.cancel().catch(() => undefined);
      throw new EzriChatError('EZRI_HTTP_ERROR', 'The companion service returned an error.', res.status);
    }

    if (!stream) {
      let payload: unknown;
      try {
        payload = await res.json();
      } catch {
        if (controller.signal.aborted) throw abortError();
        throw new EzriChatError('EZRI_HTTP_ERROR', 'The companion service returned an unreadable reply.');
      }
      const text = typeof (payload as { response?: unknown })?.response === 'string'
        ? ((payload as { response: string }).response).trim()
        : '';
      if (!text) throw new EzriChatError('EZRI_EMPTY_REPLY', 'The companion did not reply.');
      onEvent?.({ type: 'delta', text });
      return text;
    }

    if (!res.body) throw new EzriChatError('EZRI_STREAM_INCOMPLETE', 'The reply stream was empty.');

    const parser = new SseDataParser();
    const decoder = new TextDecoder();
    const reader = res.body.getReader();
    const parts: string[] = [];
    let done = false;

    try {
      while (!done) {
        const { value, done: ended } = await reader.read();
        if (ended) break;
        for (const data of parser.push(decoder.decode(value, { stream: true }))) {
          if (data === '[DONE]') {
            done = true;
            break;
          }
          let parsed: { text?: unknown; status?: unknown };
          try {
            parsed = JSON.parse(data);
          } catch {
            continue; // Unknown frame: ignore rather than surface raw upstream text.
          }
          if (typeof parsed.text === 'string' && parsed.text.trim()) {
            const chunk = parsed.text.trim();
            onEvent?.({ type: 'delta', text: parts.length ? ` ${chunk}` : chunk });
            parts.push(chunk);
          } else if (typeof parsed.status === 'string' && parsed.status.trim()) {
            onEvent?.({ type: 'status', text: parsed.status.trim() });
          }
        }
      }
    } catch {
      if (controller.signal.aborted) throw abortError();
      throw new EzriChatError('EZRI_STREAM_INCOMPLETE', 'The reply was interrupted.');
    } finally {
      if (!done) await reader.cancel().catch(() => undefined);
    }

    if (!done) {
      if (controller.signal.aborted) throw abortError();
      throw new EzriChatError('EZRI_STREAM_INCOMPLETE', 'The reply was interrupted.');
    }
    const text = parts.join(' ');
    if (!text) throw new EzriChatError('EZRI_EMPTY_REPLY', 'The companion did not reply.');
    return text;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onOuterAbort);
  }
}
