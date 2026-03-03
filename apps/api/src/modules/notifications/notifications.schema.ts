import { z } from 'zod';

export const createNotificationSchema = z.object({
  user_id: z.string().uuid(),
  type: z.string(),
  title: z.string().optional(),
  message: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
