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
        "max-w-full",
        isPill ? "h-6 bg-gray-200 rounded-full" : "h-4 bg-gray-200 rounded",
        w
      )}
    />
  );
}

/**
 * Pulse skeleton rows for admin data tables. Pair with
 * `thead`: `bg-gray-50 border-b`, `th`: `px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase`
 * (or `px-4` when using `padding="compact"`).
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
              <div className="h-4 w-4 rounded bg-gray-200" />
            </td>
          )}
          {firstColumnWide && (
            <td className={td}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-full bg-gray-200 shrink-0" />
                <div className="space-y-2 min-w-0">
                  <div className="h-4 w-32 max-w-full bg-gray-200 rounded" />
                  <div className="h-3 w-48 max-w-full bg-gray-100 rounded" />
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
