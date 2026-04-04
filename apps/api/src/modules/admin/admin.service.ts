
import prisma from '../../lib/prisma';
import { Prisma, $Enums } from '@prisma/client';
import { DashboardStats } from './admin.schema';
import { endSession } from '../sessions/sessions.service';
import { notificationsService } from '../notifications/notifications.service';
import { emailService } from '../email/email.service';
import { supabaseAdmin } from '../../config/supabase';
import * as userService from '../users/user.service';

// Simple in-memory cache for dashboard stats (keyed by query options)
const STATS_CACHE_TTL = 60 * 1000; // 60 seconds
const statsCache = new Map<string, { data: DashboardStats; timestamp: number }>();

export type DashboardStatsQuery = {
  chartPeriod?: 'week' | 'month' | 'year';
  sessionWeekOffset?: number;
};

function statsCacheKey(opts: DashboardStatsQuery): string {
  return JSON.stringify({
    chartPeriod: opts.chartPeriod ?? 'month',
    sessionWeekOffset: opts.sessionWeekOffset ?? 0,
  });
}

function utcMonday(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setUTCDate(x.getUTCDate() + diff);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function addUtcDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

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
const activityLogsCache = new Map<string, { data: any[]; timestamp: number }>();

const CRISIS_EVENTS_CACHE_TTL = 120 * 1000; // 120 seconds
const crisisEventsCache = new Map<string, { data: any[]; timestamp: number }>();

const EMAIL_TEMPLATES_CACHE_TTL = 120 * 1000; // 120 seconds
let emailTemplatesCache: { data: any[]; timestamp: number } | null = null;

const ERROR_LOGS_CACHE_TTL = 120 * 1000; // 120 seconds
const errorLogsCache = new Map<string, { data: any[]; timestamp: number }>();

const LIVE_SESSIONS_CACHE_TTL = 120 * 1000; // 120 seconds
let liveSessionsCache: { data: any[]; timestamp: number } | null = null;

export async function getDashboardStats(
  opts: DashboardStatsQuery = {}
): Promise<DashboardStats> {
  const now = Date.now();
  const cacheKey = statsCacheKey(opts);
  const cached = statsCache.get(cacheKey);
  if (cached && now - cached.timestamp < STATS_CACHE_TTL) {
    return cached.data;
  }

  const chartPeriod = opts.chartPeriod ?? 'month';
  const sessionWeekOffset = Math.min(52, Math.max(0, opts.sessionWeekOffset ?? 0));

  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const weekStart = addUtcDays(utcMonday(new Date(now)), -sessionWeekOffset * 7);
  const weekEnd = addUtcDays(weekStart, 7);

  const [
    countsResult,
    revenueResult,
    hourlyStats,
    dailyStatsWeek,
    userGrowthMonthly,
    userGrowthWeekly,
    userGrowthYearly,
    revenueMonthly,
    revenueWeekly,
    revenueYearly,
  ] = await Promise.all([
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
    // 3. Hourly stats for last 7 days - Optimized
    prisma.$queryRaw`
      SELECT 
        EXTRACT(HOUR FROM started_at) as hour,
        COUNT(*) as count
      FROM app_sessions
      WHERE started_at >= ${sevenDaysAgo}
      GROUP BY EXTRACT(HOUR FROM started_at)
    `,
    prisma.$queryRaw`
      SELECT 
        DATE(started_at AT TIME ZONE 'UTC') as date,
        COUNT(*)::bigint as count,
        COALESCE(SUM(duration_minutes), 0)::bigint as total_duration
      FROM app_sessions
      WHERE started_at >= ${weekStart} AND started_at < ${weekEnd}
      GROUP BY DATE(started_at AT TIME ZONE 'UTC')
    `,
    prisma.$queryRaw<Array<{ label: string; users: bigint }>>`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', timezone('utc'::text, now())) - interval '11 months',
          date_trunc('month', timezone('utc'::text, now())),
          interval '1 month'
        ) AS m
      )
      SELECT 
        to_char(m, 'Mon YY') AS label,
        (SELECT COUNT(*)::bigint FROM profiles p WHERE p.created_at < m + interval '1 month') AS users
      FROM months
      ORDER BY m
    `,
    prisma.$queryRaw<Array<{ label: string; users: bigint }>>`
      SELECT 
        to_char(date_trunc('week', timezone('utc'::text, created_at)), 'Mon DD') AS label,
        COUNT(*)::bigint AS users
      FROM profiles
      WHERE created_at >= timezone('utc', now()) - interval '12 weeks'
      GROUP BY date_trunc('week', timezone('utc'::text, created_at))
      ORDER BY date_trunc('week', timezone('utc'::text, created_at))
    `,
    prisma.$queryRaw<Array<{ label: string; users: bigint }>>`
      SELECT 
        to_char(date_trunc('year', timezone('utc'::text, created_at)), 'YYYY') AS label,
        COUNT(*)::bigint AS users
      FROM profiles
      WHERE created_at >= timezone('utc', now()) - interval '5 years'
      GROUP BY date_trunc('year', timezone('utc'::text, created_at))
      ORDER BY date_trunc('year', timezone('utc'::text, created_at))
    `,
    prisma.$queryRaw<Array<{ label: string; revenue: bigint }>>`
      SELECT 
        to_char(date_trunc('month', timezone('utc'::text, created_at)), 'Mon YY') AS label,
        COALESCE(SUM(amount), 0)::bigint AS revenue
      FROM payment_transactions
      WHERE status = 'completed'
        AND created_at >= timezone('utc', now()) - interval '12 months'
      GROUP BY date_trunc('month', timezone('utc'::text, created_at))
      ORDER BY date_trunc('month', timezone('utc'::text, created_at))
    `,
    prisma.$queryRaw<Array<{ label: string; revenue: bigint }>>`
      SELECT 
        to_char(date_trunc('week', timezone('utc'::text, created_at)), 'Mon DD') AS label,
        COALESCE(SUM(amount), 0)::bigint AS revenue
      FROM payment_transactions
      WHERE status = 'completed'
        AND created_at >= timezone('utc', now()) - interval '12 weeks'
      GROUP BY date_trunc('week', timezone('utc'::text, created_at))
      ORDER BY date_trunc('week', timezone('utc'::text, created_at))
    `,
    prisma.$queryRaw<Array<{ label: string; revenue: bigint }>>`
      SELECT 
        to_char(date_trunc('year', timezone('utc'::text, created_at)), 'YYYY') AS label,
        COALESCE(SUM(amount), 0)::bigint AS revenue
      FROM payment_transactions
      WHERE status = 'completed'
        AND created_at >= timezone('utc', now()) - interval '6 years'
      GROUP BY date_trunc('year', timezone('utc'::text, created_at))
      ORDER BY date_trunc('year', timezone('utc'::text, created_at))
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
    const d = addUtcDays(weekStart, i);
    const ymd = d.toISOString().slice(0, 10);
    const stat = (dailyStatsWeek as any[]).find((s: any) => {
      const raw = s.date;
      const key =
        typeof raw === 'string'
          ? raw.slice(0, 10)
          : new Date(raw).toISOString().slice(0, 10);
      return key === ymd;
    });
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    return {
      day: dayName,
      sessions: stat ? Number(stat.count) : 0,
      duration:
        stat && Number(stat.count) > 0
          ? Math.round(Number(stat.total_duration) / Number(stat.count))
          : 0,
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

  const ugMonth = (userGrowthMonthly as Array<{ label: string; users: bigint }>).map((r) => ({
    month: r.label,
    users: Number(r.users),
    orgs: 0,
  }));
  const ugWeek = (userGrowthWeekly as Array<{ label: string; users: bigint }>).map((r) => ({
    month: r.label,
    users: Number(r.users),
    orgs: 0,
  }));
  const ugYear = (userGrowthYearly as Array<{ label: string; users: bigint }>).map((r) => ({
    month: r.label,
    users: Number(r.users),
    orgs: 0,
  }));

  const userGrowthFallback = [
    { month: '—', users: totalUsers, orgs: 0 },
  ];

  let userGrowth =
    chartPeriod === 'week'
      ? ugWeek.length
        ? ugWeek
        : userGrowthFallback
      : chartPeriod === 'year'
        ? ugYear.length
          ? ugYear
          : userGrowthFallback
        : ugMonth.length
          ? ugMonth
          : userGrowthFallback;

  const revFromTx = (
    rows: Array<{ label: string; revenue: bigint }>
  ): { month: string; revenue: number }[] =>
    rows.map((r) => ({
      month: r.label,
      revenue: Math.max(0, Math.round(Number(r.revenue) / 100)),
    }));

  const revMonth = revFromTx(revenueMonthly as Array<{ label: string; revenue: bigint }>);
  const revWeek = revFromTx(revenueWeekly as Array<{ label: string; revenue: bigint }>);
  const revYear = revFromTx(revenueYearly as Array<{ label: string; revenue: bigint }>);

  const revenueFallback = [
    { month: 'Total', revenue: Math.round(revenue) },
  ];

  let revenueData =
    chartPeriod === 'week'
      ? revWeek.length
        ? revWeek
        : revenueFallback
      : chartPeriod === 'year'
        ? revYear.length
          ? revYear
          : revenueFallback
        : revMonth.length
          ? revMonth
          : revenueFallback;

  const userGrowthIsMock =
    chartPeriod === 'week'
      ? ugWeek.length === 0
      : chartPeriod === 'year'
        ? ugYear.length === 0
        : ugMonth.length === 0;

  const revenueIsMock =
    chartPeriod === 'week'
      ? revWeek.length === 0
      : chartPeriod === 'year'
        ? revYear.length === 0
        : revMonth.length === 0;

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

  const mockedSections: string[] = ['systemHealth', 'platformDistribution'];
  if (userGrowthIsMock) mockedSections.push('userGrowth');
  if (revenueIsMock) mockedSections.push('revenueData');

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
    featureUsage,
    mockedSections,
    chartPeriod,
    sessionWeekOffset,
  };

  statsCache.set(cacheKey, { data: result, timestamp: Date.now() });
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

export async function createUserByAdmin(
  input: {
    email: string;
    full_name: string;
    status?: 'active' | 'suspended' | 'inactive';
    subscription?: 'trial' | 'core' | 'pro';
  },
  webBaseUrl: string
) {
  const emailNorm = input.email.trim().toLowerCase();
  if (!emailNorm) {
    throw new Error('Email is required');
  }

  const dup = await prisma.profiles.findFirst({
    where: { email: { equals: emailNorm, mode: 'insensitive' } },
    select: { id: true },
  });
  if (dup) {
    throw new Error('A profile with this email already exists');
  }

  const base = webBaseUrl.replace(/\/$/, '');
  const redirectTo = `${base}/login`;

  const { data: invited, error: inviteError } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(emailNorm, {
      data: { full_name: input.full_name },
      redirectTo,
    });

  if (inviteError) {
    throw new Error(inviteError.message || 'Failed to send invite');
  }
  const userId = invited?.user?.id;
  if (!userId) {
    throw new Error('Invite did not return a user id');
  }

  await userService.createProfile(userId, emailNorm, input.full_name, 'trial');

  const status = input.status ?? 'active';
  const subscription = input.subscription ?? 'trial';

  const role =
    status === 'suspended'
      ? 'suspended'
      : 'user';

  await prisma.profiles.update({
    where: { id: userId },
    data: {
      role,
      account_status: status === 'inactive' ? 'inactive' : 'active',
    },
  });

  if (subscription !== 'trial') {
    const trialSub = await prisma.subscriptions.findFirst({
      where: { user_id: userId, plan_type: 'trial' },
      orderBy: { created_at: 'desc' },
    });
    if (trialSub) {
      await prisma.subscriptions.update({
        where: { id: trialSub.id },
        data: {
          plan_type: subscription,
          status: 'active',
        },
      });
    }
  }

  usersCache.clear();

  const created = await getUserById(userId);
  if (!created) {
    throw new Error('User was created but could not be loaded');
  }
  return created;
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

/** Paginated audit trail for admin UI (all actors). */
export async function getGlobalAuditLogs(page: number = 1, limit: number = 50) {
  const skip = Math.max(0, (page - 1) * limit);
  const take = Math.min(Math.max(limit, 1), 100);
  return prisma.audit_logs.findMany({
    skip,
    take,
    orderBy: { created_at: 'desc' },
    include: {
      profiles: {
        select: { full_name: true, email: true },
      },
    },
  });
}

// --- New Admin Features ---

// 1. User Segmentation
export async function getUserSegments() {
  return prisma.user_segments.findMany({
    orderBy: { created_at: 'desc' },
  });
}

type SegmentRule = { type: string; operator: string; value: string };

function extractSegmentRules(criteria: unknown): SegmentRule[] {
  if (criteria && typeof criteria === 'object' && !Array.isArray(criteria) && 'rules' in criteria) {
    const rules = (criteria as { rules?: unknown }).rules;
    return Array.isArray(rules) ? (rules as SegmentRule[]) : [];
  }
  if (Array.isArray(criteria)) {
    return criteria as SegmentRule[];
  }
  return [];
}

/** End-users only (exclude admin roles). */
function endUserWhere(): Prisma.profilesWhereInput {
  return {
    OR: [
      { role: null },
      { role: { notIn: ['super_admin', 'org_admin', 'team_admin'] } },
    ],
  };
}

function buildProfileWhereFromRules(rules: SegmentRule[]): Prisma.profilesWhereInput {
  if (!rules.length) {
    return endUserWhere();
  }
  const parts: Prisma.profilesWhereInput[] = [];
  for (const r of rules) {
    if (!r?.type || !r?.operator) continue;
    const v = String(r.value ?? '').trim();
    if (!v) continue;
    if (r.type === 'role' && r.operator === 'equals') {
      parts.push({ role: v });
    } else if (r.type === 'account_status' && r.operator === 'equals') {
      parts.push({ account_status: v });
    } else if (r.type === 'subscription' && r.operator === 'equals') {
      parts.push({
        subscriptions: {
          some: { status: 'active', plan_type: v },
        },
      });
    }
  }
  if (parts.length === 0) {
    return endUserWhere();
  }
  return { AND: [endUserWhere(), ...parts] };
}

const SEGMENTATION_CACHE_TTL = 45 * 1000;
let segmentationDashboardCache: { data: unknown; at: number } | null = null;

export async function getUserSegmentationDashboard() {
  const now = Date.now();
  if (
    segmentationDashboardCache &&
    now - segmentationDashboardCache.at < SEGMENTATION_CACHE_TTL
  ) {
    return segmentationDashboardCache.data;
  }

  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const segments = await prisma.user_segments.findMany({
    orderBy: { created_at: 'desc' },
  });

  const [totalEndUsers, premiumUsers, sessionAgg, engagementBucketsRaw] = await Promise.all([
    prisma.profiles.count({ where: endUserWhere() }),
    prisma.profiles.count({
      where: {
        AND: [
          endUserWhere(),
          {
            subscriptions: {
              some: {
                status: 'active',
                plan_type: { not: 'trial' },
              },
            },
          },
        ],
      },
    }),
    prisma.app_sessions.aggregate({
      _avg: { duration_minutes: true },
      where: {
        profiles: endUserWhere(),
        duration_minutes: { not: null },
      },
    }),
    prisma.$queryRaw<Array<{ id: string; c: bigint }>>`
      SELECT p.id, COUNT(s.id)::bigint AS c
      FROM profiles p
      LEFT JOIN app_sessions s ON s.user_id = p.id AND s.started_at >= ${thirtyDaysAgo}
      WHERE COALESCE(p.role, 'user') NOT IN ('super_admin', 'org_admin', 'team_admin')
      GROUP BY p.id
    `,
  ]);

  const buckets = [0, 0, 0, 0, 0];
  const labels = [
    '0 sessions',
    '1–2 sessions',
    '3–5 sessions',
    '6–10 sessions',
    '11+ sessions',
  ];
  for (const row of engagementBucketsRaw) {
    const n = Number(row.c);
    if (n === 0) buckets[0]++;
    else if (n <= 2) buckets[1]++;
    else if (n <= 5) buckets[2]++;
    else if (n <= 10) buckets[3]++;
    else buckets[4]++;
  }
  const engagementDistribution = labels.map((range, i) => ({
    range,
    users: buckets[i],
  }));

  const usersWithSessions30d = buckets.slice(1).reduce((a, b) => a + b, 0);
  const avgEngagementPct =
    totalEndUsers > 0 ? Math.round((usersWithSessions30d / totalEndUsers) * 100) : 0;

  const enrichedSegments = await Promise.all(
    segments.map(async (seg) => {
      const rules = extractSegmentRules(seg.criteria);
      const where = buildProfileWhereFromRules(rules);

      const [userCount, engagedInSegment, paidInSegment, avgDur] = await Promise.all([
        prisma.profiles.count({ where }),
        prisma.profiles.count({
          where: {
            AND: [
              where,
              {
                app_sessions: {
                  some: { started_at: { gte: thirtyDaysAgo } },
                },
              },
            ],
          },
        }),
        prisma.profiles.count({
          where: {
            AND: [
              where,
              {
                subscriptions: {
                  some: {
                    status: 'active',
                    plan_type: { not: 'trial' },
                  },
                },
              },
            ],
          },
        }),
        prisma.app_sessions.aggregate({
          _avg: { duration_minutes: true },
          where: {
            profiles: where,
            duration_minutes: { not: null },
          },
        }),
      ]);

      const engagementPct =
        userCount > 0 ? Math.round((engagedInSegment / userCount) * 100) : 0;
      const conversionPct =
        userCount > 0 ? Math.round((paidInSegment / userCount) * 100) : 0;

      return {
        ...seg,
        user_count: userCount,
        avg_session_minutes: Math.round(Number(avgDur._avg.duration_minutes ?? 0)),
        engagement_pct: engagementPct,
        conversion_pct: conversionPct,
      };
    })
  );

  const payload = {
    segments: enrichedSegments,
    platform: {
      total_end_users: totalEndUsers,
      total_segments: segments.length,
      avg_engagement_pct: avgEngagementPct,
      premium_users: premiumUsers,
      avg_session_minutes_platform: Math.round(
        Number(sessionAgg._avg.duration_minutes ?? 0)
      ),
      engagement_distribution: engagementDistribution,
    },
  };

  segmentationDashboardCache = { data: payload, at: now };
  return payload;
}

export async function createUserSegment(data: any) {
  return prisma.user_segments.create({
    data,
  });
}

export async function deleteUserSegment(id: string) {
  return prisma.user_segments.delete({
    where: { id },
  });
}

// --- Organization team (Team Management) — backed by `org_members` + `profiles.role` ---

function permissionsForProfileRole(role: string | null | undefined): string[] {
  const r = role ?? 'user';
  if (r === 'super_admin') {
    return ['full-access', 'system-settings', 'user-management', 'audit-logs'];
  }
  if (r === 'org_admin') {
    return ['org-settings', 'user-management', 'team-management', 'analytics-view'];
  }
  if (r === 'team_admin') {
    return ['session-access', 'user-view', 'support-access', 'analytics-view'];
  }
  return ['app-user'];
}

async function resolveOrgIdForTeamManagement(
  callerId: string,
  callerRole: string | undefined,
  requestedOrgId: string | undefined
): Promise<{ orgId: string | null; error?: string }> {
  const cr = callerRole ?? '';
  if (cr === 'super_admin') {
    if (requestedOrgId) {
      const exists = await prisma.organizations.findUnique({
        where: { id: requestedOrgId },
        select: { id: true },
      });
      if (!exists) return { orgId: null, error: 'Organization not found' };
      return { orgId: requestedOrgId };
    }
    const first = await prisma.organizations.findFirst({ orderBy: { name: 'asc' } });
    return { orgId: first?.id ?? null };
  }
  if (cr === 'org_admin') {
    const m = await prisma.org_members.findFirst({
      where: { user_id: callerId },
      select: { org_id: true },
    });
    if (!m) return { orgId: null, error: 'No organization membership for your account' };
    if (requestedOrgId && requestedOrgId !== m.org_id) {
      return { orgId: null, error: 'Forbidden' };
    }
    return { orgId: m.org_id };
  }
  return { orgId: null, error: 'Forbidden' };
}

async function assertCallerCanManageOrg(
  callerId: string,
  callerRole: string | undefined,
  orgId: string
) {
  const cr = callerRole ?? '';
  if (cr === 'super_admin') return;
  if (cr === 'org_admin') {
    const m = await prisma.org_members.findFirst({
      where: { user_id: callerId, org_id: orgId },
      select: { org_id: true },
    });
    if (m) return;
  }
  throw new Error('Forbidden');
}

async function countOrgAdminsInOrg(orgId: string): Promise<number> {
  const rows = await prisma.org_members.findMany({
    where: { org_id: orgId },
    include: { profiles: { select: { role: true } } },
  });
  return rows.filter((r) => r.profiles.role === 'org_admin').length;
}

export async function listOrganizationsForTeamAdmin() {
  return prisma.organizations.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true },
  });
}

export type OrgTeamMemberRow = {
  id: string;
  org_id: string;
  user_id: string;
  org_role: string;
  email: string;
  full_name: string;
  phone: string | null;
  profile_role: string;
  account_status: string | null;
  created_at: string;
  joined_org_at: string;
  session_count: number;
  last_active_at: string | null;
  permissions: string[];
  status: 'active' | 'inactive' | 'pending';
};

function mapOrgMemberRow(m: {
  org_id: string;
  user_id: string;
  role: string | null;
  created_at: Date;
  profiles: {
    id: string;
    email: string | null;
    full_name: string | null;
    phone: string | null;
    role: string | null;
    account_status: string | null;
    created_at: Date;
    updated_at: Date;
    _count: { app_sessions: number };
    app_sessions: { started_at: Date | null }[];
  };
}): OrgTeamMemberRow {
  const p = m.profiles;
  const lastAt = p.app_sessions[0]?.started_at ?? p.updated_at;
  const sessionCount = p._count.app_sessions;

  let status: 'active' | 'inactive' | 'pending' = 'active';
  if (p.account_status === 'suspended' || p.role === 'suspended') status = 'inactive';
  else if (p.account_status === 'inactive') status = 'inactive';
  else if (!p.email) status = 'pending';

  return {
    id: p.id,
    org_id: m.org_id,
    user_id: m.user_id,
    org_role: m.role ?? 'member',
    email: p.email ?? '',
    full_name: p.full_name ?? '',
    phone: p.phone,
    profile_role: p.role ?? 'user',
    account_status: p.account_status,
    created_at: p.created_at.toISOString(),
    joined_org_at: m.created_at.toISOString(),
    session_count: sessionCount,
    last_active_at: lastAt ? new Date(lastAt).toISOString() : null,
    permissions: permissionsForProfileRole(p.role),
    status,
  };
}

export async function getOrgTeamMembers(
  callerId: string,
  callerRole: string | undefined,
  requestedOrgId: string | undefined
) {
  const { orgId, error } = await resolveOrgIdForTeamManagement(callerId, callerRole, requestedOrgId);
  const organizations = callerRole === 'super_admin' ? await listOrganizationsForTeamAdmin() : [];

  if (!orgId) {
    return {
      org: null as { id: string; name: string; slug: string } | null,
      organizations,
      members: [] as OrgTeamMemberRow[],
      message: error,
    };
  }

  await assertCallerCanManageOrg(callerId, callerRole, orgId);

  const org = await prisma.organizations.findUnique({ where: { id: orgId } });
  const rows = await prisma.org_members.findMany({
    where: { org_id: orgId },
    include: {
      profiles: {
        select: {
          id: true,
          email: true,
          full_name: true,
          phone: true,
          role: true,
          account_status: true,
          created_at: true,
          updated_at: true,
          _count: {
            select: {
              app_sessions: {
                where: { ended_at: { not: null } },
              },
            },
          },
          app_sessions: {
            orderBy: { started_at: 'desc' },
            take: 1,
            select: { started_at: true },
          },
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  return {
    org: org ? { id: org.id, name: org.name, slug: org.slug } : null,
    organizations,
    members: rows.map(mapOrgMemberRow),
    message: undefined as string | undefined,
  };
}

export async function addOrgTeamMember(
  callerId: string,
  callerRole: string | undefined,
  input: {
    org_id?: string;
    email: string;
    full_name: string;
    phone?: string;
    profile_role: 'org_admin' | 'team_admin' | 'user';
  },
  webBaseUrl: string
) {
  const { orgId, error } = await resolveOrgIdForTeamManagement(callerId, callerRole, input.org_id);
  if (!orgId) throw new Error(error || 'No organization');
  await assertCallerCanManageOrg(callerId, callerRole, orgId);

  if (input.profile_role === 'org_admin' && callerRole !== 'super_admin') {
    throw new Error('Only a super admin can assign the organization admin role');
  }

  const emailNorm = input.email.trim().toLowerCase();
  if (!emailNorm) throw new Error('Email is required');
  const nameTrim = input.full_name.trim();
  if (!nameTrim) throw new Error('Full name is required');

  const existingProfile = await prisma.profiles.findFirst({
    where: { email: { equals: emailNorm, mode: 'insensitive' } },
    select: { id: true, role: true },
  });

  if (existingProfile) {
    if (existingProfile.role === 'super_admin') {
      throw new Error('This account is a super admin and cannot be managed as an org member here');
    }
    const dup = await prisma.org_members.findFirst({
      where: { org_id: orgId, user_id: existingProfile.id },
    });
    if (dup) throw new Error('This user is already in the organization');

    await prisma.org_members.create({
      data: {
        org_id: orgId,
        user_id: existingProfile.id,
        role: input.profile_role === 'team_admin' ? 'staff' : 'member',
      },
    });

    await prisma.profiles.update({
      where: { id: existingProfile.id },
      data: {
        ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
        full_name: nameTrim,
        role: input.profile_role,
      },
    });

    usersCache.clear();
    return getOrgTeamMembers(callerId, callerRole, orgId);
  }

  const base = webBaseUrl.replace(/\/$/, '');
  const redirectTo = `${base}/login`;

  const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(emailNorm, {
    data: { full_name: nameTrim },
    redirectTo,
  });

  if (inviteError) throw new Error(inviteError.message || 'Failed to send invite');
  const newId = invited?.user?.id;
  if (!newId) throw new Error('Invite did not return a user id');

  await userService.createProfile(newId, emailNorm, nameTrim, 'trial');
  await prisma.profiles.update({
    where: { id: newId },
    data: {
      role: input.profile_role,
      ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
      account_status: 'active',
    },
  });

  await prisma.org_members.create({
    data: {
      org_id: orgId,
      user_id: newId,
      role: input.profile_role === 'team_admin' ? 'staff' : 'member',
    },
  });

  usersCache.clear();
  return getOrgTeamMembers(callerId, callerRole, orgId);
}

export async function updateOrgTeamMember(
  callerId: string,
  callerRole: string | undefined,
  orgIdParam: string | undefined,
  targetUserId: string,
  data: {
    phone?: string;
    profile_role?: 'org_admin' | 'team_admin' | 'user';
    account_status?: string;
    org_role?: string;
  }
) {
  const { orgId, error } = await resolveOrgIdForTeamManagement(callerId, callerRole, orgIdParam);
  if (!orgId) throw new Error(error || 'No organization');
  await assertCallerCanManageOrg(callerId, callerRole, orgId);

  const membership = await prisma.org_members.findFirst({
    where: { org_id: orgId, user_id: targetUserId },
    include: { profiles: { select: { role: true } } },
  });
  if (!membership) throw new Error('User is not in this organization');

  if (data.profile_role === 'org_admin' && callerRole !== 'super_admin') {
    throw new Error('Only a super admin can assign the organization admin role');
  }

  if (targetUserId === callerId && data.profile_role && data.profile_role !== (membership.profiles.role ?? '')) {
    throw new Error('You cannot change your own role');
  }

  const currentRole = membership.profiles.role ?? '';
  if (currentRole === 'super_admin') {
    throw new Error('Cannot modify a super admin account here');
  }

  if (data.profile_role && data.profile_role !== 'org_admin' && currentRole === 'org_admin') {
    const admins = await countOrgAdminsInOrg(orgId);
    if (admins <= 1) {
      throw new Error('Cannot change the last organization admin to a different role');
    }
  }

  const updateProfile: Prisma.profilesUpdateInput = {};
  if (data.phone !== undefined) updateProfile.phone = data.phone.trim() || null;
  if (data.account_status !== undefined) updateProfile.account_status = data.account_status;
  if (data.profile_role) updateProfile.role = data.profile_role;

  if (Object.keys(updateProfile).length > 0) {
    await prisma.profiles.update({
      where: { id: targetUserId },
      data: updateProfile,
    });
  }

  if (data.org_role !== undefined) {
    await prisma.org_members.updateMany({
      where: { org_id: orgId, user_id: targetUserId },
      data: { role: data.org_role.trim() || 'member' },
    });
  }

  usersCache.clear();
  return getOrgTeamMembers(callerId, callerRole, orgId);
}

export async function removeOrgTeamMember(
  callerId: string,
  callerRole: string | undefined,
  orgIdParam: string | undefined,
  targetUserId: string
) {
  const { orgId, error } = await resolveOrgIdForTeamManagement(callerId, callerRole, orgIdParam);
  if (!orgId) throw new Error(error || 'No organization');
  await assertCallerCanManageOrg(callerId, callerRole, orgId);

  if (targetUserId === callerId) {
    throw new Error('You cannot remove yourself from the organization');
  }

  const membership = await prisma.org_members.findFirst({
    where: { org_id: orgId, user_id: targetUserId },
    include: { profiles: { select: { role: true } } },
  });
  if (!membership) throw new Error('User is not in this organization');

  if (membership.profiles.role === 'super_admin') {
    throw new Error('Cannot remove a super admin');
  }

  if (membership.profiles.role === 'org_admin') {
    const admins = await countOrgAdminsInOrg(orgId);
    if (admins <= 1) {
      throw new Error('Cannot remove the last organization admin');
    }
  }

  await prisma.org_members.deleteMany({
    where: { org_id: orgId, user_id: targetUserId },
  });

  usersCache.clear();
  return getOrgTeamMembers(callerId, callerRole, orgId);
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
  manualNotificationsCache = null;
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

    return notificationsService.createManyForUsers(
      eligibleUsers.map((u) => u.id),
      {
        type: data.type || 'system',
        title: data.title,
        message: data.message,
        metadata: {
          ...baseMetadata,
          target_audience: 'segment',
          target_count: eligibleUsers.length,
        },
      }
    );
  }

  if (data.target_audience === 'all') {
    const allUsers = await prisma.profiles.findMany({ 
      select: { id: true, notification_preferences: true } 
    });
    
    const eligibleUsers = allUsers.filter(u => shouldSend(u.notification_preferences));

    if (eligibleUsers.length === 0) return { count: 0 };
    
    return notificationsService.createManyForUsers(
      eligibleUsers.map((u) => u.id),
      {
        type: data.type || 'system',
        title: data.title,
        message: data.message,
        metadata: {
          ...baseMetadata,
          target_audience: 'all',
          target_count: eligibleUsers.length,
        },
      }
    );
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

    return notificationsService.createManyForUsers(
      eligibleUsers.map((s) => s.user_id),
      {
        type: data.type || 'system',
        title: data.title,
        message: data.message,
        metadata: {
          ...baseMetadata,
          target_audience: 'premium',
          target_count: eligibleUsers.length,
        },
      }
    );
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

    return notificationsService.createManyForUsers(
      eligibleUsers.map((s) => s.user_id),
      {
        type: data.type || 'system',
        title: data.title,
        message: data.message,
        metadata: {
          ...baseMetadata,
          target_audience: 'trial',
          target_count: eligibleUsers.length,
        },
      }
    );
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
    
    return notificationsService.createManyForUsers(
      eligibleUsers.map((u) => u.id),
      {
        type: data.type || 'system',
        title: data.title,
        message: data.message,
        metadata: {
          ...baseMetadata,
          target_audience: 'active',
          target_count: eligibleUsers.length,
        },
      }
    );
  }

  if (data.userIds && Array.isArray(data.userIds)) {
    const users = await prisma.profiles.findMany({
      where: { id: { in: data.userIds } },
      select: { id: true, notification_preferences: true }
    });

    const eligibleUsers = users.filter(u => shouldSend(u.notification_preferences));

    if (eligibleUsers.length === 0) return { count: 0 };

    return notificationsService.createManyForUsers(
      eligibleUsers.map((u) => u.id),
      {
        type: data.type || 'system',
        title: data.title,
        message: data.message,
        metadata: {
          ...baseMetadata,
          target_audience: data.target_audience || 'specific',
          target_count: eligibleUsers.length,
        },
      }
    );
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

  const existingTemplates = await prisma.email_templates.findMany({
    orderBy: { name: 'asc' }
  });

  if (existingTemplates.length === 0) {
    const defaultTemplates = emailService.getDefaultTemplateRecords();
    if (defaultTemplates.length > 0) {
      await prisma.email_templates.createMany({
        data: defaultTemplates,
        skipDuplicates: true,
      });
    }
  }

  const result = await prisma.email_templates.findMany({
    orderBy: { name: 'asc' }
  });

  emailTemplatesCache = { data: result, timestamp: Date.now() };
  return result;
}

export async function createEmailTemplate(data: any) {
  const result = await prisma.email_templates.create({ data });
  emailTemplatesCache = null;
  return result;
}

export async function updateEmailTemplate(id: string, data: any) {
  const result = await prisma.email_templates.update({
    where: { id },
    data
  });
  emailTemplatesCache = null;
  return result;
}

export async function deleteEmailTemplate(id: string) {
  const result = await prisma.email_templates.delete({ where: { id } });
  emailTemplatesCache = null;
  return result;
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
export async function getSupportTickets(page: number = 1, limit: number = 20, status?: string) {
  const skip = Math.max(0, (page - 1) * limit);
  const take = Math.min(Math.max(limit, 1), 100);
  const ticketStatuses = Object.values($Enums.ticket_status) as $Enums.ticket_status[];
  const statusFilter =
    status && ticketStatuses.includes(status as $Enums.ticket_status)
      ? (status as $Enums.ticket_status)
      : undefined;
  return prisma.support_tickets.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    skip,
    take,
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
export async function getActivityLogs(page: number = 1, limit: number = 25) {
  const now = Date.now();
  const cacheKey = `${page}_${limit}`;
  const cached = activityLogsCache.get(cacheKey);
  if (cached && (now - cached.timestamp < ACTIVITY_LOGS_CACHE_TTL)) return cached.data;
  const skip = Math.max(0, (page - 1) * limit);
  const take = Math.min(Math.max(limit, 1), 100);

  const result = await prisma.activity_events.findMany({
    skip,
    take,
    orderBy: { timestamp: 'desc' },
    include: {
      profiles: {
        select: { full_name: true, email: true }
      }
    }
  });

  activityLogsCache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}

// 9. Session Recordings / History
export async function getSessionRecordings(page: number = 1, limit: number = 20) {
  const skip = Math.max(0, (page - 1) * limit);
  const take = Math.min(Math.max(limit, 1), 100);
  return prisma.app_sessions.findMany({
    where: {
      started_at: { not: null },
      ended_at: { not: null }
    },
    orderBy: { created_at: 'desc' },
    skip,
    take,
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
export async function getErrorLogs(page: number = 1, limit: number = 25) {
  const now = Date.now();
  const cacheKey = `${page}_${limit}`;
  const cached = errorLogsCache.get(cacheKey);
  if (cached && (now - cached.timestamp < ERROR_LOGS_CACHE_TTL)) return cached.data;
  const skip = Math.max(0, (page - 1) * limit);
  const take = Math.min(Math.max(limit, 1), 100);

  const result = await prisma.error_logs.findMany({
    skip,
    orderBy: { created_at: 'desc' },
    take
  });

  errorLogsCache.set(cacheKey, { data: result, timestamp: Date.now() });
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

export async function getCrisisEvents(status?: string, page: number = 1, limit: number = 20) {
  const now = Date.now();
  const cacheKey = `${status || 'all'}_${page}_${limit}`;
  const cached = crisisEventsCache.get(cacheKey);
  if (cached && (now - cached.timestamp < CRISIS_EVENTS_CACHE_TTL)) {
    return cached.data;
  }

  const where: any = {};
  if (status) {
    where.status = mapCrisisStatusToDb(status);
  }

  const skip = Math.max(0, (page - 1) * limit);
  const take = Math.min(Math.max(limit, 1), 100);

  const events = await prisma.crisis_events.findMany({
    where,
    skip,
    orderBy: { created_at: 'desc' },
    take,
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
