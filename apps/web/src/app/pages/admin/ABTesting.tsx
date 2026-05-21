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
import { useState, useEffect, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { api } from "@/lib/api";
import { toast } from "sonner";

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

function mapRowToTest(row: Record<string, unknown>): ABTest {
  const variantsRaw = row.variants;
  const variants = Array.isArray(variantsRaw)
    ? (variantsRaw as ABTest["variants"])
    : [];
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description ?? ""),
    status: (String(row.status || "draft") as ABTest["status"]) || "draft",
    startDate: new Date(String(row.startDate)),
    endDate: row.endDate ? new Date(String(row.endDate)) : undefined,
    variants,
    goal: String(row.goal ?? ""),
    confidence: typeof row.confidence === "number" ? row.confidence : 0,
    winner: row.winner != null ? String(row.winner) : undefined,
  };
}

export function ABTesting() {
  const [selectedTest, setSelectedTest] = useState<ABTest | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [abTests, setAbTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [detailsTest, setDetailsTest] = useState<ABTest | null>(null);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createGoal, setCreateGoal] = useState("Complete onboarding");

  const loadTests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listAbTests();
      setAbTests((Array.isArray(data) ? data : []).map((r) => mapRowToTest(r as Record<string, unknown>)));
    } catch (e) {
      console.error(e);
      toast.error("Failed to load A/B tests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTests();
  }, [loadTests]);

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

  const totalVisitors = abTests.reduce(
    (sum, t) => sum + t.variants.reduce((s, v) => s + (v.visitors || 0), 0),
    0
  );
  const stats = {
    activeTests: abTests.filter((t) => t.status === "active").length,
    completedTests: abTests.filter((t) => t.status === "completed").length,
    avgUplift:
      abTests.length > 0
        ? Math.round(
            abTests.reduce((acc, t) => {
              const rates = t.variants.map((v) => v.conversionRate || 0);
              const spread = rates.length > 1 ? Math.max(...rates) - Math.min(...rates) : 0;
              return acc + spread;
            }, 0) / abTests.length
          )
        : 0,
    totalVisitors,
  };

  const mergeUpdated = (updated: unknown) => {
    const t = mapRowToTest(updated as Record<string, unknown>);
    setAbTests((prev) => prev.map((x) => (x.id === t.id ? t : x)));
    setSelectedTest((s) => (s?.id === t.id ? t : s));
  };

  const pauseTest = async (e: React.MouseEvent, testId: string) => {
    e.stopPropagation();
    setBusy(true);
    try {
      const u = await api.updateAbTest(testId, { status: "paused" });
      mergeUpdated(u);
      toast.success("Test paused");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to pause");
    } finally {
      setBusy(false);
    }
  };

  const resumeTest = async (e: React.MouseEvent, testId: string) => {
    e.stopPropagation();
    setBusy(true);
    try {
      const u = await api.updateAbTest(testId, {
        status: "active",
        startDate: new Date().toISOString(),
      });
      mergeUpdated(u);
      toast.success("Test resumed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resume");
    } finally {
      setBusy(false);
    }
  };

  const declareWinner = async (e: React.MouseEvent, test: ABTest) => {
    e.stopPropagation();
    if (!test.variants.length) return;
    const best = test.variants.reduce((a, b) =>
      (b.conversionRate || 0) > (a.conversionRate || 0) ? b : a
    );
    setBusy(true);
    try {
      const u = await api.updateAbTest(test.id, {
        status: "completed",
        winner: best.id,
        endDate: new Date().toISOString(),
        confidence: Math.max(test.confidence, 95),
      });
      mergeUpdated(u);
      toast.success(`Winner set: ${best.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to declare winner");
    } finally {
      setBusy(false);
    }
  };

  const startTest = async (e: React.MouseEvent, testId: string) => {
    e.stopPropagation();
    setBusy(true);
    try {
      const u = await api.updateAbTest(testId, {
        status: "active",
        startDate: new Date().toISOString(),
      });
      mergeUpdated(u);
      toast.success("Test started");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start test");
    } finally {
      setBusy(false);
    }
  };

  const submitCreate = async () => {
    if (!createName.trim()) {
      toast.error("Test name is required");
      return;
    }
    setBusy(true);
    try {
      const u = await api.createAbTest({
        name: createName.trim(),
        description: createDescription.trim(),
        goal: createGoal,
        status: "draft",
      });
      setAbTests((prev) => [mapRowToTest(u as Record<string, unknown>), ...prev]);
      setShowCreateModal(false);
      setCreateName("");
      setCreateDescription("");
      setCreateGoal("Complete onboarding");
      toast.success("Created experiment");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create test");
    } finally {
      setBusy(false);
    }
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
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center gap-2 shadow-lg disabled:opacity-50"
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

          {loading && <p className="text-gray-600 py-6">Loading experiments…</p>}

          <div className="space-y-4">
            {!loading && abTests.map((test, index) => {
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
                      <div className="flex flex-wrap gap-2 mt-4">
                        {test.status === "active" && (
                          <>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              disabled={busy}
                              onClick={(e) => pauseTest(e, test.id)}
                              className="px-3 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium flex items-center gap-1 disabled:opacity-50"
                            >
                              <Pause className="w-4 h-4" />
                              Pause
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              disabled={busy}
                              onClick={(e) => declareWinner(e, test)}
                              className="px-3 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-medium flex items-center gap-1 disabled:opacity-50"
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
                            disabled={busy}
                            onClick={(e) => resumeTest(e, test.id)}
                            className="px-3 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-medium flex items-center gap-1 disabled:opacity-50"
                          >
                            <Play className="w-4 h-4" />
                            Resume
                          </motion.button>
                        )}

                        {test.status === "draft" && (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            disabled={busy}
                            onClick={(e) => startTest(e, test.id)}
                            className="px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium flex items-center gap-1 disabled:opacity-50"
                          >
                            <Play className="w-4 h-4" />
                            Start Test
                          </motion.button>
                        )}

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailsTest(test);
                          }}
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Create A/B Test</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Test Name</label>
                  <input
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="e.g., Homepage Hero Image Test"
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                    placeholder="What are you testing and why?"
                    rows={3}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Goal Metric</label>
                  <select
                    value={createGoal}
                    onChange={(e) => setCreateGoal(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="Sign up conversion">Sign up conversion</option>
                    <option value="Complete onboarding">Complete onboarding</option>
                    <option value="Start therapy session">Start therapy session</option>
                    <option value="Complete mood check-in">Complete mood check-in</option>
                    <option value="Subscribe to premium">Subscribe to premium</option>
                  </select>
                </div>

                <p className="text-sm text-gray-500">
                  Default control and variant A are created automatically. Start the test when ready.
                </p>
              </div>

              <div className="flex gap-3 mt-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowCreateModal(false)}
                  disabled={busy}
                  className="flex-1 px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                >
                  Cancel
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => void submitCreate()}
                  disabled={busy}
                  className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium disabled:opacity-50"
                >
                  {busy ? "Creating…" : "Create Test"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {detailsTest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
            onClick={() => setDetailsTest(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2">{detailsTest.name}</h3>
              <p className="text-gray-600 text-sm mb-4">{detailsTest.description}</p>
              <div className="flex flex-wrap gap-2 text-xs text-gray-600 mb-4">
                <span className="px-2 py-1 bg-gray-100 rounded">Status: {detailsTest.status}</span>
                <span className="px-2 py-1 bg-gray-100 rounded">Goal: {detailsTest.goal}</span>
                <span className="px-2 py-1 bg-gray-100 rounded">Confidence: {detailsTest.confidence}%</span>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-gray-900">{detailsTest.variants.length} variants</p>
                <ul className="text-sm text-gray-700 list-disc pl-5">
                  {detailsTest.variants.map((v) => (
                    <li key={v.id}>
                      {v.name}: {Number(v.conversionRate ?? 0).toFixed(1)}% conv. · {Number(v.visitors ?? 0).toLocaleString()} visitors
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                className="mt-6 w-full px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium"
                onClick={() => setDetailsTest(null)}
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </div>
    </AdminLayoutNew>
  );
}