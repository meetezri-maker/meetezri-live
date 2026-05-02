import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

type AdminStatsParams = {
  chartPeriod?: "week" | "month" | "year";
  dateFrom?: string;
  dateTo?: string;
  rangeDays?: number;
};

export const adminQueryKeys = {
  stats: (params?: AdminStatsParams) => ["admin", "stats", params ?? {}] as const,
  recentActivity: () => ["admin", "recentActivity"] as const,
};

/**
 * Fetches admin dashboard stats with 60-second client-side cache.
 * Multiple components using the same params share one in-flight request.
 * Navigating away and back within 60s returns instantly from cache.
 */
export function useAdminStats(params?: AdminStatsParams) {
  return useQuery({
    queryKey: adminQueryKeys.stats(params),
    queryFn: () => api.admin.getStats(params),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}

/**
 * Fetches recent activity (sessions, alerts, mood entries) with 30-second cache.
 */
export function useAdminRecentActivity() {
  return useQuery({
    queryKey: adminQueryKeys.recentActivity(),
    queryFn: () => api.admin.getRecentActivity(),
    staleTime: 30_000,
    gcTime: 2 * 60_000,
  });
}
