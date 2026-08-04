import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  expertReviewConversationParamsSchema,
  listExpertReviewConversationsQuerySchema,
  updateExpertReviewBodySchema,
} from './expert-review.schema';
import {
  AiSupabaseConfigurationError,
  AiSupabaseUnavailableError,
  ExpertReviewConversationNotFoundError,
  getExpertReviewConversationById,
  listExpertReviewConversations,
  updateExpertReviewConversation,
} from './expert-review.service';

function sendExpertReviewError(
  request: FastifyRequest,
  reply: FastifyReply,
  error: unknown
) {
  if (error instanceof AiSupabaseConfigurationError) {
    request.log.warn(
      { route: request.routeOptions?.url || request.url },
      'AI Supabase configuration is missing'
    );
    return reply.code(503).send({
      statusCode: 503,
      error: 'Service Unavailable',
      code: 'AI_DATABASE_UNCONFIGURED',
      message: 'Expert review data is unavailable.',
    });
  }

  if (error instanceof AiSupabaseUnavailableError) {
    request.log.error(
      {
        route: request.routeOptions?.url || request.url,
        causeName:
          error.cause && typeof error.cause === 'object' && 'name' in error.cause
            ? (error.cause as { name?: string }).name
            : undefined,
      },
      'AI Supabase request failed'
    );
    return reply.code(502).send({
      statusCode: 502,
      error: 'Bad Gateway',
      code: 'AI_DATABASE_UNAVAILABLE',
      message: 'Expert review data could not be loaded.',
    });
  }

  if (error instanceof ExpertReviewConversationNotFoundError) {
    return reply.code(404).send({
      statusCode: 404,
      error: 'Not Found',
      code: 'CONVERSATION_NOT_FOUND',
      message: 'Conversation not found',
    });
  }

  request.log.error({ err: error }, 'Expert review request failed');
  return reply.code(500).send({
    statusCode: 500,
    error: 'Internal Server Error',
    message: 'Expert review request failed.',
  });
}

export async function listExpertReviewConversationsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const parsed = listExpertReviewConversationsQuerySchema.safeParse(request.query ?? {});
  if (!parsed.success) {
    return reply.code(400).send({
      statusCode: 400,
      error: 'Bad Request',
      code: 'INVALID_EXPERT_REVIEW_QUERY',
      message: parsed.error.issues[0]?.message || 'Invalid query parameters',
    });
  }

  try {
    const result = await listExpertReviewConversations(parsed.data);
    return reply.code(200).send(result);
  } catch (error) {
    return sendExpertReviewError(request, reply, error);
  }
}

export async function getExpertReviewConversationHandler(
  request: FastifyRequest<{ Params: z.infer<typeof expertReviewConversationParamsSchema> }>,
  reply: FastifyReply
) {
  const parsed = expertReviewConversationParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply.code(400).send({
      statusCode: 400,
      error: 'Bad Request',
      code: 'INVALID_CONVERSATION_ID',
      message: 'Invalid conversation id',
    });
  }

  try {
    const conversation = await getExpertReviewConversationById(parsed.data.id);
    if (!conversation) {
      return reply.code(404).send({
        statusCode: 404,
        error: 'Not Found',
        code: 'CONVERSATION_NOT_FOUND',
        message: 'Conversation not found',
      });
    }
    return reply.code(200).send(conversation);
  } catch (error) {
    return sendExpertReviewError(request, reply, error);
  }
}

export async function updateExpertReviewConversationHandler(
  request: FastifyRequest<{
    Params: z.infer<typeof expertReviewConversationParamsSchema>;
    Body: unknown;
  }>,
  reply: FastifyReply
) {
  const params = expertReviewConversationParamsSchema.safeParse(request.params);
  if (!params.success) {
    return reply.code(400).send({
      statusCode: 400,
      error: 'Bad Request',
      code: 'INVALID_CONVERSATION_ID',
      message: 'Invalid conversation id',
    });
  }

  const body = updateExpertReviewBodySchema.safeParse(request.body ?? {});
  if (!body.success) {
    return reply.code(400).send({
      statusCode: 400,
      error: 'Bad Request',
      code: 'INVALID_EXPERT_REVIEW_BODY',
      message: body.error.issues[0]?.message || 'Invalid expert review payload',
    });
  }

  const user = request.user as { sub?: string; id?: string; appRole?: string } | undefined;
  const actorId = user?.sub || user?.id;
  if (!actorId) {
    return reply.code(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  try {
    const conversation = await updateExpertReviewConversation(params.data.id, body.data, {
      id: actorId,
      role: user?.appRole,
    });
    return reply.code(200).send(conversation);
  } catch (error) {
    return sendExpertReviewError(request, reply, error);
  }
}
