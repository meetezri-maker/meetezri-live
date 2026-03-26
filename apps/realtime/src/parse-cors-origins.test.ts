import { parseRealtimeCorsOrigins } from './parse-cors-origins';

describe('parseRealtimeCorsOrigins', () => {
  it('returns empty when unset', () => {
    expect(parseRealtimeCorsOrigins(undefined)).toEqual([]);
    expect(parseRealtimeCorsOrigins('')).toEqual([]);
  });

  it('trims entries and drops empties', () => {
    expect(parseRealtimeCorsOrigins(' https://a.com , , https://b.com ')).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });
});
