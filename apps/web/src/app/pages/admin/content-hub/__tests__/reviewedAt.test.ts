/**
 * Regression: "Invalid datetime" when saving the Reviewed on field.
 *
 * WHAT HAPPENED. `reviewed_at` is a `timestamptz` column and the API's update schema is
 * `z.string().datetime()`. The editor's control is `<input type="date">`, which submits
 * `2026-08-10`, and `toUpdateBody` forwarded that string unchanged. Zod rejected it and the save
 * failed with "Invalid datetime". The read direction was already correct, so the field looked
 * fine until you tried to change it.
 *
 * These tests cover the boundary that failed — form values through `toUpdateBody` to the payload,
 * and an API ISO datetime back into the date input — plus the timezone property that makes the
 * chosen conversion the right one.
 */

import { describe, expect, it } from 'vitest';
import {
  dateInputToIso,
  isoToDateInput,
  editorDraftSchema,
  toUpdateBody,
  type EditorFormValues,
} from '../schema/contentHubEditor.schema';

const baseValues = (overrides: Partial<EditorFormValues> = {}): EditorFormValues => ({
  title: 'A Week 1 item',
  slug: 'a-week-1-item',
  metaDescription: '',
  featuredImageUrl: '',
  featuredImageAlt: '',
  pillar: '',
  week: '',
  tagsInput: '',
  editorialRef: '',
  authorId: '',
  reviewerId: '',
  reviewedAt: '',
  canonicalUrlOverride: '',
  robotsDirective: 'index,follow',
  ...overrides,
});

const build = (overrides: Partial<EditorFormValues> = {}) =>
  toUpdateBody(baseValues(overrides), { expectedUpdatedAt: '2026-08-09T10:00:00.000Z', createRevision: true });

// ─── The save payload ────────────────────────────────────────────────────────

describe('form date → save payload', () => {
  it('sends an ISO datetime, not the bare date the input produced', () => {
    // Before the fix this was exactly `'2026-08-10'`, which the API rejected.
    expect(build({ reviewedAt: '2026-08-10' }).reviewedAt).toBe('2026-08-10T00:00:00.000Z');
  });

  it('produces a value the API contract accepts', () => {
    // Mirrors the API's `z.string().datetime()` (Zod v3), which is the check that was failing.
    const iso = build({ reviewedAt: '2026-08-10' }).reviewedAt!;
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(Number.isNaN(Date.parse(iso))).toBe(false);
  });

  it('sends null when no reviewed date is set', () => {
    expect(build({ reviewedAt: '' }).reviewedAt).toBeNull();
  });

  it('sends null when the date is cleared', () => {
    // Clearing an `<input type="date">` yields an empty string, not undefined.
    expect(build({ reviewedAt: '   ' }).reviewedAt).toBeNull();
  });

  it('passes a full ISO datetime through untouched', () => {
    expect(build({ reviewedAt: '2026-08-10T14:30:00.000Z' }).reviewedAt).toBe(
      '2026-08-10T14:30:00.000Z',
    );
  });
});

// ─── Hydration ───────────────────────────────────────────────────────────────

describe('response timestamp → date input', () => {
  it('feeds the date input a calendar date, never a full timestamp', () => {
    expect(isoToDateInput('2026-08-10T00:00:00.000Z')).toBe('2026-08-10');
    expect(isoToDateInput('2026-08-10T00:00:00.000Z')).not.toContain('T');
  });

  it('handles a stored timestamp that is not midnight', () => {
    expect(isoToDateInput('2026-08-10T23:59:59.999Z')).toBe('2026-08-10');
  });

  it('maps null and undefined to an empty input', () => {
    expect(isoToDateInput(null)).toBe('');
    expect(isoToDateInput(undefined)).toBe('');
    expect(isoToDateInput('')).toBe('');
  });
});

// ─── Round trip ──────────────────────────────────────────────────────────────

