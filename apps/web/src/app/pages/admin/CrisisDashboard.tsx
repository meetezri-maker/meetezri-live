import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { AlertTriangle, Phone, Mail, Eye, CheckCircle, Clock, TrendingDown, Shield, MessageSquare, User, ArrowRight, AlertCircle, Activity, Calendar, Download, X, ChevronRight, Zap, ClipboardList, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../../lib/api";

interface CrisisEvent {
  id: string;
  userId: string;
  userName: string;
  riskLevel: "critical" | "high" | "medium" | "low";
  type: string;
  keywords: string[];
  timestamp: string;
  status: "pending" | "contacted" | "in-progress" | "resolved";
  aiConfidence: number;
  responseTime?: string;
  assignedTo?: string;
  lastContact?: string;
  createdAt?: string;
  resolvedAt?: string;
}

type RiskFilter = "all" | "critical" | "high" | "medium";

function formatRelativeTime(timestamp: string | null | undefined) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) {
    return `${diffMinutes} min${diffMinutes === 1 ? "" : "s"} ago`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hr${diffHours === 1 ? "" : "s"} ago`;
  }
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function getResponseTimeLabel(start?: string, end?: string) {
  if (!start || !end) return undefined;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return undefined;
  }
  const diffMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
  if (diffMinutes <= 0) return undefined;
  return `${diffMinutes} min`;
}

function getAverageResponseTime(events: CrisisEvent[]): string {
  let totalMinutes = 0;
  let count = 0;
  events.forEach((event) => {
    if (!event.createdAt || !event.resolvedAt) return;
    const start = new Date(event.createdAt);
    const end = new Date(event.resolvedAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
    const diffMinutes = (end.getTime() - start.getTime()) / 60000;
    if (diffMinutes <= 0) return;
    totalMinutes += diffMinutes;
    count += 1;
  });
  if (!count) return "N/A";
  const avg = totalMinutes / count;
  return `${avg.toFixed(1)} min`;
}

function mapApiCrisisEvent(event: any): CrisisEvent {
  const createdAt = event.created_at as string | undefined;
  const resolvedAt = event.resolved_at as string | undefined;
  const userName =
    event.profiles?.full_name ||
    event.profiles?.email ||
    "Unknown user";
  const assignedTo =
    event.assigned_profile?.full_name ||
    event.assigned_profile?.email ||
    undefined;
  return {
    id: event.id,
    userId: event.user_id,
    userName,
    riskLevel: (event.risk_level || "medium") as CrisisEvent["riskLevel"],
    type: event.event_type || "Crisis event",
    keywords: Array.isArray(event.keywords) ? event.keywords : [],
    timestamp: formatRelativeTime(createdAt),
    status: (event.status || "pending") as CrisisEvent["status"],
    aiConfidence: typeof event.ai_confidence === "number" ? event.ai_confidence : 0,
    responseTime: getResponseTimeLabel(createdAt, resolvedAt),
    assignedTo,
    lastContact: undefined,
    createdAt,
    resolvedAt,
  };
}

function getPreviousStatus(status: CrisisEvent["status"]): CrisisEvent["status"] | null {
  const map: Partial<Record<CrisisEvent["status"], CrisisEvent["status"]>> = {
    contacted: "pending",
    "in-progress": "contacted",
    resolved: "in-progress",
  };
  return map[status] ?? null;
}

function getPreviousStatusLabel(status: CrisisEvent["status"]): string {
  const map: Partial<Record<CrisisEvent["status"], string>> = {
    contacted: "Pending",
    "in-progress": "Contacted",
    resolved: "In Progress",
  };
  return map[status] ?? "";
}

// Workflow steps definition
const WORKFLOW_STEPS: { status: CrisisEvent["status"]; label: string; color: string; bg: string }[] = [
  { status: "pending",     label: "Pending",     color: "text-red-600",    bg: "bg-red-500" },
  { status: "contacted",   label: "Contacted",   color: "text-yellow-600", bg: "bg-yellow-500" },
  { status: "in-progress", label: "In Progress", color: "text-blue-600",   bg: "bg-blue-500" },
  { status: "resolved",    label: "Resolved",    color: "text-green-600",  bg: "bg-green-500" },
];

function WorkflowStepper({ currentStatus }: { currentStatus: CrisisEvent["status"] }) {
  const currentIdx = WORKFLOW_STEPS.findIndex((s) => s.status === currentStatus);
  return (
    <div className="flex items-center gap-0 my-3">
      {WORKFLOW_STEPS.map((step, idx) => {
        const isCompleted = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <div key={step.status} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  isCompleted
                    ? `${step.bg} border-transparent text-white`
                    : isCurrent
                    ? `border-current ${step.color} bg-white shadow-md ring-2 ring-offset-1 ring-current`
                    : "border-gray-200 text-gray-300 bg-white"
                }`}
              >
                {isCompleted ? <CheckCircle className="w-4 h-4" /> : <span>{idx + 1}</span>}
              </div>
              <span
                className={`text-[10px] font-semibold whitespace-nowrap ${
                  isCompleted ? step.color : isCurrent ? step.color : "text-gray-300"
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < WORKFLOW_STEPS.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-1 rounded transition-all ${
                  idx < currentIdx ? step.bg : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CrisisDashboard() {
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [selectedEvent, setSelectedEvent] = useState<CrisisEvent | null>(null);
  // Step-specific modals
  const [showContactModal, setShowContactModal] = useState(false);       // pending → contacted
  const [showInterventionModal, setShowInterventionModal] = useState(false); // contacted → in-progress
  const [showResolveModal, setShowResolveModal] = useState(false);       // in-progress → resolved
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [contactMethod, setContactMethod] = useState<"phone" | "email" | "in-app">("phone");
  const [contactNotes, setContactNotes] = useState("");
  const [interventionNotes, setInterventionNotes] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolutionOutcome, setResolutionOutcome] = useState<"safe" | "referred" | "no-contact">("safe");
  const [events, setEvents] = useState<CrisisEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [bannerReviewed, setBannerReviewed] = useState(false);
  const [highlightCritical, setHighlightCritical] = useState(false);
  const [showMoveBackModal, setShowMoveBackModal] = useState(false);
  const [moveBackEvent, setMoveBackEvent] = useState<CrisisEvent | null>(null);
  const kanbanRef = useRef<HTMLDivElement>(null);

  const loadEvents = async () => {
    try {
      setError(null);
      const data = await api.admin.getCrisisEvents();
      const items = Array.isArray(data) ? data : [];
      setEvents(items.map(mapApiCrisisEvent));
    } catch (err) {
      console.error("Failed to fetch crisis events", err);
      const msg =
        err instanceof Error ? err.message : "Failed to load crisis events";
      setError(msg || "Failed to load crisis events");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  // Filter events by risk level; kanban columns further filter by status
  const filteredEvents = events.filter((event) =>
    riskFilter === "all" || event.riskLevel === riskFilter
  );

  // Stats
  const stats = {
    critical: events.filter((e) => e.riskLevel === "critical").length,
    pending: events.filter((e) => e.status === "pending").length,
    contacted: events.filter((e) => e.status === "contacted" || e.status === "in-progress").length,
    resolved: events.filter((e) => e.status === "resolved").length,
    avgResponseTime: getAverageResponseTime(events),
    activeFollowUps: events.filter((e) => e.status === "contacted" || e.status === "in-progress").length,
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "critical":
        return "bg-red-500 text-white";
      case "high":
        return "bg-orange-500 text-white";
      case "medium":
        return "bg-yellow-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  const getRiskBorderColor = (level: string) => {
    switch (level) {
      case "critical":
        return "border-red-500";
      case "high":
        return "border-orange-500";
      case "medium":
        return "border-yellow-500";
      default:
        return "border-gray-500";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-red-100 text-red-700 border-red-300";
      case "contacted":
        return "bg-yellow-100 text-yellow-700 border-yellow-300";
      case "in-progress":
        return "bg-blue-100 text-blue-700 border-blue-300";
      case "resolved":
        return "bg-green-100 text-green-700 border-green-300";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  if (isLoading) {
    return (
      <AdminLayoutNew>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayoutNew>
    );
  }

  if (error) {
    return (
      <AdminLayoutNew>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <p className="text-red-600 font-medium">{error}</p>
          <Button
            onClick={() => {
              setIsLoading(true);
              loadEvents();
            }}
          >
            Retry
          </Button>
        </div>
      </AdminLayoutNew>
    );
  }

  return (
    <AdminLayoutNew>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-start md:justify-between gap-4"
        >
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Crisis Monitoring</h1>
                <p className="text-muted-foreground">
                  Real-time monitoring and intervention for at-risk users
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-red-700">Live Monitoring Active</span>
            </div>
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Export Report
            </Button>
          </div>
        </motion.div>

        {/* Critical Alert Banner */}
        {stats.critical > 0 && !bannerReviewed && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-4 bg-red-50 border-red-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-600 animate-pulse" />
                  <div>
                    <p className="font-bold text-red-900">
                      {stats.critical} Critical Alert{stats.critical !== 1 ? "s" : ""} Requiring Immediate Attention
                    </p>
                    <p className="text-sm text-red-700">
                      High-risk situations detected. Immediate intervention recommended.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => {
                      setBannerReviewed(true);
                      setRiskFilter("critical");
                      setHighlightCritical(true);
                      setTimeout(() => setHighlightCritical(false), 3000);
                      setTimeout(() => {
                        kanbanRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }, 100);
                    }}
                  >
                    Review Now
                  </Button>
                  <button
                    onClick={() => setBannerReviewed(true)}
                    className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                    aria-label="Dismiss alert"
                  >
                    <X className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-4 border-l-4 border-red-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Critical</p>
                  <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card className="p-4 border-l-4 border-yellow-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="p-4 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Active</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.contacted}</p>
                </div>
                <Activity className="w-8 h-8 text-blue-500" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Card className="p-4 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Resolved</p>
                  <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="p-4 border-l-4 border-purple-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Avg Response</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.avgResponseTime}</p>
                </div>
                <TrendingDown className="w-8 h-8 text-purple-500" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <Card className="p-4 border-l-4 border-orange-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Follow-ups</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.activeFollowUps}</p>
                </div>
                <Calendar className="w-8 h-8 text-orange-500" />
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Pipeline toolbar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex items-center justify-between gap-3 flex-wrap"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-muted-foreground">Filter by risk:</span>
            <select
              className="px-3 py-2 border rounded-lg text-sm bg-white"
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as RiskFilter)}
            >
              <option value="all">All Risk Levels</option>
              <option value="critical">Critical Only</option>
              <option value="high">High Only</option>
              <option value="medium">Medium Only</option>
            </select>
          </div>
          <Link to="/admin/crisis-follow-up-queue">
            <Button variant="outline" size="sm" className="gap-2">
              <Calendar className="w-4 h-4" />
              Follow-up Queue
            </Button>
          </Link>
        </motion.div>

        {/* ── Kanban Pipeline Board ── */}
        {highlightCritical && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold"
          >
            <AlertTriangle className="w-4 h-4 animate-pulse" />
            Showing critical cases only — scroll down to review each one
          </motion.div>
        )}
        <motion.div
          ref={kanbanRef}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4"
        >
          {/* ── Column: Pending ── */}
          {(() => {
            const col = filteredEvents.filter((e) => e.status === "pending");
            return (
              <div className="flex flex-col gap-3">
                {/* Column header */}
                <div className="flex items-center justify-between px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                    <span className="font-bold text-red-800 text-sm">Pending</span>
                  </div>
                  <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">{col.length}</span>
                </div>
                <p className="text-xs text-muted-foreground px-1 -mt-1">Awaiting first contact — act immediately</p>

                {/* Arrow to next */}
                <div className="hidden xl:flex items-center justify-end pr-1 -mb-1">
                  <ArrowRight className="w-4 h-4 text-red-400" />
                </div>

                {col.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-red-200 rounded-xl text-red-400">
                    <CheckCircle className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-xs font-medium">No pending events</p>
                  </div>
                )}
                {col.map((event, i) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + i * 0.04 }}
                    className={`bg-white border-l-4 ${getRiskBorderColor(event.riskLevel)} rounded-xl shadow-sm hover:shadow-md transition-shadow p-4`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {event.userName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{event.userName}</p>
                        <p className="text-xs text-muted-foreground">{event.timestamp}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0 ${getRiskColor(event.riskLevel)}`}>
                        {event.riskLevel.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-2 truncate">{event.type}</p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {event.keywords.slice(0, 3).map((kw, ki) => (
                        <span key={ki} className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">{kw}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                      <Shield className="w-3 h-3" />
                      <span>AI: {event.aiConfidence}%</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Button
                        size="sm"
                        className="w-full bg-red-600 hover:bg-red-700 gap-1.5 text-xs h-8"
                        onClick={() => { setSelectedEvent(event); setShowContactModal(true); }}
                      >
                        <Phone className="w-3 h-3" />
                        Log Contact
                        <ChevronRight className="w-3 h-3 ml-auto" />
                      </Button>
                      <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs h-7" asChild>
                        <Link to={`/admin/crisis-event-details?id=${encodeURIComponent(event.id)}`}>
                          <Eye className="w-3 h-3" />
                          View Details
                        </Link>
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            );
          })()}

          {/* ── Column: Contacted ── */}
          {(() => {
            const col = filteredEvents.filter((e) => e.status === "contacted");
            return (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-3 py-2.5 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span className="font-bold text-yellow-800 text-sm">Contacted</span>
                  </div>
                  <span className="px-2 py-0.5 bg-yellow-500 text-white text-xs font-bold rounded-full">{col.length}</span>
                </div>
                <p className="text-xs text-muted-foreground px-1 -mt-1">Contact made — begin active intervention</p>

                {col.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-yellow-200 rounded-xl text-yellow-400">
                    <Phone className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-xs font-medium">No contacted cases</p>
                  </div>
                )}
                {col.map((event, i) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.65 + i * 0.04 }}
                    className={`bg-white border-l-4 border-yellow-400 rounded-xl shadow-sm hover:shadow-md transition-shadow p-4`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {event.userName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{event.userName}</p>
                        <p className="text-xs text-muted-foreground">{event.timestamp}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0 ${getRiskColor(event.riskLevel)}`}>
                        {event.riskLevel.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-2 truncate">{event.type}</p>
                    {/* Status context */}
                    <div className="flex items-center gap-1.5 mb-3 px-2 py-1.5 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <Phone className="w-3 h-3 text-yellow-600" />
                      <span className="text-xs text-yellow-800 font-medium">Contact logged — awaiting intervention</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                      <Shield className="w-3 h-3" />
                      <span>AI: {event.aiConfidence}%</span>
                      {event.assignedTo && (
                        <>
                          <span className="mx-1">•</span>
                          <User className="w-3 h-3" />
                          <span className="truncate max-w-[80px]">{event.assignedTo}</span>
                        </>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Button
                        size="sm"
                        className="w-full bg-blue-600 hover:bg-blue-700 gap-1.5 text-xs h-8"
                        onClick={() => { setSelectedEvent(event); setShowInterventionModal(true); }}
                      >
                        <Zap className="w-3 h-3" />
                        Begin Intervention
                        <ChevronRight className="w-3 h-3 ml-auto" />
                      </Button>
                      <div className="flex gap-1.5">
                        <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs h-7" asChild>
                          <Link to={`/admin/crisis-event-details?id=${encodeURIComponent(event.id)}`}>
                            <Eye className="w-3 h-3" />
                            View Details
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-xs h-7 text-gray-500 hover:text-orange-100 hover:border-orange-600"
                          onClick={() => { setMoveBackEvent(event); setShowMoveBackModal(true); }}
                          title="Move back to Pending"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Undo
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            );
          })()}

          {/* ── Column: In Progress ── */}
          {(() => {
            const col = filteredEvents.filter((e) => e.status === "in-progress");
            return (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                    <span className="font-bold text-blue-800 text-sm">In Progress</span>
                  </div>
                  <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-full">{col.length}</span>
                </div>
                <p className="text-xs text-muted-foreground px-1 -mt-1">Active intervention underway — resolve when done</p>

                {col.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-blue-200 rounded-xl text-blue-400">
                    <Zap className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-xs font-medium">No active interventions</p>
                  </div>
                )}
                {col.map((event, i) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 + i * 0.04 }}
                    className={`bg-white border-l-4 border-blue-500 rounded-xl shadow-sm hover:shadow-md transition-shadow p-4`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {event.userName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{event.userName}</p>
                        <p className="text-xs text-muted-foreground">{event.timestamp}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0 ${getRiskColor(event.riskLevel)}`}>
                        {event.riskLevel.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-2 truncate">{event.type}</p>
                    {/* Status context */}
                    <div className="flex items-center gap-1.5 mb-3 px-2 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
                      <Activity className="w-3 h-3 text-blue-600" />
                      <span className="text-xs text-blue-800 font-medium">Intervention active — monitoring closely</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                      <Shield className="w-3 h-3" />
                      <span>AI: {event.aiConfidence}%</span>
                      {event.responseTime && (
                        <>
                          <span className="mx-1">•</span>
                          <Clock className="w-3 h-3" />
                          <span>{event.responseTime}</span>
                        </>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Button
                        size="sm"
                        className="w-full bg-green-600 hover:bg-green-700 gap-1.5 text-xs h-8"
                        onClick={() => { setSelectedEvent(event); setShowResolveModal(true); }}
                      >
                        <CheckCircle className="w-3 h-3" />
                        Resolve Case
                        <ChevronRight className="w-3 h-3 ml-auto" />
                      </Button>
                      <div className="flex gap-1.5">
                        <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs h-7" asChild>
                          <Link to={`/admin/crisis-event-details?id=${encodeURIComponent(event.id)}`}>
                            <Eye className="w-3 h-3" />
                            View Details
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-xs h-7 text-gray-500 hover:text-orange-600 hover:border-orange-300"
                          onClick={() => { setMoveBackEvent(event); setShowMoveBackModal(true); }}
                          title="Move back to Contacted"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Undo
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            );
          })()}

          {/* ── Column: Resolved ── */}
          {(() => {
            const col = filteredEvents.filter((e) => e.status === "resolved");
            return (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-3 py-2.5 bg-green-50 border border-green-200 rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="font-bold text-green-800 text-sm">Resolved</span>
                  </div>
                  <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full">{col.length}</span>
                </div>
                <p className="text-xs text-muted-foreground px-1 -mt-1">Case closed — intervention complete</p>

                {col.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-green-200 rounded-xl text-green-400">
                    <CheckCircle className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-xs font-medium">No resolved cases yet</p>
                  </div>
                )}
                {col.map((event, i) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.75 + i * 0.04 }}
                    className="bg-white border-l-4 border-green-400 rounded-xl shadow-sm p-4 opacity-90"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {event.userName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{event.userName}</p>
                        <p className="text-xs text-muted-foreground">{event.timestamp}</p>
                      </div>
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    </div>
                    <p className="text-xs text-gray-600 mb-2 truncate">{event.type}</p>
                    <div className="flex items-center gap-1.5 mb-3 px-2 py-1.5 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle className="w-3 h-3 text-green-600" />
                      <span className="text-xs text-green-800 font-medium">Case successfully resolved</span>
                    </div>
                    {event.responseTime && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                        <Clock className="w-3 h-3" />
                        <span>Total time: {event.responseTime}</span>
                      </div>
                    )}
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs h-7" asChild>
                        <Link to={`/admin/crisis-event-details?id=${encodeURIComponent(event.id)}`}>
                          <Eye className="w-3 h-3" />
                          View Report
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-xs h-7 text-gray-500 hover:text-orange-600 hover:border-orange-300"
                        onClick={() => { setMoveBackEvent(event); setShowMoveBackModal(true); }}
                        title="Move back to In Progress"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Undo
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            );
          })()}
        </motion.div>

        {/* Empty state: no events at all */}
        {filteredEvents.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="font-bold text-xl mb-2">No Crisis Events</h3>
            <p className="text-muted-foreground">No events match the current risk filter</p>
          </motion.div>
        )}

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card className="p-6">
            <h2 className="font-bold text-xl mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link to="/admin/crisis-protocol">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Shield className="w-4 h-4" />
                  Crisis Protocols
                </Button>
              </Link>
              <Link to="/admin/crisis-follow-up-queue">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Calendar className="w-4 h-4" />
                  Follow-up Queue
                </Button>
              </Link>
              <Link to="/admin/crisis-dashboard">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Activity className="w-4 h-4" />
                  Crisis Dashboard
                </Button>
              </Link>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* ── Step 1 Modal: Pending → Contacted ── */}
      {showContactModal && selectedEvent && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowContactModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full uppercase tracking-wide">Step 1 of 3</span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Log Contact Attempt</h3>
                <p className="text-gray-500 text-sm mt-1">{selectedEvent.userName} — {selectedEvent.riskLevel.toUpperCase()} risk</p>
              </div>
              <button onClick={() => setShowContactModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Workflow progress */}
            <div className="mb-5">
              <WorkflowStepper currentStatus="pending" />
              <p className="text-xs text-gray-400 text-center mt-1">After confirming contact, this case moves to <strong>Contacted</strong></p>
            </div>

            {/* Crisis summary */}
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="font-semibold text-red-900 text-sm">Crisis Details</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                <div><span className="text-gray-500">Event type:</span> <span className="font-medium">{selectedEvent.type}</span></div>
                <div><span className="text-gray-500">AI confidence:</span> <span className="font-medium">{selectedEvent.aiConfidence}%</span></div>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedEvent.keywords.map((kw, i) => (
                  <span key={i} className="px-2 py-0.5 bg-red-200 text-red-800 rounded text-xs font-medium">{kw}</span>
                ))}
              </div>
            </div>

            {/* Contact method */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2">How did you reach out?</label>
              <div className="grid grid-cols-3 gap-3">
                {(["phone", "email", "in-app"] as const).map((method) => {
                  const Icon = method === "phone" ? Phone : method === "email" ? Mail : MessageSquare;
                  const labels: Record<string, [string, string]> = {
                    phone: ["Phone Call", "Immediate"],
                    email: ["Email", "Follow-up"],
                    "in-app": ["In-App", "Message"],
                  };
                  const [label, sub] = labels[method];
                  const active = contactMethod === method;
                  return (
                    <button
                      key={method}
                      onClick={() => setContactMethod(method)}
                      className={`p-4 border-2 rounded-xl transition-all ${active ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}
                    >
                      <Icon className={`w-6 h-6 mx-auto mb-2 ${active ? "text-blue-600" : "text-gray-400"}`} />
                      <p className={`text-sm font-medium ${active ? "text-blue-900" : "text-gray-700"}`}>{label}</p>
                      <p className={`text-xs mt-0.5 ${active ? "text-blue-600" : "text-gray-400"}`}>{sub}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Notes</label>
              <textarea
                value={contactNotes}
                onChange={(e) => setContactNotes(e.target.value)}
                rows={3}
                placeholder="What happened? Who answered? What was communicated?"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 gap-2"
                disabled={isUpdating}
                onClick={async () => {
                  if (!selectedEvent) return;
                  try {
                    setIsUpdating(true);
                    await api.admin.updateCrisisEventStatus(selectedEvent.id, {
                      status: "contacted",
                      notes: contactNotes || undefined,
                    });
                    await loadEvents();
                    setShowContactModal(false);
                    setContactNotes("");
                    setContactMethod("phone");
                  } catch (err) {
                    console.error("Failed to update crisis event", err);
                  } finally {
                    setIsUpdating(false);
                  }
                }}
              >
                <Phone className="w-4 h-4" />
                {isUpdating ? "Saving…" : "Confirm Contact → Mark as Contacted"}
                {!isUpdating && <ArrowRight className="w-4 h-4 ml-auto" />}
              </Button>
              <Button variant="outline" className="px-5" onClick={() => { setShowContactModal(false); setContactNotes(""); }}>
                Cancel
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* ── Step 2 Modal: Contacted → In Progress ── */}
      {showInterventionModal && selectedEvent && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowInterventionModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full uppercase tracking-wide">Step 2 of 3</span>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">Begin Intervention</h3>
                <p className="text-gray-500 text-sm mt-1">{selectedEvent.userName}</p>
              </div>
              <button onClick={() => setShowInterventionModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="mb-5">
              <WorkflowStepper currentStatus="contacted" />
              <p className="text-xs text-gray-400 text-center mt-1">This case will move to <strong>In Progress</strong></p>
            </div>

            {/* Intervention plan */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <ClipboardList className="w-4 h-4 inline mr-1" />
                Intervention Plan / Actions Being Taken
              </label>
              <textarea
                value={interventionNotes}
                onChange={(e) => setInterventionNotes(e.target.value)}
                rows={4}
                placeholder="Describe the active intervention steps — e.g. connected with therapist, counselling session scheduled, safety plan in place…"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm"
              />
            </div>

            <div className="flex gap-3">
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700 gap-2"
                disabled={isUpdating}
                onClick={async () => {
                  if (!selectedEvent) return;
                  try {
                    setIsUpdating(true);
                    await api.admin.updateCrisisEventStatus(selectedEvent.id, {
                      status: "in-progress",
                      notes: interventionNotes || undefined,
                    });
                    await loadEvents();
                    setShowInterventionModal(false);
                    setInterventionNotes("");
                  } catch (err) {
                    console.error("Failed to update crisis event", err);
                  } finally {
                    setIsUpdating(false);
                  }
                }}
              >
                <Zap className="w-4 h-4" />
                {isUpdating ? "Saving…" : "Start Intervention → In Progress"}
                {!isUpdating && <ArrowRight className="w-4 h-4 ml-auto" />}
              </Button>
              <Button variant="outline" className="px-5" onClick={() => { setShowInterventionModal(false); setInterventionNotes(""); }}>
                Cancel
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* ── Step 3 Modal: In Progress → Resolved ── */}
      {showResolveModal && selectedEvent && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowResolveModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full uppercase tracking-wide">Step 3 of 3</span>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">Resolve Case</h3>
                <p className="text-gray-500 text-sm mt-1">{selectedEvent.userName}</p>
              </div>
              <button onClick={() => setShowResolveModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="mb-5">
              <WorkflowStepper currentStatus="in-progress" />
              <p className="text-xs text-gray-400 text-center mt-1">This case will be marked as <strong>Resolved</strong></p>
            </div>

            {/* Outcome */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Resolution Outcome</label>
              <div className="space-y-2">
                {([
                  { value: "safe",       label: "User is safe",               sub: "Crisis de-escalated, user confirmed safe",         color: "green" },
                  { value: "referred",   label: "Referred to professional",    sub: "User connected with mental health professional",   color: "blue" },
                  { value: "no-contact", label: "Could not reach user",        sub: "All attempts exhausted, escalated to authorities", color: "orange" },
                ] as const).map(({ value, label, sub, color }) => {
                  const active = resolutionOutcome === value;
                  return (
                    <button
                      key={value}
                      onClick={() => setResolutionOutcome(value)}
                      className={`w-full p-3 border-2 rounded-xl text-left transition-all ${
                        active ? `border-${color}-400 bg-${color}-50` : "border-gray-200 bg-white hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${active ? `border-${color}-500 bg-${color}-500` : "border-gray-300"}`} />
                        <div>
                          <p className={`text-sm font-semibold ${active ? `text-${color}-900` : "text-gray-800"}`}>{label}</p>
                          <p className="text-xs text-gray-500">{sub}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Resolution notes */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Resolution Notes</label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                rows={3}
                placeholder="Summarise what was done, who was involved, and what follow-up (if any) is needed…"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none resize-none text-sm"
              />
            </div>

            <div className="flex gap-3">
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
                disabled={isUpdating}
                onClick={async () => {
                  if (!selectedEvent) return;
                  try {
                    setIsUpdating(true);
                    await api.admin.updateCrisisEventStatus(selectedEvent.id, {
                      status: "resolved",
                      notes: resolutionNotes || undefined,
                    });
                    await loadEvents();
                    setShowResolveModal(false);
                    setResolutionNotes("");
                  } catch (err) {
                    console.error("Failed to update crisis event", err);
                  } finally {
                    setIsUpdating(false);
                  }
                }}
              >
                <CheckCircle className="w-4 h-4" />
                {isUpdating ? "Saving…" : "Mark as Resolved"}
                {!isUpdating && <ArrowRight className="w-4 h-4 ml-auto" />}
              </Button>
              <Button variant="outline" className="px-5" onClick={() => { setShowResolveModal(false); setResolutionNotes(""); }}>
                Cancel
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* ── Move Back Confirmation Modal ── */}
      {showMoveBackModal && moveBackEvent && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowMoveBackModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <RotateCcw className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Move Case Back?</h3>
                  <p className="text-sm text-gray-500">{moveBackEvent.userName}</p>
                </div>
              </div>
              <button onClick={() => setShowMoveBackModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-5">
              <p className="text-sm text-orange-800">
                This will move <strong>{moveBackEvent.userName}</strong>'s case from{" "}
                <strong className="capitalize">{moveBackEvent.status.replace("-", " ")}</strong> back to{" "}
                <strong>{getPreviousStatusLabel(moveBackEvent.status)}</strong>.
              </p>
              <p className="text-xs text-orange-600 mt-2">
                Use this only to correct an accidental status change. All previous notes will be preserved.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                className="flex-1 bg-orange-500 hover:bg-orange-600 gap-2"
                disabled={isUpdating}
                onClick={async () => {
                  if (!moveBackEvent) return;
                  const prevStatus = getPreviousStatus(moveBackEvent.status);
                  if (!prevStatus) return;
                  try {
                    setIsUpdating(true);
                    await api.admin.updateCrisisEventStatus(moveBackEvent.id, {
                      status: prevStatus,
                    });
                    await loadEvents();
                    setShowMoveBackModal(false);
                    setMoveBackEvent(null);
                  } catch (err) {
                    console.error("Failed to move case back", err);
                  } finally {
                    setIsUpdating(false);
                  }
                }}
              >
                <RotateCcw className="w-4 h-4" />
                {isUpdating ? "Saving…" : `Move Back to ${getPreviousStatusLabel(moveBackEvent.status)}`}
              </Button>
              <Button
                variant="outline"
                className="px-5"
                onClick={() => { setShowMoveBackModal(false); setMoveBackEvent(null); }}
              >
                Cancel
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* View Details Modal */}
      {showDetailsModal && selectedEvent && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowDetailsModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-6 pb-4 border-b border-gray-200">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-2xl font-bold text-gray-900">Crisis Event Details</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getRiskColor(selectedEvent.riskLevel)}`}>
                    {selectedEvent.riskLevel.toUpperCase()}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedEvent.status)}`}>
                    {selectedEvent.status.replace("-", " ").toUpperCase()}
                  </span>
                </div>
                <p className="text-gray-600">Event #{selectedEvent.id} • {selectedEvent.timestamp}</p>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <AlertCircle className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* User Information */}
            <div className="mb-6">
              <h4 className="font-bold text-lg text-gray-900 mb-3 flex items-center gap-2">
                <User className="w-5 h-5" />
                User Information
              </h4>
              <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-xl p-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">User Name</p>
                  <p className="font-semibold text-gray-900">{selectedEvent.userName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">User ID</p>
                  <p className="font-semibold text-gray-900">{selectedEvent.userId}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Event Type</p>
                  <p className="font-semibold text-gray-900">{selectedEvent.type}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Detection Time</p>
                  <p className="font-semibold text-gray-900">{selectedEvent.timestamp}</p>
                </div>
              </div>
            </div>

            {/* Risk Assessment */}
            <div className="mb-6">
              <h4 className="font-bold text-lg text-gray-900 mb-3 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Risk Assessment
              </h4>
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Risk Level</p>
                    <span className={`inline-block px-4 py-2 rounded-full text-sm font-bold ${getRiskColor(selectedEvent.riskLevel)}`}>
                      {selectedEvent.riskLevel.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">AI Confidence Score</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-red-600 h-3 rounded-full transition-all"
                          style={{ width: `${selectedEvent.aiConfidence}%` }}
                        />
                      </div>
                      <span className="font-bold text-gray-900">{selectedEvent.aiConfidence}%</span>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-2">Detected Crisis Keywords</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedEvent.keywords.map((keyword, i) => (
                      <span key={i} className="px-3 py-1 bg-red-200 text-red-900 rounded-lg text-sm font-medium">
                        "{keyword}"
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Response Information */}
            <div className="mb-6">
              <h4 className="font-bold text-lg text-gray-900 mb-3 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Response Information
              </h4>
              <div className="grid grid-cols-2 gap-4 bg-blue-50 rounded-xl p-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Current Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedEvent.status)}`}>
                    {selectedEvent.status.replace("-", " ").toUpperCase()}
                  </span>
                </div>
                {selectedEvent.responseTime && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Response Time</p>
                    <p className="font-semibold text-gray-900 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {selectedEvent.responseTime}
                    </p>
                  </div>
                )}
                {selectedEvent.assignedTo && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Assigned To</p>
                    <p className="font-semibold text-gray-900">{selectedEvent.assignedTo}</p>
                  </div>
                )}
                {selectedEvent.lastContact && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Last Contact</p>
                    <p className="font-semibold text-gray-900">{selectedEvent.lastContact}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Timeline */}
            <div className="mb-6">
              <h4 className="font-bold text-lg text-gray-900 mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Event Timeline
              </h4>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="w-2 bg-red-500 rounded-full" />
                  <div className="flex-1 pb-3">
                    <p className="font-semibold text-gray-900">Crisis Event Detected</p>
                    <p className="text-sm text-gray-600">{selectedEvent.timestamp}</p>
                    <p className="text-sm text-gray-700 mt-1">AI system detected potential crisis indicators with {selectedEvent.aiConfidence}% confidence</p>
                  </div>
                </div>
                {selectedEvent.assignedTo && (
                  <div className="flex gap-3">
                    <div className="w-2 bg-blue-500 rounded-full" />
                    <div className="flex-1 pb-3">
                      <p className="font-semibold text-gray-900">Event Assigned</p>
                      <p className="text-sm text-gray-600">Assigned to {selectedEvent.assignedTo}</p>
                    </div>
                  </div>
                )}
                {selectedEvent.status !== "pending" && (
                  <div className="flex gap-3">
                    <div className="w-2 bg-green-500 rounded-full" />
                    <div className="flex-1 pb-3">
                      <p className="font-semibold text-gray-900">Response Initiated</p>
                      <p className="text-sm text-gray-600">Contact established with user</p>
                      {selectedEvent.responseTime && (
                        <p className="text-sm text-gray-700 mt-1">Response time: {selectedEvent.responseTime}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Emergency Contact Information */}
            <div className="mb-6">
              <h4 className="font-bold text-lg text-gray-900 mb-3 flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Emergency Resources
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="font-semibold text-red-900 mb-1">Crisis Hotline</p>
                  <p className="text-2xl font-bold text-red-700">988</p>
                  <p className="text-xs text-red-600 mt-1">24/7 Suicide & Crisis Lifeline</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="font-semibold text-red-900 mb-1">Emergency Services</p>
                  <p className="text-2xl font-bold text-red-700">911</p>
                  <p className="text-xs text-red-600 mt-1">Immediate emergency response</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              {selectedEvent.status === "pending" && (
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 gap-2"
                  onClick={() => { setShowDetailsModal(false); setShowContactModal(true); }}
                >
                  <Phone className="w-4 h-4" />
                  Log Contact
                  <ArrowRight className="w-4 h-4 ml-auto" />
                </Button>
              )}
              {selectedEvent.status === "contacted" && (
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 gap-2"
                  onClick={() => { setShowDetailsModal(false); setShowInterventionModal(true); }}
                >
                  <Zap className="w-4 h-4" />
                  Begin Intervention
                  <ArrowRight className="w-4 h-4 ml-auto" />
                </Button>
              )}
              {selectedEvent.status === "in-progress" && (
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
                  onClick={() => { setShowDetailsModal(false); setShowResolveModal(true); }}
                >
                  <CheckCircle className="w-4 h-4" />
                  Resolve Case
                  <ArrowRight className="w-4 h-4 ml-auto" />
                </Button>
              )}
              <Button
                variant="outline"
                className="px-6"
                onClick={() => setShowDetailsModal(false)}
              >
                Close
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AdminLayoutNew>
  );
}
