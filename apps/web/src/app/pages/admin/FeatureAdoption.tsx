import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Zap,
  Activity,
  BookOpen,
  Smile,
  Heart,
  Brain,
  Target,
  Clock,
  AlertCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card } from "@/app/components/ui/card";
import { api } from "../../../lib/api";
import { AdminAnalyticsToolbar } from "../../components/admin/AdminAnalyticsToolbar";
import { datesForPreset, downloadCsv } from "@/lib/adminAnalytics";

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

const ICON_MAP: Record<string, typeof Brain> = {
  "AI Sessions": Brain,
  "Mood Tracking": Smile,
  Journal: BookOpen,
  "Wellness Tools": Heart,
  "Sleep Tracker": Activity,
  "Habit Tracker": Activity,
  "Crisis Resources": AlertCircle,
};

export function FeatureAdoption() {
  const [dateFrom, setDateFrom] = useState(datesForPreset("30d").dateFrom);
  const [dateTo, setDateTo] = useState(datesForPreset("30d").dateTo);
  const [dash, setDash] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadStats = useCallback(async (forceRefresh?: boolean) => {
    setIsLoading(true);
    try {
      setDash(
        await api.admin.getStats({
          chartPeriod: "month",
          dateFrom,
          dateTo,
          ...(forceRefresh ? { refresh: true } : {}),
        })
      );
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const featureUsage = (dash?.featureUsage || []) as { feature: string; usage: number }[];
  const sessionActivity = (dash?.sessionActivity || []) as {
    day: string;
    sessions: number;
    duration: number;
  }[];
  const hourlyActivity = (dash?.hourlyActivity || []) as { hour: string; hourNum?: number; sessions: number }[];

  const totalSessionsAllTime = Number(dash?.totalSessions) || 0;
  const sessionsInRange = sessionActivity.reduce((s, x) => s + (Number(x.sessions) || 0), 0);

  const sessionTrendData = sessionActivity.map((r) => ({
    day: r.day,
    sessions: Number(r.sessions) || 0,
    avgDurationMin: Number(r.duration) || 0,
  }));

  const hourlyChartData = hourlyActivity.map((h) => ({
    hour: h.hour,
    sessions: Number(h.sessions) || 0,
  }));

  const featureAdoptionData = featureUsage.map((f, i) => ({
    feature: f.feature,
    adoption: Math.max(0, Math.min(100, Number(f.usage) || 0)),
    icon: ICON_MAP[f.feature] ?? Brain,
    color: ["#8b5cf6", "#ec4899", "#3b82f6", "#10b981", "#f59e0b", "#06b6d4", "#a855f7"][i % 7],
  }));

  const oc = dash?.onboardingStats as
    | { signupsInRange?: number; completionsInRange?: number; completionRatePercent?: number }
    | undefined;
  const signupsR = Math.max(0, Number(oc?.signupsInRange) || 0);
  const completionsR = Math.max(0, Number(oc?.completionsInRange) || 0);
  const onboardingFunnelStages = [
    { stage: "Signups (range)", value: signupsR, fill: "#8b5cf6" },
    { stage: "Completed onboarding (range)", value: completionsR, fill: "#3b82f6" },
  ];

  const featureShareBars = [...featureUsage]
    .map((f) => ({
      feature: f.feature,
      share: Math.max(0, Math.min(100, Number(f.usage) || 0)),
    }))
    .sort((a, b) => b.share - a.share);

  const avgAdopt =
    featureUsage.length > 0
      ? Math.round(featureUsage.reduce((s, x) => s + x.usage, 0) / featureUsage.length)
      : 0;
  const topFeat = featureUsage.length
    ? featureUsage.reduce((a, b) => (a.usage >= b.usage ? a : b))
    : { feature: "—", usage: 0 };
  const topStats = [
    {
      label: "Avg relative usage",
      value: `${avgAdopt}%`,
      change: "—",
      trend: "up" as const,
      icon: Zap,
      color: "from-purple-500 to-indigo-600",
      description: "mean of per-feature index (vs busiest feature)",
    },
    {
      label: "Highest feature",
      value: topFeat.feature,
      change: `${topFeat.usage}%`,
      trend: "up" as const,
      icon: Brain,
      color: "from-pink-500 to-rose-600",
      description: "relative activity share",
    },
    {
      label: "Total Sessions",
      value: totalSessionsAllTime.toLocaleString(),
      change: `${sessionsInRange.toLocaleString()} in range`,
      trend: "up" as const,
      icon: BookOpen,
      color: "from-cyan-500 to-blue-600",
      description: "all-time ended sessions · badge shows count in selected dates",
    },
    {
      label: "Onboarding completion",
      value: `${dash?.onboardingStats?.completionRatePercent ?? 0}%`,
      change: "—",
      trend: "up" as const,
      icon: Clock,
      color: "from-green-500 to-emerald-600",
      description: "profiles completed / signups in range",
    },
  ];

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
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Feature Adoption</h1>
            <p className="text-gray-600">
              Relative platform activity by feature, session trends, and onboarding — for your selected dates
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {formatAnalyticsRangeLabel(dateFrom, dateTo)} · Feature index uses all-time totals; sessions & onboarding
              match the range.
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
              if (!dash) return;
              downloadCsv(`feature-adoption-${new Date().toISOString().slice(0, 10)}.csv`, [
                ...featureUsage.map((f) => ({ feature: f.feature, relativeUsageIndex: f.usage })),
                ...sessionTrendData.map((r, i) => ({
                  row: i,
                  day: r.day,
                  sessions: r.sessions,
                  avgDurationMin: r.avgDurationMin,
                })),
              ]);
            }}
          />
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {topStats.map((stat, index) => (
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

        {/* Feature Adoption Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-black mb-1">
                  Feature Adoption Overview
                </h3>
                <p className="text-sm text-gray-400">
                  Relative activity index (0–100) vs the busiest feature — not a % of users
                </p>
              </div>
              <Sparkles className="w-5 h-5 text-purple-400" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featureAdoptionData.map((feature, index) => (
                <motion.div
                  key={feature.feature}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-all"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${feature.color}20` }}
                    >
                      <feature.icon
                        className="w-5 h-5"
                        style={{ color: feature.color }}
                      />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-black text-sm">
                        {feature.feature}
                      </h4>
                      <p className="text-xs text-gray-400">Share of top feature’s volume</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Relative index</span>
                      <span className="text-black font-bold">{feature.adoption}%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${feature.adoption}%` }}
                        transition={{ duration: 1, delay: index * 0.1 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: feature.color }}
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Adoption Trend & Rollout Impact */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Adoption Trend */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-black mb-1">
                    Sessions per day (range)
                  </h3>
                  <p className="text-sm text-gray-400">
                    From admin session activity for the selected dates (UTC buckets)
                  </p>
                </div>
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={sessionTrendData} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis
                    dataKey="day"
                    stroke="#9ca3af"
                    tick={{ fontSize: 11 }}
                    angle={-35}
                    textAnchor="end"
                    height={64}
                    interval="preserveStartEnd"
                    minTickGap={16}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="#9ca3af"
                    tick={{ fontSize: 11 }}
                    width={40}
                    domain={[0, "auto"]}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#9ca3af"
                    tick={{ fontSize: 11 }}
                    width={44}
                    domain={[0, "auto"]}
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
                    yAxisId="left"
                    dataKey="sessions"
                    fill="#8b5cf6"
                    name="Sessions"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="avgDurationMin"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    name="Avg duration (min)"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>

          {/* Rollout Impact */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-black mb-1">
                    Sessions by hour (UTC)
                  </h3>
                  <p className="text-sm text-gray-400">
                    Distribution of sessions across the day for the selected range
                  </p>
                </div>
                <Activity className="w-5 h-5 text-cyan-400" />
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={hourlyChartData} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis
                    dataKey="hour"
                    stroke="#9ca3af"
                    tick={{ fontSize: 10 }}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={56}
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
                  <Bar dataKey="sessions" fill="#3b82f6" name="Sessions" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </div>

        {/* Adoption Funnel & Time to Adoption */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Onboarding funnel (range) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-black mb-1">
                    Onboarding funnel (range)
                  </h3>
                  <p className="text-sm text-gray-400">
                    Signups vs completed onboarding in the selected date window
                  </p>
                </div>
                <Target className="w-5 h-5 text-orange-400" />
              </div>

              {signupsR === 0 && completionsR === 0 ? (
                <p className="text-sm text-gray-500 py-8 text-center">No onboarding events in this range.</p>
              ) : (
                <div className="space-y-3">
                  {onboardingFunnelStages.map((stage) => {
                    const widthPct =
                      signupsR > 0
                        ? Math.min(100, Math.round((stage.value / signupsR) * 1000) / 10)
                        : stage.value > 0
                          ? 100
                          : 0;
                    return (
                      <div key={stage.stage} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-black font-medium text-sm">{stage.stage}</span>
                          <span className="text-gray-400 text-sm">{stage.value.toLocaleString()}</span>
                        </div>
                        <div className="h-8 rounded-lg overflow-hidden bg-white/5">
                          <div
                            className="h-full flex items-center justify-center text-black text-xs font-medium min-w-[2rem]"
                            style={{ width: `${widthPct}%`, backgroundColor: stage.fill }}
                          >
                            {signupsR > 0 || stage.value > 0 ? `${widthPct}%` : ""}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </motion.div>

          {/* Feature share ranking */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-black mb-1">
                    Feature activity ranking
                  </h3>
                  <p className="text-sm text-gray-400">
                    Same relative index as cards — sorted by share of the busiest feature
                  </p>
                </div>
                <Clock className="w-5 h-5 text-blue-400" />
              </div>

              {featureShareBars.length === 0 ? (
                <p className="text-sm text-gray-500 py-8 text-center">No feature usage data.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={featureShareBars}
                    layout="vertical"
                    margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                    <XAxis type="number" stroke="#9ca3af" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="feature"
                      stroke="#9ca3af"
                      width={128}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid #374151",
                        borderRadius: "8px",
                        color: "#fff",
                      }}
                      formatter={(v: number) => [`${v}%`, "Relative index"]}
                    />
                    <Bar dataKey="share" fill="#6366f1" radius={[0, 8, 8, 0]} name="Index" />
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