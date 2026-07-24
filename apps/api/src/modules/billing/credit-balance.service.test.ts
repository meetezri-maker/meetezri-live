/**
 * Tests for the single shared subscription-allowance stacking helper.
 *
 * `addSubscriptionAllowanceMinutes` is the only stacking implementation for automated grant
 * paths after the Step 4 consolidation. These tests pin its current arithmetic exactly — they
 * document what the function does today, not a new contract.
 *
 * Reset/overwrite paths (admin plan override, trial credit assignment) deliberately do NOT go
 * through this helper and are not covered here.
 */

const mockPrisma = {
  profiles: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $queryRaw: jest.fn(),
};

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

import { addSubscriptionAllowanceMinutes } from './credit-balance.service';

/** Stand-in for a `Prisma.TransactionClient` handed to the helper by an interactive transaction. */
function buildTxClient() {
  return {
    profiles: {
      findUnique: jest.fn().mockResolvedValue({ credits: 0, credits_seconds: 0 }),
      update: jest.fn().mockResolvedValue({}),
    },
  };
}

const USER_ID = 'user-allowance-1';

describe('addSubscriptionAllowanceMinutes — default Prisma client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.profiles.update.mockResolvedValue({});
  });

  it('reads and writes through the Prisma singleton when no client is supplied', async () => {
    mockPrisma.profiles.findUnique.mockResolvedValue({ credits: 0, credits_seconds: 0 });

    await addSubscriptionAllowanceMinutes(USER_ID, 200);

    expect(mockPrisma.profiles.findUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
      select: { credits: true, credits_seconds: true },
    });
    expect(mockPrisma.profiles.update).toHaveBeenCalledTimes(1);
  });

  it('stacks minutes onto an existing balance and updates both columns', async () => {
    mockPrisma.profiles.findUnique.mockResolvedValue({ credits: 30, credits_seconds: 1800 });

    await addSubscriptionAllowanceMinutes(USER_ID, 200);

    expect(mockPrisma.profiles.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { credits: 230, credits_seconds: 13800 },
    });
  });

  it('never replaces the existing balance — two grants accumulate', async () => {
    mockPrisma.profiles.findUnique.mockResolvedValueOnce({ credits: 0, credits_seconds: 0 });
    await addSubscriptionAllowanceMinutes(USER_ID, 200);

    mockPrisma.profiles.findUnique.mockResolvedValueOnce({ credits: 200, credits_seconds: 12000 });
    await addSubscriptionAllowanceMinutes(USER_ID, 400);

    expect(mockPrisma.profiles.update.mock.calls.map((c: any[]) => c[0].data)).toEqual([
      { credits: 200, credits_seconds: 12000 },
      { credits: 600, credits_seconds: 36000 },
    ]);
  });
});

describe('addSubscriptionAllowanceMinutes — explicit transaction client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.profiles.update.mockResolvedValue({});
  });

  it('routes every database operation through the supplied client', async () => {
    const tx = buildTxClient();
    tx.profiles.findUnique.mockResolvedValue({ credits: 30, credits_seconds: 1800 });

    await addSubscriptionAllowanceMinutes(USER_ID, 200, tx as any);

    expect(tx.profiles.findUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
      select: { credits: true, credits_seconds: true },
    });
    expect(tx.profiles.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { credits: 230, credits_seconds: 13800 },
    });
  });

  it('does not touch the Prisma singleton when a client is supplied', async () => {
    const tx = buildTxClient();
    tx.profiles.findUnique.mockResolvedValue({ credits: 100, credits_seconds: 6000 });

    await addSubscriptionAllowanceMinutes(USER_ID, 400, tx as any);

    expect(mockPrisma.profiles.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.profiles.update).not.toHaveBeenCalled();
  });

  it('produces identical arithmetic through a transaction client and the singleton', async () => {
    const balance = { credits: 45, credits_seconds: 2730 };

    mockPrisma.profiles.findUnique.mockResolvedValue(balance);
    await addSubscriptionAllowanceMinutes(USER_ID, 200);

    const tx = buildTxClient();
    tx.profiles.findUnique.mockResolvedValue(balance);
    await addSubscriptionAllowanceMinutes(USER_ID, 200, tx as any);

    expect(tx.profiles.update.mock.calls[0][0]).toEqual(
      mockPrisma.profiles.update.mock.calls[0][0]
    );
  });
});

