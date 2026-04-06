import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  ArrowLeft,
  AlertTriangle,
  Phone,
  Mail,
  MessageSquare,
  Shield,
  Clock,
  User,
  CheckCircle,
  PhoneCall,
  Send,
  FileText,
  Activity,
  Heart,
  Download,
  X,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../../lib/api";

interface CrisisEvent {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  riskLevel: "critical" | "high" | "medium" | "low";
  type: string;
  keywords: string[];
  timestamp: string;
  detectedAt?: string;
  status: "pending" | "contacted" | "in-progress" | "resolved";
  aiConfidence: number;
  sessionId?: string;
  location?: string;
  timezone?: string;
  notes?: string | null;
  resolvedAt?: string | null;
  emergencyContact?: {
    name: string;
    relationship?: string;
    phone?: string;
  } | null;
  companion?: {
    name: string;
    specialty?: string;
    phone?: string;
  } | null;
}

type UserHistoryRow = {
  date: string;
  event: string;
  mood?: number;
  notes: string;
  riskLevel: "high" | "medium" | "low";
};

type ActionLogItem = {
  iso: string;
  time: string;
  date: string;
  action: string;
  performer: string;
  details: string;
  severity: "critical" | "high" | "medium" | "low";
};

function dash(v?: string | null) {
  const t = v?.trim();
  return t ? t : "—";
}

function riskToUserHistoryLevel(
  rk: string
): UserHistoryRow["riskLevel"] {
  if (rk === "critical" || rk === "high") return "high";
  if (rk === "medium") return "medium";
  return "low";
}

function buildUserHistory(data: Record<string, unknown>): UserHistoryRow[] {
  const rows: { at: number; row: UserHistoryRow }[] = [];
  const moods = (data.recent_mood_entries as Array<Record<string, unknown>> | undefined) || [];
  for (const m of moods) {
    const created = m.created_at as string | undefined;
    if (!created) continue;
    const at = new Date(created).getTime();
    const intensity = typeof m.intensity === "number" ? m.intensity : 5;
    const risk: UserHistoryRow["riskLevel"] =
      intensity >= 8 ? "high" : intensity >= 5 ? "medium" : "low";
    rows.push({
      at,
      row: {
        date: formatDateTime(created),
        event: `Mood check-in (${String(m.mood || "—")})`,
        mood: intensity,
        notes: typeof m.notes === "string" && m.notes.trim() ? m.notes.trim() : "—",
        riskLevel: risk,
      },
    });
  }
  const prior = (data.prior_crisis_events as Array<Record<string, unknown>> | undefined) || [];
  for (const p of prior) {
    const created = p.created_at as string | undefined;
    if (!created) continue;
    const at = new Date(created).getTime();
    const rk = String(p.risk_level || "medium");
    rows.push({
      at,
      row: {
        date: formatDateTime(created),
        event: `Prior crisis: ${String(p.event_type || "Crisis event")}`,
        notes:
          Array.isArray(p.keywords) && p.keywords.length
            ? `Keywords: ${(p.keywords as string[]).join(", ")}`
            : "—",
        riskLevel: riskToUserHistoryLevel(rk),
      },
    });
  }
  rows.sort((a, b) => b.at - a.at);
  return rows.slice(0, 12).map((x) => x.row);
}

function severityFromRisk(rk: string): ActionLogItem["severity"] {
  if (rk === "critical") return "critical";
  if (rk === "high") return "high";
  if (rk === "medium") return "medium";
  return "low";
}

function buildActionTimeline(data: Record<string, unknown>): ActionLogItem[] {
  const items: ActionLogItem[] = [];
  const createdRaw = data.created_at as string | undefined;
  if (createdRaw) {
    const d = new Date(createdRaw);
    const iso = d.toISOString();
    const rk = String(data.risk_level || "medium");
    const kws = Array.isArray(data.keywords) ? (data.keywords as string[]).filter(Boolean) : [];
    items.push({
      iso,
      time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      date: d.toLocaleDateString(),
      action: "Crisis event recorded",
      performer: "System",
      details: `Risk: ${rk}. Keywords: ${kws.length ? kws.join(", ") : "none logged"}.`,
      severity: severityFromRisk(rk),
    });
  }
  const notes = typeof data.notes === "string" ? data.notes.trim() : "";
  if (notes) {
    const ref = (data.resolved_at as string | undefined) || createdRaw;
    const d = ref ? new Date(ref) : new Date();
    items.push({
      iso: d.toISOString(),
      time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      date: d.toLocaleDateString(),
      action: "Case notes on file",
      performer: "Staff",
      details: notes,
      severity: "medium",
    });
  }
  const resolvedRaw = data.resolved_at as string | undefined;
  if (resolvedRaw) {
    const d = new Date(resolvedRaw);
    items.push({
      iso: d.toISOString(),
      time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      date: d.toLocaleDateString(),
      action: "Case resolved",
      performer: "System",
      details: "Status marked resolved.",
      severity: "low",
    });
  }
  items.sort((a, b) => new Date(b.iso).getTime() - new Date(a.iso).getTime());
  return items;
}

