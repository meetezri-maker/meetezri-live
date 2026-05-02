import { motion, AnimatePresence } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Send, Users, Bell, Mail, MessageSquare, Calendar, X, Clock, Plus,
  Edit, Trash2, BarChart3, CheckCircle, Eye, AlignLeft, Braces, Code, Type,
  Search, Smile, Target, AlertCircle, RefreshCw,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { RefObject } from "react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { api } from "@/lib/api";
import { toast } from "sonner";

// ─── Shared types ─────────────────────────────────────────────────────────────

interface SentNotification {
  id: string;
  title: string;
  message: string;
  channel: "push" | "email" | "in-app" | "sms";
  audience: { segment: string; count: number };
  status: "sent" | "scheduled" | "failed";
  sentAt: string;
  sentBy: string;
  performance?: { delivered: number; opened: number; clicked: number };
}

interface Segment { id: string; name: string; count: number; }

interface PushCampaign {
  id: string;
  title: string;
  message: string;
  target: "all" | "core" | "pro" | "trial" | "segment";
  segmentId?: string | null;
  scheduledFor?: Date;
  sentAt?: Date;
  status: "draft" | "scheduled" | "sent" | "failed";
  deliveredCount?: number;
  clickRate?: number;
  priority: "low" | "medium" | "high";
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  category: "welcome" | "notification" | "marketing" | "system" | "crisis";
  htmlContent: string;
  textContent: string;
  variables: string[];
  lastModified: Date;
  sentCount: number;
  openRate: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseUserSegmentsPayload(res: unknown): unknown[] {
  if (Array.isArray(res)) return res;
  if (res && typeof res === "object") {
    const o = res as Record<string, unknown>;
    if (Array.isArray(o.segments)) return o.segments;
    const data = o.data;
    if (data && typeof data === "object") {
      const d = data as Record<string, unknown>;
      if (Array.isArray(d.segments)) return d.segments;
    }
  }
  return [];
}

const QUICK_EMOJIS = ["😀","😊","😂","🥰","😍","🤗","👍","🙏","👏","🎉","✨","🔥","❤️","💙","💪","🌟","☀️","🌈","✅","📌","💬","🔔","🙌","🙂"];

const BUILTIN_SEGMENTS: { id: string; name: string; audience: "active" | "premium" | "trial" }[] = [
  { id: "__builtin_active", name: "Active users (sessions in last 30 days)", audience: "active" },
  { id: "__builtin_premium", name: "Premium subscribers", audience: "premium" },
  { id: "__builtin_trial", name: "Trial users", audience: "trial" },
];

const MESSAGE_MAX = 200;

function useMessageInserter(message: string, setMessage: (s: string) => void, ref: RefObject<HTMLTextAreaElement | null>) {
  return useCallback((insert: string) => {
    if (!insert) return;
    const el = ref.current;
    if (!el) {
      const next = `${message}${insert}`;
      if (next.length > MESSAGE_MAX) { toast.error(`Message is limited to ${MESSAGE_MAX} characters.`); return; }
      setMessage(next); return;
    }
    const start = el.selectionStart ?? message.length;
    const end = el.selectionEnd ?? message.length;
    const next = message.slice(0, start) + insert + message.slice(end);
    if (next.length > MESSAGE_MAX) { toast.error(`Message is limited to ${MESSAGE_MAX} characters.`); return; }
    setMessage(next);
    requestAnimationFrame(() => { el.focus(); const pos = start + insert.length; el.setSelectionRange(pos, pos); });
  }, [message, setMessage, ref]);
}

function formatAudience(meta: any): string {
  const a = meta?.target_audience;
  if (a === "all") return "All Users";
  if (a === "premium") return "Premium Users";
  if (a === "trial") return "Trial Users";
  if (a === "active") return "Active Users";
  if (a === "segment") return "Segment";
  if (typeof a === "string") return a.charAt(0).toUpperCase() + a.slice(1);
  return "Targeted";
}

// ─── InAppTab ─────────────────────────────────────────────────────────────────

function InAppTab({ onSent }: { onSent?: () => void }) {
  const [channel, setChannel] = useState<"push" | "in-app">("push");
  const [audienceType, setAudienceType] = useState<"all" | "segment" | "specific">("all");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [scheduleType, setScheduleType] = useState<"now" | "scheduled">("now");
  const [selectedSegment, setSelectedSegment] = useState("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [audienceCounts, setAudienceCounts] = useState({ all: 0, active: 0, premium: 0, trial: 0 });
  const [allUsers, setAllUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [specificUsers, setSpecificUsers] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const msgRef = useRef<HTMLTextAreaElement>(null);
  const insertMsg = useMessageInserter(message, setMessage, msgRef);

  const segmentChoices = useMemo((): Segment[] => {
    const quick: Segment[] = BUILTIN_SEGMENTS.map(b => ({
      id: b.id, name: b.name,
      count: b.audience === "active" ? audienceCounts.active : b.audience === "premium" ? audienceCounts.premium : audienceCounts.trial,
    }));
    return [...quick, ...segments];
  }, [audienceCounts, segments]);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const [segRes, countsRes, usersRes] = await Promise.all([
          api.admin.getUserSegments(),
          api.admin.getNotificationAudienceCounts(),
          api.admin.getUsers(),
        ]);
        setSegments(parseUserSegmentsPayload(segRes).map((s: any) => ({
          id: String(s?.id ?? "").trim(), name: String(s?.name ?? "Untitled").trim(), count: Number(s?.user_count ?? 0),
        })).filter((s) => s.id.length > 0));
        setAudienceCounts({ all: countsRes.all || 0, active: countsRes.active || 0, premium: countsRes.premium || 0, trial: countsRes.trial || 0 });
        setAllUsers((usersRes || []).map((u: any) => ({ id: u.id, name: u.full_name || u.email?.split("@")[0] || "User", email: u.email || "" })));
      } catch (e) { console.error(e); }
      finally { setIsLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (audienceType !== "segment" || segmentChoices.length === 0) return;
    setSelectedSegment(prev => segmentChoices.some(s => s.id === prev) ? prev : segmentChoices[0].id);
  }, [audienceType, segmentChoices]);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) { toast.error("Please fill in title and message"); return; }
    if (audienceType === "segment" && !selectedSegment) { toast.error("Please select a segment"); return; }
    if (scheduleType === "scheduled" && (!scheduledDate || !scheduledTime)) { toast.error("Please set a date and time"); return; }
    setIsSending(true);
    try {
      let scheduledFor: string | undefined;
      if (scheduleType === "scheduled") scheduledFor = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      const builtin = BUILTIN_SEGMENTS.find(b => b.id === selectedSegment);
      const targetAudience = audienceType === "all" ? "all"
        : audienceType === "segment" ? (builtin ? builtin.audience : "segment")
        : "specific";
      await api.admin.createManualNotification({
        title: title.trim(), message: message.trim(), channel,
        target_audience: targetAudience,
        ...(audienceType === "segment" && !builtin ? { segment_id: selectedSegment } : {}),
        ...(audienceType === "specific" ? { user_ids: specificUsers } : {}),
        ...(scheduledFor ? { scheduled_for: scheduledFor } : {}),
      });
      toast.success(scheduleType === "scheduled" ? "Notification scheduled!" : "Notification sent!");
      setTitle(""); setMessage(""); setScheduleType("now"); setScheduledDate(""); setScheduledTime(""); setSpecificUsers([]);
      onSent?.();
    } catch (e: any) { toast.error(e?.message || "Failed to send"); }
    finally { setIsSending(false); }
  };

  const filteredUsers = allUsers.filter(u =>
    userSearch ? u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()) : true
  ).slice(0, 20);

  const quickTemplates = [
    { label: "Maintenance Notice", title: "Platform Maintenance Notice", msg: "We will be performing scheduled maintenance. Please save your work and expect a brief interruption." },
    { label: "Feature Update", title: "New Feature Update", msg: "Exciting news! We've just released new features to enhance your experience. Check out what's new!" },
    { label: "Wellness Tip", title: "Daily Wellness Tip", msg: "Remember to take regular breaks and practice mindfulness. Your mental health is important to us!" },
    { label: "Event Reminder", title: "Upcoming Event Reminder", msg: "Don't forget about our upcoming wellness event. Mark your calendars and join us!" },
  ];

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Compose form */}
      <div className="lg:col-span-2">
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-6">Compose Notification</h2>
          <div className="space-y-5">
            {/* Channel */}
            <div>
              <Label className="mb-2 block">Channel</Label>
              <div className="flex gap-2">
                {(["push","in-app"] as const).map(c => (
                  <button key={c} onClick={() => setChannel(c)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${channel === c ? "border-primary bg-primary/5 text-primary" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                    {c === "push" ? <Bell className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                    {c === "push" ? "Push" : "In-App"}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <Label htmlFor="notif-title">Title *</Label>
              <Input id="notif-title" className="mt-1" placeholder="Notification title..." value={title} onChange={e => setTitle(e.target.value)} />
            </div>

            {/* Message */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="notif-msg">Message *</Label>
                <span className={`text-xs ${message.length > MESSAGE_MAX * 0.9 ? "text-red-500" : "text-gray-400"}`}>{message.length}/{MESSAGE_MAX}</span>
              </div>
              <div className="relative">
                <textarea id="notif-msg" ref={msgRef} rows={4} maxLength={MESSAGE_MAX}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  placeholder="Write your message..." value={message} onChange={e => setMessage(e.target.value)} />
                <div className="absolute bottom-2 right-2 flex gap-1">
                  <div className="relative">
                    <button onClick={() => setEmojiOpen(!emojiOpen)}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
                      <Smile className="w-4 h-4" />
                    </button>
                    {emojiOpen && (
                      <div className="absolute bottom-8 right-0 bg-white border border-gray-200 rounded-xl shadow-lg p-3 grid grid-cols-6 gap-1 z-20 w-56">
                        {QUICK_EMOJIS.map(e => (
                          <button key={e} onClick={() => { insertMsg(e); setEmojiOpen(false); }}
                            className="text-lg hover:bg-gray-100 rounded p-0.5">{e}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Audience */}
            <div>
              <Label className="mb-2 block">Target Audience</Label>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {([
                  { id: "all", label: "All Users", count: audienceCounts.all },
                  { id: "segment", label: "Segment", count: null },
                  { id: "specific", label: "Specific Users", count: null },
                ] as const).map(opt => (
                  <button key={opt.id} onClick={() => setAudienceType(opt.id)}
                    className={`p-3 rounded-lg border-2 text-left text-sm transition-all ${audienceType === opt.id ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"}`}>
                    <p className="font-medium">{opt.label}</p>
                    {opt.count !== null && <p className="text-xs text-gray-500">{opt.count.toLocaleString()} users</p>}
                  </button>
                ))}
              </div>
              {audienceType === "segment" && (
                <select className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  value={selectedSegment} onChange={e => setSelectedSegment(e.target.value)}>
                  {segmentChoices.map(s => <option key={s.id} value={s.id}>{s.name} {s.count > 0 ? `(${s.count.toLocaleString()})` : ""}</option>)}
                </select>
              )}
              {audienceType === "specific" && (
                <div className="border border-gray-200 rounded-lg p-3">
                  <Input placeholder="Search users..." className="mb-2" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
                  <div className="max-h-36 overflow-y-auto space-y-1">
                    {filteredUsers.map(u => (
                      <label key={u.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer">
                        <input type="checkbox" checked={specificUsers.includes(u.id)}
                          onChange={e => setSpecificUsers(prev => e.target.checked ? [...prev, u.id] : prev.filter(x => x !== u.id))} />
                        <span className="text-sm">{u.name}</span>
                        <span className="text-xs text-gray-400">{u.email}</span>
                      </label>
                    ))}
                  </div>
                  {specificUsers.length > 0 && <p className="text-xs text-primary mt-1">{specificUsers.length} user(s) selected</p>}
                </div>
              )}
            </div>

            {/* Schedule */}
            <div>
              <Label className="mb-2 block">When to Send</Label>
              <div className="flex gap-2 mb-3">
                {([
                  { id: "now", label: "Send Now", icon: Send },
                  { id: "scheduled", label: "Schedule", icon: Clock },
                ] as const).map(opt => {
                  const Icon = opt.icon;
                  return (
                    <button key={opt.id} onClick={() => setScheduleType(opt.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${scheduleType === opt.id ? "border-primary bg-primary/5 text-primary" : "border-gray-200 text-gray-600"}`}>
                      <Icon className="w-4 h-4" /> {opt.label}
                    </button>
                  );
                })}
              </div>
              {scheduleType === "scheduled" && (
                <div className="grid grid-cols-2 gap-3">
                  <Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
                  <Input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} />
                </div>
              )}
            </div>

            <Button className="w-full gap-2" onClick={handleSend} disabled={isSending || isLoading}>
              {isSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {isSending ? "Sending…" : scheduleType === "scheduled" ? "Schedule Notification" : "Send Now"}
            </Button>
          </div>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        <Card className="p-5">
          <h3 className="font-bold mb-3 flex items-center gap-2"><Bell className="w-4 h-4 text-primary" /> Stats</h3>
          <div className="space-y-3">
            <div className="p-3 bg-primary/5 rounded-lg">
              <p className="text-xs text-gray-500">Total Users</p>
              <p className="text-2xl font-bold text-primary">{audienceCounts.all.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-xs text-gray-500">Active Users</p>
              <p className="text-2xl font-bold text-green-600">{audienceCounts.active.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <p className="text-xs text-gray-500">Premium Users</p>
              <p className="text-2xl font-bold text-purple-600">{audienceCounts.premium.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-bold mb-3">Quick Templates</h3>
          <div className="space-y-2">
            {quickTemplates.map(t => (
              <button key={t.label} onClick={() => { setTitle(t.title); setMessage(t.msg); }}
                className="w-full text-left px-3 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 transition-colors">
                {t.label}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── PushTab ──────────────────────────────────────────────────────────────────

function PushTab() {
  const [notifications, setNotifications] = useState<PushCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<"send" | "scheduled" | "history">("send");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState<PushCampaign["target"]>("all");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [scheduleDateTime, setScheduleDateTime] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [segments, setSegments] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingNotif, setEditingNotif] = useState<PushCampaign | null>(null);
  const [deletingNotif, setDeletingNotif] = useState<PushCampaign | null>(null);

  useEffect(() => {
    fetchNotifications();
    (async () => {
      try {
        const raw = await api.admin.getUserSegments();
        const list = Array.isArray(raw) ? raw : (raw as any).segments ?? [];
        setSegments((list as { id: string; name: string }[]).map(s => ({ id: s.id, name: s.name })));
        if (list.length > 0) setSegmentId((list[0] as { id: string }).id);
      } catch { setSegments([]); }
    })();
  }, []);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const data = await api.admin.getPushCampaigns();
      setNotifications((Array.isArray(data) ? data : []).map((n: any) => {
        const m = n.metrics || {};
        const ta = (m.target_audience as string) || (n.target_segment_id ? "segment" : "all");
        return {
          id: n.id, title: n.title, message: n.message,
          target: ta === "segment" ? "segment" : ta as PushCampaign["target"],
          segmentId: n.target_segment_id ?? null,
          scheduledFor: n.scheduled_at ? new Date(n.scheduled_at) : undefined,
          sentAt: n.sent_at ? new Date(n.sent_at) : undefined,
          status: n.status,
          deliveredCount: typeof m.delivered_count === "number" ? m.delivered_count : 0,
          clickRate: typeof m.click_rate === "number" ? m.click_rate : 0,
          priority: (m.priority as PushCampaign["priority"]) || "medium",
        };
      }));
    } catch { toast.error("Failed to load campaigns"); }
    finally { setIsLoading(false); }
  };

  const resetForm = () => { setTitle(""); setMessage(""); setTarget("all"); setPriority("medium"); setScheduleDateTime(""); };

  const buildBody = (status: "draft" | "scheduled") => {
    if (target === "segment" && !segmentId) throw new Error("Select a user segment");
    return {
      title, message, status,
      scheduled_at: status === "scheduled" && scheduleDateTime ? new Date(scheduleDateTime).toISOString() : null,
      target_segment_id: target === "segment" ? segmentId : null,
      metrics: { target_audience: target, priority },
    };
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) { toast.error("Title and message are required"); return; }
    setSaving(true);
    try {
      const created = await api.admin.createPushCampaign(buildBody("scheduled"));
      await api.admin.dispatchPushCampaign((created as any).id);
      toast.success("Push notification sent!"); resetForm(); fetchNotifications();
    } catch (e: any) { toast.error(e?.message || "Failed to send"); }
    finally { setSaving(false); }
  };

  const handleSchedule = async () => {
    if (!title.trim() || !message.trim()) { toast.error("Title and message are required"); return; }
    if (!scheduleDateTime) { toast.error("Please select a date and time"); return; }
    setSaving(true);
    try {
      await api.admin.createPushCampaign(buildBody("scheduled"));
      toast.success("Notification scheduled!"); resetForm(); fetchNotifications();
    } catch (e: any) { toast.error(e?.message || "Failed to schedule"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.admin.deletePushCampaign(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setDeletingNotif(null);
      toast.success("Deleted");
    } catch { toast.error("Failed to delete"); }
  };

  const statusColor = (s: string) => {
    if (s === "scheduled") return "bg-blue-100 text-blue-700";
    if (s === "sent") return "bg-green-100 text-green-700";
    if (s === "failed") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-700";
  };

  const priorityColor = (p: string) => {
    if (p === "high") return "bg-red-100 text-red-700";
    if (p === "medium") return "bg-yellow-100 text-yellow-700";
    return "bg-green-100 text-green-700";
  };

  const scheduled = notifications.filter(n => n.status === "scheduled");
  const sent = notifications.filter(n => n.status === "sent");

  const stats = {
    scheduled: scheduled.length,
    sent: sent.length,
    delivered: sent.reduce((s, n) => s + (n.deliveredCount || 0), 0),
    avgClick: sent.length > 0 ? (sent.reduce((s, n) => s + (n.clickRate || 0), 0) / sent.length).toFixed(1) : "0.0",
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Scheduled", value: stats.scheduled, color: "from-blue-500 to-cyan-600" },
          { label: "Sent", value: stats.sent, color: "from-green-500 to-emerald-600" },
          { label: "Total Delivered", value: stats.delivered.toLocaleString(), color: "from-purple-500 to-pink-600" },
          { label: "Avg Click Rate", value: `${stats.avgClick}%`, color: "from-orange-500 to-amber-600" },
        ].map(s => (
          <Card key={s.label} className="p-4">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center mb-2`}>
              <Bell className="w-4 h-4 text-white" />
            </div>
            <p className="text-xl font-bold text-gray-900">{isLoading ? "—" : s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {(["send","scheduled","history"] as const).map(t => (
          <button key={t} onClick={() => setSelectedTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${selectedTab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {t === "scheduled" ? `Scheduled (${scheduled.length})` : t === "history" ? `History (${sent.length})` : "Send New"}
          </button>
        ))}
      </div>

      {/* Send form */}
      {selectedTab === "send" && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="font-bold mb-4">Create Push Notification</h3>
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input className="mt-1" placeholder="Notification title..." value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div>
                <Label>Message</Label>
                <textarea rows={4} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  placeholder="Your message..." value={message} onChange={e => setMessage(e.target.value)} />
              </div>
              <div>
                <Label>Target</Label>
                <select className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" value={target} onChange={e => setTarget(e.target.value as PushCampaign["target"])}>
                  <option value="all">All Users</option>
                  <option value="core">Core Users</option>
                  <option value="pro">Pro Users</option>
                  <option value="trial">Trial Users</option>
                  {segments.length > 0 && <option value="segment">Custom Segment</option>}
                </select>
                {target === "segment" && segments.length > 0 && (
                  <select className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" value={segmentId} onChange={e => setSegmentId(e.target.value)}>
                    {segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}
              </div>
              <div>
                <Label>Priority</Label>
                <select className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" value={priority} onChange={e => setPriority(e.target.value as "low"|"medium"|"high")}>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </select>
              </div>
              <div>
                <Label>Schedule (optional)</Label>
                <Input type="datetime-local" className="mt-1" value={scheduleDateTime} onChange={e => setScheduleDateTime(e.target.value)} />
              </div>
              <div className="flex gap-3">
                <Button className="flex-1 gap-2" onClick={handleSend} disabled={saving}>
                  <Send className="w-4 h-4" /> {saving ? "Sending…" : "Send Now"}
                </Button>
                {scheduleDateTime && (
                  <Button variant="outline" className="flex-1 gap-2" onClick={handleSchedule} disabled={saving}>
                    <Clock className="w-4 h-4" /> Schedule
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Scheduled list */}
      {selectedTab === "scheduled" && (
        <Card className="p-6">
          {scheduled.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Clock className="w-10 h-10 mx-auto mb-2" />
              <p>No scheduled notifications</p>
            </div>
          ) : (
            <div className="space-y-3">
              {scheduled.map(n => (
                <div key={n.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
                  <div>
                    <p className="font-medium text-gray-900">{n.title}</p>
                    <p className="text-sm text-gray-500">{n.message}</p>
                    <div className="flex gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(n.status)}`}>{n.status}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${priorityColor(n.priority)}`}>{n.priority}</span>
                    </div>
                    {n.scheduledFor && <p className="text-xs text-gray-400 mt-1">Scheduled: {n.scheduledFor.toLocaleString()}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditingNotif(n)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeletingNotif(n)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* History list */}
      {selectedTab === "history" && (
        <Card className="p-6">
          {sent.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <CheckCircle className="w-10 h-10 mx-auto mb-2" />
              <p>No sent notifications yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sent.map(n => (
                <div key={n.id} className="p-4 border border-gray-200 rounded-xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{n.title}</p>
                      <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(n.status)}`}>{n.status}</span>
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-gray-400">
                    {n.deliveredCount ? <span>Delivered: {n.deliveredCount.toLocaleString()}</span> : null}
                    {n.clickRate ? <span>Click rate: {n.clickRate}%</span> : null}
                    {n.sentAt ? <span>{n.sentAt.toLocaleDateString()}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Delete confirm */}
      <AnimatePresence>
        {deletingNotif && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
            onClick={() => setDeletingNotif(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-md w-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-lg"><AlertCircle className="w-5 h-5 text-red-600" /></div>
                <h3 className="font-bold text-lg">Delete notification?</h3>
              </div>
              <p className="text-gray-600 mb-4">"{deletingNotif.title}" will be permanently deleted.</p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setDeletingNotif(null)}>Cancel</Button>
                <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={() => handleDelete(deletingNotif.id)}>Delete</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── EmailTab ─────────────────────────────────────────────────────────────────

function EmailTab() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [viewMode, setViewMode] = useState<"preview" | "html" | "text">("preview");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSendModal, setShowSendModal] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editMode, setEditMode] = useState<"create" | "edit">("create");
  const [formName, setFormName] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formCategory, setFormCategory] = useState<EmailTemplate["category"]>("system");
  const [formHtml, setFormHtml] = useState("");
  const [formText, setFormText] = useState("");
  const [formVariables, setFormVariables] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { fetchTemplates(); }, []);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const data = await api.admin.getEmailTemplates();
      setTemplates(data.map((t: any) => ({
        id: t.id, name: t.name, subject: t.subject,
        category: (t.category as EmailTemplate["category"]) || "system",
        htmlContent: t.html_content || t.body || "",
        textContent: t.text_content || "",
        variables: Array.isArray(t.variables) ? t.variables : [],
        lastModified: new Date(t.updated_at || t.created_at),
        sentCount: t.sent_count || 0,
        openRate: t.open_rate || 0,
      })));
    } catch { toast.error("Failed to load email templates"); }
    finally { setIsLoading(false); }
  };

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const catColor = (c: string) => {
    if (c === "welcome") return "bg-green-100 text-green-700";
    if (c === "notification") return "bg-blue-100 text-blue-700";
    if (c === "marketing") return "bg-purple-100 text-purple-700";
    if (c === "crisis") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-700";
  };

  const getPreviewContent = (t: EmailTemplate) => {
    let html = t.htmlContent;
    const replacements: Record<string, string> = {
      "{{user_name}}": "John Doe", "{{app_url}}": "/therapy-session",
      "{{session_url}}": "/therapy-session", "{{session_time}}": "2:00 PM",
      "{{reset_url}}": "/reset-password", "{{upgrade_url}}": "/pricing",
      "{{sessions_count}}": "5", "{{mood_count}}": "12",
      "{{journal_count}}": "8", "{{streak_days}}": "7",
    };
    Object.entries(replacements).forEach(([k, v]) => { html = html.replace(new RegExp(k, "g"), v); });
    return html;
  };

  const handleSendTest = async () => {
    if (!selectedTemplate || !testEmail) return;
    setIsSending(true);
    try {
      await api.sendEmail(testEmail, selectedTemplate.subject, getPreviewContent(selectedTemplate), selectedTemplate.textContent);
      toast.success("Test email sent"); setShowSendModal(false);
    } catch (e: any) { toast.error(e?.message || "Failed to send"); }
    finally { setIsSending(false); }
  };

  const openCreate = () => {
    setEditMode("create"); setFormName(""); setFormSubject(""); setFormCategory("system");
    setFormHtml(""); setFormText(""); setFormVariables(""); setShowEditModal(true);
  };

  const openEdit = (t: EmailTemplate) => {
    setEditMode("edit"); setFormName(t.name); setFormSubject(t.subject);
    setFormCategory(t.category); setFormHtml(t.htmlContent); setFormText(t.textContent);
    setFormVariables(t.variables.join(", ")); setSelectedTemplate(t); setShowEditModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formSubject.trim()) { toast.error("Name and subject are required"); return; }
    setIsSaving(true);
    try {
      const payload = {
        name: formName.trim(), subject: formSubject.trim(), category: formCategory,
        html_content: formHtml, text_content: formText,
        variables: formVariables.split(",").map(v => v.trim()).filter(Boolean),
      };
      if (editMode === "create") {
        const created = await api.admin.createEmailTemplate(payload);
        setTemplates(prev => [{ id: created.id, name: created.name, subject: created.subject, category: created.category || "system", htmlContent: created.html_content || "", textContent: created.text_content || "", variables: Array.isArray(created.variables) ? created.variables : [], lastModified: new Date(created.updated_at || created.created_at), sentCount: 0, openRate: 0 }, ...prev]);
      } else if (selectedTemplate) {
        const updated = await api.admin.updateEmailTemplate(selectedTemplate.id, payload);
        setTemplates(prev => prev.map(t => t.id === selectedTemplate.id ? { ...t, name: updated.name, subject: updated.subject, category: updated.category || "system", htmlContent: updated.html_content || "", textContent: updated.text_content || "", variables: Array.isArray(updated.variables) ? updated.variables : [], lastModified: new Date(updated.updated_at || updated.created_at) } : t));
      }
      toast.success(editMode === "create" ? "Template created" : "Template updated");
      setShowEditModal(false);
    } catch (e: any) { toast.error(e?.message || "Failed to save"); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async (t: EmailTemplate) => {
    try {
      await api.admin.deleteEmailTemplate(t.id);
      setTemplates(prev => prev.filter(x => x.id !== t.id));
      if (selectedTemplate?.id === t.id) setSelectedTemplate(null);
      toast.success("Template deleted");
    } catch { toast.error("Failed to delete"); }
  };

  const stats = { total: templates.length, sent: templates.reduce((s, t) => s + t.sentCount, 0), avgOpen: templates.length ? (templates.reduce((s, t) => s + t.openRate, 0) / templates.length).toFixed(1) : "0.0" };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Templates", value: stats.total, color: "from-blue-500 to-indigo-600" },
          { label: "Total Sent", value: stats.sent.toLocaleString(), color: "from-green-500 to-emerald-600" },
          { label: "Avg Open Rate", value: `${stats.avgOpen}%`, color: "from-purple-500 to-pink-600" },
        ].map(s => (
          <Card key={s.label} className="p-4">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center mb-2`}><Mail className="w-4 h-4 text-white" /></div>
            <p className="text-xl font-bold text-gray-900">{isLoading ? "—" : s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Template list */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input className="pl-9" placeholder="Search templates…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <Button className="bg-gradient-to-r from-green-500 to-emerald-600 text-white" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" /> New
            </Button>
          </div>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <Card className="p-8 text-center"><Mail className="w-10 h-10 text-gray-300 mx-auto mb-2" /><p className="text-gray-500">No templates found</p></Card>
          ) : (
            <div className="space-y-3">
              {filtered.map(t => (
                <div key={t.id} onClick={() => setSelectedTemplate(t)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedTemplate?.id === t.id ? "border-primary bg-primary/5" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{t.name}</p>
                      <p className="text-sm text-gray-500 truncate">{t.subject}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${catColor(t.category)}`}>{t.category}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span>Sent: {t.sentCount}</span>
                    <span>Open: {t.openRate}%</span>
                    <span>{t.lastModified.toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview pane */}
        <div>
          {selectedTemplate ? (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">{selectedTemplate.name}</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(selectedTemplate)}><Edit className="w-4 h-4" /></Button>
                  <Button size="sm" variant="outline" className="text-green-600" onClick={() => setShowSendModal(true)}><Send className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDelete(selectedTemplate)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
              {/* View mode tabs */}
              <div className="flex gap-1 mb-4 p-1 bg-gray-100 rounded-lg w-fit">
                {(["preview","html","text"] as const).map(m => (
                  <button key={m} onClick={() => setViewMode(m)}
                    className={`px-3 py-1 rounded text-xs font-medium capitalize ${viewMode === m ? "bg-white shadow-sm" : "text-gray-500"}`}>
                    {m === "preview" ? <><Eye className="w-3 h-3 inline mr-1" />Preview</> : m === "html" ? <><Code className="w-3 h-3 inline mr-1" />HTML</> : <><AlignLeft className="w-3 h-3 inline mr-1" />Text</>}
                  </button>
                ))}
              </div>
              {viewMode === "preview" && (
                <div className="border border-gray-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                  {selectedTemplate.htmlContent ? (
                    <iframe srcDoc={getPreviewContent(selectedTemplate)} className="w-full h-72 border-0" title="Email preview" />
                  ) : (
                    <div className="p-4 text-sm text-gray-500">No HTML content</div>
                  )}
                </div>
              )}
              {viewMode === "html" && (
                <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-80 overflow-auto whitespace-pre-wrap">{selectedTemplate.htmlContent || "(empty)"}</pre>
              )}
              {viewMode === "text" && (
                <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-80 overflow-auto whitespace-pre-wrap">{selectedTemplate.textContent || "(empty)"}</pre>
              )}
              {selectedTemplate.variables.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 mb-1">Variables:</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedTemplate.variables.map(v => (
                      <span key={v} className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-xs font-mono">{`{{${v}}}`}</span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ) : (
            <Card className="p-12 text-center h-full flex flex-col items-center justify-center">
              <Mail className="w-12 h-12 text-gray-200 mb-3" />
              <p className="text-gray-400 text-sm">Select a template to preview</p>
            </Card>
          )}
        </div>
      </div>

      {/* Send test email modal */}
      <AnimatePresence>
        {showSendModal && selectedTemplate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
            onClick={() => setShowSendModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Send Test Email</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowSendModal(false)}><X className="w-4 h-4" /></Button>
              </div>
              <div className="space-y-4">
                <div>
                  <Label>Template</Label>
                  <p className="text-sm text-gray-600 mt-1 font-medium">{selectedTemplate.name}</p>
                </div>
                <div>
                  <Label>Test Email Address</Label>
                  <Input className="mt-1" type="email" placeholder="test@example.com" value={testEmail} onChange={e => setTestEmail(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <Button variant="outline" className="flex-1" onClick={() => setShowSendModal(false)}>Cancel</Button>
                <Button className="flex-1 gap-2" onClick={handleSendTest} disabled={isSending || !testEmail}>
                  <Send className="w-4 h-4" /> {isSending ? "Sending…" : "Send Test"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit / Create modal */}
      <AnimatePresence>
        {showEditModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
            onClick={() => setShowEditModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold">{editMode === "create" ? "Create Template" : "Edit Template"}</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowEditModal(false)}><X className="w-4 h-4" /></Button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Name *</Label>
                    <Input className="mt-1" placeholder="Template name" value={formName} onChange={e => setFormName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <select className="mt-1 w-full px-3 py-2 border rounded-lg text-sm" value={formCategory} onChange={e => setFormCategory(e.target.value as EmailTemplate["category"])}>
                      <option value="welcome">Welcome</option><option value="notification">Notification</option>
                      <option value="marketing">Marketing</option><option value="system">System</option><option value="crisis">Crisis</option>
                    </select>
                  </div>
                </div>
                <div>
                  <Label>Subject *</Label>
                  <Input className="mt-1" placeholder="Email subject line" value={formSubject} onChange={e => setFormSubject(e.target.value)} />
                </div>
                <div>
                  <Label>HTML Content</Label>
                  <textarea rows={6} className="mt-1 w-full px-3 py-2 border rounded-lg text-sm font-mono" value={formHtml} onChange={e => setFormHtml(e.target.value)} placeholder="<html>...</html>" />
                </div>
                <div>
                  <Label>Text Content</Label>
                  <textarea rows={3} className="mt-1 w-full px-3 py-2 border rounded-lg text-sm" value={formText} onChange={e => setFormText(e.target.value)} placeholder="Plain text version..." />
                </div>
                <div>
                  <Label>Variables (comma-separated)</Label>
                  <Input className="mt-1" placeholder="user_name, reset_url, ..." value={formVariables} onChange={e => setFormVariables(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="flex-1" onClick={() => setShowEditModal(false)}>Cancel</Button>
                <Button className="flex-1 gap-2" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {editMode === "create" ? "Create" : "Save Changes"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── HistoryTab ───────────────────────────────────────────────────────────────

function HistoryTab() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [detail, setDetail] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const data = await api.admin.getManualNotifications();
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const formatted = data.map((n: any) => {
          const md = n.metadata || {};
          const created = new Date(n.created_at).getTime();
          return {
            id: n.id, title: n.title, message: n.message || "",
            audience: formatAudience(md),
            channel: md.channel || "push",
            delivered: typeof md.target_count === "number" ? md.target_count : 1,
            status: md.campaign_status === "scheduled" ? "Scheduled" : n.is_read ? "Read" : "Sent",
            sent: new Date(n.created_at).toLocaleString(),
            isThisWeek: created >= weekAgo,
          };
        });
        setNotifications(formatted);
      } catch (e) { console.error(e); toast.error("Failed to load history"); }
      finally { setIsLoading(false); }
    })();
  }, []);

  const weekCount = notifications.filter(n => n.isThisWeek).length;
  const totalDelivered = notifications.reduce((s, n) => s + (n.delivered || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Notifications", value: notifications.length, icon: Bell, color: "from-blue-500 to-indigo-600" },
          { label: "This Week", value: weekCount, icon: Calendar, color: "from-green-500 to-emerald-600" },
          { label: "Total Recipients", value: totalDelivered.toLocaleString(), icon: Users, color: "from-purple-500 to-pink-600" },
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

      <Card className="p-6">
        <h3 className="font-bold mb-4">All Notifications</h3>
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-8 text-gray-400"><MessageSquare className="w-10 h-10 mx-auto mb-2" /><p>No notifications yet</p></div>
        ) : (
          <div className="space-y-3">
            {notifications.map(n => (
              <div key={n.id} className="flex items-start justify-between p-4 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
                <div className="flex gap-3">
                  <MessageSquare className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">{n.title}</p>
                    <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{n.audience}</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{n.sent}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">Delivered to {n.delivered.toLocaleString()} users</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setDetail(n)}>Details</Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Detail modal */}
      <AnimatePresence>
        {detail && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
            onClick={() => setDetail(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Notification Details</h3>
                <Button variant="ghost" size="sm" onClick={() => setDetail(null)}><X className="w-4 h-4" /></Button>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Title</p>
                  <p className="font-semibold">{detail.title}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Message</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{detail.message}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-gray-500">Audience</p><p className="text-sm font-medium">{detail.audience}</p></div>
                  <div><p className="text-xs text-gray-500">Channel</p><p className="text-sm font-medium capitalize">{detail.channel}</p></div>
                  <div><p className="text-xs text-gray-500">Status</p><p className="text-sm font-medium">{detail.status}</p></div>
                  <div><p className="text-xs text-gray-500">Delivered</p><p className="text-sm font-medium">{detail.delivered.toLocaleString()}</p></div>
                </div>
                <p className="text-xs text-gray-400">Sent: {detail.sent}</p>
              </div>
              <Button variant="outline" className="w-full mt-4" onClick={() => setDetail(null)}>Close</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main CommunicationsHub ───────────────────────────────────────────────────

const COMM_TABS = [
  { id: "in-app", label: "In-App / Push", icon: MessageSquare },
  { id: "push", label: "Push Campaigns", icon: Bell },
  { id: "email", label: "Email Templates", icon: Mail },
  { id: "history", label: "History", icon: Calendar },
] as const;

type CommTabId = typeof COMM_TABS[number]["id"];

export function CommunicationsHub() {
  const [activeTab, setActiveTab] = useState<CommTabId>("in-app");
  const [refreshTick, setRefreshTick] = useState(0);

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl font-bold text-gray-900 mb-1">Communications Hub</h1>
          <p className="text-gray-500">Manage all notifications, push campaigns and email templates in one place</p>
        </motion.div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit border border-gray-200 flex-wrap">
          {COMM_TABS.map(tab => {
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
            {activeTab === "in-app" && <InAppTab onSent={() => setRefreshTick(t => t + 1)} />}
            {activeTab === "push" && <PushTab key={refreshTick} />}
            {activeTab === "email" && <EmailTab />}
            {activeTab === "history" && <HistoryTab key={refreshTick} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </AdminLayoutNew>
  );
}
