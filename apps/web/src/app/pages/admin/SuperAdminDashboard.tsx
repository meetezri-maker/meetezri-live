import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { adminCard, adminBtnSecondary, adminQuickAction, adminBtnPrimary, adminKpiTile, adminPageHeader, adminPageHeaderTitle, adminPageHeaderActions, adminPageHeading, adminPageSubtitle } from "@/app/admin/adminPageChrome";
import { cn } from "@/lib/utils";
import { api } from "../../../lib/api";
import { motion } from "motion/react";
import {
  Users,
  Globe,
  TrendingUp,
  Activity,
  Server,
  AlertTriangle,
  DollarSign,
  Crown,
  CalendarDays,
  CheckCircle2,
  Clock,
  Settings,
  Zap,
  Shield,
  MessageSquare,
  UserCheck,
  BarChart3,
  Eye,
  Download,
  Smile,
  ChevronLeft,
  ChevronRight,
  Loader2,
  HeartPulse,
  Timer,
  Brain,
  BookOpen,
  Siren,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { downloadCsv } from "../../../lib/adminAnalytics";
import { Skeleton } from "../../components/ui/skeleton";
import { Calendar } from "../../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import {
  Line,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
} from "recharts";

const PERIOD_RANGE_DAYS = {
  week: 7,
  month: 30,
  year: 365,
} as const;

const MIN_STATS_YEAR = 2020;

function clampStatsYear(y: number): number {
  const maxY = new Date().getUTCFullYear();
  return Math.min(Math.max(y, MIN_STATS_YEAR), maxY);
}

/** Full calendar year in UTC-friendly YYYY-MM-DD (used for default range). */
function fullYearRange(y: number): { from: string; to: string } {
  const yy = clampStatsYear(y);
  return { from: `${yy}-01-01`, to: `${yy}-12-31` };
}

function formatYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYmdLocal(s: string): Date {
  const parts = s.split("-").map((x) => parseInt(x, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return new Date();
  }
  return new Date(parts[0]!, parts[1]! - 1, parts[2]!);
}

function formatReadableRangeDate(isoYmd: string): string {
  const d = parseYmdLocal(isoYmd);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function anchorYearFromRange(range: { from: string }): number {
  const y = parseInt(range.from.slice(0, 4), 10);
  return Number.isFinite(y) ? y : new Date().getUTCFullYear();
}

const MAX_MONTH_OFFSET = 120;

/** Rolling 30-day window in UTC, shifted back by `monthOffset` blocks (aligned with dashboard stats). */
function rolling30DayRangeUtc(monthOffset: number): { dateFrom: string; dateTo: string } {
  const end = new Date(
    Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate(),
      0,
      0,
      0,
      0
    )
  );
  end.setUTCDate(end.getUTCDate() - monthOffset * 30);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);
  return {
    dateFrom: start.toISOString().slice(0, 10),
    dateTo: end.toISOString().slice(0, 10),
  };
}

/** Compact UTC range for chart labels (API returns ISO instants). */
function formatUtcRangeCaption(isoStart: string, isoEnd: string): string {
  const s = new Date(isoStart);
  const e = new Date(isoEnd);
  const o: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  };
  return `${s.toLocaleDateString(undefined, o)} → ${e.toLocaleDateString(undefined, o)}`;
}

type CsvRow = {
  section: string;
  category: string;
  label: string;
  value1: string;
  value2: string;
  value3: string;
};

function cell(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function buildSuperAdminCsvRows(
  statsData: Record<string, unknown> | null,
  query: Record<string, unknown>
): CsvRow[] {
  const rows: CsvRow[] = [];
  const push = (section: string, category: string, label: string, v1 = "", v2 = "", v3 = "") => {
    rows.push({ section, category, label, value1: v1, value2: v2, value3: v3 });
  };

  push("Meta", "export", "exportedAt", new Date().toISOString());
  for (const [k, v] of Object.entries(query)) {
    push("Meta", "query", k, cell(v));
  }

  if (!statsData) {
    push("Meta", "note", "stats", "empty");
    return rows;
  }

  const s = statsData as Record<string, unknown>;
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? String(x) : cell(x));

  push("Summary", "totals", "totalUsers", num(s.totalUsers));
  push("Summary", "totals", "activeSessions", num(s.activeSessions));
  push("Summary", "totals", "totalSessions", num(s.totalSessions));
  push("Summary", "totals", "avgSessionLength", num(s.avgSessionLength));
  push("Summary", "totals", "crisisAlerts", num(s.crisisAlerts));
  push("Summary", "totals", "revenue", num(s.revenue));
  if (s.rangeStart != null) push("Summary", "range", "rangeStart", cell(s.rangeStart));
  if (s.rangeEnd != null) push("Summary", "range", "rangeEnd", cell(s.rangeEnd));
  if (s.rangeDays != null) push("Summary", "range", "rangeDays", num(s.rangeDays));

  const kpi = s.kpi as Record<string, unknown> | undefined;
  if (kpi && typeof kpi === "object") {
    for (const [k, v] of Object.entries(kpi)) {
      push("KPI", "kpi", k, cell(v));
    }
  }

  const ph = s.processHealth as Record<string, unknown> | undefined;
  if (ph && typeof ph === "object") {
    for (const [k, v] of Object.entries(ph)) {
      push("ProcessHealth", "process", k, cell(v));
    }
  }

  const mocked = s.mockedSections as string[] | undefined;
  if (mocked?.length) {
    push("Notes", "warning", "mockedSections", mocked.join("; "));
  }

  for (const r of (s.userGrowth as any[]) || []) {
    push(
      "UserGrowth",
      "series",
      cell(r?.month),
      num(r?.users),
      num(r?.orgs)
    );
  }

  for (const r of (s.sessionActivity as any[]) || []) {
    push(
      "SessionActivity",
      "daily",
      cell(r?.day),
      num(r?.sessions),
      num(r?.duration)
    );
  }

  for (const r of (s.revenueData as any[]) || []) {
    push("Revenue", "series", cell(r?.month), num(r?.revenue));
  }

  for (const r of (s.systemHealth as any[]) || []) {
    push(
      "SystemHealth",
      "metric",
      cell(r?.name),
      cell(r?.value),
      cell(r?.status),
      num(r?.percentage)
    );
  }

  for (const r of (s.platformDistribution as any[]) || []) {
    push(
      "PlatformDistribution",
      "share",
      cell(r?.name),
      num(r?.value),
      cell(r?.color)
    );
  }

  const hr = s.hourlyActivity as any[] | undefined;
  if (hr?.length) {
    for (const r of hr) {
      push("HourlyActivity", "hour", cell(r?.hour), num(r?.sessions));
    }
  }

  return rows;
}

