import { createHash } from 'crypto';

export const EXPECTED_ALLOWLIST_COUNT = 243;
export const EXPECTED_UUID_HASH = '0ca589e4068a2088b51d35d020f8987fec40b9be20a3e6aea47ca9718b03712e';
export const EXPECTED_IDENTITY_HASH = '613a29f1ac3b3e5312a8974b2713238a3349ac83f6ca2d3a3897de4ed508f991';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export type AllowlistEntry = Readonly<{ id: string; email: string }>;
export type IdentityRow = Readonly<{ id: string; email: string | null }>;

export function normalizeAllowlist(entries: readonly AllowlistEntry[]): AllowlistEntry[] {
  return entries.map(({ id, email }) => ({ id: String(id).trim().toLowerCase(), email: String(email).trim().toLowerCase() }));
}
export function canonicalAllowlistHashes(entries: readonly AllowlistEntry[]) {
  const normalized = normalizeAllowlist(entries);
  const uuidText = normalized.map((entry) => entry.id).sort().join('\n');
  const identityText = normalized.map((entry) => `${entry.id}\t${entry.email}`).sort().join('\n');
  return { uuidHash: createHash('sha256').update(uuidText, 'utf8').digest('hex'), identityHash: createHash('sha256').update(identityText, 'utf8').digest('hex') };
}
export function parseAllowlistTsv(text: string): AllowlistEntry[] {
  return text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#')).map((line, index) => {
    const [id, email, extra] = line.split('\t');
    if (!id || !email || extra !== undefined) throw new Error(`Invalid allowlist row ${index + 1}`);
    return { id, email };
  });
}
export function assertCanonicalAllowlist(entries: readonly AllowlistEntry[]): AllowlistEntry[] {
  const normalized = normalizeAllowlist(entries);
  if (normalized.length !== EXPECTED_ALLOWLIST_COUNT) throw new Error(`Allowlist row count mismatch: expected ${EXPECTED_ALLOWLIST_COUNT}, got ${normalized.length}`);
  const ids = new Set<string>(); const emails = new Set<string>();
  for (const entry of normalized) {
    if (!UUID_RE.test(entry.id)) throw new Error(`Invalid allowlist UUID: ${entry.id}`);
    if (!entry.email.includes('@')) throw new Error(`Invalid allowlist email for ${entry.id}`);
    if (ids.has(entry.id)) throw new Error(`Duplicate allowlist UUID: ${entry.id}`);
    if (emails.has(entry.email)) throw new Error(`Duplicate allowlist email: ${entry.email}`);
    ids.add(entry.id); emails.add(entry.email);
  }
  const hashes = canonicalAllowlistHashes(normalized);
  if (hashes.uuidHash !== EXPECTED_UUID_HASH) throw new Error(`Canonical UUID hash mismatch: ${hashes.uuidHash}`);
  if (hashes.identityHash !== EXPECTED_IDENTITY_HASH) throw new Error(`Canonical UUID/email hash mismatch: ${hashes.identityHash}`);
  return normalized;
}
function indexRows(rows: readonly IdentityRow[], source: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const row of rows) {
    const id = row.id.trim().toLowerCase(); const email = row.email?.trim().toLowerCase();
    if (!email) throw new Error(`${source} identity ${id} has no email`);
    if (result.has(id)) throw new Error(`Duplicate ${source} identity: ${id}`);
    result.set(id, email);
  }
  return result;
}
export function assertIdentityMatches(entries: readonly AllowlistEntry[], profiles: readonly IdentityRow[], authUsers: readonly IdentityRow[]): void {
  const expected = assertCanonicalAllowlist(entries);
  const profileById = indexRows(profiles, 'profile'); const authById = indexRows(authUsers, 'auth');
  if (profileById.size !== EXPECTED_ALLOWLIST_COUNT || authById.size !== EXPECTED_ALLOWLIST_COUNT) throw new Error(`Identity count mismatch: profiles=${profileById.size}, auth=${authById.size}`);
  for (const entry of expected) {
    const profileEmail = profileById.get(entry.id); const authEmail = authById.get(entry.id);
    if (profileEmail !== entry.email || authEmail !== entry.email) throw new Error(`UUID/email identity mismatch for ${entry.id}: expected ${entry.email}, profile=${profileEmail ?? 'missing'}, auth=${authEmail ?? 'missing'}`);
  }
}
export function assertOnlyAllowlisted(selectedIds: readonly string[], entries: readonly AllowlistEntry[], label: string): void {
  const allowed = new Set(entries.map((entry) => entry.id));
  const outside = selectedIds.map((id) => id.trim().toLowerCase()).filter((id) => !allowed.has(id));
  if (outside.length) throw new Error(`${label} contains non-allowlisted UUIDs: ${outside.join(', ')}`);
}
