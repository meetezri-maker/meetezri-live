/**
 * Phase 13 — Historical rewards backfill (Goals & Achievements).
 *
 * Inserts a point-transaction ledger row (and sets reward_awarded/completed_at)
 * for every already-completed personal goal and personal achievement that does
 * not yet have one, so historical completions are reflected in the new backend
 * points/level system.
 *
 * SAFETY:
 *   - DRY-RUN by default. It reports what it WOULD do and writes nothing.
 *   - Pass --execute to actually write (only after historical rewards are approved).
 *   - Idempotent: the ledger unique constraint (user_id, source_type,
 *     source_item_id) means re-running never creates duplicate rewards. Each item
 *     is processed in its own transaction.
 *
 * Run (from apps/api, DATABASE_URL must reach Postgres):
 *   npx ts-node scripts/backfill-gamification-rewards.ts            # dry-run
 *   npx ts-node scripts/backfill-gamification-rewards.ts --execute  # apply
 */
import { Prisma, PrismaClient } from "@prisma/client";
import {
  PERSONAL_ACHIEVEMENT_COMPLETION_POINTS,
  PERSONAL_GOAL_COMPLETION_POINTS,
  POINT_SOURCE_TYPES,
} from "../src/modules/gamification/rewards.constants";

const prisma = new PrismaClient();
const EXECUTE = process.argv.includes("--execute");

interface Candidate {
  userId: string;
  itemId: string;
  sourceType: string;
  points: number;
  reason: string;
  kind: "goal" | "achievement";
}

/** Award one candidate idempotently in its own transaction. Returns true if a row was written. */
async function awardOne(c: Candidate): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    try {
      await tx.point_transactions.create({
        data: {
          user_id: c.userId,
          source_type: c.sourceType,
          source_item_id: c.itemId,
          points: c.points,
          reason: c.reason,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return false; // already rewarded — idempotent no-op
      }
      throw err;
    }

    const completedAt = new Date();
    if (c.kind === "goal") {
      await tx.personal_goals.update({
        where: { id: c.itemId },
        data: { reward_awarded: true, completed_at: completedAt },
      });
    } else {
      await tx.custom_achievements.update({
        where: { id: c.itemId },
        data: { reward_awarded: true, completed_at: completedAt, unlocked: true },
      });
    }
    return true;
  });
}

async function main() {
  console.log(`Gamification rewards backfill — ${EXECUTE ? "EXECUTE" : "DRY-RUN"}`);

  // Completed goals: status 'completed' or progress at 100, not yet rewarded.
  const goals = await prisma.personal_goals.findMany({
    where: {
      reward_awarded: false,
      OR: [{ status: "completed" }, { progress_percentage: { gte: 100 } }],
    },
    select: { id: true, user_id: true },
  });

  // Completed achievements: unlocked or progress >= total, not yet rewarded.
  const achievementsRaw = await prisma.$queryRaw<Array<{ id: string; user_id: string }>>`
    SELECT id, user_id
    FROM public.custom_achievements
    WHERE reward_awarded = false
      AND (unlocked = true OR progress >= total)
  `;

  const candidates: Candidate[] = [
    ...goals.map((g) => ({
      userId: g.user_id,
      itemId: g.id,
      sourceType: POINT_SOURCE_TYPES.PERSONAL_GOAL_COMPLETION,
      points: PERSONAL_GOAL_COMPLETION_POINTS,
      reason: "personal_goal_completion_backfill",
      kind: "goal" as const,
    })),
    ...achievementsRaw.map((a) => ({
      userId: a.user_id,
      itemId: a.id,
      sourceType: POINT_SOURCE_TYPES.PERSONAL_ACHIEVEMENT_COMPLETION,
      points: PERSONAL_ACHIEVEMENT_COMPLETION_POINTS,
      reason: "personal_achievement_completion_backfill",
      kind: "achievement" as const,
    })),
  ];

  console.log(
    `Found ${goals.length} completed goal(s) and ${achievementsRaw.length} completed achievement(s) without a reward.`
  );

  if (!EXECUTE) {
    for (const c of candidates) {
      console.log(`  [dry-run] would award ${c.points} pts -> ${c.kind} ${c.itemId} (user ${c.userId})`);
    }
    console.log("Dry-run complete. Re-run with --execute to apply (after approval).");
    return;
  }

  let written = 0;
  let skipped = 0;
  for (const c of candidates) {
    const did = await awardOne(c);
    if (did) written++;
    else skipped++;
  }
  console.log(`Backfill complete. Wrote ${written} reward(s); skipped ${skipped} already-rewarded.`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
