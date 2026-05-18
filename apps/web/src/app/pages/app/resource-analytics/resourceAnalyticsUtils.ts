import type { ResourceInteraction } from '@/app/utils/resourceTracking';

export type ChartInterval = 'daily' | 'weekly';

export interface DailyBucket {
  dateKey: string;
  label: string;
  interactions: number;
  views: number;
  engagements: number;
}

export interface PeriodComparison {
  pct: number;
  direction: 'up' | 'down' | 'neutral';
}

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  crisis_line: 'Crisis & Safety',
  text_line: 'Text & Chat Support',
  emergency: 'Emergency Services',
  support_group: 'Support Groups',
  trusted_contact: 'Trusted Contacts',
};

const RESOURCE_TYPE_COLORS: Record<string, string> = {
  crisis_line: 'from-violet-500 to-fuchsia-500',
  text_line: 'from-cyan-500 to-sky-500',
  emergency: 'from-rose-500 to-red-500',
  support_group: 'from-emerald-500 to-teal-500',
  trusted_contact: 'from-amber-500 to-orange-500',
};

export function getResourceTypeLabel(type: string): string {
  return RESOURCE_TYPE_LABELS[type] ?? type.replace(/_/g, ' ');
}

export function getResourceTypeColor(type: string): string {
  return RESOURCE_TYPE_COLORS[type] ?? 'from-violet-500 to-purple-500';
}

export function getPreviousPeriodBounds(start: Date, end: Date): { start: Date; end: Date } {
  const duration = end.getTime() - start.getTime();
  return {
    start: new Date(start.getTime() - duration),
    end: new Date(start.getTime()),
  };
}

export function comparePeriods(current: number, previous: number): PeriodComparison | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) {
    return { pct: 100, direction: current > 0 ? 'up' : 'neutral' };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { pct: 0, direction: 'neutral' };
  return { pct: Math.abs(pct), direction: pct > 0 ? 'up' : 'down' };
}

export function formatComparisonLine(
  comparison: PeriodComparison | null,
  periodLabel: string
): string | null {
  if (!comparison) return null;
  const arrow = comparison.direction === 'up' ? '↑' : comparison.direction === 'down' ? '↓' : '→';
  return `${arrow} ${comparison.pct}% vs ${periodLabel}`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatDayLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatWeekLabel(d: Date): string {
  return `Week of ${formatDayLabel(d)}`;
}

export function buildDailyBuckets(
  interactions: ResourceInteraction[],
  start: Date,
  end: Date
): DailyBucket[] {
  const buckets: DailyBucket[] = [];
  const cursor = startOfDay(start);
  const endDay = startOfDay(end);

  while (cursor <= endDay) {
    const key = cursor.toISOString().slice(0, 10);
    buckets.push({
      dateKey: key,
      label: formatDayLabel(cursor),
      interactions: 0,
      views: 0,
      engagements: 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const bucketMap = new Map(buckets.map((b) => [b.dateKey, b]));

  interactions.forEach((ix) => {
    const day = startOfDay(new Date(ix.timestamp));
    const key = day.toISOString().slice(0, 10);
    const bucket = bucketMap.get(key);
    if (!bucket) return;
    bucket.interactions += 1;
    if (ix.interactionType === 'view') bucket.views += 1;
    else if (['call', 'text', 'visit', 'share', 'copy'].includes(ix.interactionType)) {
      bucket.engagements += 1;
    }
  });

  return buckets;
}

export function aggregateBucketsWeekly(buckets: DailyBucket[]): DailyBucket[] {
  if (buckets.length === 0) return [];
  const weeks: DailyBucket[] = [];
  let current: DailyBucket | null = null;

  buckets.forEach((b) => {
    const d = new Date(b.dateKey);
    const weekStart = startOfDay(d);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const key = weekStart.toISOString().slice(0, 10);
    if (!current || current.dateKey !== key) {
      current = {
        dateKey: key,
        label: formatWeekLabel(weekStart),
        interactions: 0,
        views: 0,
        engagements: 0,
      };
      weeks.push(current);
    }
    current.interactions += b.interactions;
    current.views += b.views;
    current.engagements += b.engagements;
  });

  return weeks;
}

export function sparklineFromBuckets(
  buckets: DailyBucket[],
  key: 'interactions' | 'views' | 'engagements'
): number[] {
  const values = buckets.map((b) => b[key]);
  if (values.length <= 14) return values;
  return values.slice(-14);
}

export function getMostActivePeriod(interactions: ResourceInteraction[]): string | null {
  if (interactions.length === 0) return null;

  const periods: Record<string, { label: string; count: number }> = {
    night: { label: 'Late night 10PM – 6AM', count: 0 },
    morning: { label: 'Mornings 6AM – 12PM', count: 0 },
    afternoon: { label: 'Afternoons 12PM – 4PM', count: 0 },
    evening: { label: 'Evenings 4PM – 10PM', count: 0 },
  };

  interactions.forEach((ix) => {
    const hour = new Date(ix.timestamp).getHours();
    if (hour < 6 || hour >= 22) periods.night.count += 1;
    else if (hour < 12) periods.morning.count += 1;
    else if (hour < 16) periods.afternoon.count += 1;
    else periods.evening.count += 1;
  });

  const top = Object.values(periods).sort((a, b) => b.count - a.count)[0];
  return top && top.count > 0 ? top.label : null;
}

export function getTopReachOutDays(
  interactions: ResourceInteraction[],
  limit = 3
): string[] {
  if (interactions.length === 0) return [];

  const byDay = new Map<string, { label: string; count: number }>();
  interactions.forEach((ix) => {
    const d = startOfDay(new Date(ix.timestamp));
    const key = d.toISOString().slice(0, 10);
    const existing = byDay.get(key);
    if (existing) existing.count += 1;
    else byDay.set(key, { label: formatDayLabel(d), count: 1 });
  });

  return [...byDay.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((d) => d.label);
}

export function getEngagementLevel(totalInteractions: number): {
  label: string;
  percent: number;
} {
  if (totalInteractions === 0) return { label: 'Getting started', percent: 0 };
  if (totalInteractions < 5) return { label: 'Building momentum', percent: 28 };
  if (totalInteractions < 15) return { label: 'Steady engagement', percent: 55 };
  if (totalInteractions < 30) return { label: 'High engagement', percent: 78 };
  return { label: 'High engagement', percent: 92 };
}

export function getSupportConsistencyDays(interactions: ResourceInteraction[]): number {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const days = new Set<string>();
  interactions.forEach((ix) => {
    const d = new Date(ix.timestamp);
    if (d >= weekAgo) {
      days.add(startOfDay(d).toISOString().slice(0, 10));
    }
  });
  return days.size;
}

export function getEmotionalEngagementLabel(avgEffectiveness: number): string {
  if (avgEffectiveness === 0) return 'Not enough data yet';
  if (avgEffectiveness >= 70) return 'Strong';
  if (avgEffectiveness >= 40) return 'Growing';
  return 'Emerging';
}

export function effectivenessToStars(score: number): number {
  if (score <= 0) return 0;
  return Math.max(1, Math.min(5, Math.round(score / 20)));
}

export function getResourceTypeForId(
  interactions: ResourceInteraction[],
  resourceId: string
): string | undefined {
  return interactions.find((i) => i.resourceId === resourceId)?.resourceType;
}
