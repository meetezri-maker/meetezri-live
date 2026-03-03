import { z } from 'zod';

export const createSleepEntrySchema = z.object({
  bed_time: z.string().datetime(), // ISO string
  wake_time: z.string().datetime(), // ISO string
  quality_rating: z.number().min(0).max(100).optional(),
  factors: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const updateSleepEntrySchema = z.object({
  bed_time: z.string().datetime().optional(),
  wake_time: z.string().datetime().optional(),
  quality_rating: z.number().min(0).max(100).optional(),
  factors: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const sleepEntryResponseSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  bed_time: z.date(),
  wake_time: z.date(),
  quality_rating: z.number().nullable(),
  factors: z.array(z.string()),
  notes: z.string().nullable(),
  created_at: z.date(),
});

export type CreateSleepEntryInput = z.infer<typeof createSleepEntrySchema>;
export type UpdateSleepEntryInput = z.infer<typeof updateSleepEntrySchema>;
