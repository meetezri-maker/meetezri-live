import prisma from '../../lib/prisma';
import { CreateWellnessToolInput, UpdateWellnessToolInput } from './wellness.schema';

const PROGRESS_CACHE_TTL = 30 * 1000; // 30 seconds
const progressCache = new Map<string, { data: any[]; timestamp: number }>();

const WELLNESS_TOOLS_CACHE_TTL = 60 * 1000; // 60 seconds
const wellnessToolsCache = new Map<string, { data: any[]; timestamp: number }>();

const WELLNESS_STATS_CACHE_TTL = 60 * 1000; // 60 seconds
const wellnessStatsCache = new Map<string, { data: any; timestamp: number }>();

function clearWellnessToolCaches() {
  wellnessToolsCache.clear();
}

function clearUserWellnessCaches(userId: string) {
  progressCache.delete(userId);
  wellnessStatsCache.delete(userId);
}

function resolveDurationFields(input: {
  duration_minutes?: number | null;
  duration_seconds?: number | null;
}): { duration_minutes: number | null; duration_seconds: number | null } {
  const dmIn = input.duration_minutes ?? null;
  const dsIn = input.duration_seconds ?? null;
  if (dsIn != null && dsIn >= 0) {
    return {
      duration_seconds: dsIn,
      duration_minutes: Math.max(1, Math.round(dsIn / 60)),
    };
  }
  if (dmIn != null && dmIn > 0) {
    return {
      duration_minutes: dmIn,
      duration_seconds: dmIn * 60,
    };
  }
  return { duration_minutes: dmIn, duration_seconds: dsIn };
}

export async function createWellnessTool(data: CreateWellnessToolInput & { created_by?: string }) {
  const { created_by, image_url, content } = data;
  /** Guided JSON lives in `content_url` (text column) when no separate asset URL. */
  const storedContent = image_url ?? content ?? null;
  const { duration_minutes, duration_seconds } = resolveDurationFields(data);

  const created = await prisma.wellness_tools.create({
    data: {
      title: data.title,
      category: data.category,
      description: data.description,
      duration_minutes,
      duration_seconds,
      difficulty: data.difficulty,
      is_premium: data.is_premium,
      status: data.status,
      icon: data.icon,
      content_url: storedContent,
      ...(created_by ? {
        profiles: {
          connect: { id: created_by },
        }
      } : {}),
    },
  });
  clearWellnessToolCaches();
  return created;
}

export async function createWellnessChallenge(data: {
  title: string;
  description?: string | null;
  category?: string | null;
  start_date: string;
  end_date: string;
  reward_points?: number | null;
  goal_criteria?: unknown | null;
}) {
  const start = new Date(data.start_date);
  const end = new Date(data.end_date);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Invalid start or end date');
  }
  const created = await prisma.wellness_challenges.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      category: data.category ?? null,
      start_date: start,
      end_date: end,
      reward_points: data.reward_points ?? 0,
      goal_criteria:
        data.goal_criteria === undefined || data.goal_criteria === null
          ? undefined
          : (data.goal_criteria as object),
    },
  });
  return {
    ...created,
    participants: 0,
    completionRate: 0,
  };
}

export async function getWellnessChallengesWithStats() {
  const [challenges, participation, completions] = await Promise.all([
    prisma.wellness_challenges.findMany({
      orderBy: { start_date: 'asc' },
    }),
    prisma.user_challenge_participation.groupBy({
      by: ['challenge_id'],
      _count: { user_id: true },
    }),
    prisma.user_challenge_participation.groupBy({
      by: ['challenge_id'],
      where: { is_completed: true },
      _count: { user_id: true },
    }),
  ]);

  const participantsMap = new Map<string, number>();
  participation.forEach((row) => {
    participantsMap.set(row.challenge_id, row._count.user_id);
  });

  const completionsMap = new Map<string, number>();
  completions.forEach((row) => {
    completionsMap.set(row.challenge_id, row._count.user_id);
  });

  return challenges.map((challenge) => {
    const participants = participantsMap.get(challenge.id) || 0;
    const completed = completionsMap.get(challenge.id) || 0;
    const completionRate = participants
      ? Math.round((completed / participants) * 100)
      : 0;

    return {
      ...challenge,
      participants,
      completionRate,
    };
  });
}

