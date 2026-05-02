import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  TrendingUp,
  Users,
  Activity,
  Clock,
  MessageSquare,
  Heart,
  BarChart3,
  PieChart,
  LineChart,
} from "lucide-react";
import {
  LineChart as RechartsLine,
  BarChart,
  PieChart as RechartsPie,
  Line,
  Bar,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { mergeCompanionAvatarCountsClient } from "@/lib/avatar/adminAvatarAnalytics";
import { api } from "../../../lib/api";
import { AdminAnalyticsToolbar } from "../../components/admin/AdminAnalyticsToolbar";
import { datesForPreset, downloadCsv } from "@/lib/adminAnalytics";

const COMPANION_PIE_COLOR: Record<string, string> = {
  "Not set": "#94a3b8",
  Alex: "#3b82f6",
  "Alex Rivera": "#3b82f6",
  "Sara Mitchell": "#ec4899",
  "Sarah Mitchell": "#ec4899",
  "Jordan Taylor": "#10b981",
  "maya chen": "#8b5cf6",
  "Maya Chen": "#8b5cf6",
  Other: "#64748b",
};

const PIE_FALLBACK_COLORS = ["#0ea5e9", "#f97316", "#a855f7", "#14b8a6", "#eab308", "#6366f1"];

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

export function UsageAnalytics() {
  const [dateFrom, setDateFrom] = useState(datesForPreset("30d").dateFrom);
  const [dateTo, setDateTo] = useState(datesForPreset("30d").dateTo);

  const [selectedMetric, setSelectedMetric] = useState<"sessions" | "users" | "avgDuration">("sessions");
  const [statsData, setStatsData] = useState<any | null>(null);
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
      setStatsData(data);
    } catch (err: any) {
      console.error("Failed to fetch usage analytics", err);
      setError(err.message || "Failed to load usage analytics");
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const sessionActivity = (statsData?.sessionActivity || []) as Array<{
    day: string;
    sessions: number;
    duration: number;
  }>;

  const sessionData = sessionActivity.map((item) => ({
    date: item.day,
    sessions: item.sessions,
    users: item.sessions,
    avgDuration: item.duration,
  }));

  const trendKey = selectedMetric;

  /** All-time completed sessions — matches Conversation Transcripts. */
  const totalSessionsAllTime: number = statsData?.totalSessions ?? 0;

  /** Sessions in the selected date range (for charts only). */
  const sessionsInRange = sessionActivity.reduce((sum, item) => sum + (Number(item.sessions) || 0), 0);

  /** Weighted average duration across days in range; fall back to backend all-time avg. */
  const avgDurationInRange: number = (() => {
    if (sessionsInRange > 0) {
      const weighted = sessionActivity.reduce(
        (sum, item) => sum + (Number(item.sessions) || 0) * (Number(item.duration) || 0),
        0
      );
      const val = Math.round((weighted / sessionsInRange) * 10) / 10;
      if (val > 0) return val;
    }
    return Math.round(Number(statsData?.avgSessionLength ?? 0) * 10) / 10;
  })();

  const featureUsage = statsData?.featureUsage || [];

  const getFeatureUsagePercent = (name: string) => {
    const found = featureUsage.find((item: any) => item.feature === name);
    return found ? found.usage : 0;
  };

  const moodUsagePercent = getFeatureUsagePercent("Mood Tracking");
  const journalUsagePercent = getFeatureUsagePercent("Journal");
  const wellnessUsagePercent = getFeatureUsagePercent("Wellness Tools");

  /** Completion rate = completed sessions / all sessions with a start_at (incl. active). */
  const completionRate: string = (() => {
    const completed = statsData?.totalSessions ?? 0;
    // activeSessions from backend counts sessions started in last 4h; total is harder without raw count.
    // Use sessionsInRange as denominator proxy only if data available.
    if (!completed) return "N/A";
    const allStarted = statsData?.allStartedSessions ?? completed; // backend may not expose this yet
    if (!allStarted || allStarted <= 0) return "N/A";
    return `${Math.min(100, Math.round((completed / allStarted) * 100))}%`;
  })();

  /** Average mood score from backend if available. */
  const avgMoodScore: string = (() => {
    const score = statsData?.avgMoodScore ?? statsData?.avg_mood_score ?? null;
    if (score == null || score === 0) return "N/A";
    return Number(score).toFixed(1);
  })();

  const engagementData = [
    {
      date: "Selected period",
      moodChecks: Math.round((moodUsagePercent / 100) * sessionsInRange),
      journalEntries: Math.round((journalUsagePercent / 100) * sessionsInRange),
      wellness: Math.round((wellnessUsagePercent / 100) * sessionsInRange),
    },
  ];

  /** Re-merge on the client so labels match Session Lobby; collapse strays into "Other". */
  const avatarData = (() => {
    const raw = (statsData?.avatarDistribution || []) as Array<{
      name: string;
      value?: number;
      count?: number;
      color?: string;
    }>;
    if (!raw.length) return [];
    const merged = mergeCompanionAvatarCountsClient(
      raw.map((r) => ({ name: r.name, c: Number(r.count ?? 0) }))
    );
    const total = merged.reduce((s, r) => s + r.count, 0);
    return merged.map((r, i) => {
      const name = r.name;
      const count = r.count;
      const value = total > 0 ? Math.round((count / total) * 100) : 0;
      const color = COMPANION_PIE_COLOR[name] ?? PIE_FALLBACK_COLORS[i % PIE_FALLBACK_COLORS.length];
      return { name, value, count, color };
    });
  })();

  const sessionTypeData = featureUsage.map((item: any) => ({
    name: item.feature,
    value: item.usage,
    color:
      item.feature === "AI Sessions"
        ? "#3B82F6"
        : item.feature === "Mood Tracking"
        ? "#10B981"
        : item.feature === "Journal"
        ? "#8B5CF6"
        : "#F59E0B",
  }));

  const hourlyData = statsData?.hourlyActivity || [];

  const retentionData =
    (statsData?.userGrowth || []).map((item: any, index: number, arr: any[]) => {
      const latestUsers = arr.length > 0 ? arr[arr.length - 1].users : 0;
      const retained =
        latestUsers > 0 ? Math.round((item.users / latestUsers) * 100) : 0;
      const churned = Math.max(0, 100 - retained);
      return {
        week: `Period ${index + 1}`,
        retained,
        churned,
      };
    });

  const stats = statsData
    ? [
        {
          label: "Total Sessions",
          value: totalSessionsAllTime.toLocaleString(),
          sub: "all time · completed",
          change: "",
          trend: "up",
          icon: MessageSquare,
          color: "text-blue-600",
          bg: "bg-blue-100",
        },
        {
          label: "Registered Users",
          value: (statsData.totalUsers ?? 0).toLocaleString(),
          sub: "all time",
          change: "",
          trend: "up",
          icon: Users,
          color: "text-green-600",
          bg: "bg-green-100",
        },
        {
          label: "Avg Session Duration",
          value: avgDurationInRange > 0 ? `${avgDurationInRange} min` : "N/A",
          sub: "completed sessions",
          change: "",
          trend: "up",
          icon: Clock,
          color: "text-purple-600",
          bg: "bg-purple-100",
        },
        {
          label: "Sessions in Period",
          value: sessionsInRange.toLocaleString(),
          sub: `${dateFrom} – ${dateTo}`,
          change: "",
          trend: "up",
          icon: Activity,
          color: "text-orange-600",
          bg: "bg-orange-100",
        },
        {
          label: "Avg Mood Score",
          value: avgMoodScore,
          sub: avgMoodScore !== "N/A" ? "out of 10" : "no mood data yet",
          change: "",
          trend: "up",
          icon: Heart,
          color: "text-pink-600",
          bg: "bg-pink-100",
        },
        {
          label: "Completion Rate",
          value: completionRate,
          sub: completionRate !== "N/A" ? "sessions with ended_at" : "data unavailable",
          change: "",
          trend: "up",
          icon: TrendingUp,
          color: "text-emerald-600",
          bg: "bg-emerald-100",
        },
      ]
    : [];

  if (isLoading) {
    return (
      <AdminLayoutNew>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
        </div>
      </AdminLayoutNew>
    );
  }

  if (error && !statsData) {
    return (
      <AdminLayoutNew>
        <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
          <h1 className="text-2xl font-bold">Usage analytics unavailable</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </AdminLayoutNew>
    );
  }

  return (
    <AdminLayoutNew>
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center shadow-lg">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Usage Analytics</h1>
                <p className="text-muted-foreground">
                  {formatAnalyticsRangeLabel(dateFrom, dateTo)} · Session totals and averages match the period below (not
                  all-time database totals).
                </p>
              </div>
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
                if (!statsData) return;
                const rows = sessionData.map((r) => ({ ...r }));
                downloadCsv(`usage-analytics-${new Date().toISOString().slice(0, 10)}.csv`, rows);
              }}
            />
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-12 h-12 rounded-lg ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
                {"sub" in stat && stat.sub && (
                  <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
                )}
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold mb-1">Session Trends</h2>
                <p className="text-sm text-muted-foreground">
                  Daily session volume and user activity
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={selectedMetric === "sessions" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedMetric("sessions")}
                >
                  Sessions
                </Button>
                <Button
                  variant={selectedMetric === "users" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedMetric("users")}
                >
                  Users
                </Button>
                <Button
                  variant={selectedMetric === "avgDuration" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedMetric("avgDuration")}
                >
                  Duration
                </Button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={sessionData}>
                <defs>
                  <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11, fill: "#64748b" }} interval="preserveStartEnd" minTickGap={20} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11, fill: "#64748b" }} width={40} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    fontSize: 12,
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey={trendKey}
                  name={
                    selectedMetric === "avgDuration"
                      ? "Avg duration (min)"
                      : selectedMetric === "users"
                        ? "Sessions (volume)"
                        : "Sessions"
                  }
                  stroke="#3B82F6"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorSessions)"
                  dot={false}
                  activeDot={{ r: 6, fill: "#3B82F6", strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-6">User Engagement</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={engagementData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11, fill: "#64748b" }} width={40} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    fontSize: 12,
                  }}
                />
                <Legend />
                <Bar dataKey="moodChecks" fill="#EC4899" name="Mood Checks" radius={[4, 4, 0, 0]} />
                <Bar dataKey="journalEntries" fill="#8B5CF6" name="Journal Entries" radius={[4, 4, 0, 0]} />
                <Bar dataKey="wellness" fill="#10B981" name="Wellness Tools" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">Platform Preferences</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Companion choices grouped to the same four avatars as the user app (Session Lobby). Unrecognized values
                roll into &quot;Other&quot;.
              </p>
              {avatarData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-12 text-center">No avatar selection data available.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <RechartsPie margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                    <Pie
                      data={avatarData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      isAnimationActive={false}
                      label={false}
                      innerRadius={60}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      paddingAngle={3}
                    >
                      {avatarData.map((entry, index) => (
                        <Cell key={`cell-${entry.name}-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string, item: { payload?: { count?: number } }) => [
                        `${item.payload?.count ?? "—"} profiles (${value}%)`,
                        name,
                      ]}
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e2e8f0",
                        borderRadius: "10px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                        fontSize: 12,
                      }}
                    />
                  </RechartsPie>
                </ResponsiveContainer>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                {avatarData.map((avatar) => (
                  <div key={avatar.name} className="flex items-start gap-2 text-sm">
                    <div
                      className="w-3 h-3 rounded-full mt-1 shrink-0"
                      style={{ backgroundColor: avatar.color }}
                    />
                    <span className="text-muted-foreground">
                      <span className="font-medium text-foreground">{avatar.name}</span>
                      <span className="mx-1">·</span>
                      {avatar.count} profiles ({avatar.value}%)
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">Feature Usage</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Relative share by feature activity in the product database (not the same denominator as session count
                above).
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <RechartsPie margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                  <Pie
                    data={sessionTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    isAnimationActive={false}
                    label={false}
                    innerRadius={60}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    paddingAngle={3}
                  >
                    {sessionTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, _n, item: { payload?: { name?: string } }) => [
                      `${value}% of max feature volume`,
                      item.payload?.name ?? "",
                    ]}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      fontSize: 12,
                    }}
                  />
                </RechartsPie>
              </ResponsiveContainer>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                {sessionTypeData.map((type) => (
                  <div key={type.name} className="flex items-start gap-2 text-sm">
                    <div
                      className="w-3 h-3 rounded-full mt-1 shrink-0"
                      style={{ backgroundColor: type.color }}
                    />
                    <span className="text-muted-foreground">
                      <span className="font-medium text-foreground">{type.name}</span>
                      <span className="mx-1">·</span>
                      relative {type.value}%
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-6">Peak Usage Hours</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="hour" stroke="#94a3b8" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11, fill: "#64748b" }} width={36} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="sessions" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        {/* User Retention */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-6">User Retention Cohort</h2>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={retentionData}>
                <defs>
                  <linearGradient id="colorRetained" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorChurned" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" stroke="#94a3b8" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11, fill: "#64748b" }} width={36} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    fontSize: 12,
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="retained"
                  stackId="1"
                  stroke="#10B981"
                  strokeWidth={2}
                  fill="url(#colorRetained)"
                  name="Retained %"
                />
                <Area
                  type="monotone"
                  dataKey="churned"
                  stackId="1"
                  stroke="#EF4444"
                  strokeWidth={2}
                  fill="url(#colorChurned)"
                  name="Churned %"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        {/* Key Insights — derived from real data */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Key Insights</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {/* Session volume */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-green-600 mt-1" />
                  <div>
                    <h3 className="font-bold text-green-900 mb-1">Session Volume</h3>
                    <p className="text-sm text-green-700">
                      {totalSessionsAllTime > 0
                        ? `${totalSessionsAllTime.toLocaleString()} completed sessions all time. ${sessionsInRange > 0 ? `${sessionsInRange.toLocaleString()} occurred in the selected period.` : "No sessions in the selected period."}`
                        : "No completed session data available yet."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Avg session duration */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-blue-600 mt-1" />
                  <div>
                    <h3 className="font-bold text-blue-900 mb-1">Session Duration</h3>
                    <p className="text-sm text-blue-700">
                      {avgDurationInRange > 0
                        ? `Average session duration is ${avgDurationInRange} min across completed sessions in the selected period.`
                        : "No session duration data available for the selected period."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Peak hour */}
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Activity className="w-5 h-5 text-purple-600 mt-1" />
                  <div>
                    <h3 className="font-bold text-purple-900 mb-1">Peak Usage Hour</h3>
                    <p className="text-sm text-purple-700">
                      {(() => {
                        const hourly = (statsData?.hourlyActivity || []) as Array<{ hour: string; sessions: number }>;
                        if (!hourly.length) return "No hourly activity data available.";
                        const peak = hourly.reduce((a, b) => (Number(b.sessions) > Number(a.sessions) ? b : a), hourly[0]);
                        return `Highest activity at ${peak.hour} with ${Number(peak.sessions).toLocaleString()} session${Number(peak.sessions) !== 1 ? "s" : ""}. Plan support coverage around this window.`;
                      })()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Top companion */}
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-orange-600 mt-1" />
                  <div>
                    <h3 className="font-bold text-orange-900 mb-1">Top Companion</h3>
                    <p className="text-sm text-orange-700">
                      {(() => {
                        if (!avatarData.length) return "No companion preference data available.";
                        const top = avatarData.reduce((a, b) => (b.count > a.count ? b : a), avatarData[0]);
                        return `${top.name} is the most selected companion with ${top.count.toLocaleString()} profile${top.count !== 1 ? "s" : ""} (${top.value}% of users).`;
                      })()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </AdminLayoutNew>
  );
}
