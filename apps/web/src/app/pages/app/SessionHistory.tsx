import { AppLayout } from "../../components/AppLayout";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { motion, AnimatePresence } from "motion/react";
import {
  Clock,
  Calendar,
  Video,
  MessageSquare,
  TrendingUp,
  Heart,
  Bookmark,
  Play,
  ChevronRight,
  Filter,
  Search,
  Download,
  Smile,
  Meh,
  Frown,
  Star,
  Lock
} from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../../lib/api";
import { Skeleton } from "../../components/ui/skeleton";

interface SessionData {
  id: string;
  date: string;
  duration: string;
  type: "video" | "chat";
  mood: "positive" | "neutral" | "concerned";
  moodEmoji: string;
  messagesCount: number;
  highlightsCount: number;
  topicsDiscussed: string[];
  thumbnail: string;
  summary: string;
  sentiment: number;
  favorite: boolean;
  status?: "completed" | "upcoming";
  recordingUrl?: string;
  isUpcoming?: boolean;
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
  recording_url: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  _count?: {
    session_messages: number;
  };
}

export function SessionHistory() {
  const navigate = useNavigate();
  const { session, profile } = useAuth();

  // Feature Gate for Trial Users
  if (profile?.subscription_plan === 'trial') {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-slate-200">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Session History is a Core Feature</h2>
            <p className="text-slate-600 max-w-md mx-auto mb-8">
              Upgrade to Core or Pro to unlock detailed session logs and history.
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
  const [filterMood, setFilterMood] = useState<string>("all");
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"completed" | "upcoming">("completed");
  
  const [completedSessions, setCompletedSessions] = useState<SessionData[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<SessionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [transcript, setTranscript] = useState<{ role: string; content: string; created_at: string }[]>([]);
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
          const isUpcoming =
            (s.status === 'scheduled' || s.status === 'active') &&
            baseDate.getTime() >= now.getTime();

          return {
            id: s.id,
            date: baseDate.toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
              hour: s.scheduled_at ? 'numeric' : undefined,
              minute: s.scheduled_at ? 'numeric' : undefined,
            }),
            duration: s.duration_minutes ? `${s.duration_minutes} min` : "N/A",
            type: s.type === 'instant' ? 'video' : (s.type as "video" | "chat") || 'video',
            mood: "neutral",
            moodEmoji: "😐",
            messagesCount: s._count?.session_messages || 0,
            highlightsCount: 0,
            topicsDiscussed: [],
            thumbnail: `gradient-${(s.id.charCodeAt(0) % 5) + 1}`,
            summary: s.title || "No summary available",
            sentiment: 0,
            favorite: s.is_favorite || false,
            status: s.status === 'completed' ? 'completed' : 'upcoming',
            recordingUrl: s.recording_url || undefined,
            isUpcoming,
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

  const handleExportSession = (session: SessionData) => {
    // Create session data object
    const exportData = {
      sessionId: session.id,
      date: session.date,
      duration: session.duration,
      type: session.type,
      mood: session.mood,
      sentiment: `${session.sentiment}%`,
      messagesCount: session.messagesCount,
      highlightsCount: session.highlightsCount,
      topicsDiscussed: session.topicsDiscussed.join(", "),
      summary: session.summary,
      exportedAt: new Date().toISOString()
    };

    // Convert to JSON string
    const jsonString = JSON.stringify(exportData, null, 2);
    
    // Create a blob and download
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `session-${session.id}-${session.date.replace(/,?\s+/g, "-")}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };


  const sessions = activeTab === "completed" ? completedSessions : upcomingSessions;

  const filteredSessions = sessions.filter((session) => {
    if (activeTab === "upcoming") return true; // Don't filter upcoming sessions by mood
    const matchesMood = filterMood === "all" || session.mood === filterMood;
    const matchesFavorite = !filterFavorites || session.favorite;
    const matchesSearch = session.topicsDiscussed.some(topic => 
      topic.toLowerCase().includes(searchQuery.toLowerCase())
    ) || session.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesMood && matchesFavorite && (searchQuery === "" || matchesSearch);
  });

  const gradientStyles: Record<string, string> = {
    "gradient-1": "from-blue-400 to-purple-500",
    "gradient-2": "from-purple-400 to-pink-500",
    "gradient-3": "from-orange-400 to-red-500",
    "gradient-4": "from-green-400 to-teal-500",
    "gradient-5": "from-indigo-400 to-blue-500"
  };

  const getMoodIcon = (mood: string) => {
    switch (mood) {
      case "positive": return <Smile className="w-4 h-4 text-green-500" />;
      case "neutral": return <Meh className="w-4 h-4 text-blue-500" />;
      case "concerned": return <Frown className="w-4 h-4 text-orange-500" />;
      default: return null;
    }
  };

  // Calculate stats
  const totalDurationMinutes = completedSessions.reduce((acc, s) => {
    const minutes = parseInt(s.duration.split(' ')[0]) || 0;
    return acc + minutes;
  }, 0);
  const totalHours = (totalDurationMinutes / 60).toFixed(1);

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
                <h1 className="text-3xl font-bold">Session History</h1>
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
                  <p className="text-sm text-muted-foreground">Total Sessions</p>
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
                  <p className="text-sm text-muted-foreground">Avg Sentiment</p>
                  <p className="text-2xl font-bold">N/A</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
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
              Completed Sessions ({completedSessions.length})
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
              Upcoming Sessions ({upcomingSessions.length})
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
                  placeholder="Search topics or keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setFilterFavorites(!filterFavorites)}
                  variant={filterFavorites ? "default" : "outline"}
                  className={`gap-2 ${filterFavorites ? "bg-red-500 hover:bg-red-600 text-white border-red-500" : "text-gray-600 hover:text-red-500 hover:border-red-200"}`}
                >
                  <Heart className={`w-4 h-4 ${filterFavorites ? "fill-current" : ""}`} />
                  Favorites
                </Button>
                <div className="w-px h-8 bg-gray-200 mx-2" />
                {["all", "positive", "neutral", "concerned"].map((mood) => (
                  <Button
                    key={mood}
                    onClick={() => setFilterMood(mood)}
                    variant={filterMood === mood ? "default" : "outline"}
                    className="capitalize"
                  >
                    {mood === "all" ? "All" : mood}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Sessions List */}
        <div className="grid grid-cols-1 gap-4">
          {filteredSessions.length === 0 && (
            <Card className="p-12 text-center">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="font-bold text-lg mb-2">
                {activeTab === "upcoming" ? "No Upcoming Sessions" : "No Sessions Found"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {activeTab === "upcoming"
                  ? "Schedule a session to get started"
                  : "Try adjusting your filters"}
              </p>
              {activeTab === "upcoming" && (
                <Link to="/app/session-lobby">
                  <Button>
                    <Calendar className="w-4 h-4 mr-2" />
                    Schedule Session
                  </Button>
                </Link>
              )}
            </Card>
          )}
          {filteredSessions.map((session, index) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
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
                      {getMoodIcon(session.mood)}
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
                        <span>{session.messagesCount} messages</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Bookmark className="w-4 h-4" />
                        <span>{session.highlightsCount} highlights</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Heart className="w-4 h-4" />
                        <span>{session.sentiment}% positive</span>
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
                        handleExportSession(session);
                      }}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

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
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold mb-2">Session Details</h2>
                      <p className="text-sm text-muted-foreground">{selectedSession.date}</p>
                    </div>
                    <button
                      onClick={() => setSelectedSession(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* Summary */}
                    <div>
                      <h3 className="font-bold mb-2">Summary</h3>
                      <p className="text-sm text-gray-600">{selectedSession.summary}</p>
                    </div>

                    {/* Key Highlights */}
                    <div>
                      <h3 className="font-bold mb-2">Key Highlights</h3>
                      <div className="space-y-2">
                        {[
                          "Identified work stress triggers",
                          "Practiced breathing exercises",
                          "Created action plan for self-care",
                          "Discussed support system",
                          "Set goals for next session"
                        ].slice(0, selectedSession.highlightsCount).map((highlight, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <Star className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-gray-600">{highlight}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Sentiment Analysis */}
                    <div>
                      <h3 className="font-bold mb-2">Sentiment Analysis</h3>
                      <div className="flex items-center gap-3">
                        {getMoodIcon(selectedSession.mood)}
                        <div className="flex-1">
                          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${selectedSession.sentiment}%` }}
                              transition={{ duration: 1 }}
                              className={`h-full rounded-full ${
                                selectedSession.mood === "positive"
                                  ? "bg-green-500"
                                  : selectedSession.mood === "concerned"
                                  ? "bg-orange-500"
                                  : "bg-blue-500"
                              }`}
                            />
                          </div>
                        </div>
                        <span className="text-sm font-medium">{selectedSession.sentiment}%</span>
                      </div>
                    </div>

                    {/* Transcript */}
                    <div>
                      <h3 className="font-bold mb-2">Transcript</h3>
                      <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto space-y-3">
                        {loadingTranscript ? (
                           <p className="text-sm text-gray-500 text-center">Loading transcript...</p>
                        ) : transcript.length > 0 ? (
                          transcript.map((msg, i) => (
                            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                              }`}>
                                {msg.role === 'user' ? 'U' : 'E'}
                              </div>
                              <div className={`p-3 rounded-lg max-w-[80%] text-sm ${
                                msg.role === 'user' ? 'bg-primary/10' : 'bg-white border border-gray-200 shadow-sm'
                              }`}>
                                <p>{msg.content}</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500 text-center italic">No transcript available for this session.</p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-4 border-t border-gray-200">
                      <Button className="flex-1" variant="outline" onClick={() => handleExportSession(selectedSession)}>
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