/** Mirrors user.service streak logic for dashboard challenge progress. */
function calculateMoodStreakDays(
  moodEntries: { created_at: Date }[]
): number {
  if (!moodEntries || moodEntries.length === 0) return 0;
  const sorted = [...moodEntries].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastEntryDate = new Date(sorted[0].created_at);
  lastEntryDate.setHours(0, 0, 0, 0);
  const diffTime = Math.abs(today.getTime() - lastEntryDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays > 1) return 0;

  let streak = 1;
  let currentDate = lastEntryDate;
  for (let i = 1; i < sorted.length; i++) {
    const entryDate = new Date(sorted[i].created_at);
    entryDate.setHours(0, 0, 0, 0);
    const diff = Math.abs(currentDate.getTime() - entryDate.getTime());
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days === 0) continue;
    if (days === 1) {
      streak++;
      currentDate = entryDate;
    } else {
      break;
    }
  }
  return streak;
}

function getChallengeTargetFromCriteria(goalCriteria: unknown): number {
  const gc =
    goalCriteria && typeof goalCriteria === 'object'
      ? (goalCriteria as Record<string, unknown>)
      : {};
  const t = gc.target ?? gc.targetCount;
  if (typeof t === 'number' && t > 0) return Math.min(9999, Math.floor(t));
  const tasks = gc.dailyTasks;
  if (Array.isArray(tasks) && tasks.length > 0) return tasks.length;
  return 7;
}

function mapDifficultyLabel(goalCriteria: unknown): 'Easy' | 'Medium' | 'Hard' {
  const gc =
    goalCriteria && typeof goalCriteria === 'object'
      ? (goalCriteria as Record<string, unknown>)
      : {};
  const d = String(gc.difficulty || 'easy').toLowerCase();
  if (d === 'medium') return 'Medium';
  if (d === 'hard') return 'Hard';
  return 'Easy';
}

async function computeChallengeProgressForUser(
  userId: string,
  challenge: {
    id: string;
    title: string;
    category: string | null;
    start_date: Date;
    end_date: Date;
    goal_criteria: unknown;
  },
  participation: { progress: number | null; is_completed: boolean | null } | null,
  profileStreakDays: number
): Promise<number> {
  const target = getChallengeTargetFromCriteria(challenge.goal_criteria);
  if (participation?.is_completed) {
    return target;
  }
  if (
    typeof participation?.progress === 'number' &&
    participation.progress > 0
  ) {
    return Math.min(participation.progress, target);
  }

  const gc = (challenge.goal_criteria || {}) as Record<string, unknown>;
  const metric = typeof gc.metric === 'string' ? gc.metric : '';
  const title = (challenge.title || '').toLowerCase();
  const cat = (challenge.category || '').toLowerCase();
  const start = challenge.start_date;
  const end = challenge.end_date;

  let raw = 0;

  if (
    metric === 'mood_streak' ||
    title.includes('check-in') ||
    title.includes('check in') ||
    title.includes('daily check')
  ) {
    raw = Math.min(profileStreakDays, target);
  } else if (metric === 'meditation_sessions' || title.includes('meditation')) {
    raw = await prisma.user_wellness_progress.count({
      where: {
        user_id: userId,
        completed_at: { gte: start, lte: end, not: null },
        wellness_tools: { category: 'Meditation' },
      },
    });
  } else if (
    metric === 'journal_entries' ||
    cat === 'journaling' ||
    title.includes('journal')
  ) {
    raw = await prisma.journal_entries.count({
      where: { user_id: userId, created_at: { gte: start, lte: end } },
    });
  } else if (metric === 'breathing' || title.includes('breath')) {
    raw = await prisma.user_wellness_progress.count({
      where: {
        user_id: userId,
        completed_at: { gte: start, lte: end, not: null },
        wellness_tools: { category: 'Relaxation' },
      },
    });
  } else if (metric === 'wellness_sessions' || title.includes('wellness warrior')) {
    raw = await prisma.user_wellness_progress.count({
      where: {
        user_id: userId,
        completed_at: { gte: start, lte: end, not: null },
      },
    });
  } else if (metric === 'sleep_nights' || title.includes('sleep')) {
    raw = await prisma.sleep_entries.count({
      where: { user_id: userId, created_at: { gte: start, lte: end } },
    });
  } else if (metric === 'mood_entries' || title.includes('mood')) {
    raw = await prisma.mood_entries.count({
      where: { user_id: userId, created_at: { gte: start, lte: end } },
    });
  } else {
    raw = typeof participation?.progress === 'number' ? participation.progress : 0;
  }

  return Math.min(Math.max(0, raw), target);
}

