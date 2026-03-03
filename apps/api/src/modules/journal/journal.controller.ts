import { FastifyReply, FastifyRequest } from 'fastify';
import { createJournalEntry, deleteJournalEntry, getJournalEntries, getJournalEntryById, updateJournalEntry, toggleJournalFavorite } from './journal.service';
import { CreateJournalInput, UpdateJournalInput } from './journal.schema';

interface UserPayload {
  sub: string;
  email?: string;
  role?: string;
}

export async function createJournalHandler(
  request: FastifyRequest<{ Body: CreateJournalInput }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const journal = await createJournalEntry(user.sub, request.body);
  return reply.code(201).send(journal);
}

export async function getJournalsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const journals = await getJournalEntries(user.sub);
  return reply.send(journals);
}

export async function getJournalByIdHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const { id } = request.params;
  const journal = await getJournalEntryById(user.sub, id);
  
  if (!journal) {
    return reply.code(404).send({ message: 'Journal entry not found' });
  }
  
  return reply.send(journal);
}

export async function updateJournalHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: UpdateJournalInput }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const { id } = request.params;
  
  try {
    const journal = await updateJournalEntry(user.sub, id, request.body);
    return reply.send(journal);
  } catch (error) {
    return reply.code(404).send({ message: 'Journal entry not found' });
  }
}

export async function toggleJournalFavoriteHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const { id } = request.params;
  
  try {
    const journal = await toggleJournalFavorite(user.sub, id);
    return reply.send(journal);
  } catch (error) {
    return reply.code(404).send({ message: 'Journal entry not found' });
  }
}

export async function getUserJournalsHandler(
  request: FastifyRequest<{ Params: { userId: string } }>,
  reply: FastifyReply
) {
  const { userId } = request.params;
  const journals = await getJournalEntries(userId);
  return reply.send(journals);
}

export async function deleteJournalHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const { id } = request.params;
  
  try {
    await deleteJournalEntry(user.sub, id);
    return reply.code(204).send();
  } catch (error) {
    return reply.code(404).send({ message: 'Journal entry not found' });
  }
}
