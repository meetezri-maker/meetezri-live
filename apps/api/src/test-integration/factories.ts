/**
 * Minimal, deterministic factories for the concurrency proof.
 *
 * SCOPE: only the five entities the advisory-lock tests need. This is not a fixture framework and
 * should not grow into one — anything broader belongs to whichever task actually needs it.
 *
 * DETERMINISTIC: ids are derived from a caller-supplied label plus a monotonic counter, never from
 * randomness, so a failing run names the exact row involved and reruns are reproducible.
 *
 * `profiles.id` is a FK to `auth.users.id`, so a member always needs both rows. `createMember`
 * creates them together to make that impossible to get wrong.
 */

import prisma from '../lib/prisma';

/** Deterministic UUIDv4-shaped id from a label + counter. No randomness. */
let sequence = 0;
export function deterministicUuid(label: string): string {
  sequence += 1;
  const seed = `${label}-${sequence}`;
  // Simple, stable hash -> hex. Only needs to be collision-free within a run.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < seed.length; i += 1) {
    h1 = Math.imul(h1 ^ seed.charCodeAt(i), 0x01000193) >>> 0;
    h2 = Math.imul(h2 + seed.charCodeAt(i) + 1, 0x85ebca6b) >>> 0;
  }
  const hex = (n: number) => n.toString(16).padStart(8, '0');
  const body = `${hex(h1)}${hex(h2)}${hex(h1 ^ h2)}${hex((h1 + h2) >>> 0)}`;
  // Shape it as a v4 UUID so Postgres accepts it and it reads as a real id.
  return [
    body.slice(0, 8),
    body.slice(8, 12),
    `4${body.slice(13, 16)}`,
    `a${body.slice(17, 20)}`,
    body.slice(20, 32),
  ].join('-');
}

/** Internal billing plan values — never the membership names. */
export type InternalPlan = 'trial' | 'core' | 'pro';

export interface CreatedMember {
  userId: string;
  email: string;
}

/**
 * Create an auth user + profile + subscription for one membership.
 *
 * `plan` is the raw `subscriptions.plan_type`, so tests exercise the same mapping production does
 * (trial -> DISCOVER, core -> GROW, pro -> THRIVE) rather than asserting membership directly.
 */
export async function createMember(
  label: string,
  plan: InternalPlan,
  options: { credits?: number } = {}
): Promise<CreatedMember> {
  const userId = deterministicUuid(`user-${label}`);
  const email = `${label}-${userId.slice(0, 8)}@integration.test`;

  await prisma.users.create({
    data: { id: userId, email, is_sso_user: false, is_anonymous: false },
  });

  await prisma.profiles.create({
    data: {
      id: userId,
      email,
      full_name: `Integration ${label}`,
      credits: options.credits ?? 100,
      credits_seconds: (options.credits ?? 100) * 60,
      purchased_credits: 0,
      purchased_credits_seconds: 0,
    },
    // `select` is required, not stylistic. By default Prisma RETURNs every field the model
    // declares, and `schema.prisma` declares `profiles.signup_source` — a column that exists in
    // production but that NO migration creates (see the migration-history drift documented in
    // the Phase 2C continuation report). On a database built purely from migrations that column
    // is absent, so an unscoped create fails on the RETURNING clause even though the INSERT
    // itself is fine.
    //
    // Narrowing the projection keeps this suite runnable against a migrations-only database
    // without hiding the drift: the drift is reported separately as its own blocker, and none of
    // the missing objects sit on the challenge-join path under test.
    select: { id: true },
  });

  await prisma.subscriptions.create({
    data: {
      user_id: userId,
      plan_type: plan,
      status: 'active',
      billing_cycle: 'monthly',
      start_date: new Date(),
      end_date: null,
    },
  });

  return { userId, email };
}

/**
 * Create a challenge template that is currently ACTIVE by the canonical predicate:
 * inside its date window and not a draft.
 */
export async function createActiveChallenge(label: string): Promise<string> {
  const id = deterministicUuid(`challenge-${label}`);
  const now = Date.now();

  await prisma.wellness_challenges.create({
    data: {
      id,
      title: `Integration challenge ${label}`,
      description: 'Created by the advisory-lock integration suite.',
      category: 'integration',
      // Comfortably inside the window from both sides, so clock skew cannot flake the test.
      start_date: new Date(now - 24 * 60 * 60 * 1000),
      end_date: new Date(now + 30 * 24 * 60 * 60 * 1000),
      goal_criteria: { target: 5 },
      reward_points: 10,
    },
  });

  return id;
}

/** Directly insert a participation row, bypassing the service — used to pre-load a member to N active. */
export async function createParticipation(
  userId: string,
  challengeId: string,
  options: { completed?: boolean } = {}
): Promise<void> {
  await prisma.user_challenge_participation.create({
    data: {
      user_id: userId,
      challenge_id: challengeId,
      progress: 0,
      is_completed: options.completed ?? false,
    },
  });
}

/** Count this member's participation rows, unfiltered — for asserting "exactly one row exists". */
export function countParticipationRows(userId: string): Promise<number> {
  return prisma.user_challenge_participation.count({ where: { user_id: userId } });
}

/**
 * Remove everything the suite created.
 *
 * Deletes only the integration-test users (identified by the email domain) and cascades from
 * there; it never truncates a table, so a mistaken run against a populated database still could
 * not wipe it. Challenges are removed by their integration category.
 */
export async function cleanupIntegrationData(): Promise<void> {
  await prisma.user_challenge_participation.deleteMany({
    where: { profiles: { email: { endsWith: '@integration.test' } } },
  });
  await prisma.wellness_challenges.deleteMany({ where: { category: 'integration' } });
  await prisma.subscriptions.deleteMany({
    where: { profiles: { email: { endsWith: '@integration.test' } } },
  });
  await prisma.profiles.deleteMany({ where: { email: { endsWith: '@integration.test' } } });
  await prisma.users.deleteMany({ where: { email: { endsWith: '@integration.test' } } });
}

/** Advisory locks currently held on this database. The proof that a lock was released. */
export async function countAdvisoryLocks(): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM pg_locks WHERE locktype = 'advisory'
  `;
  return Number(rows[0]?.count ?? 0);
}
