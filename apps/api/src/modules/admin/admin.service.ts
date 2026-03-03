
import prisma from '../../lib/prisma';
import { Prisma } from '@prisma/client';
import { DashboardStats } from './admin.schema';
import { endSession } from '../sessions/sessions.service';

// Simple in-memory cache for dashboard stats
const STATS_CACHE_TTL = 60 * 1000; // 60 seconds
let statsCache: { data: DashboardStats; timestamp: number } | null = null;

// Simple in-memory cache for users list
const USERS_CACHE_TTL = 30 * 1000; // 30 seconds
const usersCache = new Map<string, { data: any[], timestamp: number }>();

// New caches for slow endpoints
const RECENT_ACTIVITY_CACHE_TTL = 30 * 1000; // 30 seconds
let recentActivityCache: { data: any; timestamp: number } | null = null;

const MANUAL_NOTIFICATIONS_CACHE_TTL = 60 * 1000; // 60 seconds
let manualNotificationsCache: { data: any[]; timestamp: number } | null = null;

const NUDGE_TEMPLATES_CACHE_TTL = 120 * 1000; // 120 seconds
let nudgeTemplatesCache: { data: any[]; timestamp: number } | null = null;

const COMMUNITY_STATS_CACHE_TTL = 60 * 1000; // 60 seconds
let communityStatsCache: { data: any; timestamp: number } | null = null;

const COMMUNITY_GROUPS_CACHE_TTL = 60 * 1000; // 60 seconds
let communityGroupsCache: { data: any[]; timestamp: number } | null = null;

const ACTIVITY_LOGS_CACHE_TTL = 120 * 1000; // 120 seconds
let activityLogsCache: { data: any[]; timestamp: number } | null = null;

const CRISIS_EVENTS_CACHE_TTL = 120 * 1000; // 120 seconds
const crisisEventsCache = new Map<string, { data: any[]; timestamp: number }>();

const EMAIL_TEMPLATES_CACHE_TTL = 120 * 1000; // 120 seconds
let emailTemplatesCache: { data: any[]; timestamp: number } | null = null;

const ERROR_LOGS_CACHE_TTL = 120 * 1000; // 120 seconds
let errorLogsCache: { data: any[]; timestamp: number } | null = null;

const LIVE_SESSIONS_CACHE_TTL = 120 * 1000; // 120 seconds
let liveSessionsCache: { data: any[]; timestamp: number } | null = null;

