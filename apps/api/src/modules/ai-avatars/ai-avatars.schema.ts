
import { z } from "zod";

export const createAvatarSchema = z.object({
  name: z.string(),
  gender: z.string().optional(),
  age_range: z.string().optional(),
  personality: z.string().optional(),
  specialties: z.array(z.string()).default([]),
  description: z.string().optional(),
  image_url: z.string().optional(),
  voice_type: z.string().optional(),
  accent_type: z.string().optional(),
  is_active: z.boolean().default(true),
});

export const updateAvatarSchema = createAvatarSchema.partial();

export type CreateAvatarInput = z.infer<typeof createAvatarSchema>;
export type UpdateAvatarInput = z.infer<typeof updateAvatarSchema>;
