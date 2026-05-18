import { FastifyInstance } from 'fastify';
import { createSleepEntrySchema, updateSleepEntrySchema, sleepEntryResponseSchema } from './sleep.schema';
import { createSleepEntryHandler, deleteSleepEntryHandler, getAllSleepEntriesAdminHandler, getSleepEntriesHandler, getSleepEntryByIdHandler, updateSleepEntryHandler, getUserSleepEntriesHandler } from './sleep.controller';
import { z } from 'zod';

export async function sleepRoutes(app: FastifyInstance) {
  app.get(
    '/admin',
    {
      schema: {
        response: {
          200: z.array(sleepEntryResponseSchema),
        },
      },
      preHandler: [app.authenticate, app.authorize(['super_admin', 'org_admin', 'team_admin'])],
    },
    getAllSleepEntriesAdminHandler
  );

  app.get(
    '/admin/users/:userId/sleep',
    {
      schema: {
        params: z.object({ userId: z.string() }),
        response: {
          200: z.array(sleepEntryResponseSchema),
        },
      },
      preHandler: [app.authenticate, app.authorize(['super_admin', 'org_admin', 'team_admin'])],
    },
    getUserSleepEntriesHandler
  );

  app.get(
    '/',
    {
      schema: {
        response: {
          200: z.array(sleepEntryResponseSchema),
        },
      },
      preHandler: [app.authenticate],
    },
    getSleepEntriesHandler
  );

  app.get(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
        response: {
          200: sleepEntryResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    getSleepEntryByIdHandler
  );

  app.post(
    '/',
    {
      schema: {
        body: createSleepEntrySchema,
        response: {
          201: sleepEntryResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    createSleepEntryHandler
  );

  app.patch(
    '/:id',
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
        body: updateSleepEntrySchema,
        response: {
          200: sleepEntryResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    updateSleepEntryHandler
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
      preHandler: [app.authenticate],
    },
    deleteSleepEntryHandler
  );
}
