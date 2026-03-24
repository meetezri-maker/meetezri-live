import { FastifyInstance } from 'fastify';
import {
  getContactsHandler,
  createContactHandler,
  updateContactHandler,
  deleteContactHandler,
} from './emergency-contacts.controller';
import { createEmergencyContactSchema, updateEmergencyContactWithFieldsSchema, emergencyContactResponseSchema } from './emergency-contacts.schema';
import { z } from 'zod';

export async function emergencyContactRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    {
      preHandler: [fastify.authenticate],
      schema: {
        response: {
          200: z.array(emergencyContactResponseSchema),
        },
      },
    },
    getContactsHandler
  );

  fastify.post(
    '/',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: createEmergencyContactSchema,
        response: {
          201: emergencyContactResponseSchema,
        },
      },
    },
    createContactHandler
  );

  fastify.patch(
    '/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: updateEmergencyContactWithFieldsSchema,
        response: {
          200: emergencyContactResponseSchema,
        },
      },
    },
    updateContactHandler
  );

  fastify.delete(
    '/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    deleteContactHandler
  );
}
