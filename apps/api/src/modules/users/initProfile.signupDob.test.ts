/**
 * POST /users/init and the signup date of birth.
 *
 *   - a new profile is created through createProfile, which carries the DOB itself
 *   - an existing profile with an empty `age` is filled once, from the server-resolved user
 *   - an existing numeric age or DOB is never overwritten, and repeat calls are no-ops
 *   - a supplied invalid DOB answers an explicit 400 with a code, not a generic 500
 */

export {};

const INVALID_CODE = 'INVALID_SIGNUP_DOB';

const mockUserService = {
  INVALID_SIGNUP_DOB_CODE: INVALID_CODE,
  isInvalidSignupDobError: (error: unknown) =>
    (error as { code?: unknown } | null)?.code === INVALID_CODE,
  getUserEmail: jest.fn(),
  getProfile: jest.fn(),
  getStoredSignupType: jest.fn(),
  getSignupTypeFromAuthMeta: jest.fn(),
  setSignupTypeForProfile: jest.fn(),
  invalidateUserProfileCache: jest.fn(),
  getProfileNameBackfillFromAuth: jest.fn(),
  updateProfile: jest.fn(),
  getFullNameFromAuthMeta: jest.fn(),
  createProfile: jest.fn(),
  getSignupDobFromAuthMeta: jest.fn(),
  fillEmptyProfileAge: jest.fn(),
};

jest.mock('./user.service', () => mockUserService);
jest.mock('../billing', () => ({}));
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { auth: { admin: {} } } }));
jest.mock('../email/email.service', () => ({ emailService: {} }));
jest.mock('../../lib/prisma', () => ({ __esModule: true, default: {} }));

const USER_ID = 'user-init-dob';

function invalidDobError() {
  return Object.assign(new Error('The date of birth entered at signup is not valid.'), {
    statusCode: 400,
    code: INVALID_CODE,
  });
}

function makeReply() {
  const reply: any = {};
  reply.code = jest.fn(() => reply);
  reply.send = jest.fn((body: unknown) => body);
  return reply;
}

async function callInit() {
  const { initProfileHandler } = await import('./user.controller');
  const reply = makeReply();
  const request: any = {
    user: { sub: USER_ID, email: 'jane@example.com' },
    body: {},
    log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  };
  const result = await initProfileHandler(request, reply);
  return { reply, result, request };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUserService.getStoredSignupType.mockResolvedValue('trial');
  mockUserService.getProfileNameBackfillFromAuth.mockResolvedValue(null);
});

describe('existing profile', () => {
  it('fills an empty age from the server-resolved user and returns the fresh profile', async () => {
    mockUserService.getProfile
      .mockResolvedValueOnce({ id: USER_ID, age: null })
      .mockResolvedValueOnce({ id: USER_ID, age: '1990-04-02' });
    mockUserService.getSignupDobFromAuthMeta.mockResolvedValue('1990-04-02');
    mockUserService.fillEmptyProfileAge.mockResolvedValue(true);

    const { result } = await callInit();

    expect(mockUserService.getSignupDobFromAuthMeta).toHaveBeenCalledWith(USER_ID);
    expect(mockUserService.fillEmptyProfileAge).toHaveBeenCalledWith(USER_ID, '1990-04-02');
    expect((result as any).age).toBe('1990-04-02');
  });

  it.each([['30'], ['1985-01-15']])('never touches a stored age (%s)', async (age) => {
    mockUserService.getProfile.mockResolvedValue({ id: USER_ID, age });

    const { result } = await callInit();

    expect(mockUserService.getSignupDobFromAuthMeta).not.toHaveBeenCalled();
    expect(mockUserService.fillEmptyProfileAge).not.toHaveBeenCalled();
    expect((result as any).age).toBe(age);
  });

  it('does nothing when there is no signup DOB (legacy / Google)', async () => {
    mockUserService.getProfile.mockResolvedValue({ id: USER_ID, age: '' });
    mockUserService.getSignupDobFromAuthMeta.mockResolvedValue(null);

    await callInit();

    expect(mockUserService.fillEmptyProfileAge).not.toHaveBeenCalled();
  });

  it('is idempotent when the conditional fill matches nothing', async () => {
    mockUserService.getProfile.mockResolvedValue({ id: USER_ID, age: null });
    mockUserService.getSignupDobFromAuthMeta.mockResolvedValue('1990-04-02');
    mockUserService.fillEmptyProfileAge.mockResolvedValue(false);

    await callInit();

    // No re-read when nothing was written.
    expect(mockUserService.getProfile).toHaveBeenCalledTimes(1);
  });

  it('answers an explicit 400 for an invalid supplied DOB', async () => {
    mockUserService.getProfile.mockResolvedValue({ id: USER_ID, age: null });
    mockUserService.getSignupDobFromAuthMeta.mockRejectedValue(invalidDobError());

    const { reply } = await callInit();

    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ code: INVALID_CODE }));
    expect(mockUserService.fillEmptyProfileAge).not.toHaveBeenCalled();
  });
});

describe('new profile', () => {
  it('creates through createProfile (which carries the DOB)', async () => {
    mockUserService.getProfile.mockResolvedValue(null);
    mockUserService.getFullNameFromAuthMeta.mockResolvedValue('Jane Roe');
    mockUserService.createProfile.mockResolvedValue({ id: USER_ID, age: '1990-04-02' });

    const { result } = await callInit();

    expect(mockUserService.createProfile).toHaveBeenCalled();
    expect((result as any).age).toBe('1990-04-02');
  });

  it('answers an explicit 400, not the generic 500, for an invalid supplied DOB', async () => {
    mockUserService.getProfile.mockResolvedValue(null);
    mockUserService.getFullNameFromAuthMeta.mockResolvedValue('Jane Roe');
    mockUserService.createProfile.mockRejectedValue(invalidDobError());

    const { reply } = await callInit();

    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply.code).not.toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ code: INVALID_CODE }));
  });

  it('keeps the generic 500 for other failures', async () => {
    mockUserService.getProfile.mockResolvedValue(null);
    mockUserService.getFullNameFromAuthMeta.mockResolvedValue('Jane Roe');
    mockUserService.createProfile.mockRejectedValue(new Error('db down'));

    const { reply } = await callInit();

    expect(reply.code).toHaveBeenCalledWith(500);
  });
});
