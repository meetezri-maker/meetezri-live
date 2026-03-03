import { FastifyInstance } from "fastify";
import {
  createHabitHandler,
  getHabitsHandler,
  updateHabitHandler,
  deleteHabitHandler,
  logHabitCompletionHandler,
  removeHabitCompletionHandler,
  getUserHabitsHandler
} from "./habits.controller";
import { createHabitSchema, updateHabitSchema, logHabitSchema, habitResponseSchema } from "./habits.schema";

export async function habitsRoutes(server: FastifyInstance) {
  server.get(
    "/admin/users/:userId/habits",
    {
      preHandler: [server.authenticate, server.authorize(['super_admin', 'org_admin'])],
    },
    getUserHabitsHandler
  );

  server.post(
    "/",
    {
      preHandler: [server.authenticate],
      schema: {
        body: createHabitSchema,
        response: {
          201: habitResponseSchema,
        },
      },
    },
    createHabitHandler
  );

  server.get(
    "/",
    {
      preHandler: [server.authenticate],
    },
    getHabitsHandler
  );

  server.put(
    "/:id",
    {
      preHandler: [server.authenticate],
      schema: {
        body: updateHabitSchema,
        response: {
          200: habitResponseSchema,
        },
      },
    },
    updateHabitHandler
  );

  server.delete(
    "/:id",
    {
      preHandler: [server.authenticate],
    },
    deleteHabitHandler
  );

  server.post(
    "/:id/complete",
    {
      preHandler: [server.authenticate],
      schema: {
        body: logHabitSchema,
      },
    },
    logHabitCompletionHandler
  );

  server.delete(
    "/:id/complete",
    {
      preHandler: [server.authenticate],
    },
    removeHabitCompletionHandler
  );
}
