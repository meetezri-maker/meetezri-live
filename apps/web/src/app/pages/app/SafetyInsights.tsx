/**
 * Solace — Personal Safety Insights
 * Cinematic emotional wellness sanctuary (not analytics dashboard).
 */

import { useMemo, useState, useEffect, useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Link, useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  ArrowRight,
  Shield,
  TrendingUp,
  TrendingDown,
  Clock,
  Heart,
  AlertTriangle,
  Phone,
  Users,
  Sun,
  Target,
  Award,
  Cloud,
  Leaf,
  ChevronRight,
  Check,
  Loader2,
} from "lucide-react";
import { useSafety } from "@/app/contexts/SafetyContext";
import { getUserSafetyEvents } from "@/app/utils/safetyLogger";
import type { SafetyEvent } from "@/app/types/safety";
import {
  getMostUsedResources,
  getInteractionsBySafetyState,
  mapServerRowsToInteractions,
} from "@/app/utils/resourceTracking";
import { getSafetyResources } from "@/app/utils/safetyResources";
import { useAuth } from "@/app/contexts/AuthContext";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { SolaceGlassCard } from "@/app/solace/SolaceGlassCard";
import {
  WELLNESS_PLAN_BANNER_IMG,
  WELLNESS_PLAN_HERO_IMG,
  wellnessPlanBackLink,
  wellnessPlanBtnGhost,
  wellnessPlanBtnRose,
  wellnessPlanGlassCard,
  wellnessPlanHeroCard,
  wellnessPlanHeroImage,
  wellnessPlanHeroOverlayLeft,
  wellnessPlanHeroOverlayPurple,
  wellnessPlanHeroOverlayWarmth,
  wellnessPlanHeroTitle,
  wellnessPlanIconChip,
  wellnessPlanPageAtmosphere,
  wellnessPlanPageFogMid,
  wellnessPlanPageGlowTop,
  wellnessPlanPageVignette,
} from "@/app/pages/app/wellness-plan-settings/wellnessPlanSettingsUi";
import {
  SafetyInsightsRail,
  type SafetyCheckInEntry,
} from "@/app/pages/app/safety-insights/SafetyInsightsRail";

type SafetyTrend = "increasing" | "decreasing" | "stable";

interface SafetyRecommendation {
  type: string;
  icon: typeof Heart;
  title: string;
  description: string;
  action: string;
  actionLink: string;
}

interface SafetyInsightsData {
  totalEvents: number;
  last30DaysCount: number;
  stateDistribution: Record<string, number>;
  timePatterns: Record<string, number>;
  dayPatterns: Record<string, number>;
  triggers: Record<string, number>;
  topResources: Array<{ resourceId: string; totalClicks: number }>;
  resourcesByState: Record<string, unknown>;
  trend: SafetyTrend;
  highRiskLast14: number;
  highRiskPrevious14: number;
  recommendations: SafetyRecommendation[];
  safetyScore: number;
  currentState: string;
}

const STATE_LABELS: Record<string, { label: string; color: string }> = {
  NORMAL: { label: "Safe", color: "#34d399" },
  ELEVATED_CONCERN: { label: "Caution", color: "#fbbf24" },
  HIGH_RISK: { label: "Stress", color: "#fb923c" },
  SAFETY_MODE: { label: "Crisis", color: "#f87171" },
};

function getScoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Needs Attention";
}

function getSupportiveMessage(score: number, last30DaysCount: number): string {
  if (score >= 80 && last30DaysCount === 0) {
    return "That's amazing. You're showing great care for yourself.";
  }
  if (score >= 80) return "You're navigating challenges with strength and awareness.";
  if (score >= 60) return "You're building awareness—small steps matter deeply here.";
  if (score >= 40) return "Be gentle with yourself. Support is always within reach.";
  return "You deserve care and connection. Reaching out is a brave step.";
}

function triggerSeverity(count: number, max: number): { label: string; tone: "high" | "medium" | "low" } {
  if (max === 0) return { label: "Low", tone: "low" };
  const ratio = count / max;
  if (ratio >= 0.66) return { label: "High", tone: "high" };
  if (ratio >= 0.33) return { label: "Medium", tone: "medium" };
  return { label: "Low", tone: "low" };
}