export async function getDashboardStats(): Promise<DashboardStats> {
  const now = Date.now();
  if (statsCache && (now - statsCache.timestamp < STATS_CACHE_TTL)) {
    return statsCache.data;
  }
  // Use 'now' from above
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  
  const [countsResult, revenueResult, dailyStats, hourlyStats] = await Promise.all([
    // 1. Optimized: Single query for all counts using raw SQL
    prisma.$queryRaw`
      SELECT 
        (SELECT count(*) FROM profiles) as total_users,
        (SELECT count(*) FROM app_sessions WHERE started_at IS NOT NULL AND ended_at IS NULL) as active_sessions,
        (SELECT count(*) FROM app_sessions) as total_sessions,
        (SELECT AVG(duration_minutes) FROM app_sessions) as avg_duration,
        (SELECT count(*) FROM crisis_events WHERE status = 'pending') as pending_crisis,
        (SELECT count(*) FROM mood_entries) as mood_entries,
        (SELECT count(*) FROM journal_entries) as journal_entries,
        (SELECT count(*) FROM sleep_entries) as sleep_entries,
        (SELECT count(*) FROM habit_logs) as habit_logs,
        (SELECT count(*) FROM user_wellness_progress) as wellness_progress,
        (SELECT count(*) FROM crisis_events) as total_crisis
    `,
    // 2. Calculate MRR (Monthly Recurring Revenue) from active subscriptions
    prisma.subscriptions.aggregate({
      _sum: { amount: true },
      where: { status: 'active' }
    }),
    // 3. Real session activity for last 7 days - Optimized with Group By
    prisma.$queryRaw`
      SELECT 
        DATE(started_at) as date,
        COUNT(*) as count,
        COALESCE(SUM(duration_minutes), 0) as total_duration
      FROM app_sessions
      WHERE started_at >= ${sevenDaysAgo}
      GROUP BY DATE(started_at)
    `,
    // 4. Hourly stats for last 7 days - Optimized
    prisma.$queryRaw`
      SELECT 
        EXTRACT(HOUR FROM started_at) as hour,
        COUNT(*) as count
      FROM app_sessions
      WHERE started_at >= ${sevenDaysAgo}
      GROUP BY EXTRACT(HOUR FROM started_at)
    `
  ]);

  const counts = (countsResult as any[])[0] || {};

  const totalUsers = Number(counts.total_users || 0);
  const activeSessions = Number(counts.active_sessions || 0);
  const totalSessions = Number(counts.total_sessions || 0);
  const avgSessionLength = Math.round(Number(counts.avg_duration || 0));
  const crisisAlerts = Number(counts.pending_crisis || 0);
  const moodEntriesCount = Number(counts.mood_entries || 0);
  const journalEntriesCount = Number(counts.journal_entries || 0);
  const sleepEntriesCount = Number(counts.sleep_entries || 0);
  const habitLogsCount = Number(counts.habit_logs || 0);
  const wellnessProgressCount = Number(counts.wellness_progress || 0);
  const crisisEventsCount = Number(counts.total_crisis || 0);

  const revenue = revenueResult._sum.amount?.toNumber() || 0;

  const sessionActivity = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    
    // Find matching stat
    const stat = (dailyStats as any[]).find((s: any) => {
      const sDate = new Date(s.date);
      return sDate.getDate() === d.getDate() && sDate.getMonth() === d.getMonth();
    });
    
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    
    return {
      day: dayName,
      sessions: stat ? Number(stat.count) : 0,
      duration: stat && Number(stat.count) > 0 ? Math.round(Number(stat.total_duration) / Number(stat.count)) : 0
    };
  });

  const hourlyBuckets = new Array(24).fill(0).map((_, hour) => ({
    hour,
    sessions: 0
  }));

  (hourlyStats as any[]).forEach((stat: any) => {
    const hour = Number(stat.hour);
    if (hour >= 0 && hour < 24) {
      hourlyBuckets[hour].sessions = Number(stat.count);
    }
  });

  const hourlyActivity = hourlyBuckets.map(bucket => {
    const hour = bucket.hour;
    let label = "";
    if (hour === 0) {
      label = "12am";
    } else if (hour < 12) {
      label = `${hour}am`;
    } else if (hour === 12) {
      label = "12pm";
    } else {
      label = `${hour - 12}pm`;
    }
    return {
      hour: label,
      sessions: bucket.sessions
    };
  });

  // System Health - Still hard to get real metrics without infra access
  const systemHealth = [
    { name: "API Response Time", value: "45ms", status: "excellent", color: "text-green-600", percentage: 95 },
    { name: "Server Uptime", value: "99.98%", status: "excellent", color: "text-green-600", percentage: 99 },
    { name: "Database Load", value: "42%", status: "good", color: "text-blue-600", percentage: 58 },
    { name: "CDN Performance", value: "98%", status: "excellent", color: "text-green-600", percentage: 98 },
  ];

  // User Growth - Mocked trend but scaled to real total
  // (Implementing real monthly aggregation requires raw SQL or complex grouping not easily done with simple Prisma findMany)
  const userGrowth = [
    { month: "Jan", users: Math.floor(totalUsers * 0.7), orgs: 0 },
    { month: "Feb", users: Math.floor(totalUsers * 0.75), orgs: 0 },
    { month: "Mar", users: Math.floor(totalUsers * 0.8), orgs: 0 },
    { month: "Apr", users: Math.floor(totalUsers * 0.85), orgs: 0 },
    { month: "May", users: Math.floor(totalUsers * 0.9), orgs: 0 },
    { month: "Jun", users: Math.floor(totalUsers * 0.95), orgs: 0 },
    { month: "Jul", users: totalUsers, orgs: 0 },
  ];

  // Revenue Data - Mocked trend scaled to real revenue
  const revenueData = [
    { month: "Jan", revenue: Math.floor(revenue * 0.7) },
    { month: "Feb", revenue: Math.floor(revenue * 0.75) },
    { month: "Mar", revenue: Math.floor(revenue * 0.8) },
    { month: "Apr", revenue: Math.floor(revenue * 0.85) },
    { month: "May", revenue: Math.floor(revenue * 0.9) },
    { month: "Jun", revenue: Math.floor(revenue * 0.95) },
    { month: "Jul", revenue: revenue },
  ];

  const featureUsageRaw = [
    { feature: "AI Sessions", count: totalSessions },
    { feature: "Mood Tracking", count: moodEntriesCount },
    { feature: "Journal", count: journalEntriesCount },
    { feature: "Sleep Tracker", count: sleepEntriesCount },
    { feature: "Habit Tracker", count: habitLogsCount },
    { feature: "Wellness Tools", count: wellnessProgressCount },
    { feature: "Crisis Resources", count: crisisEventsCount }
  ];

  const maxFeatureCount = featureUsageRaw.reduce((max, item) => {
    return item.count > max ? item.count : max;
  }, 0);

  const featureUsage = featureUsageRaw.map(item => ({
    feature: item.feature,
    usage: maxFeatureCount > 0 ? Math.round((item.count / maxFeatureCount) * 100) : 0
  }));

  const platformDistribution = [
    { name: "Mobile App", value: 58, color: "#8b5cf6" },
    { name: "Web", value: 32, color: "#ec4899" },
    { name: "Desktop", value: 10, color: "#06b6d4" },
  ];

  const result = {
    totalUsers,
    activeSessions,
    totalSessions,
    avgSessionLength,
    crisisAlerts,
    revenue,
    systemHealth,
    userGrowth,
    sessionActivity,
    hourlyActivity,
    revenueData,
    platformDistribution,
    featureUsage
  };

  statsCache = { data: result, timestamp: Date.now() };
  return result;
}

