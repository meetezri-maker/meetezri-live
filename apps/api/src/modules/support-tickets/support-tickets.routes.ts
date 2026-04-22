import { FastifyInstance } from 'fastify';
import {
  createTicketHandler,
  getMyTicketsHandler,
  getTicketHandler,
  addTicketMessageHandler,
  closeTicketHandler,
} from './support-tickets.controller';

export async function supportTicketsRoutes(fastify: FastifyInstance) {
  fastify.get('/tickets', { preHandler: [fastify.authenticate] }, getMyTicketsHandler);
  fastify.post('/tickets', { preHandler: [fastify.authenticate] }, createTicketHandler);
  fastify.get('/tickets/:ticketId', { preHandler: [fastify.authenticate] }, getTicketHandler);
  fastify.post(
    '/tickets/:ticketId/messages',
    { preHandler: [fastify.authenticate] },
    addTicketMessageHandler
  );
  fastify.post(
    '/tickets/:ticketId/close',
    { preHandler: [fastify.authenticate] },
    closeTicketHandler
  );
}

