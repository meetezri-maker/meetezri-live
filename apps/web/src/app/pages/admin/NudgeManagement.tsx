import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { AnimatePresence } from "motion/react";
import {
  Bell,
  Plus,
  Edit,
  Trash2,
  Copy,
  BarChart3,
  Users,
  Clock,
  Target,
  Search,
  Filter,
  Calendar,
  MessageSquare,
  TrendingUp,
  Eye,
  Send,
  AlertCircle,
  CheckCircle,
  Pause,
  Play,
  X,
  Save,
  Upload,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

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

const initialNudges: Nudge[] = [];

const mapApiNudge = (apiNudge: any, previous?: Nudge): Nudge => {
  const meta = (apiNudge?.target_audience || {}) as any;
  const createdAt = apiNudge?.created_at ? new Date(apiNudge.created_at) : new Date();
  return {
    id: apiNudge.id || previous?.id || "",
    title: apiNudge.title || previous?.title || "",
    message: apiNudge.message || previous?.message || "",
    type:
      (apiNudge.type as Nudge["type"]) ||
      previous?.type ||
      "motivational",
    status:
      (apiNudge.status as Nudge["status"]) ||
      previous?.status ||
      "draft",
    trigger: meta.trigger || previous?.trigger || "Custom trigger",
    targetAudience:
      meta.targetAudience ||
      meta.label ||
      previous?.targetAudience ||
      "All active users",
    schedule: meta.schedule || previous?.schedule || "Daily",
    sentCount: previous?.sentCount ?? 0,
    openRate: previous?.openRate ?? 0,
    clickRate: previous?.clickRate ?? 0,
    createdDate:
      previous?.createdDate ||
      createdAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    lastSent: meta.lastSent || previous?.lastSent,
  };
};

export function NudgeManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [nudges, setNudges] = useState<Nudge[]>(initialNudges);
  const [viewModalNudge, setViewModalNudge] = useState<Nudge | null>(null);
  const [editModalNudge, setEditModalNudge] = useState<Nudge | null>(null);
  const [deleteModalNudge, setDeleteModalNudge] = useState<Nudge | null>(null);
  const [analyticsModalNudge, setAnalyticsModalNudge] = useState<Nudge | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
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
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadNudges = async () => {
      try {
        setIsLoading(true);
        const data = await api.admin.getNudges();
        const mapped: Nudge[] = Array.isArray(data)
          ? data.map((n: any) => mapApiNudge(n))
          : [];
        setNudges(mapped);
      } catch (error: any) {
        console.error("Failed to load nudges", error);
        toast.error(error.message || "Failed to load nudges");
      } finally {
        setIsLoading(false);
      }
    };

    loadNudges();
  }, []);

  const formatCreatedDate = () => {
    const date = new Date();
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const sendNudgeToUsers = async (nudge: Nudge) => {
    try {
      const result = await api.admin.createManualNotification({
        title: nudge.title,
        message: nudge.message,
        channel: "push",
        target_audience: "all",
      } as any);
      const sentCount =
        result && typeof result.count === "number" ? result.count : 0;
      const lastSent = new Date().toLocaleString();

      try {
        const targetAudienceMeta = {
          label: nudge.targetAudience,
          trigger: nudge.trigger,
          schedule: nudge.schedule,
          lastSent,
        };
        const updated = await api.admin.updateNudge(nudge.id, {
          status: "active",
          target_audience: targetAudienceMeta,
        });
        setNudges((prev) =>
          prev.map((n) =>
            n.id === nudge.id
              ? mapApiNudge(updated, {
                  ...n,
                  sentCount: n.sentCount + sentCount,
                  lastSent,
                })
              : n
          )
        );
      } catch (updateError: any) {
        console.error("Failed to update nudge after sending", updateError);
      }

      if (sentCount > 0) {
        toast.success(`Nudge sent to ${sentCount.toLocaleString()} users`);
      } else {
        toast.success("Nudge published");
      }
    } catch (error: any) {
      console.error("Failed to send nudge", error);
      toast.error(error.message || "Failed to send nudge");
    }
  };

  const handleCreateNudge = async () => {
    if (!newTitle.trim() || !newMessage.trim()) {
      toast.error("Title and message are required");
      return;
    }
    try {
      const targetAudienceMeta = {
        label: newTargetAudience.trim() || "All active users",
        trigger: newTrigger.trim() || "Custom trigger",
        schedule: newSchedule,
      };
      const createdApiNudge = await api.admin.createNudge({
        title: newTitle.trim(),
        message: newMessage.trim(),
        type: newType,
        status: "draft",
        target_audience: targetAudienceMeta,
      });
      const created = mapApiNudge(createdApiNudge);
      setNudges((prev) => [created, ...prev]);
      setShowCreateModal(false);
      setNewTitle("");
      setNewMessage("");
      setNewType("motivational");
      setNewSchedule("Daily");
      setNewTargetAudience("");
      setNewTrigger("");
      toast.success("Nudge created");
    } catch (error: any) {
      console.error("Failed to create nudge", error);
      toast.error(error.message || "Failed to create nudge");
    }
  };

  const openEditModal = (nudge: Nudge) => {
    setEditModalNudge(nudge);
    setEditTitle(nudge.title);
    setEditMessage(nudge.message);
    setEditType(nudge.type);
    setEditStatus(nudge.status);
    setEditTrigger(nudge.trigger);
    setEditSchedule(nudge.schedule);
    setEditTargetAudience(nudge.targetAudience);
  };

  const handleSaveEdit = async () => {
    if (!editModalNudge) return;

    if (!editTitle.trim() || !editMessage.trim()) {
      toast.error("Title and message are required");
      return;
    }

    try {
      const targetAudienceMeta = {
        label: editTargetAudience.trim() || editModalNudge.targetAudience,
        trigger: editTrigger.trim() || editModalNudge.trigger,
        schedule: editSchedule || editModalNudge.schedule,
        lastSent: editModalNudge.lastSent,
      };
      const updatedApiNudge = await api.admin.updateNudge(editModalNudge.id, {
        title: editTitle.trim(),
        message: editMessage.trim(),
        type: editType,
        status: editStatus,
        target_audience: targetAudienceMeta,
      });
      setNudges((prev) =>
        prev.map((n) =>
          n.id === editModalNudge.id ? mapApiNudge(updatedApiNudge, n) : n
        )
      );
      setEditModalNudge(null);
      toast.success("Nudge updated");
    } catch (error: any) {
      console.error("Failed to update nudge", error);
      toast.error(error.message || "Failed to update nudge");
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteModalNudge) return;
    try {
      await api.admin.deleteNudge(deleteModalNudge.id);
      setNudges((prev) => prev.filter((n) => n.id !== deleteModalNudge.id));
      toast.success("Nudge deleted");
      setDeleteModalNudge(null);
    } catch (error: any) {
      console.error("Failed to delete nudge", error);
      toast.error(error.message || "Failed to delete nudge");
    }
  };

  const updateNudgeStatus = async (id: string, status: Nudge["status"]) => {
    try {
      const existing = nudges.find((n) => n.id === id);
      const targetAudienceMeta = existing
        ? {
            label: existing.targetAudience,
            trigger: existing.trigger,
            schedule: existing.schedule,
            lastSent: existing.lastSent,
          }
        : undefined;
      const updatedApiNudge = await api.admin.updateNudge(id, {
        status,
        target_audience: targetAudienceMeta,
      });
      setNudges((prev) =>
        prev.map((n) => (n.id === id ? mapApiNudge(updatedApiNudge, n) : n))
      );
    } catch (error: any) {
      console.error("Failed to update nudge status", error);
      toast.error(error.message || "Failed to update nudge status");
    }
  };

  const handleCopyTitle = (nudge: Nudge) => {
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(nudge.title)
        .then(() => {
          toast.success("Nudge title copied");
        })
        .catch(() => {
          toast.error("Failed to copy title");
        });
    } else {
      toast.success("Copy not supported in this browser");
    }
  };

  const filteredNudges = nudges.filter((nudge) => {
    const matchesSearch =
      nudge.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      nudge.message.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "all" || nudge.type === filterType;
    const matchesStatus = filterStatus === "all" || nudge.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const stats = {
    total: nudges.length,
    active: nudges.filter((n) => n.status === "active").length,
    draft: nudges.filter((n) => n.status === "draft").length,
    paused: nudges.filter((n) => n.status === "paused").length,
    totalSent: nudges.reduce((sum, n) => sum + n.sentCount, 0),
    avgOpenRate:
      nudges.length > 0
        ? (nudges.reduce((sum, n) => sum + n.openRate, 0) / nudges.length).toFixed(1)
        : "0.0",
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "motivational":
        return "bg-purple-100 text-purple-700 border-purple-300";
      case "reminder":
        return "bg-blue-100 text-blue-700 border-blue-300";
      case "milestone":
        return "bg-green-100 text-green-700 border-green-300";
      case "wellness-tip":
        return "bg-orange-100 text-orange-700 border-orange-300";
      case "check-in":
        return "bg-pink-100 text-pink-700 border-pink-300";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-700 border-green-300";
      case "draft":
        return "bg-gray-100 text-gray-700 border-gray-300";
      case "paused":
        return "bg-yellow-100 text-yellow-700 border-yellow-300";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getSentDisplay = (nudge: Nudge) => {
    if (!nudge.lastSent) {
      return 0;
    }
    return nudge.sentCount;
  };

  return (
    <AdminLayoutNew>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                <Bell className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Nudge Management</h1>
                <p className="text-muted-foreground">
                  Create and manage motivational messages and reminders
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2" onClick={() => setShowImportModal(true)}>
                <Upload className="w-4 h-4" />
                Import
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => setShowCreateTemplateModal(true)}>
                <FileText className="w-4 h-4" />
                Create Template
              </Button>
              <Button className="gap-2" onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4" />
                Create Nudge
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Nudges</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Bell className="w-8 h-8 text-primary" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Active</p>
                  <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Draft</p>
                  <p className="text-2xl font-bold text-gray-600">{stats.draft}</p>
                </div>
                <Edit className="w-8 h-8 text-gray-500" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Paused</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.paused}</p>
                </div>
                <Pause className="w-8 h-8 text-yellow-500" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Sent</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {(stats.totalSent / 1000).toFixed(1)}K
                  </p>
                </div>
                <Send className="w-8 h-8 text-blue-500" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Avg Open Rate</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.avgOpenRate}%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-500" />
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search nudges..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <select
                  className="px-3 py-2 border rounded-lg"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="all">All Types</option>
                  <option value="motivational">Motivational</option>
                  <option value="reminder">Reminder</option>
                  <option value="milestone">Milestone</option>
                  <option value="wellness-tip">Wellness Tip</option>
                  <option value="check-in">Check-in</option>
                </select>
                <select
                  className="px-3 py-2 border rounded-lg"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Nudges Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredNudges.map((nudge, index) => (
            <motion.div
              key={nudge.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + index * 0.05 }}
            >
              <Card className="p-6 hover:shadow-lg transition-shadow">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-bold text-lg">{nudge.title}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(nudge.status)}`}>
                        {nudge.status}
                      </span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border inline-block ${getTypeColor(nudge.type)}`}>
                      {nudge.type.replace("-", " ")}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setViewModalNudge(nudge)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEditModal(nudge)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyTitle(nudge)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Message */}
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm">{nudge.message}</p>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Trigger</p>
                    <p className="font-medium">{nudge.trigger}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Schedule</p>
                    <p className="font-medium">{nudge.schedule}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Target Audience</p>
                    <p className="font-medium">{nudge.targetAudience}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Created</p>
                    <p className="font-medium">{nudge.createdDate}</p>
                  </div>
                </div>

                {/* Stats */}
                {nudge.status !== "draft" && (
                  <div className="border-t pt-4 mb-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-blue-600">
                          {getSentDisplay(nudge).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">Sent</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-600">{nudge.openRate}%</p>
                        <p className="text-xs text-muted-foreground">Open Rate</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-purple-600">{nudge.clickRate}%</p>
                        <p className="text-xs text-muted-foreground">Click Rate</p>
                      </div>
                    </div>
                  </div>
                )}

                {nudge.lastSent && (
                  <p className="text-xs text-muted-foreground mb-4">
                    Last sent: {nudge.lastSent}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {nudge.status === "active" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => {
                        updateNudgeStatus(nudge.id, "paused");
                        toast.success("Nudge paused");
                      }}
                    >
                      <Pause className="w-4 h-4" />
                      Pause
                    </Button>
                  )}
                  {nudge.status === "paused" && (
                    <Button
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => {
                        updateNudgeStatus(nudge.id, "active");
                        toast.success("Nudge activated");
                      }}
                    >
                      <Play className="w-4 h-4" />
                      Activate
                    </Button>
                  )}
                  {nudge.status === "draft" && (
                    <Button
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => sendNudgeToUsers(nudge)}
                    >
                      <Send className="w-4 h-4" />
                      Publish & Send
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={() => setAnalyticsModalNudge(nudge)}>
                    <BarChart3 className="w-4 h-4" />
                    Analytics
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDeleteModalNudge(nudge)}>
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Empty State */}
        {filteredNudges.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Bell className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-bold text-xl mb-2">No Nudges Found</h3>
            <p className="text-muted-foreground mb-4">
              No nudges match the current filters
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Nudge
            </Button>
          </motion.div>
        )}

        {/* Create Modal Placeholder */}
        <AnimatePresence>
          {showCreateModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setShowCreateModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">Create New Nudge</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCreateModal(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Nudge Title</label>
                    <Input
                      placeholder="Enter nudge title..."
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Message</label>
                    <textarea
                      className="w-full p-3 border rounded-lg"
                      rows={4}
                      placeholder="Enter your message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Type</label>
                      <select
                        className="w-full px-3 py-2 border rounded-lg"
                        value={newType}
                        onChange={(e) => setNewType(e.target.value as Nudge["type"])}
                      >
                        <option value="motivational">Motivational</option>
                        <option value="reminder">Reminder</option>
                        <option value="milestone">Milestone</option>
                        <option value="wellness-tip">Wellness Tip</option>
                        <option value="check-in">Check-in</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Schedule</label>
                      <select
                        className="w-full px-3 py-2 border rounded-lg"
                        value={newSchedule}
                        onChange={(e) => setNewSchedule(e.target.value)}
                      >
                        <option>Daily</option>
                        <option>Weekly</option>
                        <option>Triggered</option>
                        <option>Custom</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Trigger</label>
                    <Input
                      placeholder="e.g., Daily at 8:00 AM"
                      value={newTrigger}
                      onChange={(e) => setNewTrigger(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Target Audience</label>
                    <Input
                      placeholder="e.g., All active users"
                      value={newTargetAudience}
                      onChange={(e) => setNewTargetAudience(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowCreateModal(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button className="flex-1" onClick={handleCreateNudge}>
                      Create Nudge
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* View Modal */}
        <AnimatePresence>
          {viewModalNudge && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setViewModalNudge(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold">View Nudge</h2>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(viewModalNudge.status)}`}>
                      {viewModalNudge.status}
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setViewModalNudge(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Title</label>
                    <p className="text-lg font-semibold">{viewModalNudge.title}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Message</label>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p>{viewModalNudge.message}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">Type</label>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border inline-block ${getTypeColor(viewModalNudge.type)}`}>
                        {viewModalNudge.type.replace("-", " ")}
                      </span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">Schedule</label>
                      <p className="font-medium">{viewModalNudge.schedule}</p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Trigger</label>
                    <p className="font-medium">{viewModalNudge.trigger}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Target Audience</label>
                    <p className="font-medium">{viewModalNudge.targetAudience}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Created</label>
                    <p className="font-medium">{viewModalNudge.createdDate}</p>
                  </div>
                  
                  {viewModalNudge.status !== "draft" && (
                    <div className="border-t pt-4">
                      <label className="block text-sm font-medium text-gray-600 mb-3">Performance</label>
                      <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="p-3 bg-blue-50 rounded-lg">
                          <p className="text-2xl font-bold text-blue-600">
                            {getSentDisplay(viewModalNudge).toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-600">Sent</p>
                        </div>
                        <div className="p-3 bg-green-50 rounded-lg">
                          <p className="text-2xl font-bold text-green-600">{viewModalNudge.openRate}%</p>
                          <p className="text-xs text-gray-600">Open Rate</p>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-lg">
                          <p className="text-2xl font-bold text-purple-600">{viewModalNudge.clickRate}%</p>
                          <p className="text-xs text-gray-600">Click Rate</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setViewModalNudge(null)}
                    >
                      Close
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => {
                        openEditModal(viewModalNudge);
                        setViewModalNudge(null);
                      }}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit Modal */}
        <AnimatePresence>
          {editModalNudge && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setEditModalNudge(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">Edit Nudge</h2>
                  <Button variant="ghost" size="sm" onClick={() => setEditModalNudge(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Nudge Title</label>
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Message</label>
                    <textarea
                      className="w-full p-3 border rounded-lg"
                      rows={4}
                      value={editMessage}
                      onChange={(e) => setEditMessage(e.target.value)}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Type</label>
                      <select
                        className="w-full px-3 py-2 border rounded-lg"
                        value={editType}
                        onChange={(e) => setEditType(e.target.value as Nudge["type"])}
                      >
                        <option value="motivational">Motivational</option>
                        <option value="reminder">Reminder</option>
                        <option value="milestone">Milestone</option>
                        <option value="wellness-tip">Wellness Tip</option>
                        <option value="check-in">Check-in</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Status</label>
                      <select
                        className="w-full px-3 py-2 border rounded-lg"
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value as Nudge["status"])}
                      >
                        <option value="active">Active</option>
                        <option value="draft">Draft</option>
                        <option value="paused">Paused</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Trigger</label>
                    <Input
                      value={editTrigger}
                      onChange={(e) => setEditTrigger(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Schedule</label>
                    <select
                      className="w-full px-3 py-2 border rounded-lg"
                      value={editSchedule}
                      onChange={(e) => setEditSchedule(e.target.value)}
                    >
                      <option>Daily</option>
                      <option>Weekly</option>
                      <option>Triggered</option>
                      <option>Custom</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Target Audience</label>
                    <Input
                      value={editTargetAudience}
                      onChange={(e) => setEditTargetAudience(e.target.value)}
                    />
                  </div>
                  
                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setEditModalNudge(null)}
                    >
                      Cancel
                    </Button>
                    <Button className="flex-1" onClick={handleSaveEdit}>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Analytics Modal */}
        <AnimatePresence>
          {analyticsModalNudge && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setAnalyticsModalNudge(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">Analytics: {analyticsModalNudge.title}</h2>
                  <Button variant="ghost" size="sm" onClick={() => setAnalyticsModalNudge(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="space-y-6">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <Send className="w-5 h-5 text-blue-600" />
                        <TrendingUp className="w-4 h-4 text-blue-600" />
                      </div>
                      <p className="text-3xl font-bold text-blue-600">
                        {getSentDisplay(analyticsModalNudge).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600">Total Sent</p>
                    </div>
                    
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center justify-between mb-2">
                        <Eye className="w-5 h-5 text-green-600" />
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      </div>
                      <p className="text-3xl font-bold text-green-600">{analyticsModalNudge.openRate}%</p>
                      <p className="text-sm text-gray-600">Open Rate</p>
                    </div>
                    
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="flex items-center justify-between mb-2">
                        <Target className="w-5 h-5 text-purple-600" />
                        <TrendingUp className="w-4 h-4 text-purple-600" />
                      </div>
                      <p className="text-3xl font-bold text-purple-600">{analyticsModalNudge.clickRate}%</p>
                      <p className="text-sm text-gray-600">Click Rate</p>
                    </div>
                  </div>
                  
                  {/* Details */}
                  <div className="border-t pt-4">
                    <h3 className="font-bold text-lg mb-3">Nudge Details</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-gray-600 mb-1">Type</p>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border inline-block ${getTypeColor(analyticsModalNudge.type)}`}>
                          {analyticsModalNudge.type.replace("-", " ")}
                        </span>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-gray-600 mb-1">Status</p>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border inline-block ${getStatusBadge(analyticsModalNudge.status)}`}>
                          {analyticsModalNudge.status}
                        </span>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-gray-600 mb-1">Schedule</p>
                        <p className="font-medium text-gray-900">{analyticsModalNudge.schedule}</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-gray-600 mb-1">Created</p>
                        <p className="font-medium text-gray-900">{analyticsModalNudge.createdDate}</p>
                      </div>
                    </div>
                  </div>
                  
                  {analyticsModalNudge.lastSent && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-yellow-600" />
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Last sent:</span> {analyticsModalNudge.lastSent}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" className="flex-1" onClick={() => setAnalyticsModalNudge(null)}>
                      Close
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete Modal */}
        <AnimatePresence>
          {deleteModalNudge && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setDeleteModalNudge(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl p-6 max-w-md w-full"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-red-600">Delete Nudge</h2>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteModalNudge(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-900 mb-1">Are you sure you want to delete this nudge?</p>
                        <p className="text-sm text-gray-600">
                          This action cannot be undone. The nudge "{deleteModalNudge.title}" will be permanently deleted.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {deleteModalNudge.status !== "draft" && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-2">Current Performance:</p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="font-bold text-gray-900">{deleteModalNudge.sentCount.toLocaleString()}</p>
                          <p className="text-xs text-gray-600">Sent</p>
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{deleteModalNudge.openRate}%</p>
                          <p className="text-xs text-gray-600">Opens</p>
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{deleteModalNudge.clickRate}%</p>
                          <p className="text-xs text-gray-600">Clicks</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setDeleteModalNudge(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                      onClick={handleDeleteConfirmed}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Import Modal */}
        <AnimatePresence>
          {showImportModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setShowImportModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">Import Nudges</h2>
                  <Button variant="ghost" size="sm" onClick={() => setShowImportModal(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <div className="p-6 border-2 border-dashed border-gray-300 rounded-lg text-center">
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <h3 className="font-semibold text-lg mb-2">Upload Nudges File</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Drag and drop your CSV or JSON file here, or click to browse
                    </p>
                    <input
                      type="file"
                      accept=".csv,.json"
                      className="hidden"
                      id="file-upload"
                    />
                    <label htmlFor="file-upload">
                      <Button variant="outline" className="cursor-pointer" asChild>
                        <span>Browse Files</span>
                      </Button>
                    </label>
                  </div>
                  
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">File Format Requirements:</h4>
                    <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                      <li>CSV or JSON format</li>
                      <li>Required fields: title, message, type, trigger</li>
                      <li>Optional fields: targetAudience, schedule, status</li>
                      <li>Maximum file size: 5MB</li>
                    </ul>
                  </div>
                  
                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowImportModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => {
                        toast.success("Nudges imported successfully");
                        setShowImportModal(false);
                      }}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Import Nudges
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create Template Modal */}
        <AnimatePresence>
          {showCreateTemplateModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setShowCreateTemplateModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">Create Nudge Template</h2>
                  <Button variant="ghost" size="sm" onClick={() => setShowCreateTemplateModal(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Template Name</label>
                    <Input placeholder="e.g., Morning Check-in Template" />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Description</label>
                    <textarea
                      className="w-full p-3 border rounded-lg"
                      rows={2}
                      placeholder="Brief description of this template..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Message Template</label>
                    <textarea
                      className="w-full p-3 border rounded-lg font-mono text-sm"
                      rows={4}
                      placeholder="Use variables like {{user_name}}, {{date}}, {{time}}..."
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Category</label>
                      <select className="w-full px-3 py-2 border rounded-lg">
                        <option>Motivational</option>
                        <option>Reminder</option>
                        <option>Milestone</option>
                        <option>Wellness Tip</option>
                        <option>Check-in</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Default Schedule</label>
                      <select className="w-full px-3 py-2 border rounded-lg">
                        <option>Daily</option>
                        <option>Weekly</option>
                        <option>Triggered</option>
                        <option>Custom</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Available Variables</label>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex flex-wrap gap-2">
                        {['{{user_name}}', '{{date}}', '{{time}}', '{{day}}', '{{streak}}', '{{points}}'].map(variable => (
                          <span key={variable} className="px-2 py-1 bg-white border rounded text-xs font-mono">
                            {variable}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex gap-2">
                      <AlertCircle className="w-5 h-5 text-purple-600 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-purple-900 font-medium mb-1">Template Tips</p>
                        <p className="text-sm text-purple-800">
                          Use variables to personalize messages. Templates can be reused across multiple nudge campaigns.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowCreateTemplateModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => {
                        toast.success("Template created successfully");
                        setShowCreateTemplateModal(false);
                      }}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Create Template
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminLayoutNew>
  );
}
