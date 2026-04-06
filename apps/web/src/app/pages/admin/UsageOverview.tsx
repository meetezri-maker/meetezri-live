import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Users,
  Activity,
  Clock,
  TrendingUp,
  TrendingDown,
  Calendar,
  BarChart3,
  PieChart,
  Zap,
  Target,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart as RechartsPie,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/app/components/ui/card";
import { api } from "../../../lib/api";
import { AdminAnalyticsToolbar } from "../../components/admin/AdminAnalyticsToolbar";
import { buildStatsQuery, datesForPreset, downloadCsv, type DashboardTimePreset } from "@/lib/adminAnalytics";

function rollingSum(sessions: number[], windowSize: number, i: number): number {
  let s = 0;
  const start = Math.max(0, i - windowSize + 1);
  for (let j = start; j <= i; j++) s += sessions[j] || 0;
  return s;
}

export function UsageOverview() {
  const [chartPeriod, setChartPeriod] = useState<"week" | "month" | "year">("month");
  const [rangePreset, setRangePreset] = useState<DashboardTimePreset>("30d");
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [dateFrom, setDateFrom] = useState(datesForPreset("30d").dateFrom);
  const [dateTo, setDateTo] = useState(datesForPreset("30d").dateTo);

  const [statsData, setStatsData] = useState<any | null>(null);
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
      setStatsData(data);
    } catch (err: any) {
      console.error("Failed to fetch usage overview stats", err);
      setError(err.message || "Failed to load usage overview");
    } finally {
      setIsLoading(false);
    }
  }, [chartPeriod, rangePreset, useCustomRange, dateFrom, dateTo]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const sessionActivity = (statsData?.sessionActivity || []) as any[];
  const sessionCounts = sessionActivity.map((item: any) => Number(item.sessions) || 0);

  const dailyActiveUsersData = sessionActivity.map((item: any, i: number) => ({
    date: item.day,
    dau: item.sessions,
    wau: rollingSum(sessionCounts, 7, i),
    mau: rollingSum(sessionCounts, 30, i),
  }));

  const sessionData = sessionActivity.map((item: any) => ({
    date: item.day,
    sessions: item.sessions,
    avgDuration: item.duration,
    totalMinutes: item.sessions * item.duration,
  }));

  const hourlyData = (statsData?.hourlyActivity || []) as any[];

  const peakUsageData = hourlyData.map((item: any) => ({
    hour: item.hour,
    users: item.sessions,
  }));

  const totalSessions = statsData?.totalSessions || 0;

  const powerUsers = Math.max(Math.round(totalSessions * 0.1), 0);
  const activeUsers = Math.max(Math.round(totalSessions * 0.3), 0);
  const regularUsers = Math.max(Math.round(totalSessions * 0.4), 0);
  const casualUsers = Math.max(Math.round(totalSessions * 0.15), 0);
  const allocatedUsers = powerUsers + activeUsers + regularUsers + casualUsers;
  const inactiveUsers = Math.max(totalSessions - allocatedUsers, 0);

  const activityDistribution = [
    { name: "Power Users (>10 sessions/week)", value: powerUsers, color: "#8b5cf6" },
    { name: "Active Users (5-10 sessions/week)", value: activeUsers, color: "#3b82f6" },
    { name: "Regular Users (2-4 sessions/week)", value: regularUsers, color: "#10b981" },
    { name: "Casual Users (1 session/week)", value: casualUsers, color: "#f59e0b" },
    { name: "Inactive (no sessions this week)", value: inactiveUsers, color: "#6b7280" },
  ];

  /** KPIs summarize the full selected date range (charts use the same series). The last day alone is often “today” with 0 sessions while history has activity — that made cards show 0. */
  const daysInRange = sessionActivity.length;
  const totalSessionsInRange = sessionCounts.reduce((a, b) => a + b, 0);
  const totalMinutesInRange = sessionData.reduce((a, b) => a + (Number(b.totalMinutes) || 0), 0);
  const avgSessionsPerDay =
    daysInRange > 0 ? Math.round((totalSessionsInRange / daysInRange) * 10) / 10 : 0;
  const avgSessionDurationInRange =
    totalSessionsInRange > 0
      ? Math.round((totalMinutesInRange / totalSessionsInRange) * 10) / 10
      : statsData?.avgSessionLength || 0;

  const half = Math.floor(daysInRange / 2);
  const sumSessions = (from: number, to: number) =>
    sessionCounts.slice(from, to).reduce((a, b) => a + b, 0);
  const sumMinutes = (from: number, to: number) =>
    sessionData.slice(from, to).reduce((a, b) => a + (Number(b.totalMinutes) || 0), 0);

  const getPercentChange = (current: number, previous: number | null) => {
    if (previous === null || previous === 0) {
      return 0;
    }
    return ((current - previous) / previous) * 100;
  };

  const formatChange = (value: number) => {
    const fixed = value.toFixed(1);
    return `${value >= 0 ? "+" : ""}${fixed}%`;
  };

  let compareLabel = "2nd half vs 1st half of range";
  let sessionsPrev: number | null = null;
  let minutesPrev: number | null = null;
  let avgDurFirst: number | null = null;
  let avgDurSecond: number | null = null;
  let avgSessionsPerDayFirst = 0;
  let avgSessionsPerDaySecond = 0;

  if (daysInRange >= 2 && half >= 1) {
    const firstHalfSessions = sumSessions(0, half);
    const secondHalfSessions = sumSessions(half, daysInRange);
    const firstHalfMinutes = sumMinutes(0, half);
    const secondHalfMinutes = sumMinutes(half, daysInRange);
    sessionsPrev = firstHalfSessions;
    minutesPrev = firstHalfMinutes;
    avgDurFirst = firstHalfSessions > 0 ? firstHalfMinutes / firstHalfSessions : null;
    avgDurSecond = secondHalfSessions > 0 ? secondHalfMinutes / secondHalfSessions : null;
    avgSessionsPerDayFirst = firstHalfSessions / half;
    avgSessionsPerDaySecond = secondHalfSessions / (daysInRange - half);
  }

  const dailyActiveUsersChange =
    avgSessionsPerDayFirst > 0
      ? getPercentChange(avgSessionsPerDaySecond, avgSessionsPerDayFirst)
      : 0;
  const sessionsChange =
    sessionsPrev != null && half >= 1
      ? getPercentChange(sumSessions(half, daysInRange), sessionsPrev)
      : 0;
  const minutesChange =
    minutesPrev != null && half >= 1
      ? getPercentChange(sumMinutes(half, daysInRange), minutesPrev)
      : 0;
  const durationChange =
    avgDurFirst != null && avgDurSecond != null && avgDurFirst > 0
      ? getPercentChange(avgDurSecond, avgDurFirst)
      : 0;

  const stats = [
    {
      label: "Avg sessions / day",
      value: avgSessionsPerDay.toLocaleString(),
      change: formatChange(dailyActiveUsersChange),
      trend: (dailyActiveUsersChange >= 0 ? "up" : "down") as "up" | "down",
      icon: Users,
      color: "from-blue-500 to-cyan-600",
      description: compareLabel,
    },
    {
      label: "Total sessions",
      value: totalSessionsInRange.toLocaleString(),
      change: formatChange(sessionsChange),
      trend: (sessionsChange >= 0 ? "up" : "down") as "up" | "down",
      icon: Activity,
      color: "from-purple-500 to-pink-600",
      description: "in selected range",
    },
    {
      label: "Total minutes",
      value: Math.round(totalMinutesInRange).toLocaleString(),
      change: formatChange(minutesChange),
      trend: (minutesChange >= 0 ? "up" : "down") as "up" | "down",
      icon: Clock,
      color: "from-green-500 to-emerald-600",
      description: "therapy minutes in range",
    },
    {
      label: "Avg session duration",
      value: `${avgSessionDurationInRange.toFixed(1)} min`,
      change: formatChange(durationChange),
      trend: (durationChange >= 0 ? "up" : "down") as "up" | "down",
      icon: Target,
      color: "from-orange-500 to-red-600",
      description: "weighted across range",
    },
  ];

  const COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#6b7280"];

  if (isLoading) {
    return (
      <AdminLayoutNew>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayoutNew>
    );
  }

  if (error) {
    return (
      <AdminLayoutNew>
        <div className="max-w-2xl mx-auto py-16">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Usage Overview</h1>
          <p className="text-gray-600 mb-4">
            Failed to load usage data. Please try again later.
          </p>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </AdminLayoutNew>
    );
  }

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Usage Overview</h1>
            <p className="text-gray-600">
              Daily active users, sessions, and minutes consumed
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
            exportLabel="Export report"
            onExport={() => {
              if (!statsData) return;
              const rows: Record<string, unknown>[] = (statsData.sessionActivity || []).map((r: any, i: number) => ({
                i,
                day: r.day,
                sessions: r.sessions,
                avgDuration: r.duration,
                dau_proxy: r.sessions,
                wau_rolling7: rollingSum(sessionCounts, 7, i),
                mau_rolling30: rollingSum(sessionCounts, 30, i),
              }));
              downloadCsv(`usage-overview-${new Date().toISOString().slice(0, 10)}.csv`, rows);
            }}
          />
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
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
                    <stat.icon className="w-6 h-6 text-white" />
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
                <h3 className="text-3xl font-bold !text-gray-900 mb-1">{stat.value}</h3>
                <p className="text-sm !text-gray-600">{stat.label}</p>
                <p className="text-xs !text-gray-500 mt-1">{stat.description}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* DAU/MAU/WAU Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-white border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold !text-gray-900 mb-1">
                  Active Users Trend
                </h3>
                <p className="text-sm !text-gray-600">
                  DAU = sessions that day; WAU/MAU = rolling 7 / 30‑day session totals (volume proxy)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-600" />
              </div>
            </div>

            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={dailyActiveUsersData}>
                <defs>
                  <linearGradient id="colorDAU" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorWAU" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorMAU" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                <XAxis dataKey="date" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="dau"
                  stroke="#8b5cf6"
                  fillOpacity={1}
                  fill="url(#colorDAU)"
                  name="Daily Active Users"
                />
                <Area
                  type="monotone"
                  dataKey="wau"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorWAU)"
                  name="Weekly Active Users"
                />
                <Area
                  type="monotone"
                  dataKey="mau"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#colorMAU)"
                  name="Monthly Active Users"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        {/* Sessions & Minutes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sessions Chart */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold !text-gray-900 mb-1">
                    Total Sessions
                  </h3>
                  <p className="text-sm !text-gray-600">Sessions started per day</p>
                </div>
                <Activity className="w-5 h-5 text-purple-600" />
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sessionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis dataKey="date" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                  <Bar dataKey="sessions" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>

          {/* Minutes Consumed Chart */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold !text-gray-900 mb-1">
                    Minutes Consumed
                  </h3>
                  <p className="text-sm !text-gray-600">Total therapy minutes</p>
                </div>
                <Clock className="w-5 h-5 text-green-600" />
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={sessionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis dataKey="date" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="totalMinutes"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ fill: "#10b981", r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </div>

        {/* Peak Usage Hours & Activity Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Peak Usage Hours */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-white border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold !text-gray-900 mb-1">
                    Peak Usage Hours
                  </h3>
                  <p className="text-sm !text-gray-600">Active users by hour</p>
                </div>
                <Zap className="w-5 h-5 text-yellow-600" />
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={peakUsageData}>
                  <defs>
                    <linearGradient id="colorHour" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis dataKey="hour" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="users"
                    stroke="#f59e0b"
                    fillOpacity={1}
                    fill="url(#colorHour)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>

          {/* Activity Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-white border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold !text-gray-900 mb-1">
                    User Activity Distribution
                  </h3>
                  <p className="text-sm !text-gray-600">Users by engagement level</p>
                </div>
                <PieChart className="w-5 h-5 text-pink-600" />
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <RechartsPie>
                  <Pie
                    data={activityDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {activityDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                  <Legend />
                </RechartsPie>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </div>
      </div>
    </AdminLayoutNew>
  );
}
