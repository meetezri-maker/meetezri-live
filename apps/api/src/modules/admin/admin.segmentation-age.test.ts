/**
 * Segmentation age filters with ISO dates of birth.
 *
 * `profiles.age` holds a numeric age ("24") or an ISO DOB ("2000-04-15"). Numeric filtering must
 * stay exactly as it was; ISO DOBs must match the same bounds by completed years, still inside
 * the one DB query that also drives count and pagination.
 */

export {};

const mockAdminPrisma = {
  user_segments: { findUnique: jest.fn() },
  profiles: { findMany: jest.fn(), count: jest.fn() },
  $queryRaw: jest.fn(),
};

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: mockAdminPrisma,
  Prisma: { sql: jest.fn(() => ''), join: jest.fn(() => '') },
}));

/** 2026-10-26 at local noon. */
const TODAY = new Date(2026, 9, 26, 12, 0, 0);

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  jest.setSystemTime(TODAY);
  mockAdminPrisma.profiles.findMany.mockResolvedValue([]);
  mockAdminPrisma.profiles.count.mockResolvedValue(0);
});

afterEach(() => {
  jest.useRealTimers();
});

async function ageClauseFor(rule: { type: string; operator: string; value: string }) {
  mockAdminPrisma.user_segments.findUnique.mockResolvedValue({ id: 's1', criteria: { rules: [rule] } });
  const { getUserSegmentUsers } = await import('./admin.service');
  await getUserSegmentUsers('s1', { page: 2, limit: 10 });
  const findArgs = mockAdminPrisma.profiles.findMany.mock.calls[0][0];
  const countArgs = mockAdminPrisma.profiles.count.mock.calls[0][0];
  // Count and page share one where, and pagination stays in the query.
  expect(countArgs.where).toEqual(findArgs.where);
  expect(findArgs.skip).toBe(10);
  expect(findArgs.take).toBe(10);
  return findArgs.where.AND[1];
}

const isoRange = (lte: string, gt: string) => ({
  AND: [{ age: { contains: '-' } }, { age: { lte } }, { age: { gt } }],
});

describe('dobCutoffForAge', () => {
  it('is today minus N years on the local calendar', async () => {
    const { dobCutoffForAge } = await import('./admin.service');
    expect(dobCutoffForAge(18)).toBe('2008-10-26');
    expect(dobCutoffForAge(0)).toBe('2026-10-26');
  });
});

describe('age rules', () => {
  it('equals keeps the exact numeric match and adds the ISO window for that age', async () => {
    const clause = await ageClauseFor({ type: 'age', operator: 'equals', value: '24' });
    expect(clause).toEqual({
      OR: [{ age: '24' }, isoRange('2002-10-26', '2001-10-26')],
    });
  });

  it('between keeps the numeric list and adds the ISO window', async () => {
    const clause = await ageClauseFor({ type: 'age', operator: 'between', value: '18,25' });
    expect(clause.OR[0]).toEqual({
      age: { in: ['18', '19', '20', '21', '22', '23', '24', '25'] },
    });
    expect(clause.OR[1]).toEqual(isoRange('2008-10-26', '2000-10-26'));
  });

  it('gte and lte use the same 13..120 clamp as the numeric list', async () => {
    const gte = await ageClauseFor({ type: 'age', operator: 'gte', value: '65' });
    expect(gte.OR[0].age.in[0]).toBe('65');
    expect(gte.OR[0].age.in.at(-1)).toBe('120');
    expect(gte.OR[1]).toEqual(isoRange('1961-10-26', '1905-10-26'));

    jest.clearAllMocks();
    mockAdminPrisma.profiles.findMany.mockResolvedValue([]);
    mockAdminPrisma.profiles.count.mockResolvedValue(0);
    const lte = await ageClauseFor({ type: 'age', operator: 'lte', value: '20' });
    expect(lte.OR[0].age.in[0]).toBe('13');
    expect(lte.OR[0].age.in.at(-1)).toBe('20');
    expect(lte.OR[1]).toEqual(isoRange('2013-10-26', '2005-10-26'));
  });

  it('ignores a non-numeric rule value exactly as before', async () => {
    mockAdminPrisma.user_segments.findUnique.mockResolvedValue({
      id: 's1',
      criteria: { rules: [{ type: 'age', operator: 'equals', value: 'abc' }] },
    });
    const { getUserSegmentUsers } = await import('./admin.service');
    await getUserSegmentUsers('s1');
    const where = mockAdminPrisma.profiles.findMany.mock.calls[0][0].where;
    expect(where.AND).toBeUndefined();
  });
});
