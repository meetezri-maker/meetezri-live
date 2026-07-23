import { ProgressReportEmptyLine, ProgressReportSection } from "./ProgressReportSection";
import { ITEM_TYPE_LABELS, formatReportDate, humanizeToken } from "./progress-report.utils";
import type { ProgressReport, ProgressReportTextEntry } from "./progress-report.types";

/**
 * User-entered check-in content, shown verbatim.
 *
 * Text is rendered as plain React children (escaped — never dangerouslySetInnerHTML)
 * and is never rewritten, summarized, or interpreted. Achievement notes stay in
 * the neutral "Notes" list; they are never reclassified as wins or challenges.
 */
function EntryList({
  entries,
  emptyMessage,
  testId,
}: {
  entries: ProgressReportTextEntry[];
  emptyMessage: string;
  testId: string;
}) {
  if (entries.length === 0) {
    return <ProgressReportEmptyLine>{emptyMessage}</ProgressReportEmptyLine>;
  }
  return (
    <ul data-testid={testId} className="space-y-2">
      {entries.map((entry, index) => {
        const date = formatReportDate(entry.date);
        return (
          <li
            key={`${entry.itemId}-${entry.date}-${index}`}
            className="min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3"
          >
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-200">
              {entry.text}
            </p>
            <p className="mt-1.5 text-xs text-zinc-500">
              <span className="break-words">{entry.itemTitle}</span>
              <span aria-hidden> · </span>
              {ITEM_TYPE_LABELS[entry.itemType]}
              {date ? (
                <>
                  <span aria-hidden> · </span>
                  {date}
                </>
              ) : null}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {children}
    </div>
  );
}

export function ProgressReportWellbeingSection({
  entries,
}: {
  entries: ProgressReport["wellbeingEntries"];
}) {
  return (
    <ProgressReportSection
      title="Wins, Challenges, Reflections, Notes, and Moods"
      caption="Your own words from check-ins during this period, shown exactly as you wrote them."
      headingId="report-wellbeing"
    >
      <SubSection title="Wins">
        <EntryList
          entries={entries.wins}
          emptyMessage="No wins were recorded during this period."
          testId="report-wins"
        />
      </SubSection>

      <SubSection title="Challenges">
        <EntryList
          entries={entries.challenges}
          emptyMessage="No challenges were recorded during this period."
          testId="report-challenges"
        />
      </SubSection>

      <SubSection title="Reflections">
        <EntryList
          entries={entries.reflections}
          emptyMessage="No reflections were recorded during this period."
          testId="report-reflections"
        />
      </SubSection>

      <SubSection title="Notes">
        <EntryList
          entries={entries.notes}
          emptyMessage="No notes were recorded during this period."
          testId="report-notes"
        />
      </SubSection>

      <SubSection title="Mood counts">
        {entries.moodCounts.length === 0 ? (
          <ProgressReportEmptyLine>No moods were recorded during this period.</ProgressReportEmptyLine>
        ) : (
          <ul data-testid="report-moods" className="flex flex-wrap gap-2">
            {entries.moodCounts.map((m) => (
              <li
                key={m.mood}
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs text-zinc-200"
              >
                {humanizeToken(m.mood)} <span aria-hidden>—</span>{" "}
                <span className="tabular-nums">{m.count}</span>
              </li>
            ))}
          </ul>
        )}
      </SubSection>
    </ProgressReportSection>
  );
}
