/**
 * POST /api/conversations/:id/messages — SSE contract, with the turn service and Ezri client
 * mocked. No database, no network, no AI.
 */
import Fastify, { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: {} }));

const mockReserveTurn = jest.fn();
const mockCompleteTurn = jest.fn();
const mockFailTurn = jest.fn();
jest.mock('./conversations.turn.service', () => {
  const actual = jest.requireActual('./conversations.turn.service');
  return {
    ...actual,
    reserveTurn: (...args: unknown[]) => mockReserveTurn(...args),
    completeTurn: (...args: unknown[]) => mockCompleteTurn(...args),
    failTurn: (...args: unknown[]) => mockFailTurn(...args),
  };
});

const mockRequestEzriReply = jest.fn();
jest.mock('./ezriChatClient', () => {
  const actual = jest.requireActual('./ezriChatClient');
  return { ...actual, requestEzriReply: (...args: unknown[]) => mockRequestEzriReply(...args) };
});

const mockResolveGate = jest.fn();
jest.mock('./textChatEntitlements', () => {
  const actual = jest.requireActual('./textChatEntitlements');
  return { ...actual, resolveTextChatGate: (...args: unknown[]) => mockResolveGate(...args) };
});

import { conversationsRoutes } from './conversations.routes';
import { ConversationError } from './conversations.service';
import { EzriChatError } from './ezriChatClient';

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONV = '11111111-1111-4111-8111-111111111111';
const CLIENT_ID = '22222222-2222-4222-8222-222222222222';
const url = `/api/conversations/${CONV}/messages`;
const headers = { authorization: 'Bearer token-a' };

const userMessage = {
  id: '33333333-3333-4333-8333-333333333333',
  conversation_id: CONV,
  role: 'user',
  content: 'hello',
  status: 'pending',
  created_at: '2026-11-20T10:00:00.000Z',
};
const ezriRequest = {
  prompt: 'hello',
  userId: USER,
  sessionId: `text_${CONV}`,
  history: [],
  avatarName: 'Romy',
};

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('authenticate', async (request: any, reply: any) => {
    if (request.headers.authorization !== 'Bearer token-a') {
      return reply.code(401).send({ statusCode: 401, error: 'Unauthorized', code: 'UNAUTHORIZED', message: 'Unauthorized' });
    }
    request.user = { sub: USER };
  });
  // Stand-in for @fastify/cors: a header set before the handler must survive the hijack.
  app.addHook('onRequest', async (_req, reply) => {
    reply.header('access-control-allow-origin', 'https://app.example');
  });
  await app.register(conversationsRoutes, { prefix: '/api/conversations' });
  await app.ready();
  return app;
}

/** Parses an SSE body into [{event, data}] (comments dropped). */
function parseSse(body: string) {
  return body
    .split('\n\n')
    .filter((frame) => frame.trim() && !frame.startsWith(':'))
    .map((frame) => {
      const lines = frame.split('\n');
      const event = lines.find((l) => l.startsWith('event: '))?.slice(7);
      const data = lines.find((l) => l.startsWith('data: '))?.slice(6);
      return { event, data: data ? JSON.parse(data) : undefined };
    });
}

