import { FastifyInstance, FastifyRequest } from 'fastify';
import { notificationsService } from './notifications.service';
import {
  createNotificationSchema,
  listNotificationsQuerySchema,
  paginatedNotificationsSchema,
} from './notifications.schema';
import { z } from 'zod';

export async function notificationRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get('/', {
    schema: {
      // @ts-ignore
      tags: ['Notifications'],
      querystring: listNotificationsQuerySchema,
      response: {
        200: paginatedNotificationsSchema,
      },
    },
  }, async (req) => {
    // @ts-ignore - user is populated by auth plugin
    const userId = req.user.sub;
    const { page, limit } = listNotificationsQuerySchema.parse(req.query ?? {});
    return notificationsService.findPaginated(userId, page, limit);
  });

  app.get('/unread-count', {
      schema: {
          // @ts-ignore
          tags: ['Notifications'],
          response: {
              200: z.object({ count: z.number() })
          }
      }
  }, async (req) => {
      // @ts-ignore
      const userId = req.user.sub;
      const count = await notificationsService.getUnreadCount(userId);
      return { count };
  });

  app.patch('/:id/read', {
    schema: {
      // @ts-ignore
      tags: ['Notifications'],
      params: z.object({ id: z.string() }),
    }
  }, async (req) => {
    const { id } = req.params as { id: string };
    // @ts-ignore
    const userId = req.user.sub;
    return notificationsService.markAsRead(id, userId);
  });
  
  app.patch('/read-all', {
      schema: {
          // @ts-ignore
          tags: ['Notifications']
      }
  }, async (req) => {
      // @ts-ignore
      const userId = req.user.sub;
      return notificationsService.markAllAsRead(userId);
  });

  // Admin only - creating notifications
  app.post('/', {
    preHandler: [app.authenticate, app.authorize(['super_admin', 'org_admin', 'team_admin'])],
    schema: {
      // @ts-ignore
      tags: ['Notifications'],
      body: createNotificationSchema,
    }
  }, async (req) => {
    // TODO: Add admin check
    return notificationsService.create(req.body as any);
  });

  app.post('/broadcast', {
    preHandler: [app.authenticate, app.authorize(['super_admin', 'org_admin', 'team_admin'])],
    schema: {
      // @ts-ignore
      tags: ['Notifications'],
      body: createNotificationSchema.omit({ user_id: true }),
    }
  }, async (req) => {
    // TODO: Add admin check
    return notificationsService.broadcast(req.body as any);
  });
}
