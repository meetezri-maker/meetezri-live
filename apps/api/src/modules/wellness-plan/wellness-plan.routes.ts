import { FastifyInstance } from 'fastify';
import {
  clearWellnessPlanHandler,
  getWellnessPlanHandler,
  upsertWellnessPlanHandler,
} from './wellness-plan.controller';
import { wellnessPlanResponseSchema, wellnessPlanUpsertBodySchema } from './wellness-plan.schema';

export async function wellnessPlanRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    {
      preHandler: [fastify.authenticate],
      schema: {
        response: {
          200: wellnessPlanResponseSchema,
        },
      },
    },
    getWellnessPlanHandler
  );

  fastify.put(
    '/',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: wellnessPlanUpsertBodySchema,
        response: {
          200: wellnessPlanResponseSchema,
        },
      },
    },
    upsertWellnessPlanHandler
  );

  fastify.delete(
    '/',
    {
      preHandler: [fastify.authenticate],
      schema: {
        response: {
          200: wellnessPlanResponseSchema,
        },
      },
    },
    clearWellnessPlanHandler
  );
}
