/**
 * Content Hub list filters.
 *
 * The search input is debounced (~300 ms) INSIDE this component so the page owns only committed
 * filter values — typing never re-runs the query per keystroke, and the parent never has to know
 * about debounce timing.
 *
 * Every filter change resets the page to 1, which is the parent's job (`onChange` replaces the
 * whole filter object minus `page`).
 */

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { CONTENT_STATUSES, CONTENT_TYPES, PUBLIC_CONTENT_LABEL } from "@meetezri/shared";
import { adminBtnSecondary, adminInput, adminSelect } from "@/app/admin";
import { cn } from "@/lib/utils";
import type { ContentHubContentType, ContentHubListParams, ContentHubStatus } from "@/lib/api";

const SEARCH_DEBOUNCE_MS = 300;

const STATUS_LABEL: Record<ContentHubStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
  published: "Published",
  unpublished: "Unpublished",
  archived: "Archived",
};

export interface ContentFiltersProps {
  filters: ContentHubListParams;
  onChange: (next: ContentHubListParams) => void;
  className?: string;
}

export function ContentFilters({ filters, onChange, className }: ContentFiltersProps) {
  const [searchText, setSearchText] = useState(filters.search ?? "");
  const debounceRef = useRef<number | null>(null);

  // Keep the input in step when the parent clears filters.
  useEffect(() => {
    setSearchText(filters.search ?? "");
  }, [filters.search]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchText(value);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      onChange({ ...filters, search: value.trim() || undefined });
    }, SEARCH_DEBOUNCE_MS);
  };

  const patch = (next: Partial<ContentHubListParams>) => onChange({ ...filters, ...next });

  const hasFilters =
    !!filters.search ||
    !!filters.contentType ||
    !!filters.status ||
    !!filters.pillar ||
    filters.week != null ||
    (filters.tags?.length ?? 0) > 0 ||
    !!filters.awaitingApproval ||
    !!filters.dueToPublish;

  return (
    <div className={cn("flex flex-wrap items-end gap-3", className)}>
      <div className="min-w-[14rem] flex-1">
        <label htmlFor="content-search" className="mb-1 block text-xs text-[var(--admin-text-secondary)]">
          Search
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-text-muted)]"
          />
          <input
            id="content-search"
            type="search"
            value={searchText}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Title, slug or reference"
            className={cn(adminInput, "w-full pl-9")}
          />
        </div>
      </div>

      <div>
        <label htmlFor="content-type-filter" className="mb-1 block text-xs text-[var(--admin-text-secondary)]">
          Type
        </label>
        <select
          id="content-type-filter"
          value={filters.contentType ?? ""}
          onChange={(e) => patch({ contentType: (e.target.value || undefined) as ContentHubContentType | undefined })}
          className={cn(adminSelect, "min-w-[9rem]")}
        >
          <option value="">All types</option>
          {CONTENT_TYPES.map((type) => (
            // Public label is what the operator reads; the internal value only travels on the wire.
            <option key={type} value={type}>
              {PUBLIC_CONTENT_LABEL[type]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="content-status-filter" className="mb-1 block text-xs text-[var(--admin-text-secondary)]">
          Status
        </label>
        <select
          id="content-status-filter"
          value={filters.status ?? ""}
          onChange={(e) => patch({ status: (e.target.value || undefined) as ContentHubStatus | undefined })}
          className={cn(adminSelect, "min-w-[10rem]")}
        >
          <option value="">All statuses</option>
          {CONTENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="content-pillar-filter" className="mb-1 block text-xs text-[var(--admin-text-secondary)]">
          Pillar
        </label>
        <input
          id="content-pillar-filter"
          type="text"
          value={filters.pillar ?? ""}
          onChange={(e) => patch({ pillar: e.target.value.trim() || undefined })}
          placeholder="Any"
          className={cn(adminInput, "w-36")}
        />
      </div>

      <div>
        <label htmlFor="content-week-filter" className="mb-1 block text-xs text-[var(--admin-text-secondary)]">
          Week
        </label>
        <input
          id="content-week-filter"
          type="number"
          inputMode="numeric"
          min={1}
          value={filters.week ?? ""}
          onChange={(e) => patch({ week: e.target.value === "" ? undefined : Number(e.target.value) })}
          placeholder="Any"
          className={cn(adminInput, "w-24")}
        />
      </div>

      <div>
        <label htmlFor="content-tags-filter" className="mb-1 block text-xs text-[var(--admin-text-secondary)]">
          Tags
        </label>
        <input
          id="content-tags-filter"
          type="text"
          value={(filters.tags ?? []).join(", ")}
          onChange={(e) => {
            const tags = e.target.value
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean);
            patch({ tags: tags.length > 0 ? tags : undefined });
          }}
          placeholder="Comma separated"
          className={cn(adminInput, "w-44")}
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-[var(--admin-text-secondary)]">
        <input
          type="checkbox"
          checked={!!filters.awaitingApproval}
          onChange={(e) => patch({ awaitingApproval: e.target.checked || undefined })}
          className="h-4 w-4 rounded border-white/20 bg-transparent"
        />
        Awaiting approval
      </label>

      <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-[var(--admin-text-secondary)]">
        <input
          type="checkbox"
          checked={!!filters.dueToPublish}
          onChange={(e) => patch({ dueToPublish: e.target.checked || undefined })}
          className="h-4 w-4 rounded border-white/20 bg-transparent"
        />
        Due to publish
      </label>

      {hasFilters ? (
        <button
          type="button"
          onClick={() => onChange({ pageSize: filters.pageSize, sort: filters.sort, order: filters.order })}
          className={cn(adminBtnSecondary, "mb-0.5 inline-flex items-center gap-1.5")}
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
