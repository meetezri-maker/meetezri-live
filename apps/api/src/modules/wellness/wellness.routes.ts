import { FastifyInstance } from 'fastify';
import { createWellnessToolSchema, updateWellnessToolSchema, wellnessToolResponseSchema, trackProgressSchema, progressResponseSchema, wellnessChallengeResponseSchema } from './wellness.schema';
import { createWellnessToolHandler, deleteWellnessToolHandler, getWellnessToolByIdHandler, getWellnessToolsHandler, updateWellnessToolHandler, trackWellnessProgressHandler, getUserWellnessProgressHandler, startWellnessSessionHandler, completeWellnessSessionHandler, getWellnessStatsHandler, getWellnessChallengesHandler, toggleWellnessToolFavoriteHandler } from './wellness.controller';
import { z } from 'zod';

export async function wellnessRoutes(app: FastifyInstance) {
  app.get(
    '/',
    {
      schema: {
        querystring: z.object({
          category: z.string().optional(),
        }),
        response: {
          200: z.array(wellnessToolResponseSchema),
        },
      },
      preHandler: [app.authenticate],
    },
    getWellnessToolsHandler
  );

  app.get(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: wellnessToolResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    getWellnessToolByIdHandler
  );

  app.post(
    '/:id/favorite',
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: z.object({
            is_favorite: z.boolean(),
          }),
        },
      },
      preHandler: [app.authenticate],
    },
    toggleWellnessToolFavoriteHandler
  );

  // Admin only
  app.post(
    '/',
    {
      schema: {
        body: createWellnessToolSchema,
        response: {
          201: wellnessToolResponseSchema,
        },
      },
      preHandler: [app.authenticate, app.authorize(['super_admin', 'org_admin'])],
    },
    createWellnessToolHandler
  );

  app.patch(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
        body: updateWellnessToolSchema,
        response: {
          200: wellnessToolResponseSchema,
        },
      },
      preHandler: [app.authenticate, app.authorize(['super_admin', 'org_admin'])],
    },
    updateWellnessToolHandler
  );

  app.delete(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
        response: {
          204: z.null(),
        },
      },
      preHandler: [app.authenticate, app.authorize(['super_admin', 'org_admin'])],
    },
    deleteWellnessToolHandler
  );

  app.post(
    '/:id/progress',
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
        body: trackProgressSchema,
        response: {
          201: progressResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    trackWellnessProgressHandler
  );

  app.post(
    '/:id/start',
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
        response: {
          201: progressResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    startWellnessSessionHandler
  );

  app.patch(
    '/progress/:progressId',
    {
      schema: {
        params: z.object({
          progressId: z.string(),
        }),
        body: trackProgressSchema,
        response: {
          200: progressResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    completeWellnessSessionHandler
  );

  app.get(
    '/progress',
    {
      preHandler: [app.authenticate],
    },
    getUserWellnessProgressHandler
  );

  app.get(
    '/stats',
    {
      preHandler: [app.authenticate],
    },
    getWellnessStatsHandler
  );

  app.get(
    '/challenges',
    {
      schema: {
        response: {
          200: z.array(wellnessChallengeResponseSchema),
        },
      },
      preHandler: [app.authenticate],
    },
    getWellnessChallengesHandler
  );
}
