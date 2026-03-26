import Fastify from 'fastify';

const mockPrisma = {
  profiles: {
    findUnique: jest.fn(),
  },
  users: {
    findUnique: jest.fn(),
  },
};

jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

describe('auth plugin authorize middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('denies access when appRole is missing', async () => {
    const authPlugin = (await import('./auth')).default;
    const app = Fastify();

    app.decorate('jwtVerify', async () => true);
    await app.register(authPlugin);

    app.get('/admin', {
      preHandler: [app.authorize(['super_admin'])],
      handler: async () => ({ ok: true }),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/admin',
      headers: {
        authorization: 'Bearer fake-token',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual(
      expect.objectContaining({
        message: 'Access denied: No role assigned',
      })
    );

    await app.close();
  });

  it('allows access when appRole is in allowedRoles', async () => {
    const authPlugin = (await import('./auth')).default;
    const app = Fastify();

    app.decorate('jwtVerify', async () => true);
    await app.register(authPlugin);

    app.get('/admin', {
      preHandler: [
        async (request) => {
          (request as any).user = { appRole: 'super_admin' };
        },
        app.authorize(['super_admin']),
      ],
      handler: async () => ({ ok: true }),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/admin',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });

    await app.close();
  });
});
