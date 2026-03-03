import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { AlertTriangle, Phone, Mail, Eye, CheckCircle, Clock, TrendingDown, Shield, MessageSquare, User, Bell, ArrowRight, AlertCircle, Activity, Users, Calendar, Filter, Download } from "lucide-react";
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

type FilterType = "all" | "pending" | "contacted" | "in-progress" | "resolved";
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

export function CrisisDashboard() {
  const [statusFilter, setStatusFilter] = useState<FilterType>("all");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CrisisEvent | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [contactNotes, setContactNotes] = useState("");
  const [statusNotes, setStatusNotes] = useState("");
  const [newStatus, setNewStatus] = useState<"contacted" | "in-progress" | "resolved">("contacted");
  const [events, setEvents] = useState<CrisisEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

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

  // Filter events
  const filteredEvents = events.filter((event) => {
    const matchesStatus = statusFilter === "all" || event.status === statusFilter;
    const matchesRisk = riskFilter === "all" || event.riskLevel === riskFilter;
    return matchesStatus && matchesRisk;
  });

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
        {stats.critical > 0 && (
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
                <Button className="bg-red-600 hover:bg-red-700" onClick={() => {
                  setStatusFilter("pending");
                  setRiskFilter("critical");
                }}>
                  Review Now
                </Button>
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
            <Card className="p-4 border-l-4 border-yellow-500 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("pending")}>
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

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button
                  variant={statusFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("all")}
                >
                  All Events
                </Button>
                <Button
                  variant={statusFilter === "pending" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("pending")}
                  className={statusFilter === "pending" ? "bg-red-600 hover:bg-red-700" : ""}
                >
                  Pending
                </Button>
                <Button
                  variant={statusFilter === "contacted" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("contacted")}
                >
                  Contacted
                </Button>
                <Button
                  variant={statusFilter === "in-progress" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("in-progress")}
                >
                  In Progress
                </Button>
                <Button
                  variant={statusFilter === "resolved" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("resolved")}
                >
                  Resolved
                </Button>
              </div>
              <div className="flex gap-2">
                <select
                  className="px-3 py-2 border rounded-lg text-sm"
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value as RiskFilter)}
                >
                  <option value="all">All Risk Levels</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                </select>
                <Link to="/admin/crisis-follow-up-queue">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Calendar className="w-4 h-4" />
                    Follow-up Queue
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Crisis Events List */}
        <div className="space-y-4">
          {filteredEvents.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + index * 0.05 }}
            >
              <Card className={`p-6 border-l-4 ${getRiskBorderColor(event.riskLevel)} hover:shadow-lg transition-shadow`}>
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Event Info */}
                  <div className="flex-1">
                    <div className="flex items-start gap-4 mb-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold flex-shrink-0">
                        {event.userName.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg">{event.userName}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${getRiskColor(event.riskLevel)}`}>
                            {event.riskLevel.toUpperCase()}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(event.status)}`}>
                            {event.status.replace("-", " ").toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          User ID: {event.userId} • {event.timestamp}
                        </p>
                        <div className="mb-3">
                          <p className="font-medium text-sm mb-1">{event.type}</p>
                          <div className="flex flex-wrap gap-2">
                            {event.keywords.map((keyword, i) => (
                              <span
                                key={i}
                                className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium"
                              >
                                {keyword}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Shield className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">AI Confidence:</span>
                            <span className="font-medium">{event.aiConfidence}%</span>
                          </div>
                          {event.responseTime && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Response Time:</span>
                              <span className="font-medium">{event.responseTime}</span>
                            </div>
                          )}
                          {event.assignedTo && (
                            <div className="flex items-center gap-1">
                              <User className="w-4 h-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Assigned:</span>
                              <span className="font-medium">{event.assignedTo}</span>
                            </div>
                          )}
                          {event.lastContact && (
                            <div className="flex items-center gap-1">
                              <MessageSquare className="w-4 h-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Last Contact:</span>
                              <span className="font-medium">{event.lastContact}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex lg:flex-col gap-2 lg:items-end">
                    <Button 
                      variant="outline" 
                      className="w-full gap-2"
                      onClick={() => {
                        setSelectedEvent(event);
                        setShowDetailsModal(true);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                      View Details
                    </Button>
                    {event.status === "pending" && (
                      <Button 
                        className="flex-1 lg:flex-initial bg-red-600 hover:bg-red-700 gap-2"
                        onClick={() => {
                          setSelectedEvent(event);
                          setShowContactModal(true);
                        }}
                      >
                        <Phone className="w-4 h-4" />
                        Contact Now
                      </Button>
                    )}
                    {event.status === "contacted" && (
                      <Button 
                        className="flex-1 lg:flex-initial gap-2"
                        onClick={() => {
                          setSelectedEvent(event);
                          setShowStatusModal(true);
                        }}
                      >
                        <CheckCircle className="w-4 h-4" />
                        Update Status
                      </Button>
                    )}
                    {event.status === "in-progress" && (
                      <Button 
                        className="flex-1 lg:flex-initial gap-2"
                        onClick={() => {
                          setSelectedEvent(event);
                          setShowStatusModal(true);
                        }}
                      >
                        <MessageSquare className="w-4 h-4" />
                        Continue
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Empty State */}
        {filteredEvents.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="font-bold text-xl mb-2">No Crisis Events</h3>
            <p className="text-muted-foreground">
              No events match the current filters
            </p>
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

      {/* Contact Now Modal */}
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
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Contact Crisis Event</h3>
                <p className="text-gray-600">Event #{selectedEvent.id} - {selectedEvent.userName}</p>
              </div>
              <button
                onClick={() => setShowContactModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <AlertCircle className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Event Summary */}
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h4 className="font-bold text-red-900">Crisis Event Summary</h4>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-600">User ID:</p>
                  <p className="font-semibold text-gray-900">{selectedEvent.userId}</p>
                </div>
                <div>
                  <p className="text-gray-600">Risk Level:</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${getRiskColor(selectedEvent.riskLevel)}`}>
                    {selectedEvent.riskLevel.toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-gray-600">Event Type:</p>
                  <p className="font-semibold text-gray-900">{selectedEvent.type}</p>
                </div>
                <div>
                  <p className="text-gray-600">AI Confidence:</p>
                  <p className="font-semibold text-gray-900">{selectedEvent.aiConfidence}%</p>
                </div>
              </div>
              <div className="mt-3">
                <p className="text-gray-600 text-sm mb-2">Detected Keywords:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedEvent.keywords.map((keyword, i) => (
                    <span key={i} className="px-2 py-1 bg-red-200 text-red-800 rounded text-xs font-medium">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Contact Method */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">Contact Method</label>
              <div className="grid grid-cols-3 gap-3">
                <button className="p-4 border-2 border-blue-500 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors">
                  <Phone className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-blue-900">Phone Call</p>
                  <p className="text-xs text-blue-600 mt-1">Immediate</p>
                </button>
                <button className="p-4 border-2 border-gray-300 bg-white rounded-xl hover:bg-gray-50 transition-colors">
                  <Mail className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-900">Email</p>
                  <p className="text-xs text-gray-500 mt-1">Follow-up</p>
                </button>
                <button className="p-4 border-2 border-gray-300 bg-white rounded-xl hover:bg-gray-50 transition-colors">
                  <MessageSquare className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-900">In-App</p>
                  <p className="text-xs text-gray-500 mt-1">Message</p>
                </button>
              </div>
            </div>

            {/* Emergency Resources */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">Quick Actions</label>
              <div className="space-y-2">
                <button className="w-full p-3 bg-red-100 border border-red-300 rounded-xl text-left hover:bg-red-200 transition-colors">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <div>
                      <p className="font-semibold text-red-900">Activate Crisis Protocol</p>
                      <p className="text-xs text-red-700">Connect to emergency services</p>
                    </div>
                  </div>
                </button>
                <button className="w-full p-3 bg-blue-100 border border-blue-300 rounded-xl text-left hover:bg-blue-200 transition-colors">
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-semibold text-blue-900">Call Emergency Contact</p>
                      <p className="text-xs text-blue-700">Notify registered contact</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Contact Notes */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Notes</label>
              <textarea
                value={contactNotes}
                onChange={(e) => setContactNotes(e.target.value)}
                rows={4}
                placeholder="Document your interaction, actions taken, and next steps..."
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
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
                  } catch (error) {
                    console.error("Failed to update crisis event", error);
                  } finally {
                    setIsUpdating(false);
                  }
                }}
              >
                <Phone className="w-4 h-4" />
                Confirm Contact
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

      {/* Update Status Modal */}
      {showStatusModal && selectedEvent && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowStatusModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl"
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Update Event Status</h3>
                <p className="text-gray-600">Event #{selectedEvent.id} - {selectedEvent.userName}</p>
              </div>
              <button
                onClick={() => setShowStatusModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <AlertCircle className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Current Status */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Current Status</label>
              <span className={`inline-block px-4 py-2 rounded-full text-sm font-medium border ${getStatusColor(selectedEvent.status)}`}>
                {selectedEvent.status.replace("-", " ").toUpperCase()}
              </span>
            </div>

            {/* New Status */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">Update To</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as any)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="contacted">Contacted</option>
                <option value="in-progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            {/* Status Notes */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Status Update Notes</label>
              <textarea
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                rows={4}
                placeholder="Describe the current situation, actions taken, and next steps..."
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                className="flex-1 gap-2"
                disabled={isUpdating}
                onClick={async () => {
                  if (!selectedEvent) return;
                  try {
                    setIsUpdating(true);
                    await api.admin.updateCrisisEventStatus(selectedEvent.id, {
                      status: newStatus,
                      notes: statusNotes || undefined,
                    });
                    await loadEvents();
                    setShowStatusModal(false);
                    setStatusNotes("");
                  } catch (error) {
                    console.error("Failed to update crisis event", error);
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
                  onClick={() => {
                    setShowDetailsModal(false);
                    setShowContactModal(true);
                  }}
                >
                  <Phone className="w-4 h-4" />
                  Contact Now
                </Button>
              )}
              {(selectedEvent.status === "contacted" || selectedEvent.status === "in-progress") && (
                <Button
                  className="flex-1 gap-2"
                  onClick={() => {
                    setShowDetailsModal(false);
                    setShowStatusModal(true);
                  }}
                >
                  <CheckCircle className="w-4 h-4" />
                  Update Status
                </Button>
              )}
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => {
                  // Export details
                  console.log('Exporting event details:', selectedEvent.id);
                }}
              >
                <Download className="w-4 h-4" />
                Export Report
              </Button>
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
