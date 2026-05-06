import { FastifyInstance } from 'fastify';
import {
  createSessionHandler,
  getSessionsHandler,
  getSessionHandler,
  beginScheduledSessionHandler,
  endSessionHandler,
  createMessageHandler,
  getSessionTranscriptHandler,
  scheduleSessionHandler,
  getUserSessionsHandler,
  toggleSessionFavoriteHandler,
  heartbeatSessionHandler,
  cancelScheduledSessionHandler,
  updateScheduledSessionHandler,
} from './sessions.controller';
import {
  createSessionSchema,
  beginScheduledSessionSchema,
  endSessionSchema,
  createMessageSchema,
  heartbeatSessionSchema,
  updateScheduledSessionSchema,
} from './sessions.schema';

export async function sessionRoutes(app: FastifyInstance) {
  app.get(
    '/admin/users/:userId/sessions',
    {
      preHandler: [app.authenticate, app.authorize(['super_admin', 'org_admin'])],
    },
    getUserSessionsHandler
  );

  app.post(
    '/',
    {
      schema: {
        body: createSessionSchema,
      },
      preHandler: [app.authenticate],
    },
    createSessionHandler
  );

  app.post(
    '/schedule',
    {
      schema: {
        body: createSessionSchema,
      },
      preHandler: [app.authenticate],
    },
    scheduleSessionHandler
  );

  app.get(
    '/',
    {
      preHandler: [app.authenticate],
    },
    getSessionsHandler
  );

  app.get(
    '/:id',
    {
        preHandler: [app.authenticate],
    },
    getSessionHandler
  );

  app.post(
    '/:id/start',
    {
      schema: {
        body: beginScheduledSessionSchema,
      },
      preHandler: [app.authenticate],
    },
    beginScheduledSessionHandler
  );

  app.post(
    '/:id/end',
    {
      schema: {
        body: endSessionSchema,
      },
      preHandler: [app.authenticate],
    },
    endSessionHandler
  );

  app.post(
    '/:id/heartbeat',
    {
      schema: {
        body: heartbeatSessionSchema,
      },
      preHandler: [app.authenticate],
    },
    heartbeatSessionHandler
  );

  app.delete(
    '/:id/schedule',
    {
      preHandler: [app.authenticate],
    },
    cancelScheduledSessionHandler
  );

  app.patch(
    '/:id/schedule',
    {
      schema: {
        body: updateScheduledSessionSchema,
      },
      preHandler: [app.authenticate],
    },
    updateScheduledSessionHandler
  );

  app.post(
    '/:id/messages',
    {
      schema: {
        body: createMessageSchema,
      },
      preHandler: [app.authenticate],
    },
    createMessageHandler
  );

  app.post(
    '/:id/favorite',
    {
      preHandler: [app.authenticate],
    },
    toggleSessionFavoriteHandler
  );

  app.get(
    '/:id/transcript',
    {
      preHandler: [app.authenticate],
    },
    getSessionTranscriptHandler
  );
}
