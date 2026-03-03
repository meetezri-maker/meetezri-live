import { z } from 'zod';

export const createJournalSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  mood_tags: z.array(z.string()).optional(),
  is_private: z.boolean().optional(),
  location: z.string().optional(),
});

export const updateJournalSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  mood_tags: z.array(z.string()).optional(),
  is_private: z.boolean().optional(),
  location: z.string().optional(),
});

export const journalResponseSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  title: z.string().nullable(),
  content: z.string().nullable(),
  mood_tags: z.array(z.string()),
  is_private: z.boolean().nullable(),
  is_favorite: z.boolean().default(false),
  location: z.string().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
});

export type CreateJournalInput = z.infer<typeof createJournalSchema>;
export type UpdateJournalInput = z.infer<typeof updateJournalSchema>;
