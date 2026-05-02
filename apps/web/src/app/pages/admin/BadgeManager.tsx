import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Award,
  Trophy,
  Target,
  Star,
  Zap,
  Crown,
  Plus,
  CheckCircle,
  Users,
  TrendingUp,
  Edit,
  Eye,
  X,
  Save,
  BarChart3,
  Calendar,
  Loader2,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { api } from "@/lib/api";

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

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  achievement: Trophy,
  milestone: Target,
  special: Star,
  streak: Zap,
  challenge: Crown,
  sessions: Trophy,
  mood: Star,
  journal: Award,
  social: Users,
  wellness: TrendingUp,
};

const CATEGORY_COLORS: Record<string, string> = {
  achievement: "from-yellow-500 to-orange-600",
  milestone: "from-blue-500 to-indigo-600",
  special: "from-purple-500 to-pink-600",
  streak: "from-orange-500 to-red-600",
  challenge: "from-emerald-500 to-teal-600",
  sessions: "from-cyan-500 to-blue-600",
  mood: "from-rose-400 to-pink-600",
  journal: "from-violet-500 to-purple-600",
  social: "from-green-500 to-emerald-600",
  wellness: "from-teal-500 to-cyan-600",
};

const CATEGORIES = ["achievement", "milestone", "special", "streak", "challenge", "sessions", "mood", "journal", "social", "wellness"];

function getCategoryIcon(category: string): React.ElementType {
  return CATEGORY_ICONS[category] ?? Award;
}

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? "from-slate-500 to-slate-700";
}

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
      <div className="grid grid-cols-2 gap-2">
        <div className="h-10 bg-gray-200 rounded-lg" />
        <div className="h-10 bg-gray-200 rounded-lg" />
      </div>
    </div>
  );
}

