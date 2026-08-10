/**
 * Regression: the `reviewedAt` half of the update contract.
 *
 * The editor's `<input type="date">` submitted `2026-08-10` and the API's update schema is
 * `z.string().datetime()`, so every save of the Reviewed on field failed with "Invalid datetime".
 * The fix converts at the web boundary; this file pins the API side of that agreement so the
 * contract cannot drift from the other direction.
 *
 * The API schema is deliberately NOT loosened to accept a bare date: `reviewed_at` is a
 * `timestamptz` column, and allowing two formats into one timestamp column is how ambiguity gets
 * stored.
 */

import { updateContentBodySchema } from '../content-hub.schema';

const parse = (reviewedAt: unknown) =>
  updateContentBodySchema.safeParse({
    expectedUpdatedAt: '2026-08-09T10:00:00.000Z',
    createRevision: true,
    reviewedAt,
  });

describe('the update schema and the editor agree on reviewedAt', () => {
  it('accepts the UTC-midnight timestamp the editor now sends', () => {
    expect(parse('2026-08-10T00:00:00.000Z').success).toBe(true);
  });

  it('REJECTS the bare calendar date that caused the bug', () => {
    const result = parse('2026-08-10');
    expect(result.success).toBe(false);
    if (!result.success) {
      // The exact message operators saw in the editor.
      expect(result.error.issues.some((i) => /datetime/i.test(i.message))).toBe(true);
    }
  });

  it('accepts null, so the date can be cleared', () => {
    expect(parse(null).success).toBe(true);
  });

  it('accepts the field being absent entirely', () => {
    expect(
      updateContentBodySchema.safeParse({
        expectedUpdatedAt: '2026-08-09T10:00:00.000Z',
        createRevision: true,
      }).success
    ).toBe(true);
  });

  it('rejects an empty string rather than storing an unparseable timestamp', () => {
    expect(parse('').success).toBe(false);
  });

  it('accepts a non-midnight timestamp, so the column keeps its full precision', () => {
    expect(parse('2026-08-10T14:30:00.000Z').success).toBe(true);
  });
});

describe('reviewer and reviewed date remain independently settable', () => {
  it('accepts a reviewed date with a null reviewer', () => {
    const result = updateContentBodySchema.safeParse({
      expectedUpdatedAt: '2026-08-09T10:00:00.000Z',
      createRevision: true,
      reviewerId: null,
      reviewedAt: '2026-08-10T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a reviewer with a null reviewed date', () => {
    const result = updateContentBodySchema.safeParse({
      expectedUpdatedAt: '2026-08-09T10:00:00.000Z',
      createRevision: true,
      reviewerId: '11111111-1111-4111-8111-111111111111',
      reviewedAt: null,
    });
    expect(result.success).toBe(true);
  });
});
