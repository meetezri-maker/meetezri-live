import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/skeleton";
import { Link, useLocation } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Video, Heart, BookOpen, Sparkles, TrendingUp, Flame, Target, Mail } from "lucide-react";
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
import { queryKeys } from "@/lib/queries";
import { resolveCompanionPortraitUrl } from "@/lib/avatar/companionModelUrl";
import {
  SolaceDashboardView,
  type SolaceJourneyCard,
  type SolaceQuickAction,
  type SolaceInsightItem,
} from "./dashboard/SolaceDashboardView";

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
  const showConfirmEmailPopup =
    signupType === "trial" && isUnverified && !confirmEmailDismissed;
  const canCancelSubscription =
    signupType !== "trial" &&
    ["active", "trialing", "past_due"].includes(
      String(profile?.subscription_status || "").toLowerCase()
    );

  const moodEmojis: Record<string, string> = {
    Happy: "😊",
    Calm: "😌",
    Excited: "🤩",
    Anxious: "😰",
    Sad: "😢",
    Angry: "😡",
  };

  const getMoodEmoji = (mood: string) => {
    if (!mood) return "😐";
    if (Object.values(moodEmojis).includes(mood)) return mood;
    const entry = Object.entries(moodEmojis).find(
      ([label]) => label.toLowerCase() === mood.toLowerCase()
    );
    return entry ? entry[1] : "😐";
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

  const { data: sessionsRaw, isLoading } = useQuery({
    queryKey: queryKeys.sessions.list({ status: "scheduled" }),
    queryFn: () => api.sessions.list({ status: "scheduled" }),
    staleTime: 60_000,
  });

  const upcomingSessionsCount = (() => {
    const sessions = Array.isArray(sessionsRaw)
      ? (sessionsRaw as BackendSession[])
      : Array.isArray((sessionsRaw as { sessions?: unknown })?.sessions)
        ? (sessionsRaw as { sessions: BackendSession[] }).sessions
        : [];
    const now = new Date();
    return sessions.filter((session) => {
      const scheduledDate = session.scheduled_at ? new Date(session.scheduled_at) : null;
      if (!scheduledDate) return false;
      return scheduledDate.getTime() >= now.getTime() && session.status === "scheduled";
    }).length;
  })();

  const { data: creditsData } = useQuery({
    queryKey: queryKeys.credits.byUser(user?.id),
    queryFn: () =>
      api.getCredits() as Promise<{
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
      ? (activityRaw as Array<{
          id: string;
          type: string;
          text: string;
          created_at: string;
          mood?: string;
        }>)
      : Array.isArray((activityRaw as { items?: unknown })?.items)
        ? (activityRaw as {
            items: Array<{ id: string; type: string; text: string; created_at: string; mood?: string }>;
          }).items
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
          row.type === "mood" && row.mood ? getMoodEmoji(row.mood) : emojiForActivityType(row.type),
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

  const creditsRemaining =
    profile?.credits_remaining != null ? profile.credits_remaining : 0;
  const creditsTotal = profile?.credits_total != null ? profile.credits_total : 200;
  const userPlan = profile?.subscription_plan || "Basic Plan";

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
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

  const accountRemainingMinutesDisplay = Math.max(0, Math.ceil(creditsRemainingSeconds / 60));
  const accountUsedMinutesDisplay = Math.max(
    0,
    Math.ceil((creditsTotalSeconds - creditsRemainingSeconds) / 60)
  );
  const creditsRemainingLow = accountRemainingMinutesDisplay;

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

  const insights: SolaceInsightItem[] = [
    {
      icon: TrendingUp,
      title: "Mood trending up",
      description: "Your average mood improved 15% this week",
      accent: "emerald",
    },
    {
      icon: Flame,
      title: `${streakDays} day streak`,
      description: "Keep up the gentle rhythm of showing up for yourself",
      accent: "orange",
    },
    {
      icon: Target,
      title: "Weekly goal: 80%",
      description: "4 of 5 check-ins completed",
      accent: "sky",
    },
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

  const journeyCards: SolaceJourneyCard[] = useMemo(
    () => [
      {
        title: "Deep Focus",
        duration: "25 min",
        benefit: "Improve concentration",
        to: "/app/wellness-tools",
        ambiance: "lake",
      },
      {
        title: "Evening Unwind",
        duration: "20 min",
        benefit: "Release the day",
        to: "/app/wellness-tools",
        ambiance: "mountain",
      },
      {
        title: "Anxiety Release",
        duration: "28 min",
        benefit: "Find calm",
        to: "/app/mood-checkin",
        ambiance: "forest",
      },
      {
        title: "Gratitude Reflection",
        duration: "15 min",
        benefit: "Cultivate appreciation",
        to: "/app/journal",
        ambiance: "dusk",
      },
    ],
    []
  );

  const quickActions: SolaceQuickAction[] = useMemo(
    () => [
      {
        icon: Video,
        label: "Start talking",
        description: "Talk with Solace now",
        path: "/app/session-lobby",
        accent: "violet",
      },
      {
        icon: Heart,
        label: "Mood check-in",
        description: "How are you feeling?",
        path: "/app/mood-checkin",
        accent: "rose",
      },
      {
        icon: BookOpen,
        label: "New journal entry",
        description: "Write your thoughts",
        path: "/app/journal",
        accent: "cyan",
      },
      {
        icon: Sparkles,
        label: "Wellness tools",
        description: "Breathing & meditation",
        path: "/app/wellness-tools",
        accent: "amber",
      },
    ],
    []
  );

  const lastSessionLabel = useMemo(() => {
    const rows = Array.isArray(activityRaw)
      ? (activityRaw as Array<{ id: string; type: string; created_at: string }>)
      : Array.isArray((activityRaw as { items?: unknown })?.items)
        ? (activityRaw as { items: Array<{ id: string; type: string; created_at: string }> }).items
        : [];
    const sessionRow = rows.find((r) => r.type === "session");
    if (!sessionRow?.created_at) return null;
    const created = new Date(sessionRow.created_at);
    if (Number.isNaN(created.getTime())) return null;
    return formatDistanceToNow(created, { addSuffix: true });
  }, [activityRaw]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const portraitUrl = resolveCompanionPortraitUrl(profile?.selected_avatar);
  const companionDisplayName =
    (profile?.selected_avatar && profile.selected_avatar.trim()) || "Ezri";
  const companionShort = companionDisplayName.split(/\s+/)[0] || "Ezri";
  const companionTag = `Your companion, ${companionShort}`;

  const mindfulMinutesDisplay = useMemo(() => {
    const hrs = Math.floor(accountUsedMinutesDisplay / 60);
    const m = accountUsedMinutesDisplay % 60;
    if (hrs <= 0) return `${m} min of gentle presence`;
    return `${hrs}h ${m}m of gentle presence`;
  }, [accountUsedMinutesDisplay]);

  const sessionsCompletedDisplay = useMemo(() => {
    const n = safeStat(profile?.stats?.completed_sessions);
    return n === 1 ? "1 session so far" : `${n} sessions so far`;
  }, [profile?.stats?.completed_sessions]);

  const moodSparkPhrase = useMemo(() => {
    return streakDays > 0
      ? `${streakDays}-day rhythm · staying with your moods`
      : "Your emotional line softens when you check in";
  }, [streakDays]);

  const sleepQualityLabel = "Soft nights matter — rest supports every step";

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

  if (isLoading) {
    return (
      <div className="min-h-full bg-[#07080d] px-4 py-8 sm:px-5">
        <div className="mx-auto max-w-[1600px] space-y-6">
          <Skeleton className="h-10 w-56 bg-zinc-800" />
          <Skeleton className="h-4 w-40 bg-zinc-800" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-2xl bg-zinc-800/80" />
            ))}
          </div>
          <Skeleton className="h-72 w-full rounded-3xl bg-zinc-800/70" />
        </div>
      </div>
    );
  }

  const emailDialog = (
    <Dialog
      open={showConfirmEmailPopup}
      onOpenChange={(open) => !open && setConfirmEmailDismissed(true)}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <Mail className="h-6 w-6 text-amber-600" />
          </div>
          <DialogTitle className="text-center">Verify your email</DialogTitle>
          <DialogDescription className="text-center">
            We sent a verification link to <strong>{user?.email}</strong>. Open that email and{" "}
            <strong>click the link</strong> to verify your account and secure your free trial. You can
            close this and verify from the link in your inbox anytime.
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
  );

  return (
    <>
      <SolaceDashboardView
        firstName={firstName}
        greeting={greeting}
        companionTag={companionTag}
        heroSubtext="I'm here for you, whenever you need. You've been showing up for yourself — I'm really proud of you."
        portraitUrl={portraitUrl}
        companionImageAlt={`${companionDisplayName}, your companion`}
        lastSessionLabel={lastSessionLabel}
        currentMood={currentMood}
        getMoodEmoji={getMoodEmoji}
        streakDays={streakDays}
        upcomingSessionsCount={upcomingSessionsCount}
        formatTime={formatTime}
        creditsRemainingSeconds={creditsRemainingSeconds}
        creditsTotalMinutes={creditsTotalMinutes}
        userPlan={userPlan}
        creditsRemainingLow={creditsRemainingLow}
        quickActions={quickActions}
        journeyCards={journeyCards}
        insights={insights}
        insightDistributionData={insightDistributionData}
        insightDistributionChartData={insightDistributionChartData}
        insightDistributionTotal={insightDistributionTotal}
        recentActivities={recentActivities}
        quoteLines={{
          line: "The greatest glory in living lies not in never falling, but in rising every time we fall.",
          attribution: "— Nelson Mandela",
        }}
        mindfulMinutesDisplay={mindfulMinutesDisplay}
        sessionsCompletedDisplay={sessionsCompletedDisplay}
        moodSparkPhrase={moodSparkPhrase}
        sleepQualityLabel={sleepQualityLabel}
        showTrialChip={signupType === "trial"}
        canCancelSubscription={canCancelSubscription}
        cancelSubscriptionLoading={cancelSubscriptionLoading}
        onCancelSubscription={handleCancelSubscription}
        supportCta={
          <Link to="/app/emergency-resources" className="inline-flex">
            <Button
              type="button"
              className="bg-gradient-to-r from-violet-600/90 to-indigo-600/90 text-white shadow-[0_0_28px_rgba(76,29,149,0.35)] hover:from-violet-500 hover:to-indigo-500"
            >
              Get support
            </Button>
          </Link>
        }
        emailDialog={emailDialog}
      />
    </>
  );
}
