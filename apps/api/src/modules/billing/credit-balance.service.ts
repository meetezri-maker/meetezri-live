import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';

/**
 * Add plan-granted minutes to the subscription bucket (profiles.credits / credits_seconds).
 * Stack-safe: never replaces existing remaining time.
 */
export async function addSubscriptionAllowanceMinutes(userId: string, minutesToAdd: number): Promise<void> {
  if (!minutesToAdd || minutesToAdd <= 0) return;

  const profile = await prisma.profiles.findUnique({
    where: { id: userId },
    select: { credits: true, credits_seconds: true },
  });

  const existingMinutes = profile?.credits ?? 0;
  const existingSeconds =
    profile?.credits_seconds && profile.credits_seconds > 0
      ? profile.credits_seconds
      : existingMinutes * 60;

  const newSeconds = existingSeconds + minutesToAdd * 60;
  const newMinutes = newSeconds === 0 ? 0 : Math.ceil(newSeconds / 60);

  await prisma.profiles.update({
    where: { id: userId },
    data: { credits: newMinutes, credits_seconds: newSeconds },
  });
}

/**
 * Lifetime billable seconds from completed sessions (billed_seconds preferred, else duration_minutes).
 * Single aggregate query — avoids loading every session row (critical for /users/me latency).
 */
export async function getLifetimeUsedSeconds(userId: string): Promise<number> {
  const cached = lifetimeUsedCache.get(userId);
  if (cached && Date.now() - cached.timestamp < LIFETIME_USED_CACHE_TTL) {
    return cached.value;
  }
  const rows = await prisma.$queryRaw<[{ total: bigint | null }]>(
    Prisma.sql`
      SELECT COALESCE(
        SUM(
          CASE
            WHEN s.billed_seconds IS NOT NULL AND s.billed_seconds > 0
              THEN s.billed_seconds::bigint
            ELSE (GREATEST(0, COALESCE(s.duration_minutes, 0)) * 60)::bigint
          END
        ),
        0
      )::bigint AS total
      FROM public.app_sessions s
      WHERE s.user_id = ${userId}::uuid
        AND s.status = 'completed'
        AND s.ended_at IS NOT NULL
    `
  );
  const raw = rows[0]?.total;
  const n = raw == null ? 0 : Number(raw);
  const value = Math.max(0, Number.isFinite(n) ? n : 0);
  lifetimeUsedCache.set(userId, { value, timestamp: Date.now() });
  return value;
}

const lifetimeUsedCache = new Map<string, { value: number; timestamp: number }>();
const LIFETIME_USED_CACHE_TTL = 5 * 1000; // 5s: shared by /users/me and /users/credits
