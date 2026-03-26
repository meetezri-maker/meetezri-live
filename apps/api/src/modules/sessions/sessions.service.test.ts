const mockPrisma = {
  profiles: {
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
  subscriptions: {
    findFirst: jest.fn(),
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
};

const mockEmailService = {
  sendEmail: jest.fn(),
};

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../email/email.service', () => ({
  emailService: mockEmailService,
}));

import { createSession, endSession, heartbeatSession } from './sessions.service';

describe('sessions.service createSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects when user profile is missing', async () => {
    mockPrisma.profiles.findUnique.mockResolvedValue(null);

    await expect(
      createSession('user-1', { type: 'instant', duration_minutes: 5 })
    ).rejects.toThrow('User profile not found. Please complete onboarding first.');
  });

  it('rejects when trial subscription is expired', async () => {
    mockPrisma.profiles.findUnique.mockResolvedValue({
      id: 'user-1',
      credits: 20,
      purchased_credits: 0,
      credits_seconds: 1200,
      purchased_credits_seconds: 0,
    });
    mockPrisma.subscriptions.findFirst.mockResolvedValue({
      plan_type: 'trial',
      end_date: new Date(Date.now() - 60_000),
    });

    await expect(
      createSession('user-1', { type: 'instant', duration_minutes: 5 })
    ).rejects.toThrow('Your trial has expired. Please upgrade to continue.');
  });

  it('rejects when credits are insufficient for requested duration', async () => {
    mockPrisma.profiles.findUnique.mockResolvedValue({
      id: 'user-1',
      credits: 1,
      purchased_credits: 0,
      credits_seconds: 60,
      purchased_credits_seconds: 0,
    });
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);

    await expect(
      createSession('user-1', { type: 'instant', duration_minutes: 5 })
    ).rejects.toThrow('Insufficient credits. You need 5 minutes but have 1. Please upgrade your plan.');
  });

  it('creates instant sessions with active status and start timestamp', async () => {
    mockPrisma.profiles.findUnique.mockResolvedValue({
      id: 'user-1',
      credits: 30,
      purchased_credits: 0,
      credits_seconds: 1800,
      purchased_credits_seconds: 0,
    });
    mockPrisma.subscriptions.findFirst.mockResolvedValue(null);
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

describe('sessions.service endSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws when session is not found', async () => {
    mockPrisma.app_sessions.findFirst.mockResolvedValue(null);

    await expect(endSession('user-1', 'missing')).rejects.toThrow('Session not found');
  });

  it('deducts only the delta between reported duration and already-billed seconds', async () => {
    mockPrisma.app_sessions.findFirst.mockResolvedValue({
      id: 's1',
      user_id: 'user-1',
      started_at: new Date('2020-01-01T00:00:00Z'),
      billed_seconds: 60,
    });
    mockPrisma.profiles.findUnique.mockResolvedValue({
      credits: 10,
      purchased_credits: 0,
      credits_seconds: 600,
      purchased_credits_seconds: 0,
    });
    mockPrisma.profiles.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.app_sessions.update.mockResolvedValue({ id: 's1', status: 'completed' });

    await endSession('user-1', 's1', 120);

    expect(mockPrisma.profiles.updateMany).toHaveBeenCalled();
    expect(mockPrisma.app_sessions.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's1' },
        data: expect.objectContaining({
          status: 'completed',
          billed_seconds: 120,
        }),
      })
    );
  });

  it('persists transcript lines when provided', async () => {
    mockPrisma.app_sessions.findFirst.mockResolvedValue({
      id: 's1',
      user_id: 'user-1',
      billed_seconds: 0,
    });
    mockPrisma.profiles.findUnique.mockResolvedValue({
      credits: 5,
      purchased_credits: 0,
      credits_seconds: 300,
      purchased_credits_seconds: 0,
    });
    mockPrisma.profiles.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.session_messages.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.app_sessions.update.mockResolvedValue({ id: 's1' });

    await endSession('user-1', 's1', 30, undefined, [
      { role: 'user', content: 'hello', timestamp: '2024-06-01T12:00:00.000Z' },
    ]);

    expect(mockPrisma.session_messages.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          session_id: 's1',
          role: 'user',
          content: 'hello',
          created_at: new Date('2024-06-01T12:00:00.000Z'),
        }),
      ],
    });
  });
});

describe('sessions.service heartbeatSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns zero delta for negative elapsed', async () => {
    await expect(heartbeatSession('user-1', 's1', -5)).resolves.toEqual({
      ok: true,
      billed_delta_seconds: 0,
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('bills incremental seconds inside a transaction', async () => {
    const txMock = {
      app_sessions: {
        findFirst: jest.fn().mockResolvedValue({
          id: 's1',
          status: 'active',
          ended_at: null,
          billed_seconds: 30,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      profiles: {
        findUnique: jest.fn().mockResolvedValue({
          credits: 10,
          purchased_credits: 0,
          credits_seconds: 600,
          purchased_credits_seconds: 0,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) =>
      fn(txMock)
    );

    const result = await heartbeatSession('user-1', 's1', 120);

    expect(result).toEqual({ ok: true, billed_delta_seconds: 90 });
    expect(txMock.profiles.updateMany).toHaveBeenCalled();
    expect(txMock.app_sessions.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { billed_seconds: 120 },
    });
  });

  it('returns no further billing when session already completed', async () => {
    const txMock = {
      app_sessions: {
        findFirst: jest.fn().mockResolvedValue({
          id: 's1',
          status: 'completed',
          ended_at: new Date(),
          billed_seconds: 100,
        }),
        update: jest.fn(),
      },
      profiles: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) =>
      fn(txMock)
    );

    await expect(heartbeatSession('user-1', 's1', 200)).resolves.toEqual({
      ok: true,
      billed_delta_seconds: 0,
    });
    expect(txMock.profiles.updateMany).not.toHaveBeenCalled();
  });
});
