import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { cn } from "@/lib/utils";
import {
  solaceSelectContentClass,
  solaceSelectItemClass,
  solaceSelectTriggerDefault,
} from "@/app/solace";
import { adminBtnSecondary } from "@/app/admin/adminPageChrome";

const DEFAULT_SIZES = [10, 25, 50, 100] as const;

export type AdminPaginationBarProps = {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  /** Unique id for the page-size control (accessibility). */
  selectId: string;
  pageSizeOptions?: readonly number[];
  /** `solace` matches dark member-app pages (Sleep Tracker, etc.). */
  variant?: "admin" | "solace";
  className?: string;
};

const adminPageBtn = cn(
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed",
  "border-[color:var(--admin-border)] bg-white/[0.03] text-[var(--admin-text-secondary)]",
  "hover:border-[color:var(--admin-border-glow)] hover:bg-white/[0.06] hover:text-[var(--admin-text)]",
  "disabled:border-transparent disabled:bg-white/[0.02] disabled:text-[var(--admin-text-muted)]"
);

export function AdminPaginationBar({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  selectId,
  pageSizeOptions = DEFAULT_SIZES,
  variant = "admin",
  className,
}: AdminPaginationBarProps) {
  if (total <= 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);
  const isSolace = variant === "solace";

  const pageSizeControl = isSolace ? (
    <Select
      value={String(pageSize)}
      onValueChange={(value) => {
        onPageSizeChange(Number(value));
        onPageChange(1);
      }}
    >
      <SelectTrigger
        id={selectId}
        aria-label="Records per page"
        className={cn(solaceSelectTriggerDefault, "min-w-[11rem]")}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        position="popper"
        sideOffset={6}
        className={cn(solaceSelectContentClass, "z-[400]")}
      >
        {pageSizeOptions.map((n) => (
          <SelectItem key={n} value={String(n)} className={solaceSelectItemClass}>
            {n} Records per page
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : (
    <>
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
        className={cn(adminBtnSecondary, "min-w-[11rem] cursor-pointer py-2 pr-9 text-[var(--admin-primary)]")}
      >
        {pageSizeOptions.map((n) => (
          <option key={n} value={n}>
            {n} Records per page
          </option>
        ))}
      </select>
    </>
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        isSolace ? "px-4 py-3 sm:px-5" : "border-t border-[color:var(--admin-border)] px-4 py-3",
        className,
      )}
    >
      <div className="flex items-center gap-2">{pageSizeControl}</div>
      <div className="flex items-center justify-center gap-2 sm:justify-end">
        <button
          type="button"
          aria-label="Previous page"
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage <= 1}
          className={isSolace ? cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed",
            "border-white/10 bg-black/40 text-zinc-200 hover:bg-white/[0.08] disabled:border-white/[0.04] disabled:bg-black/20 disabled:text-zinc-600"
          ) : adminPageBtn}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span
          className={cn(
            "min-w-[9rem] text-center text-sm tabular-nums",
            isSolace ? "text-zinc-400" : "text-[var(--admin-text-secondary)]",
          )}
        >
          {from} to {to} of {total}
        </span>
        <button
          type="button"
          aria-label="Next page"
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage >= totalPages}
          className={isSolace ? cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed",
            "border-white/10 bg-black/40 text-zinc-200 hover:bg-white/[0.08] disabled:border-white/[0.04] disabled:bg-black/20 disabled:text-zinc-600"
          ) : adminPageBtn}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
