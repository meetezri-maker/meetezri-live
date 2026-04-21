import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertTriangle,
  Phone,
  Mail,
  Eye,
  CheckCircle,
  Clock,
  TrendingDown,
  Shield,
  X,
  User,
  MessageSquare,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface CrisisEvent {
  id: string;
  user: string;
  userEmail?: string;
  userPhone?: string;
  riskLevel: "critical" | "high" | "medium" | "low";
  type: string;
  keywords: string[];
  timestamp: string;
  status: "pending" | "contacted" | "resolved";
  aiConfidence: number;
  notes?: string;
  createdAt?: string;
  resolvedAt?: string;
}

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
  const user =
    event.profiles?.full_name ||
    event.profiles?.email ||
    "Unknown user";
  return {
    id: event.id,
    user,
    userEmail: event.profiles?.email || undefined,
    userPhone: event.profiles?.phone || undefined,
    riskLevel: (event.risk_level || "medium") as CrisisEvent["riskLevel"],
    type: event.event_type || "Crisis event",
    keywords: Array.isArray(event.keywords) ? event.keywords : [],
    timestamp: formatRelativeTime(createdAt),
    status: (event.status || "pending") as CrisisEvent["status"],
    aiConfidence: typeof event.ai_confidence === "number" ? event.ai_confidence : 0,
    notes: typeof event.notes === "string" ? event.notes : undefined,
    createdAt,
    resolvedAt,
  };
}

