/**
 * The transcript export (web) uses only GET /sessions/:id and GET /sessions/:id/transcript.
 * Pin that both are owner-scoped reads: no writes, no summary generation, no outbound calls.
 */

const writeSpy = jest.fn(() => {
  throw new Error('transcript export reads must not write');
});
const writes = { create: writeSpy, createMany: writeSpy, update: writeSpy, updateMany: writeSpy, upsert: writeSpy, delete: writeSpy, deleteMany: writeSpy };

const mockPrisma = {
  app_sessions: { findFirst: jest.fn(), ...writes },
  session_messages: { findMany: jest.fn(), ...writes },
  activity_events: { ...writes },
  $transaction: writeSpy,
  $executeRaw: writeSpy,
};

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../system-achievements/system-achievements.triggers', () => ({ onUserActivity: jest.fn() }));
jest.mock('../email/email.service', () => ({ emailService: { sendEmail: jest.fn() } }));

import { getSessionById, getSessionTranscript } from './sessions.service';

const fetchSpy = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (globalThis as { fetch?: unknown }).fetch = fetchSpy;
  mockPrisma.app_sessions.findFirst.mockResolvedValue({ id: 's1', user_id: 'user-a', config: { summary: 'Instant talk' } });
  mockPrisma.session_messages.findMany.mockResolvedValue([{ role: 'user', content: 'Hello' }]);
});

describe('transcript export reads', () => {
  it('GET /sessions/:id reads one row scoped to the owner', async () => {
    await getSessionById('user-a', 's1');
    expect(mockPrisma.app_sessions.findFirst).toHaveBeenCalledWith({ where: { id: 's1', user_id: 'user-a' } });
    expect(writeSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('GET /sessions/:id/transcript checks ownership, then reads messages in order, without writing or generating', async () => {
    const rows = await getSessionTranscript('user-a', 's1');
    expect(rows).toEqual([{ role: 'user', content: 'Hello' }]);
    expect(mockPrisma.app_sessions.findFirst).toHaveBeenCalledWith({ where: { id: 's1', user_id: 'user-a' } });
    expect(mockPrisma.session_messages.findMany).toHaveBeenCalledWith({
      where: { session_id: 's1' },
      orderBy: { created_at: 'asc' },
    });
    expect(writeSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled(); // no OpenAI summary request
  });

  it("refuses another user's session", async () => {
    mockPrisma.app_sessions.findFirst.mockResolvedValue(null);
    await expect(getSessionTranscript('user-b', 's1')).rejects.toThrow('Session not found');
    expect(mockPrisma.session_messages.findMany).not.toHaveBeenCalled();
  });
});
