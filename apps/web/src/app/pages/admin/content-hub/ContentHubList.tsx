/**
 * Content Hub — list screen (`/admin/content-hub`).
 *
 * Built to `.cursorrules`: TanStack Query for server state, `useState` for UI state only, shared
 * admin chrome, `AdminTableSkeletonRows` and `AdminPaginationBar`. No `alert()`, no `fetch()`.
 *
 * KPI TILES: the list endpoint returns `total` for the CURRENT filter set, so global counts come
 * from four separate `pageSize: 1` queries. Deriving them from one page would be wrong the moment
 * the library exceeds a page — see the Phase 3 report.
 */

import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { FileText, Plus } from "lucide-react";
import { AdminLayoutNew } from "@/app/components/AdminLayoutNew";
import { AdminTableSkeletonRows } from "@/app/components/admin/AdminTableSkeleton";
import { AdminPaginationBar } from "@/app/components/admin/AdminPaginationBar";
import {
  adminBtnPrimary,
  adminCardStatic,
  adminKpiTile,
  adminPageAtmosphere,
  adminPageGlowTeal,
  adminPageGlowTop,
  adminPageRoot,
  adminPageTitle,
  adminPageVignette,
  adminTableWrap,
} from "@/app/admin";
import { api, type ContentHubListParams } from "@/lib/api";
import { contentHubKeys, useContentHubList } from "@/lib/queries/contentHubQueries";
import { cn } from "@/lib/utils";
import { ContentFilters } from "./components/ContentFilters";
import { ContentEmptyState, ContentErrorState } from "./components/ContentStates";
import { ContentTable } from "./components/ContentTable";

const DEFAULT_PAGE_SIZE = 25;

/** One `pageSize: 1` query per tile — cheap, and correct regardless of how large the library gets. */
const KPI_TILES = [
  { key: "total", label: "Total", filters: {} as ContentHubListParams },
  { key: "drafts", label: "Drafts", filters: { status: "draft" } as ContentHubListParams },
  {
    key: "awaiting",
    label: "Awaiting approval",
    filters: { status: "in_review" } as ContentHubListParams,
  },
  { key: "published", label: "Published", filters: { status: "published" } as ContentHubListParams },
];

export function ContentHubList() {
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [filters, setFilters] = useState<ContentHubListParams>({});

  const query = useMemo<ContentHubListParams>(
    () => ({ ...filters, page, pageSize, sort: filters.sort ?? "updated_at", order: filters.order ?? "desc" }),
    [filters, page, pageSize],
  );

  const { data, isLoading, isError, refetch, isFetching } = useContentHubList(query);

  // Any filter change resets to page 1 — staying on page 7 of a new result set is disorienting.
  const handleFiltersChange = useCallback((next: ContentHubListParams) => {
    setFilters(next);
    setPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({});
    setPage(1);
  }, []);

  const kpiQueries = useQueries({
    queries: KPI_TILES.map((tile) => ({
      queryKey: contentHubKeys.list({ ...tile.filters, page: 1, pageSize: 1 }),
      queryFn: () => api.content.list({ ...tile.filters, page: 1, pageSize: 1 }),
      staleTime: 60_000,
    })),
  });

  const hasActiveFilters = Object.keys(filters).some(
    (key) => !["sort", "order", "pageSize"].includes(key) && filters[key as keyof ContentHubListParams] != null,
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <AdminLayoutNew>
      <div className={adminPageRoot}>
        <div className={adminPageAtmosphere} aria-hidden="true">
          <div className={adminPageGlowTop} />
          <div className={adminPageGlowTeal} />
          <div className={adminPageVignette} />
        </div>

        <div className="relative z-10 space-y-6 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className={adminPageTitle}>Content Hub</h1>
              <p className="mt-1 text-sm text-[var(--admin-text-secondary)]">
                Answers, Insights and Articles for the public resource library.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/admin/content-hub/new")}
              className={cn(adminBtnPrimary, "inline-flex items-center gap-2")}
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              New Content
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {KPI_TILES.map((tile, index) => {
              const tileQuery = kpiQueries[index];
              return (
                <div key={tile.key} className={adminKpiTile}>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
                    <FileText aria-hidden="true" className="h-4 w-4 text-[var(--admin-text-secondary)]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-[var(--admin-text-secondary)]">{tile.label}</p>
                    <p className="text-xl font-semibold text-[var(--admin-text)]">
                      {tileQuery?.isLoading ? "—" : (tileQuery?.data?.total ?? 0)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={cn(adminCardStatic, "p-4")}>
            <ContentFilters filters={filters} onChange={handleFiltersChange} />
          </div>

          {isLoading ? (
            <div className={adminTableWrap}>
              <table className="w-full">
                <tbody>
                  <AdminTableSkeletonRows columns={9} rows={8} />
                </tbody>
              </table>
            </div>
          ) : isError ? (
            <div className={adminCardStatic}>
              <ContentErrorState onRetry={() => void refetch()} />
            </div>
          ) : items.length === 0 ? (
            <div className={adminCardStatic}>
              <ContentEmptyState
                variant={hasActiveFilters ? "filtered" : "library"}
                onCreate={() => navigate("/admin/content-hub/new")}
                onClearFilters={handleClearFilters}
              />
            </div>
          ) : (
            <div className={cn(adminCardStatic, "overflow-hidden")}>
              <ContentTable items={items} />
              <AdminPaginationBar
                total={total}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                selectId="content-hub-page-size"
              />
            </div>
          )}

          {/* Refetches after a mutation are announced without stealing focus. */}
          <span className="sr-only" role="status" aria-live="polite">
            {isFetching ? "Updating content list" : ""}
          </span>
        </div>
      </div>
    </AdminLayoutNew>
  );
}
