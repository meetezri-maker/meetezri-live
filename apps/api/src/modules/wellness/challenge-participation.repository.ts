/**
 * Challenge participation — the canonical "active challenge" definition.
 *
 * =========================================================================================
 * THE PREDICATE
 * =========================================================================================
 *
 * A challenge is ACTIVE for a member when ALL of the following hold:
 *
 *   1. a `user_challenge_participation` row exists for (user_id, challenge_id)
 *   2. `is_completed` is not true          — completed challenges never count
 *   3. `now` is inside the challenge's window: `start_date <= now <= end_date`
 *   4. the challenge is not a draft        — `goal_criteria->>'status' <> 'draft'`
 *
 * WHY EACH CLAUSE, given the actual schema:
 *
 *   - `user_challenge_participation` has NO `status`, `canceled_at`, `abandoned_at`, or
 *     `deleted_at` column. Leaving a challenge is a HARD DELETE of the row
 *     (`unjoinWellnessChallenge`), so cancelled / abandoned / deleted participation is excluded
 *     structurally by clause 1 — there is nothing to filter on, and nothing to miss.
 *
 *   - `is_completed` is `Boolean?` (nullable, defaults false), so the check is written as
 *     "not true" rather than "= false" — a NULL must not silently count as complete or as
 *     incomplete by accident.
 *
 *   - Clauses 3 and 4 mirror `getWellnessChallengesForUserDashboard` EXACTLY, which is what the
 *     member actually sees. Two reasons this matters: an ended challenge would otherwise consume
 *     a limit slot forever with no way to free it except un-joining (a trap the member cannot
 *     diagnose), and an enforcement count that disagrees with the on-screen count makes the
 *     limit error look like a bug.
 *
 * This is the ONE definition. Nothing else may compute an active-challenge count.
 *
 * =========================================================================================
 * PERFORMANCE
 * =========================================================================================
 *
 * A single `COUNT(*)` with a join — no participation rows are loaded into Node. Supported by
 * `user_challenge_participation_user_completed_idx (user_id, is_completed)` and
 * `wellness_challenges_start_end_idx (start_date, end_date)`.
 */

import { Prisma } from '@prisma/client';
import prisma, { type PrismaClientLike } from '../../lib/prisma';

/**
 * Count the member's currently-active challenges.
 *
 * Pass `client` to enlist in a caller-owned transaction — required when the count is being used
 * to make an enforcement decision, so the read and the subsequent write share one snapshot and
 * one lock. Omitting it uses the Prisma singleton and is fine for read-only/reporting callers.
 */
export async function getActiveChallengeCount(
  userId: string,
  client: PrismaClientLike = prisma
): Promise<number> {
  const rows = await client.$queryRaw<Array<{ count: bigint | null }>>(
    Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM public.user_challenge_participation p
      JOIN public.wellness_challenges c ON c.id = p.challenge_id
      WHERE p.user_id = ${userId}::uuid
        AND COALESCE(p.is_completed, false) = false
        AND c.start_date <= now()
        AND c.end_date >= now()
        AND COALESCE(c.goal_criteria->>'status', '') <> 'draft'
    `
  );

  const raw = rows[0]?.count;
  const n = raw == null ? 0 : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Serialize a member's challenge-participation mutations against each other.
 *
 * `pg_advisory_xact_lock` is a transaction-scoped Postgres advisory lock: it is acquired inside
 * the caller's transaction and released automatically on COMMIT or ROLLBACK, so there is no
 * unlock path to leak. It requires no schema change and no migration.
 *
 * Scoped to the user via `hashtext(userId)`, so two different members never contend. The
 * `'challenge-participation'` namespace is folded in so this lock cannot collide with a future
 * advisory lock taken on the same user for an unrelated reason.
 *
 * This is what makes the count-then-create sequence safe: without it, two concurrent joins can
 * both read a count below the limit and both insert.
 */
export async function lockUserChallengeParticipation(
  userId: string,
  client: PrismaClientLike
): Promise<void> {
  await client.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`challenge-participation:${userId}`}))`
  );
}
