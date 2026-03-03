import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Users,
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  Award,
  DollarSign,
  RefreshCw,
  Download,
  Calendar,
  Percent,
  Heart,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useState } from "react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";

export function RetentionMetrics() {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");

  // Cohort Retention Analysis
  const cohortRetentionData = [
    { cohort: "Jan 2024", week1: 92, week2: 85, week3: 78, week4: 72, month2: 65, month3: 58 },
    { cohort: "Feb 2024", week1: 94, week2: 87, week3: 80, week4: 74, month2: 67, month3: 60 },
    { cohort: "Mar 2024", week1: 95, week2: 89, week3: 82, week4: 76, month2: 69, month3: 62 },
    { cohort: "Apr 2024", week1: 93, week2: 86, week3: 79, week4: 73, month2: 66, month3: 59 },
    { cohort: "May 2024", week1: 96, week2: 90, week3: 84, week4: 78, month2: 71, month3: 64 },
    { cohort: "Jun 2024", week1: 97, week2: 91, week3: 85, week4: 79, month2: 72, month3: 65 },
    { cohort: "Jul 2024", week1: 98, week2: 92, week3: 86, week4: 80, month2: 73, month3: null },
  ];

  // Monthly Retention Curve
  const retentionCurveData = [
    { month: "Month 0", retention: 100 },
    { month: "Month 1", retention: 78 },
    { month: "Month 2", retention: 68 },
    { month: "Month 3", retention: 62 },
    { month: "Month 6", retention: 54 },
    { month: "Month 9", retention: 49 },
    { month: "Month 12", retention: 45 },
  ];

  // Churn Rate Over Time
  const churnRateData = [
    { month: "Jan", churnRate: 7.2, newUsers: 890, churned: 64 },
    { month: "Feb", churnRate: 6.8, newUsers: 1234, churned: 84 },
    { month: "Mar", churnRate: 6.5, newUsers: 1456, churned: 95 },
    { month: "Apr", churnRate: 5.9, newUsers: 1678, churned: 99 },
    { month: "May", churnRate: 5.4, newUsers: 1890, churned: 102 },
    { month: "Jun", churnRate: 5.1, newUsers: 2100, churned: 107 },
    { month: "Jul", churnRate: 4.8, newUsers: 2340, churned: 112 },
  ];

  // Trial to Paid Conversion
  const conversionData = [
    { week: "Week 1", trials: 500, converted: 45, rate: 9 },
    { week: "Week 2", trials: 650, converted: 78, rate: 12 },
    { week: "Week 3", trials: 800, converted: 112, rate: 14 },
    { week: "Week 4", trials: 920, converted: 156, rate: 17 },
    { week: "Week 5", trials: 1100, converted: 198, rate: 18 },
    { week: "Week 6", trials: 1250, converted: 238, rate: 19 },
    { week: "Week 7", trials: 1400, converted: 280, rate: 20 },
    { week: "Week 8", trials: 1520, converted: 319, rate: 21 },
  ];

  // Lifetime Value Estimates
  const lifetimeValueData = [
    { segment: "Power Users", ltv: 2400, retention: 89, avgSpend: 49 },
    { segment: "Active Users", ltv: 1680, retention: 76, avgSpend: 39 },
    { segment: "Regular Users", ltv: 960, retention: 58, avgSpend: 29 },
    { segment: "Casual Users", ltv: 480, retention: 42, avgSpend: 19 },
  ];

  // Win-back Opportunities
  const winbackData = [
    { status: "At Risk (30 days inactive)", count: 456, potential: "$22,464" },
    { status: "Dormant (60 days inactive)", count: 234, potential: "$11,232" },
    { status: "Lost (90+ days inactive)", count: 123, potential: "$5,904" },
  ];

  // Retention by User Type
  const retentionByTypeData = [
    { type: "Trial", day7: 68, day30: 45, day90: 32 },
    { type: "Core", day7: 82, day30: 64, day90: 48 },
    { type: "Pro", day7: 94, day30: 85, day90: 76 },
  ];

  const stats = [
    {
      label: "30-Day Retention",
      value: "68%",
      change: "+3.2%",
      trend: "up" as const,
      icon: Users,
      color: "from-blue-500 to-cyan-600",
      description: "vs last period",
    },
    {
      label: "Churn Rate",
      value: "4.8%",
      change: "-0.6%",
      trend: "up" as const,
      icon: AlertCircle,
      color: "from-red-500 to-orange-600",
      description: "improvement",
    },
    {
      label: "Trial Conversion",
      value: "21%",
      change: "+2.1%",
      trend: "up" as const,
      icon: Target,
      color: "from-green-500 to-emerald-600",
      description: "to paid",
    },
    {
      label: "Avg Lifetime Value",
      value: "$1,380",
      change: "+$180",
      trend: "up" as const,
      icon: DollarSign,
      color: "from-purple-500 to-pink-600",
      description: "per user",
    },
  ];

  const COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b"];

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
              Retention Metrics
            </h1>
            <p className="text-gray-600">
              Cohort analysis, churn tracking, and lifetime value estimates
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
                      : "text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {range === "7d" ? "7 Days" : range === "30d" ? "30 Days" : "90 Days"}
                </button>
              ))}
            </div>

            <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white">
              <Download className="w-4 h-4 mr-2" />
              Export
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
              <Card className="bg-white border-gray-200 p-6 hover:shadow-lg transition-all">
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
                <p className="text-sm text-gray-700">{stat.label}</p>
                <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Cohort Retention Analysis */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-white border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold !text-gray-900 mb-1">
                  Cohort Retention Analysis
                </h3>
                <p className="text-sm !text-gray-600">
                  Retention rates by signup cohort over time
                </p>
              </div>
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left !text-gray-700 font-medium pb-3">Cohort</th>
                    <th className="text-center !text-gray-700 font-medium pb-3">Week 1</th>
                    <th className="text-center !text-gray-700 font-medium pb-3">Week 2</th>
                    <th className="text-center !text-gray-700 font-medium pb-3">Week 3</th>
                    <th className="text-center !text-gray-700 font-medium pb-3">Week 4</th>
                    <th className="text-center !text-gray-700 font-medium pb-3">Month 2</th>
                    <th className="text-center !text-gray-700 font-medium pb-3">Month 3</th>
                  </tr>
                </thead>
                <tbody>
                  {cohortRetentionData.map((cohort, index) => (
                    <motion.tr
                      key={cohort.cohort}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b border-gray-100"
                    >
                      <td className="py-3 !text-gray-900 font-medium">{cohort.cohort}</td>
                      <td className="text-center">
                        <span
                          className="inline-block px-3 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `rgba(34, 197, 94, ${cohort.week1 / 100})`,
                            color: cohort.week1 > 80 ? "#fff" : "#000",
                          }}
                        >
                          {cohort.week1}%
                        </span>
                      </td>
                      <td className="text-center">
                        <span
                          className="inline-block px-3 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `rgba(34, 197, 94, ${cohort.week2 / 100})`,
                            color: cohort.week2 > 80 ? "#fff" : "#000",
                          }}
                        >
                          {cohort.week2}%
                        </span>
                      </td>
                      <td className="text-center">
                        <span
                          className="inline-block px-3 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `rgba(34, 197, 94, ${cohort.week3 / 100})`,
                            color: cohort.week3 > 70 ? "#fff" : "#000",
                          }}
                        >
                          {cohort.week3}%
                        </span>
                      </td>
                      <td className="text-center">
                        <span
                          className="inline-block px-3 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `rgba(34, 197, 94, ${cohort.week4 / 100})`,
                            color: cohort.week4 > 70 ? "#fff" : "#000",
                          }}
                        >
                          {cohort.week4}%
                        </span>
                      </td>
                      <td className="text-center">
                        <span
                          className="inline-block px-3 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `rgba(34, 197, 94, ${cohort.month2 / 100})`,
                            color: cohort.month2 > 60 ? "#fff" : "#000",
                          }}
                        >
                          {cohort.month2}%
                        </span>
                      </td>
                      <td className="text-center">
                        {cohort.month3 ? (
                          <span
                            className="inline-block px-3 py-1 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: `rgba(34, 197, 94, ${cohort.month3 / 100})`,
                              color: cohort.month3 > 60 ? "#fff" : "#000",
                            }}
                          >
                            {cohort.month3}%
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">-</span>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>

        {/* Retention Curve & Churn Rate */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Retention Curve */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    Monthly Retention Curve
                  </h3>
                  <p className="text-sm text-gray-400">User retention over 12 months</p>
                </div>
                <Heart className="w-5 h-5 text-pink-400" />
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={retentionCurveData}>
                  <defs>
                    <linearGradient id="colorRetention" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis dataKey="month" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="retention"
                    stroke="#ec4899"
                    fillOpacity={1}
                    fill="url(#colorRetention)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>

          {/* Churn Rate */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    Churn Rate Trend
                  </h3>
                  <p className="text-sm text-gray-400">Monthly churn percentage</p>
                </div>
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={churnRateData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis dataKey="month" stroke="#9ca3af" />
                  <YAxis yAxisId="left" stroke="#9ca3af" />
                  <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                  <Legend />
                  <Bar
                    yAxisId="right"
                    dataKey="newUsers"
                    fill="#3b82f6"
                    radius={[8, 8, 0, 0]}
                    name="New Users"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="churnRate"
                    stroke="#ef4444"
                    strokeWidth={3}
                    name="Churn Rate %"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </div>

        {/* Trial Conversion & LTV */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Trial to Paid Conversion */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    Trial to Paid Conversion
                  </h3>
                  <p className="text-sm text-gray-400">Conversion rate over time</p>
                </div>
                <Target className="w-5 h-5 text-green-400" />
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={conversionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis dataKey="week" stroke="#9ca3af" />
                  <YAxis yAxisId="left" stroke="#9ca3af" />
                  <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" />
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
                    yAxisId="right"
                    type="monotone"
                    dataKey="rate"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ fill: "#10b981", r: 5 }}
                    name="Conversion Rate %"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="converted"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Converted Users"
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>

          {/* Lifetime Value */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    Lifetime Value by Segment
                  </h3>
                  <p className="text-sm text-gray-400">LTV estimates per user type</p>
                </div>
                <DollarSign className="w-5 h-5 text-yellow-400" />
              </div>

              <div className="space-y-4">
                {lifetimeValueData.map((segment, index) => (
                  <div key={segment.segment} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-medium">{segment.segment}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-400">
                          {segment.retention}% retention
                        </span>
                        <span className="text-lg font-bold text-white">
                          ${segment.ltv.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(segment.ltv / 2400) * 100}%` }}
                        transition={{ duration: 1, delay: index * 0.1 }}
                        className="h-full bg-gradient-to-r from-yellow-500 to-orange-600 rounded-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Win-back Opportunities & Retention by Type */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Win-back Opportunities */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    Win-back Opportunities
                  </h3>
                  <p className="text-sm text-gray-400">
                    Inactive users and revenue potential
                  </p>
                </div>
                <RefreshCw className="w-5 h-5 text-cyan-400" />
              </div>

              <div className="space-y-4">
                {winbackData.map((item, index) => (
                  <motion.div
                    key={item.status}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                    className="bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            index === 0
                              ? "bg-yellow-500/20"
                              : index === 1
                              ? "bg-orange-500/20"
                              : "bg-red-500/20"
                          }`}
                        >
                          <AlertCircle
                            className={`w-5 h-5 ${
                              index === 0
                                ? "text-yellow-400"
                                : index === 1
                                ? "text-orange-400"
                                : "text-red-400"
                            }`}
                          />
                        </div>
                        <div>
                          <h4 className="font-semibold text-white text-sm">
                            {item.status}
                          </h4>
                          <p className="text-xs text-gray-400">{item.count} users</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-white">{item.potential}</p>
                        <p className="text-xs text-gray-400">potential revenue</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Launch Win-back Campaign
                    </Button>
                  </motion.div>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Retention by User Type */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    Retention by User Type
                  </h3>
                  <p className="text-sm text-gray-400">
                    Retention rates at key milestones
                  </p>
                </div>
                <Users className="w-5 h-5 text-blue-400" />
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={retentionByTypeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis dataKey="type" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="day7" fill="#8b5cf6" name="7-Day" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="day30" fill="#3b82f6" name="30-Day" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="day90" fill="#10b981" name="90-Day" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </div>
      </div>
    </AdminLayoutNew>
  );
}