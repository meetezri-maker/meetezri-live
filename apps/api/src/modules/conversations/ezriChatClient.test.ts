/**
 * Ezri chat client — mocked fetch only. No network, no AI.
 */
import {
  EzriChatError,
  SseDataParser,
  buildEzriPayload,
  readEzriChatConfig,
  requestEzriReply,
  type EzriChatConfig,
  type EzriChatEvent,
  type EzriChatRequest,
} from './ezriChatClient';

const config: EzriChatConfig = {
  baseUrl: 'https://ezri.example',
  provider: 'runpod',
  transport: 'stream',
  timeoutMs: 5_000,
};

const request: EzriChatRequest = {
  prompt: 'I feel tense today',
  userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  sessionId: 'text_11111111-1111-4111-8111-111111111111',
  history: [
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: 'Hello.' },
  ],
  avatarName: 'Romy',
  countryCode: 'AU',
  timezone: 'Australia/Sydney',
};

/** A Response whose body yields the given text chunks (optionally hanging before the end). */
function streamResponse(chunks: string[], opts: { status?: number; hang?: boolean; failAfter?: boolean } = {}) {
  const encoder = new TextEncoder();
  let i = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i++]));
        return;
      }
      if (opts.failAfter) {
        controller.error(new Error('socket hang up'));
        return;
      }
      if (opts.hang) return new Promise(() => undefined);
      controller.close();
    },
  });
  return new Response(body, { status: opts.status ?? 200, headers: { 'Content-Type': 'text/event-stream' } });
}

const frame = (data: unknown) => `data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`;

function run(response: Response | (() => Promise<Response>), overrides: Partial<EzriChatConfig> = {}, signal?: AbortSignal) {
  const events: EzriChatEvent[] = [];
  const fetchImpl = jest.fn(async (_url: string, init: RequestInit) => {
    if (typeof response === 'function') return response();
    // Respect aborts like real fetch does for the body.
    init.signal?.addEventListener('abort', () => undefined);
    return response;
  });
  const promise = requestEzriReply(request, {
    config: { ...config, ...overrides },
    onEvent: (e) => events.push(e),
    fetchImpl,
    signal,
  });
  return { promise, events, fetchImpl };
}

describe('readEzriChatConfig', () => {
  it('returns null when the base URL is missing or not http(s)', () => {
    expect(readEzriChatConfig({})).toBeNull();
    expect(readEzriChatConfig({ CONVERSATIONS_EZRI_BASE_URL: 'ftp://x' })).toBeNull();
  });

  it('applies defaults and bounds', () => {
    expect(readEzriChatConfig({ CONVERSATIONS_EZRI_BASE_URL: 'https://e.example/' })).toEqual({
      baseUrl: 'https://e.example',
      provider: 'runpod',
      transport: 'stream',
      timeoutMs: 55_000,
    });
    const custom = readEzriChatConfig({
      CONVERSATIONS_EZRI_BASE_URL: 'https://e.example',
      CONVERSATIONS_TRANSPORT: 'JSON',
      CONVERSATIONS_EZRI_PROVIDER: 'openai',
      CONVERSATIONS_REPLY_TIMEOUT_MS: '120000',
      EZRI_SERVICE_TOKEN: ' secret ',
    });
    expect(custom).toMatchObject({ transport: 'json', provider: 'openai', timeoutMs: 120_000, serviceToken: 'secret' });
    expect(readEzriChatConfig({ CONVERSATIONS_EZRI_BASE_URL: 'https://e.example', CONVERSATIONS_REPLY_TIMEOUT_MS: '10' })?.timeoutMs).toBe(55_000);
  });
});

describe('buildEzriPayload', () => {
  it('sends the server-decided identity, session, companion and history in Ezri’s contract', () => {
    expect(buildEzriPayload(request, config, true)).toEqual({
      prompt: 'I feel tense today',
      provider: 'runpod',
      userid: request.userId,
      session_id: request.sessionId,
      history: request.history,
      avatar_name: 'Romy',
      country_code: 'AU',
      timezone: 'Australia/Sydney',
      stream: true,
    });
  });

  it('omits empty locale fields', () => {
    const payload = buildEzriPayload({ ...request, countryCode: null, timezone: null }, config, false);
    expect(payload).not.toHaveProperty('country_code');
    expect(payload).not.toHaveProperty('timezone');
  });
});

describe('SseDataParser', () => {
  it('reassembles frames split across chunks and CRLF separators', () => {
    const parser = new SseDataParser();
    expect(parser.push('data: {"te')).toEqual([]);
    expect(parser.push('xt":"a"}\r\n\r\ndata: [DO')).toEqual(['{"text":"a"}']);
    expect(parser.push('NE]\n\n')).toEqual(['[DONE]']);
  });

  it('ignores comments and non-data lines', () => {
    const parser = new SseDataParser();
    expect(parser.push(': ping\n\nevent: x\ndata: 1\n\n')).toEqual(['1']);
  });
});

