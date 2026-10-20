import { readFileSync } from 'fs';
import path from 'path';
import {
  EXPECTED_IDENTITY_HASH,
  EXPECTED_UUID_HASH,
  assertCanonicalAllowlist,
  assertIdentityMatches,
  canonicalAllowlistHashes,
  parseAllowlistTsv,
} from './account-cleanup.allowlist';

const entries = parseAllowlistTsv(readFileSync(path.resolve(__dirname, '../../../scripts/account-cleanup/delete-account-allowlist.tsv'), 'utf8'));

describe('account cleanup allowlist', () => {
  test('243 canonical UUID/email pairs pass both hashes', () => {
    expect(assertCanonicalAllowlist(entries)).toHaveLength(243);
    expect(canonicalAllowlistHashes(entries)).toEqual({ uuidHash: EXPECTED_UUID_HASH, identityHash: EXPECTED_IDENTITY_HASH });
  });
  test('one changed UUID fails closed', () => {
    const changed = entries.map((entry, i) => i ? entry : { ...entry, id: '11111111-1111-4111-8111-111111111111' });
    expect(() => assertCanonicalAllowlist(changed)).toThrow('Canonical UUID hash mismatch');
  });
  test('one changed email fails closed', () => {
    const changed = entries.map((entry, i) => i ? entry : { ...entry, email: 'changed@example.com' });
    expect(() => assertCanonicalAllowlist(changed)).toThrow('Canonical UUID/email hash mismatch');
  });
  test('one missing or extra row fails closed', () => {
    expect(() => assertCanonicalAllowlist(entries.slice(1))).toThrow('row count mismatch');
    expect(() => assertCanonicalAllowlist([...entries, entries[0]])).toThrow('row count mismatch');
  });
  test('UUID/email identity mismatch fails closed', () => {
    const rows = entries.map((entry) => ({ ...entry }));
    const mismatched = rows.map((row, i) => i ? row : { ...row, email: 'wrong@example.com' });
    expect(() => assertIdentityMatches(entries, mismatched, rows)).toThrow('UUID/email identity mismatch');
  });
});
