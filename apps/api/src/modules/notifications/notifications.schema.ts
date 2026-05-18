import { z } from 'zod';

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const notificationItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string().nullable(),
  message: z.string().nullable(),
  is_read: z.boolean().nullable(),
  created_at: z.union([z.date(), z.string()]),
  metadata: z.any().nullable(),
});

export const paginatedNotificationsSchema = z.object({
  notifications: z.array(notificationItemSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export const createNotificationSchema = z.object({
  user_id: z.string().uuid(),
  type: z.string(),
  title: z.string().optional(),
  message: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