function riskBannerClass(level: CrisisEvent["riskLevel"]) {
  switch (level) {
    case "critical":
      return {
        card: "bg-red-50 border-2 border-red-500",
        iconBg: "bg-red-600",
        title: "Critical crisis alert",
        badge: "bg-red-600 text-white",
        text: "text-red-900",
        sub: "text-red-800",
        chip: "bg-red-600 text-white",
      };
    case "high":
      return {
        card: "bg-orange-50 border-2 border-orange-500",
        iconBg: "bg-orange-600",
        title: "High risk crisis alert",
        badge: "bg-orange-600 text-white",
        text: "text-orange-950",
        sub: "text-orange-900",
        chip: "bg-orange-600 text-white",
      };
    case "medium":
      return {
        card: "bg-amber-50 border-2 border-amber-400",
        iconBg: "bg-amber-500",
        title: "Medium risk alert",
        badge: "bg-amber-600 text-white",
        text: "text-amber-950",
        sub: "text-amber-900",
        chip: "bg-amber-600 text-white",
      };
    default:
      return {
        card: "bg-slate-50 border-2 border-slate-300",
        iconBg: "bg-slate-600",
        title: "Crisis event",
        badge: "bg-slate-600 text-white",
        text: "text-slate-900",
        sub: "text-slate-800",
        chip: "bg-slate-600 text-white",
      };
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function formatRelativeTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min${diffMinutes === 1 ? "" : "s"} ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function mapApiEvent(event: Record<string, unknown>): CrisisEvent {
  const profile = event.profiles as Record<string, unknown> | undefined;
  const assignedProfile = event.assigned_profile as Record<string, unknown> | undefined;
  const contacts = (event.emergency_contacts_list as Array<Record<string, unknown>> | undefined) || [];
  const firstContact = contacts[0];
  const userName =
    (profile?.full_name as string | undefined) ||
    (profile?.email as string | undefined) ||
    "Unknown user";
  const userEmail = profile?.email as string | undefined;
  const riskLevel = (event.risk_level || "medium") as CrisisEvent["riskLevel"];
  const status = (event.status || "pending") as CrisisEvent["status"];

  const ecFromTable =
    firstContact &&
    (firstContact.name || firstContact.phone || firstContact.email)
      ? {
          name: String(firstContact.name || "Emergency contact"),
          relationship:
            typeof firstContact.relationship === "string"
              ? firstContact.relationship
              : undefined,
          phone: [firstContact.phone, firstContact.email].filter(Boolean).join(" · ") || undefined,
        }
      : null;

  const ecFromProfile =
    !ecFromTable &&
    (profile?.emergency_contact_name || profile?.emergency_contact_phone)
      ? {
          name: String(profile.emergency_contact_name || "Emergency contact"),
          relationship: profile.emergency_contact_relationship as string | undefined,
          phone: (profile.emergency_contact_phone as string | undefined) || undefined,
        }
      : null;

  return {
    id: String(event.id),
    userId: String(event.user_id),
    userName,
    userEmail,
    userPhone: (profile?.phone as string | undefined) || undefined,
    riskLevel,
    type: (event.event_type as string) || "Crisis event",
    keywords: Array.isArray(event.keywords) ? (event.keywords as string[]) : [],
    timestamp: formatRelativeTime(event.created_at as string | undefined),
    detectedAt: formatDateTime(event.created_at as string | undefined),
    status,
    aiConfidence: typeof event.ai_confidence === "number" ? event.ai_confidence : 0,
    sessionId: undefined,
    location: undefined,
    timezone: (profile?.timezone as string | undefined) || undefined,
    notes: (event.notes as string | null | undefined) ?? null,
    resolvedAt: (event.resolved_at as string | null | undefined) ?? null,
    emergencyContact: ecFromTable || ecFromProfile,
    companion: assignedProfile
      ? {
          name:
            (assignedProfile.full_name as string | undefined) ||
            (assignedProfile.email as string | undefined) ||
            "Assigned specialist",
          specialty: undefined,
          phone: (assignedProfile.phone as string | undefined) || undefined,
        }
      : null,
  };
}

export function CrisisEventDetails() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const eventId = searchParams.get("id");

  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showEmergencyContactModal, setShowEmergencyContactModal] = useState(false);
  const [showTherapistModal, setShowTherapistModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showCompleteLogModal, setShowCompleteLogModal] = useState(false);
  const [notes, setNotes] = useState("");
  const [caseNotes, setCaseNotes] = useState("");
  const [statusNotes, setStatusNotes] = useState("");
  const [emailContent, setEmailContent] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [event, setEvent] = useState<CrisisEvent | null>(null);
  const [detailPayload, setDetailPayload] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(() => Boolean(eventId));
  const [listLoading, setListLoading] = useState(() => !eventId);
  const [listRows, setListRows] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const reloadDetail = useCallback(async () => {
    if (!eventId) return;
    try {
      const data = await api.admin.getCrisisEvent(eventId);
      setDetailPayload(data as Record<string, unknown>);
      setEvent(mapApiEvent(data as Record<string, unknown>));
    } catch (err) {
      console.error("Failed to refresh crisis event", err);
    }
  }, [eventId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!eventId) {
        setIsLoading(false);
        setListLoading(true);
        setError(null);
        setEvent(null);
        setDetailPayload(null);
        try {
          const data = await api.admin.getCrisisEvents({ limit: 80 });
          const rows = Array.isArray(data) ? data : [];
          if (!cancelled) setListRows(rows as Record<string, unknown>[]);
        } catch (err) {
          console.error("Failed to fetch crisis events list", err);
          if (!cancelled) setError("Failed to load crisis events");
        } finally {
          if (!cancelled) setListLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const data = await api.admin.getCrisisEvent(eventId);
        if (cancelled) return;
        setDetailPayload(data as Record<string, unknown>);
        setEvent(mapApiEvent(data as Record<string, unknown>));
      } catch (err) {
        console.error("Failed to fetch crisis event", err);
        if (!cancelled) setError("Failed to load crisis event");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const userHistoryRows = useMemo(
    () => (detailPayload ? buildUserHistory(detailPayload) : []),
    [detailPayload]
  );
  const actionLogFull = useMemo(
    () => (detailPayload ? buildActionTimeline(detailPayload) : []),
    [detailPayload]
  );
  const actionHistoryPreview = useMemo(() => actionLogFull.slice(0, 3), [actionLogFull]);
  const riskB = useMemo(() => (event ? riskBannerClass(event.riskLevel) : null), [event]);

  const quickActions = [
    {
      id: "call",
      label: "Call User",
      icon: Phone,
      color: "bg-blue-600 hover:bg-blue-700",
      description: "Initiate immediate phone contact",
    },
    {
      id: "emergency",
      label: "Contact Emergency Services",
      icon: AlertTriangle,
      color: "bg-red-600 hover:bg-red-700",
      description: "Call 911 or local emergency services",
    },
    {
      id: "contact",
      label: "Call Emergency Contact",
      icon: PhoneCall,
      color: "bg-orange-600 hover:bg-orange-700",
      description: "Contact designated emergency contact",
    },
    {
      id: "email",
      label: "Send Email",
      icon: Mail,
      color: "bg-purple-600 hover:bg-purple-700",
      description: "Send supportive email message",
    },
    {
      id: "companion",
      label: "Alert Companion",
      icon: User,
      color: "bg-green-600 hover:bg-green-700",
      description: "Notify assigned crisis specialist",
    },
    {
      id: "notes",
      label: "Add Notes",
      icon: FileText,
      color: "bg-gray-600 hover:bg-gray-700",
      description: "Document intervention details",
    },
  ];

  const handleAction = (actionId: string) => {
    setSelectedAction(actionId);
    if (actionId === "notes") {
      setCaseNotes(event?.notes || "");
      setShowNotes(true);
    } else if (actionId === "call") {
      setShowCallModal(true);
    } else if (actionId === "email") {
      setShowEmailModal(true);
    } else if (actionId === "emergency") {
      setShowEmergencyModal(true);
    } else if (actionId === "contact") {
      setShowEmergencyContactModal(true);
    } else if (actionId === "companion") {
      setShowTherapistModal(true);
    } else if (actionId === "status") {
      setShowStatusModal(true);
    } else {
      // Demo alert
      alert(`Performing action: ${actionId}`);
    }
  };

  if (!eventId) {
    if (listLoading) {
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
            <Button variant="outline" asChild>
              <Link to="/admin/crisis-dashboard">Back to Crisis Dashboard</Link>
            </Button>
          </div>
        </AdminLayoutNew>
      );
    }
    return (
      <AdminLayoutNew>
        <div className="space-y-6" key="crisis-events-index">
          <div>
            <Button variant="ghost" className="gap-2 mb-4" asChild>
              <Link to="/admin/crisis-dashboard">
                <ArrowLeft className="w-4 h-4" />
                Back to Crisis Dashboard
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">Crisis events</h1>
            <p className="text-muted-foreground mt-1">Select an event to open full details.</p>
          </div>
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-semibold">When</th>
                    <th className="text-left p-3 font-semibold">User</th>
                    <th className="text-left p-3 font-semibold">Risk</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                    <th className="text-left p-3 font-semibold">Type</th>
                    <th className="text-right p-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {listRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        No crisis events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    listRows.map((row) => {
                      const id = String(row.id);
                      const prof = row.profiles as Record<string, unknown> | undefined;
                      const name =
                        (prof?.full_name as string) || (prof?.email as string) || "Unknown user";
                      const created = row.created_at as string | undefined;
                      const rel = created ? formatRelativeTime(created) : "—";
                      const rk = String(row.risk_level || "medium");
                      const st = String(row.status || "pending");
                      return (
                        <tr key={id} className="border-t border-border hover:bg-muted/30">
                          <td className="p-3 whitespace-nowrap">{rel}</td>
                          <td className="p-3">{name}</td>
                          <td className="p-3 uppercase text-xs font-semibold">{rk}</td>
                          <td className="p-3">{st.replace(/-/g, " ")}</td>
                          <td className="p-3 max-w-[200px] truncate">
                            {(row.event_type as string) || "Crisis event"}
                          </td>
                          <td className="p-3 text-right">
                            <Button size="sm" variant="outline" asChild>
                              <Link to={`/admin/crisis-event-details?id=${encodeURIComponent(id)}`}>View</Link>
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </AdminLayoutNew>
    );
  }

  if (eventId && isLoading) {
    return (
      <AdminLayoutNew>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayoutNew>
    );
  }

  if (eventId && (error || !event)) {
    return (
      <AdminLayoutNew>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <p className="text-red-600 font-medium">{error || "Crisis event not found"}</p>
          <Button variant="outline" asChild>
            <Link to="/admin/crisis-dashboard">Back to Crisis Dashboard</Link>
          </Button>
        </div>
      </AdminLayoutNew>
    );
  }

  if (!event) {
    return null;
  }

  return (
    <AdminLayoutNew>
      <div className="space-y-6" key={eventId}>
        {/* Header */}
        <div
        >
          <Button variant="ghost" className="gap-2 mb-4" asChild>
            <Link to="/admin/crisis-dashboard">
              <ArrowLeft className="w-4 h-4" />
              Back to Crisis Dashboard
            </Link>
          </Button>

          {/* Risk banner (data from crisis_events) */}
          {riskB && (
            <Card className={`p-6 mb-6 ${riskB.card}`}>
              <div className="flex items-start gap-4">
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${
                    event.riskLevel === "critical" ? "animate-pulse " : ""
                  }${riskB.iconBg}`}
                >
                  <AlertTriangle className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h2 className={`text-2xl font-bold ${riskB.text}`}>{riskB.title.toUpperCase()}</h2>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${riskB.badge}`}>
                      REVIEW REQUIRED
                    </span>
                  </div>
                  <p className={`font-medium mb-2 ${riskB.sub}`}>
                    {event.type} — {event.userName} ({event.userId})
                  </p>
                  <p className={`text-sm mb-3 ${riskB.sub}`}>
                    AI confidence: {event.aiConfidence}% • Detected {event.timestamp}
                    {event.detectedAt ? ` • ${event.detectedAt}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {event.keywords.length === 0 ? (
                      <span className="text-sm opacity-80">No keywords stored for this event.</span>
                    ) : (
                      event.keywords.map((keyword, i) => (
                        <span
                          key={i}
                          className={`px-3 py-1 rounded-full text-sm font-medium ${riskB.chip}`}
                        >
                          {keyword}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* User Information */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div
          >
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                User Information
              </h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-2xl font-bold">
                    {event.userName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-lg">{event.userName}</p>
                    <p className="text-sm text-muted-foreground">{event.userId}</p>
                  </div>
                </div>

                <div className="pt-4 space-y-3 border-t">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="font-medium text-sm">{dash(event.userEmail)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="font-medium text-sm">{dash(event.userPhone)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Timezone</p>
                      <p className="font-medium text-sm">{dash(event.timezone)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div
          >
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-primary" />
                Emergency Contact
              </h3>
              <div className="space-y-4">
                {event.emergencyContact ? (
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="font-bold mb-1">{event.emergencyContact.name}</p>
                    <p className="text-sm text-muted-foreground mb-2">
                      {dash(event.emergencyContact.relationship)}
                    </p>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4" />
                      <span className="font-medium">{dash(event.emergencyContact.phone)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No emergency contact on file (profile or saved contacts).
                  </p>
                )}

                <Button
                  className="w-full gap-2 bg-orange-600 hover:bg-orange-700"
                  disabled={!event.emergencyContact}
                  onClick={() => setShowEmergencyContactModal(true)}
                >
                  <PhoneCall className="w-4 h-4" />
                  Call Emergency Contact
                </Button>
              </div>

              <div className="mt-6 pt-6 border-t">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Crisis Specialist
                </h3>
                {event.companion ? (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="font-bold mb-1">{event.companion.name}</p>
                    <p className="text-sm text-muted-foreground mb-2">
                      {dash(event.companion.specialty)}
                    </p>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4" />
                      <span className="font-medium">{dash(event.companion.phone)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No specialist assigned yet.</p>
                )}

                <Button
                  variant="outline"
                  className="w-full gap-2 mt-3"
                  disabled={!event.companion}
                  onClick={() => setShowTherapistModal(true)}
                >
                  <Send className="w-4 h-4" />
                  Notify Specialist
                </Button>
              </div>
            </Card>
          </div>

          <div
          >
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Event Details
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Risk Level</p>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-bold text-white ${
                      event.riskLevel === "critical"
                        ? "bg-red-600"
                        : event.riskLevel === "high"
                          ? "bg-orange-500"
                          : event.riskLevel === "medium"
                            ? "bg-amber-500"
                            : "bg-slate-500"
                    }`}
                  >
                    {event.riskLevel.toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Event Type</p>
                  <p className="font-medium">{event.type}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">AI Confidence</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-red-600 h-2 rounded-full"
                        style={{ width: `${event.aiConfidence}%` }}
                      />
                    </div>
                    <span className="font-bold text-red-600">{event.aiConfidence}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Detected At</p>
                  <p className="font-medium">{event.detectedAt}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Session</p>
                  <p className="font-medium text-muted-foreground">
                    {event.sessionId || "Not linked to an app session in this record"}
                  </p>
                </div>
                {event.resolvedAt && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Resolved</p>
                    <p className="font-medium">{formatDateTime(event.resolvedAt)}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium border border-red-300">
                    {event.status.replace("-", " ").toUpperCase()}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div
        >
          <Card className="p-6">
            <h3 className="font-bold text-lg mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {quickActions.map((action, index) => (
                <button
                  key={action.id}
                  onClick={() => handleAction(action.id)}
                  className={`p-4 rounded-lg text-white text-center hover:shadow-lg transition-all ${action.color}`}
                >
                  <action.icon className="w-6 h-6 mx-auto mb-2" />
                  <p className="font-medium text-sm">{action.label}</p>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Detection summary (chat transcripts are not stored server-side) */}
        <div
        >
          <Card className="p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Detection summary
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Full conversation transcripts are not stored. The information below is what was persisted when this
              crisis event was created.
            </p>
            {event.notes?.trim() ? (
              <div className="mb-4 p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Case notes</p>
                <p className="text-sm whitespace-pre-wrap">{event.notes.trim()}</p>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {event.keywords.length === 0 ? (
                <span className="text-sm text-muted-foreground">No keywords on record.</span>
              ) : (
                event.keywords.map((keyword, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium border border-red-200"
                  >
                    {keyword}
                  </span>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* User History */}
          <div
          >
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Recent User History
              </h3>
              <div className="space-y-3">
                {userHistoryRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No recent mood check-ins or prior crisis events for this user in the database.
                  </p>
                ) : (
                  userHistoryRows.map((item, index) => (
                    <div
                      key={index}
                      className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-medium">{item.event}</p>
                          <p className="text-sm text-muted-foreground">{item.date}</p>
                        </div>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            item.riskLevel === "high"
                              ? "bg-red-100 text-red-700"
                              : item.riskLevel === "medium"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-green-100 text-green-700"
                          }`}
                        >
                          {item.riskLevel}
                        </span>
                      </div>
                      {item.mood !== undefined && (
                        <div className="flex items-center gap-2 mb-2">
                          <Heart className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">Intensity: {item.mood}/10</span>
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground">{item.notes}</p>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* Action History */}
          <div
          >
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Action History
              </h3>
              <div className="space-y-3">
                {actionHistoryPreview.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No timeline entries for this event yet.</p>
                ) : (
                  actionHistoryPreview.map((action, index) => (
                    <div
                      key={`${action.iso}-${index}`}
                      className="p-4 bg-blue-50 border border-blue-200 rounded-lg"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <p className="font-medium">{action.action}</p>
                        <span className="text-xs text-muted-foreground">{action.time}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">By: {action.performer}</p>
                      <p className="text-sm">{action.details}</p>
                    </div>
                  ))
                )}
              </div>

              <Button variant="outline" className="w-full mt-4 gap-2" onClick={() => setShowCompleteLogModal(true)}>
                <FileText className="w-4 h-4" />
                View Complete Log
              </Button>
            </Card>
          </div>
        </div>

        {/* Status Update */}
        <div
        >
          <Card className="p-6">
            <h3 className="font-bold text-lg mb-4">Update Case Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => {
                  setSelectedStatus("contacted");
                  setStatusNotes("");
                  setShowStatusModal(true);
                }}
              >
                <Clock className="w-4 h-4" />
                Mark Contacted
              </Button>
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => {
                  setSelectedStatus("in-progress");
                  setStatusNotes("");
                  setShowStatusModal(true);
                }}
              >
                <Activity className="w-4 h-4" />
                In Progress
              </Button>
              <Button 
                variant="outline" 
                className="gap-2 text-green-600 border-green-300"
                onClick={() => {
                  setSelectedStatus("resolved");
                  setStatusNotes("");
                  setShowStatusModal(true);
                }}
              >
                <CheckCircle className="w-4 h-4" />
                Resolve Case
              </Button>
              <Button 
                variant="outline" 
                className="gap-2 text-red-600 border-red-300"
                onClick={() => {
                  setSelectedStatus("escalated");
                  setStatusNotes("");
                  setShowStatusModal(true);
                }}
              >
                <AlertTriangle className="w-4 h-4" />
                Escalate
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Add Notes Modal */}
              {showNotes && (
          <div
            key="crisis-notes-overlay"
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowNotes(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl"
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Add Crisis Notes</h3>
                  <p className="text-gray-600">{event.userName} - Case #{event.id}</p>
                </div>
                <button
                  onClick={() => setShowNotes(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Notes</label>
                <textarea
                  value={caseNotes}
                  onChange={(e) => setCaseNotes(e.target.value)}
                  rows={8}
                  placeholder="Document intervention details, actions taken, user's response, follow-up plans..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1 gap-2"
                  disabled={isUpdating}
                  onClick={async () => {
                    try {
                      setIsUpdating(true);
                      await api.admin.updateCrisisEventStatus(event.id, {
                        notes: caseNotes.trim() || undefined,
                      });
                      await reloadDetail();
                      setShowNotes(false);
                    } catch (e) {
                      console.error("Failed to save crisis notes", e);
                    } finally {
                      setIsUpdating(false);
                    }
                  }}
                >
                  <FileText className="w-4 h-4" />
                  Save Notes
                </Button>
                <Button
                  variant="outline"
                  className="px-6"
                  onClick={() => {
                    setShowNotes(false);
                    setCaseNotes("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

      {/* Call User Modal - Similar to Crisis Monitoring */}
              {showCallModal && (
          <div
            key="crisis-call-overlay"
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCallModal(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl"
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Initiate Crisis Call</h3>
                  <p className="text-gray-600">{event.userName} ({dash(event.userPhone)})</p>
                </div>
                <button
                  onClick={() => setShowCallModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                  <div>
                    <p className="font-bold text-red-900 mb-2">Crisis Protocol Reminder</p>
                    <ul className="text-sm text-red-800 space-y-1">
                      <li>• Remain calm and empathetic</li>
                      <li>• Listen actively without judgment</li>
                      <li>• Assess immediate safety and suicide risk</li>
                      <li>• Do not leave user alone if imminent danger</li>
                      <li>• Connect to emergency services if needed (911)</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">Emergency Resources Ready</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <p className="text-xs text-gray-600 mb-1">Suicide Hotline</p>
                    <p className="font-bold text-gray-900">988</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <p className="text-xs text-gray-600 mb-1">Emergency Services</p>
                    <p className="font-bold text-gray-900">911</p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Call Notes</label>
                <textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  rows={4}
                  placeholder="Document the call: user's state, actions taken, outcome, next steps..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 gap-2"
                  onClick={() => {
                    console.log('Initiating call:', callNotes);
                    setShowCallModal(false);
                    setCallNotes("");
                  }}
                >
                  <Phone className="w-4 h-4" />
                  Start Call
                </Button>
                <Button
                  variant="outline"
                  className="px-6"
                  onClick={() => {
                    setShowCallModal(false);
                    setCallNotes("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

      {/* Send Email Modal */}
              {showEmailModal && (
          <div
            key="crisis-email-overlay"
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowEmailModal(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Send Crisis Support Email</h3>
                  <p className="text-gray-600">{event.userName} ({event.userEmail})</p>
                </div>
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">Email Template</label>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button 
                    className="p-3 border-2 border-purple-500 bg-purple-50 rounded-xl text-left hover:bg-purple-100 transition-colors"
                    onClick={() => setEmailContent(`Dear ${event.userName},\n\nWe noticed you may be going through a difficult time, and we want you to know that support is available. Your wellbeing is important to us.\n\nIf you're experiencing a crisis, please reach out to:\n- National Suicide Prevention Lifeline: 988\n- Crisis Text Line: Text HOME to 741741\n- Emergency Services: 911\n\nOur team is here to support you. Please don't hesitate to reach out.\n\nWith care,\nEzri Crisis Support Team`)}
                  >
                    <p className="font-semibold text-purple-900 text-sm">Supportive Check-in</p>
                    <p className="text-xs text-purple-700 mt-1">Empathetic outreach with resources</p>
                  </button>
                  <button 
                    className="p-3 border-2 border-gray-300 bg-white rounded-xl text-left hover:bg-gray-50 transition-colors"
                    onClick={() => setEmailContent(`Dear ${event.userName},\n\nThis is an urgent message regarding your recent session. We are deeply concerned about your safety and wellbeing.\n\nPlease contact us immediately or reach out to emergency services:\n- Call 911 for immediate emergency assistance\n- National Suicide Prevention Lifeline: 988 (24/7)\n- Crisis Text Line: Text HOME to 741741\n\nYour life matters. Help is available.\n\nUrgently,\nEzri Crisis Support Team`)}
                  >
                    <p className="font-semibold text-gray-900 text-sm">Urgent Safety Outreach</p>
                    <p className="text-xs text-gray-700 mt-1">Immediate safety concerns</p>
                  </button>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email Message</label>
                <textarea
                  value={emailContent}
                  onChange={(e) => setEmailContent(e.target.value)}
                  rows={10}
                  placeholder="Write your email message..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-purple-600 hover:bg-purple-700 gap-2"
                  onClick={() => {
                    console.log('Sending email:', emailContent);
                    setShowEmailModal(false);
                    setEmailContent("");
                  }}
                >
                  <Mail className="w-4 h-4" />
                  Send Email
                </Button>
                <Button
                  variant="outline"
                  className="px-6"
                  onClick={() => {
                    setShowEmailModal(false);
                    setEmailContent("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

      {/* Emergency Services Modal */}
              {showEmergencyModal && (
          <div
            key="crisis-emergency-services-overlay"
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowEmergencyModal(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl"
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-red-900 mb-2">Contact Emergency Services</h3>
                  <p className="text-gray-600">Immediate emergency response for {event.userName}</p>
                </div>
                <button
                  onClick={() => setShowEmergencyModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="bg-red-50 border-2 border-red-500 rounded-xl p-6 mb-6">
                <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
                <h4 className="text-center font-bold text-red-900 text-lg mb-4">CALL 911 IMMEDIATELY</h4>
                <div className="text-center mb-4">
                  <p className="text-red-800 font-medium mb-2">Emergency Information:</p>
                  <p className="text-sm text-red-700">User: {event.userName}</p>
                  <p className="text-sm text-red-700">Phone: {dash(event.userPhone)}</p>
                  <p className="text-sm text-red-700">Timezone: {dash(event.timezone)}</p>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Documentation</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Document emergency services contact, time of call, information provided..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-red-500 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 gap-2"
                  onClick={() => {
                    console.log('Emergency services contacted:', notes);
                    setShowEmergencyModal(false);
                    setNotes("");
                  }}
                >
                  <AlertTriangle className="w-4 h-4" />
                  Confirm 911 Called
                </Button>
                <Button
                  variant="outline"
                  className="px-6"
                  onClick={() => setShowEmergencyModal(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

      {/* Emergency Contact Modal */}
              {showEmergencyContactModal && (
          <div
            key="crisis-emergency-contact-overlay"
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowEmergencyContactModal(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl"
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Call Emergency Contact</h3>
                  <p className="text-gray-600">Contacting designated emergency contact</p>
                </div>
                <button
                  onClick={() => setShowEmergencyContactModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 mb-6">
                <h4 className="font-bold text-orange-900 mb-3">Emergency Contact Information</h4>
                {event.emergencyContact ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-orange-700" />
                      <span className="font-semibold">{event.emergencyContact.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-orange-700" />
                      <span className="text-sm">{dash(event.emergencyContact.relationship)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-orange-700" />
                      <span className="font-medium">{dash(event.emergencyContact.phone)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-orange-900">No emergency contact on file.</p>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Call Notes</label>
                <textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  rows={4}
                  placeholder="Document conversation with emergency contact, their response, next steps..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-orange-600 hover:bg-orange-700 gap-2"
                  onClick={() => {
                    console.log('Emergency contact called:', callNotes);
                    setShowEmergencyContactModal(false);
                    setCallNotes("");
                  }}
                >
                  <PhoneCall className="w-4 h-4" />
                  Start Call
                </Button>
                <Button
                  variant="outline"
                  className="px-6"
                  onClick={() => {
                    setShowEmergencyContactModal(false);
                    setCallNotes("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

      {/* Alert Therapist Modal */}
              {showTherapistModal && (
          <div
            key="crisis-therapist-overlay"
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowTherapistModal(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl"
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Alert Crisis Specialist</h3>
                  <p className="text-gray-600">Notify assigned companion of critical event</p>
                </div>
                <button
                  onClick={() => setShowTherapistModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 mb-6">
                <h4 className="font-bold text-green-900 mb-3">Crisis Specialist Information</h4>
                {event.companion ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-green-700" />
                      <span className="font-semibold">{event.companion.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-green-700" />
                      <span className="text-sm">{dash(event.companion.specialty)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-green-700" />
                      <span className="font-medium">{dash(event.companion.phone)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-green-900">No specialist assigned.</p>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Alert Message</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={6}
                  placeholder="Include crisis details, AI confidence level, keywords detected, immediate actions taken..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
                  onClick={() => {
                    console.log('Therapist alerted:', notes);
                    setShowTherapistModal(false);
                    setNotes("");
                  }}
                >
                  <Send className="w-4 h-4" />
                  Send Alert
                </Button>
                <Button
                  variant="outline"
                  className="px-6"
                  onClick={() => {
                    setShowTherapistModal(false);
                    setNotes("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

      {/* Update Status Modal */}
              {showStatusModal && (
          <div
            key="crisis-status-overlay"
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowStatusModal(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl"
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Update Case Status</h3>
                  <p className="text-gray-600">Case #{event.id} - {event.userName}</p>
                </div>
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">New Status</label>
                <div className={`p-4 rounded-xl border-2 ${
                  selectedStatus === "contacted" ? "bg-yellow-50 border-yellow-300" :
                  selectedStatus === "in-progress" ? "bg-blue-50 border-blue-300" :
                  selectedStatus === "resolved" ? "bg-green-50 border-green-300" :
                  "bg-red-50 border-red-300"
                }`}>
                  <p className="font-bold text-lg">
                    {selectedStatus === "contacted" && "📞 Mark as Contacted"}
                    {selectedStatus === "in-progress" && "⚙️ In Progress"}
                    {selectedStatus === "resolved" && "✅ Resolve Case"}
                    {selectedStatus === "escalated" && "⚠️ Escalate"}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedStatus === "contacted" && "User has been contacted and initial assessment completed"}
                    {selectedStatus === "in-progress" && "Ongoing monitoring and intervention required"}
                    {selectedStatus === "resolved" && "Crisis has been resolved, user is safe"}
                    {selectedStatus === "escalated" && "Escalating to higher-level intervention"}
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Status Update Notes</label>
                <textarea
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  rows={5}
                  placeholder="Document the reason for status change, actions taken, current situation, next steps..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1 gap-2"
                  disabled={isUpdating}
                  onClick={async () => {
                    const apiStatus =
                      selectedStatus === "escalated" ? "in-progress" : selectedStatus;
                    let merged = event.notes || "";
                    if (statusNotes.trim()) {
                      const tag =
                        selectedStatus === "escalated" ? "Escalation" : "Status update";
                      merged = merged
                        ? `${merged}\n\n[${tag}] ${statusNotes.trim()}`
                        : `[${tag}] ${statusNotes.trim()}`;
                    }
                    try {
                      setIsUpdating(true);
                      await api.admin.updateCrisisEventStatus(event.id, {
                        status: apiStatus as "contacted" | "in-progress" | "resolved",
                        notes: merged || undefined,
                      });
                      await reloadDetail();
                      setShowStatusModal(false);
                      setStatusNotes("");
                    } catch (e) {
                      console.error("Failed to update crisis status", e);
                    } finally {
                      setIsUpdating(false);
                    }
                  }}
                >
                  <CheckCircle className="w-4 h-4" />
                  Update Status
                </Button>
                <Button
                  variant="outline"
                  className="px-6"
                  onClick={() => {
                    setShowStatusModal(false);
                    setStatusNotes("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

      {/* Complete Log Modal */}
              {showCompleteLogModal && (
          <div
            key="crisis-complete-log-overlay"
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCompleteLogModal(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Complete Action Log</h3>
                  <p className="text-gray-600">Case #{event.id} - {event.userName}</p>
                </div>
                <button
                  onClick={() => setShowCompleteLogModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-gray-600">Showing all {actionLogFull.length} actions</p>
                <Button variant="outline" className="gap-2 px-3 py-2 text-sm">
                  <Download className="w-4 h-4" />
                  Export Log
                </Button>
              </div>

              <div className="space-y-3">
                {actionLogFull.map((action, index) => (
                  <div
                    key={`${action.iso}-${index}`}
                    className={`p-4 rounded-lg border-l-4 ${
                      action.severity === "critical" ? "bg-red-50 border-red-500 border" :
                      action.severity === "high" ? "bg-orange-50 border-orange-500 border" :
                      action.severity === "medium" ? "bg-yellow-50 border-yellow-500 border" :
                      "bg-blue-50 border-blue-500 border"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{action.action}</p>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          action.severity === "critical" ? "bg-red-200 text-red-900" :
                          action.severity === "high" ? "bg-orange-200 text-orange-900" :
                          action.severity === "medium" ? "bg-yellow-200 text-yellow-900" :
                          "bg-blue-200 text-blue-900"
                        }`}>
                          {action.severity.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-gray-700">{action.time}</p>
                        <p className="text-xs text-gray-500">{action.date}</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">By:</span> {action.performer}
                    </p>
                    <p className="text-sm text-gray-700">{action.details}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowCompleteLogModal(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
    </AdminLayoutNew>
  );
}
