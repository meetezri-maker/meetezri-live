/**
 * Solace — Personal Safety Insights
 * Cinematic emotional wellness sanctuary (not analytics dashboard).
 */

import { useMemo, useId } from "react";
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
import {
  getMostUsedResources,
  getInteractionsBySafetyState,
  getInteractionsByTimePeriod,
  getResourceInteractions,
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
  wellnessPlanHeroLightScrim,
  wellnessPlanHeroOverlayAccent,
  wellnessPlanHeroOverlayBottom,
  wellnessPlanHeroOverlayReadability,
  wellnessPlanHeroTitle,
  wellnessPlanIconChip,
  safetyInsightsEmergencyCta,
  safetyInsightsPageAtmosphere,
  safetyInsightsResourcesBanner,
  safetyInsightsResourcesBannerOverlayAccent,
  safetyInsightsResourcesBannerOverlayDark,
  wellnessPlanBottomBannerBody,
  wellnessPlanBottomBannerContent,
  wellnessPlanBottomBannerImg,
  wellnessPlanBottomBannerTitle,
  wellnessPlanPageFogMid,
  wellnessPlanPageGlowTop,
  wellnessPlanPageVignette,
} from "@/app/pages/app/wellness-plan-settings/wellnessPlanSettingsUi";
import { SafetyInsightsRail } from "@/app/pages/app/safety-insights/SafetyInsightsRail";
import {
  buildCheckInEntries,
  buildInsightsAnalyticsCharts,
  breathingResourcesSummary,
  computeSafetyInsights,
  connectionDaysSummary,
  journalingSummary,
  loadLocalSafetyEvents,
  mergeSafetyHistories,
  moodStabilitySummary,
  safetyEventsFromResourceInteractions,
  thirtyDaysAgo,
} from "@/app/pages/app/safety-insights/safetyInsightsData";
import type { MoodEntryForInsights } from "@/app/pages/app/safety-insights/safetyInsightsData";

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

interface DonutSegment {
  name: string;
  value: number;
  color: string;
}

interface MoodDonutTooltipProps {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: DonutSegment }>;
}

function MoodDonutTooltip({ active, payload }: MoodDonutTooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const name = item.name ?? item.payload?.name ?? "Mood";
  const value = item.value ?? item.payload?.value ?? 0;
  const color = item.payload?.color ?? "#a78bfa";

  return (
    <div className="rounded-xl border border-white/15 bg-[#0c0d18] px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.55)]">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <span className="text-sm font-medium text-white">{name}</span>
      </div>
      <p className="mt-0.5 pl-[18px] text-xs font-semibold tabular-nums text-fuchsia-200">{value}%</p>
    </div>
  );
}

interface DonutLegendProps {
  segments: DonutSegment[];
}

