import prisma, { type PrismaClientLike } from '../../lib/prisma';
import { Prisma } from '@prisma/client';
import {
  deriveSessionSummaryFromTranscript,
  formatTranscriptForSummary,
} from '@meetezri/shared';
import { onUserActivity } from '../system-achievements/system-achievements.triggers';
import { getMembershipEntitlements } from '../entitlements';
import { resolveProfileActualSeconds } from '../billing/credit-balance.service';
import { emailService } from '../email/email.service';
import {
  CreateSessionInput,
  CreateMessageInput,
  UpdateScheduledSessionInput,
  BeginScheduledSessionInput,
  ExtendSessionInput,
} from './sessions.schema';
import { invalidateRecentActivityCache, invalidateUserProfileCache } from '../users/user.service';

/** Local alias for the shared type; keeps every existing `DbClient` signature unchanged. */
type DbClient = PrismaClientLike;

const sessionsListCache = new Map<string, { data: any; timestamp: number }>();
const SESSIONS_LIST_CACHE_TTL = 5 * 1000; // 5s: absorbs UI polling / rapid navigation without going stale long.

function sessionsListCacheKey(userId: string, status?: string, limit?: number) {
  return `${userId}|${status || ''}|${typeof limit === 'number' ? limit : ''}`;
}

export function invalidateSessionsCache(userId: string) {
  const prefix = `${userId}|`;
  for (const key of sessionsListCache.keys()) {
    if (key.startsWith(prefix)) sessionsListCache.delete(key);
  }
}

function badRequest(message: string): never {
  const err = new Error(message);
  (err as { statusCode?: number }).statusCode = 400;
  throw err;
}

/**
 * Membership, profile, and credit checks shared by new instant sessions and starting a scheduled
 * session.
 *
 * PHASE 1B MIGRATION — the membership decision moved to the canonical entitlement engine.
 *
 *   WAS: this function queried `subscriptions` directly and inlined the trial-expiry policy
 *        ("no active non-trial row" + "now > end_date"), making it a second, independent reader
 *        of membership alongside `billing.getSubscription()`.
 *   NOW: `getMembershipEntitlements()` answers the membership question. This function keeps only
 *        what is genuinely session-specific: profile existence and the DURATION-sized balance
 *        check, which is accounting, not authorization.
 *
 * Behaviour is unchanged — see `sessions.entitlement-parity.test.ts`, which was made green
 * against the previous implementation and passes unaltered against this one.
 *
 * Why `status === 'EXPIRED'` reproduces the old rule exactly: live-row expiry is DISCOVER-scoped
 * in the resolver (a paid membership only expires via cancellation), which is the same carve-out
 * the old `hasActivePaidSubscription` short-circuit provided.
 *
 * `canUseAI` is deliberately NOT used as the gate. It folds in "balance > 0", which would
 * collapse the zero-balance case into the expiry case and lose the user-facing distinction
 * between "your trial ended" and "you are out of minutes" — two different remediations.
 */
async function assertSessionStartAllowed(userId: string, durationMinutes: number) {
  const profile = await prisma.profiles.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!profile) {
    badRequest('User profile not found. Please complete onboarding first.');
  }

  const entitlements = await getMembershipEntitlements(userId);

  if (entitlements.status === 'EXPIRED') {
    badRequest('Your trial has expired. Please upgrade to continue.');
  }

  const requiredCredits = durationMinutes || 5;
  // Same figure the old code computed via `resolveProfileRemainingSeconds(profile)` — the engine
  // derives it from the same columns through the same helper.
  const totalSeconds = entitlements.remainingSeconds;
  const requiredSeconds = requiredCredits * 60;

  if (totalSeconds < requiredSeconds) {
    badRequest(insufficientCreditsMessage(requiredCredits, totalSeconds));
  }
}

function insufficientCreditsMessage(requiredMinutes: number, availableSeconds: number): string {
  return `Insufficient credits. You requested ${requiredMinutes} minutes for this session but only have ${Math.floor(availableSeconds / 60)} full minutes available (${availableSeconds}s). Shorten the session or upgrade your plan.`;
}

