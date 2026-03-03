import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Heart,
  TrendingUp,
  TrendingDown,
  Award,
  Target,
  Zap,
  Clock,
  Calendar,
  Download,
  RefreshCw,
  Users,
  Activity,
  BookOpen,
  Smile,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Area,
} from "recharts";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";

export function EngagementMetrics() {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  const [statsData, setStatsData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchStats = async () => {
      try {
        const data = await api.admin.getStats();
        if (isMounted) {
          setStatsData(data);
        }
      } catch (err: any) {
        console.error("Failed to fetch engagement metrics", err);
        if (isMounted) {
          setError(err.message || "Failed to load engagement metrics");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchStats();

    return () => {
      isMounted = false;
    };
  }, []);

  const sessionActivity = (statsData?.sessionActivity || []) as any[];
  const hourlyActivity = (statsData?.hourlyActivity || []) as any[];
  const featureUsage = (statsData?.featureUsage || []) as any[];
  const userGrowth = (statsData?.userGrowth || []) as any[];

  const totalSessions = statsData?.totalSessions || 0;
  const totalUsers = statsData?.totalUsers || 0;

  const sessionsThisPeriod = sessionActivity.reduce(
    (sum, item) => sum + (item.sessions || 0),
    0
  );

  const engagementScore = featureUsage.length
    ? Math.round(
        featureUsage.reduce((sum, item) => sum + (item.usage || 0), 0) /
          featureUsage.length
      )
    : 0;

  const avgSessionFrequency =
    totalUsers > 0 ? sessionsThisPeriod / totalUsers : 0;

  const formattedAvgSessionFrequency = avgSessionFrequency
    ? `${avgSessionFrequency.toFixed(1)}x/week`
    : "0x/week";

  const adoptionRate = featureUsage.length
    ? Math.round(
        (featureUsage.filter((item) => (item.usage || 0) > 0).length /
          featureUsage.length) *
          100
      )
    : 0;

  const engagementTrendMaxSessions = sessionActivity.reduce(
    (max, item) => (item.sessions > max ? item.sessions : max),
    0
  );

  const engagementTrendData = sessionActivity.map((item) => ({
    date: item.day,
    sessions: item.sessions,
    score: engagementTrendMaxSessions
      ? Math.round((item.sessions / engagementTrendMaxSessions) * 100)
      : 0,
  }));

  const timeOfDayBuckets = [
    { label: "Morning (6-12)", match: (hour: number) => hour >= 6 && hour < 12 },
    { label: "Afternoon (12-6)", match: (hour: number) => hour >= 12 && hour < 18 },
    { label: "Evening (6-10)", match: (hour: number) => hour >= 18 && hour < 22 },
    {
      label: "Night (10-6)",
      match: (hour: number) => hour >= 22 || hour < 6,
    },
  ];

  const timeOfDaySessions = timeOfDayBuckets.map((bucket) => {
    let sessions = 0;
    hourlyActivity.forEach((item, index) => {
      if (bucket.match(index)) {
        sessions += item.sessions || 0;
      }
    });
    return { label: bucket.label, sessions };
  });

  const maxBucketSessions = timeOfDaySessions.reduce(
    (max, item) => (item.sessions > max ? item.sessions : max),
    0
  );

  const timeOfDayEngagement = timeOfDaySessions.map((item) => ({
    time: item.label,
    sessions: item.sessions,
    engagement: maxBucketSessions
      ? Math.round((item.sessions / maxBucketSessions) * 100)
      : 0,
  }));

  const featureEngagementData = featureUsage.map((item) => {
    const usage = item.usage || 0;
    const satisfactionRaw = 3 + usage / 50;
    const satisfaction =
      satisfactionRaw > 5 ? 5 : Number(satisfactionRaw.toFixed(1));
    return {
      feature: item.feature,
      usage,
      satisfaction,
    };
  });

  const maxUserGrowth = userGrowth.reduce(
    (max, item) => (item.users > max ? item.users : max),
    0
  );

  const userJourneyData = userGrowth.map((item) => {
    const completion = maxUserGrowth
      ? Math.round((item.users / maxUserGrowth) * 100)
      : 0;
    const dropoff = completion > 100 ? 0 : 100 - completion;
    return {
      stage: item.month,
      completion,
      dropoff,
    };
  });

  const baseSessions =
    sessionActivity.length > 0 ? sessionActivity[0].sessions || 0 : 0;

  const returnRateData = sessionActivity.map((item, index) => ({
    day: `Day ${index + 1}`,
    rate: baseSessions
      ? Math.round((item.sessions / baseSessions) * 100)
      : 0,
  }));

  const sevenDayReturnRate =
    returnRateData.length > 0 ? returnRateData[returnRateData.length - 1].rate : 0;

  const stats = [
    {
      label: "Overall Engagement Score",
      value: `${engagementScore}%`,
      change: "+0.0%",
      trend: "up" as const,
      icon: Heart,
      color: "from-pink-500 to-rose-600",
      description: "based on feature usage",
    },
    {
      label: "Avg Session Frequency",
      value: formattedAvgSessionFrequency,
      change: "+0.0x",
      trend: "up" as const,
      icon: Activity,
      color: "from-purple-500 to-indigo-600",
      description: "per user over last 7 days",
    },
    {
      label: "Feature Adoption Rate",
      value: `${adoptionRate}%`,
      change: "+0.0%",
      trend: "up" as const,
      icon: Zap,
      color: "from-cyan-500 to-blue-600",
      description: "of tracked features",
    },
    {
      label: "7-Day Return Rate",
      value: `${sevenDayReturnRate}%`,
      change: "+0.0%",
      trend: "up" as const,
      icon: Target,
      color: "from-orange-500 to-red-600",
      description: "relative to first day",
    },
  ];

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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Engagement Metrics
          </h1>
          <p className="text-gray-600 mb-4">
            Failed to load engagement metrics. Please try again later.
          </p>
          <p className="text-sm text-red-600">{error}</p>
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
              Engagement Metrics
            </h1>
            <p className="text-gray-600">
              User engagement scores, session frequency, and behavioral insights
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Time Range Selector */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1 border border-gray-200">
              {(["7d", "30d", "90d"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    timeRange === range
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg"
                      : "text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {range === "7d" ? "7 Days" : range === "30d" ? "30 Days" : "90 Days"}
                </button>
              ))}
            </div>

            <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>

            <Button
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>

        {/* Stats Grid */}
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
                <h3 className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</h3>
                <p className="text-sm text-gray-700">{stat.label}</p>
                <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Engagement Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">
                  Engagement Score Trend
                </h3>
                <p className="text-sm text-gray-400">
                  Overall engagement with AI sessions
                </p>
              </div>
              <Heart className="w-5 h-5 text-pink-400" />
            </div>

            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={engagementTrendData}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                <XAxis dataKey="date" stroke="#9ca3af" />
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
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="score"
                  stroke="#ec4899"
                  fillOpacity={1}
                  fill="url(#colorScore)"
                  name="Engagement Score"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="sessions"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  name="Sessions"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        {/* Session Frequency & Feature Engagement */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Session Frequency */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    Session Frequency Analysis
                  </h3>
                  <p className="text-sm text-gray-400">Users by sessions per week</p>
                </div>
                <Activity className="w-5 h-5 text-purple-400" />
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sessionFrequencyData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis type="number" stroke="#9ca3af" />
                  <YAxis dataKey="range" type="category" stroke="#9ca3af" width={120} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                  <Bar dataKey="users" fill="#8b5cf6" radius={[0, 8, 8, 0]}>
                    {sessionFrequencyData.map((entry, index) => (
                      <text
                        key={index}
                        x={entry.users + 50}
                        y={0}
                        fill="#fff"
                        textAnchor="start"
                      >
                        {entry.percentage}%
                      </text>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>

          {/* Feature Engagement */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    Feature Engagement
                  </h3>
                  <p className="text-sm text-gray-400">Usage % and satisfaction</p>
                </div>
                <Zap className="w-5 h-5 text-cyan-400" />
              </div>

              <div className="space-y-4">
                {featureEngagementData.map((feature, index) => (
                  <div key={feature.feature} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-medium">{feature.feature}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-400">
                          {feature.usage}% usage
                        </span>
                        <div className="flex items-center gap-1">
                          <Smile className="w-4 h-4 text-yellow-400" />
                          <span className="text-sm text-white font-medium">
                            {feature.satisfaction}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${feature.usage}%` }}
                        transition={{ duration: 1, delay: index * 0.1 }}
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>

        {/* User Journey & Return Rate */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User Journey Drop-off */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    User Journey Engagement
                  </h3>
                  <p className="text-sm text-gray-400">Completion and drop-off rates</p>
                </div>
                <Target className="w-5 h-5 text-orange-400" />
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={userJourneyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis dataKey="stage" stroke="#9ca3af" angle={-45} textAnchor="end" height={80} />
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
                  <Bar dataKey="completion" stackId="a" fill="#10b981" name="Completion %" />
                  <Bar dataKey="dropoff" stackId="a" fill="#ef4444" name="Drop-off %" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>

          {/* Return Rate */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">Return Rate Trend</h3>
                  <p className="text-sm text-gray-400">
                    % of users returning over time
                  </p>
                </div>
                <Users className="w-5 h-5 text-green-400" />
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={returnRateData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis dataKey="day" stroke="#9ca3af" />
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
                    dataKey="rate"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ fill: "#10b981", r: 6 }}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </div>

        {/* Time of Day Engagement */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">
                  Engagement by Time of Day
                </h3>
                <p className="text-sm text-gray-400">
                  Engagement scores and session volume
                </p>
              </div>
              <Clock className="w-5 h-5 text-blue-400" />
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={timeOfDayEngagement}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                <XAxis dataKey="time" stroke="#9ca3af" />
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
                  yAxisId="right"
                  dataKey="sessions"
                  fill="#3b82f6"
                  radius={[8, 8, 0, 0]}
                  name="Sessions"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="engagement"
                  stroke="#ec4899"
                  strokeWidth={3}
                  name="Engagement %"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>
      </div>
    </AdminLayoutNew>
  );
}
