
import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { 
  Users,
  Filter,
  Target,
  TrendingUp,
  Calendar,
  Heart,
  Zap,
  DollarSign,
  Activity,
  Clock,
  Plus,
  Eye,
  Edit,
  Download,
  X,
  Mail,
  Send,
  Trash2,
  Loader2,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { api } from "../../../lib/api";
import { toast } from "sonner";

const SEGMENT_COLOR_PALETTE = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
] as const;

function paletteIndexForId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h << 5) - h + id.charCodeAt(i);
  }
  return Math.abs(h) % SEGMENT_COLOR_PALETTE.length;
}

function isHexColor(s: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(s);
}

/** API stores `criteria` as JSON: either legacy array or `{ color, rules }`. */
function normalizeCriteriaFromApi(
  raw: unknown,
  segmentId: string
): {
  color: string;
  rules: { type: string; operator: string; value: string }[];
} {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const rawColor = o.color;
    const color =
      typeof rawColor === "string" && isHexColor(rawColor)
        ? rawColor
        : SEGMENT_COLOR_PALETTE[paletteIndexForId(segmentId)];
    const rules = Array.isArray(o.rules) ? o.rules : [];
    const safe = rules.filter(
      (r): r is { type: string; operator: string; value: string } =>
        r != null &&
        typeof r === "object" &&
        "type" in (r as object) &&
        "operator" in (r as object) &&
        "value" in (r as object)
    );
    return { color, rules: safe };
  }
  if (Array.isArray(raw)) {
    const safe = raw.filter(
      (r): r is { type: string; operator: string; value: string } =>
        r != null &&
        typeof r === "object" &&
        "type" in (r as object) &&
        "operator" in (r as object) &&
        "value" in (r as object)
    );
    return {
      color: SEGMENT_COLOR_PALETTE[paletteIndexForId(segmentId)],
      rules: safe,
    };
  }
  return {
    color: SEGMENT_COLOR_PALETTE[paletteIndexForId(segmentId)],
    rules: [],
  };
}

interface Segment {
  id: string;
  name: string;
  description: string;
  userCount: number;
  criteria: {
    type: string;
    operator: string;
    value: string;
  }[];
  engagement: number;
  conversionRate: number;
  avgSessionLength: number;
  createdAt: Date;
  color: string;
}

type SegmentationPlatform = {
  total_end_users: number;
  total_segments: number;
  avg_engagement_pct: number;
  premium_users: number;
  avg_session_minutes_platform: number;
  engagement_distribution: { range: string; users: number }[];
};

const emptyPlatform: SegmentationPlatform = {
  total_end_users: 0,
  total_segments: 0,
  avg_engagement_pct: 0,
  premium_users: 0,
  avg_session_minutes_platform: 0,
  engagement_distribution: [],
};

