import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isEligibleAccountDob, isRealIsoDob, preferStoredDob } from './profileAge';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 26, 12, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('isRealIsoDob', () => {
  it('accepts real calendar dates, including leap days in leap years', () => {
    expect(isRealIsoDob('1990-04-02')).toBe(true);
    expect(isRealIsoDob('2000-02-29')).toBe(true);
  });

  it('rejects impossible or malformed dates', () => {
    for (const value of ['2001-02-29', '2001-02-30', '2001-04-31', '2001-13-01', '1990-4-2', '04/02/1990', '', '30']) {
      expect(isRealIsoDob(value)).toBe(false);
    }
  });
});

describe('isEligibleAccountDob', () => {
  it('applies the 18+ rule with today as the boundary', () => {
    expect(isEligibleAccountDob('2008-10-26')).toBe(true);
    expect(isEligibleAccountDob('2008-10-27')).toBe(false);
  });

  it('rejects future dates', () => {
    expect(isEligibleAccountDob('2027-01-01')).toBe(false);
  });
});

describe('preferStoredDob', () => {
  it('keeps a stored DOB over a stale numeric or empty candidate', () => {
    expect(preferStoredDob('30', '1990-04-02')).toBe('1990-04-02');
    expect(preferStoredDob('', '1990-04-02')).toBe('1990-04-02');
    expect(preferStoredDob(undefined, '1990-04-02')).toBe('1990-04-02');
  });

  it('keeps a DOB candidate (an edit) over the stored one', () => {
    expect(preferStoredDob('1985-12-31', '1990-04-02')).toBe('1985-12-31');
  });

  it('leaves numeric and empty accounts exactly as they were', () => {
    expect(preferStoredDob('30', '30')).toBe('30');
    expect(preferStoredDob('30', null)).toBe('30');
    expect(preferStoredDob('', null)).toBe('');
  });
});
