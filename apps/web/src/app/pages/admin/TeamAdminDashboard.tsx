import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { motion } from "motion/react";
import {
  Users,
  UserCheck,
  Activity,
  TrendingUp,
  Shield,
  Star,
  Clock,
  MessageSquare,
  CheckCircle2,
  Target,
  Award,
  Eye,
  Heart,
  Calendar,
  ArrowUpRight,
  Settings,
  BarChart3,
  AlertCircle,
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export function TeamAdminDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [recent, setRecent] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [s, r, u] = await Promise.all([
          api.admin.getStats(),
          api.admin.getRecentActivity(),
          api.admin.getUsers(),
        ]);
        if (!cancelled) {
          setStats(s);
          setRecent(r);
          setUsers(Array.isArray(u) ? u.slice(0, 5) : []);
        }
      } catch (e) {
        console.error("Team admin dashboard load failed", e);
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

  const sessionActivity = (stats?.sessionActivity || []) as {
    day: string;
    sessions: number;
    duration: number;
  }[];

  const weeklyActivity = useMemo(
    () =>
      sessionActivity.map((d) => ({
        day: d.day,
        sessions: d.sessions,
        avgDuration: d.duration,
      })),
    [sessionActivity]
  );

  const featureUsage = (stats?.featureUsage || []) as { feature: string; usage: number }[];

  const wellnessScores = useMemo(
    () => featureUsage.slice(0, 6).map((f) => ({ category: f.feature, score: f.usage })),
    [featureUsage]
  );

  const teamMembers = useMemo(() => {
    return users.map((u) => ({
      id: u.id as string,
      name: u.full_name || u.email || "User",
      status: u.status === "active" ? "active" : "away",
      sessions: u.session_count ?? 0,
      lastActive: u.last_active
        ? formatDistanceToNow(new Date(u.last_active), { addSuffix: true })
        : "—",
      progress: u.risk_level === "high" ? 60 : u.risk_level === "medium" ? 75 : 85,
    }));
  }, [users]);

  const recentAlerts = useMemo(() => {
    const fromCrisis = (recent?.alerts ?? []).slice(0, 4).map((a: any) => ({
      id: a.id,
      type: a.risk_level === "high" ? "warning" : "info",
      message: `${a.risk_level || "Risk"} — ${a.event_type || "Crisis"}`,
      time: a.created_at
        ? formatDistanceToNow(new Date(a.created_at), { addSuffix: true })
        : "",
    }));
    if (fromCrisis.length > 0) return fromCrisis;
    return [
      {
        id: "m1",
        type: "info",
        message: `Total AI sessions (app): ${stats?.totalSessions ?? 0}`,
        time: "Live stats",
      },
    ];
  }, [recent, stats]);

  const milestones = useMemo(() => {
    const ts = stats?.totalSessions ?? 0;
    const live = stats?.activeSessions ?? 0;
    const crisis = stats?.crisisAlerts ?? 0;
    return [
      {
        title: `${ts.toLocaleString()} total AI sessions (platform)`,
        achieved: ts > 0,
        date: "App data",
        progress: ts > 0 ? 100 : 0,
      },
      {
        title: `${live} live AI sessions now`,
        achieved: live > 0,
        date: "Live",
        progress: live > 0 ? 100 : 0,
      },
      {
        title: crisis === 0 ? "No pending crisis events" : `${crisis} crisis event(s) pending`,
        achieved: crisis === 0,
        date: crisis === 0 ? "Clear" : "Needs review",
        progress: Math.min(100, crisis * 10),
      },
    ];
  }, [stats]);

  const totalUsers = stats?.totalUsers ?? 0;
  const activeSessions = stats?.activeSessions ?? 0;
  const todaySessions =
    sessionActivity.length > 0 ? sessionActivity[sessionActivity.length - 1].sessions : 0;
  const mockedSections: string[] = stats?.mockedSections || [];

  const teamInfo = {
    name: "Team",
    organization: profile?.full_name || profile?.email || "Team admin",
    members: totalUsers,
    activeMembers: activeSessions,
    role: "Team Admin",
    since: "Live",
  };

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
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Team Dashboard</h1>
                <p className="text-muted-foreground">
                  {teamInfo.organization} • Live app metrics (platform-wide)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/admin/team-role-management">
                <Button variant="outline" size="sm">
                  <Users className="w-4 h-4 mr-2" />
                  Manage Team
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
            Some metrics are estimated: {mockedSections.join(", ")}. Session and user counts are from live data.
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
          >
            <Card className="p-6 bg-gradient-to-br from-cyan-50 to-white border-cyan-200 relative overflow-hidden hover:shadow-xl transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500 flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div className="px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-xs font-semibold">
                    Total
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-1">Total users</p>
                <div className="text-3xl font-bold">{teamInfo.members.toLocaleString()}</div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <UserCheck className="w-3 h-3 text-cyan-600" />
                  <span>Profiles in app</span>
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
                  {activeSessions}
                </motion.div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Eye className="w-3 h-3 text-green-600" />
                  <span>Active agent conversations</span>
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
                    <Heart className="w-6 h-6 text-white" />
                  </div>
                  <div className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">
                    Avg
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-1">Avg session length</p>
                <div className="text-3xl font-bold">{stats?.avgSessionLength ?? 0} min</div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Star className="w-3 h-3 text-orange-600 fill-orange-600" />
                  <span>{stats?.crisisAlerts ?? 0} pending crises</span>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Weekly Activity Chart */}
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
                    <BarChart3 className="w-5 h-5 text-cyan-500" />
                    Weekly Activity Breakdown
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
                <BarChart data={weeklyActivity}>
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
                  <Bar dataKey="sessions" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Sessions" />
                  <Bar dataKey="avgDuration" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Avg duration (min)" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>

          {/* Wellness Radar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-bold text-xl flex items-center gap-2">
                    <Target className="w-5 h-5 text-purple-500" />
                    App feature mix
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Includes AI agent sessions vs other features
                  </p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={wellnessScores.length ? wellnessScores : [{ category: "No data", score: 0 }]}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="category" stroke="#6b7280" />
                  <PolarRadiusAxis stroke="#6b7280" />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke="#8b5cf6"
                    fill="#8b5cf6"
                    fillOpacity={0.6}
                  />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </div>

        {/* Team Members */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-bold text-xl flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  Team Members
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Current status and activity
                </p>
              </div>
              <Link to="/admin/user-management">
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {teamMembers.length === 0 && (
                <p className="text-sm text-muted-foreground col-span-full py-6 text-center">
                  No users returned yet — open User Management to browse the full directory.
                </p>
              )}
              {teamMembers.map((member, index) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                  className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-lg border border-gray-200 hover:shadow-lg transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white font-bold">
                        {(member.name || "U")
                          .split(/\s+/)
                          .filter(Boolean)
                          .map((n: string) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                        member.status === "active" ? "bg-green-500" : "bg-gray-400"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.lastActive}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Sessions</span>
                      <span className="font-bold">{member.sessions}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-bold text-green-600">{member.progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${member.progress}%` }}
                        transition={{ delay: 0.8 + index * 0.1, duration: 1 }}
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Team Milestones */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-yellow-500" />
                  <h2 className="font-bold text-xl">Team Milestones</h2>
                </div>
              </div>

              <div className="space-y-4">
                {milestones.map((milestone, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.9 + index * 0.1 }}
                    className={`p-4 rounded-lg border-l-4 ${
                      milestone.achieved
                        ? "bg-green-50 border-green-500"
                        : "bg-blue-50 border-blue-500"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {milestone.achieved ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : (
                            <Target className="w-5 h-5 text-blue-600" />
                          )}
                          <p className="font-medium text-sm">{milestone.title}</p>
                        </div>
                        {milestone.achieved ? (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Achieved {milestone.date}
                          </p>
                        ) : (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-muted-foreground">Progress</span>
                              <span className="font-semibold">{milestone.progress}%</span>
                            </div>
                            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${milestone.progress}%` }}
                                transition={{ delay: 1 + index * 0.1, duration: 1 }}
                                className="h-full bg-blue-500"
                              />
                            </div>
                          </div>
                        )}
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
            transition={{ delay: 0.9 }}
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-orange-500" />
                  <h2 className="font-bold text-xl">Notifications</h2>
                </div>
                <Link to="/admin/notifications">
                  <Button variant="ghost" size="sm">
                    View All
                  </Button>
                </Link>
              </div>

              <div className="space-y-3">
                {recentAlerts.map((alert: { id: string | number; type: string; message: string; time: string }, index: number) => (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1 + index * 0.1 }}
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
                        <TrendingUp className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
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
                ))}
              </div>

              <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-blue-900">Team Performance</p>
                    <p className="text-xs text-blue-700 mt-1">Exceeding monthly targets</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-blue-600" />
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
        >
          <Card className="p-6 bg-gradient-to-br from-cyan-50 to-blue-50 border-cyan-200">
            <h2 className="font-bold text-xl mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-cyan-500" />
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <Link to="/admin/user-management">
                <Button variant="outline" className="w-full justify-start gap-2 bg-white hover:bg-gray-50 hover:text-gray-700">
                  <Users className="w-4 h-4" />
                  Members
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
            </div>
          </Card>
        </motion.div>
      </div>
    </AdminLayoutNew>
  );
}