function formatTriggerLabel(signal: string): string {
  return signal
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function eventToCheckInNote(event: SafetyEvent): string {
  const state = event.newState;
  const map: Record<string, string> = {
    NORMAL: "Feeling safe and calm",
    ELEVATED_CONCERN: "Noticed elevated concern—took a mindful pause",
    HIGH_RISK: "Managed stress with care",
    SAFETY_MODE: "Activated safety support",
  };
  if (map[state]) return map[state];
  if (event.trigger) return `Reflected on ${formatTriggerLabel(event.trigger)}`;
  if (event.detectedSignals?.[0]) {
    return `Reflected on ${formatTriggerLabel(event.detectedSignals[0])}`;
  }
  return "Safety check-in recorded";
}

interface SafetyScoreRingProps {
  score: number;
  size?: number;
}

function SafetyScoreRing({ score, size = 128 }: SafetyScoreRingProps) {
  const gradId = useId().replace(/:/g, "");
  const strokeWidth = 10;
  const r = (size - strokeWidth) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;
  const isExcellent = score >= 80;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Safety score ${score} out of 100`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={`score-${gradId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={isExcellent ? "#34d399" : "#a855f7"} />
            <stop offset="100%" stopColor={isExcellent ? "#6ee7b7" : "#ec4899"} />
          </linearGradient>
        </defs>
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={`url(#score-${gradId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            filter: isExcellent
              ? "drop-shadow(0 0 14px rgba(52,211,153,0.55))"
              : "drop-shadow(0 0 12px rgba(168,85,247,0.45))",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            "text-4xl font-light tabular-nums",
            isExcellent ? "text-emerald-300" : "text-white"
          )}
        >
          {score}
        </span>
        <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-[rgba(255,255,255,0.45)]">
          Safety Score
        </span>
      </div>
    </div>
  );
}

export function SafetyInsights() {
  const navigate = useNavigate();
  const { currentState } = useSafety();
  const { user } = useAuth();
  const [insights, setInsights] = useState<SafetyInsightsData | null>(null);
  const [safetyHistory, setSafetyHistory] = useState<SafetyEvent[]>([]);
  const chartGradId = useId().replace(/:/g, "");

  const resourceIdToName = useMemo(() => {
    const resources = getSafetyResources();
    return new Map(resources.map((r) => [r.id, r.name]));
  }, []);

  const { data: rawSafetyResourceIx } = useQuery({
    queryKey: queryKeys.safetyResourceInteractions.list({
      userId: user?.id,
      window: "safety-insights",
    }),
    queryFn: async () => {
      const rows = (await api.safetyResourceInteractions.list({
        limit: 3000,
      })) as Array<Record<string, unknown>>;
      return Array.isArray(rows) ? rows : [];
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const resourceInteractions = useMemo(
    () => mapServerRowsToInteractions(rawSafetyResourceIx ?? []),
    [rawSafetyResourceIx]
  );

  useEffect(() => {
    const userId = user?.id || "anonymous";
    const history = getUserSafetyEvents(userId);
    setSafetyHistory(history);
  }, [user?.id]);

  const calculateInsights = () => {
    const events = safetyHistory || [];

    const totalEvents = events.length;
    const last30Days = events.filter((e) => {
      const eventDate = new Date(e.timestamp);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return eventDate >= thirtyDaysAgo;
    });

    const stateDistribution = events.reduce<Record<string, number>>((acc, event) => {
      const state = event.newState || "NORMAL";
      acc[state] = (acc[state] || 0) + 1;
      return acc;
    }, {});

    const timePatterns = events.reduce<Record<string, number>>((acc, event) => {
      const hour = new Date(event.timestamp).getHours();
      const period =
        hour < 6 ? "night" : hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
      acc[period] = (acc[period] || 0) + 1;
      return acc;
    }, {});

    const dayPatterns = events.reduce<Record<string, number>>((acc, event) => {
      const day = new Date(event.timestamp).getDay();
      const dayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      acc[dayNames[day]] = (acc[dayNames[day]] || 0) + 1;
      return acc;
    }, {});

    const triggers = events.reduce<Record<string, number>>((acc, event) => {
      const signal = event.trigger || event.detectedSignals?.[0];
      if (!signal) return acc;
      acc[signal] = (acc[signal] || 0) + 1;
      return acc;
    }, {});

    const topResources = getMostUsedResources(3, resourceInteractions);
    const resourcesByState = getInteractionsBySafetyState(resourceInteractions);

    const last14Days = events.filter((e) => {
      const eventDate = new Date(e.timestamp);
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      return eventDate >= fourteenDaysAgo;
    });

    const previous14Days = events.filter((e) => {
      const eventDate = new Date(e.timestamp);
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const twentyEightDaysAgo = new Date();
      twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);
      return eventDate >= twentyEightDaysAgo && eventDate < fourteenDaysAgo;
    });

    const highRiskLast14 = last14Days.filter(
      (e) => e.newState === "HIGH_RISK" || e.newState === "SAFETY_MODE"
    ).length;

    const highRiskPrevious14 = previous14Days.filter(
      (e) => e.newState === "HIGH_RISK" || e.newState === "SAFETY_MODE"
    ).length;

    const trend: SafetyTrend =
      highRiskPrevious14 === 0
        ? highRiskLast14 > 0
          ? "increasing"
          : "stable"
        : highRiskLast14 > highRiskPrevious14
          ? "increasing"
          : highRiskLast14 < highRiskPrevious14
            ? "decreasing"
            : "stable";

    const recommendations = generateRecommendations({
      stateDistribution,
      timePatterns,
      dayPatterns,
      triggers,
      trend,
      topResources,
      totalEvents: last30Days.length,
    });

    setInsights({
      totalEvents,
      last30DaysCount: last30Days.length,
      stateDistribution,
      timePatterns,
      dayPatterns,
      triggers,
      topResources,
      resourcesByState,
      trend,
      highRiskLast14,
      highRiskPrevious14,
      recommendations,
      safetyScore: calculateSafetyScore(stateDistribution, trend),
      currentState,
    });
  };

  const generateRecommendations = (data: {
    stateDistribution: Record<string, number>;
    timePatterns: Record<string, number>;
    dayPatterns: Record<string, number>;
    triggers: Record<string, number>;
    trend: SafetyTrend;
    topResources: Array<{ resourceId: string; totalClicks: number }>;
    totalEvents: number;
  }): SafetyRecommendation[] => {
    const recs: SafetyRecommendation[] = [];

    const mostCommonTime = Object.entries(data.timePatterns).sort(
      ([, a], [, b]) => b - a
    )[0] as [string, number] | undefined;

    if (mostCommonTime && mostCommonTime[1] > 2) {
      recs.push({
        type: "time",
        icon: Clock,
        title: "Time Pattern Detected",
        description: `You experience elevated concerns most often in the ${mostCommonTime[0]}. Consider scheduling check-ins or self-care during this time.`,
        action: "Set Reminder",
        actionLink: "/app/settings/notifications",
      });
    }

    if (Object.keys(data.triggers).length > 0) {
      const topTrigger = Object.entries(data.triggers).sort(([, a], [, b]) => b - a)[0] as [
        string,
        number,
      ];
      recs.push({
        type: "trigger",
        icon: AlertTriangle,
        title: "Common Trigger Identified",
        description: `"${formatTriggerLabel(topTrigger[0])}" has been detected ${topTrigger[1]} times. Consider adding coping strategies for this trigger to your Safety Plan.`,
        action: "Update Safety Plan",
        actionLink: "/app/settings/wellness-plan",
      });
    }

    if (data.topResources.length === 0 || data.totalEvents > 5) {
      recs.push({
        type: "resource",
        icon: Phone,
        title: "Explore Support Resources",
        description:
          "You have resources available but haven't used them recently. Having quick access to support can be helpful during difficult moments.",
        action: "View Resources",
        actionLink: "/app/emergency-resources",
      });
    }

    if (data.trend === "increasing") {
      recs.push({
        type: "trend",
        icon: TrendingUp,
        title: "Increased Activity Noticed",
        description:
          "You've had more safety concerns recently. This might be a good time to reach out to your trusted contacts or a professional.",
        action: "Contact Support",
        actionLink: "/app/settings/emergency-contacts",
      });
    } else if (data.trend === "decreasing") {
      recs.push({
        type: "trend",
        icon: TrendingDown,
        title: "Positive Progress!",
        description:
          "You've had fewer safety concerns lately. Keep up the great work with your wellness practices!",
        action: "View Progress",
        actionLink: "/app/progress",
      });
    }

    recs.push({
      type: "selfcare",
      icon: Heart,
      title: "Daily Self-Care",
      description: "Small daily actions create big changes. Prioritize you.",
      action: "Explore Tools",
      actionLink: "/app/wellness-tools",
    });

    return recs.slice(0, 4);
  };

  const calculateSafetyScore = (distribution: Record<string, number>, trend: SafetyTrend) => {
    const normalCount = distribution.NORMAL || 0;
    const elevatedCount = distribution.ELEVATED_CONCERN || 0;
    const highRiskCount = distribution.HIGH_RISK || 0;
    const safetyModeCount = distribution.SAFETY_MODE || 0;
    const total = normalCount + elevatedCount + highRiskCount + safetyModeCount;

    if (total === 0) return 100;

    const score =
      ((normalCount * 1.0 +
        elevatedCount * 0.7 +
        highRiskCount * 0.3 +
        safetyModeCount * 0.1) /
        total) *
      100;

    const trendAdjustment = trend === "decreasing" ? 5 : trend === "increasing" ? -5 : 0;
    return Math.round(Math.min(100, Math.max(0, score + trendAdjustment)));
  };

  useEffect(() => {
    calculateInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safetyHistory, resourceInteractions, currentState]);

  const timeChartData = useMemo(() => {
    if (!insights) return [];
    const base = [
      { label: "6 AM", hour: 6, value: 0 },
      { label: "10 AM", hour: 10, value: 0 },
      { label: "2 PM", hour: 14, value: 0 },
      { label: "6 PM", hour: 18, value: 0 },
      { label: "10 PM", hour: 22, value: 0 },
    ];
    safetyHistory.forEach((event) => {
      const hour = new Date(event.timestamp).getHours();
      const nearest = base.reduce((prev, curr) =>
        Math.abs(curr.hour - hour) < Math.abs(prev.hour - hour) ? curr : prev
      );
      nearest.value += 1;
    });
    return base;
  }, [insights, safetyHistory]);

  const donutData = useMemo(() => {
    if (!insights) return [];
    const dist = insights.stateDistribution;
    const total = Object.values(dist).reduce((s, c) => s + c, 0);
    if (total === 0) {
      return [{ name: "Safe", value: 100, color: "#34d399" }];
    }
    return Object.entries(dist).map(([key, count]) => ({
      name: STATE_LABELS[key]?.label ?? key,
      value: Math.round((count / total) * 100),
      color: STATE_LABELS[key]?.color ?? "#a78bfa",
    }));
  }, [insights]);

  const safePercent = useMemo(() => {
    const safe = donutData.find((d) => d.name === "Safe");
    return safe?.value ?? 0;
  }, [donutData]);

  const triggerRows = useMemo(() => {
    if (!insights) return [];
    const entries = Object.entries(insights.triggers).sort(([, a], [, b]) => b - a);
    const max = entries[0]?.[1] ?? 0;
    return entries.slice(0, 5).map(([signal, count]) => {
      const severity = triggerSeverity(count, max);
      return {
        label: formatTriggerLabel(signal),
        count,
        severityLabel: severity.label,
        tone: severity.tone,
      };
    });
  }, [insights]);

  const featuredRecommendation = useMemo(() => {
    if (!insights) return null;
    return (
      insights.recommendations.find((r) => r.type === "selfcare") ?? insights.recommendations[0]
    );
  }, [insights]);

  const checkIns = useMemo((): SafetyCheckInEntry[] => {
    return [...safetyHistory]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 6)
      .map((e) => ({
        timestamp: new Date(e.timestamp).toISOString(),
        note: eventToCheckInNote(e),
      }));
  }, [safetyHistory]);

  if (!insights) {
    return (
      <motion.div className={wellnessPlanPageAtmosphere}>
        <motion.div className={wellnessPlanPageGlowTop} aria-hidden />
        <div className="relative z-10 flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-fuchsia-300/60" aria-label="Loading" />
        </div>
      </motion.div>
    );
  }

  const scoreLabel = getScoreLabel(insights.safetyScore);
  const FeaturedIcon = featuredRecommendation?.icon ?? Heart;

  return (
    <motion.div
      className={wellnessPlanPageAtmosphere}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <motion.div className={wellnessPlanPageGlowTop} aria-hidden />
      <motion.div className={wellnessPlanPageFogMid} aria-hidden />
      <motion.div className={wellnessPlanPageVignette} aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-7 sm:py-9">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,340px)]">
          <div className="min-w-0 space-y-8">
            {/* Page header */}
            <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <Link to="/app/settings" className={wellnessPlanBackLink}>
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back to Settings
              </Link>
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <div className={wellnessPlanIconChip("pink")}>
                  <Shield className="h-7 w-7 text-fuchsia-200" aria-hidden />
                </div>
                <div>
                  <h1 className={wellnessPlanHeroTitle}>Your Safety Insights</h1>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[rgba(255,255,255,0.55)] sm:text-[15px]">
                    Personal patterns, trends, and recommendations based on your safety journey
                  </p>
                </div>
              </div>
            </motion.header>

            {/* Hero */}
            <motion.section
              className={wellnessPlanHeroCard}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <img
                src={WELLNESS_PLAN_HERO_IMG}
                alt=""
                className={wellnessPlanHeroImage}
              />
              <div className={wellnessPlanHeroOverlayLeft} aria-hidden />
              <motion.div className={wellnessPlanHeroOverlayPurple} aria-hidden />
              <motion.div className={wellnessPlanHeroOverlayWarmth} aria-hidden />

              <motion.div className="relative flex min-h-[280px] flex-col gap-6 p-6 sm:min-h-[300px] sm:p-8 lg:min-h-[320px] lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center lg:flex-1">
                  <SafetyScoreRing score={insights.safetyScore} />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-serif text-2xl font-light text-white sm:text-3xl">
                      {scoreLabel} Wellness
                    </h2>
                    <p className="mt-2 text-sm text-[rgba(255,255,255,0.55)]">
                      Based on {insights.last30DaysCount} safety events in the last 30 days
                    </p>
                    <p className="mt-3 max-w-md text-sm leading-relaxed text-rose-200/75">
                      {getSupportiveMessage(insights.safetyScore, insights.last30DaysCount)}
                    </p>
                    <div className="mt-4 flex items-center gap-2 text-sm text-emerald-300/85">
                      {insights.trend === "decreasing" ? (
                        <TrendingDown className="h-4 w-4 shrink-0" aria-hidden />
                      ) : insights.trend === "increasing" ? (
                        <TrendingUp className="h-4 w-4 shrink-0 text-amber-300/90" aria-hidden />
                      ) : (
                        <Check className="h-4 w-4 shrink-0" aria-hidden />
                      )}
                      <span>
                        {insights.trend === "decreasing"
                          ? "Improving patterns"
                          : insights.trend === "increasing"
                            ? "Heightened awareness period"
                            : "Stable patterns"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="hidden shrink-0 lg:block lg:w-[38%] xl:w-[42%]" aria-hidden>
                  <div
                    className="relative h-[200px] w-full overflow-hidden rounded-2xl ring-1 ring-white/[0.08]"
                    style={{
                      backgroundImage: `url(${WELLNESS_PLAN_HERO_IMG})`,
                      backgroundSize: "cover",
                      backgroundPosition: "72% 38%",
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#0a0b18]/20 to-[#0a0b18]/60" />
                    <motion.div
                      className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_60%_50%,rgba(251,146,60,0.35)_0%,transparent_65%)]"
                      aria-hidden
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 lg:absolute lg:bottom-6 lg:right-6 lg:mt-0">
                  <button
                    type="button"
                    onClick={() => navigate("/app/settings/wellness-plan")}
                    className={wellnessPlanBtnRose}
                  >
                    <Target className="h-4 w-4" aria-hidden />
                    Safety Plan
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/app/emergency-resources")}
                    className={wellnessPlanBtnGhost}
                  >
                    <Phone className="h-4 w-4" aria-hidden />
                    Resources
                  </button>
                </div>
              </motion.div>
            </motion.section>

            {/* Personalized recommendation */}
            {featuredRecommendation ? (
              <motion.section
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={cn(
                  wellnessPlanGlassCard,
                  "flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6",
                  "border-fuchsia-400/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_48px_-16px_rgba(236,72,153,0.2)]"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={wellnessPlanIconChip("pink")}>
                    <FeaturedIcon className="h-5 w-5" aria-hidden />
                  </div>
                  <div>
                    <h2 className="font-serif text-lg font-light text-white">
                      {featuredRecommendation.title}
                    </h2>
                    <p className="mt-1 max-w-xl text-sm leading-relaxed text-[rgba(255,255,255,0.55)]">
                      {featuredRecommendation.description}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(featuredRecommendation.actionLink)}
                  className={cn(
                    wellnessPlanBtnGhost,
                    "shrink-0 border-fuchsia-400/20 hover:border-fuchsia-400/35 hover:bg-fuchsia-500/[0.08]"
                  )}
                >
                  {featuredRecommendation.action}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
              </motion.section>
            ) : null}

            {/* Analytics grid */}
            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3"
            >
              <SolaceGlassCard className="flex min-h-[320px] flex-col p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-2">
                  <div className={wellnessPlanIconChip("violet")}>
                    <Clock className="h-4 w-4" aria-hidden />
                  </div>
                  <h3 className="font-serif text-lg font-light text-white">Time of Day Patterns</h3>
                </div>
                <div className="min-h-[180px] flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`${chartGradId}-time`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ff4fa3" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#ff4fa3" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "#a1a1aa", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(10,11,24,0.95)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                        labelStyle={{ color: "#e4e4e7" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#ff4fa3"
                        strokeWidth={2}
                        fill={`url(#${chartGradId}-time)`}
                        dot={{ fill: "#ff4fa3", r: 4, strokeWidth: 0 }}
                        style={{ filter: "drop-shadow(0 0 8px rgba(255,79,163,0.45))" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-3 text-xs text-[rgba(255,255,255,0.45)]">
                  Try evening grounding practices
                </p>
              </SolaceGlassCard>

              <SolaceGlassCard className="flex min-h-[320px] flex-col p-5 sm:p-6">
                <div className="mb-2 flex items-center gap-2">
                  <div className={wellnessPlanIconChip("rose")}>
                    <Heart className="h-4 w-4" aria-hidden />
                  </div>
                  <h3 className="font-serif text-lg font-light text-white">Safety State Distribution</h3>
                </div>
                <div className="relative mx-auto h-[180px] w-full max-w-[200px] flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={78}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {donutData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <Heart className="h-6 w-6 text-fuchsia-300/80" aria-hidden />
                  </div>
                </div>
                <p className="mt-2 text-center text-xs leading-relaxed text-[rgba(255,255,255,0.5)]">
                  You&apos;re in a safe state {safePercent}% of the time. Keep going.
                </p>
              </SolaceGlassCard>

              <SolaceGlassCard className="flex min-h-[320px] flex-col p-5 sm:p-6 md:col-span-2 xl:col-span-1">
                <motion.div className="mb-4 flex items-center gap-2">
                  <motion.div className={wellnessPlanIconChip("amber")}>
                    <AlertTriangle className="h-4 w-4" aria-hidden />
                  </motion.div>
                  <h3 className="font-serif text-lg font-light text-white">Top Triggers</h3>
                </motion.div>
                <ul className="flex-1 space-y-3">
                  {triggerRows.length === 0 ? (
                    <li className="text-sm text-[rgba(255,255,255,0.45)]">
                      No triggers recorded yet—your patterns will appear here as you reflect.
                    </li>
                  ) : (
                    triggerRows.map((row) => (
                      <li
                        key={row.label}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-3"
                      >
                        <span className="text-sm text-[rgba(255,255,255,0.82)]">{row.label}</span>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                            row.tone === "high" &&
                              "bg-fuchsia-500/15 text-fuchsia-300 shadow-[0_0_16px_-4px_rgba(255,79,163,0.4)]",
                            row.tone === "medium" && "bg-amber-500/15 text-amber-300",
                            row.tone === "low" && "bg-emerald-500/15 text-emerald-300"
                          )}
                        >
                          {row.severityLabel}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
                <button
                  type="button"
                  onClick={() => navigate("/app/settings/wellness-plan")}
                  className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-fuchsia-300/75 transition-colors hover:text-fuchsia-200"
                >
                  View all triggers
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              </SolaceGlassCard>
            </motion.section>

            {/* Insights summary */}
            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={cn(
                wellnessPlanGlassCard,
                "flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between"
              )}
            >
              <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    icon: Sun,
                    title: "Mood stability",
                    text:
                      insights.trend === "stable" || insights.trend === "decreasing"
                        ? "Your emotional rhythm looks steady lately."
                        : "Check-ins can help you notice shifts early.",
                  },
                  {
                    icon: Leaf,
                    title: "Journaling correlation",
                    text: "Reflective writing often deepens self-understanding.",
                  },
                  {
                    icon: Cloud,
                    title: "Breathing exercises",
                    text:
                      insights.topResources.length > 0
                        ? "Your go-to tools are within reach when you need them."
                        : "Gentle breath work can calm the nervous system.",
                  },
                  {
                    icon: Users,
                    title: "Connection days",
                    text: `${insights.last30DaysCount} safety moments logged this month.`,
                  },
                ].map((block, i) => (
                  <div
                    key={block.title}
                    className={cn(
                      "flex flex-col gap-2 pr-4",
                      i < 3 && "lg:border-r lg:border-white/[0.06]"
                    )}
                  >
                    <div className={wellnessPlanIconChip("violet")}>
                      {(() => {
                        const BlockIcon = block.icon;
                        return <BlockIcon className="h-4 w-4" aria-hidden />;
                      })()}
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[rgba(255,255,255,0.42)]">
                      {block.title}
                    </p>
                    <p className="text-sm leading-relaxed text-[rgba(255,255,255,0.65)]">{block.text}</p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => navigate("/app/progress")}
                className={cn(wellnessPlanBtnGhost, "shrink-0")}
              >
                View Full Insights
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </motion.section>

            {/* Quick actions */}
            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <h2 className="mb-4 font-serif text-lg font-light text-white">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[
                  {
                    icon: Target,
                    title: "Safety Plan",
                    desc: "Your personalized wellness guide",
                    href: "/app/settings/wellness-plan",
                  },
                  {
                    icon: Users,
                    title: "Contacts",
                    desc: "People who care about you",
                    href: "/app/settings/emergency-contacts",
                  },
                  {
                    icon: Heart,
                    title: "Wellness Tools",
                    desc: "Breathing, grounding & more",
                    href: "/app/wellness-tools",
                  },
                  {
                    icon: Award,
                    title: "Progress",
                    desc: "Celebrate your journey",
                    href: "/app/progress",
                  },
                ].map((action) => (
                  <button
                    key={action.title}
                    type="button"
                    onClick={() => navigate(action.href)}
                    className={cn(
                      wellnessPlanGlassCard,
                      "flex min-h-[120px] flex-col items-start gap-3 rounded-[1.5rem] p-5 text-left",
                      "transition-all duration-300 hover:border-fuchsia-400/22 hover:shadow-[0_0_36px_-12px_rgba(236,72,153,0.25)]"
                    )}
                  >
                    <motion.div className={wellnessPlanIconChip("pink")}>{(() => { const ActionIcon = action.icon; return <ActionIcon className="h-5 w-5" aria-hidden />; })()}</motion.div>
                    <div>
                      <p className="text-sm font-semibold text-white">{action.title}</p>
                      <p className="mt-1 text-xs text-[rgba(255,255,255,0.45)]">{action.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.section>

            {/* Emergency banner */}
            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="relative min-h-[140px] overflow-hidden rounded-[1.75rem] border border-fuchsia-400/20"
              aria-labelledby="safety-insights-emergency-heading"
            >
              <img
                src={WELLNESS_PLAN_BANNER_IMG}
                alt=""
                className="absolute inset-0 h-full w-full object-cover object-[20%_50%] brightness-[0.35]"
              />
              <div
                className="absolute inset-0 bg-gradient-to-r from-[#3b0a28]/95 via-[#2a0a24]/80 to-[#1a0a20]/70"
                aria-hidden
              />
              <div
                className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_0%_50%,rgba(255,79,163,0.25)_0%,transparent_60%)]"
                aria-hidden
              />
              <div className="relative flex min-h-[140px] flex-col items-start justify-center gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
                <div>
                  <h2
                    id="safety-insights-emergency-heading"
                    className="font-serif text-xl font-light text-white sm:text-2xl"
                  >
                    Helpful Resources — Available 24/7
                  </h2>
                  <p className="mt-2 text-sm text-[rgba(255,255,255,0.6)]">
                    You are not alone. Help is always available.
                  </p>
                </div>
                <Link
                  to="/app/emergency-resources"
                  className={cn(
                    "inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-full px-6 py-3",
                    "bg-white text-sm font-semibold text-fuchsia-900",
                    "shadow-[0_0_32px_-6px_rgba(255,255,255,0.35)] transition hover:bg-white/95"
                  )}
                >
                  Emergency Resources
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </motion.section>
          </div>

          <SafetyInsightsRail
            safetyScore={insights.safetyScore}
            trend={insights.trend}
            last30DaysCount={insights.last30DaysCount}
            checkIns={checkIns}
          />
        </div>
      </div>
    </motion.div>
  );
}
