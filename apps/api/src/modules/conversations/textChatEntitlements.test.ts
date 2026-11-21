jest.mock('../../lib/prisma', () => ({ __esModule: true, default: {} }));

import { getPolicyStatus } from '../entitlements';
import {
  PROPOSED_DAILY_LIMITS,
  decideTextChatAccess,
  effectiveTextChatMode,
  readTextChatDailyLimits,
  requestedTextChatMode,
  resolveTextChatGate,
} from './textChatEntitlements';

const limits = PROPOSED_DAILY_LIMITS;

describe('text chat eligibility policy', () => {
  it.each([
    ['active trial (DISCOVER / ACTIVE)', 'DISCOVER', 'ACTIVE', 20],
    ['trialing (DISCOVER / TRIALING)', 'DISCOVER', 'TRIALING', 20],
    ['Grow', 'GROW', 'ACTIVE', 100],
    ['Thrive', 'THRIVE', 'ACTIVE', 200],
    ['cancelled but inside the paid period', 'GROW', 'CANCELED', 100],
    ['past due (access retained, as everywhere else)', 'THRIVE', 'PAST_DUE', 200],
    ['no subscription / unrecognised status (treated as DISCOVER, as every caller does)', 'DISCOVER', 'NONE', 20],
  ] as const)('allows %s with the tier allowance', (_label, membership, status, dailyLimit) => {
    expect(decideTextChatAccess({ membership, status }, limits)).toEqual({ allowed: true, membership, status, dailyLimit });
  });

  it('blocks an expired trial with TRIAL_EXPIRED', () => {
    expect(decideTextChatAccess({ membership: 'DISCOVER', status: 'EXPIRED' }, limits)).toMatchObject({
      allowed: false,
      code: 'TRIAL_EXPIRED',
    });
  });

  it('blocks a cancelled paid plan whose period ended with SUBSCRIPTION_NOT_ELIGIBLE', () => {
    expect(decideTextChatAccess({ membership: 'GROW', status: 'EXPIRED' }, limits)).toMatchObject({
      allowed: false,
      code: 'SUBSCRIPTION_NOT_ELIGIBLE',
    });
  });

  it('treats a tier configured with 0 messages as not eligible', () => {
    expect(decideTextChatAccess({ membership: 'DISCOVER', status: 'ACTIVE' }, { ...limits, DISCOVER: 0 })).toMatchObject({
      allowed: false,
      code: 'PLAN_NOT_ELIGIBLE',
    });
  });
});

describe('configuration', () => {
  it('defaults to the proposed limits and accepts overrides in range only', () => {
    expect(readTextChatDailyLimits({})).toEqual({ DISCOVER: 20, GROW: 100, THRIVE: 200 });
    expect(
      readTextChatDailyLimits({
        CONVERSATIONS_DAILY_LIMIT_DISCOVER: '30',
        CONVERSATIONS_DAILY_LIMIT_GROW: '0',
        CONVERSATIONS_DAILY_LIMIT_THRIVE: '-5',
      })
    ).toEqual({ DISCOVER: 30, GROW: 0, THRIVE: 200 });
    expect(readTextChatDailyLimits({ CONVERSATIONS_DAILY_LIMIT_GROW: '1.5' }).GROW).toBe(100);
  });

  it.each([
    [undefined, 'off'],
    ['', 'off'],
    ['bogus', 'off'],
    ['SHADOW', 'shadow'],
    [' enforce ', 'enforce'],
  ])('reads CONVERSATIONS_ENTITLEMENTS_MODE=%p as %p', (raw, expected) => {
    expect(requestedTextChatMode(raw === undefined ? {} : { CONVERSATIONS_ENTITLEMENTS_MODE: raw })).toBe(expected);
  });

  it('never enforces while the policy ledger says PROVISIONAL (downgrades to shadow)', () => {
    expect(getPolicyStatus('textChatAccess')).toBe('PROVISIONAL');
    expect(effectiveTextChatMode('enforce')).toBe('shadow');
    expect(effectiveTextChatMode('enforce', 'PROVISIONAL')).toBe('shadow');
    expect(effectiveTextChatMode('enforce', 'APPROVED')).toBe('enforce');
    expect(effectiveTextChatMode('shadow', 'APPROVED')).toBe('shadow');
    expect(effectiveTextChatMode('off', 'APPROVED')).toBe('off');
  });

  it('defaults to off in this environment', () => {
    expect(effectiveTextChatMode()).toBe('off');
  });
});

describe('resolveTextChatGate', () => {
  it('does no lookup at all when off', async () => {
    const load = jest.fn();
    await expect(resolveTextChatGate('u', { mode: 'off', loadEntitlements: load })).resolves.toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it('resolves the decision through the entitlement engine when shadow/enforce', async () => {
    const load = jest.fn(async () => ({ membership: 'GROW' as const, status: 'ACTIVE' as const }));
    await expect(resolveTextChatGate('u1', { mode: 'shadow', loadEntitlements: load, limits })).resolves.toEqual({
      mode: 'shadow',
      decision: { allowed: true, membership: 'GROW', status: 'ACTIVE', dailyLimit: 100 },
    });
    expect(load).toHaveBeenCalledWith('u1');
  });
});
