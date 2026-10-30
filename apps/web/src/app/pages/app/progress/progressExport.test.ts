import { describe, it, expect } from 'vitest';
import { format } from 'date-fns';
import { parseCsv } from '@/test/parseCsv';
import {
  SESSION_LIST_LIMIT_CAP,
  buildProgressExportCsv,
  progressExportFileName,
  type ProgressExportInput,
} from './progressExport';

const local = (m: number, d: number, h = 12) => new Date(2026, m, d, h).toISOString();
const NOW = new Date(2026, 9, 28, 15, 0); // Wed 28 Oct 2026, local

const base = (over: Partial<ProgressExportInput> = {}): ProgressExportInput => ({
  range: 'this_month',
  now: NOW,
  timeZone: 'Asia/Karachi',
  sessions: {
    ok: true,
    data: [
      { started_at: local(9, 1, 0), ended_at: local(9, 1, 1) }, // first local minute of the month
      { started_at: local(9, 20), ended_at: local(9, 20, 13) },
      { started_at: local(8, 30, 23), ended_at: local(8, 30, 23) }, // September: outside
      { started_at: local(9, 27), ended_at: null }, // not completed
    ],
  },
  moods: { ok: true, data: [{ created_at: local(9, 2) }, { created_at: local(8, 15) }] },
  journals: { ok: true, data: [{ created_at: local(9, 5) }, { created_at: local(9, 6) }, { created_at: local(9, 7) }] },
  currentStreakDays: 0,
  stats: {
    ok: true,
    data: {
      weeklyProgress: [
        { name: 'Week 1', sessions: 1, mood: 0, wellness: 2 },
        { name: 'Week 2', sessions: 0, mood: 0, wellness: 0 },
        { name: 'Week 3', sessions: 2, mood: 3, wellness: 1 },
        { name: 'Week 4', sessions: 1, mood: 5, wellness: 0 },
      ],
      wellnessScore: [
        { subject: 'Emotional', A: 62, fullMark: 100 },
        { subject: 'Social', A: 0, fullMark: 100 },
        { subject: 'Focus', A: 40, fullMark: 100 },
      ],
      monthlyActivity: [{ month: 'Sep', value: 4 }, { month: 'Oct', value: 9 }],
    },
  },
  tools: {
    ok: true,
    data: [
      { toolId: 'box-breathing', toolTitle: 'Box Breathing, 4-4-4', sessionsCompleted: 5, totalSeconds: 905 },
      { toolId: 'grounding', toolTitle: '=SUM(1,1) Grounding', sessionsCompleted: 0, totalSeconds: 0 },
    ],
  },
  ...over,
});

function parse(csv: string) {
  const rows = parseCsv(csv);
  const headerAt = rows.findIndex((r) => r[0] === 'Section' && r[1] === 'Metric');
  const meta = Object.fromEntries(rows.slice(0, headerAt).filter((r) => r.length >= 2).map((r) => [r[0], r[1]]));
  const data = rows.slice(headerAt + 1);
  const find = (section: string, metric: string) => data.find((r) => r[0] === section && r[1] === metric);
  return { header: rows[headerAt], data, meta, find };
}

