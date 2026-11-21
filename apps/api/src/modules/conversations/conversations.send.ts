import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { OutgoingHttpHeaders, ServerResponse } from 'http';
import { z } from 'zod';
import { conversationParamsSchema, errorResponseSchema } from './conversations.schema';
import { ConversationError } from './conversations.service';
import {
  MAX_MESSAGE_CHARS,
  completeTurn,
  failTurn,
  readTurnLimits,
  reserveTurn,
} from './conversations.turn.service';
import { EzriChatError, readEzriChatConfig, requestEzriReply } from './ezriChatClient';
import { effectiveTextChatMode, resolveTextChatGate, type TextChatGate } from './textChatEntitlements';

/**
 * POST /api/conversations/:id/messages — send one message and stream the companion's reply (SSE).
 *
 * Before streaming starts, failures are ordinary JSON errors (400/401/404/409/429/503). Once the
 * user message is stored the response becomes `text/event-stream` with these events:
 *
 *   event: start   data: { user_message }                       — stored, status "pending"
 *   event: status  data: { text }                               — transient ("Let me check…")
 *   event: delta   data: { text }                               — append as-is (spacing included)
 *   event: done    data: { user_message, assistant_message }    — both stored, status "complete"
 *   event: error   data: { code, message }                      — user message now "failed"
 *   : ping                                                      — keep-alive comment every 15 s
 *
 * The reply is stored only on `done`; an interrupted reply is not stored (decision D7 pending).
 * If the member disconnects, the Ezri request is cancelled and the user message is marked failed.
 *
 * Response compression is disabled for this route, and the reply is hijacked, so no global
 * onSend hook (compression, timing headers) can buffer the stream.
 */

export const sendMessageSchema = z
  .object({
    content: z
      .string()
      .refine((v) => v.trim().length > 0, { message: 'Write a message first.' })
      .refine((v) => v.trim().length <= MAX_MESSAGE_CHARS, {
        message: `Messages can be up to ${MAX_MESSAGE_CHARS} characters.`,
      }),
    /** Client-generated id; re-sending a FAILED message with the same id retries it. */
    client_message_id: z.string().uuid(),
  })
  .strict();

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

const PING_INTERVAL_MS = 15_000;

type StreamErrorCode = 'REPLY_TIMEOUT' | 'REPLY_FAILED' | 'PERSISTENCE_FAILED';

const STREAM_ERROR_MESSAGES: Record<StreamErrorCode, string> = {
  REPLY_TIMEOUT: 'Your companion took too long to reply. Please try again.',
  REPLY_FAILED: 'Your companion couldn’t reply just now. Please try again.',
  PERSISTENCE_FAILED: 'The reply couldn’t be saved. Please try again.',
};

function userIdOf(request: FastifyRequest): string {
  return (request as unknown as { user: { sub: string } }).user.sub;
}

function jsonError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  details?: Record<string, string | number>
) {
  const error =
    (
      { 400: 'Bad Request', 403: 'Forbidden', 404: 'Not Found', 409: 'Conflict', 429: 'Too Many Requests' } as Record<
        number,
        string
      >
    )[statusCode] ?? 'Service Unavailable';
  return reply.code(statusCode).send({ statusCode, error, code, message, ...(details ?? {}) });
}