/**
 * Active challenges with per-user progress for dashboard / app UI.
 */
export async function getWellnessChallengesForUserDashboard(userId: string) {
  const now = new Date();

  const [challenges, recentMoods] = await Promise.all([
    prisma.wellness_challenges.findMany({
      where: {
        start_date: { lte: now },
        end_date: { gte: now },
      },
      orderBy: { end_date: 'asc' },
      take: 12,
    }),
    prisma.mood_entries.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 60,
      select: { created_at: true },
    }),
  ]);

  const streakDays = calculateMoodStreakDays(recentMoods);

  if (challenges.length === 0) {
    return {
      totalPoints: 0,
      currentLevel: 1,
      pointsToNextLevel: 250,
      levelProgressPercent: 0,
      challenges: [] as Array<Record<string, unknown>>,
    };
  }

  const participationRows = await prisma.user_challenge_participation.findMany({
    where: {
      user_id: userId,
      challenge_id: { in: challenges.map((c) => c.id) },
    },
  });
  const partMap = new Map(participationRows.map((p) => [p.challenge_id, p]));

  const completedForPoints = await prisma.user_challenge_participation.findMany({
    where: { user_id: userId, is_completed: true },
    include: {
      wellness_challenges: { select: { reward_points: true } },
    },
  });
  const totalPoints = completedForPoints.reduce(
    (sum, row) => sum + (row.wellness_challenges.reward_points ?? 0),
    0
  );

  const withinThousand = totalPoints % 1000;
  const pointsToNextLevel =
    totalPoints === 0 ? 250 : withinThousand === 0 ? 1000 : 1000 - withinThousand;
  const levelProgressPercent =
    totalPoints === 0 ? 0 : Math.min(100, (withinThousand / 1000) * 100);
  const currentLevel = Math.max(
    1,
    Math.min(99, Math.floor(totalPoints / 200) + 1)
  );

  const mapped = [];
  for (const c of challenges) {
    const part = partMap.get(c.id) ?? null;
    const target = Math.max(1, getChallengeTargetFromCriteria(c.goal_criteria));
    const progress = await computeChallengeProgressForUser(
      userId,
      c,
      part,
      streakDays
    );
    const isCompleted = part?.is_completed === true || progress >= target;
    const gc = (c.goal_criteria || {}) as Record<string, unknown>;
    const isLocked = gc.locked === true;

    mapped.push({
      id: c.id,
      title: c.title,
      description: c.description ?? '',
      progress,
      target,
      reward: c.reward_points ?? 0,
      difficulty: mapDifficultyLabel(c.goal_criteria),
      isCompleted,
      isLocked,
      category: c.category,
      endDate: c.end_date.toISOString(),
    });
  }

  return {
    totalPoints,
    currentLevel,
    pointsToNextLevel:
      totalPoints === 0 ? 250 : Math.min(1000, Math.max(0, pointsToNextLevel)),
    levelProgressPercent: Number.isFinite(levelProgressPercent)
      ? levelProgressPercent
      : 0,
    challenges: mapped,
  };
}

export async function getWellnessTools(userId: string, category?: string) {
  const now = Date.now();
  const cacheKey = `${userId}_${category || 'all'}`;
  const cached = wellnessToolsCache.get(cacheKey);
  if (cached && (now - cached.timestamp < WELLNESS_TOOLS_CACHE_TTL)) {
    return cached.data;
  }

  const where = category ? { category } : {};
  const tools = await prisma.wellness_tools.findMany({
    where,
    orderBy: { created_at: 'desc' },
    include: {
      profiles: {
        select: {
          full_name: true,
        }
      },
      favorite_wellness_tools: {
        where: { user_id: userId },
        select: { created_at: true }
      }
    }
  });

  const result = tools.map(tool => ({
    ...tool,
    is_favorite: tool.favorite_wellness_tools.length > 0,
    favorite_wellness_tools: undefined
  }));

  wellnessToolsCache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}