export function UserSegmentation() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [platform, setPlatform] = useState<SegmentationPlatform>(emptyPlatform);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [showViewUsersModal, setShowViewUsersModal] = useState(false);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [viewingSegment, setViewingSegment] = useState<Segment | null>(null);
  const [creatingSegment, setCreatingSegment] = useState(false);
  const [deletingSegmentId, setDeletingSegmentId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const segmentsFirstLoad = useRef(true);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    criteria: [] as any[],
    color: '#3b82f6'
  });

  const fetchSegments = async () => {
    try {
      if (segmentsFirstLoad.current) setIsLoading(true);
      setLoadError(null);
      const data = await api.admin.getUserSegments() as {
        segments?: unknown[];
        platform?: SegmentationPlatform;
      };
      const list = Array.isArray(data) ? data : data.segments ?? [];
      const plat =
        data && !Array.isArray(data) && data.platform
          ? data.platform
          : emptyPlatform;

      const mapped = list.map((s: any) => {
        const { color, rules } = normalizeCriteriaFromApi(s.criteria, s.id);
        return {
          id: s.id,
          name: s.name,
          description: s.description || "",
          userCount: Number(s.user_count ?? 0),
          criteria: rules,
          engagement: Number(s.engagement_pct ?? 0),
          conversionRate: Number(s.conversion_pct ?? 0),
          avgSessionLength: Number(s.avg_session_minutes ?? 0),
          createdAt: new Date(s.created_at),
          color,
        };
      });
      setSegments(mapped);
      setPlatform(plat);
    } catch (error) {
      console.error("Failed to fetch segments", error);
      const msg =
        error instanceof Error ? error.message : "Failed to load segmentation data.";
      setLoadError(msg);
      toast.error(msg);
    } finally {
      if (segmentsFirstLoad.current) {
        setIsLoading(false);
        segmentsFirstLoad.current = false;
      }
    }
  };

  useEffect(() => {
    fetchSegments();
  }, []);

  const handleCreate = async () => {
    const name = formData.name.trim();
    if (!name) {
      toast.error("Please enter a segment name.");
      return;
    }
    if (creatingSegment) return;
    setCreatingSegment(true);
    try {
      await api.admin.createUserSegment({
        name,
        description: formData.description.trim() || undefined,
        criteria: {
          color: formData.color,
          rules: formData.criteria,
        },
        user_count: 0,
      });
      toast.success("Segment created.");
      setShowCreateModal(false);
      setFormData({ name: '', description: '', criteria: [], color: '#3b82f6' });
      await fetchSegments();
    } catch (error) {
      console.error("Failed to create segment", error);
      const msg = error instanceof Error ? error.message : "Failed to create segment";
      toast.error(msg);
    } finally {
      setCreatingSegment(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingSegmentId) return;
    if (!confirm('Are you sure you want to delete this segment?')) return;
    setDeletingSegmentId(id);
    try {
      await api.admin.deleteUserSegment(id);
      fetchSegments();
    } catch (error) {
      console.error("Failed to delete segment", error);
      toast.error("Failed to delete segment");
    } finally {
      setDeletingSegmentId(null);
    }
  };

  const engagementData =
    platform.engagement_distribution?.length > 0
      ? platform.engagement_distribution
      : [{ range: "—", users: 0 }];

  // Segment distribution for pie chart
  const segmentDistribution = segments.map(seg => ({
    name: seg.name,
    value: seg.userCount,
    color: seg.color
  }));

  const stats = {
    totalEndUsers: platform.total_end_users,
    totalSegments: platform.total_segments || segments.length,
    avgEngagement: platform.avg_engagement_pct,
    premiumUsers: platform.premium_users,
  };

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        {isLoading && (
          <div className="animate-pulse space-y-6 mb-2" aria-hidden>
            <div className="h-10 bg-gray-200 rounded-lg w-64 max-w-full" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 bg-gray-100 rounded-2xl" />
              ))}
            </div>
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="h-72 bg-gray-100 rounded-2xl" />
              <div className="h-72 bg-gray-100 rounded-2xl" />
            </div>
            <div className="h-48 bg-gray-100 rounded-2xl" />
          </div>
        )}

        <div className={isLoading ? "opacity-0 h-0 overflow-hidden pointer-events-none" : "space-y-6"}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Segmentation</h1>
            <p className="text-gray-600 mt-1">Analyze and target specific user groups</p>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center gap-2 shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Create Segment
          </motion.button>
        </motion.div>

        {loadError ? (
          <div
            className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between"
            role="alert"
          >
            <span>{loadError}</span>
            <button
              type="button"
              className="shrink-0 rounded-md border border-red-300 bg-white px-3 py-1.5 font-medium text-red-800 hover:bg-red-100"
              onClick={() => void fetchSegments()}
            >
              Retry
            </button>
          </div>
        ) : null}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
                <p className="text-gray-600 text-sm">Total profiles</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalEndUsers.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Matches main admin “Total Users”</p>
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
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Segments</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalSegments}</p>
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
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Avg Engagement</p>
                <p className="text-2xl font-bold text-gray-900">{stats.avgEngagement}%</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl p-6 shadow-lg border-2 border-blue-200"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Premium users</p>
                <p className="text-2xl font-bold text-blue-600">{stats.premiumUsers.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Core / Pro, active or trialing</p>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Segment Distribution */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-6">Segment Distribution</h2>
            <ResponsiveContainer width="100%" height={250}>
              <RechartsPie>
                <Pie
                  data={segmentDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {segmentDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPie>
            </ResponsiveContainer>
          </motion.div>

          {/* Engagement Distribution */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-6">Engagement Distribution</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={engagementData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="range" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '12px' 
                  }}
                />
                <Bar dataKey="users" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Segments List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-6">All Segments</h2>

          {segments.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No segments found. Create one to get started!</p>
          ) : (
            <div className="space-y-4">
              {segments.map((segment, index) => (
                <motion.div
                  key={segment.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + index * 0.05 }}
                  onClick={() => setSelectedSegment(selectedSegment?.id === segment.id ? null : segment)}
                  className={`border-2 rounded-xl p-5 cursor-pointer transition-all ${
                    selectedSegment?.id === segment.id
                      ? "border-blue-500 bg-blue-50 shadow-md"
                      : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div 
                      className="p-3 rounded-xl flex-shrink-0"
                      style={{ backgroundColor: segment.color }}
                    >
                      <Users className="w-6 h-6 text-white" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-gray-900 text-lg">{segment.name}</h3>
                        <span 
                          className="px-3 py-1 rounded-lg text-sm font-bold text-white"
                          style={{ backgroundColor: segment.color }}
                        >
                          {segment.userCount} users
                        </span>
                      </div>

                      <p className="text-gray-600 mb-3">{segment.description}</p>

                      {/* Metrics */}
                      <div className="grid grid-cols-3 gap-4 mb-3">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Activity className="w-4 h-4 text-gray-600" />
                            <p className="text-xs text-gray-600">Engagement</p>
                          </div>
                          <p className="font-bold text-gray-900">{segment.engagement}%</p>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-4 h-4 text-gray-600" />
                            <p className="text-xs text-gray-600">Conversion</p>
                          </div>
                          <p className="font-bold text-gray-900">{segment.conversionRate}%</p>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-4 h-4 text-gray-600" />
                            <p className="text-xs text-gray-600">Avg Session</p>
                          </div>
                          <p className="font-bold text-gray-900">{segment.avgSessionLength}m</p>
                        </div>
                      </div>

                      {/* Criteria */}
                      {segment.criteria.length > 0 && (
                        <div className="bg-gray-50 rounded-lg p-3 mb-3">
                          <p className="text-xs font-bold text-gray-700 mb-2 uppercase">Criteria:</p>
                          <div className="space-y-1">
                            {segment.criteria.map((criterion, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm">
                                <Filter className="w-3 h-3 text-gray-500" />
                                <span className="text-gray-700">
                                  <span className="font-medium">{criterion.type}</span> {criterion.operator} <span className="font-medium">{criterion.value}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Created: {segment.createdAt.toLocaleDateString()}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 mt-4">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex-1 px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium flex items-center justify-center gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingSegment(segment);
                            setShowViewUsersModal(true);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                          View Users
                        </motion.button>

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex-1 px-3 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium flex items-center justify-center gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingSegment(segment);
                            setShowCampaignModal(true);
                          }}
                        >
                          <Zap className="w-4 h-4" />
                          Send Campaign
                        </motion.button>

                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          disabled={deletingSegmentId === segment.id}
                          className="px-3 py-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 text-sm font-medium disabled:opacity-60"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDelete(segment.id);
                          }}
                        >
                          {deletingSegmentId === segment.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
        </div>

        {/* Create Segment Modal */}
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !creatingSegment && setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Create User Segment</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Segment Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Weekend Warriors"
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe this user segment..."
                    rows={3}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* Simplified Criteria UI for now */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter Criteria</label>
                  <p className="text-sm text-gray-500 mb-2">Adding complex filters will be available in the next update. For now, you can create named segments.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Segment Color</label>
                  <div className="flex flex-wrap gap-2">
                    {SEGMENT_COLOR_PALETTE.map((color) => {
                      const selected = formData.color.toLowerCase() === color.toLowerCase();
                      return (
                        <button
                          key={color}
                          type="button"
                          title={color}
                          aria-label={`Color ${color}`}
                          aria-pressed={selected}
                          onClick={() => setFormData((prev) => ({ ...prev, color }))}
                          className={`relative w-10 h-10 rounded-lg border-2 transition-all shrink-0 shadow-sm ${
                            selected
                              ? "border-white ring-2 ring-offset-2 ring-offset-white ring-gray-900 scale-105 z-10"
                              : "border-white/80 hover:border-gray-400"
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Selected: <span className="font-mono">{formData.color}</span>
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={creatingSegment}
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium disabled:opacity-50"
                >
                  Cancel
                </motion.button>

                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={creatingSegment}
                  onClick={() => void handleCreate()}
                  className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium inline-flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {creatingSegment && <Loader2 className="w-4 h-4 animate-spin" />}
                  {creatingSegment ? "Creating…" : "Create Segment"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* View Users Modal (Placeholder for now) */}
        {showViewUsersModal && viewingSegment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowViewUsersModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-md w-full text-center"
            >
              <h3 className="text-xl font-bold mb-2">Users in {viewingSegment.name}</h3>
              <p className="text-gray-600 mb-6">User list viewing is coming soon.</p>
              <button
                onClick={() => setShowViewUsersModal(false)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg"
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
