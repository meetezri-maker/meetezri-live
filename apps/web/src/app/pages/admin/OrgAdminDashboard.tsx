import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { motion } from "motion/react";
import {
  Users,
  UserPlus,
  Activity,
  TrendingUp,
  Building2,
  Shield,
  Star,
  Clock,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  ArrowUpRight,
  Settings,
  BarChart3,
  Target,
  Award,
  Eye,
  Bell,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { api } from "../../../lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const FEATURE_PIE_COLORS = ["#10b981", "#06b6d4", "#f59e0b", "#8b5cf6"];

export function OrgAdminDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [recent, setRecent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [s, r] = await Promise.all([
          api.admin.getStats(),
          api.admin.getRecentActivity(),
        ]);
        if (!cancelled) {
          setStats(s);
          setRecent(r);
        }
      } catch (e) {
        console.error("Org admin dashboard load failed", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const orgLabel = profile?.full_name || profile?.email || "Organization";

  const sessionActivity = (stats?.sessionActivity || []) as {
    day: string;
    sessions: number;
    duration: number;
  }[];

  const engagementData = useMemo(
    () =>
      sessionActivity.map((d) => ({
        day: d.day,
        sessions: d.sessions,
        avgDuration: d.duration,
      })),
    [sessionActivity]
  );

  const featureUsage = (stats?.featureUsage || []) as { feature: string; usage: number }[];
  const wellnessMetrics = useMemo(() => {
    const slice = featureUsage.slice(0, 4);
    if (slice.length === 0) {
      return [{ name: "No data yet", value: 100, color: "#e5e7eb" }];
    }
    return slice.map((f, i) => ({
      name: f.feature,
      value: f.usage,
      color: FEATURE_PIE_COLORS[i % FEATURE_PIE_COLORS.length],
    }));
  }, [featureUsage]);

  const teamPerformance = useMemo(
    () => featureUsage.slice(0, 6).map((f) => ({ team: f.feature, score: f.usage })),
    [featureUsage]
  );

  const teamActivity = useMemo(
    () =>
      featureUsage.slice(0, 4).map((f) => ({
        team: f.feature,
        members: stats?.totalUsers ?? 0,
        activeToday: stats?.activeSessions ?? 0,
        sessions: stats?.totalSessions ?? 0,
        growth: "—",
        engagement: f.usage,
      })),
    [featureUsage, stats]
  );

  const recentActivity = useMemo(() => {
    const rows: {
      id: string;
      user: string;
      action: string;
      team: string;
      time: string;
      ts: number;
    }[] = [];
    for (const s of recent?.sessions ?? []) {
      const ts = s.started_at ? new Date(s.started_at).getTime() : 0;
      rows.push({
        id: `s-${s.id}`,
        user: s.profiles?.full_name || s.profiles?.email || "User",
        action: "AI session",
        team: "Session",
        time: s.started_at
          ? formatDistanceToNow(new Date(s.started_at), { addSuffix: true })
          : "",
        ts,
      });
    }
    for (const m of recent?.moodEntries ?? []) {
      const ts = m.created_at ? new Date(m.created_at).getTime() : 0;
      rows.push({
        id: `m-${m.id}`,
        user: m.profiles?.full_name || "User",
        action: m.mood ? `Mood check-in (${m.mood})` : "Mood check-in",
        team: "Mood",
        time: m.created_at
          ? formatDistanceToNow(new Date(m.created_at), { addSuffix: true })
          : "",
        ts,
      });
    }
    rows.sort((a, b) => b.ts - a.ts);
    return rows.slice(0, 8);
  }, [recent]);

  const crisisPreview = useMemo(() => {
    return (recent?.alerts ?? []).slice(0, 3).map((a: any) => ({
      id: a.id,
      type: a.risk_level === "high" || a.risk_level === "critical" ? "warning" : "info",
      message: `${a.risk_level || "Unknown"} risk — ${a.event_type || "Crisis event"}`,
      time: a.created_at
        ? formatDistanceToNow(new Date(a.created_at), { addSuffix: true })
        : "",
    }));
  }, [recent]);

  const totalUsers = stats?.totalUsers ?? 0;
  const activeSessions = stats?.activeSessions ?? 0;
  const todaySessions =
    sessionActivity.length > 0 ? sessionActivity[sessionActivity.length - 1].sessions : 0;
  const avgSession = stats?.avgSessionLength ?? 0;
  const crisisCount = stats?.crisisAlerts ?? 0;
  const engagementPct =
    totalUsers > 0 ? Math.min(100, Math.round((activeSessions / totalUsers) * 100)) : 0;

  const mockedSections: string[] = stats?.mockedSections || [];

  if (loading && !stats) {
    return (
      <AdminLayoutNew>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
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
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
                <Building2 className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Organization Dashboard</h1>
                <p className="text-muted-foreground">
                  {orgLabel} • Live app metrics (platform-wide)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/admin/user-management">
                <Button variant="outline" size="sm">
                  <Users className="w-4 h-4 mr-2" />
                  Manage Users
                </Button>
              </Link>
              <Link to="/admin/settings">
                <Button size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>

        {mockedSections.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Some metrics are estimated or infrastructure placeholders: {mockedSections.join(", ")}.
            Charts and totals below reflect real app usage from the database.
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
          >
            <Card className="p-6 bg-gradient-to-br from-blue-50 to-white border-blue-200 relative overflow-hidden hover:shadow-xl transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                    Total
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-1">Total Users</p>
                <div className="text-3xl font-bold">{totalUsers.toLocaleString()}</div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Target className="w-3 h-3 text-blue-600" />
                  <span>Registered profiles</span>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-6 bg-gradient-to-br from-green-50 to-white border-green-200 relative overflow-hidden hover:shadow-xl transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center">
                    <Activity className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs text-green-600 font-semibold">Live</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-1">Live AI sessions</p>
                <motion.div
                  key={activeSessions}
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  className="text-3xl font-bold"
                >
                  {activeSessions.toLocaleString()}
                </motion.div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Eye className="w-3 h-3 text-green-600" />
                  <span>
                    {totalUsers > 0 ? `${engagementPct}% of users in session` : "No users yet"}
                  </span>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-6 bg-gradient-to-br from-purple-50 to-white border-purple-200 relative overflow-hidden hover:shadow-xl transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-500 flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-white" />
                  </div>
                  <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                    7d
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-1">Sessions today</p>
                <motion.div
                  key={todaySessions}
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  className="text-3xl font-bold"
                >
                  {todaySessions}
                </motion.div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <TrendingUp className="w-3 h-3 text-green-600" />
                  <span>Last day in 7-day trend</span>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="p-6 bg-gradient-to-br from-orange-50 to-white border-orange-200 relative overflow-hidden hover:shadow-xl transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center">
                    <Award className="w-6 h-6 text-white" />
                  </div>
                  <div className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">
                    Safety
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-1">Pending crises</p>
                <div className="text-3xl font-bold">{crisisCount}</div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Star className="w-3 h-3 text-orange-600 fill-orange-600" />
                  <span>Avg session {avgSession} min</span>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Engagement Chart */}
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
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                    Weekly session activity
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    AI sessions and average duration (last 7 days)
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Last 7 Days
                </Button>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={engagementData}>
                  <defs>
                    <linearGradient id="colorSessionsArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorDurationArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
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
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="sessions"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorSessionsArea)"
                    name="Sessions"
                  />
                  <Area
                    type="monotone"
                    dataKey="avgDuration"
                    stroke="#8b5cf6"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorDurationArea)"
                    name="Avg duration (min)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>

          {/* Wellness Outcomes */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-bold text-xl flex items-center gap-2">
                    <Target className="w-5 h-5 text-green-500" />
                    Feature mix
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Relative use of app areas (AI sessions, mood, journal, …)
                  </p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={wellnessMetrics}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {wellnessMetrics.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {wellnessMetrics.map((item, index) => (
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
              <div className="mt-4 p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-green-700 font-medium">
                  AI Sessions reflects live agent usage in the app.
                </p>
              </div>
            </Card>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Team Performance */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-bold text-xl flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-purple-500" />
                    Feature usage
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Normalized share of activity (includes AI agent sessions)
                  </p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={teamPerformance} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" stroke="#6b7280" />
                  <YAxis type="category" dataKey="team" stroke="#6b7280" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="score" fill="#8b5cf6" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-cyan-500" />
                  <h2 className="font-bold text-xl">Recent Activity</h2>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse ml-1" />
                </div>
                <Link to="/admin/activity-monitor">
                  <Button variant="ghost" size="sm">
                    View All
                  </Button>
                </Link>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto">
                {recentActivity.length === 0 && (
                  <p className="text-sm text-muted-foreground py-6 text-center">No recent sessions or moods yet.</p>
                )}
                {recentActivity.map((activity, index) => (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.8 + index * 0.1 }}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                      {activity.user.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{activity.user}</p>
                      <p className="text-xs text-muted-foreground">{activity.action}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                        {activity.team}
                      </span>
                      <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Team Activity Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-bold text-xl flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  Feature overview
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Same metrics as usage cards, tied to live app data
                </p>
              </div>
              <Link to="/admin/team-role-management">
                <Button variant="outline" size="sm">
                  Manage Teams
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {teamActivity.map((team, index) => (
                <motion.div
                  key={team.team}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.9 + index * 0.1 }}
                  className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-lg border border-gray-200 hover:shadow-lg transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm">{team.team}</h3>
                    <Shield className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Members</span>
                      <span className="font-bold">{team.members}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Active Today</span>
                      <span className="font-bold text-green-600">{team.activeToday}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Sessions</span>
                      <span className="font-bold">{team.sessions}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Growth</span>
                      <span className="font-bold text-green-600">{team.growth}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Engagement</span>
                      <span className="font-semibold">{team.engagement}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${team.engagement}%` }}
                        transition={{ delay: 1 + index * 0.1, duration: 1 }}
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Alerts & Notifications */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-orange-500" />
                <h2 className="font-bold text-xl">Notifications & Alerts</h2>
              </div>
              <Link to="/admin/notifications">
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {crisisPreview.length === 0 ? (
                <p className="text-sm text-muted-foreground col-span-full py-4 text-center">
                  No pending crisis events in the latest feed.
                </p>
              ) : (
                crisisPreview.map((alert: { id: string | number; type: string; message: string; time: string }, index: number) => (
                  <motion.div
                    key={String(alert.id)}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.1 + index * 0.1 }}
                    className={`p-4 rounded-lg border-l-4 ${
                      alert.type === "success"
                        ? "bg-green-50 border-green-500"
                        : alert.type === "warning"
                        ? "bg-orange-50 border-orange-500"
                        : "bg-blue-50 border-blue-500"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {alert.type === "success" && (
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      )}
                      {alert.type === "warning" && (
                        <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                      )}
                      {alert.type === "info" && (
                        <MessageSquare className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-sm mb-1">{alert.message}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {alert.time}
                        </p>
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
          <Card className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <h2 className="font-bold text-xl mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-blue-500" />
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <Link to="/admin/user-management">
                <Button variant="outline" className="w-full justify-start gap-2 bg-white hover:bg-gray-50 hover:text-gray-700">
                  <Users className="w-4 h-4" />
                  Users
                </Button>
              </Link>
              <Link to="/admin/team-role-management">
                <Button variant="outline" className="w-full justify-start gap-2 bg-white hover:bg-gray-50 hover:text-gray-700">
                  <Shield className="w-4 h-4" />
                  Teams
                </Button>
              </Link>
              <Link to="/admin/analytics">
                <Button variant="outline" className="w-full justify-start gap-2 bg-white hover:bg-gray-50 hover:text-gray-700">
                  <BarChart3 className="w-4 h-4" />
                  Analytics
                </Button>
              </Link>
              <Link to="/admin/reports-analytics">
                <Button variant="outline" className="w-full justify-start gap-2 bg-white hover:bg-gray-50 hover:text-gray-700">
                  <TrendingUp className="w-4 h-4" />
                  Reports
                </Button>
              </Link>
              <Link to="/admin/support-tickets">
                <Button variant="outline" className="w-full justify-start gap-2 bg-white hover:bg-gray-50 hover:text-gray-700">
                  <MessageSquare className="w-4 h-4" />
                  Support
                </Button>
              </Link>
              <Link to="/admin/system-settings">
                <Button variant="outline" className="w-full justify-start gap-2 bg-white hover:bg-gray-50 hover:text-gray-700">
                  <Settings className="w-4 h-4" />
                  Settings
                </Button>
              </Link>
            </div>
          </Card>
        </motion.div>
      </div>
    </AdminLayoutNew>
  );
}