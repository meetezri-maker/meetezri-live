import { motion, AnimatePresence } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { 
  Bell,
  Send,
  Users,
  Calendar,
  Target,
  CheckCircle,
  Clock,
  BarChart3,
  Edit,
  Trash2,
  Plus,
  X
} from "lucide-react";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";

interface Notification {
  id: string;
  title: string;
  message: string;
  target: "all" | "core" | "pro" | "trial" | "segment";
  segmentId?: string | null;
  segmentName?: string;
  scheduledFor?: Date;
  sentAt?: Date;
  status: "draft" | "scheduled" | "sent" | "failed";
  deliveredCount?: number;
  clickRate?: number;
  priority: "low" | "medium" | "high";
}

export function PushNotifications() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"send" | "scheduled" | "history">("send");
  
  // Form states
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState<"all" | "core" | "pro" | "trial" | "segment">("all");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [scheduleDateTime, setScheduleDateTime] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [segments, setSegments] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  // Edit/Delete modals
  const [editingNotification, setEditingNotification] = useState<Notification | null>(null);
  const [deletingNotification, setDeletingNotification] = useState<Notification | null>(null);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await api.admin.getUserSegments();
        const list = Array.isArray(raw) ? raw : (raw as { segments?: unknown }).segments ?? [];
        setSegments(
          (list as { id: string; name: string }[]).map((s) => ({
            id: s.id,
            name: s.name,
          }))
        );
        if (list.length > 0) {
          setSegmentId((list[0] as { id: string }).id);
        }
      } catch {
        setSegments([]);
      }
    })();
  }, []);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const data = await api.admin.getPushCampaigns();
      const rows = Array.isArray(data) ? data : [];
      setNotifications(
        rows.map((n: any) => {
          const m = (n.metrics || {}) as Record<string, unknown>;
          const ta = (m.target_audience as string) || (n.target_segment_id ? "segment" : "all");
          return {
            id: n.id,
            title: n.title,
            message: n.message,
            target: ta === "segment" ? "segment" : (ta as Notification["target"]),
            segmentId: n.target_segment_id ?? null,
            segmentName: undefined,
            scheduledFor: n.scheduled_at ? new Date(n.scheduled_at) : undefined,
            sentAt: n.sent_at ? new Date(n.sent_at) : undefined,
            status: n.status,
            deliveredCount: typeof m.delivered_count === "number" ? m.delivered_count : 0,
            clickRate: typeof m.click_rate === "number" ? m.click_rate : 0,
            priority: (m.priority as Notification["priority"]) || "medium",
          };
        })
      );
    } catch (error) {
      console.error("Failed to fetch push campaigns:", error);
      toast.error("Failed to load notifications");
    } finally {
      setIsLoading(false);
    }
  };

  const scheduledNotifications = notifications.filter(n => n.status === "scheduled");
  const sentNotifications = notifications.filter(n => n.status === "sent");

  const getStatusColor = (status: string) => {
    switch(status) {
      case "draft": return "bg-gray-100 text-gray-700";
      case "scheduled": return "bg-blue-100 text-blue-700";
      case "sent": return "bg-green-100 text-green-700";
      case "failed": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case "high": return "bg-red-100 text-red-700";
      case "medium": return "bg-yellow-100 text-yellow-700";
      case "low": return "bg-green-100 text-green-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getTargetColor = (target: string) => {
    switch(target) {
      case "all": return "bg-purple-100 text-purple-700";
      case "core": return "bg-blue-100 text-blue-700";
      case "pro": return "bg-indigo-100 text-indigo-700";
      case "trial": return "bg-green-100 text-green-700";
      case "segment": return "bg-pink-100 text-pink-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const formatTimeUntil = (date: Date) => {
    const hours = Math.floor((date.getTime() - Date.now()) / (1000 * 60 * 60));
    if (hours < 1) {
      const minutes = Math.floor((date.getTime() - Date.now()) / (1000 * 60));
      return `in ${minutes}m`;
    }
    if (hours < 24) return `in ${hours}h`;
    return `in ${Math.floor(hours / 24)}d`;
  };

  const stats = {
    scheduled: scheduledNotifications.length,
    sent: sentNotifications.length,
    totalDelivered: sentNotifications.reduce((sum, n) => sum + (n.deliveredCount || 0), 0),
    avgClickRate:
      sentNotifications.length > 0
        ? (
            sentNotifications.reduce((sum, n) => sum + (n.clickRate || 0), 0) /
            sentNotifications.length
          ).toFixed(1)
        : "0.0",
  };

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setTarget("all");
    setPriority("medium");
    setScheduleDateTime("");
    if (segments[0]) setSegmentId(segments[0].id);
  };

  const buildCampaignBody = (status: "draft" | "scheduled") => {
    if (target === "segment" && !segmentId) {
      throw new Error("Select a user segment");
    }
    return {
      title,
      message,
      status,
      scheduled_at:
        status === "scheduled" && scheduleDateTime
          ? new Date(scheduleDateTime).toISOString()
          : null,
      target_segment_id: target === "segment" ? segmentId : null,
      metrics: { target_audience: target, priority },
    };
  };

  function campaignIdFromResponse(created: unknown): string {
    if (created && typeof created === "object" && "id" in created) {
      return String((created as { id: unknown }).id);
    }
    return "";
  }

  const handleSendNow = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Please fill in both title and message");
      return;
    }
    if (target === "segment" && !segmentId) {
      toast.error("Select a segment");
      return;
    }
    try {
      setSaving(true);
      if (scheduleDateTime) {
        await api.admin.createPushCampaign(buildCampaignBody("scheduled"));
        toast.success("Notification scheduled");
      } else {
        const created = await api.admin.createPushCampaign(buildCampaignBody("draft"));
        const id = campaignIdFromResponse(created);
        if (!id) {
          throw new Error("Server did not return a campaign id");
        }
        await api.admin.dispatchPushCampaign(id);
        toast.success("Push notification sent");
      }
      resetForm();
      await fetchNotifications();
    } catch (e: unknown) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Please fill in both title and message");
      return;
    }
    if (target === "segment" && !segmentId) {
      toast.error("Select a segment");
      return;
    }
    try {
      setSaving(true);
      await api.admin.createPushCampaign(buildCampaignBody("draft"));
      toast.success("Draft saved");
      resetForm();
      await fetchNotifications();
    } catch (e: unknown) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to save draft");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (notification: Notification) => {
    setEditingNotification(notification);
    setTitle(notification.title);
    setMessage(notification.message);
    setTarget(notification.target);
    setPriority(notification.priority);
    setSegmentId(notification.segmentId || segments[0]?.id || "");
  };

  const handleSaveEdit = async () => {
    if (!editingNotification) return;
    if (target === "segment" && !segmentId) {
      toast.error("Select a segment");
      return;
    }
    try {
      setSaving(true);
      await api.admin.updatePushCampaign(editingNotification.id, {
        title,
        message,
        target_segment_id: target === "segment" ? segmentId : null,
        metrics: { target_audience: target, priority },
      });
      toast.success("Campaign updated");
      setEditingNotification(null);
      resetForm();
      await fetchNotifications();
    } catch (e) {
      console.error(e);
      toast.error("Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (notification: Notification) => {
    setDeletingNotification(notification);
  };

  const confirmDelete = async () => {
    if (!deletingNotification) return;
    try {
      setSaving(true);
      await api.admin.deletePushCampaign(deletingNotification.id);
      toast.success("Notification removed");
      setDeletingNotification(null);
      await fetchNotifications();
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNotification = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Please fill in both title and message");
      return;
    }
    if (target === "segment" && !segmentId) {
      toast.error("Select a segment");
      return;
    }
    try {
      setSaving(true);
      if (scheduleDateTime) {
        await api.admin.createPushCampaign(buildCampaignBody("scheduled"));
        toast.success("Scheduled");
      } else {
        const created = await api.admin.createPushCampaign(buildCampaignBody("draft"));
        const id = campaignIdFromResponse(created);
        if (!id) {
          throw new Error("Server did not return a campaign id");
        }
        await api.admin.dispatchPushCampaign(id);
        toast.success("Sent");
      }
      setShowCreateModal(false);
      resetForm();
      await fetchNotifications();
    } catch (e: unknown) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
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
            <h1 className="text-3xl font-bold text-gray-900">Push Notifications</h1>
            <p className="text-gray-600 mt-1">Send targeted notifications to users</p>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center gap-2 shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Create Notification
          </motion.button>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Scheduled</p>
                <p className="text-2xl font-bold text-gray-900">{stats.scheduled}</p>
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
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Sent</p>
                <p className="text-2xl font-bold text-gray-900">{stats.sent}</p>
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
                <Send className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Delivered</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalDelivered.toLocaleString()}</p>
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
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Avg Click Rate</p>
                <p className="text-2xl font-bold text-gray-900">{stats.avgClickRate}%</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-2 shadow-lg border border-gray-100 flex gap-2"
        >
          <button
            onClick={() => setSelectedTab("send")}
            className={`flex-1 px-4 py-2 rounded-xl font-medium transition-colors ${
              selectedTab === "send"
                ? "bg-blue-500 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Send className="w-4 h-4 inline mr-2" />
            Send New
          </button>
          <button
            onClick={() => setSelectedTab("scheduled")}
            className={`flex-1 px-4 py-2 rounded-xl font-medium transition-colors ${
              selectedTab === "scheduled"
                ? "bg-blue-500 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Clock className="w-4 h-4 inline mr-2" />
            Scheduled ({scheduledNotifications.length})
          </button>
          <button
            onClick={() => setSelectedTab("history")}
            className={`flex-1 px-4 py-2 rounded-xl font-medium transition-colors ${
              selectedTab === "history"
                ? "bg-blue-500 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <CheckCircle className="w-4 h-4 inline mr-2" />
            History ({sentNotifications.length})
          </button>
        </motion.div>

        {/* Send New Tab */}
        {selectedTab === "send" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-6">Compose Notification</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Daily Wellness Reminder"
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter your notification message..."
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">Max 200 characters recommended</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Target Audience</label>
                  <select 
                    value={target}
                    onChange={(e) => setTarget(e.target.value as "all" | "core" | "pro" | "trial" | "segment")}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="all">All Users</option>
                    <option value="core">Core Plan Users</option>
                    <option value="pro">Pro Plan Users</option>
                    <option value="trial">Trial Users</option>
                    <option value="segment">Custom Segment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <select 
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              {target === "segment" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">User segment</label>
                  <select
                    value={segmentId}
                    onChange={(e) => setSegmentId(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {segments.length === 0 ? (
                      <option value="">No segments — create one under User Segmentation</option>
                    ) : (
                      segments.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Schedule (Optional)</label>
                <input
                  type="datetime-local"
                  value={scheduleDateTime}
                  onChange={(e) => setScheduleDateTime(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  onClick={() => void handleSendNow()}
                  disabled={saving}
                  className="flex-1 min-h-12 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium disabled:opacity-50"
                >
                  <Send className="w-4 h-4 inline mr-2" />
                  {saving ? "Working…" : scheduleDateTime ? "Schedule" : "Send Now"}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleSaveDraft()}
                  disabled={saving}
                  className="min-h-12 rounded-xl disabled:opacity-50"
                >
                  Save Draft
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Scheduled Tab */}
        {selectedTab === "scheduled" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-6">Scheduled Notifications</h2>

            <div className="space-y-4">
              {scheduledNotifications.map((notification, index) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-gray-900">{notification.title}</h3>
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getPriorityColor(notification.priority)}`}>
                          {notification.priority}
                        </span>
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getTargetColor(notification.target)}`}>
                          {notification.target}
                        </span>
                      </div>

                      <p className="text-gray-700 mb-3">{notification.message}</p>

                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {notification.scheduledFor && (
                            <span>{formatTimeUntil(notification.scheduledFor)}</span>
                          )}
                        </div>
                        {notification.segmentName && (
                          <div className="flex items-center gap-1">
                            <Target className="w-4 h-4" />
                            <span>{notification.segmentName}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleEdit(notification)}
                        className="p-2 rounded-lg hover:bg-blue-50 text-blue-600"
                      >
                        <Edit className="w-4 h-4" />
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleDelete(notification)}
                        className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* History Tab */}
        {selectedTab === "history" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-6">Sent Notifications</h2>

            <div className="space-y-4">
              {sentNotifications.map((notification, index) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="border border-gray-200 rounded-xl p-5"
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-gray-900">{notification.title}</h3>
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(notification.status)}`}>
                          {notification.status}
                        </span>
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getTargetColor(notification.target)}`}>
                          {notification.target}
                        </span>
                      </div>

                      <p className="text-gray-700 mb-3">{notification.message}</p>

                      {notification.sentAt && (
                        <p className="text-sm text-gray-600">
                          Sent {notification.sentAt.toLocaleDateString()} at {notification.sentAt.toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                    <div>
                      <p className="text-xs text-gray-600">Delivered</p>
                      <p className="text-lg font-bold text-gray-900">{notification.deliveredCount?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Click Rate</p>
                      <p className="text-lg font-bold text-gray-900">{notification.clickRate}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Clicks</p>
                      <p className="text-lg font-bold text-gray-900">
                        {notification.deliveredCount && notification.clickRate 
                          ? Math.round(notification.deliveredCount * notification.clickRate / 100)
                          : 0}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Create Modal */}
        <AnimatePresence>
          {showCreateModal && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                onClick={() => setShowCreateModal(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={() => setShowCreateModal(false)}
              >
                <div
                  className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                    <h2 className="text-2xl font-bold text-gray-900">Create Notification</h2>
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>

                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g., Daily Wellness Reminder"
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Message *</label>
                      <textarea
                        rows={4}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Enter your notification message..."
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">{message.length} / 200 characters</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Target Audience</label>
                        <select 
                          value={target}
                          onChange={(e) => setTarget(e.target.value as "all" | "core" | "pro" | "trial" | "segment")}
                          className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value="all">All Users</option>
                          <option value="trial">Trial Users</option>
                          <option value="core">Core Users</option>
                          <option value="pro">Pro Users</option>
                          <option value="segment">Custom Segment</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                        <select 
                          value={priority}
                          onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}
                          className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>
                    </div>

                    {target === "segment" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">User segment</label>
                        <select
                          value={segmentId}
                          onChange={(e) => setSegmentId(e.target.value)}
                          className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          {segments.length === 0 ? (
                            <option value="">No segments — create one under User Segmentation</option>
                          ) : (
                            segments.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Schedule (Optional)</label>
                      <input
                        type="datetime-local"
                        value={scheduleDateTime}
                        onChange={(e) => setScheduleDateTime(e.target.value)}
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">Leave empty to send immediately</p>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button
                        type="button"
                        onClick={() => void handleCreateNotification()}
                        disabled={saving}
                        className="flex-1 min-h-12 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium disabled:opacity-50"
                      >
                        {saving ? "Working…" : scheduleDateTime ? "Schedule Notification" : "Send Now"}
                      </Button>

                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setShowCreateModal(false)}
                        disabled={saving}
                        className="min-h-12 rounded-xl disabled:opacity-50"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Edit Modal */}
        <AnimatePresence>
          {editingNotification && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                onClick={() => setEditingNotification(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={() => setEditingNotification(null)}
              >
                <div
                  className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                    <h2 className="text-2xl font-bold text-gray-900">Edit Notification</h2>
                    <button
                      onClick={() => setEditingNotification(null)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>

                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Message *</label>
                      <textarea
                        rows={4}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Target Audience</label>
                        <select 
                          value={target}
                          onChange={(e) => setTarget(e.target.value as "all" | "core" | "pro" | "trial" | "segment")}
                          className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value="all">All Users</option>
                          <option value="trial">Trial Users</option>
                          <option value="core">Core Users</option>
                          <option value="pro">Pro Users</option>
                          <option value="segment">Custom Segment</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                        <select 
                          value={priority}
                          onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}
                          className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>
                    </div>

                    {target === "segment" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">User segment</label>
                        <select
                          value={segmentId}
                          onChange={(e) => setSegmentId(e.target.value)}
                          className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          {segments.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex gap-3 pt-4">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSaveEdit}
                        disabled={saving}
                        className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium disabled:opacity-50"
                      >
                        Save Changes
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setEditingNotification(null)}
                        disabled={saving}
                        className="px-4 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium disabled:opacity-50"
                      >
                        Cancel
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {deletingNotification && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                onClick={() => setDeletingNotification(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={() => setDeletingNotification(null)}
              >
                <div
                  className="bg-white rounded-2xl shadow-2xl max-w-md w-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-6">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                      <Trash2 className="w-6 h-6 text-red-600" />
                    </div>
                    
                    <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Delete Notification?</h2>
                    <p className="text-gray-600 text-center mb-6">
                      Are you sure you want to delete "{deletingNotification.title}"? This action cannot be undone.
                    </p>

                    <div className="flex gap-3">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={confirmDelete}
                        className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium"
                      >
                        Delete
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setDeletingNotification(null)}
                        className="flex-1 px-4 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                      >
                        Cancel
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </AdminLayoutNew>
  );
}
