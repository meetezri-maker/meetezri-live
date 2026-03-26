import prisma from '../../lib/prisma';
import { Prisma } from '@prisma/client';
import { emailService } from '../email/email.service';
import { CreateSessionInput, CreateMessageInput } from './sessions.schema';

type DbClient = Prisma.TransactionClient | typeof prisma;

async function deductCreditsSeconds(db: DbClient, userId: string, secondsUsed: number) {
  if (secondsUsed <= 0) return;
  for (let attempt = 0; attempt < 5; attempt++) {
    const profile = await db.profiles.findUnique({
      where: { id: userId },
      select: {
        credits: true,
        purchased_credits: true,
        credits_seconds: true,
        purchased_credits_seconds: true,
      },
    });

    if (!profile) return;

    const storedSubSeconds = profile.credits_seconds || 0;
    const storedPurSeconds = profile.purchased_credits_seconds || 0;
    const subSeconds = storedSubSeconds > 0 ? storedSubSeconds : (profile.credits || 0) * 60;
    const purSeconds = storedPurSeconds > 0 ? storedPurSeconds : (profile.purchased_credits || 0) * 60;

    let newSubSeconds = subSeconds;
    let newPurSeconds = purSeconds;
    if (newSubSeconds >= secondsUsed) {
      newSubSeconds -= secondsUsed;
    } else {
      const remaining = secondsUsed - newSubSeconds;
      newSubSeconds = 0;
      newPurSeconds = Math.max(0, newPurSeconds - remaining);
    }

    const newSubCredits = newSubSeconds === 0 ? 0 : Math.ceil(newSubSeconds / 60);
    const newPurCredits = newPurSeconds === 0 ? 0 : Math.ceil(newPurSeconds / 60);

    const updated = await db.profiles.updateMany({
      where: {
        id: userId,
        credits_seconds: storedSubSeconds,
        purchased_credits_seconds: storedPurSeconds,
      },
      data: {
        credits: newSubCredits,
        purchased_credits: Math.max(0, newPurCredits),
        credits_seconds: newSubSeconds,
        purchased_credits_seconds: newPurSeconds,
      },
    });

    if (updated.count === 1) return;
  }

  throw new Error('Failed to deduct credits safely after retries');
}

export async function createSession(userId: string, input: CreateSessionInput) {
  try {
    // Ensure user profile exists to satisfy foreign key constraint
    const profile = await prisma.profiles.findUnique({
      where: { id: userId },
      select: {
        id: true,
        credits: true,
        purchased_credits: true,
        credits_seconds: true,
        purchased_credits_seconds: true,
      }
    });

    if (!profile) {
      throw new Error('User profile not found. Please complete onboarding first.');
    }

    // Check active subscription state.
    // Some legacy users can have both old trial rows and a paid active subscription.
    // In that case, paid plans must take precedence over expired trial records.
    const activeSubscriptions = await prisma.subscriptions.findMany({
      where: { user_id: userId, status: 'active' },
      orderBy: { created_at: 'desc' },
      select: {
        plan_type: true,
        end_date: true,
      },
    });

    const hasActivePaidSubscription = activeSubscriptions.some(
      (sub) => sub.plan_type !== 'trial'
    );

    if (!hasActivePaidSubscription) {
      const latestTrialSubscription = activeSubscriptions.find(
        (sub) => sub.plan_type === 'trial'
      );
      if (
        latestTrialSubscription?.end_date &&
        new Date() > latestTrialSubscription.end_date
      ) {
        throw new Error('Your trial has expired. Please upgrade to continue.');
      }
    }

    // Check if user has sufficient credits
    // For trial users (hard cap), ensure they have enough credits for the entire planned duration
    const requiredCredits = input.duration_minutes || 5;
    const subSeconds =
      (profile.credits_seconds && profile.credits_seconds > 0)
        ? profile.credits_seconds
        : (profile.credits || 0) * 60;
    const purSeconds =
      (profile.purchased_credits_seconds && profile.purchased_credits_seconds > 0)
        ? profile.purchased_credits_seconds
        : (profile.purchased_credits || 0) * 60;
    const totalSeconds = subSeconds + purSeconds;
    const requiredSeconds = requiredCredits * 60;
    const totalCredits = totalSeconds === 0 ? 0 : Math.ceil(totalSeconds / 60);
    
    if (totalSeconds < requiredSeconds) {
      throw new Error(
        `Insufficient credits. You need ${requiredCredits} minutes but have ${totalCredits}. Please upgrade your plan.`
      );
    }

    const result = await prisma.app_sessions.create({
      data: {
        user_id: userId,
        type: input.type,
        title: input.title || (input.type === 'instant' ? 'Instant Session' : 'Scheduled Session'),
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

    return result;
  } catch (error) {
    console.error('Error in createSession service:', error);
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

    const sessionTitle = session.title || 'Your Ezri session';

    // Immediate confirmation email
    const htmlConfirmation = `
      <p>Hi there,</p>
      <p>Your session <strong>${sessionTitle}</strong> has been scheduled for <strong>${formattedDateTime}</strong>.</p>
      <p>If you did not make this change or need to reschedule, please log in to your MeetEzri account.</p>
      <p>— The MeetEzri Team</p>
    `;

    await emailService.sendEmail(
      email,
      'Your Ezri session is scheduled',
      htmlConfirmation
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
            const htmlReminder = `
              <p>Hi there,</p>
              <p>This is a reminder that your session <strong>${sessionTitle}</strong> is starting in about one hour, at <strong>${formattedDateTime}</strong>.</p>
              <p>You can join your session from your MeetEzri dashboard.</p>
              <p>— The MeetEzri Team</p>
            `;

            await emailService.sendEmail(
              email,
              'Reminder: Your Ezri session is coming up',
              htmlReminder
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

export async function getSessions(userId: string, status?: string) {
  return prisma.app_sessions.findMany({
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
  });
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

  // Calculate duration in seconds, preferring explicit client value
  let secondsUsed = 0;
  if (typeof durationSeconds === 'number' && durationSeconds >= 0) {
    secondsUsed = durationSeconds;
  } else if (session.started_at) {
    const now = new Date();
    const durationMs = now.getTime() - new Date(session.started_at).getTime();
    secondsUsed = Math.max(0, Math.floor(durationMs / 1000));
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
      await prisma.session_messages.createMany({
        data: transcript.map(msg => ({
          session_id: sessionId,
          role: msg.role,
          content: msg.content,
          created_at: msg.timestamp ? new Date(msg.timestamp) : undefined
        }))
      });
    } catch (error) {
      console.error('Failed to save transcript:', error);
    }
  }

  return prisma.app_sessions.update({
    where: { id: sessionId },
    data: {
      ended_at: new Date(),
      duration_minutes: Math.floor(secondsUsed / 60),
      recording_url: recordingUrl,
      status: 'completed',
      billed_seconds: secondsUsed,
    },
  });
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
  return prisma.app_sessions.update({
    where: { id: sessionId },
    data: {
      is_favorite: !session.is_favorite,
    },
  });
}

export async function getSessionById(userId: string, sessionId: string) {
  return prisma.app_sessions.findFirst({
    where: {
      id: sessionId,
      user_id: userId,
    },
  });
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
        app_name: 'Ezri Session',
        window_title: 'AI Therapy Session',
        metadata: {
          type: 'session',
          status: 'active',
          device: 'desktop',
        } as any,
      },
    }),
  ]);

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