export function BadgeManager() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAch, setSelectedAch] = useState<Achievement | null>(null);
  const [editModal, setEditModal] = useState<Achievement | null>(null);
  const [viewStatsModal, setViewStatsModal] = useState<Achievement | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Create form
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("achievement");
  const [newPoints, setNewPoints] = useState(50);
  const [newLevel, setNewLevel] = useState(1);
  const [newMaxLevel, setNewMaxLevel] = useState(5);

  // Edit form mirrors
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
    } catch (err) {
      toast.error("Failed to load achievements");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (a: Achievement) => {
    setEditModal(a);
    setEditName(a.name);
    setEditDesc(a.description);
    setEditCategory(a.category);
    setEditPoints(a.points);
    setEditLevel(a.level);
    setEditMaxLevel(a.maxLevel);
  };

  const resetCreate = () => {
    setNewName(""); setNewDesc(""); setNewCategory("achievement");
    setNewPoints(50); setNewLevel(1); setNewMaxLevel(5);
  };

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      const created = await api.admin.createAchievement({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        category: newCategory,
        points: newPoints,
        level: newLevel,
        maxLevel: newMaxLevel,
      });
      setAchievements((prev) => [created as Achievement, ...prev]);
      setShowCreateModal(false);
      resetCreate();
      toast.success("Achievement created");
    } catch {
      toast.error("Failed to create achievement");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editModal) return;
    if (!editName.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      const updated = await api.admin.updateAchievement(editModal.id, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
        category: editCategory,
        points: editPoints,
        level: editLevel,
        maxLevel: editMaxLevel,
      });
      setAchievements((prev) =>
        prev.map((a) => (a.id === editModal.id ? { ...a, ...(updated as Achievement) } : a))
      );
      setEditModal(null);
      toast.success("Achievement updated");
    } catch {
      toast.error("Failed to update achievement");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await api.admin.deleteAchievement(id);
      setAchievements((prev) => prev.filter((a) => a.id !== id));
      setSelectedAch(null);
      toast.success("Achievement deleted");
    } catch {
      toast.error("Failed to delete achievement");
    } finally {
      setDeleting(null);
    }
  };

  const stats = {
    total: achievements.length,
    totalEarned: achievements.reduce((s, a) => s + a.earnedCount, 0),
    withPoints: achievements.filter((a) => a.points > 0).length,
    topEarned: achievements.reduce((max, a) => Math.max(max, a.earnedCount), 0),
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
            <h1 className="text-3xl font-bold text-gray-900">Achievement Manager</h1>
            <p className="text-gray-600 mt-1">
              Manage platform-wide achievements — <span className="font-medium">{totalUsers.toLocaleString()}</span> registered users
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={load}
              disabled={isLoading}
              className="gap-1.5"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { resetCreate(); setShowCreateModal(true); }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center gap-2 shadow-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              New Achievement
            </motion.button>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: "Total Achievements", value: stats.total, icon: Award, color: "from-blue-500 to-indigo-600", border: "border-gray-100" },
            { label: "Times Earned (total)", value: stats.totalEarned.toLocaleString(), icon: CheckCircle, color: "from-green-500 to-emerald-600", border: "border-green-200" },
            { label: "With Points", value: stats.withPoints, icon: Star, color: "from-yellow-500 to-orange-600", border: "border-gray-100" },
            { label: "Registered Users", value: totalUsers.toLocaleString(), icon: Users, color: "from-purple-500 to-pink-600", border: "border-gray-100" },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.08 }}
                className={`bg-white rounded-2xl p-6 shadow-lg border-2 ${s.border}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${s.color}`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">{s.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{isLoading ? "—" : s.value}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Achievement Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              All Achievements
              {!isLoading && (
                <span className="text-base font-normal text-gray-500">({achievements.length})</span>
              )}
            </h2>
          </div>

          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : achievements.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No achievements yet</p>
              <p className="text-sm mt-1">Create your first achievement using the button above.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {achievements.map((ach, index) => {
                const CategoryIcon = getCategoryIcon(ach.category);
                const earnRate = totalUsers > 0 ? ((ach.earnedCount / totalUsers) * 100).toFixed(1) : "0";
                const isSelected = selectedAch?.id === ach.id;
                return (
                  <motion.div
                    key={ach.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.05 + index * 0.04 }}
                    onClick={() => setSelectedAch(isSelected ? null : ach)}
                    className={`border-2 rounded-xl p-5 cursor-pointer transition-all ${
                      isSelected
                        ? "border-blue-500 bg-blue-50 shadow-md"
                        : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`p-3 rounded-xl bg-gradient-to-br ${getCategoryColor(ach.category)} shrink-0`}>
                        <CategoryIcon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 truncate">{ach.name}</h3>
                        <span className="inline-block mt-0.5 px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs capitalize">
                          {ach.category}
                        </span>
                      </div>
                    </div>

                    {ach.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{ach.description}</p>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-blue-50 rounded-lg p-2">
                        <p className="text-xs text-blue-600">Points</p>
                        <p className="font-bold text-blue-700">{ach.points}</p>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-2">
                        <p className="text-xs text-purple-600">Earned by</p>
                        <p className="font-bold text-purple-700">{ach.earnedCount} users</p>
                      </div>
                    </div>

                    {ach.maxLevel > 1 && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                        <BarChart3 className="w-3 h-3" />
                        Level {ach.level} / {ach.maxLevel}
                      </div>
                    )}

                    <AnimatePresence>
                      {isSelected && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 pt-3 border-t border-gray-200 space-y-2"
                        >
                          <p className="text-xs text-gray-500">
                            Earn rate: <span className="font-semibold text-gray-700">{earnRate}%</span> of all users
                          </p>
                          <div className="flex gap-2">
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={(e) => { e.stopPropagation(); openEdit(ach); }}
                              className="flex-1 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium flex items-center justify-center gap-1"
                            >
                              <Edit className="w-3 h-3" /> Edit
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={(e) => { e.stopPropagation(); setViewStatsModal(ach); }}
                              className="flex-1 px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-medium flex items-center justify-center gap-1"
                            >
                              <Eye className="w-3 h-3" /> Stats
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              disabled={deleting === ach.id}
                              onClick={(e) => { e.stopPropagation(); handleDelete(ach.id); }}
                              className="px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 text-xs font-medium flex items-center justify-center gap-1 disabled:opacity-50"
                            >
                              {deleting === ach.id
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <Trash2 className="w-3 h-3" />}
                            </motion.button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Create Modal */}
        <AnimatePresence>
          {showCreateModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
              onClick={() => setShowCreateModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">New Achievement</h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <Input placeholder="e.g., Session Champion" value={newName} onChange={(e) => setNewName(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      rows={2}
                      placeholder="Describe what the user must do…"
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                      <select
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Points Reward</label>
                      <Input type="number" min={0} value={newPoints} onChange={(e) => setNewPoints(Number(e.target.value) || 0)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
                      <Input type="number" min={1} value={newLevel} onChange={(e) => setNewLevel(Number(e.target.value) || 1)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Level</label>
                      <Input type="number" min={1} value={newMaxLevel} onChange={(e) => setNewMaxLevel(Number(e.target.value) || 1)} />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <Button variant="outline" className="flex-1" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:opacity-90"
                    disabled={saving}
                    onClick={handleCreate}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Create
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit Modal */}
        <AnimatePresence>
          {editModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
              onClick={() => setEditModal(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">Edit Achievement</h3>
                  <Button variant="ghost" size="sm" onClick={() => setEditModal(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      rows={2}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                      <select
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Points Reward</label>
                      <Input type="number" min={0} value={editPoints} onChange={(e) => setEditPoints(Number(e.target.value) || 0)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
                      <Input type="number" min={1} value={editLevel} onChange={(e) => setEditLevel(Number(e.target.value) || 1)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Level</label>
                      <Input type="number" min={1} value={editMaxLevel} onChange={(e) => setEditMaxLevel(Number(e.target.value) || 1)} />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <Button variant="outline" className="flex-1" onClick={() => setEditModal(null)}>
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:opacity-90"
                    disabled={saving}
                    onClick={handleSaveEdit}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Changes
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Modal */}
        <AnimatePresence>
          {viewStatsModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
              onClick={() => setViewStatsModal(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">Achievement Stats</h3>
                  <Button variant="ghost" size="sm" onClick={() => setViewStatsModal(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-6">
                  <div className={`flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br ${getCategoryColor(viewStatsModal.category)} bg-opacity-10`}>
                    <div className={`p-4 rounded-xl bg-gradient-to-br ${getCategoryColor(viewStatsModal.category)}`}>
                      {(() => { const Icon = getCategoryIcon(viewStatsModal.category); return <Icon className="w-8 h-8 text-white" />; })()}
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-gray-900">{viewStatsModal.name}</h4>
                      {viewStatsModal.description && (
                        <p className="text-gray-600 text-sm mt-0.5">{viewStatsModal.description}</p>
                      )}
                      <span className="mt-1 inline-block px-2 py-0.5 bg-white/70 rounded text-xs capitalize font-medium text-gray-700">
                        {viewStatsModal.category}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <Award className="w-6 h-6 text-blue-600 mb-2" />
                      <p className="text-2xl font-bold text-blue-600">{viewStatsModal.earnedCount}</p>
                      <p className="text-xs text-gray-600">Times Earned</p>
                    </div>
                    <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                      <Star className="w-6 h-6 text-yellow-600 mb-2" />
                      <p className="text-2xl font-bold text-yellow-600">{viewStatsModal.points}</p>
                      <p className="text-xs text-gray-600">Points</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <TrendingUp className="w-6 h-6 text-purple-600 mb-2" />
                      <p className="text-2xl font-bold text-purple-600">
                        {totalUsers > 0 ? ((viewStatsModal.earnedCount / totalUsers) * 100).toFixed(1) : "0"}%
                      </p>
                      <p className="text-xs text-gray-600">Earn Rate</p>
                    </div>
                  </div>

                  {viewStatsModal.maxLevel > 1 && (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-sm font-medium text-gray-700">Level: {viewStatsModal.level} / {viewStatsModal.maxLevel}</p>
                    </div>
                  )}

                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h5 className="font-medium text-gray-900 mb-1 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-600" /> Created
                    </h5>
                    <p className="text-gray-700 text-sm">
                      {new Date(viewStatsModal.createdAt).toLocaleDateString("en-US", {
                        year: "numeric", month: "long", day: "numeric"
                      })}
                    </p>
                  </div>

                  <Button variant="outline" className="w-full" onClick={() => setViewStatsModal(null)}>
                    Close
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminLayoutNew>
  );
}
