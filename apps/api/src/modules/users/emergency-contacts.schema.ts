import { z } from 'zod';
import {
  isValidOptionalAppPhone,
  OPTIONAL_PHONE_VALIDATION_MESSAGE,
} from '@meetezri/shared';

const emergencyContactPhoneInner = z
  .string()
  .transform((value) => value.replace(/[^\d+]/g, ''))
  .refine((value) => isValidOptionalAppPhone(value), {
    message: OPTIONAL_PHONE_VALIDATION_MESSAGE,
  });

/** Same rules as profile `phone`: omit or validate by selected country dial code. */
const emergencyContactPhoneField = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? undefined : val),
  emergencyContactPhoneInner.optional()
);

export const createEmergencyContactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  relationship: z.string().optional(),
  phone: emergencyContactPhoneField,
  email: z.string().email().optional().or(z.literal('')),
  is_trusted: z.boolean().optional().default(false),
});

export const updateEmergencyContactSchema = createEmergencyContactSchema.partial();
export const updateEmergencyContactWithFieldsSchema = updateEmergencyContactSchema.refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field is required for update' }
);

export const emergencyContactResponseSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  relationship: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  is_trusted: z.boolean().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
});

export type CreateEmergencyContactInput = z.infer<typeof createEmergencyContactSchema>;
export type UpdateEmergencyContactInput = z.infer<typeof updateEmergencyContactSchema>;
