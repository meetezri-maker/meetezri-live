/**
 * Word count and reading time for the Content Hub.
 *
 * THE SERVER VALUE IS AUTHORITATIVE. Both numbers are computed here on write and stored on the
 * row (`word_count`, `reading_time_minutes`) so that:
 *
 *   1. the public /resources list never parses a body to render a card, and
 *   2. server-rendered and client-rendered markup cannot disagree — a hydration mismatch this
 *      design specifically avoids (CONTENT_HUB_IMPLEMENTATION_PLAN.md §10.11).
 *
 * The editor may show a live count for feedback, but it is advisory; what the public page shows
 * comes from the stored value.
 *
 * The algorithm lives in `@meetezri/shared` so the editor's advisory number uses the identical
 * rules — including the exclusions, which are the part most likely to drift.
 */

import { countBodyWords, deriveReadingStats, readingTimeMinutes } from '@meetezri/shared';

export { countBodyWords, deriveReadingStats, readingTimeMinutes };

/**
 * Both derived values for a body, in the shape the persistence layer stores.
 *
 * Counts only what a reader actually reads: internal fields (`coreMessage`, `citationGoal`),
 * block ids, URLs and image metadata are excluded. Including them would inflate reading time and
 * make the SEO `word_count_target` comparison meaningless.
 */
export function deriveContentMetrics(body: unknown): {
  word_count: number;
  reading_time_minutes: number;
} {
  const stats = deriveReadingStats(body);
  return {
    word_count: stats.wordCount,
    reading_time_minutes: stats.readingTimeMinutes,
  };
}
