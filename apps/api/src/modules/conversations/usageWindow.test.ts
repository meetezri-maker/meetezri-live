import { resolveUsageTimeZone, usageWindowFor } from './usageWindow';

const iso = (d: Date) => d.toISOString();

describe('usage window (member-local calendar day)', () => {
  it('uses UTC midnight for UTC members', () => {
    const w = usageWindowFor(new Date('2026-11-20T15:30:00Z'), 'UTC');
    expect(iso(w.start)).toBe('2026-11-20T00:00:00.000Z');
    expect(iso(w.resetsAt)).toBe('2026-11-21T00:00:00.000Z');
  });

  it('uses local midnight east of UTC (Sydney, AEDT +11)', () => {
    // 2026-11-20 08:00 local = 2026-11-19 21:00Z
    const w = usageWindowFor(new Date('2026-11-19T21:00:00Z'), 'Australia/Sydney');
    expect(w.timeZone).toBe('Australia/Sydney');
    expect(iso(w.start)).toBe('2026-11-19T13:00:00.000Z'); // 2026-11-20 00:00 AEDT
    expect(iso(w.resetsAt)).toBe('2026-11-20T13:00:00.000Z');
  });

  it('uses local midnight west of UTC (New York, EST -5)', () => {
    const w = usageWindowFor(new Date('2026-11-21T03:00:00Z'), 'America/New_York'); // 22:00 on the 20th
    expect(iso(w.start)).toBe('2026-11-20T05:00:00.000Z');
    expect(iso(w.resetsAt)).toBe('2026-11-21T05:00:00.000Z');
  });

  it('is exact on boundaries: one millisecond before local midnight is still "yesterday"', () => {
    const before = usageWindowFor(new Date('2026-11-20T12:59:59.999Z'), 'Australia/Sydney');
    const at = usageWindowFor(new Date('2026-11-20T13:00:00.000Z'), 'Australia/Sydney');
    expect(iso(before.resetsAt)).toBe('2026-11-20T13:00:00.000Z');
    expect(iso(at.start)).toBe('2026-11-20T13:00:00.000Z');
  });

  it('handles a 23-hour DST day (New York spring forward, 2026-03-08)', () => {
    const w = usageWindowFor(new Date('2026-03-08T16:00:00Z'), 'America/New_York');
    expect(iso(w.start)).toBe('2026-03-08T05:00:00.000Z'); // EST
    expect(iso(w.resetsAt)).toBe('2026-03-09T04:00:00.000Z'); // EDT
    expect(w.resetsAt.getTime() - w.start.getTime()).toBe(23 * 3600_000);
  });

  it('handles a 25-hour DST day (Sydney DST ends, 2026-04-05)', () => {
    const w = usageWindowFor(new Date('2026-04-05T05:00:00Z'), 'Australia/Sydney');
    expect(iso(w.start)).toBe('2026-04-04T13:00:00.000Z'); // AEDT
    expect(iso(w.resetsAt)).toBe('2026-04-05T14:00:00.000Z'); // AEST
    expect(w.resetsAt.getTime() - w.start.getTime()).toBe(25 * 3600_000);
  });

  it('falls back to UTC for a missing or invalid time zone', () => {
    expect(resolveUsageTimeZone(null)).toBe('UTC');
    expect(resolveUsageTimeZone('  ')).toBe('UTC');
    expect(resolveUsageTimeZone('Mars/Olympus_Mons')).toBe('UTC');
    expect(resolveUsageTimeZone(' Asia/Karachi ')).toBe('Asia/Karachi');
    expect(iso(usageWindowFor(new Date('2026-11-20T15:30:00Z'), 'nope').start)).toBe('2026-11-20T00:00:00.000Z');
  });
});