function createSseWriter(res: ServerResponse) {
  const writable = () => !res.writableEnded && !res.destroyed;
  return {
    event(name: string, data: unknown) {
      if (writable()) res.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    comment(text: string) {
      if (writable()) res.write(`: ${text}\n\n`);
    },
    end() {
      if (writable()) res.end();
    },
  };
}

export function registerSendMessageRoute(app: FastifyInstance) {
  app.post(
    '/:id/messages',
    {
      schema: {
        tags: ['Conversations'],
        params: conversationParamsSchema,
        body: sendMessageSchema,
        response: {
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          429: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
      preHandler: [app.authenticate],
      // Read by @fastify/compress: never compress (and so never buffer) this stream.
      config: { compress: false },
    } as any,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const config = readEzriChatConfig();
      if (!config) {
        return jsonError(reply, 503, 'CONVERSATIONS_UNAVAILABLE', 'Conversations are not available yet.');
      }

      const userId = userIdOf(request);
      const { id: conversationId } = request.params as { id: string };
      const body = request.body as SendMessageInput;

      // Phase 5: plan eligibility + daily allowance. Off by default (no queries). In shadow mode a
      // lookup failure must never break chat; in enforce mode it fails closed (500).
      let gate: TextChatGate | null = null;
      const mode = effectiveTextChatMode();
      try {
        gate = await resolveTextChatGate(userId, { mode });
      } catch (error) {
        if (mode === 'enforce') throw error;
        request.log.warn({ err: error, conversationId }, 'conversations: entitlement lookup failed (shadow)');
      }

      let turn;
      try {
        turn = await reserveTurn(userId, conversationId, body, readTurnLimits(config.timeoutMs), undefined, gate);
      } catch (error) {
        if (error instanceof ConversationError) {
          if (gate) {
            request.log.info({ conversationId, entitlementMode: gate.mode, code: error.code }, 'conversations: send refused');
          }
          return jsonError(reply, error.statusCode, error.code, error.message, error.details);
        }
        if ((error as { code?: string })?.code === 'P2021') {
          return jsonError(reply, 503, 'CONVERSATIONS_UNAVAILABLE', 'Conversations are not available yet.');
        }
        throw error;
      }

      // From here the response is a raw SSE stream. Keep headers Fastify plugins already set
      // (CORS, rate-limit) — hijack bypasses Fastify's own header writing.
      reply.hijack();
      const res = reply.raw;
      const inherited: OutgoingHttpHeaders = {};
      for (const [name, value] of Object.entries(reply.getHeaders())) {
        if (value !== undefined && name !== 'content-length' && name !== 'content-encoding') {
          inherited[name] = value;
        }
      }
      res.writeHead(200, {
        ...inherited,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.flushHeaders?.();

      const sse = createSseWriter(res);
      const abort = new AbortController();
      let finished = false;
      res.on('close', () => {
        if (!finished) abort.abort();
      });
      const ping = setInterval(() => sse.comment('ping'), PING_INTERVAL_MS);
      const startedAt = Date.now();
      let outcome = 'done';

      sse.event('start', { user_message: turn.userMessage });

      try {
        const replyText = await requestEzriReply(turn.ezriRequest, {
          config,
          signal: abort.signal,
          onEvent: (event) => sse.event(event.type, { text: event.text }),
        });
        try {
          const saved = await completeTurn(userId, conversationId, turn.userMessage.id, replyText);
          sse.event('done', { user_message: saved.userMessage, assistant_message: saved.assistantMessage });
        } catch (error) {
          outcome = 'PERSISTENCE_FAILED';
          request.log.error({ err: error, conversationId }, 'conversations: failed to store reply');
          await failTurn(userId, turn.userMessage.id);
          sse.event('error', { code: 'PERSISTENCE_FAILED', message: STREAM_ERROR_MESSAGES.PERSISTENCE_FAILED });
        }
      } catch (error) {
        await failTurn(userId, turn.userMessage.id);
        const upstream = error instanceof EzriChatError ? error.code : 'UNEXPECTED';
        outcome = upstream;
        if (upstream !== 'ABORTED') {
          const code: StreamErrorCode = upstream === 'EZRI_TIMEOUT' ? 'REPLY_TIMEOUT' : 'REPLY_FAILED';
          sse.event('error', { code, message: STREAM_ERROR_MESSAGES[code] });
        }
        // Codes and statuses only — never message content or upstream error bodies.
        request.log.warn(
          {
            conversationId,
            code: upstream,
            httpStatus: error instanceof EzriChatError ? error.httpStatus : undefined,
          },
          'conversations: reply failed'
        );
      } finally {
        finished = true;
        clearInterval(ping);
        sse.end();
        request.log.info(
          {
            conversationId,
            outcome,
            ms: Date.now() - startedAt,
            retried: turn.retried,
            transport: config.transport,
            // Shadow mode: what the entitlement gate WOULD have done (counts only, never content).
            ...(turn.entitlement ? { entitlement: turn.entitlement } : {}),
          },
          'conversations: turn finished'
        );
      }
    }
  );
}
