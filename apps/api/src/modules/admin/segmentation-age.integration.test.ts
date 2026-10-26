/**
 * Signup DOB storage against REAL PostgreSQL (disposable container, see test-integration/).
 *
 *   1. fillEmptyProfileAge: one conditional UPDATE — fills NULL / '' only, never a stored
 *      numeric age or DOB, is idempotent, and leaves concurrently written columns intact.
 *   2. Segmentation age filters: numeric ages match exactly as before, ISO DOBs match the same
 *      bounds by completed years, and count + pagination come from the same query. NULL, empty
 *      and malformed values never break the query.
 */

import prisma from '../../lib/prisma';
import { fillEmptyProfileAge } from '../users/user.service';
import { getUserSegmentUsers } from './admin.service';
import { cleanupIntegrationData, deterministicUuid } from '../../test-integration/factories';

jest.setTimeout(60_000);

const segmentIds: string[] = [];

async function cleanup() {
  if (segmentIds.length) {
    await prisma.user_segments.deleteMany({ where: { id: { in: segmentIds.splice(0) } } });
  }
  await cleanupIntegrationData();
}

beforeAll(cleanup);
afterEach(cleanup);
afterAll(cleanup);

/** Auth row + profile with a given `age`. `select` avoids the documented signup_source drift. */
async function createProfileWithAge(label: string, age: string | null): Promise<string> {
  const id = deterministicUuid(`dob-${label}`);
  const email = `${label}-${id.slice(0, 8)}@integration.test`;
  await prisma.users.create({ data: { id, email, is_sso_user: false, is_anonymous: false } });
  await prisma.profiles.create({
    data: { id, email, full_name: `Integration ${label}`, age },
    select: { id: true },
  });
  return id;
}

async function ageOf(id: string) {
  const row = await prisma.profiles.findUnique({ where: { id }, select: { age: true, pronouns: true } });
  return row;
}

/** ISO date `years` before today (local calendar), shifted by `dayOffset` days. */
function isoYearsAgo(years: number, dayOffset = 0): string {
  const now = new Date();
  const d = new Date(now.getFullYear() - years, now.getMonth(), now.getDate() + dayOffset, 12);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(d.getFullYear()).padStart(4, '0')}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function segmentWith(rules: Array<{ type: string; operator: string; value: string }>) {
  const seg = await prisma.user_segments.create({
    data: { name: 'integration-age', criteria: { rules } },
    select: { id: true },
  });
  segmentIds.push(seg.id);
  return seg.id;
}

describe('fillEmptyProfileAge (real UPDATE ... WHERE)', () => {
  it('fills NULL and empty ages only', async () => {
    const nullAge = await createProfileWithAge('null', null);
    const emptyAge = await createProfileWithAge('empty', '');
    const numeric = await createProfileWithAge('numeric', '30');
    const dob = await createProfileWithAge('dob', '1985-01-15');

    expect(await fillEmptyProfileAge(nullAge, '1990-04-02')).toBe(true);
    expect(await fillEmptyProfileAge(emptyAge, '1990-04-02')).toBe(true);
    expect(await fillEmptyProfileAge(numeric, '1990-04-02')).toBe(false);
    expect(await fillEmptyProfileAge(dob, '1990-04-02')).toBe(false);

    expect((await ageOf(nullAge))?.age).toBe('1990-04-02');
    expect((await ageOf(emptyAge))?.age).toBe('1990-04-02');
    expect((await ageOf(numeric))?.age).toBe('30');
    expect((await ageOf(dob))?.age).toBe('1985-01-15');
  });

  it('is idempotent: a second fill with another value changes nothing', async () => {
    const id = await createProfileWithAge('idem', null);
    expect(await fillEmptyProfileAge(id, '1990-04-02')).toBe(true);
    expect(await fillEmptyProfileAge(id, '1970-07-07')).toBe(false);
    expect((await ageOf(id))?.age).toBe('1990-04-02');
  });

  it('preserves a concurrent update to another column, and concurrent fills write once', async () => {
    const id = await createProfileWithAge('concurrent', null);
    const results = await Promise.all([
      fillEmptyProfileAge(id, '1990-04-02'),
      fillEmptyProfileAge(id, '1970-07-07'),
      prisma.profiles.update({ where: { id }, data: { pronouns: 'they/them' }, select: { id: true } }),
    ]);

    expect([results[0], results[1]].filter(Boolean)).toHaveLength(1);
    const row = await ageOf(id);
    expect(['1990-04-02', '1970-07-07']).toContain(row?.age);
    expect(row?.pronouns).toBe('they/them');
  });
});

