/**
 * STEP 6 — canonical trial-row creation (`ensureSingleActiveTrial`, plan §8A.4).
 *
 * Scope of the guarantee under test: the SEQUENTIAL active-trial invariant. Concurrency is
 * explicitly NOT covered — the partial unique index that provides it lands with the approved
 * cleanup migration (§17 Gate 3b).
 */

const mockPrisma = {
  subscriptions: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  founding_members: { findUnique: jest.fn() },
  profiles: { update: jest.fn() },
};

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

import {
  ensureSingleActiveTrial,
  provisionDiscoverTrial,
} from './trial.service';

const USER_ID = 'user-trial-helper';

function buildTxClient() {
  return {
    subscriptions: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'row-tx' }),
      update: jest.fn().mockResolvedValue({ id: 'row-tx' }),
    },
  };
}

describe('ensureSingleActiveTrial — first creation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.subscriptions.create.mockResolvedValue({ id: 'row-new' });
    mockPrisma.subscriptions.update.mockResolvedValue({ id: 'row-new' });
  });

  it('creates an active trial row when none exists', async () => {
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);

    const result = await ensureSingleActiveTrial(USER_ID);

    expect(result).toMatchObject({ created: true, reshaped: false });
    expect(mockPrisma.subscriptions.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.subscriptions.create.mock.calls[0][0].data).toMatchObject({
      user_id: USER_ID,
      plan_type: 'trial',
      status: 'active',
      billing_cycle: 'monthly',
    });
  });

  it('scopes the default lookup to the active trial row', async () => {
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);

    await ensureSingleActiveTrial(USER_ID);

    expect(mockPrisma.subscriptions.findFirst).toHaveBeenCalledWith({
      where: { user_id: USER_ID, plan_type: 'trial', status: 'active' },
      orderBy: { created_at: 'desc' },
    });
  });

  it('writes an exact trial window when start and end are supplied together', async () => {
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);
    const start = new Date('2026-01-01T00:00:00.000Z');
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

    await ensureSingleActiveTrial(USER_ID, { startDate: start, endDate: end });

    const data = mockPrisma.subscriptions.create.mock.calls[0][0].data;
    expect(data.start_date).toEqual(start);
    expect(data.end_date).toEqual(end);
  });

  it('omits end_date when the low-level helper receives no end date', async () => {
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);

    await ensureSingleActiveTrial(USER_ID, { amount: 0 });

    const data = mockPrisma.subscriptions.create.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('end_date');
    expect(data.amount).toBe(0);
  });
});

describe('ensureSingleActiveTrial — the active-trial invariant (sequential)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.subscriptions.create.mockResolvedValue({ id: 'row-new' });
    mockPrisma.subscriptions.update.mockResolvedValue({ id: 'row-existing' });
  });

  it('reuses an existing active trial row instead of creating a second one', async () => {
    mockPrisma.subscriptions.findFirst.mockResolvedValue({ id: 'row-existing' });

    const result = await ensureSingleActiveTrial(USER_ID);

    expect(result).toMatchObject({ created: false, reshaped: false });
    expect(mockPrisma.subscriptions.create).not.toHaveBeenCalled();
  });

  it('is idempotent across sequential calls — one row, not three', async () => {
    mockPrisma.subscriptions.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: 'row-new' });

    const a = await ensureSingleActiveTrial(USER_ID);
    const b = await ensureSingleActiveTrial(USER_ID);
    const c = await ensureSingleActiveTrial(USER_ID);

    expect([a.created, b.created, c.created]).toEqual([true, false, false]);
    expect(mockPrisma.subscriptions.create).toHaveBeenCalledTimes(1);
  });

  it('reshapes an existing active trial row when asked, without creating', async () => {
    mockPrisma.subscriptions.findFirst.mockResolvedValue({ id: 'row-existing' });

    const result = await ensureSingleActiveTrial(USER_ID, {
      reshapeExisting: true,
      billingCycle: 'monthly',
      endDate: null as any,
      amount: 0,
    });

    expect(result).toMatchObject({ created: false, reshaped: true });
    expect(mockPrisma.subscriptions.create).not.toHaveBeenCalled();
    expect(mockPrisma.subscriptions.update).toHaveBeenCalledWith({
      where: { id: 'row-existing' },
      data: {
        plan_type: 'trial',
        status: 'active',
        billing_cycle: 'monthly',
        amount: 0,
      },
    });
  });
});

