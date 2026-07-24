/**
 * Point transaction ledger — the single source of truth for points.
 *
 * A user's total points are DERIVED from the ledger (SUM of point_amount), so
 * totals can never drift from the recorded rewards. Every reward is one row.
 * Historical rows are never deleted when an item is edited. A DB unique
 * constraint on (user_id, source_type, source_item_id) guarantees the same
 * item can never award the same reward twice (idempotency).
 */
import { Prisma } from "@prisma/client";
import prisma, { type PrismaClientLike } from "../../lib/prisma";
import { PointSourceType } from "./rewards.constants";
import { LevelInfo, calculateLevel } from "./level.service";

/**
 * Re-exported for backwards compatibility: `completion.service.ts` and
 * `system-achievements.service.ts` import this name from here. The canonical
 * declaration now lives in `lib/prisma.ts`.
 */
export type { PrismaClientLike };

export interface RecordPointsInput {
  userId: string;
  sourceType: PointSourceType;
  sourceItemId: string;
  points: number;
  reason: string;
}

export interface RecordPointsResult {
  /** True when a new ledger row was inserted; false when it already existed. */
  inserted: boolean;
  transaction: unknown | null;
}

/**
 * Idempotently record a point transaction. Relies on the DB unique constraint
 * (user_id, source_type, source_item_id): a duplicate insert raises P2002,
 * which is caught and reported as `inserted: false` — never a double award.
 */
export async function recordPointTransaction(
  client: PrismaClientLike,
  input: RecordPointsInput
): Promise<RecordPointsResult> {
  try {
    const transaction = await client.point_transactions.create({
      data: {
        user_id: input.userId,
        source_type: input.sourceType,
        source_item_id: input.sourceItemId,
        points: input.points,
        reason: input.reason,
      },
    });
    return { inserted: true, transaction };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Reward already recorded for this item — idempotent no-op.
      return { inserted: false, transaction: null };
    }
    throw err;
  }
}

/** Sum of all ledger rows for a user (0 when none). */
export async function getUserTotalPoints(
  userId: string,
  client: PrismaClientLike = prisma
): Promise<number> {
  const agg = await client.point_transactions.aggregate({
    where: { user_id: userId },
    _sum: { points: true },
  });
  return agg._sum.points ?? 0;
}

export interface UserPointsSummary extends LevelInfo {
  totalPoints: number;
}

/** Total points + derived level info for a user. */
export async function getUserPointsSummary(
  userId: string,
  client: PrismaClientLike = prisma
): Promise<UserPointsSummary> {
  const totalPoints = await getUserTotalPoints(userId, client);
  return { ...calculateLevel(totalPoints), totalPoints };
}

/** A user's own point transactions, newest first. Strictly user-scoped. */
export async function listUserTransactions(
  userId: string,
  limit = 100,
  client: PrismaClientLike = prisma
): Promise<unknown[]> {
  return client.point_transactions.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
    take: Math.min(Math.max(limit, 1), 500),
  });
}
