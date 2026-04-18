import { ChevronLeft, ChevronRight } from "lucide-react";

const DEFAULT_SIZES = [10, 25, 50, 100] as const;

export type AdminPaginationBarProps = {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  /** Unique id for the page-size `<select>` (accessibility). */
  selectId: string;
  pageSizeOptions?: readonly number[];
};

export function AdminPaginationBar({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  selectId,
  pageSizeOptions = DEFAULT_SIZES,
}: AdminPaginationBarProps) {
  if (total <= 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  return (
    <div className="border-t px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <label htmlFor={selectId} className="sr-only">
          Records per page
        </label>
        <select
          id={selectId}
          value={pageSize}
          onChange={(e) => {
            onPageSizeChange(Number(e.target.value));
            onPageChange(1);
          }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 pr-9 text-sm font-medium text-blue-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-500/30 cursor-pointer"
        >
          {pageSizeOptions.map((n) => (
            <option key={n} value={n}>
              {n} Records per page
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center justify-center gap-2 sm:justify-end">
        <button
          type="button"
          aria-label="Previous page"
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage <= 1}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[9rem] text-center text-sm tabular-nums text-gray-600">
          {from} to {to} of {total}
        </span>
        <button
          type="button"
          aria-label="Next page"
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage >= totalPages}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