async function deductCreditsSeconds(db: DbClient, userId: string, secondsUsed: number) {
  if (secondsUsed <= 0) return;
  // Single atomic update: avoids read/modify/write loops and reduces lock contention
  // with heartbeat billing.
  await db.$executeRaw(Prisma.sql`
    WITH current AS (
      SELECT
        id,
        CASE
          WHEN COALESCE(credits_seconds, 0) > 0 THEN COALESCE(credits_seconds, 0)
          ELSE COALESCE(credits, 0) * 60
        END AS sub_seconds,
        CASE
          WHEN COALESCE(purchased_credits_seconds, 0) > 0 THEN COALESCE(purchased_credits_seconds, 0)
          ELSE COALESCE(purchased_credits, 0) * 60
        END AS pur_seconds
      FROM public.profiles
      WHERE id = ${userId}::uuid
      FOR UPDATE
    ),
    next AS (
      SELECT
        id,
        GREATEST(0, sub_seconds - ${secondsUsed})::int AS next_sub,
        CASE
          WHEN sub_seconds >= ${secondsUsed}
            THEN pur_seconds
          ELSE GREATEST(0, pur_seconds - (${secondsUsed} - sub_seconds))::int
        END AS next_pur
      FROM current
    )
    UPDATE public.profiles p
    SET
      credits_seconds = n.next_sub,
      purchased_credits_seconds = n.next_pur,
      credits = CASE WHEN n.next_sub <= 0 THEN 0 ELSE CEIL(n.next_sub / 60.0)::int END,
      purchased_credits = CASE WHEN n.next_pur <= 0 THEN 0 ELSE CEIL(n.next_pur / 60.0)::int END
    FROM next n
    WHERE p.id = n.id;
  `);
}

export async function createSession(userId: string, input: CreateSessionInput) {
  try {
    const plannedMinutes = input.duration_minutes || 5;
    await assertSessionStartAllowed(userId, plannedMinutes);

    const data = {
      user_id: userId,
      type: input.type,
      title: input.title || (input.type === 'instant' ? 'Instant Talk' : 'Scheduled Session'),
      duration_minutes: input.duration_minutes,
      scheduled_at: input.scheduled_at,
      config: input.config as any, // Prisma Json type workaround
      status: input.type === 'instant' ? 'active' : 'scheduled',
      // For instant sessions, we assume they start immediately
      started_at: input.type === 'instant' ? new Date() : undefined,
    };

    const result =
      input.type === 'instant' && (await isSessionExtensionAllowedFor(userId))
        ? await runBillingTransaction(async (tx) => {
            await assertAccountCovers(tx, userId, plannedMinutes);
            return tx.app_sessions.create({ data });
          })
        : await prisma.app_sessions.create({ data });

    // Send confirmation and schedule reminder emails for scheduled sessions
    if (result.type === 'scheduled') {
      void sendScheduledSessionEmails(userId, result);
    }

    invalidateSessionsCache(userId);
    // Award any system achievement this session newly unlocks (failure-isolated).
    await onUserActivity(userId, "session_completed");
    return result;
  } catch (error) {
    const code = (error as { statusCode?: number })?.statusCode;
    if (!(typeof code === 'number' && code >= 400 && code < 500)) {
      console.error('Error in createSession service:', error);
    }
    throw error;
  }
}

async function sendScheduledSessionEmails(userId: string, session: any) {
  try {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user?.email) {
      console.warn('No email found for user when sending scheduled session emails', { userId });
      return;
    }
    const email = user.email;

    const scheduledAt = session.scheduled_at ? new Date(session.scheduled_at) : null;

    const formattedDateTime = scheduledAt
      ? scheduledAt.toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : 'the scheduled time';

    const sessionTitle = session.title || 'Your Solace session';

    const sessionScheduledEmail = emailService.buildSessionScheduledEmail({
      sessionTitle,
      formattedDateTime,
    });

    await emailService.sendEmail(
      email,
      sessionScheduledEmail.subject,
      sessionScheduledEmail.html,
      sessionScheduledEmail.text
    );

    // Best-effort reminder about 1 hour before the session starts
    if (scheduledAt) {
      const now = new Date();
      const oneHourMs = 60 * 60 * 1000;
      const diffMs = scheduledAt.getTime() - now.getTime();
      const delayMs = diffMs - oneHourMs;

      // Only schedule reminder if the session is at least slightly in the future
      if (delayMs > 0) {
        setTimeout(async () => {
          try {
            const sessionReminderEmail = emailService.buildSessionReminderEmail({
              sessionTitle,
              formattedDateTime,
            });

            await emailService.sendEmail(
              email,
              sessionReminderEmail.subject,
              sessionReminderEmail.html,
              sessionReminderEmail.text
            );
          } catch (err) {
            console.error('Failed to send scheduled session reminder email:', err);
          }
        }, delayMs);
      }
    }
  } catch (error) {
    console.error('Failed to send scheduled session emails:', error);
  }
}

