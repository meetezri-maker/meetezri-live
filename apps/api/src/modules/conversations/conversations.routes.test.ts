/**
 * Conversations Module — route + service tests against an IN-MEMORY Prisma fake.
 *
 * No database, no network, no AI. `lib/prisma` is replaced with a tiny store that understands the
 * exact query shapes the service issues (equality, `lt`, `OR`, `orderBy`, `take`, nested latest
 * message), so ownership, ordering and pagination are exercised through the real routes.
 */
import Fastify, { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';

type ConvRow = {
  id: string;
  user_id: string;
  companion_key: string;
  title: string;
  created_at: Date;
  updated_at: Date;
  last_message_at: Date;
};
type MsgRow = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: string;
  content: string;
  status: string;
  client_message_id: string | null;
  created_at: Date;
};

const store: { conversations: ConvRow[]; messages: MsgRow[]; nextError: unknown } = {
  conversations: [],
  messages: [],
  nextError: null,
};

function cmp(a: unknown, b: unknown): number {
  const av = a instanceof Date ? a.getTime() : (a as any);
  const bv = b instanceof Date ? b.getTime() : (b as any);
  return av < bv ? -1 : av > bv ? 1 : 0;
}

function matches(row: Record<string, any>, where: Record<string, any> = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'OR') return (cond as any[]).some((w) => matches(row, w));
    if (cond && typeof cond === 'object' && !(cond instanceof Date) && 'lt' in cond) {
      return cmp(row[key], cond.lt) < 0;
    }
    return cmp(row[key], cond) === 0;
  });
}

function sortBy<T extends Record<string, any>>(rows: T[], orderBy: Array<Record<string, 'asc' | 'desc'>>): T[] {
  return [...rows].sort((a, b) => {
    for (const clause of orderBy) {
      const [key, dir] = Object.entries(clause)[0];
      const c = cmp(a[key], b[key]);
      if (c !== 0) return dir === 'desc' ? -c : c;
    }
    return 0;
  });
}

function project(row: ConvRow, select: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [key, sel] of Object.entries(select)) {
    if (key === 'chat_messages') {
      const own = store.messages.filter((m) => m.conversation_id === row.id);
      out.chat_messages = sortBy(own, sel.orderBy)
        .slice(0, sel.take)
        .map((m) => ({ content: m.content }));
    } else if (sel) {
      out[key] = (row as any)[key];
    }
  }
  return out;
}

function takeError() {
  const error = store.nextError;
  store.nextError = null;
  if (error) throw error;
}

let idSeq = 0;
const newId = () => `00000000-0000-4000-8000-${String(++idSeq).padStart(12, '0')}`;

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    chat_conversations: {
      create: jest.fn(async ({ data, select }: any) => {
        takeError();
        const now = new Date();
        const row: ConvRow = {
          id: newId(),
          user_id: data.user_id,
          companion_key: data.companion_key,
          title: data.title,
          created_at: now,
          updated_at: now,
          last_message_at: now,
        };
        store.conversations.push(row);
        return project(row, select);
      }),
      findMany: jest.fn(async ({ where, orderBy, take, select }: any) => {
        takeError();
        return sortBy(store.conversations.filter((r) => matches(r, where)), orderBy)
          .slice(0, take)
          .map((r) => project(r, select));
      }),
      findFirst: jest.fn(async ({ where, select }: any) => {
        takeError();
        const row = store.conversations.find((r) => matches(r, where));
        return row ? project(row, select) : null;
      }),
    },
    chat_messages: {
      findMany: jest.fn(async ({ where, orderBy, take }: any) => {
        takeError();
        return sortBy(store.messages.filter((r) => matches(r, where)), orderBy).slice(0, take);
      }),
    },
  },
}));

// Imported after the mock so the service binds to the fake client.
import { conversationsRoutes } from './conversations.routes';
import prisma from '../../lib/prisma';

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TOKENS: Record<string, string> = { 'token-a': USER_A, 'token-b': USER_B };

