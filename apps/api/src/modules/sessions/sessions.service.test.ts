const mockPrisma = {
  profiles: {
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
  subscriptions: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  app_sessions: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  session_messages: {
    createMany: jest.fn(),
  },
  users: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
  $executeRaw: jest.fn().mockResolvedValue(1),
};

const mockEmailService = {
  sendEmail: jest.fn(),
};

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock("../system-achievements/system-achievements.triggers", () => ({
  onUserActivity: jest.fn().mockResolvedValue(null),
}));

jest.mock('../email/email.service', () => ({
  emailService: mockEmailService,
}));

import { createSession, endSession, heartbeatSession, beginScheduledSession } from './sessions.service';

describe('sessions.service createSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // `clearMocks` clears calls but not implementations, and the session gate now resolves
    // membership via `getSubscription` -> `subscriptions.findFirst`. Without this reset, one
    // test's subscription row would persist into every later test in the file.
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);
  });

  it('rejects when user profile is missing', async () => {
    mockPrisma.profiles.findUnique.mockResolvedValue(null);

    await expect(
      createSession('user-1', { type: 'instant', duration_minutes: 5 })
    ).rejects.toMatchObject({
      message: 'User profile not found. Please complete onboarding first.',
      statusCode: 400,
    });
  });

  it('rejects when trial subscription is expired', async () => {
    // Distinct user id: the session gate now resolves membership through
    // `billing.getSubscription()`, which memoizes per user for 30s. Reusing 'user-1' would leak
    // this expired trial into the later 'user-1' cases in this file.
    const userId = 'user-expired-trial';
    mockPrisma.profiles.findUnique.mockResolvedValue({
      id: userId,
      credits: 20,
      purchased_credits: 0,
      credits_seconds: 1200,
      purchased_credits_seconds: 0,
    });
    // `getSubscription` reads the newest non-incomplete row via findFirst.
    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      plan_type: 'trial',
      status: 'active',
      end_date: new Date(Date.now() - 60_000),
    });

    await expect(
      createSession(userId, { type: 'instant', duration_minutes: 5 })
    ).rejects.toMatchObject({
      message: 'Your trial has expired. Please upgrade to continue.',
      statusCode: 400,
    });
  });

  it('rejects when credits are insufficient for requested duration', async () => {
    mockPrisma.profiles.findUnique.mockResolvedValue({
      id: 'user-1',
      credits: 1,
      purchased_credits: 0,
      credits_seconds: 60,
      purchased_credits_seconds: 0,
    });
    mockPrisma.subscriptions.findMany.mockResolvedValue([]);

    await expect(
      createSession('user-1', { type: 'instant', duration_minutes: 5 })
    ).rejects.toMatchObject({
      message:
        'Insufficient credits. You requested 5 minutes for this session but only have 1 full minutes available (60s). Shorten the session or upgrade your plan.',
      statusCode: 400,
    });
  });

  it('allows session when minutes column is ahead of stale credits_seconds (healed balance)', async () => {
    mockPrisma.profiles.findUnique.mockResolvedValue({
      id: 'user-1',
      credits: 2008,
      purchased_credits: 0,
      // Stale seconds imply 2000 min; minutes column implies 2008 — should use max.
      credits_seconds: 2000 * 60,
      purchased_credits_seconds: 0,
    });
    mockPrisma.subscriptions.findMany.mockResolvedValue([]);
    mockPrisma.app_sessions.create.mockResolvedValue({
      id: 'session-1',
      type: 'instant',
      status: 'active',
    });

    await createSession('user-1', { type: 'instant', duration_minutes: 2000 });
    expect(mockPrisma.app_sessions.create).toHaveBeenCalled();
  });

  it('creates instant sessions with active status and start timestamp', async () => {
    mockPrisma.profiles.findUnique.mockResolvedValue({
      id: 'user-1',
      credits: 30,
      purchased_credits: 0,
      credits_seconds: 1800,
      purchased_credits_seconds: 0,
    });
    mockPrisma.subscriptions.findMany.mockResolvedValue([]);
    mockPrisma.app_sessions.create.mockResolvedValue({
      id: 'session-1',
      type: 'instant',
      status: 'active',
    });

    const result = await createSession('user-1', {
      type: 'instant',
      duration_minutes: 10,
      title: 'Quick check-in',
    });

    expect(result).toEqual({
      id: 'session-1',
      type: 'instant',
      status: 'active',
    });
    expect(mockPrisma.app_sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user_id: 'user-1',
          status: 'active',
          started_at: expect.any(Date),
          duration_minutes: 10,
        }),
      })
    );
  });
});

