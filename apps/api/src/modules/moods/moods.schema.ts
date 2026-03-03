import { z } from "zod";

export const createMoodSchema = z.object({
  mood: z.string(),
  intensity: z.number().min(1).max(10),
  activities: z.array(z.string()),
  notes: z.string().optional(),
});

export type CreateMoodInput = z.infer<typeof createMoodSchema>;

export const moodResponseSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  mood: z.string(),
  intensity: z.number(),
  activities: z.array(z.string()),
  notes: z.string().nullable(),
  created_at: z.date(),
});
