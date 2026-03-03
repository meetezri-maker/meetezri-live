import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { ArrowLeft, Mail, Phone, Calendar, Activity, MessageSquare, Heart, AlertTriangle, Ban, CheckCircle2, Clock, MapPin, Shield, Star, TrendingUp, TrendingDown, Edit, Trash2, Key, Send, Download, Eye, EyeOff, User, CreditCard, Bell, Settings, Moon, Sun } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../../lib/api";

export function UserDetailsEnhanced() {
  const { userId } = useParams<{ userId: string }>();
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"overview" | "activity" | "sessions" | "security">("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [userData, setUserData] = useState<any>(null);
  const [activityTimeline, setActivityTimeline] = useState<any[]>([]);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  useEffect(() => {
    async function fetchData() {
      if (!userId) return;
      
      try {
        setLoading(true);
        // Fetch user profile
        const userProfile = await api.admin.getUserProfile(userId);
        
        // Fetch related data
        const [sessions, moods, journals, sleep, habits, auditLogs, subscription] = await Promise.all([
          api.sessions.getUserSessions(userId).catch(() => []),
          api.moods.getUserMoods(userId).catch(() => []),
          api.journal.getUserJournals(userId).catch(() => []),
          api.sleep.getUserEntries(userId).catch(() => []),
          api.habits.getUserHabits(userId).catch(() => []),
          api.admin.getUserAuditLogs(userId).catch(() => []),
          api.admin.getUserSubscription(userId).catch(() => null)
        ]);
        
        // Calculate stats
        const totalDuration = sessions.reduce((acc: number, s: any) => acc + (s.duration_minutes || 0), 0);
        const avgDuration = sessions.length ? Math.round(totalDuration / sessions.length) : 0;
        
        const completedSessions = sessions.filter((s: any) => s.status === 'completed').length;
        const completionRate = sessions.length ? Math.round((completedSessions / sessions.length) * 100) : 0;

        // Process user data
        const processedUser = {
          id: userProfile.id,
          name: userProfile.full_name || userProfile.email?.split('@')[0] || "Unknown User",
          email: userProfile.email || "No Email",
          phone: userProfile.phone || "Not set",
          avatar: userProfile.full_name?.[0] || userProfile.email?.[0] || "U",
          status: userProfile.status || "active",
          riskLevel: userProfile.riskLevel || "low", // Assuming backend might return this or we default
          subscription: subscription?.plan_type || "trial",
          organization: userProfile.organization || "Individual",
          joinDate: new Date(userProfile.created_at).toLocaleDateString(),
          lastActive: new Date(userProfile.updated_at).toLocaleDateString(), // Proxy for last active
          location: userProfile.timezone || "Unknown Location",
          timezone: userProfile.timezone || "UTC",
          preferredAvatar: userProfile.selected_avatar || "Not set",
          totalSessions: userProfile.stats?.total_sessions || sessions.length || 0,
          avgSessionDuration: `${avgDuration} min`,
          completionRate: `${completionRate}%`,
          avgMoodScore: calculateAvgMood(moods),
          journalEntries: userProfile.stats?.journal_entries || journals.length || 0,
          wellnessStreak: (userProfile.stats?.mood_entries || 0) + (habits.length > 0 ? habits.length : 0), // Improved proxy
          sleepEntries: sleep.length || 0,
          habitsCount: habits.length || 0
        };
        
        setUserData(processedUser);
        setRecentSessions(sessions);
        setSecurityLogs(auditLogs);
        
        // Build timeline
        const timeline = [
          ...sessions.map((s: any) => ({
            id: s.id,
            type: "session",
            title: "Session",
            description: `${s.type} session`,
            time: new Date(s.created_at).toLocaleString(),
            timestamp: new Date(s.created_at).getTime(),
            icon: MessageSquare,
            color: "text-blue-600",
            bg: "bg-blue-100"
          })),
          ...moods.map((m: any) => ({
            id: m.id,
            type: "mood",
            title: "Mood Check-in",
            description: `Mood: ${m.mood} (${m.intensity}/10)`,
            time: new Date(m.created_at).toLocaleString(),
            timestamp: new Date(m.created_at).getTime(),
            icon: Heart,
            color: "text-pink-600",
            bg: "bg-pink-100"
          })),
          ...journals.map((j: any) => ({
            id: j.id,
            type: "journal",
            title: "Journal Entry",
            description: j.title || "Untitled Entry",
            time: new Date(j.created_at).toLocaleString(),
            timestamp: new Date(j.created_at).getTime(),
            icon: Edit,
            color: "text-purple-600",
            bg: "bg-purple-100"
          })),
          ...sleep.map((s: any) => ({
            id: s.id,
            type: "sleep",
            title: "Sleep Log",
            description: `Sleep Quality: ${s.quality_rating || 'N/A'}/5`,
            time: new Date(s.created_at).toLocaleString(),
            timestamp: new Date(s.created_at).getTime(),
            icon: Moon,
            color: "text-indigo-600",
            bg: "bg-indigo-100"
          })),
          // Assuming habits have a created_at or we want to show them as "Habit Active"
          // If we had completion history for habits, we'd add it here. 
          // For now, we'll just list the habits themselves as 'Created Habit' events if we use created_at
          ...habits.map((h: any) => ({
            id: h.id,
            type: "habit",
            title: "Habit Created",
            description: `Habit: ${h.name}`,
            time: new Date(h.created_at).toLocaleString(),
            timestamp: new Date(h.created_at).getTime(),
            icon: CheckCircle2,
            color: "text-teal-600",
            bg: "bg-teal-100"
          }))
        ].sort((a, b) => b.timestamp - a.timestamp);
        
        setActivityTimeline(timeline);
        
      } catch (err: any) {
        console.error("Error fetching user details:", err);
        setError(err.message || "Failed to load user details");
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [userId]);

  const calculateAvgMood = (moods: any[]) => {
    if (!moods.length) return 0;
    const sum = moods.reduce((acc, curr) => acc + (curr.intensity || 0), 0);
    return (sum / moods.length).toFixed(1);
  };

  const handleAction = (action: string) => {
    if (!userData) return;

    const performAction = async () => {
      try {
        if (action === "reset-password") {
          const subject = "Reset your Ezri password";
          const text = `Hello ${userData.name},\n\nAn admin has requested a password reset for your Ezri account. If this was not you, please contact support.`;
          const html = `<p>Hello ${userData.name},</p><p>An admin has requested a password reset for your Ezri account. If this was not you, please contact support.</p>`;
          await api.sendEmail(userData.email, subject, html, text);
        } else if (action === "send-message") {
          const subject = "Message from Ezri Admin";
          const text = `Hello ${userData.name},\n\nYou have received a message from the Ezri admin team.`;
          const html = `<p>Hello ${userData.name},</p><p>You have received a message from the Ezri admin team.</p>`;
          await api.sendEmail(userData.email, subject, html, text);
        } else if (action === "export-data") {
          const blob = await api.exportUserData();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `ezri-user-${userData.id}-data.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        } else if (action === "suspend") {
          await api.admin.updateUser(userData.id, { status: "suspended" });
          setUserData((prev: any) =>
            prev ? { ...prev, status: "suspended" } : prev
          );
        } else if (action === "delete") {
          await api.admin.deleteUser(userData.id);
          window.location.href = "/admin/user-management";
        }
        setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
      } catch (err) {
        console.error("Failed to perform action", err);
        setConfirmationModal({
          isOpen: true,
          title: "Error",
          message: "Failed to perform action. Please try again.",
          onConfirm: () =>
            setConfirmationModal((prev) => ({
              ...prev,
              isOpen: false,
            })),
        });
      }
    };

    let title = "";
    let message = "";

    if (action === "reset-password") {
      title = "Reset Password";
      message = `Send a password reset email to ${userData.name}?`;
    } else if (action === "send-message") {
      title = "Send Message";
      message = `Send a message email to ${userData.name}?`;
    } else if (action === "export-data") {
      title = "Export Data";
      message = `Export all data for ${userData.name}?`;
    } else if (action === "suspend") {
      title = "Suspend Account";
      message = `Suspend ${userData.name}'s account?`;
    } else if (action === "delete") {
      title = "Delete Account";
      message = `Permanently delete ${userData.name}'s account and profile?`;
    }

    setShowActionMenu(false);
    setConfirmationModal({
      isOpen: true,
      title,
      message,
      onConfirm: performAction,
    });
  };
  
  const statsCards = userData ? [
    { label: "Total Sessions", value: userData.totalSessions.toString(), icon: MessageSquare, color: "text-blue-600", bg: "bg-blue-100" },
    { label: "Mood Score", value: `${userData.avgMoodScore}/10`, icon: Heart, color: "text-pink-600", bg: "bg-pink-100" },
    { label: "Wellness Streak", value: `${userData.wellnessStreak} entries`, icon: TrendingUp, color: "text-green-600", bg: "bg-green-100" },
    { label: "Journal Entries", value: userData.journalEntries.toString(), icon: Edit, color: "text-purple-600", bg: "bg-purple-100" },
  ] : [];

  const tabs = [
    { id: "overview", label: "Overview", icon: User },
    { id: "activity", label: "Activity", icon: Activity },
    { id: "sessions", label: "Sessions", icon: MessageSquare },
    { id: "security", label: "Security", icon: Shield },
  ];

  if (loading) {
    return (
      <AdminLayoutNew>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayoutNew>
    );
  }

  if (error || !userData) {
    return (
      <AdminLayoutNew>
        <div className="flex flex-col items-center justify-center h-96 space-y-4">
          <AlertTriangle className="h-12 w-12 text-red-500" />
          <h2 className="text-xl font-bold">Error Loading User</h2>
          <p className="text-muted-foreground">{error || "User not found"}</p>
          <Link to="/admin/user-management">
            <Button>Back to Users</Button>
          </Link>
        </div>
      </AdminLayoutNew>
    );
  }

  return (
    <AdminLayoutNew>
      <div className="space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <Link to="/admin/user-management">
            <Button variant="ghost" className="gap-2 mb-4">
              <ArrowLeft className="w-4 h-4" />
              Back to Users
            </Button>
          </Link>

          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-3xl font-bold shadow-lg"
              >
                {userData.avatar}
              </motion.div>
              <div>
                <h1 className="text-3xl font-bold mb-1">{userData.name}</h1>
                <p className="text-muted-foreground mb-2">{userData.email}</p>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    userData.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}>
                    {userData.status}
                  </span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium capitalize">
                    {userData.subscription}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                    userData.riskLevel === "low" ? "bg-green-100 text-green-700" :
                    userData.riskLevel === "medium" ? "bg-yellow-100 text-yellow-700" :
                    "bg-red-100 text-red-700"
                  }`}>
                    {userData.riskLevel} Risk
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => handleAction("send-message")}
              >
                <Mail className="w-4 h-4" />
                Email
              </Button>
              <Button variant="outline" className="gap-2">
                <Edit className="w-4 h-4" />
                Edit
              </Button>
              <div className="relative">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => setShowActionMenu(!showActionMenu)}
                >
                  <Settings className="w-4 h-4" />
                  Actions
                </Button>
                <AnimatePresence>
                  {showActionMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 top-12 w-56 bg-white rounded-lg shadow-xl border z-50"
                    >
                      <div className="py-2">
                        <button
                          onClick={() => handleAction("reset-password")}
                          className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Key className="w-4 h-4" />
                          Reset Password
                        </button>
                        <button
                          onClick={() => handleAction("send-message")}
                          className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Send className="w-4 h-4" />
                          Send Message
                        </button>
                        <button
                          onClick={() => handleAction("export-data")}
                          className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Export Data
                        </button>
                        <div className="border-t my-2" />
                        <button
                          onClick={() => handleAction("suspend")}
                          className="w-full px-4 py-2 text-left hover:bg-red-50 text-red-600 flex items-center gap-2"
                        >
                          <Ban className="w-4 h-4" />
                          Suspend Account
                        </button>
                        <button
                          onClick={() => handleAction("delete")}
                          className="w-full px-4 py-2 text-left hover:bg-red-50 text-red-600 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete Account
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {statsCards.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-lg ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="border-b">
            <div className="flex gap-4">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                    selectedTab === tab.id
                      ? "border-primary text-primary font-medium"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {selectedTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid lg:grid-cols-2 gap-6"
            >
              {/* User Information */}
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  User Information
                </h2>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Full Name</p>
                    <p className="font-medium">{userData.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Email</p>
                    <p className="font-medium">{userData.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Phone</p>
                    <p className="font-medium">{userData.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Organization</p>
                    <p className="font-medium">{userData.organization}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Location</p>
                    <p className="font-medium flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      {userData.location}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Timezone</p>
                    <p className="font-medium">{userData.timezone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Join Date</p>
                    <p className="font-medium flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      {userData.joinDate}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Last Active</p>
                    <p className="font-medium flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      {userData.lastActive}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Preferred Avatar</p>
                    <p className="font-medium">{userData.preferredAvatar}</p>
                  </div>
                </div>
              </Card>

              {/* Performance Metrics */}
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Performance Metrics
                </h2>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-muted-foreground">Avg Session Duration</p>
                      <p className="font-bold text-blue-600">{userData.avgSessionDuration}</p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: "0%" }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-muted-foreground">Completion Rate</p>
                      <p className="font-bold text-green-600">{userData.completionRate}</p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-green-600 h-2 rounded-full" style={{ width: "0%" }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-muted-foreground">Avg Mood Score</p>
                      <p className="font-bold text-pink-600">{userData.avgMoodScore}/10</p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-pink-600 h-2 rounded-full" style={{ width: `${(userData.avgMoodScore / 10) * 100}%` }} />
                    </div>
                  </div>

                  <div className="pt-4 space-y-3">
                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                      <span className="text-sm font-medium">Journal Entries</span>
                      <span className="font-bold text-purple-600">{userData.journalEntries}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <span className="text-sm font-medium">Wellness Streak</span>
                      <span className="font-bold text-green-600">{userData.wellnessStreak} entries</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                      <span className="text-sm font-medium">Risk Assessment</span>
                      <span className="font-bold text-green-600 capitalize">{userData.riskLevel}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {selectedTab === "activity" && (
            <motion.div
              key="activity"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  Activity Timeline
                </h2>
                <div className="space-y-4">
                  {activityTimeline.length > 0 ? activityTimeline.map((activity, index) => (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex gap-4 relative"
                    >
                      {index !== activityTimeline.length - 1 && (
                        <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-gray-200" />
                      )}
                      <div className={`w-10 h-10 rounded-full ${activity.bg} flex items-center justify-center flex-shrink-0 relative z-10`}>
                        <activity.icon className={`w-5 h-5 ${activity.color}`} />
                      </div>
                      <div className="flex-1 pb-6">
                        <div className="flex items-start justify-between mb-1">
                          <p className="font-medium">{activity.title}</p>
                          <span className="text-xs text-muted-foreground">{activity.time}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{activity.description}</p>
                      </div>
                    </motion.div>
                  )) : (
                    <div className="text-center py-8 text-muted-foreground">No recent activity</div>
                  )}
                </div>
              </Card>
            </motion.div>
          )}

          {selectedTab === "sessions" && (
            <motion.div
              key="sessions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  Recent Sessions
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-sm text-muted-foreground">
                        <th className="pb-3 pl-4">Date</th>
                        <th className="pb-3">Type</th>
                        <th className="pb-3">Duration</th>
                        <th className="pb-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentSessions.length > 0 ? recentSessions.map((session: any) => (
                        <tr key={session.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-4 pl-4">{new Date(session.created_at).toLocaleDateString()}</td>
                          <td className="py-4 capitalize">{session.type}</td>
                          <td className="py-4">{session.duration_minutes || session.duration || 0} min</td>
                          <td className="py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              session.status === 'completed' ? 'bg-green-100 text-green-700' :
                              session.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {session.status || 'Scheduled'}
                            </span>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={4} className="text-center py-8 text-muted-foreground">No sessions found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          )}

          {selectedTab === "security" && (
            <motion.div
              key="security"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Security Events
                </h2>
                <div className="space-y-4">
                  {securityLogs.length > 0 ? securityLogs.map((log: any) => (
                    <div key={log.id} className="flex items-start justify-between p-4 border rounded-lg">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                          <Key className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium">{log.action}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            {log.details?.device && <span>{log.details.device}</span>}
                            {log.details?.device && <span>•</span>}
                            {log.details?.ip_address && <span>{log.details.ip_address}</span>}
                            {!log.details?.device && !log.details?.ip_address && <span>No details available</span>}
                          </div>
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                  )) : (
                    <div className="text-center py-8 text-muted-foreground">No security events found</div>
                  )}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <ConfirmationModal
        isOpen={confirmationModal.isOpen}
        onClose={() =>
          setConfirmationModal({ ...confirmationModal, isOpen: false })
        }
        onConfirm={confirmationModal.onConfirm}
        title={confirmationModal.title}
        message={confirmationModal.message}
      />
    </AdminLayoutNew>
  );
}
