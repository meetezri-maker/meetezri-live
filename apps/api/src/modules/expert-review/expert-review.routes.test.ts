import Fastify, { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { expertReviewRoutes } from './expert-review.routes';
import { resetAiSupabaseClientForTests } from '../../config/aiSupabase';

type ConversationRow = {
  id: string;
  userid: string;
  session_id: string | null;
  user_query: string;
  brain_output: string;
  created_at: string | null;
  query_embedding?: number[];
  expert_analysis: string | null;
  expert_rephrased: string | null;
  is_reviewed: boolean | null;
};

const seedRows: ConversationRow[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    userid: 'user-a',
    session_id: 'session-a',
    user_query: 'I feel anxious',
    brain_output: 'Let us slow down together.',
    created_at: '2026-08-04T10:00:00.000Z',
    query_embedding: [0.1, 0.2],
    expert_analysis: 'Supportive existing analysis',
    expert_rephrased: 'Try a grounded breathing prompt.',
    is_reviewed: true,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    userid: 'user-b',
    session_id: null,
    user_query: 'I cannot sleep',
    brain_output: 'Tell me what tonight has felt like.',
    created_at: '2026-08-04T09:00:00.000Z',
    query_embedding: [0.3, 0.4],
    expert_analysis: null,
    expert_rephrased: null,
    is_reviewed: false,
  },
];

let rows: ConversationRow[] = [];
let shouldFailAiDatabase = false;
let updatePayloads: Array<Record<string, unknown>> = [];

var mockAuditLogsCreate: jest.Mock;

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    audit_logs: {
      create: (...args: unknown[]) => mockAuditLogsCreate(...args),
    },
  },
}));

function projectSelectedFields(row: ConversationRow, selectArg: string) {
  const fields = selectArg.split(',').map((field) => field.trim());
  return Object.fromEntries(fields.map((field) => [field, (row as any)[field]]));
}

function createSelectQueryBuilder(selectArg: string) {
  const filters: Array<(row: ConversationRow) => boolean> = [];
  let rangeStart = 0;
  let rangeEnd = rows.length - 1;

  const builder: any = {
    order() {
      return builder;
    },
    range(from: number, to: number) {
      rangeStart = from;
      rangeEnd = to;
      return builder;
    },
    eq(column: keyof ConversationRow, value: unknown) {
      filters.push((row) => row[column] === value);
      return builder;
    },
    gte(column: keyof ConversationRow, value: string) {
      filters.push((row) => String(row[column]) >= value);
      return builder;
    },
    lte(column: keyof ConversationRow, value: string) {
      filters.push((row) => String(row[column]) <= value);
      return builder;
    },
    maybeSingle() {
      return {
        then(resolve: (value: unknown) => void) {
          if (shouldFailAiDatabase) {
            resolve({ data: null, error: { message: 'connection refused', details: 'secret' } });
            return;
          }
          const filtered = rows.filter((row) => filters.every((filter) => filter(row)));
          resolve({
            data: filtered[0] ? projectSelectedFields(filtered[0], selectArg) : null,
            error: null,
          });
        },
      };
    },
    then(resolve: (value: unknown) => void) {
      if (shouldFailAiDatabase) {
        resolve({ data: null, error: { message: 'connection refused', details: 'secret' }, count: null });
        return;
      }

      const filtered = rows.filter((row) => filters.every((filter) => filter(row)));
      const paged = filtered.slice(rangeStart, rangeEnd + 1);
      resolve({
        data: paged.map((row) => projectSelectedFields(row, selectArg)),
        error: null,
        count: filtered.length,
      });
    },
  };

  return builder;
}

