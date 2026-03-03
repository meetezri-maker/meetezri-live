import { z } from 'zod';

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  full_name: z.string().optional(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
