import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { useState } from "react";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import {
  Users,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  ChevronRight,
  UserPlus,
  Calendar,
  Zap,
  Award,
  X,
  XCircle,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
} from "lucide-react";

interface FunnelStep {
  step: number;
  name: string;
  description: string;
  entered: number;
  completed: number;
  dropped: number;
  completionRate: number;
  avgTimeSpent: number;
  commonDropReason?: string;
}

export function OnboardingAnalytics() {
  const [timeRange, setTimeRange] = useState("7d");

  // Funnel steps
  const funnelSteps: FunnelStep[] = [
    {
      step: 1,
      name: "Welcome Screen",
      description: "Initial welcome and app introduction",
      entered: 2450,
      completed: 2389,
      dropped: 61,
      completionRate: 97.5,
      avgTimeSpent: 45,
      commonDropReason: "Closed app immediately"
    },
    {
      step: 2,
      name: "Profile Setup",
      description: "Basic profile information and preferences",
      entered: 2389,
      completed: 2156,
      dropped: 233,
      completionRate: 90.2,
      avgTimeSpent: 180,
      commonDropReason: "Too many required fields"
    },
    {
      step: 3,
      name: "Wellness Baseline",
      description: "Initial mental health assessment",
      entered: 2156,
      completed: 1923,
      dropped: 233,
      completionRate: 89.2,
      avgTimeSpent: 240,
      commonDropReason: "Survey too long"
    },
    {
      step: 4,
      name: "Health Background",
      description: "Medical history and conditions",
      entered: 1923,
      completed: 1745,
      dropped: 178,
      completionRate: 90.7,
      avgTimeSpent: 195,
      commonDropReason: "Privacy concerns"
    },
    {
      step: 5,
      name: "Avatar Preferences",
      description: "Companion avatar customization",
      entered: 1745,
      completed: 1689,
      dropped: 56,
      completionRate: 96.8,
      avgTimeSpent: 120,
      commonDropReason: "Skipped customization"
    },
    {
      step: 6,
      name: "Emergency Contact",
      description: "Crisis contact information",
      entered: 1689,
      completed: 1598,
      dropped: 91,
      completionRate: 94.6,
      avgTimeSpent: 90,
      commonDropReason: "Preferred not to share"
    },
    {
      step: 7,
      name: "Permissions",
      description: "Notification and privacy permissions",
      entered: 1598,
      completed: 1534,
      dropped: 64,
      completionRate: 96.0,
      avgTimeSpent: 60,
      commonDropReason: "Denied permissions"
    },
    {
      step: 8,
      name: "Completion",
      description: "Final confirmation and dashboard access",
      entered: 1534,
      completed: 1534,
      dropped: 0,
      completionRate: 100,
      avgTimeSpent: 30,
      commonDropReason: undefined
    }
  ];

  // Overall completion rate over time
  const completionTrend = [
    { date: "Jun 15", rate: 58 },
    { date: "Jun 16", rate: 61 },
    { date: "Jun 17", rate: 59 },
    { date: "Jun 18", rate: 63 },
    { date: "Jun 19", rate: 65 },
    { date: "Jun 20", rate: 62 },
    { date: "Jun 21", rate: 64 },
    { date: "Jun 22", rate: 67 },
    { date: "Jun 23", rate: 69 },
    { date: "Jun 24", rate: 68 },
    { date: "Jun 25", rate: 71 },
    { date: "Jun 26", rate: 73 },
    { date: "Jun 27", rate: 72 },
    { date: "Jun 28", rate: 75 }
  ];

  // Drop-off by step
  const dropOffData = funnelSteps.map(step => ({
    name: `Step ${step.step}`,
    dropOff: step.dropped,
    rate: ((step.dropped / step.entered) * 100).toFixed(1)
  }));

  // Time spent per step
  const timeSpentData = funnelSteps.map(step => ({
    name: step.name.split(" ")[0],
    seconds: step.avgTimeSpent
  }));

  const overallStats = {
    totalStarted: funnelSteps[0].entered,
    totalCompleted: funnelSteps[funnelSteps.length - 1].completed,
    overallCompletionRate: ((funnelSteps[funnelSteps.length - 1].completed / funnelSteps[0].entered) * 100).toFixed(1),
    avgTimeToComplete: funnelSteps.reduce((sum, step) => sum + step.avgTimeSpent, 0),
    totalDropped: funnelSteps[0].entered - funnelSteps[funnelSteps.length - 1].completed
  };

  const getStepColor = (completionRate: number) => {
    if (completionRate >= 95) return "from-green-500 to-emerald-600";
    if (completionRate >= 90) return "from-blue-500 to-indigo-600";
    if (completionRate >= 85) return "from-yellow-500 to-orange-600";
    return "from-red-500 to-rose-600";
  };

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Onboarding Analytics</h1>
            <p className="text-gray-600 mt-1">Track user journey through onboarding funnel</p>
          </div>

          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            <option value="7d">Last 7 days</option>
            <option value="14d">Last 14 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
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
                <p className="text-2xl font-bold text-gray-900">{overallStats.totalStarted.toLocaleString()}</p>
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
                <p className="text-2xl font-bold text-green-600">{overallStats.totalCompleted.toLocaleString()}</p>
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
                <p className="text-gray-600 text-sm">Completion Rate</p>
                <p className="text-2xl font-bold text-gray-900">{overallStats.overallCompletionRate}%</p>
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
                <p className="text-gray-600 text-sm">Dropped Off</p>
                <p className="text-2xl font-bold text-gray-900">{overallStats.totalDropped}</p>
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
                <p className="text-gray-600 text-sm">Avg Time</p>
                <p className="text-2xl font-bold text-gray-900">{Math.floor(overallStats.avgTimeToComplete / 60)}m</p>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Completion Trend */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-6">Completion Rate Trend</h2>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={completionTrend}>
                <defs>
                  <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '12px' 
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="rate" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorRate)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Drop-off by Step */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-6">Drop-off by Step</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dropOffData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '12px' 
                  }}
                />
                <Bar dataKey="dropOff" fill="#ef4444" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Funnel Visualization */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-6">Onboarding Funnel</h2>

          <div className="space-y-4">
            {funnelSteps.map((step, index) => {
              const barWidth = (step.entered / funnelSteps[0].entered) * 100;
              
              return (
                <div key={step.step}>
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 + index * 0.05 }}
                    className="relative"
                  >
                    {/* Step Info */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-sm">
                          {step.step}
                        </span>
                        <div>
                          <h3 className="font-bold text-gray-900">{step.name}</h3>
                          <p className="text-xs text-gray-600">{step.description}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-bold text-gray-900">{step.entered.toLocaleString()}</p>
                        <p className="text-xs text-gray-600">entered</p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="relative h-16 bg-gray-100 rounded-xl overflow-hidden mb-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${barWidth}%` }}
                        transition={{ duration: 1, delay: 0.8 + index * 0.05 }}
                        className={`h-full bg-gradient-to-r ${getStepColor(step.completionRate)} flex items-center justify-between px-4`}
                      >
                        <div className="text-white">
                          <p className="text-sm font-bold">{step.completed.toLocaleString()} completed</p>
                          <p className="text-xs opacity-90">{step.completionRate}% completion rate</p>
                        </div>

                        {step.dropped > 0 && (
                          <div className="text-white text-right">
                            <p className="text-sm font-bold">{step.dropped} dropped</p>
                            <p className="text-xs opacity-90">{step.avgTimeSpent}s avg time</p>
                          </div>
                        )}
                      </motion.div>
                    </div>

                    {/* Drop-off reason */}
                    {step.commonDropReason && (
                      <div className="flex items-center gap-2 text-xs text-orange-600 mb-2">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Common reason: {step.commonDropReason}</span>
                      </div>
                    )}

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-4 gap-3">
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-xs text-gray-600">Entered</p>
                        <p className="font-bold text-gray-900">{step.entered.toLocaleString()}</p>
                      </div>

                      <div className="bg-green-50 rounded-lg p-2">
                        <p className="text-xs text-green-600">Completed</p>
                        <p className="font-bold text-green-700">{step.completed.toLocaleString()}</p>
                      </div>

                      <div className="bg-red-50 rounded-lg p-2">
                        <p className="text-xs text-red-600">Dropped</p>
                        <p className="font-bold text-red-700">{step.dropped}</p>
                      </div>

                      <div className="bg-blue-50 rounded-lg p-2">
                        <p className="text-xs text-blue-600">Rate</p>
                        <p className="font-bold text-blue-700">{step.completionRate}%</p>
                      </div>
                    </div>
                  </motion.div>

                  {/* Arrow between steps */}
                  {index < funnelSteps.length - 1 && (
                    <div className="flex justify-center my-2">
                      <ArrowRight className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Recommendations */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 shadow-lg border-2 border-blue-200"
        >
          <div className="flex items-center gap-3 mb-4">
            <Zap className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Optimization Recommendations</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-orange-100">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">Profile Setup Drop-off</h3>
                  <p className="text-sm text-gray-600 mb-2">233 users dropped at profile setup (10% drop rate)</p>
                  <p className="text-xs text-blue-600 font-medium">→ Reduce required fields from 8 to 4</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-yellow-100">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">Wellness Baseline Too Long</h3>
                  <p className="text-sm text-gray-600 mb-2">240 seconds average time (target: 120s)</p>
                  <p className="text-xs text-blue-600 font-medium">→ Split into 2 shorter assessments</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">Avatar Preferences Success</h3>
                  <p className="text-sm text-gray-600 mb-2">97% completion rate - users love customization</p>
                  <p className="text-xs text-blue-600 font-medium">→ Move this step earlier in funnel</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">Overall Improvement</h3>
                  <p className="text-sm text-gray-600 mb-2">Completion rate up 12% this month</p>
                  <p className="text-xs text-blue-600 font-medium">→ Continue A/B testing variations</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AdminLayoutNew>
  );
}