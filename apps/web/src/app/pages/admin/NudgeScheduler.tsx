import { motion, AnimatePresence } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Calendar as CalendarIcon,
  Plus,
  Edit,
  Trash2,
  Play,
  Pause,
  Users,
  Target,
  Clock,
  Zap,
  Bell,
  Filter,
  Settings,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  X,
  Save,
  BarChart3,
  Send,
  Eye,
  Copy,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { api } from "@/lib/api";
import { toast } from "sonner";

/** ISO string → value for `input type="datetime-local"` (local timezone). */
function isoToDateTimeLocal(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const CAMPAIGN_LANGUAGES: { value: string; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "zh-Hans", label: "Chinese (Simplified)" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" },
];

interface NudgeCampaign {
  id: string;
  name: string;
  template: string;
  type: "time-based" | "event-based" | "behavior-based";
  status: "active" | "paused" | "scheduled" | "completed";
  language: string;
  audience: {
    segment: string;
    count: number;
  };
  trigger: {
    type: string;
    value: string;
  };
  schedule: {
    startDate: string;
    endDate?: string;
    frequency: string;
    /** ISO 8601 datetime when the campaign is available / scheduled to run. */
    availabilityAt?: string;
  };
  performance: {
    sent: number;
    opened: number;
    clicked: number;
    converted: number;
  };
  abTest?: {
    enabled: boolean;
    variants: number;
  };
  createdBy: string;
  lastRun: string;
}

export function NudgeScheduler() {
  const [viewMode, setViewMode] = useState<"calendar" | "list">("list");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  
  // Modal states
  const [viewModalCampaign, setViewModalCampaign] = useState<NudgeCampaign | null>(null);
  const [editModalCampaign, setEditModalCampaign] = useState<NudgeCampaign | null>(null);
  const [deleteModalCampaign, setDeleteModalCampaign] = useState<NudgeCampaign | null>(null);
  const [analyticsModalCampaign, setAnalyticsModalCampaign] = useState<NudgeCampaign | null>(null);
  const [showCreateCampaignModal, setShowCreateCampaignModal] = useState(false);
  const [campaigns, setCampaigns] = useState<NudgeCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [campaignType, setCampaignType] = useState<"time-based" | "event-based" | "behavior-based">("time-based");
  const [campaignStatus, setCampaignStatus] = useState<NudgeCampaign["status"]>("scheduled");
  const [campaignTemplateId, setCampaignTemplateId] = useState("");
  const [triggerType, setTriggerType] = useState("");
  const [triggerValue, setTriggerValue] = useState("");
  const [frequency, setFrequency] = useState("");
  const [availabilityDateTime, setAvailabilityDateTime] = useState("");
  const [campaignLanguage, setCampaignLanguage] = useState("en");
  const [targetAudience, setTargetAudience] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [editDraft, setEditDraft] = useState<NudgeCampaign | null>(null);

  const mapApiCampaign = (c: any): NudgeCampaign => {
    const metrics = c.metrics || {};
    const audience = metrics.audience || {};
    const trigger = metrics.trigger || {};
    const schedule = metrics.schedule || {};
    const performance = metrics.performance || {};
    const abTest = metrics.abTest;
    const createdAt = c.created_at ? new Date(c.created_at) : new Date();
    const availabilityFromMetrics =
      typeof schedule.availabilityAt === "string" ? schedule.availabilityAt : undefined;
    const availabilityFromScheduled = c.scheduled_at
      ? new Date(c.scheduled_at).toISOString()
      : undefined;
    const availabilityAt = availabilityFromMetrics || availabilityFromScheduled;
    const start =
      (typeof schedule.startDate === "string" && schedule.startDate
        ? String(schedule.startDate).slice(0, 10)
        : undefined) ||
      (availabilityAt ? new Date(availabilityAt).toISOString().slice(0, 10) : undefined) ||
      (c.scheduled_at ? new Date(c.scheduled_at).toISOString().slice(0, 10) : createdAt.toISOString().slice(0, 10));
    const lastRun =
      metrics.lastRun ||
      (c.sent_at ? new Date(c.sent_at).toLocaleString() : "Not yet run");
    const lang =
      typeof metrics.language === "string" && metrics.language
        ? metrics.language
        : "en";

    return {
      id: c.id,
      name: c.title || metrics.name || "Untitled campaign",
      template: metrics.template || "",
      type: (metrics.type as NudgeCampaign["type"]) || "time-based",
      status: (c.status as NudgeCampaign["status"]) || "scheduled",
      language: lang,
      audience: {
        segment: audience.segment || "All users",
        count: typeof audience.count === "number" ? audience.count : 0,
      },
      trigger: {
        type: trigger.type || "Custom",
        value: trigger.value || "",
      },
      schedule: {
        startDate: start,
        endDate: schedule.endDate,
        frequency: schedule.frequency || "Once",
        ...(availabilityAt ? { availabilityAt } : {}),
      },
      performance: {
        sent: performance.sent ?? 0,
        opened: performance.opened ?? 0,
        clicked: performance.clicked ?? 0,
        converted: performance.converted ?? 0,
      },
      abTest: abTest
        ? {
            enabled: !!abTest.enabled,
            variants: abTest.variants ?? 1,
          }
        : undefined,
      createdBy: metrics.createdBy || "System",
      lastRun,
    };
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [campaignData, templateData] = await Promise.all([
          api.admin.getPushCampaigns(),
          api.admin.getNudgeTemplates(),
        ]);
        const mappedCampaigns = Array.isArray(campaignData)
          ? campaignData.map((c: any) => mapApiCampaign(c))
          : [];
        const mappedTemplates = Array.isArray(templateData)
          ? templateData.map((t: any) => ({ id: t.id, name: t.name }))
          : [];
        setCampaigns(mappedCampaigns);
        setTemplates(mappedTemplates);
      } catch (error: any) {
        console.error("Failed to load scheduler data", error);
        toast.error(error?.message || "Failed to load scheduler data");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    if (editModalCampaign) {
      setEditDraft(editModalCampaign);
    } else {
      setEditDraft(null);
    }
  }, [editModalCampaign]);

  const handleCreateCampaign = async () => {
    try {
      setIsSaving(true);
      const selectedTemplate = templates.find((t) => t.id === campaignTemplateId);
      const availabilityIso = availabilityDateTime
        ? new Date(availabilityDateTime).toISOString()
        : null;
      const metrics = {
        templateId: campaignTemplateId || null,
        template: selectedTemplate?.name || "",
        type: campaignType,
        language: campaignLanguage,
        audience: {
          segment: targetAudience || "All users",
          count: 0,
        },
        trigger: {
          type: triggerType || "Custom",
          value: triggerValue || "",
        },
        schedule: {
          startDate: availabilityDateTime
            ? availabilityDateTime.slice(0, 10)
            : new Date().toISOString().slice(0, 10),
          frequency: frequency || "Once",
          ...(availabilityIso ? { availabilityAt: availabilityIso } : {}),
        },
        performance: {
          sent: 0,
          opened: 0,
          clicked: 0,
          converted: 0,
        },
        lastRun: "Not yet run",
      };

      const payload = {
        title: campaignName || selectedTemplate?.name || "Untitled campaign",
        message: "",
        status: campaignStatus,
        target_segment_id: null,
        scheduled_at: availabilityIso,
        metrics,
      };

      const created = await api.admin.createPushCampaign(payload);
      setCampaigns((prev) => [mapApiCampaign(created), ...prev]);
      setShowCreateCampaignModal(false);
      setCampaignName("");
      setCampaignType("time-based");
      setCampaignStatus("scheduled");
      setCampaignTemplateId("");
      setTriggerType("");
      setTriggerValue("");
      setFrequency("");
      setAvailabilityDateTime("");
      setCampaignLanguage("en");
      setTargetAudience("");
      toast.success("Campaign created");
    } catch (error: any) {
      console.error("Failed to create campaign", error);
      toast.error(error?.message || "Failed to create campaign");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateStatus = async (campaign: NudgeCampaign, status: NudgeCampaign["status"]) => {
    try {
      const updated = await api.admin.updatePushCampaign(campaign.id, {
        status,
      });
      const mapped = mapApiCampaign(updated);
      setCampaigns((prev) => prev.map((c) => (c.id === campaign.id ? mapped : c)));
      toast.success(`Campaign ${status === "active" ? "activated" : "paused"}`);
    } catch (error: any) {
      console.error("Failed to update campaign status", error);
      toast.error(error?.message || "Failed to update campaign");
    }
  };

  const handleDeleteCampaign = async (campaign: NudgeCampaign) => {
    try {
      await api.admin.deletePushCampaign(campaign.id);
      setCampaigns((prev) => prev.filter((c) => c.id !== campaign.id));
      setDeleteModalCampaign(null);
      toast.success("Campaign deleted");
    } catch (error: any) {
      console.error("Failed to delete campaign", error);
      toast.error(error?.message || "Failed to delete campaign");
    }
  };

  const handleSaveCampaignEdit = async () => {
    if (!editModalCampaign || !editDraft) return;
    try {
      const metrics = {
        name: editDraft.name,
        template: editDraft.template,
        type: editDraft.type,
        language: editDraft.language,
        audience: editDraft.audience,
        trigger: editDraft.trigger,
        schedule: editDraft.schedule,
        performance: editModalCampaign.performance,
        abTest: editModalCampaign.abTest,
        createdBy: editModalCampaign.createdBy,
        lastRun: editModalCampaign.lastRun,
      };
      const rawAvail = editDraft.schedule.availabilityAt;
      const scheduledAt =
        rawAvail && !Number.isNaN(new Date(rawAvail).getTime())
          ? new Date(rawAvail).toISOString()
          : null;
      const updated = await api.admin.updatePushCampaign(editModalCampaign.id, {
        title: editDraft.name,
        status: editDraft.status,
        scheduled_at: scheduledAt,
        metrics,
      });
      const mapped = mapApiCampaign(updated);
      setCampaigns((prev) => prev.map((c) => (c.id === editModalCampaign.id ? mapped : c)));
      setEditModalCampaign(null);
      toast.success("Campaign updated");
    } catch (error: any) {
      toast.error(error?.message || "Failed to save campaign");
    }
  };

  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesStatus =
      selectedStatus === "all" || campaign.status === selectedStatus;
    const matchesType = selectedType === "all" || campaign.type === selectedType;
    return matchesStatus && matchesType;
  });

  const campaignsWithSends = campaigns.filter((c) => c.performance.sent > 0);
  const avgOpenRate =
    campaignsWithSends.length === 0
      ? "0.0"
      : (
          campaignsWithSends.reduce(
            (sum, c) => sum + c.performance.opened / c.performance.sent,
            0
          ) / campaignsWithSends.length
        ).toFixed(1);

  const stats = [
    {
      label: "Active Campaigns",
      value: campaigns.filter((c) => c.status === "active").length.toString(),
      color: "from-green-500 to-emerald-600",
      icon: CheckCircle2,
    },
    {
      label: "Scheduled",
      value: campaigns.filter((c) => c.status === "scheduled").length.toString(),
      color: "from-blue-500 to-cyan-600",
      icon: Clock,
    },
    {
      label: "Total Audience",
      value: campaigns
        .reduce((sum, c) => sum + c.audience.count, 0)
        .toLocaleString(),
      color: "from-purple-500 to-pink-600",
      icon: Users,
    },
    {
      label: "Avg Open Rate",
      value:
        avgOpenRate + "%",
      color: "from-orange-500 to-amber-600",
      icon: TrendingUp,
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-50 text-green-700 border-green-200";
      case "paused":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case "scheduled":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "completed":
        return "bg-gray-50 text-gray-700 border-gray-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "time-based":
        return Clock;
      case "event-based":
        return Zap;
      case "behavior-based":
        return Target;
      default:
        return Bell;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "time-based":
        return "#3b82f6";
      case "event-based":
        return "#10b981";
      case "behavior-based":
        return "#f59e0b";
      default:
        return "#8b5cf6";
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
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Nudge Scheduler</h1>
            <p className="text-gray-600">
              Schedule and manage notification campaigns
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1 border border-gray-200">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  viewMode === "list"
                    ? "bg-purple-500 text-white"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setViewMode("calendar")}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  viewMode === "calendar"
                    ? "bg-purple-500 text-white"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Calendar
              </button>
            </div>

            <Button className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white" onClick={() => setShowCreateCampaignModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Campaign
            </Button>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="bg-white border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}
                  >
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-white border border-gray-200 p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
              </select>

              {/* Type Filter */}
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Types</option>
                <option value="time-based">Time-based</option>
                <option value="event-based">Event-based</option>
                <option value="behavior-based">Behavior-based</option>
              </select>

              <div className="flex-1"></div>

              <Button
                variant="outline"
                className="border-gray-300 text-gray-700 hover:bg-gray-500"
              >
                <Filter className="w-4 h-4 mr-2" />
                Advanced Filters
              </Button>
            </div>
          </Card>
        </motion.div>

        {viewMode === "calendar" && (
          <Card className="bg-white border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
                }
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h3 className="text-lg font-semibold text-gray-900">
                {calendarMonth.toLocaleString("default", { month: "long", year: "numeric" })}
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
                }
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="py-2">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {(() => {
                const y = calendarMonth.getFullYear();
                const m = calendarMonth.getMonth();
                const first = new Date(y, m, 1).getDay();
                const days = new Date(y, m + 1, 0).getDate();
                const cells: (number | null)[] = [];
                for (let i = 0; i < first; i++) cells.push(null);
                for (let d = 1; d <= days; d++) cells.push(d);
                const byDay = new Map<number, NudgeCampaign[]>();
                filteredCampaigns.forEach((c) => {
                  const sd = c.schedule.startDate?.slice(0, 10);
                  if (!sd) return;
                  const parts = sd.split("-").map((x) => parseInt(x, 10));
                  if (parts.length !== 3) return;
                  const [yy, mm, dd] = parts;
                  if (yy === y && mm - 1 === m) {
                    const arr = byDay.get(dd) || [];
                    arr.push(c);
                    byDay.set(dd, arr);
                  }
                });
                return cells.map((day, idx) => (
                  <div
                    key={idx}
                    className={`min-h-[88px] rounded-lg border p-1 text-left ${
                      day ? "bg-gray-50 border-gray-200" : "border-transparent"
                    }`}
                  >
                    {day ? (
                      <>
                        <div className="text-xs font-semibold text-gray-700 mb-1">{day}</div>
                        <div className="space-y-1">
                          {(byDay.get(day) || []).slice(0, 3).map((c) => (
                            <button
                              type="button"
                              key={c.id}
                              onClick={() => setViewModalCampaign(c)}
                              className="w-full truncate rounded bg-purple-100 px-1 py-0.5 text-left text-[10px] text-purple-900 hover:bg-purple-200"
                            >
                              {c.name}
                            </button>
                          ))}
                          {(byDay.get(day) || []).length > 3 && (
                            <p className="text-[10px] text-gray-500">
                              +{(byDay.get(day) || []).length - 3} more
                            </p>
                          )}
                        </div>
                      </>
                    ) : null}
                  </div>
                ));
              })()}
            </div>
          </Card>
        )}

        {/* Campaigns List */}
        {viewMode === "list" && (
        <div className="space-y-4">
          {filteredCampaigns.map((campaign, index) => {
            const TypeIcon = getTypeIcon(campaign.type);
            const typeColor = getTypeColor(campaign.type);
            const openRate =
              campaign.performance.sent > 0
                ? ((campaign.performance.opened / campaign.performance.sent) * 100).toFixed(1)
                : "0.0";

            return (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="bg-white border border-gray-200 p-6 hover:shadow-lg transition-all">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${typeColor}20` }}
                    >
                      <TypeIcon className="w-6 h-6" style={{ color: typeColor }} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Header Row */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-900 mb-1">
                            {campaign.name}
                          </h3>
                          <p className="text-sm text-gray-600">
                            Template: {campaign.template}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {campaign.abTest?.enabled && (
                            <span className="px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded text-xs font-medium">
                              A/B Test
                            </span>
                          )}
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${getStatusColor(
                              campaign.status
                            )}`}
                          >
                            {campaign.status}
                          </span>
                        </div>
                      </div>

                      {/* Info Grid */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        {/* Audience */}
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Audience</p>
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-blue-600" />
                            <div>
                              <p className="text-sm text-gray-900 font-medium">
                                {campaign.audience.count.toLocaleString()}
                              </p>
                              <p className="text-xs text-gray-600">
                                {campaign.audience.segment}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Trigger */}
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Trigger</p>
                          <p className="text-sm text-gray-900 font-medium">
                            {campaign.trigger.type}
                          </p>
                          <p className="text-xs text-gray-600">
                            {campaign.trigger.value}
                          </p>
                        </div>

                        {/* Schedule */}
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Schedule</p>
                          <p className="text-sm text-gray-900 font-medium">
                            {campaign.schedule.frequency}
                          </p>
                          <p className="text-xs text-gray-600">
                            Since {campaign.schedule.startDate}
                          </p>
                        </div>

                        {/* Performance */}
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Performance</p>
                          <p className="text-sm text-gray-900 font-medium">
                            {openRate}% open rate
                          </p>
                          <p className="text-xs text-gray-600">
                            {campaign.performance.sent.toLocaleString()} sent
                          </p>
                        </div>
                      </div>

                      {/* Performance Bar */}
                      {campaign.performance.sent > 0 && (
                        <div className="mb-4">
                          <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                            <span>Conversion Funnel</span>
                            <span>
                              {(
                                (campaign.performance.converted /
                                  campaign.performance.sent) *
                                100
                              ).toFixed(1)}
                              % converted
                            </span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full flex">
                              <div
                                className="bg-blue-500"
                                style={{
                                  width: `${
                                    (campaign.performance.opened /
                                      campaign.performance.sent) *
                                    100
                                  }%`,
                                }}
                              />
                              <div
                                className="bg-green-500"
                                style={{
                                  width: `${
                                    (campaign.performance.clicked /
                                      campaign.performance.sent) *
                                    100
                                  }%`,
                                }}
                              />
                              <div
                                className="bg-purple-500"
                                style={{
                                  width: `${
                                    (campaign.performance.converted /
                                      campaign.performance.sent) *
                                    100
                                  }%`,
                                }}
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-xs">
                            <span className="flex items-center gap-1 text-gray-600">
                              <div className="w-2 h-2 bg-blue-500 rounded-full" />
                              Opened
                            </span>
                            <span className="flex items-center gap-1 text-gray-600">
                              <div className="w-2 h-2 bg-green-500 rounded-full" />
                              Clicked
                            </span>
                            <span className="flex items-center gap-1 text-gray-600">
                              <div className="w-2 h-2 bg-purple-500 rounded-full" />
                              Converted
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                        <div className="flex items-center gap-4 text-xs text-gray-600">
                          <span>Last run: {campaign.lastRun}</span>
                          <span>by {campaign.createdBy}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-gray-600 hover:text-gray-900"
                            onClick={() => setViewModalCampaign(campaign)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-gray-600 hover:text-gray-900"
                            onClick={() => {
                              toast.success(`Copied campaign: ${campaign.name}`);
                            }}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          {campaign.status === "active" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-yellow-600 hover:text-yellow-700"
                              onClick={() => handleUpdateStatus(campaign, "paused")}
                            >
                              <Pause className="w-4 h-4" />
                            </Button>
                          )}
                          {campaign.status === "paused" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-green-600 hover:text-green-700"
                              onClick={() => handleUpdateStatus(campaign, "active")}
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-gray-600 hover:text-gray-900"
                            onClick={() => setAnalyticsModalCampaign(campaign)}
                          >
                            <BarChart3 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-blue-600 hover:text-blue-700"
                            onClick={() => setEditModalCampaign(campaign)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setDeleteModalCampaign(campaign)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
        )}

        {/* Empty State */}
        {filteredCampaigns.length === 0 && viewMode === "list" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Card className="bg-white border border-gray-200 p-12">
              <CalendarIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                No campaigns found
              </h3>
              <p className="text-gray-600 mb-6">
                Try adjusting your filters or create a new campaign
              </p>
              <Button className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white" onClick={() => setShowCreateCampaignModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Campaign
              </Button>
            </Card>
          </motion.div>
        )}

        {/* View Modal */}
        <AnimatePresence>
          {viewModalCampaign && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
              onClick={() => setViewModalCampaign(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold">View Campaign</h2>
                    <span
                      className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                        viewModalCampaign.status
                      )}`}
                    >
                      {viewModalCampaign.status}
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setViewModalCampaign(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Campaign Name</label>
                    <p className="text-lg font-semibold text-gray-900">{viewModalCampaign.name}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">Template</label>
                      <p className="font-medium text-gray-900">{viewModalCampaign.template}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">Type</label>
                      <p className="font-medium text-gray-900">{viewModalCampaign.type}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Language</label>
                    <p className="font-medium text-gray-900">
                      {CAMPAIGN_LANGUAGES.find((l) => l.value === viewModalCampaign.language)?.label ??
                        viewModalCampaign.language}
                    </p>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="font-bold text-lg mb-3">Audience</h3>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Segment</p>
                      <p className="font-medium text-gray-900">{viewModalCampaign.audience.segment}</p>
                      <p className="text-sm text-gray-600 mt-2">Target Count</p>
                      <p className="font-medium text-gray-900">{viewModalCampaign.audience.count.toLocaleString()} users</p>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="font-bold text-lg mb-3">Trigger & Schedule</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Trigger Type</p>
                        <p className="font-medium text-gray-900">{viewModalCampaign.trigger.type}</p>
                        <p className="text-xs text-gray-600 mt-1">{viewModalCampaign.trigger.value}</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Frequency</p>
                        <p className="font-medium text-gray-900">{viewModalCampaign.schedule.frequency}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          {viewModalCampaign.schedule.availabilityAt
                            ? `Available ${new Date(viewModalCampaign.schedule.availabilityAt).toLocaleString()}`
                            : `Since ${viewModalCampaign.schedule.startDate}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {viewModalCampaign.performance.sent > 0 && (
                    <div className="border-t pt-4">
                      <h3 className="font-bold text-lg mb-3">Performance</h3>
                      <div className="grid grid-cols-4 gap-4">
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-2xl font-bold text-blue-600">{viewModalCampaign.performance.sent.toLocaleString()}</p>
                          <p className="text-xs text-gray-600">Sent</p>
                        </div>
                        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                          <p className="text-2xl font-bold text-green-600">{viewModalCampaign.performance.opened.toLocaleString()}</p>
                          <p className="text-xs text-gray-600">Opened</p>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                          <p className="text-2xl font-bold text-purple-600">{viewModalCampaign.performance.clicked.toLocaleString()}</p>
                          <p className="text-xs text-gray-600">Clicked</p>
                        </div>
                        <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                          <p className="text-2xl font-bold text-orange-600">{viewModalCampaign.performance.converted.toLocaleString()}</p>
                          <p className="text-xs text-gray-600">Converted</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {viewModalCampaign.abTest?.enabled && (
                    <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                      <p className="font-medium text-gray-900">A/B Testing Enabled</p>
                      <p className="text-sm text-gray-600">{viewModalCampaign.abTest.variants} variants active</p>
                    </div>
                  )}

                  <div className="border-t pt-4">
                    <p className="text-sm text-gray-600">Created by <span className="font-medium text-gray-900">{viewModalCampaign.createdBy}</span></p>
                    <p className="text-sm text-gray-600 mt-1">Last run: <span className="font-medium text-gray-900">{viewModalCampaign.lastRun}</span></p>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" className="flex-1" onClick={() => setViewModalCampaign(null)}>
                      Close
                    </Button>
                    <Button className="flex-1" onClick={() => {
                      setEditModalCampaign(viewModalCampaign);
                      setViewModalCampaign(null);
                    }}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Campaign
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit Modal */}
        <AnimatePresence>
          {editModalCampaign && editDraft && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
              onClick={() => setEditModalCampaign(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">Edit Campaign</h2>
                  <Button variant="ghost" size="sm" onClick={() => setEditModalCampaign(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Campaign Name</label>
                    <Input
                      value={editDraft.name}
                      onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Type</label>
                      <select
                        className="w-full px-3 py-2 border rounded-lg"
                        value={editDraft.type}
                        onChange={(e) =>
                          setEditDraft({
                            ...editDraft,
                            type: e.target.value as NudgeCampaign["type"],
                          })
                        }
                      >
                        <option value="time-based">Time-based</option>
                        <option value="event-based">Event-based</option>
                        <option value="behavior-based">Behavior-based</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Status</label>
                      <select
                        className="w-full px-3 py-2 border rounded-lg"
                        value={editDraft.status}
                        onChange={(e) =>
                          setEditDraft({
                            ...editDraft,
                            status: e.target.value as NudgeCampaign["status"],
                          })
                        }
                      >
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Template</label>
                    <Input
                      value={editDraft.template}
                      onChange={(e) => setEditDraft({ ...editDraft, template: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Language</label>
                    <select
                      className="w-full px-3 py-2 border rounded-lg"
                      value={editDraft.language}
                      onChange={(e) => setEditDraft({ ...editDraft, language: e.target.value })}
                    >
                      {CAMPAIGN_LANGUAGES.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Trigger Type</label>
                      <Input
                        value={editDraft.trigger.type}
                        onChange={(e) =>
                          setEditDraft({
                            ...editDraft,
                            trigger: { ...editDraft.trigger, type: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Trigger Value</label>
                      <Input
                        value={editDraft.trigger.value}
                        onChange={(e) =>
                          setEditDraft({
                            ...editDraft,
                            trigger: { ...editDraft.trigger, value: e.target.value },
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Frequency</label>
                      <Input
                        value={editDraft.schedule.frequency}
                        onChange={(e) =>
                          setEditDraft({
                            ...editDraft,
                            schedule: { ...editDraft.schedule, frequency: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Availability</label>
                      <Input
                        type="datetime-local"
                        value={isoToDateTimeLocal(editDraft.schedule.availabilityAt)}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!v) {
                            const restSched = { ...editDraft.schedule };
                            delete restSched.availabilityAt;
                            setEditDraft({
                              ...editDraft,
                              schedule: restSched,
                            });
                            return;
                          }
                          const iso = new Date(v).toISOString();
                          setEditDraft({
                            ...editDraft,
                            schedule: {
                              ...editDraft.schedule,
                              startDate: v.slice(0, 10),
                              availabilityAt: iso,
                            },
                          });
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Target Audience</label>
                    <Input
                      value={editDraft.audience.segment}
                      onChange={(e) =>
                        setEditDraft({
                          ...editDraft,
                          audience: { ...editDraft.audience, segment: e.target.value },
                        })
                      }
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" className="flex-1" onClick={() => setEditModalCampaign(null)}>
                      Cancel
                    </Button>
                    <Button className="flex-1" type="button" onClick={handleSaveCampaignEdit}>
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
          {analyticsModalCampaign && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
              onClick={() => setAnalyticsModalCampaign(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">Campaign Analytics: {analyticsModalCampaign.name}</h2>
                  <Button variant="ghost" size="sm" onClick={() => setAnalyticsModalCampaign(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-6">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <Send className="w-5 h-5 text-blue-600" />
                        <TrendingUp className="w-4 h-4 text-blue-600" />
                      </div>
                      <p className="text-3xl font-bold text-blue-600">{analyticsModalCampaign.performance.sent.toLocaleString()}</p>
                      <p className="text-sm text-gray-600">Total Sent</p>
                    </div>

                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center justify-between mb-2">
                        <Eye className="w-5 h-5 text-green-600" />
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      </div>
                      <p className="text-3xl font-bold text-green-600">
                        {analyticsModalCampaign.performance.sent > 0 
                          ? ((analyticsModalCampaign.performance.opened / analyticsModalCampaign.performance.sent) * 100).toFixed(1)
                          : "0.0"}%
                      </p>
                      <p className="text-sm text-gray-600">Open Rate</p>
                    </div>

                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="flex items-center justify-between mb-2">
                        <Target className="w-5 h-5 text-purple-600" />
                        <TrendingUp className="w-4 h-4 text-purple-600" />
                      </div>
                      <p className="text-3xl font-bold text-purple-600">
                        {analyticsModalCampaign.performance.sent > 0 
                          ? ((analyticsModalCampaign.performance.clicked / analyticsModalCampaign.performance.sent) * 100).toFixed(1)
                          : "0.0"}%
                      </p>
                      <p className="text-sm text-gray-600">Click Rate</p>
                    </div>

                    <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="flex items-center justify-between mb-2">
                        <CheckCircle2 className="w-5 h-5 text-orange-600" />
                        <TrendingUp className="w-4 h-4 text-orange-600" />
                      </div>
                      <p className="text-3xl font-bold text-orange-600">
                        {analyticsModalCampaign.performance.sent > 0 
                          ? ((analyticsModalCampaign.performance.converted / analyticsModalCampaign.performance.sent) * 100).toFixed(1)
                          : "0.0"}%
                      </p>
                      <p className="text-sm text-gray-600">Conversion</p>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="border-t pt-4">
                    <h3 className="font-bold text-lg mb-3">Campaign Details</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-gray-600 mb-1">Type</p>
                        <p className="font-medium text-gray-900">{analyticsModalCampaign.type}</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-gray-600 mb-1">Status</p>
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(analyticsModalCampaign.status)}`}>
                          {analyticsModalCampaign.status}
                        </span>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-gray-600 mb-1">Audience</p>
                        <p className="font-medium text-gray-900">{analyticsModalCampaign.audience.count.toLocaleString()} users</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-gray-600 mb-1">Frequency</p>
                        <p className="font-medium text-gray-900">{analyticsModalCampaign.schedule.frequency}</p>
                      </div>
                    </div>
                  </div>

                  {analyticsModalCampaign.abTest?.enabled && (
                    <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <BarChart3 className="w-5 h-5 text-purple-600" />
                        <p className="font-medium text-gray-900">A/B Testing Active</p>
                      </div>
                      <p className="text-sm text-gray-600">{analyticsModalCampaign.abTest.variants} variants running</p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" className="flex-1" onClick={() => setAnalyticsModalCampaign(null)}>
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
          {deleteModalCampaign && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
              onClick={() => setDeleteModalCampaign(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl p-6 max-w-md w-full"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-red-600">Delete Campaign</h2>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteModalCampaign(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-900 mb-1">Are you sure you want to delete this campaign?</p>
                        <p className="text-sm text-gray-600">
                          This action cannot be undone. The campaign "{deleteModalCampaign.name}" and all its data will be permanently deleted.
                        </p>
                      </div>
                    </div>
                  </div>

                  {deleteModalCampaign.performance.sent > 0 && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-2">Campaign Performance:</p>
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div>
                          <p className="font-bold text-gray-900">{deleteModalCampaign.performance.sent.toLocaleString()}</p>
                          <p className="text-xs text-gray-600">Sent</p>
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{deleteModalCampaign.performance.converted.toLocaleString()}</p>
                          <p className="text-xs text-gray-600">Conversions</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" className="flex-1" onClick={() => setDeleteModalCampaign(null)}>
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                      onClick={() => {
                        if (deleteModalCampaign) {
                          handleDeleteCampaign(deleteModalCampaign);
                        }
                      }}
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

        {/* Create Campaign Modal */}
        <AnimatePresence>
          {showCreateCampaignModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
              onClick={() => setShowCreateCampaignModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">Create New Campaign</h2>
                  <Button variant="ghost" size="sm" onClick={() => setShowCreateCampaignModal(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Campaign Name</label>
                    <Input
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Type</label>
                      <select
                        className="w-full px-3 py-2 border rounded-lg"
                        value={campaignType}
                        onChange={(e) =>
                          setCampaignType(e.target.value as NudgeCampaign["type"])
                        }
                      >
                        <option value="time-based">Time-based</option>
                        <option value="event-based">Event-based</option>
                        <option value="behavior-based">Behavior-based</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Status</label>
                      <select
                        className="w-full px-3 py-2 border rounded-lg"
                        value={campaignStatus}
                        onChange={(e) =>
                          setCampaignStatus(e.target.value as NudgeCampaign["status"])
                        }
                      >
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Template</label>
                    <select
                      className="w-full px-3 py-2 border rounded-lg"
                      value={campaignTemplateId}
                      onChange={(e) => setCampaignTemplateId(e.target.value)}
                    >
                      <option value="">Select template</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Language</label>
                    <select
                      className="w-full px-3 py-2 border rounded-lg"
                      value={campaignLanguage}
                      onChange={(e) => setCampaignLanguage(e.target.value)}
                    >
                      {CAMPAIGN_LANGUAGES.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Trigger Type</label>
                      <Input
                        value={triggerType}
                        onChange={(e) => setTriggerType(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Trigger Value</label>
                      <Input
                        value={triggerValue}
                        onChange={(e) => setTriggerValue(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Frequency</label>
                      <Input
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value)}
                        placeholder="e.g. Once, Daily"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Availability</label>
                      <Input
                        type="datetime-local"
                        value={availabilityDateTime}
                        onChange={(e) => setAvailabilityDateTime(e.target.value)}
                      />
                      <p className="text-xs text-gray-500 mt-1">When this campaign is available; also sets the server schedule time.</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Target Audience</label>
                    <Input
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" className="flex-1" onClick={() => setShowCreateCampaignModal(false)}>
                      Cancel
                    </Button>
                    <Button className="flex-1" onClick={() => {
                      if (!campaignName && !campaignTemplateId) {
                        toast.error("Please enter a campaign name or select a template");
                        return;
                      }
                      if (isSaving) {
                        return;
                      }
                      handleCreateCampaign();
                    }} disabled={isSaving}>
                      <Save className="w-4 h-4 mr-2" />
                      {isSaving ? "Creating..." : "Create Campaign"}
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