export async function getRecentActivity() {
  const now = Date.now();
  if (recentActivityCache && (now - recentActivityCache.timestamp < RECENT_ACTIVITY_CACHE_TTL)) {
    return recentActivityCache.data;
  }

  const [alerts, moodEntries, sessions] = await Promise.all([
    prisma.crisis_events.findMany({
      where: { status: 'pending' },
      take: 5,
      orderBy: { created_at: 'desc' },
      include: { profiles_crisis_events_user_idToprofiles: { select: { full_name: true, email: true } } }
    }),
    prisma.mood_entries.findMany({
      take: 5,
      orderBy: { created_at: 'desc' },
      include: { profiles: { select: { full_name: true, email: true } } }
    }),
    prisma.app_sessions.findMany({
      take: 5,
      orderBy: { started_at: 'desc' },
      include: { profiles: { select: { full_name: true, email: true } } }
    })
  ]);

  const alertsMapped = alerts.map(alert => ({
    ...alert,
    profiles: alert.profiles_crisis_events_user_idToprofiles
  }));

  const result = { alerts: alertsMapped, moodEntries, sessions };
  recentActivityCache = { data: result, timestamp: Date.now() };
  return result;
}

export async function getAllUsers(page: number = 1, limit: number = 20) {
  const cacheKey = `${page}_${limit}`;
  const cached = usersCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < USERS_CACHE_TTL)) {
    return cached.data;
  }

  const skip = (page - 1) * limit;
  const take = Math.min(limit, 100);

  // Single optimized query to fetch all related data in one go
  const users = await prisma.profiles.findMany({
    take,
    skip,
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      email: true,
      full_name: true,
      avatar_url: true,
      created_at: true,
      updated_at: true,
      role: true,
      // Get session stats
      _count: {
        select: { 
          app_sessions: { 
            where: { ended_at: { not: null } } 
          } 
        }
      },
      app_sessions: {
        orderBy: { started_at: 'desc' },
        take: 1,
        select: { started_at: true }
      },
      // Get active subscription
      subscriptions: {
        where: { status: 'active' },
        orderBy: { created_at: 'desc' },
        take: 1,
        select: { plan_type: true }
      },
      // Get organization
      org_members: {
        take: 1,
        select: {
          organizations: { select: { name: true } }
        }
      },
      // Get latest mood
      mood_entries: {
        orderBy: { created_at: 'desc' },
        take: 1,
        select: { mood: true, intensity: true }
      }
    }
  });

  const result = users.map(user => {
    const lastSessionDate = user.app_sessions[0]?.started_at;
    const lastActive = lastSessionDate 
      ? (new Date(lastSessionDate).getTime() > new Date(user.updated_at).getTime() ? lastSessionDate : user.updated_at)
      : user.updated_at;

    const lastMood = user.mood_entries[0];
    const moodVal = lastMood?.mood;
    const intensity = lastMood?.intensity || 0;

    let riskLevel = 'low';
    if (moodVal === 'Sad' && intensity > 8) {
      riskLevel = 'high';
    } else if (moodVal === 'Anxious') {
      riskLevel = 'medium';
    }

    const sessionCount = user._count.app_sessions || 0;
    
    let status = 'inactive';
    if (user.role === 'suspended') {
      status = 'suspended';
    } else if (sessionCount > 0) {
      status = 'active';
    }

    return {
      id: user.id,
      email: user.email || '',
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
      updated_at: user.updated_at,
      role: user.role,
      status,
      subscription: user.subscriptions[0]?.plan_type || 'trial',
      session_count: sessionCount,
      last_active: lastActive,
      risk_level: riskLevel,
      organization: user.org_members[0]?.organizations?.name || 'Individual'
    };
  });

  usersCache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}

