import prisma from '../../lib/prisma';
import type { CreateSafetyResourceInteractionInput } from './safety-resource-interactions.schema';

export async function recordInteraction(
  userId: string,
  input: CreateSafetyResourceInteractionInput
) {
  return prisma.safety_resource_interactions.create({
    data: {
      user_id: userId,
      resource_id: input.resource_id,
      resource_name: input.resource_name,
      resource_type: input.resource_type,
      interaction_type: input.interaction_type,
      context_session_id: input.context_session_id ?? null,
      safety_state: input.safety_state ?? null,
    },
    select: {
      id: true,
      resource_id: true,
      interaction_type: true,
      created_at: true,
    },
  });
}

export async function listForUser(params: {
  userId: string;
  from?: Date;
  to?: Date;
  take?: number;
}) {
  const take = Math.min(params.take ?? 2500, 5000);

  const where = {
    user_id: params.userId,
    ...(params.from || params.to
      ? {
          created_at: {
            ...(params.from ? { gte: params.from } : {}),
            ...(params.to ? { lte: params.to } : {}),
          },
        }
      : {}),
  };

  const rows = await prisma.safety_resource_interactions.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take,
    select: {
      id: true,
      resource_id: true,
      resource_name: true,
      resource_type: true,
      interaction_type: true,
      context_session_id: true,
      safety_state: true,
      created_at: true,
    },
  });

  return rows;
}
