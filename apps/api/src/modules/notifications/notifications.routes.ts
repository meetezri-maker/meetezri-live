import { FastifyInstance, FastifyRequest } from 'fastify';
import { notificationsService } from './notifications.service';
import { createNotificationSchema } from './notifications.schema';
import { z } from 'zod';

export async function notificationRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get('/', {
    schema: {
      // @ts-ignore
      tags: ['Notifications'],
      response: {
        200: z.array(z.object({
          id: z.string(),
          type: z.string(),
          title: z.string().nullable(),
          message: z.string().nullable(),
          is_read: z.boolean().nullable(),
          created_at: z.date(),
          metadata: z.any().nullable(),
        }))
      }
    }
  }, async (req) => {
    // @ts-ignore - user is populated by auth plugin
    const userId = req.user.sub;
    return notificationsService.findAll(userId);
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