export async function toggleWellnessToolFavorite(userId: string, toolId: string) {
  const tool = await prisma.wellness_tools.findUnique({
    where: { id: toolId }
  });

  if (!tool) {
    throw new Error('Wellness tool not found');
  }

  const existing = await prisma.favorite_wellness_tools.findUnique({
    where: {
      user_id_tool_id: {
        user_id: userId,
        tool_id: toolId
      }
    }
  });

  if (existing) {
    await prisma.favorite_wellness_tools.delete({
      where: {
        user_id_tool_id: {
          user_id: userId,
          tool_id: toolId
        }
      }
    });
    clearWellnessToolCaches();
    return { is_favorite: false };
  } else {
    await prisma.favorite_wellness_tools.create({
      data: {
        user_id: userId,
        tool_id: toolId
      }
    });
    clearWellnessToolCaches();
    return { is_favorite: true };
  }
}

export async function getWellnessToolById(userId: string, id: string) {
  const tool = await prisma.wellness_tools.findUnique({
    where: { id },
    include: {
      favorite_wellness_tools: {
        where: { user_id: userId }
      }
    }
  });

  if (!tool) return null;

  return {
    ...tool,
    is_favorite: tool.favorite_wellness_tools.length > 0,
    favorite_wellness_tools: undefined
  };
}

export async function updateWellnessTool(id: string, data: UpdateWellnessToolInput) {
  const patch: {
    title?: string;
    description?: string | null;
    category?: string;
    duration_minutes?: number | null;
    duration_seconds?: number | null;
    difficulty?: string | null;
    is_premium?: boolean | null;
    status?: string | null;
    icon?: string | null;
    content_url?: string | null;
    updated_at: Date;
  } = { updated_at: new Date() };

  if (data.title !== undefined) patch.title = data.title;
  if (data.description !== undefined) patch.description = data.description;
  if (data.category !== undefined) patch.category = data.category;
  if (data.duration_minutes !== undefined || data.duration_seconds !== undefined) {
    const existing = await prisma.wellness_tools.findUnique({
      where: { id },
      select: { duration_minutes: true, duration_seconds: true },
    });
    const merged = resolveDurationFields({
      duration_minutes:
        data.duration_minutes !== undefined ? data.duration_minutes : existing?.duration_minutes,
      duration_seconds:
        data.duration_seconds !== undefined ? data.duration_seconds : existing?.duration_seconds,
    });
    patch.duration_minutes = merged.duration_minutes;
    patch.duration_seconds = merged.duration_seconds;
  }
  if (data.difficulty !== undefined) patch.difficulty = data.difficulty;
  if (data.is_premium !== undefined) patch.is_premium = data.is_premium;
  if (data.status !== undefined) patch.status = data.status;
  if (data.icon !== undefined) patch.icon = data.icon;
  if (data.content !== undefined) patch.content_url = data.content;
  else if (data.image_url !== undefined) patch.content_url = data.image_url;

  const updated = await prisma.wellness_tools.update({
    where: { id },
    data: patch,
  });
  clearWellnessToolCaches();
  return updated;
}

export async function deleteWellnessTool(id: string) {
  const deleted = await prisma.wellness_tools.delete({
    where: { id },
  });
  clearWellnessToolCaches();
  return deleted;
}

export async function trackWellnessProgress(userId: string, toolId: string, durationSpent: number, rating?: number) {
  const tool = await prisma.wellness_tools.findUnique({
    where: { id: toolId }
  });

  if (!tool) {
    throw new Error('Wellness tool not found');
  }

  const result = await prisma.user_wellness_progress.create({
    data: {
      user_id: userId,
      tool_id: toolId,
      duration_spent: durationSpent,
      feedback_rating: rating,
      completed_at: new Date(),
    },
  });
  clearUserWellnessCaches(userId);
  return result;
}

export async function startWellnessSession(userId: string, toolId: string) {
  // Check if profile exists
  const profile = await prisma.profiles.findUnique({
    where: { id: userId }
  });

  if (!profile) {
    throw new Error('User profile not found. Please complete onboarding.');
  }

  // Check if tool exists
  const tool = await prisma.wellness_tools.findUnique({
    where: { id: toolId }
  });

  if (!tool) {
    throw new Error('Wellness tool not found');
  }

  const session = await prisma.user_wellness_progress.create({
    data: {
      user_id: userId,
      tool_id: toolId,
      duration_spent: 0,
      completed_at: null,
    },
  });
  clearUserWellnessCaches(userId);
  return session;
}

