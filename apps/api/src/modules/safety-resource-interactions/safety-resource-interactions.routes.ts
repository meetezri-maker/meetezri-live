import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createSafetyResourceInteractionSchema,
  listSafetyResourceInteractionsQuerySchema,
} from './safety-resource-interactions.schema';
import * as service from './safety-resource-interactions.service';

const rowSchema = z.object({
  id: z.string().uuid(),
  resource_id: z.string(),
  resource_name: z.string(),
  resource_type: z.string(),
  interaction_type: z.string(),
  context_session_id: z.string().nullable(),
  safety_state: z.string().nullable(),
  created_at: z.union([z.date(), z.string().datetime()]),
});

export async function safetyResourceInteractionsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.post('/', {
    schema: {
      tags: ['Safety resources'],
      body: createSafetyResourceInteractionSchema,
      response: {
        201: z.object({
          id: z.string().uuid(),
          resource_id: z.string(),
          interaction_type: z.string(),
          created_at: z.union([z.date(), z.string().datetime()]),
        }),
      },
    },
  }, async (req, reply) => {
    const userId = (req as { user: { sub: string } }).user.sub;
    const body = createSafetyResourceInteractionSchema.parse(req.body);
    const created = await service.recordInteraction(userId, body);
    return reply.status(201).send(created);
  });

  app.get('/', {
    schema: {
      tags: ['Safety resources'],
      querystring: listSafetyResourceInteractionsQuerySchema,
      response: {
        200: z.array(rowSchema),
      },
    },
  }, async (req) => {
    const userId = (req as { user: { sub: string } }).user.sub;
    const q = listSafetyResourceInteractionsQuerySchema.parse((req as { query: unknown }).query);

    let from: Date | undefined;
    let to: Date | undefined;
    if (q.from) {
      from = new Date(q.from);
    }
    if (q.to) {
      to = new Date(q.to);
    }

    return service.listForUser({
      userId,
      from,
      to,
      take: q.limit,
    });
  });
}
