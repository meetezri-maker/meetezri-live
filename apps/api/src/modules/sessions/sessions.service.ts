import prisma from '../../lib/prisma';
import { CreateSessionInput, CreateMessageInput } from './sessions.schema';

export async function createSession(userId: string, input: CreateSessionInput) {
  try {
    // Ensure user profile exists to satisfy foreign key constraint
    const profile = await prisma.profiles.findUnique({
      where: { id: userId },
      select: { id: true, credits: true, purchased_credits: true }
    });

    if (!profile) {
      throw new Error('User profile not found. Please complete onboarding first.');
    }

    // Check for active subscription and trial expiry
    const subscription = await prisma.subscriptions.findFirst({
      where: { user_id: userId, status: 'active' }
    });

    if (subscription?.plan_type === 'trial' && subscription.end_date && new Date() > subscription.end_date) {
      throw new Error('Your trial has expired. Please upgrade to continue.');
    }

    // Check if user has sufficient credits
    // For trial users (hard cap), ensure they have enough credits for the entire planned duration
    const requiredCredits = input.duration_minutes || 5;
    const totalCredits = (profile.credits || 0) + (profile.purchased_credits || 0);
    
    if (totalCredits < requiredCredits) {
      throw new Error(`Insufficient credits. You need ${requiredCredits} minutes but have ${totalCredits}. Please upgrade your plan.`);
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
    return result;
  } catch (error) {
    console.error('Error in createSession service:', error);
    throw error;
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

export async function endSession(userId: string, sessionId: string, durationSeconds?: number, recordingUrl?: string, transcript?: any[]) {
  const session = await getSessionById(userId, sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  // Calculate real duration from started_at if available
  let minutesUsed = 0;
  if (session.started_at) {
    const now = new Date();
    const durationMs = now.getTime() - new Date(session.started_at).getTime();
    minutesUsed = Math.ceil(durationMs / 1000 / 60);
  } else if (durationSeconds) {
    minutesUsed = Math.ceil(durationSeconds / 60);
  }

  // Deduct credits
  if (minutesUsed > 0) {
    try {
      const profile = await prisma.profiles.findUnique({
        where: { id: userId },
        select: { credits: true, purchased_credits: true }
      });

      if (profile) {
        const subCredits = profile.credits || 0;
        const purCredits = profile.purchased_credits || 0;
        
        let newSubCredits = subCredits;
        let newPurCredits = purCredits;

        if (subCredits >= minutesUsed) {
          newSubCredits = subCredits - minutesUsed;
        } else {
          newSubCredits = 0;
          newPurCredits = purCredits - (minutesUsed - subCredits);
        }

        await prisma.profiles.update({
          where: { id: userId },
          data: {
            credits: newSubCredits,
            purchased_credits: Math.max(0, newPurCredits)
          }
        });
      }
    } catch (error) {
      console.error('Error deducting credits:', error);
      // Don't fail the session end if credit deduction fails, but log it
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
      duration_minutes: minutesUsed,
      recording_url: recordingUrl,
      status: 'completed'
    },
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