export async function getUserById(id: string) {
  const user = await prisma.profiles.findUnique({
    where: { id },
    include: {
      org_members: {
        include: {
          organizations: true
        }
      },
      _count: {
        select: {
          app_sessions: true,
          journal_entries: true,
          mood_entries: true,
          wellness_tools: true // using this for wellness streak proxy for now
        }
      }
    }
  });

  if (!user) return null;

  let status = 'inactive';
  if (user.role === 'suspended') {
    status = 'suspended';
  } else if (user._count.app_sessions > 0) {
    status = 'active';
  }

  return {
    ...user,
    email: user.email || '',
    created_at: user.created_at,
    updated_at: user.updated_at,
    status,
    // Map additional fields for frontend convenience
    organization: user.org_members[0]?.organizations.name || 'Individual',
    stats: {
      total_sessions: user._count.app_sessions,
      journal_entries: user._count.journal_entries,
      mood_entries: user._count.mood_entries,
    }
  };
}

export async function updateUser(id: string, data: { status?: string; role?: string }) {
  const existing = await prisma.profiles.findUnique({
    where: { id },
    select: {
      role: true,
    },
  });

  if (!existing) {
    throw new Error('User not found');
  }

  usersCache.clear(); // Invalidate cache

  const adminRoles = ['super_admin', 'org_admin', 'team_admin'];

  const updateData: any = {};

  if (data.role) {
    updateData.role = data.role;
  }

  if (data.status && !adminRoles.includes(existing.role || '')) {
    if (data.status === 'suspended') {
      updateData.role = 'suspended';
    }
    if (data.status === 'active' && existing.role === 'suspended') {
      updateData.role = 'user';
    }
  }

  const user = await prisma.profiles.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      full_name: true,
      avatar_url: true,
      created_at: true,
      updated_at: true,
      role: true,
    }
  });

  let status = 'inactive';
  if (user.role === 'suspended') {
    status = 'suspended';
  } else {
    status = data.status || 'active';
  }

  return {
    ...user,
    email: user.email || '',
    status
  };
}

export async function deleteUser(id: string) {
  // We should likely cascade delete or soft delete.
  // For now, we'll try to delete the profile.
  // Note: Foreign key constraints might prevent this if not handled.
  // Since we have cascading deletes on many relations, this might work, 
  // but 'users' table in auth schema might be the parent.
  // However, we can only control the public.profiles here easily.
  
  return prisma.profiles.delete({
    where: { id }
  });
}

export async function getUserAuditLogs(userId: string) {
  return prisma.audit_logs.findMany({
    where: { actor_id: userId },
    orderBy: { created_at: 'desc' },
    take: 50 // Limit to recent 50 logs
  });
}

// --- New Admin Features ---

// 1. User Segmentation
export async function getUserSegments() {
  return prisma.user_segments.findMany({
    orderBy: { created_at: 'desc' }
  });
}

export async function createUserSegment(data: any) {
  return prisma.user_segments.create({
    data
  });
}

export async function deleteUserSegment(id: string) {
  return prisma.user_segments.delete({
    where: { id }
  });
}

// 2. Notifications
export async function getManualNotifications() {
  const now = Date.now();
  if (manualNotificationsCache && (now - manualNotificationsCache.timestamp < MANUAL_NOTIFICATIONS_CACHE_TTL)) {
    return manualNotificationsCache.data;
  }

  // Assuming manual notifications are a subset or we track them. 
  // For now, let's fetch recent notifications sent by admin or just general logs.
  const result = await prisma.notifications.findMany({
    take: 50,
    orderBy: { created_at: 'desc' },
    include: {
      profiles: { select: { full_name: true, email: true } }
    }
  });

  manualNotificationsCache = { data: result, timestamp: Date.now() };
  return result;
}