export async function completeWellnessSession(userId: string, progressId: string, durationSpent: number, rating?: number) {
  const progress = await prisma.user_wellness_progress.findFirst({
    where: {
      id: progressId,
      user_id: userId,
    },
  });

  if (!progress) {
    throw new Error('Session not found');
  }

  const result = await prisma.user_wellness_progress.update({
    where: { id: progressId },
    data: {
      duration_spent: durationSpent,
      feedback_rating: rating,
      completed_at: new Date(),
    },
  });
  clearUserWellnessCaches(result.user_id);
  return result;
}

export async function getUserWellnessProgress(userId: string) {
  const cached = progressCache.get(userId);
  if (cached && (Date.now() - cached.timestamp < PROGRESS_CACHE_TTL)) {
    return cached.data;
  }

  const progress = await prisma.$queryRaw<any[]>`
    SELECT 
      wp.tool_id, 
      wt.title as "toolTitle", 
      COUNT(wp.tool_id)::int as "sessionsCompleted", 
      SUM(wp.duration_spent)::int as "totalSeconds"
    FROM user_wellness_progress wp
    JOIN wellness_tools wt ON wp.tool_id = wt.id
    WHERE wp.user_id = ${userId}::uuid
      AND wp.completed_at IS NOT NULL 
      AND wp.duration_spent > 0
    GROUP BY wp.tool_id, wt.title
  `;

  const result = progress.map(p => {
    const totalSeconds = Number(p.totalSeconds) || 0;
    return {
      toolId: p.tool_id,
      toolTitle: p.toolTitle,
      sessionsCompleted: p.sessionsCompleted,
      totalSeconds,
      totalMinutes: Math.round(totalSeconds / 60),
    };
  });

  progressCache.set(userId, { data: result, timestamp: Date.now() });
  return result;
}

