import { z } from "zod";

export const customAchievementSchema = z.object({
  title: z.string().trim().min(2),
  description: z.string().trim().min(2),
  icon: z.string().trim().min(1),
  category: z.enum([
    "sessions",
    "mood",
    "journal",
    "wellness",
    "streak",
    "community",
    "personal",
    "self_improvement",
    "professional",
  ]),
  progress: z.number().min(0),
  total: z.number().min(1),
  unlocked: z.boolean(),
  points: z.number().min(0),
  rarity: z.enum(["common", "rare", "epic", "legendary"]),
  goalType: z.enum(["gym", "money_management", "career", "learning", "health", "custom"]).optional(),
  lastCheckInDate: z.string().optional(),
  checkInHistory: z.array(z.string()).optional(),
  checkInEntries: z
    .array(
      z.object({
        date: z.string(),
        amount: z.number().optional(),
        note: z.string().optional(),
      })
    )
    .optional(),
  goalCategory: z.enum(["Mental", "Emotional", "Productivity", "Relationships", "Wellness"]).optional(),
  whyItMatters: z.string().optional(),
  targetOutcome: z.string().optional(),
  startDate: z.string().optional(),
  targetDate: z.string().optional(),
  priority: z.enum(["Low", "Medium", "High"]).optional(),
  progressStatus: z.enum(["Not Started", "In Progress", "Achieved"]).optional(),
  checkInFrequency: z.enum(["Daily", "Weekly", "Custom"]).optional(),
  reminderEnabled: z.boolean().optional(),
  actionSteps: z.string().optional(),
  moodTag: z.enum(["Stress", "Sadness", "Fear", "Confidence", "Motivation"]).optional(),
  supportType: z.enum(["Encouragement", "Accountability", "Reflection", "Coping Help"]).optional(),
  notes: z.string().optional(),
  linkedGoalId: z.string().uuid().optional(),
  /** When true, check-ins also sync to the personal goals API. False = achievement-only streak (custom_achievements only). */
  syncWithGoals: z.boolean().optional(),
});

export const createCustomAchievementSchema = customAchievementSchema;
export const updateCustomAchievementSchema = customAchievementSchema.partial();

export type CreateCustomAchievementInput = z.infer<typeof createCustomAchievementSchema>;
export type UpdateCustomAchievementInput = z.infer<typeof updateCustomAchievementSchema>;