function createUpdateQueryBuilder(updateData: Record<string, unknown>) {
  const filters: Array<(row: ConversationRow) => boolean> = [];
  let selectArg = '';

  const builder: any = {
    eq(column: keyof ConversationRow, value: unknown) {
      filters.push((row) => row[column] === value);
      return builder;
    },
    select(arg: string) {
      selectArg = arg;
      return builder;
    },
    maybeSingle() {
      return {
        then(resolve: (value: unknown) => void) {
          if (shouldFailAiDatabase) {
            resolve({ data: null, error: { message: 'permission denied', details: 'secret' } });
            return;
          }

          const index = rows.findIndex((row) => filters.every((filter) => filter(row)));
          if (index < 0) {
            resolve({ data: null, error: null });
            return;
          }

          updatePayloads.push({ ...updateData });
          rows[index] = { ...rows[index], ...(updateData as Partial<ConversationRow>) };
          resolve({ data: projectSelectedFields(rows[index], selectArg), error: null });
        },
      };
    },
  };

  return builder;
}

jest.mock('../../config/aiSupabase', () => ({
  getAiSupabaseAdmin: jest.fn(() => {
    if (!process.env.AI_SUPABASE_URL || !process.env.AI_SUPABASE_SERVICE_ROLE_KEY) {
      return null;
    }
    return {
      from: jest.fn(() => ({
        select: jest.fn((selectArg: string) => createSelectQueryBuilder(selectArg)),
        update: jest.fn((updateData: Record<string, unknown>) => createUpdateQueryBuilder(updateData)),
      })),
    };
  }),
  resetAiSupabaseClientForTests: jest.fn(),
}));

async function buildApp() {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.decorate('authenticate', async (request: any, reply: any) => {
    const auth = request.headers.authorization;
    if (!auth) {
      reply.code(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Authentication failed',
      });
      return reply;
    }
    request.user = {
      sub: 'admin-user',
      appRole: request.headers['x-test-role'] || 'user',
    };
  });

  app.decorate('authorize', (allowedRoles: string[]) => {
    return async (request: any, reply: any) => {
      if (!allowedRoles.includes(request.user?.appRole)) {
        reply.code(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Access denied',
        });
        return reply;
      }
    };
  });

  await app.register(expertReviewRoutes, { prefix: '/api/admin/expert-reviews' });
  return app;
}

async function withApp(run: (app: FastifyInstance) => Promise<void>) {
  const app = await buildApp();
  try {
    await run(app);
  } finally {
    await app.close();
  }
}

const validReviewBody = {
  expert_analysis: 'The response missed the user concern.',
  expert_rephrased: 'I hear this is difficult; let us take one grounded step together.',
};

function authHeaders(role: string) {
  return { authorization: 'Bearer token', 'x-test-role': role };
}

