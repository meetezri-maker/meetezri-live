/**
 * EZRI — RESOURCE ANALYTICS
 * Cinematic wellness analytics sanctuary (real interaction data only).
 */

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Eye,
  Phone,
  BarChart3,
  BookOpen,
  Calendar,
  Download,
  RefreshCw,
  Loader2,
  ChevronRight,
  Sun,
  Star,
  Activity,
  HeartPulse,
} from 'lucide-react';
import { SolaceGlassCard, SolaceSelect } from '@/app/solace';
import { cn } from '@/lib/utils';
import {
  wellnessPlanPageAtmosphere,
  wellnessPlanPageGlowTop,
  wellnessPlanPageFogMid,
  wellnessPlanPageVignette,
  wellnessPlanBackLink,
  wellnessPlanHeroTitle,
  wellnessPlanHeroCard,
  wellnessPlanHeroImage,
  wellnessPlanHeroLightScrim,
  wellnessPlanHeroOverlayAccent,
  wellnessPlanHeroOverlayBottom,
  wellnessPlanHeroOverlayReadability,
  wellnessPlanIconChip,
  wellnessPlanGlassCard,
  wellnessPlanBtnGhost,
  WELLNESS_PLAN_HERO_IMG,
} from '@/app/pages/app/wellness-plan-settings/wellnessPlanSettingsUi';
import {
  getAllResourceAnalytics,
  getMostUsedResources,
  getResourceEffectivenessScore,
  getInteractionsByResourceType,
  getInteractionsByTimePeriod,
  exportResourceAnalytics,
  mapServerRowsToInteractions,
  getResourceInteractions,
} from '@/app/utils/resourceTracking';
import { getSafetyResources } from '@/app/utils/safetyResources';
import { useAuth } from '@/app/contexts/AuthContext';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import { ResourceAnalyticsRail } from './resource-analytics/ResourceAnalyticsRail';
import {
  MiniSparkline,
  SupportActivityTimeline,
} from './resource-analytics/ResourceAnalyticsVisuals';
import {
  aggregateBucketsWeekly,
  buildDailyBuckets,
  comparePeriods,
  computeSupportResponseRate,
  effectivenessToStars,
  formatComparisonLine,
  getActiveDaysInPeriod,
  getEmotionalEngagementLabel,
  getEngagementLevel,
  getMostActivePeriod,
  getResourceTypeColor,
  getResourceTypeForId,
  getResourceTypeLabel,
  getTopReachOutDays,
  mergeInteractionSets,
  sparklineFromBuckets,
  type ChartInterval,
} from './resource-analytics/resourceAnalyticsUtils';

const TIME_FILTER_LABELS: Record<'7d' | '30d' | '90d' | 'all', string> = {
  '7d': 'last 7 days',
  '30d': 'last 30 days',
  '90d': 'last 90 days',
  all: 'all time',
};

interface MetricCardProps {
  label: string;
  value: string | number;
  comparison: string | null;
  icon: ReactNode;
  iconGlow: string;
  sparkData: number[];
  sparkColor: string;
}

