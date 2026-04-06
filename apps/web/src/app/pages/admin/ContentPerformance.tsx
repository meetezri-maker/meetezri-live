import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  TrendingUp,
  TrendingDown,
  Eye,
  Heart,
  Share2,
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
      setError("Could not load analytics. Check admin sign-in and API.");
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
    data?.contentTypeData?.length > 0
      ? data.contentTypeData
      : [{ name: "No wellness tools yet", value: 100, count: 0, color: "#94a3b8" }];
  const categoryEngagement =
    data?.categoryEngagement?.length > 0
      ? data.categoryEngagement
      : [{ category: "—", engagement: 0, views: 0 }];
  const completionRates =
    data?.completionRates?.length > 0
      ? data.completionRates
      : [{ type: "—", started: 0, completed: 0, rate: 0 }];
  const trendingData =
    data?.trending?.length > 0
      ? data.trending
      : [{ week: "—", trending: 0, views: 0 }];

  const stats = summary
    ? [
        {
          label: "Activity & journals",
          value: summary.totalViews.toLocaleString(),
          change: formatPct(summary.viewsChangePct),
          trend: summary.viewsChangePct >= 0 ? ("up" as const) : ("down" as const),
          icon: Eye,
          color: "from-blue-500 to-cyan-600",
        },
        {
          label: "Strong ratings (4★+)",
          value: summary.totalEngagement.toLocaleString(),
          change: formatPct(summary.engagementChangePct),
          trend: summary.engagementChangePct >= 0 ? ("up" as const) : ("down" as const),
          icon: Heart,
          color: "from-pink-500 to-rose-600",
        },
        {
          label: "Feedback rate",
          value: `${summary.avgCompletionPct.toFixed(1)}%`,
          change: formatPct(summary.completionChangePct),
          trend: summary.completionChangePct >= 0 ? ("up" as const) : ("down" as const),
          icon: Target,
          color: "from-green-500 to-emerald-600",
        },
        {
          label: "Avg session rating",
          value: summary.avgRating > 0 ? summary.avgRating.toFixed(1) : "—",
          change: formatPct(summary.ratingChangePct),
          trend: summary.ratingChangePct >= 0 ? ("up" as const) : ("down" as const),
          icon: Award,
          color: "from-orange-500 to-amber-600",
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
      <div className="max-w-7xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
        >
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Content Performance</h1>
            <p className="text-gray-600">
              Wellness session completions, journal activity, and tool feedback (live data)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1 border border-gray-200">
              {(["7d", "30d", "90d"] as const).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    timeRange === range
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg"
                      : "text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {range === "7d" && "Last 7 Days"}
                  {range === "30d" && "Last 30 Days"}
                  {range === "90d" && "Last 90 Days"}
                </button>
              ))}
            </div>

            <Button
              type="button"
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white"
              disabled={!data}
              onClick={exportJson}
            >
              <Download className="w-4 h-4 mr-2" />
              Export JSON
            </Button>

            <Button
              type="button"
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>
        </motion.div>

        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>
        )}

        {loading && !data ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-500">
            <Loader2 className="w-10 h-10 animate-spin mb-3" />
            <p>Loading analytics…</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="bg-white border border-gray-200 p-6 hover:shadow-lg transition-all">
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}
                      >
                        <stat.icon className="w-6 h-6 text-white" />
                      </div>
                      <div
                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          stat.trend === "up" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {stat.trend === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {stat.change}
                      </div>
                    </div>
                    <h3 className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</h3>
                    <p className="text-sm text-gray-600">{stat.label}</p>
                  </Card>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="bg-white border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">Performance trend</h3>
                    <p className="text-sm text-gray-600">
                      Completions (sessions) with feedback and engagement proxies
                    </p>
                  </div>
                  <Activity className="w-5 h-5 text-purple-600" />
                </div>

                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={performanceData}>
                    <defs>
                      <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorLikes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorShares" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid #374151",
                        borderRadius: "8px",
                        color: "#fff",
                      }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="views"
                      stroke="#3b82f6"
                      fillOpacity={1}
                      fill="url(#colorViews)"
                      name="Activity index"
                    />
                    <Area
                      type="monotone"
                      dataKey="likes"
                      stroke="#ec4899"
                      fillOpacity={1}
                      fill="url(#colorLikes)"
                      name="4★+ ratings"
                    />
                    <Area
                      type="monotone"
                      dataKey="shares"
                      stroke="#10b981"
                      fillOpacity={1}
                      fill="url(#colorShares)"
                      name="Engagement proxy"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="bg-white border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">Top wellness tools</h3>
                      <p className="text-sm text-gray-600">By completed sessions in this range</p>
                    </div>
                    <Award className="w-5 h-5 text-yellow-600" />
                  </div>

                  <div className="space-y-4">
                    {topContent.length === 0 ? (
                      <p className="text-sm text-gray-500">No completions in this period yet.</p>
                    ) : (
                      topContent.map((content, index) => {
                        const Icon = iconForType(content.type);
                        const col = colorForType(content.type);
                        return (
                          <div
                            key={content.id}
                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all"
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <span className="text-2xl font-bold text-purple-600">#{index + 1}</span>
                              <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: `${col}20` }}
                              >
                                <Icon className="w-5 h-5" style={{ color: col }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-gray-900 font-medium text-sm truncate">{content.title}</h4>
                                <div className="flex items-center gap-3 text-xs text-gray-600 mt-1">
                                  <span className="flex items-center gap-1">
                                    <Eye className="w-3 h-3" />
                                    {content.views.toLocaleString()}
                                  </span>
                                  <span>{content.engagement}% engagement</span>
                                  <span className="text-gray-400">{content.category}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {[...Array(5)].map((_, i) => (
                                <Heart
                                  key={i}
                                  className={`w-3 h-3 ${
                                    i < Math.floor(content.rating)
                                      ? "fill-pink-500 text-pink-500"
                                      : "text-gray-300"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="bg-white border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">Tools by category</h3>
                      <p className="text-sm text-gray-600">Catalog distribution (CMS tools)</p>
                    </div>
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>

                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPie>
                      <Pie
                        data={contentTypeData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {contentTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1f2937",
                          border: "1px solid #374151",
                          borderRadius: "8px",
                          color: "#fff",
                        }}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    {contentTypeData.map((type) => (
                      <div key={type.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: type.color }} />
                        <span className="text-sm text-gray-600">
                          {type.name}: {type.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="bg-white border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">Engagement by category</h3>
                      <p className="text-sm text-gray-600">Completed sessions (relative)</p>
                    </div>
                    <Target className="w-5 h-5 text-green-600" />
                  </div>

                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={categoryEngagement} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" stroke="#6b7280" />
                      <YAxis dataKey="category" type="category" stroke="#6b7280" width={120} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1f2937",
                          border: "1px solid #374151",
                          borderRadius: "8px",
                          color: "#fff",
                        }}
                      />
                      <Bar dataKey="engagement" fill="#10b981" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="bg-white border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">Feedback rate by category</h3>
                      <p className="text-sm text-gray-600">Share of sessions with a rating</p>
                    </div>
                    <Clock className="w-5 h-5 text-cyan-600" />
                  </div>

                  <div className="space-y-4">
                    {completionRates.map((item, index) => (
                      <div key={item.type} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-900 font-medium">{item.type}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-600">
                              {item.completed.toLocaleString()} / {item.started.toLocaleString()} rated
                            </span>
                            <span className="text-lg font-bold text-gray-900">{item.rate}%</span>
                          </div>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, item.rate)}%` }}
                            transition={{ duration: 1, delay: index * 0.1 }}
                            className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="bg-white border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">Completions over time</h3>
                    <p className="text-sm text-gray-600">Session completions vs activity index</p>
                  </div>
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                </div>

                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendingData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="week" stroke="#6b7280" />
                    <YAxis yAxisId="left" stroke="#6b7280" />
                    <YAxis yAxisId="right" orientation="right" stroke="#6b7280" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid #374151",
                        borderRadius: "8px",
                        color: "#fff",
                      }}
                    />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="trending"
                      stroke="#f59e0b"
                      strokeWidth={3}
                      dot={{ fill: "#f59e0b", r: 6 }}
                      name="Completions"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="views"
                      stroke="#3b82f6"
                      strokeWidth={2}
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
