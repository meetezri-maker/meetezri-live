import { FastifyReply, FastifyRequest } from 'fastify';
import { createSleepEntry, deleteSleepEntry, getSleepEntries, getSleepEntryById, updateSleepEntry } from './sleep.service';
import { CreateSleepEntryInput, UpdateSleepEntryInput } from './sleep.schema';

interface UserPayload {
  sub: string;
  email?: string;
  role?: string;
}

export async function createSleepEntryHandler(
  request: FastifyRequest<{ Body: CreateSleepEntryInput }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const entry = await createSleepEntry(user.sub, request.body);
  return reply.code(201).send(entry);
}

export async function getSleepEntriesHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const entries = await getSleepEntries(user.sub);
  return reply.send(entries);
}

export async function getSleepEntryByIdHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const entry = await getSleepEntryById(user.sub, request.params.id);
  if (!entry) {
    return reply.code(404).send({ message: 'Sleep entry not found' });
  }
  if (entry.user_id !== user.sub) {
    return reply.code(403).send({ message: 'Unauthorized' });
  }
  return reply.send(entry);
}

export async function updateSleepEntryHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: UpdateSleepEntryInput }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  try {
    const entry = await updateSleepEntry(user.sub, request.params.id, request.body);
    return reply.send(entry);
  } catch (error) {
    return reply.code(404).send({ message: 'Sleep entry not found' });
  }
}

export async function getUserSleepEntriesHandler(
  request: FastifyRequest<{ Params: { userId: string } }>,
  reply: FastifyReply
) {
  const { userId } = request.params;
  const entries = await getSleepEntries(userId);
  return reply.send(entries);
}

export async function deleteSleepEntryHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  try {
    await deleteSleepEntry(user.sub, request.params.id);
    return reply.code(204).send();
  } catch (error) {
    return reply.code(404).send({ message: 'Sleep entry not found' });
  }
}
