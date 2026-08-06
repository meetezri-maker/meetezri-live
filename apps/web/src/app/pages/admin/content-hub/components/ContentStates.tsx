/**
 * Empty and error states for the Content Hub screens.
 *
 * "No content yet" and "no content matches these filters" are deliberately different: the first
 * needs a create action, the second needs a way back out of the filters. Showing the wrong one
 * is a small thing that makes a screen feel broken.
 */

import { FileText, RotateCw, SearchX, TriangleAlert } from "lucide-react";
import { adminBtnPrimary, adminBtnSecondary } from "@/app/admin";
import { cn } from "@/lib/utils";

export interface ContentEmptyStateProps {
  /** `library` = nothing exists; `filtered` = filters exclude everything. */
  variant: "library" | "filtered";
  onCreate?: () => void;
  onClearFilters?: () => void;
  className?: string;
}

export function ContentEmptyState({
  variant,
  onCreate,
  onClearFilters,
  className,
}: ContentEmptyStateProps) {
  const isLibrary = variant === "library";

  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06]">
        {isLibrary ? (
          <FileText aria-hidden="true" className="h-6 w-6 text-[var(--admin-text-secondary)]" />
        ) : (
          <SearchX aria-hidden="true" className="h-6 w-6 text-[var(--admin-text-secondary)]" />
        )}
      </div>

      <h3 className="text-base font-semibold text-[var(--admin-text)]">
        {isLibrary ? "No content yet" : "No content matches these filters"}
      </h3>

      <p className="mt-1 max-w-sm text-sm text-[var(--admin-text-secondary)]">
        {isLibrary
          ? "Create your first Answer, Insight or Article to get started."
          : "Try a different search term, or clear the filters to see everything."}
      </p>

      {isLibrary && onCreate ? (
        <button type="button" onClick={onCreate} className={cn(adminBtnPrimary, "mt-5")}>
          New Content
        </button>
      ) : null}

      {!isLibrary && onClearFilters ? (
        <button type="button" onClick={onClearFilters} className={cn(adminBtnSecondary, "mt-5")}>
          Clear filters
        </button>
      ) : null}
    </div>
  );
}

export interface ContentErrorStateProps {
  onRetry?: () => void;
  /** Kept generic — never a raw error object or stack. */
  message?: string;
  className?: string;
}

export function ContentErrorState({ onRetry, message, className }: ContentErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
        <TriangleAlert aria-hidden="true" className="h-6 w-6 text-red-300" />
      </div>

      <h3 className="text-base font-semibold text-[var(--admin-text)]">Could not load content</h3>
      <p className="mt-1 max-w-sm text-sm text-[var(--admin-text-secondary)]">
        {message ?? "Something went wrong while loading. Please try again."}
      </p>

      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className={cn(adminBtnSecondary, "mt-5 inline-flex items-center gap-2")}
        >
          <RotateCw aria-hidden="true" className="h-4 w-4" />
          Retry
        </button>
      ) : null}
    </div>
  );
}
