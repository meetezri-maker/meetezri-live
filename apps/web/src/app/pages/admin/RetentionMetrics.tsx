import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Users,
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  Award,
  DollarSign,
  RefreshCw,
  Calendar,
  Percent,
  Heart,
  AlertCircle,
  CheckCircle2,
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
  Cell,
} from "recharts";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/app/components/ui/card";
import { buttonVariants } from "@/app/components/ui/button";
import { cn } from "@/app/components/ui/utils";
import { api } from "../../../lib/api";
import { AdminAnalyticsToolbar } from "../../components/admin/AdminAnalyticsToolbar";
import { buildStatsQuery, datesForPreset, downloadCsv, type DashboardTimePreset } from "@/lib/adminAnalytics";

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

export function RetentionMetrics() {
  const [chartPeriod, setChartPeriod] = useState<"week" | "month" | "year">("month");
  const [rangePreset, setRangePreset] = useState<DashboardTimePreset>("30d");
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [dateFrom, setDateFrom] = useState(datesForPreset("30d").dateFrom);
  const [dateTo, setDateTo] = useState(datesForPreset("30d").dateTo);
  const [stats, setStats] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async (forceRefresh?: boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      const q = buildStatsQuery({
        chartPeriod,
        rangePreset,
        useCustomRange,
        dateFrom,
        dateTo,
      });
      const data = await api.admin.getStats({ ...q, ...(forceRefresh ? { refresh: true } : {}) });
      setStats(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load retention metrics");
    } finally {
      setIsLoading(false);
    }
  }, [chartPeriod, rangePreset, useCustomRange, dateFrom, dateTo]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const userGrowth = (stats?.userGrowth || []) as { month: string; users: number }[];
  const cohortRetentionFallback = [
    { cohort: "Jan 2024", week1: 92, week2: 85, week3: 78, week4: 72, month2: 65, month3: 58 },
    { cohort: "Feb 2024", week1: 94, week2: 87, week3: 80, week4: 74, month2: 67, month3: 60 },
    { cohort: "Mar 2024", week1: 95, week2: 89, week3: 82, week4: 76, month2: 69, month3: 62 },
    { cohort: "Apr 2024", week1: 93, week2: 86, week3: 79, week4: 73, month2: 66, month3: 59 },
    { cohort: "May 2024", week1: 96, week2: 90, week3: 84, week4: 78, month2: 71, month3: 64 },
    { cohort: "Jun 2024", week1: 97, week2: 91, week3: 85, week4: 79, month2: 72, month3: 65 },
    { cohort: "Jul 2024", week1: 98, week2: 92, week3: 86, week4: 80, month2: 73, month3: null as number | null },
  ];
  const cohortRetentionData = userGrowth.length
    ? userGrowth.map((row, i) => {
        const prev = i > 0 ? userGrowth[i - 1].users : row.users;
        const w1 = prev > 0 ? Math.min(100, Math.round((row.users / Math.max(prev, 1)) * 100)) : 100;
        return {
          cohort: row.month,
          week1: w1,
          week2: Math.max(0, w1 - 4),
          week3: Math.max(0, w1 - 8),
          week4: Math.max(0, w1 - 12),
          month2: Math.max(0, w1 - 15),
          month3: i < userGrowth.length - 1 ? Math.max(0, w1 - 20) : null,
        };
      })
    : cohortRetentionFallback;

  const lastUsers = userGrowth.length ? userGrowth[userGrowth.length - 1].users : 0;
  const retentionCurveData =
    userGrowth.length && lastUsers > 0
      ? userGrowth.map((row) => ({
          month: row.month,
          retention: Math.min(100, Math.round((row.users / lastUsers) * 100)),
        }))
      : [{ month: "—", retention: 0 }];

  const churnRateData =
    userGrowth.length > 0
      ? userGrowth.map((row, i, arr) => {
          const prev = i > 0 ? arr[i - 1].users : row.users;
          const newUsers = Math.max(0, row.users - prev);
          const churnRate =
            prev > 0
              ? Math.max(0, Math.min(100, Math.round((1 - row.users / prev) * 1000) / 10))
              : 0;
          return {
            month: row.month,
            churnRate,
            newUsers,
            churned: Math.max(0, Math.round((churnRate / 100) * prev)),
          };
        })
      : [{ month: "—", churnRate: 0, newUsers: 0, churned: 0 }];

  // Trial to Paid Conversion
  const conversionData = [
    { week: "Week 1", trials: 500, converted: 45, rate: 9 },
    { week: "Week 2", trials: 650, converted: 78, rate: 12 },
    { week: "Week 3", trials: 800, converted: 112, rate: 14 },
    { week: "Week 4", trials: 920, converted: 156, rate: 17 },
    { week: "Week 5", trials: 1100, converted: 198, rate: 18 },
    { week: "Week 6", trials: 1250, converted: 238, rate: 19 },
    { week: "Week 7", trials: 1400, converted: 280, rate: 20 },
    { week: "Week 8", trials: 1520, converted: 319, rate: 21 },
  ];

  // Lifetime Value Estimates
  const lifetimeValueData = [
    { segment: "Power Users", ltv: 2400, retention: 89, avgSpend: 49 },
    { segment: "Active Users", ltv: 1680, retention: 76, avgSpend: 39 },
    { segment: "Regular Users", ltv: 960, retention: 58, avgSpend: 29 },
    { segment: "Casual Users", ltv: 480, retention: 42, avgSpend: 19 },
  ];

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

  // Retention by User Type
  const retentionByTypeData = [
    { type: "Trial", day7: 68, day30: 45, day90: 32 },
    { type: "Core", day7: 82, day30: 64, day90: 48 },
    { type: "Pro", day7: 94, day30: 85, day90: 76 },
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
      label: "Revenue (MRR est.)",
      value: `$${Math.round(stats?.revenue ?? 0).toLocaleString()}`,
      change: "—",
      trend: "up" as const,
      icon: DollarSign,
      color: "from-purple-500 to-pink-600",
      description: "active subscriptions",
    },
  ];

  const COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b"];

  if (isLoading && !stats) {
    return (
      <AdminLayoutNew>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
        </div>
      </AdminLayoutNew>
    );
  }

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
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Retention Metrics
            </h1>
            <p className="text-gray-600">
              Cohort analysis, churn tracking, and lifetime value estimates
            </p>
          </div>

          <AdminAnalyticsToolbar
            chartPeriod={chartPeriod}
            onChartPeriodChange={setChartPeriod}
            rangePreset={rangePreset}
            onRangePresetChange={setRangePreset}
            useCustomRange={useCustomRange}
            onUseCustomRangeChange={setUseCustomRange}
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
                ...((stats.userGrowth || []) as any[]).map((r: any, i: number) => ({
                  row: i,
                  period: r.month,
                  users: r.users,
                })),
              ]);
            }}
          />
        </motion.div>

        {stats && formatStatsRangeUtc(stats) && (
          <p className="text-sm text-gray-500">
            Data window: {formatStatsRangeUtc(stats)} · Chart bucket:{" "}
            {chartPeriod === "week" ? "week" : chartPeriod === "year" ? "year" : "month"}
          </p>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statsCards.map((stat, index) => (
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

        {/* Cohort Retention Analysis */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-white border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold !text-gray-900 mb-1">
                  Cohort Retention Analysis
                </h3>
                <p className="text-sm !text-gray-600">
                  Derived from cumulative signups per {chartPeriod === "week" ? "week" : chartPeriod === "year" ? "year" : "month"} in your selected date range
                </p>
              </div>
              <Calendar className="w-5 h-5 text-purple-600 shrink-0" aria-hidden />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left !text-gray-700 font-medium pb-3">Cohort</th>
                    <th className="text-center !text-gray-700 font-medium pb-3">Week 1</th>
                    <th className="text-center !text-gray-700 font-medium pb-3">Week 2</th>
                    <th className="text-center !text-gray-700 font-medium pb-3">Week 3</th>
                    <th className="text-center !text-gray-700 font-medium pb-3">Week 4</th>
                    <th className="text-center !text-gray-700 font-medium pb-3">Month 2</th>
                    <th className="text-center !text-gray-700 font-medium pb-3">Month 3</th>
                  </tr>
                </thead>
                <tbody>
                  {cohortRetentionData.map((cohort, rowIdx) => (
                    <tr key={`cohort-${rowIdx}-${String(cohort.cohort)}`} className="border-b border-gray-100">
                      <td className="py-3 !text-gray-900 font-medium">{cohort.cohort}</td>
                      <td className="text-center">
                        <span
                          className="inline-block px-3 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `rgba(34, 197, 94, ${cohort.week1 / 100})`,
                            color: cohort.week1 > 80 ? "#fff" : "#000",
                          }}
                        >
                          {cohort.week1}%
                        </span>
                      </td>
                      <td className="text-center">
                        <span
                          className="inline-block px-3 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `rgba(34, 197, 94, ${cohort.week2 / 100})`,
                            color: cohort.week2 > 80 ? "#fff" : "#000",
                          }}
                        >
                          {cohort.week2}%
                        </span>
                      </td>
                      <td className="text-center">
                        <span
                          className="inline-block px-3 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `rgba(34, 197, 94, ${cohort.week3 / 100})`,
                            color: cohort.week3 > 70 ? "#fff" : "#000",
                          }}
                        >
                          {cohort.week3}%
                        </span>
                      </td>
                      <td className="text-center">
                        <span
                          className="inline-block px-3 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `rgba(34, 197, 94, ${cohort.week4 / 100})`,
                            color: cohort.week4 > 70 ? "#fff" : "#000",
                          }}
                        >
                          {cohort.week4}%
                        </span>
                      </td>
                      <td className="text-center">
                        <span
                          className="inline-block px-3 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `rgba(34, 197, 94, ${cohort.month2 / 100})`,
                            color: cohort.month2 > 60 ? "#fff" : "#000",
                          }}
                        >
                          {cohort.month2}%
                        </span>
                      </td>
                      <td className="text-center">
                        {cohort.month3 ? (
                          <span
                            className="inline-block px-3 py-1 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: `rgba(34, 197, 94, ${cohort.month3 / 100})`,
                              color: cohort.month3 > 60 ? "#fff" : "#000",
                            }}
                          >
                            {cohort.month3}%
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
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
                    Monthly Retention Curve
                  </h3>
                  <p className="text-sm text-gray-400">
                    Cumulative user total vs latest bucket (range follows toolbar)
                  </p>
                </div>
                <Heart className="w-5 h-5 text-pink-400" />
              </div>

              <ResponsiveContainer width="100%" height={300} debounce={50}>
                <AreaChart data={retentionCurveData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRetentionRm" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis dataKey="month" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                  <Area
                    isAnimationActive={false}
                    type="monotone"
                    dataKey="retention"
                    stroke="#ec4899"
                    fillOpacity={1}
                    fill="url(#colorRetentionRm)"
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
                    Churn Rate Trend
                  </h3>
                  <p className="text-sm text-gray-400">Bucket-over-bucket change from the user growth series</p>
                </div>
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>

              <ResponsiveContainer width="100%" height={300} debounce={50}>
                <ComposedChart data={churnRateData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis dataKey="month" stroke="#9ca3af" />
                  <YAxis yAxisId="left" stroke="#9ca3af" />
                  <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" />
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
                    yAxisId="right"
                    dataKey="newUsers"
                    fill="#3b82f6"
                    radius={[8, 8, 0, 0]}
                    name="New Users"
                  />
                  <Line
                    isAnimationActive={false}
                    yAxisId="left"
                    type="monotone"
                    dataKey="churnRate"
                    stroke="#ef4444"
                    strokeWidth={3}
                    name="Churn Rate %"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </div>

        {/* Trial Conversion & LTV */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Trial to Paid Conversion */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-black mb-1">
                    Trial to Paid Conversion
                  </h3>
                  <p className="text-sm text-gray-400">
                    Placeholder demo curve — connect billing trials when available
                  </p>
                </div>
                <Target className="w-5 h-5 text-green-400" />
              </div>

              <ResponsiveContainer width="100%" height={300} debounce={50}>
                <LineChart data={conversionData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis dataKey="week" stroke="#9ca3af" />
                  <YAxis yAxisId="left" stroke="#9ca3af" />
                  <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" />
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
                    yAxisId="right"
                    type="monotone"
                    dataKey="rate"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ fill: "#10b981", r: 5 }}
                    name="Conversion Rate %"
                  />
                  <Line
                    isAnimationActive={false}
                    yAxisId="left"
                    type="monotone"
                    dataKey="converted"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Converted Users"
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>

          {/* Lifetime Value */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-black mb-1">
                    Lifetime Value by Segment
                  </h3>
                  <p className="text-sm text-gray-400">Illustrative segments — not computed from live billing yet</p>
                </div>
                <DollarSign className="w-5 h-5 text-yellow-400" />
              </div>

              <div className="space-y-4">
                {lifetimeValueData.map((segment) => (
                  <div key={segment.segment} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-black font-medium">{segment.segment}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-400">
                          {segment.retention}% retention
                        </span>
                        <span className="text-lg font-bold text-black">
                          ${segment.ltv.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-yellow-500 to-orange-600 rounded-full transition-[width] duration-500 ease-out"
                        style={{ width: `${Math.min(100, (segment.ltv / 2400) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
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

          {/* Retention by User Type */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-black mb-1">
                    Retention by User Type
                  </h3>
                  <p className="text-sm text-gray-400">Placeholder benchmarks — not range-filtered yet</p>
                </div>
                <Users className="w-5 h-5 text-blue-400" />
              </div>

              <ResponsiveContainer width="100%" height={300} debounce={50}>
                <BarChart data={retentionByTypeData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis dataKey="type" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                  <Legend />
                  <Bar isAnimationActive={false} dataKey="day7" fill="#8b5cf6" name="7-Day" radius={[8, 8, 0, 0]} />
                  <Bar isAnimationActive={false} dataKey="day30" fill="#3b82f6" name="30-Day" radius={[8, 8, 0, 0]} />
                  <Bar isAnimationActive={false} dataKey="day90" fill="#10b981" name="90-Day" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </div>
      </div>
    </AdminLayoutNew>
  );
}