describe('ensureSingleActiveTrial — match modes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.subscriptions.create.mockResolvedValue({ id: 'row-new' });
  });

  /**
   * `any_trial` preserves the signup path's historical semantics: an expired or canceled trial
   * row also suppresses creation there.
   */
  it('any_trial matches a trial row of any status', async () => {
    mockPrisma.subscriptions.findFirst.mockResolvedValue({ id: 'row-canceled' });

    const result = await ensureSingleActiveTrial(USER_ID, { match: 'any_trial' });

    expect(mockPrisma.subscriptions.findFirst).toHaveBeenCalledWith({
      where: { user_id: USER_ID, plan_type: 'trial' },
      orderBy: { created_at: 'desc' },
    });
    expect(result.created).toBe(false);
    expect(mockPrisma.subscriptions.create).not.toHaveBeenCalled();
  });

  /**
   * A canceled/expired trial does NOT satisfy the active-trial scope, so a fresh active trial
   * is created — historical rows are preserved, never resurrected.
   */
  it('active_trial ignores a canceled trial row and creates a new active one', async () => {
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null); // no ACTIVE trial matched

    const result = await ensureSingleActiveTrial(USER_ID, { match: 'active_trial' });

    expect(result.created).toBe(true);
    expect(mockPrisma.subscriptions.create).toHaveBeenCalledTimes(1);
  });

  /**
   * The lookup never matches a paid row, so a paid subscription can never be downgraded here,
   * and trial+paid coexistence (21 production users) is preserved.
   */
  it('never matches or mutates a paid row', async () => {
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);

    await ensureSingleActiveTrial(USER_ID, { match: 'active_trial', reshapeExisting: true });

    const where = mockPrisma.subscriptions.findFirst.mock.calls[0][0].where;
    expect(where.plan_type).toBe('trial');
    expect(mockPrisma.subscriptions.update).not.toHaveBeenCalled();
    expect(mockPrisma.subscriptions.create).toHaveBeenCalledTimes(1);
  });
});