/** Avoid bogus "20,000d ago" when dates are null/epoch (JS treats `new Date(null)` as 1970). */
function formatTimeAgo(iso: string | null | undefined) {
  if (iso == null || iso === "") return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const year2000 = Date.UTC(2000, 0, 1);
  if (t < year2000) {
    return new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function formatPctSigned(n: number) {
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function formatUptime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatMinutes(mins: number) {
  if (!Number.isFinite(mins) || mins <= 0) return "—";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "rgba(255, 255, 255, 0.97)",
  border: "1px solid rgba(167, 139, 250, 0.28)",
  borderRadius: "14px",
  boxShadow: "0 16px 45px rgba(67, 56, 202, 0.16)",
  backdropFilter: "blur(6px)",
};

const CHART_GRID_COLOR = "#e8e8ed";
const CHART_AXIS_COLOR = "#e2e8f0";
const CHART_TICK_STYLE = { fill: "#64748b", fontSize: 12 };

function buildActivityFeedFromRecent(recent: any) {
  const feed: {
    action: string;
    user: string;
    time: string;
    type: string;
    at: number;
  }[] = [];

  for (const s of recent.sessions || []) {
    const sessionAt = s.started_at ?? s.created_at;
    feed.push({
      action: "Session activity",
      user: s.profiles?.full_name || s.profiles?.email || "User",
      time: formatTimeAgo(sessionAt),
      type: "session",
      at: new Date(sessionAt).getTime(),
    });
  }
  for (const m of recent.moodEntries || []) {
    feed.push({
      action: "Mood check-in",
      user: m.profiles?.full_name || m.profiles?.email || "User",
      time: formatTimeAgo(m.created_at),
      type: "journal",
      at: new Date(m.created_at).getTime(),
    });
  }
  for (const a of recent.alerts || []) {
    feed.push({
      action: "Crisis alert",
      user: a.profiles?.full_name || a.profiles?.email || "User",
      time: formatTimeAgo(a.created_at),
      type: "crisis",
      at: new Date(a.created_at).getTime(),
    });
  }

  feed.sort((x, y) => y.at - x.at);
  return feed.slice(0, 12).map(({ at: _a, ...rest }) => rest);
}

function mapCrisisAlertsFromRecent(recent: any) {
  return (recent.alerts || []).map((a: any) => ({
    id: a.id,
    type:
      a.risk_level === "critical" || a.risk_level === "high"
        ? "critical"
        : "warning",
    message: `Crisis (${a.risk_level}): ${a.event_type || "Pending review"}`,
    time: formatTimeAgo(a.created_at),
    status: "pending",
  }));
}

/** Most recent check-ins in the last N days (not “today only,” which often looks empty). */
function filterRecentMoods(moods: any[], maxDays = 30, limit = 25) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - maxDays);
  return [...(moods || [])]
    .filter((m: any) => m?.created_at && !Number.isNaN(new Date(m.created_at).getTime()))
    .filter((m: any) => new Date(m.created_at) >= start)
    .sort(
      (a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, limit);
}

export function SuperAdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [avatarTotalSessions, setAvatarTotalSessions] = useState<number | null>(null);
  const [recentMoods, setRecentMoods] = useState<any[]>([]);
  const MOODS_PAGE_SIZE = 10;
  const [moodsPage, setMoodsPage] = useState(1);
  const [activityFeed, setActivityFeed] = useState<
    { action: string; user: string; time: string; type: string }[]
  >([]);
  const [crisisAlerts, setCrisisAlerts] = useState<
    { id: string; type: string; message: string; time: string; status: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(false);
  const [canPoll, setCanPoll] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<"week" | "month" | "year">("month");
  const [sessionWeekOffset, setSessionWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [yearRange, setYearRange] = useState(() =>
    fullYearRange(clampStatsYear(new Date().getUTCFullYear()))
  );
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [openRangeDraft, setOpenRangeDraft] = useState<{
    from?: Date;
    to?: Date;
  }>({});
  const isFirstDashboardLoad = useRef(true);

  const statsQuery = useMemo(() => {
    if (chartPeriod === "year") {
      return {
        chartPeriod: "year" as const,
        dateFrom: yearRange.from,
        dateTo: yearRange.to,
      };
    }
    if (chartPeriod === "month") {
      const { dateFrom, dateTo } = rolling30DayRangeUtc(monthOffset);
      return {
        chartPeriod: "month" as const,
        dateFrom,
        dateTo,
      };
    }
    return {
      chartPeriod: "week" as const,
      rangeDays: PERIOD_RANGE_DAYS.week,
      sessionWeekOffset,
    };
  }, [chartPeriod, yearRange, sessionWeekOffset, monthOffset]);

  const moodsTotalPages = useMemo(
    () => Math.max(1, Math.ceil((recentMoods?.length ?? 0) / MOODS_PAGE_SIZE)),
    [recentMoods?.length]
  );

  const pagedRecentMoods = useMemo(() => {
    const page = Math.min(Math.max(1, moodsPage), moodsTotalPages);
    const start = (page - 1) * MOODS_PAGE_SIZE;
    return (recentMoods ?? []).slice(start, start + MOODS_PAGE_SIZE);
  }, [recentMoods, moodsPage, moodsTotalPages]);

  useEffect(() => {
    // Reset/clamp when data changes (polling, filter changes, etc.)
    setMoodsPage((p) => Math.min(Math.max(1, p), moodsTotalPages));
  }, [moodsTotalPages, recentMoods?.length]);

  useEffect(() => {
    if (chartPeriod !== "week" && sessionWeekOffset !== 0) {
      setSessionWeekOffset(0);
    }
  }, [chartPeriod, sessionWeekOffset]);

  useEffect(() => {
    if (chartPeriod !== "month" && monthOffset !== 0) {
      setMonthOffset(0);
    }
  }, [chartPeriod, monthOffset]);

  useEffect(() => {
    let cancelled = false;
    const isFirstLoad = isFirstDashboardLoad.current;

    (async () => {
      if (isFirstLoad) {
        setLoading(true);
      } else {
        setChartsLoading(true);
      }

      try {
        const data = await api.admin.getStats({
          ...statsQuery,
          // Only skip the server cache when the chart period/range changes (non-first loads).
          // First load uses the cached result so it appears instantly.
          refresh: !isFirstLoad,
        });
        if (cancelled) return;
        setStats(data);

        if (isFirstLoad) {
          const [moods, recent, avatarStats] = await Promise.all([
            api.moods.getAllMoods(),
            api.admin.getRecentActivity(),
            api.aiAvatars.getAllWithUsageStats().catch(() => null),
          ]);
          if (cancelled) return;
          if (Array.isArray(avatarStats)) {
            const sum = (avatarStats as any[]).reduce((acc, a) => acc + (Number(a.session_count) || 0), 0);
            setAvatarTotalSessions(sum);
          }
          setRecentMoods(filterRecentMoods(moods));
          setActivityFeed(buildActivityFeedFromRecent(recent));
          setCrisisAlerts(mapCrisisAlertsFromRecent(recent));
          isFirstDashboardLoad.current = false;
          setCanPoll(true);
        }
      } catch (error) {
        console.error("Failed to fetch admin stats", error);
        toast.error("Could not load dashboard data.");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setChartsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [statsQuery]);

  useEffect(() => {
    if (!canPoll) return;

    const id = setInterval(async () => {
      try {
        const data = await api.admin.getStats(statsQuery);
        setStats(data);
        const [recent, moods] = await Promise.all([
          api.admin.getRecentActivity(),
          api.moods.getAllMoods(),
        ]);
        setActivityFeed(buildActivityFeedFromRecent(recent));
        setCrisisAlerts(mapCrisisAlertsFromRecent(recent));
        setRecentMoods(filterRecentMoods(moods));
      } catch {
        /* background refresh — ignore */
      }
    }, 30000);

    return () => clearInterval(id);
  }, [canPoll, statsQuery]);

  const exportReport = () => {
    try {
      const rows = buildSuperAdminCsvRows(
        stats != null ? (stats as Record<string, unknown>) : null,
        statsQuery as Record<string, unknown>
      );
      downloadCsv(`ezri-super-admin-report-${Date.now()}.csv`, rows as Record<string, unknown>[]);
      toast.success("CSV report downloaded.");
    } catch {
      toast.error("Export failed.");
    }
  };

  const activeUtcRange =
    stats?.rangeStart && stats?.rangeEnd
      ? formatUtcRangeCaption(stats.rangeStart, stats.rangeEnd)
      : null;

  const trendSubtitle = useMemo(() => {
    if (chartPeriod === "week") {
      return activeUtcRange
        ? `Cumulative signups by week · chart range ${activeUtcRange} (UTC)`
        : "Cumulative signups by ISO week · rolling 7-day chart range";
    }
    if (chartPeriod === "year")
      return `New signups by calendar year — ${yearRange.from} → ${yearRange.to} (UTC)`;
    return activeUtcRange
      ? `Cumulative total users by month · ${activeUtcRange} (UTC)`
      : "Cumulative total users by calendar month";
  }, [chartPeriod, yearRange, activeUtcRange]);

  const revenueSubtitle = useMemo(() => {
    if (chartPeriod === "week") {
      return activeUtcRange
        ? `Stripe volume by week · ${activeUtcRange} (UTC)`
        : "Stripe payment volume by week (chart range)";
    }
    if (chartPeriod === "year")
      return `Stripe volume by calendar year — ${yearRange.from} → ${yearRange.to} (UTC)`;
    return activeUtcRange
      ? `Stripe volume by calendar month · ${activeUtcRange} (UTC)`
      : "Stripe payment volume by calendar month";
  }, [chartPeriod, yearRange, activeUtcRange]);

  const sessionChartTitle = useMemo(() => {
    if (chartPeriod === "week") return "Weekly session activity";
    if (chartPeriod === "year") return "Yearly session activity";
    return "Monthly session activity";
  }, [chartPeriod]);

  const sessionChartSubtitle = useMemo(() => {
    if (chartPeriod === "year")
      return `Talk it out per day · ${yearRange.from} → ${yearRange.to} (UTC)`;
    if (activeUtcRange) return `Talk it out per day · ${activeUtcRange} (UTC)`;
    if (chartPeriod === "week")
      return `UTC week view · offset ${sessionWeekOffset === 0 ? "current" : sessionWeekOffset}`;
    return "Last 30 days (UTC) · daily buckets";
  }, [chartPeriod, sessionWeekOffset, yearRange, activeUtcRange]);

  const sessionLoadingText = useMemo(() => {
    if (chartPeriod === "week") return "Loading week…";
    if (chartPeriod === "year") return "Loading year…";
    return "Loading month…";
  }, [chartPeriod]);

  if (loading && !stats) {
    return (
      <AdminLayoutNew>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayoutNew>
    );
  }

  // Use stats data or fallbacks
  const userCount = stats?.totalUsers || 0;
  const sessionCount = stats?.activeSessions || 0;
  const revenue = stats?.revenue || 0;
  const totalSessions = avatarTotalSessions ?? stats?.totalSessions ?? 0;
  const avgSessionLength = stats?.avgSessionLength || 0;
  const avgMoodScore = stats?.avgMoodScore ?? null;
  const crisisAlertsCount = stats?.crisisAlerts || 0;
  const kpi = stats?.kpi as
    | {
        signupsLast7Days: number;
        signupsWeekOverWeekPct: number;
        sessionsLastHour: number;
        paymentVolumeThisMonthCents: number;
        paymentMomPct: number;
        subscriptionMrrApprox: number;
      }
    | undefined;
  const processHealth = stats?.processHealth as
    | { databaseConnected: boolean; errors24h: number; uptimeSeconds: number }
    | undefined;
  const userGrowthData = stats?.userGrowth || [];
  const sessionData = stats?.sessionActivity || [];
  const revenueData = stats?.revenueData || [];
  const platformDistribution = stats?.platformDistribution || [];
  const systemHealth = stats?.systemHealth || [];
  const mockedSections: string[] = stats?.mockedSections || [];
  const showOrgGrowthSeries = userGrowthData.some(
    (point: { orgs?: number }) => Number(point?.orgs ?? 0) > 0
  );

  const mrrEstimate = kpi?.subscriptionMrrApprox ?? 0;
  const payThisMonthUsd = (kpi?.paymentVolumeThisMonthCents ?? 0) / 100;

  return (
    <AdminLayoutNew>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className={adminPageHeader}>
            <div className={adminPageHeaderTitle}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg sm:h-12 sm:w-12">
                <Crown className="h-5 w-5 text-white sm:h-7 sm:w-7" />
              </div>
              <div className="min-w-0">
                <h1 className={adminPageHeading}>Super Admin Dashboard</h1>
                <p className={adminPageSubtitle}>
                  Platform-wide overview • Real-time monitoring
                </p>
              </div>
            </div>
            <div className={adminPageHeaderActions}>
              <Button variant="outline" size="sm" type="button" onClick={exportReport}>
                <Download className="w-4 h-4 mr-2" />
                Export Report
              </Button>
              <Link to="/admin/system-settings-enhanced">
                <Button size="sm" type="button" className={adminBtnPrimary}>
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>

        {mockedSections.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Some chart series have limited data: {mockedSections.join(", ")}. Totals and KPIs below are still from the database.
          </div>
        )}

        {/* KPI Stats — 8 uniform tiles */}
        <div className="admin-kpi-grid">
          {/* Total Users */}
          <motion.div
            className="min-h-[5.25rem] sm:h-[7.875rem]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
          >
            <Card className={cn(adminKpiTile, "border-purple-200 bg-gradient-to-br from-purple-50 to-white group")}>
              <div className="w-10 h-10 rounded-xl bg-purple-500 flex shrink-0 items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-start justify-between gap-2">
                  <p className="text-xs text-muted-foreground">Total Users</p>
                  <div
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      (kpi?.signupsWeekOverWeekPct ?? 0) >= 0
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {kpi != null ? formatPctSigned(kpi.signupsWeekOverWeekPct) : "—"}
                  </div>
                </div>
                <motion.div
                  key={userCount}
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="text-2xl font-bold tabular-nums"
                >
                  {userCount.toLocaleString()}
                </motion.div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <TrendingUp className="w-3 h-3 shrink-0 text-green-600" />
                  <span className="line-clamp-1 truncate">
                    {kpi != null
                      ? `${kpi.signupsLast7Days.toLocaleString()} signups in the last 7 days`
                      : "—"}
                  </span>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Active Talk it out */}
          <motion.div
            className="min-h-[5.25rem] sm:h-[7.875rem]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className={cn(adminKpiTile, "border-cyan-200 bg-gradient-to-br from-cyan-50 to-white group")}>
              <div className="w-10 h-10 rounded-xl bg-cyan-500 flex shrink-0 items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-start justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Active Talk it out <span className="opacity-70">(last 4h)</span>
                  </p>
                  <div className="flex shrink-0 items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-semibold text-green-600">Live</span>
                  </div>
                </div>
                <motion.div
                  key={sessionCount}
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="text-2xl font-bold tabular-nums"
                >
                  {sessionCount.toLocaleString()}
                </motion.div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Eye className="w-3 h-3 shrink-0 text-cyan-600" />
                  <span className="line-clamp-1 truncate">
                    {kpi != null
                      ? `${kpi.sessionsLastHour.toLocaleString()} sessions started in the last hour`
                      : "—"}
                  </span>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Revenue */}
          <motion.div
            className="min-h-[5.25rem] sm:h-[7.875rem]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className={cn(adminKpiTile, "border-green-200 bg-gradient-to-br from-green-50 to-white group")}>
              <div className="w-10 h-10 rounded-xl bg-green-500 flex shrink-0 items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-start justify-between gap-2">
                  <p className="text-xs text-muted-foreground">Revenue (cash, range)</p>
                  <div
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      (kpi?.paymentMomPct ?? 0) >= 0
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {kpi != null ? formatPctSigned(kpi.paymentMomPct) : "—"} vs prior month
                  </div>
                </div>
                <div className="text-2xl font-bold tabular-nums">{formatUsd(Number(revenue))}</div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <TrendingUp className="w-3 h-3 shrink-0 text-green-600" />
                  <span className="line-clamp-1 truncate leading-snug">
                    MRR est.: {formatUsd(mrrEstimate)} · {formatUsd(payThisMonthUsd)} (this month, Stripe)
                  </span>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Crisis Alerts */}
          <motion.div
            className="min-h-[5.25rem] sm:h-[7.875rem]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Link to="/admin/crisis-monitoring" className="block h-full">
              <Card className={cn(
                adminKpiTile,
                "cursor-pointer group",
                crisisAlertsCount > 0
                  ? "bg-gradient-to-br from-red-50 to-white border-red-300"
                  : "bg-gradient-to-br from-emerald-50 to-white border-emerald-200"
              )}>
                <div className={`w-10 h-10 rounded-xl flex shrink-0 items-center justify-center ${
                  crisisAlertsCount > 0 ? "bg-red-500" : "bg-emerald-500"
                }`}>
                  <Siren className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-start justify-between gap-2">
                    <p className="text-xs text-muted-foreground">Open Crisis Alerts</p>
                    {crisisAlertsCount > 0 && (
                      <div className="flex shrink-0 items-center gap-1">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-semibold text-red-600">Needs Review</span>
                      </div>
                    )}
                  </div>
                  <motion.div
                    key={crisisAlertsCount}
                    initial={{ scale: 1.1 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className={`text-2xl font-bold tabular-nums ${crisisAlertsCount > 0 ? "text-red-600" : "text-emerald-600"}`}
                  >
                    {crisisAlertsCount.toLocaleString()}
                  </motion.div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Shield className="w-3 h-3 shrink-0" />
                    <span className="line-clamp-1 truncate">
                      {crisisAlertsCount === 0 ? "All clear — no pending crisis events" : "Tap to review pending events"}
                    </span>
                  </div>
                </div>
              </Card>
            </Link>
          </motion.div>

          {/* Total AI Talk it out */}
          <motion.div
            className="min-h-[5.25rem] sm:h-[7.875rem]"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Card className={adminKpiTile}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex shrink-0 items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground line-clamp-1">Total AI Talk it out</p>
                <p className="text-2xl font-bold tabular-nums">{totalSessions.toLocaleString()}</p>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-1 truncate">All-time companion conversations</p>
              </div>
            </Card>
          </motion.div>

          {/* Avg Session Duration */}
          <motion.div
            className="min-h-[5.25rem] sm:h-[7.875rem]"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className={adminKpiTile}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex shrink-0 items-center justify-center">
                <Timer className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground line-clamp-1">Avg Session Length</p>
                <p className="text-2xl font-bold tabular-nums">{formatMinutes(avgSessionLength)}</p>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-1 truncate">Per completed AI session</p>
              </div>
            </Card>
          </motion.div>

          {/* Avg Mood Score */}
          <motion.div
            className="min-h-[5.25rem] sm:h-[7.875rem]"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <Card className={adminKpiTile}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex shrink-0 items-center justify-center">
                <HeartPulse className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground line-clamp-1">Avg Mood Score</p>
                <p className="text-2xl font-bold tabular-nums">
                  {avgMoodScore != null ? `${avgMoodScore}/10` : "—"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-1 truncate">All-time intensity average</p>
              </div>
            </Card>
          </motion.div>

          {/* API Uptime */}
          <motion.div
            className="min-h-[5.25rem] sm:h-[7.875rem]"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className={adminKpiTile}>
              <div className={`w-10 h-10 rounded-xl flex shrink-0 items-center justify-center ${
                processHealth?.databaseConnected === false
                  ? "bg-gradient-to-br from-red-500 to-rose-600"
                  : "bg-gradient-to-br from-teal-500 to-cyan-600"
              }`}>
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground line-clamp-1">API Uptime</p>
                <p className="text-2xl font-bold tabular-nums">
                  {formatUptime(processHealth?.uptimeSeconds ?? 0)}
                </p>
                <p className={`mt-1 text-xs line-clamp-1 truncate font-medium ${
                  processHealth?.databaseConnected === false ? "text-red-500" : "text-emerald-600"
                }`}>
                  {processHealth?.databaseConnected === false ? "DB unreachable" : "Database connected"}
                </p>
              </div>
            </Card>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card className="p-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <BarChart3 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="font-medium text-foreground">Charts</span>
                    {chartsLoading && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
                    )}
                  </div>
                  <ToggleGroup
                    type="single"
                    value={chartPeriod}
                    onValueChange={(v) => {
                      if (v === "week" || v === "month" || v === "year") setChartPeriod(v);
                    }}
                    variant="outline"
                    size="sm"
                    disabled={chartsLoading}
                    className="gap-0 rounded-lg border border-input bg-muted/45 p-0.5 shadow-none"
                    aria-label="Chart time period"
                  >
                    <ToggleGroupItem
                      value="week"
                      className="rounded-md px-3 text-xs sm:text-sm data-[state=on]:border-transparent data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90"
                    >
                      Week
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="month"
                      className="rounded-md px-3 text-xs sm:text-sm data-[state=on]:border-transparent data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90"
                    >
                      Month
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="year"
                      className="rounded-md px-3 text-xs sm:text-sm data-[state=on]:border-transparent data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90"
                    >
                      Year
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 lg:border-t-0 lg:pt-0 lg:pl-4 xl:border-l xl:pl-5">
              {chartPeriod === "year" && (
                <>
                  <div className="hidden h-6 w-px bg-border sm:block" aria-hidden />
                  <span className="text-sm text-muted-foreground">Date range</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    disabled={
                      chartsLoading || anchorYearFromRange(yearRange) <= MIN_STATS_YEAR
                    }
                    onClick={() =>
                      setYearRange(
                        fullYearRange(anchorYearFromRange(yearRange) - 1)
                      )
                    }
                    aria-label="Previous calendar year"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Popover
                    open={yearPickerOpen}
                    onOpenChange={(open) => {
                      setYearPickerOpen(open);
                      if (open) {
                        setOpenRangeDraft({
                          from: parseYmdLocal(yearRange.from),
                          to: parseYmdLocal(yearRange.to),
                        });
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={chartsLoading}
                        className="gap-2 font-medium"
                      >
                        <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
                        <span className="hidden max-w-[min(18rem,55vw)] truncate text-left sm:inline">
                          {yearRange.from} → {yearRange.to}
                        </span>
                        <span className="tabular-nums sm:hidden">Range</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto max-w-[min(100vw-1rem,720px)] p-0"
                      align="start"
                    >
                      <div className="space-y-2 border-b border-border px-4 py-3">
                        <div className="flex items-center justify-between gap-4 text-sm">
                          <span className="text-muted-foreground shrink-0">Start</span>
                          <span className="font-medium tabular-nums text-right">
                            {openRangeDraft.from
                              ? formatReadableRangeDate(
                                  formatYmdLocal(openRangeDraft.from)
                                )
                              : "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-sm">
                          <span className="text-muted-foreground shrink-0">End</span>
                          <span className="font-medium tabular-nums text-right">
                            {openRangeDraft.to
                              ? formatReadableRangeDate(
                                  formatYmdLocal(openRangeDraft.to)
                                )
                              : openRangeDraft.from
                                ? "Choose end date"
                                : "—"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-snug">
                          Click two days to set start and end. Use ◀ ▶ for a full Jan–Dec
                          year.
                        </p>
                      </div>
                      <div className="overflow-x-auto p-2">
                        <Calendar
                          mode="range"
                          numberOfMonths={2}
                          selected={
                            openRangeDraft.from
                              ? {
                                  from: openRangeDraft.from,
                                  to: openRangeDraft.to,
                                }
                              : undefined
                          }
                          onSelect={(range) => {
                            const next: { from?: Date; to?: Date } = range ?? {};
                            setOpenRangeDraft(next);
                            if (next.from && next.to) {
                              let from = formatYmdLocal(next.from);
                              let to = formatYmdLocal(next.to);
                              if (from > to) [from, to] = [to, from];
                              setYearRange({ from, to });
                              setYearPickerOpen(false);
                            }
                          }}
                          defaultMonth={parseYmdLocal(yearRange.from)}
                          initialFocus
                          fromDate={new Date(MIN_STATS_YEAR, 0, 1)}
                          toDate={new Date()}
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    disabled={
                      chartsLoading ||
                      anchorYearFromRange(yearRange) >= new Date().getUTCFullYear()
                    }
                    onClick={() =>
                      setYearRange(
                        fullYearRange(anchorYearFromRange(yearRange) + 1)
                      )
                    }
                    aria-label="Next calendar year"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground max-w-[12rem] truncate sm:max-w-none">
                    {yearRange.from} → {yearRange.to}
                  </span>
                </>
              )}

              {chartPeriod === "month" && (
                <>
                  <div className="hidden h-6 w-px bg-border sm:block" aria-hidden />
                  <span className="text-sm text-muted-foreground">30 days</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    disabled={chartsLoading || monthOffset >= MAX_MONTH_OFFSET}
                    onClick={() =>
                      setMonthOffset((o) => Math.min(MAX_MONTH_OFFSET, o + 1))
                    }
                    aria-label="Earlier 30-day window"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={chartsLoading}
                    onClick={() => setMonthOffset(0)}
                  >
                    Current
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    disabled={chartsLoading || monthOffset <= 0}
                    onClick={() => setMonthOffset((o) => Math.max(0, o - 1))}
                    aria-label="More recent 30-day window"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <span className="hidden text-xs text-muted-foreground tabular-nums xl:inline">
                    {rolling30DayRangeUtc(monthOffset).dateFrom} →{" "}
                    {rolling30DayRangeUtc(monthOffset).dateTo}
                  </span>
                </>
              )}

              {chartPeriod === "week" && (
                <>
                  <div className="hidden h-6 w-px bg-border sm:block" aria-hidden />
                  <span className="text-sm text-muted-foreground">7 days</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={chartsLoading}
                    onClick={() => setSessionWeekOffset((o) => Math.min(52, o + 1))}
                    aria-label="Earlier week"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={chartsLoading}
                    onClick={() => setSessionWeekOffset(0)}
                  >
                    This week
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={chartsLoading || sessionWeekOffset <= 0}
                    onClick={() => setSessionWeekOffset((o) => Math.max(0, o - 1))}
                    aria-label="More recent week"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </>
              )}
                </div>
              </div>

              {activeUtcRange ? (
                <p className="border-t border-border/70 pt-3 text-xs leading-snug text-muted-foreground">
                  <span className="font-medium text-foreground/90">Data range (UTC) </span>
                  {activeUtcRange}
                </p>
              ) : null}
            </div>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Growth Chart - Takes 2 columns */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-2"
          >
            <Card className="p-6 bg-gradient-to-br from-white via-purple-50/40 to-indigo-50/30 border-purple-100/70 shadow-sm">
              <div className="mb-6">
                <div>
                  <h2 className="font-bold text-xl flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-500" />
                    User Growth Trend
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">{trendSubtitle}</p>
                </div>
              </div>
              <div className="relative min-h-[300px]">
                <div
                  className={
                    chartsLoading ? "pointer-events-none opacity-[0.35] transition-opacity" : ""
                  }
                >
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={userGrowthData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="colorOrgs" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.22} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 8" stroke={CHART_GRID_COLOR} vertical={false} />
                      <XAxis
                        dataKey="month"
                        tick={CHART_TICK_STYLE}
                        tickLine={false}
                        axisLine={{ stroke: CHART_AXIS_COLOR }}
                      />
                      <YAxis
                        tick={CHART_TICK_STYLE}
                        tickLine={false}
                        axisLine={{ stroke: CHART_AXIS_COLOR }}
                        width={44}
                      />
                      <Tooltip
                        contentStyle={CHART_TOOLTIP_STYLE}
                        formatter={(v: number, name: string) => {
                          if (name === "Total Users") return [Number(v).toLocaleString(), name];
                          return [Number(v).toLocaleString(), "Organizations"];
                        }}
                        labelStyle={{ fontWeight: 600 }}
                      />
                      <Legend wrapperStyle={{ paddingTop: 12, color: "#475569" }} />
                      {showOrgGrowthSeries && (
                        <Area
                          type="monotone"
                          dataKey="orgs"
                          stroke="none"
                          fill="url(#colorOrgs)"
                          legendType="none"
                          isAnimationActive={!chartsLoading}
                        />
                      )}
                      <Area
                        type="monotone"
                        dataKey="users"
                        stroke="none"
                        fill="url(#colorUsers)"
                        legendType="none"
                        isAnimationActive={!chartsLoading}
                      />
                      <Line
                        type="monotone"
                        dataKey="users"
                        stroke="#7c3aed"
                        strokeWidth={2.8}
                        dot={{ fill: "#7c3aed", strokeWidth: 2, stroke: "#fff", r: 4 }}
                        activeDot={{ r: 7, strokeWidth: 2, stroke: "#ddd6fe" }}
                        name="Total Users"
                        isAnimationActive={!chartsLoading}
                      />
                      {showOrgGrowthSeries && (
                        <Line
                          type="monotone"
                          dataKey="orgs"
                          stroke="#0891b2"
                          strokeWidth={2.2}
                          strokeDasharray="5 5"
                          dot={{ fill: "#0891b2", strokeWidth: 2, stroke: "#fff", r: 3 }}
                          activeDot={{ r: 6, strokeWidth: 2, stroke: "#bae6fd" }}
                          name="Organizations"
                          isAnimationActive={!chartsLoading}
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                {chartsLoading && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl border border-border/40 bg-background/75 backdrop-blur-[2px]">
                    <Loader2 className="h-9 w-9 animate-spin text-primary" aria-hidden />
                    <Skeleton className="h-3 w-36 rounded-full" />
                    <span className="text-xs text-muted-foreground">Updating chart…</span>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {/* System Health */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="p-6 bg-gradient-to-br from-white via-cyan-50/40 to-sky-50/30 border-cyan-100/60 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-green-500" />
                  <h2 className="font-bold text-xl">System Health</h2>
                </div>
                <Link to="/admin/system-health-enhanced">
                  <Button variant="ghost" size="sm">
                    Details
                  </Button>
                </Link>
              </div>

              <div className="space-y-4">
                {systemHealth.map((metric: any, index: number) => (
                  <motion.div
                    key={metric.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + index * 0.1 }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            metric.status === "excellent"
                              ? "bg-green-500"
                              : metric.status === "good"
                                ? "bg-amber-500"
                                : metric.status === "degraded" || metric.status === "critical"
                                  ? "bg-red-500"
                                  : "bg-blue-500"
                          }`}
                        />
                        <span className="text-sm font-medium">{metric.name}</span>
                      </div>
                      <span className={`font-bold text-sm ${metric.color}`}>
                        {metric.value}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, metric.percentage)}%` }}
                        transition={{ delay: 0.7 + index * 0.1, duration: 1 }}
                        className={`h-full ${
                          metric.status === "excellent"
                            ? "bg-green-500"
                            : metric.status === "good"
                              ? "bg-blue-500"
                              : metric.status === "degraded" || metric.status === "critical"
                                ? "bg-red-500"
                                : "bg-blue-500"
                        }`}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className={`mt-6 p-4 rounded-lg border ${
                  processHealth && !processHealth.databaseConnected
                    ? "bg-red-50 border-red-200"
                    : processHealth && processHealth.errors24h > 0
                      ? "bg-amber-50 border-amber-200"
                      : "bg-green-50 border-green-200"
                }`}
              >
                <div
                  className={`flex items-center gap-2 ${
                    processHealth && !processHealth.databaseConnected
                      ? "text-red-800"
                      : processHealth && processHealth.errors24h > 0
                        ? "text-amber-900"
                        : "text-green-700"
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span className="font-medium text-sm">
                    {processHealth && !processHealth.databaseConnected
                      ? "Database unreachable — check API logs and connection."
                      : processHealth && processHealth.errors24h > 0
                        ? `${processHealth.errors24h} error log(s) in the last 24h — review Error Tracking.`
                        : "API process healthy — database reachable, no blocking issues from this snapshot."}
                  </span>
                </div>
              </motion.div>
            </Card>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Session Analytics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="p-6">
              <div className="mb-6">
                <div>
                  <h2 className="font-bold text-xl flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-cyan-500" />
                    {sessionChartTitle}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">{sessionChartSubtitle}</p>
                </div>
              </div>
              <div className="relative min-h-[280px]">
                <div
                  className={
                    chartsLoading ? "pointer-events-none opacity-[0.35] transition-opacity" : ""
                  }
                >
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={sessionData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="barSessions" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#67e8f9" stopOpacity={1} />
                          <stop offset="65%" stopColor="#06b6d4" stopOpacity={0.96} />
                          <stop offset="100%" stopColor="#0e7490" stopOpacity={0.92} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 8" stroke={CHART_GRID_COLOR} vertical={false} />
                      <XAxis
                        dataKey="day"
                        tick={CHART_TICK_STYLE}
                        tickLine={false}
                        axisLine={{ stroke: CHART_AXIS_COLOR }}
                      />
                      <YAxis
                        tick={CHART_TICK_STYLE}
                        tickLine={false}
                        axisLine={{ stroke: CHART_AXIS_COLOR }}
                        width={36}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={CHART_TOOLTIP_STYLE}
                        formatter={(v: number) => [v, "Talk it out"]}
                      />
                      <Bar
                        dataKey="sessions"
                        fill="url(#barSessions)"
                        radius={[12, 12, 4, 4]}
                        maxBarSize={46}
                        isAnimationActive={!chartsLoading}
                      >
                        {sessionData.map((_: any, index: number) => (
                          <Cell
                            key={`session-cell-${index}`}
                            fillOpacity={Math.max(0.58, 1 - index * 0.03)}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {chartsLoading && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl border border-border/40 bg-background/75 backdrop-blur-[2px]">
                    <Loader2 className="h-9 w-9 animate-spin text-primary" aria-hidden />
                    <Skeleton className="h-3 w-36 rounded-full" />
                    <span className="text-xs text-muted-foreground">{sessionLoadingText}</span>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Revenue Growth */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Card className="p-6 bg-gradient-to-br from-white via-emerald-50/35 to-green-50/30 border-emerald-100/60 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-bold text-xl flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-500" />
                    Revenue Trend
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">{revenueSubtitle}</p>
                </div>
              </div>
              <div className="relative min-h-[280px]">
                <div
                  className={
                    chartsLoading ? "pointer-events-none opacity-[0.35] transition-opacity" : ""
                  }
                >
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={revenueData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#34d399" stopOpacity={0.45} />
                          <stop offset="70%" stopColor="#10b981" stopOpacity={0.12} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 8" stroke={CHART_GRID_COLOR} vertical={false} />
                      <XAxis
                        dataKey="month"
                        tick={CHART_TICK_STYLE}
                        tickLine={false}
                        axisLine={{ stroke: CHART_AXIS_COLOR }}
                      />
                      <YAxis
                        tick={CHART_TICK_STYLE}
                        tickLine={false}
                        axisLine={{ stroke: CHART_AXIS_COLOR }}
                        width={44}
                        tickFormatter={(v) => `$${v}`}
                      />
                      <Tooltip
                        contentStyle={CHART_TOOLTIP_STYLE}
                        formatter={(v: number) => [formatUsd(Number(v)), "Revenue"]}
                        labelStyle={{ fontWeight: 600 }}
                      />
                      <Legend wrapperStyle={{ color: "#475569" }} />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="none"
                        fill="url(#colorRevenue)"
                        legendType="none"
                        isAnimationActive={!chartsLoading}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#059669"
                        strokeWidth={2.8}
                        dot={{ fill: "#059669", strokeWidth: 2, stroke: "#fff", r: 4 }}
                        activeDot={{ r: 7, strokeWidth: 2, stroke: "#bbf7d0" }}
                        name="Revenue"
                        isAnimationActive={!chartsLoading}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                {chartsLoading && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl border border-border/40 bg-background/75 backdrop-blur-[2px]">
                    <Loader2 className="h-9 w-9 animate-spin text-primary" aria-hidden />
                    <Skeleton className="h-3 w-36 rounded-full" />
                    <span className="text-xs text-muted-foreground">Updating revenue…</span>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live Activity Feed */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <Card className="p-6 bg-gradient-to-br from-white via-blue-50/45 to-indigo-50/35 border-blue-100/70 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-orange-500" />
                  <h2 className="font-bold text-xl">Live Activity</h2>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse ml-1" />
                </div>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto">
                {(activityFeed.length ? activityFeed : [{ action: "No recent activity", user: "—", time: "", type: "session" }]).map((activity, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.9 + index * 0.1 }}
                    className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      activity.type === "signup" ? "bg-purple-100" :
                      activity.type === "session" ? "bg-cyan-100" :
                      activity.type === "upgrade" ? "bg-green-100" :
                      activity.type === "crisis" ? "bg-red-100" :
                      "bg-blue-100"
                    }`}>
                      {activity.type === "signup" && <UserCheck className="w-4 h-4 text-purple-600" />}
                      {activity.type === "session" && <Activity className="w-4 h-4 text-cyan-600" />}
                      {activity.type === "upgrade" && <TrendingUp className="w-4 h-4 text-green-600" />}
                      {activity.type === "crisis" && <Shield className="w-4 h-4 text-red-600" />}
                      {activity.type === "journal" && <MessageSquare className="w-4 h-4 text-blue-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{activity.action}</p>
                      <p className="text-xs text-muted-foreground truncate">{activity.user}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* System Alerts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  <h2 className="font-bold text-xl">System Alerts</h2>
                </div>
                <Link to="/admin/system-logs">
                  <Button variant="ghost" size="sm">
                    View All
                  </Button>
                </Link>
              </div>

              <div className="space-y-3">
                {(crisisAlerts.length ? crisisAlerts : []).length === 0 && (
                  <p className="text-sm text-muted-foreground py-4">No pending crisis alerts.</p>
                )}
                {crisisAlerts.map((alert, index) => (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1 + index * 0.1 }}
                    className={`p-4 rounded-lg border-l-4 ${
                      alert.type === "critical"
                        ? "bg-red-50 border-red-500"
                        : alert.type === "warning"
                        ? "bg-orange-50 border-orange-500"
                        : "bg-blue-50 border-blue-500"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-medium text-sm mb-1">{alert.message}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {alert.time}
                        </p>
                      </div>
                      {alert.status === "pending" && (
                        <Link to="/admin/crisis-monitoring">
                          <Button size="sm" variant="outline" type="button">
                            Review
                          </Button>
                        </Link>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Platform Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-bold text-xl flex items-center gap-2">
                    <Globe className="w-5 h-5 text-blue-500" />
                    Avatar selection
                  </h2>
                  {/* <p className="text-sm text-muted-foreground mt-1">
                    Uses the companion saved on the profile when present; otherwise the avatar from the user&apos;s
                    most recent session. Labels match Session Lobby: Alex Rivera, Maya Chen, Jordan Taylor, and Sara
                    Mitchell.
                  </p> */}
                </div>
                <Link to="/admin/avatar-selection-analytics">
                  <Button variant="ghost" size="sm" type="button">
                    View details
                  </Button>
                </Link>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <defs>
                    <filter id="pieGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#1e3a8a" floodOpacity="0.12" />
                    </filter>
                  </defs>
                  <Pie
                    data={platformDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={86}
                    paddingAngle={3}
                    cornerRadius={8}
                    labelLine={false}
                    label={({ value }) => `${value}%`}
                    dataKey="value"
                    isAnimationActive={!chartsLoading}
                    filter="url(#pieGlow)"
                  >
                    {platformDistribution.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(v: number, _name: string, p: any) => [String(v) + "%", p?.payload?.name || "Share"]}
                    labelFormatter={() => "Avatar Distribution"}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {platformDistribution.map((item: any, index: number) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm">{item.name}</span>
                    </div>
                    <span className="text-sm font-semibold">{item.value}%</span>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>



        {/* Recent Mood Check-ins */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
        >
          <Card className={cn(adminCard, "p-6")}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-bold text-xl flex items-center gap-2 text-[var(--admin-text)]">
                  <Smile className="w-5 h-5 text-[var(--admin-secondary)]" />
                  Recent Mood Check-ins
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Latest check-ins from the last 30 days (up to 25)
                </p>
              </div>
              {recentMoods.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Page {Math.min(moodsPage, moodsTotalPages)} of {moodsTotalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-3"
                    disabled={moodsPage <= 1}
                    onClick={() => setMoodsPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-3"
                    disabled={moodsPage >= moodsTotalPages}
                    onClick={() =>
                      setMoodsPage((p) => Math.min(moodsTotalPages, p + 1))
                    }
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {recentMoods.length === 0 ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  No mood check-ins in the last 30 days.
                </div>
              ) : (
                pagedRecentMoods.map((mood, index) => (
                  <motion.div
                    key={mood.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.2 + index * 0.1 }}
                    className={cn(adminCard, "admin-card-hover p-4 cursor-pointer transition-all group")}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-[var(--admin-primary)] to-[var(--admin-secondary)] rounded-full flex items-center justify-center text-[#041018] font-bold text-lg shadow-md">
                        <Smile className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate text-[var(--admin-text)]">{mood.profiles?.full_name || 'Anonymous'}</p>
                        <span className="px-2 py-0.5 rounded text-xs font-medium capitalize bg-[color-mix(in_srgb,var(--admin-secondary)_18%,transparent)] text-[var(--admin-secondary)]">
                          {mood.mood}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Intensity</span>
                        <span className="font-bold">{mood.intensity}/10</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Activities</span>
                        <span className="font-bold text-xs truncate max-w-[80px]">
                          {mood.activities?.length || 0} selected
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm gap-2">
                        <span className="text-muted-foreground shrink-0">Date & time</span>
                        <span className="font-bold text-xs text-right leading-tight">
                          {new Date(mood.created_at).toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
        >
          <Card className={cn(adminCard, "p-6")}>
            <h2 className="font-bold text-xl mb-4 flex items-center gap-2 text-[var(--admin-text)]">
              <Zap className="w-5 h-5 text-[var(--admin-secondary)]" />
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <Link to="/admin/system-settings-enhanced">
                <Button variant="outline" className={cn(adminQuickAction)}>
                  <Settings className="w-4 h-4" />
                  Settings
                </Button>
              </Link>
              <Link to="/admin/analytics">
                <Button variant="outline" className={cn(adminQuickAction)}>
                  <TrendingUp className="w-4 h-4" />
                  Analytics
                </Button>
              </Link>
              <Link to="/admin/feature-flags">
                <Button variant="outline" className={cn(adminQuickAction)}>
                  <Globe className="w-4 h-4" />
                  Features
                </Button>
              </Link>
              <Link to="/admin/billing">
                <Button variant="outline" className={cn(adminQuickAction)}>
                  <DollarSign className="w-4 h-4" />
                  Billing
                </Button>
              </Link>
              <Link to="/admin/user-management">
                <Button variant="outline" className={adminQuickAction}>
                  View All Users
                </Button>
              </Link>
              <Link to="/admin/support-tickets">
                <Button variant="outline" className={cn(adminQuickAction)}>
                  <MessageSquare className="w-4 h-4" />
                  Support
                </Button>
              </Link>
            </div>
          </Card>
        </motion.div>
      </div>
    </AdminLayoutNew>
  );
}