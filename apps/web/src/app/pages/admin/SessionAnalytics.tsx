import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { StatsCard } from "../../components/StatsCard";
import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { AdminAnalyticsToolbar } from "../../components/admin/AdminAnalyticsToolbar";
import { buildStatsQuery, datesForPreset, downloadCsv, type DashboardTimePreset } from "@/lib/adminAnalytics";
import {
  MessageSquare,
  Clock,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { api } from "../../../lib/api";
import { AdminTableSkeletonRows } from "../../components/admin/AdminTableSkeleton";

export function SessionAnalytics() {
  const [chartPeriod, setChartPeriod] = useState<"week" | "month" | "year">("month");
  const [rangePreset, setRangePreset] = useState<DashboardTimePreset>("30d");
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [dateFrom, setDateFrom] = useState(datesForPreset("30d").dateFrom);
  const [dateTo, setDateTo] = useState(datesForPreset("30d").dateTo);

  const [statsData, setStatsData] = useState<any | null>(null);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (forceRefresh?: boolean) => {
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
      const [stats, recent] = await Promise.all([
        api.admin.getStats({ ...q, ...(forceRefresh ? { refresh: true } : {}) }),
        api.admin.getRecentActivity(),
      ]);
      setStatsData(stats);
      setRecentSessions(recent.sessions || []);
    } catch (err: any) {
      console.error("Failed to fetch session analytics", err);
      setError(err.message || "Failed to load session analytics");
    } finally {
      setIsLoading(false);
    }
  }, [chartPeriod, rangePreset, useCustomRange, dateFrom, dateTo]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totalSessions = statsData?.totalSessions || 0;
  const totalUsers = statsData?.totalUsers || 0;
  const avgSessionLength = statsData?.avgSessionLength || 0;

  const sessionActivity = (statsData?.sessionActivity || []) as any[];

  const sessionTrendData = sessionActivity.map((item: any) => ({
    date: item.day,
    sessions: item.sessions,
  }));

  const sessionsThisWeek = sessionActivity.reduce(
    (sum, item: any) => sum + item.sessions,
    0
  );

  const hourlyActivity = (statsData?.hourlyActivity || []) as any[];

  const sessionDurationData = hourlyActivity.map((item: any) => ({
    range: item.hour,
    count: item.sessions,
  }));

  const statsCards = [
    {
      title: "Total Sessions",
      value: totalSessions.toLocaleString(),
      change: "0.0%",
      changeType: "positive",
      icon: MessageSquare,
      color: "primary",
      delay: 0,
    },
    {
      title: "Avg Duration",
      value: `${avgSessionLength} min`,
      change: "0.0",
      changeType: "positive",
      icon: Clock,
      color: "secondary",
      delay: 0.1,
    },
    {
      title: "Active Users",
      value: totalUsers.toLocaleString(),
      change: "0.0%",
      changeType: "positive",
      icon: Users,
      color: "accent",
      delay: 0.2,
    },
    {
      title: "Sessions This Week",
      value: sessionsThisWeek.toLocaleString(),
      change: "0.0%",
      changeType: "positive",
      icon: TrendingUp,
      color: "success",
      delay: 0.3,
    },
  ];

  const avatarUsageData: { name: string; value: number; color: string }[] = (
    statsData?.avatarDistribution?.length
      ? statsData.avatarDistribution
      : [{ name: "No data", value: 100, color: "#94a3b8" }]
  ).map((a: { name: string; value: number; color: string }) => ({
    name: a.name,
    value: a.value,
    color: a.color,
  }));

  const topicDistributionData = sessionActivity.map((item: any) => ({
    topic: item.day,
    count: item.sessions,
  }));

  const mappedRecentSessions = recentSessions.map((session: any) => {
    const userName =
      session.profiles?.full_name ||
      session.profiles?.email ||
      "Unknown user";
    const duration =
      session.duration_minutes != null
        ? `${session.duration_minutes} min`
        : "N/A";
    const startedAt = session.started_at
      ? new Date(session.started_at)
      : null;
    const timeLabel = startedAt
      ? startedAt.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "";

    return {
      id: session.id,
      user: userName,
      avatar: "AI Companion",
      topic: "Session",
      duration,
      sentiment: "Neutral",
      time: timeLabel,
    };
  });

  if (error) {
    return (
      <AdminLayoutNew>
        <div className="max-w-2xl mx-auto py-16">
          <h1 className="text-3xl font-bold mb-2">Session Analytics</h1>
          <p className="text-muted-foreground mb-4">
            Failed to load session analytics. Please try again later.
          </p>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </AdminLayoutNew>
    );
  }

  return (
    <AdminLayoutNew>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold mb-2">Session Analytics</h1>
            <p className="text-muted-foreground">
              Monitor AI session usage patterns and metrics
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
            onRefresh={() => void loadData(true)}
            isLoading={isLoading}
            onExport={() => {
              if (!statsData) return;
              const rows = (statsData.sessionActivity || []).map((r: any, i: number) => ({
                i,
                day: r.day,
                sessions: r.sessions,
                avgDurationMin: r.duration,
              }));
              downloadCsv(`session-analytics-${new Date().toISOString().slice(0, 10)}.csv`, rows);
            }}
          />
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-gray-200 bg-white p-6 h-32 animate-pulse"
                >
                  <div className="h-4 w-24 bg-gray-200 rounded mb-4" />
                  <div className="h-8 w-20 bg-gray-200 rounded" />
                </div>
              ))
            : statsCards.map((card) => (
                <StatsCard
                  key={card.title}
                  title={card.title}
                  value={card.value}
                  change={card.change}
                  changeType={card.changeType as "positive" | "negative" | "neutral"}
                  icon={card.icon}
                  color={card.color as any}
                  delay={card.delay}
                />
              ))}
        </div>

        {/* Charts Row 1 */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Session Trend */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">Session trend (selected range)</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={sessionTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="sessions"
                    stroke="#9b87f5"
                    strokeWidth={3}
                    dot={{ fill: "#9b87f5", r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>

          {/* Avatar Usage */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-2">Companion avatar (profile selection)</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Share of users by <span className="font-medium">selected_avatar</span> on their profile
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Pie
                    data={avatarUsageData}
                    cx="50%"
                    cy="45%"
                    labelLine={false}
                    label={false}
                    outerRadius={88}
                    fill="#8884d8"
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {avatarUsageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${value}%`, "Share"]}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    wrapperStyle={{ fontSize: 11, lineHeight: 1.4 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Topic Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">Popular Topics</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topicDistributionData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" stroke="#6b7280" />
                  <YAxis dataKey="topic" type="category" stroke="#6b7280" width={72} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="count" fill="#9b87f5" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>

          {/* Session Duration */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">Session Duration Distribution</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sessionDurationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="range" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="count" fill="#7c3aed" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </div>

        {/* Recent Sessions Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card className="overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold">Recent Sessions</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Avatar
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Topic
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Sentiment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {isLoading && (
                    <AdminTableSkeletonRows
                      columns={6}
                      rows={8}
                      firstColumnWide
                      padding="comfortable"
                    />
                  )}
                  {!isLoading &&
                    mappedRecentSessions.map((session) => (
                    <tr key={session.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-sm font-bold">
                            {session.user.charAt(0)}
                          </div>
                          <span className="font-medium text-sm">{session.user}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {session.avatar}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {session.topic}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {session.duration}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            session.sentiment === "Positive"
                              ? "bg-green-100 text-green-700"
                              : session.sentiment === "Improved"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {session.sentiment}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {session.time}
                      </td>
                    </tr>
                  ))}
                  {!isLoading && mappedRecentSessions.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-12 text-center text-sm text-muted-foreground"
                      >
                        No recent sessions in this range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      </div>
    </AdminLayoutNew>
  );
}
