import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
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
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Skeleton } from "../../components/ui/skeleton";
import { Calendar } from "../../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover";
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

const PERIOD_OPTIONS = ["week", "month", "year"] as const;
const PERIOD_RANGE_DAYS: Record<(typeof PERIOD_OPTIONS)[number], number> = {
  week: 7,
  month: 30,
  year: 365,
};

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

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "rgba(255, 255, 255, 0.97)",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  boxShadow: "0 10px 40px rgba(15, 23, 42, 0.08)",
};

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
  const [recentMoods, setRecentMoods] = useState<any[]>([]);
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
    return {
      chartPeriod,
      rangeDays: PERIOD_RANGE_DAYS[chartPeriod],
      sessionWeekOffset: chartPeriod === "week" ? sessionWeekOffset : 0,
    };
  }, [chartPeriod, yearRange, sessionWeekOffset]);

  useEffect(() => {
    if (chartPeriod !== "week" && sessionWeekOffset !== 0) {
      setSessionWeekOffset(0);
    }
  }, [chartPeriod, sessionWeekOffset]);

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
          refresh: true,
        });
        if (cancelled) return;
        setStats(data);

        if (isFirstLoad) {
          const [moods, recent] = await Promise.all([
            api.moods.getAllMoods(),
            api.admin.getRecentActivity(),
          ]);
          if (cancelled) return;
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
      const payload = {
        exportedAt: new Date().toISOString(),
        ...statsQuery,
        stats,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ezri-super-admin-report-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Report downloaded.");
    } catch {
      toast.error("Export failed.");
    }
  };

  const trendSubtitle = useMemo(() => {
    if (chartPeriod === "week") return "New signups per week (last 12 weeks)";
    if (chartPeriod === "year")
      return `New signups by year — ${yearRange.from} → ${yearRange.to}`;
    return "Total users over time (monthly)";
  }, [chartPeriod, yearRange]);

  const revenueSubtitle = useMemo(() => {
    if (chartPeriod === "week") return "Payment volume by week (Stripe)";
    if (chartPeriod === "year")
      return `Payment volume (Stripe) — ${yearRange.from} → ${yearRange.to}`;
    return "Payment volume by month (Stripe)";
  }, [chartPeriod, yearRange]);

  const sessionChartTitle = useMemo(() => {
    if (chartPeriod === "week") return "Weekly Session Activity";
    if (chartPeriod === "year") return "Yearly Session Activity";
    return "Monthly Session Activity";
  }, [chartPeriod]);

  const sessionChartSubtitle = useMemo(() => {
    if (chartPeriod === "week") {
      return `Sessions per day (UTC week) — offset ${sessionWeekOffset || "current"}`;
    }
    if (chartPeriod === "year")
      return `Sessions per day — ${yearRange.from} → ${yearRange.to}`;
    return "Sessions per day for the last 30 days";
  }, [chartPeriod, sessionWeekOffset, yearRange]);

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

  const mrrDisplay = kpi != null ? kpi.subscriptionMrrApprox : Number(revenue);
  const payThisMonthUsd = (kpi?.paymentVolumeThisMonthCents ?? 0) / 100;

  return (
    <AdminLayoutNew>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                <Crown className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
                <p className="text-muted-foreground">
                  Platform-wide overview • Real-time monitoring
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" type="button" onClick={exportReport}>
                <Download className="w-4 h-4 mr-2" />
                Export Report
              </Button>
              <Link to="/admin/system-settings-enhanced">
                <Button size="sm" type="button">
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

        {/* Animated Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Users */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
          >
            <Card className="p-6 bg-gradient-to-br from-purple-50 to-white border-purple-200 relative overflow-hidden group hover:shadow-xl transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-500 flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      (kpi?.signupsWeekOverWeekPct ?? 0) >= 0
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {kpi != null ? formatPctSigned(kpi.signupsWeekOverWeekPct) : "—"}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-1">Total Users</p>
                <motion.div
                  key={userCount}
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="text-3xl font-bold"
                >
                  {userCount.toLocaleString()}
                </motion.div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <TrendingUp className="w-3 h-3 text-green-600" />
                  <span>
                    {kpi != null
                      ? `${kpi.signupsLast7Days.toLocaleString()} signups in the last 7 days`
                      : "—"}
                  </span>
                </div>
              </div>
            </Card>
          </motion.div>



          {/* Active Sessions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-6 bg-gradient-to-br from-cyan-50 to-white border-cyan-200 relative overflow-hidden group hover:shadow-xl transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500 flex items-center justify-center">
                    <Activity className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs text-green-600 font-semibold">Live</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-1">Active Sessions</p>
                <motion.div
                  key={sessionCount}
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="text-3xl font-bold"
                >
                  {sessionCount.toLocaleString()}
                </motion.div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Eye className="w-3 h-3 text-cyan-600" />
                  <span>
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="p-6 bg-gradient-to-br from-green-50 to-white border-green-200 relative overflow-hidden group hover:shadow-xl transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-white" />
                  </div>
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      (kpi?.paymentMomPct ?? 0) >= 0
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {kpi != null ? formatPctSigned(kpi.paymentMomPct) : "—"} vs prior month
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-1">Subscription MRR (active)</p>
                <div className="text-3xl font-bold">{formatUsd(mrrDisplay)}</div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <TrendingUp className="w-3 h-3 text-green-600" />
                  <span>
                    {formatUsd(payThisMonthUsd)} completed payments (this month, Stripe)
                  </span>
                </div>
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
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-foreground">Charts</span>
                {chartsLoading && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {PERIOD_OPTIONS.map((p) => (
                  <Button
                    key={p}
                    variant={chartPeriod === p ? "default" : "outline"}
                    size="sm"
                    type="button"
                    disabled={chartsLoading}
                    onClick={() => setChartPeriod(p)}
                  >
                    {p === "week" ? "Week" : p === "month" ? "Month" : "Year"}
                  </Button>
                ))}
              </div>

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
                            const next = range ?? {};
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

              {chartPeriod === "week" && (
                <>
                  <div className="hidden h-6 w-px bg-border sm:block" aria-hidden />
                  <span className="text-sm text-muted-foreground">Week</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={chartsLoading}
                    onClick={() => setSessionWeekOffset((o) => Math.min(52, o + 1))}
                    aria-label="Older week"
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
                    aria-label="Newer week"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </>
              )}
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
            <Card className="p-6">
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
                    <ComposedChart data={userGrowthData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 8" stroke="#e8e8ed" vertical={false} />
                      <XAxis
                        dataKey="month"
                        tick={{ fill: "#64748b", fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: "#e2e8f0" }}
                      />
                      <YAxis
                        tick={{ fill: "#64748b", fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: "#e2e8f0" }}
                        width={44}
                      />
                      <Tooltip
                        contentStyle={CHART_TOOLTIP_STYLE}
                        formatter={(v: number) => [Number(v).toLocaleString(), "Users"]}
                        labelStyle={{ fontWeight: 600 }}
                      />
                      <Legend wrapperStyle={{ paddingTop: 12 }} />
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
                        strokeWidth={2.5}
                        dot={{ fill: "#7c3aed", strokeWidth: 2, stroke: "#fff", r: 4 }}
                        activeDot={{ r: 6 }}
                        name="Total Users"
                        isAnimationActive={!chartsLoading}
                      />
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
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-green-500" />
                  <h2 className="font-bold text-xl">System Health</h2>
                </div>
                <Link to="/admin/system-health-dashboard">
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
                    <BarChart data={sessionData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="barSessions" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22d3ee" stopOpacity={1} />
                          <stop offset="100%" stopColor="#0891b2" stopOpacity={0.95} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 8" stroke="#e8e8ed" vertical={false} />
                      <XAxis
                        dataKey="day"
                        tick={{ fill: "#64748b", fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: "#e2e8f0" }}
                      />
                      <YAxis
                        tick={{ fill: "#64748b", fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: "#e2e8f0" }}
                        width={36}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={CHART_TOOLTIP_STYLE}
                        formatter={(v: number) => [v, "Sessions"]}
                      />
                      <Bar
                        dataKey="sessions"
                        fill="url(#barSessions)"
                        radius={[10, 10, 0, 0]}
                        maxBarSize={48}
                        isAnimationActive={!chartsLoading}
                      />
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
            <Card className="p-6">
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
                    <ComposedChart data={revenueData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 8" stroke="#e8e8ed" vertical={false} />
                      <XAxis
                        dataKey="month"
                        tick={{ fill: "#64748b", fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: "#e2e8f0" }}
                      />
                      <YAxis
                        tick={{ fill: "#64748b", fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: "#e2e8f0" }}
                        width={44}
                        tickFormatter={(v) => `$${v}`}
                      />
                      <Tooltip
                        contentStyle={CHART_TOOLTIP_STYLE}
                        formatter={(v: number) => [formatUsd(Number(v)), "Revenue"]}
                        labelStyle={{ fontWeight: 600 }}
                      />
                      <Legend />
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
                        strokeWidth={2.5}
                        dot={{ fill: "#059669", strokeWidth: 2, stroke: "#fff", r: 4 }}
                        activeDot={{ r: 6 }}
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
            <Card className="p-6">
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
                  <p className="text-sm text-muted-foreground mt-1">
                    Share of users by chosen profile avatar (from profiles)
                  </p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={platformDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {platformDistribution.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
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
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-bold text-xl flex items-center gap-2">
                  <Smile className="w-5 h-5 text-purple-500" />
                  Recent Mood Check-ins
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Latest check-ins from the last 30 days (up to 25)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {recentMoods.length === 0 ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  No mood check-ins in the last 30 days.
                </div>
              ) : (
                recentMoods.map((mood, index) => (
                  <motion.div
                    key={mood.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.2 + index * 0.1 }}
                    className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-lg border border-gray-200 hover:shadow-lg transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
                        <Smile className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{mood.profiles?.full_name || 'Anonymous'}</p>
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium capitalize">
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
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Date</span>
                        <span className="font-bold text-xs">
                          {new Date(mood.created_at).toLocaleDateString()}
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
          <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
            <h2 className="font-bold text-xl mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-500" />
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <Link to="/admin/system-settings-enhanced">
                <Button variant="outline" className="w-full justify-start gap-2 bg-white hover:bg-gray-50 hover:text-gray-700">
                  <Settings className="w-4 h-4" />
                  Settings
                </Button>
              </Link>
              <Link to="/admin/analytics">
                <Button variant="outline" className="w-full justify-start gap-2 bg-white hover:bg-gray-50 hover:text-gray-700">
                  <TrendingUp className="w-4 h-4" />
                  Analytics
                </Button>
              </Link>
              <Link to="/admin/feature-flags">
                <Button variant="outline" className="w-full justify-start gap-2 bg-white hover:bg-gray-50 hover:text-gray-700">
                  <Globe className="w-4 h-4" />
                  Features
                </Button>
              </Link>
              <Link to="/admin/billing">
                <Button variant="outline" className="w-full justify-start gap-2 bg-white hover:bg-gray-50 hover:text-gray-700">
                  <DollarSign className="w-4 h-4" />
                  Billing
                </Button>
              </Link>
              <Link to="/admin/user-management">
                <Button variant="outline" size="sm">
                  View All Users
                </Button>
              </Link>
              <Link to="/admin/support-tickets">
                <Button variant="outline" className="w-full justify-start gap-2 bg-white hover:bg-gray-50 hover:text-gray-700">
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