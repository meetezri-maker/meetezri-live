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
import { useState } from "react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";

export function ContentPerformance() {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");

  // Content Performance Overview
  const performanceData = [
    { date: "Week 1", views: 12450, likes: 890, shares: 145, completions: 78 },
    { date: "Week 2", views: 15230, likes: 1120, shares: 189, completions: 82 },
    { date: "Week 3", views: 18900, likes: 1450, shares: 234, completions: 85 },
    { date: "Week 4", views: 21340, likes: 1680, shares: 289, completions: 88 },
  ];

  // Top Performing Content
  const topContent = [
    {
      id: "1",
      title: "5 Morning Habits for Better Mental Health",
      type: "article",
      views: 4123,
      engagement: 92,
      rating: 4.8,
      icon: FileText,
      color: "#3b82f6",
    },
    {
      id: "2",
      title: "Quick Desk Stretch Routine",
      type: "activity",
      views: 3456,
      engagement: 88,
      rating: 4.7,
      icon: Activity,
      color: "#10b981",
    },
    {
      id: "3",
      title: "Meditation for Beginners",
      type: "video",
      views: 3210,
      engagement: 95,
      rating: 4.9,
      icon: Video,
      color: "#ec4899",
    },
    {
      id: "4",
      title: "Deep Breathing Benefits",
      type: "tip",
      views: 2987,
      engagement: 85,
      rating: 4.6,
      icon: Lightbulb,
      color: "#f59e0b",
    },
    {
      id: "5",
      title: "Sleep Hygiene Checklist",
      type: "article",
      views: 2654,
      engagement: 81,
      rating: 4.5,
      icon: FileText,
      color: "#3b82f6",
    },
  ];

  // Content by Type Distribution
  const contentTypeData = [
    { name: "Articles", value: 35, count: 28, color: "#3b82f6" },
    { name: "Tips", value: 30, count: 42, color: "#f59e0b" },
    { name: "Activities", value: 25, count: 18, color: "#10b981" },
    { name: "Videos", value: 10, count: 8, color: "#ec4899" },
  ];

  // Engagement by Category
  const categoryEngagement = [
    { category: "Mental Wellness", engagement: 94, views: 18900 },
    { category: "Physical Wellness", engagement: 87, views: 15600 },
    { category: "Sleep", engagement: 91, views: 14200 },
    { category: "Meditation", engagement: 89, views: 12800 },
    { category: "Stress Management", engagement: 85, views: 11500 },
    { category: "Mindfulness", engagement: 82, views: 9800 },
  ];

  // Completion Rates
  const completionRates = [
    { type: "Articles", started: 5420, completed: 4756, rate: 88 },
    { type: "Videos", started: 3210, completed: 2889, rate: 90 },
    { type: "Activities", started: 4680, completed: 3744, rate: 80 },
    { type: "Tips", started: 8900, completed: 8188, rate: 92 },
  ];

  // Trending Content
  const trendingData = [
    { week: "Week 1", trending: 12, views: 8900 },
    { week: "Week 2", trending: 18, views: 12400 },
    { week: "Week 3", trending: 24, views: 15800 },
    { week: "Week 4", trending: 32, views: 19200 },
  ];

  const stats = [
    {
      label: "Total Views",
      value: "67,920",
      change: "+18.5%",
      trend: "up" as const,
      icon: Eye,
      color: "from-blue-500 to-cyan-600",
    },
    {
      label: "Total Engagement",
      value: "5,140",
      change: "+23.2%",
      trend: "up" as const,
      icon: Heart,
      color: "from-pink-500 to-rose-600",
    },
    {
      label: "Avg Completion",
      value: "87.5%",
      change: "+4.2%",
      trend: "up" as const,
      icon: Target,
      color: "from-green-500 to-emerald-600",
    },
    {
      label: "Avg Rating",
      value: "4.7",
      change: "+0.2",
      trend: "up" as const,
      icon: Award,
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
              Content Performance
            </h1>
            <p className="text-gray-600">
              Analytics and engagement metrics for wellness content
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Time Range Selector */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1 border border-gray-200">
              {(["7d", "30d", "90d"] as const).map((range) => (
                <button
                  key={range}
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

            <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white">
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>

            <Button
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              <RefreshCw className="w-4 h-4" />
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
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
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
          <Card className="bg-white border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  Performance Trend
                </h3>
                <p className="text-sm text-gray-600">
                  Views, engagement, and completion rates
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
                  dataKey="views"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorViews)"
                  name="Views"
                />
                <Area
                  type="monotone"
                  dataKey="likes"
                  stroke="#ec4899"
                  fillOpacity={1}
                  fill="url(#colorLikes)"
                  name="Likes"
                />
                <Area
                  type="monotone"
                  dataKey="shares"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#colorShares)"
                  name="Shares"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        {/* Top Content & Content Type Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Performing Content */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    Top Performing Content
                  </h3>
                  <p className="text-sm text-gray-600">Most popular this month</p>
                </div>
                <Award className="w-5 h-5 text-yellow-600" />
              </div>

              <div className="space-y-4">
                {topContent.map((content, index) => (
                  <div
                    key={content.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-2xl font-bold text-purple-600">
                        #{index + 1}
                      </span>
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${content.color}20` }}
                      >
                        <content.icon
                          className="w-5 h-5"
                          style={{ color: content.color }}
                        />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-gray-900 font-medium text-sm">
                          {content.title}
                        </h4>
                        <div className="flex items-center gap-3 text-xs text-gray-600 mt-1">
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {content.views.toLocaleString()}
                          </span>
                          <span>{content.engagement}% engagement</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
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
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Content Type Distribution */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    Content by Type
                  </h3>
                  <p className="text-sm text-gray-600">Distribution breakdown</p>
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
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: type.color }}
                    />
                    <span className="text-sm text-gray-600">
                      {type.name}: {type.count}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Category Engagement & Completion Rates */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category Engagement */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-white border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    Engagement by Category
                  </h3>
                  <p className="text-sm text-gray-600">Category performance</p>
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

          {/* Completion Rates */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-white border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    Completion Rates
                  </h3>
                  <p className="text-sm text-gray-600">By content type</p>
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
                          {item.completed.toLocaleString()} / {item.started.toLocaleString()}
                        </span>
                        <span className="text-lg font-bold text-gray-900">
                          {item.rate}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${item.rate}%` }}
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

        {/* Trending Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="bg-white border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  Trending Content Growth
                </h3>
                <p className="text-sm text-gray-600">
                  Number of trending items over time
                </p>
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
                  name="Trending Items"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="views"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Views"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>
      </div>
    </AdminLayoutNew>
  );
}