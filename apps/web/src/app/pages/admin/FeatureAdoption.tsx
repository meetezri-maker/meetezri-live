import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Zap,
  Users,
  Activity,
  BookOpen,
  Smile,
  Heart,
  Brain,
  Target,
  Download,
  RefreshCw,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  FunnelChart,
  Funnel,
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

export function FeatureAdoption() {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");

  // Overall Feature Adoption
  const featureAdoptionData = [
    {
      feature: "AI Therapy Sessions",
      adoption: 95,
      users: 4750,
      growth: 12.5,
      icon: Brain,
      color: "#8b5cf6",
    },
    {
      feature: "Mood Tracking",
      adoption: 89,
      users: 4450,
      growth: 8.3,
      icon: Smile,
      color: "#ec4899",
    },
    {
      feature: "Journaling",
      adoption: 72,
      users: 3600,
      growth: 15.7,
      icon: BookOpen,
      color: "#3b82f6",
    },
    {
      feature: "Wellness Tools",
      adoption: 68,
      users: 3400,
      growth: 11.2,
      icon: Heart,
      color: "#10b981",
    },
    {
      feature: "Progress Reports",
      adoption: 54,
      users: 2700,
      growth: 5.8,
      icon: Target,
      color: "#f59e0b",
    },
    {
      feature: "Avatar Customization",
      adoption: 82,
      users: 4100,
      growth: -2.1,
      icon: Users,
      color: "#06b6d4",
    },
  ];

  // Adoption Trend Over Time
  const adoptionTrendData = [
    { month: "Jul", aiSessions: 78, moodTracking: 65, journaling: 45, wellness: 52 },
    { month: "Aug", aiSessions: 82, moodTracking: 70, journaling: 52, wellness: 58 },
    { month: "Sep", aiSessions: 85, moodTracking: 75, journaling: 58, wellness: 61 },
    { month: "Oct", aiSessions: 88, moodTracking: 80, journaling: 63, wellness: 64 },
    { month: "Nov", aiSessions: 91, moodTracking: 84, journaling: 67, wellness: 66 },
    { month: "Dec", aiSessions: 93, moodTracking: 87, journaling: 70, wellness: 67 },
    { month: "Jan", aiSessions: 95, moodTracking: 89, journaling: 72, wellness: 68 },
  ];

  // Feature Rollout Impact
  const rolloutImpactData = [
    { week: "Pre-Launch", users: 0, engagement: 0 },
    { week: "Week 1", users: 456, engagement: 23 },
    { week: "Week 2", users: 1234, engagement: 45 },
    { week: "Week 3", users: 2345, engagement: 62 },
    { week: "Week 4", users: 3200, engagement: 74 },
    { week: "Week 5", users: 3780, engagement: 81 },
    { week: "Week 6", users: 4100, engagement: 85 },
    { week: "Week 7", users: 4350, engagement: 87 },
    { week: "Week 8", users: 4520, engagement: 89 },
  ];

  // Adoption Funnel
  const adoptionFunnelData = [
    { stage: "Signed Up", value: 5000, fill: "#8b5cf6" },
    { stage: "Completed Onboarding", value: 4750, fill: "#3b82f6" },
    { stage: "First Session", value: 4500, fill: "#10b981" },
    { stage: "Used 2+ Features", value: 3800, fill: "#f59e0b" },
    { stage: "Active User (7+ days)", value: 3200, fill: "#ec4899" },
    { stage: "Power User (30+ days)", value: 2100, fill: "#06b6d4" },
  ];

  // Feature Comparison Radar
  const featureComparisonData = [
    {
      feature: "Adoption Rate",
      aiSessions: 95,
      moodTracking: 89,
      journaling: 72,
      wellness: 68,
    },
    {
      feature: "Daily Usage",
      aiSessions: 78,
      moodTracking: 85,
      journaling: 62,
      wellness: 54,
    },
    {
      feature: "Satisfaction",
      aiSessions: 92,
      moodTracking: 88,
      journaling: 90,
      wellness: 85,
    },
    {
      feature: "Retention",
      aiSessions: 87,
      moodTracking: 82,
      journaling: 75,
      wellness: 70,
    },
    {
      feature: "Referrals",
      aiSessions: 68,
      moodTracking: 45,
      journaling: 52,
      wellness: 48,
    },
  ];

  // Time to Adoption
  const timeToAdoptionData = [
    { feature: "AI Sessions", avgDays: 1.2 },
    { feature: "Mood Tracking", avgDays: 2.5 },
    { feature: "Wellness Tools", avgDays: 4.8 },
    { feature: "Journaling", avgDays: 6.3 },
    { feature: "Progress Reports", avgDays: 12.5 },
  ];

  const stats = [
    {
      label: "Overall Adoption Rate",
      value: "76%",
      change: "+8.7%",
      trend: "up" as const,
      icon: Zap,
      color: "from-purple-500 to-indigo-600",
      description: "of all features",
    },
    {
      label: "Most Adopted Feature",
      value: "AI Sessions",
      change: "95%",
      trend: "up" as const,
      icon: Brain,
      color: "from-pink-500 to-rose-600",
      description: "adoption rate",
    },
    {
      label: "Fastest Growing",
      value: "Journaling",
      change: "+15.7%",
      trend: "up" as const,
      icon: BookOpen,
      color: "from-cyan-500 to-blue-600",
      description: "this month",
    },
    {
      label: "Avg Time to Adopt",
      value: "5.4 days",
      change: "-1.2 days",
      trend: "up" as const,
      icon: Clock,
      color: "from-green-500 to-emerald-600",
      description: "from signup",
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
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Feature Adoption</h1>
            <p className="text-gray-600">
              Track feature usage, adoption rates, and rollout performance
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

        {/* Feature Adoption Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">
                  Feature Adoption Overview
                </h3>
                <p className="text-sm text-gray-400">
                  Current adoption rates and growth
                </p>
              </div>
              <Sparkles className="w-5 h-5 text-purple-400" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featureAdoptionData.map((feature, index) => (
                <motion.div
                  key={feature.feature}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-all"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${feature.color}20` }}
                    >
                      <feature.icon
                        className="w-5 h-5"
                        style={{ color: feature.color }}
                      />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-white text-sm">
                        {feature.feature}
                      </h4>
                      <p className="text-xs text-gray-400">{feature.users.toLocaleString()} users</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Adoption</span>
                      <span className="text-white font-bold">{feature.adoption}%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${feature.adoption}%` }}
                        transition={{ duration: 1, delay: index * 0.1 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: feature.color }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Growth</span>
                      <span
                        className={`font-medium ${
                          feature.growth > 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {feature.growth > 0 ? "+" : ""}
                        {feature.growth}%
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Adoption Trend & Rollout Impact */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Adoption Trend */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    Adoption Trend Over Time
                  </h3>
                  <p className="text-sm text-gray-400">Monthly adoption rates</p>
                </div>
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={adoptionTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis dataKey="month" stroke="#9ca3af" />
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
                  <Line
                    type="monotone"
                    dataKey="aiSessions"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    name="AI Sessions"
                  />
                  <Line
                    type="monotone"
                    dataKey="moodTracking"
                    stroke="#ec4899"
                    strokeWidth={2}
                    name="Mood Tracking"
                  />
                  <Line
                    type="monotone"
                    dataKey="journaling"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Journaling"
                  />
                  <Line
                    type="monotone"
                    dataKey="wellness"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="Wellness"
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>

          {/* Rollout Impact */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    Feature Rollout Impact
                  </h3>
                  <p className="text-sm text-gray-400">New feature adoption curve</p>
                </div>
                <Activity className="w-5 h-5 text-cyan-400" />
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={rolloutImpactData}>
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
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
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="users"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#colorUsers)"
                    name="Users"
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="engagement"
                    stroke="#10b981"
                    fillOpacity={1}
                    fill="url(#colorEngagement)"
                    name="Engagement %"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </div>

        {/* Adoption Funnel & Time to Adoption */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Adoption Funnel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    Feature Adoption Funnel
                  </h3>
                  <p className="text-sm text-gray-400">User journey to power user</p>
                </div>
                <Target className="w-5 h-5 text-orange-400" />
              </div>

              <div className="space-y-3">
                {adoptionFunnelData.map((stage, index) => {
                  const percentage = ((stage.value / adoptionFunnelData[0].value) * 100).toFixed(0);
                  return (
                    <div key={stage.stage} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium text-sm">
                          {stage.stage}
                        </span>
                        <span className="text-gray-400 text-sm">
                          {stage.value.toLocaleString()} ({percentage}%)
                        </span>
                      </div>
                      <div className="h-8 rounded-lg overflow-hidden" style={{ width: `${percentage}%`, backgroundColor: stage.fill }}>
                        <div className="h-full flex items-center justify-center text-white text-xs font-medium">
                          {percentage}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </motion.div>

          {/* Time to Adoption */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    Time to Adoption
                  </h3>
                  <p className="text-sm text-gray-400">
                    Avg days from signup to first use
                  </p>
                </div>
                <Clock className="w-5 h-5 text-blue-400" />
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={timeToAdoptionData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis type="number" stroke="#9ca3af" />
                  <YAxis dataKey="feature" type="category" stroke="#9ca3af" width={120} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                  <Bar dataKey="avgDays" fill="#3b82f6" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </div>
      </div>
    </AdminLayoutNew>
  );
}