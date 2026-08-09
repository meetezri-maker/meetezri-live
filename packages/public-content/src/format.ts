/**
 * Deterministic formatting.
 *
 * Every helper here must produce the SAME string on the server and in the browser, or hydration
 * warns and the visible text flickers. That rules out `toLocaleDateString()`, which depends on
 * the host's ICU data and timezone: Node on Vercel is UTC, the reader's browser is not.
 *
 * So dates are formatted from UTC parts with an explicit month table. Boring on purpose.
 */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** "12 March 2026", or null when the input is missing or unparseable. */
export function formatPublicDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** "2026-03-12" — the machine-readable form for `<time dateTime>` and sitemap lastmod. */
export function toIsoDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

/** "4 min read", or null when reading time is unknown. */
export function formatReadingTime(minutes: number | null | undefined): string | null {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) return null;
  return `${Math.round(minutes)} min read`;
}

/** Public path for a resource. The one place the `/resources` prefix is written. */
export function resourcePath(slug: string): string {
  return `/resources/${slug}`;
}

/**
 * Absolute URL for a public path.
 *
 * `origin` is passed in rather than read from the environment so the same function works in the
 * renderer, the sitemap and the tests without a global.
 */
export function absoluteUrl(origin: string, path: string): string {
  const base = origin.replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * A slug-safe anchor id derived from heading text.
 *
 * Used only when a block carries no `anchorId`. Deterministic — never a random id, which would
 * differ between the server render and the client render.
 */
export function anchorFromText(text: string, fallback: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || fallback;
}
