/**
 * Resource Analytics values, computed once from the selected period's interactions and shared by
 * the page and the PDF. (The JSON export keeps using `exportResourceAnalytics` on the same
 * interactions.) The PDF snapshot is plain, frozen data: numbers as computed here, dates already
 * formatted in the reader's time zone, so the worker only lays it out.
 */
import { format } from 'date-fns';
import {
  getAllResourceAnalytics,
  getInteractionsByResourceType,
  getInteractionsBySafetyState,
  getMostUsedResources,
  type ResourceAnalytics,
  type ResourceInteraction,
} from '@/app/utils/resourceTracking';
import {
  aggregateBucketsWeekly,
  buildDailyBuckets,
  comparePeriods,
  computeSupportResponseRate,
  getActiveDaysInPeriod,
  getEmotionalEngagementLabel,
  getEngagementLevel,
  getMostActivePeriod,
  getResourceTypeForId,
  getResourceTypeLabel,
  getTopReachOutDays,
  type ChartInterval,
  type DailyBucket,
  type PeriodComparison,
} from './resourceAnalyticsUtils';

export type ResourceAnalyticsTimeFilter = '7d' | '30d' | '90d' | 'all';

export const TIME_FILTER_LABELS: Record<ResourceAnalyticsTimeFilter, string> = {
  '7d': 'last 7 days',
  '30d': 'last 30 days',
  '90d': 'last 90 days',
  all: 'all time',
};

/** Most records one server request returns for this page (the page's `limit`). */
export const RESOURCE_ANALYTICS_SERVER_LIMIT = 5000;

export interface PeriodBounds {
  start: Date;
  end: Date;
}

/** Everything the page shows for the selected period. */
export interface ResourceAnalyticsView {
  analytics: Record<string, ResourceAnalytics>;
  totalInteractions: number;
  totalClicks: number;
  supportResponseRate: number;
  /** Average support response rate as shown ("0" with no activity, else one decimal). */
  avgCtr: string;
  resourcesExplored: number;
  comparisonLabel: string;
  comparisons: Record<'interactions' | 'engagements' | 'ctr' | 'resources', PeriodComparison | null>;
  mostUsed: Array<ResourceAnalytics & { rank: number }>;
  byType: Record<string, number>;
  dailyBuckets: DailyBucket[];
  chartBuckets: DailyBucket[];
  engagement: { label: string; percent: number };
  activeDaysInPeriod: number;
  emotionalEngagement: string;
  topCategory: string;
  mostActivePeriod: string | null;
  topDays: string[];
}

const sumOf = (analytics: Record<string, ResourceAnalytics>, pick: (a: ResourceAnalytics) => number) =>
  Object.values(analytics).reduce((sum, a) => sum + pick(a), 0);

/** Splits the period at its midpoint: first half (prior) and second half (recent). */
function splitHalves(interactions: ResourceInteraction[], bounds: PeriodBounds) {
  const mid = new Date(bounds.start.getTime() + (bounds.end.getTime() - bounds.start.getTime()) / 2);
  const prior: ResourceInteraction[] = [];
  const recent: ResourceInteraction[] = [];
  interactions.forEach((ix) => {
    if (new Date(ix.timestamp) < mid) prior.push(ix);
    else recent.push(ix);
  });
  return { prior, recent };
}