export async function getNotificationAudienceCounts() {
  const [all, active, premium, trial] = await Promise.all([
    prisma.profiles.count(),
    prisma.app_sessions.groupBy({ // Proxy for active: users with sessions
      by: ['user_id'],
      _count: true
    }).then(res => res.length), 
    prisma.subscriptions.count({
      where: {
        status: 'active',
        plan_type: { not: 'trial' }
      }
    }),
    prisma.subscriptions.count({
      where: {
        plan_type: 'trial'
      }
    })
  ]);

  return {
    all,
    active,
    premium,
    trial
  };
}

export async function createManualNotification(data: any) {
  // Helper to check preferences
  const shouldSend = (prefs: any) => !prefs || prefs.pushEnabled !== false;

  const baseMetadata = {
    channel: data.channel || 'push',
    target_audience: data.target_audience,
    segment_id: data.segment_id || null,
    scheduled_for: data.scheduled_for || null,
    schedule_type: data.scheduled_for ? 'scheduled' : 'now',
  };

  if (data.target_audience === 'segment' && data.segment_id) {
    const allUsers = await prisma.profiles.findMany({
      select: { id: true, notification_preferences: true }
    });

    const eligibleUsers = allUsers.filter(u => shouldSend(u.notification_preferences));

    if (eligibleUsers.length === 0) return { count: 0 };

    return prisma.notifications.createMany({
      data: eligibleUsers.map(u => ({
        user_id: u.id,
        title: data.title,
        message: data.message,
        type: data.type || 'system',
        metadata: {
          ...baseMetadata,
          target_audience: 'segment',
          target_count: eligibleUsers.length,
        },
        created_at: new Date()
      }))
    });
  }

  if (data.target_audience === 'all') {
    const allUsers = await prisma.profiles.findMany({ 
      select: { id: true, notification_preferences: true } 
    });
    
    const eligibleUsers = allUsers.filter(u => shouldSend(u.notification_preferences));

    if (eligibleUsers.length === 0) return { count: 0 };
    
    return prisma.notifications.createMany({
      data: eligibleUsers.map(u => ({
        user_id: u.id,
        title: data.title,
        message: data.message,
        type: data.type || 'system',
        metadata: {
          ...baseMetadata,
          target_audience: 'all',
          target_count: eligibleUsers.length,
        },
        created_at: new Date()
      })),
    });
  }
  
  if (data.target_audience === 'premium') {
    const premiumUsers = await prisma.subscriptions.findMany({
      where: { status: 'active', plan_type: { not: 'trial' } },
      select: { 
        user_id: true,
        profiles: { select: { notification_preferences: true } }
      }
    });
    
    const eligibleUsers = premiumUsers.filter(u => shouldSend(u.profiles?.notification_preferences));
    
    if (eligibleUsers.length === 0) return { count: 0 };

    return prisma.notifications.createMany({
      data: eligibleUsers.map(s => ({
        user_id: s.user_id,
        title: data.title,
        message: data.message,
        type: data.type || 'system',
        metadata: {
          ...baseMetadata,
          target_audience: 'premium',
          target_count: eligibleUsers.length,
        },
        created_at: new Date()
      })),
    });
  }
  
  if (data.target_audience === 'trial') {
    const trialUsers = await prisma.subscriptions.findMany({
      where: { plan_type: 'trial' },
      select: { 
        user_id: true,
        profiles: { select: { notification_preferences: true } }
      }
    });
    
    const eligibleUsers = trialUsers.filter(u => shouldSend(u.profiles?.notification_preferences));
    
    if (eligibleUsers.length === 0) return { count: 0 };

    return prisma.notifications.createMany({
      data: eligibleUsers.map(s => ({
        user_id: s.user_id,
        title: data.title,
        message: data.message,
        type: data.type || 'system',
        metadata: {
          ...baseMetadata,
          target_audience: 'trial',
          target_count: eligibleUsers.length,
        },
        created_at: new Date()
      })),
    });
  }
  
  if (data.target_audience === 'active') {
    // Users with sessions in last 30 days
    const activeSessions = await prisma.app_sessions.groupBy({
      by: ['user_id'],
      where: {
        started_at: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      }
    });
    
    const userIds = activeSessions.map(s => s.user_id);
    
    if (userIds.length === 0) return { count: 0 };
    
    const activeUsers = await prisma.profiles.findMany({
      where: { id: { in: userIds } },
      select: { id: true, notification_preferences: true }
    });

    const eligibleUsers = activeUsers.filter(u => shouldSend(u.notification_preferences));
    
    if (eligibleUsers.length === 0) return { count: 0 };
    
    return prisma.notifications.createMany({
      data: eligibleUsers.map(u => ({
        user_id: u.id,
        title: data.title,
        message: data.message,
        type: data.type || 'system',
        metadata: {
          ...baseMetadata,
          target_audience: 'active',
          target_count: eligibleUsers.length,
        },
        created_at: new Date()
      })),
    });
  }

  if (data.userIds && Array.isArray(data.userIds)) {
    const users = await prisma.profiles.findMany({
      where: { id: { in: data.userIds } },
      select: { id: true, notification_preferences: true }
    });

    const eligibleUsers = users.filter(u => shouldSend(u.notification_preferences));

    if (eligibleUsers.length === 0) return { count: 0 };

    return prisma.notifications.createMany({
      data: eligibleUsers.map(u => ({
        user_id: u.id,
        title: data.title,
        message: data.message,
        type: data.type || 'system',
        metadata: {
          ...baseMetadata,
          target_audience: data.target_audience || 'specific',
          target_count: eligibleUsers.length,
        },
        created_at: new Date()
      })),
    });
  }
  
  if (data.user_id) {
    const user = await prisma.profiles.findUnique({
      where: { id: data.user_id },
      select: { notification_preferences: true }
    });

    if (!user || !shouldSend(user.notification_preferences)) {
       throw new Error("User has disabled notifications");
    }

    return prisma.notifications.create({
      data: {
        user_id: data.user_id,
        title: data.title,
        message: data.message,
        type: data.type || 'system',
        metadata: {
          ...baseMetadata,
          target_audience: data.target_audience || 'user',
          target_count: 1,
        },
      }
    });
  }
  
  // Fallback or error
  throw new Error("No target audience or user IDs provided");
}

