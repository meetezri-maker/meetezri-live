import { z } from "zod";

export const createHabitSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().optional(),
  frequency: z.enum(["daily", "weekly"]).default("daily"),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export const updateHabitSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().optional(),
  frequency: z.enum(["daily", "weekly"]).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  is_archived: z.boolean().optional(),
});

export const logHabitSchema = z.object({
  completed_at: z.string().datetime().optional(), // ISO string, defaults to now if not provided
});

export const habitResponseSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  category: z.string().nullable().optional(),
  frequency: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  habit_logs: z.array(z.object({
    completed_at: z.union([z.string(), z.date()]),
  })).optional(),
  created_at: z.union([z.string(), z.date()]),
  is_archived: z.boolean().nullable().optional(),
});

export type CreateHabitInput = z.infer<typeof createHabitSchema>;
export type UpdateHabitInput = z.infer<typeof updateHabitSchema>;
export type LogHabitInput = z.infer<typeof logHabitSchema>;
export type HabitResponse = z.infer<typeof habitResponseSchema>;
