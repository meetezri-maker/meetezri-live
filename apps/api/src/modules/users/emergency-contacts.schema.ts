import { z } from 'zod';

export const createEmergencyContactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  relationship: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  is_trusted: z.boolean().optional().default(false),
});

export const updateEmergencyContactSchema = createEmergencyContactSchema.partial();

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