export function computeResourceAnalyticsView(params: {
  interactions: ResourceInteraction[];
  bounds: PeriodBounds;
  timeFilter: ResourceAnalyticsTimeFilter;
  chartInterval: ChartInterval;
}): ResourceAnalyticsView {
  const { interactions, bounds, timeFilter, chartInterval } = params;
  const { prior, recent } = splitHalves(interactions, bounds);
  const analytics = getAllResourceAnalytics(interactions);
  const recentAnalytics = getAllResourceAnalytics(recent);
  const priorAnalytics = getAllResourceAnalytics(prior);

  const totalInteractions = sumOf(analytics, (a) => a.totalViews + a.totalClicks);
  const totalClicks = sumOf(analytics, (a) => a.totalClicks);
  const supportResponseRate = computeSupportResponseRate(interactions);
  const comparisonLabel = `first half of ${TIME_FILTER_LABELS[timeFilter]}`;

  const dailyBuckets = buildDailyBuckets(interactions, bounds.start, bounds.end);
  const chartBuckets =
    chartInterval === 'weekly' || timeFilter === '90d' || timeFilter === 'all'
      ? aggregateBucketsWeekly(dailyBuckets)
      : dailyBuckets;

  const byType = getInteractionsByResourceType(interactions);
  const topType = Object.entries(byType).sort(([, a], [, b]) => b - a)[0];

  return {
    analytics,
    totalInteractions,
    totalClicks,
    supportResponseRate,
    avgCtr: interactions.length === 0 ? '0' : supportResponseRate.toFixed(1),
    resourcesExplored: Object.keys(analytics).length,
    comparisonLabel,
    comparisons: {
      interactions: comparePeriods(
        sumOf(recentAnalytics, (a) => a.totalViews + a.totalClicks),
        sumOf(priorAnalytics, (a) => a.totalViews + a.totalClicks)
      ),
      engagements: comparePeriods(sumOf(recentAnalytics, (a) => a.totalClicks), sumOf(priorAnalytics, (a) => a.totalClicks)),
      ctr: comparePeriods(computeSupportResponseRate(recent), computeSupportResponseRate(prior)),
      resources: comparePeriods(Object.keys(recentAnalytics).length, Object.keys(priorAnalytics).length),
    },
    mostUsed: getMostUsedResources(4, interactions),
    byType,
    dailyBuckets,
    chartBuckets,
    engagement: getEngagementLevel(interactions.length, supportResponseRate),
    activeDaysInPeriod: getActiveDaysInPeriod(interactions, bounds.start, bounds.end),
    emotionalEngagement: getEmotionalEngagementLabel(interactions, supportResponseRate),
    topCategory: topType ? getResourceTypeLabel(topType[0]) : 'Not enough data yet',
    mostActivePeriod: getMostActivePeriod(interactions),
    topDays: getTopReachOutDays(interactions),
  };
}

// --- PDF snapshot ------------------------------------------------------------------------------

export type ResourceAnalyticsSource = 'server' | 'browser';

/** Plain, frozen data for the PDF worker. */
export interface ResourceAnalyticsPdfSnapshot {
  periodLabel: string;
  periodRange: string;
  generatedAt: string;
  timeZone: string;
  source: ResourceAnalyticsSource;
  sourceLabel: string;
  /** The incomplete-data warning (browser fallback only). */
  warning: string | null;
  /** Data limits that apply to this report, in plain words. */
  limits: string[];
  metrics: Array<{ label: string; value: string; change: string }>;
  comparisonNote: string;
  highlights: Array<{ label: string; value: string }>;
  timeline: { interval: 'Daily' | 'Weekly'; note: string | null; rows: Array<{ period: string; interactions: number; views: number; engagements: number }> };
  byType: Array<{ type: string; interactions: number }>;
  bySafetyState: Array<{ state: string; interactions: number }>;
  resources: Array<{
    rank: number;
    name: string;
    type: string;
    views: number;
    engagements: number;
    calls: number;
    texts: number;
    visits: number;
    firstUsed: string;
    lastUsed: string;
  }>;
}

const dateOnly = (d: Date) => format(d, 'd MMM yyyy');
const dateTime = (d: Date) => format(d, "d MMM yyyy, HH:mm");

/** "Up 12% vs first half of last 30 days" — the page's comparison, in words. */
export function comparisonInWords(c: PeriodComparison | null, label: string): string {
  if (!c) return '—';
  if (c.direction === 'neutral') return c.pct === 0 ? `No change vs ${label}` : `${c.pct}% vs ${label}`;
  return `${c.direction === 'up' ? 'Up' : 'Down'} ${c.pct}% vs ${label}`;
}

export const RESOURCE_ANALYTICS_SOURCE_LABELS: Record<ResourceAnalyticsSource, string> = {
  server: 'Source: server-confirmed activity only.',
  browser: "Source: this account's activity saved in this browser only.",
};
/** The page's own notice for the browser fallback. */
export const RESOURCE_ANALYTICS_FALLBACK_WARNING =
  'Could not reach the server. Showing activity saved in this browser only, which may be incomplete.';

