
import { motion, AnimatePresence } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { 
  Users,
  Filter,
  Target,
  TrendingUp,
  Calendar,
  Zap,
  DollarSign,
  Activity,
  Clock,
  Plus,
  Eye,
  Edit,
  X,
  Trash2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
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

type CreateFilters = {
  agePreset: AgePresetId;
  ageCustomMin: string;
  ageCustomMax: string;
  planMode: "any" | "none" | "specific";
  plans: { trial: boolean; core: boolean; pro: boolean };
  signupType: "any" | "trial" | "plan" | "__unset__";
  onboarding: "any" | "true" | "false";
};

function buildSegmentRulesFromCreateFilters(f: CreateFilters): SegmentRuleRow[] {
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

function parseFiltersFromRules(rules: SegmentRuleRow[]): CreateFilters {
  const filters = defaultCreateFilters();
  for (const rule of rules) {
    if (rule.type === "age" && rule.operator === "between") {
      const parts = rule.value.split(",").map((x) => x.trim());
      const a = parts[0];
      const b = parts[1];
      const preset = Object.entries(PRESET_AGE_BETWEEN).find(
        ([, [lo, hi]]) => String(lo) === a && String(hi) === b
      );
      if (preset) {
        filters.agePreset = preset[0] as AgePresetId;
      } else {
        filters.agePreset = "custom";
        filters.ageCustomMin = a ?? "25";
        filters.ageCustomMax = b ?? "44";
      }
    }
    if (rule.type === "subscription") {
      if (rule.operator === "equals") {
        if (rule.value === "none") {
          filters.planMode = "none";
        } else {
          filters.planMode = "specific";
          const key = rule.value as keyof typeof filters.plans;
          if (key in filters.plans) {
            filters.plans = { ...filters.plans, [key]: true };
          }
        }
      } else if (rule.operator === "in") {
        filters.planMode = "specific";
        rule.value.split(",").forEach((v) => {
          const key = v.trim() as keyof typeof filters.plans;
          if (key in filters.plans) {
            filters.plans = { ...filters.plans, [key]: true };
          }
        });
      }
    }
    if (rule.type === "signup_type" && rule.operator === "equals") {
      filters.signupType = rule.value as CreateFilters["signupType"];
    }
    if (rule.type === "onboarding_completed" && rule.operator === "equals") {
      filters.onboarding = rule.value as CreateFilters["onboarding"];
    }
  }
  return filters;
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
    const m: Record<string, string> = { trial: "Discover", core: "Grow", pro: "Thrive" };
    return `Plan: ${m[c.value] ?? c.value}`;
  }
  if (c.type === "subscription" && c.operator === "in") {
    const m: Record<string, string> = { trial: "Discover", core: "Grow", pro: "Thrive" };
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

const defaultCreateFilters = (): CreateFilters => ({
  agePreset: "any",
  ageCustomMin: "25",
  ageCustomMax: "44",
  planMode: "any",
  plans: { trial: false, core: false, pro: false },
  signupType: "any",
  onboarding: "any",
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

// ─── Shared modal shell ───────────────────────────────────────────────────────

interface ModalShellProps {
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}

function ModalShell({ onClose, children, maxWidth = "max-w-2xl" }: ModalShellProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 8 }}
        transition={{ duration: 0.18 }}
        onClick={(e) => e.stopPropagation()}
        className={`bg-white rounded-2xl shadow-2xl border border-gray-100 w-full ${maxWidth}`}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

// ─── Segment form (shared between Create and Edit) ────────────────────────────

interface SegmentFormBodyProps {
  formData: { name: string; description: string; color: string };
  setFormData: React.Dispatch<React.SetStateAction<{ name: string; description: string; color: string }>>;
  filters: CreateFilters;
  setFilters: React.Dispatch<React.SetStateAction<CreateFilters>>;
}

function SegmentFormBody({ formData, setFormData, filters, setFilters }: SegmentFormBodyProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Segment Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
          placeholder="e.g., Weekend Warriors"
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
          placeholder="Describe this user segment..."
          rows={2}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 space-y-4">
        {/* Age */}
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-1.5">Age</label>
          <select
            value={filters.agePreset}
            onChange={(e) =>
              setFilters((p) => ({ ...p, agePreset: e.target.value as AgePresetId }))
            }
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          >
            {AGE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          {filters.agePreset === "custom" && (
            <div className="flex gap-3 mt-2 items-center">
              <label className="text-xs text-gray-600 shrink-0">Min</label>
              <input
                type="number"
                min={13}
                max={120}
                value={filters.ageCustomMin}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, ageCustomMin: e.target.value }))
                }
                className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
              />
              <label className="text-xs text-gray-600 shrink-0">Max</label>
              <input
                type="number"
                min={13}
                max={120}
                value={filters.ageCustomMax}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, ageCustomMax: e.target.value }))
                }
                className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
              />
            </div>
          )}
          <p className="text-xs text-gray-400 mt-1.5">
            Users without an age are excluded when an age filter applies.
          </p>
        </div>

        {/* Subscription */}
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-1.5">Subscription plan</label>
          <div className="space-y-2">
            {(["any", "none", "specific"] as const).map((mode) => (
              <label key={mode} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="planMode"
                  checked={filters.planMode === mode}
                  onChange={() => setFilters((p) => ({ ...p, planMode: mode }))}
                  className="rounded-full border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {mode === "any" ? "Any (no plan filter)" : mode === "none" ? "No active or trialing subscription" : "Specific plans (active or trialing)"}
              </label>
            ))}
          </div>
          {filters.planMode === "specific" && (
            <div className="flex flex-wrap gap-3 mt-3 pl-6">
              {(["trial", "core", "pro"] as const).map((key) => (
                <label key={key} className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer capitalize">
                  <input
                    type="checkbox"
                    checked={filters.plans[key]}
                    onChange={(e) =>
                      setFilters((p) => ({ ...p, plans: { ...p.plans, [key]: e.target.checked } }))
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Signup / Onboarding */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1.5">Signup path</label>
            <select
              value={filters.signupType}
              onChange={(e) =>
                setFilters((p) => ({ ...p, signupType: e.target.value as CreateFilters["signupType"] }))
              }
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            >
              <option value="any">Any</option>
              <option value="trial">Trial signup</option>
              <option value="plan">Plan signup</option>
              <option value="__unset__">Not recorded</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1.5">Onboarding</label>
            <select
              value={filters.onboarding}
              onChange={(e) =>
                setFilters((p) => ({ ...p, onboarding: e.target.value as CreateFilters["onboarding"] }))
              }
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            >
              <option value="any">Any</option>
              <option value="true">Completed</option>
              <option value="false">Not completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Color */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Segment Color</label>
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
                onClick={() => setFormData((p) => ({ ...p, color }))}
                className={`relative w-9 h-9 rounded-lg border-2 transition-all shrink-0 shadow-sm ${
                  selected
                    ? "border-white ring-2 ring-offset-2 ring-offset-white ring-gray-900 scale-110 z-10"
                    : "border-white/80 hover:scale-105"
                }`}
                style={{ backgroundColor: color }}
              />
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          Selected: <span className="font-mono">{formData.color}</span>
        </p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function UserSegmentation() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [platform, setPlatform] = useState<SegmentationPlatform>(emptyPlatform);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const segmentsFirstLoad = useRef(true);

  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);

  // Pagination
  const [segmentsListPage, setSegmentsListPage] = useState(1);
  const [segmentsListPageSize, setSegmentsListPageSize] = useState(10);

  // ── Create modal ──
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingSegment, setCreatingSegment] = useState(false);
  const [createFormData, setCreateFormData] = useState({ name: "", description: "", color: "#3b82f6" });
  const [createFilters, setCreateFilters] = useState<CreateFilters>(defaultCreateFilters);

  // ── Edit modal ──
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editFormData, setEditFormData] = useState({ name: "", description: "", color: "#3b82f6" });
  const [editFilters, setEditFilters] = useState<CreateFilters>(defaultCreateFilters);

  // ── Delete confirm modal ──
  const [segmentToDelete, setSegmentToDelete] = useState<Segment | null>(null);
  const [deletingSegmentId, setDeletingSegmentId] = useState<string | null>(null);

  // ── View Users modal ──
  const [viewingSegment, setViewingSegment] = useState<Segment | null>(null);
  const [showViewUsersModal, setShowViewUsersModal] = useState(false);
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

  // ── Campaign modal ──
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [campaignSegment, setCampaignSegment] = useState<Segment | null>(null);

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
      const msg = error instanceof Error ? error.message : "Failed to load segmentation data.";
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
    return () => { cancelled = true; };
  }, [showViewUsersModal, viewingSegment?.id, segmentUsersPage]);

  useEffect(() => {
    const tp = Math.max(1, Math.ceil(segments.length / segmentsListPageSize) || 1);
    setSegmentsListPage((p) => (p > tp ? tp : p));
  }, [segments.length, segmentsListPageSize]);

  // ── Handlers ──

  const validateFilters = (filters: CreateFilters): string | null => {
    if (filters.planMode === "specific") {
      const anyPlan = filters.plans.trial || filters.plans.core || filters.plans.pro;
      if (!anyPlan) return "Select at least one membership (Discover, Grow, or Thrive).";
    }
    if (filters.agePreset === "custom") {
      const lo = parseInt(filters.ageCustomMin, 10);
      const hi = parseInt(filters.ageCustomMax, 10);
      if (Number.isNaN(lo) || Number.isNaN(hi) || lo > hi || lo < 13 || hi > 120) {
        return "Enter a valid age range (13–120, min ≤ max).";
      }
    }
    return null;
  };

  const handleCreate = async () => {
    const name = createFormData.name.trim();
    if (!name) { toast.error("Please enter a segment name."); return; }
    const err = validateFilters(createFilters);
    if (err) { toast.error(err); return; }
    if (creatingSegment) return;
    setCreatingSegment(true);
    try {
      const rules = buildSegmentRulesFromCreateFilters(createFilters);
      await api.admin.createUserSegment({
        name,
        description: createFormData.description.trim() || undefined,
        criteria: { color: createFormData.color, rules },
        user_count: 0,
      });
      toast.success("Segment created.");
      setShowCreateModal(false);
      setCreateFormData({ name: "", description: "", color: "#3b82f6" });
      setCreateFilters(defaultCreateFilters());
      await fetchSegments();
    } catch (error) {
      console.error("Failed to create segment", error);
      toast.error(error instanceof Error ? error.message : "Failed to create segment");
    } finally {
      setCreatingSegment(false);
    }
  };

  const openEditModal = (segment: Segment) => {
    setEditingSegment(segment);
    setEditFormData({ name: segment.name, description: segment.description, color: segment.color });
    setEditFilters(parseFiltersFromRules(segment.criteria));
  };

  const handleEdit = async () => {
    if (!editingSegment) return;
    const name = editFormData.name.trim();
    if (!name) { toast.error("Please enter a segment name."); return; }
    const err = validateFilters(editFilters);
    if (err) { toast.error(err); return; }
    if (savingEdit) return;
    setSavingEdit(true);
    try {
      const rules = buildSegmentRulesFromCreateFilters(editFilters);
      await api.admin.updateUserSegment(editingSegment.id, {
        name,
        description: editFormData.description.trim() || undefined,
        criteria: { color: editFormData.color, rules },
      });
      toast.success("Segment updated.");
      setEditingSegment(null);
      await fetchSegments();
    } catch (error) {
      console.error("Failed to update segment", error);
      toast.error(error instanceof Error ? error.message : "Failed to update segment");
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDelete = async () => {
    if (!segmentToDelete || deletingSegmentId) return;
    setDeletingSegmentId(segmentToDelete.id);
    const id = segmentToDelete.id;
    setSegmentToDelete(null);
    try {
      await api.admin.deleteUserSegment(id);
      toast.success("Segment deleted.");
      fetchSegments();
    } catch (error) {
      console.error("Failed to delete segment", error);
      toast.error("Failed to delete segment");
    } finally {
      setDeletingSegmentId(null);
    }
  };

  // ── Derived ──

  const segmentsTotalPages = Math.max(1, Math.ceil(segments.length / segmentsListPageSize) || 1);
  const segmentsSafePage = Math.min(Math.max(1, segmentsListPage), segmentsTotalPages);
  const paginatedSegments = segments.slice(
    (segmentsSafePage - 1) * segmentsListPageSize,
    segmentsSafePage * segmentsListPageSize
  );

  const engagementData =
    platform.engagement_distribution?.length > 0
      ? platform.engagement_distribution
      : [{ range: "—", users: 0 }];

  const segmentDistribution = (() => {
    const rows = segments
      .map((seg) => ({ name: seg.name, users: seg.userCount, color: seg.color }))
      .filter((r) => Number.isFinite(r.users) && r.users > 0);
    rows.sort((a, b) => b.users - a.users);
    const TOP_N = 10;
    const top = rows.slice(0, TOP_N);
    const rest = rows.slice(TOP_N);
    const otherUsers = rest.reduce((sum, r) => sum + r.users, 0);
    return otherUsers > 0
      ? [...top, { name: `Other (${rest.length})`, users: otherUsers, color: "#94a3b8" }]
      : top;
  })();

  const stats = {
    totalEndUsers: platform.total_end_users,
    totalSegments: platform.total_segments || segments.length,
    avgEngagement: platform.avg_engagement_pct,
    premiumUsers: platform.premium_users,
  };

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Loading skeleton */}
        {isLoading && (
          <div className="animate-pulse space-y-6 mb-2" aria-hidden>
            <div className="h-10 bg-gray-200 rounded-lg w-64 max-w-full" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 bg-gray-100 rounded-2xl" />)}
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
                setCreateFormData({ name: "", description: "", color: "#3b82f6" });
                setShowCreateModal(true);
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center gap-2 shadow-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Create Segment
            </motion.button>
          </motion.div>

          {loadError && (
            <div
              className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between"
              role="alert"
            >
              <span>{loadError}</span>
              <button
                type="button"
                className="shrink-0 rounded-lg border border-red-300 bg-white px-3 py-1.5 font-medium text-red-800 hover:bg-red-100"
                onClick={() => void fetchSegments()}
              >
                Retry
              </button>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Users, gradient: "from-blue-500 to-indigo-600", label: "Total profiles", value: stats.totalEndUsers.toLocaleString(), sub: 'Matches main admin "Total Users"' },
              { icon: Target, gradient: "from-purple-500 to-pink-600", label: "Segments", value: String(stats.totalSegments), sub: null },
              { icon: Activity, gradient: "from-green-500 to-emerald-600", label: "Avg Engagement", value: `${stats.avgEngagement}%`, sub: null },
              { icon: DollarSign, gradient: "from-blue-500 to-indigo-600", label: "Premium users", value: stats.premiumUsers.toLocaleString(), sub: "Grow / Thrive, active or trialing", highlight: true },
            ].map(({ icon: Icon, gradient, label, value, sub, highlight }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className={`bg-white rounded-2xl p-6 shadow-lg border ${highlight ? "border-2 border-blue-200" : "border-gray-100"}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient}`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">{label}</p>
                    <p className={`text-2xl font-bold ${highlight ? "text-blue-600" : "text-gray-900"}`}>{value}</p>
                    {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-6">Segment Distribution</h2>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={segmentDistribution}
                  layout="vertical"
                  margin={{ top: 8, right: 12, bottom: 8, left: 12 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" stroke="#6b7280" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke="#6b7280" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px" }}
                    formatter={(value) => [`${value}`, "Users"]}
                  />
                  <Bar dataKey="users" radius={[0, 8, 8, 0]} isAnimationActive={false}>
                    {segmentDistribution.map((entry, idx) => (
                      <Cell key={`seg-bar-${idx}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-3 text-xs text-gray-500">
                Showing top segments by users{segments.length > 10 ? " (rest grouped as Other)" : ""}.
              </p>
            </motion.div>

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
                  <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px" }} />
                  <Bar dataKey="users" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          </div>

          {/* Segments list */}
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

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h3 className="font-bold text-gray-900 text-lg">{segment.name}</h3>
                            <span
                              className="px-3 py-1 rounded-lg text-sm font-bold text-white"
                              style={{ backgroundColor: segment.color }}
                            >
                              {segment.userCount} users
                            </span>
                          </div>

                          {segment.description && (
                            <p className="text-gray-600 mb-3 text-sm">{segment.description}</p>
                          )}

                          {/* Metrics */}
                          <div className="grid grid-cols-3 gap-3 mb-3">
                            {[
                              { icon: Activity, label: "Engagement", value: `${segment.engagement}%` },
                              { icon: TrendingUp, label: "Conversion", value: `${segment.conversionRate}%` },
                              { icon: Clock, label: "Avg Session", value: `${segment.avgSessionLength}m` },
                            ].map(({ icon: Icon, label, value }) => (
                              <div key={label} className="bg-gray-50 rounded-lg p-3">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <Icon className="w-3.5 h-3.5 text-gray-500" />
                                  <p className="text-xs text-gray-500">{label}</p>
                                </div>
                                <p className="font-bold text-gray-900 text-sm">{value}</p>
                              </div>
                            ))}
                          </div>

                          {/* Criteria */}
                          {segment.criteria.length > 0 && (
                            <div className="bg-gray-50 rounded-lg p-3 mb-3">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Criteria</p>
                              <div className="flex flex-wrap gap-2">
                                {segment.criteria.map((criterion, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-gray-200 text-xs text-gray-700"
                                  >
                                    <Filter className="w-3 h-3 text-gray-400" />
                                    {formatSegmentRuleLabel(criterion)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                              <Calendar className="w-3 h-3" />
                              Created {segment.createdAt.toLocaleDateString()}
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium flex items-center gap-1.5"
                                onClick={() => {
                                  setViewingSegment(segment);
                                  setSegmentUsersPage(1);
                                  setSegmentUsersPayload(null);
                                  setShowViewUsersModal(true);
                                }}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                View Users
                              </motion.button>

                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="px-3 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-xs font-medium flex items-center gap-1.5"
                                onClick={() => {
                                  setCampaignSegment(segment);
                                  setShowCampaignModal(true);
                                }}
                              >
                                <Zap className="w-3.5 h-3.5" />
                                Campaign
                              </motion.button>

                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700 text-xs font-medium flex items-center gap-1.5"
                                onClick={() => openEditModal(segment)}
                              >
                                <Edit className="w-3.5 h-3.5" />
                                Edit
                              </motion.button>

                              <motion.button
                                type="button"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                disabled={deletingSegmentId === segment.id}
                                className="px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 text-xs font-medium flex items-center gap-1.5 disabled:opacity-60"
                                onClick={() => setSegmentToDelete(segment)}
                              >
                                {deletingSegmentId === segment.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                                Delete
                              </motion.button>
                            </div>
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

        {/* ── Delete confirmation dialog ─────────────────────────────────── */}
        <AnimatePresence>
          {segmentToDelete && (
            <ModalShell onClose={() => setSegmentToDelete(null)} maxWidth="max-w-md">
              <div className="p-6">
                <div className="flex items-start gap-4 mb-5">
                  <div className="flex-shrink-0 w-11 h-11 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Delete segment?</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      <span className="font-medium">"{segmentToDelete.name}"</span> will be permanently deleted. This cannot be undone.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSegmentToDelete(null)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirmDelete()}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-sm flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            </ModalShell>
          )}
        </AnimatePresence>

        {/* ── Create segment modal ───────────────────────────────────────── */}
        <AnimatePresence>
          {showCreateModal && (
            <ModalShell onClose={() => !creatingSegment && setShowCreateModal(false)}>
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
                <h3 className="text-xl font-bold text-gray-900">Create Segment</h3>
                <button
                  type="button"
                  onClick={() => !creatingSegment && setShowCreateModal(false)}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-6 py-5 overflow-y-auto max-h-[calc(90vh-160px)]">
                <SegmentFormBody
                  formData={createFormData}
                  setFormData={setCreateFormData}
                  filters={createFilters}
                  setFilters={setCreateFilters}
                />
              </div>
              <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
                <button
                  type="button"
                  disabled={creatingSegment}
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={creatingSegment}
                  onClick={() => void handleCreate()}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium text-sm inline-flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {creatingSegment && <Loader2 className="w-4 h-4 animate-spin" />}
                  {creatingSegment ? "Creating…" : "Create Segment"}
                </button>
              </div>
            </ModalShell>
          )}
        </AnimatePresence>

        {/* ── Edit segment modal ─────────────────────────────────────────── */}
        <AnimatePresence>
          {editingSegment && (
            <ModalShell onClose={() => !savingEdit && setEditingSegment(null)}>
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
                <h3 className="text-xl font-bold text-gray-900">Edit Segment</h3>
                <button
                  type="button"
                  onClick={() => !savingEdit && setEditingSegment(null)}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-6 py-5 overflow-y-auto max-h-[calc(90vh-160px)]">
                <SegmentFormBody
                  formData={editFormData}
                  setFormData={setEditFormData}
                  filters={editFilters}
                  setFilters={setEditFilters}
                />
              </div>
              <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={() => setEditingSegment(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={() => void handleEdit()}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium text-sm inline-flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {savingEdit && <Loader2 className="w-4 h-4 animate-spin" />}
                  {savingEdit ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </ModalShell>
          )}
        </AnimatePresence>

        {/* ── View Users modal ───────────────────────────────────────────── */}
        <AnimatePresence>
          {showViewUsersModal && viewingSegment && (
            <ModalShell onClose={() => setShowViewUsersModal(false)}>
              <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-gray-100">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Users in {viewingSegment.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {segmentUsersPayload != null
                      ? `${segmentUsersPayload.total.toLocaleString()} matching user${segmentUsersPayload.total === 1 ? "" : "s"}`
                      : "Loading…"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowViewUsersModal(false)}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {segmentUsersError && (
                <p className="text-sm text-red-600 px-6 pt-3">{segmentUsersError}</p>
              )}

              <div className="overflow-y-auto" style={{ maxHeight: "50vh" }}>
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
                          <td className="px-4 py-2.5 text-gray-900">{u.full_name?.trim() || "—"}</td>
                          <td className="px-4 py-2.5 text-gray-700 break-all">{u.email || "—"}</td>
                          <td className="px-4 py-2.5 text-gray-700">{u.age ?? "—"}</td>
                          <td className="px-4 py-2.5 text-gray-700">
                            {u.plan_type
                              ? { pro: "Thrive", core: "Grow", trial: "Discover" }[u.plan_type] ?? u.plan_type
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </div>

              {segmentUsersPayload && segmentUsersPayload.pages > 1 && (
                <div className="flex items-center justify-between gap-3 px-6 py-3 border-t border-gray-100">
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
                      disabled={segmentUsersLoading || !segmentUsersPayload || segmentUsersPage >= segmentUsersPayload.pages}
                      onClick={() => setSegmentUsersPage((p) => p + 1)}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              <div className="px-6 pb-5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowViewUsersModal(false)}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium text-sm"
                >
                  Close
                </button>
              </div>
            </ModalShell>
          )}
        </AnimatePresence>

        {/* ── Campaign modal (placeholder) ───────────────────────────────── */}
        <AnimatePresence>
          {showCampaignModal && campaignSegment && (
            <ModalShell onClose={() => setShowCampaignModal(false)} maxWidth="max-w-lg">
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Send Campaign</h3>
                  <p className="text-sm text-gray-500 mt-0.5">To: {campaignSegment.name} ({campaignSegment.userCount} users)</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCampaignModal(false)}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-6 py-5">
                <p className="text-sm text-gray-500">Campaign functionality coming soon.</p>
              </div>
              <div className="px-6 pb-5">
                <button
                  type="button"
                  onClick={() => setShowCampaignModal(false)}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium text-sm"
                >
                  Close
                </button>
              </div>
            </ModalShell>
          )}
        </AnimatePresence>

      </div>
    </AdminLayoutNew>
  );
}
