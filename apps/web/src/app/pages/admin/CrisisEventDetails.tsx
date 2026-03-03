import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  AlertTriangle,
  Phone,
  Mail,
  MessageSquare,
  Shield,
  Clock,
  User,
  MapPin,
  Calendar,
  CheckCircle,
  XCircle,
  PhoneCall,
  Send,
  FileText,
  Activity,
  AlertCircle,
  Heart,
  TrendingUp,
  Download,
  Ban,
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

function mapApiEvent(event: any): CrisisEvent {
  const profile = event.profiles;
  const assignedProfile = event.assigned_profile;
  const userName =
    profile?.full_name ||
    profile?.email ||
    "Unknown user";
  const userEmail = profile?.email;
  const riskLevel = (event.risk_level || "medium") as CrisisEvent["riskLevel"];
  const status = (event.status || "pending") as CrisisEvent["status"];

  return {
    id: event.id,
    userId: event.user_id,
    userName,
    userEmail,
    userPhone: undefined,
    riskLevel,
    type: event.event_type || "Crisis event",
    keywords: Array.isArray(event.keywords) ? event.keywords : [],
    timestamp: formatRelativeTime(event.created_at as string | undefined),
    detectedAt: formatDateTime(event.created_at as string | undefined),
    status,
    aiConfidence: typeof event.ai_confidence === "number" ? event.ai_confidence : 0,
    sessionId: event.session_id || undefined,
    location: undefined,
    timezone: undefined,
    emergencyContact: null,
    companion: assignedProfile
      ? {
          name: assignedProfile.full_name || assignedProfile.email || "Assigned specialist",
          specialty: undefined,
          phone: undefined,
        }
      : null,
  };
}

