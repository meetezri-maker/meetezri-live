
import { FastifyInstance } from "fastify";
import {
  createAvatarHandler,
  getAllAvatarsHandler,
  getAllAvatarsWithUsageStatsHandler,
  getAvatarByIdHandler,
  updateAvatarHandler,
  deleteAvatarHandler,
  getAvatarSessionsHandler,
  getAvatarUsersHandler,
} from "./ai-avatars.controller";
import { createAvatarSchema, updateAvatarSchema } from "./ai-avatars.schema";

export async function aiAvatarsRoutes(server: FastifyInstance) {
  server.post(
    "/",
    {
      preHandler: [server.authenticate],
      schema: {
        body: createAvatarSchema,
      },
    },
    createAvatarHandler
  );

  server.get(
    "/",
    {
      preHandler: [server.authenticate],
    },
    getAllAvatarsHandler
  );

  server.get(
    "/stats",
    {
      preHandler: [server.authenticate, server.authorize(['super_admin', 'org_admin', 'team_admin'])],
    },
    getAllAvatarsWithUsageStatsHandler
  );

  server.get(
    "/:id",
    {
      preHandler: [server.authenticate],
    },
    getAvatarByIdHandler
  );

  server.put(
    "/:id",
    {
      preHandler: [server.authenticate],
      schema: {
        body: updateAvatarSchema,
      },
    },
    updateAvatarHandler
  );

  server.delete(
    "/:id",
    {
      preHandler: [server.authenticate],
    },
    deleteAvatarHandler
  );

  server.get(
    "/:id/sessions",
    {
      preHandler: [server.authenticate, server.authorize(['super_admin', 'org_admin', 'team_admin'])],
    },
    getAvatarSessionsHandler
  );

  server.get(
    "/:id/users",
    {
      preHandler: [server.authenticate, server.authorize(['super_admin', 'org_admin', 'team_admin'])],
    },
    getAvatarUsersHandler
  );
}
