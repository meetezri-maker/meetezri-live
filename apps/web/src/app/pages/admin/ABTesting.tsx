import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { 
  Beaker,
  TrendingUp,
  Users,
  BarChart3,
  CheckCircle,
  XCircle,
  Play,
  Pause,
  Eye,
  Calendar,
  Target,
  Zap,
  ArrowRight,
  Plus
} from "lucide-react";
import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

interface ABTest {
  id: string;
  name: string;
  description: string;
  status: "active" | "draft" | "completed" | "paused";
  startDate: Date;
  endDate?: Date;
  variants: {
    id: string;
    name: string;
    traffic: number;
    conversions: number;
    visitors: number;
    conversionRate: number;
  }[];
  goal: string;
  confidence: number;
  winner?: string;
}

export function ABTesting() {
  const [selectedTest, setSelectedTest] = useState<ABTest | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Mock A/B tests
  const abTests: ABTest[] = [
    {
      id: "test001",
      name: "Onboarding Flow Optimization",
      description: "Testing new avatar selection flow vs. traditional setup",
      status: "active",
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      variants: [
        {
          id: "control",
          name: "Control (Original)",
          traffic: 50,
          conversions: 342,
          visitors: 1024,
          conversionRate: 33.4
        },
        {
          id: "variant_a",
          name: "Interactive Avatar First",
          traffic: 50,
          conversions: 489,
          visitors: 1018,
          conversionRate: 48.0
        }
      ],
      goal: "Complete onboarding",
      confidence: 98.5
    },
    {
      id: "test002",
      name: "Dashboard Layout Test",
      description: "Card-based vs. list-based dashboard design",
      status: "active",
      startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      variants: [
        {
          id: "control",
          name: "Card Layout",
          traffic: 50,
          conversions: 234,
          visitors: 856,
          conversionRate: 27.3
        },
        {
          id: "variant_a",
          name: "List Layout",
          traffic: 50,
          conversions: 198,
          visitors: 842,
          conversionRate: 23.5
        }
      ],
      goal: "Start therapy session",
      confidence: 72.3
    },
    {
      id: "test003",
      name: "Pricing Page CTA",
      description: "Testing different call-to-action button colors and text",
      status: "completed",
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      variants: [
        {
          id: "control",
          name: "Blue 'Get Started'",
          traffic: 33,
          conversions: 145,
          visitors: 2134,
          conversionRate: 6.8
        },
        {
          id: "variant_a",
          name: "Green 'Start Trial'",
          traffic: 33,
          conversions: 203,
          visitors: 2098,
          conversionRate: 9.7
        },
        {
          id: "variant_b",
          name: "Purple 'Begin Your Journey'",
          traffic: 34,
          conversions: 178,
          visitors: 2156,
          conversionRate: 8.3
        }
      ],
      goal: "Sign up conversion",
      confidence: 99.2,
      winner: "variant_a"
    },
    {
      id: "test004",
      name: "Session Reminder Timing",
      description: "Testing optimal reminder notification timing",
      status: "paused",
      startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      variants: [
        {
          id: "control",
          name: "1 hour before",
          traffic: 50,
          conversions: 89,
          visitors: 234,
          conversionRate: 38.0
        },
        {
          id: "variant_a",
          name: "24 hours before",
          traffic: 50,
          conversions: 102,
          visitors: 228,
          conversionRate: 44.7
        }
      ],
      goal: "Attend scheduled session",
      confidence: 81.5
    },
    {
      id: "test005",
      name: "Mood Check-in Frequency",
      description: "Daily vs. twice daily mood tracking prompts",
      status: "draft",
      startDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      variants: [
        {
          id: "control",
          name: "Once daily (9 AM)",
          traffic: 50,
          conversions: 0,
          visitors: 0,
          conversionRate: 0
        },
        {
          id: "variant_a",
          name: "Twice daily (9 AM, 9 PM)",
          traffic: 50,
          conversions: 0,
          visitors: 0,
          conversionRate: 0
        }
      ],
      goal: "Complete mood check-in",
      confidence: 0
    }
  ];

  // Mock performance data
  const performanceData = [
    { day: "Day 1", control: 28, variant: 32 },
    { day: "Day 2", control: 31, variant: 39 },
    { day: "Day 3", control: 29, variant: 42 },
    { day: "Day 4", control: 33, variant: 45 },
    { day: "Day 5", control: 32, variant: 47 },
    { day: "Day 6", control: 34, variant: 48 },
    { day: "Day 7", control: 33, variant: 48 }
  ];

  const getStatusColor = (status: string) => {
    switch(status) {
      case "active": return "bg-green-100 text-green-700 border-green-300";
      case "completed": return "bg-blue-100 text-blue-700 border-blue-300";
      case "paused": return "bg-yellow-100 text-yellow-700 border-yellow-300";
      case "draft": return "bg-gray-100 text-gray-700 border-gray-300";
      default: return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case "active": return Play;
      case "completed": return CheckCircle;
      case "paused": return Pause;
      case "draft": return Eye;
      default: return Eye;
    }
  };

  const stats = {
    activeTests: abTests.filter(t => t.status === "active").length,
    completedTests: abTests.filter(t => t.status === "completed").length,
    avgUplift: 14.6,
    totalVisitors: 12456
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
            <h1 className="text-3xl font-bold text-gray-900">A/B Testing Manager</h1>
            <p className="text-gray-600 mt-1">Run experiments and optimize user experience</p>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center gap-2 shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Create Test
          </motion.button>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 shadow-lg border-2 border-green-200"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600">
                <Play className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Active Tests</p>
                <p className="text-2xl font-bold text-green-600">{stats.activeTests}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completedTests}</p>
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
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Avg Uplift</p>
                <p className="text-2xl font-bold text-gray-900">+{stats.avgUplift}%</p>
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
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Total Visitors</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalVisitors.toLocaleString()}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Active Tests */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-6">All Experiments</h2>

          <div className="space-y-4">
            {abTests.map((test, index) => {
              const StatusIcon = getStatusIcon(test.status);
              const winner = test.winner ? test.variants.find(v => v.id === test.winner) : null;
              
              return (
                <motion.div
                  key={test.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + index * 0.05 }}
                  onClick={() => setSelectedTest(selectedTest?.id === test.id ? null : test)}
                  className={`border-2 rounded-xl p-5 cursor-pointer transition-all ${
                    selectedTest?.id === test.id
                      ? "border-blue-500 bg-blue-50 shadow-md"
                      : `${getStatusColor(test.status)} hover:shadow-md`
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${
                      test.status === "active" ? "from-green-500 to-emerald-600" :
                      test.status === "completed" ? "from-blue-500 to-indigo-600" :
                      test.status === "paused" ? "from-yellow-500 to-orange-600" :
                      "from-gray-500 to-slate-600"
                    } flex-shrink-0`}>
                      <Beaker className="w-6 h-6 text-white" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-gray-900 text-lg">{test.name}</h3>
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium uppercase flex items-center gap-1 ${
                          selectedTest?.id === test.id ? "bg-blue-200 text-blue-700" : "bg-white bg-opacity-50"
                        }`}>
                          <StatusIcon className="w-3 h-3" />
                          {test.status}
                        </span>
                        {winner && (
                          <span className="px-2 py-1 rounded-lg text-xs font-medium bg-yellow-200 text-yellow-800 flex items-center gap-1">
                            <Target className="w-3 h-3" />
                            Winner: {winner.name}
                          </span>
                        )}
                      </div>

                      <p className="text-gray-600 mb-3">{test.description}</p>

                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Started: {test.startDate.toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1">
                          <Target className="w-4 h-4" />
                          Goal: {test.goal}
                        </div>
                        <div className="flex items-center gap-1">
                          <BarChart3 className="w-4 h-4" />
                          Confidence: {test.confidence}%
                        </div>
                      </div>

                      {/* Variants */}
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {test.variants.map(variant => (
                          <div 
                            key={variant.id}
                            className={`border-2 rounded-lg p-3 ${
                              winner?.id === variant.id 
                                ? "border-yellow-400 bg-yellow-50" 
                                : "border-gray-200 bg-white"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-bold text-gray-900 text-sm">{variant.name}</span>
                              {winner?.id === variant.id && (
                                <CheckCircle className="w-4 h-4 text-yellow-600" />
                              )}
                            </div>
                            
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Visitors:</span>
                                <span className="font-medium text-gray-900">{variant.visitors.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Conversions:</span>
                                <span className="font-medium text-gray-900">{variant.conversions}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Rate:</span>
                                <span className={`font-bold ${
                                  variant.conversionRate > 30 ? "text-green-600" : "text-gray-900"
                                }`}>
                                  {variant.conversionRate.toFixed(1)}%
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Traffic:</span>
                                <span className="font-medium text-gray-900">{variant.traffic}%</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Expanded Details */}
                      {selectedTest?.id === test.id && test.status === "active" && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-4 pt-4 border-t border-gray-300"
                        >
                          <h4 className="font-bold text-gray-900 mb-3">Performance Over Time</h4>
                          <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={performanceData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis dataKey="day" stroke="#6b7280" />
                              <YAxis stroke="#6b7280" />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: '#fff', 
                                  border: '1px solid #e5e7eb', 
                                  borderRadius: '12px' 
                                }}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="control" 
                                stroke="#6b7280" 
                                strokeWidth={2}
                                name="Control"
                              />
                              <Line 
                                type="monotone" 
                                dataKey="variant" 
                                stroke="#3b82f6" 
                                strokeWidth={2}
                                name="Variant"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </motion.div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 mt-4">
                        {test.status === "active" && (
                          <>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className="px-3 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium flex items-center gap-1"
                            >
                              <Pause className="w-4 h-4" />
                              Pause
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className="px-3 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-medium flex items-center gap-1"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Declare Winner
                            </motion.button>
                          </>
                        )}

                        {test.status === "paused" && (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="px-3 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-medium flex items-center gap-1"
                          >
                            <Play className="w-4 h-4" />
                            Resume
                          </motion.button>
                        )}

                        {test.status === "draft" && (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium flex items-center gap-1"
                          >
                            <Play className="w-4 h-4" />
                            Start Test
                          </motion.button>
                        )}

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="px-3 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          Details
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Create Test Modal */}
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Create A/B Test</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Test Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Homepage Hero Image Test"
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    placeholder="What are you testing and why?"
                    rows={3}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Goal Metric</label>
                    <select className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none">
                      <option>Sign up conversion</option>
                      <option>Complete onboarding</option>
                      <option>Start therapy session</option>
                      <option>Complete mood check-in</option>
                      <option>Subscribe to premium</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Traffic Split</label>
                    <select className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none">
                      <option>50/50 (2 variants)</option>
                      <option>33/33/34 (3 variants)</option>
                      <option>25/25/25/25 (4 variants)</option>
                      <option>90/10 (Control heavy)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Number of Variants</label>
                  <select className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none">
                    <option>2 (Control + Variant A)</option>
                    <option>3 (Control + Variant A + Variant B)</option>
                    <option>4 (Control + 3 Variants)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                >
                  Cancel
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium"
                >
                  Create Test
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </AdminLayoutNew>
  );
}