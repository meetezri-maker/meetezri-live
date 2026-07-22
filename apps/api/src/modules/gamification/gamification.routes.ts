import { FastifyInstance } from "fastify";
import { getMyPointsHandler, listMyTransactionsHandler } from "./gamification.controller";

export async function gamificationRoutes(app: FastifyInstance) {
  // Both endpoints are strictly scoped to the authenticated user (request.user.sub).
  app.get("/points", { preHandler: [app.authenticate] }, getMyPointsHandler);
  app.get("/transactions", { preHandler: [app.authenticate] }, listMyTransactionsHandler);
}
