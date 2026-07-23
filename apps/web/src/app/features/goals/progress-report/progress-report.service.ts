/**
 * Typed access to the read-only Progress Report endpoint.
 *
 * Uses the repository's existing authenticated API client (Supabase bearer via
 * `getHeaders`). This layer performs NO calculation — it only types the
 * backend response.
 */
import { api } from "@/lib/api";
import type { ProgressReport, ProgressReportRange } from "./progress-report.types";

/** GET /api/gamification/report?range={range} */
export async function fetchProgressReport(range: ProgressReportRange): Promise<ProgressReport> {
  const data = await api.gamification.getReport(range);
  return data as ProgressReport;
}
