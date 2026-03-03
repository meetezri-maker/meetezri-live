import prisma from '../../lib/prisma';
import { CreateWellnessToolInput, UpdateWellnessToolInput } from './wellness.schema';

const PROGRESS_CACHE_TTL = 30 * 1000; // 30 seconds
const progressCache = new Map<string, { data: any[]; timestamp: number }>();

const WELLNESS_TOOLS_CACHE_TTL = 60 * 1000; // 60 seconds
const wellnessToolsCache = new Map<string, { data: any[]; timestamp: number }>();

const WELLNESS_STATS_CACHE_TTL = 60 * 1000; // 60 seconds
const wellnessStatsCache = new Map<string, { data: any; timestamp: number }>();

export async function createWellnessTool(data: CreateWellnessToolInput & { created_by?: string }) {
  const { created_by, image_url, content, ...rest } = data;

  return prisma.wellness_tools.create({
    data: {
      title: data.title,
      category: data.category,
      description: data.description,
      duration_minutes: data.duration_minutes,
      difficulty: data.difficulty,
      is_premium: data.is_premium,
      status: data.status,
      icon: data.icon,
      content_url: image_url,
      ...(created_by ? {
        profiles: {
          connect: { id: created_by },
        }
      } : {}),
    },
  });
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
    return { is_favorite: false };
  } else {
    await prisma.favorite_wellness_tools.create({
      data: {
        user_id: userId,
        tool_id: toolId
      }
    });
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
  return prisma.wellness_tools.update({
    where: { id },
    data: {
      ...data,
      updated_at: new Date(),
    },
  });
}

export async function deleteWellnessTool(id: string) {
  return prisma.wellness_tools.delete({
    where: { id },
  });
}

export async function trackWellnessProgress(userId: string, toolId: string, durationSpent: number, rating?: number) {
  const result = await prisma.user_wellness_progress.create({
    data: {
      user_id: userId,
      tool_id: toolId,
      duration_spent: durationSpent,
      feedback_rating: rating,
      completed_at: new Date(),
    },
  });
  progressCache.delete(userId);
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

  return prisma.user_wellness_progress.create({
    data: {
      user_id: userId,
      tool_id: toolId,
      duration_spent: 0,
      completed_at: null,
    },
  });
}

export async function completeWellnessSession(progressId: string, durationSpent: number, rating?: number) {
  const result = await prisma.user_wellness_progress.update({
    where: { id: progressId },
    data: {
      duration_spent: durationSpent,
      feedback_rating: rating,
      completed_at: new Date(),
    },
  });
  progressCache.delete(result.user_id);
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

  const result = progress.map(p => ({
    toolId: p.tool_id,
    toolTitle: p.toolTitle,
    sessionsCompleted: p.sessionsCompleted,
    totalMinutes: Math.round((p.totalSeconds || 0) / 60),
  }));

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