describe('sessions.service beginScheduledSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // `clearMocks` clears calls but not implementations, and the session gate now resolves
    // membership via `getSubscription` -> `subscriptions.findFirst`. Without this reset, one
    // test's subscription row would persist into every later test in the file.
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);
  });

  it('activates scheduled row and stamps started_at', async () => {
    mockPrisma.app_sessions.findFirst.mockResolvedValue({
      id: 'sched-1',
      user_id: 'user-1',
      status: 'scheduled',
      duration_minutes: 30,
      scheduled_at: new Date(Date.now() + 60_000),
    });
    mockPrisma.profiles.findUnique.mockResolvedValue({
      id: 'user-1',
      credits: 60,
      purchased_credits: 0,
      credits_seconds: 3600,
      purchased_credits_seconds: 0,
    });
    mockPrisma.subscriptions.findMany.mockResolvedValue([]);
    mockPrisma.app_sessions.update.mockResolvedValue({
      id: 'sched-1',
      status: 'active',
      duration_minutes: 15,
    });

    await beginScheduledSession('user-1', 'sched-1', { duration_minutes: 15 });

    expect(mockPrisma.app_sessions.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sched-1' },
        data: expect.objectContaining({
          status: 'active',
          started_at: expect.any(Date),
          duration_minutes: 15,
        }),
      })
    );
  });

  it('rejects non-scheduled sessions', async () => {
    mockPrisma.app_sessions.findFirst.mockResolvedValue({
      id: 's1',
      user_id: 'user-1',
      status: 'completed',
      duration_minutes: 30,
    });

    await expect(beginScheduledSession('user-1', 's1', {})).rejects.toThrow(
      'Only scheduled sessions can be started'
    );
  });
});


/**
 * In-memory stand-in for one app_sessions row and the billing writes made against it.
 *
 * `$transaction` runs callbacks one at a time (modelling the `SELECT … FOR UPDATE` row lock that
 * serializes them in Postgres) and only commits a callback's writes if it resolves (modelling
 * rollback). This checks the service's lock/idempotency logic; it does not prove Postgres locking.
 */
function createSessionStore(
  row: Record<string, unknown>,
  opts: { failDeduct?: number; failTranscript?: number; transientFailures?: number } = {}
) {
  const committed = {
    session: { ...row } as Record<string, unknown>,
    messages: [] as Array<Record<string, unknown>>,
    deductions: [] as number[],
  };
  let failDeduct = opts.failDeduct ?? 0;
  let failTranscript = opts.failTranscript ?? 0;
  let transientFailures = opts.transientFailures ?? 0;
  let lock: Promise<unknown> = Promise.resolve();

  const transaction = (fn: (tx: unknown) => Promise<unknown>) => {
    const run = lock.then(async () => {
      if (transientFailures > 0) {
        transientFailures -= 1;
        throw Object.assign(new Error('write conflict'), { code: 'P2034' });
      }
      const working = {
        session: { ...committed.session },
        messages: [...committed.messages],
        deductions: [...committed.deductions],
      };
      const tx = {
        $queryRaw: jest.fn(async () => [{ ...working.session }]),
        $executeRaw: jest.fn(async (sql: { values: unknown[] }) => {
          if (failDeduct > 0) {
            failDeduct -= 1;
            throw new Error('deduct failed');
          }
          working.deductions.push(sql.values[1] as number);
          return 1;
        }),
        app_sessions: {
          update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
            Object.assign(working.session, data);
            return { ...working.session };
          }),
          findUniqueOrThrow: jest.fn(async () => ({ ...working.session })),
        },
        session_messages: {
          createMany: jest.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
            if (failTranscript > 0) {
              failTranscript -= 1;
              throw new Error('transcript failed');
            }
            working.messages.push(...data);
            return { count: data.length };
          }),
        },
      };
      const result = await fn(tx);
      committed.session = working.session;
      committed.messages = working.messages;
      committed.deductions = working.deductions;
      return result;
    });
    lock = run.catch(() => undefined);
    return run;
  };

  mockPrisma.app_sessions.findFirst.mockImplementation(async () => ({ ...committed.session }));
  mockPrisma.$transaction.mockImplementation(transaction);

  return {
    committed,
    totalDeducted: () => committed.deductions.reduce((sum, s) => sum + s, 0),
  };
}

