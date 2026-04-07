import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Bell,
  Target,
  Award,
  Download,
  RefreshCw,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
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
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface NudgeNotification {
  id: string;
  title: string;
  channel: "push" | "email" | "in-app" | "sms" | "other";
  audience: string;
  sentCount: number;
  createdAt: Date;
  campaignKey: string;
}

interface PerformanceTrendPoint {
  date: string;
  sent: number;
  opened: number;
  clicked: number;
  converted: number;
}

interface CampaignPerformanceItem {
  name: string;
  sent: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
}

interface NudgeCampaignAggregate {
  key: string;
  name: string;
  channel: NudgeNotification["channel"];
  audience: string;
  recipients: number;
  createdAt: Date;
}

function csvEscapeCell(value: string) {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function NudgePerformance() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [periodMode, setPeriodMode] = useState<"month" | "custom">("month");
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [notifications, setNotifications] = useState<NudgeNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.admin.getManualNotifications();
      const mapped: NudgeNotification[] = Array.isArray(data)
        ? data.map((n: any) => {
            const metadata = n.metadata || {};
            const channelRaw = metadata.channel as string | undefined;
            const channel: NudgeNotification["channel"] =
              channelRaw === "push" ||
              channelRaw === "email" ||
              channelRaw === "in-app" ||
              channelRaw === "sms"
                ? channelRaw
                : "push";
            const count =
              typeof metadata.target_count === "number"
                ? metadata.target_count
                : 1;
            const createdAt = new Date(n.sent_at || n.created_at);
            const audienceRaw = metadata.target_audience as string | undefined;
            let audience = "Targeted";
            if (audienceRaw === "all") {
              audience = "All Users";
            } else if (audienceRaw) {
              audience =
                audienceRaw.charAt(0).toUpperCase() +
                audienceRaw.slice(1) +
                " Users";
            }
            const campaignKey = [
              n.title || "",
              metadata.target_audience || "",
              metadata.schedule_type || "",
              createdAt.toISOString().slice(0, 16),
            ].join("|");
            return {
              id: n.id,
              title: n.title || "Untitled nudge",
              channel,
              audience,
              sentCount: count,
              createdAt,
              campaignKey,
            };
          })
        : [];
      setNotifications(mapped);
    } catch (error: any) {
      console.error("Failed to load nudge performance data", error);
      toast.error(error?.message || "Failed to load nudge performance data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [refreshKey, loadNotifications]);

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (periodMode === "custom") {
      const start = new Date(customStart);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customEnd);
      end.setHours(23, 59, 59, 999);
      return { rangeStart: start, rangeEnd: end };
    }
    const start = new Date(selectedYear, selectedMonth - 1, 1);
    const end = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
    return { rangeStart: start, rangeEnd: end };
  }, [periodMode, selectedYear, selectedMonth, customStart, customEnd]);

  const filteredNotifications = useMemo(
    () =>
      notifications.filter(
        (n) => n.createdAt >= rangeStart && n.createdAt <= rangeEnd
      ),
    [notifications, rangeStart, rangeEnd]
  );

  const campaignAggregates = useMemo(() => {
    const map = new Map<string, NudgeCampaignAggregate>();
    filteredNotifications.forEach((n) => {
      const existing = map.get(n.campaignKey);
      if (!existing) {
        map.set(n.campaignKey, {
          key: n.campaignKey,
          name: n.title,
          channel: n.channel,
          audience: n.audience,
          recipients: n.sentCount,
          createdAt: n.createdAt,
        });
      } else if (n.sentCount > existing.recipients) {
        existing.recipients = n.sentCount;
      }
    });
    return Array.from(map.values());
  }, [filteredNotifications]);

  const totalSent = useMemo(
    () => campaignAggregates.reduce((sum, c) => sum + c.recipients, 0),
    [campaignAggregates]
  );

  const totalCampaigns = campaignAggregates.length;

  const distinctCampaigns = useMemo(
    () => totalCampaigns,
    [totalCampaigns]
  );

  const distinctChannels = useMemo(
    () => new Set(campaignAggregates.map((c) => c.channel)).size,
    [campaignAggregates]
  );

  const avgRecipients = totalCampaigns
    ? totalSent / totalCampaigns
    : 0;

  const performanceTrend: PerformanceTrendPoint[] = useMemo(() => {
    const map = new Map<string, PerformanceTrendPoint>();
    campaignAggregates.forEach((c) => {
      const key = c.createdAt.toISOString().slice(0, 10);
      const existing =
        map.get(key) ||
        ({
          date: key,
          sent: 0,
          opened: 0,
          clicked: 0,
          converted: 0,
        } as PerformanceTrendPoint);
      existing.sent += c.recipients;
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [campaignAggregates]);

  const campaignPerformance: CampaignPerformanceItem[] = useMemo(() => {
    const map = new Map<string, CampaignPerformanceItem>();
    campaignAggregates.forEach((c) => {
      const existing =
        map.get(c.name) ||
        ({
          name: c.name,
          sent: 0,
          openRate: 0,
          clickRate: 0,
          conversionRate: 0,
        } as CampaignPerformanceItem);
      existing.sent += c.recipients;
      map.set(c.name, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.sent - a.sent);
  }, [campaignAggregates]);

  const channelData = useMemo(() => {
    if (!campaignAggregates.length) return [];
    const map = new Map<
      string,
      { name: string; count: number; color: string }
    >();
    const colorMap: Record<string, string> = {
      push: "#3b82f6",
      email: "#10b981",
      "in-app": "#f59e0b",
      sms: "#ec4899",
      other: "#6b7280",
    };
    campaignAggregates.forEach((c) => {
      const key = c.channel;
      const label =
        key === "in-app"
          ? "In-App"
          : key.charAt(0).toUpperCase() + key.slice(1);
      const existing =
        map.get(key) || {
          name: label,
          count: 0,
          color: colorMap[key] || "#6b7280",
        };
      existing.count += c.recipients;
      map.set(key, existing);
    });
    const total = Array.from(map.values()).reduce(
      (sum, c) => sum + c.count,
      0
    );
    return Array.from(map.values()).map((c) => ({
      ...c,
      value: total ? Math.round((c.count / total) * 100) : 0,
    }));
  }, [campaignAggregates]);

  const topTemplates = useMemo(
    () =>
      campaignPerformance.slice(0, 4).map((c, index) => ({
        id: String(index),
        name: c.name,
        sent: c.sent,
        openRate: c.openRate,
        clickRate: c.clickRate,
        conversionRate: c.conversionRate,
      })),
    [campaignPerformance]
  );

  const stats = [
    {
      label: "Total Nudges Sent",
      value: totalSent.toLocaleString(),
      change: "N/A",
      trend: "up" as const,
      icon: Bell,
      color: "from-blue-500 to-cyan-600",
    },
    {
      label: "Nudge Campaigns",
      value: distinctCampaigns.toString(),
      change: "N/A",
      trend: "up" as const,
      icon: Target,
      color: "from-purple-500 to-pink-600",
    },
    {
      label: "Channels Used",
      value: distinctChannels.toString(),
      change: "N/A",
      trend: "up" as const,
      icon: Users,
      color: "from-green-500 to-emerald-600",
    },
    {
      label: "Avg Recipients per Nudge",
      value: avgRecipients.toFixed(1),
      change: "N/A",
      trend: "up" as const,
      icon: TrendingUp,
      color: "from-orange-500 to-amber-600",
    },
  ];

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Nudge Performance
            </h1>
            <p className="text-gray-600">
              Campaign analytics and engagement metrics
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900"
              value={periodMode}
              onChange={(e) =>
                setPeriodMode(e.target.value as "month" | "custom")
              }
            >
              <option value="month">Month / Year</option>
              <option value="custom">Custom range</option>
            </select>

            {periodMode === "month" ? (
              <>
                <select
                  className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {new Date(2000, m - 1, 1).toLocaleString("default", {
                        month: "long",
                      })}
                    </option>
                  ))}
                </select>
                <select
                  className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                >
                  {Array.from({ length: 8 }, (_, i) => now.getFullYear() - i).map(
                    (y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    )
                  )}
                </select>
              </>
            ) : (
              <>
                <input
                  type="date"
                  className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
                <span className="text-sm text-gray-500">to</span>
                <input
                  type="date"
                  className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </>
            )}

            <Button
              type="button"
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white"
              disabled={isLoading}
              onClick={() => {
                const rows: string[][] = [
                  ["Metric", "Value"],
                  ["Total Nudges Sent", totalSent.toString()],
                  ["Nudge Campaigns", distinctCampaigns.toString()],
                  ["Channels Used", distinctChannels.toString()],
                  ["Avg Recipients per Nudge", avgRecipients.toFixed(1)],
                  ["Period", `${rangeStart.toISOString().slice(0, 10)} – ${rangeEnd.toISOString().slice(0, 10)}`],
                  [],
                  ["Campaign Performance"],
                  ["Campaign", "Sent"],
                  ...campaignPerformance.map((c) => [
                    csvEscapeCell(c.name),
                    c.sent.toString(),
                  ]),
                ];
                const csvContent = rows.map((row) => row.join(",")).join("\r\n");
                const blob = new Blob(["\uFEFF" + csvContent], {
                  type: "text/csv;charset=utf-8",
                });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `nudge-performance-report-${new Date().toISOString().split("T")[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                toast.success("Report exported");
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>

            <Button
              type="button"
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-500"
              disabled={isLoading}
              onClick={() => setRefreshKey((k) => k + 1)}
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </motion.div>

        {/* Stats Grid */}
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
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${
                      stat.trend === "up"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-red-50 text-red-700 border-red-200"
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
                <h3 className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</h3>
                <p className="text-sm text-gray-600">{stat.label}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Performance Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">
                  Performance Funnel Trend
                </h3>
                <p className="text-sm text-gray-400">
                  Sent, opened, clicked, and converted over time
                </p>
              </div>
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>

            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={performanceTrend}>
                <defs>
                  <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorOpened" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorClicked" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorConverted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
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
                  dataKey="sent"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorSent)"
                  name="Sent"
                />
                <Area
                  type="monotone"
                  dataKey="opened"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#colorOpened)"
                  name="Opened"
                />
                <Area
                  type="monotone"
                  dataKey="clicked"
                  stroke="#f59e0b"
                  fillOpacity={1}
                  fill="url(#colorClicked)"
                  name="Clicked"
                />
                <Area
                  type="monotone"
                  dataKey="converted"
                  stroke="#8b5cf6"
                  fillOpacity={1}
                  fill="url(#colorConverted)"
                  name="Converted"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        {/* Campaign Comparison & Channel Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Campaign Performance Comparison */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    Campaign Comparison
                  </h3>
                  <p className="text-sm text-gray-400">Open rates by campaign</p>
                </div>
                <Target className="w-5 h-5 text-purple-400" />
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={campaignPerformance} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis type="number" stroke="#9ca3af" />
                  <YAxis dataKey="name" type="category" stroke="#9ca3af" width={150} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                  <Bar dataKey="sent" fill="#10b981" radius={[0, 8, 8, 0]} name="Sent" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>

          {/* Channel Distribution */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    Channel Distribution
                  </h3>
                  <p className="text-sm text-gray-400">Messages by channel</p>
                </div>
                <Bell className="w-5 h-5 text-blue-400" />
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <RechartsPie>
                  <Pie
                    data={channelData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {channelData.map((entry, index) => (
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
                {channelData.map((channel) => (
                  <div key={channel.name} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: channel.color }}
                    />
                    <span className="text-sm text-gray-400">
                      {channel.name}: {channel.count.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Top Performing Templates */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    Top Performing Templates
                  </h3>
                  <p className="text-sm text-gray-400">Best engagement rates</p>
                </div>
                <Award className="w-5 h-5 text-yellow-400" />
              </div>

              <div className="space-y-4">
                {topTemplates.map((template, index) => (
                  <div
                    key={template.id}
                    className="flex items-center gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all"
                  >
                    <span className="text-2xl font-bold text-purple-400">
                      #{index + 1}
                    </span>
                    <div className="flex-1">
                      <h4 className="text-white font-medium text-sm">
                        {template.name}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                        <span>{template.sent.toLocaleString()} sent</span>
                        <span>{template.openRate}% open</span>
                        <span>{template.clickRate}% click</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-400">
                        {template.conversionRate}%
                      </p>
                      <p className="text-xs text-gray-500">conversion</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </AdminLayoutNew>
  );
}
