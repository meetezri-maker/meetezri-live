import { AppLayout } from "../../components/AppLayout";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { motion, AnimatePresence } from "motion/react";
import {
  Clock,
  Calendar,
  Video,
  MessageSquare,
  Heart,
  Play,
  ChevronRight,
  Filter,
  Search,
  Download,
  Star,
  Lock
} from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../../lib/api";
import { Skeleton } from "../../components/ui/skeleton";
import {
  companionCardImageUrl,
  tryResolveCompanionPortraitUrl,
} from "@/lib/avatar/companionModelUrl";
import { findLobbyAvatar } from "@/lib/avatar/lobbyAvatars";

interface SessionData {
  id: string;
  date: string;
  timeLabel: string;
  duration: string;
  /** Fractional minutes for summary stats (avoids parsing the label string). */
  durationMinutesForStats: number;
  type: "video" | "chat";
  messagesCount: number;
  topicsDiscussed: string[];
  thumbnail: string;
  summary: string;
  favorite: boolean;
  status?: "completed" | "upcoming";
  recordingUrl?: string;
  isUpcoming?: boolean;
  avatarName?: string;
  avatarImage?: string;
  environmentLabel?: string;
}

interface BackendSession {
  id: string;
  user_id: string;
  title: string | null;
  status: string;
  type: string;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  billed_seconds?: number | null;
  recording_url: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  _count?: {
    session_messages: number;
  };
  config?: {
    avatar?: string;
    environment?: string;
  };
}

const DEFAULT_HISTORY_AVATAR = {
  name: "Alex",
  image: companionCardImageUrl("Alex.png"),
};

function resolveHistoryAvatar(name: string | undefined | null) {
  const raw = (name ?? "").trim();
  if (!raw) return DEFAULT_HISTORY_AVATAR;
  const lobby = findLobbyAvatar(raw);
  if (lobby?.cardImage) {
    return { name: lobby.name, image: lobby.cardImage };
  }
  const img = tryResolveCompanionPortraitUrl(raw);
  if (img) return { name: raw, image: img };
  return DEFAULT_HISTORY_AVATAR;
}

const SESSION_ENVIRONMENT_LABELS: Record<string, string> = {
  beach: "Beach Sunset",
  forest: "Peaceful Forest",
  mountains: "Mountain View",
  space: "Starry Night",
  minimal: "Minimal Studio",
};

function formatEnvironmentLabel(value: string | undefined | null): string {
  if (!value) return "Default";
  return SESSION_ENVIRONMENT_LABELS[value] ?? value;
}

/** Default / legacy API titles shown in history (new instant sessions use Instant Talk). */
function formatSessionSummaryTitle(title: string | null | undefined): string {
  const t = title?.trim();
  if (!t) return "Talking";
  if (t === "Instant Session") return "Instant Talk";
  return t;
}

/**
 * `duration_minutes` is stored as floor(seconds/60), so sub-minute sessions are 0 — but the UI
 * used truthy checks and showed "N/A". Prefer wall-clock (started_at → ended_at) when available.
 */
function formatSessionDuration(s: BackendSession): { label: string; minutesForStats: number } {
  const billedSec =
    typeof s.billed_seconds === "number" &&
    Number.isFinite(s.billed_seconds) &&
    s.billed_seconds > 0
      ? s.billed_seconds
      : null;

  const spanMs =
    s.started_at && s.ended_at
      ? Math.max(0, new Date(s.ended_at).getTime() - new Date(s.started_at).getTime())
      : null;
  const spanMinutes = spanMs != null ? spanMs / 60000 : null;

  const storedMin =
    typeof s.duration_minutes === "number" && !Number.isNaN(s.duration_minutes)
      ? s.duration_minutes
      : null;

  if (spanMinutes != null && spanMinutes > 0) {
    if (spanMinutes >= 1) {
      const m = Math.floor(spanMinutes);
      return { label: `${m} min`, minutesForStats: m };
    }
    return { label: "< 1 min", minutesForStats: spanMinutes };
  }

  if (storedMin != null && storedMin > 0) {
    return { label: `${storedMin} min`, minutesForStats: storedMin };
  }

  if (storedMin === 0) {
    return { label: "0 min", minutesForStats: 0 };
  }

  if (billedSec != null) {
    const m = billedSec / 60;
    return {
      label: m < 1 ? "< 1 min" : `${Math.floor(m)} min`,
      minutesForStats: m,
    };
  }

  return { label: "N/A", minutesForStats: 0 };
}