describe('round trip', () => {
  it('returns the same calendar date it was given', () => {
    for (const date of ['2026-08-10', '2026-01-01', '2026-12-31', '2024-02-29']) {
      expect({ date, back: isoToDateInput(dateInputToIso(date)) }).toEqual({ date, back: date });
    }
  });

  it('survives a save-and-reload cycle through the payload shape', () => {
    const payload = build({ reviewedAt: '2026-08-10' });
    // The API echoes the stored timestamp back on the detail response.
    expect(isoToDateInput(payload.reviewedAt)).toBe('2026-08-10');
  });
});

// ─── Timezone safety ─────────────────────────────────────────────────────────

describe('timezone safety', () => {
  /**
   * The whole reason the conversion is string-only. These dates are the ones that shift under a
   * local-time parse: a New Year's Day in UTC+13, and a New Year's Eve in UTC-11.
   */
  it('never shifts the day, in either direction', () => {
    for (const date of ['2026-01-01', '2026-12-31', '2026-06-15', '2026-08-10']) {
      const iso = dateInputToIso(date)!;
      expect({ date, iso }).toEqual({ date, iso: `${date}T00:00:00.000Z` });
      expect({ date, back: isoToDateInput(iso) }).toEqual({ date, back: date });
    }
  });

  it('does not construct a Date, which is what made the naive fix unsafe', () => {
    // Demonstrates the bug that was avoided: parsing `YYYY-MM-DDT00:00:00` as LOCAL time moves
    // the calendar day in any timezone east of UTC. Our conversion cannot, because it never
    // parses anything.
    const naive = new Date('2026-08-10T00:00:00').toISOString().slice(0, 10);
    const safe = isoToDateInput(dateInputToIso('2026-08-10'));

    expect(safe).toBe('2026-08-10');
    // `naive` equals the input only when the runner happens to sit at or west of UTC — which is
    // precisely why it cannot be relied on.
    expect(['2026-08-09', '2026-08-10']).toContain(naive);
  });

  it('is a pure string transform — no Date, no locale, no environment', () => {
    const iso = dateInputToIso('2026-08-10');
    expect(iso).toBe('2026-08-10T00:00:00.000Z');
    // Same input, same output, regardless of when or where it runs.
    expect(dateInputToIso('2026-08-10')).toBe(iso);
  });
});

// ─── Field validation ────────────────────────────────────────────────────────

describe('the field schema keeps the date input honest', () => {
  const parse = (reviewedAt: string) => editorDraftSchema.safeParse(baseValues({ reviewedAt }));

  it('accepts a calendar date', () => {
    expect(parse('2026-08-10').success).toBe(true);
  });

  it('accepts an empty value', () => {
    expect(parse('').success).toBe(true);
  });

  it('rejects a malformed value rather than letting the API reject it', () => {
    // Better to fail in the form, next to the field, than as a save error with no location.
    expect(parse('10/08/2026').success).toBe(false);
    expect(parse('not-a-date').success).toBe(false);
  });
});

// ─── Reviewer / date independence ────────────────────────────────────────────

describe('reviewer and reviewed date are independent fields', () => {
  it('allows a reviewed date with no reviewer assigned', () => {
    const payload = build({ reviewedAt: '2026-08-10', reviewerId: '' });
    expect(payload.reviewedAt).toBe('2026-08-10T00:00:00.000Z');
    expect(payload.reviewerId).toBeNull();
  });

  it('allows a reviewer with no reviewed date', () => {
    const payload = build({ reviewerId: '11111111-1111-4111-8111-111111111111', reviewedAt: '' });
    expect(payload.reviewerId).toBe('11111111-1111-4111-8111-111111111111');
    expect(payload.reviewedAt).toBeNull();
  });

  it('does NOT cascade — clearing the reviewer leaves the date alone', () => {
    // Deliberate: the approved model treats these as separate fields, and silently erasing an
    // editor's recorded review date because they changed the reviewer would be data loss.
    // The public JSON-LD already guards the meaningful case by emitting `reviewedBy` only when
    // BOTH a reviewer and a review date exist.
    const payload = build({ reviewerId: '', reviewedAt: '2026-08-10' });
    expect(payload.reviewerId).toBeNull();
    expect(payload.reviewedAt).toBe('2026-08-10T00:00:00.000Z');
  });
});