export async function getWellnessStats(userId: string) {
  const cached = wellnessStatsCache.get(userId);
  if (cached && (Date.now() - cached.timestamp < WELLNESS_STATS_CACHE_TTL)) {
    return cached.data;
  }

  const today = new Date();
  
  // 1. Time Ranges
  // Weekly: Last 4 Weeks
  const fourWeeksAgo = new Date(today);
  fourWeeksAgo.setDate(today.getDate() - 28);
  
  // Monthly: Last 6 Months
  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setMonth(today.getMonth() - 5); 
  sixMonthsAgo.setDate(1); 

  // Helper to group by week
  const getWeekNumber = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const diff = d.getTime() - fourWeeksAgo.getTime();
    return Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
  };

  // Run independent queries in parallel
  const [
    sessionsResult,
    moodsResult,
    wellnessResult,
    journalsResult,
    avgMoodResult,
    sleepEntries,
    postsCount,
    commentsCount
  ] = await Promise.all([
    // Sessions (Last 6 Months)
    prisma.app_sessions.findMany({
      where: {
        user_id: userId,
        started_at: { gte: sixMonthsAgo },
        ended_at: { not: null }
      },
      select: { started_at: true }
    }),
    // Moods (Last 6 Months)
    prisma.mood_entries.findMany({
      where: {
        user_id: userId,
        created_at: { gte: sixMonthsAgo }
      },
      select: { created_at: true }
    }),
    // Wellness Progress (Last 6 Months)
    prisma.user_wellness_progress.findMany({
      where: {
        user_id: userId,
        completed_at: { gte: sixMonthsAgo }
      },
      select: { completed_at: true }
    }),
    // Journals (Last 6 Months)
    prisma.journal_entries.findMany({
      where: {
        user_id: userId,
        created_at: { gte: sixMonthsAgo }
      },
      select: { created_at: true }
    }),

    // Average Mood Intensity (Last 4 weeks)
    prisma.mood_entries.aggregate({
      where: {
        user_id: userId,
        created_at: { gte: fourWeeksAgo }
      },
      _avg: { intensity: true }
    }),

    // Sleep Entries (Recent 10)
    prisma.sleep_entries.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 10,
      select: { quality_rating: true }
    }),

    // Social Counts (Total)
    prisma.community_posts.count({ where: { user_id: userId } }),
    prisma.community_comments.count({ where: { user_id: userId } })
  ]);

  // --- Process Results ---
  
  // Helper to process raw dates into daily counts
  const processDates = (items: any[], dateField: string) => {
    const counts = new Map<string, number>();
    items.forEach(item => {
      const date = item[dateField];
      if (date) {
        const key = date.toISOString().split('T')[0]; // YYYY-MM-DD
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    });
    return Array.from(counts.entries()).map(([day, count]) => ({ day, count }));
  };

  const sessionsCounts = processDates(sessionsResult, 'started_at');
  const moodsCounts = processDates(moodsResult, 'created_at');
  const wellnessCounts = processDates(wellnessResult, 'completed_at');
  const journalsCounts = processDates(journalsResult, 'created_at');

  // Initialize Weekly Data
  const weeklyData = Array(4).fill(0).map((_, i) => ({
    name: `Week ${i + 1}`,
    sessions: 0,
    mood: 0,
    wellness: 0,
    journals: 0 // Track for mental score calculation
  }));

  const processWeekly = (rows: { day: string; count: number }[], type: 'sessions' | 'mood' | 'wellness' | 'journals') => {
    rows.forEach((row) => {
      const date = new Date(row.day);
      if (date >= fourWeeksAgo) {
        const week = getWeekNumber(date);
        if (week >= 0 && week < 4) {
          weeklyData[week][type] += row.count;
        }
      }
    });
  };

  processWeekly(sessionsCounts, 'sessions');
  processWeekly(moodsCounts, 'mood');
  processWeekly(wellnessCounts, 'wellness');
  processWeekly(journalsCounts, 'journals');

  // Initialize Monthly Data
  const monthlyActivity: { month: string; value: number; _key: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today);
    d.setMonth(today.getMonth() - i);
    const monthName = d.toLocaleString('default', { month: 'short' });
    const monthKey = `${d.getFullYear()}-${d.getMonth()}`; 
    
    monthlyActivity.push({
      month: monthName,
      value: 0,
      _key: monthKey
    });
  }

  const processMonthly = (rows: { day: string; count: number }[]) => {
    rows.forEach((row) => {
      const d = new Date(row.day);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const monthItem = monthlyActivity.find(m => m._key === key);
      if (monthItem) monthItem.value += row.count;
    });
  };

  processMonthly(sessionsCounts);
  processMonthly(moodsCounts);
  processMonthly(wellnessCounts);
  processMonthly(journalsCounts);

  const finalMonthlyActivity = monthlyActivity.map(({ _key, ...rest }) => rest);

  // --- Wellness Score Calculation ---
  const avgMood = (avgMoodResult as any)._avg.intensity || 0;
  const emotionalScore = Math.min(avgMood * 10, 100);

  const avgSleep = sleepEntries.length > 0
    ? sleepEntries.reduce((acc, curr) => acc + (curr.quality_rating || 0), 0) / sleepEntries.length
    : 0;
  const sleepScore = Math.min(avgSleep * 10, 100);

  // Social Score
  const socialCount = Number(postsCount) + Number(commentsCount);
  const socialScore = Math.min((socialCount / 5) * 100, 100);

  // Mental: Journals + Sessions + Wellness Exercises (Last 4 weeks)
  const recentJournals = weeklyData.reduce((acc, w) => acc + w.journals, 0);
  const recentSessions = weeklyData.reduce((acc, w) => acc + w.sessions, 0);
  const recentWellness = weeklyData.reduce((acc, w) => acc + w.wellness, 0);
  
  const mentalCount = recentJournals + recentSessions + recentWellness;
  const mentalScore = Math.min((mentalCount / 5) * 100, 100);

  // Physical: Placeholder
  const physicalScore = 65; 

  const wellnessScore = [
    { subject: 'Emotional', A: Math.round(emotionalScore), fullMark: 100 },
    { subject: 'Mental', A: Math.round(mentalScore), fullMark: 100 },
    { subject: 'Physical', A: physicalScore, fullMark: 100 },
    { subject: 'Social', A: Math.round(socialScore), fullMark: 100 },
    { subject: 'Sleep', A: Math.round(sleepScore), fullMark: 100 },
  ];

  // Remove 'journals' from weeklyData response to match original shape
  const finalWeeklyData = weeklyData.map(({ journals, ...rest }) => rest);

  const result = {
    weeklyProgress: finalWeeklyData,
    monthlyActivity: finalMonthlyActivity,
    wellnessScore
  };

  wellnessStatsCache.set(userId, { data: result, timestamp: Date.now() });
  return result;
}