describe('expertReviewRoutes', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      AI_SUPABASE_URL: 'https://ai.example.supabase.co',
      AI_SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    };
    rows = seedRows.map((row) => ({ ...row, query_embedding: row.query_embedding ? [...row.query_embedding] : undefined }));
    shouldFailAiDatabase = false;
    updatePayloads = [];
    mockAuditLogsCreate = jest.fn().mockResolvedValue({ id: 'audit-1' });
    resetAiSupabaseClientForTests();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns 401 without authentication', async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/expert-reviews/conversations',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  it('returns 403 for a normal user', async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/expert-reviews/conversations',
        headers: authHeaders('user'),
      });

      expect(response.statusCode).toBe(403);
    });
  });

  it('allows super_admin to list conversations', async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/expert-reviews/conversations',
        headers: authHeaders('super_admin'),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(expect.objectContaining({ page: 1, limit: 25, total: 2 }));
    });
  });

  it('allows org_admin to read one conversation', async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/expert-reviews/conversations/11111111-1111-4111-8111-111111111111',
        headers: authHeaders('org_admin'),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(expect.objectContaining({ id: '11111111-1111-4111-8111-111111111111' }));
    });
  });

  it('returns 503 when AI credentials are missing', async () => {
    delete process.env.AI_SUPABASE_URL;
    delete process.env.AI_SUPABASE_SERVICE_ROLE_KEY;

    await withApp(async (app) => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/expert-reviews/conversations',
        headers: authHeaders('super_admin'),
      });

      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual(expect.objectContaining({ code: 'AI_DATABASE_UNCONFIGURED' }));
    });
  });

  it('returns 400 for an invalid UUID', async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/expert-reviews/conversations/not-a-uuid',
        headers: authHeaders('super_admin'),
      });

      expect(response.statusCode).toBe(400);
    });
  });

  it('returns 400 for invalid pagination', async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/expert-reviews/conversations?page=0&limit=101',
        headers: authHeaders('super_admin'),
      });

      expect(response.statusCode).toBe(400);
    });
  });

  it('returns a safe response when the AI database fails', async () => {
    shouldFailAiDatabase = true;

    await withApp(async (app) => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/expert-reviews/conversations',
        headers: authHeaders('super_admin'),
      });

      expect(response.statusCode).toBe(502);
      expect(response.body).not.toContain('connection refused');
      expect(response.json()).toEqual(expect.objectContaining({ code: 'AI_DATABASE_UNAVAILABLE' }));
    });
  });

  it('never includes query_embedding in list responses', async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/expert-reviews/conversations',
        headers: authHeaders('super_admin'),
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).not.toContain('query_embedding');
      expect(response.json().items[0]).not.toHaveProperty('query_embedding');
    });
  });

  it('filters reviewed records when reviewed=true', async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/expert-reviews/conversations?reviewed=true',
        headers: authHeaders('super_admin'),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().items).toHaveLength(1);
      expect(response.json().items[0].is_reviewed).toBe(true);
    });
  });

  it('filters pending records when reviewed=false', async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/expert-reviews/conversations?reviewed=false',
        headers: authHeaders('super_admin'),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().items).toHaveLength(1);
      expect(response.json().items[0].is_reviewed).toBe(false);
    });
  });

  it('returns 401 on review update without a token', async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/expert-reviews/conversations/22222222-2222-4222-8222-222222222222/review',
        payload: validReviewBody,
      });

      expect(response.statusCode).toBe(401);
    });
  });

  it('returns 403 on review update for a normal user', async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/expert-reviews/conversations/22222222-2222-4222-8222-222222222222/review',
        headers: authHeaders('user'),
        payload: validReviewBody,
      });

      expect(response.statusCode).toBe(403);
    });
  });

  it('allows super_admin to save a review and sets is_reviewed true', async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/expert-reviews/conversations/22222222-2222-4222-8222-222222222222/review',
        headers: authHeaders('super_admin'),
        payload: validReviewBody,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(
        expect.objectContaining({
          expert_analysis: validReviewBody.expert_analysis,
          expert_rephrased: validReviewBody.expert_rephrased,
          is_reviewed: true,
        })
      );
    });
  });

  it('allows org_admin to save a review', async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/expert-reviews/conversations/22222222-2222-4222-8222-222222222222/review',
        headers: authHeaders('org_admin'),
        payload: validReviewBody,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().is_reviewed).toBe(true);
    });
  });

  it('returns 400 for an invalid UUID on review update', async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/expert-reviews/conversations/not-a-uuid/review',
        headers: authHeaders('super_admin'),
        payload: validReviewBody,
      });

      expect(response.statusCode).toBe(400);
    });
  });

  it('rejects a missing expert_analysis', async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/expert-reviews/conversations/22222222-2222-4222-8222-222222222222/review',
        headers: authHeaders('super_admin'),
        payload: { expert_rephrased: validReviewBody.expert_rephrased },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  it('rejects a missing expert_rephrased', async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/expert-reviews/conversations/22222222-2222-4222-8222-222222222222/review',
        headers: authHeaders('super_admin'),
        payload: { expert_analysis: validReviewBody.expert_analysis },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  it('rejects whitespace-only review values', async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/expert-reviews/conversations/22222222-2222-4222-8222-222222222222/review',
        headers: authHeaders('super_admin'),
        payload: { expert_analysis: '          ', expert_rephrased: '          ' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  it('rejects review values below the minimum length', async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/expert-reviews/conversations/22222222-2222-4222-8222-222222222222/review',
        headers: authHeaders('super_admin'),
        payload: { expert_analysis: 'too short', expert_rephrased: 'also bad' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  it('rejects unknown review fields', async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/expert-reviews/conversations/22222222-2222-4222-8222-222222222222/review',
        headers: authHeaders('super_admin'),
        payload: { ...validReviewBody, is_reviewed: false },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  it('returns 503 on review update when AI credentials are missing', async () => {
    delete process.env.AI_SUPABASE_URL;
    delete process.env.AI_SUPABASE_SERVICE_ROLE_KEY;

    await withApp(async (app) => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/expert-reviews/conversations/22222222-2222-4222-8222-222222222222/review',
        headers: authHeaders('super_admin'),
        payload: validReviewBody,
      });

      expect(response.statusCode).toBe(503);
    });
  });

  it('returns a safe 502 on review update when the AI database fails', async () => {
    shouldFailAiDatabase = true;

    await withApp(async (app) => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/expert-reviews/conversations/22222222-2222-4222-8222-222222222222/review',
        headers: authHeaders('super_admin'),
        payload: validReviewBody,
      });

      expect(response.statusCode).toBe(502);
      expect(response.body).not.toContain('permission denied');
    });
  });

  it('returns 404 when the conversation is not found', async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/expert-reviews/conversations/33333333-3333-4333-8333-333333333333/review',
        headers: authHeaders('super_admin'),
        payload: validReviewBody,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  it('updates only expert fields and is_reviewed in the AI database', async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/expert-reviews/conversations/22222222-2222-4222-8222-222222222222/review',
        headers: authHeaders('super_admin'),
        payload: validReviewBody,
      });

      expect(response.statusCode).toBe(200);
      expect(updatePayloads).toHaveLength(1);
      expect(Object.keys(updatePayloads[0]).sort()).toEqual([
        'expert_analysis',
        'expert_rephrased',
        'is_reviewed',
      ]);
    });
  });

  it('never returns query_embedding from a review update', async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/expert-reviews/conversations/22222222-2222-4222-8222-222222222222/review',
        headers: authHeaders('super_admin'),
        payload: validReviewBody,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).not.toContain('query_embedding');
      expect(response.json()).not.toHaveProperty('query_embedding');
    });
  });

  it('allows updating an existing reviewed row', async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/expert-reviews/conversations/11111111-1111-4111-8111-111111111111/review',
        headers: authHeaders('org_admin'),
        payload: validReviewBody,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().is_reviewed).toBe(true);
      expect(response.json().expert_analysis).toBe(validReviewBody.expert_analysis);
    });
  });

  it('creates a safe audit log entry after a successful save', async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/expert-reviews/conversations/22222222-2222-4222-8222-222222222222/review',
        headers: authHeaders('super_admin'),
        payload: validReviewBody,
      });

      expect(response.statusCode).toBe(200);
      expect(mockAuditLogsCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actor_id: 'admin-user',
          action: 'expert_review_conversation_saved',
          details: expect.objectContaining({
            actor_role: 'super_admin',
            conversation_id: '22222222-2222-4222-8222-222222222222',
            previous_is_reviewed: false,
            reviewed_after: true,
            expert_analysis_length: validReviewBody.expert_analysis.length,
            expert_rephrased_length: validReviewBody.expert_rephrased.length,
          }),
        }),
      });
      const details = mockAuditLogsCreate.mock.calls[0][0].data.details;
      expect(JSON.stringify(details)).not.toContain(validReviewBody.expert_analysis);
      expect(JSON.stringify(details)).not.toContain(validReviewBody.expert_rephrased);
      expect(JSON.stringify(details)).not.toContain('I cannot sleep');
      expect(JSON.stringify(details)).not.toContain('Tell me what tonight has felt like.');
    });
  });
});
