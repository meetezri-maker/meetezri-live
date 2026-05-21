import { motion, AnimatePresence } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Trophy, Target, Users, TrendingUp, Calendar, Plus, Edit, Play, Pause,
  CheckCircle, Award, Heart, Zap, Moon, Coffee, Book, Footprints, Smile,
  X, Save, BarChart3, Eye, Star, Crown, Loader2, Trash2, RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from "recharts";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { api } from "@/lib/api";
import { toast } from "sonner";

// ─── Shared types ─────────────────────────────────────────────────────────────

interface Challenge {
  id: string;
  name: string;
  description: string;
  category: "mindfulness" | "exercise" | "sleep" | "journaling" | "social" | "habits";
  status: "active" | "draft" | "completed" | "scheduled";
  startDate: Date;
  endDate: Date;
  participants: number;
  completionRate: number;
  goal: string;
  difficulty: "easy" | "medium" | "hard";
  rewards: { points: number; badge?: string };
  dailyTasks: string[];
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  iconUrl: string;
  criteria: unknown;
  points: number;
  level: number;
  maxLevel: number;
  createdAt: string;
  earnedCount: number;
}

// ─── Challenges helpers ────────────────────────────────────────────────────────

const getChallengeIcon = (category: string) => {
  switch (category) {
    case "mindfulness": return Heart;
    case "exercise": return Footprints;
    case "sleep": return Moon;
    case "journaling": return Book;
    case "social": return Users;
    case "habits": return Coffee;
    default: return Target;
  }
};

const getChallengeGradient = (category: string) => {
  switch (category) {
    case "mindfulness": return "from-purple-500 to-pink-600";
    case "exercise": return "from-green-500 to-emerald-600";
    case "sleep": return "from-blue-500 to-indigo-600";
    case "journaling": return "from-yellow-500 to-orange-600";
    case "social": return "from-red-500 to-rose-600";
    case "habits": return "from-gray-500 to-slate-600";
    default: return "from-blue-500 to-indigo-600";
  }
};

const deriveChallengeStatus = (goalCriteria: unknown, start: Date, end: Date, now: Date = new Date()): Challenge["status"] => {
  const gc = goalCriteria && typeof goalCriteria === "object" ? (goalCriteria as Record<string, unknown>) : {};
  const explicit = typeof gc.status === "string" ? gc.status : "";
  if (explicit === "draft") return "draft";
  if (explicit === "completed") return "completed";
  if (explicit === "scheduled") { if (now < start) return "scheduled"; if (now > end) return "completed"; return "active"; }
  if (explicit === "active") { if (now > end) return "completed"; return "active"; }
  if (now < start) return "scheduled";
  if (now > end) return "completed";
  return "active";
};

const mapApiChallenge = (c: any): Challenge => {
  const meta = (c.goal_criteria || {}) as Record<string, unknown>;
  const startDate = new Date(c.start_date);
  const endDate = new Date(c.end_date);
  const rawCat = String(c.category || "mindfulness").toLowerCase();
  const category = (["mindfulness","exercise","sleep","journaling","social","habits"].includes(rawCat) ? rawCat : "mindfulness") as Challenge["category"];
  return {
    id: c.id, name: c.title, description: c.description || "",
    category,
    status: deriveChallengeStatus(c.goal_criteria, startDate, endDate),
    startDate, endDate,
    participants: c.participants ?? 0,
    completionRate: c.completionRate ?? 0,
    goal: typeof meta.goal === "string" ? meta.goal : "",
    difficulty: (meta.difficulty as Challenge["difficulty"]) || "easy",
    rewards: { points: c.reward_points ?? 0, badge: typeof meta.badge === "string" ? meta.badge : undefined },
    dailyTasks: Array.isArray(meta.dailyTasks) ? (meta.dailyTasks as string[]) : [],
  };
};

const statusBadge = (s: string) => {
  if (s === "active") return "bg-green-100 text-green-700";
  if (s === "scheduled") return "bg-blue-100 text-blue-700";
  if (s === "completed") return "bg-gray-100 text-gray-700";
  return "bg-yellow-100 text-yellow-700";
};

const difficultyBadge = (d: string) => {
  if (d === "easy") return "bg-green-100 text-green-700";
  if (d === "medium") return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
};

