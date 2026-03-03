import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  AlertTriangle,
  Phone,
  Users,
  Heart,
  FileText,
  CheckCircle,
  Shield,
  Activity,
  Clock,
  ArrowRight,
  User,
  MapPin,
  MessageSquare,
  Bell,
  X,
  PhoneCall,
  Send,
  Copy,
  Calendar,
} from "lucide-react";
import { AnimatePresence } from "motion/react";
import { Button } from "../../components/ui/button";
import { api } from "../../../lib/api";

interface CrisisCase {
  id: string;
  userId: string;
  userName: string;
  severity: "critical" | "high" | "medium";
  type: "suicidal" | "violence" | "abuse" | "medical" | "other";
  status: "active" | "monitoring" | "resolved";
  reportedAt: Date;
  assignedTo?: string;
  location?: string;
  contactAttempts: number;
  lastContact?: Date;
  notes: string[];
}

function mapStatusToProtocolStatus(status: string): CrisisCase["status"] {
  switch (status) {
    case "resolved":
      return "resolved";
    case "contacted":
      return "monitoring";
    case "in-progress":
      return "active";
    default:
      return "active";
  }
}

function mapRiskToSeverity(risk: string | null | undefined): CrisisCase["severity"] {
  switch (risk) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    default:
      return "medium";
  }
}

function mapEventTypeToCaseType(eventType: string | null | undefined): CrisisCase["type"] {
  const value = (eventType || "").toLowerCase();
  if (value.includes("suicid")) return "suicidal";
  if (value.includes("violence") || value.includes("harm") || value.includes("homicid")) return "violence";
  if (value.includes("abuse") || value.includes("assault")) return "abuse";
  if (value.includes("medical")) return "medical";
  return "other";
}

function mapApiCrisisEventToCrisisCase(event: any): CrisisCase {
  const createdAt = event.created_at ? new Date(event.created_at) : new Date();
  const resolvedAt = event.resolved_at ? new Date(event.resolved_at) : undefined;
  const userName =
    event.profiles?.full_name ||
    event.profiles?.email ||
    "Unknown user";
  const assignedTo =
    event.assigned_profile?.full_name ||
    event.assigned_profile?.email ||
    undefined;

  const rawNotes = typeof event.notes === "string" ? event.notes : "";
  const notes: string[] = rawNotes
    .split(/\r?\n/)
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0);

  if (!notes.length) {
    notes.push("No notes recorded yet");
  }

  return {
    id: event.id,
    userId: event.user_id,
    userName,
    severity: mapRiskToSeverity(event.risk_level),
    type: mapEventTypeToCaseType(event.event_type),
    status: mapStatusToProtocolStatus(event.status || "pending"),
    reportedAt: createdAt,
    assignedTo,
    location: undefined,
    contactAttempts: 0,
    lastContact: resolvedAt,
    notes,
  };
}

function getAverageResponseTime(cases: CrisisCase[]): string {
  let totalMinutes = 0;
  let count = 0;

  cases.forEach((c) => {
    if (!c.reportedAt || !c.lastContact) return;
    const diffMinutes = (c.lastContact.getTime() - c.reportedAt.getTime()) / 60000;
    if (diffMinutes <= 0) return;
    totalMinutes += diffMinutes;
    count += 1;
  });

  if (!count) return "N/A";
  const avg = totalMinutes / count;
  return `${avg.toFixed(1)} min`;
}

