import { describe, it, expect } from 'vitest';
import { buildCsv, escapeCsvCell } from './csv';

describe('escapeCsvCell', () => {
  it('quotes commas, quotes and line breaks', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell('line 1\nline 2')).toBe('"line 1\nline 2"');
    expect(escapeCsvCell('line 1\r\nline 2')).toBe('"line 1\r\nline 2"');
  });

  it('keeps numbers, booleans and blanks as values', () => {
    expect(escapeCsvCell(0)).toBe('0');
    expect(escapeCsvCell(-2.5)).toBe('-2.5');
    expect(escapeCsvCell(false)).toBe('false');
    expect(escapeCsvCell(true)).toBe('true');
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
    expect(escapeCsvCell(Number.NaN)).toBe('');
  });

  it.each([
    ['=1+2', "'=1+2"],
    ['+92 300 0000000', "'+92 300 0000000"],
    ['-2+3', "'-2+3"],
    ['@SUM(1,1)', '"\'@SUM(1,1)"'],
    ['  =cmd', "'  =cmd"],
    ['\t=cmd', "'\t=cmd"],
    ['\r=cmd', '"\'\r=cmd"'],
    ['\u0001=cmd', "'\u0001=cmd"],
    ['\tplain', "'\tplain"],
    ['＝1+2', "'＝1+2"],
  ])('neutralises formula-like text %j', (input, expected) => {
    expect(escapeCsvCell(input)).toBe(expected);
  });

  it('leaves ordinary and Urdu text unchanged', () => {
    expect(escapeCsvCell('Ayesha')).toBe('Ayesha');
    expect(escapeCsvCell('آج میں نے بہت سکون محسوس کیا')).toBe('آج میں نے بہت سکون محسوس کیا');
    expect(escapeCsvCell('a-b = c')).toBe('a-b = c');
  });
});

describe('buildCsv', () => {
  it('writes a UTF-8 BOM, CRLF rows and a trailing newline', () => {
    expect(buildCsv([['a', 1], ['b', false]])).toBe('﻿a,1\r\nb,false\r\n');
  });
});