const activeSession = (overrides: Record<string, unknown> = {}) => ({
  id: 's1',
  user_id: 'user-1',
  status: 'active',
  started_at: new Date(Date.now() - 30 * 60_000),
  ended_at: null,
  duration_minutes: 10,
  billed_seconds: 0,
  ...overrides,
});

const transcriptLines = [
  { role: 'user', content: 'hello', timestamp: Date.parse('2024-06-01T12:00:00.000Z') },
  { role: 'assistant', content: 'hi there' },
];

describe('sessions.service endSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // `clearMocks` clears calls but not implementations, and the session gate now resolves
    // membership via `getSubscription` -> `subscriptions.findFirst`. Without this reset, one
    // test's subscription row would persist into every later test in the file.
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);
  });

  it('throws when session is not found', async () => {
    mockPrisma.app_sessions.findFirst.mockResolvedValue(null);

    await expect(endSession('user-1', 'missing')).rejects.toThrow('Session not found');
  });

  it('deducts only the delta between reported duration and already-billed seconds', async () => {
    const store = createSessionStore(activeSession({ billed_seconds: 60 }));

    await endSession('user-1', 's1', 120);

    expect(store.committed.deductions).toEqual([60]);
    expect(store.committed.session).toMatchObject({ status: 'completed', billed_seconds: 120 });
  });

  it('persists transcript lines when provided', async () => {
    const store = createSessionStore(activeSession());

    await endSession('user-1', 's1', 30, undefined, transcriptLines);

    expect(store.committed.messages).toEqual([
      expect.objectContaining({
        session_id: 's1',
        role: 'user',
        content: 'hello',
        created_at: new Date('2024-06-01T12:00:00.000Z'),
      }),
      expect.objectContaining({ session_id: 's1', role: 'assistant', content: 'hi there' }),
    ]);
  });

  it('bills actual usage for a session ended before its selected length', async () => {
    const store = createSessionStore(activeSession({ duration_minutes: 10 }));

    await endSession('user-1', 's1', 125);

    expect(store.totalDeducted()).toBe(125);
    expect(store.committed.session).toMatchObject({ billed_seconds: 125, duration_minutes: 2 });
  });

  it('never bills past the selected session length', async () => {
    const store = createSessionStore(activeSession({ duration_minutes: 10, billed_seconds: 590 }));

    await endSession('user-1', 's1', 900);

    expect(store.totalDeducted()).toBe(10);
    expect(store.committed.session).toMatchObject({ billed_seconds: 600, duration_minutes: 10 });
  });

  it('caps the server wall-clock fallback at the selected length', async () => {
    const store = createSessionStore(
      activeSession({ duration_minutes: 5, started_at: new Date(Date.now() - 60 * 60_000) })
    );

    await endSession('user-1', 's1', 0);

    expect(store.totalDeducted()).toBe(300);
  });

  it('does not cap sessions without a selected length', async () => {
    const store = createSessionStore(activeSession({ duration_minutes: null }));

    await endSession('user-1', 's1', 900);

    expect(store.totalDeducted()).toBe(900);
  });

  it('is a no-op when the session is ended again', async () => {
    const store = createSessionStore(activeSession());

    await endSession('user-1', 's1', 120, undefined, transcriptLines);
    const again = await endSession('user-1', 's1', 300, undefined, transcriptLines);

    expect(store.totalDeducted()).toBe(120);
    expect(store.committed.messages).toHaveLength(2);
    expect(again).toMatchObject({ status: 'completed', billed_seconds: 120 });
  });

  it('finalizes once when two end requests arrive together', async () => {
    const store = createSessionStore(activeSession());

    await Promise.all([
      endSession('user-1', 's1', 120, undefined, transcriptLines),
      endSession('user-1', 's1', 121, undefined, transcriptLines),
    ]);

    expect(store.committed.deductions).toHaveLength(1);
    expect(store.committed.messages).toHaveLength(2);
  });

  it('commits nothing when deduction fails, so a retry can finalize once', async () => {
    const store = createSessionStore(activeSession(), { failDeduct: 1 });

    await expect(endSession('user-1', 's1', 120, undefined, transcriptLines)).rejects.toThrow(
      'deduct failed'
    );
    expect(store.committed.session.status).toBe('active');
    expect(store.committed.messages).toHaveLength(0);

    await endSession('user-1', 's1', 120, undefined, transcriptLines);
    expect(store.totalDeducted()).toBe(120);
    expect(store.committed.messages).toHaveLength(2);
  });

  it('commits nothing when transcript persistence fails', async () => {
    const store = createSessionStore(activeSession(), { failTranscript: 1 });

    await expect(endSession('user-1', 's1', 120, undefined, transcriptLines)).rejects.toThrow(
      'transcript failed'
    );
    expect(store.committed.deductions).toHaveLength(0);
    expect(store.committed.session.status).toBe('active');
  });

  it('retries a transient transaction conflict', async () => {
    const store = createSessionStore(activeSession(), { transientFailures: 1 });

    await endSession('user-1', 's1', 120);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
    expect(store.totalDeducted()).toBe(120);
  });
});

