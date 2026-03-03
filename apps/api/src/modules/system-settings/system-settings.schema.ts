import { z } from "zod";

export const upsertSettingSchema = z.object({
  key: z.string().min(1),
  value: z.any(), // JSON value
  description: z.string().optional(),
});

export type UpsertSettingInput = z.infer<typeof upsertSettingSchema>;

export const getSettingSchema = z.object({
  key: z.string().min(1),
});

export type GetSettingInput = z.infer<typeof getSettingSchema>;