describe('buildProgressExportCsv', () => {
  it('labels the selected range with real dates and the time zone used', () => {
    const { meta, header } = parse(buildProgressExportCsv(base()));
    expect(meta['Selected period']).toBe('This Month (2026-10-01 to 2026-10-28)');
    expect(meta['Time zone']).toMatch(/^Asia\/Karachi/);
    expect(meta.Completeness).toBe('Complete');
    expect(header).toEqual(['Section', 'Metric', 'Value', 'Unit', 'Scope', 'Status']);
  });

  it('counts selected-period summary rows from timestamped records', () => {
    const { find } = parse(buildProgressExportCsv(base()));
    expect(find('Summary', 'Talks completed')?.slice(2)).toEqual([
      '2', 'talks', 'Selected period: This Month (2026-10-01 to 2026-10-28)', 'Complete',
    ]);
    expect(find('Summary', 'Mood check-ins')?.[2]).toBe('1');
    expect(find('Summary', 'Journal entries')?.[2]).toBe('3');
    expect(find('Summary', 'Current streak')?.slice(2, 4)).toEqual(['0', 'days']);
  });

  it('labels server aggregates with their own windows, readable names and units', () => {
    const csv = buildProgressExportCsv(base());
    const { find, data } = parse(csv);
    const week1 = find('Weekly activity', 'Week 1 (oldest): wellness tool sessions completed');
    expect(week1?.[2]).toBe('2');
    expect(week1?.[4]).toMatch(/^Last 28 days .*not the selected period$/);
    expect(find('Weekly activity', 'Week 4 (most recent): mood check-ins')?.[2]).toBe('5');
    expect(find('Wellness scores', 'Emotional score')?.slice(2)).toEqual(['62', 'score (0–100)', 'Last 28 days (server time)', 'Complete']);
    expect(find('Wellness scores', 'Social score')?.slice(2, 5)).toEqual(['0', 'score (0–100)', 'All time']);
    expect(find('Wellness scores', 'Focus score')?.slice(4)).toEqual(['Scope unknown', 'Scope unknown']);
    expect(find('Monthly activity', 'Oct: activities logged')?.[4]).toMatch(/^Last 6 calendar months/);
    expect(find('Wellness tools', 'Box Breathing, 4-4-4: wellness tool sessions completed')?.slice(2, 5)).toEqual(['5', 'sessions', 'All time']);
    expect(find('Wellness tools', 'Box Breathing, 4-4-4: total time')?.slice(2, 4)).toEqual(['905', 'seconds']);
    expect(find('Wellness tools', "'=SUM(1,1) Grounding: wellness tool sessions completed")?.[2]).toBe('0');
    expect(csv).not.toMatch(/Talk it out completed|fullMark|,A,/);
    expect(data.every((r) => r.length === 6)).toBe(true);
  });

  it('marks failed sources unavailable, not zero, and the file partial', () => {
    const { find, meta } = parse(
      buildProgressExportCsv(base({ journals: { ok: false }, stats: { ok: false }, sessions: { ok: false } }))
    );
    expect(find('Summary', 'Journal entries')?.slice(2)).toEqual([
      '', 'entries', expect.stringMatching(/^Selected period/), 'Unavailable: could not be loaded',
    ]);
    expect(find('Summary', 'Talks completed')?.[2]).toBe('');
    expect(find('Weekly activity', 'All metrics')?.[5]).toBe('Unavailable: could not be loaded');
    expect(meta.Completeness).toMatch(/^Partial: talks; journal entries; weekly activity/);
  });

  it('labels talk totals as a lower bound when only the capped list was available', () => {
    const many = Array.from({ length: SESSION_LIST_LIMIT_CAP }, (_, i) => ({
      started_at: local(9, 1 + (i % 27)),
      ended_at: local(9, 1 + (i % 27)),
    }));
    const { find, meta } = parse(buildProgressExportCsv(base({ sessions: { ok: true, data: many, limited: true } })));
    const talks = find('Summary', 'Talks completed');
    expect(talks?.[2]).toBe('200');
    expect(talks?.[5]).toBe('Lower bound: only the most recent 200 talks could be loaded');
    expect(meta.Completeness).toMatch(/^Partial: talks counted from the most recent 200 only/);
  });

  it('describes All Time without inventing a start date', () => {
    const { meta, find } = parse(buildProgressExportCsv(base({ range: 'all' })));
    expect(meta['Selected period']).toBe('All Time (up to 2026-10-28)');
    expect(find('Summary', 'Talks completed')?.[2]).toBe('3');
  });

  it('names the file after the range and date', () => {
    expect(progressExportFileName('last_month', NOW)).toBe('solace-progress-last-month-2026-10-28.csv');
  });

  it('writes exactly the same bytes as before the shared report model (BOM, CRLF, escaping)', () => {
    const csv = buildProgressExportCsv(
      base({
        journals: { ok: false },
        stats: { ok: true, data: { weeklyProgress: [{ name: 'Week 1', sessions: 0, mood: 2, wellness: 1 }], wellnessScore: [{ subject: 'Focus', A: 0, fullMark: 100 }], monthlyActivity: [] } },
      })
    );
    const offset = format(NOW, 'xxx');
    const sel = 'Selected period: This Month (2026-10-01 to 2026-10-28)';
    expect(csv).toBe(
      '﻿' +
        [
          'Solace Progress Report',
          `Generated,2026-10-28 15:00 ${offset}`,
          'Selected period,This Month (2026-10-01 to 2026-10-28)',
          'Time zone,Asia/Karachi (selected-period counts use this time zone)',
          'Completeness,Partial: journal entries',
          '',
          'Section,Metric,Value,Unit,Scope,Status',
          `Summary,Talks completed,2,talks,${sel},Complete`,
          `Summary,Mood check-ins,1,check-ins,${sel},Complete`,
          `Summary,Journal entries,,entries,${sel},Unavailable: could not be loaded`,
          'Summary,Current streak,0,days,As of 2026-10-28,Complete',
          'Weekly activity,Week 1 (oldest): talks started,0,talks,"Last 28 days in 7-day blocks, Week 1 oldest (server time); not the selected period",Complete',
          'Weekly activity,Week 1 (oldest): mood check-ins,2,check-ins,"Last 28 days in 7-day blocks, Week 1 oldest (server time); not the selected period",Complete',
          'Weekly activity,Week 1 (oldest): wellness tool sessions completed,1,sessions,"Last 28 days in 7-day blocks, Week 1 oldest (server time); not the selected period",Complete',
          'Wellness scores,Focus score,0,score (0–100),Scope unknown,Scope unknown',
          'Wellness tools,"Box Breathing, 4-4-4: wellness tool sessions completed",5,sessions,All time,Complete',
          'Wellness tools,"Box Breathing, 4-4-4: total time",905,seconds,All time,Complete',
          `Wellness tools,"'=SUM(1,1) Grounding: wellness tool sessions completed",0,sessions,All time,Complete`,
          `Wellness tools,"'=SUM(1,1) Grounding: total time",0,seconds,All time,Complete`,
        ].join('\r\n') +
        '\r\n'
    );
  });
});