export function CrisisMonitoring() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<CrisisEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getRiskColor = (level: string) => {
    switch (level) {
      case "critical":
        return "bg-red-500 text-white border-red-600";
      case "high":
        return "bg-orange-500 text-white border-orange-600";
      case "medium":
        return "bg-yellow-500 text-white border-yellow-600";
      default:
        return "bg-gray-500 text-white";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-red-100 text-red-700 border-red-200";
      case "contacted":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "resolved":
        return "bg-green-100 text-green-700 border-green-200";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const [selectedEvent, setSelectedEvent] = useState<CrisisEvent | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailContent, setEmailContent] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveNotes, setResolveNotes] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedContact, setSelectedContact] = useState<{
    phone?: string;
    email?: string;
    emergencyName?: string;
    emergencyPhone?: string;
  } | null>(null);

  const parsePhoneForDial = (phone: string | undefined) => {
    if (!phone) return null;
    const candidate = phone.replace(/[^\d+#*]/g, "");
    return candidate.length >= 3 ? candidate : null;
  };

  const mergeUpdatedEvent = (updated: any) => {
    const mapped = mapApiCrisisEvent(updated);
    setEvents((prev) => prev.map((item) => (item.id === mapped.id ? mapped : item)));
    setSelectedEvent((prev) => (prev && prev.id === mapped.id ? mapped : prev));
  };

  const updateEventStatus = async (
    eventId: string,
    data: { status?: string; notes?: string }
  ) => {
    setIsUpdating(true);
    try {
      const updated = await api.admin.updateCrisisEventStatus(eventId, data);
      mergeUpdatedEvent(updated);
      if (data.status === "resolved") {
        toast.success("Crisis event marked as resolved.");
      } else if (data.status === "contacted") {
        toast.success("Crisis event updated to contacted.");
      } else {
        toast.success("Crisis event updated.");
      }
    } catch (err) {
      console.error("Failed to update crisis event", err);
      toast.error("Failed to update crisis event status.");
    } finally {
      setIsUpdating(false);
    }
  };

  const loadEventContactDetails = async (eventId: string) => {
    try {
      const detail = await api.admin.getCrisisEvent(eventId);
      setSelectedContact({
        phone: detail?.profiles?.phone || undefined,
        email: detail?.profiles?.email || undefined,
        emergencyName: detail?.profiles?.emergency_contact_name || undefined,
        emergencyPhone: detail?.profiles?.emergency_contact_phone || undefined,
      });
    } catch (err) {
      console.error("Failed to load crisis event details", err);
      setSelectedContact(null);
    }
  };

  const loadEvents = async () => {
    try {
      setError(null);
      const data = await api.admin.getCrisisEvents();
      const items = Array.isArray(data) ? data : [];
      setEvents(items.map(mapApiCrisisEvent));
    } catch (err) {
      console.error("Failed to fetch crisis events", err);
      setError("Failed to load crisis events");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const criticalCount = events.filter((e) => e.riskLevel === "critical").length;
  const pendingCount = events.filter((e) => e.status === "pending").length;
  const resolvedToday = events.filter((e) => e.status === "resolved").length;
  const avgResponseTime = getAverageResponseTime(events);

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
          className="flex items-start justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold mb-2">Crisis Monitoring</h1>
            <p className="text-muted-foreground">
              Real-time monitoring and intervention for at-risk users
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium">Live Monitoring Active</span>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-4 border-l-4 border-red-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Critical Alerts
                  </p>
                  <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </Card>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-4 border-l-4 border-yellow-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Pending Review
                  </p>
                  <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
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
            <Card className="p-4 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Resolved Today
                  </p>
                  <p className="text-2xl font-bold text-green-600">{resolvedToday}</p>
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
            <Card className="p-4 border-l-4 border-primary">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Avg Response Time
                  </p>
                  <p className="text-2xl font-bold text-primary">{avgResponseTime}</p>
                </div>
                <TrendingDown className="w-8 h-8 text-primary" />
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Crisis Events List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Active Crisis Events</h2>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => navigate("/admin/crisis-protocol")}
              >
                <Shield className="w-4 h-4" />
                Crisis Protocol Guide
              </Button>
            </div>

              <div className="space-y-4">
              {events.map((event, index) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + index * 0.1 }}
                  className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start gap-4 p-4">
                    {/* Risk Level Badge */}
                    <div
                      className={`px-3 py-1 rounded-md font-bold text-xs uppercase ${getRiskColor(
                        event.riskLevel
                      )}`}
                    >
                      {event.riskLevel}
                    </div>

                    {/* Event Details */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-bold text-lg mb-1">{event.user}</p>
                          <p className="text-sm font-medium text-red-600 mb-2">
                            {event.type}
                          </p>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {event.timestamp}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-3">
                        {event.keywords.map((keyword, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded-md border border-red-200"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                              event.status
                            )}`}
                          >
                            {event.status === "pending" && "⏳ Pending Review"}
                            {event.status === "contacted" && "📞 User Contacted"}
                            {event.status === "resolved" && "✅ Resolved"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            AI Confidence: {event.aiConfidence}%
                          </span>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2 hover:bg-blue-500"
                            onClick={() => {
                              setSelectedEvent(event);
                              void loadEventContactDetails(event.id);
                              setShowDetailsModal(true);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                            View Details
                          </Button>
                          {event.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-2 hover:bg-green-500"
                                onClick={() => {
                                  setSelectedEvent(event);
                                  void loadEventContactDetails(event.id);
                                  setCallNotes("");
                                  setShowCallModal(true);
                                }}
                              >
                                <Phone className="w-4 h-4" />
                                Call User
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-2 hover:bg-purple-500"
                                onClick={() => {
                                  setSelectedEvent(event);
                                  void loadEventContactDetails(event.id);
                                  setEmailContent("");
                                  setShowEmailModal(true);
                                }}
                              >
                                <Mail className="w-4 h-4" />
                                Send Email
                              </Button>
                            </>
                          )}
                          {event.status !== "resolved" && (
                            <Button
                              size="sm"
                              className="gap-2"
                              onClick={() => {
                                setSelectedEvent(event);
                                setResolveNotes(event.notes || "");
                                setShowResolveModal(true);
                              }}
                            >
                              <CheckCircle className="w-4 h-4" />
                              Mark Resolved
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Emergency Resources */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <Card className="p-6 bg-gradient-to-r from-red-50 to-orange-50 border-red-200">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Phone className="w-5 h-5 text-red-600" />
              Emergency Resources
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium mb-1">National Suicide Prevention</p>
                <p className="text-lg font-bold text-red-600">988</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Crisis Text Line</p>
                <p className="text-lg font-bold text-red-600">Text HOME to 741741</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Emergency Services</p>
                <p className="text-lg font-bold text-red-600">911</p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* View Details Modal */}
      <AnimatePresence>
        {showDetailsModal && selectedEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDetailsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex items-start justify-between mb-6 pb-4 border-b border-gray-200">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-2xl font-bold text-gray-900">Crisis Event Details</h3>
                    <span className={`px-3 py-1 rounded-md text-xs font-bold ${getRiskColor(selectedEvent.riskLevel)}`}>
                      {selectedEvent.riskLevel.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-gray-600">Event #{selectedEvent.id} • {selectedEvent.timestamp}</p>
                </div>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-6">
                {/* User Info */}
                <div>
                  <h4 className="font-bold text-lg text-gray-900 mb-3 flex items-center gap-2">
                    <User className="w-5 h-5" />
                    User Information
                  </h4>
                  <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">User Name</p>
                      <p className="font-semibold text-gray-900">{selectedEvent.user}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Event Type</p>
                      <p className="font-semibold text-gray-900">{selectedEvent.type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Detection Time</p>
                      <p className="font-semibold text-gray-900">{selectedEvent.timestamp}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">AI Confidence</p>
                      <p className="font-semibold text-gray-900">{selectedEvent.aiConfidence}%</p>
                    </div>
                  </div>
                </div>

                {/* Crisis Keywords */}
                <div>
                  <h4 className="font-bold text-lg text-gray-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    Detected Crisis Keywords
                  </h4>
                  <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                    <div className="flex flex-wrap gap-2">
                      {selectedEvent.keywords.map((keyword, i) => (
                        <span key={i} className="px-3 py-2 bg-red-200 text-red-900 rounded-lg text-sm font-medium">
                          "{keyword}"
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div>
                  <h4 className="font-bold text-lg text-gray-900 mb-3">Current Status</h4>
                  <span className={`px-4 py-2 rounded-full text-sm font-medium border ${getStatusColor(selectedEvent.status)}`}>
                    {selectedEvent.status === "pending" && "⏳ Pending Review"}
                    {selectedEvent.status === "contacted" && "📞 User Contacted"}
                    {selectedEvent.status === "resolved" && "✅ Resolved"}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  {selectedEvent.status === "pending" && (
                    <>
                      <Button
                        className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
                        onClick={() => {
                          setShowDetailsModal(false);
                          void loadEventContactDetails(selectedEvent.id);
                          setCallNotes("");
                          setShowCallModal(true);
                        }}
                      >
                        <Phone className="w-4 h-4" />
                        Call User
                      </Button>
                      <Button
                        className="flex-1 bg-purple-600 hover:bg-purple-700 gap-2"
                        onClick={() => {
                          setShowDetailsModal(false);
                          void loadEventContactDetails(selectedEvent.id);
                          setEmailContent("");
                          setShowEmailModal(true);
                        }}
                      >
                        <Mail className="w-4 h-4" />
                        Send Email
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outline"
                    className="px-6"
                    onClick={() => setShowDetailsModal(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Call User Modal */}
      <AnimatePresence>
        {showCallModal && selectedEvent && (
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
                  <p className="text-gray-600">{selectedEvent.user} - {selectedEvent.type}</p>
                </div>
                <button
                  onClick={() => setShowCallModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Crisis Warning */}
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

              {/* Emergency Contacts */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">Emergency Resources Ready</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <p className="text-xs text-gray-600 mb-1">User Phone</p>
                    <p className="font-bold text-gray-900">{selectedContact?.phone || selectedEvent.userPhone || "Not available"}</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <p className="text-xs text-gray-600 mb-1">Emergency Contact</p>
                    <p className="font-bold text-gray-900">{selectedContact?.emergencyPhone || "Not available"}</p>
                  </div>
                </div>
              </div>

              {/* Call Notes */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Call Notes</label>
                <textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  rows={4}
                  placeholder="Document the call: user's state, actions taken, outcome, next steps..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  disabled={isUpdating}
                  className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
                  onClick={async () => {
                    const dialTarget =
                      parsePhoneForDial(selectedContact?.phone) ||
                      parsePhoneForDial(selectedEvent.userPhone) ||
                      parsePhoneForDial(selectedContact?.emergencyPhone);
                    if (dialTarget) {
                      window.location.assign(`tel:${dialTarget}`);
                    } else {
                      toast.error("No dialable phone number found for this user.");
                    }
                    await updateEventStatus(selectedEvent.id, {
                      status: "contacted",
                      notes: callNotes || "Phone outreach initiated by admin.",
                    });
                    setShowCallModal(false);
                    setCallNotes("");
                  }}
                >
                  <Phone className="w-4 h-4" />
                  {isUpdating ? "Updating..." : "Start Call"}
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
        {showEmailModal && selectedEvent && (
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
                  <p className="text-gray-600">{selectedEvent.user} - {selectedEvent.type}</p>
                </div>
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Email Template Suggestions */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">Email Template</label>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button 
                    className="p-3 border-2 border-purple-500 bg-purple-50 rounded-xl text-left hover:bg-purple-100 transition-colors"
                    onClick={() => setEmailContent(`Dear ${selectedEvent.user},\n\nWe noticed you may be going through a difficult time, and we want you to know that support is available. Your wellbeing is important to us.\n\nIf you're experiencing a crisis, please reach out to:\n- National Suicide Prevention Lifeline: 988\n- Crisis Text Line: Text HOME to 741741\n- Emergency Services: 911\n\nOur team is here to support you. Please don't hesitate to reach out.\n\nWith care,\nEzri Crisis Support Team`)}
                  >
                    <p className="font-semibold text-purple-900 text-sm">Supportive Check-in</p>
                    <p className="text-xs text-purple-700 mt-1">Empathetic outreach with resources</p>
                  </button>
                  <button 
                    className="p-3 border-2 border-gray-300 bg-white rounded-xl text-left hover:bg-gray-50 transition-colors"
                    onClick={() => setEmailContent(`Dear ${selectedEvent.user},\n\nThis is an urgent message regarding your recent session. We are deeply concerned about your safety and wellbeing.\n\nPlease contact us immediately or reach out to emergency services:\n- Call 911 for immediate emergency assistance\n- National Suicide Prevention Lifeline: 988 (24/7)\n- Crisis Text Line: Text HOME to 741741\n\nYour life matters. Help is available.\n\nUrgently,\nEzri Crisis Support Team`)}
                  >
                    <p className="font-semibold text-gray-900 text-sm">Urgent Safety Outreach</p>
                    <p className="text-xs text-gray-700 mt-1">Immediate safety concerns</p>
                  </button>
                </div>
              </div>

              {/* Email Content */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">To</label>
                <div className="px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 mb-3">
                  {selectedContact?.email || selectedEvent.userEmail || "No email available"}
                </div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email Message</label>
                <textarea
                  value={emailContent}
                  onChange={(e) => setEmailContent(e.target.value)}
                  rows={10}
                  placeholder="Write your email message..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  disabled={isUpdating}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 gap-2"
                  onClick={async () => {
                    const email = selectedContact?.email || selectedEvent.userEmail;
                    if (email) {
                      const subject = encodeURIComponent("Crisis Support Check-in");
                      const body = encodeURIComponent(emailContent || "Checking in with support resources.");
                      window.location.assign(`mailto:${email}?subject=${subject}&body=${body}`);
                    } else {
                      toast.error("No email found for this user.");
                    }
                    await updateEventStatus(selectedEvent.id, {
                      status: "contacted",
                      notes: "Crisis support email prepared/sent by admin.",
                    });
                    setShowEmailModal(false);
                    setEmailContent("");
                  }}
                >
                  <Mail className="w-4 h-4" />
                  {isUpdating ? "Updating..." : "Send Email"}
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

      {/* Resolve Event Modal */}
      <AnimatePresence>
        {showResolveModal && selectedEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowResolveModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl border border-pink-100"
            >
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Resolve Crisis Event</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Mark this event as resolved and save final notes.
                  </p>
                </div>
                <button
                  onClick={() => setShowResolveModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="mb-5 p-4 rounded-xl bg-gray-50 border border-gray-200">
                <p className="font-semibold text-gray-900">{selectedEvent.user}</p>
                <p className="text-sm text-gray-600">{selectedEvent.type}</p>
                <p className="text-xs text-gray-500 mt-1">Event ID: {selectedEvent.id}</p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Resolution Notes</label>
                <textarea
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  rows={4}
                  placeholder="Add resolution details, outcomes, and next steps..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowResolveModal(false)}
                  disabled={isUpdating}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  disabled={isUpdating}
                  onClick={async () => {
                    await updateEventStatus(selectedEvent.id, {
                      status: "resolved",
                      notes: resolveNotes || "Resolved by admin in crisis monitoring.",
                    });
                    setShowResolveModal(false);
                  }}
                >
                  {isUpdating ? "Saving..." : "Confirm Resolve"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayoutNew>
  );
}