/** "Week of 5 Oct 2026" / "5 Oct 2026" from a bucket's local date key. */
function bucketLabel(b: DailyBucket, weekly: boolean): string {
  const [y, m, d] = b.dateKey.split('-').map(Number);
  const label = dateOnly(new Date(y, m - 1, d));
  return weekly ? `Week of ${label}` : label;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

export function buildResourceAnalyticsPdfSnapshot(params: {
  view: ResourceAnalyticsView;
  interactions: ResourceInteraction[];
  timeFilter: ResourceAnalyticsTimeFilter;
  bounds: PeriodBounds;
  source: ResourceAnalyticsSource;
  /** Server records returned for this period (server source only). */
  serverRecordCount?: number;
  localRecordLimit: number;
  resourceName: (resourceId: string) => string;
  generatedAt: Date;
  timeZone: string;
}): ResourceAnalyticsPdfSnapshot {
  const { view, interactions, timeFilter, bounds, source } = params;
  const weekly = view.chartBuckets !== view.dailyBuckets;
  const count = (n: number) => n.toLocaleString('en-US');

  // All time starts at 1970; list the timeline from the first period with recorded activity.
  let timelineRows = view.chartBuckets;
  let timelineNote: string | null = null;
  if (timeFilter === 'all') {
    const first = timelineRows.findIndex((b) => b.interactions > 0);
    timelineRows = first < 0 ? [] : timelineRows.slice(first);
    timelineNote = 'All time: weeks before your first recorded activity are not listed.';
  }

  const limits: string[] = [];
  if (source === 'server' && (params.serverRecordCount ?? 0) >= RESOURCE_ANALYTICS_SERVER_LIMIT) {
    limits.push(
      `The server returns at most ${count(RESOURCE_ANALYTICS_SERVER_LIMIT)} records for one report. This period reached that limit, so some activity in it may not be included.`
    );
  }
  if (source === 'browser') {
    limits.push(`This browser keeps at most ${count(params.localRecordLimit)} of this account's most recent records.`);
  }

  const ranked = getMostUsedResources(Object.keys(view.analytics).length, interactions);
  const label = view.comparisonLabel;

  return deepFreeze({
    periodLabel: timeFilter === 'all' ? 'All time' : `Last ${TIME_FILTER_LABELS[timeFilter].slice('last '.length)}`,
    periodRange:
      timeFilter === 'all'
        ? `All recorded activity up to ${dateTime(bounds.end)}`
        : `${dateTime(bounds.start)} – ${dateTime(bounds.end)}`,
    generatedAt: dateTime(params.generatedAt),
    timeZone: params.timeZone,
    source,
    sourceLabel: RESOURCE_ANALYTICS_SOURCE_LABELS[source],
    warning: source === 'browser' ? RESOURCE_ANALYTICS_FALLBACK_WARNING : null,
    limits,
    metrics: [
      { label: 'Total Interactions', value: count(view.totalInteractions), change: comparisonInWords(view.comparisons.interactions, label) },
      { label: 'Total Engagements', value: count(view.totalClicks), change: comparisonInWords(view.comparisons.engagements, label) },
      { label: 'Avg Support Response Rate', value: `${view.avgCtr}%`, change: comparisonInWords(view.comparisons.ctr, label) },
      { label: 'Resources Explored', value: count(view.resourcesExplored), change: comparisonInWords(view.comparisons.resources, label) },
    ],
    comparisonNote: `Changes compare the second half of the period with the ${label}.`,
    highlights: [
      { label: 'Active days in this period', value: count(view.activeDaysInPeriod) },
      { label: 'Most used category', value: view.topCategory },
      { label: 'Most active periods', value: view.mostActivePeriod ?? 'Not enough data yet' },
      { label: 'Days you reached out most', value: view.topDays.length > 0 ? view.topDays.join(' • ') : 'Not enough data yet' },
    ],
    timeline: {
      interval: weekly ? 'Weekly' : 'Daily',
      note: timelineNote,
      rows: timelineRows.map((b) => ({ period: bucketLabel(b, weekly), interactions: b.interactions, views: b.views, engagements: b.engagements })),
    },
    byType: Object.entries(view.byType)
      .sort(([, a], [, b]) => b - a)
      .map(([type, n]) => ({ type: getResourceTypeLabel(type), interactions: n })),
    bySafetyState: Object.entries(getInteractionsBySafetyState(interactions))
      .sort(([, a], [, b]) => b - a)
      .map(([state, n]) => ({ state, interactions: n })),
    resources: ranked.map((r) => ({
      rank: r.rank,
      name: params.resourceName(r.resourceId),
      type: getResourceTypeLabel(getResourceTypeForId(interactions, r.resourceId) ?? 'crisis_line'),
      views: r.totalViews,
      engagements: r.totalClicks,
      calls: r.totalCalls,
      texts: r.totalTexts,
      visits: r.totalVisits,
      firstUsed: r.firstInteraction ? dateOnly(new Date(r.firstInteraction)) : '—',
      lastUsed: r.lastInteraction ? dateOnly(new Date(r.lastInteraction)) : '—',
    })),
  });
}

/** e.g. `solace-resource-analytics-2026-10-05-to-2026-11-04.pdf`, `solace-resource-analytics-all-time-to-2026-11-04.pdf`. */
export function resourceAnalyticsPdfFileName(timeFilter: ResourceAnalyticsTimeFilter, bounds: PeriodBounds): string {
  const day = (d: Date) => format(d, 'yyyy-MM-dd');
  const period = timeFilter === 'all' ? `all-time-to-${day(bounds.end)}` : `${day(bounds.start)}-to-${day(bounds.end)}`;
  return `solace-resource-analytics-${period}.pdf`;
}
