import { z } from 'zod';
import {
  GOAL_CATEGORY_OPTIONS,
  GOAL_CHECKIN_FREQUENCY_OPTIONS,
  GOAL_EMOTION_TAG_OPTIONS,
  GOAL_PRIORITY_OPTIONS,
  GOAL_SUPPORT_TYPE_OPTIONS,
} from './constants';

const categoryValues = GOAL_CATEGORY_OPTIONS.map((o) => o.value) as [string, ...string[]];
const priorityValues = GOAL_PRIORITY_OPTIONS.map((o) => o.value) as [string, ...string[]];
const frequencyValues = GOAL_CHECKIN_FREQUENCY_OPTIONS.map((o) => o.value) as [string, ...string[]];
const emotionValues = GOAL_EMOTION_TAG_OPTIONS.map((o) => o.value) as [string, ...string[]];
const supportValues = GOAL_SUPPORT_TYPE_OPTIONS.map((o) => o.value) as [string, ...string[]];

export const goalFormSchema = z.object({
  goal_title: z.string().trim().min(2, 'Goal title is required'),
  goal_category: z.enum(categoryValues as any),
  goal_description: z.string().trim().min(10, 'Goal description is required'),
  why_this_goal_matters: z.string().trim().min(5, 'Please explain why this goal matters'),
  target_outcome: z.string().trim().min(5, 'Target outcome is required'),
  priority_level: z.enum(priorityValues as any),
  start_date: z.string().min(1, 'Start date is required'),
  target_date: z.string().optional(),
  progress_percentage: z.number().min(0).max(100).optional(),
  check_in_frequency: z.enum(frequencyValues as any).optional(),
  reminder_enabled: z.boolean().optional(),
  reminder_time: z.string().optional(),
  small_action_steps: z.array(z.string().trim().min(1)).optional(),
  emotion_tag: z.enum(emotionValues as any).optional(),
  support_type_needed: z.enum(supportValues as any).optional(),
  notes: z.string().optional(),
  partner_visibility: z.boolean().optional(),
  partner_comment_enabled: z.boolean().optional(),
});

export const goalCheckInSchema = z.object({
  progress_percentage: z.number().min(0).max(100),
  mood: z.enum(emotionValues as any).optional(),
  reflection: z.string().optional(),
  challenges_faced: z.string().optional(),
  wins: z.string().optional(),
  notes: z.string().optional(),
});

export type GoalFormSchemaInput = z.infer<typeof goalFormSchema>;
export type GoalCheckInSchemaInput = z.infer<typeof goalCheckInSchema>;
