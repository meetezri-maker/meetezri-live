import { cn } from "@/lib/utils";
import { achievementsCard, achievementsSectionPanel } from "@/app/pages/app/achievements/achievementsUi";

const bar = "animate-pulse rounded-md bg-white/10";

function StatGrid({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
          <div className={cn(bar, "h-3 w-24")} />
          <div className={cn(bar, "mt-2 h-6 w-16")} />
        </div>
      ))}
    </div>
  );
}

function CardGrid({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn(achievementsCard, "space-y-3 rounded-2xl p-5")}>
          <div className={cn(bar, "h-4 w-2/3")} />
          <div className={cn(bar, "h-3 w-1/3")} />
          <div className={cn(bar, "h-16 w-full")} />
          <div className={cn(bar, "h-12 w-full")} />
        </div>
      ))}
    </div>
  );
}

/**
 * Structural skeleton that mirrors the real report layout (header, range
 * selector, stat grids, item cards, sections) to avoid layout shift.
 */
export function ProgressReportSkeleton() {
  return (
    <div data-testid="report-skeleton" className="space-y-8" aria-hidden>
      <p className="sr-only" role="status" aria-live="polite" aria-hidden={false}>
        Loading your Progress Report…
      </p>

      {/* Header */}
      <div className="space-y-3">
        <div className={cn(bar, "h-4 w-48")} />
        <div className={cn(bar, "h-8 w-64")} />
        <div className={cn(bar, "h-3 w-80 max-w-full")} />
      </div>

      {/* Range selector */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={cn(bar, "h-9 w-28 rounded-full")} />
        ))}
      </div>

      {/* Snapshot + summary */}
      <div className={cn(achievementsSectionPanel)}>
        <div className={cn(bar, "h-5 w-40")} />
        <StatGrid count={4} />
      </div>
      <div className={cn(achievementsSectionPanel)}>
        <div className={cn(bar, "h-5 w-40")} />
        <StatGrid count={4} />
      </div>

      {/* Goal + achievement cards */}
      <div className={cn(achievementsSectionPanel)}>
        <div className={cn(bar, "h-5 w-32")} />
        <CardGrid count={2} />
      </div>
      <div className={cn(achievementsSectionPanel)}>
        <div className={cn(bar, "h-5 w-56")} />
        <CardGrid count={2} />
      </div>

      {/* Remaining report sections */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className={cn(achievementsSectionPanel)}>
          <div className={cn(bar, "h-5 w-44")} />
          <div className={cn(bar, "h-20 w-full")} />
        </div>
      ))}
    </div>
  );
}
