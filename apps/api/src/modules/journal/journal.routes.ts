import { FastifyInstance } from 'fastify';
import { createJournalSchema, journalAdminResponseSchema, journalResponseSchema, updateJournalSchema } from './journal.schema';
import { createJournalHandler, deleteJournalHandler, getAllJournalsAdminHandler, getJournalByIdHandler, getJournalsHandler, updateJournalHandler, getUserJournalsHandler, toggleJournalFavoriteHandler } from './journal.controller';
import { z } from 'zod';
import { requireEntitlementRoute } from '../entitlements';

/**
 * PHASE 7 — Journalling is a Grow/Thrive capability (Option A, APPROVED).
 *
 * Built once and shared by every member journal route so the rule lives in exactly one place.
 * The `/admin` routes are NOT gated: they carry their own role authorization and serve staff,
 * whose own membership is irrelevant to what they are allowed to administer.
 */
const requireJournal = requireEntitlementRoute('canCreateJournal', {
  message: 'Journalling is part of Grow. Upgrade to Grow or Thrive to continue.',
});

export async function journalRoutes(app: FastifyInstance) {
  app.get(
    '/admin',
    {
      schema: {
        response: {
          200: z.array(journalAdminResponseSchema),
        },
      },
      preHandler: [app.authenticate, app.authorize(['super_admin', 'org_admin', 'team_admin'])],
    },
    getAllJournalsAdminHandler
  );

  app.get(
    '/admin/users/:userId/journals',
    {
      schema: {
        params: z.object({ userId: z.string() }),
        response: {
          200: z.array(journalAdminResponseSchema),
        },
      },
      preHandler: [app.authenticate, app.authorize(['super_admin', 'org_admin', 'team_admin'])],
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
      preHandler: [app.authenticate, requireJournal],
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
      preHandler: [app.authenticate, requireJournal],
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
      preHandler: [app.authenticate, requireJournal],
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
      preHandler: [app.authenticate, requireJournal],
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
      preHandler: [app.authenticate, requireJournal],
    },
    toggleJournalFavoriteHandler
  );

  app.delete(
    '/:id',
    {
      schema: {
        params: z.object({ id: z.string() }),
      },
      preHandler: [app.authenticate, requireJournal],
    },
    deleteJournalHandler
  );
}