describe('sessions.service heartbeatSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // `clearMocks` clears calls but not implementations, and the session gate now resolves
    // membership via `getSubscription` -> `subscriptions.findFirst`. Without this reset, one
    // test's subscription row would persist into every later test in the file.
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);
  });

  it('returns zero delta for negative elapsed', async () => {
    await expect(heartbeatSession('user-1', 's1', -5)).resolves.toEqual({
      ok: true,
      billed_delta_seconds: 0,
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('bills incremental seconds inside a transaction', async () => {
    const store = createSessionStore(activeSession({ billed_seconds: 30 }));

    const result = await heartbeatSession('user-1', 's1', 120);

    expect(result).toEqual({ ok: true, billed_delta_seconds: 90 });
    expect(store.committed.deductions).toEqual([90]);
    expect(store.committed.session.billed_seconds).toBe(120);
  });

  it('returns no further billing when session already completed', async () => {
    const store = createSessionStore(
      activeSession({ status: 'completed', ended_at: new Date(), billed_seconds: 100 })
    );

    await expect(heartbeatSession('user-1', 's1', 200)).resolves.toEqual({
      ok: true,
      billed_delta_seconds: 0,
    });
    expect(store.committed.deductions).toHaveLength(0);
  });

  it('stops billing at the selected session length', async () => {
    const store = createSessionStore(activeSession({ duration_minutes: 10, billed_seconds: 590 }));

    await expect(heartbeatSession('user-1', 's1', 700)).resolves.toEqual({
      ok: true,
      billed_delta_seconds: 10,
    });
    await heartbeatSession('user-1', 's1', 715);

    expect(store.totalDeducted()).toBe(10);
  });

  it('bills overlapping heartbeats for the same time once', async () => {
    const store = createSessionStore(activeSession());

    await Promise.all([
      heartbeatSession('user-1', 's1', 120),
      heartbeatSession('user-1', 's1', 120),
    ]);

    expect(store.totalDeducted()).toBe(120);
  });

  it.each([
    ['heartbeat first', true],
    ['end first', false],
  ])('does not double-charge when heartbeat races end (%s)', async (_label, heartbeatFirst) => {
    const store = createSessionStore(activeSession());

    const heartbeat = () => heartbeatSession('user-1', 's1', 300);
    const end = () => endSession('user-1', 's1', 320);
    await Promise.all(heartbeatFirst ? [heartbeat(), end()] : [end(), heartbeat()]);

    expect(store.totalDeducted()).toBe(320);
    expect(store.committed.session).toMatchObject({ status: 'completed', billed_seconds: 320 });
  });
});
