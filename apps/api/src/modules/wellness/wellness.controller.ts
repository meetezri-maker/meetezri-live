import { FastifyReply, FastifyRequest } from 'fastify';
import { createWellnessTool, deleteWellnessTool, getWellnessToolById, getWellnessTools, updateWellnessTool, trackWellnessProgress, getUserWellnessProgress, startWellnessSession, completeWellnessSession, getWellnessStats, getWellnessChallengesWithStats, toggleWellnessToolFavorite } from './wellness.service';
import { CreateWellnessToolInput, UpdateWellnessToolInput, TrackProgressInput } from './wellness.schema';

export async function createWellnessToolHandler(
  request: FastifyRequest<{ Body: CreateWellnessToolInput }>,
  reply: FastifyReply
) {
  const tool = await createWellnessTool({
    ...request.body,
    created_by: (request.user as any).sub
  });
  return reply.code(201).send(tool);
}

export async function getWellnessToolsHandler(
  request: FastifyRequest<{ Querystring: { category?: string } }>,
  reply: FastifyReply
) {
  const tools = await getWellnessTools((request.user as any).sub, request.query.category);
  return reply.send(tools);
}

export async function getWellnessToolByIdHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const tool = await getWellnessToolById((request.user as any).sub, request.params.id);
  if (!tool) {
    return reply.code(404).send({ message: 'Wellness tool not found' });
  }
  return reply.send(tool);
}

export async function updateWellnessToolHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: UpdateWellnessToolInput }>,
  reply: FastifyReply
) {
  try {
    const tool = await updateWellnessTool(request.params.id, request.body);
    return reply.send(tool);
  } catch (error) {
    return reply.code(404).send({ message: 'Wellness tool not found' });
  }
}

export async function toggleWellnessToolFavoriteHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const result = await toggleWellnessToolFavorite((request.user as any).sub, request.params.id);
    return reply.send(result);
  } catch (error: any) {
    if (error.message === 'Wellness tool not found') {
      return reply.code(404).send({ message: 'Wellness tool not found' });
    }
    throw error;
  }
}

export async function getUserWellnessProgressHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const progress = await getUserWellnessProgress((request.user as any).sub);
    return reply.send(progress);
  } catch (error) {
    return reply.code(500).send({ message: 'Failed to fetch wellness progress' });
  }
}

export async function deleteWellnessToolHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    await deleteWellnessTool(request.params.id);
    return reply.code(204).send();
  } catch (error) {
    return reply.code(404).send({ message: 'Wellness tool not found' });
  }
}

export async function trackWellnessProgressHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: TrackProgressInput }>,
  reply: FastifyReply
) {
  try {
    const progress = await trackWellnessProgress(
      (request.user as any).sub,
      request.params.id,
      request.body.duration_spent,
      request.body.feedback_rating
    );
    return reply.code(201).send(progress);
  } catch (error) {
    return reply.code(404).send({ message: 'Wellness tool not found' });
  }
}

export async function startWellnessSessionHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const session = await startWellnessSession(
      (request.user as any).sub,
      request.params.id
    );
    return reply.code(201).send(session);
  } catch (error: any) {
    request.log.error(error);
    if (error.message === 'User profile not found. Please complete onboarding.') {
      return reply.code(400).send({ message: error.message });
    }
    if (error.message === 'Wellness tool not found') {
      return reply.code(404).send({ message: error.message });
    }
    return reply.code(500).send({ message: 'Internal Server Error', error: error.message });
  }
}

export async function completeWellnessSessionHandler(
  request: FastifyRequest<{ Params: { progressId: string }; Body: TrackProgressInput }>,
  reply: FastifyReply
) {
  try {
    const progress = await completeWellnessSession(
      request.params.progressId,
      request.body.duration_spent,
      request.body.feedback_rating
    );
    return reply.code(200).send(progress);
  } catch (error) {
    return reply.code(404).send({ message: 'Session not found' });
  }
}

export async function getWellnessStatsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const stats = await getWellnessStats((request.user as any).sub);
    return reply.send(stats);
  } catch (error) {
    return reply.code(500).send({ message: 'Failed to fetch wellness stats' });
  }
}

export async function getWellnessChallengesHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const challenges = await getWellnessChallengesWithStats();
    return reply.send(challenges);
  } catch (error) {
    return reply.code(500).send({ message: 'Failed to fetch wellness challenges' });
  }
}
