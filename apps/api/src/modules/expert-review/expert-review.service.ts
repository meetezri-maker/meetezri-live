import { getAiSupabaseAdmin } from '../../config/aiSupabase';
import prisma from '../../lib/prisma';
import {
  expertReviewConversationSelect,
  type ExpertReviewConversation,
  type ListExpertReviewConversationsQuery,
  type UpdateExpertReviewBody,
} from './expert-review.schema';

export class AiSupabaseConfigurationError extends Error {
  constructor() {
    super('AI Supabase is not configured');
    this.name = 'AiSupabaseConfigurationError';
  }
}

export class AiSupabaseUnavailableError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    super('AI Supabase is unavailable');
    this.name = 'AiSupabaseUnavailableError';
    this.cause = cause;
  }
}

export class ExpertReviewConversationNotFoundError extends Error {
  constructor() {
    super('Conversation not found');
    this.name = 'ExpertReviewConversationNotFoundError';
  }
}

export async function listExpertReviewConversations(
  query: ListExpertReviewConversationsQuery
): Promise<{
  items: ExpertReviewConversation[];
  page: number;
  limit: number;
  total: number;
}> {
  const client = getAiSupabaseAdmin();
  if (!client) throw new AiSupabaseConfigurationError();

  const fromIndex = (query.page - 1) * query.limit;
  const toIndex = fromIndex + query.limit - 1;

  let request = client
    .from('conversations')
    .select(expertReviewConversationSelect, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(fromIndex, toIndex);

  if (typeof query.reviewed === 'boolean') {
    request = request.eq('is_reviewed', query.reviewed);
  }
  if (query.from) {
    request = request.gte('created_at', new Date(query.from).toISOString());
  }
  if (query.to) {
    request = request.lte('created_at', new Date(query.to).toISOString());
  }

  const { data, error, count } = await request;
  if (error) throw new AiSupabaseUnavailableError(error);

  return {
    items: (data ?? []) as ExpertReviewConversation[],
    page: query.page,
    limit: query.limit,
    total: count ?? 0,
  };
}

export async function getExpertReviewConversationById(
  id: string
): Promise<ExpertReviewConversation | null> {
  const client = getAiSupabaseAdmin();
  if (!client) throw new AiSupabaseConfigurationError();

  const { data, error } = await client
    .from('conversations')
    .select(expertReviewConversationSelect)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new AiSupabaseUnavailableError(error);
  return (data ?? null) as ExpertReviewConversation | null;
}

export async function updateExpertReviewConversation(
  id: string,
  input: UpdateExpertReviewBody,
  actor: { id: string; role?: string | null }
): Promise<ExpertReviewConversation> {
  const client = getAiSupabaseAdmin();
  if (!client) throw new AiSupabaseConfigurationError();

  const current = await getExpertReviewConversationById(id);
  if (!current) throw new ExpertReviewConversationNotFoundError();

  const updateData = {
    expert_analysis: input.expert_analysis,
    expert_rephrased: input.expert_rephrased,
    is_reviewed: true,
  };

  const { data, error } = await client
    .from('conversations')
    .update(updateData)
    .eq('id', id)
    .select(expertReviewConversationSelect)
    .maybeSingle();

  if (error) throw new AiSupabaseUnavailableError(error);
  if (!data) throw new ExpertReviewConversationNotFoundError();

  await prisma.audit_logs.create({
    data: {
      actor_id: actor.id,
      action: 'expert_review_conversation_saved',
      details: {
        actor_role: actor.role ?? null,
        conversation_id: id,
        previous_is_reviewed: current.is_reviewed,
        reviewed_after: true,
        expert_analysis_length: input.expert_analysis.length,
        expert_rephrased_length: input.expert_rephrased.length,
      },
    },
  });

  return data as ExpertReviewConversation;
}