// ─── Achievement helpers ───────────────────────────────────────────────────────

const ACH_ICON_MAP: Record<string, React.ElementType> = {
  achievement: Trophy, milestone: Target, special: Star, streak: Zap,
  challenge: Crown, sessions: Trophy, mood: Star, journal: Award,
  social: Users, wellness: TrendingUp,
};
const ACH_COLOR_MAP: Record<string, string> = {
  achievement: "from-yellow-500 to-orange-600", milestone: "from-blue-500 to-indigo-600",
  special: "from-purple-500 to-pink-600", streak: "from-orange-500 to-red-600",
  challenge: "from-emerald-500 to-teal-600", sessions: "from-cyan-500 to-blue-600",
  mood: "from-rose-400 to-pink-600", journal: "from-violet-500 to-purple-600",
  social: "from-green-500 to-emerald-600", wellness: "from-teal-500 to-cyan-600",
};
const ACH_CATEGORIES = ["achievement","milestone","special","streak","challenge","sessions","mood","journal","social","wellness"];
const achIcon = (c: string): React.ElementType => ACH_ICON_MAP[c] ?? Award;
const achColor = (c: string): string => ACH_COLOR_MAP[c] ?? "from-slate-500 to-slate-700";

function SkeletonCard() {
  return (
    <div className="border-2 border-gray-200 rounded-xl p-5 animate-pulse">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-14 h-14 rounded-xl bg-gray-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
      <div className="h-3 bg-gray-200 rounded w-full mb-2" />
      <div className="grid grid-cols-2 gap-2"><div className="h-10 bg-gray-200 rounded-lg" /><div className="h-10 bg-gray-200 rounded-lg" /></div>
    </div>
  );
}

// ─── ChallengesTab ─────────────────────────────────────────────────────────────

