import { FastifyInstance } from "fastify";
import {
  createCustomAchievementHandler,
  deleteCustomAchievementHandler,
  listCustomAchievementsHandler,
  updateCustomAchievementHandler,
} from "./custom-achievements.controller";
import {
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
}