const authenticate = jest.fn(async (request: any, reply: any) => {
  const sub = TOKENS[(request.headers.authorization ?? '').replace(/^Bearer /, '')];
  if (!sub) {
    return reply.code(401).send({ statusCode: 401, error: 'Unauthorized', code: 'UNAUTHORIZED', message: 'Unauthorized' });
  }
  request.user = { sub };
});

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('authenticate', authenticate);
  await app.register(conversationsRoutes, { prefix: '/api/conversations' });
  await app.ready();
  return app;
}

const asA = { authorization: 'Bearer token-a' };
const asB = { authorization: 'Bearer token-b' };

function seedConversation(userId: string, overrides: Partial<ConvRow> = {}): ConvRow {
  const at = overrides.last_message_at ?? new Date('2026-11-01T10:00:00.000Z');
  const row: ConvRow = {
    id: newId(),
    user_id: userId,
    companion_key: 'Sara Mitchell',
    title: 'Seeded',
    created_at: at,
    updated_at: at,
    last_message_at: at,
    ...overrides,
  };
  store.conversations.push(row);
  return row;
}

function seedMessage(conv: ConvRow, minute: number, overrides: Partial<MsgRow> = {}): MsgRow {
  const row: MsgRow = {
    id: newId(),
    conversation_id: conv.id,
    user_id: conv.user_id,
    role: minute % 2 === 0 ? 'user' : 'assistant',
    content: `message ${minute}`,
    status: 'complete',
    client_message_id: null,
    created_at: new Date(Date.UTC(2026, 10, 1, 10, minute)),
    ...overrides,
  };
  store.messages.push(row);
  return row;
}

