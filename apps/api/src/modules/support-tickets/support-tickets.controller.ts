import { FastifyReply, FastifyRequest } from 'fastify';
import * as supportTicketsService from './support-tickets.service';

type UserPayload = {
  sub: string;
  appRole?: string;
};

function isPrivilegedRole(role?: string) {
  return role === 'super_admin' || role === 'org_admin' || role === 'team_admin';
}

export async function getMyTicketsHandler(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user as UserPayload;
  const q = request.query as { status?: string; limit?: string };
  const limit = q?.limit ? Math.min(Math.max(parseInt(q.limit, 10) || 20, 1), 50) : 20;
  try {
    return await supportTicketsService.listTicketsForUser(user.sub, {
      status: q?.status,
      limit,
    });
  } catch (err: any) {
    return reply.code(500).send({ message: err?.message || 'Failed to load tickets' });
  }
}

export async function createTicketHandler(
  request: FastifyRequest<{
    Body: { subject: string; description: string; priority?: 'low' | 'medium' | 'high' | 'urgent' };
  }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const body = request.body || ({} as any);
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';

  if (!subject) return reply.code(400).send({ message: 'Subject is required' });
  if (!description) return reply.code(400).send({ message: 'Description is required' });

  try {
    return await supportTicketsService.createTicket(user.sub, {
      subject,
      description,
      priority: body.priority,
    });
  } catch (err: any) {
    return reply.code(500).send({ message: err?.message || 'Failed to create ticket' });
  }
}

export async function getTicketHandler(
  request: FastifyRequest<{ Params: { ticketId: string } }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  try {
    const ticket = await supportTicketsService.getTicketById(request.params.ticketId, {
      requesterUserId: user.sub,
      allowIfAdmin: isPrivilegedRole(user.appRole),
    });
    return ticket;
  } catch (err: any) {
    const code = err?.statusCode === 404 ? 404 : err?.statusCode === 403 ? 403 : 500;
    return reply.code(code).send({ message: err?.message || 'Failed to load ticket' });
  }
}

export async function addTicketMessageHandler(
  request: FastifyRequest<{ Params: { ticketId: string }; Body: { body: string } }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const b = request.body || ({} as any);
  const body = typeof b.body === 'string' ? b.body.trim() : '';
  if (!body) return reply.code(400).send({ message: 'Message is required' });

  try {
    return await supportTicketsService.addMessage(request.params.ticketId, {
      requesterUserId: user.sub,
      requesterRole: isPrivilegedRole(user.appRole) ? 'support' : 'user',
      body,
      allowIfAdmin: isPrivilegedRole(user.appRole),
    });
  } catch (err: any) {
    const code = err?.statusCode === 404 ? 404 : err?.statusCode === 403 ? 403 : 500;
    return reply.code(code).send({ message: err?.message || 'Failed to send message' });
  }
}

export async function closeTicketHandler(
  request: FastifyRequest<{ Params: { ticketId: string } }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  try {
    return await supportTicketsService.closeTicket(request.params.ticketId, {
      requesterUserId: user.sub,
      allowIfAdmin: isPrivilegedRole(user.appRole),
    });
  } catch (err: any) {
    const code = err?.statusCode === 404 ? 404 : err?.statusCode === 403 ? 403 : 500;
    return reply.code(code).send({ message: err?.message || 'Failed to close ticket' });
  }
}