describe('requestEzriReply — streaming', () => {
  it('posts to /chat/stream and joins chunks with a space, as Ezri does', async () => {
    const { promise, events, fetchImpl } = run(
      streamResponse([
        frame({ text: 'Hello.', avatar_name: 'Romy' }),
        frame({ status: 'Let me check on that.' }),
        frame({ text: ' How are you? ' }),
        frame('[DONE]'),
      ])
    );

    await expect(promise).resolves.toBe('Hello. How are you?');
    expect(events).toEqual([
      { type: 'delta', text: 'Hello.' },
      { type: 'status', text: 'Let me check on that.' },
      { type: 'delta', text: ' How are you?' },
    ]);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://ezri.example/api/v1/chat/stream');
    expect(JSON.parse(String(init.body))).toMatchObject({ userid: request.userId, stream: true });
    expect((init.headers as Record<string, string>)['X-Ezri-Service-Key']).toBeUndefined();
  });

  it('sends the service key header when configured', async () => {
    const { promise, fetchImpl } = run(streamResponse([frame({ text: 'Hi' }), frame('[DONE]')]), { serviceToken: 'k' });
    await promise;
    expect((fetchImpl.mock.calls[0][1].headers as Record<string, string>)['X-Ezri-Service-Key']).toBe('k');
  });

  it('treats a stream that ends without [DONE] as incomplete (Ezri has no error event)', async () => {
    const { promise } = run(streamResponse([frame({ text: 'Partial' })]));
    await expect(promise).rejects.toMatchObject({ code: 'EZRI_STREAM_INCOMPLETE' });
  });

  it('treats a dropped connection as incomplete', async () => {
    const { promise } = run(streamResponse([frame({ text: 'Partial' })], { failAfter: true }));
    await expect(promise).rejects.toMatchObject({ code: 'EZRI_STREAM_INCOMPLETE' });
  });

  it('rejects an empty reply', async () => {
    const { promise } = run(streamResponse([frame({ status: 'thinking' }), frame('[DONE]')]));
    await expect(promise).rejects.toMatchObject({ code: 'EZRI_EMPTY_REPLY' });
  });

  it('ignores malformed frames instead of surfacing them', async () => {
    const { promise, events } = run(streamResponse(['data: <html>oops\n\n', frame({ text: 'Ok' }), frame('[DONE]')]));
    await expect(promise).resolves.toBe('Ok');
    expect(events).toEqual([{ type: 'delta', text: 'Ok' }]);
  });

  it('maps HTTP errors without exposing the upstream body', async () => {
    const { promise } = run(new Response('Traceback: secret detail', { status: 500 }));
    const error = await promise.catch((e) => e);
    expect(error).toBeInstanceOf(EzriChatError);
    expect(error.code).toBe('EZRI_HTTP_ERROR');
    expect(error.httpStatus).toBe(500);
    expect(error.message).not.toContain('secret');
  });

  it('maps network failures', async () => {
    const { promise } = run(() => Promise.reject(new TypeError('fetch failed')));
    await expect(promise).rejects.toMatchObject({ code: 'EZRI_NETWORK_ERROR' });
  });

  it('times out a stream that stops producing data', async () => {
    jest.useFakeTimers();
    try {
      const fetchImpl = jest.fn(async (_url: string, init: RequestInit) => {
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(frame({ text: 'Hi' })));
            init.signal?.addEventListener('abort', () => controller.error(new Error('aborted')));
          },
        });
        return new Response(body, { status: 200 });
      });
      const promise = requestEzriReply(request, { config: { ...config, timeoutMs: 5_000 }, fetchImpl });
      const settled = promise.catch((e) => e);
      await jest.advanceTimersByTimeAsync(5_001);
      expect(await settled).toMatchObject({ code: 'EZRI_TIMEOUT' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('cancels when the member disconnects (outer signal)', async () => {
    const outer = new AbortController();
    const fetchImpl = jest.fn(async (_url: string, init: RequestInit) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          init.signal?.addEventListener('abort', () => controller.error(new Error('aborted')));
        },
      });
      return new Response(body, { status: 200 });
    });
    const promise = requestEzriReply(request, { config, fetchImpl, signal: outer.signal });
    setTimeout(() => outer.abort(), 10);
    await expect(promise).rejects.toMatchObject({ code: 'ABORTED' });
  });
});

describe('requestEzriReply — JSON fallback', () => {
  it('posts to /chat and returns `response` as one delta', async () => {
    const { promise, events, fetchImpl } = run(
      new Response(JSON.stringify({ response: ' Hello there. ', avatar_name: 'Romy' }), { status: 200 }),
      { transport: 'json' }
    );
    await expect(promise).resolves.toBe('Hello there.');
    expect(events).toEqual([{ type: 'delta', text: 'Hello there.' }]);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://ezri.example/api/v1/chat');
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1].body)).stream).toBe(false);
  });

  it('rejects an empty JSON reply', async () => {
    const { promise } = run(new Response(JSON.stringify({ response: '' }), { status: 200 }), { transport: 'json' });
    await expect(promise).rejects.toMatchObject({ code: 'EZRI_EMPTY_REPLY' });
  });
});
