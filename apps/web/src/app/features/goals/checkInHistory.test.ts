import { describe, it, expect } from 'vitest';
import { milestoneLabel, normalizeCheckIn, normalizeHistory } from './checkInHistory';

describe('checkInHistory — normalization', () => {
  it('humanizes milestone values', () => {
    expect(milestoneLabel('making_progress')).toBe('Making Progress');
    expect(milestoneLabel('completed')).toBe('Completed');
    expect(milestoneLabel(null)).toBeNull();
    expect(milestoneLabel('')).toBeNull();
  });

  it('normalizes a numeric GOAL check-in (note from notes/reflection)', () => {
    const row = {
      id: 'c1',
      created_at: '2026-07-10T10:00:00Z',
      check_in_date: '2026-07-10',
      value_added: 3,
      milestone: null,
      progress_before: 20,
      progress_after: 50,
      notes: 'Did three',
      reflection: 'ignored when notes present',
    };
    const n = normalizeCheckIn(row, 'goal');
    expect(n).toMatchObject({
      valueAdded: 3,
      milestone: null,
      progressBefore: 20,
      progressAfter: 50,
      note: 'Did three',
    });
  });

  it('falls back to reflection for a goal note when notes is empty', () => {
    const n = normalizeCheckIn(
      { id: 'c2', created_at: 'x', notes: '', reflection: 'felt good' },
      'goal'
    );
    expect(n.note).toBe('felt good');
  });

  it('normalizes a MANUAL milestone check-in', () => {
    const n = normalizeCheckIn(
      { id: 'c3', created_at: 'x', milestone: 'significant_progress', progress_before: 50, progress_after: 75 },
      'achievement'
    );
    expect(n.milestone).toBe('Significant Progress');
    expect(n.progressAfter).toBe(75);
  });

  it('normalizes an ACHIEVEMENT check-in (note from note field)', () => {
    const n = normalizeCheckIn(
      { id: 'c4', created_at: 'x', value_added: 5, note: 'nice', progress_after: 40 },
      'achievement'
    );
    expect(n.note).toBe('nice');
    expect(n.valueAdded).toBe(5);
  });

  it('sorts history chronologically (oldest first) and handles empty', () => {
    expect(normalizeHistory([], 'goal')).toEqual([]);
    expect(normalizeHistory(null, 'goal')).toEqual([]);
    const rows = [
      { id: 'b', created_at: '2026-07-11T00:00:00Z', value_added: 1 },
      { id: 'a', created_at: '2026-07-10T00:00:00Z', value_added: 1 },
      { id: 'c', created_at: '2026-07-12T00:00:00Z', value_added: 1 },
    ];
    expect(normalizeHistory(rows, 'goal').map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });
});
