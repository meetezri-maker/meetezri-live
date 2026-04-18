
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
import { AdminPaginationBar } from "../../components/admin/AdminPaginationBar";

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

type SegmentRuleRow = { type: string; operator: string; value: string };

const AGE_PRESETS = [
  { id: "any" as const, label: "Any age" },
  { id: "13-17" as const, label: "13–17" },
  { id: "18-24" as const, label: "18–24" },
  { id: "25-34" as const, label: "25–34" },
  { id: "35-44" as const, label: "35–44" },
  { id: "45-54" as const, label: "45–54" },
  { id: "55-64" as const, label: "55–64" },
  { id: "65+" as const, label: "65+" },
  { id: "custom" as const, label: "Custom range" },
];

type AgePresetId = (typeof AGE_PRESETS)[number]["id"];

const PRESET_AGE_BETWEEN: Record<string, [number, number]> = {
  "13-17": [13, 17],
  "18-24": [18, 24],
  "25-34": [25, 34],
  "35-44": [35, 44],
  "45-54": [45, 54],
  "55-64": [55, 64],
  "65+": [65, 120],
};

function buildSegmentRulesFromCreateFilters(f: {
  agePreset: AgePresetId;
  ageCustomMin: string;
  ageCustomMax: string;
  planMode: "any" | "none" | "specific";
  plans: { trial: boolean; core: boolean; pro: boolean };
  signupType: "any" | "trial" | "plan" | "__unset__";
  onboarding: "any" | "true" | "false";
}): SegmentRuleRow[] {
  const rules: SegmentRuleRow[] = [];
  if (f.agePreset !== "any") {
    if (f.agePreset === "custom") {
      const lo = parseInt(f.ageCustomMin, 10);
      const hi = parseInt(f.ageCustomMax, 10);
      if (!Number.isNaN(lo) && !Number.isNaN(hi) && lo <= hi) {
        rules.push({ type: "age", operator: "between", value: `${lo},${hi}` });
      }
    } else if (PRESET_AGE_BETWEEN[f.agePreset]) {
      const [a, b] = PRESET_AGE_BETWEEN[f.agePreset];
      rules.push({ type: "age", operator: "between", value: `${a},${b}` });
    }
  }
  if (f.planMode === "none") {
    rules.push({ type: "subscription", operator: "equals", value: "none" });
  } else if (f.planMode === "specific") {
    const chosen: string[] = [];
    if (f.plans.trial) chosen.push("trial");
    if (f.plans.core) chosen.push("core");
    if (f.plans.pro) chosen.push("pro");
    if (chosen.length === 1) {
      rules.push({ type: "subscription", operator: "equals", value: chosen[0] });
    } else if (chosen.length > 1) {
      rules.push({ type: "subscription", operator: "in", value: chosen.join(",") });
    }
  }
  if (f.signupType !== "any") {
    rules.push({ type: "signup_type", operator: "equals", value: f.signupType });
  }
  if (f.onboarding !== "any") {
    rules.push({ type: "onboarding_completed", operator: "equals", value: f.onboarding });
  }
  return rules;
}

function formatSegmentRuleLabel(c: SegmentRuleRow): string {
  if (c.type === "age" && c.operator === "between") {
    const [a, b] = c.value.split(",").map((x) => x.trim());
    return `Age ${a}–${b}`;
  }
  if (c.type === "age" && c.operator === "equals") return `Age is ${c.value}`;
  if (c.type === "age" && (c.operator === "gte" || c.operator === "lte")) {
    return c.operator === "gte" ? `Age ≥ ${c.value}` : `Age ≤ ${c.value}`;
  }
  if (c.type === "subscription" && c.operator === "equals") {
    if (c.value === "none") return "No active or trialing subscription";
    const m: Record<string, string> = { trial: "Trial", core: "Core", pro: "Pro" };
    return `Plan: ${m[c.value] ?? c.value}`;
  }
  if (c.type === "subscription" && c.operator === "in") {
    const m: Record<string, string> = { trial: "Trial", core: "Core", pro: "Pro" };
    return `Plan: ${c.value.split(",").map((x) => m[x.trim()] ?? x.trim()).join(", ")}`;
  }
  if (c.type === "signup_type" && c.operator === "equals") {
    if (c.value === "__unset__") return "Signup: not set";
    if (c.value === "trial") return "Signup: trial path";
    if (c.value === "plan") return "Signup: plan path";
    return `Signup: ${c.value}`;
  }
  if (c.type === "onboarding_completed" && c.operator === "equals") {
    return c.value === "true" ? "Onboarding complete" : "Onboarding incomplete";
  }
  if (c.type === "role" && c.operator === "equals") return `Role: ${c.value}`;
  if (c.type === "account_status" && c.operator === "equals") return `Account: ${c.value}`;
  return `${c.type} ${c.operator} ${c.value}`;
}