function MetricCard({
  label,
  value,
  comparison,
  icon,
  iconGlow,
  sparkData,
  sparkColor,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        wellnessPlanGlassCard,
        'flex min-h-[132px] flex-col justify-between rounded-3xl p-5',
        'border-white/[0.06] bg-[linear-gradient(160deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.01)_55%,rgba(0,0,0,0.15)_100%)]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
            iconGlow
          )}
        >
          {icon}
        </div>
        <MiniSparkline data={sparkData} stroke={sparkColor} />
      </div>
      <div className="mt-4">
        <p className="text-3xl font-light tabular-nums text-white">{value}</p>
        <p className="mt-1 text-xs font-medium text-[rgba(255,255,255,0.5)]">{label}</p>
        {comparison ? (
          <p
            className={cn(
              'mt-1.5 text-[11px] font-medium',
              comparison.startsWith('↑')
                ? 'text-emerald-400/85'
                : comparison.startsWith('↓')
                  ? 'text-amber-300/80'
                  : 'text-[rgba(255,255,255,0.4)]'
            )}
          >
            {comparison}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function ResourceAnalyticsPage() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const userId = user?.id ?? profile?.id ?? null;
  const [timeFilter, setTimeFilter] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [chartInterval, setChartInterval] = useState<ChartInterval>('daily');

  const range = useMemo(() => {
    const now = new Date();
    const isoEnd = now.toISOString();
    switch (timeFilter) {
      case '7d':
        return {
          from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          to: isoEnd,
        };
      case '30d':
        return {
          from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          to: isoEnd,
        };
      case '90d':
        return {
          from: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          to: isoEnd,
        };
      default:
        return {};
    }
  }, [timeFilter]);

  const periodBounds = useMemo(() => {
    const now = new Date();
    switch (timeFilter) {
      case '7d':
        return {
          start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          end: now,
        };
      case '30d':
        return {
          start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          end: now,
        };
      case '90d':
        return {
          start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
          end: now,
        };
      default:
        return { start: new Date(0), end: now };
    }
  }, [timeFilter]);

  const {
    data: rawRows,
    isLoading,
    isError,
    isSuccess,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: queryKeys.safetyResourceInteractions.list({
      userId,
      from: range.from,
      to: range.to,
      window: timeFilter,
    }),
    queryFn: async () => {
      const rows = (await api.safetyResourceInteractions.list({
        from: range.from,
        to: range.to,
        limit: 5000,
      })) as Array<Record<string, unknown>>;
      return Array.isArray(rows) ? rows : [];
    },
    enabled: !!userId,
    staleTime: 30_000,
  });

  const serverInteractions = useMemo(
    () => mapServerRowsToInteractions(rawRows ?? []),
    [rawRows]
  );

  const localInteractionsFiltered = useMemo(
    () =>
      getInteractionsByTimePeriod(
        periodBounds.start,
        periodBounds.end,
        getResourceInteractions()
      ),
    [periodBounds.start, periodBounds.end]
  );

  const interactions = useMemo(() => {
    if (!(isSuccess || isError)) return [];
    return mergeInteractionSets(serverInteractions, localInteractionsFiltered);
  }, [serverInteractions, localInteractionsFiltered, isSuccess, isError]);

  const { recentHalfInteractions, priorHalfInteractions } = useMemo(() => {
    const midMs =
      periodBounds.start.getTime() +
      (periodBounds.end.getTime() - periodBounds.start.getTime()) / 2;
    const mid = new Date(midMs);
    const prior: typeof interactions = [];
    const recent: typeof interactions = [];
    interactions.forEach((ix) => {
      const t = new Date(ix.timestamp);
      if (t < mid) prior.push(ix);
      else recent.push(ix);
    });
    return { recentHalfInteractions: recent, priorHalfInteractions: prior };
  }, [interactions, periodBounds.start, periodBounds.end]);

  const dataSourceNote: 'synced' | 'local_fallback' | 'offline' =
    serverInteractions.length > 0
      ? 'synced'
      : isError
        ? 'offline'
        : localInteractionsFiltered.length > 0
          ? 'local_fallback'
          : 'synced';

  const analytics = useMemo(
    () => getAllResourceAnalytics(interactions),
    [interactions]
  );

  const recentHalfAnalytics = useMemo(
    () => getAllResourceAnalytics(recentHalfInteractions),
    [recentHalfInteractions]
  );

  const priorHalfAnalytics = useMemo(
    () => getAllResourceAnalytics(priorHalfInteractions),
    [priorHalfInteractions]
  );

  const mostUsed = useMemo(() => getMostUsedResources(4, interactions), [interactions]);

  const byType = useMemo(() => getInteractionsByResourceType(interactions), [interactions]);

  const dailyBuckets = useMemo(
    () => buildDailyBuckets(interactions, periodBounds.start, periodBounds.end),
    [interactions, periodBounds.start, periodBounds.end]
  );

  const chartBuckets = useMemo(() => {
    if (chartInterval === 'weekly' || timeFilter === '90d' || timeFilter === 'all') {
      return aggregateBucketsWeekly(dailyBuckets);
    }
    return dailyBuckets;
  }, [chartInterval, dailyBuckets, timeFilter]);

  const handleExport = () => {
    const data = exportResourceAnalytics(interactions);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resource-analytics-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const totalInteractions = useMemo(
    () => Object.values(analytics).reduce((sum, a) => sum + a.totalViews + a.totalClicks, 0),
    [analytics]
  );

  const totalClicks = useMemo(
    () => Object.values(analytics).reduce((sum, a) => sum + a.totalClicks, 0),
    [analytics]
  );

  const recentTotalInteractions = useMemo(
    () =>
      Object.values(recentHalfAnalytics).reduce((sum, a) => sum + a.totalViews + a.totalClicks, 0),
    [recentHalfAnalytics]
  );

  const priorTotalInteractions = useMemo(
    () =>
      Object.values(priorHalfAnalytics).reduce((sum, a) => sum + a.totalViews + a.totalClicks, 0),
    [priorHalfAnalytics]
  );

  const recentTotalClicks = useMemo(
    () => Object.values(recentHalfAnalytics).reduce((sum, a) => sum + a.totalClicks, 0),
    [recentHalfAnalytics]
  );

  const priorTotalClicks = useMemo(
    () => Object.values(priorHalfAnalytics).reduce((sum, a) => sum + a.totalClicks, 0),
    [priorHalfAnalytics]
  );

  const supportResponseRate = useMemo(
    () => computeSupportResponseRate(interactions),
    [interactions]
  );

  const avgCtr = useMemo(() => {
    if (interactions.length === 0) return '0';
    return supportResponseRate.toFixed(1);
  }, [interactions.length, supportResponseRate]);

  const recentAvgCtr = useMemo(
    () => computeSupportResponseRate(recentHalfInteractions),
    [recentHalfInteractions]
  );

  const priorAvgCtr = useMemo(
    () => computeSupportResponseRate(priorHalfInteractions),
    [priorHalfInteractions]
  );

  const resourcesExplored = Object.keys(analytics).length;
  const recentResourcesExplored = Object.keys(recentHalfAnalytics).length;
  const priorResourcesExplored = Object.keys(priorHalfAnalytics).length;

  const comparisonLabel = `first half of ${TIME_FILTER_LABELS[timeFilter]}`;

  const comparisons = useMemo(
    () => ({
      interactions: formatComparisonLine(
        comparePeriods(recentTotalInteractions, priorTotalInteractions),
        comparisonLabel
      ),
      engagements: formatComparisonLine(
        comparePeriods(recentTotalClicks, priorTotalClicks),
        comparisonLabel
      ),
      ctr: formatComparisonLine(
        comparePeriods(recentAvgCtr, priorAvgCtr),
        comparisonLabel
      ),
      resources: formatComparisonLine(
        comparePeriods(recentResourcesExplored, priorResourcesExplored),
        comparisonLabel
      ),
    }),
    [
      recentTotalInteractions,
      priorTotalInteractions,
      recentTotalClicks,
      priorTotalClicks,
      recentAvgCtr,
      priorAvgCtr,
      recentResourcesExplored,
      priorResourcesExplored,
      comparisonLabel,
    ]
  );

  const engagement = useMemo(
    () => getEngagementLevel(interactions.length, supportResponseRate),
    [interactions.length, supportResponseRate]
  );

  const activeDaysInPeriod = useMemo(
    () => getActiveDaysInPeriod(interactions, periodBounds.start, periodBounds.end),
    [interactions, periodBounds.start, periodBounds.end]
  );

  const emotionalEngagement = useMemo(
    () => getEmotionalEngagementLabel(interactions, supportResponseRate),
    [interactions, supportResponseRate]
  );

  const topCategory = useMemo(() => {
    const entries = Object.entries(byType).sort(([, a], [, b]) => b - a);
    if (entries.length === 0) return 'Not enough data yet';
    return getResourceTypeLabel(entries[0][0]);
  }, [byType]);

  const mostActivePeriod = useMemo(() => getMostActivePeriod(interactions), [interactions]);
  const topDays = useMemo(() => getTopReachOutDays(interactions), [interactions]);

  const getResourceName = useCallback(
    (resourceId: string): string => {
      const fromEvent = interactions.find((i) => i.resourceId === resourceId)?.resourceName;
      if (fromEvent?.trim()) return fromEvent.trim();
      const allResources = getSafetyResources();
      const resource = allResources.find((r) => r.id === resourceId);
      return resource?.name || resourceId.replace(/^web_/i, '').replace(/_/g, ' ');
    },
    [interactions]
  );

  if (authLoading) {
    return (
      <div className={wellnessPlanPageAtmosphere}>
        <div className="relative z-10 flex min-h-[50vh] flex-col items-center justify-center gap-4 text-[rgba(255,255,255,0.5)]">
          <Loader2 className="h-10 w-10 animate-spin text-fuchsia-300/60" aria-hidden />
          <p>Loading your analytics sanctuary…</p>
        </div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className={wellnessPlanPageAtmosphere}>
        <div className="relative z-10 mx-auto max-w-lg px-6 py-16 text-center">
          <SolaceGlassCard className="p-8">
            <p className="text-[rgba(255,255,255,0.55)]">Sign in to view resource analytics.</p>
          </SolaceGlassCard>
        </div>
      </div>
    );
  }

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
        <div className="mb-6 flex flex-col gap-4 sm:mb-7 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/app/settings" className={wellnessPlanBackLink}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to Settings
          </Link>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:gap-3">
            <label className="sr-only" htmlFor="ra-time-filter">
              Date range
            </label>
            <div className="flex min-h-[44px] items-center gap-2 rounded-full border border-white/[0.1] bg-black/35 px-3 backdrop-blur-md">
              <Calendar className="h-4 w-4 shrink-0 text-[rgba(255,255,255,0.45)]" aria-hidden />
              <SolaceSelect
                id="ra-time-filter"
                value={timeFilter}
                onValueChange={(v) => setTimeFilter(v as typeof timeFilter)}
                ariaLabel="Date range"
                variant="compact"
                size="sm"
                disabled={isLoading}
                triggerClassName="min-h-[44px] border-0 bg-transparent px-0 py-0 text-sm text-[rgba(255,255,255,0.88)] shadow-none hover:bg-transparent"
                options={[
                  { value: '7d', label: 'Last 7 days' },
                  { value: '30d', label: 'Last 30 days' },
                  { value: '90d', label: 'Last 90 days' },
                  { value: 'all', label: 'All time' },
                ]}
              />
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className={cn(wellnessPlanBtnGhost, 'min-h-[44px] min-w-[44px] px-4')}
              aria-label="Refresh analytics"
            >
              <RefreshCw
                className={cn('h-4 w-4', isFetching && 'animate-spin')}
                aria-hidden
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={interactions.length === 0}
              className={cn(
                'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white',
                'bg-[linear-gradient(135deg,#7c3aed_0%,#db2777_55%,#ec4899_100%)]',
                'border border-white/10 shadow-[0_0_32px_-8px_rgba(168,85,247,0.55)]',
                'transition-all hover:brightness-110 disabled:opacity-45'
              )}
            >
              <Download className="h-4 w-4" aria-hidden />
              Export insights
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] xl:gap-7">
          {/* Main column ~72% */}
          <div className="min-w-0 space-y-7">
            {/* 1. Cinematic hero */}
            <motion.section
              className={wellnessPlanHeroCard}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <img
                src={WELLNESS_PLAN_HERO_IMG}
                alt=""
                className={wellnessPlanHeroImage}
                width={1600}
                height={900}
              />
              <div className={wellnessPlanHeroLightScrim} aria-hidden />
              <div className={wellnessPlanHeroOverlayReadability} aria-hidden />
              <div className={wellnessPlanHeroOverlayAccent} aria-hidden />
              <div className={wellnessPlanHeroOverlayBottom} aria-hidden />

              <div className="relative z-10 flex min-h-[240px] flex-col justify-center p-5 sm:min-h-[260px] sm:p-7 lg:min-h-[280px]">
                <div className="flex flex-1 flex-col justify-end">
                  <div className="flex flex-wrap items-start gap-4">
                    <div className={wellnessPlanIconChip('pink')}>
                      <BarChart3 className="h-7 w-7 text-fuchsia-200" aria-hidden />
                    </div>
                    <div>
                      <h1 className={wellnessPlanHeroTitle}>Resource Analytics</h1>
                      <p className="settings-subpage-hero-lead mt-2 max-w-xl">
                        Understanding what support resources helped you most.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>

            {/* Sync / offline notices */}
            {dataSourceNote === 'offline' && interactions.length > 0 ? (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-100/90">
                Could not reach the server. Showing activity saved in this browser.{' '}
                <button type="button" className="font-semibold underline" onClick={() => refetch()}>
                  Retry sync
                </button>
              </div>
            ) : null}

            {dataSourceNote === 'local_fallback' &&
            interactions.length > 0 &&
            !isError &&
            serverInteractions.length === 0 &&
            isSuccess ? (
              <div className="rounded-2xl border border-violet-400/18 bg-violet-500/[0.08] px-4 py-3 text-sm text-violet-100/88">
                Showing browser-logged activity for this period.{' '}
                <Link className="font-semibold underline" to="/app/emergency-resources">
                  Emergency resources
                </Link>{' '}
                sync to your account when the API is available.
              </div>
            ) : null}

            {isError && interactions.length === 0 ? (
              <SolaceGlassCard className="border-rose-400/20 p-5">
                <p className="text-sm text-rose-200/85">
                  Could not load analytics from the server. Use Emergency resources once, then retry.
                </p>
                <button
                  type="button"
                  className={cn(wellnessPlanBtnGhost, 'mt-4')}
                  onClick={() => refetch()}
                >
                  Retry
                </button>
              </SolaceGlassCard>
            ) : null}

            {isLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={cn(wellnessPlanGlassCard, 'h-32 animate-pulse rounded-3xl')}
                  />
                ))}
              </div>
            ) : (
              <>
                {/* 2. Overview metrics */}
                <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricCard
                    label="Total Interactions"
                    value={totalInteractions}
                    comparison={comparisons.interactions}
                    icon={<Eye className="h-5 w-5 text-cyan-200" aria-hidden />}
                    iconGlow="bg-[radial-gradient(circle,rgba(34,211,238,0.35)_0%,rgba(139,92,246,0.12)_70%)] shadow-[0_0_24px_-6px_rgba(34,211,238,0.45)]"
                    sparkData={sparklineFromBuckets(dailyBuckets, 'interactions')}
                    sparkColor="#22d3ee"
                  />
                  <MetricCard
                    label="Total Engagements"
                    value={totalClicks}
                    comparison={comparisons.engagements}
                    icon={<Phone className="h-5 w-5 text-pink-200" aria-hidden />}
                    iconGlow="bg-[radial-gradient(circle,rgba(236,72,153,0.35)_0%,rgba(168,85,247,0.1)_70%)] shadow-[0_0_24px_-6px_rgba(236,72,153,0.45)]"
                    sparkData={sparklineFromBuckets(dailyBuckets, 'engagements')}
                    sparkColor="#f472b6"
                  />
                  <MetricCard
                    label="Avg Support Response Rate"
                    value={`${avgCtr}%`}
                    comparison={comparisons.ctr}
                    icon={<HeartPulse className="h-5 w-5 text-emerald-200" aria-hidden />}
                    iconGlow="bg-[radial-gradient(circle,rgba(52,211,153,0.32)_0%,rgba(34,211,238,0.1)_70%)] shadow-[0_0_24px_-6px_rgba(52,211,153,0.4)]"
                    sparkData={sparklineFromBuckets(dailyBuckets, 'engagements')}
                    sparkColor="#34d399"
                  />
                  <MetricCard
                    label="Resources Explored"
                    value={resourcesExplored}
                    comparison={comparisons.resources}
                    icon={<BookOpen className="h-5 w-5 text-amber-200" aria-hidden />}
                    iconGlow="bg-[radial-gradient(circle,rgba(251,191,36,0.32)_0%,rgba(249,115,22,0.08)_70%)] shadow-[0_0_24px_-6px_rgba(251,191,36,0.4)]"
                    sparkData={sparklineFromBuckets(dailyBuckets, 'views')}
                    sparkColor="#fbbf24"
                  />
                </section>

                {/* 3. Support Activity Timeline */}
                <SolaceGlassCard className="p-5 sm:p-6">
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-serif text-xl font-light text-white">
                        Support Activity Timeline
                      </h2>
                      <p className="mt-1 text-sm text-[rgba(255,255,255,0.48)]">
                        Your engagement with support resources over time.
                      </p>
                    </div>
                    <label className="sr-only" htmlFor="ra-chart-interval">
                      Chart interval
                    </label>
                    <SolaceSelect
                      id="ra-chart-interval"
                      value={chartInterval}
                      onValueChange={(v) => setChartInterval(v as ChartInterval)}
                      ariaLabel="Chart interval"
                      variant="compact"
                      triggerClassName="min-h-[44px] rounded-full"
                      options={[
                        { value: 'daily', label: 'Daily' },
                        { value: 'weekly', label: 'Weekly' },
                      ]}
                    />
                  </div>

                  <SupportActivityTimeline
                    data={chartBuckets}
                    isEmpty={interactions.length === 0}
                  />

                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
                      <div className="flex items-center gap-2 text-xs font-medium text-amber-200/85">
                        <Sun className="h-4 w-4 shrink-0" aria-hidden />
                        Most active periods
                      </div>
                      <p className="mt-1.5 text-sm text-[rgba(255,255,255,0.65)]">
                        {mostActivePeriod ?? 'Not enough data yet'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
                      <div className="flex items-center gap-2 text-xs font-medium text-violet-200/85">
                        <Calendar className="h-4 w-4 shrink-0" aria-hidden />
                        Days you reached out most
                      </div>
                      <p className="mt-1.5 text-sm text-[rgba(255,255,255,0.65)]">
                        {topDays.length > 0 ? topDays.join(' • ') : 'Not enough data yet'}
                      </p>
                    </div>
                  </div>
                </SolaceGlassCard>

                {/* 4. Most Helpful Resources */}
                <section>
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h2 className="font-serif text-xl font-light text-white">
                        Most Helpful Resources
                      </h2>
                      <p className="mt-1 text-sm text-[rgba(255,255,255,0.48)]">
                        Resources you&apos;ve used and engaged with the most.
                      </p>
                    </div>
                    <Link
                      to="/app/settings/resources "
                      className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-fuchsia-300/80 transition-colors hover:text-fuchsia-200"
                    >
                      View all resources
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </div>

                  {mostUsed.length === 0 ? (
                    <SolaceGlassCard className="p-8 text-center">
                      <p className="text-sm text-[rgba(255,255,255,0.5)]">
                        Nothing recorded in this period yet—open Emergency resources, tap a hotline
                        or link, then refresh.
                      </p>
                      <Link
                        to="/app/emergency-resources"
                        className={cn(wellnessPlanBtnGhost, 'mt-5 inline-flex')}
                      >
                        Go to Emergency resources
                      </Link>
                    </SolaceGlassCard>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {mostUsed.map((resource) => {
                        const effectivenessScore = getResourceEffectivenessScore(
                          resource.resourceId,
                          interactions
                        );
                        const stars = effectivenessToStars(effectivenessScore);
                        const resourceType =
                          getResourceTypeForId(interactions, resource.resourceId) ?? 'crisis_line';
                        const lastUsed = resource.lastInteraction
                          ? new Date(resource.lastInteraction).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : '—';

                        return (
                          <article
                            key={resource.resourceId}
                            className={cn(
                              wellnessPlanGlassCard,
                              'rounded-3xl p-5 transition-colors hover:border-fuchsia-400/18'
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-bold text-white shadow-[0_0_20px_-6px_rgba(168,85,247,0.6)]">
                                #{resource.rank}
                              </span>
                              <div
                                className={cn(
                                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br',
                                  getResourceTypeColor(resourceType)
                                )}
                              >
                                <Activity className="h-5 w-5 text-white/90" aria-hidden />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="truncate font-medium text-white">
                                  {getResourceName(resource.resourceId)}
                                </h3>
                                <span
                                  className={cn(
                                    'mt-1 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                                    'border border-white/10 bg-white/[0.04] text-violet-200/85'
                                  )}
                                >
                                  {getResourceTypeLabel(resourceType)}
                                </span>
                              </div>
                            </div>
                            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <dt className="text-[rgba(255,255,255,0.42)]">Views</dt>
                                <dd className="mt-0.5 font-semibold text-cyan-200/90">
                                  {resource.totalViews}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-[rgba(255,255,255,0.42)]">Engagements</dt>
                                <dd className="mt-0.5 font-semibold text-pink-200/90">
                                  {resource.totalClicks}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-[rgba(255,255,255,0.42)]">Helpfulness</dt>
                                <dd className="mt-0.5 flex items-center gap-0.5">
                                  {stars > 0 ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                      <Star
                                        key={i}
                                        className={cn(
                                          'h-3.5 w-3.5',
                                          i < stars
                                            ? 'fill-amber-300/90 text-amber-300/90'
                                            : 'text-white/15'
                                        )}
                                        aria-hidden
                                      />
                                    ))
                                  ) : (
                                    <span className="text-[rgba(255,255,255,0.45)]">—</span>
                                  )}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-[rgba(255,255,255,0.42)]">Last used</dt>
                                <dd className="mt-0.5 font-medium text-[rgba(255,255,255,0.72)]">
                                  {lastUsed}
                                </dd>
                              </div>
                            </dl>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              </>
            )}

            {/* How it works — preserved, discreet */}
            <details className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-[rgba(255,255,255,0.48)]">
              <summary className="cursor-pointer font-medium text-[rgba(255,255,255,0.65)]">
                How resource tracking works
              </summary>
              <ol className="mt-3 list-decimal space-y-2 pl-5">
                <li>
                  Open{' '}
                  <Link className="text-fuchsia-300/85 underline" to="/app/emergency-resources">
                    Emergency resources
                  </Link>{' '}
                  from Settings or during a live session.
                </li>
                <li>
                  Taps on call, visit, copy, or similar are recorded for your insights only.
                </li>
                <li>
                  Use <strong className="text-white/80">Refresh</strong> to sync; browser activity
                  appears if the API is unavailable.
                </li>
              </ol>
            </details>

            {/* Footer */}
            <footer className="border-t border-white/[0.06] pt-6 text-center">
              <p className="text-sm text-[rgba(255,255,255,0.42)]">
                <span aria-hidden>♡</span> Made with care for your wellbeing
              </p>
            </footer>
          </div>

          {/* Right rail ~28% */}
          <ResourceAnalyticsRail
            engagementLabel={engagement.label}
            engagementPercent={engagement.percent}
            mostUsedCategory={topCategory}
            activeDaysInPeriod={activeDaysInPeriod}
            periodLabel={TIME_FILTER_LABELS[timeFilter]}
            emotionalEngagement={emotionalEngagement}
          />
        </div>
      </div>
    </motion.div>
  );
}
