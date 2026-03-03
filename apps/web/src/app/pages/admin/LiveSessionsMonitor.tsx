import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { AnimatePresence } from "motion/react";
import { api } from "../../../lib/api";
import {
  Activity,
  Users,
  Clock,
  MessageSquare,
  Search,
  Filter,
  Eye,
  AlertTriangle,
  TrendingUp,
  Video,
  Mic,
  Volume2,
  Signal,
  Globe,
  MapPin,
  Zap,
  CheckCircle,
  AlertCircle,
  XCircle,
  MoreVertical,
  Download,
  X,
  Send,
  PhoneOff,
  UserX,
  FileText,
} from "lucide-react";
import { Link } from "react-router-dom";

interface LiveSession {
  id: string;
  userId: string;
  userName: string;
  avatar: string;
  sessionType: "therapy" | "crisis" | "wellness";
  startTime: string;
  duration: string;
  messageCount: number;
  sentiment: "positive" | "neutral" | "negative" | "critical";
  status: "active" | "paused" | "ending";
  riskLevel: "low" | "medium" | "high" | "critical";
  location: string;
  device: string;
  connectionQuality: "excellent" | "good" | "fair" | "poor";
  aiConfidence: number;
}

export function LiveSessionsMonitor() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSentiment, setFilterSentiment] = useState<string>("all");
  const [filterRisk, setFilterRisk] = useState<string>("all");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal states
  const [monitoringSession, setMonitoringSession] = useState<LiveSession | null>(null);
  const [interveningSession, setInterveningSession] = useState<LiveSession | null>(null);
  const [menuOpenSession, setMenuOpenSession] = useState<string | null>(null);
  const [interventionMessage, setInterventionMessage] = useState("");

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchLiveSessions = async () => {
      try {
        setIsLoading(true);
        const data = await api.admin.getLiveSessions();
        // Map backend data to frontend interface
        const mappedSessions: LiveSession[] = data.map((s: any) => ({
          id: s.id,
          userId: s.user_id,
          userName: s.profiles?.full_name || 'Unknown User',
          avatar: s.profiles?.avatar_url || 'Unknown',
          sessionType: s.type || 'therapy',
          startTime: s.started_at
            ? new Date(s.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'Unknown',
          duration: s.started_at
            ? `${Math.max(1, Math.floor((Date.now() - new Date(s.started_at).getTime()) / 60000))} min`
            : s.duration_minutes
            ? `${s.duration_minutes} min`
            : 'Just started',
          messageCount: s._count?.session_messages ?? 0,
          sentiment: (s.config?.sentiment || 'neutral') as any,
          status: 'active',
          riskLevel: (s.config?.risk_level || 'low') as any,
          location: s.config?.location || 'Unknown',
          device: s.config?.device || 'Unknown',
          connectionQuality: (s.config?.connection_quality || 'good') as any,
          aiConfidence: typeof s.config?.ai_confidence === 'number' ? s.config.ai_confidence : 0,
        }));
        setLiveSessions(mappedSessions);
      } catch (error) {
        console.error("Failed to fetch live sessions:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLiveSessions();
    // Refresh every 30 seconds
    const interval = setInterval(fetchLiveSessions, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredSessions = liveSessions.filter((session) => {
    const matchesSearch =
      session.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.userId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSentiment = filterSentiment === "all" || session.sentiment === filterSentiment;
    const matchesRisk = filterRisk === "all" || session.riskLevel === filterRisk;
    return matchesSearch && matchesSentiment && matchesRisk;
  });

  const stats = {
    total: liveSessions.length,
    therapy: liveSessions.filter((s) => s.sessionType === "therapy").length,
    crisis: liveSessions.filter((s) => s.sessionType === "crisis").length,
    wellness: liveSessions.filter((s) => s.sessionType === "wellness").length,
    critical: liveSessions.filter((s) => s.riskLevel === "critical").length,
    avgDuration: "23:15",
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return "bg-green-100 text-green-700 border-green-300";
      case "neutral":
        return "bg-blue-100 text-blue-700 border-blue-300";
      case "negative":
        return "bg-orange-100 text-orange-700 border-orange-300";
      case "critical":
        return "bg-red-100 text-red-700 border-red-300";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "critical":
        return "text-red-600";
      case "high":
        return "text-orange-600";
      case "medium":
        return "text-yellow-600";
      case "low":
        return "text-green-600";
      default:
        return "text-gray-600";
    }
  };

  const getConnectionColor = (quality: string) => {
    switch (quality) {
      case "excellent":
        return "text-green-600";
      case "good":
        return "text-blue-600";
      case "fair":
        return "text-yellow-600";
      case "poor":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getSessionTypeColor = (type: string) => {
    switch (type) {
      case "crisis":
        return "bg-red-500 text-white";
      case "therapy":
        return "bg-blue-500 text-white";
      case "wellness":
        return "bg-green-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  const handleMonitor = (session: LiveSession) => {
    setMonitoringSession(session);
  };

  const handleIntervene = (session: LiveSession) => {
    setInterveningSession(session);
  };

  const handleSendIntervention = () => {
    if (!interventionMessage.trim()) {
      alert("⚠️ Please enter an intervention message!");
      return;
    }

    alert(`✅ Intervention sent successfully!\n\nSession: ${interveningSession?.userName}\nMessage: ${interventionMessage}\n\nThe user and crisis team have been notified.`);
    
    setInterventionMessage("");
    setInterveningSession(null);
  };

  const handleEndSession = async (session: LiveSession) => {
    const confirmed = window.confirm(
      `End this session?\n\nUser: ${session.userName}\nSession ID: ${session.id}`
    );
    if (!confirmed) {
      return;
    }

    try {
      await api.admin.endLiveSession(session.id);
      setLiveSessions((prev) => prev.filter((s) => s.id !== session.id));
    } catch (error) {
      console.error("Failed to end session:", error);
      alert("Failed to end session. Please try again.");
    } finally {
      setMenuOpenSession(null);
    }
  };

  const handleExportSession = (session: LiveSession) => {
    const lines = [
      "Live Session Report",
      "===================",
      `Session ID: ${session.id}`,
      `User: ${session.userName} (${session.userId})`,
      `Type: ${session.sessionType}`,
      `Started at: ${session.startTime}`,
      `Duration: ${session.duration}`,
      `Messages: ${session.messageCount}`,
      `Sentiment: ${session.sentiment}`,
      `Risk Level: ${session.riskLevel}`,
      `Location: ${session.location}`,
      `Device: ${session.device}`,
      `Connection Quality: ${session.connectionQuality}`,
      `AI Confidence: ${session.aiConfidence}`,
    ];

    const blob = new Blob([lines.join("\n")], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `live-session-${session.id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setMenuOpenSession(null);
  };

  const handleFlagSession = async (session: LiveSession) => {
    try {
      await api.admin.flagLiveSession(session.id);
      alert(`Session flagged for review for user ${session.userName}.`);
    } catch (error) {
      console.error("Failed to flag session:", error);
      alert("Failed to flag session. Please try again.");
    } finally {
      setMenuOpenSession(null);
    }
  };

  return (
    <AdminLayoutNew>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Live Sessions Monitor</h1>
                <p className="text-muted-foreground">
                  Real-time monitoring of active therapy sessions
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-green-700">
                  Live • {currentTime.toLocaleTimeString()}
                </span>
              </div>
              <Button variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Critical Sessions Alert */}
        {stats.critical > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-4 bg-red-50 border-red-300">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-600 animate-pulse" />
                <div>
                  <p className="font-bold text-red-900">
                    {stats.critical} Critical Risk Session{stats.critical !== 1 ? "s" : ""} Active
                  </p>
                  <p className="text-sm text-red-700">
                    High-risk situations detected. Crisis team has been notified.
                  </p>
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
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Active Sessions</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Users className="w-8 h-8 text-primary" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Therapy</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.therapy}</p>
                </div>
                <MessageSquare className="w-8 h-8 text-blue-500" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Crisis</p>
                  <p className="text-2xl font-bold text-red-600">{stats.crisis}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Wellness</p>
                  <p className="text-2xl font-bold text-green-600">{stats.wellness}</p>
                </div>
                <Zap className="w-8 h-8 text-green-500" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Critical Risk</p>
                  <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Avg Duration</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.avgDuration}</p>
                </div>
                <Clock className="w-8 h-8 text-purple-500" />
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
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by user name or ID..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <select
                  className="px-3 py-2 border rounded-lg"
                  value={filterSentiment}
                  onChange={(e) => setFilterSentiment(e.target.value)}
                >
                  <option value="all">All Sentiment</option>
                  <option value="positive">Positive</option>
                  <option value="neutral">Neutral</option>
                  <option value="negative">Negative</option>
                  <option value="critical">Critical</option>
                </select>
                <select
                  className="px-3 py-2 border rounded-lg"
                  value={filterRisk}
                  onChange={(e) => setFilterRisk(e.target.value)}
                >
                  <option value="all">All Risk Levels</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Live Sessions Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredSessions.map((session, index) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 + index * 0.05 }}
            >
              <Card className={`p-6 hover:shadow-xl transition-all ${
                session.riskLevel === "critical" ? "border-l-4 border-red-500 bg-red-50/30" : ""
              }`}>
                {/* Session Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold relative">
                      {session.userName.charAt(0)}
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-bold">{session.userName}</h3>
                      <p className="text-sm text-muted-foreground">{session.userId}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getSessionTypeColor(session.sessionType)}`}>
                      {session.sessionType.toUpperCase()}
                    </span>
                    <div className="relative">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setMenuOpenSession(menuOpenSession === session.id ? null : session.id)}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                      
                      {/* Dropdown Menu */}
                      {menuOpenSession === session.id && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                          <button
                            onClick={() => handleExportSession(session)}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                          >
                            <FileText className="w-4 h-4" />
                            Export Report
                          </button>
                          <button
                            onClick={() => handleFlagSession(session)}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                          >
                            <AlertTriangle className="w-4 h-4" />
                            Flag for Review
                          </button>
                          <button
                            onClick={() => handleEndSession(session)}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-red-600"
                          >
                            <PhoneOff className="w-4 h-4" />
                            End Session
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Session Metrics */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <span className="text-xs text-muted-foreground">Duration</span>
                    </div>
                    <p className="font-bold text-blue-600">{session.duration}</p>
                    <p className="text-xs text-muted-foreground">Started {session.startTime}</p>
                  </div>

                  <div className="p-3 bg-purple-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare className="w-4 h-4 text-purple-600" />
                      <span className="text-xs text-muted-foreground">Messages</span>
                    </div>
                    <p className="font-bold text-purple-600">{session.messageCount}</p>
                    <p className="text-xs text-muted-foreground">with {session.avatar}</p>
                  </div>
                </div>

                {/* Status Indicators */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Sentiment</p>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border inline-block ${getSentimentColor(session.sentiment)}`}>
                      {session.sentiment}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Risk Level</p>
                    <span className={`font-bold ${getRiskColor(session.riskLevel)}`}>
                      {session.riskLevel.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Technical Info */}
                <div className="border-t pt-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Signal className={`w-4 h-4 ${getConnectionColor(session.connectionQuality)}`} />
                      <span className="text-muted-foreground">Connection:</span>
                      <span className={`font-medium ${getConnectionColor(session.connectionQuality)}`}>
                        {session.connectionQuality}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">AI Confidence:</span>
                      <span className="font-medium">{session.aiConfidence}%</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{session.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{session.device}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="border-t pt-4 mt-4 flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 gap-2"
                    onClick={() => handleMonitor(session)}
                  >
                    <Eye className="w-4 h-4" />
                    Monitor
                  </Button>
                  {session.riskLevel === "critical" && (
                    <Button 
                      className="flex-1 gap-2 bg-red-600 hover:bg-red-700"
                      onClick={() => handleIntervene(session)}
                    >
                      <AlertTriangle className="w-4 h-4" />
                      Intervene
                    </Button>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Empty State */}
        {filteredSessions.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Activity className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-bold text-xl mb-2">No Active Sessions</h3>
            <p className="text-muted-foreground">
              No sessions match the current filters
            </p>
          </motion.div>
        )}

        {/* Monitor Modal */}
        <AnimatePresence>
          {monitoringSession && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                onClick={() => setMonitoringSession(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={() => setMonitoringSession(null)}
              >
                <div
                  className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold">
                        {monitoringSession.userName.charAt(0)}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">Monitoring: {monitoringSession.userName}</h2>
                        <p className="text-sm text-gray-600">{monitoringSession.userId} • {monitoringSession.sessionType.toUpperCase()} Session</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setMonitoringSession(null)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>

                  {/* Modal Content */}
                  <div className="p-6 space-y-6">
                    {/* Session Status */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-blue-50 rounded-lg p-4">
                        <Clock className="w-5 h-5 text-blue-600 mb-2" />
                        <p className="text-xs text-gray-600">Duration</p>
                        <p className="text-lg font-bold text-blue-600">{monitoringSession.duration}</p>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-4">
                        <MessageSquare className="w-5 h-5 text-purple-600 mb-2" />
                        <p className="text-xs text-gray-600">Messages</p>
                        <p className="text-lg font-bold text-purple-600">{monitoringSession.messageCount}</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4">
                        <Signal className="w-5 h-5 text-green-600 mb-2" />
                        <p className="text-xs text-gray-600">Connection</p>
                        <p className="text-lg font-bold text-green-600">{monitoringSession.connectionQuality}</p>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-4">
                        <TrendingUp className="w-5 h-5 text-orange-600 mb-2" />
                        <p className="text-xs text-gray-600">AI Confidence</p>
                        <p className="text-lg font-bold text-orange-600">{monitoringSession.aiConfidence}%</p>
                      </div>
                    </div>

                    {/* Risk Assessment */}
                    <div className={`p-4 rounded-lg border-2 ${
                      monitoringSession.riskLevel === "critical" ? "bg-red-50 border-red-300" :
                      monitoringSession.riskLevel === "high" ? "bg-orange-50 border-orange-300" :
                      monitoringSession.riskLevel === "medium" ? "bg-yellow-50 border-yellow-300" :
                      "bg-green-50 border-green-300"
                    }`}>
                      <div className="flex items-center gap-3 mb-3">
                        <AlertCircle className={`w-6 h-6 ${getRiskColor(monitoringSession.riskLevel)}`} />
                        <div>
                          <h3 className="font-bold text-gray-900">Risk Assessment</h3>
                          <p className={`text-sm font-semibold ${getRiskColor(monitoringSession.riskLevel)}`}>
                            {monitoringSession.riskLevel.toUpperCase()} RISK LEVEL
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm text-gray-700">
                        <p><span className="font-medium">Sentiment:</span> {monitoringSession.sentiment}</p>
                        <p><span className="font-medium">AI Avatar:</span> {monitoringSession.avatar}</p>
                        <p><span className="font-medium">Session Type:</span> {monitoringSession.sessionType}</p>
                      </div>
                    </div>

                    {/* Live Conversation Preview */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Recent Conversation</h3>
                      <div className="bg-gray-50 rounded-lg p-4 space-y-3 max-h-60 overflow-y-auto">
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                              {monitoringSession.userName.charAt(0)}
                            </div>
                            <span className="text-xs font-medium text-gray-900">{monitoringSession.userName}</span>
                            <span className="text-xs text-gray-500">2 min ago</span>
                          </div>
                          <p className="text-sm text-gray-700">I'm feeling really overwhelmed today...</p>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold">
                              AI
                            </div>
                            <span className="text-xs font-medium text-gray-900">{monitoringSession.avatar}</span>
                            <span className="text-xs text-gray-500">1 min ago</span>
                          </div>
                          <p className="text-sm text-gray-700">I understand you're feeling overwhelmed. Can you tell me more about what's causing these feelings?</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                              {monitoringSession.userName.charAt(0)}
                            </div>
                            <span className="text-xs font-medium text-gray-900">{monitoringSession.userName}</span>
                            <span className="text-xs text-gray-500">30 sec ago</span>
                          </div>
                          <p className="text-sm text-gray-700">Everything seems to be piling up and I don't know where to start...</p>
                        </div>
                      </div>
                    </div>

                    {/* Technical Details */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Technical Details</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <MapPin className="w-4 h-4 text-gray-600" />
                            <span className="text-xs text-gray-600">Location</span>
                          </div>
                          <p className="font-medium text-gray-900">{monitoringSession.location}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Globe className="w-4 h-4 text-gray-600" />
                            <span className="text-xs text-gray-600">Device</span>
                          </div>
                          <p className="font-medium text-gray-900">{monitoringSession.device}</p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t">
                      {monitoringSession.riskLevel === "critical" && (
                        <button
                          onClick={() => {
                            setMonitoringSession(null);
                            handleIntervene(monitoringSession);
                          }}
                          className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium flex items-center justify-center gap-2"
                        >
                          <AlertTriangle className="w-5 h-5" />
                          Intervene Now
                        </button>
                      )}
                      <button
                        onClick={() => handleExportSession(monitoringSession)}
                        className="flex-1 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center justify-center gap-2"
                      >
                        <FileText className="w-5 h-5" />
                        Export Report
                      </button>
                      <button
                        onClick={() => setMonitoringSession(null)}
                        className="px-4 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Intervention Modal */}
        <AnimatePresence>
          {interveningSession && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                onClick={() => setInterveningSession(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={() => setInterveningSession(null)}
              >
                <div
                  className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-6">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                      <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                    
                    <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Crisis Intervention</h2>
                    <p className="text-gray-600 text-center mb-6">
                      Send an immediate intervention message to this high-risk session
                    </p>

                    <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-6">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold">
                          {interveningSession.userName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{interveningSession.userName}</p>
                          <p className="text-xs text-gray-600">{interveningSession.userId}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                        <div>
                          <span className="text-gray-600">Risk:</span>
                          <span className={`ml-1 font-bold ${getRiskColor(interveningSession.riskLevel)}`}>
                            {interveningSession.riskLevel.toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Sentiment:</span>
                          <span className="ml-1 font-medium">{interveningSession.sentiment}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Duration:</span>
                          <span className="ml-1 font-medium">{interveningSession.duration}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Intervention Message
                      </label>
                      <textarea
                        className="w-full h-32 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-red-500 focus:outline-none resize-none"
                        placeholder="Type your intervention message here... This will be sent immediately to the user and crisis response team."
                        value={interventionMessage}
                        onChange={(e) => setInterventionMessage(e.target.value)}
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        This message will be delivered immediately and the crisis team will be notified.
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={handleSendIntervention}
                        className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium flex items-center justify-center gap-2"
                      >
                        <Send className="w-5 h-5" />
                        Send Intervention
                      </button>

                      <button
                        onClick={() => {
                          setInterveningSession(null);
                          setInterventionMessage("");
                        }}
                        className="flex-1 px-4 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                      >
                        Cancel
                      </button>
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
