import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Clock,
  Heart,
  Phone,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { SafetyEvent, SafetyState } from "@/app/types/safety";
import { getSafetyEvents } from "@/app/utils/safetyLogger";
import { getMoodDisplayInfo } from "@/app/pages/app/mood-check-in/moodDisplay";
import {
  computeCheckInStreak,
  type MoodEntryLite,
} from "@/app/pages/app/mood-check-in/moodCheckInUtils";
import type { ResourceAnalytics, ResourceInteraction } from "@/app/utils/resourceTracking";
export interface SafetyCheckInEntry {
  timestamp: string;
  note: string;
}

export type SafetyTrend = "increasing" | "decreasing" | "stable";

export interface SafetyRecommendation {
  type: string;
  icon: LucideIcon;
  title: string;
  description: string;
  action: string;
  actionLink: string;
}

export interface SafetyInsightsData {
  totalEvents: number;
  last30DaysCount: number;
  stateDistribution: Record<string, number>;
  timePatterns: Record<string, number>;
  dayPatterns: Record<string, number>;
  triggers: Record<string, number>;
  topResources: Array<ResourceAnalytics & { rank: number }>;
  resourcesByState: Record<string, number>;
  trend: SafetyTrend;
  highRiskLast14: number;
  highRiskPrevious14: number;
  recommendations: SafetyRecommendation[];
  safetyScore: number;
  currentState: string;
  moodCheckInsLast30: number;
  moodStreak: number;
}

const SAFETY_STATES = new Set<SafetyState>([
  "NORMAL",
  "ELEVATED_CONCERN",
  "HIGH_RISK",
  "SAFETY_MODE",
  "COOLDOWN",
]);

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function triggerSeverity(
  count: number,
  max: number
): { label: string; tone: "high" | "medium" | "low" } {
  if (max === 0) return { label: "Low", tone: "low" };
  const ratio = count / max;
  if (ratio >= 0.66) return { label: "High", tone: "high" };
  if (ratio >= 0.33) return { label: "Medium", tone: "medium" };
  return { label: "Low", tone: "low" };
}

export function formatTriggerLabel(signal: string): string {
  return signal
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function thirtyDaysAgo(from = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() - 30);
  return d;
}

/** Include legacy rows logged before auth user id was stable. */
export function loadLocalSafetyEvents(userId: string): SafetyEvent[] {
  const all = getSafetyEvents();
  return all.filter(
    (event) => event.userId === userId || event.userId === "unknown"
  );
}

export function safetyEventsFromResourceInteractions(
  interactions: ResourceInteraction[],
  userId: string
): SafetyEvent[] {
  return interactions
    .filter((ix) => ix.safetyState && SAFETY_STATES.has(ix.safetyState as SafetyState))
    .map((ix) => ({
      id: `rsc_${ix.id}`,
      timestamp: new Date(ix.timestamp).getTime(),
      userId,
      sessionId: ix.sessionId ?? "resource",
      previousState: "NORMAL" as SafetyState,
      newState: ix.safetyState as SafetyState,
      trigger: `resource_${ix.interactionType}`,
      detectedSignals: [ix.resourceId],
      context: ix.resourceName,
    }));
}

export function mergeSafetyHistories(
  localEvents: SafetyEvent[],
  derivedEvents: SafetyEvent[]
): SafetyEvent[] {
  const byId = new Map<string, SafetyEvent>();
  for (const e of [...localEvents, ...derivedEvents]) {
    byId.set(e.id, e);
  }
  return [...byId.values()].sort((a, b) => b.timestamp - a.timestamp);
}

export function eventToCheckInNote(event: SafetyEvent): string {
  const state = event.newState;
  const map: Record<string, string> = {
    NORMAL: "Feeling safe and calm",
    ELEVATED_CONCERN: "Noticed elevated concern—took a mindful pause",
    HIGH_RISK: "Managed stress with care",
    SAFETY_MODE: "Activated safety support",
    COOLDOWN: "Cooling down after a difficult moment",
  };
  if (map[state]) return map[state];
  if (event.trigger) return `Reflected on ${formatTriggerLabel(event.trigger)}`;
  if (event.detectedSignals?.[0]) {
    return `Reflected on ${formatTriggerLabel(event.detectedSignals[0])}`;
  }
  return "Safety check-in recorded";
}