export async function getNudges() {
  return prisma.nudges.findMany({
    orderBy: { created_at: 'desc' }
  });
}

export async function createNudge(data: any, createdBy?: string) {
  return prisma.nudges.create({
    data: {
      title: data.title,
      message: data.message,
      type: data.type,
      status: data.status ?? 'draft',
      target_audience: data.target_audience ?? null,
      schedule_time: data.schedule_time ?? null,
      is_recurring: data.is_recurring ?? false,
      created_by: createdBy,
    },
  });
}

export async function updateNudge(id: string, data: any) {
  return prisma.nudges.update({
    where: { id },
    data: {
      title: data.title,
      message: data.message,
      type: data.type,
      status: data.status,
      target_audience: data.target_audience,
      schedule_time: data.schedule_time,
      is_recurring: data.is_recurring,
    },
  });
}

export async function deleteNudge(id: string) {
  return prisma.nudges.delete({
    where: { id },
  });
}

export async function getNudgeTemplates() {
  const now = Date.now();
  if (nudgeTemplatesCache && (now - nudgeTemplatesCache.timestamp < NUDGE_TEMPLATES_CACHE_TTL)) {
    return nudgeTemplatesCache.data;
  }

  const result = await prisma.nudge_templates.findMany({
    orderBy: { created_at: 'desc' }
  });

  nudgeTemplatesCache = { data: result, timestamp: Date.now() };
  return result;
}

export async function createNudgeTemplate(data: any, createdBy?: string) {
  return prisma.nudge_templates.create({
    data: {
      name: data.name,
      category: data.category,
      type: data.type,
      title: data.title,
      message: data.message,
      variables: Array.isArray(data.variables) ? data.variables : [],
      status: data.status ?? 'active',
      usage: data.usage ?? 0,
      rating: data.rating ?? null,
      created_by: createdBy,
      last_used: data.last_used ?? null,
    },
  });
}

export async function updateNudgeTemplate(id: string, data: any) {
  return prisma.nudge_templates.update({
    where: { id },
    data: {
      name: data.name,
      category: data.category,
      type: data.type,
      title: data.title,
      message: data.message,
      variables: Array.isArray(data.variables) ? data.variables : undefined,
      status: data.status,
      usage: data.usage,
      rating: data.rating,
      last_used: data.last_used,
    },
  });
}

export async function deleteNudgeTemplate(id: string) {
  return prisma.nudge_templates.delete({
    where: { id },
  });
}

