import { FastifyReply, FastifyRequest } from "fastify";
import { generateProgressReport } from "./progress-report.service";
import type { ProgressReportRange } from "./progress-report.constants";

/**
 * GET /api/gamification/report?range=7d|30d|90d|all
 *
 * Returns the authenticated user's progress report. The user id comes ONLY from
 * the verified auth token (request.user.sub) — never from the query, body,
 * headers, or route params. Read-only.
 */
export async function getProgressReportHandler(
  request: FastifyRequest<{ Querystring: { range: ProgressReportRange } }>,
  reply: FastifyReply
) {
  const user = request.user as { sub: string };
  const report = await generateProgressReport(user.sub, request.query.range);
  return reply.send(report);
}
