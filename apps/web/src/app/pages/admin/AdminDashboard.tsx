
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { StatsCard } from "../../components/StatsCard";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { motion } from "motion/react";
import {
  Users,
  MessageSquare,
  AlertTriangle,
  TrendingUp,
  Activity,
  Clock,
  ArrowRight,
  CheckCircle2,
  Smile,
} from "lucide-react";
import { Link } from "react-router";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

export function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, activityData] = await Promise.all([
          api.admin.getStats(),
          api.admin.getRecentActivity()
        ]);
        setStats(statsData);
        setRecentActivity(activityData);
      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <AdminLayoutNew>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayoutNew>
    );
  }

  const recentAlerts = recentActivity?.alerts || [];
  const recentSessions = recentActivity?.sessions || [];
  const recentMoods = recentActivity?.moodEntries || [];

  return (
    <AdminLayoutNew>
      <div className="space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's what's happening with Ezri today.
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Total Users"
            value={stats?.totalUsers?.toLocaleString() || "0"}
            change="+12.5%" // You might want to calculate this real change later
            changeType="positive"
            icon={Users}
            color="primary"
            delay={0}
          />
          <StatsCard
            title="Active Sessions"
            value={stats?.activeSessions?.toLocaleString() || "0"}
            change="Live"
            changeType="positive"
            icon={MessageSquare}
            color="secondary"
            delay={0.1}
          />
          <StatsCard
            title="Crisis Alerts"
            value={stats?.crisisAlerts?.toLocaleString() || "0"}
            change={stats?.crisisAlerts > 0 ? "Requires Attention" : "All Good"}
            changeType={stats?.crisisAlerts > 0 ? "negative" : "positive"}
            icon={AlertTriangle}
            color="warning"
            delay={0.2}
          />
          <StatsCard
            title="Avg Session Time"
            value={`${stats?.avgSessionLength || 0} min`}
            change="Average"
            changeType="positive"
            icon={Clock}
            color="accent"
            delay={0.3}
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Alerts */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="p-6 h-full">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold mb-1">Recent Alerts</h2>
                  <p className="text-sm text-muted-foreground">
                    Requires immediate attention
                  </p>
                </div>
                <Link to="/admin/crisis-dashboard">
                  <Button variant="outline" size="sm" className="gap-2">
                    View All
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>

              <div className="space-y-4">
                {recentAlerts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No active alerts.</p>
                ) : (
                  recentAlerts.map((alert: any, index: number) => (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + index * 0.1 }}
                      className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 hover:border-primary/50 transition-colors group"
                    >
                      <div
                        className={`w-2 h-2 rounded-full mt-2 ${
                          alert.status === "pending"
                            ? "bg-red-500 animate-pulse"
                            : "bg-green-500"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="font-medium text-sm">{alert.profiles?.full_name || 'Unknown User'}</p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {alert.risk_level} risk - {alert.event_type}
                        </p>
                      </div>
                      <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.div>
                  ))
                )}
              </div>
            </Card>
          </motion.div>

          {/* Recent Mood Check-ins */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="p-6 h-full">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold mb-1">Recent Mood Check-ins</h2>
                  <p className="text-sm text-muted-foreground">
                    Latest user moods
                  </p>
                </div>
                <Button variant="outline" size="sm" className="gap-2">
                  View All
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-4">
                {recentMoods.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No mood entries yet.</p>
                ) : (
                recentMoods.map((mood: any, index: number) => (
                  <motion.div
                    key={mood.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + index * 0.1 }}
                    className="flex items-center gap-4 p-4 rounded-lg border border-gray-200 hover:border-primary/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-sm">
                      <Smile className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm mb-1">{mood.profiles?.full_name || 'Anonymous'}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {mood.mood} • Intensity: {mood.intensity}/10
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {new Date(mood.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </motion.div>
                )))}
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link to="/admin/user-management">
                <motion.div
                  whileHover={{ y: -4 }}
                  className="p-4 rounded-lg border border-gray-200 hover:border-primary transition-colors text-center group"
                >
                  <Users className="w-8 h-8 mx-auto mb-2 text-primary group-hover:scale-110 transition-transform" />
                  <p className="font-medium text-sm">Manage Users</p>
                </motion.div>
              </Link>
              <Link to="/admin/crisis-dashboard">
                <motion.div
                  whileHover={{ y: -4 }}
                  className="p-4 rounded-lg border border-gray-200 hover:border-primary transition-colors text-center group"
                >
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-warning group-hover:scale-110 transition-transform" />
                  <p className="font-medium text-sm">Crisis Monitor</p>
                </motion.div>
              </Link>
              <Link to="/admin/reports-analytics">
                <motion.div
                  whileHover={{ y: -4 }}
                  className="p-4 rounded-lg border border-gray-200 hover:border-primary transition-colors text-center group"
                >
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 text-secondary group-hover:scale-110 transition-transform" />
                  <p className="font-medium text-sm">View Reports</p>
                </motion.div>
              </Link>
              <Link to="/admin/notifications-center">
                <motion.div
                  whileHover={{ y: -4 }}
                  className="p-4 rounded-lg border border-gray-200 hover:border-primary transition-colors text-center group"
                >
                  <Activity className="w-8 h-8 mx-auto mb-2 text-accent group-hover:scale-110 transition-transform" />
                  <p className="font-medium text-sm">Send Alert</p>
                </motion.div>
              </Link>
            </div>
          </Card>
        </motion.div>
      </div>
    </AdminLayoutNew>
  );
}