describe('Conversations API', () => {
  let app: FastifyInstance;
  const originalFlag = process.env.CONVERSATIONS_API_ENABLED;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    if (originalFlag === undefined) delete process.env.CONVERSATIONS_API_ENABLED;
    else process.env.CONVERSATIONS_API_ENABLED = originalFlag;
  });

  beforeEach(() => {
    store.conversations = [];
    store.messages = [];
    store.nextError = null;
    process.env.CONVERSATIONS_API_ENABLED = 'true';
  });

  describe('feature flag (server side)', () => {
    it.each([undefined, '', 'false', 'yes', '0'])('answers 404 before auth when the flag is %p', async (value) => {
      if (value === undefined) delete process.env.CONVERSATIONS_API_ENABLED;
      else process.env.CONVERSATIONS_API_ENABLED = value;

      const res = await app.inject({ method: 'GET', url: '/api/conversations', headers: asA });

      expect(res.statusCode).toBe(404);
      expect(authenticate).not.toHaveBeenCalled();
      expect((prisma as any).chat_conversations.findMany).not.toHaveBeenCalled();
    });

    it.each(['true', 'TRUE', ' 1 '])('is enabled for %p', async (value) => {
      process.env.CONVERSATIONS_API_ENABLED = value;
      const res = await app.inject({ method: 'GET', url: '/api/conversations', headers: asA });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('authentication', () => {
    it.each([
      ['GET', '/api/conversations'],
      ['POST', '/api/conversations'],
      ['GET', '/api/conversations/00000000-0000-4000-8000-000000000999'],
      ['GET', '/api/conversations/00000000-0000-4000-8000-000000000999/messages'],
    ])('%s %s requires a token', async (method, url) => {
      const res = await app.inject({ method: method as any, url, payload: method === 'POST' ? { companion_key: 'Alex' } : undefined });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/conversations', () => {
    it('creates a conversation owned by the token user with the default title', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/conversations',
        headers: asA,
        payload: { companion_key: 'Sara Mitchell' },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body).toMatchObject({ companion_key: 'Sara Mitchell', title: 'New chat with Romy', preview: '' });
      expect(store.conversations).toHaveLength(1);
      expect(store.conversations[0].user_id).toBe(USER_A);
    });

    it.each([
      ['Alex', 'Frankie'],
      ['Jordan Taylor', 'Andre'],
      ['Maya Chen', 'Tessa'],
      ['Sara Mitchell', 'Romy'],
      ['Bianca', 'Bianca'],
      ['Damian', 'Damian'],
      ['Sasha', 'Sasha'],
    ])('accepts canonical companion %p (shown as %p) and keeps the canonical key', async (key, display) => {
      const res = await app.inject({ method: 'POST', url: '/api/conversations', headers: asA, payload: { companion_key: key } });
      expect(res.statusCode).toBe(201);
      expect(res.json().companion_key).toBe(key);
      expect(res.json().title).toBe(`New chat with ${display}`);
    });

    it.each(['Romy', 'Frankie', 'unknown', '', 'sara mitchell'])('rejects non-canonical companion %p', async (key) => {
      const res = await app.inject({ method: 'POST', url: '/api/conversations', headers: asA, payload: { companion_key: key } });
      expect(res.statusCode).toBe(400);
      expect(store.conversations).toHaveLength(0);
    });

    it('rejects a client-supplied user id (no spoofing)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/conversations',
        headers: asA,
        payload: { companion_key: 'Alex', user_id: USER_B },
      });
      expect(res.statusCode).toBe(400);
      expect(store.conversations).toHaveLength(0);
    });

    it('accepts an explicit title within limits', async () => {
      const ok = await app.inject({ method: 'POST', url: '/api/conversations', headers: asA, payload: { companion_key: 'Alex', title: '  Sleep  ' } });
      expect(ok.statusCode).toBe(201);
      expect(ok.json().title).toBe('Sleep');

      const tooLong = await app.inject({ method: 'POST', url: '/api/conversations', headers: asA, payload: { companion_key: 'Alex', title: 'x'.repeat(201) } });
      expect(tooLong.statusCode).toBe(400);
    });

    it('maps a missing profile (FK violation) to 400 PROFILE_NOT_FOUND', async () => {
      store.nextError = Object.assign(new Error('fk'), { code: 'P2003' });
      const res = await app.inject({ method: 'POST', url: '/api/conversations', headers: asA, payload: { companion_key: 'Alex' } });
      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('PROFILE_NOT_FOUND');
    });

    it('maps a missing table (SQL not yet applied) to 503 CONVERSATIONS_UNAVAILABLE', async () => {
      store.nextError = Object.assign(new Error('relation does not exist'), { code: 'P2021' });
      const res = await app.inject({ method: 'POST', url: '/api/conversations', headers: asA, payload: { companion_key: 'Alex' } });
      expect(res.statusCode).toBe(503);
      expect(res.json().code).toBe('CONVERSATIONS_UNAVAILABLE');
    });
  });

  describe('GET /api/conversations', () => {
    it('lists only the caller’s conversations, most recent first, with a latest-message preview', async () => {
      const older = seedConversation(USER_A, { last_message_at: new Date('2026-11-01T09:00:00Z') });
      const newer = seedConversation(USER_A, { last_message_at: new Date('2026-11-02T09:00:00Z') });
      seedConversation(USER_B, { last_message_at: new Date('2026-11-03T09:00:00Z') });
      seedMessage(newer, 1, { content: 'first' });
      seedMessage(newer, 2, { content: '  latest\n\nreply  ' });

      const res = await app.inject({ method: 'GET', url: '/api/conversations', headers: asA });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.items.map((c: any) => c.id)).toEqual([newer.id, older.id]);
      expect(body.items[0].preview).toBe('latest reply');
      expect(body.items[1].preview).toBe('');
      expect(body.next_cursor).toBeNull();
    });

    it('paginates with an opaque cursor without duplicates or gaps (ties broken by id)', async () => {
      const sameTime = new Date('2026-11-05T12:00:00Z');
      const rows = [
        seedConversation(USER_A, { last_message_at: sameTime }),
        seedConversation(USER_A, { last_message_at: sameTime }),
        seedConversation(USER_A, { last_message_at: new Date('2026-11-04T12:00:00Z') }),
        seedConversation(USER_A, { last_message_at: new Date('2026-11-03T12:00:00Z') }),
        seedConversation(USER_A, { last_message_at: new Date('2026-11-02T12:00:00Z') }),
      ];

      const seen: string[] = [];
      let cursor: string | null = null;
      do {
        const url: string = `/api/conversations?limit=2${cursor ? `&cursor=${cursor}` : ''}`;
        const res = await app.inject({ method: 'GET', url, headers: asA });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        seen.push(...body.items.map((c: any) => c.id));
        cursor = body.next_cursor;
      } while (cursor);

      expect(seen).toHaveLength(rows.length);
      expect(new Set(seen).size).toBe(rows.length);
    });

    it('rejects a malformed cursor and out-of-range limits', async () => {
      expect((await app.inject({ method: 'GET', url: '/api/conversations?cursor=not-a-cursor', headers: asA })).statusCode).toBe(400);
      expect((await app.inject({ method: 'GET', url: '/api/conversations?limit=0', headers: asA })).statusCode).toBe(400);
      expect((await app.inject({ method: 'GET', url: '/api/conversations?limit=51', headers: asA })).statusCode).toBe(400);
    });
  });

  describe('GET /api/conversations/:id', () => {
    it('returns the caller’s conversation', async () => {
      const conv = seedConversation(USER_A, { title: 'Mine' });
      const res = await app.inject({ method: 'GET', url: `/api/conversations/${conv.id}`, headers: asA });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ id: conv.id, title: 'Mine', companion_key: 'Sara Mitchell' });
    });

    it('answers 404 for another user’s conversation — indistinguishable from a missing one', async () => {
      const conv = seedConversation(USER_A);
      const foreign = await app.inject({ method: 'GET', url: `/api/conversations/${conv.id}`, headers: asB });
      const missing = await app.inject({
        method: 'GET',
        url: '/api/conversations/00000000-0000-4000-8000-000000000999',
        headers: asB,
      });
      expect(foreign.statusCode).toBe(404);
      expect(missing.statusCode).toBe(404);
      expect(foreign.json()).toEqual(missing.json());
    });

    it('rejects a non-uuid id', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/conversations/not-a-uuid', headers: asA });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/conversations/:id/messages', () => {
    it('returns messages oldest-first and pages backwards with next_before', async () => {
      const conv = seedConversation(USER_A);
      const msgs = [0, 1, 2, 3, 4].map((m) => seedMessage(conv, m));

      const first = await app.inject({ method: 'GET', url: `/api/conversations/${conv.id}/messages?limit=2`, headers: asA });
      expect(first.statusCode).toBe(200);
      expect(first.json().items.map((m: any) => m.id)).toEqual([msgs[3].id, msgs[4].id]);
      expect(first.json().next_before).toEqual(expect.any(String));

      const second = await app.inject({
        method: 'GET',
        url: `/api/conversations/${conv.id}/messages?limit=2&before=${first.json().next_before}`,
        headers: asA,
      });
      expect(second.json().items.map((m: any) => m.id)).toEqual([msgs[1].id, msgs[2].id]);

      const third = await app.inject({
        method: 'GET',
        url: `/api/conversations/${conv.id}/messages?limit=2&before=${second.json().next_before}`,
        headers: asA,
      });
      expect(third.json().items.map((m: any) => m.id)).toEqual([msgs[0].id]);
      expect(third.json().next_before).toBeNull();
    });

    it('exposes only the public message fields', async () => {
      const conv = seedConversation(USER_A);
      seedMessage(conv, 0, { client_message_id: '11111111-1111-4111-8111-111111111111' });
      const res = await app.inject({ method: 'GET', url: `/api/conversations/${conv.id}/messages`, headers: asA });
      expect(Object.keys(res.json().items[0]).sort()).toEqual(
        ['content', 'conversation_id', 'created_at', 'id', 'role', 'status'].sort()
      );
    });

    it('answers 404 (not an empty list) for another user’s conversation and never queries its messages', async () => {
      const conv = seedConversation(USER_A);
      seedMessage(conv, 0);
      const res = await app.inject({ method: 'GET', url: `/api/conversations/${conv.id}/messages`, headers: asB });
      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe('CONVERSATION_NOT_FOUND');
      expect((prisma as any).chat_messages.findMany).not.toHaveBeenCalled();
    });

    it('scopes the message query by both conversation and owner', async () => {
      const conv = seedConversation(USER_A);
      await app.inject({ method: 'GET', url: `/api/conversations/${conv.id}/messages`, headers: asA });
      const call = (prisma as any).chat_messages.findMany.mock.calls[0][0];
      expect(call.where).toMatchObject({ conversation_id: conv.id, user_id: USER_A });
    });
  });
});
