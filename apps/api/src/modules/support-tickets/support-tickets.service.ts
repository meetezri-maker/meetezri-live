import prisma from '../../lib/prisma';
import { $Enums, Prisma } from '@prisma/client';
import { notificationsService } from '../notifications/notifications.service';

const VALID_STATUSES = Object.values($Enums.ticket_status) as $Enums.ticket_status[];
const VALID_PRIORITIES = Object.values($Enums.ticket_priority) as $Enums.ticket_priority[];

function parseStatus(status?: string): $Enums.ticket_status | undefined {
  if (!status) return undefined;
  return VALID_STATUSES.includes(status as $Enums.ticket_status)
    ? (status as $Enums.ticket_status)
    : undefined;
}

function parsePriority(priority?: string): $Enums.ticket_priority | undefined {
  if (!priority) return undefined;
  return VALID_PRIORITIES.includes(priority as $Enums.ticket_priority)
    ? (priority as $Enums.ticket_priority)
    : undefined;
}

export async function listTicketsForUser(
  userId: string,
  opts: { status?: string; limit?: number }
) {
  const statusFilter = parseStatus(opts.status);
  const take = Math.min(Math.max(opts.limit ?? 20, 1), 50);

  return prisma.support_tickets.findMany({
    where: {
      user_id: userId,
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    take,
    orderBy: { updated_at: 'desc' },
    select: {
      id: true,
      subject: true,
      description: true,
      priority: true,
      status: true,
      created_at: true,
      updated_at: true,
    },
  });
}

export async function createTicket(
  userId: string,
  data: { subject: string; description: string; priority?: string }
) {
  const priority = parsePriority(data.priority) ?? $Enums.ticket_priority.medium;

  const ticket = await prisma.support_tickets.create({
    data: {
      user_id: userId,
      subject: data.subject,
      description: data.description,
      priority,
      status: $Enums.ticket_status.open,
    },
    select: {
      id: true,
      subject: true,
      description: true,
      priority: true,
      status: true,
      created_at: true,
      updated_at: true,
    },
  });

  // Seed the thread with the initial description as the first message.
  await prisma.support_ticket_messages.create({
    data: {
      ticket_id: ticket.id,
      author_user_id: userId,
      author_role: 'user',
      body: data.description,
    },
  });

  return ticket;
}

export async function getTicketById(
  ticketId: string,
  opts: { requesterUserId: string; allowIfAdmin: boolean }
) {
  const ticket = await prisma.support_tickets.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      user_id: true,
      subject: true,
      description: true,
      priority: true,
      status: true,
      assigned_to: true,
      created_at: true,
      updated_at: true,
      support_ticket_messages: {
        orderBy: { created_at: 'asc' },
        select: {
          id: true,
          author_user_id: true,
          author_role: true,
          body: true,
          created_at: true,
          profiles: {
            select: { full_name: true, avatar_url: true, email: true, role: true },
          },
        },
      },
    },
  });

  if (!ticket) {
    const err: any = new Error('Ticket not found');
    err.statusCode = 404;
    throw err;
  }

  if (!opts.allowIfAdmin && ticket.user_id !== opts.requesterUserId) {
    const err: any = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }

  return ticket;
}

export async function addMessage(
  ticketId: string,
  data: {
    requesterUserId: string;
    requesterRole: 'user' | 'support';
    body: string;
    allowIfAdmin: boolean;
  }
) {
  const ticket = await prisma.support_tickets.findUnique({
    where: { id: ticketId },
    select: { id: true, user_id: true, status: true, subject: true },
  });

  if (!ticket) {
    const err: any = new Error('Ticket not found');
    err.statusCode = 404;
    throw err;
  }

  if (!data.allowIfAdmin && ticket.user_id !== data.requesterUserId) {
    const err: any = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }

  // Prevent new messages on closed tickets for non-admins.
  if (!data.allowIfAdmin && ticket.status === $Enums.ticket_status.closed) {
    const err: any = new Error('Ticket is closed');
    err.statusCode = 403;
    throw err;
  }

  const msg = await prisma.support_ticket_messages.create({
    data: {
      ticket_id: ticketId,
      author_user_id: data.requesterUserId,
      author_role: data.requesterRole,
      body: data.body,
    },
    select: {
      id: true,
      ticket_id: true,
      author_user_id: true,
      author_role: true,
      body: true,
      created_at: true,
    },
  });

  const patch: Prisma.support_ticketsUncheckedUpdateInput = {
    updated_at: new Date(),
  };

  // If user writes after resolved/closed, move it back to open (unless admin/support).
  if (data.requesterRole === 'user') {
    if (ticket.status === $Enums.ticket_status.resolved || ticket.status === $Enums.ticket_status.closed) {
      patch.status = $Enums.ticket_status.open;
    }
  } else {
    // Support reply marks ticket in-progress when it was open.
    if (ticket.status === $Enums.ticket_status.open) {
      patch.status = $Enums.ticket_status.in_progress;
    }
  }

  await prisma.support_tickets.update({
    where: { id: ticketId },
    data: patch,
  });

  // Notify the ticket owner when support replies.
  if (data.requesterRole === 'support' && ticket.user_id !== data.requesterUserId) {
    try {
      await notificationsService.create({
        user_id: ticket.user_id,
        type: 'support',
        title: 'Support replied to your ticket',
        message: ticket.subject ? `Ticket: ${ticket.subject}` : 'You have a new reply on your support ticket.',
        metadata: {
          kind: 'support_ticket',
          ticketId,
          action: 'reply',
        },
      } as any);
    } catch {
      // Notification failures should not block support replies.
    }
  }

  return msg;
}

export async function closeTicket(
  ticketId: string,
  opts: { requesterUserId: string; allowIfAdmin: boolean }
) {
  const ticket = await prisma.support_tickets.findUnique({
    where: { id: ticketId },
    select: { id: true, user_id: true },
  });
  if (!ticket) {
    const err: any = new Error('Ticket not found');
    err.statusCode = 404;
    throw err;
  }
  if (!opts.allowIfAdmin && ticket.user_id !== opts.requesterUserId) {
    const err: any = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }

  return prisma.support_tickets.update({
    where: { id: ticketId },
    data: { status: $Enums.ticket_status.closed, updated_at: new Date() },
    select: {
      id: true,
      subject: true,
      status: true,
      updated_at: true,
    },
  });
}