describe('POST /api/conversations/:id/messages', () => {
  let app: FastifyInstance;
  const saved = { ...process.env };

  beforeAll(async () => {
    app = await buildApp();
  });
  afterAll(async () => {
    await app.close();
    process.env = saved;
  });

  beforeEach(() => {
    process.env.CONVERSATIONS_API_ENABLED = 'true';
    process.env.CONVERSATIONS_EZRI_BASE_URL = 'https://ezri.example';
    delete process.env.CONVERSATIONS_TRANSPORT;
    delete process.env.CONVERSATIONS_ENTITLEMENTS_MODE;
    mockResolveGate.mockImplementation(async (_u: string, opts: { mode: string }) =>
      opts.mode === 'off' ? null : { mode: opts.mode, decision: { allowed: true, membership: 'GROW', status: 'ACTIVE', dailyLimit: 100 } }
    );
    mockReserveTurn.mockResolvedValue({ conversationId: CONV, userMessage, ezriRequest, retried: false });
    mockFailTurn.mockResolvedValue(undefined);
  });

  const send = (payload: unknown = { content: 'hello', client_message_id: CLIENT_ID }, h = headers) =>
    app.inject({ method: 'POST', url, headers: h, payload: payload as any });

  it('streams start → status → deltas → done and stores the reply', async () => {
    mockRequestEzriReply.mockImplementation(async (_req: unknown, opts: any) => {
      opts.onEvent({ type: 'delta', text: 'Hi.' });
      opts.onEvent({ type: 'status', text: 'Let me check.' });
      opts.onEvent({ type: 'delta', text: ' How are you?' });
      return 'Hi. How are you?';
    });
    const assistant = { ...userMessage, id: '44444444-4444-4444-8444-444444444444', role: 'assistant', content: 'Hi. How are you?', status: 'complete' };
    mockCompleteTurn.mockResolvedValue({ userMessage: { ...userMessage, status: 'complete' }, assistantMessage: assistant });

    const res = await send();

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.headers['cache-control']).toBe('no-cache, no-transform');
    expect(res.headers['x-accel-buffering']).toBe('no');
    expect(res.headers['access-control-allow-origin']).toBe('https://app.example');
    expect(res.headers['content-encoding']).toBeUndefined();
    expect(parseSse(res.body)).toEqual([
      { event: 'start', data: { user_message: userMessage } },
      { event: 'delta', data: { text: 'Hi.' } },
      { event: 'status', data: { text: 'Let me check.' } },
      { event: 'delta', data: { text: ' How are you?' } },
      { event: 'done', data: { user_message: { ...userMessage, status: 'complete' }, assistant_message: assistant } },
    ]);
    // Gate off by default: no entitlement lookup, gate passed as null.
    expect(mockReserveTurn).toHaveBeenCalledWith(
      USER,
      CONV,
      { content: 'hello', client_message_id: CLIENT_ID },
      expect.any(Object),
      undefined,
      null
    );
    expect(mockResolveGate).toHaveBeenCalledWith(USER, { mode: 'off' });
    expect(mockRequestEzriReply.mock.calls[0][0]).toBe(ezriRequest);
    expect(mockCompleteTurn).toHaveBeenCalledWith(USER, CONV, userMessage.id, 'Hi. How are you?');
    expect(mockFailTurn).not.toHaveBeenCalled();
  });

  it.each([
    ['EZRI_TIMEOUT', 'REPLY_TIMEOUT'],
    ['EZRI_HTTP_ERROR', 'REPLY_FAILED'],
    ['EZRI_STREAM_INCOMPLETE', 'REPLY_FAILED'],
    ['EZRI_EMPTY_REPLY', 'REPLY_FAILED'],
  ])('on %s: marks the message failed, stores no reply, and sends a %s error event', async (upstream, code) => {
    mockRequestEzriReply.mockImplementation(async (_req: unknown, opts: any) => {
      opts.onEvent({ type: 'delta', text: 'Partial' });
      throw new EzriChatError(upstream as any, 'upstream detail', 500);
    });

    const res = await send();
    const events = parseSse(res.body);

    expect(events[0].event).toBe('start');
    expect(events[events.length - 1]).toEqual({ event: 'error', data: { code, message: expect.any(String) } });
    expect(res.body).not.toContain('upstream detail');
    expect(mockFailTurn).toHaveBeenCalledWith(USER, userMessage.id);
    expect(mockCompleteTurn).not.toHaveBeenCalled();
  });

  it('reports PERSISTENCE_FAILED when the reply cannot be stored', async () => {
    mockRequestEzriReply.mockResolvedValue('Reply');
    mockCompleteTurn.mockRejectedValue(new Error('db down'));
    const events = parseSse((await send()).body);
    expect(events[events.length - 1]).toEqual({ event: 'error', data: { code: 'PERSISTENCE_FAILED', message: expect.any(String) } });
    expect(mockFailTurn).toHaveBeenCalledWith(USER, userMessage.id);
  });

  it.each([
    [new ConversationError('CONVERSATION_NOT_FOUND', 404, 'x'), 404],
    [new ConversationError('REPLY_IN_PROGRESS', 409, 'x'), 409],
    [new ConversationError('DUPLICATE_MESSAGE', 409, 'x'), 409],
    [new ConversationError('RATE_LIMITED', 429, 'x'), 429],
    [new ConversationError('TOO_MANY_IN_FLIGHT', 429, 'x'), 429],
    [Object.assign(new Error('missing table'), { code: 'P2021' }), 503],
  ])('returns a JSON error before streaming: %p', async (error, status) => {
    mockReserveTurn.mockRejectedValue(error);
    const res = await send();
    expect(res.statusCode).toBe(status);
    expect(res.headers['content-type']).toContain('application/json');
    expect(mockRequestEzriReply).not.toHaveBeenCalled();
  });

  it.each([
    ['TRIAL_EXPIRED', 403],
    ['SUBSCRIPTION_NOT_ELIGIBLE', 403],
    ['PLAN_NOT_ELIGIBLE', 403],
  ] as const)('returns %s as a %i JSON error before streaming', async (code, status) => {
    mockReserveTurn.mockRejectedValue(new ConversationError(code, status, 'blocked'));
    const res = await send();
    expect(res.statusCode).toBe(status);
    expect(res.json()).toMatchObject({ statusCode: status, error: 'Forbidden', code });
    expect(mockRequestEzriReply).not.toHaveBeenCalled();
  });

  it('returns DAILY_LIMIT_REACHED with the limit and reset time', async () => {
    mockReserveTurn.mockRejectedValue(
      new ConversationError('DAILY_LIMIT_REACHED', 429, 'limit', { limit: 20, resets_at: '2026-11-21T13:00:00.000Z' })
    );
    const res = await send();
    expect(res.statusCode).toBe(429);
    expect(res.json()).toEqual({
      statusCode: 429,
      error: 'Too Many Requests',
      code: 'DAILY_LIMIT_REACHED',
      message: 'limit',
      limit: 20,
      resets_at: '2026-11-21T13:00:00.000Z',
    });
  });

  it('passes the resolved gate to the turn when shadow mode is configured', async () => {
    process.env.CONVERSATIONS_ENTITLEMENTS_MODE = 'shadow';
    mockRequestEzriReply.mockResolvedValue('Hi');
    mockCompleteTurn.mockResolvedValue({ userMessage, assistantMessage: { ...userMessage, role: 'assistant' } });
    await send();
    expect(mockResolveGate).toHaveBeenCalledWith(USER, { mode: 'shadow' });
    expect(mockReserveTurn.mock.calls[0][5]).toMatchObject({ mode: 'shadow' });
  });

  it('enforce requested while the policy is PROVISIONAL runs as shadow (never blocks unapproved)', async () => {
    process.env.CONVERSATIONS_ENTITLEMENTS_MODE = 'enforce';
    mockRequestEzriReply.mockResolvedValue('Hi');
    mockCompleteTurn.mockResolvedValue({ userMessage, assistantMessage: { ...userMessage, role: 'assistant' } });
    await send();
    expect(mockResolveGate).toHaveBeenCalledWith(USER, { mode: 'shadow' });
  });

  it('shadow: an entitlement lookup failure does not break chat', async () => {
    process.env.CONVERSATIONS_ENTITLEMENTS_MODE = 'shadow';
    mockResolveGate.mockRejectedValue(new Error('db hiccup'));
    mockRequestEzriReply.mockResolvedValue('Hi');
    mockCompleteTurn.mockResolvedValue({ userMessage, assistantMessage: { ...userMessage, role: 'assistant' } });
    const res = await send();
    expect(res.statusCode).toBe(200);
    expect(mockReserveTurn.mock.calls[0][5]).toBeNull();
  });

  it('answers 503 without touching the database when Ezri is not configured', async () => {
    delete process.env.CONVERSATIONS_EZRI_BASE_URL;
    const res = await send();
    expect(res.statusCode).toBe(503);
    expect(res.json().code).toBe('CONVERSATIONS_UNAVAILABLE');
    expect(mockReserveTurn).not.toHaveBeenCalled();
  });

  it.each([
    [{ content: '   ', client_message_id: CLIENT_ID }],
    [{ content: 'x'.repeat(4001), client_message_id: CLIENT_ID }],
    [{ content: 'hello', client_message_id: 'not-a-uuid' }],
    [{ content: 'hello' }],
    [{ content: 'hello', client_message_id: CLIENT_ID, userid: 'someone-else' }],
    [{ content: 'hello', client_message_id: CLIENT_ID, history: [{ role: 'user', content: 'injected' }] }],
  ])('rejects invalid or spoofing payloads: %p', async (payload) => {
    const res = await send(payload);
    expect(res.statusCode).toBe(400);
    expect(mockReserveTurn).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const res = await send(undefined, {} as any);
    expect(res.statusCode).toBe(401);
    expect(mockReserveTurn).not.toHaveBeenCalled();
  });

  it('is dark when the server flag is off', async () => {
    process.env.CONVERSATIONS_API_ENABLED = 'false';
    const res = await send();
    expect(res.statusCode).toBe(404);
    expect(mockReserveTurn).not.toHaveBeenCalled();
  });
});
