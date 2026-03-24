import { z } from 'zod';

const ageSchema = z
  .string()
  .refine((val) => {
    const num = Number.parseInt(val, 10);
    return Number.isFinite(num) && num >= 13 && num <= 120;
  }, 'Age must be between 13 and 120');

const emergencyPhoneSchema = z
  .string()
  .transform((value) => value.replace(/[^\d+]/g, ''))
  .refine((value) => /^\+?\d{7,15}$/.test(value), 'Emergency contact phone must be valid');

export const onboardingSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  avatar_url: z.string().url().nullable().optional(),
  role: z.enum(['user', 'therapist']).default('user'),
  pronouns: z.string().optional(),
  age: ageSchema.optional(),
  timezone: z.string().optional(),
  current_mood: z.string().optional(),
  selected_goals: z.array(z.string()).optional(),
  in_therapy: z.string().optional(),
  on_medication: z.string().optional(),
  selected_triggers: z.array(z.string()).optional(),
  selected_avatar: z.string().optional(),
  selected_environment: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: emergencyPhoneSchema.optional(),
  emergency_contact_relationship: z.string().optional(),
  permissions: z.record(z.any()).optional(),
  notification_preferences: z.record(z.any()).optional(),
  privacy_settings: z.record(z.any()).optional(),
  // Companion specific fields
  license_number: z.string().optional(),
  specializations: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
}).superRefine((values, ctx) => {
  const name = values.emergency_contact_name?.trim() ?? '';
  const phone = values.emergency_contact_phone?.trim() ?? '';
  const relationship = values.emergency_contact_relationship?.trim() ?? '';
  const hasAny = Boolean(name || phone || relationship);
  const hasAll = Boolean(name && phone && relationship);

  if (hasAny && !hasAll) {
    if (!name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['emergency_contact_name'],
        message: 'Emergency contact name is required when emergency contact is provided',
      });
    }
    if (!phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['emergency_contact_phone'],
        message: 'Emergency contact phone is required when emergency contact is provided',
      });
    }
    if (!relationship) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['emergency_contact_relationship'],
        message: 'Emergency contact relationship is required when emergency contact is provided',
      });
    }
  }
});

export const updateProfileSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  avatar_url: z.string().url().nullable().optional(),
  age: ageSchema.optional(),
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
  emergency_contact_phone: emergencyPhoneSchema.optional(),
  emergency_contact_relationship: z.string().optional(),
  notification_preferences: z.record(z.any()).optional(),
  privacy_settings: z.record(z.any()).optional(),
}).superRefine((values, ctx) => {
  const name = values.emergency_contact_name?.trim() ?? '';
  const phone = values.emergency_contact_phone?.trim() ?? '';
  const relationship = values.emergency_contact_relationship?.trim() ?? '';
  const hasAny = Boolean(name || phone || relationship);
  const hasAll = Boolean(name && phone && relationship);

  if (hasAny && !hasAll) {
    if (!name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['emergency_contact_name'],
        message: 'Emergency contact name is required when emergency contact is provided',
      });
    }
    if (!phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['emergency_contact_phone'],
        message: 'Emergency contact phone is required when emergency contact is provided',
      });
    }
    if (!relationship) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['emergency_contact_relationship'],
        message: 'Emergency contact relationship is required when emergency contact is provided',
      });
    }
  }
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const checkUserSchema = z.object({
  email: z.string().email(),
});

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  stripe_session_id: z.string().optional(),
});

export type CheckUserInput = z.infer<typeof checkUserSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

