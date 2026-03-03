import { z } from 'zod';

export const createWellnessToolSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  category: z.string(),
  duration_minutes: z.number().optional(),
  content: z.string().optional(),
  image_url: z.string().optional(),
  is_premium: z.boolean().default(false),
  difficulty: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  icon: z.string().optional(),
});

export const updateWellnessToolSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  duration_minutes: z.number().optional(),
  content: z.string().optional(),
  image_url: z.string().optional(),
  is_premium: z.boolean().optional(),
  difficulty: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  icon: z.string().optional(),
});

export const wellnessToolResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  duration_minutes: z.number().nullable(),
  content_url: z.string().nullable(),
  is_premium: z.boolean().nullable(),
  difficulty: z.string().nullable(),
  status: z.string().nullable(),
  icon: z.string().nullable(),
  is_favorite: z.boolean().default(false),
  created_at: z.date(),
  updated_at: z.date(),
  profiles: z
    .object({
      full_name: z.string().nullable(),
    })
    .optional()
    .nullable(),
});

export const trackProgressSchema = z.object({
  duration_spent: z.number().min(0),
  feedback_rating: z.number().min(1).max(5).optional(),
});

export const progressResponseSchema = z.object({
  id: z.string(),
  tool_id: z.string(),
  duration_spent: z.number().nullable(),
  feedback_rating: z.number().nullable(),
  completed_at: z.date().nullable(),
});

export const wellnessChallengeResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  start_date: z.date(),
  end_date: z.date(),
  goal_criteria: z.any().nullable(),
  reward_points: z.number().nullable(),
  created_at: z.date(),
  participants: z.number().optional(),
  completionRate: z.number().optional(),
});

export type CreateWellnessToolInput = z.infer<typeof createWellnessToolSchema>;
export type UpdateWellnessToolInput = z.infer<typeof updateWellnessToolSchema>;
export type TrackProgressInput = z.infer<typeof trackProgressSchema>;
