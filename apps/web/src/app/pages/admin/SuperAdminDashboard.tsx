import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { api } from "../../../lib/api";
import { motion } from "motion/react";
import {
  Users,
  Building2,
  Globe,
  TrendingUp,
  Activity,
  Server,
  AlertTriangle,
  DollarSign,
  Crown,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Settings,
  Zap,
  Shield,
  MessageSquare,
  UserCheck,
  BarChart3,
  Bell,
  Eye,
  Download,
  Smile,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  AreaChart,
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
} from "recharts";

function formatTimeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
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
  const [chartPeriod, setChartPeriod] = useState<"week" | "month" | "year">("month");
  const [sessionWeekOffset, setSessionWeekOffset] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      try {
        const [data, moods, recent] = await Promise.all([
          api.admin.getStats({ chartPeriod, sessionWeekOffset }),
          api.moods.getAllMoods(),
          api.admin.getRecentActivity(),
        ]);
        if (cancelled) return;

        setStats(data);

        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const todays = (moods || []).filter(
          (m: any) => new Date(m.created_at) >= start
        );
        setRecentMoods(todays);

        const feed: {
          action: string;
          user: string;
          time: string;
          type: string;
          at: number;
        }[] = [];

        for (const s of recent.sessions || []) {
          feed.push({
            action: "Session activity",
            user: s.profiles?.full_name || s.profiles?.email || "User",
            time: formatTimeAgo(s.started_at),
            type: "session",
            at: new Date(s.started_at).getTime(),
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
        setActivityFeed(feed.slice(0, 12).map(({ at: _a, ...rest }) => rest));

        setCrisisAlerts(
          (recent.alerts || []).map((a: any) => ({
            id: a.id,
            type:
              a.risk_level === "critical" || a.risk_level === "high"
                ? "critical"
                : "warning",
            message: `Crisis (${a.risk_level}): ${a.event_type || "Pending review"}`,
            time: formatTimeAgo(a.created_at),
            status: "pending",
          }))
        );
      } catch (error) {
        console.error("Failed to fetch admin stats", error);
        toast.error("Could not load dashboard data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [chartPeriod, sessionWeekOffset]);

  const exportReport = () => {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        chartPeriod,
        sessionWeekOffset,
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
    if (chartPeriod === "year") return "New signups by year";
    return "Total users over time (monthly)";
  }, [chartPeriod]);

  const revenueSubtitle = useMemo(() => {
    if (chartPeriod === "week") return "Payment volume by week (Stripe)";
    if (chartPeriod === "year") return "Payment volume by year (Stripe)";
    return "Payment volume by month (Stripe)";
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
  const totalSessions = stats?.totalSessions || 0;
  const revenue = stats?.revenue || 0;
  const userGrowthData = stats?.userGrowth || [];
  const sessionData = stats?.sessionActivity || [];
  const revenueData = stats?.revenueData || [];
  const platformDistribution = stats?.platformDistribution || [];
  const systemHealth = stats?.systemHealth || [];
  const mockedSections: string[] = stats?.mockedSections || [];

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
            Some dashboard metrics are currently mocked/estimated: {mockedSections.join(", ")}.
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
                  <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                    +12.5%
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
                  <span>+1,234 this week</span>
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
                  <span>234 in last hour</span>
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
                  <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                    +23.1%
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-1">Revenue (MRR)</p>
                <div className="text-3xl font-bold">${revenue}K</div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <TrendingUp className="w-3 h-3 text-green-600" />
                  <span>$58K this month</span>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Growth Chart - Takes 2 columns */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-2"
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-bold text-xl flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-500" />
                    User Growth Trend
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">{trendSubtitle}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(["week", "month", "year"] as const).map((p) => (
                    <Button
                      key={p}
                      variant={chartPeriod === p ? "default" : "outline"}
                      size="sm"
                      type="button"
                      onClick={() => setChartPeriod(p)}
                    >
                      {p === "week" ? "Week" : p === "month" ? "Month" : "Year"}
                    </Button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={userGrowthData}>
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>

                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="users"
                    stroke="#8b5cf6"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorUsers)"
                    name="Total Users"
                  />

                </AreaChart>
              </ResponsiveContainer>
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
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-sm font-medium">{metric.name}</span>
                      </div>
                      <span className={`font-bold text-sm ${metric.color}`}>
                        {metric.value}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${metric.percentage}%` }}
                        transition={{ delay: 0.7 + index * 0.1, duration: 1 }}
                        className={`h-full ${
                          metric.status === "excellent"
                            ? "bg-green-500"
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
                className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200"
              >
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium text-sm">All systems operational</span>
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
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                  <h2 className="font-bold text-xl flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-cyan-500" />
                    Weekly Session Activity
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sessions per day (UTC week) — offset {sessionWeekOffset || "current"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setSessionWeekOffset((o) => Math.min(52, o + 1))}
                    aria-label="Previous week"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSessionWeekOffset(0)}
                  >
                    This week
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setSessionWeekOffset((o) => Math.max(0, o - 1))}
                    disabled={sessionWeekOffset <= 0}
                    aria-label="Next week"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={sessionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="sessions" fill="#06b6d4" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
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
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
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
                        <Button size="sm" variant="outline">
                          Review
                        </Button>
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
                    Platform Usage
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Distribution by device type
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
                  Today&apos;s mood check-ins (all recorded today)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {recentMoods.length === 0 ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  No mood entries recorded yet.
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