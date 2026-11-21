import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  conversationListResponseSchema,
  conversationParamsSchema,
  conversationSummarySchema,
  createConversationSchema,
  errorResponseSchema,
  listConversationsQuerySchema,
  listMessagesQuerySchema,
  messageListResponseSchema,
  type CreateConversationInput,
  type ListConversationsQuery,
  type ListMessagesQuery,
} from './conversations.schema';
import * as service from './conversations.service';
import { registerSendMessageRoute } from './conversations.send';

/**
 * Conversations Module (text chat) — member API, mounted at `/api/conversations`.
 *
 * DARK BY DEFAULT: unless `CONVERSATIONS_API_ENABLED` is "true"/"1", every route answers 404 before
 * authentication runs, so a deployment of this code exposes nothing until the owner opts in (and
 * has created the tables). The frontend flag `VITE_CONVERSATIONS_ENABLED` is separate.
 *
 * Scope: create / list / get / read messages (Phase 1) and send + stream a reply (Phase 2, see
 * conversations.send.ts). Deletion is pending decision D6. Identity always comes from the verified
 * JWT (`request.user.sub`); no route accepts a user id from the client.
 */

export function parseConversationsApiFlag(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  const value = raw.trim().toLowerCase();
  return value === 'true' || value === '1';
}

export function isConversationsApiEnabled(): boolean {
  return parseConversationsApiFlag(process.env.CONVERSATIONS_API_ENABLED);
}

function userIdOf(request: FastifyRequest): string {
  return (request as unknown as { user: { sub: string } }).user.sub;
}

function sendError(reply: FastifyReply, statusCode: number, code: string, message: string) {
  const error =
    statusCode === 400 ? 'Bad Request' : statusCode === 404 ? 'Not Found' : 'Service Unavailable';
  return reply.code(statusCode).send({ statusCode, error, code, message });
}

/** Maps known failures to stable codes; anything else goes to the global error handler (500). */
function handleError(reply: FastifyReply, error: unknown) {
  if (error instanceof service.ConversationError) {
    return sendError(reply, error.statusCode, error.code, error.message);
  }
  // P2021: table does not exist — the reviewed SQL has not been applied to this database yet.
  if ((error as { code?: string })?.code === 'P2021') {
    return sendError(reply, 503, 'CONVERSATIONS_UNAVAILABLE', 'Conversations are not available yet.');
  }
  throw error;
}

const errorResponses = {
  400: errorResponseSchema,
  404: errorResponseSchema,
  503: errorResponseSchema,
};

export async function conversationsRoutes(app: FastifyInstance) {
  // Runs before any route-level preHandler (authenticate), so a disabled API reveals nothing.
  app.addHook('onRequest', async (_request, reply) => {
    if (!isConversationsApiEnabled()) {
      return reply
        .code(404)
        .send({ statusCode: 404, error: 'Not Found', code: 'NOT_FOUND', message: 'Not Found' });
    }
  });

  app.post(
    '/',
    {
      schema: {
        tags: ['Conversations'],
        body: createConversationSchema,
        response: { 201: conversationSummarySchema, ...errorResponses },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const created = await service.createConversation(
          userIdOf(request),
          request.body as CreateConversationInput
        );
        return reply.code(201).send(created);
      } catch (error) {
        return handleError(reply, error);
      }
    }
  );

  app.get(
    '/',
    {
      schema: {
        tags: ['Conversations'],
        querystring: listConversationsQuerySchema,
        response: { 200: conversationListResponseSchema, ...errorResponses },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      try {
        return await service.listConversations(userIdOf(request), request.query as ListConversationsQuery);
      } catch (error) {
        return handleError(reply, error);
      }
    }
  );

  app.get(
    '/:id',
    {
      schema: {
        tags: ['Conversations'],
        params: conversationParamsSchema,
        response: { 200: conversationSummarySchema, ...errorResponses },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        return await service.getConversation(userIdOf(request), id);
      } catch (error) {
        return handleError(reply, error);
      }
    }
  );

  app.get(
    '/:id/messages',
    {
      schema: {
        tags: ['Conversations'],
        params: conversationParamsSchema,
        querystring: listMessagesQuerySchema,
        response: { 200: messageListResponseSchema, ...errorResponses },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        return await service.listMessages(userIdOf(request), id, request.query as ListMessagesQuery);
      } catch (error) {
        return handleError(reply, error);
      }
    }
  );

  // Phase 2: send a message and stream the reply (SSE). Same flag, same authentication.
  registerSendMessageRoute(app);
}
