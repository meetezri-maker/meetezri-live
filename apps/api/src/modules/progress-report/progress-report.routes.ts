import { FastifyInstance } from "fastify";
import { z } from "zod";
import { getProgressReportHandler } from "./progress-report.controller";
import { PROGRESS_REPORT_RANGES } from "./progress-report.constants";

/**
 * `range` is required and must be one of the approved values. An invalid or
 * missing value fails Zod validation and returns the repository-standard 400.
 */
const reportQuerySchema = z.object({
  range: z.enum(PROGRESS_REPORT_RANGES),
});

export async function progressReportRoutes(app: FastifyInstance) {
  // Registered under the /api/gamification prefix -> GET /api/gamification/report.
  // Strictly scoped to the authenticated user (request.user.sub); never trusts
  // any client-supplied user id.
  app.get(
    "/report",
    {
      schema: { querystring: reportQuerySchema },
      preHandler: [app.authenticate],
    },
    getProgressReportHandler
  );
}
