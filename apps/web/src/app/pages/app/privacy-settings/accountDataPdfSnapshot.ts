/**
 * Account Data Report snapshot: the same allowlisted rows as the CSV (accountDataExportRows),
 * grouped by section, with each value written out for reading. Plain, frozen data for the PDF
 * worker — no API object is passed on.
 */
import { format } from 'date-fns';
import {
  ACCOUNT_DATA_EXPORT_CONTENTS,
  ACCOUNT_DATA_EXPORT_EXCLUSIONS,
  type AccountDataRow,
  type AccountDataValue,
} from './accountDataExportCsv';

/** Shown for a field with no saved value (the CSV leaves it blank). */
export const ACCOUNT_DATA_NOT_PROVIDED = 'Not provided';
/** Shown for a list with no items (e.g. no goals selected). */
export const ACCOUNT_DATA_EMPTY_LIST = 'None';

export interface AccountDataPdfSnapshot {
  /** Local date and time the server generated the export, e.g. "5 Nov 2026, 14:30". */
  generatedAt: string;
  timeZone: string;
  contents: string;
  exclusions: string;
  sections: Array<{ title: string; rows: Array<{ label: string; value: string }> }>;
}

/** The stored value as text: true/false and numbers as stored, one list item per line. */
export function accountDataDisplayValue(value: AccountDataValue): string {
  if (Array.isArray(value)) return value.length ? value.join('\n') : ACCOUNT_DATA_EMPTY_LIST;
  if (value === null || value === '') return ACCOUNT_DATA_NOT_PROVIDED;
  return String(value);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

export function buildAccountDataPdfSnapshot(rows: AccountDataRow[], timeZone: string): AccountDataPdfSnapshot {
  const generated = rows.find((r) => r.section === 'Export' && r.label === 'Generated')?.value;
  const when = typeof generated === 'string' ? new Date(generated) : null;
  const sections: AccountDataPdfSnapshot['sections'] = [];
  for (const row of rows) {
    if (row.section === 'Export') continue;
    let section = sections[sections.length - 1];
    if (!section || section.title !== row.section) {
      section = { title: row.section, rows: [] };
      sections.push(section);
    }
    section.rows.push({ label: row.label, value: accountDataDisplayValue(row.value) });
  }
  return deepFreeze({
    generatedAt: when && !Number.isNaN(when.getTime()) ? format(when, 'd MMM yyyy, HH:mm') : accountDataDisplayValue(generated ?? null),
    timeZone,
    contents: ACCOUNT_DATA_EXPORT_CONTENTS,
    exclusions: ACCOUNT_DATA_EXPORT_EXCLUSIONS,
    sections,
  });
}