export function moodEntryToCheckInNote(entry: MoodEntryLite & { notes?: string }): string {
  const display = getMoodDisplayInfo(entry.mood);
  const label = display?.label ?? formatTriggerLabel(entry.mood);
  if (entry.notes?.trim()) {
    const snippet = entry.notes.trim().slice(0, 100);
    return snippet.length < entry.notes.trim().length ? `${snippet}…` : snippet;
  }
  return `Mood check-in: feeling ${label}`;
}

export function buildCheckInEntries(
  moods: Array<MoodEntryLite & { notes?: string }>,
  safetyEvents: SafetyEvent[],
  limit = 6
): SafetyCheckInEntry[] {
  const moodEntries: SafetyCheckInEntry[] = moods.map((m) => ({
    timestamp: m.created_at,
    note: moodEntryToCheckInNote(m),
  }));

  const safetyEntries: SafetyCheckInEntry[] = safetyEvents.map((e) => ({
    timestamp: new Date(e.timestamp).toISOString(),
    note: eventToCheckInNote(e),
  }));

  return [...moodEntries, ...safetyEntries]
    .filter((e) => !Number.isNaN(new Date(e.timestamp).getTime()))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

export function filterMoodsLast30Days(moods: MoodEntryLite[], now = new Date()): MoodEntryLite[] {
  const start = thirtyDaysAgo(now);
  return moods.filter((m) => {
    const d = new Date(m.created_at);
    return !Number.isNaN(d.getTime()) && d >= start;
  });
}

const TIME_CHART_BUCKETS = [
  { label: "6 AM", hour: 6 },
  { label: "10 AM", hour: 10 },
  { label: "2 PM", hour: 14 },
  { label: "6 PM", hour: 18 },
  { label: "10 PM", hour: 22 },
] as const;

const SAFETY_STATE_CHART_LABELS: Record<string, { label: string; color: string }> = {
  NORMAL: { label: "Safe", color: "#34d399" },
  ELEVATED_CONCERN: { label: "Caution", color: "#fbbf24" },
  HIGH_RISK: { label: "Stress", color: "#fb923c" },
  SAFETY_MODE: { label: "Crisis", color: "#f87171" },
  COOLDOWN: { label: "Cooldown", color: "#a78bfa" },
};

function bumpTimeBucket(buckets: Array<{ label: string; hour: number; value: number }>, hour: number) {
  const nearest = buckets.reduce((prev, curr) =>
    Math.abs(curr.hour - hour) < Math.abs(prev.hour - hour) ? curr : prev
  );
  nearest.value += 1;
}

function periodFromHour(hour: number): string {
  if (hour < 6) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

export type MoodEntryForInsights = MoodEntryLite & {
  notes?: string;
  activities?: string[];
};

export interface InsightsAnalyticsCharts {
  timeChartData: Array<{ label: string; hour: number; value: number }>;
  timeChartTotal: number;
  timeHint: string;
  donutData: Array<{ name: string; value: number; color: string }>;
  donutFooter: string;
  donutUsesMoods: boolean;
  triggerRows: Array<{
    label: string;
    count: number;
    severityLabel: string;
    tone: "high" | "medium" | "low";
  }>;
}

/** Time-of-day area chart: mood check-ins + safety moments (last 30 days). */
export function buildTimeOfDayChartData(
  moods: MoodEntryForInsights[],
  events: SafetyEvent[],
  periodStart = thirtyDaysAgo()
): { data: InsightsAnalyticsCharts["timeChartData"]; total: number; periodCounts: Record<string, number> } {
  const buckets = TIME_CHART_BUCKETS.map((b) => ({ ...b, value: 0 }));
  const periodCounts: Record<string, number> = {};
  let total = 0;

  for (const m of moods) {
    const d = new Date(m.created_at);
    if (Number.isNaN(d.getTime()) || d < periodStart) continue;
    bumpTimeBucket(buckets, d.getHours());
    const p = periodFromHour(d.getHours());
    periodCounts[p] = (periodCounts[p] ?? 0) + 1;
    total += 1;
  }

  for (const e of events) {
    const d = new Date(e.timestamp);
    if (Number.isNaN(d.getTime()) || d < periodStart) continue;
    bumpTimeBucket(buckets, d.getHours());
    const p = periodFromHour(d.getHours());
    periodCounts[p] = (periodCounts[p] ?? 0) + 1;
    total += 1;
  }

  return { data: buckets, total, periodCounts };
}

/** Donut: safety states when enough safety data; otherwise mood check-in mix. */
export function buildDistributionDonut(
  stateDistribution: Record<string, number>,
  moodsLast30: MoodEntryForInsights[],
  safetyMomentsLast30: number
): {
  segments: InsightsAnalyticsCharts["donutData"];
  footer: string;
  usesMoods: boolean;
} {
  const safetyTotal = Object.values(stateDistribution).reduce((s, c) => s + c, 0);
  const useMoodChart = moodsLast30.length > 0 && safetyTotal < Math.max(3, moodsLast30.length * 0.25);

  if (useMoodChart) {
    const counts = new Map<string, { label: string; color: string; count: number }>();
    for (const m of moodsLast30) {
      const info = getMoodDisplayInfo(m.mood);
      const label = info?.label ?? formatTriggerLabel(m.mood);
      const color = info?.color ?? "#a78bfa";
      const prev = counts.get(label.toLowerCase());
      if (prev) prev.count += 1;
      else counts.set(label.toLowerCase(), { label, color, count: 1 });
    }
    const total = moodsLast30.length;
    const segments = [...counts.values()]
      .sort((a, b) => b.count - a.count)
      .map((entry) => ({
        name: entry.label,
        value: Math.round((entry.count / total) * 100),
        color: entry.color,
      }));
    const top = segments[0];
    const footer = top
      ? `${top.name} shows up in ${top.value}% of your check-ins this month.`
      : "Your mood patterns will appear as you check in.";
    return { segments, footer, usesMoods: true };
  }

  if (safetyTotal === 0) {
    if (moodsLast30.length === 0) {
      return {
        segments: [{ name: "No data yet", value: 100, color: "#52525b" }],
        footer: "Log mood check-ins or use safety tools to see your distribution.",
        usesMoods: false,
      };
    }
  }

  const distTotal = safetyTotal || 1;
  const segments = Object.entries(stateDistribution)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => ({
      name: SAFETY_STATE_CHART_LABELS[key]?.label ?? formatTriggerLabel(key),
      value: Math.round((count / distTotal) * 100),
      color: SAFETY_STATE_CHART_LABELS[key]?.color ?? "#a78bfa",
    }));

  if (segments.length === 0) {
    return {
      segments: [{ name: "Safe", value: 100, color: "#34d399" }],
      footer: "No elevated safety states recorded in the last 30 days.",
      usesMoods: false,
    };
  }

  const safe = segments.find((s) => s.name === "Safe");
  const safePct = safe?.value ?? 0;
  const footer =
    safePct >= 80
      ? `You're in a safe state ${safePct}% of the time. Keep going.`
      : safetyMomentsLast30 > 0
        ? `${safetyMomentsLast30} safety moment${safetyMomentsLast30 === 1 ? "" : "s"} shaped this mix.`
        : "Your safety state mix from recent activity.";

  return { segments, footer, usesMoods: false };
}

/** Top triggers: mood labels, activities, and safety signals (last 30 days). */
export function buildTriggerRowsFromData(
  safetyTriggers: Record<string, number>,
  moodsLast30: MoodEntryForInsights[]
): InsightsAnalyticsCharts["triggerRows"] {
  const counts = new Map<string, number>();

  for (const m of moodsLast30) {
    const info = getMoodDisplayInfo(m.mood);
    const moodLabel = info?.label ?? formatTriggerLabel(m.mood);
    counts.set(moodLabel, (counts.get(moodLabel) ?? 0) + 1);

    for (const act of m.activities ?? []) {
      const actLabel = formatTriggerLabel(act);
      if (actLabel) counts.set(actLabel, (counts.get(actLabel) ?? 0) + 1);
    }
  }

  for (const [signal, count] of Object.entries(safetyTriggers)) {
    const label = formatTriggerLabel(signal);
    counts.set(label, (counts.get(label) ?? 0) + count);
  }

  const entries = [...counts.entries()].sort(([, a], [, b]) => b - a);
  const max = entries[0]?.[1] ?? 0;

  return entries.slice(0, 5).map(([label, count]) => {
    const severity = triggerSeverity(count, max);
    return {
      label,
      count,
      severityLabel: severity.label,
      tone: severity.tone,
    };
  });
}

export function buildInsightsAnalyticsCharts(
  insights: SafetyInsightsData,
  moods: MoodEntryForInsights[],
  events: SafetyEvent[]
): InsightsAnalyticsCharts {
  const periodStart = thirtyDaysAgo();
  const moodsLast30 = filterMoodsLast30Days(moods) as MoodEntryForInsights[];
  const { data: timeChartData, total: timeChartTotal, periodCounts } = buildTimeOfDayChartData(
    moods,
    events,
    periodStart
  );
  const { segments, footer, usesMoods } = buildDistributionDonut(
    insights.stateDistribution,
    moodsLast30,
    insights.last30DaysCount
  );

  return {
    timeChartData,
    timeChartTotal,
    timeHint: timePatternHint(periodCounts),
    donutData: segments,
    donutFooter: footer,
    donutUsesMoods: usesMoods,
    triggerRows: buildTriggerRowsFromData(insights.triggers, moodsLast30),
  };
}

export function timePatternHint(timePatterns: Record<string, number>): string {
  const top = Object.entries(timePatterns).sort(([, a], [, b]) => b - a)[0];
  if (!top || top[1] === 0) {
    return "Log mood check-ins to discover when you feel most supported.";
  }
  const period = top[0];
  const hints: Record<string, string> = {
    morning: "Morning grounding or breath work may help you start steady.",
    afternoon: "A short afternoon pause can reset stress before it builds.",
    evening: "Try evening grounding practices when patterns peak.",
    night: "Gentle wind-down rituals before bed can ease nighttime tension.",
  };
  return hints[period] ?? "Small rituals at your peak times can help you feel steadier.";
}

export function moodStabilitySummary(moodsLast30: MoodEntryLite[], trend: SafetyTrend): string {
  if (moodsLast30.length === 0) {
    return trend === "increasing"
      ? "Mood check-ins can help you notice shifts early."
      : "Your emotional rhythm looks steady lately.";
  }
  const intensities = moodsLast30
    .map((m) => (typeof m.intensity === "number" ? m.intensity : null))
    .filter((v): v is number => v != null);
  if (intensities.length < 2) {
    return "Keep checking in—patterns become clearer with each entry.";
  }
  const avg =
    intensities.reduce((s, v) => s + v, 0) / intensities.length;
  const variance =
    intensities.reduce((s, v) => s + (v - avg) ** 2, 0) / intensities.length;
  if (variance < 4 && trend !== "increasing") {
    return "Your mood intensity has been relatively steady this month.";
  }
  if (trend === "decreasing") {
    return "Your emotional rhythm looks steadier compared to recent weeks.";
  }
  return "Your moods have varied—check-ins help you spot what helps.";
}

export function journalingSummary(moodsLast30: Array<MoodEntryLite & { notes?: string }>): string {
  const withNotes = moodsLast30.filter((m) => m.notes?.trim()).length;
  if (withNotes === 0) {
    return "Adding a line in mood check-in deepens self-understanding.";
  }
  if (withNotes >= 5) {
    return `You've reflected in writing ${withNotes} times this month—keep it up.`;
  }
  return `You've journaled ${withNotes} time${withNotes === 1 ? "" : "s"} this month through mood notes.`;
}

export function breathingResourcesSummary(
  topResources: Array<ResourceAnalytics & { rank: number }>,
  resourceIdToName: Map<string, string>
): string {
  if (topResources.length === 0) {
    return "Gentle breath work can calm the nervous system when you need it.";
  }
  const top = topResources[0];
  const name = resourceIdToName.get(top.resourceId) ?? "your support tools";
  return `${name} is your most reached-for resource lately.`;
}

export function connectionDaysSummary(
  moodCount30: number,
  safetyEvents30: number
): string {
  const total = moodCount30 + safetyEvents30;
  if (total === 0) {
    return "Check in with mood or wellness tools to build your support rhythm.";
  }
  if (moodCount30 > 0 && safetyEvents30 > 0) {
    return `${moodCount30} mood check-in${moodCount30 === 1 ? "" : "s"} and ${safetyEvents30} safety moment${safetyEvents30 === 1 ? "" : "s"} this month.`;
  }
  if (moodCount30 > 0) {
    return `${moodCount30} mood check-in${moodCount30 === 1 ? "" : "s"} logged this month.`;
  }
  return `${safetyEvents30} safety moment${safetyEvents30 === 1 ? "" : "s"} logged this month.`;
}

function calculateSafetyScore(
  distribution: Record<string, number>,
  trend: SafetyTrend
): number {
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
}

function generateRecommendations(data: {
  stateDistribution: Record<string, number>;
  timePatterns: Record<string, number>;
  triggers: Record<string, number>;
  trend: SafetyTrend;
  topResources: Array<ResourceAnalytics & { rank: number }>;
  totalEventsLast30: number;
  moodCheckInsLast30: number;
}): SafetyRecommendation[] {
  const recs: SafetyRecommendation[] = [];

  const mostCommonTime = Object.entries(data.timePatterns).sort(
    ([, a], [, b]) => b - a
  )[0] as [string, number] | undefined;

  if (mostCommonTime && mostCommonTime[1] >= 2) {
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

  if (data.topResources.length === 0 && data.totalEventsLast30 > 2) {
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

  if (data.moodCheckInsLast30 === 0) {
    recs.push({
      type: "mood",
      icon: Heart,
      title: "Start Mood Check-ins",
      description:
        "Regular mood check-ins help this page reflect your real patterns and give you clearer recommendations.",
      action: "Check In Now",
      actionLink: "/app/mood-check-in",
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
}

export function computeSafetyInsights(params: {
  events: SafetyEvent[];
  topResources: Array<ResourceAnalytics & { rank: number }>;
  resourcesByState: Record<string, number>;
  currentState: string;
  moods: Array<MoodEntryLite & { notes?: string }>;
}): SafetyInsightsData {
  const { events, topResources, resourcesByState, currentState, moods } = params;

  const start30 = thirtyDaysAgo();
  const last30Days = events.filter((e) => new Date(e.timestamp) >= start30);
  const moodsLast30 = filterMoodsLast30Days(moods);

  const stateDistribution = events.reduce<Record<string, number>>((acc, event) => {
    const state = event.newState || "NORMAL";
    acc[state] = (acc[state] || 0) + 1;
    return acc;
  }, {});

  const timePatterns: Record<string, number> = {};
  for (const event of events) {
    if (new Date(event.timestamp) < start30) continue;
    const period = periodFromHour(new Date(event.timestamp).getHours());
    timePatterns[period] = (timePatterns[period] || 0) + 1;
  }
  for (const m of moodsLast30) {
    const d = new Date(m.created_at);
    if (Number.isNaN(d.getTime())) continue;
    const period = periodFromHour(d.getHours());
    timePatterns[period] = (timePatterns[period] || 0) + 1;
  }

  const dayPatterns = events.reduce<Record<string, number>>((acc, event) => {
    const day = new Date(event.timestamp).getDay();
    acc[DAY_NAMES[day]] = (acc[DAY_NAMES[day]] || 0) + 1;
    return acc;
  }, {});

  const triggers = events.reduce<Record<string, number>>((acc, event) => {
    const signal = event.trigger || event.detectedSignals?.[0];
    if (!signal || signal.startsWith("resource_")) return acc;
    acc[signal] = (acc[signal] || 0) + 1;
    return acc;
  }, {});

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
    triggers,
    trend,
    topResources,
    totalEventsLast30: last30Days.length,
    moodCheckInsLast30: moodsLast30.length,
  });

  return {
    totalEvents: events.length,
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
    moodCheckInsLast30: moodsLast30.length,
    moodStreak: computeCheckInStreak(moods),
  };
}

export type SnapshotTone = "emerald" | "amber" | "rose";

/** Display model for the Safety Snapshot rail card — derived from insights + check-ins. */
export interface SafetySnapshotDisplay {
  safetyScore: number;
  scoreTone: SnapshotTone;
  trend: SafetyTrend;
  trendLabel: string;
  trendTone: SnapshotTone;
  trendDetail: string;
  riskLabel: string;
  riskTone: SnapshotTone;
  riskDetail: string;
  lastCheckInLabel: string;
  lastCheckInSource: "mood" | "safety" | null;
  moodCheckInsLast30: number;
  safetyMomentsLast30: number;
  moodStreak: number;
}

export function scoreToneForValue(score: number): SnapshotTone {
  if (score >= 80) return "emerald";
  if (score >= 50) return "amber";
  return "rose";
}

export function trendLabelForTrend(trend: SafetyTrend): string {
  if (trend === "decreasing") return "Improving";
  if (trend === "increasing") return "Needs care";
  return "Stable";
}

export function trendToneForTrend(trend: SafetyTrend): SnapshotTone {
  if (trend === "increasing") return "amber";
  if (trend === "decreasing") return "emerald";
  return "emerald";
}

export function trendDetailText(
  trend: SafetyTrend,
  highRiskLast14: number,
  highRiskPrevious14: number
): string {
  if (highRiskLast14 === 0 && highRiskPrevious14 === 0) {
    return "No elevated safety moments in the last 28 days.";
  }
  if (trend === "increasing") {
    return `${highRiskLast14} elevated moment${highRiskLast14 === 1 ? "" : "s"} (last 14d) vs ${highRiskPrevious14} in the prior 14d.`;
  }
  if (trend === "decreasing") {
    return `${highRiskLast14} elevated moment${highRiskLast14 === 1 ? "" : "s"} (last 14d), down from ${highRiskPrevious14}.`;
  }
  return `${highRiskLast14} elevated moment${highRiskLast14 === 1 ? "" : "s"} in each of the last two 14-day windows.`;
}

/**
 * Risk level: live session state first, then recent elevated counts, then safety score.
 */
export function computeSnapshotRisk(
  safetyScore: number,
  currentState: string,
  highRiskLast14: number
): { label: string; tone: SnapshotTone; detail: string } {
  if (currentState === "SAFETY_MODE") {
    return {
      label: "Elevated",
      tone: "rose",
      detail: "Safety mode is active—use your plan or emergency resources.",
    };
  }
  if (currentState === "HIGH_RISK") {
    return {
      label: "Elevated",
      tone: "rose",
      detail: "High-risk state detected—support resources are recommended.",
    };
  }
  if (currentState === "ELEVATED_CONCERN") {
    return {
      label: "Moderate",
      tone: "amber",
      detail: "Elevated concern in your current session.",
    };
  }
  if (currentState === "COOLDOWN") {
    return {
      label: "Moderate",
      tone: "amber",
      detail: "Cooling down after a difficult moment.",
    };
  }
  if (highRiskLast14 >= 3) {
    return {
      label: "Moderate",
      tone: "amber",
      detail: `${highRiskLast14} elevated moments in the last 14 days.`,
    };
  }
  if (safetyScore >= 80) {
    return { label: "Low", tone: "emerald", detail: "Patterns look steady based on recent activity." };
  }
  if (safetyScore >= 50) {
    return {
      label: "Moderate",
      tone: "amber",
      detail: "Mixed safety signals—check-ins and your plan can help.",
    };
  }
  return {
    label: "Elevated",
    tone: "rose",
    detail: "Several elevated moments recently—reach out if you need support.",
  };
}

export function lastCheckInDisplay(
  checkIns: SafetyCheckInEntry[],
  safetyMomentsLast30: number
): { label: string; source: "mood" | "safety" | null } {
  const latest = checkIns[0];
  if (!latest) {
    return {
      label: safetyMomentsLast30 > 0 ? "Recently" : "Not yet",
      source: null,
    };
  }
  const d = new Date(latest.timestamp);
  let label = "Not yet";
  if (!Number.isNaN(d.getTime())) {
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (diffDays === 0) {
      label = `Today, ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
    } else if (diffDays === 1) {
      label = "Yesterday";
    } else {
      label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
  }
  const source = latest.note.toLowerCase().includes("mood check-in") ? "mood" : "safety";
  return { label, source };
}

/** Builds all Safety Snapshot rail fields from computed insights. */
export function computeSafetySnapshot(
  insights: Pick<
    SafetyInsightsData,
    | "safetyScore"
    | "trend"
    | "highRiskLast14"
    | "highRiskPrevious14"
    | "moodCheckInsLast30"
    | "last30DaysCount"
    | "moodStreak"
    | "currentState"
  >,
  checkIns: SafetyCheckInEntry[]
): SafetySnapshotDisplay {
  const risk = computeSnapshotRisk(
    insights.safetyScore,
    insights.currentState,
    insights.highRiskLast14
  );
  const last = lastCheckInDisplay(checkIns, insights.last30DaysCount);

  return {
    safetyScore: insights.safetyScore,
    scoreTone: scoreToneForValue(insights.safetyScore),
    trend: insights.trend,
    trendLabel: trendLabelForTrend(insights.trend),
    trendTone: trendToneForTrend(insights.trend),
    trendDetail: trendDetailText(
      insights.trend,
      insights.highRiskLast14,
      insights.highRiskPrevious14
    ),
    riskLabel: risk.label,
    riskTone: risk.tone,
    riskDetail: risk.detail,
    lastCheckInLabel: last.label,
    lastCheckInSource: last.source,
    moodCheckInsLast30: insights.moodCheckInsLast30,
    safetyMomentsLast30: insights.last30DaysCount,
    moodStreak: insights.moodStreak,
  };
}

/** One-line summary of how the hero safety score is calculated. */
export const SAFETY_SCORE_FORMULA_HINT =
  "Weighted average of your safety states (30d), adjusted ±5 for trend. With no safety moments, score defaults to 100.";

export const SNAPSHOT_DATA_SOURCES_HINT =
  "Mood check-ins from your account; safety moments from sessions and resource use with a safety state.";