export function SessionHistory() {
  const navigate = useNavigate();
  const { session, profile } = useAuth();

  // Feature Gate for Trial Users
  if (profile?.subscription_plan === 'trial') {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Talking History is a Core Feature</h2>
            <p className="text-slate-600 dark:text-slate-300 max-w-md mx-auto mb-8">
              Upgrade to Core or Pro to unlock detailed talking logs and history.
            </p>
            <Button onClick={() => navigate('/app/billing')}>
              View Plans
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null);
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"completed" | "upcoming">("completed");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  const [completedSessions, setCompletedSessions] = useState<SessionData[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<SessionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [transcript, setTranscript] = useState<
    { role: string; content: string; created_at?: string }[]
  >([]);
  const [loadingTranscript, setLoadingTranscript] = useState(false);

  const handleToggleFavorite = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.sessions.toggleFavorite(sessionId);
      
      // Update local state
      const updateSessions = (sessions: SessionData[]) => 
        sessions.map(s => s.id === sessionId ? { ...s, favorite: !s.favorite } : s);
      
      setCompletedSessions(prev => updateSessions(prev));
      setUpcomingSessions(prev => updateSessions(prev));
      
      if (selectedSession?.id === sessionId) {
        setSelectedSession(prev => prev ? { ...prev, favorite: !prev.favorite } : null);
      }
    } catch (error) {
      console.error("Failed to toggle favorite", error);
    }
  };

  useEffect(() => {
    if (selectedSession) {
      const fetchTranscript = async () => {
        setLoadingTranscript(true);
        try {
          const data = await api.sessions.getTranscript(selectedSession.id);
          setTranscript(data);
        } catch (error) {
          console.error("Failed to fetch transcript", error);
          setTranscript([]);
        } finally {
          setLoadingTranscript(false);
        }
      };
      fetchTranscript();
    } else {
      setTranscript([]);
    }
  }, [selectedSession]);

  useEffect(() => {
    const fetchSessions = async () => {
      if (!session?.access_token) return;
      
      try {
        const data: BackendSession[] = await api.sessions.list();
        const now = new Date();

        const mapSession = (s: BackendSession): SessionData => {
          const baseDateString = s.scheduled_at || s.started_at || s.created_at;
          const baseDate = new Date(baseDateString);
          const scheduledAtMs = s.scheduled_at ? new Date(s.scheduled_at).getTime() : null;
          const isFutureScheduled =
            s.status === "scheduled" &&
            scheduledAtMs !== null &&
            scheduledAtMs >= now.getTime();

          const { label: durationLabel, minutesForStats } = formatSessionDuration(s);
          const resolvedAvatar = resolveHistoryAvatar(s.config?.avatar ?? profile?.selected_avatar);

          return {
            id: s.id,
            date: baseDate.toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            }),
            timeLabel: baseDate.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            }),
            duration: durationLabel,
            durationMinutesForStats: minutesForStats,
            type: s.type === 'instant' ? 'video' : (s.type as "video" | "chat") || 'video',
            messagesCount: s._count?.session_messages || 0,
            topicsDiscussed: [],
            thumbnail: `gradient-${(s.id.charCodeAt(0) % 5) + 1}`,
            summary: formatSessionSummaryTitle(s.title),
            favorite: s.is_favorite || false,
            status: s.status === 'completed' ? 'completed' : 'upcoming',
            recordingUrl: s.recording_url || undefined,
            isUpcoming: isFutureScheduled,
            avatarName: resolvedAvatar.name,
            avatarImage: resolvedAvatar.image,
            environmentLabel: formatEnvironmentLabel(s.config?.environment ?? profile?.selected_environment),
          };
        };

        const mapped = data.map(mapSession);

        const completed = mapped.filter(s => s.status === 'completed');
        const upcoming = mapped.filter(s => s.status === 'upcoming' && s.isUpcoming);

        setCompletedSessions(completed);
        setUpcomingSessions(upcoming);
      } catch (error) {
        console.error('Error fetching sessions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessions();
  }, [session]);

  const handleReplaySession = () => {
    // Navigate to active session page to replay the session
    // navigate("/app/active-session");
  };

  const transcriptLine = (role: string, content: string) => {
    const r = role.toLowerCase();
    const label = r === "user" ? "You" : "Ezri";
    return `[${label}] ${content}`;
  };

  const downloadTextFile = (filename: string, body: string) => {
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportSession = async (
    session: SessionData,
    messages?: { role: string; content: string; created_at?: string }[]
  ) => {
    let rows: { role: string; content: string; created_at?: string }[];
    if (messages !== undefined) {
      rows = messages;
    } else {
      try {
        rows = await api.sessions.getTranscript(session.id);
      } catch {
        rows = [];
      }
    }

    const header = [
      `Session ID: ${session.id}`,
      `Date: ${session.date}`,
      `Duration: ${session.duration}`,
      `Summary: ${session.summary}`,
      "",
      "--- Transcript ---",
      "",
    ].join("\n");

    const body =
      rows.length > 0
        ? rows.map((m) => transcriptLine(m.role, m.content)).join("\n\n")
        : "(No messages stored for this session.)";

    const text = `${header}${body}`;
    const safeDate = session.date.replace(/,?\s+/g, "-");
    downloadTextFile(`session-${session.id}-${safeDate}-transcript.txt`, text);
  };


  const sessions = activeTab === "completed" ? completedSessions : upcomingSessions;

  const filteredSessions = sessions.filter((session) => {
    if (activeTab === "upcoming") return true;
    const matchesFavorite = !filterFavorites || session.favorite;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      q === "" ||
      session.summary.toLowerCase().includes(q) ||
      session.topicsDiscussed.some((topic) => topic.toLowerCase().includes(q));
    return matchesFavorite && matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * pageSize;
  const paginatedSessions = filteredSessions.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, filterFavorites, searchQuery, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const gradientStyles: Record<string, string> = {
    "gradient-1": "from-blue-400 to-purple-500",
    "gradient-2": "from-purple-400 to-pink-500",
    "gradient-3": "from-orange-400 to-red-500",
    "gradient-4": "from-green-400 to-teal-500",
    "gradient-5": "from-indigo-400 to-blue-500"
  };

  // Calculate stats
  const totalDurationMinutes = completedSessions.reduce(
    (acc, s) => acc + s.durationMinutesForStats,
    0
  );
  const totalHours = (totalDurationMinutes / 60).toFixed(1);
  const totalMessages = completedSessions.reduce((acc, s) => acc + s.messagesCount, 0);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="mb-8">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-5 w-12" />
                  </div>
                  <Skeleton className="w-8 h-8 rounded-lg" />
                </div>
              </Card>
            ))}
          </div>
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <Skeleton className="w-full sm:w-48 h-32 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-8 h-8 text-primary" />
                <h1 className="text-3xl font-bold">Talking History</h1>
              </div>
              <p className="text-muted-foreground">
                Review your past sessions and track your progress
              </p>
            </div>
            <Link to="/app/session-lobby">
              <Button className="gap-2">
                <Video className="w-4 h-4" />
                New Session
              </Button>
            </Link>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Talk it out</p>
                  <p className="text-2xl font-bold">{completedSessions.length}</p>
                </div>
                <Video className="w-8 h-8 text-primary" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Time</p>
                  <p className="text-2xl font-bold">{totalHours}h</p>
                </div>
                <Clock className="w-8 h-8 text-secondary" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Messages saved</p>
                  <p className="text-2xl font-bold">{totalMessages}</p>
                </div>
                <MessageSquare className="w-8 h-8 text-green-500" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Upcoming</p>
                  <p className="text-2xl font-bold">{upcomingSessions.length}</p>
                </div>
                <Calendar className="w-8 h-8 text-purple-500" />
              </div>
            </Card>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 mb-6 border-b border-gray-200">
            <motion.button
              onClick={() => setActiveTab("completed")}
              className={`px-6 py-3 font-medium transition-colors relative ${
                activeTab === "completed"
                  ? "text-primary"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              Completed Talk ({completedSessions.length})
              {activeTab === "completed" && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </motion.button>
            <motion.button
              onClick={() => setActiveTab("upcoming")}
              className={`px-6 py-3 font-medium transition-colors relative ${
                activeTab === "upcoming"
                  ? "text-primary"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              Upcoming Talk ({upcomingSessions.length})
              {activeTab === "upcoming" && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </motion.button>
          </div>

          {/* Filters & Search - Only show for completed sessions */}
          {activeTab === "completed" && (
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by session title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setFilterFavorites(!filterFavorites)}
                  variant={filterFavorites ? "default" : "outline"}
                  className={`gap-2 ${filterFavorites ? "bg-red-500 hover:bg-red-600 text-white border-red-500" : "text-gray-600 hover:text-white hover:border-red-200"}`}
                >
                  <Heart className={`w-4 h-4 ${filterFavorites ? "fill-current" : ""}`} />
                  Favorites
                </Button>
              </div>
            </div>
          )}
        </motion.div>

        {/* Talk it out List */}
        <div className="grid grid-cols-1 gap-4">
          {filteredSessions.length === 0 && (
            <Card className="p-12 text-center">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="font-bold text-lg mb-2">
                {activeTab === "upcoming" ? "No Upcoming Talk" : "No Talk it out Found"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {activeTab === "upcoming"
                  ? "Schedule a talk to get started"
                  : "Try adjusting your filters"}
              </p>
              {activeTab === "upcoming" && (
                <Link to="/app/session-lobby">
                  <Button>
                    <Calendar className="w-4 h-4 mr-2" />
                     Let's Talk it Out Later
                  </Button>
                </Link>
              )}
            </Card>
          )}
          {paginatedSessions.map((session, index) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index, 4) * 0.06 }}
            >
              {activeTab === "upcoming" ? (
                <Card className="overflow-hidden border border-primary/15 bg-gradient-to-r from-white to-indigo-50/30 dark:from-gray-900 dark:to-indigo-950/20">
                  <div className="flex items-center gap-4 p-4 sm:p-5">
                    <div className="h-16 w-16 rounded-full overflow-hidden border-2 border-white dark:border-gray-900 shadow-md shrink-0">
                      <img
                        src={session.avatarImage || DEFAULT_HISTORY_AVATAR.image}
                        alt={session.avatarName || "Companion avatar"}
                        className="h-full w-full object-cover object-top"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base truncate">
                        {session.avatarName || "Your companion"}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>{session.date}</span>
                        <span className="text-gray-300">•</span>
                        <Clock className="w-4 h-4" />
                        <span>{session.duration}</span>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                      Upcoming
                    </span>
                  </div>
                </Card>
              ) : (
                <Card className="group overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                  <div className="flex flex-col sm:flex-row">
                    {/* Thumbnail */}
                    <div className={`w-full sm:w-48 h-32 bg-gradient-to-br ${gradientStyles[session.thumbnail]} relative`}>
                      <motion.div
                        animate={{
                          scale: [1, 1.1, 1],
                          opacity: [0.3, 0.5, 0.3]
                        }}
                        transition={{ duration: 3, repeat: Infinity }}
                        className="absolute inset-0 bg-white/20 rounded-full blur-3xl"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setSelectedSession(session)}
                          className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-xl"
                        >
                          <Play className="w-6 h-6 text-primary ml-1" />
                        </motion.button>
                      </div>
                      <button
                        onClick={(e) => handleToggleFavorite(session.id, e)}
                        className={`absolute top-2 right-2 p-2 rounded-full transition-all duration-200 ${
                          session.favorite
                            ? "bg-white/20 opacity-100"
                            : "bg-black/20 opacity-0 group-hover:opacity-100 hover:bg-black/30"
                        }`}
                      >
                        <Star
                          className={`w-5 h-5 transition-colors ${
                            session.favorite
                              ? "text-yellow-400 fill-yellow-400"
                              : "text-white"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-muted-foreground">{session.date}</span>
                            <span className="text-gray-300">•</span>
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-muted-foreground">{session.duration}</span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{session.summary}</p>
                        </div>
                      </div>

                      {/* Topics */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {session.topicsDiscussed.map((topic) => (
                          <span
                            key={topic}
                            className="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium"
                          >
                            {topic}
                          </span>
                        ))}
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MessageSquare className="w-4 h-4" />
                          <span>
                            {session.messagesCount} message{session.messagesCount === 1 ? "" : "s"} saved
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="p-4 flex sm:flex-col gap-2 border-t sm:border-t-0 sm:border-l border-gray-200">
                      <Button
                        onClick={() => setSelectedSession(session)}
                        variant="outline"
                        size="sm"
                        className="flex-1 sm:flex-none"
                      >
                        View Details
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 sm:flex-none"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleExportSession(session);
                        }}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </motion.div>
          ))}
        </div>

        {filteredSessions.length > 0 && (
          <div className="mt-6 flex flex-col gap-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <label htmlFor="session-history-page-size" className="text-sm text-muted-foreground">
                Rows
              </label>
              <select
                id="session-history-page-size"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm"
              >
                {[5, 10, 20, 50].map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </select>
              <span className="text-sm text-muted-foreground">
                {pageStart + 1}-{Math.min(pageStart + pageSize, filteredSessions.length)} of {filteredSessions.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage <= 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {safeCurrentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Session Detail Modal */}
        <AnimatePresence>
          {selectedSession && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedSession(null)}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 50 }}
                className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-3xl z-50"
              >
                <Card className="p-6 max-h-[90vh] overflow-y-auto">
               

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="font-bold">Talking Details</h3>
                      <div className="rounded-lg border border-gray-200 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 text-sm border-b border-gray-200">
                          <span className="text-muted-foreground">Time</span>
                          <span className="font-medium">{selectedSession.timeLabel}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3 text-sm border-b border-gray-200">
                          <span className="text-muted-foreground">Date</span>
                          <span className="font-medium">{selectedSession.date}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3 text-sm border-b border-gray-200">
                          <span className="text-muted-foreground">Session Time</span>
                          <span className="font-medium">{selectedSession.duration}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3 text-sm border-b border-gray-200">
                          <span className="text-muted-foreground">Avatar</span>
                          <span className="font-medium">{selectedSession.avatarName || "Default"}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3 text-sm">
                          <span className="text-muted-foreground">Environment</span>
                          <span className="font-medium">{selectedSession.environmentLabel || "Default"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Summary */}
                    <div>
                      <h3 className="font-bold mb-2">Summary</h3>
                      <p className="text-sm text-gray-600">{selectedSession.summary}</p>
                    </div>

                    {/* Transcript */}
                    <div>
                      {/* <h3 className="font-bold mb-2">Summary</h3> */}
                      <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto space-y-3">
                        {loadingTranscript ? (
                           <p className="text-sm text-gray-500 text-center">Loading transcript...</p>
                        ) : transcript.length > 0 ? (
                          transcript.map((msg, i) => {
                            const isUser = msg.role?.toLowerCase() === "user";
                            return (
                            <div key={i} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                              }`}>
                                {isUser ? 'U' : 'E'}
                              </div>
                              <div className={`p-3 rounded-lg max-w-[80%] text-sm ${
                                isUser ? 'bg-primary/10' : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm'
                              }`}>
                                <p>{msg.content}</p>
                              </div>
                            </div>
                            );
                          })
                        ) : (
                          <p className="text-sm text-gray-500 text-center italic">No transcript available for this session.</p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-4 border-t border-gray-200">
                      <Button
                        className="flex-1"
                        variant="outline"
                        onClick={() => void handleExportSession(selectedSession, transcript)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export Transcript
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
