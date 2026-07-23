/**
 * TanStack Query binding for the Progress Report.
 *
 * One cache entry per range (stable key), no derived report data here — the
 * query layer only fetches and caches the backend response. Global defaults
 * (staleTime 60s, retry 1, no refetch-on-focus) come from the app QueryClient.
 */
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries";
import { fetchProgressReport } from "./progress-report.service";
import type { ProgressReport, ProgressReportRange } from "./progress-report.types";

export function progressReportQueryKey(range: ProgressReportRange) {
  return queryKeys.gamification.progressReport(range);
}

/**
 * Fetch the report for `range`. `keepPreviousData` keeps the previously loaded
 * report visible while a new range loads (no full-page blanking); the caller
 * shows a subtle `isFetching` indicator instead.
 */
export function useProgressReportQuery(range: ProgressReportRange) {
  return useQuery<ProgressReport>({
    queryKey: progressReportQueryKey(range),
    queryFn: () => fetchProgressReport(range),
    placeholderData: keepPreviousData,
  });
}
