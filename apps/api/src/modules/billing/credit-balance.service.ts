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
 */
export async function getLifetimeUsedSeconds(userId: string): Promise<number> {
  const rows = await prisma.app_sessions.findMany({
    where: {
      user_id: userId,
      status: 'completed',
      ended_at: { not: null },
    },
    select: { billed_seconds: true, duration_minutes: true },
  });

  let sum = 0;
  for (const r of rows) {
    const sec =
      typeof r.billed_seconds === 'number' && r.billed_seconds > 0
        ? r.billed_seconds
        : Math.max(0, (r.duration_minutes ?? 0) * 60);
    sum += sec;
  }
  return Math.max(0, sum);
}
