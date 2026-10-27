/**
 * GET /users/export handler: always exports the authenticated caller, never an id from the
 * request, and no longer goes through getProfile (which can sync Stripe and write).
 */

export {};

const mockBuild = jest.fn();
const mockUserService = { getProfile: jest.fn() };

jest.mock('./account-data-export', () => ({ buildAccountDataExport: mockBuild }));
jest.mock('./user.service', () => mockUserService);
jest.mock('../billing', () => ({}));
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { auth: { admin: {} } } }));
jest.mock('../email/email.service', () => ({ emailService: {} }));
jest.mock('../../lib/prisma', () => ({ __esModule: true, default: {} }));

function makeReply() {
  const reply: any = { headers: {} as Record<string, string> };
  reply.code = jest.fn(() => reply);
  reply.header = jest.fn((k: string, v: string) => {
    reply.headers[k] = v;
    return reply;
  });
  reply.send = jest.fn((body: unknown) => body);
  return reply;
}

const request = (sub: string): any => ({
  user: { sub, email: 'a@example.test' },
  params: { userId: 'user-b' },
  query: { userId: 'user-b' },
  body: { userId: 'user-b' },
  log: { info: jest.fn(), error: jest.fn() },
});

beforeEach(() => jest.clearAllMocks());

describe('exportUserDataHandler', () => {
  it("exports only the authenticated user's data, with a Solace-branded, filesystem-safe name", async () => {
    mockBuild.mockResolvedValue({ exportVersion: 1, generatedAt: '2026-10-27T09:30:00.000Z', profile: {} });
    const { exportUserDataHandler } = await import('./user.controller');
    const reply = makeReply();

    await exportUserDataHandler(request('user-a'), reply);

    expect(mockBuild).toHaveBeenCalledWith('user-a');
    expect(mockBuild).not.toHaveBeenCalledWith('user-b');
    expect(mockUserService.getProfile).not.toHaveBeenCalled();
    expect(reply.headers['Content-Disposition']).toBe('attachment; filename="solace-account-data-2026-10-27.json"');
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ exportVersion: 1 }));
  });

  it('returns 404 when there is no profile and 500 on failure', async () => {
    const { exportUserDataHandler } = await import('./user.controller');

    mockBuild.mockResolvedValueOnce(null);
    const notFound = makeReply();
    await exportUserDataHandler(request('user-a'), notFound);
    expect(notFound.code).toHaveBeenCalledWith(404);

    mockBuild.mockRejectedValueOnce(new Error('db down'));
    const failed = makeReply();
    await exportUserDataHandler(request('user-a'), failed);
    expect(failed.code).toHaveBeenCalledWith(500);
    expect(failed.send).toHaveBeenCalledWith({ message: 'Failed to export user data' });
  });
});