export async function getSessions(userId: string, status?: string, limit?: number) {
  const key = sessionsListCacheKey(userId, status, limit);
  const cached = sessionsListCache.get(key);
  if (cached && Date.now() - cached.timestamp < SESSIONS_LIST_CACHE_TTL) {
    return cached.data;
  }

  const data = await prisma.app_sessions.findMany({
    where: {
      user_id: userId,
      ...(status ? { status } : {}),
    },
    include: {
      _count: {
        select: { session_messages: true }
      }
    },
    orderBy: {
      created_at: 'desc',
    },
    ...(typeof limit === 'number' ? { take: limit } : {}),
  });
  sessionsListCache.set(key, { data, timestamp: Date.now() });
  return data;
}

type LockedSessionRow = {
  id: string;
  status: string;
  started_at: Date | null;
  ended_at: Date | null;
  duration_minutes: number | null;
  billed_seconds: number | null;
  config: unknown;
};

/**
 * Row-locks the session for the rest of the transaction. Heartbeat and end both bill against
 * `billed_seconds`, so they must serialize on this lock: the second caller waits, then reads the
 * first caller's committed `billed_seconds` / `status` instead of a stale copy.
 */
async function lockSessionRow(
  tx: Prisma.TransactionClient,
  userId: string,
  sessionId: string
): Promise<LockedSessionRow | null> {
  const rows = await tx.$queryRaw<LockedSessionRow[]>(Prisma.sql`
    SELECT id, status, started_at, ended_at, duration_minutes, billed_seconds, config
    FROM public.app_sessions
    WHERE id = ${sessionId}::uuid AND user_id = ${userId}::uuid
    FOR UPDATE
  `);
  return rows[0] ?? null;
}

/**
 * The selected session length, as the most usage this session may bill.
 *
 * While a session is `active`, `duration_minutes` holds the approved length: only `createSession` /
 * `beginScheduledSession` set it and `extendSession` raises it, scheduled edits are rejected for
 * non-scheduled rows, and `endSession` overwrites it with actual usage in the same update that
 * completes the row.
 * Any other status, or no selected length, means there is no verified limit to apply.
 */
function selectedLimitSeconds(session: LockedSessionRow): number | null {
  if (session.status !== 'active') return null;
  const minutes = session.duration_minutes;
  return typeof minutes === 'number' && minutes > 0 ? minutes * 60 : null;
}

function isRetryableTransactionError(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return code === 'P2034' || code === 'P2028';
}

/** Retries write conflicts / dropped transactions. Safe because a failed attempt rolls back. */
async function runBillingTransaction<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(work);
    } catch (error) {
      if (attempt >= maxAttempts || !isRetryableTransactionError(error)) throw error;
    }
  }
}

