/**
 * Phase 10 — Legacy Goals & Achievements tracking audit + safe migration.
 *
 * Audits records created before tracking fields existed and, on --execute,
 * applies ONLY safe fallbacks:
 *   - Numeric tracking with no target_value -> mark legacy_tracking = true and
 *     switch to manual_milestone (we never INVENT a numeric target).
 *   - Existing progress percentages are preserved.
 *   - Legacy check-in JSON on custom_achievements is left in place (never deleted).
 *   - Historical rewards are NOT awarded here (see backfill-gamification-rewards.ts,
 *     which stays dry-run until separately approved).
 *
 * DRY-RUN by default. Pass --execute to apply the safe fallbacks.
 *
 * Run (from apps/api, DATABASE_URL must reach Postgres):
 *   npx ts-node scripts/audit-legacy-gamification.ts            # dry-run report
 *   npx ts-node scripts/audit-legacy-gamification.ts --execute  # apply safe fallbacks
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const EXECUTE = process.argv.includes("--execute");

async function main() {
  console.log(`Legacy gamification audit — ${EXECUTE ? "EXECUTE" : "DRY-RUN"}`);

  // --- Goals ---
  const goalsNumericNoTarget = await prisma.personal_goals.findMany({
    where: {
      tracking_type: { in: ["count", "duration", "amount"] },
      target_value: null,
    },
    select: { id: true },
  });
  const goalsCompleted = await prisma.personal_goals.count({ where: { status: "completed" } });

  // --- Achievements (raw: mixes model + legacy columns) ---
  const achNumericNoTarget = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM public.custom_achievements
    WHERE tracking_type IN ('count','duration','amount') AND (total IS NULL OR total <= 0)
  `;
  const achLegacyJson = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*)::bigint AS n FROM public.custom_achievements
    WHERE check_in_entries IS NOT NULL AND jsonb_array_length(check_in_entries) > 0
  `;
  const achCompleted = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*)::bigint AS n FROM public.custom_achievements WHERE unlocked = true
  `;

  // Completed items lacking a reward ledger row (potential historical rewards).
  const goalsCompletedNoReward = await prisma.personal_goals.count({
    where: { status: "completed", reward_awarded: false },
  });
  const achCompletedNoReward = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*)::bigint AS n FROM public.custom_achievements
    WHERE unlocked = true AND reward_awarded = false
  `;

  const summary = {
    goals: {
      numericMissingTarget_fallback: goalsNumericNoTarget.length,
      completed: goalsCompleted,
      completedWithoutReward_potentialHistoricalReward: goalsCompletedNoReward,
    },
    achievements: {
      numericMissingTarget_fallback: achNumericNoTarget.length,
      legacyJsonCheckInRows_preserved: Number(achLegacyJson[0]?.n ?? 0),
      completed: Number(achCompleted[0]?.n ?? 0),
      completedWithoutReward_potentialHistoricalReward: Number(achCompletedNoReward[0]?.n ?? 0),
    },
  };
  console.log("Audit summary:", JSON.stringify(summary, null, 2));

  if (!EXECUTE) {
    console.log("Dry-run only. Re-run with --execute to apply safe fallbacks.");
    return;
  }

  // Safe fallback: numeric-without-target -> manual_milestone + legacy flag.
  let migratedGoals = 0;
  for (const g of goalsNumericNoTarget) {
    await prisma.personal_goals.update({
      where: { id: g.id },
      data: { tracking_type: "manual_milestone", legacy_tracking: true },
    });
    migratedGoals++;
  }
  let migratedAch = 0;
  for (const a of achNumericNoTarget) {
    await prisma.$executeRaw`
      UPDATE public.custom_achievements
      SET tracking_type = 'manual_milestone', total = 100, legacy_tracking = true
      WHERE id = ${a.id}::uuid
    `;
    migratedAch++;
  }
  console.log(
    `Applied safe fallbacks: ${migratedGoals} goal(s), ${migratedAch} achievement(s) set to manual_milestone (progress preserved, no targets invented).`
  );
}

main()
  .catch((err) => {
    console.error("Audit failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
