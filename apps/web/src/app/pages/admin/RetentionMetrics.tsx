import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Users,
  TrendingUp,
  TrendingDown,
  Target,
  DollarSign,
  RefreshCw,
  Calendar,
  Heart,
  AlertCircle,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/app/components/ui/card";
import { buttonVariants } from "@/app/components/ui/button";
import { cn } from "@/app/components/ui/utils";
import { api } from "../../../lib/api";
import { AdminAnalyticsToolbar } from "../../components/admin/AdminAnalyticsToolbar";
import { AdminTableSkeletonRows } from "../../components/admin/AdminTableSkeleton";
import { datesForPreset, downloadCsv } from "@/lib/adminAnalytics";

function formatStatsRangeUtc(stats: { rangeStart?: string; rangeEnd?: string } | null) {
  if (!stats?.rangeStart || !stats?.rangeEnd) return "";
  try {
    const a = new Date(stats.rangeStart).toISOString().slice(0, 10);
    const b = new Date(stats.rangeEnd).toISOString().slice(0, 10);
    return `${a} → ${b} UTC`;
  } catch {
    return "";
  }
}

function formatAnalyticsRangeLabel(from: string, to: string): string {
  try {
    const a = new Date(`${from}T12:00:00Z`);
    const b = new Date(`${to}T12:00:00Z`);
    const o: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
    return `${a.toLocaleDateString(undefined, o)} – ${b.toLocaleDateString(undefined, o)}`;
  } catch {
    return `${from} – ${to}`;
  }
}

/** API userGrowth buckets are cumulative profile counts at each period end (not cohort retention). */
function buildPeriodGrowthRows(
  userGrowth: { month: string; users: number }[]
): {
  period: string;
  cumulative: number;
  netNewVsPrior: number | null;
  pctOfRangeEndTotal: number;
}[] {
  if (!userGrowth.length) return [];
  const cum = userGrowth.map((r) => Math.max(0, Number(r.users) || 0));
  const end = cum[cum.length - 1] || 0;
  return userGrowth.map((r, i) => ({
    period: r.month,
    cumulative: cum[i],
    netNewVsPrior: i === 0 ? null : Math.max(0, cum[i] - cum[i - 1]),
    pctOfRangeEndTotal: end > 0 ? Math.round((cum[i] / end) * 1000) / 10 : 0,
  }));
}

