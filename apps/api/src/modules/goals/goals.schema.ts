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
const trackingTypeValues = ["count", "duration", "amount", "manual_milestone"] as const;
const milestoneValues = [
  "not_started",
  "started",
  "making_progress",
  "significant_progress",
  "completed",
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
  // Tracking configuration (Task 2.5). Progress itself is backend-derived; the
  // client configures the method + target, never an official percentage.
  tracking_type: z.enum(trackingTypeValues).optional(),
  target_value: z.number().positive().optional(),
  tracking_unit: z.string().trim().max(40).optional(),
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

// Check-in submits ONLY the user action (a numeric value or a milestone) plus
// optional notes. The backend derives the official progress percentage; any
// client-supplied progress/completion/reward fields are not accepted here.
export const createGoalCheckInSchema = z
  .object({
    value: z.number().min(0).optional(),
    milestone: z.enum(milestoneValues).optional(),
    note: z.string().optional(),
    mood: z.enum(emotionTagValues).optional(),
    reflection: z.string().optional(),
    challenges_faced: z.string().optional(),
    wins: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((d) => d.value !== undefined || d.milestone !== undefined, {
    message: "A check-in requires either a value or a milestone",
  });

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type UpdateGoalStatusInput = z.infer<typeof updateGoalStatusSchema>;
export type CreateGoalCheckInInput = z.infer<typeof createGoalCheckInSchema>;
