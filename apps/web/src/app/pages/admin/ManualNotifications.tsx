import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Send,
  Users,
  Bell,
  Mail,
  MessageSquare,
  Calendar,
  Target,
  Filter,
  Eye,
  Paperclip,
  Image as ImageIcon,
  Smile,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface SentNotification {
  id: string;
  title: string;
  message: string;
  channel: "push" | "email" | "in-app" | "sms";
  audience: {
    segment: string;
    count: number;
  };
  status: "sent" | "scheduled" | "failed";
  sentAt: string;
  sentBy: string;
  performance?: {
    delivered: number;
    opened: number;
    clicked: number;
  };
}

interface Segment {
  id: string;
  name: string;
  count: number;
}

interface AudienceCounts {
  all: number;
  active: number;
  premium: number;
  trial: number;
}

export function ManualNotifications() {
  const [channel, setChannel] = useState<"push" | "email" | "in-app" | "sms">("push");
  const [audienceType, setAudienceType] = useState<"all" | "segment" | "specific">(
    "all"
  );
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [scheduleType, setScheduleType] = useState<"now" | "scheduled">("now");
  const [selectedSegment, setSelectedSegment] = useState<string>("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [recentNotifications, setRecentNotifications] = useState<SentNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [specificUsers, setSpecificUsers] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [allUsers, setAllUsers] = useState<
    { id: string; name: string; email: string }[]
  >([]);
  const [audienceCounts, setAudienceCounts] = useState<AudienceCounts>({
    all: 0,
    active: 0,
    premium: 0,
    trial: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [segmentsData, notificationsData, countsData, usersData] =
        await Promise.all([
          api.admin.getUserSegments(),
          api.admin.getManualNotifications(),
          api.admin.getNotificationAudienceCounts(),
          api.admin.getUsers(),
        ]);
      
      setSegments(segmentsData.map((s: any) => ({
        id: s.id,
        name: s.name,
        count: s.user_count
      })));

      if (segmentsData.length > 0) {
        setSelectedSegment(segmentsData[0].id);
      }

      setAudienceCounts({
        all: countsData.all || 0,
        active: countsData.active || 0,
        premium: countsData.premium || 0,
        trial: countsData.trial || 0,
      });

      setAllUsers(
        (usersData || []).map((u: any) => ({
          id: u.id,
          name: u.full_name || (u.email ? u.email.split("@")[0] : "User"),
          email: u.email || "",
        }))
      );

      setRecentNotifications(notificationsData.map((n: any) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        channel: n.metadata?.channel || "push",
        audience: {
          segment: n.metadata?.target_audience === "all"
            ? "All Users"
            : n.metadata?.target_audience === "premium"
            ? "Premium Users"
            : n.metadata?.target_audience === "trial"
            ? "Trial Users"
            : n.metadata?.target_audience === "active"
            ? "Active Users"
            : n.metadata?.target_audience === "segment"
            ? "Segment"
            : "Targeted",
          count: n.metadata?.target_count || 0
        },
        status: n.metadata?.schedule_type === "scheduled" ? "scheduled" : "sent",
        sentAt: new Date(
          n.metadata?.scheduled_for || n.created_at
        ).toLocaleString(),
        sentBy: "Admin", // In a real app, this would come from the user context
        performance: {
          delivered: n.metadata?.target_count || 0,
          opened: 0,
          clicked: 0
        }
      })));
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast.error("Failed to load notifications data");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedSegmentData = segments.find((s) => s.id === selectedSegment);

  const getChannelIcon = (ch: string) => {
    switch (ch) {
      case "push":
        return Bell;
      case "email":
        return Mail;
      case "in-app":
        return MessageSquare;
      case "sms":
        return MessageSquare;
      default:
        return Bell;
    }
  };

  const getChannelColor = (ch: string) => {
    switch (ch) {
      case "push":
        return "#3b82f6";
      case "email":
        return "#10b981";
      case "in-app":
        return "#f59e0b";
      case "sms":
        return "#ec4899";
      default:
        return "#8b5cf6";
    }
  };

  const handleSend = async () => {
    if (!title || !message) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (scheduleType === "scheduled" && (!scheduledDate || !scheduledTime)) {
      toast.error("Please select date and time for scheduled notifications");
      return;
    }

    try {
      setIsSending(true);
      
      let scheduledFor = undefined;
      if (scheduleType === "scheduled" && scheduledDate && scheduledTime) {
        scheduledFor = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      }

      await api.admin.createManualNotification({
        title,
        message,
        channel,
        target_audience:
          audienceType === "all"
            ? "all"
            : audienceType === "segment"
            ? "segment"
            : "specific",
        segment_id: audienceType === "segment" ? selectedSegment : undefined,
        userIds: audienceType === "specific" ? specificUsers : undefined,
        scheduled_for: scheduledFor,
      });

      if (scheduleType === "now") {
        toast.success(`Notification sent successfully!`);
      } else {
        toast.success(`Notification scheduled successfully!`);
      }
      
      // Reset form and refresh list
      setTitle("");
      setMessage("");
      setScheduledDate("");
      setScheduledTime("");
      fetchData();
      
    } catch (error) {
      console.error("Failed to send notification:", error);
      toast.error("Failed to send notification");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Manual Notifications
            </h1>
            <p className="text-gray-600">Send instant notifications to users</p>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span>Ready to send</span>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Composer Section (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Channel Selection */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="bg-white border border-gray-200 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  1. Select Channel
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(["push", "email", "in-app", "sms"] as const).map((ch) => {
                    const Icon = getChannelIcon(ch);
                    const color = getChannelColor(ch);
                    return (
                      <button
                        key={ch}
                        onClick={() => setChannel(ch)}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          channel === ch
                            ? "border-purple-500 bg-purple-50"
                            : "border-gray-200 bg-white hover:bg-gray-50"
                        }`}
                      >
                        <Icon
                          className="w-6 h-6 mx-auto mb-2"
                          style={{ color: channel === ch ? "#a855f7" : color }}
                        />
                        <p
                          className={`text-sm font-medium ${
                            channel === ch ? "text-purple-700" : "text-gray-700"
                          }`}
                        >
                          {ch === "push"
                            ? "Push"
                            : ch === "email"
                            ? "Email"
                            : ch === "in-app"
                            ? "In-App"
                            : "SMS"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </Card>
            </motion.div>

            {/* Audience Selection */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="bg-white border border-gray-200 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  2. Select Audience
                </h3>

                <div className="flex gap-3 mb-4">
                  {(["all", "segment", "specific"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setAudienceType(type)}
                      className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${
                        audienceType === type
                          ? "bg-gradient-to-r from-purple-500 to-pink-600 text-white"
                          : "bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {type === "all"
                        ? "All Users"
                        : type === "segment"
                        ? "Segment"
                        : "Specific Users"}
                    </button>
                  ))}
                </div>

                {audienceType === "segment" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Segment
                    </label>
                    <select
                      value={selectedSegment}
                      onChange={(e) => setSelectedSegment(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {segments.map((seg) => (
                        <option key={seg.id} value={seg.id} className="text-gray-900">
                          {seg.name} ({seg.count.toLocaleString()} users)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {audienceType === "specific" && (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Select Specific Users
                    </label>
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search by name or email..."
                      className="w-full px-4 py-2 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl divide-y">
                      {allUsers
                        .filter((u) => {
                          if (!userSearch.trim()) return true;
                          const q = userSearch.toLowerCase();
                          return (
                            u.name.toLowerCase().includes(q) ||
                            u.email.toLowerCase().includes(q)
                          );
                        })
                        .slice(0, 50)
                        .map((u) => {
                          const isSelected = specificUsers.includes(u.id);
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                setSpecificUsers((prev) =>
                                  prev.includes(u.id)
                                    ? prev.filter((id) => id !== u.id)
                                    : [...prev, u.id]
                                );
                              }}
                              className={`w-full px-4 py-2 flex items-center justify-between text-left ${
                                isSelected
                                  ? "bg-purple-50"
                                  : "bg-white hover:bg-gray-50"
                              }`}
                            >
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {u.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {u.email}
                                </p>
                              </div>
                              {isSelected && (
                                <CheckCircle2 className="w-4 h-4 text-purple-600" />
                              )}
                            </button>
                          );
                        })}
                    </div>

                    {specificUsers.length > 0 && (
                      <p className="text-xs text-gray-600">
                        Selected {specificUsers.length} user
                        {specificUsers.length > 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                )}

                {audienceType === "all" && (
                  <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <Users className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-gray-900 font-medium">All Active Users</p>
                      <p className="text-sm text-gray-600">
                        {audienceCounts.all.toLocaleString()} recipients
                      </p>
                    </div>
                  </div>
                )}

                {selectedSegmentData && audienceType === "segment" && (
                  <div className="flex items-center gap-3 p-4 bg-purple-50 border border-purple-200 rounded-xl mt-3">
                    <Target className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="text-gray-900 font-medium">
                        {selectedSegmentData.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        {selectedSegmentData.count.toLocaleString()} recipients
                      </p>
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>

            {/* Message Composer */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="bg-white border border-gray-200 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  3. Compose Message
                </h3>

                {/* Title */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title / Subject *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter notification title..."
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {title.length} / 60 characters
                  </p>
                </div>

                {/* Message */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message *
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Enter your message..."
                    rows={6}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {message.length} / 200 characters
                  </p>
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-2 mb-4">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-gray-600 hover:text-gray-900"
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-gray-600 hover:text-gray-900"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-gray-600 hover:text-gray-900"
                  >
                    <Smile className="w-4 h-4" />
                  </Button>
                </div>

                {/* Preview */}
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                  <p className="text-xs text-gray-600 mb-2 font-medium">Preview</p>
                  <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg p-4">
                    <p className="text-white font-bold mb-1">
                      {title || "Your notification title"}
                    </p>
                    <p className="text-white/90 text-sm">
                      {message || "Your message will appear here..."}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Schedule */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="bg-white border border-gray-200 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4">4. Schedule</h3>

                <div className="flex gap-3 mb-4">
                  <button
                    onClick={() => setScheduleType("now")}
                    className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${
                      scheduleType === "now"
                        ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white"
                        : "bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Send Now
                  </button>
                  <button
                    onClick={() => setScheduleType("scheduled")}
                    className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${
                      scheduleType === "scheduled"
                        ? "bg-gradient-to-r from-blue-500 to-cyan-600 text-white"
                        : "bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Schedule for Later
                  </button>
                </div>

                {scheduleType === "scheduled" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date
                      </label>
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Time
                      </label>
                      <input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>

            {/* Send Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Button
                onClick={handleSend}
                disabled={
                  !title ||
                  !message ||
                  isSending ||
                  (scheduleType === "scheduled" &&
                    (!scheduledDate || !scheduledTime))
                }
                className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white py-6 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5 mr-2" />
                {isSending
                  ? "Processing..."
                  : scheduleType === "now"
                  ? "Send Notification"
                  : "Schedule Notification"}
              </Button>
            </motion.div>
          </div>

          {/* Recent Notifications Sidebar (1/3) */}
          <div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="bg-white border border-gray-200 p-6 sticky top-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Recent Notifications
                </h3>

                <div className="space-y-3 max-h-[800px] overflow-y-auto">
                  {recentNotifications.map((notification) => {
                    const ChannelIcon = getChannelIcon(notification.channel);
                    const channelColor = getChannelColor(notification.channel);
                    const deliveryRate = notification.performance
                      ? (
                          (notification.performance.delivered /
                            notification.audience.count) *
                          100
                        ).toFixed(0)
                      : null;

                    return (
                      <div
                        key={notification.id}
                        className="p-3 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all"
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${channelColor}20` }}
                          >
                            <ChannelIcon
                              className="w-4 h-4"
                              style={{ color: channelColor }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-gray-900 truncate">
                              {notification.title}
                            </h4>
                            <p className="text-xs text-gray-600 truncate">
                              {notification.message}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span
                            className={`px-2 py-1 rounded-full font-medium ${
                              notification.status === "sent"
                                ? "bg-green-100 text-green-700"
                                : notification.status === "scheduled"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {notification.status}
                          </span>
                          {deliveryRate && (
                            <span className="text-gray-600">{deliveryRate}% delivered</span>
                          )}
                        </div>

                        <div className="mt-2 text-xs text-gray-500">
                          {notification.sentAt} • {notification.sentBy}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </AdminLayoutNew>
  );
}
