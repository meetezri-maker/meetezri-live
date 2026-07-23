import { ProgressReportSection } from "./ProgressReportSection";

/**
 * The backend's deterministic summary lines, rendered verbatim.
 * Nothing is regenerated, interpreted, or sent to any external/AI service.
 */
export function ProgressReportClosingSummary({ lines }: { lines: string[] }) {
  if (!lines || lines.length === 0) return null;

  return (
    <ProgressReportSection title="Summary" headingId="report-closing-summary">
      <p className="text-sm text-zinc-400">During this reporting period:</p>
      <ul data-testid="report-closing-summary" className="space-y-1.5">
        {lines.map((line, index) => (
          <li key={`${index}-${line}`} className="flex gap-2 text-sm leading-relaxed text-zinc-200">
            <span aria-hidden className="text-zinc-500">
              •
            </span>
            <span className="break-words">{line}</span>
          </li>
        ))}
      </ul>
    </ProgressReportSection>
  );
}
