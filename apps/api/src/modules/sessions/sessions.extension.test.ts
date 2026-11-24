const mockExtendSession = jest.fn();

jest.mock('./sessions.service', () => ({
  ...jest.requireActual('./sessions.service'),
  extendSession: mockExtendSession,
}));

const mockFindFlag = jest.fn();
const mockFindSession = jest.fn();

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    feature_flags: { findUnique: (...args: unknown[]) => mockFindFlag(...args) },
    app_sessions: { findFirst: (...args: unknown[]) => mockFindSession(...args) },
  },
}));

import { extendSessionHandler, getSessionHandler } from './sessions.controller';
import { isSessionExtensionAllowedFor, isSessionExtensionEnabled } from './sessions.service';

const allowlist = (targetUsers: unknown, isEnabled = true) =>
  mockFindFlag.mockResolvedValue({ is_enabled: isEnabled, rules: { targetUsers } });

describe('isSessionExtensionAllowedFor', () => {
  const original = process.env.SESSION_EXTENSIONS_ENABLED;
  beforeEach(() => {
    mockFindFlag.mockReset();
    process.env.SESSION_EXTENSIONS_ENABLED = 'true';
  });
  afterEach(() => {
    if (original === undefined) delete process.env.SESSION_EXTENSIONS_ENABLED;
    else process.env.SESSION_EXTENSIONS_ENABLED = original;
  });

  it('allows only listed account ids', async () => {
    allowlist(['qa-account', 'other-qa']);
    await expect(isSessionExtensionAllowedFor('qa-account')).resolves.toBe(true);
    await expect(isSessionExtensionAllowedFor('QA-ACCOUNT')).resolves.toBe(true);
    await expect(isSessionExtensionAllowedFor('someone-else')).resolves.toBe(false);
  });

  it.each([
    ['no flag row', null],
    ['a disabled row', { is_enabled: false, rules: { targetUsers: ['qa-account'] } }],
    ['an empty list', { is_enabled: true, rules: { targetUsers: [] } }],
    ['no list', { is_enabled: true, rules: {} }],
    ['no rules', { is_enabled: true, rules: null }],
    ['a malformed list', { is_enabled: true, rules: { targetUsers: 'qa-account' } }],
  ])('allows nobody with %s', async (_label, row) => {
    mockFindFlag.mockResolvedValue(row);
    await expect(isSessionExtensionAllowedFor('qa-account')).resolves.toBe(false);
  });

  it('allows nobody when the global switch is off, without reading the list', async () => {
    delete process.env.SESSION_EXTENSIONS_ENABLED;
    allowlist(['qa-account']);
    await expect(isSessionExtensionAllowedFor('qa-account')).resolves.toBe(false);
    expect(mockFindFlag).not.toHaveBeenCalled();
  });

  it('allows nobody when the lookup fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockFindFlag.mockRejectedValue(new Error('db down'));
    await expect(isSessionExtensionAllowedFor('qa-account')).resolves.toBe(false);
    warn.mockRestore();
  });
});

describe('getSessionHandler eligibility', () => {
  const original = process.env.SESSION_EXTENSIONS_ENABLED;
  afterEach(() => {
    if (original === undefined) delete process.env.SESSION_EXTENSIONS_ENABLED;
    else process.env.SESSION_EXTENSIONS_ENABLED = original;
  });

  it.each([
    ['listed', ['user-1'], true],
    ['not listed', ['someone-else'], false],
  ])('reports %s accounts', async (_label, targetUsers, eligible) => {
    process.env.SESSION_EXTENSIONS_ENABLED = 'true';
    allowlist(targetUsers);
    mockFindSession.mockResolvedValue({ id: 's1', status: 'active' });
    const reply = replyStub();
    await getSessionHandler({ user: { sub: 'user-1' }, params: { id: 's1' } } as any, reply);
    expect(reply.payload).toMatchObject({ id: 's1', extension_eligible: eligible });
  });
});
import {
  resolveBucketActualSeconds,
  resolveProfileActualSeconds,
} from '../billing/credit-balance.service';

