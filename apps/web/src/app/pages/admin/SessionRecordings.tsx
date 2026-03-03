import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { api } from "../../../lib/api";
import {
  Video,
  Flag,
  AlertTriangle,
  Star,
  User,
  Calendar,
  Clock,
  MessageSquare,
  Download,
  CheckCircle,
  Search,
} from "lucide-react";

interface SessionRecording {
  id: string;
  userId: string;
  userName: string;
  sessionDate: Date;
  duration: number;
  status: "completed" | "flagged" | "reviewed" | "escalated";
  aiCompanion: string;
  topics: string[];
  sentiment: "positive" | "neutral" | "negative" | "crisis";
  flaggedIssues?: string[];
  qualityScore: number;
  transcriptAvailable: boolean;
  reviewedBy?: string;
  reviewNotes?: string;
}

interface TranscriptMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

export function SessionRecordings() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedRecording, setSelectedRecording] = useState<SessionRecording | null>(null);
  const [recordings, setRecordings] = useState<SessionRecording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [transcripts, setTranscripts] = useState<Record<string, TranscriptMessage[]>>({});
  const [transcriptLoadingId, setTranscriptLoadingId] = useState<string | null>(null);
  const [transcriptErrorId, setTranscriptErrorId] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecordings = async () => {
      try {
        const data = await api.admin.getSessionRecordings();
        const mappedRecordings: SessionRecording[] = data.map((session: any) => {
          const config = session.config || {};

          let status: SessionRecording["status"] = "completed";
          if (config.admin_flagged) {
            status = "flagged";
          } else if (config.status && ["completed", "flagged", "reviewed", "escalated"].includes(config.status)) {
            status = config.status;
          }

          const topics = Array.isArray(config.topics) ? config.topics : [];
          const qualityScore = typeof config.quality_score === "number" ? config.quality_score : 0;
          const transcriptCount = session._count?.session_messages ?? 0;

          return {
            id: session.id,
            userId: session.user_id,
            userName: session.profiles?.full_name || "Unknown User",
            sessionDate: new Date(session.started_at || session.created_at),
            duration: session.duration_minutes || 0,
            status,
            aiCompanion: config.ai_name || "AI Assistant",
            topics,
            sentiment: (config.sentiment || "neutral") as any,
            flaggedIssues: config.flagged_issues,
            qualityScore,
            transcriptAvailable: transcriptCount > 0,
            reviewedBy: config.reviewed_by,
            reviewNotes: config.review_notes,
          };
        });
        setRecordings(mappedRecordings);
      } catch (error) {
        console.error("Failed to fetch session recordings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecordings();
  }, []);

  // Mock session recordings
  /* const recordings: SessionRecording[] = [ ... ] */

  const filteredRecordings = recordings.filter(rec => {
    const matchesSearch = rec.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         rec.topics.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFilter = filterStatus === "all" || rec.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status: string) => {
    switch(status) {
      case "completed": return "bg-green-100 text-green-700";
      case "flagged": return "bg-yellow-100 text-yellow-700";
      case "reviewed": return "bg-blue-100 text-blue-700";
      case "escalated": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch(sentiment) {
      case "positive": return "text-green-600";
      case "neutral": return "text-gray-600";
      case "negative": return "text-orange-600";
      case "crisis": return "text-red-600";
      default: return "text-gray-600";
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case "completed": return CheckCircle;
      case "flagged": return Flag;
      case "reviewed": return MessageSquare;
      case "escalated": return AlertTriangle;
      default: return CheckCircle;
    }
  };

  const stats = {
    totalRecordings: recordings.length,
    flaggedSessions: recordings.filter(r => r.status === "flagged").length,
    escalatedSessions: recordings.filter(r => r.status === "escalated").length,
    avgQualityScore:
      recordings.length === 0
        ? 0
        : Math.round(recordings.reduce((sum, r) => sum + r.qualityScore, 0) / recordings.length)
  };

  const loadTranscript = (recording: SessionRecording) => {
    if (transcripts[recording.id] || transcriptLoadingId === recording.id) return;
    setTranscriptLoadingId(recording.id);
    setTranscriptErrorId(null);
    api.admin
      .getSessionRecordingTranscript(recording.id)
      .then((data: any[]) => {
        const mapped: TranscriptMessage[] = data.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          created_at: m.created_at
        }));
        setTranscripts(prev => ({ ...prev, [recording.id]: mapped }));
      })
      .catch((error) => {
        console.error("Failed to fetch session transcript:", error);
        setTranscriptErrorId(recording.id);
      })
      .finally(() => {
        setTranscriptLoadingId(null);
      });
  };

  const handleToggleRecording = (recording: SessionRecording) => {
    const isCurrentlySelected = selectedRecording?.id === recording.id;
    if (isCurrentlySelected) {
      setSelectedRecording(null);
      return;
    }
    setSelectedRecording(recording);
    if (recording.transcriptAvailable) {
      loadTranscript(recording);
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
            <h1 className="text-3xl font-bold text-gray-900">AI Session Recordings</h1>
            <p className="text-gray-600 mt-1">Review and analyze session recordings</p>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                <Video className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Total Recordings</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalRecordings}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-6 shadow-lg border-2 border-yellow-200"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600">
                <Flag className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Flagged</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.flaggedSessions}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-6 shadow-lg border-2 border-red-200"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-red-500 to-rose-600">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Escalated</p>
                <p className="text-2xl font-bold text-red-600">{stats.escalatedSessions}</p>
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
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600">
                <Star className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Avg Quality</p>
                <p className="text-2xl font-bold text-gray-900">{stats.avgQualityScore}/100</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100"
        >
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by user name or topic..."
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="flagged">Flagged</option>
              <option value="reviewed">Reviewed</option>
              <option value="escalated">Escalated</option>
            </select>
          </div>
        </motion.div>

        {/* Recordings List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-6">Session Recordings</h2>

          <div className="space-y-4">
            {filteredRecordings.map((recording, index) => {
              const StatusIcon = getStatusIcon(recording.status);
              
              return (
                <motion.div
                  key={recording.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + index * 0.05 }}
                  onClick={() => handleToggleRecording(recording)}
                  className={`border-2 rounded-xl p-5 cursor-pointer transition-all ${
                    selectedRecording?.id === recording.id
                      ? "border-blue-500 bg-blue-50 shadow-md"
                      : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl flex-shrink-0 bg-gradient-to-br ${
                      recording.status === "escalated" ? "from-red-500 to-rose-600" :
                      recording.status === "flagged" ? "from-yellow-500 to-orange-600" :
                      recording.status === "reviewed" ? "from-blue-500 to-indigo-600" :
                      "from-green-500 to-emerald-600"
                    }`}>
                      <Video className="w-6 h-6 text-white" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-gray-900 text-lg">{recording.userName}</h3>
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium uppercase flex items-center gap-1 ${getStatusColor(recording.status)}`}>
                          <StatusIcon className="w-3 h-3" />
                          {recording.status}
                        </span>
                        <span className={`text-xs font-medium ${getSentimentColor(recording.sentiment)}`}>
                          {recording.sentiment}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 mb-3 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {recording.aiCompanion}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {recording.sessionDate.toLocaleString()}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {recording.duration} min
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4" />
                          {recording.qualityScore}/100
                        </div>
                      </div>

                      {/* Topics */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {recording.topics.map((topic, idx) => (
                          <span key={idx} className="px-2 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium">
                            {topic}
                          </span>
                        ))}
                      </div>

                      {/* Flagged Issues */}
                      {recording.flaggedIssues && recording.flaggedIssues.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                            <p className="text-xs font-bold text-red-700 uppercase">Flagged Issues:</p>
                          </div>
                          <div className="space-y-1">
                            {recording.flaggedIssues.map((issue, idx) => (
                              <p key={idx} className="text-xs text-red-700">• {issue}</p>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Review Notes */}
                      {recording.reviewNotes && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                          <div className="flex items-center gap-2 mb-2">
                            <MessageSquare className="w-4 h-4 text-blue-600" />
                            <p className="text-xs font-bold text-blue-700 uppercase">
                              Reviewed by {recording.reviewedBy}:
                            </p>
                          </div>
                          <p className="text-sm text-blue-700">{recording.reviewNotes}</p>
                        </div>
                      )}

                      {/* Expanded Transcript */}
                      {selectedRecording?.id === recording.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-4 pt-4 border-t border-gray-300"
                        >
                          {recording.transcriptAvailable && (
                            <div className="bg-gray-50 rounded-lg p-4 mb-4 max-h-80 overflow-y-auto">
                              <h4 className="font-bold text-gray-900 mb-2 text-sm">
                                Session Transcript
                              </h4>
                              {transcriptLoadingId === recording.id && (
                                <p className="text-xs text-gray-500">Loading transcript...</p>
                              )}
                              {transcriptErrorId === recording.id && (
                                <p className="text-xs text-red-600">
                                  Failed to load transcript.
                                </p>
                              )}
                              {!transcriptLoadingId &&
                                transcripts[recording.id] &&
                                transcripts[recording.id].length > 0 && (
                                  <div className="space-y-3 text-sm">
                                    {transcripts[recording.id].map((msg) => {
                                      const isUser = msg.role === "user";
                                      const sender = isUser
                                        ? recording.userName
                                        : recording.aiCompanion;
                                      const colorClass = isUser
                                        ? "text-purple-600"
                                        : "text-blue-600";
                                      return (
                                        <div key={msg.id} className="flex gap-2">
                                          <span className={`font-medium ${colorClass}`}>
                                            {sender}:
                                          </span>
                                          <span className="text-gray-700">
                                            {msg.content}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              {!transcriptLoadingId &&
                                transcripts[recording.id] &&
                                transcripts[recording.id].length === 0 && (
                                  <p className="text-xs text-gray-500">
                                    No transcript messages found for this session.
                                  </p>
                                )}
                            </div>
                          )}
                        </motion.div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 mt-4">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (selectedRecording?.id !== recording.id) {
                              setSelectedRecording(recording);
                            }
                            if (recording.transcriptAvailable) {
                              loadTranscript(recording);
                            }
                          }}
                          className="flex-1 px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium flex items-center justify-center gap-1"
                        >
                          <MessageSquare className="w-4 h-4" />
                          {selectedRecording?.id === recording.id ? "Hide Transcript" : "View Transcript"}
                        </motion.button>

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="px-3 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium"
                        >
                          <Download className="w-4 h-4" />
                        </motion.button>

                        {recording.status === "flagged" && (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="px-3 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-medium flex items-center gap-1"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Mark Reviewed
                          </motion.button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </AdminLayoutNew>
  );
}
