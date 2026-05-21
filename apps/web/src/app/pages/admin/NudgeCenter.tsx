import { motion, AnimatePresence } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Bell, Plus, Edit, Trash2, Copy, BarChart3, Users, Clock, Target, Search,
  TrendingUp, Eye, Send, Pause, Play, X, Save, Upload, FileText,
  CheckCircle2, Star, Heart, Zap, Calendar, MessageSquare,
  Download, RefreshCw, AlertCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { FluentEmoji } from "@/components/ui/FluentEmoji";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Nudge {
  id: string;
  title: string;
  message: string;
  type: "motivational" | "reminder" | "milestone" | "wellness-tip" | "check-in";
  status: "active" | "draft" | "paused";
  trigger: string;
  targetAudience: string;
  schedule: string;
  sentCount: number;
  openRate: number;
  clickRate: number;
  createdDate: string;
  lastSent?: string;
}

interface NudgeTemplate {
  id: string;
  name: string;
  category: string;
  type: "push" | "email" | "in-app" | "sms";
  title: string;
  message: string;
  variables: string[];
  icon: React.ElementType;
  iconColor: string;
  usage: number;
  rating: number;
  status: "active" | "draft" | "archived";
  createdBy: string;
  lastUsed: string;
}

interface NudgeCampaign {
  id: string;
  name: string;
  template: string;
  type: "time-based" | "event-based" | "behavior-based";
  status: "active" | "paused" | "scheduled" | "completed";
  language: string;
  audience: { segment: string; count: number };
  trigger: { type: string; value: string };
  schedule: { startDate: string; endDate?: string; frequency: string; availabilityAt?: string };
  performance: { sent: number; opened: number; clicked: number; converted: number };
  createdBy: string;
  lastRun: string;
}

interface PerfNotification {
  id: string;
  title: string;
  channel: "push" | "email" | "in-app" | "sms" | "other";
  audience: string;
  sentCount: number;
  createdAt: Date;
  campaignKey: string;
}

// ─── Nudge helpers ─────────────────────────────────────────────────────────────

const mapApiNudge = (n: any, previous?: Nudge): Nudge => {
  const meta = (n?.target_audience || {}) as any;
  const createdAt = n?.created_at ? new Date(n.created_at) : new Date();
  return {
    id: n.id || previous?.id || "",
    title: n.title || previous?.title || "",
    message: n.message || previous?.message || "",
    type: (n.type as Nudge["type"]) || previous?.type || "motivational",
    status: (n.status as Nudge["status"]) || previous?.status || "draft",
    trigger: meta.trigger || previous?.trigger || "Custom trigger",
    targetAudience: meta.targetAudience || meta.label || previous?.targetAudience || "All active users",
    schedule: meta.schedule || previous?.schedule || "Daily",
    sentCount: previous?.sentCount ?? 0,
    openRate: previous?.openRate ?? 0,
    clickRate: previous?.clickRate ?? 0,
    createdDate: previous?.createdDate || createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    lastSent: meta.lastSent || previous?.lastSent,
  };
};

const nudgeStatusColor = (s: string) => {
  if (s === "active") return "bg-green-100 text-green-700 border-green-200";
  if (s === "paused") return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
};

// ─── Template helpers ──────────────────────────────────────────────────────────

const mapApiTemplate = (t: any): NudgeTemplate => {
  const baseIcon: React.ElementType = (() => {
    if (t.name?.includes("Mood") || t.category === "Engagement") return Heart;
    if (t.name?.includes("Breath") || t.category === "Wellness") return Zap;
    if (t.name?.includes("Sleep")) return Clock;
    if (t.name?.includes("Session") || t.name?.includes("Reminder")) return Calendar;
    if (t.category === "Progress") return TrendingUp;
    if (t.category === "Achievement") return Star;
    if (t.category === "Retention") return MessageSquare;
    return Bell;
  })();
  const iconColor = t.iconColor || (t.category === "Engagement" ? "#ec4899" : t.category === "Wellness" ? "#10b981" : t.category === "Progress" ? "#3b82f6" : t.category === "Achievement" ? "#f59e0b" : t.category === "Retention" ? "#06b6d4" : "#6366f1");
  return {
    id: t.id, name: t.name, category: t.category,
    type: t.type as NudgeTemplate["type"],
    title: t.title, message: t.message,
    variables: Array.isArray(t.variables) ? t.variables : [],
    icon: baseIcon, iconColor,
    usage: typeof t.usage === "number" ? t.usage : 0,
    rating: (() => { const r = t.rating; if (r == null) return 0; if (typeof r === "number") return r; return parseFloat(String(r)) || 0; })(),
    status: (t.status as NudgeTemplate["status"]) || "active",
    createdBy: t.profiles?.full_name || "System",
    lastUsed: t.last_used != null ? new Date(t.last_used).toLocaleString() : "Never",
  };
};

const typeEmoji = (type: string) => {
  if (type === "push") return "📱";
  if (type === "email") return "📧";
  if (type === "in-app") return "💬";
  return "📢";
};

// ─── Campaign helpers ──────────────────────────────────────────────────────────

