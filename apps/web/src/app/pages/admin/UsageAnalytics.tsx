import { useEffect, useState } from "react";
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
  Calendar,
  Download,
  Filter,
  BarChart3,
  PieChart,
  LineChart,
  ArrowUp,
  ArrowDown,
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
import { api } from "../../../lib/api";

export function UsageAnalytics() {
  const [timeRange, setTimeRange] = useState("7d");
  const [selectedMetric, setSelectedMetric] = useState("sessions");
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
        console.error("Failed to fetch usage analytics", err);
        if (isMounted) {
          setError(err.message || "Failed to load usage analytics");
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

  const sessionData =
    (statsData?.sessionActivity || []).map((item: any) => ({
      date: item.day,
      sessions: item.sessions,
      users: Math.max(item.sessions, 0),
      avgDuration: item.duration,
    }));

  const totalSessions = statsData?.totalSessions || 0;
  const featureUsage = statsData?.featureUsage || [];

  const getFeatureUsagePercent = (name: string) => {
    const found = featureUsage.find((item: any) => item.feature === name);
    return found ? found.usage : 0;
  };

  const moodUsagePercent = getFeatureUsagePercent("Mood Tracking");
  const journalUsagePercent = getFeatureUsagePercent("Journal");
  const wellnessUsagePercent = getFeatureUsagePercent("Wellness Tools");

  const engagementData = [
    {
      date: "All time",
      moodChecks: Math.round((moodUsagePercent / 100) * totalSessions),
      journalEntries: Math.round((journalUsagePercent / 100) * totalSessions),
      wellness: Math.round((wellnessUsagePercent / 100) * totalSessions),
    },
  ];

  const platformDistribution = statsData?.platformDistribution || [];

  const avatarData = platformDistribution.map((item: any) => ({
    name: item.name,
    value: item.value,
    color: item.color,
  }));

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
          value: statsData.totalSessions.toLocaleString(),
          change: "0.0%",
          trend: "up",
          icon: MessageSquare,
          color: "text-blue-600",
          bg: "bg-blue-100",
        },
        {
          label: "Active Users",
          value: statsData.totalUsers.toLocaleString(),
          change: "0.0%",
          trend: "up",
          icon: Users,
          color: "text-green-600",
          bg: "bg-green-100",
        },
        {
          label: "Avg Session Time",
          value: `${statsData.avgSessionLength || 0} min`,
          change: "0.0%",
          trend: "up",
          icon: Clock,
          color: "text-purple-600",
          bg: "bg-purple-100",
        },
        {
          label: "Engagement Rate",
          value:
            featureUsage.length > 0
              ? `${Math.round(
                  featureUsage.reduce(
                    (sum: number, item: any) => sum + item.usage,
                    0
                  ) / featureUsage.length
                )}%`
              : "0%",
          change: "0.0%",
          trend: "up",
          icon: Activity,
          color: "text-orange-600",
          bg: "bg-orange-100",
        },
        {
          label: "Avg Mood Score",
          value: "N/A",
          change: "0.0",
          trend: "up",
          icon: Heart,
          color: "text-pink-600",
          bg: "bg-pink-100",
        },
        {
          label: "Completion Rate",
          value: "N/A",
          change: "0.0%",
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
                  Comprehensive insights into platform usage and engagement
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <select
                className="px-3 py-2 border rounded-lg"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="1y">Last Year</option>
              </select>
              <Button variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
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
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                    stat.trend === "up" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}>
                    {stat.trend === "up" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                    {stat.change}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
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
                  variant={selectedMetric === "duration" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedMetric("duration")}
                >
                  Duration
                </Button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={sessionData}>
                <defs>
                  <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey={selectedMetric}
                  stroke="#3B82F6"
                  fillOpacity={1}
                  fill="url(#colorSessions)"
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
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="moodChecks" fill="#EC4899" name="Mood Checks" />
                <Bar dataKey="journalEntries" fill="#8B5CF6" name="Journal Entries" />
                <Bar dataKey="wellness" fill="#10B981" name="Wellness Tools" />
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
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPie>
                  <Pie
                    data={avatarData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {avatarData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPie>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-3 mt-4">
                {avatarData.map((avatar) => (
                  <div key={avatar.name} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: avatar.color }}
                    />
                    <span className="text-sm">
                      {avatar.name}: <span className="font-medium">{avatar.value}</span>
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
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPie>
                  <Pie
                    data={sessionTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {sessionTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPie>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-3 mt-4">
                {sessionTypeData.map((type) => (
                  <div key={type.name} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: type.color }}
                    />
                    <span className="text-sm">
                      {type.name}: <span className="font-medium">{type.value}</span>
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
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="sessions" fill="#8B5CF6" radius={[8, 8, 0, 0]} />
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
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorChurned" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="retained"
                  stackId="1"
                  stroke="#10B981"
                  fill="url(#colorRetained)"
                  name="Retained %"
                />
                <Area
                  type="monotone"
                  dataKey="churned"
                  stackId="1"
                  stroke="#EF4444"
                  fill="url(#colorChurned)"
                  name="Churned %"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        {/* Key Insights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Key Insights</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-green-600 mt-1" />
                  <div>
                    <h3 className="font-bold text-green-900 mb-1">Session Growth</h3>
                    <p className="text-sm text-green-700">
                      Sessions increased by 12.5% compared to last week, with highest growth in wellness tools (+18%)
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-blue-600 mt-1" />
                  <div>
                    <h3 className="font-bold text-blue-900 mb-1">User Engagement</h3>
                    <p className="text-sm text-blue-700">
                      Average session duration increased to 45 minutes. Users are spending more quality time.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-purple-600 mt-1" />
                  <div>
                    <h3 className="font-bold text-purple-900 mb-1">Peak Hours</h3>
                    <p className="text-sm text-purple-700">
                      Highest activity between 6-9 PM. Consider optimizing server resources during peak hours.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Heart className="w-5 h-5 text-orange-600 mt-1" />
                  <div>
                    <h3 className="font-bold text-orange-900 mb-1">User Satisfaction</h3>
                    <p className="text-sm text-orange-700">
                      Average mood score improved to 7.2/10. Serena remains the most popular avatar (28% preference).
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
