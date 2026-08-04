import { z } from 'zod';

export const expertReviewConversationSelect =
  'id,userid,session_id,user_query,brain_output,created_at,expert_analysis,expert_rephrased,is_reviewed';

export const expertReviewConversationSchema = z.object({
  id: z.string().uuid(),
  userid: z.string(),
  session_id: z.string().nullable(),
  user_query: z.string(),
  brain_output: z.string(),
  created_at: z.string().nullable(),
  expert_analysis: z.string().nullable(),
  expert_rephrased: z.string().nullable(),
  is_reviewed: z.boolean().nullable(),
});

const isoDateSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Must be a valid ISO date',
  });

export const listExpertReviewConversationsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    reviewed: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => {
        if (value === 'true') return true;
        if (value === 'false') return false;
        return undefined;
      }),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
  })
  .refine(
    (value) => {
      if (!value.from || !value.to) return true;
      return Date.parse(value.from) <= Date.parse(value.to);
    },
    {
      message: '`from` must be before or equal to `to`',
      path: ['from'],
    }
  );

export const expertReviewConversationParamsSchema = z.object({
  id: z.string().uuid('Invalid conversation id'),
});

export const updateExpertReviewBodySchema = z
  .object({
    expert_analysis: z.string().trim().min(10).max(10000),
    expert_rephrased: z.string().trim().min(10).max(20000),
  })
  .strict();

export const listExpertReviewConversationsResponseSchema = z.object({
  items: z.array(expertReviewConversationSchema),
  page: z.number().int().min(1),
  limit: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
});

export const safeErrorResponseSchema = z.object({
  statusCode: z.number(),
  error: z.string(),
  code: z.string().optional(),
  message: z.string(),
});

export type ListExpertReviewConversationsQuery = z.output<
  typeof listExpertReviewConversationsQuerySchema
>;
export type ExpertReviewConversation = z.infer<typeof expertReviewConversationSchema>;
export type UpdateExpertReviewBody = z.infer<typeof updateExpertReviewBodySchema>;