function isoToLocal(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const mapApiCampaign = (c: any): NudgeCampaign => {
  const m = c.metrics || {};
  const audience = m.audience || {};
  const trigger = m.trigger || {};
  const schedule = m.schedule || {};
  const performance = m.performance || {};
  const created = c.created_at ? new Date(c.created_at) : new Date();
  const availAt = (typeof schedule.availabilityAt === "string" ? schedule.availabilityAt : undefined) || (c.scheduled_at ? new Date(c.scheduled_at).toISOString() : undefined);
  const start = (typeof schedule.startDate === "string" && schedule.startDate ? schedule.startDate.slice(0,10) : undefined) || (availAt ? new Date(availAt).toISOString().slice(0,10) : undefined) || (c.scheduled_at ? new Date(c.scheduled_at).toISOString().slice(0,10) : created.toISOString().slice(0,10));
  return {
    id: c.id, name: c.title || m.name || "Untitled campaign", template: m.template || "",
    type: (m.type as NudgeCampaign["type"]) || "time-based",
    status: (c.status as NudgeCampaign["status"]) || "scheduled",
    language: typeof m.language === "string" && m.language ? m.language : "en",
    audience: { segment: audience.segment || "All users", count: typeof audience.count === "number" ? audience.count : 0 },
    trigger: { type: trigger.type || "Custom", value: trigger.value || "" },
    schedule: { startDate: start, endDate: schedule.endDate, frequency: schedule.frequency || "Once", ...(availAt ? { availabilityAt: availAt } : {}) },
    performance: { sent: performance.sent ?? 0, opened: performance.opened ?? 0, clicked: performance.clicked ?? 0, converted: performance.converted ?? 0 },
    createdBy: m.createdBy || "System",
    lastRun: m.lastRun || (c.sent_at ? new Date(c.sent_at).toLocaleString() : "Not yet run"),
  };
};

const campStatusColor = (s: string) => {
  if (s === "active") return "bg-green-50 text-green-700 border-green-200";
  if (s === "paused") return "bg-yellow-50 text-yellow-700 border-yellow-200";
  if (s === "scheduled") return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-gray-50 text-gray-700 border-gray-200";
};

// ─── NudgesTab ─────────────────────────────────────────────────────────────────

function NudgesTab() {
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewModalNudge, setViewModalNudge] = useState<Nudge | null>(null);
  const [editModalNudge, setEditModalNudge] = useState<Nudge | null>(null);
  const [deleteModalNudge, setDeleteModalNudge] = useState<Nudge | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newType, setNewType] = useState<Nudge["type"]>("motivational");
  const [newSchedule, setNewSchedule] = useState("Daily");
  const [newTargetAudience, setNewTargetAudience] = useState("");
  const [newTrigger, setNewTrigger] = useState("");

  const [editTitle, setEditTitle] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [editType, setEditType] = useState<Nudge["type"]>("motivational");
  const [editStatus, setEditStatus] = useState<Nudge["status"]>("draft");
  const [editTrigger, setEditTrigger] = useState("");
  const [editSchedule, setEditSchedule] = useState("");
  const [editTargetAudience, setEditTargetAudience] = useState("");

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const data = await api.admin.getNudges();
        setNudges(Array.isArray(data) ? data.map((n: any) => mapApiNudge(n)) : []);
      } catch (e: any) { toast.error(e?.message || "Failed to load nudges"); }
      finally { setIsLoading(false); }
    })();
  }, []);

  const handleCreate = async () => {
    if (!newTitle.trim() || !newMessage.trim()) { toast.error("Title and message are required"); return; }
    try {
      const created = await api.admin.createNudge({ title: newTitle.trim(), message: newMessage.trim(), type: newType, status: "draft", target_audience: { label: newTargetAudience.trim() || "All active users", trigger: newTrigger.trim() || "Custom trigger", schedule: newSchedule } });
      setNudges(prev => [mapApiNudge(created), ...prev]);
      setShowCreateModal(false);
      setNewTitle(""); setNewMessage(""); setNewType("motivational"); setNewSchedule("Daily"); setNewTargetAudience(""); setNewTrigger("");
      toast.success("Nudge created");
    } catch (e: any) { toast.error(e?.message || "Failed to create nudge"); }
  };

  const openEdit = (nudge: Nudge) => {
    setEditModalNudge(nudge); setEditTitle(nudge.title); setEditMessage(nudge.message);
    setEditType(nudge.type); setEditStatus(nudge.status); setEditTrigger(nudge.trigger);
    setEditSchedule(nudge.schedule); setEditTargetAudience(nudge.targetAudience);
  };

  const handleSaveEdit = async () => {
    if (!editModalNudge) return;
    if (!editTitle.trim() || !editMessage.trim()) { toast.error("Title and message required"); return; }
    try {
      const updated = await api.admin.updateNudge(editModalNudge.id, { title: editTitle.trim(), message: editMessage.trim(), type: editType, status: editStatus, target_audience: { label: editTargetAudience.trim() || editModalNudge.targetAudience, trigger: editTrigger.trim() || editModalNudge.trigger, schedule: editSchedule || editModalNudge.schedule, lastSent: editModalNudge.lastSent } });
      setNudges(prev => prev.map(n => n.id === editModalNudge.id ? mapApiNudge(updated, n) : n));
      setEditModalNudge(null);
      toast.success("Nudge updated");
    } catch (e: any) { toast.error(e?.message || "Failed to update nudge"); }
  };

  const handleDelete = async () => {
    if (!deleteModalNudge) return;
    try {
      await api.admin.deleteNudge(deleteModalNudge.id);
      setNudges(prev => prev.filter(n => n.id !== deleteModalNudge.id));
      setDeleteModalNudge(null);
      toast.success("Nudge deleted");
    } catch (e: any) { toast.error(e?.message || "Failed to delete"); }
  };

  const handleSend = async (nudge: Nudge) => {
    try {
      const result = await api.admin.createManualNotification({ title: nudge.title, message: nudge.message, channel: "push", target_audience: "all" } as any);
      const sentCount = result && typeof result.count === "number" ? result.count : 0;
      const lastSent = new Date().toLocaleString();
      const updated = await api.admin.updateNudge(nudge.id, { status: "active", target_audience: { label: nudge.targetAudience, trigger: nudge.trigger, schedule: nudge.schedule, lastSent } });
      setNudges(prev => prev.map(n => n.id === nudge.id ? mapApiNudge(updated, { ...n, sentCount: n.sentCount + sentCount, lastSent }) : n));
      toast.success(sentCount > 0 ? `Nudge sent to ${sentCount.toLocaleString()} users` : "Nudge published");
    } catch (e: any) { toast.error(e?.message || "Failed to send nudge"); }
  };

  const handleToggleStatus = async (nudge: Nudge, status: Nudge["status"]) => {
    try {
      const updated = await api.admin.updateNudge(nudge.id, { status, target_audience: { label: nudge.targetAudience, trigger: nudge.trigger, schedule: nudge.schedule, lastSent: nudge.lastSent } });
      setNudges(prev => prev.map(n => n.id === nudge.id ? mapApiNudge(updated, n) : n));
      toast.success(`Nudge ${status}`);
    } catch (e: any) { toast.error(e?.message || "Failed to update"); }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setIsImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const items: any[] = Array.isArray(parsed) ? parsed : parsed?.nudges ? parsed.nudges : [parsed];
      let count = 0;
      for (const item of items) {
        const title = String(item.title || "").trim();
        const message = String(item.message || "").trim();
        if (!title || !message) continue;
        const created = await api.admin.createNudge({ title, message, type: (item.type || "motivational") as Nudge["type"], status: "draft", target_audience: { label: String(item.targetAudience || "All active users"), trigger: String(item.trigger || "Imported"), schedule: String(item.schedule || "Daily") } });
        setNudges(prev => [mapApiNudge(created), ...prev]);
        count++;
      }
      count > 0 ? toast.success(`Imported ${count} nudge(s)`) : toast.error("No valid nudges found");
      if (count > 0) setShowImportModal(false);
    } catch (e: any) { toast.error(e?.message || "Failed to import"); }
    finally { setIsImporting(false); }
  };

  const filtered = nudges.filter(n => {
    const matchSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.message.toLowerCase().includes(searchQuery.toLowerCase());
    const matchType = filterType === "all" || n.type === filterType;
    const matchStatus = filterStatus === "all" || n.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  const stats = { total: nudges.length, active: nudges.filter(n => n.status === "active").length, draft: nudges.filter(n => n.status === "draft").length, paused: nudges.filter(n => n.status === "paused").length };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Nudge Management</h2>
          <p className="text-gray-500 text-sm mt-1">Create and manage personalized user nudges</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImportModal(true)}><Upload className="w-4 h-4 mr-1" /> Import</Button>
          <Button className="bg-gradient-to-r from-purple-500 to-pink-600 text-white" onClick={() => setShowCreateModal(true)}><Plus className="w-4 h-4 mr-1" /> Create Nudge</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total", value: stats.total, color: "from-purple-500 to-pink-600" },
          { label: "Active", value: stats.active, color: "from-green-500 to-emerald-600" },
          { label: "Draft", value: stats.draft, color: "from-blue-500 to-cyan-600" },
          { label: "Paused", value: stats.paused, color: "from-orange-500 to-amber-600" },
        ].map(s => (
          <Card key={s.label} className="p-4">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center mb-2`}><Bell className="w-4 h-4 text-white" /></div>
            <p className="text-xl font-bold text-gray-900">{isLoading ? "—" : s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input className="pl-9" placeholder="Search nudges..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <select className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="all">All Types</option>
          <option value="motivational">Motivational</option><option value="reminder">Reminder</option>
          <option value="milestone">Milestone</option><option value="wellness-tip">Wellness Tip</option><option value="check-in">Check-In</option>
        </select>
        <select className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Status</option><option value="active">Active</option><option value="draft">Draft</option><option value="paused">Paused</option>
        </select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({length:6}).map((_,i) => <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center"><Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No nudges found</p></Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((nudge, i) => (
            <motion.div key={nudge.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}>
              <Card className="p-5 bg-white hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{nudge.title}</h3>
                    <div className="flex gap-1.5 mt-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${nudgeStatusColor(nudge.status)}`}>{nudge.status}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">{nudge.type}</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2 mb-3">{nudge.message}</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{nudge.targetAudience}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{nudge.schedule}</span>
                </div>
                <div className="flex items-center gap-1 justify-end pt-3 border-t border-gray-100">
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setViewModalNudge(nudge)}><Eye className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleSend(nudge)}><Send className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(nudge)}><Edit className="w-4 h-4" /></Button>
                  {nudge.status === "active"
                    ? <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleToggleStatus(nudge, "paused")}><Pause className="w-4 h-4" /></Button>
                    : <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleToggleStatus(nudge, "active")}><Play className="w-4 h-4" /></Button>
                  }
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500" onClick={() => setDeleteModalNudge(nudge)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </Card>
            </motion.div>
          ))}
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
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold">Create Nudge</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(false)}><X className="w-4 h-4" /></Button>
              </div>
              <div className="space-y-4">
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">Title *</label><Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Nudge title..." /></div>
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">Message *</label><textarea rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Your nudge message..." /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Type</label>
                    <select className="w-full px-3 py-2 border rounded-lg text-sm" value={newType} onChange={e => setNewType(e.target.value as Nudge["type"])}>
                      <option value="motivational">Motivational</option><option value="reminder">Reminder</option>
                      <option value="milestone">Milestone</option><option value="wellness-tip">Wellness Tip</option><option value="check-in">Check-In</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Schedule</label>
                    <select className="w-full px-3 py-2 border rounded-lg text-sm" value={newSchedule} onChange={e => setNewSchedule(e.target.value)}>
                      <option>Daily</option><option>Weekly</option><option>Monthly</option><option>Once</option>
                    </select>
                  </div>
                </div>
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">Target Audience</label><Input value={newTargetAudience} onChange={e => setNewTargetAudience(e.target.value)} placeholder="e.g., All active users" /></div>
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">Trigger</label><Input value={newTrigger} onChange={e => setNewTrigger(e.target.value)} placeholder="e.g., After session completed" /></div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="flex-1" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                <Button className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 text-white" onClick={handleCreate}><Plus className="w-4 h-4 mr-1" /> Create</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Modal */}
      <AnimatePresence>
        {viewModalNudge && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
            onClick={() => setViewModalNudge(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()} className="w-full max-w-md p-6 rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold">Nudge Details</h3>
                <Button variant="ghost" size="sm" onClick={() => setViewModalNudge(null)}><X className="w-4 h-4" /></Button>
              </div>
              <div className="space-y-3">
                <div><p className="text-xs text-gray-500">Title</p><p className="font-semibold">{viewModalNudge.title}</p></div>
                <div className="p-3 bg-gray-50 rounded-lg border"><p className="text-sm">{viewModalNudge.message}</p></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-gray-500">Type</p><p className="text-sm font-medium capitalize">{viewModalNudge.type}</p></div>
                  <div><p className="text-xs text-gray-500">Status</p><span className={`text-xs px-2 py-0.5 rounded-full border ${nudgeStatusColor(viewModalNudge.status)}`}>{viewModalNudge.status}</span></div>
                  <div><p className="text-xs text-gray-500">Schedule</p><p className="text-sm">{viewModalNudge.schedule}</p></div>
                  <div><p className="text-xs text-gray-500">Audience</p><p className="text-sm">{viewModalNudge.targetAudience}</p></div>
                </div>
                {viewModalNudge.lastSent && <div><p className="text-xs text-gray-500">Last Sent</p><p className="text-sm">{viewModalNudge.lastSent}</p></div>}
              </div>
              <div className="flex gap-3 mt-5">
                <Button variant="outline" className="flex-1" onClick={() => setViewModalNudge(null)}>Close</Button>
                <Button className="flex-1" onClick={() => { openEdit(viewModalNudge); setViewModalNudge(null); }}><Edit className="w-4 h-4 mr-1" /> Edit</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editModalNudge && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
            onClick={() => setEditModalNudge(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()} className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold">Edit Nudge</h3>
                <Button variant="ghost" size="sm" onClick={() => setEditModalNudge(null)}><X className="w-4 h-4" /></Button>
              </div>
              <div className="space-y-4">
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">Title *</label><Input value={editTitle} onChange={e => setEditTitle(e.target.value)} /></div>
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">Message *</label><textarea rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" value={editMessage} onChange={e => setEditMessage(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Type</label>
                    <select className="w-full px-3 py-2 border rounded-lg text-sm" value={editType} onChange={e => setEditType(e.target.value as Nudge["type"])}>
                      <option value="motivational">Motivational</option><option value="reminder">Reminder</option>
                      <option value="milestone">Milestone</option><option value="wellness-tip">Wellness Tip</option><option value="check-in">Check-In</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Status</label>
                    <select className="w-full px-3 py-2 border rounded-lg text-sm" value={editStatus} onChange={e => setEditStatus(e.target.value as Nudge["status"])}>
                      <option value="active">Active</option><option value="draft">Draft</option><option value="paused">Paused</option>
                    </select>
                  </div>
                </div>
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">Schedule</label><Input value={editSchedule} onChange={e => setEditSchedule(e.target.value)} /></div>
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">Target Audience</label><Input value={editTargetAudience} onChange={e => setEditTargetAudience(e.target.value)} /></div>
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">Trigger</label><Input value={editTrigger} onChange={e => setEditTrigger(e.target.value)} /></div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="flex-1" onClick={() => setEditModalNudge(null)}>Cancel</Button>
                <Button className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 text-white" onClick={handleSaveEdit}><Save className="w-4 h-4 mr-1" /> Save</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      <AnimatePresence>
        {deleteModalNudge && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
            onClick={() => setDeleteModalNudge(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()} className="w-full max-w-md p-6 rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex items-start gap-3 mb-4"><div className="p-2 bg-red-100 rounded-lg"><AlertCircle className="w-5 h-5 text-red-600" /></div><h3 className="font-bold text-lg pt-1">Delete Nudge?</h3></div>
              <p className="text-gray-600 mb-5">"{deleteModalNudge.title}" will be permanently deleted.</p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setDeleteModalNudge(null)}>Cancel</Button>
                <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete}><Trash2 className="w-4 h-4 mr-1" /> Delete</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Import Modal */}
      <AnimatePresence>
        {showImportModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
            onClick={() => setShowImportModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()} className="w-full max-w-md p-6 rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold">Import Nudges</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowImportModal(false)}><X className="w-4 h-4" /></Button>
              </div>
              <p className="text-sm text-gray-600 mb-4">Upload a JSON file with an array of nudge objects. Each entry must have <code className="bg-gray-100 px-1 rounded">title</code> and <code className="bg-gray-100 px-1 rounded">message</code> fields.</p>
              <input ref={importFileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
              <Button className="w-full gap-2" disabled={isImporting} onClick={() => importFileRef.current?.click()}>
                <Upload className="w-4 h-4" /> {isImporting ? "Importing…" : "Select JSON File"}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── TemplatesTab ──────────────────────────────────────────────────────────────

function TemplatesTab() {
  const [templates, setTemplates] = useState<NudgeTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewModal, setViewModal] = useState<NudgeTemplate | null>(null);
  const [editModal, setEditModal] = useState<NudgeTemplate | null>(null);
  const [deleteModal, setDeleteModal] = useState<NudgeTemplate | null>(null);
  const createRef = useRef(false);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const data = await api.admin.getNudgeTemplates();
        setTemplates(Array.isArray(data) ? data.map(mapApiTemplate) : []);
      } catch (e: any) { toast.error(e?.message || "Failed to load templates"); }
      finally { setIsLoading(false); }
    })();
  }, []);

  const handleCreate = async () => {
    if (createRef.current) return;
    createRef.current = true; setIsCreating(true);
    try {
      const created = await api.admin.createNudgeTemplate({ name: "New Template", category: "Engagement", type: "push", title: "New nudge title", message: "Write your message here...", variables: [], status: "draft" });
      const mapped = mapApiTemplate(created);
      setTemplates(prev => [mapped, ...prev]);
      setEditModal(mapped);
      toast.success("Template created — customize in the editor");
    } catch (e: any) { toast.error(e?.message || "Failed to create template"); }
    finally { createRef.current = false; setIsCreating(false); }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setIsImporting(true);
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const items: unknown[] = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === "object" && Array.isArray((parsed as any).templates)) ? (parsed as any).templates : [parsed];
      let count = 0;
      for (const raw of items) {
        const item = raw as Record<string, unknown>;
        const name = String(item.name ?? item.title ?? "").trim();
        const message = String(item.message ?? "").trim();
        if (!name || !message) continue;
        const created = await api.admin.createNudgeTemplate({ name, category: String(item.category ?? "Engagement"), type: (item.type as NudgeTemplate["type"]) || "push", title: String(item.title ?? name), message, variables: Array.isArray(item.variables) ? item.variables as string[] : [], status: (item.status as NudgeTemplate["status"]) || "draft" });
        setTemplates(prev => [mapApiTemplate(created), ...prev]);
        count++;
      }
      count > 0 ? toast.success(`Imported ${count} template(s)`) : toast.error("No valid templates found");
    } catch (e: any) { toast.error(e?.message || "Import failed"); }
    finally { setIsImporting(false); }
  };

  const filtered = templates.filter(t => {
    const search = t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.message.toLowerCase().includes(searchQuery.toLowerCase());
    const cat = filterCategory === "all" || t.category === filterCategory;
    const type = filterType === "all" || t.type === filterType;
    const status = filterStatus === "all" || t.status === filterStatus;
    return search && cat && type && status;
  });

  const stats = { total: templates.length, active: templates.filter(t => t.status === "active").length, usage: templates.reduce((s, t) => s + t.usage, 0), avgRating: templates.length ? (templates.reduce((s, t) => s + t.rating, 0) / templates.length).toFixed(1) : "0.0" };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Nudge Templates</h2>
          <p className="text-gray-500 text-sm mt-1">Pre-built notification templates with personalization</p>
        </div>
        <div className="flex gap-2">
          <label className={`inline-flex h-9 items-center gap-2 rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50 ${isImporting ? "opacity-60 pointer-events-none" : ""}`}>
            <input type="file" accept=".json" className="sr-only" disabled={isImporting} onChange={handleImport} />
            <Upload className="w-4 h-4" /> {isImporting ? "Importing…" : "Import"}
          </label>
          <Button className="bg-gradient-to-r from-purple-500 to-pink-600 text-white" disabled={isCreating} onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-1" /> {isCreating ? "Creating…" : "Create Template"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Templates", value: stats.total, icon: Bell, color: "from-purple-500 to-pink-600" },
          { label: "Active", value: stats.active, icon: CheckCircle2, color: "from-green-500 to-emerald-600" },
          { label: "Total Usage", value: stats.usage.toLocaleString(), icon: TrendingUp, color: "from-blue-500 to-cyan-600" },
          { label: "Avg Rating", value: stats.avgRating, icon: Star, color: "from-orange-500 to-amber-600" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="p-4">
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center mb-2`}><Icon className="w-4 h-4 text-white" /></div>
              <p className="text-xl font-bold text-gray-900">{isLoading ? "—" : s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input className="pl-9" placeholder="Search templates..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        {[
          { val: filterCategory, set: setFilterCategory, options: ["all","Engagement","Wellness","Progress","Achievement","Retention"], labels: ["All Categories","Engagement","Wellness","Progress","Achievement","Retention"] },
          { val: filterType, set: setFilterType, options: ["all","push","email","in-app","sms"], labels: ["All Types","Push","Email","In-App","SMS"] },
          { val: filterStatus, set: setFilterStatus, options: ["all","active","draft","archived"], labels: ["All Status","Active","Draft","Archived"] },
        ].map((f, i) => (
          <select key={i} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" value={f.val} onChange={e => f.set(e.target.value)}>
            {f.options.map((o, j) => <option key={o} value={o}>{f.labels[j]}</option>)}
          </select>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid lg:grid-cols-2 gap-4">{Array.from({length:4}).map((_,i) => <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center"><Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No templates found</p></Card>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {filtered.map((t, i) => {
            const Icon = t.icon;
            return (
              <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Card className="p-5 bg-white hover:shadow-md transition-all">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${t.iconColor}20` }}>
                      <Icon className="w-5 h-5" style={{ color: t.iconColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-gray-900 truncate">{t.name}</h3>
                        <div className="flex gap-1.5 shrink-0">
                          <span className="text-lg leading-none inline-flex">
                            <FluentEmoji emoji={typeEmoji(t.type)} size={22} />
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${t.status === "active" ? "bg-green-50 text-green-700 border-green-200" : t.status === "draft" ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-gray-50 text-gray-700 border-gray-200"}`}>{t.status}</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">{t.category}</p>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-100">
                    <p className="text-sm font-semibold text-gray-900 mb-1">{t.title}</p>
                    <p className="text-sm text-gray-600 line-clamp-2">{t.message}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-gray-500 mb-3">
                    <span>Used: {t.usage.toLocaleString()}</span>
                    <span className="flex items-center gap-1"><Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />{t.rating}</span>
                    <span>By: {t.createdBy}</span>
                  </div>
                  <div className="flex justify-end gap-1 pt-2 border-t border-gray-100">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setViewModal(t)}><Eye className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { if (navigator.clipboard) navigator.clipboard.writeText(t.message); }}><Copy className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-blue-600" onClick={() => setEditModal(t)}><Edit className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" onClick={() => setDeleteModal(t)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* View Modal */}
      <AnimatePresence>
        {viewModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
            onClick={() => setViewModal(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()} className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold">View Template</h3>
                <Button variant="ghost" size="sm" onClick={() => setViewModal(null)}><X className="w-4 h-4" /></Button>
              </div>
              <div className="space-y-3">
                <div><p className="text-xs text-gray-500">Name</p><p className="font-semibold">{viewModal.name}</p></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-gray-500">Category</p><p className="text-sm">{viewModal.category}</p></div>
                  <div><p className="text-xs text-gray-500">Type</p><p className="text-sm inline-flex items-center gap-1"><FluentEmoji emoji={typeEmoji(viewModal.type)} size={18} /> {viewModal.type}</p></div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border">
                  <p className="font-semibold text-sm mb-1">{viewModal.title}</p>
                  <p className="text-sm text-gray-700">{viewModal.message}</p>
                </div>
                {viewModal.variables.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Variables</p>
                    <div className="flex flex-wrap gap-1">{viewModal.variables.map(v => <span key={v} className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-xs font-mono">{`{{${v}}}`}</span>)}</div>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg text-center"><p className="text-lg font-bold text-blue-600">{viewModal.usage.toLocaleString()}</p><p className="text-xs text-gray-500">Usage</p></div>
                  <div className="p-2 bg-yellow-50 rounded-lg text-center"><p className="text-lg font-bold text-yellow-600">{viewModal.rating}</p><p className="text-xs text-gray-500">Rating</p></div>
                  <div className="p-2 bg-gray-50 rounded-lg text-center"><p className="text-xs font-bold text-gray-700">{viewModal.lastUsed}</p><p className="text-xs text-gray-500">Last Used</p></div>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <Button variant="outline" className="flex-1" onClick={() => setViewModal(null)}>Close</Button>
                <Button className="flex-1" onClick={() => { setEditModal(viewModal); setViewModal(null); }}><Edit className="w-4 h-4 mr-1" /> Edit</Button>
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
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold">Edit Template</h3>
                <Button variant="ghost" size="sm" onClick={() => setEditModal(null)}><X className="w-4 h-4" /></Button>
              </div>
              <div className="space-y-4">
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">Template Name</label><Input defaultValue={editModal.name} onChange={e => setEditModal({...editModal, name: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Category</label>
                    <select className="w-full px-3 py-2 border rounded-lg text-sm" defaultValue={editModal.category} onChange={e => setEditModal({...editModal, category: e.target.value})}>
                      {["Engagement","Wellness","Progress","Achievement","Retention"].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Type</label>
                    <select className="w-full px-3 py-2 border rounded-lg text-sm" defaultValue={editModal.type} onChange={e => setEditModal({...editModal, type: e.target.value as NudgeTemplate["type"]})}>
                      <option value="push">Push</option><option value="email">Email</option><option value="in-app">In-App</option><option value="sms">SMS</option>
                    </select>
                  </div>
                </div>
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">Title</label><Input defaultValue={editModal.title} onChange={e => setEditModal({...editModal, title: e.target.value})} /></div>
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">Message</label><textarea rows={4} className="w-full px-3 py-2 border rounded-lg text-sm" defaultValue={editModal.message} onChange={e => setEditModal({...editModal, message: e.target.value})} /></div>
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">Variables (comma separated)</label><Input defaultValue={editModal.variables.join(", ")} placeholder="name, sessions, etc." onChange={e => setEditModal({...editModal, variables: e.target.value.split(",").map(v => v.trim()).filter(Boolean)})} /></div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Status</label>
                  <select className="w-full px-3 py-2 border rounded-lg text-sm" defaultValue={editModal.status} onChange={e => setEditModal({...editModal, status: e.target.value as NudgeTemplate["status"]})}>
                    <option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="flex-1" onClick={() => setEditModal(null)}>Cancel</Button>
                <Button className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 text-white" onClick={async () => {
                  if (!editModal) return;
                  const updated = await api.admin.updateNudgeTemplate(editModal.id, { name: editModal.name, category: editModal.category, type: editModal.type, title: editModal.title, message: editModal.message, variables: editModal.variables, status: editModal.status });
                  setTemplates(prev => prev.map(t => t.id === editModal.id ? mapApiTemplate({ ...updated }) : t));
                  setEditModal(null); toast.success("Template saved");
                }}><Save className="w-4 h-4 mr-1" /> Save</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      <AnimatePresence>
        {deleteModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
            onClick={() => setDeleteModal(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()} className="w-full max-w-md p-6 rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex items-start gap-3 mb-4"><div className="p-2 bg-red-100 rounded-lg"><AlertCircle className="w-5 h-5 text-red-600" /></div><h3 className="font-bold text-lg pt-1">Delete template?</h3></div>
              <p className="text-gray-600 mb-5">"{deleteModal.name}" will be permanently deleted.</p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setDeleteModal(null)}>Cancel</Button>
                <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={async () => {
                  await api.admin.deleteNudgeTemplate(deleteModal.id);
                  setTemplates(prev => prev.filter(t => t.id !== deleteModal.id));
                  setDeleteModal(null); toast.success("Template deleted");
                }}>Delete</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── ScheduleTab ───────────────────────────────────────────────────────────────

function ScheduleTab() {
  const [campaigns, setCampaigns] = useState<NudgeCampaign[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [viewModal, setViewModal] = useState<NudgeCampaign | null>(null);
  const [editModal, setEditModal] = useState<NudgeCampaign | null>(null);
  const [deleteModal, setDeleteModal] = useState<NudgeCampaign | null>(null);
  const [editDraft, setEditDraft] = useState<NudgeCampaign | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [campName, setCampName] = useState("");
  const [campType, setCampType] = useState<NudgeCampaign["type"]>("time-based");
  const [campStatus, setCampStatus] = useState<NudgeCampaign["status"]>("scheduled");
  const [campTemplateId, setCampTemplateId] = useState("");
  const [triggerType, setTriggerType] = useState("");
  const [frequency, setFrequency] = useState("Once");
  const [availAt, setAvailAt] = useState("");
  const [language, setLanguage] = useState("en");
  const [targetAudience, setTargetAudience] = useState("All users");

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const [campData, tplData] = await Promise.all([api.admin.getPushCampaigns(), api.admin.getNudgeTemplates()]);
        setCampaigns(Array.isArray(campData) ? campData.map(mapApiCampaign) : []);
        setTemplates(Array.isArray(tplData) ? tplData.map((t: any) => ({ id: t.id, name: t.name })) : []);
      } catch (e: any) { toast.error(e?.message || "Failed to load campaigns"); }
      finally { setIsLoading(false); }
    })();
  }, []);

  useEffect(() => { setEditDraft(editModal); }, [editModal]);

  const handleCreate = async () => {
    setIsSaving(true);
    try {
      const selectedTpl = templates.find(t => t.id === campTemplateId);
      const availIso = availAt ? new Date(availAt).toISOString() : null;
      const created = await api.admin.createPushCampaign({ title: campName || selectedTpl?.name || "Untitled campaign", message: "", status: campStatus, target_segment_id: null, scheduled_at: availIso, metrics: { templateId: campTemplateId || null, template: selectedTpl?.name || "", type: campType, language, audience: { segment: targetAudience, count: 0 }, trigger: { type: triggerType || "Custom", value: "" }, schedule: { startDate: availAt?.slice(0,10) || new Date().toISOString().slice(0,10), frequency, ...(availIso ? { availabilityAt: availIso } : {}) }, performance: { sent:0, opened:0, clicked:0, converted:0 }, lastRun: "Not yet run" } });
      setCampaigns(prev => [mapApiCampaign(created), ...prev]);
      setShowCreate(false); setCampName(""); setCampType("time-based"); setCampStatus("scheduled"); setCampTemplateId(""); setTriggerType(""); setFrequency("Once"); setAvailAt(""); setLanguage("en"); setTargetAudience("All users");
      toast.success("Campaign created");
    } catch (e: any) { toast.error(e?.message || "Failed to create campaign"); }
    finally { setIsSaving(false); }
  };

  const handleSaveEdit = async () => {
    if (!editModal || !editDraft) return;
    setIsSaving(true);
    try {
      const rawAvail = editDraft.schedule.availabilityAt;
      const scheduledAt = rawAvail && !isNaN(new Date(rawAvail).getTime()) ? new Date(rawAvail).toISOString() : null;
      const updated = await api.admin.updatePushCampaign(editModal.id, { title: editDraft.name, status: editDraft.status, scheduled_at: scheduledAt, metrics: { name: editDraft.name, template: editDraft.template, type: editDraft.type, language: editDraft.language, audience: editDraft.audience, trigger: editDraft.trigger, schedule: editDraft.schedule, performance: editModal.performance, createdBy: editModal.createdBy, lastRun: editModal.lastRun } });
      setCampaigns(prev => prev.map(c => c.id === editModal.id ? mapApiCampaign(updated) : c));
      setEditModal(null); toast.success("Campaign updated");
    } catch (e: any) { toast.error(e?.message || "Failed to save"); }
    finally { setIsSaving(false); }
  };

  const handleToggle = async (c: NudgeCampaign, s: NudgeCampaign["status"]) => {
    try {
      const updated = await api.admin.updatePushCampaign(c.id, { status: s });
      setCampaigns(prev => prev.map(x => x.id === c.id ? mapApiCampaign(updated) : x));
      toast.success(`Campaign ${s}`);
    } catch (e: any) { toast.error(e?.message || "Failed to update"); }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    try { await api.admin.deletePushCampaign(deleteModal.id); setCampaigns(prev => prev.filter(c => c.id !== deleteModal.id)); setDeleteModal(null); toast.success("Campaign deleted"); }
    catch (e: any) { toast.error(e?.message || "Failed to delete"); }
  };

  const filtered = campaigns.filter(c => (filterStatus === "all" || c.status === filterStatus) && (filterType === "all" || c.type === filterType));

  const stats = { active: campaigns.filter(c => c.status === "active").length, scheduled: campaigns.filter(c => c.status === "scheduled").length, audience: campaigns.reduce((s, c) => s + c.audience.count, 0) };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Campaign Scheduler</h2>
          <p className="text-gray-500 text-sm mt-1">Schedule and manage notification campaigns</p>
        </div>
        <Button className="bg-gradient-to-r from-purple-500 to-pink-600 text-white" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" /> Create Campaign</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active Campaigns", value: stats.active, icon: Play, color: "from-green-500 to-emerald-600" },
          { label: "Scheduled", value: stats.scheduled, icon: Clock, color: "from-blue-500 to-cyan-600" },
          { label: "Total Audience", value: stats.audience.toLocaleString(), icon: Users, color: "from-purple-500 to-pink-600" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="p-4">
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center mb-2`}><Icon className="w-4 h-4 text-white" /></div>
              <p className="text-xl font-bold text-gray-900">{isLoading ? "—" : s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </Card>
          );
        })}
      </div>

      <div className="flex gap-3">
        <select className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Status</option><option value="active">Active</option><option value="paused">Paused</option><option value="scheduled">Scheduled</option><option value="completed">Completed</option>
        </select>
        <select className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="all">All Types</option><option value="time-based">Time-Based</option><option value="event-based">Event-Based</option><option value="behavior-based">Behavior-Based</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({length:3}).map((_,i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center"><Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No campaigns found</p></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="p-5 bg-white hover:shadow-md transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900 truncate">{c.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 ${campStatusColor(c.status)}`}>{c.status}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600 capitalize shrink-0">{c.type}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-500 mt-1">
                      <span><Users className="w-3 h-3 inline mr-1" />{c.audience.segment}</span>
                      <span><Clock className="w-3 h-3 inline mr-1" />{c.schedule.frequency}</span>
                      <span>Start: {c.schedule.startDate}</span>
                      <span>Last: {c.lastRun}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setViewModal(c)}><Eye className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditModal(c)}><Edit className="w-4 h-4" /></Button>
                    {c.status === "active"
                      ? <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleToggle(c,"paused")}><Pause className="w-4 h-4" /></Button>
                      : <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleToggle(c,"active")}><Play className="w-4 h-4" /></Button>
                    }
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500" onClick={() => setDeleteModal(c)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
                {c.performance.sent > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-gray-100 text-xs">
                    {[
                      { label: "Sent", value: c.performance.sent },
                      { label: "Opened", value: c.performance.opened },
                      { label: "Clicked", value: c.performance.clicked },
                      { label: "Converted", value: c.performance.converted },
                    ].map(s => (
                      <div key={s.label} className="text-center">
                        <p className="font-bold text-gray-900">{s.value.toLocaleString()}</p>
                        <p className="text-gray-500">{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
            onClick={() => setShowCreate(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()} className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold">Create Campaign</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}><X className="w-4 h-4" /></Button>
              </div>
              <div className="space-y-4">
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">Campaign Name</label><Input value={campName} onChange={e => setCampName(e.target.value)} placeholder="e.g., Daily Mood Check-In" /></div>
                {templates.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Template (optional)</label>
                    <select className="w-full px-3 py-2 border rounded-lg text-sm" value={campTemplateId} onChange={e => setCampTemplateId(e.target.value)}>
                      <option value="">— None —</option>
                      {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Type</label>
                    <select className="w-full px-3 py-2 border rounded-lg text-sm" value={campType} onChange={e => setCampType(e.target.value as NudgeCampaign["type"])}>
                      <option value="time-based">Time-Based</option><option value="event-based">Event-Based</option><option value="behavior-based">Behavior-Based</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Status</label>
                    <select className="w-full px-3 py-2 border rounded-lg text-sm" value={campStatus} onChange={e => setCampStatus(e.target.value as NudgeCampaign["status"])}>
                      <option value="scheduled">Scheduled</option><option value="active">Active</option><option value="paused">Paused</option>
                    </select>
                  </div>
                </div>
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">Target Audience</label><Input value={targetAudience} onChange={e => setTargetAudience(e.target.value)} /></div>
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">Trigger</label><Input value={triggerType} onChange={e => setTriggerType(e.target.value)} placeholder="e.g., After inactivity" /></div>
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">Frequency</label><Input value={frequency} onChange={e => setFrequency(e.target.value)} placeholder="e.g., Daily, Weekly" /></div>
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">Schedule / Availability</label><Input type="datetime-local" value={availAt} onChange={e => setAvailAt(e.target.value)} /></div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 text-white" disabled={isSaving} onClick={handleCreate}>
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />} Create
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editModal && editDraft && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
            onClick={() => setEditModal(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()} className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold">Edit Campaign</h3>
                <Button variant="ghost" size="sm" onClick={() => setEditModal(null)}><X className="w-4 h-4" /></Button>
              </div>
              <div className="space-y-4">
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">Name</label><Input value={editDraft.name} onChange={e => setEditDraft({...editDraft, name: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Status</label>
                    <select className="w-full px-3 py-2 border rounded-lg text-sm" value={editDraft.status} onChange={e => setEditDraft({...editDraft, status: e.target.value as NudgeCampaign["status"]})}>
                      <option value="active">Active</option><option value="paused">Paused</option><option value="scheduled">Scheduled</option><option value="completed">Completed</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Type</label>
                    <select className="w-full px-3 py-2 border rounded-lg text-sm" value={editDraft.type} onChange={e => setEditDraft({...editDraft, type: e.target.value as NudgeCampaign["type"]})}>
                      <option value="time-based">Time-Based</option><option value="event-based">Event-Based</option><option value="behavior-based">Behavior-Based</option>
                    </select>
                  </div>
                </div>
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">Audience Segment</label><Input value={editDraft.audience.segment} onChange={e => setEditDraft({...editDraft, audience: {...editDraft.audience, segment: e.target.value}})} /></div>
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">Frequency</label><Input value={editDraft.schedule.frequency} onChange={e => setEditDraft({...editDraft, schedule: {...editDraft.schedule, frequency: e.target.value}})} /></div>
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">Availability / Schedule</label><Input type="datetime-local" value={isoToLocal(editDraft.schedule.availabilityAt)} onChange={e => setEditDraft({...editDraft, schedule: {...editDraft.schedule, availabilityAt: e.target.value ? new Date(e.target.value).toISOString() : undefined}})} /></div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="flex-1" onClick={() => setEditModal(null)}>Cancel</Button>
                <Button className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 text-white" disabled={isSaving} onClick={handleSaveEdit}>
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />} Save
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Modal */}
      <AnimatePresence>
        {viewModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
            onClick={() => setViewModal(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()} className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold">Campaign Details</h3>
                <Button variant="ghost" size="sm" onClick={() => setViewModal(null)}><X className="w-4 h-4" /></Button>
              </div>
              <div className="space-y-3">
                <div><p className="text-xs text-gray-500">Name</p><p className="font-semibold">{viewModal.name}</p></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-gray-500">Type</p><p className="text-sm capitalize">{viewModal.type}</p></div>
                  <div><p className="text-xs text-gray-500">Status</p><span className={`text-xs px-2 py-0.5 rounded-full border ${campStatusColor(viewModal.status)}`}>{viewModal.status}</span></div>
                  <div><p className="text-xs text-gray-500">Audience</p><p className="text-sm">{viewModal.audience.segment}</p></div>
                  <div><p className="text-xs text-gray-500">Frequency</p><p className="text-sm">{viewModal.schedule.frequency}</p></div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[{l:"Sent",v:viewModal.performance.sent},{l:"Opened",v:viewModal.performance.opened},{l:"Clicked",v:viewModal.performance.clicked},{l:"Converted",v:viewModal.performance.converted}].map(s => (
                    <div key={s.l} className="p-2 bg-gray-50 rounded-lg text-center">
                      <p className="font-bold text-sm text-gray-900">{s.v.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">{s.l}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <Button variant="outline" className="flex-1" onClick={() => setViewModal(null)}>Close</Button>
                <Button className="flex-1" onClick={() => { setEditModal(viewModal); setViewModal(null); }}><Edit className="w-4 h-4 mr-1" /> Edit</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      <AnimatePresence>
        {deleteModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
            onClick={() => setDeleteModal(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()} className="w-full max-w-md p-6 rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <h3 className="font-bold text-lg mb-3">Delete campaign?</h3>
              <p className="text-gray-600 mb-5">"{deleteModal.name}" will be permanently deleted.</p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setDeleteModal(null)}>Cancel</Button>
                <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete}>Delete</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── AnalyticsTab ──────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const [notifications, setNotifications] = useState<PerfNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const now = new Date();
  const [periodMode, setPeriodMode] = useState<"month" | "custom">("month");
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [customStart, setCustomStart] = useState(() => { const d = new Date(); d.setDate(d.getDate()-30); return d.toISOString().slice(0,10); });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().slice(0,10));

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.admin.getManualNotifications();
      setNotifications((Array.isArray(data) ? data : []).map((n: any) => {
        const md = n.metadata || {};
        const ch = md.channel as string | undefined;
        const channel: PerfNotification["channel"] = ch === "push" || ch === "email" || ch === "in-app" || ch === "sms" ? ch : "push";
        const count = (typeof md.delivered_count === "number" ? md.delivered_count : undefined) ?? (typeof md.target_count === "number" ? md.target_count : undefined) ?? 1;
        const createdAt = new Date(n.sent_at || n.created_at);
        const audienceRaw = md.target_audience as string | undefined;
        const audience = audienceRaw === "all" ? "All Users" : audienceRaw ? audienceRaw.charAt(0).toUpperCase() + audienceRaw.slice(1) + " Users" : "Targeted";
        return { id: n.id, title: n.title || "Untitled nudge", channel, audience, sentCount: count, createdAt, campaignKey: [n.title||"", md.target_audience||"", createdAt.toISOString().slice(0,16)].join("|") };
      }));
    } catch (e: any) { toast.error(e?.message || "Failed to load analytics"); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [refreshKey, load]);

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (periodMode === "custom") {
      const s = new Date(customStart); s.setHours(0,0,0,0);
      const e = new Date(customEnd); e.setHours(23,59,59,999);
      return { rangeStart: s, rangeEnd: e };
    }
    return { rangeStart: new Date(selectedYear, selectedMonth-1, 1), rangeEnd: new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999) };
  }, [periodMode, selectedYear, selectedMonth, customStart, customEnd]);

  const filtered = useMemo(() => notifications.filter(n => n.createdAt >= rangeStart && n.createdAt <= rangeEnd), [notifications, rangeStart, rangeEnd]);

  const aggregates = useMemo(() => {
    const map = new Map<string, { key: string; name: string; channel: PerfNotification["channel"]; audience: string; recipients: number; createdAt: Date }>();
    filtered.forEach(n => {
      const ex = map.get(n.campaignKey);
      if (!ex) map.set(n.campaignKey, { key: n.campaignKey, name: n.title, channel: n.channel, audience: n.audience, recipients: n.sentCount, createdAt: n.createdAt });
      else if (n.sentCount > ex.recipients) ex.recipients = n.sentCount;
    });
    return Array.from(map.values());
  }, [filtered]);

  const totalSent = useMemo(() => aggregates.reduce((s, c) => s + c.recipients, 0), [aggregates]);
  const distinctChannels = useMemo(() => new Set(aggregates.map(c => c.channel)).size, [aggregates]);
  const avgRecipients = aggregates.length ? totalSent / aggregates.length : 0;

  const trendData = useMemo(() => {
    const map = new Map<string, number>();
    aggregates.forEach(c => { const k = c.createdAt.toISOString().slice(0,10); map.set(k, (map.get(k) || 0) + c.recipients); });
    return Array.from(map.entries()).map(([date,sent]) => ({date,sent})).sort((a,b) => a.date.localeCompare(b.date));
  }, [aggregates]);

  const channelData = useMemo(() => {
    const map = new Map<string, { name: string; value: number; color: string }>();
    const colorMap: Record<string,string> = { push:"#3b82f6", email:"#10b981", "in-app":"#f59e0b", sms:"#ec4899", other:"#6b7280" };
    aggregates.forEach(c => { const ex = map.get(c.channel) || { name: c.channel === "in-app" ? "In-App" : c.channel.charAt(0).toUpperCase()+c.channel.slice(1), value: 0, color: colorMap[c.channel] || "#6b7280" }; ex.value += c.recipients; map.set(c.channel, ex); });
    const total = Array.from(map.values()).reduce((s,c) => s+c.value, 0);
    return Array.from(map.values()).map(c => ({ ...c, percent: total ? Math.round((c.value/total)*100) : 0 }));
  }, [aggregates]);

  const handleExport = () => {
    const rows = [["Campaign","Channel","Recipients","Date"],...aggregates.map(c => [c.name, c.channel, c.recipients.toString(), c.createdAt.toISOString().slice(0,10)])];
    const blob = new Blob(["\uFEFF"+rows.map(r=>r.join(",")).join("\r\n")], { type:"text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`nudge-report-${new Date().toISOString().slice(0,10)}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast.success("Report exported");
  };

  return (
    <div className="space-y-6">
      {/* Header + controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Nudge Performance</h2>
          <p className="text-gray-500 text-sm mt-1">Delivery volume from nudges and campaigns</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="px-3 py-2 rounded-lg border text-sm bg-white" value={periodMode} onChange={e => setPeriodMode(e.target.value as "month"|"custom")}>
            <option value="month">Month / Year</option><option value="custom">Custom Range</option>
          </select>
          {periodMode === "month" ? (
            <>
              <select className="px-3 py-2 rounded-lg border text-sm bg-white" value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
                {Array.from({length:12},(_,i)=>i+1).map(m => <option key={m} value={m}>{new Date(2000,m-1,1).toLocaleString("default",{month:"long"})}</option>)}
              </select>
              <select className="px-3 py-2 rounded-lg border text-sm bg-white" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                {Array.from({length:8},(_,i)=>now.getFullYear()-i).map(y => <option key={y}>{y}</option>)}
              </select>
            </>
          ) : (
            <>
              <input type="date" className="px-3 py-2 rounded-lg border text-sm" value={customStart} onChange={e => setCustomStart(e.target.value)} />
              <span className="text-sm text-gray-500">to</span>
              <input type="date" className="px-3 py-2 rounded-lg border text-sm" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </>
          )}
          <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white gap-2" disabled={isLoading} onClick={handleExport}><Download className="w-4 h-4" /> Export</Button>
          <Button variant="outline" disabled={isLoading} onClick={() => setRefreshKey(k => k+1)}><RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} /></Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Estimated Reach", value: totalSent.toLocaleString(), icon: Bell, color: "from-blue-500 to-cyan-600" },
          { label: "Nudge Campaigns", value: aggregates.length.toString(), icon: Target, color: "from-purple-500 to-pink-600" },
          { label: "Channels Used", value: distinctChannels.toString(), icon: Users, color: "from-green-500 to-emerald-600" },
          { label: "Avg Recipients", value: avgRecipients.toFixed(1), icon: TrendingUp, color: "from-orange-500 to-amber-600" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="p-4">
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center mb-2`}><Icon className="w-4 h-4 text-white" /></div>
              <p className="text-xl font-bold text-gray-900">{isLoading ? "—" : s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      {!isLoading && aggregates.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="p-5">
            <h3 className="font-bold text-gray-900 mb-4">Delivery Trend</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="sent" stroke="#6366f1" fill="#6366f120" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
          {channelData.length > 0 && (
            <Card className="p-5">
              <h3 className="font-bold text-gray-900 mb-4">By Channel</h3>
              <ResponsiveContainer width="100%" height={200}>
                <RechartsPie>
                  <Pie data={channelData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${percent}%`}>
                    {channelData.map((c, i) => <Cell key={i} fill={c.color} />)}
                  </Pie>
                  <Tooltip />
                </RechartsPie>
              </ResponsiveContainer>
            </Card>
          )}
        </div>
      )}

      {!isLoading && aggregates.length === 0 && (
        <Card className="p-12 text-center"><BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No data for this period</p></Card>
      )}

      {/* Top campaigns table */}
      {aggregates.length > 0 && (
        <Card className="p-5">
          <h3 className="font-bold text-gray-900 mb-4">Top Campaigns by Reach</h3>
          <div className="space-y-2">
            {aggregates.sort((a,b) => b.recipients-a.recipients).slice(0,10).map(c => (
              <div key={c.key} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                <div>
                  <p className="font-medium text-sm text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-500">{c.audience} · {c.channel}</p>
                </div>
                <p className="font-bold text-gray-900">{c.recipients.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Main NudgeCenter ──────────────────────────────────────────────────────────

const NUDGE_TABS = [
  { id: "nudges", label: "Nudges", icon: Bell },
  { id: "templates", label: "Templates", icon: FileText },
  { id: "schedule", label: "Schedule", icon: Calendar },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
] as const;

type NudgeTabId = typeof NUDGE_TABS[number]["id"];

export function NudgeCenter() {
  const [activeTab, setActiveTab] = useState<NudgeTabId>("nudges");

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl font-bold text-gray-900 mb-1">Nudge Center</h1>
          <p className="text-gray-500">Manage nudges, templates, campaign schedules and performance analytics</p>
        </motion.div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit border border-gray-200">
          {NUDGE_TABS.map(tab => {
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
            {activeTab === "nudges" && <NudgesTab />}
            {activeTab === "templates" && <TemplatesTab />}
            {activeTab === "schedule" && <ScheduleTab />}
            {activeTab === "analytics" && <AnalyticsTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </AdminLayoutNew>
  );
}
