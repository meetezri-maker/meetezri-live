import { describe, it, expect } from 'vitest';
import { parseCsv } from '@/test/parseCsv';
import {
  MOOD_EXPORT_COLUMNS,
  buildMoodHistoryExport,
  moodHistoryExportFileName,
  type MoodHistoryExportEntry,
  type MoodHistoryExportInput,
} from './moodHistoryExport';

const URDU = 'آج میں نے بہت سکون محسوس کیا';
// Local-time constructors so the boundaries hold in any test time zone.
const local = (d: number, h = 12, m = 0, s = 0, ms = 0) => new Date(2026, 9, d, h, m, s, ms);
const WEEK = { label: 'Week (Mon–Sun)', start: local(26, 0), end: local(32, 23, 59, 59, 999) }; // Mon 26 Oct – Sun 1 Nov

const entry = (over: Partial<MoodHistoryExportEntry>): MoodHistoryExportEntry => ({
  id: 'x', created_at: local(27).toISOString(), mood: 'calm', intensity: 6, source: 'check-in', ...over,
});

const input = (over: Partial<MoodHistoryExportInput> = {}): MoodHistoryExportInput => ({
  entries: [],
  period: WEEK,
  sources: { checkIns: 'ok', journals: 'ok' },
  moodLabel: (m) => ({ calm: 'Calm', happy: 'Happy', anxious: 'Anxious' })[m] ?? null,
  timeZone: 'Asia/Karachi',
  generatedAt: local(28, 9, 30),
  ...over,
});

function table(csv: string) {
  const rows = parseCsv(csv);
  const headerAt = rows.findIndex((r) => r[0] === 'Date' && r[1] === 'Time');
  const meta = Object.fromEntries(rows.slice(0, headerAt).filter((r) => r.length >= 2).map((r) => [r[0], r[1]]));
  return { header: rows[headerAt], data: rows.slice(headerAt + 1), meta };
}

describe('buildMoodHistoryExport', () => {
  it('exports only the period, oldest first, including both midnight boundaries', () => {
    const result = buildMoodHistoryExport(
      input({
        entries: [
          entry({ id: 'before', created_at: new Date(WEEK.start.getTime() - 1).toISOString() }),
          entry({ id: 'start', created_at: WEEK.start.toISOString(), mood: 'happy' }),
          entry({ id: 'end', created_at: WEEK.end.toISOString(), mood: 'anxious' }),
          entry({ id: 'after', created_at: new Date(WEEK.end.getTime() + 1).toISOString() }),
          entry({ id: 'mid', created_at: local(28, 8).toISOString() }),
        ],
      })
    );
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    const { header, data, meta } = table(result.csv);
    expect(header).toEqual([...MOOD_EXPORT_COLUMNS]);
    expect(data.map((r) => [r[0], r[1], r[3]])).toEqual([
      ['2026-10-26', '00:00', 'happy'],
      ['2026-10-28', '08:00', 'calm'],
      ['2026-11-01', '23:59', 'anxious'],
    ]);
    expect(meta.Period).toBe('Week (Mon–Sun): 2026-10-26 to 2026-11-01');
    expect(meta['Time zone']).toBe('Asia/Karachi');
    expect(meta.Completeness).toBe('Complete');
    expect(meta.Entries).toBe('3');
    expect(meta.Generated).toMatch(/^2026-10-28 09:30 [+-]\d{2}:\d{2}$/);
  });

  it('keeps recorded intensity (including 0) for check-ins and leaves journal intensity blank', () => {
    const result = buildMoodHistoryExport(
      input({
        entries: [
          entry({ id: 'c0', intensity: 0, created_at: local(27, 9).toISOString() }),
          entry({ id: 'j1', source: 'journal', mood: 'happy', intensity: 10, created_at: local(27, 10).toISOString(), notes: '<p>x</p>' }),
        ],
      })
    );
    if (result.kind !== 'ok') throw new Error('expected ok');
    const { data } = table(result.csv);
    expect(data[0][2]).toBe('Mood check-in');
    expect(data[0][5]).toBe('0');
    expect(data[1][2]).toBe('Journal entry');
    expect(data[1][5]).toBe('');
  });

  it('converts journal HTML to readable text and keeps check-in notes as written', () => {
    const result = buildMoodHistoryExport(
      input({
        entries: [
          entry({
            id: 'j', source: 'journal', created_at: local(27, 9).toISOString(),
            notes: '<p>Para one, with &amp; entity.</p><ul><li>a</li><li>b</li></ul><script>bad()</script>',
          }),
          entry({ id: 'c', created_at: local(27, 10).toISOString(), notes: `=1+2 "quoted", ${URDU}\nsecond line`, activities: ['walk', 'family, friends'] }),
        ],
      })
    );
    if (result.kind !== 'ok') throw new Error('expected ok');
    expect(result.csv).not.toMatch(/<p>|<li>|<script>|bad\(\)/);
    const { data } = table(result.csv);
    expect(data[0][7]).toBe('Para one, with & entity.\n\n- a\n- b');
    expect(data[1][7]).toBe(`'=1+2 "quoted", ${URDU}\nsecond line`);
    expect(data[1][6]).toBe('walk; family, friends');
    expect(result.csv.startsWith('﻿')).toBe(true);
  });

  it('marks the file partial when journals failed, and still exports check-ins', () => {
    const result = buildMoodHistoryExport(
      input({ entries: [entry({ id: 'c' })], sources: { checkIns: 'ok', journals: 'failed' } })
    );
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.partial).toBe(true);
    expect(table(result.csv).meta.Completeness).toMatch(/^Partial: journal entries could not be loaded/);
  });

  it('refuses to export when mood check-ins failed, even if journals loaded', () => {
    const result = buildMoodHistoryExport(
      input({
        entries: [entry({ id: 'j', source: 'journal' })],
        sources: { checkIns: 'failed', journals: 'ok' },
      })
    );
    expect(result).toEqual({ kind: 'source-unavailable' });
  });

  it('reports an empty period instead of downloading an empty file', () => {
    const result = buildMoodHistoryExport(input({ entries: [entry({ created_at: local(10).toISOString() })] }));
    expect(result).toEqual({ kind: 'empty' });
  });

  it('names the file after the period', () => {
    expect(moodHistoryExportFileName(WEEK)).toBe('solace-mood-history-2026-10-26-to-2026-11-01.csv');
  });
});
