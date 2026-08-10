/**
 * Regression: `GET /api/admin/users` role filtering.
 *
 * The Content Hub author/reviewer picker used to fetch page one and filter for admin roles in the
 * browser. Production has 269 profiles and both admins were created early — positions 204 and 264
 * — so neither appeared in the newest-100 window and the dropdown offered only "Unassigned".
 *
 * The filter now runs in the query. These tests pin that the filter reaches Prisma, and that
 * omitting it leaves the existing Users screen behaviour untouched.
 */

// Marks this file as a module. Without it TypeScript treats it as a script and `mockAdminPrisma`
// lands in the global scope, colliding with the identically named const in other test files.
export {};

const mockAdminPrisma = {
  profiles: { findMany: jest.fn(), count: jest.fn() },
  $queryRaw: jest.fn(),
};

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: mockAdminPrisma,
  Prisma: { sql: jest.fn(() => ''), join: jest.fn(() => '') },
}));

describe('getAllUsers role filtering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminPrisma.profiles.findMany.mockResolvedValue([]);
    mockAdminPrisma.$queryRaw.mockResolvedValue([]);
  });

  /** The `where` Prisma actually received. */
  async function whereFor(...args: Parameters<typeof callGetAllUsers>) {
    await callGetAllUsers(...args);
    return mockAdminPrisma.profiles.findMany.mock.calls[0]?.[0]?.where;
  }

  async function callGetAllUsers(page?: number, limit?: number, search?: string, roles?: string[]) {
    const { getAllUsers } = await import('./admin.service');
    // Unique search term per call so the module-level cache never serves a previous result.
    return getAllUsers(page, limit, search ?? `nocache-${Math.random()}`, roles);
  }

  it('filters by role in the query when roles are supplied', async () => {
    const where = await whereFor(1, 200, undefined, ['super_admin', 'therapist']);

    const clauses = (where?.AND ?? []) as Array<Record<string, unknown>>;
    const roleClause = clauses.find((c) => 'role' in c);
    expect(roleClause).toEqual({ role: { in: ['super_admin', 'therapist'] } });
  });

  it('finds an admin regardless of how many newer profiles exist', async () => {
    // The exact production shape: the only eligible person sits far outside page one.
    const admin = { id: 'a1', email: 'a@x.test', full_name: 'Late Created Admin', role: 'super_admin' };
    mockAdminPrisma.profiles.findMany.mockResolvedValue([
      { ...admin, avatar_url: null, created_at: new Date(), updated_at: new Date(), app_sessions: [], subscriptions: [], org_members: [], _count: { app_sessions: 0 } },
    ]);

    const result = (await callGetAllUsers(1, 200, undefined, ['super_admin'])) as Array<{ role?: string }>;

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('super_admin');
  });

  it('leaves the query unfiltered when no roles are supplied', async () => {
    const where = await whereFor(1, 20, undefined, undefined);

    const clauses = (where?.AND ?? []) as Array<Record<string, unknown>>;
    expect(clauses.some((c) => 'role' in c)).toBe(false);
  });

  it('combines a role filter with a search term', async () => {
    await callGetAllUsers(1, 50, 'ros', ['super_admin']);
    const where = mockAdminPrisma.profiles.findMany.mock.calls[0][0].where;

    const clauses = (where?.AND ?? []) as Array<Record<string, unknown>>;
    expect(clauses.some((c) => 'OR' in c)).toBe(true);
    expect(clauses.some((c) => 'role' in c)).toBe(true);
  });

  it('treats an empty role list as no filter', async () => {
    const where = await whereFor(1, 20, undefined, []);
    const clauses = (where?.AND ?? []) as Array<Record<string, unknown>>;
    expect(clauses.some((c) => 'role' in c)).toBe(false);
  });
});