export async function endSession(
  userId: string,
  sessionId: string,
  durationSeconds?: number,
  recordingUrl?: string,
  transcript?: any[]
) {
  const session = await getSessionById(userId, sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  // Billing, transcript and completion commit together, once. A repeated or concurrent end waits
  // on the row lock, then sees the session already completed and changes nothing.
  const updated = await runBillingTransaction(async (tx) => {
    const locked = await lockSessionRow(tx, userId, sessionId);
    if (!locked) throw new Error('Session not found');
    if (locked.ended_at || locked.status === 'completed') {
      return tx.app_sessions.findUniqueOrThrow({ where: { id: sessionId } });
    }

    // Wall-clock elapsed — used when client omits duration or sends 0 (refresh / keepalive / race with React state).
    let serverElapsedSeconds = 0;
    if (locked.started_at) {
      const durationMs = Date.now() - new Date(locked.started_at).getTime();
      serverElapsedSeconds = Math.max(0, Math.floor(durationMs / 1000));
    }

    let secondsUsed: number;
    if (typeof durationSeconds === 'number' && Number.isFinite(durationSeconds) && durationSeconds > 0) {
      secondsUsed = durationSeconds;
    } else {
      secondsUsed = serverElapsedSeconds;
    }

    // Never bill past the selected session length; shorter sessions bill what they used.
    const limit = selectedLimitSeconds(locked);
    if (limit !== null) secondsUsed = Math.min(secondsUsed, limit);

    // Deduct credits
    // If heartbeat already billed some seconds, only bill the remainder.
    const alreadyBilled = typeof locked.billed_seconds === 'number' ? Math.max(0, locked.billed_seconds) : 0;
    const billNow = Math.max(0, secondsUsed - alreadyBilled);
    if (billNow > 0) {
      await deductCreditsSeconds(tx, userId, billNow);
    }

    // Save transcript if available
    if (transcript && transcript.length > 0) {
      await tx.session_messages.createMany({
        data: transcript.map((msg) => ({
          session_id: sessionId,
          role: msg.role,
          content: msg.content,
          created_at: msg.timestamp ? new Date(msg.timestamp) : undefined,
        })),
      });
    }

    return tx.app_sessions.update({
      where: { id: sessionId },
      data: {
        ended_at: new Date(),
        duration_minutes: Math.floor(secondsUsed / 60),
        recording_url: recordingUrl,
        status: 'completed',
        billed_seconds: secondsUsed,
      },
    });
  });
  invalidateSessionsCache(userId);
  invalidateUserProfileCache(userId); // credits + profile totals
  invalidateRecentActivityCache(userId);
  return updated;
}

export async function heartbeatSession(userId: string, sessionId: string, elapsedSeconds: number) {
  if (elapsedSeconds < 0) return { ok: true, billed_delta_seconds: 0 };

  return runBillingTransaction(async (tx) => {
    const session = await lockSessionRow(tx, userId, sessionId);
    if (!session) throw new Error('Session not found');
    if (session.ended_at || session.status === 'completed') {
      return { ok: true, billed_delta_seconds: 0 };
    }

    const alreadyBilled = typeof session.billed_seconds === 'number' ? Math.max(0, session.billed_seconds) : 0;
    const limit = selectedLimitSeconds(session);
    const desired = limit === null ? Math.max(0, elapsedSeconds) : Math.min(Math.max(0, elapsedSeconds), limit);
    const delta = desired - alreadyBilled;
    if (delta <= 0) {
      return { ok: true, billed_delta_seconds: 0 };
    }

    // Deduct + mark billed seconds atomically
    await deductCreditsSeconds(tx, userId, delta);
    await tx.app_sessions.update({
      where: { id: sessionId },
      // `updated_at` is how `committedSecondsOfOtherSessions` tells a live session from a crashed one.
      data: { billed_seconds: desired, updated_at: new Date() }
    });

    return { ok: true, billed_delta_seconds: delta };
  });
}

/** Off unless explicitly enabled; the hard cutoff at the selected length stays the default. */
export function isSessionExtensionEnabled(): boolean {
  const raw = process.env.SESSION_EXTENSIONS_ENABLED?.trim().toLowerCase();
  return raw === 'true' || raw === '1';
}

/** The `feature_flags` row (managed under Admin > Feature flags) that lists who may add time. */
export const SESSION_EXTENSIONS_FLAG_KEY = 'session_extensions';

/**
 * Whether this account may add time, and so whether the extension Start and balance rules apply.
 *
 * Needs the global switch AND an enabled `session_extensions` row that either has
 * `rules.rolloutPercentage` at 100 (every account) or lists the account id in `rules.targetUsers`.
 * Below 100 only listed accounts get it; there is no partial percentage bucketing. A missing row,
 * a disabled row or a failed lookup allows nobody. Read on every call, so changes take effect on
 * each account's next request.
 */
export async function isSessionExtensionAllowedFor(userId: string): Promise<boolean> {
  if (!isSessionExtensionEnabled()) return false;
  try {
    const flag = await prisma.feature_flags.findUnique({
      where: { name: SESSION_EXTENSIONS_FLAG_KEY },
      select: { is_enabled: true, rules: true },
    });
    if (!flag?.is_enabled) return false;
    const rules = flag.rules as { targetUsers?: unknown; rolloutPercentage?: unknown } | null;
    if (typeof rules?.rolloutPercentage === 'number' && rules.rolloutPercentage >= 100) return true;
    const targetUsers = rules?.targetUsers;
    const id = userId.trim().toLowerCase();
    return (
      Array.isArray(targetUsers) &&
      targetUsers.some((entry) => typeof entry === 'string' && entry.trim().toLowerCase() === id)
    );
  } catch (error) {
    console.warn('[sessions] session extension allowlist lookup failed; treating as not allowed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/** Longest approvable session, matching the limit on starting a scheduled session. */
const MAX_EXTENDED_SESSION_MINUTES = 480;

/**
 * How recently a session must have shown billing or extension activity to still hold balance.
 * Longer than the 10-minute extension decision window, so a session waiting on its popup still
 * counts; a crashed session stops holding balance once this passes.
 */
const SESSION_COMMITMENT_LIVENESS_MINUTES = 15;

export type ExtendSessionRejectionCode =
  | 'TRIAL_EXPIRED'
  | 'SESSION_NOT_ACTIVE'
  | 'NOT_ELIGIBLE'
  | 'EXTENSION_STALE'
  | 'NOT_AT_LIMIT'
  | 'LIMIT_EXCEEDED'
  | 'INSUFFICIENT_BALANCE'
  | typeof MINUTES_HELD_CODE;

export type ExtendSessionResult =
  | {
      approved: true;
      replayed: boolean;
      limit_minutes: number;
      limit_seconds: number;
      billed_seconds: number;
      balance_seconds: number;
      available_seconds: number;
    }
  | {
      approved: false;
      code: ExtendSessionRejectionCode;
      message: string;
      limit_minutes: number | null;
      limit_seconds: number | null;
      balance_seconds: number | null;
      available_seconds: number | null;
    };

type ExtensionLogEntry = {
  request_id: string;
  expected_limit_minutes: number;
  add_minutes: number;
};

function extensionLogOf(config: unknown): ExtensionLogEntry[] {
  const log = (config as { extension_log?: unknown } | null)?.extension_log;
  return Array.isArray(log) ? (log as ExtensionLogEntry[]) : [];
}

function rejectExtension(
  code: ExtendSessionRejectionCode,
  message: string,
  limitMinutes: number | null,
  balances: { balance: number; available: number } | null = null
): ExtendSessionResult {
  return {
    approved: false,
    code,
    message,
    limit_minutes: limitMinutes,
    limit_seconds: limitMinutes === null ? null : limitMinutes * 60,
    balance_seconds: balances?.balance ?? null,
    available_seconds: balances?.available ?? null,
  };
}

/**
 * Time other live sessions on this account are already approved to use. Extensions take nothing
 * from the balance up front, so without this two sessions could each be approved against the
 * same minutes.
 */
async function committedSecondsOfOtherSessions(
  tx: Prisma.TransactionClient,
  userId: string,
  sessionId: string
): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ committed: number }>>(Prisma.sql`
    SELECT COALESCE(SUM(GREATEST(0, duration_minutes * 60 - COALESCE(billed_seconds, 0))), 0)::int AS committed
    FROM public.app_sessions
    WHERE user_id = ${userId}::uuid
      AND id <> ${sessionId}::uuid
      AND status = 'active'
      AND ended_at IS NULL
      AND duration_minutes IS NOT NULL
      AND GREATEST(updated_at, started_at) > now() - make_interval(mins => ${SESSION_COMMITMENT_LIVENESS_MINUTES}::int)
  `);
  return Number(rows[0]?.committed ?? 0);
}

const NO_SESSION_ID = '00000000-0000-0000-0000-000000000000';

/** The account has the minutes, but another live session is approved to use them. */
export const MINUTES_HELD_CODE = 'MINUTES_HELD_BY_ANOTHER_SESSION';
const MINUTES_HELD_MESSAGE =
  'Your minutes are being held by another active session. End that session, or try again in a moment.';

/**
 * The one balance rule for starting and extending a session, which must be applied with the
 * account row locked: what is left once other live sessions' approved time is set aside.
 */
async function lockAccountAvailability(
  tx: Prisma.TransactionClient,
  userId: string,
  excludeSessionId: string = NO_SESSION_ID
): Promise<{ balance: number; available: number; others: number }> {
  const balance = await lockAccountBalanceSeconds(tx, userId);
  const others = await committedSecondsOfOtherSessions(tx, userId, excludeSessionId);
  return { balance, others, available: Math.max(0, balance - others) };
}

async function assertAccountCovers(
  tx: Prisma.TransactionClient,
  userId: string,
  requiredMinutes: number,
  excludeSessionId?: string
): Promise<void> {
  const { balance, available } = await lockAccountAvailability(tx, userId, excludeSessionId);
  const requiredSeconds = requiredMinutes * 60;
  if (requiredSeconds <= available) return;
  if (balance >= requiredSeconds) {
    throw Object.assign(new Error(MINUTES_HELD_MESSAGE), {
      statusCode: 409,
      code: MINUTES_HELD_CODE,
      available_seconds: available,
    });
  }
  badRequest(insufficientCreditsMessage(requiredMinutes, available));
}

/** Row-locks the account balance, so approvals on any of its sessions are decided one at a time. */
async function lockAccountBalanceSeconds(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<number> {
  const rows = await tx.$queryRaw<
    Array<{
      credits: number | null;
      purchased_credits: number | null;
      credits_seconds: number | null;
      purchased_credits_seconds: number | null;
    }>
  >(Prisma.sql`
    SELECT credits, purchased_credits, credits_seconds, purchased_credits_seconds
    FROM public.profiles
    WHERE id = ${userId}::uuid
    FOR UPDATE
  `);
  return rows[0] ? resolveProfileActualSeconds(rows[0]) : 0;
}

/**
 * Approves more time for a session that reached its selected length, from the existing balance.
 * Nothing is deducted for the added time: it only raises the limit that heartbeat and end bill up
 * to. Locks session then account, the order heartbeat and end use, so all three serialize.
 */
export async function extendSession(
  userId: string,
  sessionId: string,
  input: ExtendSessionInput
): Promise<ExtendSessionResult> {
  // Checked here as well as in the route, so no caller can extend for an account off the list.
  if (!(await isSessionExtensionAllowedFor(userId))) {
    return rejectExtension('NOT_ELIGIBLE', 'Adding more time is not available for this account.', null);
  }
  const entitlements = await getMembershipEntitlements(userId);
  if (entitlements.status === 'EXPIRED') {
    return rejectExtension('TRIAL_EXPIRED', 'Your trial has expired.', null);
  }

  const result = await runBillingTransaction(async (tx): Promise<ExtendSessionResult> => {
    const session = await lockSessionRow(tx, userId, sessionId);
    if (!session) throw new Error('Session not found');
    if (session.ended_at || session.status !== 'active') {
      return rejectExtension('SESSION_NOT_ACTIVE', 'This session has already ended.', null);
    }

    const limit = selectedLimitSeconds(session);
    if (limit === null) {
      return rejectExtension('NOT_ELIGIBLE', 'This session has no selected length.', null);
    }
    const limitMinutes = limit / 60;
    const alreadyBilled = Math.max(0, session.billed_seconds ?? 0);
    const log = extensionLogOf(session.config);

    const prior = log.find((entry) => entry.request_id === input.request_id);
    if (prior) {
      if (
        prior.expected_limit_minutes !== input.expected_limit_minutes ||
        prior.add_minutes !== input.add_minutes
      ) {
        return rejectExtension('EXTENSION_STALE', 'This request was already used.', limitMinutes);
      }
      const { balance, others } = await lockAccountAvailability(tx, userId, sessionId);
      return {
        approved: true,
        replayed: true,
        limit_minutes: limitMinutes,
        limit_seconds: limit,
        billed_seconds: alreadyBilled,
        balance_seconds: balance,
        available_seconds: Math.max(0, balance - others - Math.max(0, limit - alreadyBilled)),
      };
    }

    if (input.expected_limit_minutes !== limitMinutes) {
      return rejectExtension('EXTENSION_STALE', 'This session was already changed.', limitMinutes);
    }
    if (input.elapsed_seconds < limit) {
      return rejectExtension('NOT_AT_LIMIT', 'This session still has time left.', limitMinutes);
    }
    if (limitMinutes + input.add_minutes > MAX_EXTENDED_SESSION_MINUTES) {
      return rejectExtension('LIMIT_EXCEEDED', 'This session cannot be made longer.', limitMinutes);
    }

    // Settle usage up to the old limit first, so the balance below reflects all of it.
    const unsettled = Math.max(0, limit - alreadyBilled);
    if (unsettled > 0) {
      await deductCreditsSeconds(tx, userId, unsettled);
      await tx.app_sessions.update({
        where: { id: sessionId },
        data: { billed_seconds: limit, updated_at: new Date() },
      });
    }

    const { balance, available } = await lockAccountAvailability(tx, userId, sessionId);
    const addSeconds = input.add_minutes * 60;
    if (addSeconds > available) {
      const held = balance >= addSeconds;
      return rejectExtension(
        held ? MINUTES_HELD_CODE : 'INSUFFICIENT_BALANCE',
        held ? MINUTES_HELD_MESSAGE : 'Not enough minutes available.',
        limitMinutes,
        { balance, available }
      );
    }

    const nextLimitMinutes = limitMinutes + input.add_minutes;
    const entry: ExtensionLogEntry = {
      request_id: input.request_id,
      expected_limit_minutes: input.expected_limit_minutes,
      add_minutes: input.add_minutes,
    };
    await tx.app_sessions.update({
      where: { id: sessionId },
      data: {
        duration_minutes: nextLimitMinutes,
        updated_at: new Date(),
        config: {
          ...((session.config as Record<string, unknown> | null) ?? {}),
          extension_log: [...log, entry],
        } as Prisma.InputJsonValue,
      },
    });

    return {
      approved: true,
      replayed: false,
      limit_minutes: nextLimitMinutes,
      limit_seconds: nextLimitMinutes * 60,
      billed_seconds: limit,
      balance_seconds: balance,
      available_seconds: available - addSeconds,
    };
  });

  invalidateSessionsCache(userId);
  invalidateUserProfileCache(userId);
  return result;
}

export async function toggleSessionFavorite(userId: string, sessionId: string) {
  const session = await getSessionById(userId, sessionId);
  if (!session) {
    throw new Error('Session not found');
  }
  const updated = await prisma.app_sessions.update({
    where: { id: sessionId },
    data: {
      is_favorite: !session.is_favorite,
    },
  });
  invalidateSessionsCache(userId);
  return updated;
}

export async function getSessionById(userId: string, sessionId: string) {
  return prisma.app_sessions.findFirst({
    where: {
      id: sessionId,
      user_id: userId,
    },
  });
}

/**
 * Turns a scheduled row into an active session (same id) so the lobby/history lists stay consistent.
 */
export async function beginScheduledSession(
  userId: string,
  sessionId: string,
  input: BeginScheduledSessionInput
) {
  const session = await getSessionById(userId, sessionId);
  if (!session) throw new Error('Session not found');
  if (session.status !== 'scheduled') {
    throw new Error('Only scheduled sessions can be started');
  }

  const durationMinutes =
    typeof input.duration_minutes === 'number' && input.duration_minutes > 0
      ? input.duration_minutes
      : session.duration_minutes ?? 5;

  await assertSessionStartAllowed(userId, durationMinutes);

  const activate = (db: DbClient) =>
    db.app_sessions.update({
      where: { id: sessionId },
      data: {
        status: 'active',
        started_at: new Date(),
        duration_minutes: durationMinutes,
        updated_at: new Date(),
      },
      include: {
        _count: {
          select: { session_messages: true },
        },
      },
    });

  const updated = (await isSessionExtensionAllowedFor(userId))
    ? await runBillingTransaction(async (tx) => {
        const locked = await lockSessionRow(tx, userId, sessionId);
        if (!locked) throw new Error('Session not found');
        if (locked.status !== 'scheduled') {
          throw new Error('Only scheduled sessions can be started');
        }
        await assertAccountCovers(tx, userId, durationMinutes, sessionId);
        return activate(tx);
      })
    : await activate(prisma);

  invalidateSessionsCache(userId);
  return updated;
}

export async function cancelScheduledSession(userId: string, sessionId: string) {
  const session = await getSessionById(userId, sessionId);
  if (!session) throw new Error('Session not found');
  if (session.status !== 'scheduled') {
    throw new Error('Only scheduled sessions can be canceled');
  }

  const updated = await prisma.app_sessions.update({
    where: { id: sessionId },
    data: {
      status: 'canceled',
      ended_at: new Date(),
    },
  });
  invalidateSessionsCache(userId);
  return updated;
}

export async function updateScheduledSession(
  userId: string,
  sessionId: string,
  input: UpdateScheduledSessionInput
) {
  const session = await getSessionById(userId, sessionId);
  if (!session) throw new Error('Session not found');
  if (session.status !== 'scheduled') {
    throw new Error('Only scheduled sessions can be edited');
  }

  const updated = await prisma.app_sessions.update({
    where: { id: sessionId },
    data: {
      ...(typeof input.duration_minutes === 'number'
        ? { duration_minutes: input.duration_minutes }
        : {}),
      ...(typeof input.scheduled_at === 'string'
        ? { scheduled_at: new Date(input.scheduled_at) }
        : {}),
      ...(input.config ? { config: input.config as any } : {}),
      updated_at: new Date(),
    },
  });
  invalidateSessionsCache(userId);
  return updated;
}

export async function createMessage(userId: string, sessionId: string, input: CreateMessageInput) {
  const session = await getSessionById(userId, sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const [message] = await prisma.$transaction([
    prisma.session_messages.create({
      data: {
        session_id: sessionId,
        role: input.role,
        content: input.content,
      },
    }),
    prisma.activity_events.create({
      data: {
        session_id: sessionId,
        user_id: userId,
        app_name: 'Solace Session',
        window_title: 'Solace Session',
        metadata: {
          type: 'session',
          status: 'active',
          device: 'desktop',
        } as any,
      },
    }),
  ]);

  invalidateSessionsCache(userId);
  return message;
}

export async function getSessionTranscript(userId: string, sessionId: string) {
  const session = await getSessionById(userId, sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  return prisma.session_messages.findMany({
    where: { session_id: sessionId },
    orderBy: { created_at: 'asc' },
  });
}

async function generateAiSessionSummary(transcript: string): Promise<string | null> {
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (!openaiKey || !transcript.trim()) return null;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 240,
        messages: [
          {
            role: 'system',
            content:
              'You summarize wellness support conversations between a user and Solace (an AI companion). Write 2-4 sentences in second person ("you"). Capture the main topics, emotional themes, and how the conversation progressed across the FULL transcript. Only include facts stated in the transcript—never invent details. Ignore audio-check small talk (e.g. "can you hear me"). The assistant is always named Solace, never Ezri.',
          },
          {
            role: 'user',
            content: `Summarize this complete talk:\n\n${transcript.slice(0, 14000)}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch {
    return null;
  }
}

export async function getOrGenerateSessionSummary(userId: string, sessionId: string) {
  const session = await getSessionById(userId, sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const config = (session.config || {}) as Record<string, unknown>;
  const cached = typeof config.summary === 'string' ? config.summary.trim() : '';
  const summarySource =
    typeof config.summary_source === 'string' ? config.summary_source : null;
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const isTitleLikeSummary =
    !cached ||
    cached.length < 30 ||
    /^(instant talk|scheduled talk|talking|new session)$/i.test(cached);
  const canUseCached =
    cached &&
    !isTitleLikeSummary &&
    (summarySource === 'ai' || !openaiKey);
  if (canUseCached) {
    return { summary: cached, source: 'cached' as const };
  }

  const rows = await getSessionTranscript(userId, sessionId);
  if (!rows.length) {
    return { summary: null, source: 'empty' as const };
  }

  const transcriptMessages = rows.map((row) => ({
    role: row.role,
    content: row.content,
  }));

  const transcriptText = formatTranscriptForSummary(transcriptMessages);
  let summary = await generateAiSessionSummary(transcriptText);
  let source: 'ai' | 'heuristic' = 'ai';

  if (!summary) {
    summary = deriveSessionSummaryFromTranscript(transcriptMessages);
    source = 'heuristic';
  }

  if (summary?.trim()) {
    const updatedConfig = {
      ...config,
      summary: summary.trim(),
      summary_source: source,
    };
    await prisma.app_sessions.update({
      where: { id: sessionId },
      data: { config: updatedConfig as Prisma.InputJsonValue },
    });
    invalidateSessionsCache(userId);
  }

  return { summary: summary?.trim() || null, source };
}

export async function getUserSessions(userId: string) {
  return prisma.app_sessions.findMany({
    where: {
      user_id: userId,
    },
    orderBy: {
      created_at: 'desc',
    },
  });
}
