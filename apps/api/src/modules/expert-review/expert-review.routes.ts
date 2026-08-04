import { FastifyInstance } from 'fastify';
import {
  getExpertReviewConversationHandler,
  listExpertReviewConversationsHandler,
  updateExpertReviewConversationHandler,
} from './expert-review.controller';
import {
  expertReviewConversationParamsSchema,
  expertReviewConversationSchema,
  listExpertReviewConversationsResponseSchema,
  safeErrorResponseSchema,
  updateExpertReviewBodySchema,
} from './expert-review.schema';

const EXPERT_REVIEW_ADMIN_ROLES = ['super_admin', 'org_admin'] as const;

export async function expertReviewRoutes(app: FastifyInstance) {
  if (!app.authenticate || !app.authorize) {
    throw new Error('Authentication/authorization decorators are not registered');
  }

  app.get(
    '/conversations',
    {
      preHandler: [app.authenticate, app.authorize([...EXPERT_REVIEW_ADMIN_ROLES])],
      schema: {
        response: {
          200: listExpertReviewConversationsResponseSchema,
          400: safeErrorResponseSchema,
          502: safeErrorResponseSchema,
          503: safeErrorResponseSchema,
        },
      },
    },
    listExpertReviewConversationsHandler
  );

  app.get(
    '/conversations/:id',
    {
      preHandler: [app.authenticate, app.authorize([...EXPERT_REVIEW_ADMIN_ROLES])],
      schema: {
        params: expertReviewConversationParamsSchema,
        response: {
          200: expertReviewConversationSchema,
          400: safeErrorResponseSchema,
          404: safeErrorResponseSchema,
          502: safeErrorResponseSchema,
          503: safeErrorResponseSchema,
        },
      },
    },
    getExpertReviewConversationHandler
  );

  app.patch(
    '/conversations/:id/review',
    {
      preHandler: [app.authenticate, app.authorize([...EXPERT_REVIEW_ADMIN_ROLES])],
      schema: {
        params: expertReviewConversationParamsSchema,
        body: updateExpertReviewBodySchema,
        response: {
          200: expertReviewConversationSchema,
          400: safeErrorResponseSchema,
          404: safeErrorResponseSchema,
          502: safeErrorResponseSchema,
          503: safeErrorResponseSchema,
        },
      },
    },
    updateExpertReviewConversationHandler
  );
}
