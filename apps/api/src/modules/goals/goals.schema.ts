import { z } from "zod";

const goalStatusValues = ["not_started", "active", "paused", "completed", "archived"] as const;
const goalPriorityValues = ["low", "medium", "high"] as const;
const goalCheckInFrequencyValues = ["daily", "weekly", "twice_weekly", "custom"] as const;
const goalCategoryValues = [
  "mental_emotional",
  "social_relationships",
  "personal_growth",
  "daily_productivity",
  "wellness",
] as const;
const emotionTagValues = [
  "stress",
  "anxiety",
  "confidence",
  "motivation",
  "loneliness",
  "focus",
  "sadness",
  "overwhelm",
  "discipline",
  "calm",
] as const;
const supportTypeValues = [
  "encouragement",
  "accountability",
  "reflection",
  "coping_help",
  "motivation",
  "partner_support",
] as const;

export const createGoalSchema = z.object({
  goal_title: z.string().trim().min(2),
  goal_category: z.enum(goalCategoryValues),
  goal_description: z.string().trim().min(10),
  why_this_goal_matters: z.string().trim().min(5),
  target_outcome: z.string().trim().min(5),
  priority_level: z.enum(goalPriorityValues),
  start_date: z.string().trim().min(1),
  target_date: z.string().trim().optional(),
  progress_percentage: z.number().min(0).max(100).optional(),
  check_in_frequency: z.enum(goalCheckInFrequencyValues).optional(),
  reminder_enabled: z.boolean().optional(),
  reminder_time: z.string().trim().optional(),
  small_action_steps: z.array(z.string().trim().min(1)).optional(),
  emotion_tag: z.enum(emotionTagValues).optional(),
  support_type_needed: z.enum(supportTypeValues).optional(),
  notes: z.string().optional(),
  partner_visibility: z.boolean().optional(),
  partner_comment_enabled: z.boolean().optional(),
});

export const updateGoalSchema = createGoalSchema.partial().extend({
  status: z.enum(goalStatusValues).optional(),
  completion_note: z.string().optional(),
});

export const updateGoalStatusSchema = z.object({
  status: z.enum(goalStatusValues),
});

export const createGoalCheckInSchema = z.object({
  progress_percentage: z.number().min(0).max(100),
  mood: z.enum(emotionTagValues).optional(),
  reflection: z.string().optional(),
  challenges_faced: z.string().optional(),
  wins: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type UpdateGoalStatusInput = z.infer<typeof updateGoalStatusSchema>;
export type CreateGoalCheckInInput = z.infer<typeof createGoalCheckInSchema>;
