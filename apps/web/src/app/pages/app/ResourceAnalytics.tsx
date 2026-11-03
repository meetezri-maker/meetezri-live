/**
 * EZRI — RESOURCE ANALYTICS
 * Cinematic wellness analytics sanctuary (real interaction data only).
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
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
  getResourceEffectivenessScore,
  getInteractionsByTimePeriod,
  exportResourceAnalytics,
  mapServerRowsToInteractions,
  getResourceInteractions,
  MAX_LOCAL_INTERACTIONS,
  RESOURCE_INTERACTION_SETTLED_EVENT,
} from '@/app/utils/resourceTracking';
import { getSafetyResources } from '@/app/utils/safetyResources';
import { useAuth } from '@/app/contexts/AuthContext';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import { currentTimeZone } from '@/lib/reportTimeZone';
import { describeUnsupportedText, PdfUnsupportedTextError } from '@/lib/pdf/pdfText';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { ResourceAnalyticsRail } from './resource-analytics/ResourceAnalyticsRail';
import {
  MiniSparkline,
  SupportActivityTimeline,
} from './resource-analytics/ResourceAnalyticsVisuals';
import {
  effectivenessToStars,
  formatComparisonLine,
  getResourceTypeColor,
  getResourceTypeForId,
  getResourceTypeLabel,
  selectResourceAnalyticsInteractions,
  sparklineFromBuckets,
  type ChartInterval,
} from './resource-analytics/resourceAnalyticsUtils';
import {
  buildResourceAnalyticsPdfSnapshot,
  computeResourceAnalyticsView,
  RESOURCE_ANALYTICS_SERVER_LIMIT,
  resourceAnalyticsPdfFileName,
  TIME_FILTER_LABELS,
} from './resource-analytics/resourceAnalyticsReport';

/** A short message for text the PDF can't draw: scripts by name, at most three symbols. */
function unsupportedTextMessage(characters: string[]): string {
  const { scripts, symbols, moreSymbols } = describeUnsupportedText(characters);
  const tail = "so the PDF wasn't downloaded. You can download the JSON instead.";
  if (scripts.length) {
    const named = scripts.length > 2 ? `${scripts.slice(0, 2).join(', ')} and other` : scripts.join(' and ');
    return `This report includes ${named} text, which the PDF can't display yet, ${tail}`;
  }
  return `This report includes ${symbols.length === 1 && !moreSymbols ? 'a symbol' : 'symbols'} the PDF can't display (${symbols.join(' ')}${moreSymbols ? ' …' : ''}), ${tail}`;
}

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
        limit: RESOURCE_ANALYTICS_SERVER_LIMIT,
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

  // Bumped when one of this account's tracked writes settles, so pending local rows are re-read.
  const [localVersion, setLocalVersion] = useState(0);
  useEffect(() => {
    if (!userId) return;
    const onSettled = (event: Event) => {
      if ((event as CustomEvent<{ userId: string | null }>).detail?.userId !== userId) return;
      setLocalVersion((v) => v + 1);
      void refetch();
    };
    window.addEventListener(RESOURCE_INTERACTION_SETTLED_EVENT, onSettled);
    return () => window.removeEventListener(RESOURCE_INTERACTION_SETTLED_EVENT, onSettled);
  }, [userId, refetch]);

  const localInteractionsFiltered = useMemo(
    () =>
      getInteractionsByTimePeriod(
        periodBounds.start,
        periodBounds.end,
        getResourceInteractions(userId)
      ),
    // localVersion is a re-read trigger for localStorage, not a value used in the body.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [periodBounds.start, periodBounds.end, userId, localVersion]
  );

  const interactions = useMemo(
    () =>
      selectResourceAnalyticsInteractions({
        serverStatus: !userId ? 'pending' : isSuccess ? 'success' : isError ? 'error' : 'pending',
        server: serverInteractions,
        local: localInteractionsFiltered,
      }),
    [userId, serverInteractions, localInteractionsFiltered, isSuccess, isError]
  );

  const dataSourceNote: 'synced' | 'offline' = isError ? 'offline' : 'synced';

  // Every value the page shows (and the PDF reports) for the selected period.
  const view = useMemo(
    () => computeResourceAnalyticsView({ interactions, bounds: periodBounds, timeFilter, chartInterval }),
    [interactions, periodBounds, timeFilter, chartInterval]
  );
  const {
    totalInteractions,
    totalClicks,
    avgCtr,
    resourcesExplored,
    comparisonLabel,
    mostUsed,
    dailyBuckets,
    chartBuckets,
    engagement,
    activeDaysInPeriod,
    emotionalEngagement,
    topCategory,
    mostActivePeriod,
    topDays,
  } = view;
  const comparisons = useMemo(
    () => ({
      interactions: formatComparisonLine(view.comparisons.interactions, comparisonLabel),
      engagements: formatComparisonLine(view.comparisons.engagements, comparisonLabel),
      ctr: formatComparisonLine(view.comparisons.ctr, comparisonLabel),
      resources: formatComparisonLine(view.comparisons.resources, comparisonLabel),
    }),
    [view.comparisons, comparisonLabel]
  );

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

  // --- PDF export -----------------------------------------------------------------------------
  // One PDF export at a time. It is built in a worker from a frozen snapshot of what the page
  // shows, and cancelled (worker terminated, toast cleared) on account change, sign-out, period
  // change or unmount; a cancelled or superseded export never downloads or touches newer state.
  const currentUserIdRef = useRef(userId);
  currentUserIdRef.current = userId;
  const pdfJobRef = useRef<{ controller: AbortController; toastId: string | number } | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const cancelPdfExport = useCallback(() => {
    const job = pdfJobRef.current;
    if (!job) return;
    pdfJobRef.current = null;
    job.controller.abort();
    toast.dismiss(job.toastId);
    setPdfBusy(false);
  }, []);
  useEffect(() => cancelPdfExport, [userId, timeFilter, cancelPdfExport]);

  const exportDisabled = !userId || isLoading || isFetching || interactions.length === 0 || pdfBusy;

  const handleExportPdf = async () => {
    if (exportDisabled || pdfJobRef.current) return;
    const accountId = userId;
    const snapshot = buildResourceAnalyticsPdfSnapshot({
      view,
      interactions,
      timeFilter,
      bounds: periodBounds,
      source: dataSourceNote === 'offline' ? 'browser' : 'server',
      serverRecordCount: rawRows?.length ?? 0,
      localRecordLimit: MAX_LOCAL_INTERACTIONS,
      resourceName: getResourceName,
      generatedAt: new Date(),
      timeZone: currentTimeZone(),
    });
    const fileName = resourceAnalyticsPdfFileName(timeFilter, periodBounds);
    const job = { controller: new AbortController(), toastId: toast.loading('Preparing your PDF…') };
    const isCurrent = () => pdfJobRef.current === job && currentUserIdRef.current === accountId;
    pdfJobRef.current = job;
    setPdfBusy(true);
    try {
      const { createResourceAnalyticsPdf } = await import('./resource-analytics/resourceAnalyticsPdf');
      if (!isCurrent()) return;
      const { bytes } = await createResourceAnalyticsPdf(snapshot, {
        signal: job.controller.signal,
        locale: typeof navigator !== 'undefined' ? navigator.language : undefined,
        onProgress: ({ fontsLoaded, fontsTotal }) => {
          if (fontsTotal > 0 && isCurrent()) {
            toast.loading(`Preparing your PDF… downloading fonts (${fontsLoaded} of ${fontsTotal})`, { id: job.toastId });
          }
        },
      });
      if (!isCurrent()) return;
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      // Cancelled (account change, sign-out, period change or leaving the page): nothing to report.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      // Unsupported text: log the reason only, not the report's characters.
      console.error('Resource Analytics PDF failed', error instanceof PdfUnsupportedTextError ? `${error.name} (${error.reason})` : error);
      if (!isCurrent()) return;
      if (error instanceof PdfUnsupportedTextError) {
        toast.error(
          error.reason === 'font-unavailable'
            ? "The fonts needed for this PDF couldn't be loaded, so it wasn't downloaded. Please check your connection and try again, or download the JSON."
            : unsupportedTextMessage(error.characters)
        );
      } else {
        toast.error("We couldn't create the PDF. Please try again, or download the JSON.");
      }
    } finally {
      toast.dismiss(job.toastId);
      if (pdfJobRef.current === job) {
        pdfJobRef.current = null;
        setPdfBusy(false);
      }
    }
  };

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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={exportDisabled}
                  aria-busy={pdfBusy}
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
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[10rem] border-white/10 bg-[#12122a] text-white">
                <DropdownMenuItem className="cursor-pointer focus:bg-violet-500/15 focus:text-white" onSelect={() => void handleExportPdf()}>
                  Download PDF
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer focus:bg-violet-500/15 focus:text-white" onSelect={handleExport}>
                  Download JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                Could not reach the server. Showing activity saved in this browser only, which
                may be incomplete.{' '}
                <button type="button" className="font-semibold underline" onClick={() => refetch()}>
                  Retry sync
                </button>
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
