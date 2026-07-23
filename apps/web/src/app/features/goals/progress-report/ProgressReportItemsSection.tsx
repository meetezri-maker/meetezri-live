import { ProgressReportEmptyLine, ProgressReportSection } from "./ProgressReportSection";
import { ProgressReportItemCard } from "./ProgressReportItemCard";
import type { ProgressReportItem, ProgressReportItemType } from "./progress-report.types";

/**
 * Renders "Active Goals" or "Active Personal Achievements". Only the user's own
 * active items are included — predefined achievements are never part of this
 * report (the backend excludes them entirely).
 */
export function ProgressReportItemsSection({
  title,
  headingId,
  items,
  itemType,
  emptyMessage,
  testId,
}: {
  title: string;
  headingId: string;
  items: ProgressReportItem[];
  itemType: ProgressReportItemType;
  emptyMessage: string;
  testId: string;
}) {
  return (
    <ProgressReportSection title={title} headingId={headingId}>
      {items.length === 0 ? (
        <ProgressReportEmptyLine>{emptyMessage}</ProgressReportEmptyLine>
      ) : (
        <div data-testid={testId} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <ProgressReportItemCard key={item.id} item={item} itemType={itemType} />
          ))}
        </div>
      )}
    </ProgressReportSection>
  );
}
