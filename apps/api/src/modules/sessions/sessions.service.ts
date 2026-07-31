import prisma, { type PrismaClientLike } from '../../lib/prisma';
import { Prisma } from '@prisma/client';
import {
  deriveSessionSummaryFromTranscript,
  formatTranscriptForSummary,
} from '@meetezri/shared';
import { onUserActivity } from '../system-achievements/system-achievements.triggers';
import { getMembershipEntitlements } from '../entitlements';
import { emailService } from '../email/email.service';
import {
  CreateSessionInput,
  CreateMessageInput,
  UpdateScheduledSessionInput,
  BeginScheduledSessionInput,
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
  const haveFullMinutes = Math.floor(totalSeconds / 60);

  if (totalSeconds < requiredSeconds) {
    badRequest(
      `Insufficient credits. You requested ${requiredCredits} minutes for this session but only have ${haveFullMinutes} full minutes available (${totalSeconds}s). Shorten the session or upgrade your plan.`
    );
  }
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

    const result = await prisma.app_sessions.create({
      data: {
        user_id: userId,
        type: input.type,
        title: input.title || (input.type === 'instant' ? 'Instant Talk' : 'Scheduled Session'),
        duration_minutes: input.duration_minutes,
        scheduled_at: input.scheduled_at,
        config: input.config as any, // Prisma Json type workaround
        status: input.type === 'instant' ? 'active' : 'scheduled',
        // For instant sessions, we assume they start immediately
        started_at: input.type === 'instant' ? new Date() : undefined,
      },
    });

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

  // Wall-clock elapsed — used when client omits duration or sends 0 (refresh / keepalive / race with React state).
  let serverElapsedSeconds = 0;
  if (session.started_at) {
    const durationMs = Date.now() - new Date(session.started_at).getTime();
    serverElapsedSeconds = Math.max(0, Math.floor(durationMs / 1000));
  }

  let secondsUsed: number;
  if (typeof durationSeconds === 'number' && Number.isFinite(durationSeconds) && durationSeconds > 0) {
    secondsUsed = durationSeconds;
  } else {
    secondsUsed = serverElapsedSeconds;
  }

  // Deduct credits
  // If heartbeat already billed some seconds, only bill the remainder.
  const alreadyBilled = typeof (session as any).billed_seconds === 'number' ? Math.max(0, (session as any).billed_seconds) : 0;
  const billNow = Math.max(0, secondsUsed - alreadyBilled);
  if (billNow > 0) {
    try {
      await deductCreditsSeconds(prisma, userId, billNow);
    } catch (error) {
      console.error('Error deducting credits:', error);
    }
  }

  // Save transcript if available
  if (transcript && transcript.length > 0) {
    try {
      // Best-effort: do not block session end on transcript persistence.
      void prisma.session_messages
        .createMany({
          data: transcript.map((msg) => ({
            session_id: sessionId,
            role: msg.role,
            content: msg.content,
            created_at: msg.timestamp ? new Date(msg.timestamp) : undefined,
          })),
        })
        .catch((error) => {
          console.error("Failed to save transcript:", error);
        });
    } catch (error) {
      console.error('Failed to save transcript:', error);
    }
  }

  const updated = await prisma.app_sessions.update({
    where: { id: sessionId },
    data: {
      ended_at: new Date(),
      duration_minutes: Math.floor(secondsUsed / 60),
      recording_url: recordingUrl,
      status: 'completed',
      billed_seconds: secondsUsed,
    },
  });
  invalidateSessionsCache(userId);
  invalidateUserProfileCache(userId); // credits + profile totals
  invalidateRecentActivityCache(userId);
  return updated;
}

export async function heartbeatSession(userId: string, sessionId: string, elapsedSeconds: number) {
  if (elapsedSeconds < 0) return { ok: true, billed_delta_seconds: 0 };

  return prisma.$transaction(async (tx) => {
    const session = await tx.app_sessions.findFirst({
      where: { id: sessionId, user_id: userId },
      select: { id: true, status: true, ended_at: true, billed_seconds: true }
    });
    if (!session) throw new Error('Session not found');
    if (session.ended_at || session.status === 'completed') {
      return { ok: true, billed_delta_seconds: 0 };
    }

    const alreadyBilled = typeof session.billed_seconds === 'number' ? Math.max(0, session.billed_seconds) : 0;
    const desired = Math.max(0, elapsedSeconds);
    const delta = desired - alreadyBilled;
    if (delta <= 0) {
      return { ok: true, billed_delta_seconds: 0 };
    }

    // Deduct + mark billed seconds atomically
    await deductCreditsSeconds(tx, userId, delta);
    await tx.app_sessions.update({
      where: { id: sessionId },
      data: { billed_seconds: desired }
    });

    return { ok: true, billed_delta_seconds: delta };
  });
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

  const updated = await prisma.app_sessions.update({
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