describe('ensureSingleActiveTrial — unique-index race recovery (Step 8 readiness)', () => {
  const INDEX = 'subscriptions_one_active_trial_per_user';

  /**
   * Shapes below mirror what Prisma ACTUALLY produces, verified in Step 8B against
   * PostgreSQL 16 with the real partial indexes:
   *   active-trial index -> { modelName: 'subscriptions', target: ['user_id'] }
   *   stripe-id index    -> { modelName: 'subscriptions', target: ['stripe_sub_id'] }
   *   primary key        -> { modelName: 'subscriptions', target: ['id'] }
   */
  function p2002(target: unknown, modelName: string | undefined = 'subscriptions') {
    const e: any = new Error('Unique constraint failed');
    e.code = 'P2002';
    e.meta = modelName === undefined ? { target } : { modelName, target };
    return e;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Losing the race to a concurrent caller returns THAT caller's committed row. No second row
   * is created and no error reaches the user.
   */
  /**
   * WAS (Step 8): this asserted a match on `target: ['subscriptions_one_active_trial_per_user']`,
   * i.e. the index NAME. That shape does not occur — Step 8B proved empirically that Prisma
   * reports the column list instead, so the Step 8 predicate would never have fired and the
   * race would have surfaced as a 500.
   * NOW: the real shape, `{ modelName: 'subscriptions', target: ['user_id'] }`.
   */
  it('re-queries and returns the committed winner when the active-trial index rejects the insert', async () => {
    mockPrisma.subscriptions.findFirst
      .mockResolvedValueOnce(null) // initial lookup: no active trial yet
      .mockResolvedValueOnce({ id: 'winner-row', plan_type: 'trial', status: 'active' });
    mockPrisma.subscriptions.create.mockRejectedValue(p2002(['user_id']));

    const result = await ensureSingleActiveTrial(USER_ID);

    expect(result).toMatchObject({
      subscription: { id: 'winner-row' },
      created: false,
      raceRecovered: true,
    });
    expect(mockPrisma.subscriptions.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.subscriptions.findFirst).toHaveBeenLastCalledWith({
      where: { user_id: USER_ID, plan_type: 'trial', status: 'active' },
      orderBy: { created_at: 'desc' },
    });
  });

  /** Forward compatibility: still recognised if a future Prisma reports the index name. */
  it('also recognises the index name, should a future Prisma report it', async () => {
    mockPrisma.subscriptions.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'winner-row' });
    mockPrisma.subscriptions.create.mockRejectedValue(p2002(INDEX));

    const result = await ensureSingleActiveTrial(USER_ID);

    expect(result.raceRecovered).toBe(true);
  });

  /**
   * The narrowness requirement, using the REAL competing shapes. `['stripe_sub_id']` and
   * `['id']` are what the Stripe index and the primary key actually produce.
   */
  it('rethrows a P2002 from the stripe_sub_id unique index', async () => {
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);
    mockPrisma.subscriptions.create.mockRejectedValue(p2002(['stripe_sub_id']));

    await expect(ensureSingleActiveTrial(USER_ID)).rejects.toMatchObject({ code: 'P2002' });
  });

  it('rethrows a P2002 from the primary key', async () => {
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);
    mockPrisma.subscriptions.create.mockRejectedValue(p2002(['id']));

    await expect(ensureSingleActiveTrial(USER_ID)).rejects.toMatchObject({ code: 'P2002' });
  });

  /**
   * Guards the assumption the predicate rests on: `['user_id']` identifies the active-trial
   * index only while no OTHER model reports that column. A P2002 from a different model is
   * never this race.
   */
  it('rethrows a user_id P2002 raised by a different model', async () => {
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);
    mockPrisma.subscriptions.create.mockRejectedValue(p2002(['user_id'], 'point_transactions'));

    await expect(ensureSingleActiveTrial(USER_ID)).rejects.toMatchObject({ code: 'P2002' });
  });

  /** A composite target is not the single-column active-trial index. */
  it('rethrows a P2002 whose target is a composite key including user_id', async () => {
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);
    mockPrisma.subscriptions.create.mockRejectedValue(p2002(['user_id', 'source_item_id']));

    await expect(ensureSingleActiveTrial(USER_ID)).rejects.toMatchObject({ code: 'P2002' });
  });

  it('rethrows a P2002 whose target Prisma could not resolve', async () => {
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);
    mockPrisma.subscriptions.create.mockRejectedValue(p2002(undefined));

    await expect(ensureSingleActiveTrial(USER_ID)).rejects.toMatchObject({ code: 'P2002' });
  });

  it('rethrows an unrelated database error untouched', async () => {
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);
    mockPrisma.subscriptions.create.mockRejectedValue(new Error('connection reset'));

    await expect(ensureSingleActiveTrial(USER_ID)).rejects.toThrow('connection reset');
  });

  /**
   * If we lost the race but cannot find a winner, our model of the constraint is wrong.
   * Surface the original error rather than inventing a result.
   */
  it('rethrows when the race is lost but no winner can be found', async () => {
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);
    mockPrisma.subscriptions.create.mockRejectedValue(p2002(['user_id']));

    await expect(ensureSingleActiveTrial(USER_ID)).rejects.toMatchObject({ code: 'P2002' });
  });

  it('never converts a paid row during race recovery', async () => {
    mockPrisma.subscriptions.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'winner-row', plan_type: 'trial', status: 'active' });
    mockPrisma.subscriptions.create.mockRejectedValue(p2002(['user_id']));

    await ensureSingleActiveTrial(USER_ID);

    expect(mockPrisma.subscriptions.update).not.toHaveBeenCalled();
  });
});

