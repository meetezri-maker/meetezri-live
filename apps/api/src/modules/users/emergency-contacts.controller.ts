import { FastifyReply, FastifyRequest } from 'fastify';
import { CreateEmergencyContactInput, UpdateEmergencyContactInput } from './emergency-contacts.schema';
import { getEmergencyContacts, createEmergencyContact, updateEmergencyContact, deleteEmergencyContact } from './emergency-contacts.service';

export async function getContactsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as { sub: string };
  const contacts = await getEmergencyContacts(user.sub);
  return reply.code(200).send(contacts);
}

export async function createContactHandler(
  request: FastifyRequest<{ Body: CreateEmergencyContactInput }>,
  reply: FastifyReply
) {
  const user = request.user as { sub: string };
  const contact = await createEmergencyContact(user.sub, request.body);
  return reply.code(201).send(contact);
}

export async function updateContactHandler(
  request: FastifyRequest<{ Params: { id: string }; Body: UpdateEmergencyContactInput }>,
  reply: FastifyReply
) {
  const user = request.user as { sub: string };
  const { id } = request.params;
  try {
    const contact = await updateEmergencyContact(user.sub, id, request.body);
    return reply.code(200).send(contact);
  } catch (error) {
    return reply.code(404).send({ message: 'Contact not found' });
  }
}

export async function deleteContactHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const user = request.user as { sub: string };
  const { id } = request.params;
  try {
    await deleteEmergencyContact(user.sub, id);
    return reply.code(204).send();
  } catch (error) {
    return reply.code(404).send({ message: 'Contact not found' });
  }
}
