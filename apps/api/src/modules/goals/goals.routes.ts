import { FastifyInstance } from "fastify";
import {
  createGoalCheckInHandler,
  createGoalHandler,
  deleteGoalHandler,
  getGoalHandler,
  listGoalCheckInsHandler,
  listGoalsHandler,
  updateGoalHandler,
  updateGoalStatusHandler,
} from "./goals.controller";
import {
  createGoalCheckInSchema,
  createGoalSchema,
  updateGoalSchema,
  updateGoalStatusSchema,
} from "./goals.schema";

export async function goalsRoutes(app: FastifyInstance) {
  app.get(
    "/",
    { preHandler: [app.authenticate] },
    listGoalsHandler
  );

  app.post(
    "/",
    {
      schema: { body: createGoalSchema },
      preHandler: [app.authenticate],
    },
    createGoalHandler
  );

  app.get(
    "/:goalId",
    { preHandler: [app.authenticate] },
    getGoalHandler
  );

  app.patch(
    "/:goalId",
    {
      schema: { body: updateGoalSchema },
      preHandler: [app.authenticate],
    },
    updateGoalHandler
  );

  app.patch(
    "/:goalId/status",
    {
      schema: { body: updateGoalStatusSchema },
      preHandler: [app.authenticate],
    },
    updateGoalStatusHandler
  );

  app.delete(
    "/:goalId",
    { preHandler: [app.authenticate] },
    deleteGoalHandler
  );

  app.get(
    "/:goalId/check-ins",
    { preHandler: [app.authenticate] },
    listGoalCheckInsHandler
  );

  app.post(
    "/:goalId/check-ins",
    {
      schema: { body: createGoalCheckInSchema },
      preHandler: [app.authenticate],
    },
    createGoalCheckInHandler
  );
}
