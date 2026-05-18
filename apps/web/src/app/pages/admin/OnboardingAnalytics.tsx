import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { api } from "../../../lib/api";
import { AdminAnalyticsToolbar } from "../../components/admin/AdminAnalyticsToolbar";
import { datesForPreset, downloadCsv } from "@/lib/adminAnalytics";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Users,
  Clock,
  Target,
  CheckCircle,
  XCircle,
  ArrowRight,
  Zap,
} from "lucide-react";

function formatAnalyticsRangeLabel(from: string, to: string): string {
  try {
    const a = new Date(`${from}T12:00:00Z`);
    const b = new Date(`${to}T12:00:00Z`);
    const o: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
    return `${a.toLocaleDateString(undefined, o)} – ${b.toLocaleDateString(undefined, o)}`;
  } catch {
    return `${from} – ${to}`;
  }
}

function shortDayLabel(isoDate: string): string {
  try {
    return isoDate.slice(5, 10);
  } catch {
    return isoDate;
  }
}

export function OnboardingAnalytics() {
  const [dateFrom, setDateFrom] = useState(datesForPreset("30d").dateFrom);
  const [dateTo, setDateTo] = useState(datesForPreset("30d").dateTo);
  const [dash, setDash] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadStats = useCallback(async (forceRefresh?: boolean) => {
    setIsLoading(true);
    try {
      setDash(
        await api.admin.getStats({
          chartPeriod: "month",
          dateFrom,
          dateTo,
          ...(forceRefresh ? { refresh: true } : {}),
        })
      );
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const onboard = dash?.onboardingStats as
    | {
        signupsInRange?: number;
        completionsInRange?: number;
        completionRatePercent?: number;
        daily?: { date: string; signups: number; completions: number }[];
      }
    | undefined;

  const daily = onboard?.daily ?? [];

  const completionTrend = useMemo(() => {
    if (!daily.length) return [{ date: "—", rate: 0 }];
    return daily.map((d) => ({
      date: shortDayLabel(d.date),
      rate:
        d.signups > 0
          ? Math.round((d.completions / d.signups) * 1000) / 10
          : 0,
    }));
  }, [daily]);

  const signupsVsCompletions = useMemo(() => {
    if (!daily.length) return [{ date: "—", signups: 0, completions: 0 }];
    return daily.map((d) => ({
      date: shortDayLabel(d.date),
      signups: d.signups ?? 0,
      completions: d.completions ?? 0,
    }));
  }, [daily]);

  const signupsInRange = Math.max(0, Number(onboard?.signupsInRange) || 0);
  const completionsInRange = Math.max(0, Number(onboard?.completionsInRange) || 0);
  const completionRatePct = Number(onboard?.completionRatePercent ?? 0);
  const droppedOff = Math.max(0, signupsInRange - completionsInRange);
  const reportingDays = Math.max(1, daily.length);
  const avgSignupsPerDay = Math.round((signupsInRange / reportingDays) * 10) / 10;

  const insightLines = useMemo(() => {
    if (signupsInRange === 0) {
      return [
        "No profile signups in this date range. Widen the range or confirm tracking on new registrations.",
      ];
    }
    if (completionRatePct >= 75) {
      return [
        `Strong completion rate (${completionRatePct}%) for this window — keep monitoring daily signups vs completions.`,
      ];
    }
    if (completionRatePct >= 40) {
      return [
        `Completion rate is ${completionRatePct}%. Compare signups vs completions on the chart to spot days that lag.`,
        "Per-step funnel breakdown needs product analytics instrumentation (not available in admin stats yet).",
      ];
    }
    return [
      `Completion rate is ${completionRatePct}%. Many users start but do not finish onboarding — review required steps and time-to-complete in the product.`,
      "Step-level drop-off is not available until events are tracked per onboarding screen.",
    ];
  }, [signupsInRange, completionRatePct]);

  if (isLoading && !dash) {
    return (
      <AdminLayoutNew>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
        </div>
      </AdminLayoutNew>
    );
  }

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Onboarding Analytics</h1>
            <p className="text-gray-600 mt-1">Track user journey through onboarding funnel</p>
            <p className="text-sm text-muted-foreground mt-2">
              {formatAnalyticsRangeLabel(dateFrom, dateTo)} · All metrics below use signups and{" "}
              <span className="font-medium">onboarding_completed</span> for this range (daily series from admin stats).
            </p>
          </div>

          <AdminAnalyticsToolbar
            showChartPeriod={false}
            showRangePreset={false}
            chartPeriod="month"
            onChartPeriodChange={() => {}}
            rangePreset="30d"
            onRangePresetChange={() => {}}
            useCustomRange
            onUseCustomRangeChange={() => {}}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            onRefresh={() => void loadStats(true)}
            isLoading={isLoading}
            onExport={() => {
              if (!onboard?.daily?.length) return;
              downloadCsv(`onboarding-analytics-${new Date().toISOString().slice(0, 10)}.csv`, onboard.daily);
            }}
          />
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Started</p>
                <p className="text-2xl font-bold text-gray-900">{signupsInRange.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-0.5">signups in range</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-6 shadow-lg border-2 border-green-200"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Completed</p>
                <p className="text-2xl font-bold text-green-600">{completionsInRange.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-0.5">onboarding_completed</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Completion rate</p>
                <p className="text-2xl font-bold text-gray-900">{completionRatePct}%</p>
                <p className="text-xs text-gray-500 mt-0.5">completed / started</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-red-600">
                <XCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Dropped off</p>
                <p className="text-2xl font-bold text-gray-900">{droppedOff.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-0.5">started − completed</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Avg signups / day</p>
                <p className="text-2xl font-bold text-gray-900">{avgSignupsPerDay}</p>
                <p className="text-xs text-gray-500 mt-0.5">over {reportingDays} day(s) in range</p>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-1">Daily completion rate</h2>
            <p className="text-sm text-gray-500 mb-4">completions ÷ signups per day (same range)</p>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={completionTrend} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="colorRateOa" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  stroke="#6b7280"
                  tick={{ fontSize: 11 }}
                  angle={-35}
                  textAnchor="end"
                  height={64}
                  interval="preserveStartEnd"
                  minTickGap={16}
                />
                <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} width={36} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "12px",
                  }}
                  formatter={(v: number) => [`${v}%`, "Rate"]}
                />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRateOa)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-1">Signups vs completions</h2>
            <p className="text-sm text-gray-500 mb-4">Daily counts from admin stats (range-scoped)</p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={signupsVsCompletions} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  stroke="#6b7280"
                  tick={{ fontSize: 11 }}
                  angle={-35}
                  textAnchor="end"
                  height={64}
                  interval="preserveStartEnd"
                  minTickGap={16}
                />
                <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} width={40} domain={[0, "auto"]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "12px",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="signups"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                  name="Signups"
                />
                <Line
                  type="monotone"
                  dataKey="completions"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  name="Completions"
                />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Honest 2-step funnel (only aggregates API exposes) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-1">Onboarding funnel (summary)</h2>
          <p className="text-sm text-gray-500 mb-6">
            Step-by-step screens are not tracked in admin stats yet — this shows start vs complete for the selected
            range only.
          </p>

          <div className="space-y-6 max-w-3xl">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-sm">
                    1
                  </span>
                  <div>
                    <h3 className="font-bold text-gray-900">Started onboarding</h3>
                    <p className="text-xs text-gray-600">Profiles created in range (same basis as signups)</p>
                  </div>
                </div>
                <p className="font-bold text-gray-900">{signupsInRange.toLocaleString()}</p>
              </div>
              <div className="h-12 bg-gray-100 rounded-xl overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center px-4 text-white text-sm font-medium"
                  style={{ width: signupsInRange > 0 ? "100%" : "0%" }}
                >
                  {signupsInRange > 0 ? "100% of cohort" : "—"}
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <ArrowRight className="w-5 h-5 text-gray-400" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 text-white font-bold text-sm">
                    2
                  </span>
                  <div>
                    <h3 className="font-bold text-gray-900">Completed onboarding</h3>
                    <p className="text-xs text-gray-600">onboarding_completed in range</p>
                  </div>
                </div>
                <p className="font-bold text-gray-900">{completionsInRange.toLocaleString()}</p>
              </div>
              <div className="h-12 bg-gray-100 rounded-xl overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-600 flex items-center px-4 text-white text-sm font-medium"
                  style={{
                    width: signupsInRange > 0 ? `${Math.min(100, (completionsInRange / signupsInRange) * 100)}%` : "0%",
                  }}
                >
                  {signupsInRange > 0
                    ? `${Math.round((completionsInRange / signupsInRange) * 1000) / 10}% of starters`
                    : "—"}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 shadow-lg border-2 border-blue-200"
        >
          <div className="flex items-center gap-3 mb-4">
            <Zap className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Insights</h2>
          </div>
          <ul className="space-y-3 text-sm text-gray-700 list-none">
            {insightLines.map((line, i) => (
              <li key={i} className="flex gap-2 pl-1">
                <span className="text-blue-500 font-bold leading-snug">·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </AdminLayoutNew>
  );
}
