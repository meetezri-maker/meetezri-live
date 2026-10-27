/** IANA time zone this browser uses for local dates (e.g. "Asia/Karachi"), for report headers. */
export function currentTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time';
  } catch {
    return 'Local time';
  }
}