describe('segmentation age filters', () => {
  async function seed() {
    return {
      numeric24: await createProfileWithAge('n24', '24'),
      numeric30: await createProfileWithAge('n30', '30'),
      dob24: await createProfileWithAge('d24', isoYearsAgo(24, -10)),
      dobTurns25Today: await createProfileWithAge('d25today', isoYearsAgo(25)),
      dob24Tomorrow25: await createProfileWithAge('d24tmrw', isoYearsAgo(25, 1)),
      dob40: await createProfileWithAge('d40', isoYearsAgo(40, -3)),
      nullAge: await createProfileWithAge('null', null),
      emptyAge: await createProfileWithAge('empty', ''),
      malformed: await createProfileWithAge('malformed', 'abc-def'),
    };
  }

  async function idsFor(rules: Array<{ type: string; operator: string; value: string }>) {
    const result = await getUserSegmentUsers(await segmentWith(rules), { limit: 100 });
    return { ids: result.users.map((u) => u.id).sort(), total: result.total };
  }

  it('equals: numeric exact match plus ISO DOBs with that completed age', async () => {
    const s = await seed();
    const { ids, total } = await idsFor([{ type: 'age', operator: 'equals', value: '24' }]);
    expect(ids).toEqual([s.numeric24, s.dob24, s.dob24Tomorrow25].sort());
    expect(total).toBe(3);
  });

  it('between: inclusive birthday boundaries on both ends', async () => {
    const s = await seed();
    const { ids, total } = await idsFor([{ type: 'age', operator: 'between', value: '25,30' }]);
    expect(ids).toEqual([s.numeric30, s.dobTurns25Today].sort());
    expect(total).toBe(2);
  });

  it('gte / lte keep the numeric clamp and add matching DOBs', async () => {
    const s = await seed();
    const gte = await idsFor([{ type: 'age', operator: 'gte', value: '30' }]);
    expect(gte.ids).toEqual([s.numeric30, s.dob40].sort());

    const lte = await idsFor([{ type: 'age', operator: 'lte', value: '24' }]);
    expect(lte.ids).toEqual([s.numeric24, s.dob24, s.dob24Tomorrow25].sort());
  });

  it('paginates and counts in the query', async () => {
    await seed();
    const segId = await segmentWith([{ type: 'age', operator: 'between', value: '13,120' }]);
    const page1 = await getUserSegmentUsers(segId, { page: 1, limit: 4 });
    const page2 = await getUserSegmentUsers(segId, { page: 2, limit: 4 });

    // 2 numeric + 4 DOBs match; NULL, '' and malformed do not.
    expect(page1.total).toBe(6);
    expect(page1.pages).toBe(2);
    expect(page1.users).toHaveLength(4);
    expect(page2.users).toHaveLength(2);
    const seen = new Set([...page1.users, ...page2.users].map((u) => u.id));
    expect(seen.size).toBe(6);
  });

  it('combines with other rules', async () => {
    const s = await seed();
    await prisma.profiles.update({
      where: { id: s.dob24 },
      data: { onboarding_completed: true },
      select: { id: true },
    });
    const { ids } = await idsFor([
      { type: 'age', operator: 'equals', value: '24' },
      { type: 'onboarding_completed', operator: 'equals', value: 'true' },
    ]);
    expect(ids).toEqual([s.dob24]);
  });
});