export function RetentionMetrics() {
  const [dateFrom, setDateFrom] = useState(datesForPreset("30d").dateFrom);
  const [dateTo, setDateTo] = useState(datesForPreset("30d").dateTo);
  const [stats, setStats] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async (forceRefresh?: boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.admin.getStats({
        chartPeriod: "month",
        dateFrom,
        dateTo,
        ...(forceRefresh ? { refresh: true } : {}),
      });
      setStats(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load retention metrics");
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const userGrowth = (stats?.userGrowth || []) as { month: string; users: number }[];
  const periodGrowthRows = buildPeriodGrowthRows(userGrowth);

  const cumulativeCurveData =
    userGrowth.length > 0
      ? userGrowth.map((row) => ({
          month: row.month,
          cumulative: Math.max(0, Number(row.users) || 0),
        }))
      : [{ month: "—", cumulative: 0 }];

  /** Per-bucket new signups (delta of cumulative series); x-axis starts at 2nd bucket. MoM compares consecutive deltas. */
  const signupMomentumChart =
    userGrowth.length > 1
      ? userGrowth.slice(1).map((row, j) => {
          const idx = j + 1;
          const netNew = Math.max(
            0,
            Number(userGrowth[idx].users) - Number(userGrowth[idx - 1].users)
          );
          let momNewSignupGrowthPct: number | null = null;
          if (idx >= 2) {
            const prevNew = Math.max(
              0,
              Number(userGrowth[idx - 1].users) - Number(userGrowth[idx - 2].users)
            );
            if (prevNew > 0) {
              momNewSignupGrowthPct =
                Math.round(((netNew - prevNew) / prevNew) * 10000) / 100;
            } else if (netNew > 0) {
              momNewSignupGrowthPct = 100;
            } else {
              momNewSignupGrowthPct = 0;
            }
          }
          return { month: row.month, netNew, momNewSignupGrowthPct };
        })
      : [];

  const onboardingDaily = (stats?.onboardingStats?.daily || []) as {
    date: string;
    signups: number;
    completions: number;
  }[];
  const onboardingTrendData = onboardingDaily.map((d) => ({
    day: d.date?.slice(5) ?? d.date,
    signups: d.signups ?? 0,
    completions: d.completions ?? 0,
  }));

  const revenueByPeriod = (stats?.revenueData || []) as { month: string; revenue: number }[];
  const revenueChartData = revenueByPeriod.map((r) => ({
    period: r.month,
    revenue: Math.max(0, Number(r.revenue) || 0),
  }));

  const featureUsageChart = ((stats?.featureUsage || []) as { feature: string; usage: number }[]).map((f) => ({
    feature: f.feature,
    usage: Math.max(0, Math.min(100, Number(f.usage) || 0)),
  }));

  const w = stats?.winbackStats;
  const winbackData = [
    {
      status: "Inactive 30–60 days (profile)",
      count: w?.atRisk30 ?? 0,
      hint: "Win-back: send a nudge or push campaign to re-engage users who went quiet.",
    },
    {
      status: "Inactive 60–90 days",
      count: w?.dormant60 ?? 0,
      hint: "Stronger win-back or support outreach.",
    },
    {
      status: "Inactive 90+ days",
      count: w?.lost90 ?? 0,
      hint: "Long-lapsed users; use segments + nudges or manual outreach.",
    },
  ];

  const oc = stats?.onboardingStats;
  const statsCards = [
    {
      label: "Onboarding completion (range)",
      value: `${oc?.completionRatePercent ?? 0}%`,
      change: "—",
      trend: "up" as const,
      icon: Users,
      color: "from-blue-500 to-cyan-600",
      description: "profiles completed / signups in range",
    },
    {
      label: "Inactive 30–60d (profiles)",
      value: String(w?.atRisk30 ?? 0),
      change: "—",
      trend: "up" as const,
      icon: AlertCircle,
      color: "from-red-500 to-orange-600",
      description: "by profile updated_at",
    },
    {
      label: "Total users",
      value: (stats?.totalUsers ?? 0).toLocaleString(),
      change: "—",
      trend: "up" as const,
      icon: Target,
      color: "from-green-500 to-emerald-600",
      description: "registered profiles",
    },
    {
      label: "Revenue (cash, range)",
      value: `$${(stats?.revenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: "—",
      trend: "up" as const,
      icon: DollarSign,
      color: "from-purple-500 to-pink-600",
      description: "completed payments in range",
    },
  ];

  const userGrowthMocked =
    Array.isArray(stats?.mockedSections) && stats.mockedSections.includes("userGrowth");
  const revenueMocked =
    Array.isArray(stats?.mockedSections) && stats.mockedSections.includes("revenueData");

  if (error && !stats) {
    return (
      <AdminLayoutNew>
        <div className="max-w-2xl mx-auto py-16">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Retention Metrics</h1>
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      </AdminLayoutNew>
    );
  }

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
        >
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Retention Metrics
            </h1>
            <p className="text-gray-600">
              Signup momentum, cumulative user base, and onboarding — scoped to your selected dates
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {formatAnalyticsRangeLabel(dateFrom, dateTo)} · Monthly buckets · KPIs use the API data window below.
            </p>
          </div>

          <AdminAnalyticsToolbar
            showChartPeriod={false}
            showRangePreset={false}
            chartPeriod="month"
            onChartPeriodChange={() => {}}
            rangePreset="30d"
            onRangePresetChange={() => {}}
            useCustomRange
            onUseCustomRangeChange={() => {}}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            onRefresh={() => void loadStats(true)}
            isLoading={isLoading}
            onExport={() => {
              if (!stats) return;
              downloadCsv(`retention-metrics-${new Date().toISOString().slice(0, 10)}.csv`, [
                { metric: "totalUsers", value: stats.totalUsers },
                { metric: "onboardingCompletionPct", value: stats.onboardingStats?.completionRatePercent },
                ...periodGrowthRows.map((r, i) => ({
                  row: i,
                  period: r.period,
                  cumulativeUsers: r.cumulative,
                  netNewVsPrior: r.netNewVsPrior,
                  pctOfRangeEndTotal: r.pctOfRangeEndTotal,
                })),
              ]);
            }}
          />
        </motion.div>

        {stats && formatStatsRangeUtc(stats) && (
          <p className="text-sm text-gray-500">
            Data window: {formatStatsRangeUtc(stats)} · Buckets: monthly (aligned to range)
          </p>
        )}

        {userGrowthMocked && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            User growth series fell back to a placeholder — check API/database connectivity for live cumulative profile
            counts.
          </p>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoading && !stats
            ? Array.from({ length: 4 }).map((_, index) => (
                <Card
                  key={index}
                  className="bg-white border-gray-200 p-6 h-36 animate-pulse"
                >
                  <div className="h-4 w-28 bg-gray-200 rounded mb-4" />
                  <div className="h-8 w-20 bg-gray-200 rounded mb-2" />
                  <div className="h-3 w-40 bg-gray-100 rounded" />
                </Card>
              ))
            : statsCards.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="bg-white border-gray-200 p-6 hover:shadow-lg transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}
                  >
                    <stat.icon className="w-6 h-6 text-black" />
                  </div>
                  <div
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      stat.trend === "up"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {stat.trend === "up" ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {stat.change}
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</h3>
                <p className="text-sm text-gray-700">{stat.label}</p>
                <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Profile growth (cumulative series — not same-user cohort retention) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-white border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold !text-gray-900 mb-1">
                  Profile growth by period
                </h3>
                <p className="text-sm !text-gray-600 max-w-3xl">
                  Cumulative profile totals at each month boundary in your range. &quot;New vs prior&quot; is the change
                  between consecutive buckets (not classic cohort week-1/week-2 retention).
                </p>
              </div>
              <Calendar className="w-5 h-5 text-purple-600 shrink-0" aria-hidden />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                      Period
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                      Cumulative profiles
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                      New vs prior period
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                      % of range-end base
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {isLoading && !stats ? (
                    <AdminTableSkeletonRows columns={4} rows={6} padding="comfortable" />
                  ) : (
                    periodGrowthRows.map((row, rowIdx) => (
                      <tr key={`growth-${rowIdx}-${String(row.period)}`} className="border-b border-gray-100">
                        <td className="py-3 px-6 !text-gray-900 font-medium">{row.period}</td>
                        <td className="text-right px-6 tabular-nums">{row.cumulative.toLocaleString()}</td>
                        <td className="text-right px-6 tabular-nums text-gray-700">
                          {row.netNewVsPrior === null ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            row.netNewVsPrior.toLocaleString()
                          )}
                        </td>
                        <td className="text-right px-6 tabular-nums text-gray-700">{row.pctOfRangeEndTotal}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>

        {/* Retention Curve & Churn Rate */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Retention Curve */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-black mb-1">
                    Cumulative user base
                  </h3>
                  <p className="text-sm text-gray-400">
                    Total profiles with <span className="italic">created_at</span> before each month end (from stats
                    series)
                  </p>
                </div>
                <Heart className="w-5 h-5 text-pink-400" />
              </div>

              <ResponsiveContainer width="100%" height={300} debounce={50}>
                <AreaChart
                  data={cumulativeCurveData}
                  margin={{ top: 8, right: 12, left: 8, bottom: 8 }}
                >
                  <defs>
                    <linearGradient id="colorRetentionRm" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis
                    dataKey="month"
                    stroke="#9ca3af"
                    tick={{ fontSize: 11 }}
                    angle={-35}
                    textAnchor="end"
                    height={64}
                    interval="preserveStartEnd"
                    minTickGap={24}
                  />
                  <YAxis
                    stroke="#9ca3af"
                    tick={{ fontSize: 11 }}
                    width={48}
                    domain={[0, "auto"]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                    formatter={(v: number) => [v.toLocaleString(), "Profiles"]}
                  />
                  <Area
                    isAnimationActive={false}
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#ec4899"
                    fillOpacity={1}
                    fill="url(#colorRetentionRm)"
                    name="Cumulative profiles"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>

          {/* Churn Rate */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-black mb-1">
                    Signup momentum
                  </h3>
                  <p className="text-sm text-gray-400">
                    New profiles per bucket (delta of cumulative counts). Line = period-over-period % change in those
                    signups.
                  </p>
                </div>
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>

              {signupMomentumChart.length === 0 ? (
                <p className="text-sm text-gray-500 py-12 text-center">
                  Need at least two monthly buckets in the range to chart signup deltas.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={300} debounce={50}>
                  <ComposedChart
                    data={signupMomentumChart}
                    margin={{ top: 8, right: 12, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                    <XAxis
                      dataKey="month"
                      stroke="#9ca3af"
                      tick={{ fontSize: 11 }}
                      angle={-35}
                      textAnchor="end"
                      height={64}
                      interval="preserveStartEnd"
                      minTickGap={24}
                    />
                    <YAxis
                      yAxisId="left"
                      stroke="#9ca3af"
                      tick={{ fontSize: 11 }}
                      width={44}
                      domain={[0, "auto"]}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#9ca3af"
                      tick={{ fontSize: 11 }}
                      width={48}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid #374151",
                        borderRadius: "8px",
                        color: "#fff",
                      }}
                    />
                    <Legend />
                    <Bar
                      isAnimationActive={false}
                      yAxisId="left"
                      dataKey="netNew"
                      fill="#3b82f6"
                      radius={[8, 8, 0, 0]}
                      name="New signups"
                    />
                    <Line
                      isAnimationActive={false}
                      yAxisId="right"
                      type="monotone"
                      dataKey="momNewSignupGrowthPct"
                      stroke="#ef4444"
                      strokeWidth={3}
                      connectNulls
                      name="Δ signups vs prior %"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </Card>
          </motion.div>
        </div>

        {/* Onboarding (range) & Revenue by period */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-black mb-1">
                    Onboarding (daily in range)
                  </h3>
                  <p className="text-sm text-gray-400">
                    Signups vs profile completions per day from admin stats (same window as KPIs)
                  </p>
                </div>
                <Target className="w-5 h-5 text-green-400" />
              </div>

              {onboardingTrendData.length === 0 ? (
                <p className="text-sm text-gray-500 py-12 text-center">No onboarding daily rows for this range.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300} debounce={50}>
                  <LineChart data={onboardingTrendData} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                    <XAxis
                      dataKey="day"
                      stroke="#9ca3af"
                      tick={{ fontSize: 10 }}
                      interval="preserveStartEnd"
                      minTickGap={8}
                    />
                    <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} width={36} domain={[0, "auto"]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid #374151",
                        borderRadius: "8px",
                        color: "#fff",
                      }}
                    />
                    <Legend />
                    <Line
                      isAnimationActive={false}
                      type="monotone"
                      dataKey="signups"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      name="Signups"
                    />
                    <Line
                      isAnimationActive={false}
                      type="monotone"
                      dataKey="completions"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                      name="Completions"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-black mb-1">
                    Revenue by period
                  </h3>
                  <p className="text-sm text-gray-400">
                    Completed payment volume per bucket (from admin revenue series; matches chart period)
                  </p>
                </div>
                <DollarSign className="w-5 h-5 text-yellow-400" />
              </div>

              {revenueMocked && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mb-3">
                  Revenue series used a fallback aggregate — detailed per-period rows were unavailable.
                </p>
              )}
              {revenueChartData.length === 0 ? (
                <p className="text-sm text-gray-500 py-12 text-center">No revenue rows for this chart period.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300} debounce={50}>
                  <BarChart data={revenueChartData} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                    <XAxis
                      dataKey="period"
                      stroke="#9ca3af"
                      tick={{ fontSize: 11 }}
                      angle={-30}
                      textAnchor="end"
                      height={56}
                    />
                    <YAxis
                      stroke="#9ca3af"
                      tick={{ fontSize: 11 }}
                      width={44}
                      domain={[0, "auto"]}
                      tickFormatter={(v: number) => `$${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid #374151",
                        borderRadius: "8px",
                        color: "#fff",
                      }}
                      formatter={(v: number) => [`$${v.toLocaleString()}`, "Revenue"]}
                    />
                    <Bar
                      isAnimationActive={false}
                      dataKey="revenue"
                      fill="#eab308"
                      radius={[8, 8, 0, 0]}
                      name="Revenue (USD)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </motion.div>
        </div>

        {/* Win-back Opportunities & Retention by Type */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Win-back Opportunities */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-black mb-1">
                    Win-back Opportunities
                  </h3>
                  <p className="text-sm text-gray-400">
                    Current snapshot from profile activity (not tied to the date range above)
                  </p>
                </div>
                <RefreshCw className="w-5 h-5 text-cyan-400" />
              </div>

              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                A <span className="font-medium text-gray-700">win-back campaign</span> is outreach to bring back
                inactive users (email, push, or in-app nudges). This screen only shows counts; it does not send
                messages. Use Nudge Management to create templates and target segments.
              </p>

              <div className="space-y-4">
                {winbackData.map((item, index) => (
                  <div
                    key={item.status}
                    className="bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                            index === 0
                              ? "bg-yellow-500/20"
                              : index === 1
                              ? "bg-orange-500/20"
                              : "bg-red-500/20"
                          }`}
                        >
                          <AlertCircle
                            className={`w-5 h-5 ${
                              index === 0
                                ? "text-yellow-400"
                                : index === 1
                                ? "text-orange-400"
                                : "text-red-400"
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-black text-sm">
                            {item.status}
                          </h4>
                          <p className="text-xs text-gray-400">{item.count} users</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 leading-snug text-right max-w-[min(100%,20rem)]">
                        {item.hint}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <Link
                to="/admin/nudge-management"
                className={cn(
                  buttonVariants({ size: "default" }),
                  "mt-4 w-full justify-center bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-black"
                )}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Open Nudge Management (win-back)
              </Link>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-black mb-1">
                    Platform activity mix
                  </h3>
                  <p className="text-sm text-gray-400">
                    Relative feature usage (normalized index from totals in admin stats — not retention by plan tier)
                  </p>
                </div>
                <Users className="w-5 h-5 text-blue-400" />
              </div>

              {featureUsageChart.length === 0 ? (
                <p className="text-sm text-gray-500 py-12 text-center">No feature usage data.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300} debounce={50}>
                  <BarChart
                    data={featureUsageChart}
                    layout="vertical"
                    margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                    <XAxis type="number" stroke="#9ca3af" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="feature"
                      stroke="#9ca3af"
                      width={120}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid #374151",
                        borderRadius: "8px",
                        color: "#fff",
                      }}
                      formatter={(v: number) => [`${v}%`, "Relative usage"]}
                    />
                    <Bar
                      isAnimationActive={false}
                      dataKey="usage"
                      fill="#6366f1"
                      name="Usage index"
                      radius={[0, 8, 8, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </motion.div>
        </div>
      </div>
    </AdminLayoutNew>
  );
}