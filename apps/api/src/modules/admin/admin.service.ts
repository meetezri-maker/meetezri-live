
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
  /** Inclusive number of days for session/hourly charts (default 7, max 366) */
  rangeDays?: number;
  /** Custom UTC date range (YYYY-MM-DD); when both set, rangeDays is ignored */
  dateFrom?: string;
  dateTo?: string;
  /** Skip in-memory stats cache (e.g. explicit refresh) */
  skipCache?: boolean;
};

function statsCacheKey(opts: DashboardStatsQuery): string {
  return JSON.stringify({
    chartPeriod: opts.chartPeriod ?? 'month',
    sessionWeekOffset: opts.sessionWeekOffset ?? 0,
    rangeDays: opts.rangeDays ?? 7,
    dateFrom: opts.dateFrom ?? null,
    dateTo: opts.dateTo ?? null,
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

function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

/** Parse dashboard date range: custom dates, or rolling window ending (today UTC − week offset). */
function parseDashboardRange(
  opts: DashboardStatsQuery,
  nowMs: number
): { start: Date; end: Date } {
  if (opts.dateFrom && opts.dateTo) {
    const start = new Date(`${opts.dateFrom}T00:00:00.000Z`);
    const end = new Date(`${opts.dateTo}T23:59:59.999Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return parseDashboardRange({ ...opts, dateFrom: undefined, dateTo: undefined }, nowMs);
    }
    if (start > end) {
      return { start: end, end: start };
    }
    return { start, end };
  }
  const rangeDays = Math.min(366, Math.max(1, opts.rangeDays ?? 7));
  const weekOff = Math.min(52, Math.max(0, opts.sessionWeekOffset ?? 0));
  const now = new Date(nowMs);
  const end = utcDayStart(now);
  end.setUTCDate(end.getUTCDate() - weekOff * 7);
  end.setUTCHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (rangeDays - 1));
  start.setUTCHours(0, 0, 0, 0);
  return { start, end };
}

const AVATAR_COLORS = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#06b6d4', '#a855f7', '#64748b'];

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

const LIVE_SESSIONS_CACHE_TTL = 15 * 1000; // 15 seconds — admin monitor expects near real-time data
let liveSessionsCache: { data: any[]; timestamp: number } | null = null;

function invalidateErrorLogsCache() {
  errorLogsCache.clear();
}

/** Cumulative user totals at each bucket end, aligned to the selected dashboard range. */
async function queryUserGrowthSeries(
  chartPeriod: 'week' | 'month' | 'year',
  rangeStart: Date,
  rangeEnd: Date
): Promise<Array<{ label: string; users: bigint }>> {
  const rs = rangeStart;
  const re = rangeEnd;
  if (chartPeriod === 'week') {
    return prisma.$queryRaw<Array<{ label: string; users: bigint }>>`
      WITH buckets AS (
        SELECT generate_series(
          date_trunc('week', ${rs}::timestamptz),
          date_trunc('week', ${re}::timestamptz),
          interval '1 week'
        ) AS w
      )
      SELECT
        to_char(w, 'Mon DD') AS label,
        (SELECT COUNT(*)::bigint FROM profiles p WHERE p.created_at < w + interval '1 week') AS users
      FROM buckets
      ORDER BY w
    `;
  }
  if (chartPeriod === 'year') {
    return prisma.$queryRaw<Array<{ label: string; users: bigint }>>`
      WITH buckets AS (
        SELECT generate_series(
          date_trunc('year', ${rs}::timestamptz),
          date_trunc('year', ${re}::timestamptz),
          interval '1 year'
        ) AS y
      )
      SELECT
        to_char(y, 'YYYY') AS label,
        (SELECT COUNT(*)::bigint FROM profiles p WHERE p.created_at < y + interval '1 year') AS users
      FROM buckets
      ORDER BY y
    `;
  }
  return prisma.$queryRaw<Array<{ label: string; users: bigint }>>`
    WITH buckets AS (
      SELECT generate_series(
        date_trunc('month', ${rs}::timestamptz),
        date_trunc('month', ${re}::timestamptz),
        interval '1 month'
      ) AS m
    )
    SELECT
      to_char(m, 'Mon YY') AS label,
      (SELECT COUNT(*)::bigint FROM profiles p WHERE p.created_at < m + interval '1 month') AS users
    FROM buckets
    ORDER BY m
  `;
}

export async function getDashboardStats(
  opts: DashboardStatsQuery = {}
): Promise<DashboardStats> {
  const now = Date.now();
  const cacheKey = statsCacheKey(opts);
  if (!opts.skipCache) {
    const cached = statsCache.get(cacheKey);
    if (cached && now - cached.timestamp < STATS_CACHE_TTL) {
      return cached.data;
    }
  }

  const chartPeriod = opts.chartPeriod ?? 'month';
  const sessionWeekOffset = Math.min(52, Math.max(0, opts.sessionWeekOffset ?? 0));

  const { start: rangeStart, end: rangeEnd } = parseDashboardRange(opts, now);

  const [
    countsResult,
    revenueResult,
    hourlyStats,
    dailyStatsRange,
    avatarRows,
    onboardingDailyRows,
    inactiveBuckets,
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
    // 3. Hourly distribution across the selected date range
    prisma.$queryRaw`
      SELECT 
        EXTRACT(HOUR FROM started_at) as hour,
        COUNT(*)::bigint as count
      FROM app_sessions
      WHERE started_at >= ${rangeStart} AND started_at <= ${rangeEnd}
      GROUP BY EXTRACT(HOUR FROM started_at)
    `,
    prisma.$queryRaw`
      SELECT 
        DATE(started_at AT TIME ZONE 'UTC') as date,
        COUNT(*)::bigint as count,
        COALESCE(SUM(duration_minutes), 0)::bigint as total_duration
      FROM app_sessions
      WHERE started_at >= ${rangeStart} AND started_at <= ${rangeEnd}
      GROUP BY DATE(started_at AT TIME ZONE 'UTC')
    `,
    prisma.$queryRaw<Array<{ name: string; c: bigint }>>`
      SELECT COALESCE(NULLIF(TRIM(selected_avatar), ''), 'Not set') AS name, COUNT(*)::bigint AS c
      FROM profiles
      GROUP BY 1
      ORDER BY c DESC
      LIMIT 12
    `,
    prisma.$queryRaw<Array<{ d: Date; signups: bigint; completions: bigint }>>`
      SELECT 
        DATE(created_at AT TIME ZONE 'UTC') AS d,
        COUNT(*)::bigint AS signups,
        COUNT(*) FILTER (WHERE onboarding_completed = true)::bigint AS completions
      FROM profiles
      WHERE created_at >= ${rangeStart} AND created_at <= ${rangeEnd}
      GROUP BY DATE(created_at AT TIME ZONE 'UTC')
      ORDER BY d
    `,
    prisma.$queryRaw<Array<{ d30: bigint; d60: bigint; d90: bigint }>>`
      SELECT 
        COUNT(*) FILTER (
          WHERE updated_at < timezone('utc', now()) - interval '30 days'
            AND updated_at >= timezone('utc', now()) - interval '60 days'
        )::bigint AS d30,
        COUNT(*) FILTER (
          WHERE updated_at < timezone('utc', now()) - interval '60 days'
            AND updated_at >= timezone('utc', now()) - interval '90 days'
        )::bigint AS d60,
        COUNT(*) FILTER (WHERE updated_at < timezone('utc', now()) - interval '90 days')::bigint AS d90
      FROM profiles
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

  const userGrowthSeries = await queryUserGrowthSeries(chartPeriod, rangeStart, rangeEnd);

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

  const startDay = utcDayStart(rangeStart);
  const endDay = utcDayStart(rangeEnd);
  const dayCount = Math.max(
    1,
    Math.round((endDay.getTime() - startDay.getTime()) / (24 * 60 * 60 * 1000)) + 1
  );

  const sessionActivity = Array.from({ length: dayCount }).map((_, i) => {
    const d = addUtcDays(startDay, i);
    const ymd = d.toISOString().slice(0, 10);
    const stat = (dailyStatsRange as any[]).find((s: any) => {
      const raw = s.date;
      const key =
        typeof raw === 'string'
          ? raw.slice(0, 10)
          : new Date(raw).toISOString().slice(0, 10);
      return key === ymd;
    });
    const dayLabel =
      dayCount > 14
        ? `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
        : d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    return {
      day: dayLabel,
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
      hourNum: hour,
      sessions: bucket.sessions
    };
  });

  const avatarTotal = (avatarRows as Array<{ name: string; c: bigint }>).reduce(
    (s, r) => s + Number(r.c),
    0
  );
  const avatarDistribution = (avatarRows as Array<{ name: string; c: bigint }>).map((r, i) => ({
    name: r.name,
    value: avatarTotal > 0 ? Math.round((Number(r.c) / avatarTotal) * 100) : 0,
    count: Number(r.c),
    color: AVATAR_COLORS[i % AVATAR_COLORS.length],
  }));

  const inactiveRow = (inactiveBuckets as any[])[0] || { d30: 0, d60: 0, d90: 0 };
  const winbackStats = {
    atRisk30: Number(inactiveRow.d30 || 0),
    dormant60: Number(inactiveRow.d60 || 0),
    lost90: Number(inactiveRow.d90 || 0),
  };

  const onboardingByDayMap = new Map<string, { signups: number; completions: number }>();
  for (const row of onboardingDailyRows as Array<{ d: Date; signups: bigint; completions: bigint }>) {
    const key =
      typeof row.d === 'string'
        ? (row.d as string).slice(0, 10)
        : new Date(row.d).toISOString().slice(0, 10);
    onboardingByDayMap.set(key, {
      signups: Number(row.signups),
      completions: Number(row.completions),
    });
  }

  const onboardingDaily: Array<{ date: string; signups: number; completions: number }> = [];
  for (let i = 0; i < dayCount; i++) {
    const d = addUtcDays(startDay, i);
    const key = d.toISOString().slice(0, 10);
    const o = onboardingByDayMap.get(key);
    onboardingDaily.push({
      date: key,
      signups: o?.signups ?? 0,
      completions: o?.completions ?? 0,
    });
  }

  const onboardingSignupsInRange = onboardingDaily.reduce((s, x) => s + x.signups, 0);
  const onboardingCompletedInRange = onboardingDaily.reduce((s, x) => s + x.completions, 0);

  // System Health - Still hard to get real metrics without infra access
  const systemHealth = [
    { name: "API Response Time", value: "45ms", status: "excellent", color: "text-green-600", percentage: 95 },
    { name: "Server Uptime", value: "99.98%", status: "excellent", color: "text-green-600", percentage: 99 },
    { name: "Database Load", value: "42%", status: "good", color: "text-blue-600", percentage: 58 },
    { name: "CDN Performance", value: "98%", status: "excellent", color: "text-green-600", percentage: 98 },
  ];

  const ugFromSeries = (userGrowthSeries as Array<{ label: string; users: bigint }>).map((r) => ({
    month: r.label,
    users: Number(r.users),
    orgs: 0,
  }));

  const userGrowthFallback = [
    { month: '—', users: totalUsers, orgs: 0 },
  ];

  let userGrowth = ugFromSeries.length ? ugFromSeries : userGrowthFallback;

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

  const userGrowthIsMock = ugFromSeries.length === 0;

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
    rangeDays: dayCount,
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    avatarDistribution,
    onboardingStats: {
      signupsInRange: onboardingSignupsInRange,
      completionsInRange: onboardingCompletedInRange,
      completionRatePercent:
        onboardingSignupsInRange > 0
          ? Math.round((onboardingCompletedInRange / onboardingSignupsInRange) * 1000) / 10
          : 0,
      daily: onboardingDaily,
    },
    winbackStats,
  };

  if (!opts.skipCache) {
    statsCache.set(cacheKey, { data: result, timestamp: Date.now() });
  }
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
  const take = Math.min(limit, 1000);

  // Single query for list rows; latest mood per user is loaded in one batch (avoids per-row subqueries).
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
      subscriptions: {
        where: { status: 'active' },
        orderBy: { created_at: 'desc' },
        take: 1,
        select: { plan_type: true },
      },
      org_members: {
        take: 1,
        select: {
          organizations: { select: { name: true } },
        },
      },
    },
  });

  const userIds = users.map((u) => u.id);
  const moodByUser = new Map<string, { mood: string | null; intensity: number | null }>();
  if (userIds.length > 0) {
    const moodRows = await prisma.$queryRaw<
      { user_id: string; mood: string | null; intensity: number | null }[]
    >(Prisma.sql`
      SELECT DISTINCT ON (user_id) user_id::text AS user_id, mood, intensity
      FROM mood_entries
      WHERE user_id::text IN (${Prisma.join(userIds)})
      ORDER BY user_id, created_at DESC
    `);
    for (const row of moodRows) {
      moodByUser.set(row.user_id, { mood: row.mood, intensity: row.intensity });
    }
  }

  const result = users.map((user) => {
    const lastSessionDate = user.app_sessions[0]?.started_at;
    const lastActive = lastSessionDate
      ? new Date(lastSessionDate).getTime() > new Date(user.updated_at).getTime()
        ? lastSessionDate
        : user.updated_at
      : user.updated_at;

    const lastMood = moodByUser.get(user.id);
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

export async function createUserSegment(data: {
  name: string;
  description?: string | null;
  criteria: unknown;
  user_count?: number | null;
}) {
  segmentationDashboardCache = null;
  return prisma.user_segments.create({
    data: {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      criteria: data.criteria as Prisma.InputJsonValue,
      user_count: data.user_count ?? 0,
    },
  });
}

export async function deleteUserSegment(id: string) {
  segmentationDashboardCache = null;
  return prisma.user_segments.delete({
    where: { id },
  });
}

// --- Companion Management (`companion_profiles` + therapist `profiles`) ---

function companionAvailabilityToString(av: unknown): string {
  if (av == null) return '—';
  if (typeof av === 'string') return av;
  try {
    return JSON.stringify(av);
  } catch {
    return '—';
  }
}

function mapProfileToCompanionStatus(p: {
  email: string | null;
  account_status: string | null;
  role: string | null;
}): 'active' | 'inactive' | 'pending' {
  if (!p.email) return 'pending';
  if (p.role === 'suspended' || p.account_status === 'suspended') return 'inactive';
  if (p.account_status === 'inactive') return 'inactive';
  return 'active';
}

export async function listCompanionsForAdmin() {
  const rows = await prisma.companion_profiles.findMany({
    include: {
      profiles: {
        select: {
          email: true,
          full_name: true,
          phone: true,
          account_status: true,
          role: true,
          updated_at: true,
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return [];

  const [counts, avgs] = await Promise.all([
    prisma.appointments.groupBy({
      by: ['companion_id'],
      where: { companion_id: { in: ids } },
      _count: { _all: true },
    }),
    prisma.appointments.groupBy({
      by: ['companion_id'],
      where: { companion_id: { in: ids }, rating: { not: null } },
      _avg: { rating: true },
    }),
  ]);

  const countMap = new Map<string, number>();
  for (const c of counts) {
    if (c.companion_id != null) countMap.set(c.companion_id, c._count._all);
  }
  const avgMap = new Map<string, number>();
  for (const a of avgs) {
    if (a.companion_id != null && a._avg.rating != null) {
      avgMap.set(a.companion_id, Number(a._avg.rating));
    }
  }

  return rows.map((row) => {
    const p = row.profiles;
    const sessionsCount = countMap.get(row.id) ?? 0;
    const rating = avgMap.get(row.id) ?? 0;
    return {
      id: row.id,
      name: p.full_name || p.email?.split('@')[0] || 'Companion',
      email: p.email ?? '',
      phone: p.phone ?? '',
      specialization: row.specializations ?? [],
      license: row.license_number ?? '',
      status: mapProfileToCompanionStatus(p),
      verified: row.is_verified === true,
      joinedDate: row.joined_date?.toISOString() ?? row.created_at.toISOString(),
      sessionsCount,
      rating,
      availability: companionAvailabilityToString(row.availability),
      languages: row.languages ?? [],
    };
  });
}

export async function createCompanionByAdmin(
  input: {
    email: string;
    full_name: string;
    phone?: string;
    license_number?: string;
    specializations?: string[];
    languages?: string[];
    availability?: string;
  },
  webBaseUrl: string
) {
  const emailNorm = input.email.trim().toLowerCase();
  const nameTrim = input.full_name.trim();
  if (!emailNorm || !nameTrim) {
    throw new Error('Email and full name are required');
  }

  const specs = input.specializations?.map((s) => s.trim()).filter(Boolean) ?? [];
  const langs = input.languages?.map((s) => s.trim()).filter(Boolean) ?? [];
  const availability =
    input.availability?.trim() ||
    JSON.stringify({ note: 'Set hours in profile', timezone: 'UTC' });

  const existing = await prisma.profiles.findFirst({
    where: { email: { equals: emailNorm, mode: 'insensitive' } },
    select: { id: true, role: true },
  });

  if (existing) {
    if (existing.role === 'super_admin') {
      throw new Error('Cannot convert a super admin account into a companion here');
    }
    await prisma.profiles.update({
      where: { id: existing.id },
      data: {
        role: 'therapist',
        full_name: nameTrim,
        ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
        account_status: 'active',
      },
    });
    await prisma.companion_profiles.upsert({
      where: { id: existing.id },
      create: {
        id: existing.id,
        license_number: input.license_number?.trim() || null,
        specializations: specs,
        languages: langs,
        availability,
        is_verified: false,
      },
      update: {
        license_number: input.license_number?.trim() || null,
        specializations: specs,
        languages: langs,
        availability,
      },
    });
    usersCache.clear();
    return listCompanionsForAdmin();
  }

  const base = webBaseUrl.replace(/\/$/, '');
  const redirectTo = `${base}/login`;

  const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    emailNorm,
    {
      data: { full_name: nameTrim },
      redirectTo,
    }
  );

  if (inviteError) {
    throw new Error(inviteError.message || 'Failed to send invite');
  }
  const userId = invited?.user?.id;
  if (!userId) {
    throw new Error('Invite did not return a user id');
  }

  await userService.createProfile(userId, emailNorm, nameTrim, 'trial');
  await prisma.profiles.update({
    where: { id: userId },
    data: {
      role: 'therapist',
      ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
      account_status: 'active',
    },
  });

  await prisma.companion_profiles.create({
    data: {
      id: userId,
      license_number: input.license_number?.trim() || null,
      specializations: specs,
      languages: langs,
      availability,
      is_verified: false,
    },
  });

  usersCache.clear();
  return listCompanionsForAdmin();
}

export async function updateCompanionByAdmin(
  companionUserId: string,
  data: {
    full_name?: string;
    phone?: string;
    license_number?: string;
    specializations?: string[];
    languages?: string[];
    availability?: string;
    is_verified?: boolean;
    account_status?: string;
  }
) {
  const row = await prisma.companion_profiles.findUnique({
    where: { id: companionUserId },
    include: { profiles: { select: { role: true } } },
  });
  if (!row) {
    throw new Error('Companion not found');
  }

  const profUpdate: Prisma.profilesUpdateInput = {};
  if (data.full_name !== undefined) profUpdate.full_name = data.full_name.trim() || null;
  if (data.phone !== undefined) profUpdate.phone = data.phone.trim() || null;
  if (data.account_status !== undefined) profUpdate.account_status = data.account_status;

  if (Object.keys(profUpdate).length > 0) {
    await prisma.profiles.update({
      where: { id: companionUserId },
      data: profUpdate,
    });
  }

  const cpUpdate: Prisma.companion_profilesUpdateInput = {};
  if (data.license_number !== undefined) cpUpdate.license_number = data.license_number.trim() || null;
  if (data.specializations !== undefined) cpUpdate.specializations = data.specializations;
  if (data.languages !== undefined) cpUpdate.languages = data.languages;
  if (data.availability !== undefined) {
    const av = data.availability.trim();
    cpUpdate.availability = av ? av : Prisma.JsonNull;
  }
  if (data.is_verified !== undefined) cpUpdate.is_verified = data.is_verified;

  if (Object.keys(cpUpdate).length > 0) {
    await prisma.companion_profiles.update({
      where: { id: companionUserId },
      data: cpUpdate,
    });
  }

  usersCache.clear();
  return listCompanionsForAdmin();
}

export async function deleteCompanionProfile(companionUserId: string) {
  const row = await prisma.companion_profiles.findUnique({
    where: { id: companionUserId },
    include: { profiles: { select: { role: true } } },
  });
  if (!row) {
    throw new Error('Companion not found');
  }
  if (row.profiles.role === 'super_admin') {
    throw new Error('Cannot remove companion profile for this account');
  }

  await prisma.companion_profiles.delete({
    where: { id: companionUserId },
  });
  await prisma.profiles.update({
    where: { id: companionUserId },
    data: { role: 'user' },
  });

  usersCache.clear();
  return listCompanionsForAdmin();
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

function invalidateCommunityCaches() {
  communityStatsCache = null;
  communityGroupsCache = null;
}

async function processDueScheduledPushCampaigns() {
  const due = await prisma.push_campaigns.findMany({
    where: {
      status: 'scheduled',
      scheduled_at: { lte: new Date() },
    },
  });
  for (const c of due) {
    try {
      await dispatchPushCampaignAsNotifications(c.id);
    } catch (e) {
      console.error('processDueScheduledPushCampaigns', e);
    }
  }
}

/** Sends in-app notifications for a push campaign row and marks it sent. */
export async function dispatchPushCampaignAsNotifications(campaignId: string) {
  const c = await prisma.push_campaigns.findUnique({ where: { id: campaignId } });
  if (!c) throw new Error('Campaign not found');
  if (c.status === 'sent' && c.sent_at) {
    return { delivered: 0 };
  }
  const m = (c.metrics || {}) as Record<string, unknown>;

  const payload: Record<string, unknown> = {
    title: c.title,
    message: c.message,
    channel: 'push',
  };

  if (m.admin_broadcast) {
    const ta = (m.target_audience as string) || 'all';
    if (Array.isArray(m.userIds) && (m.userIds as string[]).length > 0) {
      payload.userIds = m.userIds;
      payload.target_audience = 'specific';
    } else if (ta === 'segment' && m.segment_id) {
      payload.target_audience = 'segment';
      payload.segment_id = m.segment_id;
    } else {
      payload.target_audience = ta;
    }
  } else {
    const ta = (m.target_audience as string) || 'all';
    if (c.target_segment_id) {
      payload.target_audience = 'segment';
      payload.segment_id = c.target_segment_id;
    } else if (Array.isArray(m.userIds) && (m.userIds as string[]).length > 0) {
      payload.userIds = m.userIds;
      payload.target_audience = 'specific';
    } else {
      payload.target_audience = ta;
    }
  }

  const result = await createManualNotification(payload);
  let delivered = 0;
  if (result && typeof result === 'object' && 'count' in result) {
    delivered = Number((result as { count: number }).count) || 0;
  } else if (result && typeof result === 'object' && 'id' in result) {
    delivered = 1;
  }

  const prevMetrics = (c.metrics && typeof c.metrics === 'object' ? c.metrics : {}) as Record<string, unknown>;
  await prisma.push_campaigns.update({
    where: { id: campaignId },
    data: {
      status: 'sent',
      sent_at: new Date(),
      metrics: {
        ...prevMetrics,
        delivered_count: delivered,
        click_rate: typeof prevMetrics.click_rate === 'number' ? prevMetrics.click_rate : 0,
      },
    },
  });

  manualNotificationsCache = null;
  return { delivered };
}

// 2. Notifications
export async function getManualNotifications() {
  const now = Date.now();
  if (manualNotificationsCache && (now - manualNotificationsCache.timestamp < MANUAL_NOTIFICATIONS_CACHE_TTL)) {
    return manualNotificationsCache.data;
  }

  await processDueScheduledPushCampaigns();

  const [notifRows, broadcastCampaigns] = await Promise.all([
    prisma.notifications.findMany({
      where: { type: 'system' },
      take: 80,
      orderBy: { created_at: 'desc' },
      include: {
        profiles: { select: { full_name: true, email: true } },
      },
    }),
    prisma.push_campaigns.findMany({
      orderBy: { created_at: 'desc' },
      take: 60,
    }),
  ]);

  const campaignAsNotifs = broadcastCampaigns
    .filter((c) => (c.metrics as Record<string, unknown> | null)?.admin_broadcast === true)
    .slice(0, 40)
    .map((c) => ({
    id: c.id,
    title: c.title,
    message: c.message,
    created_at: c.created_at,
    is_read: false,
    type: 'system',
    metadata: {
      target_audience: (c.metrics as Record<string, unknown> | null)?.target_audience,
      schedule_type: c.status === 'scheduled' ? 'scheduled' : 'now',
      scheduled_for: c.scheduled_at,
      campaign_record: true,
      campaign_status: c.status,
      channel: (c.metrics as Record<string, unknown> | null)?.channel ?? 'push',
      target_count: (c.metrics as Record<string, unknown> | null)?.delivered_count,
    },
    profiles: null as { full_name: string | null; email: string | null } | null,
  }));

  const merged = [...notifRows, ...campaignAsNotifs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const result = merged.slice(0, 80);
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

  if (data.scheduled_for) {
    return prisma.push_campaigns.create({
      data: {
        title: data.title,
        message: data.message,
        status: 'scheduled',
        scheduled_at: new Date(data.scheduled_for),
        metrics: {
          channel: data.channel || 'push',
          target_audience: data.target_audience,
          segment_id: data.segment_id || null,
          userIds: Array.isArray(data.userIds) ? data.userIds : undefined,
          admin_broadcast: true,
        },
      },
    });
  }

  const baseMetadata = {
    channel: data.channel || 'push',
    target_audience: data.target_audience,
    segment_id: data.segment_id || null,
    scheduled_for: data.scheduled_for || null,
    schedule_type: data.scheduled_for ? 'scheduled' : 'now',
  };

  if (data.target_audience === 'segment' && data.segment_id) {
    const seg = await prisma.user_segments.findUnique({
      where: { id: data.segment_id },
    });
    if (!seg) throw new Error('Segment not found');
    const rules = extractSegmentRules(seg.criteria);
    const where = buildProfileWhereFromRules(rules);
    const profiles = await prisma.profiles.findMany({
      where,
      select: { id: true, notification_preferences: true },
    });

    const eligibleUsers = profiles.filter((u) => shouldSend(u.notification_preferences));

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

  if (data.target_audience === 'core') {
    const coreUsers = await prisma.subscriptions.findMany({
      where: { status: 'active', plan_type: 'core' },
      select: {
        user_id: true,
        profiles: { select: { notification_preferences: true } },
      },
    });

    const eligibleUsers = coreUsers.filter((u) => shouldSend(u.profiles?.notification_preferences));

    if (eligibleUsers.length === 0) return { count: 0 };

    return notificationsService.createManyForUsers(
      eligibleUsers.map((s) => s.user_id),
      {
        type: data.type || 'system',
        title: data.title,
        message: data.message,
        metadata: {
          ...baseMetadata,
          target_audience: 'core',
          target_count: eligibleUsers.length,
        },
      }
    );
  }

  if (data.target_audience === 'pro') {
    const proUsers = await prisma.subscriptions.findMany({
      where: { status: 'active', plan_type: 'pro' },
      select: {
        user_id: true,
        profiles: { select: { notification_preferences: true } },
      },
    });

    const eligibleUsers = proUsers.filter((u) => shouldSend(u.profiles?.notification_preferences));

    if (eligibleUsers.length === 0) return { count: 0 };

    return notificationsService.createManyForUsers(
      eligibleUsers.map((s) => s.user_id),
      {
        type: data.type || 'system',
        title: data.title,
        message: data.message,
        metadata: {
          ...baseMetadata,
          target_audience: 'pro',
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
  await processDueScheduledPushCampaigns();
  return prisma.push_campaigns.findMany({
    orderBy: { created_at: 'desc' },
  });
}

export async function createPushCampaign(data: any) {
  const metrics = {
    ...(data.metrics && typeof data.metrics === 'object' ? data.metrics : {}),
    ...(data.priority ? { priority: data.priority } : {}),
    ...(data.target_audience ? { target_audience: data.target_audience } : {}),
  };
  return prisma.push_campaigns.create({
    data: {
      title: data.title,
      message: data.message,
      target_segment_id: data.target_segment_id ?? null,
      status: data.status ?? 'draft',
      scheduled_at: data.scheduled_at ? new Date(data.scheduled_at) : null,
      sent_at: data.sent_at ? new Date(data.sent_at) : null,
      metrics: Object.keys(metrics).length ? metrics : undefined,
      created_by: data.created_by ?? null,
    },
  });
}

export async function updatePushCampaign(id: string, data: any) {
  const prev = await prisma.push_campaigns.findUnique({ where: { id } });
  const prevMetrics =
    prev?.metrics && typeof prev.metrics === 'object' && prev.metrics !== null
      ? (prev.metrics as Record<string, unknown>)
      : {};
  const mergedMetrics = {
    ...prevMetrics,
    ...(data.metrics && typeof data.metrics === 'object' ? data.metrics : {}),
    ...(data.priority !== undefined ? { priority: data.priority } : {}),
    ...(data.target_audience !== undefined ? { target_audience: data.target_audience } : {}),
  };
  return prisma.push_campaigns.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.message !== undefined ? { message: data.message } : {}),
      ...(data.target_segment_id !== undefined ? { target_segment_id: data.target_segment_id } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.scheduled_at !== undefined
        ? { scheduled_at: data.scheduled_at ? new Date(data.scheduled_at) : null }
        : {}),
      ...(data.sent_at !== undefined ? { sent_at: data.sent_at ? new Date(data.sent_at) : null } : {}),
      metrics: Object.keys(mergedMetrics).length ? mergedMetrics : undefined,
    },
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
  const take = Math.min(Math.max(limit, 1), 200);
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
      },
      profiles_support_tickets_assigned_toToprofiles: {
        select: { full_name: true, email: true }
      }
    }
  });
}

export async function updateSupportTicket(id: string, data: any) {
  const patch: Prisma.support_ticketsUncheckedUpdateInput = {
    updated_at: new Date(),
  };
  if (data.status !== undefined) patch.status = data.status;
  if (data.priority !== undefined) patch.priority = data.priority;
  if (data.assigned_to !== undefined) patch.assigned_to = data.assigned_to;
  if (data.description !== undefined) patch.description = data.description;
  if (data.subject !== undefined) patch.subject = data.subject;
  return prisma.support_tickets.update({
    where: { id },
    data: patch,
  });
}

// 6. Community Management
export async function getCommunityStats() {
  const now = Date.now();
  if (communityStatsCache && (now - communityStatsCache.timestamp < COMMUNITY_STATS_CACHE_TTL)) {
    return communityStatsCache.data;
  }

  const [totalGroups, totalPosts, totalComments, flaggedPosts, activePosts] = await Promise.all([
    prisma.community_groups.count({ where: { archived_at: null } }),
    prisma.community_posts.count({ where: { deleted_at: null } }),
    prisma.community_comments.count(),
    prisma.community_posts.count({ where: { deleted_at: null, flag_count: { gt: 0 } } }),
    prisma.community_posts.count({ where: { deleted_at: null, locked_at: null } }),
  ]);
  
  const result = { totalGroups, totalPosts, totalComments, flaggedPosts, activePosts };
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

export async function getCommunityPostsForAdmin() {
  return prisma.community_posts.findMany({
    where: { deleted_at: null },
    orderBy: { created_at: 'desc' },
    take: 500,
    include: {
      profiles: { select: { full_name: true, email: true } },
      community_groups: { select: { name: true, category: true } },
      _count: { select: { community_comments: true } },
    },
  });
}

export async function updateCommunityPostAdmin(
  id: string,
  data: { locked?: boolean; flag_count?: number }
) {
  invalidateCommunityCaches();
  const patch: Prisma.community_postsUpdateInput = {};
  if (data.locked === true) patch.locked_at = new Date();
  if (data.locked === false) patch.locked_at = null;
  if (typeof data.flag_count === 'number') patch.flag_count = data.flag_count;
  return prisma.community_posts.update({
    where: { id },
    data: patch,
  });
}

export async function softDeleteCommunityPostAdmin(id: string) {
  invalidateCommunityCaches();
  return prisma.community_posts.update({
    where: { id },
    data: { deleted_at: new Date() },
  });
}

export async function updateCommunityGroupAdmin(id: string, data: any) {
  invalidateCommunityCaches();
  const patch: Prisma.community_groupsUpdateInput = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.description !== undefined) patch.description = data.description;
  if (data.category !== undefined) patch.category = data.category;
  if (data.privacy !== undefined) patch.privacy = data.privacy;
  if (data.archived === true) patch.archived_at = new Date();
  if (data.archived === false) patch.archived_at = null;
  return prisma.community_groups.update({
    where: { id },
    data: patch,
  });
}

export async function deleteCommunityGroupAdmin(id: string) {
  invalidateCommunityCaches();
  return prisma.community_groups.delete({ where: { id } });
}

export async function getCommunityGroupMembersAdmin(groupId: string) {
  return prisma.community_group_members.findMany({
    where: { group_id: groupId },
    include: {
      profiles: { select: { full_name: true, email: true } },
    },
  });
}

const CONTENT_PERF_PIE_COLORS = [
  '#3b82f6',
  '#f59e0b',
  '#10b981',
  '#ec4899',
  '#6366f1',
  '#d97706',
  '#0891b2',
  '#0284c7',
  '#0d9488',
];

function pctChange(cur: number, prev: number): number {
  if (prev <= 0) return cur > 0 ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

/** Aggregates wellness session completions, journal volume, and tool/category breakdowns for admin analytics. */
export async function getContentPerformanceAnalytics(rangeDays: 7 | 30 | 90) {
  const ms = rangeDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const since = new Date(now - ms);
  const prevSince = new Date(now - 2 * ms);

  const [
    progressRows,
    prevProgressRows,
    journalCount,
    prevJournalCount,
    categoryToolCounts,
  ] = await Promise.all([
    prisma.user_wellness_progress.findMany({
      where: { completed_at: { gte: since } },
      include: {
        wellness_tools: { select: { title: true, category: true } },
      },
    }),
    prisma.user_wellness_progress.findMany({
      where: {
        completed_at: { gte: prevSince, lt: since },
      },
    }),
    prisma.journal_entries.count({ where: { created_at: { gte: since } } }),
    prisma.journal_entries.count({
      where: { created_at: { gte: prevSince, lt: since } },
    }),
    prisma.wellness_tools.groupBy({
      by: ['category'],
      _count: { id: true },
    }),
  ]);

  const totalCompletions = progressRows.length;
  const prevCompletions = prevProgressRows.length;
  const positiveRatings = progressRows.filter((r) => (r.feedback_rating ?? 0) >= 4).length;
  const ratings = progressRows
    .filter((r) => r.feedback_rating != null)
    .map((r) => r.feedback_rating as number);
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
  const feedbackRate =
    totalCompletions > 0 ? Math.round((ratings.length / totalCompletions) * 1000) / 10 : 0;

  const activityScore = totalCompletions + journalCount;
  const prevActivity = prevCompletions + prevJournalCount;

  const numBuckets = Math.min(8, Math.max(2, Math.ceil(rangeDays / 7)));
  const bucketMs = ms / numBuckets;
  const weeklyTrend: {
    date: string;
    views: number;
    likes: number;
    shares: number;
    completions: number;
  }[] = [];

  for (let i = 0; i < numBuckets; i++) {
    const wStart = new Date(since.getTime() + i * bucketMs);
    const wEnd = new Date(Math.min(now, since.getTime() + (i + 1) * bucketMs));
    const weekRows = progressRows.filter(
      (r) => r.completed_at && r.completed_at >= wStart && r.completed_at < wEnd
    );
    const weekLikes = weekRows.filter((r) => (r.feedback_rating ?? 0) >= 4).length;
    const label = `${wStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    weeklyTrend.push({
      date: label,
      views: weekRows.length + Math.floor(weekRows.length * 0.5),
      likes: weekLikes,
      shares: Math.max(0, Math.floor(weekRows.length * 0.08)),
      completions: weekRows.length,
    });
  }

  const byTool = new Map<
    string,
    { title: string; category: string; count: number; ratings: number[] }
  >();
  for (const r of progressRows) {
    const t = r.wellness_tools;
    if (!t) continue;
    const cur = byTool.get(r.tool_id) ?? {
      title: t.title,
      category: t.category,
      count: 0,
      ratings: [] as number[],
    };
    cur.count++;
    if (r.feedback_rating != null) cur.ratings.push(r.feedback_rating);
    byTool.set(r.tool_id, cur);
  }

  const categoryToDisplayType = (cat: string): string => {
    if (cat === 'Exercise') return 'activity';
    if (cat === 'Meditation' || cat === 'Sleep Health') return 'video';
    return 'article';
  };

  const topTools = [...byTool.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([id, v]) => {
      const avgR = v.ratings.length
        ? v.ratings.reduce((a, b) => a + b, 0) / v.ratings.length
        : 4;
      const engagement = Math.min(100, 55 + Math.min(45, v.count * 2));
      return {
        id,
        title: v.title,
        type: categoryToDisplayType(v.category),
        category: v.category,
        views: v.count * 3,
        engagement,
        rating: Math.min(5, Math.round(avgR * 10) / 10),
      };
    });

  const byCat = new Map<string, { count: number; withFeedback: number }>();
  for (const r of progressRows) {
    const c = r.wellness_tools?.category ?? 'Unknown';
    const cur = byCat.get(c) ?? { count: 0, withFeedback: 0 };
    cur.count++;
    if (r.feedback_rating != null) cur.withFeedback++;
    byCat.set(c, cur);
  }

  const maxCat = Math.max(1, ...[...byCat.values()].map((v) => v.count));
  const categoryEngagement = [...byCat.entries()].map(([category, v]) => ({
    category,
    engagement: Math.round((v.count / maxCat) * 100),
    views: v.count * 50,
  }));

  const totalTools = categoryToolCounts.reduce((s, c) => s + c._count.id, 0);
  const contentTypeData = categoryToolCounts.map((c, i) => ({
    name: c.category,
    value: totalTools ? Math.round((c._count.id / totalTools) * 100) : 0,
    count: c._count.id,
    color: CONTENT_PERF_PIE_COLORS[i % CONTENT_PERF_PIE_COLORS.length],
  }));

  const completionRates = [...byCat.entries()].map(([type, v]) => ({
    type,
    started: v.count,
    completed: v.withFeedback,
    rate: v.count ? Math.round((v.withFeedback / v.count) * 100) : 0,
  }));

  const trending = weeklyTrend.map((w, i) => ({
    week: w.date || `W${i + 1}`,
    trending: w.completions,
    views: w.views,
  }));

  const prevPositive = prevProgressRows.filter((r) => (r.feedback_rating ?? 0) >= 4).length;
  const prevRatingVals = prevProgressRows
    .filter((r) => r.feedback_rating != null)
    .map((r) => r.feedback_rating as number);
  const prevAvgRating = prevRatingVals.length
    ? prevRatingVals.reduce((a, b) => a + b, 0) / prevRatingVals.length
    : 0;
  const prevFeedbackRate =
    prevCompletions > 0
      ? Math.round((prevRatingVals.length / prevCompletions) * 1000) / 10
      : 0;

  return {
    rangeDays,
    generatedAt: new Date().toISOString(),
    summary: {
      totalViews: activityScore,
      totalEngagement: positiveRatings + Math.min(journalCount, Math.floor(activityScore * 0.2)),
      avgCompletionPct: feedbackRate,
      avgRating: Math.round(avgRating * 10) / 10,
      viewsChangePct: pctChange(activityScore, prevActivity),
      engagementChangePct: pctChange(positiveRatings, prevPositive),
      completionChangePct: pctChange(feedbackRate, prevFeedbackRate),
      ratingChangePct: pctChange(avgRating, prevAvgRating),
    },
    weeklyTrend,
    topTools,
    categoryEngagement,
    contentTypeData,
    completionRates,
    trending,
  };
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

  const ended = await endSession(session.user_id, session.id);
  liveSessionsCache = null;
  return ended;
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

  const updated = await prisma.app_sessions.update({
    where: { id: sessionId },
    data: {
      config: updatedConfig
    }
  });
  liveSessionsCache = null;
  return updated;
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

export async function getAdminSystemHealth() {
  const mem = process.memoryUsage();
  const uptime = process.uptime();
  let databaseConnected = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseConnected = true;
  } catch {
    databaseConnected = false;
  }
  const [activeSessions, errors24h] = await Promise.all([
    prisma.app_sessions.count({
      where: { ended_at: null, started_at: { not: null } },
    }),
    prisma.error_logs.count({
      where: { created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
  ]);
  return {
    timestamp: new Date().toISOString(),
    uptimeSeconds: uptime,
    memoryHeapUsedMb: mem.heapUsed / 1024 / 1024,
    memoryHeapTotalMb: mem.heapTotal / 1024 / 1024,
    memoryRssMb: mem.rss / 1024 / 1024,
    databaseConnected,
    activeSessions,
    errors24h,
  };
}

export async function resolveErrorLog(id: string) {
  await prisma.error_logs.update({
    where: { id },
    data: {
      status: 'resolved',
      resolved_at: new Date(),
    },
  });
  invalidateErrorLogsCache();
}

export async function deleteResolvedErrorLogs() {
  const result = await prisma.error_logs.deleteMany({
    where: { status: 'resolved' },
  });
  invalidateErrorLogsCache();
  return result;
}

export async function markSessionRecordingReviewed(sessionId: string, reviewerId: string) {
  const session = await prisma.app_sessions.findUnique({
    where: { id: sessionId },
  });
  if (!session) {
    throw new Error('Session not found');
  }
  if (!session.ended_at) {
    throw new Error('Session is still active');
  }
  const currentConfig = (session.config || {}) as Record<string, unknown>;
  const updatedConfig = {
    ...currentConfig,
    status: 'reviewed',
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString(),
  };
  return prisma.app_sessions.update({
    where: { id: sessionId },
    data: {
      config: updatedConfig as Prisma.InputJsonValue,
    },
  });
}

export async function updateSessionRecordingMeta(
  sessionId: string,
  input: { admin_flagged?: boolean; review_notes?: string }
) {
  const session = await prisma.app_sessions.findUnique({
    where: { id: sessionId },
  });
  if (!session) {
    throw new Error('Session not found');
  }
  const currentConfig = (session.config || {}) as Record<string, unknown>;
  const updatedConfig = { ...currentConfig };
  if (typeof input.admin_flagged === 'boolean') {
    updatedConfig.admin_flagged = input.admin_flagged;
  }
  if (typeof input.review_notes === 'string') {
    updatedConfig.review_notes = input.review_notes;
  }
  return prisma.app_sessions.update({
    where: { id: sessionId },
    data: {
      config: updatedConfig as Prisma.InputJsonValue,
    },
  });
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
        select: {
          full_name: true,
          email: true,
          phone: true,
          timezone: true,
          emergency_contact_name: true,
          emergency_contact_phone: true,
          emergency_contact_relationship: true,
        },
      },
      profiles_crisis_events_assigned_toToprofiles: {
        select: { full_name: true, email: true, phone: true },
      },
    },
  });

  if (!event) return null;

  const userId = event.user_id;

  const [prior_crisis_events, recent_mood_entries, emergency_contacts_list] = await Promise.all([
    prisma.crisis_events.findMany({
      where: { user_id: userId, id: { not: id } },
      orderBy: { created_at: 'desc' },
      take: 12,
      select: {
        id: true,
        created_at: true,
        risk_level: true,
        event_type: true,
        status: true,
        keywords: true,
      },
    }),
    prisma.mood_entries.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 12,
      select: {
        created_at: true,
        mood: true,
        intensity: true,
        notes: true,
      },
    }),
    prisma.emergency_contacts.findMany({
      where: { user_id: userId },
      orderBy: [{ is_trusted: 'desc' }, { created_at: 'desc' }],
      take: 5,
      select: {
        name: true,
        relationship: true,
        phone: true,
        email: true,
        is_trusted: true,
      },
    }),
  ]);

  return {
    ...event,
    status: mapCrisisStatusFromDb(event.status as any),
    profiles: event.profiles_crisis_events_user_idToprofiles,
    assigned_profile: event.profiles_crisis_events_assigned_toToprofiles,
    prior_crisis_events: prior_crisis_events.map((e: any) => ({
      ...e,
      status: mapCrisisStatusFromDb(e.status || null),
    })),
    recent_mood_entries,
    emergency_contacts_list,
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

// --- Backup & Recovery (audit + logical metadata; physical backups are host-managed) ---

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms / 60000)} min`;
}

function relativeTime(d: Date): string {
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

async function collectTableCounts() {
  const [profiles, app_sessions, organizations, journal_entries, mood_entries] =
    await Promise.all([
      prisma.profiles.count(),
      prisma.app_sessions.count(),
      prisma.organizations.count(),
      prisma.journal_entries.count(),
      prisma.mood_entries.count(),
    ]);
  return { profiles, app_sessions, organizations, journal_entries, mood_entries };
}

function estimateLogicalBytes(counts: {
  profiles: number;
  app_sessions: number;
  organizations: number;
  journal_entries: number;
  mood_entries: number;
}): number {
  return Math.round(
    counts.profiles * 2048 +
      counts.app_sessions * 512 +
      counts.organizations * 256 +
      counts.journal_entries * 400 +
      counts.mood_entries * 200
  );
}

function serializeBackupRecord(r: {
  id: string;
  kind: string;
  status: string;
  size_bytes: bigint | null;
  duration_ms: number | null;
  storage_path: string | null;
  metadata: Prisma.JsonValue | null;
  error_message: string | null;
  created_at: Date;
  completed_at: Date | null;
  profiles: { full_name: string | null; email: string | null } | null;
}) {
  const sz = r.size_bytes != null ? Number(r.size_bytes) : null;
  const ts = r.completed_at ?? r.created_at;
  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    sizeBytes: r.size_bytes?.toString() ?? null,
    sizeFormatted: sz != null ? formatBytes(sz) : '—',
    durationMs: r.duration_ms,
    durationFormatted: formatDurationMs(r.duration_ms),
    storagePath: r.storage_path,
    metadata: r.metadata,
    errorMessage: r.error_message,
    createdAt: r.created_at.toISOString(),
    completedAt: r.completed_at?.toISOString() ?? null,
    timestampLabel: ts.toLocaleString(),
    relativeTime: relativeTime(ts),
    createdByName: r.profiles?.full_name || r.profiles?.email || null,
  };
}

export async function getBackupRecoveryDashboard() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const backupKinds = ['full', 'incremental', 'data_export'] as const;

  const [records, totalBackups, sumSize, lastRecord, recoveryRows] = await Promise.all([
    prisma.admin_backup_records.findMany({
      where: { kind: { in: [...backupKinds] } },
      orderBy: { created_at: 'desc' },
      take: 50,
      include: {
        profiles: { select: { full_name: true, email: true } },
      },
    }),
    prisma.admin_backup_records.count({
      where: { kind: { in: [...backupKinds] }, status: 'completed' },
    }),
    prisma.admin_backup_records.aggregate({
      where: { kind: { in: [...backupKinds] }, status: 'completed', size_bytes: { not: null } },
      _sum: { size_bytes: true },
    }),
    prisma.admin_backup_records.findFirst({
      where: { kind: { in: [...backupKinds] }, status: 'completed' },
      orderBy: { completed_at: 'desc' },
      select: { completed_at: true, created_at: true },
    }),
    prisma.admin_backup_records.findMany({
      where: {
        kind: 'full',
        status: 'completed',
        created_at: { gte: thirtyDaysAgo },
      },
      orderBy: { created_at: 'desc' },
      take: 30,
      select: {
        id: true,
        created_at: true,
        completed_at: true,
        size_bytes: true,
      },
    }),
  ]);

  const last = lastRecord?.completed_at ?? lastRecord?.created_at;
  const sumBytes = sumSize._sum.size_bytes;

  return {
    records: records.map((r) => serializeBackupRecord(r)),
    stats: {
      lastBackupRelative: last ? relativeTime(last) : 'Never',
      totalBackups,
      storageUsedFormatted: formatBytes(Number(sumBytes ?? 0)),
      storageUsedBytes: sumBytes?.toString() ?? '0',
      recoveryPointsCount: recoveryRows.length,
      recoveryRetentionDays: Number(process.env.ADMIN_BACKUP_RETENTION_DAYS || 30),
    },
    schedule: {
      full:
        process.env.ADMIN_BACKUP_FULL_SCHEDULE ||
        'Physical backups: use your database host (e.g. Supabase Dashboard → Database → Backups).',
      incremental:
        process.env.ADMIN_BACKUP_INCREMENTAL_SCHEDULE ||
        'Point-in-time recovery: available on the host when enabled; not configured in this app.',
      snapshot:
        process.env.ADMIN_BACKUP_SNAPSHOT_SCHEDULE ||
        'Logical snapshots below are recorded in this app when you run Create Backup.',
    },
    recoveryPoints: recoveryRows.map((rp) => {
      const t = rp.completed_at ?? rp.created_at;
      const sz = rp.size_bytes != null ? Number(rp.size_bytes) : 0;
      return {
        id: rp.id,
        date: t.toISOString(),
        dateLabel: t.toLocaleString(),
        type: 'Full',
        sizeFormatted: formatBytes(sz),
      };
    }),
  };
}

export async function createLogicalBackup(userId: string, kind: 'full' | 'incremental') {
  const start = Date.now();
  const row = await prisma.admin_backup_records.create({
    data: {
      kind: kind === 'incremental' ? 'incremental' : 'full',
      status: 'in_progress',
      created_by: userId,
    },
  });
  try {
    const counts = await collectTableCounts();
    const estimated = estimateLogicalBytes(counts);
    const durationMs = Date.now() - start;
    await prisma.admin_backup_records.update({
      where: { id: row.id },
      data: {
        status: 'completed',
        duration_ms: durationMs,
        size_bytes: BigInt(estimated),
        completed_at: new Date(),
        storage_path:
          'Host-managed (Postgres/Supabase). This row records a logical snapshot for audit.',
        metadata: {
          counts,
          note: 'Estimated logical size from table row counts. Not a downloadable file.',
        } as Prisma.InputJsonValue,
      },
    });
  } catch (e) {
    await prisma.admin_backup_records.update({
      where: { id: row.id },
      data: {
        status: 'failed',
        error_message: e instanceof Error ? e.message : String(e),
        completed_at: new Date(),
        duration_ms: Date.now() - start,
      },
    });
    throw e;
  }
  return getBackupRecoveryDashboard();
}

export type DataExportOptions = {
  exportType?: string;
  format?: string;
  dateRange?: string;
  compression?: string;
};

export async function createDataExportRecord(userId: string, options: DataExportOptions = {}) {
  const start = Date.now();
  const counts = await collectTableCounts();
  const payload = {
    exportedAt: new Date().toISOString(),
    version: 1,
    counts,
    exportOptions: {
      exportType: options.exportType ?? 'full',
      format: options.format ?? 'json',
      dateRange: options.dateRange ?? 'all',
      compression: options.compression ?? 'none',
    },
    disclaimer:
      'Metadata-only export. No PII. For full database backups use your hosting provider (e.g. Supabase pg_dump / backups).',
  };
  const json = JSON.stringify(payload);
  await prisma.admin_backup_records.create({
    data: {
      kind: 'data_export',
      status: 'completed',
      duration_ms: Date.now() - start,
      size_bytes: BigInt(Buffer.byteLength(json, 'utf8')),
      created_by: userId,
      completed_at: new Date(),
      metadata: payload as Prisma.InputJsonValue,
      storage_path: 'JSON export (download from this page)',
    },
  });
  return { payload, dashboard: await getBackupRecoveryDashboard() };
}

export async function requestRestoreFromBackup(userId: string, backupId: string) {
  const backup = await prisma.admin_backup_records.findUnique({ where: { id: backupId } });
  if (!backup) throw new Error('Backup record not found');
  await prisma.admin_backup_records.create({
    data: {
      kind: 'restore_request',
      status: 'completed',
      created_by: userId,
      completed_at: new Date(),
      metadata: {
        requestedBackupId: backupId,
        requestedKind: backup.kind,
        note: 'Restore is not executed from this app. Use Supabase (or your host) PITR / backup restore, or contact operations.',
      } as Prisma.InputJsonValue,
      storage_path: 'See database host console',
    },
  });
  return getBackupRecoveryDashboard();
}

export async function getBackupRecordJsonForDownload(id: string) {
  const r = await prisma.admin_backup_records.findUnique({ where: { id } });
  if (!r) return null;
  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    createdAt: r.created_at.toISOString(),
    completedAt: r.completed_at?.toISOString() ?? null,
    metadata: r.metadata,
    sizeBytes: r.size_bytes?.toString() ?? null,
    durationMs: r.duration_ms,
    storagePath: r.storage_path,
    errorMessage: r.error_message,
  };
}
