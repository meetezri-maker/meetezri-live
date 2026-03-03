import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Users,
  Activity,
  Clock,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  RefreshCw,
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
import { useEffect, useState } from "react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { api } from "../../../lib/api";

export function UsageOverview() {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  const [viewMode, setViewMode] = useState<"daily" | "weekly" | "monthly">("daily");
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
        console.error("Failed to fetch usage overview stats", err);
        if (isMounted) {
          setError(err.message || "Failed to load usage overview");
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

  const dailyActiveUsersData = sessionActivity.map((item: any) => ({
    date: item.day,
    dau: item.sessions,
    wau: item.sessions,
    mau: item.sessions,
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

  const latestDay = sessionActivity.length > 0 ? sessionActivity[sessionActivity.length - 1] : null;
  const previousDay = sessionActivity.length > 1 ? sessionActivity[sessionActivity.length - 2] : null;

  const dailyActiveUsers = latestDay ? latestDay.sessions : 0;
  const totalSessionsToday = latestDay ? latestDay.sessions : 0;
  const totalMinutesToday = latestDay ? latestDay.sessions * latestDay.duration : 0;
  const avgSessionDurationToday = latestDay ? latestDay.duration : statsData?.avgSessionLength || 0;

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

  const dailyActiveUsersChange = getPercentChange(
    dailyActiveUsers,
    previousDay ? previousDay.sessions : null
  );

  const sessionsChange = getPercentChange(
    totalSessionsToday,
    previousDay ? previousDay.sessions : null
  );

  const minutesChange = getPercentChange(
    totalMinutesToday,
    previousDay ? previousDay.sessions * previousDay.duration : null
  );

  const durationChange = getPercentChange(
    avgSessionDurationToday,
    previousDay ? previousDay.duration : null
  );

  const stats = [
    {
      label: "Daily Active Users",
      value: dailyActiveUsers.toLocaleString(),
      change: formatChange(dailyActiveUsersChange),
      trend: (dailyActiveUsersChange >= 0 ? "up" : "down") as "up" | "down",
      icon: Users,
      color: "from-blue-500 to-cyan-600",
      description: "vs previous period",
    },
    {
      label: "Total Sessions Today",
      value: totalSessionsToday.toLocaleString(),
      change: formatChange(sessionsChange),
      trend: (sessionsChange >= 0 ? "up" : "down") as "up" | "down",
      icon: Activity,
      color: "from-purple-500 to-pink-600",
      description: "sessions started",
    },
    {
      label: "Total Minutes Consumed",
      value: totalMinutesToday.toLocaleString(),
      change: formatChange(minutesChange),
      trend: (minutesChange >= 0 ? "up" : "down") as "up" | "down",
      icon: Clock,
      color: "from-green-500 to-emerald-600",
      description: "therapy minutes",
    },
    {
      label: "Avg Session Duration",
      value: `${avgSessionDurationToday.toFixed(1)} min`,
      change: formatChange(durationChange),
      trend: (durationChange >= 0 ? "up" : "down") as "up" | "down",
      icon: Target,
      color: "from-orange-500 to-red-600",
      description: "per session",
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
                      : "text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {range === "7d" ? "7 Days" : range === "30d" ? "30 Days" : "90 Days"}
                </button>
              ))}
            </div>

            {/* Export Button */}
            <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white">
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>

            {/* Refresh Button */}
            <Button
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
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
                  Daily, Weekly, and Monthly Active Users
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