// 3. Email Templates
export async function getEmailTemplates() {
  const now = Date.now();
  if (emailTemplatesCache && (now - emailTemplatesCache.timestamp < EMAIL_TEMPLATES_CACHE_TTL)) {
    return emailTemplatesCache.data;
  }

  const result = await prisma.email_templates.findMany({
    orderBy: { name: 'asc' }
  });

  emailTemplatesCache = { data: result, timestamp: Date.now() };
  return result;
}

export async function createEmailTemplate(data: any) {
  return prisma.email_templates.create({ data });
}

export async function updateEmailTemplate(id: string, data: any) {
  return prisma.email_templates.update({
    where: { id },
    data
  });
}

export async function deleteEmailTemplate(id: string) {
  return prisma.email_templates.delete({ where: { id } });
}

// 4. Push Campaigns
export async function getPushCampaigns() {
  return prisma.push_campaigns.findMany({
    orderBy: { created_at: 'desc' }
  });
}

export async function createPushCampaign(data: any) {
  return prisma.push_campaigns.create({ data });
}

export async function updatePushCampaign(id: string, data: any) {
  return prisma.push_campaigns.update({
    where: { id },
    data
  });
}

export async function deletePushCampaign(id: string) {
  return prisma.push_campaigns.delete({
    where: { id }
  });
}

// 5. Support Tickets
export async function getSupportTickets() {
  return prisma.support_tickets.findMany({
    orderBy: { created_at: 'desc' },
    include: {
      profiles_support_tickets_user_idToprofiles: {
        select: { full_name: true, email: true, avatar_url: true }
      }
    }
  });
}

export async function updateSupportTicket(id: string, data: any) {
  return prisma.support_tickets.update({
    where: { id },
    data
  });
}

// 6. Community Management
export async function getCommunityStats() {
  const now = Date.now();
  if (communityStatsCache && (now - communityStatsCache.timestamp < COMMUNITY_STATS_CACHE_TTL)) {
    return communityStatsCache.data;
  }

  const [totalGroups, totalPosts, totalComments] = await Promise.all([
    prisma.community_groups.count(),
    prisma.community_posts.count(),
    prisma.community_comments.count()
  ]);
  
  const result = { totalGroups, totalPosts, totalComments };
  communityStatsCache = { data: result, timestamp: Date.now() };
  return result;
}

export async function getCommunityGroups() {
  const now = Date.now();
  if (communityGroupsCache && (now - communityGroupsCache.timestamp < COMMUNITY_GROUPS_CACHE_TTL)) {
    return communityGroupsCache.data;
  }

  const result = await prisma.community_groups.findMany({
    include: {
      _count: {
        select: { community_group_members: true, community_posts: true }
      }
    }
  });

  communityGroupsCache = { data: result, timestamp: Date.now() };
  return result;
}

// 7. Live Sessions
export async function getLiveSessions() {
  const now = Date.now();
  if (liveSessionsCache && (now - liveSessionsCache.timestamp < LIVE_SESSIONS_CACHE_TTL)) {
    return liveSessionsCache.data;
  }

  const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000);

  const result = await prisma.app_sessions.findMany({
    where: {
      started_at: {
        not: null,
        gte: cutoff
      },
      ended_at: null
    },
    include: {
      profiles: {
        select: { full_name: true, email: true, avatar_url: true }
      },
      _count: {
        select: { session_messages: true }
      }
    },
    orderBy: { started_at: 'desc' }
  });

  liveSessionsCache = { data: result, timestamp: Date.now() };
  return result;
}

export async function endLiveSessionByAdmin(sessionId: string) {
  const session = await prisma.app_sessions.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    throw new Error('Session not found');
  }

  if (session.ended_at) {
    return session;
  }

  return endSession(session.user_id, session.id);
}

export async function flagSessionForReview(sessionId: string) {
  const session = await prisma.app_sessions.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    throw new Error('Session not found');
  }

  const currentConfig = (session.config || {}) as any;
  const updatedConfig = {
    ...currentConfig,
    admin_flagged: true
  };

  return prisma.app_sessions.update({
    where: { id: sessionId },
    data: {
      config: updatedConfig
    }
  });
}
//
// 8. Activity Logs
export async function getActivityLogs() {
  const now = Date.now();
  if (activityLogsCache && (now - activityLogsCache.timestamp < ACTIVITY_LOGS_CACHE_TTL)) {
    return activityLogsCache.data;
  }

  const result = await prisma.activity_events.findMany({
    take: 100,
    orderBy: { timestamp: 'desc' },
    include: {
      profiles: {
        select: { full_name: true, email: true }
      }
    }
  });

  activityLogsCache = { data: result, timestamp: Date.now() };
  return result;
}

