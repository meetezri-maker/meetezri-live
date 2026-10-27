/**
 * Spreadsheet-safe CSV building (RFC 4180 quoting, UTF-8 BOM, CRLF).
 *
 * Text that a spreadsheet would treat as a formula — starting with = + - @ (or their full-width
 * forms), optionally after leading whitespace/control characters, or starting with a tab/CR —
 * is prefixed with an apostrophe so it is shown as text. Real numbers and booleans are written
 * as-is.
 */
export type CsvValue = string | number | boolean | null | undefined;

const FORMULA_START = /^[\s\u0000-\u001f]*[=+\-@＝＋－＠]/;
const CONTROL_START = /^[\t\r\n]/;
const NEEDS_QUOTES = /[",\r\n]|^\s|\s$/;

export function escapeCsvCell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';

  let text = String(value);
  if (FORMULA_START.test(text) || CONTROL_START.test(text)) text = `'${text}`;
  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Whole file: BOM so spreadsheets read UTF-8 (e.g. Urdu), CRLF rows, trailing newline. */
export function buildCsv(rows: CsvValue[][]): string {
  return `﻿${rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')}\r\n`;
}