export function CrisisEventDetails() {
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
  const [emailContent, setEmailContent] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [event, setEvent] = useState<CrisisEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const eventId = searchParams.get("id");

  useEffect(() => {
    const load = async () => {
      if (!eventId) {
        setError("Missing crisis event id");
        setIsLoading(false);
        return;
      }
      try {
        setError(null);
        const data = await api.admin.getCrisisEvent(eventId);
        setEvent(mapApiEvent(data));
      } catch (err) {
        console.error("Failed to fetch crisis event", err);
        setError("Failed to load crisis event");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [eventId]);

  const conversationContext = [
    {
      speaker: "user",
      message: "I've been feeling really overwhelmed lately. Everything seems pointless.",
      time: "14:28",
    },
    {
      speaker: "avatar",
      message: "I hear that you're feeling overwhelmed. Can you tell me more about what's been happening?",
      time: "14:29",
    },
    {
      speaker: "user",
      message: "Work is crushing me, my relationship is falling apart, and I just... I can't take this pain anymore. I keep thinking about ways to end it.",
      time: "14:30",
      flagged: true,
    },
    {
      speaker: "avatar",
      message: "Thank you for sharing that with me. I want you to know that you're not alone. What you're feeling is valid, but I'm concerned about your safety. Have you thought about hurting yourself?",
      time: "14:31",
    },
    {
      speaker: "user",
      message: "Sometimes. Tonight especially. I have a plan. I just want the pain to stop.",
      time: "14:32",
      flagged: true,
      criticalKeywords: ["tonight", "plan", "pain"],
    },
  ];

  const userHistory = [
    {
      date: "Dec 28, 2024",
      event: "Session completed",
      mood: 4,
      notes: "Expressed feelings of hopelessness",
      riskLevel: "medium",
    },
    {
      date: "Dec 25, 2024",
      event: "Mood check-in",
      mood: 3,
      notes: "Holiday stress, family conflict",
      riskLevel: "medium",
    },
    {
      date: "Dec 22, 2024",
      event: "Crisis alert",
      mood: 2,
      notes: "Mentioned self-harm thoughts, contacted",
      riskLevel: "high",
    },
    {
      date: "Dec 20, 2024",
      event: "Session completed",
      mood: 5,
      notes: "Discussed coping strategies",
      riskLevel: "low",
    },
  ];

  const actionHistory = [
    {
      time: "14:35",
      action: "Crisis protocol initiated",
      performer: "AI System",
      details: "High-risk keywords detected, immediate notification sent",
    },
    {
      time: "14:34",
      action: "Emergency contact notified",
      performer: "System",
      details: "Sister (Jennifer Mitchell) alerted via SMS",
    },
    {
      time: "14:33",
      action: "Crisis team assigned",
      performer: "System",
      details: "Crisis Team Alpha notified",
    },
  ];

  // Complete action log with more historical entries
  const completeActionLog = [
    {
      time: "14:35",
      date: "Dec 29, 2024",
      action: "Crisis protocol initiated",
      performer: "AI System",
      details: "High-risk keywords detected, immediate notification sent",
      severity: "critical"
    },
    {
      time: "14:34",
      date: "Dec 29, 2024",
      action: "Emergency contact notified",
      performer: "System",
      details: "Sister (Jennifer Mitchell) alerted via SMS",
      severity: "high"
    },
    {
      time: "14:33",
      date: "Dec 29, 2024",
      action: "Crisis team assigned",
      performer: "System",
      details: "Crisis Team Alpha notified",
      severity: "high"
    },
    {
      time: "14:32",
      date: "Dec 29, 2024",
      action: "Critical keywords detected",
      performer: "AI System",
      details: "Keywords flagged: 'tonight', 'plan', 'pain' - AI Confidence: 94%",
      severity: "critical"
    },
    {
      time: "14:30",
      date: "Dec 29, 2024",
      action: "Session monitoring active",
      performer: "AI System",
      details: "Real-time conversation analysis in progress",
      severity: "medium"
    },
    {
      time: "14:28",
      date: "Dec 29, 2024",
      action: "Session started",
      performer: "User",
      details: "User initiated conversation with AI companion",
      severity: "low"
    },
    {
      time: "09:15",
      date: "Dec 28, 2024",
      action: "Follow-up check completed",
      performer: "Crisis Team",
      details: "User reported stable mood, continuing regular sessions",
      severity: "low"
    },
    {
      time: "16:42",
      date: "Dec 27, 2024",
      action: "Status update",
      performer: "Admin User",
      details: "Case marked as 'monitoring' - scheduled follow-up for Dec 28",
      severity: "medium"
    },
    {
      time: "11:23",
      date: "Dec 22, 2024",
      action: "Crisis intervention completed",
      performer: "Dr. Emily Chen",
      details: "User contacted, safety plan reviewed, emergency contacts verified",
      severity: "high"
    },
    {
      time: "10:55",
      date: "Dec 22, 2024",
      action: "Previous crisis alert",
      performer: "AI System",
      details: "Self-harm keywords detected, immediate intervention initiated",
      severity: "critical"
    },
  ];

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

  if (isLoading) {
    return (
      <AdminLayoutNew>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AdminLayoutNew>
    );
  }

  if (error || !event) {
    return (
      <AdminLayoutNew>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <p className="text-red-600 font-medium">{error || "Crisis event not found"}</p>
          <Link to="/admin/crisis-dashboard">
            <Button variant="outline">Back to Crisis Dashboard</Button>
          </Link>
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
        >
          <Link to="/admin/crisis-dashboard">
            <Button variant="ghost" className="gap-2 mb-4">
              <ArrowLeft className="w-4 h-4" />
              Back to Crisis Dashboard
            </Button>
          </Link>

          {/* Critical Alert Banner */}
          <Card className="p-6 bg-red-50 border-2 border-red-500 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0 animate-pulse">
                <AlertTriangle className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-2xl font-bold text-red-900">CRITICAL CRISIS ALERT</h2>
                  <span className="px-3 py-1 bg-red-600 text-white rounded-full text-xs font-bold">
                    IMMEDIATE ACTION REQUIRED
                  </span>
                </div>
                <p className="text-red-800 font-medium mb-2">
                  {event.type} detected for {event.userName} ({event.userId})
                </p>
                <p className="text-sm text-red-700 mb-3">
                  AI Confidence: {event.aiConfidence}% • Detected {event.timestamp} • Time-sensitive intervention needed
                </p>
                <div className="flex flex-wrap gap-2">
                  {event.keywords.map((keyword, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-red-600 text-white rounded-full text-sm font-medium"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* User Information */}
        <div className="grid lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
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
                      <p className="font-medium text-sm">{event.userEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="font-medium text-sm">{event.userPhone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Location</p>
                      <p className="font-medium text-sm">{event.location}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Timezone</p>
                      <p className="font-medium text-sm">{event.timezone}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-primary" />
                Emergency Contact
              </h3>
              <div className="space-y-4">
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="font-bold mb-1">{event.emergencyContact.name}</p>
                  <p className="text-sm text-muted-foreground mb-2">
                    {event.emergencyContact.relationship}
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4" />
                    <span className="font-medium">{event.emergencyContact.phone}</span>
                  </div>
                </div>

                <Button className="w-full gap-2 bg-orange-600 hover:bg-orange-700"
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
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="font-bold mb-1">{event.companion.name}</p>
                  <p className="text-sm text-muted-foreground mb-2">
                    {event.companion.specialty}
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4" />
                    <span className="font-medium">{event.companion.phone}</span>
                  </div>
                </div>

                <Button 
                  variant="outline" 
                  className="w-full gap-2 mt-3"
                  onClick={() => setShowTherapistModal(true)}
                >
                  <Send className="w-4 h-4" />
                  Notify Specialist
                </Button>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Event Details
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Risk Level</p>
                  <span className="px-3 py-1 bg-red-500 text-white rounded-full text-sm font-bold">
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
                  <p className="text-xs text-muted-foreground mb-1">Session ID</p>
                  <p className="font-medium">{event.sessionId}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium border border-red-300">
                    {event.status.toUpperCase()}
                  </span>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Quick Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-6">
            <h3 className="font-bold text-lg mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {quickActions.map((action, index) => (
                <motion.button
                  key={action.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + index * 0.05 }}
                  onClick={() => handleAction(action.id)}
                  className={`p-4 rounded-lg text-white text-center hover:shadow-lg transition-all ${action.color}`}
                >
                  <action.icon className="w-6 h-6 mx-auto mb-2" />
                  <p className="font-medium text-sm">{action.label}</p>
                </motion.button>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Conversation Context */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="p-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Conversation Context
            </h3>
            <div className="space-y-4">
              {conversationContext.map((msg, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: msg.speaker === "user" ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                  className={`flex ${msg.speaker === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] p-4 rounded-lg ${
                      msg.flagged
                        ? "bg-red-50 border-2 border-red-500"
                        : msg.speaker === "user"
                        ? "bg-primary text-white"
                        : "bg-gray-100"
                    }`}
                  >
                    {msg.flagged && (
                      <div className="flex items-center gap-2 mb-2 text-red-600">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-xs font-bold">CRISIS KEYWORDS DETECTED</span>
                      </div>
                    )}
                    <p className="text-sm mb-1">{msg.message}</p>
                    <p
                      className={`text-xs ${
                        msg.flagged
                          ? "text-red-600"
                          : msg.speaker === "user"
                          ? "text-white/70"
                          : "text-muted-foreground"
                      }`}
                    >
                      {msg.time}
                    </p>
                    {msg.criticalKeywords && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {msg.criticalKeywords.map((keyword, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-red-600 text-white rounded text-xs font-bold"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* User History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Recent User History
              </h3>
              <div className="space-y-3">
                {userHistory.map((item, index) => (
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
                    <div className="flex items-center gap-2 mb-2">
                      <Heart className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Mood: {item.mood}/10</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.notes}</p>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Action History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
          >
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Action History
              </h3>
              <div className="space-y-3">
                {actionHistory.map((action, index) => (
                  <div
                    key={index}
                    className="p-4 bg-blue-50 border border-blue-200 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-medium">{action.action}</p>
                      <span className="text-xs text-muted-foreground">{action.time}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      By: {action.performer}
                    </p>
                    <p className="text-sm">{action.details}</p>
                  </div>
                ))}
              </div>

              <Button variant="outline" className="w-full mt-4 gap-2" onClick={() => setShowCompleteLogModal(true)}>
                <FileText className="w-4 h-4" />
                View Complete Log
              </Button>
            </Card>
          </motion.div>
        </div>

        {/* Status Update */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          <Card className="p-6">
            <h3 className="font-bold text-lg mb-4">Update Case Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => {
                  setSelectedStatus("contacted");
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
                  setShowStatusModal(true);
                }}
              >
                <AlertTriangle className="w-4 h-4" />
                Escalate
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Add Notes Modal */}
      <AnimatePresence>
        {showNotes && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowNotes(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
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
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={8}
                  placeholder="Document intervention details, actions taken, user's response, follow-up plans..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1 gap-2"
                  onClick={() => {
                    console.log('Saving notes:', notes);
                    setShowNotes(false);
                    setNotes("");
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
                    setNotes("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Call User Modal - Similar to Crisis Monitoring */}
      <AnimatePresence>
        {showCallModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCallModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl"
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Initiate Crisis Call</h3>
                  <p className="text-gray-600">{event.userName} ({event.userPhone})</p>
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Send Email Modal */}
      <AnimatePresence>
        {showEmailModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowEmailModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emergency Services Modal */}
      <AnimatePresence>
        {showEmergencyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowEmergencyModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
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
                  <p className="text-sm text-red-700">Phone: {event.userPhone}</p>
                  <p className="text-sm text-red-700">Location: {event.location}</p>
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emergency Contact Modal */}
      <AnimatePresence>
        {showEmergencyContactModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowEmergencyContactModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
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
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-orange-700" />
                    <span className="font-semibold">{event.emergencyContact.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-orange-700" />
                    <span className="text-sm">{event.emergencyContact.relationship}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-orange-700" />
                    <span className="font-medium">{event.emergencyContact.phone}</span>
                  </div>
                </div>
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alert Therapist Modal */}
      <AnimatePresence>
        {showTherapistModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowTherapistModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
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
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-green-700" />
                    <span className="font-semibold">{event.companion.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-700" />
                    <span className="text-sm">{event.companion.specialty}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-green-700" />
                    <span className="font-medium">{event.companion.phone}</span>
                  </div>
                </div>
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Update Status Modal */}
      <AnimatePresence>
        {showStatusModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowStatusModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
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
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={5}
                  placeholder="Document the reason for status change, actions taken, current situation, next steps..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1 gap-2"
                  onClick={() => {
                    console.log('Status updated:', selectedStatus, notes);
                    setShowStatusModal(false);
                    setNotes("");
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
                    setNotes("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Complete Log Modal */}
      <AnimatePresence>
        {showCompleteLogModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCompleteLogModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
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
                <p className="text-sm text-gray-600">Showing all {completeActionLog.length} actions</p>
                <Button variant="outline" className="gap-2 px-3 py-2 text-sm">
                  <Download className="w-4 h-4" />
                  Export Log
                </Button>
              </div>

              <div className="space-y-3">
                {completeActionLog.map((action, index) => (
                  <div
                    key={index}
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayoutNew>
  );
}