// 9. Session Recordings / History
export async function getSessionRecordings() {
  return prisma.app_sessions.findMany({
    where: {
      started_at: { not: null },
      ended_at: { not: null }
    },
    orderBy: { created_at: 'desc' },
    take: 100,
    include: {
      profiles: {
        select: { full_name: true, email: true }
      },
      _count: {
        select: { session_messages: true }
      }
    }
  });
}
//
export async function getSessionRecordingTranscript(sessionId: string) {
  return prisma.session_messages.findMany({
    where: { session_id: sessionId },
    orderBy: { created_at: 'asc' }
  });
}
//
// 10. Error Logs
export async function getErrorLogs() {
  const now = Date.now();
  if (errorLogsCache && (now - errorLogsCache.timestamp < ERROR_LOGS_CACHE_TTL)) {
    return errorLogsCache.data;
  }

  const result = await prisma.error_logs.findMany({
    orderBy: { created_at: 'desc' },
    take: 100
  });

  errorLogsCache = { data: result, timestamp: Date.now() };
  return result;
}

function mapCrisisStatusFromDb(status: string | null): string {
  if (!status) {
    return 'pending';
  }
  if (status === 'in_progress') {
    return 'in-progress';
  }
  return status;
}

function mapCrisisStatusToDb(status: string): string {
  if (status === 'in-progress') {
    return 'in_progress';
  }
  return status;
}

export async function getCrisisEvents(status?: string) {
  const now = Date.now();
  const cacheKey = status || 'all';
  const cached = crisisEventsCache.get(cacheKey);
  if (cached && (now - cached.timestamp < CRISIS_EVENTS_CACHE_TTL)) {
    return cached.data;
  }

  const where: any = {};
  if (status) {
    where.status = mapCrisisStatusToDb(status);
  }

  const events = await prisma.crisis_events.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: 100,
    include: {
      profiles_crisis_events_user_idToprofiles: {
        select: { full_name: true, email: true }
      },
      profiles_crisis_events_assigned_toToprofiles: {
        select: { full_name: true, email: true }
      }
    }
  });

  const result = events.map((event: any) => ({
    ...event,
    status: mapCrisisStatusFromDb(event.status || null),
    profiles: event.profiles_crisis_events_user_idToprofiles,
    assigned_profile: event.profiles_crisis_events_assigned_toToprofiles
  }));

  crisisEventsCache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}

export async function getCrisisEvent(id: string) {
  const event = await prisma.crisis_events.findUnique({
    where: { id },
    include: {
      profiles_crisis_events_user_idToprofiles: {
        select: { full_name: true, email: true }
      },
      profiles_crisis_events_assigned_toToprofiles: {
        select: { full_name: true, email: true }
      }
    }
  });

  if (!event) return null;

  return {
    ...event,
    status: mapCrisisStatusFromDb(event.status as any),
    profiles: event.profiles_crisis_events_user_idToprofiles,
    assigned_profile: event.profiles_crisis_events_assigned_toToprofiles
  };
}

export async function updateCrisisEventStatus(
  id: string,
  data: { status?: string; notes?: string; assigned_to?: string }
) {
  const updateData: any = {};

  if (data.status) {
    updateData.status = mapCrisisStatusToDb(data.status);
    if (updateData.status === 'resolved') {
      updateData.resolved_at = new Date();
    }
  }

  if (Object.prototype.hasOwnProperty.call(data, 'notes')) {
    updateData.notes = data.notes;
  }

  if (Object.prototype.hasOwnProperty.call(data, 'assigned_to')) {
    updateData.assigned_to = data.assigned_to;
  }

  const event = await prisma.crisis_events.update({
    where: { id },
    data: updateData,
    include: {
      profiles_crisis_events_user_idToprofiles: {
        select: { full_name: true, email: true }
      },
      profiles_crisis_events_assigned_toToprofiles: {
        select: { full_name: true, email: true }
      }
    }
  });

  return {
    ...event,
    status: mapCrisisStatusFromDb(event.status as any),
    profiles: event.profiles_crisis_events_user_idToprofiles,
    assigned_profile: event.profiles_crisis_events_assigned_toToprofiles
  };
}
