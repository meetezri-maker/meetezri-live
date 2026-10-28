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

/**
 * Cache key per range, and per account when known, so one account's cached report is never
 * shown (or exported) for another. Without `userId` the key is unchanged.
 */
export function progressReportQueryKey(range: ProgressReportRange, userId?: string | null) {
  const base = queryKeys.gamification.progressReport(range);
  return userId ? ([...base, userId] as const) : base;
}

/**
 * Fetch the report for `range`. `keepPreviousData` keeps the previously loaded
 * report visible while a new range loads (no full-page blanking); the caller
 * shows a subtle `isFetching` indicator instead, and uses `isPlaceholderData`
 * to keep exports from using the previous range.
 */
export function useProgressReportQuery(range: ProgressReportRange, userId?: string | null) {
  return useQuery<ProgressReport>({
    queryKey: progressReportQueryKey(range, userId),
    queryFn: () => fetchProgressReport(range),
    // Keep the previous range on screen while loading — but never another account's report.
    placeholderData: (previous, previousQuery) =>
      previousQuery && previousQuery.queryKey[2] !== (userId || undefined)
        ? undefined
        : keepPreviousData(previous),
  });
}
