import { z } from 'zod';

export const onboardingSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  avatar_url: z.string().url().nullable().optional(),
  role: z.enum(['user', 'therapist']).default('user'),
  pronouns: z.string().optional(),
  age: z.string().optional(),
  timezone: z.string().optional(),
  current_mood: z.string().optional(),
  selected_goals: z.array(z.string()).optional(),
  in_therapy: z.string().optional(),
  on_medication: z.string().optional(),
  selected_triggers: z.array(z.string()).optional(),
  selected_avatar: z.string().optional(),
  selected_environment: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  emergency_contact_relationship: z.string().optional(),
  permissions: z.record(z.any()).optional(),
  notification_preferences: z.record(z.any()).optional(),
  privacy_settings: z.record(z.any()).optional(),
  // Companion specific fields
  license_number: z.string().optional(),
  specializations: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
});

export const updateProfileSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  avatar_url: z.string().url().nullable().optional(),
  age: z.string().optional(),
  timezone: z.string().optional(),
  pronouns: z.string().optional(),
  current_mood: z.string().optional(),
  selected_goals: z.array(z.string()).optional(),
  in_therapy: z.string().optional(),
  on_medication: z.string().optional(),
  selected_triggers: z.array(z.string()).optional(),
  selected_avatar: z.string().optional(),
  selected_voice: z.string().optional(),
  selected_environment: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  emergency_contact_relationship: z.string().optional(),
  notification_preferences: z.record(z.any()).optional(),
  privacy_settings: z.record(z.any()).optional(),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const checkUserSchema = z.object({
  email: z.string().email(),
  full_name: z.string().optional(),
});

export type CheckUserInput = z.infer<typeof checkUserSchema>;