const defaultCreateFilters = () => ({
  agePreset: "any" as AgePresetId,
  ageCustomMin: "25",
  ageCustomMax: "44",
  planMode: "any" as "any" | "none" | "specific",
  plans: { trial: false, core: false, pro: false },
  signupType: "any" as "any" | "trial" | "plan" | "__unset__",
  onboarding: "any" as "any" | "true" | "false",
});

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

  const [segmentsListPage, setSegmentsListPage] = useState(1);
  const [segmentsListPageSize, setSegmentsListPageSize] = useState(10);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#3b82f6",
  });
  const [createFilters, setCreateFilters] = useState(defaultCreateFilters);

  const [segmentUsersLoading, setSegmentUsersLoading] = useState(false);
  const [segmentUsersError, setSegmentUsersError] = useState<string | null>(null);
  const [segmentUsersPage, setSegmentUsersPage] = useState(1);
  const [segmentUsersPayload, setSegmentUsersPayload] = useState<{
    users: Array<{
      id: string;
      full_name: string | null;
      email: string | null;
      age: string | null;
      plan_type: string | null;
      subscription_status: string | null;
      created_at: string;
    }>;
    total: number;
    page: number;
    pages: number;
  } | null>(null);

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

  useEffect(() => {
    if (!showViewUsersModal || !viewingSegment?.id) return;
    let cancelled = false;
    (async () => {
      setSegmentUsersLoading(true);
      setSegmentUsersError(null);
      try {
        const data = (await api.admin.getUserSegmentUsers(viewingSegment.id, {
          page: segmentUsersPage,
          limit: 20,
        })) as {
          users: Array<{
            id: string;
            full_name: string | null;
            email: string | null;
            age: string | null;
            plan_type: string | null;
            subscription_status: string | null;
            created_at: string;
          }>;
          total: number;
          page: number;
          pages: number;
        };
        if (!cancelled) setSegmentUsersPayload(data);
      } catch (e) {
        if (!cancelled) {
          setSegmentUsersError(e instanceof Error ? e.message : "Failed to load users");
          setSegmentUsersPayload(null);
        }
      } finally {
        if (!cancelled) setSegmentUsersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showViewUsersModal, viewingSegment?.id, segmentUsersPage]);

  const handleCreate = async () => {
    const name = formData.name.trim();
    if (!name) {
      toast.error("Please enter a segment name.");
      return;
    }
    if (createFilters.planMode === "specific") {
      const anyPlan =
        createFilters.plans.trial || createFilters.plans.core || createFilters.plans.pro;
      if (!anyPlan) {
        toast.error("Select at least one plan (Trial, Core, or Pro), or change the subscription filter.");
        return;
      }
    }
    if (createFilters.agePreset === "custom") {
      const lo = parseInt(createFilters.ageCustomMin, 10);
      const hi = parseInt(createFilters.ageCustomMax, 10);
      if (Number.isNaN(lo) || Number.isNaN(hi) || lo > hi || lo < 13 || hi > 120) {
        toast.error("Enter a valid age range (13–120, min ≤ max).");
        return;
      }
    }
    if (creatingSegment) return;
    setCreatingSegment(true);
    try {
      const rules = buildSegmentRulesFromCreateFilters(createFilters);
      await api.admin.createUserSegment({
        name,
        description: formData.description.trim() || undefined,
        criteria: {
          color: formData.color,
          rules,
        },
        user_count: 0,
      });
      toast.success("Segment created.");
      setShowCreateModal(false);
      setFormData({ name: "", description: "", color: "#3b82f6" });
      setCreateFilters(defaultCreateFilters());
      await fetchSegments();
    } catch (error) {
      console.error("Failed to create segment", error);
      const msg = error instanceof Error ? error.message : "Failed to create segment";
      toast.error(msg);
    } finally {
      setCreatingSegment(false);
    }
  };

  useEffect(() => {
    const tp = Math.max(1, Math.ceil(segments.length / segmentsListPageSize) || 1);
    setSegmentsListPage((p) => (p > tp ? tp : p));
  }, [segments.length, segmentsListPageSize]);

  const segmentsTotalPages = Math.max(
    1,
    Math.ceil(segments.length / segmentsListPageSize) || 1
  );
  const segmentsSafePage = Math.min(
    Math.max(1, segmentsListPage),
    segmentsTotalPages
  );
  const paginatedSegments = segments.slice(
    (segmentsSafePage - 1) * segmentsListPageSize,
    segmentsSafePage * segmentsListPageSize
  );

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
            onClick={() => {
            setCreateFilters(defaultCreateFilters());
            setFormData({ name: "", description: "", color: "#3b82f6" });
            setShowCreateModal(true);
          }}
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
            <>
            <div className="space-y-4">
              {paginatedSegments.map((segment, index) => (
                <motion.div
                  key={segment.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + index * 0.03 }}
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
                                  {formatSegmentRuleLabel(criterion)}
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
                            setSegmentUsersPage(1);
                            setSegmentUsersPayload(null);
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
            <AdminPaginationBar
              total={segments.length}
              page={segmentsListPage}
              pageSize={segmentsListPageSize}
              onPageChange={setSegmentsListPage}
              onPageSizeChange={setSegmentsListPageSize}
              selectId="user-segmentation-list-page-size"
            />
            </>
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

                <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-2">Age</label>
                    <select
                      value={createFilters.agePreset}
                      onChange={(e) =>
                        setCreateFilters((prev) => ({
                          ...prev,
                          agePreset: e.target.value as AgePresetId,
                        }))
                      }
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    >
                      {AGE_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    {createFilters.agePreset === "custom" ? (
                      <div className="flex gap-3 mt-2 items-center">
                        <label className="text-xs text-gray-600 shrink-0">Min</label>
                        <input
                          type="number"
                          min={13}
                          max={120}
                          value={createFilters.ageCustomMin}
                          onChange={(e) =>
                            setCreateFilters((prev) => ({ ...prev, ageCustomMin: e.target.value }))
                          }
                          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
                        />
                        <label className="text-xs text-gray-600 shrink-0">Max</label>
                        <input
                          type="number"
                          min={13}
                          max={120}
                          value={createFilters.ageCustomMax}
                          onChange={(e) =>
                            setCreateFilters((prev) => ({ ...prev, ageCustomMax: e.target.value }))
                          }
                          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
                        />
                      </div>
                    ) : null}
                    <p className="text-xs text-gray-500 mt-1.5">
                      Uses the age stored on each profile (from onboarding). Users without age are excluded when an age filter applies.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-2">Subscription plan</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="radio"
                          name="planMode"
                          checked={createFilters.planMode === "any"}
                          onChange={() =>
                            setCreateFilters((prev) => ({ ...prev, planMode: "any" }))
                          }
                          className="rounded-full border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        Any (no plan filter)
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="radio"
                          name="planMode"
                          checked={createFilters.planMode === "none"}
                          onChange={() =>
                            setCreateFilters((prev) => ({ ...prev, planMode: "none" }))
                          }
                          className="rounded-full border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        No active or trialing subscription
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="radio"
                          name="planMode"
                          checked={createFilters.planMode === "specific"}
                          onChange={() =>
                            setCreateFilters((prev) => ({ ...prev, planMode: "specific" }))
                          }
                          className="rounded-full border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        Specific plans (active or trialing)
                      </label>
                    </div>
                    {createFilters.planMode === "specific" ? (
                      <div className="flex flex-wrap gap-3 mt-3 pl-6">
                        {(
                          [
                            ["trial", "Trial"],
                            ["core", "Core"],
                            ["pro", "Pro"],
                          ] as const
                        ).map(([key, label]) => (
                          <label
                            key={key}
                            className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={createFilters.plans[key]}
                              onChange={(e) =>
                                setCreateFilters((prev) => ({
                                  ...prev,
                                  plans: { ...prev.plans, [key]: e.target.checked },
                                }))
                              }
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-800 mb-2">Signup path</label>
                      <select
                        value={createFilters.signupType}
                        onChange={(e) =>
                          setCreateFilters((prev) => ({
                            ...prev,
                            signupType: e.target.value as typeof prev.signupType,
                          }))
                        }
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      >
                        <option value="any">Any</option>
                        <option value="trial">Trial signup</option>
                        <option value="plan">Plan signup</option>
                        <option value="__unset__">Not recorded</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-800 mb-2">Onboarding</label>
                      <select
                        value={createFilters.onboarding}
                        onChange={(e) =>
                          setCreateFilters((prev) => ({
                            ...prev,
                            onboarding: e.target.value as typeof prev.onboarding,
                          }))
                        }
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      >
                        <option value="any">Any</option>
                        <option value="true">Completed</option>
                        <option value="false">Not completed</option>
                      </select>
                    </div>
                  </div>
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
              className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-xl"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Users in {viewingSegment.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {segmentUsersPayload != null
                      ? `${segmentUsersPayload.total.toLocaleString()} matching user${segmentUsersPayload.total === 1 ? "" : "s"}`
                      : "Loading…"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowViewUsersModal(false)}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {segmentUsersError ? (
                <p className="text-sm text-red-600 py-4">{segmentUsersError}</p>
              ) : null}

              <div className="flex-1 overflow-y-auto min-h-[200px] border border-gray-100 rounded-xl">
                {segmentUsersLoading && !segmentUsersPayload ? (
                  <div className="flex items-center justify-center py-16 text-gray-500 gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Loading users…
                  </div>
                ) : segmentUsersPayload && segmentUsersPayload.users.length === 0 ? (
                  <p className="text-center text-gray-500 py-12 px-4">No users match this segment.</p>
                ) : segmentUsersPayload ? (
                  <table className="w-full text-sm text-left">
                    <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 text-gray-600">
                      <tr>
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Email</th>
                        <th className="px-4 py-3 font-medium">Age</th>
                        <th className="px-4 py-3 font-medium">Plan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {segmentUsersPayload.users.map((u) => (
                        <tr key={u.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/80">
                          <td className="px-4 py-2.5 text-gray-900">
                            {u.full_name?.trim() || "—"}
                          </td>
                          <td className="px-4 py-2.5 text-gray-700 break-all">{u.email || "—"}</td>
                          <td className="px-4 py-2.5 text-gray-700">{u.age ?? "—"}</td>
                          <td className="px-4 py-2.5 text-gray-700">
                            {u.plan_type
                              ? u.plan_type === "pro"
                                ? "Pro"
                                : u.plan_type === "core"
                                  ? "Core"
                                  : u.plan_type === "trial"
                                    ? "Trial"
                                    : u.plan_type
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </div>

              {segmentUsersPayload && segmentUsersPayload.pages > 1 ? (
                <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-100">
                  <span className="text-xs text-gray-500">
                    Page {segmentUsersPayload.page} of {segmentUsersPayload.pages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={segmentUsersPage <= 1 || segmentUsersLoading}
                      onClick={() => setSegmentUsersPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={
                        segmentUsersLoading ||
                        !segmentUsersPayload ||
                        segmentUsersPage >= segmentUsersPayload.pages
                      }
                      onClick={() => setSegmentUsersPage((p) => p + 1)}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => setShowViewUsersModal(false)}
                className="mt-4 w-full px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium text-sm"
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