describe('resolveBucketActualSeconds', () => {
  it('uses the seconds column when the minutes column is only its rounded-up value', () => {
    expect(resolveBucketActualSeconds(5, 299)).toBe(299);
    expect(resolveBucketActualSeconds(5, 241)).toBe(241);
    expect(resolveBucketActualSeconds(5, 300)).toBe(300);
  });

  it('reads legacy minute-only rows from the minutes column', () => {
    expect(resolveBucketActualSeconds(5, 0)).toBe(300);
    expect(resolveBucketActualSeconds(5, null)).toBe(300);
  });

  it('keeps a minutes column at least a full minute ahead of stale seconds', () => {
    expect(resolveBucketActualSeconds(10, 299)).toBe(600);
  });

  it('treats an empty bucket as zero', () => {
    expect(resolveBucketActualSeconds(0, 0)).toBe(0);
    expect(resolveBucketActualSeconds(null, null)).toBe(0);
  });

  it('adds subscription and purchased buckets to the second', () => {
    expect(
      resolveProfileActualSeconds({
        credits: 4,
        credits_seconds: 199,
        purchased_credits: 2,
        purchased_credits_seconds: 100,
      })
    ).toBe(299);
  });
});

function replyStub() {
  const reply: any = { statusCode: 200, payload: undefined };
  reply.code = jest.fn((status: number) => {
    reply.statusCode = status;
    return reply;
  });
  reply.send = jest.fn((payload: unknown) => {
    reply.payload = payload;
    return reply;
  });
  return reply;
}

const request: any = {
  user: { sub: 'user-1' },
  params: { id: 's1' },
  body: {
    request_id: 'request-1',
    expected_limit_minutes: 20,
    add_minutes: 10,
    elapsed_seconds: 1200,
  },
};

describe('extendSessionHandler', () => {
  const original = process.env.SESSION_EXTENSIONS_ENABLED;

  afterEach(() => {
    if (original === undefined) delete process.env.SESSION_EXTENSIONS_ENABLED;
    else process.env.SESSION_EXTENSIONS_ENABLED = original;
  });

  it('is off unless explicitly enabled', async () => {
    delete process.env.SESSION_EXTENSIONS_ENABLED;
    expect(isSessionExtensionEnabled()).toBe(false);

    const reply = replyStub();
    await extendSessionHandler(request, reply);

    expect(reply.statusCode).toBe(404);
    expect(mockExtendSession).not.toHaveBeenCalled();
  });

  it('returns 404 and changes nothing for an account off the allowlist', async () => {
    process.env.SESSION_EXTENSIONS_ENABLED = 'true';
    allowlist(['someone-else']);

    const reply = replyStub();
    await extendSessionHandler(request, reply);

    expect(reply.statusCode).toBe(404);
    expect(mockExtendSession).not.toHaveBeenCalled();
  });

  it('returns 200 for an approval and 409 for a rejection', async () => {
    process.env.SESSION_EXTENSIONS_ENABLED = 'true';
    allowlist(['user-1']);

    mockExtendSession.mockResolvedValueOnce({ approved: true, limit_minutes: 30 });
    const approved = replyStub();
    await extendSessionHandler(request, approved);
    expect(approved.statusCode).toBe(200);

    mockExtendSession.mockResolvedValueOnce({ approved: false, code: 'INSUFFICIENT_BALANCE' });
    const rejected = replyStub();
    await extendSessionHandler(request, rejected);
    expect(rejected.statusCode).toBe(409);
    expect(rejected.payload).toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
  });

  it('returns 404 for a session the member does not own', async () => {
    process.env.SESSION_EXTENSIONS_ENABLED = 'true';
    allowlist(['user-1']);
    mockExtendSession.mockRejectedValueOnce(new Error('Session not found'));

    const reply = replyStub();
    await extendSessionHandler(request, reply);

    expect(reply.statusCode).toBe(404);
  });
});
