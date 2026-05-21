import { FastifyReply, FastifyRequest } from 'fastify';
import { createWellnessTool, createWellnessChallenge, deleteWellnessTool, getWellnessToolById, getWellnessTools, updateWellnessTool, trackWellnessProgress, getUserWellnessProgress, getWellnessInsights, startWellnessSession, completeWellnessSession, getWellnessStats, getWellnessChallengesWithStats, getWellnessChallengesForUserDashboard, toggleWellnessToolFavorite, updateWellnessChallenge, joinWellnessChallenge, unjoinWellnessChallenge, type WellnessInsightsPeriod } from './wellness.service';
import {
  CreateWellnessChallengeInput,
  CreateWellnessToolInput,
  UpdateWellnessToolInput,
  TrackProgressInput,
  createWellnessChallengeSchema,
  updateWellnessChallengeSchema,
} from './wellness.schema';

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

export async function getWellnessInsightsHandler(
  request: FastifyRequest<{ Querystring: { period?: string } }>,
  reply: FastifyReply
) {
  try {
    const raw = request.query?.period ?? 'week';
    const period = (['today', 'week', 'month'].includes(raw) ? raw : 'week') as WellnessInsightsPeriod;
    const insights = await getWellnessInsights((request.user as any).sub, period);
    return reply.send(insights);
  } catch (error) {
    return reply.code(500).send({ message: 'Failed to fetch wellness insights' });
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
      (request.user as any).sub,
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
  request: FastifyRequest<{ Querystring: { scope?: string } }>,
  reply: FastifyReply
) {
  try {
    if (request.query?.scope === 'dashboard') {
      const userId = (request.user as { sub: string }).sub;
      const data = await getWellnessChallengesForUserDashboard(userId);
      return reply.send(data);
    }
    const payload = await getWellnessChallengesWithStats();
    return reply.send(payload);
  } catch (error) {
    return reply.code(500).send({ message: 'Failed to fetch wellness challenges' });
  }
}

export async function getWellnessChallengesMeHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const userId = (request.user as { sub: string }).sub;
    const data = await getWellnessChallengesForUserDashboard(userId);
    return reply.send(data);
  } catch (error) {
    return reply.code(500).send({ message: 'Failed to fetch your wellness challenges' });
  }
}

export async function createWellnessChallengeHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const body: CreateWellnessChallengeInput = createWellnessChallengeSchema.parse(request.body);
    const created = await createWellnessChallenge(body);
    return reply.code(201).send(created);
  } catch (error: any) {
    const message =
      error?.name === 'ZodError'
        ? 'Invalid challenge payload'
        : error?.message || 'Failed to create wellness challenge';
    return reply.code(400).send({ message });
  }
}

export async function joinWellnessChallengeHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const userId = (request.user as { sub: string }).sub;
    const result = await joinWellnessChallenge(userId, request.params.id);
    return reply.code(201).send(result);
  } catch (error: any) {
    if (error.message === 'Challenge not found') {
      return reply.code(404).send({ message: 'Challenge not found' });
    }
    throw error;
  }
}

export async function unjoinWellnessChallengeHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const userId = (request.user as { sub: string }).sub;
  await unjoinWellnessChallenge(userId, request.params.id);
  return reply.code(204).send();
}

export async function updateWellnessChallengeHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const body = updateWellnessChallengeSchema.parse(request.body);
    const updated = await updateWellnessChallenge(request.params.id, body);
    return reply.send(updated);
  } catch (error: any) {
    if (error?.message === 'Wellness challenge not found') {
      return reply.code(404).send({ message: 'Wellness challenge not found' });
    }
    const message =
      error?.name === 'ZodError'
        ? 'Invalid challenge payload'
        : error?.message || 'Failed to update wellness challenge';
    return reply.code(400).send({ message });
  }
}
