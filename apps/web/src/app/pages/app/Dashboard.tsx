import { AppLayout } from "../../components/AppLayout";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/skeleton";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Video, Heart, BookOpen, TrendingUp, Calendar, Sparkles, ArrowRight, Award, Target, Flame, Clock, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import { WellnessChallenges } from "../../components/WellnessChallenges";
import { PWAInstallPrompt } from "../../components/PWAInstallPrompt";
import { useAuth } from "@/app/contexts/AuthContext";
import { api } from "../../../lib/api";

interface BackendSession {
  id: string;
  status: string;
  type: string;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  config: any;
  created_at: string;
}

export function Dashboard() {
  const { profile, refreshProfile } = useAuth();
  const [upcomingSessionsCount, setUpcomingSessionsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const moodEmojis: Record<string, string> = {
    "Happy": "😊",
    "Calm": "😌",
    "Excited": "🤩",
    "Anxious": "😰",
    "Sad": "😢",
    "Angry": "😡"
  };

  const getMoodEmoji = (mood: string) => {
    if (!mood) return "😐";
    // If it's already an emoji
    if (Object.values(moodEmojis).includes(mood)) return mood;
    
    // Case-insensitive lookup
    const entry = Object.entries(moodEmojis).find(([label]) => label.toLowerCase() === mood.toLowerCase());
    return entry ? entry[1] : "😐"; // Default to neutral face if not found
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        await refreshProfile();
        const sessions = await api.sessions.list({ status: "scheduled" });
        const now = new Date();
        const nonExpired = (sessions as BackendSession[]).filter((session) => {
          const scheduledDate = session.scheduled_at ? new Date(session.scheduled_at) : null;
          if (!scheduledDate) return false;
          return scheduledDate.getTime() >= now.getTime() && session.status === "scheduled";
        });
        setUpcomingSessionsCount(nonExpired.length);
      } catch (error) {
        console.error("Failed to fetch upcoming sessions", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const firstName = profile?.full_name?.split(" ")[0] || "Friend";
  const currentMood = profile?.current_mood || "Calm";
  const streakDays = profile?.streak_days || 0;
  
  // Real data from backend
  const creditsRemaining = profile?.credits_remaining || 0;
  const creditsTotal = profile?.credits_total || 200;
  const userPlan = profile?.subscription_plan || "Basic Plan";

  const quickActions = [
    {
      icon: Video,
      label: "Start Session",
      description: "Talk with Ezri now",
      path: "/app/session-lobby",
      gradient: "from-blue-500 to-cyan-500"
    },
    {
      icon: Heart,
      label: "Mood Check-In",
      description: "How are you feeling?",
      path: "/app/mood-checkin",
      gradient: "from-pink-500 to-rose-500"
    },
    {
      icon: BookOpen,
      label: "New Journal Entry",
      description: "Write your thoughts",
      path: "/app/journal",
      gradient: "from-purple-500 to-indigo-500"
    },
    {
      icon: Sparkles,
      label: "Wellness Tools",
      description: "Breathing & meditation",
      path: "/app/wellness-tools",
      gradient: "from-amber-500 to-orange-500"
    }
  ];

  const recentActivities = profile?.mood_entries?.slice(0, 4).map((entry: any) => ({
    type: "mood",
    text: `Logged ${entry.mood} (${entry.intensity}/10)`,
    time: formatDistanceToNow(new Date(entry.created_at), { addSuffix: true }),
    emoji: getMoodEmoji(entry.mood)
  })) || [
    { type: "system", text: "Welcome to MeetEzri!", time: "Just now", emoji: "👋" }
  ];

  const insights = [
    {
      icon: TrendingUp,
      title: "Mood Trending Up",
      description: "Your average mood improved 15% this week",
      color: "text-green-500"
    },
    {
      icon: Flame,
      title: `${streakDays} Day Streak!`,
      description: "Keep up the great work checking in daily",
      color: "text-orange-500"
    },
    {
      icon: Target,
      title: "Weekly Goal: 80%",
      description: "4 of 5 check-ins completed",
      color: "text-blue-500"
    }
  ];

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="mb-8">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="p-6">
                <div className="space-y-3">
                  <Skeleton className="h-6 w-6" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </Card>
            ))}
          </div>
          <div className="mb-8">
            <Skeleton className="h-6 w-40 mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <Card key={i} className="p-4">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-3 w-40 mb-1" />
                  <Skeleton className="h-3 w-24" />
                </Card>
              ))}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold mb-2">Welcome back, {firstName}! 👋</h1>
          <p className="text-muted-foreground">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric"
            })}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Link to="/app/mood-history">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card className="p-6 bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-xl cursor-pointer hover:shadow-2xl transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <Heart className="w-8 h-8" />
                  <motion.span
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-3xl"
                  >
                    {getMoodEmoji(currentMood)}
                  </motion.span>
                </div>
                <h3 className="font-semibold mb-1">Current Mood</h3>
                <p className="text-2xl font-bold">{currentMood}</p>
                <p className="text-xs text-white/80 mt-2">Click to update or view history</p>
              </Card>
            </motion.div>
          </Link>

          <Link to="/app/progress">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card className="p-6 bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-xl cursor-pointer hover:shadow-2xl transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <Flame className="w-8 h-8" />
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-3xl"
                  >
                    🔥
                  </motion.div>
                </div>
                <h3 className="font-semibold mb-1">Current Streak</h3>
                <p className="text-2xl font-bold">{streakDays} Days</p>
                <p className="text-xs text-white/80 mt-2">Click to view streak history</p>
              </Card>
            </motion.div>
          </Link>

          <Link to="/app/session-history">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card className="p-6 bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-xl cursor-pointer hover:shadow-2xl transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <Calendar className="w-8 h-8" />
                  <Award className="w-8 h-8" />
                </div>
                <h3 className="font-semibold mb-1">Upcoming Sessions</h3>
                <p className="text-2xl font-bold">{upcomingSessionsCount}</p>
                <p className="text-xs text-white/80 mt-2">Click to view schedule</p>
              </Card>
            </motion.div>
          </Link>

          <Link to="/app/billing">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card className={`p-6 text-white shadow-xl cursor-pointer hover:shadow-2xl transition-shadow ${
                creditsRemaining <= 50 
                  ? 'bg-gradient-to-br from-amber-500 to-orange-500' 
                  : 'bg-gradient-to-br from-green-500 to-emerald-500'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <Clock className="w-8 h-8" />
                  {creditsRemaining <= 50 && (
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <Zap className="w-8 h-8" />
                    </motion.div>
                  )}
                </div>
                <h3 className="font-semibold mb-1">Minutes Remaining</h3>
                <p className="text-2xl font-bold">{creditsRemaining} / {creditsTotal}</p>
                <p className="text-xs text-white/90 mt-2">{userPlan} • Click to manage</p>
              </Card>
            </motion.div>
          </Link>
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-8"
        >
          <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              const isStartSession = action.path === "/app/session-lobby";
              return (
                <Link key={action.path} to={action.path}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + index * 0.05 }}
                    whileHover={{ scale: 1.05, y: -5 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Card className={`p-6 bg-gradient-to-br ${action.gradient} text-white shadow-xl cursor-pointer overflow-hidden relative group ${isStartSession ? 'ring-4 ring-blue-300 ring-opacity-50' : ''}`}>
                      {isStartSession && (
                        <motion.div
                          animate={{
                            scale: [1, 1.1, 1],
                            opacity: [0.5, 0.8, 0.5],
                          }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="absolute inset-0 bg-white/10 pointer-events-none"
                        />
                      )}
                      <motion.div
                        className="absolute inset-0 bg-white/20 pointer-events-none"
                        initial={{ x: "-100%" }}
                        whileHover={{ x: "100%" }}
                        transition={{ duration: 0.6 }}
                      />
                      <Icon className={`w-8 h-8 mb-3 relative z-10 ${isStartSession ? 'animate-pulse' : ''}`} />
                      <h3 className="font-bold mb-1 relative z-10">{action.label}</h3>
                      <p className="text-sm text-white/90 relative z-10">{action.description}</p>
                      {isStartSession && (
                        <motion.div
                          animate={{ x: [0, 5, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="absolute bottom-3 right-3 z-10 pointer-events-none"
                        >
                          <ArrowRight className="w-5 h-5" />
                        </motion.div>
                      )}
                    </Card>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Insights */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Your Insights</h2>
                <Link to="/app/progress">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="text-primary hover:underline text-sm font-medium"
                  >
                    View All
                  </motion.button>
                </Link>
              </div>
              <div className="space-y-4">
                {insights.map((insight, index) => {
                  const Icon = insight.icon;
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.7 + index * 0.1 }}
                      whileHover={{ x: 5 }}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <div className={`p-2 rounded-lg bg-gray-100 dark:bg-gray-800 ${insight.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">{insight.title}</h3>
                        <p className="text-sm text-muted-foreground">{insight.description}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </Card>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Card className="p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Recent Activity</h2>
                <Link to="/app/mood-history">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="text-primary hover:underline text-sm font-medium"
                  >
                    View History
                  </motion.button>
                </Link>
              </div>
              <div className="space-y-3">
                {recentActivities.map((activity: any, index: number) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.8 + index * 0.05 }}
                    whileHover={{ x: 5 }}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <span className="text-2xl">{activity.emoji}</span>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{activity.text}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Motivational Quote */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="mt-6"
        >
          <Card className="p-6 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-xl">
            <div className="flex items-start gap-3">
              <Sparkles className="w-6 h-6 flex-shrink-0 mt-1" />
              <div>
                <p className="text-lg font-medium mb-2">
                  "The greatest glory in living lies not in never falling, but in rising every time we fall."
                </p>
                <p className="text-sm text-white/80">— Nelson Mandela</p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Wellness Challenges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          className="mt-6"
        >
          <WellnessChallenges />
        </motion.div>

        {/* PWA Install Prompt */}
        <PWAInstallPrompt />
      </div>
    </AppLayout>
  );
}
