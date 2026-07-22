import { describe, it, expect } from 'vitest';
import {
  AMOUNT_UNITS,
  CHECK_IN_FIELD_LABELS,
  DURATION_UNITS,
  MILESTONE_PROGRESS,
  MILESTONE_STAGES,
  TRACKING_METHODS,
  displayProgressEstimate,
  isAmountPresetUnit,
  isMilestoneStage,
  isNumericTracking,
  isValidCheckInValue,
  isValidTargetValue,
  requiresTrackingChangeConfirmation,
} from './tracking';

describe('tracking methods', () => {
  it('supports all four approved tracking methods', () => {
    expect(TRACKING_METHODS).toEqual(['count', 'duration', 'amount', 'manual_milestone']);
  });

  it('classifies numeric vs manual tracking', () => {
    expect(isNumericTracking('count')).toBe(true);
    expect(isNumericTracking('duration')).toBe(true);
    expect(isNumericTracking('amount')).toBe(true);
    expect(isNumericTracking('manual_milestone')).toBe(false);
  });

  it('labels the check-in field per method', () => {
    expect(CHECK_IN_FIELD_LABELS.count).toBe('Completed today');
    expect(CHECK_IN_FIELD_LABELS.duration).toBe('Time completed');
    expect(CHECK_IN_FIELD_LABELS.amount).toBe('Amount completed');
    expect(CHECK_IN_FIELD_LABELS.manual_milestone).toBe('Progress milestone');
  });
});

describe('manual milestone mapping', () => {
  it('maps each stage to its canonical percentage', () => {
    expect(MILESTONE_PROGRESS.not_started).toBe(0);
    expect(MILESTONE_PROGRESS.started).toBe(25);
    expect(MILESTONE_PROGRESS.making_progress).toBe(50);
    expect(MILESTONE_PROGRESS.significant_progress).toBe(75);
    expect(MILESTONE_PROGRESS.completed).toBe(100);
  });

  it('exposes the five stages in order', () => {
    expect(MILESTONE_STAGES.map((s) => s.value)).toEqual([
      'not_started',
      'started',
      'making_progress',
      'significant_progress',
      'completed',
    ]);
  });

  it('validates stage names', () => {
    expect(isMilestoneStage('started')).toBe(true);
    expect(isMilestoneStage('almost')).toBe(false);
  });
});

describe('display progress estimate (client display only)', () => {
  it('computes count/duration/amount progress', () => {
    expect(displayProgressEstimate('count', { currentValue: 3, targetValue: 10 })).toBe(30);
    expect(displayProgressEstimate('duration', { currentValue: 45, targetValue: 60 })).toBe(75);
    expect(displayProgressEstimate('amount', { currentValue: 250, targetValue: 1000 })).toBe(25);
  });

  it('caps at 100%', () => {
    expect(displayProgressEstimate('count', { currentValue: 99, targetValue: 10 })).toBe(100);
  });

  it('never goes negative', () => {
    expect(displayProgressEstimate('count', { currentValue: -5, targetValue: 10 })).toBe(0);
  });

  it('uses milestone percentage for manual tracking', () => {
    expect(displayProgressEstimate('manual_milestone', { milestone: 'significant_progress' })).toBe(75);
  });
});

describe('client-side pre-validation', () => {
  it('requires target > 0', () => {
    expect(isValidTargetValue(1)).toBe(true);
    expect(isValidTargetValue(0)).toBe(false);
    expect(isValidTargetValue(-3)).toBe(false);
  });

  it('rejects negative check-in values', () => {
    expect(isValidCheckInValue(0)).toBe(true);
    expect(isValidCheckInValue(5)).toBe(true);
    expect(isValidCheckInValue(-0.5)).toBe(false);
  });
});

describe('approved units per method', () => {
  it('Duration offers Minutes / Hours / Days', () => {
    expect(DURATION_UNITS.map((u) => u.value)).toEqual(['minutes', 'hours', 'days']);
  });

  it('Amount offers currency / kilometres / litres / kilograms / custom', () => {
    expect(AMOUNT_UNITS.map((u) => u.value)).toEqual([
      'currency',
      'kilometres',
      'litres',
      'kilograms',
      'custom',
    ]);
  });

  it('recognizes amount preset units (custom is not a preset)', () => {
    expect(isAmountPresetUnit('kilometres')).toBe(true);
    expect(isAmountPresetUnit('currency')).toBe(true);
    expect(isAmountPresetUnit('custom')).toBe(false);
    expect(isAmountPresetUnit('reps')).toBe(false);
  });
});

describe('tracking-method-change confirmation (Phase 6)', () => {
  it('requires confirmation only when the method changes AND check-ins exist', () => {
    expect(requiresTrackingChangeConfirmation('count', 'duration', true)).toBe(true);
  });

  it('does not confirm when the method is unchanged', () => {
    expect(requiresTrackingChangeConfirmation('count', 'count', true)).toBe(false);
  });

  it('does not confirm when there are no check-ins', () => {
    expect(requiresTrackingChangeConfirmation('count', 'amount', false)).toBe(false);
  });

  it('does not confirm when there is no original method (fresh create)', () => {
    expect(requiresTrackingChangeConfirmation(undefined, 'count', true)).toBe(false);
  });
});