describe('ensureSingleActiveTrial — transaction client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes every operation through a supplied transaction client', async () => {
    const tx = buildTxClient();

    await ensureSingleActiveTrial(USER_ID, {}, tx as any);

    expect(tx.subscriptions.findFirst).toHaveBeenCalledTimes(1);
    expect(tx.subscriptions.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.subscriptions.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.subscriptions.create).not.toHaveBeenCalled();
  });
});

describe('provisionDiscoverTrial - canonical Discover provisioning', () => {
  const START = new Date('2026-01-01T00:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.founding_members.findUnique.mockResolvedValue(null);
    mockPrisma.profiles.update.mockResolvedValue({});
    mockPrisma.subscriptions.create.mockResolvedValue({ id: 'row-new' });
    mockPrisma.subscriptions.update.mockResolvedValue({ id: 'row-existing' });
  });

  it('creates a 7-day trial for a non-founding Discover user', async () => {
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);

    const result = await provisionDiscoverTrial(
      USER_ID,
      'person@example.com',
      { startDate: START }
    );

    const data = mockPrisma.subscriptions.create.mock.calls[0][0].data;
    expect(result).toMatchObject({ created: true, foundingMember: false, trialDays: 7 });
    expect(data.start_date).toEqual(START);
    expect(data.end_date.getTime() - data.start_date.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('normalizes email and creates a 30-day trial when that email is in founding_members', async () => {
    mockPrisma.founding_members.findUnique.mockResolvedValue({ id: 'founder-1' });
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);

    const result = await provisionDiscoverTrial(
      USER_ID,
      '  Founder@Example.COM ',
      { startDate: START }
    );

    expect(mockPrisma.founding_members.findUnique).toHaveBeenCalledWith({
      where: { email: 'founder@example.com' },
      select: { id: true },
    });
    const data = mockPrisma.subscriptions.create.mock.calls[0][0].data;
    expect(result).toMatchObject({ created: true, foundingMember: true, trialDays: 30 });
    expect(data.end_date.getTime() - data.start_date.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('preserves an existing trial end_date and does not replenish minutes on repeat provisioning', async () => {
    const existingEndDate = new Date('2026-02-01T00:00:00.000Z');
    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      id: 'row-existing',
      plan_type: 'trial',
      status: 'active',
      end_date: existingEndDate,
    });

    const result = await provisionDiscoverTrial(
      USER_ID,
      'person@example.com',
      { startDate: START }
    );

    expect(result).toMatchObject({ created: false, reshaped: false });
    expect(mockPrisma.subscriptions.update).not.toHaveBeenCalled();
    expect(mockPrisma.subscriptions.create).not.toHaveBeenCalled();
    expect(mockPrisma.profiles.update).not.toHaveBeenCalled();
    expect(result.subscription.end_date).toBe(existingEndDate);
  });

  it('grants trial minutes only for the one newly created row across sequential retries', async () => {
    mockPrisma.subscriptions.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: 'row-new', plan_type: 'trial', status: 'active' });

    await provisionDiscoverTrial(USER_ID, 'person@example.com', { startDate: START });
    await provisionDiscoverTrial(USER_ID, 'person@example.com', { startDate: START });

    expect(mockPrisma.subscriptions.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.profiles.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.profiles.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { credits: 30, credits_seconds: 1800 },
    });

  });
});

// Scope this file as a module so its top-level mock declarations do not collide with
// the script-scoped globals in `billing.webhook.test.ts` under `tsc --noEmit`.
export {};
