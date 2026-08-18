/**
 * Regression: `POST /api/admin/content/:id/transition` returned 500 on SUCCESS (req-5).
 *
 * WHAT HAPPENED. The route declared its 200 response inline as a raw JSON Schema —
 * `{ type: 'object', properties: { status: {…}, revisionNumber: {…} } }` — while the app
 * serialises every response with `fastify-type-provider-zod`. That compiler's `resolveSchema`
 * looks for an own `safeParse` property; a plain object has none, so it falls through to the
 * `properties` branch, returns the inner `properties` object, and calls `safeParse` on it:
 *
 *     TypeError: schema.safeParse is not a function
 *         at fastify-type-provider-zod/dist/index.js:91:27
 *         at serialize (fastify/lib/reply.js:960:12)
 *         at Reply.send (fastify/lib/reply.js:223:7)
 *         at Object.transitionHandler (content-hub.controller.js:146:22)
 *
 * The throw is in `reply.send`, which runs AFTER the transaction has committed. So every
 * successful transition wrote its status change, its revision and its audit event, and then told
 * the caller it had failed. Production shows six of these since 10 August, including W2-A001's
 * submit at 15:27:42 whose revision #3 and `content.submitted_for_review` row both exist.
 *
 * These tests run the REAL route through the REAL serializer compiler, because a unit test of the
 * schema object alone would not have caught it — the schema was never the thing being executed.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { contentHubAdminRoutes } from '../content-hub.routes';

jest.mock('../content-hub.publish.service', () => ({
  transitionContent: jest.fn(),
  setApprovalGate: jest.fn(),
  evaluateChecklist: jest.fn(),
}));

const publish = jest.requireMock('../content-hub.publish.service') as {
  transitionContent: jest.Mock;
};

const CONTENT_ID = '3c86b0bb-7f8d-426a-8286-6dd8ae5dfcf8';
const ACTOR = { sub: '6874e034-a3e9-45a0-835f-cfe21fdda65d', appRole: 'super_admin' };

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // The route plugin refuses to register without these, and they are not what is under test.
  app.decorate('authenticate', async () => undefined);
  app.decorate('authorize', () => async () => undefined);
  app.addHook('preHandler', async (request) => {
    (request as { user?: unknown }).user = ACTOR;
  });

  await app.register(contentHubAdminRoutes);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => jest.clearAllMocks());

/** Exactly what `transitionContent` resolves with for a draft → in_review submit. */
function submitResult() {
  return {
    status: 'in_review',
    revisionNumber: 3,
    invalidatePaths: ['/resources/questions-about-everyday-conversations', '/resources', '/sitemap.xml'],
  };
}

describe('a successful transition returns 200, not 500', () => {
  it('serialises the draft → in_review response instead of throwing', async () => {
    publish.transitionContent.mockResolvedValue(submitResult());

    const response = await app.inject({
      method: 'POST',
      url: `/${CONTENT_ID}/transition`,
      payload: { action: 'submit' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'in_review', revisionNumber: 3 });
  });

  it('does not surface a TypeError from the serializer', async () => {
    publish.transitionContent.mockResolvedValue(submitResult());

    const response = await app.inject({
      method: 'POST',
      url: `/${CONTENT_ID}/transition`,
      payload: { action: 'submit' },
    });

    // The exact production signature.
    expect(response.body).not.toContain('safeParse');
    expect(response.json()).not.toMatchObject({ error: 'TypeError' });
  });

  it('serialises every other transition action too', async () => {
    for (const [action, status] of [
      ['withdraw', 'draft'],
      ['publish', 'published'],
      ['unpublish', 'unpublished'],
      ['archive', 'archived'],
      ['restore', 'draft'],
    ] as const) {
      publish.transitionContent.mockResolvedValue({ status, revisionNumber: 4, invalidatePaths: [] });

      const response = await app.inject({
        method: 'POST',
        url: `/${CONTENT_ID}/transition`,
        payload: { action },
      });

      expect({ action, code: response.statusCode, body: response.json() }).toEqual({
        action,
        code: 200,
        body: { status, revisionNumber: 4 },
      });
    }
  });

  it('drops the internal invalidatePaths rather than leaking it', async () => {
    // The service returns cache-purge paths the client has no business seeing.
    publish.transitionContent.mockResolvedValue(submitResult());

    const response = await app.inject({
      method: 'POST',
      url: `/${CONTENT_ID}/transition`,
      payload: { action: 'submit' },
    });

    expect(Object.keys(response.json())).toEqual(['status', 'revisionNumber']);
  });
});

describe('domain failures still reach the client unchanged', () => {
  it('passes an illegal transition through as 409, not 500', async () => {
    const { ContentHubError } = jest.requireActual('../content-hub.errors');
    publish.transitionContent.mockRejectedValue(
      new ContentHubError(409, 'ILLEGAL_TRANSITION', 'Cannot move content from in_review to in_review.'),
    );

    const response = await app.inject({
      method: 'POST',
      url: `/${CONTENT_ID}/transition`,
      payload: { action: 'submit' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'ILLEGAL_TRANSITION' });
  });
});

describe('no route in this module hands the Zod serializer a raw JSON Schema', () => {
  it('declares every response schema as something with safeParse', async () => {
    /**
     * The compiler's own contract, asserted directly: `resolveSchema` requires an OWN `safeParse`
     * property. Collected from the real plugin registration, so a future route that reintroduces
     * a raw JSON Schema fails here rather than in production.
     */
    const offenders: string[] = [];
    const probe = Fastify();
    probe.setValidatorCompiler(validatorCompiler);
    probe.setSerializerCompiler(serializerCompiler);
    probe.decorate('authenticate', async () => undefined);
    probe.decorate('authorize', () => async () => undefined);

    probe.addHook('onRoute', (route) => {
      const response = (route.schema as { response?: Record<string, unknown> } | undefined)?.response;
      if (!response) return;
      for (const [code, schema] of Object.entries(response)) {
        // 204 is excluded deliberately, and on evidence: a bodyless 204 never reaches the
        // serializer at all (verified against this Fastify version — a route declaring
        // `204: { type: 'null' }` returns an empty 204 rather than throwing). Only codes that
        // actually serialise a body can reproduce req-5.
        if (code === '204') continue;
        if (!Object.prototype.hasOwnProperty.call(schema ?? {}, 'safeParse')) {
          offenders.push(`${route.method} ${route.url} → ${code}`);
        }
      }
    });

    await probe.register(contentHubAdminRoutes);
    await probe.ready();
    await probe.close();

    expect(offenders).toEqual([]);
  });
});
