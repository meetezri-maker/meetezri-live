// @vitest-environment node

import { readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const POSTER_PATH = resolve(
  process.cwd(),
  'public/solace/onboarding-complete-twilight-lake.jpg',
);

function jpegDimensions(bytes: Buffer): { width: number; height: number } {
  expect([...bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);

  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    const segmentLength = bytes.readUInt16BE(offset);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: bytes.readUInt16BE(offset + 3),
        width: bytes.readUInt16BE(offset + 5),
      };
    }
    offset += segmentLength;
  }

  throw new Error('JPEG dimensions marker was not found');
}

describe('Early Access founder poster asset integrity', () => {
  it('is a genuine 1536 × 1024 JPEG with the expected MIME extension', () => {
    const bytes = readFileSync(POSTER_PATH);

    expect(extname(POSTER_PATH)).toBe('.jpg');
    expect(jpegDimensions(bytes)).toEqual({ width: 1536, height: 1024 });
    expect(bytes.subarray(-2)).toEqual(Buffer.from([0xff, 0xd9]));
    expect('image/jpeg').toBe('image/jpeg');
  });
});