describe('addSubscriptionAllowanceMinutes — edge behaviour (documents current logic)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.profiles.update.mockResolvedValue({});
  });

  it('grants the full allowance from a zero balance', async () => {
    mockPrisma.profiles.findUnique.mockResolvedValue({ credits: 0, credits_seconds: 0 });

    await addSubscriptionAllowanceMinutes(USER_ID, 200);

    expect(mockPrisma.profiles.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { credits: 200, credits_seconds: 12000 },
    });
  });

  /**
   * `credits_seconds` is authoritative only when > 0; otherwise the minutes column is scaled up.
   * A stale/zero seconds column therefore does NOT discard the minutes the user still holds.
   */
  it('falls back to credits * 60 when credits_seconds is zero', async () => {
    mockPrisma.profiles.findUnique.mockResolvedValue({ credits: 10, credits_seconds: 0 });

    await addSubscriptionAllowanceMinutes(USER_ID, 200);

    expect(mockPrisma.profiles.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { credits: 210, credits_seconds: 12600 },
    });
  });

  it('falls back to credits * 60 when credits_seconds is null', async () => {
    mockPrisma.profiles.findUnique.mockResolvedValue({ credits: 10, credits_seconds: null });

    await addSubscriptionAllowanceMinutes(USER_ID, 200);

    expect(mockPrisma.profiles.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { credits: 210, credits_seconds: 12600 },
    });
  });

  /**
   * Sub-minute remainders are preserved in `credits_seconds` and the minutes column is rounded
   * UP (`Math.ceil`), so a partially-consumed minute is never silently lost.
   * 630s remaining + 200 min = 12630s, and ceil(12630 / 60) = 211 — not 210.
   */
  it('preserves sub-minute remainders and rounds the minutes column up', async () => {
    mockPrisma.profiles.findUnique.mockResolvedValue({ credits: 11, credits_seconds: 630 });

    await addSubscriptionAllowanceMinutes(USER_ID, 200);

    expect(mockPrisma.profiles.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { credits: 211, credits_seconds: 12630 },
    });
  });

  it('is a no-op for zero minutes — no read, no write', async () => {
    await addSubscriptionAllowanceMinutes(USER_ID, 0);

    expect(mockPrisma.profiles.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.profiles.update).not.toHaveBeenCalled();
  });

  it('is a no-op for negative minutes — never deducts', async () => {
    await addSubscriptionAllowanceMinutes(USER_ID, -50);

    expect(mockPrisma.profiles.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.profiles.update).not.toHaveBeenCalled();
  });

  it('is a no-op for zero minutes even when a transaction client is supplied', async () => {
    const tx = buildTxClient();

    await addSubscriptionAllowanceMinutes(USER_ID, 0, tx as any);

    expect(tx.profiles.findUnique).not.toHaveBeenCalled();
    expect(tx.profiles.update).not.toHaveBeenCalled();
  });

  /**
   * Current behaviour: a missing profile is treated as a zero balance and the update is STILL
   * attempted, so the error surfaces from Prisma (P2025) rather than from a guard here. There
   * is no early return for this case today.
   */
  it('treats a missing profile as a zero balance and still attempts the update', async () => {
    mockPrisma.profiles.findUnique.mockResolvedValue(null);

    await addSubscriptionAllowanceMinutes(USER_ID, 200);

    expect(mockPrisma.profiles.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { credits: 200, credits_seconds: 12000 },
    });
  });

  /**
   * The ONLY state in which this helper diverges from the inline stacking blocks it replaced
   * in Steps 4 and 4b.
   *
   * Those blocks wrote `credits: existingMinutes + planCredits`. The helper writes
   * `ceil(newSeconds / 60)`, which equals `ceil(existingSeconds / 60) + planCredits`. The two
   * agree iff `credits === ceil(credits_seconds / 60)` — the repository invariant that
   * `deductCreditsSeconds` (`sessions.service.ts:128`) and every grant path maintain, and
   * which all nine users in the Phase 1 preflight satisfy.
   *
   * `credits_seconds` is byte-identical either way; only the derived minutes column differs.
   *
   * Fixture below deliberately VIOLATES the invariant (200 minutes claimed, 100 minutes of
   * seconds) to pin what the helper does there: it trusts `credits_seconds`, so it yields 300.
   * The old inline blocks would have yielded 400 — i.e. they trusted the inflated minutes
   * column. No live writer can produce this state; the test exists so the divergence is
   * recorded rather than assumed away.
   */
  it('trusts credits_seconds over a contradictory credits column (documents the only divergence from the removed inline blocks)', async () => {
    mockPrisma.profiles.findUnique.mockResolvedValue({ credits: 200, credits_seconds: 6000 });

    await addSubscriptionAllowanceMinutes(USER_ID, 200);

    expect(mockPrisma.profiles.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      // ceil(6000/60) + 200 = 300, NOT 200 + 200 = 400.
      data: { credits: 300, credits_seconds: 18000 },
    });
  });

  /**
   * The complementary case, and the one that actually occurs: whenever the invariant holds,
   * the helper and the removed inline blocks agree exactly. 11 minutes / 630 seconds is a
   * normal post-session balance (ceil(630/60) === 11).
   */
  it('matches the removed inline arithmetic exactly whenever the invariant holds', async () => {
    const credits = 11;
    const creditsSeconds = 630;
    const planCredits = 400;
    expect(Math.ceil(creditsSeconds / 60)).toBe(credits); // invariant precondition

    mockPrisma.profiles.findUnique.mockResolvedValue({ credits, credits_seconds: creditsSeconds });

    await addSubscriptionAllowanceMinutes(USER_ID, planCredits);

    expect(mockPrisma.profiles.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: {
        // What the old inline block computed: existingMinutes + planCredits.
        credits: credits + planCredits,
        credits_seconds: creditsSeconds + planCredits * 60,
      },
    });
  });

  it('propagates a write failure to the caller', async () => {
    mockPrisma.profiles.findUnique.mockResolvedValue({ credits: 0, credits_seconds: 0 });
    mockPrisma.profiles.update.mockRejectedValue(new Error('db down'));

    await expect(addSubscriptionAllowanceMinutes(USER_ID, 200)).rejects.toThrow('db down');
  });
});