function ChallengesTab() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [enrollmentTrend, setEnrollmentTrend] = useState<{ month: string; participants: number }[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [viewStatsModal, setViewStatsModal] = useState<Challenge | null>(null);
  const [editModal, setEditModal] = useState<Challenge | null>(null);
  const [challengeActionId, setChallengeActionId] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Create form
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createCategory, setCreateCategory] = useState<Challenge["category"]>("mindfulness");
  const [createDifficulty, setCreateDifficulty] = useState<Challenge["difficulty"]>("easy");
  const [createStatus, setCreateStatus] = useState<Challenge["status"]>("draft");
  const [createStart, setCreateStart] = useState("");
  const [createEnd, setCreateEnd] = useState("");
  const [createRewardPoints, setCreateRewardPoints] = useState(100);
  const [createBadge, setCreateBadge] = useState("");
  const [createGoal, setCreateGoal] = useState("");
  const [createDailyTasks, setCreateDailyTasks] = useState("");

  type EditFormState = {
    name: string; description: string; category: Challenge["category"];
    difficulty: Challenge["difficulty"]; status: Challenge["status"];
    rewardPoints: number; badge: string; goal: string;
    startDate: string; endDate: string; dailyTasks: string;
  };
  const [editForm, setEditForm] = useState<EditFormState | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await api.wellness.getChallenges();
      let list: unknown[] = [];
      let trend: { month: string; participants: number }[] = [];
      if (Array.isArray(data)) { list = data; }
      else if (data && typeof data === "object") {
        const o = data as { challenges?: unknown[]; enrollmentTrend?: { month: string; participants: number }[] };
        if (Array.isArray(o.challenges)) list = o.challenges;
        if (Array.isArray(o.enrollmentTrend)) trend = o.enrollmentTrend;
      }
      setChallenges(list.map(mapApiChallenge));
      setEnrollmentTrend(trend);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load challenges");
    } finally { setIsLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!editModal) { setEditForm(null); return; }
    setEditForm({
      name: editModal.name, description: editModal.description,
      category: editModal.category, difficulty: editModal.difficulty,
      status: editModal.status, rewardPoints: editModal.rewards.points,
      badge: editModal.rewards.badge || "", goal: editModal.goal,
      startDate: editModal.startDate.toISOString().slice(0, 10),
      endDate: editModal.endDate.toISOString().slice(0, 10),
      dailyTasks: editModal.dailyTasks.join("\n"),
    });
  }, [editModal]);

  const resetCreate = () => {
    const today = new Date();
    const end = new Date(today); end.setDate(end.getDate() + 14);
    setCreateName(""); setCreateDesc(""); setCreateCategory("mindfulness");
    setCreateDifficulty("easy"); setCreateStatus("draft");
    setCreateStart(today.toISOString().slice(0, 10));
    setCreateEnd(end.toISOString().slice(0, 10));
    setCreateRewardPoints(100); setCreateBadge(""); setCreateGoal(""); setCreateDailyTasks("");
  };

  const handleCreate = async () => {
    if (!createName.trim()) { toast.error("Name is required"); return; }
    if (!createStart || !createEnd) { toast.error("Start and end dates are required"); return; }
    const s = new Date(createStart); const e = new Date(createEnd);
    if (e < s) { toast.error("End date must be after start date"); return; }
    setIsCreating(true);
    try {
      const created = await api.wellness.createChallenge({
        title: createName.trim(), description: createDesc.trim() || null,
        category: createCategory, start_date: s.toISOString(), end_date: e.toISOString(),
        reward_points: createRewardPoints,
        goal_criteria: {
          status: createStatus, difficulty: createDifficulty, goal: createGoal.trim(),
          dailyTasks: createDailyTasks.split("\n").map(t => t.trim()).filter(Boolean),
          badge: createBadge.trim() || undefined,
        },
      });
      setChallenges(prev => [mapApiChallenge(created), ...prev]);
      toast.success("Challenge created");
      setShowCreateModal(false); resetCreate();
    } catch (e: any) { toast.error(e?.message || "Failed to create challenge"); }
    finally { setIsCreating(false); }
  };

  const handleSaveEdit = async () => {
    if (!editModal || !editForm) return;
    const s = new Date(editForm.startDate); const e = new Date(editForm.endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) { toast.error("Invalid dates"); return; }
    if (e < s) { toast.error("End must be after start"); return; }
    if (!editForm.name.trim()) { toast.error("Name is required"); return; }
    setIsSavingEdit(true);
    try {
      const raw = await api.wellness.updateChallenge(editModal.id, {
        title: editForm.name.trim(), description: editForm.description.trim() || null,
        category: editForm.category, start_date: s.toISOString(), end_date: e.toISOString(),
        reward_points: editForm.rewardPoints,
        goal_criteria: {
          status: editForm.status, difficulty: editForm.difficulty, goal: editForm.goal.trim(),
          dailyTasks: editForm.dailyTasks.split("\n").map(t => t.trim()).filter(Boolean),
          ...(editForm.badge.trim() ? { badge: editForm.badge.trim() } : { badge: null }),
        },
      });
      setChallenges(prev => prev.map(c => c.id === editModal.id ? mapApiChallenge(raw) : c));
      toast.success("Challenge updated"); setEditModal(null);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed to save"); }
    finally { setIsSavingEdit(false); }
  };

  const handleToggleStatus = async (ch: Challenge) => {
    const next = ch.status === "active" ? "draft" : "active";
    setChallengeActionId(ch.id);
    try {
      const raw = await api.wellness.updateChallenge(ch.id, { goal_criteria: { ...ch, status: next } });
      setChallenges(prev => prev.map(c => c.id === ch.id ? mapApiChallenge(raw) : c));
      toast.success(`Challenge ${next === "active" ? "activated" : "paused"}`);
    } catch (e: any) { toast.error(e?.message || "Failed to update"); }
    finally { setChallengeActionId(null); }
  };

  const stats = {
    active: challenges.filter(c => c.status === "active").length,
    total: challenges.length,
    participants: challenges.reduce((s, c) => s + (c.participants || 0), 0),
    avgCompletion: challenges.length ? Math.round(challenges.reduce((s, c) => s + (c.completionRate || 0), 0) / challenges.length) : 0,
  };

  const fallbackTrend = useMemo(() => {
    const map = new Map<string, { month: string; participants: number; key: string }>();
    challenges.forEach(c => {
      const d = c.startDate;
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,"0")}`;
      const existing = map.get(key) || { month: d.toLocaleString("default",{month:"short"}), participants: 0, key };
      existing.participants += c.participants;
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a,b) => a.key.localeCompare(b.key)).map(({month,participants}) => ({month,participants}));
  }, [challenges]);

  const trendData = enrollmentTrend.length > 0 ? enrollmentTrend : fallbackTrend;

  const categoryData = useMemo(() => {
    const map = new Map<string, { category: string; participants: number }>();
    challenges.forEach(c => {
      const label = c.category.charAt(0).toUpperCase() + c.category.slice(1);
      const existing = map.get(c.category) || { category: label, participants: 0 };
      existing.participants += c.participants;
      map.set(c.category, existing);
    });
    return Array.from(map.values());
  }, [challenges]);

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Wellness Challenges</h2>
          <p className="text-gray-600 mt-1 text-sm">Create and manage challenges for your users</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={isLoading} className="gap-1.5">
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white" onClick={() => { resetCreate(); setShowCreateModal(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Create Challenge
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active", value: stats.active, icon: Play, color: "from-green-500 to-emerald-600", border: "border-green-200" },
          { label: "Total Challenges", value: stats.total, icon: Trophy, color: "from-blue-500 to-indigo-600", border: "border-gray-100" },
          { label: "Participants", value: stats.participants.toLocaleString(), icon: Users, color: "from-purple-500 to-pink-600", border: "border-gray-100" },
          { label: "Avg Completion", value: `${stats.avgCompletion}%`, icon: CheckCircle, color: "from-orange-500 to-amber-600", border: "border-gray-100" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className={`p-5 border-2 ${s.border}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${s.color}`}><Icon className="w-5 h-5 text-white" /></div>
                <div><p className="text-gray-600 text-xs">{s.label}</p><p className="text-xl font-bold text-gray-900">{isLoading ? "—" : s.value}</p></div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      {(trendData.length > 0 || categoryData.length > 0) && (
        <div className="grid lg:grid-cols-2 gap-6">
          {trendData.length > 0 && (
            <Card className="p-5">
              <h3 className="font-bold text-gray-900 mb-4">Participation Trend</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="participants" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6" }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}
          {categoryData.length > 0 && (
            <Card className="p-5">
              <h3 className="font-bold text-gray-900 mb-4">Participation by Category</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="participants" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </div>
      )}

      {/* Challenges grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : challenges.length === 0 ? (
        <Card className="p-12 text-center">
          <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-600">No challenges yet</p>
          <p className="text-sm text-gray-400 mt-1">Create your first wellness challenge above.</p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {challenges.map((ch, i) => {
            const Icon = getChallengeIcon(ch.category);
            const isSelected = selectedChallenge?.id === ch.id;
            return (
              <motion.div key={ch.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
                onClick={() => setSelectedChallenge(isSelected ? null : ch)}
                className={`border-2 rounded-xl p-5 cursor-pointer transition-all ${isSelected ? "border-blue-500 bg-blue-50 shadow-md" : "border-gray-200 hover:border-gray-300 hover:shadow-md bg-white"}`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${getChallengeGradient(ch.category)} shrink-0`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{ch.name}</h3>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge(ch.status)}`}>{ch.status}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${difficultyBadge(ch.difficulty)}`}>{ch.difficulty}</span>
                    </div>
                  </div>
                </div>
                {ch.description && <p className="text-sm text-gray-600 mb-3 line-clamp-2">{ch.description}</p>}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-blue-50 rounded-lg p-2">
                    <p className="text-xs text-blue-600">Participants</p>
                    <p className="font-bold text-blue-700">{ch.participants}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2">
                    <p className="text-xs text-green-600">Points</p>
                    <p className="font-bold text-green-700">{ch.rewards.points}</p>
                  </div>
                </div>
                <AnimatePresence>
                  {isSelected && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      className="mt-3 pt-3 border-t border-gray-200 space-y-2"
                    >
                      <p className="text-xs text-gray-500">
                        {ch.startDate.toLocaleDateString()} – {ch.endDate.toLocaleDateString()}
                      </p>
                      <div className="flex gap-2">
                        <button onClick={e => { e.stopPropagation(); setEditModal(ch); }}
                          className="flex-1 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium flex items-center justify-center gap-1">
                          <Edit className="w-3 h-3" /> Edit
                        </button>
                        <button onClick={e => { e.stopPropagation(); setViewStatsModal(ch); }}
                          className="flex-1 px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-medium flex items-center justify-center gap-1">
                          <Eye className="w-3 h-3" /> Stats
                        </button>
                        <button onClick={e => { e.stopPropagation(); handleToggleStatus(ch); }} disabled={challengeActionId === ch.id}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 disabled:opacity-50 ${ch.status === "active" ? "bg-yellow-100 hover:bg-yellow-200 text-yellow-700" : "bg-green-100 hover:bg-green-200 text-green-700"}`}>
                          {challengeActionId === ch.id ? <Loader2 className="w-3 h-3 animate-spin" /> : ch.status === "active" ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
            onClick={() => setShowCreateModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold">New Challenge</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(false)}><X className="w-4 h-4" /></Button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <Input placeholder="e.g., 7-Day Mindfulness" value={createName} onChange={e => setCreateName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" value={createDesc} onChange={e => setCreateDesc(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select className="w-full px-3 py-2 border rounded-lg text-sm" value={createCategory} onChange={e => setCreateCategory(e.target.value as Challenge["category"])}>
                      {["mindfulness","exercise","sleep","journaling","social","habits"].map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                    <select className="w-full px-3 py-2 border rounded-lg text-sm" value={createDifficulty} onChange={e => setCreateDifficulty(e.target.value as Challenge["difficulty"])}>
                      <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <Input type="date" value={createStart} onChange={e => setCreateStart(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <Input type="date" value={createEnd} onChange={e => setCreateEnd(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reward Points</label>
                    <Input type="number" min={0} value={createRewardPoints} onChange={e => setCreateRewardPoints(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Badge Name</label>
                    <Input placeholder="Optional" value={createBadge} onChange={e => setCreateBadge(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Goal</label>
                  <Input placeholder="What should users achieve?" value={createGoal} onChange={e => setCreateGoal(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Daily Tasks (one per line)</label>
                  <textarea rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" value={createDailyTasks} onChange={e => setCreateDailyTasks(e.target.value)} placeholder="5-minute breathing exercise&#10;Journal entry&#10;..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select className="w-full px-3 py-2 border rounded-lg text-sm" value={createStatus} onChange={e => setCreateStatus(e.target.value as Challenge["status"])}>
                    <option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="active">Active</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="flex-1" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                <Button className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white" disabled={isCreating} onClick={handleCreate}>
                  {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />} Create
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editModal && editForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
            onClick={() => setEditModal(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold">Edit Challenge</h3>
                <Button variant="ghost" size="sm" onClick={() => setEditModal(null)}><X className="w-4 h-4" /></Button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select className="w-full px-3 py-2 border rounded-lg text-sm" value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value as Challenge["category"] })}>
                      {["mindfulness","exercise","sleep","journaling","social","habits"].map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                    <select className="w-full px-3 py-2 border rounded-lg text-sm" value={editForm.difficulty} onChange={e => setEditForm({ ...editForm, difficulty: e.target.value as Challenge["difficulty"] })}>
                      <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <Input type="date" value={editForm.startDate} onChange={e => setEditForm({ ...editForm, startDate: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <Input type="date" value={editForm.endDate} onChange={e => setEditForm({ ...editForm, endDate: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reward Points</label>
                    <Input type="number" min={0} value={editForm.rewardPoints} onChange={e => setEditForm({ ...editForm, rewardPoints: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Badge Name</label>
                    <Input value={editForm.badge} onChange={e => setEditForm({ ...editForm, badge: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Goal</label>
                  <Input value={editForm.goal} onChange={e => setEditForm({ ...editForm, goal: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Daily Tasks (one per line)</label>
                  <textarea rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" value={editForm.dailyTasks} onChange={e => setEditForm({ ...editForm, dailyTasks: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select className="w-full px-3 py-2 border rounded-lg text-sm" value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value as Challenge["status"] })}>
                    <option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="active">Active</option><option value="completed">Completed</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="flex-1" onClick={() => setEditModal(null)}>Cancel</Button>
                <Button className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white" disabled={isSavingEdit} onClick={handleSaveEdit}>
                  {isSavingEdit ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Save
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Modal */}
      <AnimatePresence>
        {viewStatsModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
            onClick={() => setViewStatsModal(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md p-6 rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold">Challenge Stats</h3>
                <Button variant="ghost" size="sm" onClick={() => setViewStatsModal(null)}><X className="w-4 h-4" /></Button>
              </div>
              <div className="space-y-4">
                <div className={`flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br ${getChallengeGradient(viewStatsModal.category)}`}>
                  {(() => { const Icon = getChallengeIcon(viewStatsModal.category); return <Icon className="w-8 h-8 text-white" />; })()}
                  <div>
                    <h4 className="text-xl font-bold text-white">{viewStatsModal.name}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded bg-white/30 text-white`}>{viewStatsModal.category}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-center">
                    <p className="text-2xl font-bold text-blue-600">{viewStatsModal.participants}</p>
                    <p className="text-xs text-gray-600">Participants</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-center">
                    <p className="text-2xl font-bold text-green-600">{viewStatsModal.completionRate}%</p>
                    <p className="text-xs text-gray-600">Completion</p>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-center">
                    <p className="text-2xl font-bold text-yellow-600">{viewStatsModal.rewards.points}</p>
                    <p className="text-xs text-gray-600">Points</p>
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Duration</p>
                  <p className="text-sm font-medium">{viewStatsModal.startDate.toLocaleDateString()} – {viewStatsModal.endDate.toLocaleDateString()}</p>
                </div>
                {viewStatsModal.goal && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">Goal</p>
                    <p className="text-sm">{viewStatsModal.goal}</p>
                  </div>
                )}
                <Button variant="outline" className="w-full" onClick={() => setViewStatsModal(null)}>Close</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── BadgesTab ─────────────────────────────────────────────────────────────────

