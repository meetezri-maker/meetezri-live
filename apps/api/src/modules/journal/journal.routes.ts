import { FastifyInstance } from 'fastify';
import { createJournalSchema, journalResponseSchema, updateJournalSchema } from './journal.schema';
import { createJournalHandler, deleteJournalHandler, getJournalByIdHandler, getJournalsHandler, updateJournalHandler, getUserJournalsHandler, toggleJournalFavoriteHandler } from './journal.controller';
import { z } from 'zod';

export async function journalRoutes(app: FastifyInstance) {
  app.get(
    '/admin/users/:userId/journals',
    {
      schema: {
        params: z.object({ userId: z.string() }),
        response: {
          200: z.array(journalResponseSchema),
        },
      },
      preHandler: [app.authenticate, app.authorize(['super_admin', 'org_admin'])],
    },
    getUserJournalsHandler
  );

  app.post(
    '/',
    {
      schema: {
        body: createJournalSchema,
        response: {
          201: journalResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    createJournalHandler
  );

  app.get(
    '/',
    {
      schema: {
        response: {
          200: z.array(journalResponseSchema),
        },
      },
      preHandler: [app.authenticate],
    },
    getJournalsHandler
  );

  app.get(
    '/:id',
    {
      schema: {
        params: z.object({ id: z.string() }),
        response: {
          200: journalResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    getJournalByIdHandler
  );

  app.patch(
    '/:id',
    {
      schema: {
        params: z.object({ id: z.string() }),
        body: updateJournalSchema,
        response: {
          200: journalResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    updateJournalHandler
  );

  app.post(
    '/:id/favorite',
    {
      schema: {
        params: z.object({ id: z.string() }),
        response: {
          200: journalResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    toggleJournalFavoriteHandler
  );

  app.delete(
    '/:id',
    {
      schema: {
        params: z.object({ id: z.string() }),
      },
      preHandler: [app.authenticate],
    },
    deleteJournalHandler
  );
}
