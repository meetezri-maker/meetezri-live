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
import { useState, useEffect } from "react";
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
  const [activeMembers, setActiveMembers] = useState(38);
  const [todaySessions, setTodaySessions] = useState(28);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveMembers(prev => Math.min(45, prev + (Math.random() > 0.5 ? 1 : 0)));
      setTodaySessions(prev => prev + (Math.random() > 0.6 ? 1 : 0));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const teamInfo = {
    name: "Clinical Support Team",
    organization: "HealthCare Corp",
    members: 45,
    activeMembers: 38,
    role: "Team Admin",
    since: "Mar 2024",
  };

  const weeklyActivity = [
    { day: "Mon", sessions: 32, checkins: 28, journals: 15 },
    { day: "Tue", sessions: 38, checkins: 34, journals: 18 },
    { day: "Wed", sessions: 29, checkins: 26, journals: 12 },
    { day: "Thu", sessions: 42, checkins: 38, journals: 22 },
    { day: "Fri", sessions: 36, checkins: 32, journals: 19 },
    { day: "Sat", sessions: 24, checkins: 20, journals: 10 },
    { day: "Sun", sessions: 21, checkins: 18, journals: 8 },
  ];

  const memberEngagement = [
    { name: "Active Daily", value: 24 },
    { name: "Active Weekly", value: 14 },
    { name: "Inactive", value: 7 },
  ];

  const wellnessScores = [
    { category: "Mood", score: 85 },
    { category: "Engagement", score: 92 },
    { category: "Consistency", score: 78 },
    { category: "Progress", score: 88 },
    { category: "Satisfaction", score: 90 },
  ];

  const teamMembers = [
    { name: "Sarah Johnson", status: "active", sessions: 12, lastActive: "2m ago", progress: 85 },
    { name: "Mike Chen", status: "active", sessions: 15, lastActive: "15m ago", progress: 92 },
    { name: "Emma Wilson", status: "active", sessions: 8, lastActive: "1h ago", progress: 78 },
    { name: "David Brown", status: "away", sessions: 10, lastActive: "4h ago", progress: 82 },
    { name: "Lisa Anderson", status: "active", sessions: 14, lastActive: "30m ago", progress: 88 },
  ];

  const recentAlerts = [
    {
      id: 1,
      type: "success",
      message: "5 members completed weekly check-in",
      time: "1 hour ago",
    },
    {
      id: 2,
      type: "info",
      message: "Team engagement up 12% this week",
      time: "3 hours ago",
    },
    {
      id: 3,
      type: "warning",
      message: "2 members need follow-up",
      time: "5 hours ago",
    },
  ];

  const milestones = [
    { title: "100 Sessions Completed", achieved: true, date: "Yesterday" },
    { title: "90% Weekly Engagement", achieved: true, date: "3 days ago" },
    { title: "Team Wellness Goal", achieved: false, progress: 85 },
  ];

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
                  {teamInfo.name} • {teamInfo.organization} • {teamInfo.members} Members
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
                <p className="text-sm text-muted-foreground mb-1">Team Members</p>
                <div className="text-3xl font-bold">{teamInfo.members}</div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <UserCheck className="w-3 h-3 text-cyan-600" />
                  <span>Full team strength</span>
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
                <p className="text-sm text-muted-foreground mb-1">Active Now</p>
                <motion.div
                  key={activeMembers}
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  className="text-3xl font-bold"
                >
                  {activeMembers}
                </motion.div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Eye className="w-3 h-3 text-green-600" />
                  <span>84% engagement rate</span>
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
                    +18%
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-1">Today's Sessions</p>
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
                  <span>Above target</span>
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
                    Excellent
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-1">Team Wellness</p>
                <div className="text-3xl font-bold">87%</div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Star className="w-3 h-3 text-orange-600 fill-orange-600" />
                  <span>Up from 82% last week</span>
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
                    Sessions, check-ins, and journal entries
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
                  <Bar dataKey="checkins" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Check-ins" />
                  <Bar dataKey="journals" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Journals" />
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
                    Wellness Scores
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Team performance metrics
                  </p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={wellnessScores}>
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
              {teamMembers.map((member, index) => (
                <motion.div
                  key={member.name}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                  className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-lg border border-gray-200 hover:shadow-lg transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white font-bold">
                        {member.name.split(" ").map(n => n[0]).join("")}
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
                {recentAlerts.map((alert, index) => (
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