function BadgesTab() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAch, setSelectedAch] = useState<Achievement | null>(null);
  const [editModal, setEditModal] = useState<Achievement | null>(null);
  const [viewStatsModal, setViewStatsModal] = useState<Achievement | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("achievement");
  const [newPoints, setNewPoints] = useState(50);
  const [newLevel, setNewLevel] = useState(1);
  const [newMaxLevel, setNewMaxLevel] = useState(5);

  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCategory, setEditCategory] = useState("achievement");
  const [editPoints, setEditPoints] = useState(0);
  const [editLevel, setEditLevel] = useState(1);
  const [editMaxLevel, setEditMaxLevel] = useState(5);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.admin.getAchievements();
      setAchievements(data.achievements);
      setTotalUsers(data.totalUsers);
    } catch { toast.error("Failed to load achievements"); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (a: Achievement) => {
    setEditModal(a); setEditName(a.name); setEditDesc(a.description);
    setEditCategory(a.category); setEditPoints(a.points); setEditLevel(a.level); setEditMaxLevel(a.maxLevel);
  };

  const resetCreate = () => {
    setNewName(""); setNewDesc(""); setNewCategory("achievement"); setNewPoints(50); setNewLevel(1); setNewMaxLevel(5);
  };

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      const created = await api.admin.createAchievement({ name: newName.trim(), description: newDesc.trim() || undefined, category: newCategory, points: newPoints, level: newLevel, maxLevel: newMaxLevel });
      setAchievements(prev => [created as Achievement, ...prev]);
      setShowCreateModal(false); resetCreate();
      toast.success("Achievement created");
    } catch { toast.error("Failed to create achievement"); }
    finally { setSaving(false); }
  };

  const handleSaveEdit = async () => {
    if (!editModal) return;
    if (!editName.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      const updated = await api.admin.updateAchievement(editModal.id, { name: editName.trim(), description: editDesc.trim() || undefined, category: editCategory, points: editPoints, level: editLevel, maxLevel: editMaxLevel });
      setAchievements(prev => prev.map(a => a.id === editModal.id ? { ...a, ...(updated as Achievement) } : a));
      setEditModal(null);
      toast.success("Achievement updated");
    } catch { toast.error("Failed to update"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await api.admin.deleteAchievement(id);
      setAchievements(prev => prev.filter(a => a.id !== id));
      setSelectedAch(null);
      toast.success("Achievement deleted");
    } catch { toast.error("Failed to delete"); }
    finally { setDeleting(null); }
  };

  const stats = {
    total: achievements.length,
    earned: achievements.reduce((s, a) => s + a.earnedCount, 0),
    withPoints: achievements.filter(a => a.points > 0).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Achievement Manager</h2>
          <p className="text-gray-600 text-sm mt-1">{totalUsers.toLocaleString()} registered users</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={isLoading} className="gap-1.5">
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white" onClick={() => { resetCreate(); setShowCreateModal(true); }}>
            <Plus className="w-4 h-4 mr-2" /> New Achievement
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Achievements", value: stats.total, icon: Award, color: "from-blue-500 to-indigo-600" },
          { label: "Times Earned", value: stats.earned.toLocaleString(), icon: CheckCircle, color: "from-green-500 to-emerald-600" },
          { label: "With Points", value: stats.withPoints, icon: Star, color: "from-yellow-500 to-orange-600" },
          { label: "Registered Users", value: totalUsers.toLocaleString(), icon: Users, color: "from-purple-500 to-pink-600" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="p-5">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${s.color}`}><Icon className="w-5 h-5 text-white" /></div>
                <div><p className="text-gray-600 text-xs">{s.label}</p><p className="text-xl font-bold text-gray-900">{isLoading ? "—" : s.value}</p></div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Achievements grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : achievements.length === 0 ? (
        <Card className="p-12 text-center">
          <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-600">No achievements yet</p>
          <p className="text-sm text-gray-400 mt-1">Create your first achievement using the button above.</p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {achievements.map((ach, index) => {
            const Icon = achIcon(ach.category);
            const isSelected = selectedAch?.id === ach.id;
            const earnRate = totalUsers > 0 ? ((ach.earnedCount / totalUsers) * 100).toFixed(1) : "0";
            return (
              <motion.div key={ach.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 + index * 0.04 }}
                onClick={() => setSelectedAch(isSelected ? null : ach)}
                className={`border-2 rounded-xl p-5 cursor-pointer transition-all ${isSelected ? "border-blue-500 bg-blue-50 shadow-md" : "border-gray-200 hover:border-gray-300 hover:shadow-md bg-white"}`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${achColor(ach.category)} shrink-0`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{ach.name}</h3>
                    <span className="inline-block mt-0.5 px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs capitalize">{ach.category}</span>
                  </div>
                </div>
                {ach.description && <p className="text-sm text-gray-600 mb-3 line-clamp-2">{ach.description}</p>}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-blue-50 rounded-lg p-2"><p className="text-xs text-blue-600">Points</p><p className="font-bold text-blue-700">{ach.points}</p></div>
                  <div className="bg-purple-50 rounded-lg p-2"><p className="text-xs text-purple-600">Earned by</p><p className="font-bold text-purple-700">{ach.earnedCount} users</p></div>
                </div>
                {ach.maxLevel > 1 && <p className="mt-2 text-xs text-gray-500">Level {ach.level} / {ach.maxLevel}</p>}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                      <p className="text-xs text-gray-500">Earn rate: <span className="font-semibold text-gray-700">{earnRate}%</span></p>
                      <div className="flex gap-2">
                        <button onClick={e => { e.stopPropagation(); openEdit(ach); }}
                          className="flex-1 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium flex items-center justify-center gap-1">
                          <Edit className="w-3 h-3" /> Edit
                        </button>
                        <button onClick={e => { e.stopPropagation(); setViewStatsModal(ach); }}
                          className="flex-1 px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-medium flex items-center justify-center gap-1">
                          <Eye className="w-3 h-3" /> Stats
                        </button>
                        <button disabled={deleting === ach.id} onClick={e => { e.stopPropagation(); handleDelete(ach.id); }}
                          className="px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 text-xs font-medium flex items-center justify-center gap-1 disabled:opacity-50">
                          {deleting === ach.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
            onClick={() => setShowCreateModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()} className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold">New Achievement</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(false)}><X className="w-4 h-4" /></Button>
              </div>
              <div className="space-y-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Name *</label><Input placeholder="e.g., Session Champion" value={newName} onChange={e => setNewName(e.target.value)} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea rows={2} className="w-full px-4 py-2 rounded-xl border border-gray-200 text-sm" value={newDesc} onChange={e => setNewDesc(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                      {ACH_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                    </select>
                  </div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Points</label><Input type="number" min={0} value={newPoints} onChange={e => setNewPoints(Number(e.target.value)||0)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Level</label><Input type="number" min={1} value={newLevel} onChange={e => setNewLevel(Number(e.target.value)||1)} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Max Level</label><Input type="number" min={1} value={newMaxLevel} onChange={e => setNewMaxLevel(Number(e.target.value)||1)} /></div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="flex-1" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                <Button className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white" disabled={saving} onClick={handleCreate}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Create
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
            onClick={() => setEditModal(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()} className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold">Edit Achievement</h3>
                <Button variant="ghost" size="sm" onClick={() => setEditModal(null)}><X className="w-4 h-4" /></Button>
              </div>
              <div className="space-y-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Name *</label><Input value={editName} onChange={e => setEditName(e.target.value)} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea rows={2} className="w-full px-4 py-2 rounded-xl border border-gray-200 text-sm" value={editDesc} onChange={e => setEditDesc(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" value={editCategory} onChange={e => setEditCategory(e.target.value)}>
                      {ACH_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                    </select>
                  </div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Points</label><Input type="number" min={0} value={editPoints} onChange={e => setEditPoints(Number(e.target.value)||0)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Level</label><Input type="number" min={1} value={editLevel} onChange={e => setEditLevel(Number(e.target.value)||1)} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Max Level</label><Input type="number" min={1} value={editMaxLevel} onChange={e => setEditMaxLevel(Number(e.target.value)||1)} /></div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="flex-1" onClick={() => setEditModal(null)}>Cancel</Button>
                <Button className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white" disabled={saving} onClick={handleSaveEdit}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Save Changes
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Modal */}
      <AnimatePresence>
        {viewStatsModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
            onClick={() => setViewStatsModal(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()} className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold">Achievement Stats</h3>
                <Button variant="ghost" size="sm" onClick={() => setViewStatsModal(null)}><X className="w-4 h-4" /></Button>
              </div>
              <div className="space-y-4">
                <div className={`flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br ${achColor(viewStatsModal.category)}`}>
                  {(() => { const Icon = achIcon(viewStatsModal.category); return <Icon className="w-8 h-8 text-white" />; })()}
                  <div>
                    <h4 className="text-xl font-bold text-white">{viewStatsModal.name}</h4>
                    {viewStatsModal.description && <p className="text-white/80 text-sm mt-0.5">{viewStatsModal.description}</p>}
                    <span className="mt-1 inline-block px-2 py-0.5 bg-white/30 rounded text-xs text-white capitalize">{viewStatsModal.category}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-center">
                    <p className="text-2xl font-bold text-blue-600">{viewStatsModal.earnedCount}</p>
                    <p className="text-xs text-gray-600">Times Earned</p>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-center">
                    <p className="text-2xl font-bold text-yellow-600">{viewStatsModal.points}</p>
                    <p className="text-xs text-gray-600">Points</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 text-center">
                    <p className="text-2xl font-bold text-purple-600">{totalUsers > 0 ? ((viewStatsModal.earnedCount/totalUsers)*100).toFixed(1) : "0"}%</p>
                    <p className="text-xs text-gray-600">Earn Rate</p>
                  </div>
                </div>
                {viewStatsModal.maxLevel > 1 && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm font-medium">Level: {viewStatsModal.level} / {viewStatsModal.maxLevel}</p>
                  </div>
                )}
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <p className="text-sm">Created: {new Date(viewStatsModal.createdAt).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}</p>
                </div>
                <Button variant="outline" className="w-full" onClick={() => setViewStatsModal(null)}>Close</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Gamification page ────────────────────────────────────────────────────

const TABS = [
  { id: "challenges", label: "Challenges", icon: Trophy },
  { id: "badges", label: "Badges & Achievements", icon: Award },
] as const;

type TabId = typeof TABS[number]["id"];

export function Gamification() {
  const [activeTab, setActiveTab] = useState<TabId>("challenges");

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl font-bold text-gray-900 mb-1">Gamification</h1>
          <p className="text-gray-500">Manage wellness challenges and user achievement badges</p>
        </motion.div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit border border-gray-200">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
            {activeTab === "challenges" && <ChallengesTab />}
            {activeTab === "badges" && <BadgesTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </AdminLayoutNew>
  );
}
