import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  TrendingUp,
  TrendingDown,
  Eye,
  Heart,
  Clock,
  Award,
  Target,
  Download,
  RefreshCw,
  FileText,
  Lightbulb,
  Activity,
  Video,
  Loader2,
  BarChart2,
  Star,
  Sparkles,
  AlertCircle,
  Info,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart as RechartsPie,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useState, useEffect, useCallback } from "react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { api } from "@/lib/api";

type PerfRange = "7d" | "30d" | "90d";

type ContentPerformancePayload = {
  rangeDays?: number;
  generatedAt?: string;
  counts?: {
    wellnessCompletions: number;
    journalEntries: number;
    catalogTools: number;
    sessionsWithRating: number;
  };
  summary: {
    totalViews: number;
    totalEngagement: number;
    avgCompletionPct: number;
    avgRating: number;
    viewsChangePct: number;
    engagementChangePct: number;
    completionChangePct: number;
    ratingChangePct: number;
  };
  weeklyTrend: { date: string; views: number; likes: number; shares: number; completions: number }[];
  topTools: {
    id: string;
    title: string;
    type: string;
    category: string;
    views: number;
    engagement: number;
    rating: number;
  }[];
  categoryEngagement: { category: string; engagement: number; views: number }[];
  contentTypeData: { name: string; value: number; count: number; color: string }[];
  completionRates: { type: string; started: number; completed: number; rate: number }[];
  trending: { week: string; trending: number; views: number }[];
};

const iconForType = (type: string) => {
  switch (type) {
    case "activity":
      return Activity;
    case "video":
      return Video;
    case "tip":
      return Lightbulb;
    default:
      return FileText;
  }
};

const colorForType = (type: string) => {
  switch (type) {
    case "activity":
      return "#10b981";
    case "video":
      return "#ec4899";
    case "tip":
      return "#f59e0b";
    default:
      return "#3b82f6";
  }
};

function formatPct(p: number) {
  if (!Number.isFinite(p)) return "0%";
  const sign = p > 0 ? "+" : "";
  return `${sign}${p.toFixed(1)}%`;
}

const RANGE_LABELS: Record<PerfRange, string> = {
  "7d": "Last 7 Days",
  "30d": "Last 30 Days",
  "90d": "Last 90 Days",
};

const tooltipStyle = {
  backgroundColor: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: "10px",
  color: "#f1f5f9",
  fontSize: "13px",
  boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
};

