/** Shared with server CORS setup; covered by unit tests to avoid config drift. */
export function parseRealtimeCorsOrigins(raw: string | undefined): string[] {
  return (raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
