import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { achievementsSectionPanel } from "@/app/pages/app/achievements/achievementsUi";

/**
 * Shared report section shell: an <h2> heading, optional caption, and calm
 * panel styling. Keeps hierarchy and spacing consistent across the report.
 */
export function ProgressReportSection({
  title,
  caption,
  children,
  headingId,
  className,
}: {
  title: string;
  caption?: string;
  children: ReactNode;
  headingId?: string;
  className?: string;
}) {
  return (
    <section aria-labelledby={headingId} className={cn(achievementsSectionPanel, className)}>
      <div className="space-y-1">
        <h2 id={headingId} className="font-serif text-lg font-semibold text-white">
          {title}
        </h2>
        {caption ? <p className="text-sm text-zinc-400">{caption}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Compact metric tile used by the snapshot + period summary. */
export function ProgressReportStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 break-words text-xl font-semibold tabular-nums text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-400">{hint}</p> : null}
    </div>
  );
}

/** Compact inline empty message — never a large card (keeps the report tight). */
export function ProgressReportEmptyLine({ children }: { children: ReactNode }) {
  return <p className="text-sm text-zinc-400">{children}</p>;
}