export function ContentPerformance() {
  const [timeRange, setTimeRange] = useState<PerfRange>("30d");
  const [data, setData] = useState<ContentPerformancePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = (await api.admin.getContentPerformance({ range: timeRange })) as ContentPerformancePayload;
      setData(res);
    } catch (e) {
      console.error(e);
      setError("Could not load analytics. Check admin sign-in and that the API is reachable.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = data?.summary;
  const performanceData = data?.weeklyTrend?.length
    ? data.weeklyTrend
    : [{ date: "—", views: 0, likes: 0, shares: 0, completions: 0 }];
  const topContent = data?.topTools ?? [];
  const contentTypeData =
    data != null && Array.isArray(data.contentTypeData) && data.contentTypeData.length > 0
      ? data.contentTypeData
      : [{ name: "No wellness tools yet", value: 100, count: 0, color: "#94a3b8" }];
  const categoryEngagement =
    data != null && Array.isArray(data.categoryEngagement) && data.categoryEngagement.length > 0
      ? data.categoryEngagement
      : [{ category: "—", engagement: 0, views: 0 }];
  const completionRates =
    data != null && Array.isArray(data.completionRates) && data.completionRates.length > 0
      ? data.completionRates
      : [{ type: "—", started: 0, completed: 0, rate: 0 }];
  const trendingData =
    data != null && Array.isArray(data.trending) && data.trending.length > 0
      ? data.trending
      : [{ week: "—", trending: 0, views: 0 }];

  const counts = data?.counts;
  const noWellnessActivity =
    data?.counts != null &&
    data.counts.wellnessCompletions === 0 &&
    data.counts.journalEntries === 0;

  const trendMax = Math.max(
    1,
    ...performanceData.map((d) => Math.max(d.views, d.likes, d.shares, d.completions))
  );
  const lineTrendMaxLeft = Math.max(1, ...trendingData.map((d) => d.trending));
  const lineTrendMaxRight = Math.max(1, ...trendingData.map((d) => d.views));

  const stats = summary
    ? [
        {
          label: "Activity & Journals",
          value: summary.totalViews.toLocaleString(),
          change: formatPct(summary.viewsChangePct),
          trend: summary.viewsChangePct >= 0 ? ("up" as const) : ("down" as const),
          icon: Eye,
          gradient: "from-blue-500 to-cyan-500",
          bg: "from-blue-50 to-cyan-50",
          border: "border-blue-100",
          textColor: "text-blue-700",
          iconBg: "bg-blue-500",
        },
        {
          label: "Strong Ratings (4★+)",
          value: summary.totalEngagement.toLocaleString(),
          change: formatPct(summary.engagementChangePct),
          trend: summary.engagementChangePct >= 0 ? ("up" as const) : ("down" as const),
          icon: Heart,
          gradient: "from-pink-500 to-rose-500",
          bg: "from-pink-50 to-rose-50",
          border: "border-pink-100",
          textColor: "text-pink-700",
          iconBg: "bg-pink-500",
        },
        {
          label: "Feedback Rate",
          value: `${summary.avgCompletionPct.toFixed(1)}%`,
          change: formatPct(summary.completionChangePct),
          trend: summary.completionChangePct >= 0 ? ("up" as const) : ("down" as const),
          icon: Target,
          gradient: "from-emerald-500 to-green-500",
          bg: "from-emerald-50 to-green-50",
          border: "border-emerald-100",
          textColor: "text-emerald-700",
          iconBg: "bg-emerald-500",
        },
        {
          label: "Avg Session Rating",
          value: summary.avgRating > 0 ? summary.avgRating.toFixed(1) : "—",
          change: formatPct(summary.ratingChangePct),
          trend: summary.ratingChangePct >= 0 ? ("up" as const) : ("down" as const),
          icon: Star,
          gradient: "from-amber-500 to-orange-500",
          bg: "from-amber-50 to-orange-50",
          border: "border-amber-100",
          textColor: "text-amber-700",
          iconBg: "bg-amber-500",
        },
      ]
    : [];

  const exportJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `content-performance-${timeRange}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6 pb-10">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-6 lg:p-8 text-white shadow-xl shadow-purple-200"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-5 h-5 text-purple-200" />
                <span className="text-purple-200 text-sm font-medium tracking-wide uppercase">Analytics</span>
              </div>
              <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">Content Performance</h1>
              <p className="text-purple-100 text-sm max-w-2xl leading-relaxed">
                Wellness session completions, journal volume, and star ratings from completed sessions.
                Charts are empty when no events exist in the selected range — not placeholder data.
              </p>

              {data?.generatedAt && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-full px-3 py-1 text-xs text-purple-100">
                    <Clock className="w-3 h-3" />
                    {new Date(data.generatedAt).toLocaleString()}
                  </span>
                  {data.rangeDays != null && (
                    <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-full px-3 py-1 text-xs text-purple-100">
                      {data.rangeDays}d range
                    </span>
                  )}
                  {counts != null && (
                    <>
                      <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-full px-3 py-1 text-xs text-purple-100">
                        <Activity className="w-3 h-3" />
                        {counts.wellnessCompletions} completions
                      </span>
                      <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-full px-3 py-1 text-xs text-purple-100">
                        <FileText className="w-3 h-3" />
                        {counts.journalEntries} journal entries
                      </span>
                      <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-full px-3 py-1 text-xs text-purple-100">
                        <BarChart2 className="w-3 h-3" />
                        {counts.catalogTools} tools
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <div className="flex items-center gap-1 bg-white/10 border border-white/20 backdrop-blur-sm rounded-xl p-1">
                {(["7d", "30d", "90d"] as const).map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setTimeRange(range)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      timeRange === range
                        ? "bg-white text-purple-700 shadow-md"
                        : "text-purple-100 hover:bg-white/15"
                    }`}
                  >
                    {RANGE_LABELS[range]}
                  </button>
                ))}
              </div>

              <Button
                type="button"
                className="bg-white/15 hover:bg-white/25 border border-white/20 text-white backdrop-blur-sm"
                disabled={!data}
                onClick={exportJson}
              >
                <Download className="w-4 h-4 mr-2" />
                Export JSON
              </Button>

              <Button
                type="button"
                className="bg-white/15 hover:bg-white/25 border border-white/20 text-white backdrop-blur-sm w-10 h-10 p-0"
                onClick={() => void load()}
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </motion.div>

        {/* ── Banners ── */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-800"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
            {error}
          </motion.div>
        )}

        {data && noWellnessActivity && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3.5 text-sm text-blue-900"
          >
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
            <span>
              <strong>No activity in this window.</strong> Metrics require completed wellness sessions and/or journal entries with
              timestamps in the selected range. Complete a session in the user app (or seed test data) and refresh — pie slices
              still reflect CMS tool counts if tools exist.
            </span>
          </motion.div>
        )}

        {/* ── Loading state ── */}
        {loading && !data ? (
          <div className="flex flex-col items-center justify-center py-32 text-gray-400">
            <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center mb-4">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
            <p className="text-sm font-medium text-gray-500">Loading analytics…</p>
          </div>
        ) : (
          <>
            {/* ── Stat Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.07 }}
                >
                  <Card className={`relative overflow-hidden border ${stat.border} bg-gradient-to-br ${stat.bg} p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg`}>
                        <stat.icon className="w-5 h-5 text-white" />
                      </div>
                      <div
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          stat.trend === "up"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {stat.trend === "up" ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {stat.change}
                      </div>
                    </div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{stat.label}</p>
                    <h3 className="text-3xl font-bold text-gray-900">{stat.value}</h3>
                    <div className={`absolute bottom-0 right-0 w-20 h-20 rounded-full bg-gradient-to-br ${stat.gradient} opacity-5 translate-x-6 translate-y-6`} />
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* ── Performance Trend Chart ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="bg-white border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Performance Trend</h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Completions, ratings and engagement proxies over time
                    </p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                    <Activity className="w-4.5 h-4.5 text-purple-600" />
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={performanceData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradViews" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradLikes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ec4899" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#ec4899" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradShares" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" stroke="#cbd5e1" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis stroke="#cbd5e1" tick={{ fill: "#94a3b8", fontSize: 12 }} domain={[0, trendMax]} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "13px", paddingTop: "16px" }} />
                    <Area type="monotone" dataKey="views" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#gradViews)" name="Activity index" dot={false} />
                    <Area type="monotone" dataKey="likes" stroke="#ec4899" strokeWidth={2.5} fillOpacity={1} fill="url(#gradLikes)" name="4★+ ratings" dot={false} />
                    <Area type="monotone" dataKey="shares" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#gradShares)" name="Engagement proxy" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </motion.div>

            {/* ── Top Tools + Category Pie ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top Wellness Tools */}
              <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.28 }}>
                <Card className="bg-white border border-gray-100 shadow-sm p-6 h-full">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Top Wellness Tools</h3>
                      <p className="text-sm text-gray-500 mt-0.5">By completed sessions in this range</p>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                      <Award className="w-4.5 h-4.5 text-amber-500" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    {topContent.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                        <BarChart2 className="w-8 h-8 mb-2 text-gray-300" />
                        <p className="text-sm">No completions in this period yet.</p>
                      </div>
                    ) : (
                      topContent.map((content, index) => {
                        const Icon = iconForType(content.type);
                        const col = colorForType(content.type);
                        const rankColors = ["text-amber-500", "text-slate-400", "text-orange-400"];
                        return (
                          <motion.div
                            key={content.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 + index * 0.06 }}
                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                          >
                            <span className={`text-lg font-black w-6 text-center shrink-0 ${rankColors[index] ?? "text-gray-400"}`}>
                              {index + 1}
                            </span>
                            <div
                              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                              style={{ backgroundColor: `${col}18` }}
                            >
                              <Icon className="w-4.5 h-4.5" style={{ color: col }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-gray-900 font-semibold text-sm truncate">{content.title}</h4>
                              <div className="flex items-center gap-2.5 text-xs text-gray-400 mt-0.5">
                                <span className="flex items-center gap-1">
                                  <Eye className="w-3 h-3" />
                                  {content.views.toLocaleString()}
                                </span>
                                <span>{content.engagement}% engagement</span>
                                <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-medium">{content.category}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-3 h-3 transition-colors ${
                                    i < Math.round(content.rating)
                                      ? "fill-amber-400 text-amber-400"
                                      : "text-gray-200 fill-gray-200"
                                  }`}
                                />
                              ))}
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </Card>
              </motion.div>

              {/* Tools by Category (Pie) */}
              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.28 }}>
                <Card className="bg-white border border-gray-100 shadow-sm p-6 h-full">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Tools by Category</h3>
                      <p className="text-sm text-gray-500 mt-0.5">Catalog distribution (CMS tools)</p>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                      <FileText className="w-4.5 h-4.5 text-blue-500" />
                    </div>
                  </div>

                  <div className="flex flex-col items-center">
                    <ResponsiveContainer width="100%" height={240}>
                      <RechartsPie>
                        <Pie
                          data={contentTypeData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          innerRadius={55}
                          outerRadius={95}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {contentTypeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="white" strokeWidth={2} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(value: number, name: string) => [`${value}%`, name]}
                        />
                      </RechartsPie>
                    </ResponsiveContainer>

                    <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 w-full mt-2">
                      {contentTypeData.map((type) => (
                        <div key={type.name} className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: type.color }} />
                          <span className="text-xs text-gray-600 truncate">
                            {type.name}
                            {type.count > 0 && (
                              <span className="ml-1 text-gray-400">({type.count})</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </motion.div>
            </div>

            {/* ── Engagement by Category + Feedback Rate ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Engagement bar chart */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
                <Card className="bg-white border border-gray-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Engagement by Category</h3>
                      <p className="text-sm text-gray-500 mt-0.5">Completed sessions (relative)</p>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                      <Target className="w-4.5 h-4.5 text-emerald-500" />
                    </div>
                  </div>

                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={categoryEngagement} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" stroke="#e2e8f0" tick={{ fill: "#94a3b8", fontSize: 12 }} domain={[0, 100]} axisLine={false} tickLine={false} />
                      <YAxis dataKey="category" type="category" stroke="#e2e8f0" tick={{ fill: "#64748b", fontSize: 12 }} width={110} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="engagement" fill="url(#barGrad)" radius={[0, 6, 6, 0]}>
                        <defs>
                          <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#10b981" />
                            <stop offset="100%" stopColor="#34d399" />
                          </linearGradient>
                        </defs>
                        {categoryEngagement.map((_, idx) => (
                          <Cell key={idx} fill="url(#barGrad)" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </motion.div>

              {/* Feedback Rate progress bars */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
                <Card className="bg-white border border-gray-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Feedback Rate by Category</h3>
                      <p className="text-sm text-gray-500 mt-0.5">Share of sessions with a rating</p>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-cyan-50 flex items-center justify-center">
                      <Clock className="w-4.5 h-4.5 text-cyan-500" />
                    </div>
                  </div>

                  <div className="space-y-5">
                    {completionRates.map((item, index) => (
                      <div key={item.type} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-800">{item.type}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-400">
                              {item.completed.toLocaleString()} / {item.started.toLocaleString()} rated
                            </span>
                            <span className="text-base font-bold text-gray-900 tabular-nums w-12 text-right">{item.rate}%</span>
                          </div>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, item.rate)}%` }}
                            transition={{ duration: 0.9, delay: 0.4 + index * 0.1, ease: "easeOut" }}
                            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            </div>

            {/* ── Completions Over Time ── */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
              <Card className="bg-white border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Completions Over Time</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Session completions vs activity index</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
                    <TrendingUp className="w-4.5 h-4.5 text-orange-500" />
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={trendingData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="week" stroke="#e2e8f0" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" stroke="#e2e8f0" tick={{ fill: "#94a3b8", fontSize: 12 }} domain={[0, lineTrendMaxLeft]} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" stroke="#e2e8f0" tick={{ fill: "#94a3b8", fontSize: 12 }} domain={[0, lineTrendMaxRight]} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "13px", paddingTop: "16px" }} />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="trending"
                      stroke="#f59e0b"
                      strokeWidth={3}
                      dot={{ fill: "#f59e0b", r: 4, strokeWidth: 2, stroke: "#fff" }}
                      activeDot={{ r: 6 }}
                      name="Completions"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="views"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      strokeDasharray="6 3"
                      dot={false}
                      name="Activity index"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </motion.div>
          </>
        )}
      </div>
    </AdminLayoutNew>
  );
}