function DonutLegend({ segments }: DonutLegendProps) {
  if (segments.length === 0) return null;
  return (
    <ul
      className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1.5"
      aria-label="Chart legend"
    >
      {segments.map((seg) => (
        <li key={seg.name} className="flex items-center gap-1.5 text-[11px] text-[rgba(255,255,255,0.72)]">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: seg.color }}
            aria-hidden
          />
          <span>
            {seg.name} <span className="tabular-nums text-[rgba(255,255,255,0.45)]">{seg.value}%</span>
          </span>
        </li>
      ))}
    </ul>
  );
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
  const { user, isLoading: authLoading } = useAuth();
  const userId = user?.id;
  const chartGradId = useId().replace(/:/g, "");

  const periodStart = useMemo(() => thirtyDaysAgo(), []);
  const periodEnd = useMemo(() => new Date(), []);

  const resourceIdToName = useMemo(() => {
    const resources = getSafetyResources();
    return new Map(resources.map((r) => [r.id, r.name]));
  }, []);

  const rangeIso = useMemo(
    () => ({
      from: periodStart.toISOString(),
      to: periodEnd.toISOString(),
    }),
    [periodStart, periodEnd]
  );

  const {
    data: rawSafetyResourceIx,
    isLoading: resourcesLoading,
    isError: resourcesError,
    isSuccess: resourcesSuccess,
    refetch: refetchResources,
    isFetching: resourcesFetching,
  } = useQuery({
    queryKey: queryKeys.safetyResourceInteractions.list({
      userId,
      from: rangeIso.from,
      to: rangeIso.to,
      window: "safety-insights-30d",
    }),
    queryFn: async () => {
      const rows = (await api.safetyResourceInteractions.list({
        from: rangeIso.from,
        to: rangeIso.to,
        limit: 5000,
      })) as Array<Record<string, unknown>>;
      return Array.isArray(rows) ? rows : [];
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  const {
    data: moodEntries = [],
    isLoading: moodsLoading,
    isError: moodsError,
    refetch: refetchMoods,
  } = useQuery({
    queryKey: queryKeys.moods.my(userId),
    queryFn: async () => {
      const raw = (await api.moods.getMyMoods()) as MoodEntryForInsights[];
      return Array.isArray(raw) ? raw : [];
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  const serverInteractions = useMemo(
    () => mapServerRowsToInteractions(rawSafetyResourceIx ?? []),
    [rawSafetyResourceIx]
  );

  const localInteractions = useMemo(
    () => getInteractionsByTimePeriod(periodStart, periodEnd, getResourceInteractions()),
    [periodStart, periodEnd]
  );

  const resourceInteractions = useMemo(() => {
    if (serverInteractions.length > 0) return serverInteractions;
    if (resourcesSuccess || resourcesError) return localInteractions;
    return [];
  }, [serverInteractions, localInteractions, resourcesSuccess, resourcesError]);

  const safetyHistory = useMemo(() => {
    if (!userId) return [];
    const localEvents = loadLocalSafetyEvents(userId);
    const derived = safetyEventsFromResourceInteractions(resourceInteractions, userId);
    return mergeSafetyHistories(localEvents, derived);
  }, [userId, resourceInteractions]);

  const insights = useMemo(() => {
    const topResources = getMostUsedResources(3, resourceInteractions);
    const resourcesByState = getInteractionsBySafetyState(resourceInteractions);
    return computeSafetyInsights({
      events: safetyHistory,
      topResources,
      resourcesByState,
      currentState,
      moods: moodEntries,
    });
  }, [safetyHistory, resourceInteractions, currentState, moodEntries]);

  const dataReady =
    !authLoading && (!userId || (!resourcesLoading && !moodsLoading));

  const hasDataIssue = !!userId && (resourcesError || moodsError);

  const analyticsCharts = useMemo(() => {
    if (!insights) return null;
    return buildInsightsAnalyticsCharts(insights, moodEntries, safetyHistory);
  }, [insights, moodEntries, safetyHistory]);

  const featuredRecommendation = useMemo(() => {
    if (!insights) return null;
    return (
      insights.recommendations.find((r) => r.type === "selfcare") ?? insights.recommendations[0]
    );
  }, [insights]);

  const checkIns = useMemo(
    () => buildCheckInEntries(moodEntries, safetyHistory, 6),
    [moodEntries, safetyHistory]
  );

  const summaryCopy = useMemo(() => {
    if (!insights) return null;
    const moodsLast30 = moodEntries.filter(
      (m) => new Date(m.created_at) >= periodStart
    );
    return {
      mood: moodStabilitySummary(moodsLast30, insights.trend),
      journal: journalingSummary(moodsLast30),
      breathing: breathingResourcesSummary(insights.topResources, resourceIdToName),
      connection: connectionDaysSummary(
        insights.moodCheckInsLast30,
        insights.last30DaysCount
      ),
    };
  }, [insights, moodEntries, periodStart, resourceIdToName]);

  if (!dataReady) {
    return (
      <motion.div className={safetyInsightsPageAtmosphere}>
        <motion.div className={wellnessPlanPageGlowTop} aria-hidden />
        <div className="relative z-10 flex min-h-[50vh] flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-fuchsia-300/60" aria-label="Loading" />
          <p className="text-sm text-[rgba(255,255,255,0.45)]">Loading your safety insights…</p>
        </div>
      </motion.div>
    );
  }

  const scoreLabel = getScoreLabel(insights.safetyScore);
  const FeaturedIcon = featuredRecommendation?.icon ?? Heart;

  return (
    <motion.div
      className={safetyInsightsPageAtmosphere}
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

            {hasDataIssue ? (
              <div
                className={cn(
                  wellnessPlanGlassCard,
                  "flex flex-wrap items-center justify-between gap-3 border-amber-400/20 p-4"
                )}
                role="status"
              >
                <p className="text-sm text-amber-200/85">
                  Some data could not be synced. Showing what is available on this device.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    void refetchResources();
                    void refetchMoods();
                  }}
                  disabled={resourcesFetching}
                  className={wellnessPlanBtnGhost}
                >
                  {resourcesFetching ? "Retrying…" : "Retry sync"}
                </button>
              </div>
            ) : null}

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
                width={1600}
                height={900}
                loading="eager"
                decoding="async"
              />
              <div className={wellnessPlanHeroLightScrim} aria-hidden />
              <div className={wellnessPlanHeroOverlayReadability} aria-hidden />
              <div className={wellnessPlanHeroOverlayAccent} aria-hidden />
              <div className={wellnessPlanHeroOverlayBottom} aria-hidden />

              <motion.div className="relative z-10 flex min-h-[280px] flex-col gap-6 p-6 sm:min-h-[300px] sm:p-8 lg:min-h-[320px] lg:flex-row lg:items-center lg:justify-between lg:gap-8">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center lg:flex-1">
                  <SafetyScoreRing score={insights.safetyScore} />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-serif text-2xl font-light text-white sm:text-3xl [html[data-ezri-theme=light]_&]:text-[var(--text-primary)] [html[data-theme=light]_&]:text-[var(--text-primary)]">
                      {scoreLabel} Wellness
                    </h2>
                    <p className="settings-subpage-hero-body mt-2 text-sm">
                      Based on {insights.moodCheckInsLast30} mood check-in
                      {insights.moodCheckInsLast30 === 1 ? "" : "s"} and{" "}
                      {insights.last30DaysCount} safety moment
                      {insights.last30DaysCount === 1 ? "" : "s"} in the last 30 days
                    </p>
                    <p className={cn("mt-3 max-w-md text-sm leading-relaxed", "text-rose-200/75 [html[data-ezri-theme=light]_&]:text-[var(--text-secondary)] [html[data-theme=light]_&]:text-[var(--text-secondary)]")}>
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

                <div className="flex flex-wrap gap-3 lg:mt-0">
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
                <div className="h-[180px] w-full">
                  {analyticsCharts && analyticsCharts.timeChartTotal > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={analyticsCharts.timeChartData}
                        margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                      >
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
                        <YAxis
                          allowDecimals={false}
                          tick={{ fill: "#71717a", fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          width={28}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "rgba(10,11,24,0.95)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 12,
                            fontSize: 12,
                          }}
                          labelStyle={{ color: "#e4e4e7" }}
                          formatter={(value: number) => [
                            `${value} check-in${value === 1 ? "" : "s"}`,
                            "Activity",
                          ]}
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
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                      <p className="text-sm text-[rgba(255,255,255,0.5)]">No activity yet</p>
                      <Link
                        to="/app/mood-check-in"
                        className="text-xs font-medium text-fuchsia-300/80 hover:text-fuchsia-200"
                      >
                        Log a mood check-in
                      </Link>
                    </div>
                  )}
                </div>
                <p className="mt-3 text-xs text-[rgba(255,255,255,0.45)]">
                  {analyticsCharts?.timeHint}
                  {analyticsCharts && analyticsCharts.timeChartTotal > 0
                    ? ` (${analyticsCharts.timeChartTotal} total in the last 30 days.)`
                    : ""}
                </p>
              </SolaceGlassCard>

              <SolaceGlassCard className="flex min-h-[320px] flex-col p-5 sm:p-6">
                <div className="mb-2 flex items-center gap-2">
                  <div className={wellnessPlanIconChip("rose")}>
                    <Heart className="h-4 w-4" aria-hidden />
                  </div>
                  <h3 className="font-serif text-lg font-light text-white">
                    {analyticsCharts?.donutUsesMoods
                      ? "Mood Check-in Mix"
                      : "Safety State Distribution"}
                  </h3>
                </div>
                {analyticsCharts?.donutUsesMoods ? (
                  <p className="mb-2 text-center text-[10px] text-[rgba(255,255,255,0.38)]">
                    Based on your last 30 days of mood check-ins
                  </p>
                ) : null}
                <div className="relative mx-auto h-[180px] w-full max-w-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analyticsCharts?.donutData ?? []}
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={78}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {(analyticsCharts?.donutData ?? []).map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={<MoodDonutTooltip />}
                        wrapperStyle={{ zIndex: 20, outline: "none" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <Heart className="h-6 w-6 text-fuchsia-300/80" aria-hidden />
                  </div>
                </div>
                <DonutLegend segments={analyticsCharts?.donutData ?? []} />
                <p className="mt-2 text-center text-xs leading-relaxed text-[rgba(255,255,255,0.5)]">
                  {analyticsCharts?.donutFooter}
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
                  {(analyticsCharts?.triggerRows.length ?? 0) === 0 ? (
                    <li className="text-sm text-[rgba(255,255,255,0.45)]">
                      No patterns yet—mood check-ins and safety moments will populate this list.
                    </li>
                  ) : (
                    analyticsCharts?.triggerRows.map((row) => (
                      <li
                        key={row.label}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-3"
                      >
                        <div className="min-w-0">
                          <span className="text-sm text-[rgba(255,255,255,0.82)]">{row.label}</span>
                          <p className="mt-0.5 text-[10px] text-[rgba(255,255,255,0.38)]">
                            {row.count} time{row.count === 1 ? "" : "s"} (30d)
                          </p>
                        </div>
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
                    text: summaryCopy?.mood ?? "",
                  },
                  {
                    icon: Leaf,
                    title: "Journaling correlation",
                    text: summaryCopy?.journal ?? "",
                  },
                  {
                    icon: Cloud,
                    title: "Breathing exercises",
                    text: summaryCopy?.breathing ?? "",
                  },
                  {
                    icon: Users,
                    title: "Connection days",
                    text: summaryCopy?.connection ?? "",
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
              className={safetyInsightsResourcesBanner}
              aria-labelledby="safety-insights-emergency-heading"
            >
              <img src={WELLNESS_PLAN_BANNER_IMG} alt="" className={wellnessPlanBottomBannerImg} />
              <div className={safetyInsightsResourcesBannerOverlayDark} aria-hidden />
              <div className={safetyInsightsResourcesBannerOverlayAccent} aria-hidden />
              <div className={cn(wellnessPlanBottomBannerContent, "gap-4")}>
                <div>
                  <h2 id="safety-insights-emergency-heading" className={wellnessPlanBottomBannerTitle}>
                    Helpful Resources — Available 24/7
                  </h2>
                  <p className={wellnessPlanBottomBannerBody}>
                    You are not alone. Help is always available.
                  </p>
                </div>
                <Link to="/app/emergency-resources" className={safetyInsightsEmergencyCta}>
                  Emergency Resources
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </motion.section>
          </div>

          <SafetyInsightsRail insights={insights} checkIns={checkIns} />
        </div>
      </div>
    </motion.div>
  );
}
