import { FastifyReply, FastifyRequest } from "fastify";
import { getUserPointsSummary, listUserTransactions } from "./points.service";

/** GET /api/gamification/points — the caller's own total points + level. */
export async function getMyPointsHandler(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user as { sub: string };
  const summary = await getUserPointsSummary(user.sub);
  return reply.send(summary);
}

/** GET /api/gamification/transactions — the caller's own ledger (never another user's). */
export async function listMyTransactionsHandler(
  request: FastifyRequest<{ Querystring: { limit?: string } }>,
  reply: FastifyReply
) {
  const user = request.user as { sub: string };
  const limit = request.query.limit ? Number(request.query.limit) : 100;
  const rows = await listUserTransactions(user.sub, Number.isFinite(limit) ? limit : 100);
  return reply.send(rows);
}
