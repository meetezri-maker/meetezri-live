import { z } from 'zod';

/** Age as years ("24") or date of birth "YYYY-MM-DD" (stored in `profiles.age`). */
function ageFromIsoDob(val: string): number | null {
  const v = val.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const birth = new Date(`${v}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let years = today.getFullYear() - birth.getFullYear();
  const md = today.getMonth() - birth.getMonth();
  if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) {
    years -= 1;
  }
  if (!Number.isFinite(years)) return null;
  return years;
}

const ageOrIsoDobSchema = z
  .string()
  .refine((val) => {
    const v = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const y = ageFromIsoDob(v);
      return y !== null && y >= 0;
    }
    const num = Number.parseInt(v, 10);
    return Number.isFinite(num) && num > 0;
  }, 'Age must be a positive number, or use date of birth (YYYY-MM-DD)');

/** Accept string/number from clients; allow ISO DOB for account settings. */
const ageSchemaCoerced = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? undefined : String(val)),
  ageOrIsoDobSchema.optional()
);

const emergencyPhoneSchema = z
  .string()
  .transform((value) => value.replace(/[^\d+]/g, ''))
  .refine((value) => /^\+\d{12}$/.test(value), 'Emergency contact phone must include country code and exactly 12 digits total');

const optionalPhoneSchema = z
  .string()
  .transform((value) => value.replace(/[^\d+]/g, ''))
  .refine((value) => /^\+\d{12}$/.test(value), 'Phone must include country code and exactly 12 digits total');

/** Treat "" as omitted so partial clears don't fail validation. */
const optionalEmergencyPhoneSchema = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? undefined : val),
  emergencyPhoneSchema.optional()
);

export const onboardingSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  avatar_url: z.string().url().nullable().optional(),
  role: z.enum(['user', 'therapist']).default('user'),
  pronouns: z.string().optional(),
  phone: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    optionalPhoneSchema.optional()
  ),
  age: ageSchemaCoerced,
  timezone: z.string().optional(),
  current_mood: z.string().optional(),
  selected_goals: z.array(z.string()).optional(),
  in_therapy: z.string().optional(),
  on_medication: z.string().optional(),
  selected_triggers: z.array(z.string()).optional(),
  selected_avatar: z.string().optional(),
  selected_environment: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: optionalEmergencyPhoneSchema,
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
  phone: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    optionalPhoneSchema.optional()
  ),
  avatar_url: z.preprocess(
    (v) => (v === '' ? null : v),
    z.union([z.string().url(), z.null()]).optional()
  ),
  age: ageSchemaCoerced,
  timezone: z.string().optional(),
  pronouns: z.string().optional(),
  current_mood: z.string().optional(),
  bio: z.string().max(2000).optional().or(z.literal('')),
  selected_goals: z.array(z.string()).optional(),
  in_therapy: z.string().optional(),
  on_medication: z.string().optional(),
  selected_triggers: z.array(z.string()).optional(),
  selected_avatar: z.string().optional(),
  selected_voice: z.string().optional(),
  selected_environment: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: optionalEmergencyPhoneSchema,
  emergency_contact_relationship: z.string().optional(),
  notification_preferences: z.record(z.any()).optional(),
  privacy_settings: z.record(z.any()).optional(),
  brain_health_settings: z.record(z.any()).optional(),
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

