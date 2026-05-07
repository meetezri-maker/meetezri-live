import { AppLayout } from "../../components/AppLayout";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/skeleton";
import { motion } from "motion/react";
import { Link, useLocation } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Video, Heart, BookOpen, TrendingUp, Calendar, Sparkles, ArrowRight, Award, Target, Flame, Clock, Zap, Mail } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { WellnessChallenges } from "../../components/WellnessChallenges";
import { PWAInstallPrompt } from "../../components/PWAInstallPrompt";
import { useAuth } from "@/app/contexts/AuthContext";
import { api } from "../../../lib/api";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { queryKeys } from "@/lib/queries";
import { FluentEmoji } from "@/components/ui/FluentEmoji";

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
  const location = useLocation();
  const { user, profile, refreshProfile } = useAuth();

  // UI-only state — no fetched data here
  const [confirmEmailDismissed, setConfirmEmailDismissed] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [cancelSubscriptionLoading, setCancelSubscriptionLoading] = useState(false);

  const rawSignupType =
    (user as any)?.user_metadata?.signup_type ??
    (user as any)?.user_metadata?.signupType ??
    (user as any)?.user_metadata?.signup ??
    null;
  const signupType =
    profile?.signup_type ??
    (String(rawSignupType).toLowerCase() === "trial" ? "trial" : null) ??
    (profile?.subscription_plan === "trial" ? "trial" : null);
  const isUnverified =
    !!user && (!user.email_confirmed_at || (user as any)?.user_metadata?.email_verification_required);
  // Required behavior:
  // - show popup only for trial users
  // - show only on /app/dashboard
  // - show only when email is NOT verified
  const showConfirmEmailPopup =
    signupType === "trial" && isUnverified && !confirmEmailDismissed;
  const canCancelSubscription =
    signupType !== "trial" &&
    ["active", "trialing", "past_due"].includes(
      String(profile?.subscription_status || "").toLowerCase()
    );

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

  const resolveLatestMoodFromClient = () => {
    const fromNavigation = (location.state as any)?.latestMoodCheckin?.mood;
    if (typeof fromNavigation === "string" && fromNavigation.trim()) {
      return fromNavigation;
    }
    if (typeof window === "undefined") return null;
    try {
      const saved = window.sessionStorage.getItem("ezri_latest_mood_checkin");
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      return typeof parsed?.mood === "string" && parsed.mood.trim() ? parsed.mood : null;
    } catch {
      return null;
    }
  };

  // --- Talk it out query (replaces useState + useEffect) ---
  const { data: sessionsRaw, isLoading } = useQuery({
    queryKey: queryKeys.sessions.list({ status: "scheduled" }),
    queryFn: () => api.sessions.list({ status: "scheduled" }),
    staleTime: 60_000,
  });

  const upcomingSessionsCount = (() => {
    const sessions = Array.isArray(sessionsRaw)
      ? (sessionsRaw as BackendSession[])
      : Array.isArray((sessionsRaw as { sessions?: unknown })?.sessions)
        ? ((sessionsRaw as { sessions: BackendSession[] }).sessions)
        : [];
    const now = new Date();
    return sessions.filter((session) => {
      const scheduledDate = session.scheduled_at ? new Date(session.scheduled_at) : null;
      if (!scheduledDate) return false;
      return scheduledDate.getTime() >= now.getTime() && session.status === "scheduled";
    }).length;
  })();

  // --- Credits query (replaces useState + useEffect) ---
  const { data: creditsData } = useQuery({
    queryKey: queryKeys.credits.byUser(user?.id),
    queryFn: () => api.getCredits() as Promise<{
      credits_seconds?: number;
      credits?: number;
      subscription_total_seconds?: number;
      subscription_total?: number;
      purchased_seconds?: number;
      purchased?: number;
    }>,
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const liveCreditsSeconds = creditsData
    ? typeof creditsData.credits_seconds === "number"
      ? Math.max(0, creditsData.credits_seconds)
      : typeof creditsData.credits === "number"
      ? Math.max(0, creditsData.credits) * 60
      : null
    : null;

  const liveCreditsTotalSeconds = (() => {
    if (!creditsData) return null;
    const totalSeconds =
      typeof creditsData.subscription_total_seconds === "number"
        ? Math.max(0, creditsData.subscription_total_seconds)
        : typeof creditsData.subscription_total === "number"
        ? Math.max(0, creditsData.subscription_total) * 60
        : null;
    const purchasedSecondsValue =
      typeof creditsData.purchased_seconds === "number"
        ? Math.max(0, creditsData.purchased_seconds)
        : typeof creditsData.purchased === "number"
        ? Math.max(0, creditsData.purchased) * 60
        : 0;
    return totalSeconds !== null ? totalSeconds + purchasedSecondsValue : null;
  })();

  const liveCreditsTotalMinutes =
    liveCreditsTotalSeconds !== null ? Math.ceil(liveCreditsTotalSeconds / 60) : null;

  // --- Activity query (replaces useState + useEffect) ---
  const { data: activityRaw } = useQuery({
    queryKey: queryKeys.activity.recent(user?.id),
    queryFn: () => api.getRecentActivity(20) as Promise<unknown>,
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const emojiForActivityType = (type: string) => {
    if (type === "mood") return "😊";
    if (type === "journal") return "📓";
    if (type === "session") return "🎥";
    if (type === "event") return "⚡";
    return "📝";
  };

  const activityFeed = (() => {
    const rows = Array.isArray(activityRaw)
      ? (activityRaw as Array<{ id: string; type: string; text: string; created_at: string; mood?: string }>)
      : Array.isArray((activityRaw as { items?: unknown })?.items)
        ? ((activityRaw as { items: Array<{ id: string; type: string; text: string; created_at: string; mood?: string }> }).items)
        : [];
    return rows.slice(0, 10).map((row) => {
      const created = row.created_at ? new Date(row.created_at) : null;
      const timeOk = created && !Number.isNaN(created.getTime());
      return {
        id: row.id,
        type: row.type,
        text: row.text,
        time: timeOk ? formatDistanceToNow(created!, { addSuffix: true }) : "Recently",
        emoji:
          row.type === "mood" && row.mood
            ? getMoodEmoji(row.mood)
            : emojiForActivityType(row.type),
      };
    });
  })();

  const firstName = profile?.full_name?.split(" ")[0] || "Friend";
  const optimisticMood = resolveLatestMoodFromClient();
  const currentMood = optimisticMood || profile?.current_mood || "Calm";

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!optimisticMood || !profile?.current_mood) return;
    if (optimisticMood.toLowerCase() === String(profile.current_mood).toLowerCase()) {
      window.sessionStorage.removeItem("ezri_latest_mood_checkin");
    }
  }, [optimisticMood, profile?.current_mood]);

  const streakDays = profile?.streak_days || 0;
  
  // Real data from backend
  const creditsRemaining =
    profile?.credits_remaining != null ? profile.credits_remaining : 0;
  const creditsTotal =
    profile?.credits_total != null ? profile.credits_total : 200;
  const userPlan = profile?.subscription_plan || "Basic Plan";

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const creditsRemainingSeconds =
    liveCreditsSeconds !== null
      ? liveCreditsSeconds
      : typeof profile?.credits_remaining_seconds === "number"
      ? Math.max(0, profile.credits_remaining_seconds)
      : creditsRemaining * 60;

  const creditsTotalSeconds =
    liveCreditsTotalSeconds !== null
      ? liveCreditsTotalSeconds
      : typeof profile?.credits_total_seconds === "number"
      ? Math.max(0, profile.credits_total_seconds)
      : creditsTotal * 60;

  const creditsTotalMinutes =
    liveCreditsTotalMinutes !== null
      ? liveCreditsTotalMinutes
      : creditsTotal;

  const accountRemainingMinutesDisplay = Math.max(
    0,
    Math.ceil(creditsRemainingSeconds / 60)
  );
  const accountUsedMinutesDisplay = Math.max(
    0,
    Math.ceil((creditsTotalSeconds - creditsRemainingSeconds) / 60)
  );
  const creditsRemainingLow = accountRemainingMinutesDisplay;

  const quickActions = [
    {
      icon: Video,
      label: "Start Talking",
      description: "Talk with Solace now",
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

  const moodEntriesSafe = Array.isArray(profile?.mood_entries) ? profile.mood_entries : [];
  const moodBasedFallbackActivities =
    moodEntriesSafe.length > 0
      ? moodEntriesSafe.slice(0, 4).map((entry: any) => {
          const created = entry?.created_at ? new Date(entry.created_at) : null;
          const timeOk = created && !Number.isNaN(created.getTime());
          return {
            id: `mood:${entry?.id ?? entry?.created_at ?? String(Math.random())}`,
            type: "mood",
            text: `Logged ${entry?.mood ?? "?"} (${entry?.intensity ?? "-"}/10)`,
            time: timeOk ? formatDistanceToNow(created!, { addSuffix: true }) : "Recently",
            emoji: getMoodEmoji(String(entry?.mood ?? "")),
          };
        })
      : [
          {
            id: "system:welcome",
            type: "system",
            text: "Welcome to Solace!",
            time: "Just now",
            emoji: "👋",
          },
        ];

  const recentActivities = activityFeed.length > 0 ? activityFeed : moodBasedFallbackActivities;

  const safeStat = (value: unknown) => {
    const n = Number(value ?? 0);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

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

  const insightDistributionData = [
    {
      name: "Talk it out",
      value: safeStat(profile?.stats?.completed_sessions),
      color: "#8b5cf6",
    },
    {
      name: "Mood Check-ins",
      value: safeStat(profile?.stats?.total_checkins),
      color: "#06b6d4",
    },
    {
      name: "Journals",
      value: safeStat(profile?.stats?.total_journals),
      color: "#f59e0b",
    },
  ];
  const insightDistributionChartData = insightDistributionData.filter((item) => item.value > 0);
  const insightDistributionTotal = insightDistributionData.reduce((sum, item) => sum + item.value, 0);

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

  const handleResendVerification = async () => {
    if (!user?.email) return false;
    setResendLoading(true);
    try {
      await api.resendVerificationEmail();
      toast.success("Verification email sent. Check your inbox.");
      return true;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send verification email");
      return false;
    } finally {
      setResendLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to cancel subscription auto-renew? You will keep access until the current billing period ends."
    );
    if (!confirmed) return;
    setCancelSubscriptionLoading(true);
    try {
      await api.billing.cancelSubscription();
      await refreshProfile();
      toast.success("Subscription cancelled. Auto-renew has been turned off.");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to cancel subscription";
      toast.error(message);
    } finally {
      setCancelSubscriptionLoading(false);
    }
  };

  return (
    <AppLayout>
      {/* Confirm email popup for free trial users who haven't verified yet */}
      <Dialog open={showConfirmEmailPopup} onOpenChange={(open) => !open && setConfirmEmailDismissed(true)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <Mail className="h-6 w-6 text-amber-600" />
            </div>
            <DialogTitle className="text-center">Verify your email</DialogTitle>
            <DialogDescription className="text-center">
              We sent a verification link to <strong>{user?.email}</strong>. Open that email and <strong>click the link</strong> to verify your account and secure your free trial. You can close this and verify from the link in your inbox anytime.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={async () => {
                const isSuccess = await handleResendVerification();
                if (isSuccess) {
                  setConfirmEmailDismissed(true);
                }
              }}
              isLoading={resendLoading}
              disabled={resendLoading}
              className="w-full sm:w-auto"
            >
              Email Verification
            </Button>
            <Button
              variant="outline"
              onClick={() => setConfirmEmailDismissed(true)}
              disabled={resendLoading}
              className="w-full sm:w-auto"
            >
              Do It Later
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Verification popup is the single source of truth for prompting on dashboard */}

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
              className="h-full"
            >
              <Card className="h-full p-6 bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-xl cursor-pointer hover:shadow-2xl transition-shadow flex flex-col">
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
              className="h-full"
            >
              <Card className="h-full p-6 bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-xl cursor-pointer hover:shadow-2xl transition-shadow flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <Flame className="w-8 h-8" />
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-3xl leading-none"
                  >
                    <FluentEmoji emoji="🔥" size={36} />
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
              className="h-full"
            >
              <Card className="h-full p-6 bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-xl cursor-pointer hover:shadow-2xl transition-shadow flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <Calendar className="w-8 h-8" />
                  <Award className="w-8 h-8" />
                </div>
                <h3 className="font-semibold mb-1">Upcoming Talk</h3>
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
              className="h-full"
            >
              <Card
                className={`h-full p-6 text-white shadow-xl cursor-pointer hover:shadow-2xl transition-shadow flex flex-col ${
                  creditsRemainingLow <= 50
                    ? "bg-gradient-to-br from-amber-500 to-orange-500"
                    : "bg-gradient-to-br from-green-500 to-emerald-500"
                }`}
              >
                <div className="flex items-center justify-between ">
                  <Clock className="w-8 h-8" />
                  {creditsRemainingLow <= 50 && (
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <Zap className="w-8 h-8" />
                    </motion.div>
                  )}
                </div>
                <div className="flex flex-col gap-2 mt-1">
                <h3 className="font-bold ">Time remaining</h3>
                <p className="text-xl font-semibold font-mono">
                  {formatTime(creditsRemainingSeconds)}
                </p>
                {/* <p className="text-sm font-medium text-white/90">
                  {accountRemainingMinutesDisplay} min
                </p> */}
                </div>
                <div className="flex flex-col gap-1 mt-2">
                <div className="flex flex-row gap-2 items-baseline">
                <h3 className="font-bold">Total minutes</h3>
                <p className="text-xl font-semibold font-mono">
                  {creditsTotalMinutes} 
                </p>
                </div>
                {/* {accountUsedMinutesDisplay != null && (
                  <p className="text-sm text-white/90">
                    Used: {accountUsedMinutesDisplay} min
                  </p>
                )} */}
                </div>
                <p className="text-xs text-white/90 ">
                  {userPlan} • Click to manage
                </p>
              </Card>
            </motion.div>
          </Link>
        </div>

        {canCancelSubscription && (
          <div className="mb-8 flex justify-end">
            <Button
              variant="outline"
              onClick={handleCancelSubscription}
              isLoading={cancelSubscriptionLoading}
              disabled={cancelSubscriptionLoading}
              className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              Cancel Subscription
            </Button>
          </div>
        )}

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
        

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 }}
            className="h-full"
          >
            <Card className="p-6 shadow-xl h-full lg:h-[760px] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Recent Activity</h2>
                <Link to="/app/recent-activity-history">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="text-primary hover:underline text-sm font-medium"
                  >
                    View History
                  </motion.button>
                </Link>
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                {recentActivities.map((activity: any, index: number) => (
                  <motion.div
                    key={activity.id || index}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.8 + index * 0.05 }}
                    whileHover={{ x: 5 }}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <FluentEmoji emoji={activity.emoji} size={28} className="shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{activity.text}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="h-full"
          >
            <Card className="p-6 shadow-xl h-full lg:h-[760px] flex flex-col">
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
              <div className="mb-4 rounded-xl border border-border/60 p-3">
                <div className="h-52 w-full">
                  {insightDistributionChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={insightDistributionChartData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={48}
                          outerRadius={74}
                          paddingAngle={2}
                          strokeWidth={0}
                        >
                          {insightDistributionChartData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number, name: string) => [value, name]}
                          contentStyle={{ borderRadius: 12, borderColor: "hsl(var(--border))" }}
                        />
                      </RechartsPie>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Complete Talking, mood check-ins, or journals to populate insights.
                    </div>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                  <span>Total tracked activities</span>
                  <span className="font-semibold text-foreground">{insightDistributionTotal}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  {insightDistributionData.map((item) => (
                    <span key={item.name} className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.name}: {item.value}
                    </span>
                  ))}
                </div>
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
