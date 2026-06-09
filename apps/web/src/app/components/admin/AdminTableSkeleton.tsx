import { cn } from "@/app/components/ui/utils";

export type AdminTableSkeletonProps = {
  /** Total `<td>` cells per row (including checkbox and wide column when enabled). */
  columns: number;
  rows?: number;
  showCheckboxColumn?: boolean;
  /** First data column: avatar + two text lines (matches User Management / “User” column). */
  firstColumnWide?: boolean;
  /** `compact` = px-4 (user table); `comfortable` = px-6 (most admin tables). */
  padding?: "compact" | "comfortable";
  className?: string;
};

function SkeletonCell({ rowIndex, colIndex }: { rowIndex: number; colIndex: number }) {
  const widths = ["w-16", "w-24", "w-20", "w-12", "w-28", "w-14", "w-20", "w-16"];
  const w = widths[(colIndex + rowIndex) % widths.length];
  const isPill = colIndex % 3 === 1;
  return (
    <div
      className={cn(
        "max-w-full bg-white/[0.06]",
        isPill ? "h-6 rounded-full" : "h-4 rounded",
        w
      )}
    />
  );
}

/**
 * Pulse skeleton rows for admin data tables.
 */
export function AdminTableSkeletonRows({
  columns,
  rows = 8,
  showCheckboxColumn = false,
  firstColumnWide = false,
  padding = "comfortable",
  className,
}: AdminTableSkeletonProps) {
  const td =
    padding === "compact" ? "px-4 py-4" : "px-6 py-4";
  const reserved = (showCheckboxColumn ? 1 : 0) + (firstColumnWide ? 1 : 0);
  const genericCount = Math.max(0, columns - reserved);

  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className={cn("animate-pulse", className)}>
          {showCheckboxColumn && (
            <td className={td}>
              <div className="h-4 w-4 rounded bg-white/[0.06]" />
            </td>
          )}
          {firstColumnWide && (
            <td className={td}>
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-10 w-10 shrink-0 rounded-full bg-white/[0.06]" />
                <div className="min-w-0 space-y-2">
                  <div className="h-4 w-32 max-w-full rounded bg-white/[0.06]" />
                  <div className="h-3 w-48 max-w-full rounded bg-white/[0.04]" />
                </div>
              </div>
            </td>
          )}
          {Array.from({ length: genericCount }).map((_, i) => (
            <td key={i} className={td}>
              <SkeletonCell rowIndex={rowIndex} colIndex={i} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
