/**
 * Slug helpers for the Content Hub.
 *
 * The normalisation ALGORITHM lives in `@meetezri/shared` because the web editor needs the exact
 * same behaviour to show a live preview — two implementations would drift and the editor would
 * promise a slug the API then changed. This module is the API's entry point and adds the
 * server-only concerns.
 *
 * Database availability checks deliberately live in the service layer (Phase 2), not here: they
 * need a Prisma client, and keeping this module dependency-free keeps it trivially testable.
 */

import {
  RESERVED_SLUGS,
  isReservedSlug,
  normaliseSlug,
  validateSlug,
  type SlugRejectionReason,
} from '@meetezri/shared';

export { RESERVED_SLUGS, isReservedSlug, normaliseSlug, validateSlug };
export type { SlugRejectionReason };

/**
 * Derive a storable slug from arbitrary text (usually the title).
 *
 * Returns `null` rather than a placeholder when the input normalises to nothing — a caller that
 * silently accepted `""` or `"untitled"` would create a broken public URL.
 */
export function deriveSlug(input: string): string | null {
  const slug = normaliseSlug(input);
  return slug === '' ? null : slug;
}

/**
 * Normalise a caller-supplied slug and report why it is unusable.
 *
 * The client value is never trusted verbatim: a slug arriving as `Admin` or `  My Post  ` is
 * normalised first, then judged.
 */
export function prepareSlug(input: string): {
  slug: string;
  valid: boolean;
  reason?: SlugRejectionReason;
} {
  const slug = normaliseSlug(input);
  const result = validateSlug(slug);
  return { slug, valid: result.valid, reason: result.reason };
}
