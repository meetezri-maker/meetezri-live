import Fastify from 'fastify';

const mockPrisma = {
  profiles: {
    findUnique: jest.fn(),
    updateMany: jest.fn(),
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

  it('refreshes cached roles for privileged routes after an admin promotion', async () => {
    const authPlugin = (await import('./auth')).default;
    const app = Fastify();

    app.decorateRequest('jwtVerify', async function () {
      (this as any).user = { sub: 'promoted-user' };
      return true;
    });

    mockPrisma.profiles.findUnique
      .mockResolvedValueOnce({
        role: 'user',
        permissions: {},
        full_name: 'Promoted User',
        selected_goals: [],
        emergency_contact_relationship: 'Friend',
        notification_preferences: {},
        timezone: 'UTC',
        signup_type: 'trial',
      })
      .mockResolvedValueOnce({
        role: 'super_admin',
        permissions: {},
        full_name: 'Promoted User',
        selected_goals: [],
        emergency_contact_relationship: 'Friend',
        notification_preferences: {},
        timezone: 'UTC',
        signup_type: 'trial',
      });

    mockPrisma.users.findUnique.mockResolvedValue(null);
    mockPrisma.profiles.updateMany.mockResolvedValue({ count: 0 });

    await app.register(authPlugin);

    app.get('/regular', {
      preHandler: [app.authenticate],
      handler: async () => ({ ok: true }),
    });

    app.get('/api/system-settings', {
      preHandler: [app.authenticate, app.authorize(['super_admin'])],
      handler: async () => ({ ok: true }),
    });

    const firstResponse = await app.inject({
      method: 'GET',
      url: '/regular',
      headers: {
        authorization: 'Bearer fake-token',
      },
    });

    expect(firstResponse.statusCode).toBe(200);

    const secondResponse = await app.inject({
      method: 'GET',
      url: '/api/system-settings',
      headers: {
        authorization: 'Bearer fake-token',
      },
    });

    expect(secondResponse.statusCode).toBe(200);
    expect(mockPrisma.profiles.findUnique).toHaveBeenCalledTimes(2);

    await app.close();
  });

  it('accepts legacy super role aliases on privileged routes', async () => {
    const authPlugin = (await import('./auth')).default;
    const app = Fastify();

    app.decorateRequest('jwtVerify', async function () {
      (this as any).user = { sub: 'legacy-super-user' };
      return true;
    });

    mockPrisma.profiles.findUnique.mockResolvedValue({
      role: 'super',
      permissions: {},
      full_name: 'Legacy Super',
      selected_goals: [],
      emergency_contact_relationship: 'Friend',
      notification_preferences: {},
      timezone: 'UTC',
      signup_type: 'trial',
    });

    await app.register(authPlugin);

    app.get('/api/system-settings', {
      preHandler: [app.authenticate, app.authorize(['super_admin'])],
      handler: async () => ({ ok: true }),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/system-settings',
      headers: {
        authorization: 'Bearer fake-token',
      },
    });

    expect(response.statusCode).toBe(200);

    await app.close();
  });
});
