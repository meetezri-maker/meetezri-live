import { FastifyInstance } from "fastify";
import {
  addAchievementCheckInHandler,
  completeCustomAchievementHandler,
  createCustomAchievementHandler,
  deleteCustomAchievementHandler,
  listAchievementCheckInsHandler,
  listCustomAchievementsHandler,
  updateCustomAchievementHandler,
} from "./custom-achievements.controller";
import {
  createAchievementCheckInSchema,
  createCustomAchievementSchema,
  updateCustomAchievementSchema,
} from "./custom-achievements.schema";

export async function customAchievementRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [app.authenticate] }, listCustomAchievementsHandler);

  app.post(
    "/",
    {
      schema: { body: createCustomAchievementSchema },
      preHandler: [app.authenticate],
    },
    createCustomAchievementHandler
  );

  app.patch(
    "/:achievementId",
    {
      schema: { body: updateCustomAchievementSchema },
      preHandler: [app.authenticate],
    },
    updateCustomAchievementHandler
  );

  app.delete(
    "/:achievementId",
    { preHandler: [app.authenticate] },
    deleteCustomAchievementHandler
  );

  app.post(
    "/:achievementId/complete",
    { preHandler: [app.authenticate] },
    completeCustomAchievementHandler
  );

  app.get(
    "/:achievementId/check-ins",
    { preHandler: [app.authenticate] },
    listAchievementCheckInsHandler
  );

  app.post(
    "/:achievementId/check-ins",
    {
      schema: { body: createAchievementCheckInSchema },
      preHandler: [app.authenticate],
    },
    addAchievementCheckInHandler
  );
}
