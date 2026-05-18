import { z } from 'zod';

const resourceTypeSchema = z.enum([
  'crisis_line',
  'text_line',
  'emergency',
  'support_group',
  'trusted_contact',
]);

const interactionTypeSchema = z.enum([
  'view',
  'call',
  'text',
  'visit',
  'share',
  'copy',
]);

export const createSafetyResourceInteractionSchema = z.object({
  resource_id: z.string().min(1),
  resource_name: z.string().min(1),
  resource_type: resourceTypeSchema,
  interaction_type: interactionTypeSchema,
  context_session_id: z.string().min(1).max(240).optional(),
  safety_state: z.string().min(1).max(120).optional(),
});

export type CreateSafetyResourceInteractionInput = z.infer<
  typeof createSafetyResourceInteractionSchema
>;

export const listSafetyResourceInteractionsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  /** Max rows returned (defaults 2500, capped 5000). */
  limit: z.coerce.number().min(1).max(5000).optional(),
});
