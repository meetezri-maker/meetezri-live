import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { StatsCard } from "../../components/StatsCard";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import {
  MessageSquare,
  Clock,
  TrendingUp,
  Users,
  Calendar,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { api } from "../../../lib/api";

export function SessionAnalytics() {
  const [statsData, setStatsData] = useState<any | null>(null);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const [stats, recent] = await Promise.all([
          api.admin.getStats(),
          api.admin.getRecentActivity(),
        ]);
        if (!isMounted) {
          return;
        }
        setStatsData(stats);
        setRecentSessions(recent.sessions || []);
      } catch (err: any) {
        console.error("Failed to fetch session analytics", err);
        if (isMounted) {
          setError(err.message || "Failed to load session analytics");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  const totalSessions = statsData?.totalSessions || 0;
  const totalUsers = statsData?.totalUsers || 0;
  const avgSessionLength = statsData?.avgSessionLength || 0;

  const sessionActivity = (statsData?.sessionActivity || []) as any[];

  const sessionTrendData = sessionActivity.map((item: any) => ({
    date: item.day,
    sessions: item.sessions,
  }));

  const sessionsThisWeek = sessionActivity.reduce(
    (sum, item: any) => sum + item.sessions,
    0
  );

  const hourlyActivity = (statsData?.hourlyActivity || []) as any[];

  const sessionDurationData = hourlyActivity.map((item: any) => ({
    range: item.hour,
    count: item.sessions,
  }));

  const statsCards = [
    {
      title: "Total Sessions",
      value: totalSessions.toLocaleString(),
      change: "0.0%",
      changeType: "positive",
      icon: MessageSquare,
      color: "primary",
      delay: 0,
    },
    {
      title: "Avg Duration",
      value: `${avgSessionLength} min`,
      change: "0.0",
      changeType: "positive",
      icon: Clock,
      color: "secondary",
      delay: 0.1,
    },
    {
      title: "Active Users",
      value: totalUsers.toLocaleString(),
      change: "0.0%",
      changeType: "positive",
      icon: Users,
      color: "accent",
      delay: 0.2,
    },
    {
      title: "Sessions This Week",
      value: sessionsThisWeek.toLocaleString(),
      change: "0.0%",
      changeType: "positive",
      icon: TrendingUp,
      color: "success",
      delay: 0.3,
    },
  ];

  const avatarUsageData: { name: string; value: number; color: string }[] = [
    { name: "AI Sessions", value: totalSessions, color: "#9b87f5" },
    { name: "Mood Tracking", value: 0, color: "#7c3aed" },
    { name: "Journal", value: 0, color: "#d946ef" },
    { name: "Other", value: 0, color: "#0ea5e9" },
  ];

  const topicDistributionData = sessionActivity.map((item: any) => ({
    topic: item.day,
    count: item.sessions,
  }));

  const mappedRecentSessions = recentSessions.map((session: any) => {
    const userName =
      session.profiles?.full_name ||
      session.profiles?.email ||
      "Unknown user";
    const duration =
      session.duration_minutes != null
        ? `${session.duration_minutes} min`
        : "N/A";
    const startedAt = session.started_at
      ? new Date(session.started_at)
      : null;
    const timeLabel = startedAt
      ? startedAt.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "";

    return {
      id: session.id,
      user: userName,
      avatar: "AI Companion",
      topic: "Session",
      duration,
      sentiment: "Neutral",
      time: timeLabel,
    };
  });

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
          <h1 className="text-3xl font-bold mb-2">Session Analytics</h1>
          <p className="text-muted-foreground mb-4">
            Failed to load session analytics. Please try again later.
          </p>
          <p className="text-sm text-red-600">{error}</p>
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
          <h1 className="text-3xl font-bold mb-2">Session Analytics</h1>
          <p className="text-muted-foreground">
            Monitor AI session usage patterns and metrics
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statsCards.map((card) => (
            <StatsCard
              key={card.title}
              title={card.title}
              value={card.value}
              change={card.change}
              changeType={card.changeType as "positive" | "negative" | "neutral"}
              icon={card.icon}
              color={card.color as any}
              delay={card.delay}
            />
          ))}
        </div>

        {/* Charts Row 1 */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Session Trend */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">Session Trend (7 Days)</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={sessionTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="sessions"
                    stroke="#9b87f5"
                    strokeWidth={3}
                    dot={{ fill: "#9b87f5", r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>

          {/* Avatar Usage */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">Avatar Preferences</h2>
              <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                  <Pie
                    data={avatarUsageData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name.split(" ")[0]} ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {avatarUsageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Topic Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">Popular Topics</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topicDistributionData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" stroke="#6b7280" />
                  <YAxis dataKey="topic" type="category" stroke="#6b7280" width={100} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="count" fill="#9b87f5" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>

          {/* Session Duration */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">Session Duration Distribution</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sessionDurationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="range" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="count" fill="#7c3aed" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </div>

        {/* Recent Sessions Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card className="overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold">Recent Sessions</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Avatar
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Topic
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Sentiment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {mappedRecentSessions.map((session) => (
                    <tr key={session.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-sm font-bold">
                            {session.user.charAt(0)}
                          </div>
                          <span className="font-medium text-sm">{session.user}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {session.avatar}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {session.topic}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {session.duration}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            session.sentiment === "Positive"
                              ? "bg-green-100 text-green-700"
                              : session.sentiment === "Improved"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {session.sentiment}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {session.time}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      </div>
    </AdminLayoutNew>
  );
}