export function CrisisProtocol() {
  const [selectedCase, setSelectedCase] = useState<CrisisCase | null>(null);
  const [activeStep, setActiveStep] = useState(1);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showAlertTeamModal, setShowAlertTeamModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [contactNotes, setContactNotes] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [crisisCases, setCrisisCases] = useState<CrisisCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCases = async () => {
    try {
      setError(null);
      const data = await api.admin.getCrisisEvents();
      const items = Array.isArray(data) ? data : [];
      setCrisisCases(items.map(mapApiCrisisEventToCrisisCase));
    } catch (err) {
      console.error("Failed to fetch crisis events", err);
      setError("Failed to load crisis cases");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, []);

  const now = Date.now();
  const stats = {
    active: crisisCases.filter((c) => c.status === "active").length,
    monitoring: crisisCases.filter((c) => c.status === "monitoring").length,
    resolved24h: crisisCases.filter(
      (c) =>
        c.status === "resolved" &&
        c.lastContact &&
        now - c.lastContact.getTime() <= 24 * 60 * 60 * 1000
    ).length,
    responseTime: getAverageResponseTime(crisisCases),
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
              loadCases();
            }}
          >
            Retry
          </Button>
        </div>
      </AdminLayoutNew>
    );
  }

  // Crisis Response Protocol Steps
  const protocolSteps = [
    {
      step: 1,
      title: "Immediate Assessment",
      description: "Evaluate severity and immediate danger",
      actions: [
        "Review AI detection flags and content",
        "Check user's recent activity and history",
        "Determine severity level (Critical/High/Medium)",
        "Identify crisis type (suicidal/violence/abuse/medical)"
      ],
      timeframe: "0-5 minutes",
      icon: AlertTriangle,
      color: "from-red-500 to-rose-600"
    },
    {
      step: 2,
      title: "Emergency Contact",
      description: "Attempt to reach user and emergency contacts",
      actions: [
        "Call user's primary phone number",
        "Send urgent in-app notification",
        "Contact emergency contact if no response",
        "Document all contact attempts"
      ],
      timeframe: "5-15 minutes",
      icon: Phone,
      color: "from-orange-500 to-red-600"
    },
    {
      step: 3,
      title: "Professional Escalation",
      description: "Involve crisis professionals and authorities",
      actions: [
        "Contact National Suicide Prevention Lifeline (988)",
        "Alert licensed crisis counselor on-call",
        "Prepare welfare check if critical",
        "Notify local authorities if imminent danger"
      ],
      timeframe: "15-30 minutes",
      icon: Users,
      color: "from-yellow-500 to-orange-600"
    },
    {
      step: 4,
      title: "Resource Provision",
      description: "Provide immediate crisis resources",
      actions: [
        "Send crisis hotline numbers",
        "Provide local emergency services info",
        "Share crisis chat resources",
        "Offer immediate AI crisis support session"
      ],
      timeframe: "Concurrent",
      icon: Heart,
      color: "from-blue-500 to-indigo-600"
    },
    {
      step: 5,
      title: "Documentation & Monitoring",
      description: "Document actions and monitor situation",
      actions: [
        "Log all interventions in system",
        "Set monitoring alerts for user",
        "Schedule follow-up contacts",
        "Brief crisis team on case status"
      ],
      timeframe: "Ongoing",
      icon: FileText,
      color: "from-purple-500 to-pink-600"
    },
    {
      step: 6,
      title: "Follow-up & Resolution",
      description: "Continue support until crisis resolved",
      actions: [
        "Daily check-ins for 7 days",
        "Connect with licensed therapist",
        "Provide ongoing resources",
        "Close case only when safe"
      ],
      timeframe: "7-30 days",
      icon: CheckCircle,
      color: "from-green-500 to-emerald-600"
    }
  ];

  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case "critical": return "bg-red-100 text-red-700 border-red-300";
      case "high": return "bg-orange-100 text-orange-700 border-orange-300";
      case "medium": return "bg-yellow-100 text-yellow-700 border-yellow-300";
      default: return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case "active": return "bg-red-100 text-red-700";
      case "monitoring": return "bg-yellow-100 text-yellow-700";
      case "resolved": return "bg-green-100 text-green-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getTypeIcon = (type: string) => {
    switch(type) {
      case "suicidal": return AlertTriangle;
      case "violence": return Shield;
      case "abuse": return Heart;
      case "medical": return Activity;
      default: return AlertTriangle;
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
            <h1 className="text-3xl font-bold text-gray-900">Crisis Response Protocol</h1>
            <p className="text-gray-600 mt-1">Emergency response workflow and active cases</p>
          </div>

          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-4 py-2 rounded-xl bg-red-500 text-white flex items-center gap-2 shadow-lg"
            >
              <Phone className="w-4 h-4" />
              Emergency Hotline
            </motion.button>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 shadow-lg border-2 border-red-200"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-red-500 to-rose-600">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Active Cases</p>
                <p className="text-2xl font-bold text-red-600">{stats.active}</p>
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
              <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Monitoring</p>
                <p className="text-2xl font-bold text-gray-900">{stats.monitoring}</p>
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
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Resolved (24h)</p>
                <p className="text-2xl font-bold text-gray-900">{stats.resolved24h}</p>
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
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Avg Response</p>
                <p className="text-2xl font-bold text-gray-900">{stats.responseTime}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Protocol Steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-6">6-Step Crisis Response Protocol</h2>

          <div className="space-y-4">
            {protocolSteps.map((step, index) => {
              const Icon = step.icon;
              const isActive = activeStep === step.step;
              
              return (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  onClick={() => setActiveStep(step.step)}
                  className={`border-2 rounded-xl p-5 cursor-pointer transition-all ${
                    isActive 
                      ? "border-blue-500 bg-blue-50 shadow-md" 
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${step.color} flex-shrink-0`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-bold text-gray-500">STEP {step.step}</span>
                        <h3 className="font-bold text-gray-900 text-lg">{step.title}</h3>
                        <span className="ml-auto text-xs bg-gray-200 text-gray-700 px-3 py-1 rounded-full">
                          {step.timeframe}
                        </span>
                      </div>

                      <p className="text-gray-600 mb-3">{step.description}</p>

                      {isActive && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-4 space-y-2"
                        >
                          {step.actions.map((action, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span className="text-sm text-gray-700">{action}</span>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </div>

                    <ArrowRight className={`w-5 h-5 transition-transform ${isActive ? "rotate-90 text-blue-600" : "text-gray-400"}`} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Active Crisis Cases */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Active Crisis Cases</h2>
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-3 h-3 rounded-full bg-red-500"
              />
              <span className="text-sm text-red-600 font-medium">Live Monitoring</span>
            </div>
          </div>

          <div className="space-y-4">
            {crisisCases.map((crisisCase, index) => {
              const TypeIcon = getTypeIcon(crisisCase.type);
              
              return (
                <motion.div
                  key={crisisCase.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                  className={`border-2 rounded-xl p-5 ${getSeverityColor(crisisCase.severity)}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${
                      crisisCase.severity === "critical" 
                        ? "bg-red-500" 
                        : crisisCase.severity === "high"
                        ? "bg-orange-500"
                        : "bg-yellow-500"
                    }`}>
                      <TypeIcon className="w-6 h-6 text-white" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-gray-900">{crisisCase.userName}</h3>
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium uppercase ${getStatusColor(crisisCase.status)}`}>
                          {crisisCase.status}
                        </span>
                        <span className="px-2 py-1 rounded-lg text-xs font-medium bg-gray-200 text-gray-700 uppercase">
                          {crisisCase.type}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
                        <div className="flex items-center gap-1 text-gray-700">
                          <Clock className="w-4 h-4" />
                          <span>
                            {Math.floor((Date.now() - crisisCase.reportedAt.getTime()) / (1000 * 60))}m ago
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1 text-gray-700">
                          <User className="w-4 h-4" />
                          <span>{crisisCase.assignedTo || "Unassigned"}</span>
                        </div>

                        <div className="flex items-center gap-1 text-gray-700">
                          <MapPin className="w-4 h-4" />
                          <span>{crisisCase.location || "Unknown"}</span>
                        </div>

                        <div className="flex items-center gap-1 text-gray-700">
                          <Phone className="w-4 h-4" />
                          <span>{crisisCase.contactAttempts} attempts</span>
                        </div>
                      </div>

                      {crisisCase.lastContact && (
                        <p className="text-sm text-gray-600 mb-3">
                          Last contact: {crisisCase.lastContact.toLocaleTimeString()}
                        </p>
                      )}

                      <div className="bg-white bg-opacity-50 rounded-lg p-3 space-y-2">
                        <p className="text-xs font-bold text-gray-700 uppercase">Activity Log:</p>
                        {crisisCase.notes.map((note, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <MessageSquare className="w-3 h-3 text-gray-500 mt-0.5" />
                            <span className="text-xs text-gray-700">{note}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2 mt-4">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex-1 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium"
                          onClick={() => {
                            setSelectedCase(crisisCase);
                            setShowContactModal(true);
                          }}
                        >
                          <Phone className="w-4 h-4 inline mr-1" />
                          Contact User
                        </motion.button>

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex-1 px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium"
                          onClick={() => {
                            setSelectedCase(crisisCase);
                            setShowAlertTeamModal(true);
                          }}
                        >
                          <Bell className="w-4 h-4 inline mr-1" />
                          Alert Team
                        </motion.button>

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
                          onClick={() => {
                            setSelectedCase(crisisCase);
                            setShowCopyModal(true);
                          }}
                        >
                          <FileText className="w-4 h-4 inline" />
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Emergency Resources */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl p-6 shadow-lg border-2 border-red-200"
        >
          <div className="flex items-center gap-3 mb-4">
            <Phone className="w-6 h-6 text-red-600" />
            <h2 className="text-xl font-bold text-gray-900">Emergency Resources</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-4">
              <h3 className="font-bold text-gray-900 mb-2">National Suicide Prevention Lifeline</h3>
              <p className="text-2xl font-bold text-red-600 mb-1">988</p>
              <p className="text-sm text-gray-600">24/7 Crisis Support</p>
            </div>

            <div className="bg-white rounded-xl p-4">
              <h3 className="font-bold text-gray-900 mb-2">Crisis Text Line</h3>
              <p className="text-lg font-bold text-red-600 mb-1">Text HOME to 741741</p>
              <p className="text-sm text-gray-600">24/7 Text Support</p>
            </div>

            <div className="bg-white rounded-xl p-4">
              <h3 className="font-bold text-gray-900 mb-2">Emergency Services</h3>
              <p className="text-2xl font-bold text-red-600 mb-1">911</p>
              <p className="text-sm text-gray-600">Immediate Danger</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Contact User Modal */}
      <AnimatePresence>
        {showContactModal && selectedCase && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowContactModal(false)}
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
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Contact User</h3>
                  <p className="text-gray-600">Emergency contact for {selectedCase.userName}</p>
                </div>
                <button
                  onClick={() => setShowContactModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-6">
                <h4 className="font-bold text-red-900 mb-3">Crisis Case Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-red-700" />
                    <span className="font-semibold">{selectedCase.userName}</span>
                    <span className={`ml-auto px-2 py-0.5 rounded text-xs font-bold ${
                      selectedCase.severity === "critical" ? "bg-red-200 text-red-900" :
                      selectedCase.severity === "high" ? "bg-orange-200 text-orange-900" :
                      "bg-yellow-200 text-yellow-900"
                    }`}>
                      {selectedCase.severity.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-700" />
                    <span>Crisis Type: {selectedCase.type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-red-700" />
                    <span>Location: {selectedCase.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-red-700" />
                    <span>Previous Attempts: {selectedCase.contactAttempts}</span>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Notes</label>
                <textarea
                  value={contactNotes}
                  onChange={(e) => setContactNotes(e.target.value)}
                  rows={6}
                  placeholder="Document the contact attempt, user's response, safety status, next actions..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-red-500 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 gap-2"
                  onClick={() => {
                    console.log('Contacting user:', selectedCase.userId, contactNotes);
                    setShowContactModal(false);
                    setContactNotes("");
                  }}
                >
                  <PhoneCall className="w-4 h-4" />
                  Initiate Contact
                </Button>
                <Button
                  variant="outline"
                  className="px-6"
                  onClick={() => {
                    setShowContactModal(false);
                    setContactNotes("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alert Team Modal */}
      <AnimatePresence>
        {showAlertTeamModal && selectedCase && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAlertTeamModal(false)}
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
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Alert Crisis Team</h3>
                  <p className="text-gray-600">Escalate case to crisis response team</p>
                </div>
                <button
                  onClick={() => setShowAlertTeamModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 mb-6">
                <h4 className="font-bold text-orange-900 mb-3">Case Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-orange-700" />
                    <span className="font-semibold">{selectedCase.userName} ({selectedCase.userId})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-700" />
                    <span>Type: {selectedCase.type} | Severity: {selectedCase.severity}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-orange-700" />
                    <span>Reported: {Math.floor((Date.now() - selectedCase.reportedAt.getTime()) / (1000 * 60))} minutes ago</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-orange-700" />
                    <span>Currently Assigned: {selectedCase.assignedTo || "Unassigned"}</span>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Alert Message</label>
                <textarea
                  value={alertMessage}
                  onChange={(e) => setAlertMessage(e.target.value)}
                  rows={6}
                  placeholder="Describe the urgency, situation details, required actions, and any immediate concerns for the crisis team..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-orange-500 outline-none resize-none"
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-sm font-semibold text-gray-700 mb-2">Team Members to Alert:</p>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>Crisis Team Lead</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>On-call Crisis Specialist</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>Licensed Companion (if available)</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-orange-600 hover:bg-orange-700 gap-2"
                  onClick={() => {
                    console.log('Alerting crisis team:', selectedCase.id, alertMessage);
                    setShowAlertTeamModal(false);
                    setAlertMessage("");
                  }}
                >
                  <Send className="w-4 h-4" />
                  Send Alert
                </Button>
                <Button
                  variant="outline"
                  className="px-6"
                  onClick={() => {
                    setShowAlertTeamModal(false);
                    setAlertMessage("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Copy Case Details Modal */}
      <AnimatePresence>
        {showCopyModal && selectedCase && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCopyModal(false)}
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
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Case Details</h3>
                  <p className="text-gray-600">Complete case information for {selectedCase.userName}</p>
                </div>
                <button
                  onClick={() => setShowCopyModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-6">
                <h4 className="font-bold text-blue-900 mb-3">Complete Case File</h4>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="font-semibold text-gray-700">Case ID:</span> {selectedCase.id}
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">User:</span> {selectedCase.userName} ({selectedCase.userId})
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Severity:</span> {selectedCase.severity.toUpperCase()}
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Type:</span> {selectedCase.type}
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Status:</span> {selectedCase.status}
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Reported:</span> {selectedCase.reportedAt.toLocaleString()}
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Assigned To:</span> {selectedCase.assignedTo || "Unassigned"}
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Location:</span> {selectedCase.location || "Unknown"}
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Contact Attempts:</span> {selectedCase.contactAttempts}
                  </div>
                  {selectedCase.lastContact && (
                    <div>
                      <span className="font-semibold text-gray-700">Last Contact:</span> {selectedCase.lastContact.toLocaleString()}
                    </div>
                  )}
                  <div>
                    <span className="font-semibold text-gray-700">Activity Log:</span>
                    <ul className="mt-2 space-y-1 ml-4 list-disc">
                      {selectedCase.notes.map((note, idx) => (
                        <li key={idx}>{note}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 gap-2"
                  onClick={() => {
                    const caseDetails = `
Case ID: ${selectedCase.id}
User: ${selectedCase.userName} (${selectedCase.userId})
Severity: ${selectedCase.severity.toUpperCase()}
Type: ${selectedCase.type}
Status: ${selectedCase.status}
Reported: ${selectedCase.reportedAt.toLocaleString()}
Assigned To: ${selectedCase.assignedTo || "Unassigned"}
Location: ${selectedCase.location || "Unknown"}
Contact Attempts: ${selectedCase.contactAttempts}
Last Contact: ${selectedCase.lastContact?.toLocaleString() || "N/A"}

Activity Log:
${selectedCase.notes.map((note, i) => `${i + 1}. ${note}`).join('\n')}
                    `.trim();
                    
                    navigator.clipboard.writeText(caseDetails);
                    console.log('Case details copied to clipboard');
                    setShowCopyModal(false);
                  }}
                >
                  <Copy className="w-4 h-4" />
                  Copy to Clipboard
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCopyModal(false)}
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
