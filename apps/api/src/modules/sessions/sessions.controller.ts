import { FastifyReply, FastifyRequest } from 'fastify';
import { createSession, getSessions, getSessionById, endSession, createMessage, getSessionTranscript, toggleSessionFavorite } from './sessions.service';
import { CreateSessionInput, EndSessionInput, CreateMessageInput } from './sessions.schema';

interface UserPayload {
  sub: string;
  email?: string;
  role?: string;
}

export async function createSessionHandler(
  request: FastifyRequest<{ Body: CreateSessionInput }>,
  reply: FastifyReply
) {
  try {
    const user = request.user as UserPayload;
    const session = await createSession(user.sub, request.body);
    return reply.code(201).send(session);
  } catch (error: any) {
    console.error('Error in createSessionHandler:', error);
    if (error.message.includes('User profile not found')) {
      return reply.code(400).send({ message: error.message });
    }
    throw error;
  }
}

export async function scheduleSessionHandler(
  request: FastifyRequest<{ Body: CreateSessionInput }>,
  reply: FastifyReply
) {
  try {
    const user = request.user as UserPayload;
    // Force type to be scheduled
    const input = { ...request.body, type: 'scheduled' as const };
    const session = await createSession(user.sub, input);
    return reply.code(201).send(session);
  } catch (error: any) {
    console.error('Error in scheduleSessionHandler:', error);
    if (error.message.includes('User profile not found')) {
      return reply.code(400).send({ message: error.message });
    }
    throw error;
  }
}

export async function createMessageHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: CreateMessageInput }>,
  reply: FastifyReply
) {
  try {
    const user = request.user as UserPayload;
    const message = await createMessage(user.sub, request.params.id, request.body);
    return reply.code(201).send(message);
  } catch (error: any) {
    if (error.message === 'Session not found') {
      return reply.code(404).send({ message: 'Session not found' });
    }
    throw error;
  }
}

export async function toggleSessionFavoriteHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const user = request.user as UserPayload;
    const session = await toggleSessionFavorite(user.sub, request.params.id);
    return reply.send(session);
  } catch (error: any) {
    if (error.message === 'Session not found') {
      return reply.code(404).send({ message: 'Session not found' });
    }
    throw error;
  }
}

export async function getSessionTranscriptHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const user = request.user as UserPayload;
    const messages = await getSessionTranscript(user.sub, request.params.id);
    return reply.send(messages);
  } catch (error: any) {
    if (error.message === 'Session not found') {
      return reply.code(404).send({ message: 'Session not found' });
    }
    throw error;
  }
}

export async function getSessionsHandler(
  request: FastifyRequest<{ Querystring: { status?: string } }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const sessions = await getSessions(user.sub, request.query.status);
  return reply.send(sessions);
}

export async function getUserSessionsHandler(
  request: FastifyRequest<{ Params: { userId: string } }>,
  reply: FastifyReply
) {
  const sessions = await getSessions(request.params.userId);
  return reply.send(sessions);
}

export async function getSessionHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const session = await getSessionById(user.sub, request.params.id);
  if (!session) {
    return reply.code(404).send({ message: 'Session not found' });
  }
  return reply.send(session);
}

export async function endSessionHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: EndSessionInput }>,
  reply: FastifyReply
) {
  try {
    const user = request.user as UserPayload;
    const session = await endSession(
      user.sub, 
      request.params.id, 
      request.body.duration_seconds,
      request.body.recording_url,
      request.body.transcript
    );
    return reply.send(session);
  } catch (error: any) {
    if (error.message === 'Session not found') {
      return reply.code(404).send({ message: 'Session not found' });
    }
    throw error;
  }
}
