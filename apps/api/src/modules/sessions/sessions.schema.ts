import { z } from 'zod';

export const createSessionSchema = z.object({
  type: z.enum(['instant', 'scheduled']).default('instant'),
  title: z.string().optional(),
  duration_minutes: z.number().int().positive().optional(),
  scheduled_at: z.string().datetime().optional(),
  config: z.object({
    voice: z.string().optional(),
    avatar: z.string().optional(),
  }).optional(),
});

export const endSessionSchema = z.object({
  duration_seconds: z.number().int().nonnegative().optional(),
  recording_url: z.string().url().optional(),
  transcript: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    timestamp: z.number().optional()
  })).optional()
});

export const createMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
});

export const sessionResponseSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string().nullable(),
  status: z.string(),
  type: z.string(),
  scheduled_at: z.string().datetime().nullable(),
  started_at: z.string().datetime().nullable(),
  ended_at: z.string().datetime().nullable(),
  duration_minutes: z.number().nullable(),
  config: z.any().nullable(),
  is_favorite: z.boolean().default(false),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type EndSessionInput = z.infer<typeof endSessionSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
