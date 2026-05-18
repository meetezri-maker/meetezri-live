import { Button } from "../../components/ui/button";
import { motion, AnimatePresence } from "motion/react";
import {
  Clock,
  Calendar,
  MessageSquare,
  Heart,
  Play,
  Search,
  Download,
  Star,
  Lock,
  MoreVertical,
  ChevronDown,
  Flame,
  Plus,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../../lib/api";
import { cn } from "../../components/ui/utils";
import { AdminPaginationBar } from "@/app/components/admin/AdminPaginationBar";
import {
  companionCardImageUrl,
  tryResolveCompanionPortraitUrl,
} from "@/lib/avatar/companionModelUrl";
import { findLobbyAvatar } from "@/lib/avatar/lobbyAvatars";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";

interface SessionData {
  id: string;
  date: string;
  timeLabel: string;
  duration: string;
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
  sessionType?: string;
  mood?: string;
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
    mood?: string;
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

function formatSessionSummaryTitle(
  title: string | null | undefined,
  sessionType: string | undefined
): string {
  const t = title?.trim();
  const scheduled = sessionType === "scheduled";

  if (scheduled) {
    if (!t || t === "Talking" || t === "Scheduled Session") return "Scheduled Talk";
    if (t === "Instant Session" || t === "Instant Talk") return "Scheduled Talk";
    return t;
  }

  if (!t) return "Talking";
  if (t === "Instant Session") return "Instant Talk";
  if (t === "Scheduled Session") return "Scheduled Talk";
  return t;
}

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

const CINEMATIC_THUMBNAILS = [
  "linear-gradient(135deg, #1a0a2e 0%, #581c87 50%, #f97316 100%)",
  "linear-gradient(135deg, #0f172a 0%, #7c3aed 50%, #ec4899 100%)",
  "linear-gradient(135deg, #1e1b4b 0%, #c026d3 50%, #fb923c 100%)",
  "linear-gradient(135deg, #020617 0%, #4f46e5 50%, #f472b6 100%)",
  "linear-gradient(135deg, #0a0a1a 0%, #8b5cf6 50%, #fbbf24 100%)",
];

const MOOD_COLORS: Record<string, { bg: string; text: string }> = {
  Anxious: { bg: "bg-amber-500/20", text: "text-amber-400" },
  Hopeful: { bg: "bg-emerald-500/20", text: "text-emerald-400" },
  Emotional: { bg: "bg-pink-500/20", text: "text-pink-400" },
  Grateful: { bg: "bg-purple-500/20", text: "text-purple-400" },
  Calm: { bg: "bg-cyan-500/20", text: "text-cyan-400" },
  Sad: { bg: "bg-blue-500/20", text: "text-blue-400" },
  Happy: { bg: "bg-green-500/20", text: "text-green-400" },
  Angry: { bg: "bg-red-500/20", text: "text-red-400" },
};

interface CircularProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  children?: React.ReactNode;
}

function CircularProgress({ value, size = 140, strokeWidth = 10, className, children }: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <div 
        className="absolute rounded-full blur-xl opacity-30"
        style={{
          width: size * 0.85,
          height: size * 0.85,
          background: `conic-gradient(from 0deg, #a855f7 0%, #ec4899 ${value}%, transparent ${value}%)`,
        }}
      />
      <svg width={size} height={size} className="-rotate-90 relative">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(139, 92, 246, 0.15)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#journeyGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
          style={{ filter: "drop-shadow(0 0 8px rgba(168, 85, 247, 0.6))" }}
        />
        <defs>
          <linearGradient id="journeyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="50%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}

type FilterTab = "all" | "instant" | "scheduled" | "favorites";

export function SessionHistory() {
  const navigate = useNavigate();
  const { session, profile } = useAuth();

  if (profile?.subscription_plan === 'trial') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-xl p-8 text-center max-w-md w-full"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5" />
          <div className="relative">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
              <Lock className="w-8 h-8 text-purple-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">
              Talking History is a Core Feature
            </h2>
            <p className="text-slate-400 mb-8">
              Upgrade to Core or Pro to unlock detailed talking logs and history.
            </p>
            <Button
              onClick={() => navigate('/app/billing')}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-full px-8"
            >
              View Plans
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState<"all" | "week" | "month" | "year">("all");
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

          const moods = ["Anxious", "Hopeful", "Emotional", "Grateful", "Calm", "Sad", "Happy"];
          const randomMood = s.config?.mood || moods[Math.floor(Math.random() * moods.length)];

          return {
            id: s.id,
            date: baseDate.toLocaleDateString('en-US', {
              month: 'short',
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
            thumbnail: CINEMATIC_THUMBNAILS[s.id.charCodeAt(0) % CINEMATIC_THUMBNAILS.length],
            summary: formatSessionSummaryTitle(s.title, s.type),
            favorite: s.is_favorite || false,
            status: s.status === 'completed' ? 'completed' : 'upcoming',
            recordingUrl: s.recording_url || undefined,
            isUpcoming: isFutureScheduled,
            avatarName: resolvedAvatar.name,
            avatarImage: resolvedAvatar.image,
            environmentLabel: formatEnvironmentLabel(s.config?.environment ?? profile?.selected_environment),
            sessionType: s.type,
            mood: randomMood,
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
  }, [session, profile?.selected_avatar, profile?.selected_environment]);

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
    sessionData: SessionData,
    messages?: { role: string; content: string; created_at?: string }[]
  ) => {
    let rows: { role: string; content: string; created_at?: string }[];
    if (messages !== undefined) {
      rows = messages;
    } else {
      try {
        rows = await api.sessions.getTranscript(sessionData.id);
      } catch {
        rows = [];
      }
    }

    const header = [
      `Session ID: ${sessionData.id}`,
      `Date: ${sessionData.date}`,
      `Duration: ${sessionData.duration}`,
      `Summary: ${sessionData.summary}`,
      "",
      "--- Transcript ---",
      "",
    ].join("\n");

    const body =
      rows.length > 0
        ? rows.map((m) => transcriptLine(m.role, m.content)).join("\n\n")
        : "(No messages stored for this session.)";

    const text = `${header}${body}`;
    const safeDate = sessionData.date.replace(/,?\s+/g, "-");
    downloadTextFile(`session-${sessionData.id}-${safeDate}-transcript.txt`, text);
  };

  const filteredSessions = useMemo(() => {
    let sessions = completedSessions;

    if (filterTab === "instant") {
      sessions = sessions.filter(s => s.sessionType === "instant");
    } else if (filterTab === "scheduled") {
      sessions = sessions.filter(s => s.sessionType === "scheduled");
    } else if (filterTab === "favorites") {
      sessions = sessions.filter(s => s.favorite);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      sessions = sessions.filter(s => 
        s.summary.toLowerCase().includes(q) ||
        s.topicsDiscussed.some(topic => topic.toLowerCase().includes(q))
      );
    }

    if (timeFilter !== "all") {
      const now = new Date();
      sessions = sessions.filter(s => {
        const sessionDate = new Date(s.date);
        const diffDays = Math.floor((now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));
        if (timeFilter === "week") return diffDays <= 7;
        if (timeFilter === "month") return diffDays <= 30;
        if (timeFilter === "year") return diffDays <= 365;
        return true;
      });
    }

    return sessions;
  }, [completedSessions, filterTab, searchQuery, timeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * pageSize;
  const paginatedSessions = filteredSessions.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterTab, searchQuery, timeFilter, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const totalDurationMinutes = completedSessions.reduce(
    (acc, s) => acc + s.durationMinutesForStats,
    0
  );
  const totalHours = (totalDurationMinutes / 60).toFixed(1);
  const totalMessages = completedSessions.reduce((acc, s) => acc + s.messagesCount, 0);

  const moodDistribution = useMemo(() => {
    const moodCounts: Record<string, number> = {};
    completedSessions.forEach(s => {
      const mood = s.mood || "Calm";
      moodCounts[mood] = (moodCounts[mood] || 0) + 1;
    });
    
    const total = completedSessions.length || 1;
    return [
      { name: "Positive", value: Math.round(((moodCounts["Happy"] || 0) + (moodCounts["Hopeful"] || 0) + (moodCounts["Grateful"] || 0)) / total * 100), color: "#4ade80" },
      { name: "Neutral", value: Math.round(((moodCounts["Calm"] || 0)) / total * 100), color: "#a78bfa" },
      { name: "Anxious", value: Math.round(((moodCounts["Anxious"] || 0)) / total * 100), color: "#fbbf24" },
      { name: "Sad", value: Math.round(((moodCounts["Sad"] || 0) + (moodCounts["Angry"] || 0) + (moodCounts["Emotional"] || 0)) / total * 100), color: "#f472b6" },
    ];
  }, [completedSessions]);

  const longestStreak = profile?.streak_days || 14;
  const currentYear = new Date().getFullYear();
  const journeyProgress = Math.min(100, Math.round((completedSessions.length / 200) * 100));

  if (isLoading) {
    return (
      <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-8 flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-8 w-48 rounded-lg bg-slate-800/50 animate-pulse" />
              <div className="h-4 w-72 rounded-lg bg-slate-800/30 animate-pulse" />
            </div>
            <div className="h-10 w-32 rounded-xl bg-slate-800/50 animate-pulse" />
          </div>
          <div className="h-56 w-full rounded-3xl bg-slate-800/30 animate-pulse mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-slate-800/30 animate-pulse" />
            ))}
          </div>
          <div className="flex flex-col xl:flex-row gap-6">
            <div className="flex-1 min-w-0 space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-28 rounded-2xl bg-slate-800/30 animate-pulse" />
              ))}
            </div>
            <div className="w-full xl:w-80 space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-48 rounded-2xl bg-slate-800/30 animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full blur-lg opacity-50" />
              <div className="relative w-10 h-10 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-purple-500/30">
                <Clock className="w-5 h-5 text-purple-400" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Talking History</h1>
              <p className="text-sm text-slate-400">
                Review your past talks and track your emotional growth.
              </p>
            </div>
          </div>
          <Link to="/app/session-lobby">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-medium hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/25"
            >
              <Plus className="w-4 h-4" />
              New Talk
            </motion.button>
          </Link>
        </motion.div>

        {/* Main Content Grid */}
        <div className="flex flex-col xl:flex-row gap-6">
          {/* Left Column - Main Content (72%) */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* Hero Banner */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="relative overflow-hidden rounded-3xl min-h-[200px]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/95 to-transparent z-10" />
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 400'%3E%3Cdefs%3E%3ClinearGradient id='sky' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%230f0a1e'/%3E%3Cstop offset='30%25' stop-color='%231a0a2e'/%3E%3Cstop offset='60%25' stop-color='%23581c87'/%3E%3Cstop offset='80%25' stop-color='%23831843'/%3E%3Cstop offset='100%25' stop-color='%23f59e0b'/%3E%3C/linearGradient%3E%3ClinearGradient id='water' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23581c87' stop-opacity='0.6'/%3E%3Cstop offset='100%25' stop-color='%230f172a'/%3E%3C/linearGradient%3E%3CradialGradient id='glow' cx='70%25' cy='60%25' r='40%25'%3E%3Cstop offset='0%25' stop-color='%23fbbf24' stop-opacity='0.4'/%3E%3Cstop offset='100%25' stop-color='%23581c87' stop-opacity='0'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect fill='url(%23sky)' width='800' height='400'/%3E%3Crect fill='url(%23glow)' width='800' height='400'/%3E%3Cpath d='M400,280 L500,180 L600,220 L700,160 L800,200 L800,280 Z' fill='%231e1b4b' opacity='0.9'/%3E%3Cpath d='M300,280 L400,200 L480,240 L550,190 L650,230 L800,180 L800,280 Z' fill='%23312e81' opacity='0.7'/%3E%3Cpath d='M500,280 L580,220 L650,250 L720,200 L800,240 L800,280 Z' fill='%23581c87' opacity='0.5'/%3E%3Crect y='280' width='800' height='120' fill='url(%23water)'/%3E%3Ccircle cx='650' cy='80' r='1.5' fill='white' opacity='0.8'/%3E%3Ccircle cx='700' cy='120' r='1' fill='white' opacity='0.6'/%3E%3Ccircle cx='580' cy='60' r='1' fill='white' opacity='0.7'/%3E%3Ccircle cx='750' cy='90' r='1.2' fill='white' opacity='0.5'/%3E%3Ccircle cx='620' cy='140' r='0.8' fill='white' opacity='0.6'/%3E%3C/svg%3E")`,
                  backgroundSize: "cover",
                  backgroundPosition: "right center",
                }}
              />
              <div className="relative z-20 px-8 py-10 flex items-center min-h-[200px]">
                <div className="max-w-md">
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 leading-tight">
                    Conversations you've carried through.{" "}
                    <span className="inline-block">💜</span>
                  </h2>
                  <p className="text-slate-300 text-sm md:text-base leading-relaxed">
                    Every talk is a step forward. Every word, a release.<br />
                    You're growing beautifully.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Summary Stats Cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
            >
              {/* Total Talks */}
              <div className="relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm p-5">
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-transparent" />
                <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-pink-400" />
                </div>
                <div className="relative">
                  <p className="text-xs text-slate-400 mb-1">Total Talks</p>
                  <p className="text-3xl font-bold text-white">{completedSessions.length}</p>
                  <p className="text-xs text-slate-500 mt-1">Sessions completed</p>
                </div>
              </div>

              {/* Total Time */}
              <div className="relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm p-5">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent" />
                <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-purple-400" />
                </div>
                <div className="relative">
                  <p className="text-xs text-slate-400 mb-1">Total Time</p>
                  <p className="text-3xl font-bold text-white">{totalHours}h</p>
                  <p className="text-xs text-slate-500 mt-1">Time spent talking</p>
                </div>
              </div>

              {/* Messages Saved */}
              <div className="relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm p-5">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent" />
                <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-cyan-400" />
                </div>
                <div className="relative">
                  <p className="text-xs text-slate-400 mb-1">Messages Saved</p>
                  <p className="text-3xl font-bold text-white">{totalMessages}</p>
                  <p className="text-xs text-slate-500 mt-1">Important messages</p>
                </div>
              </div>

              {/* Upcoming Talks */}
              <div className="relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm p-5">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent" />
                <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="relative">
                  <p className="text-xs text-slate-400 mb-1">Upcoming Talks</p>
                  <p className="text-3xl font-bold text-white">{upcomingSessions.length}</p>
                  <p className="text-xs text-slate-500 mt-1">{upcomingSessions.length > 0 ? "Scheduled sessions" : "None scheduled"}</p>
                </div>
              </div>
            </motion.div>

            {/* Filter Bar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-2 flex-wrap">
                {(["all", "instant", "scheduled", "favorites"] as FilterTab[]).map((tab) => (
                  <motion.button
                    key={tab}
                    onClick={() => setFilterTab(tab)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium transition-all",
                      filterTab === tab
                        ? "bg-gradient-to-r from-purple-600/80 to-pink-600/80 text-white shadow-lg shadow-purple-500/20"
                        : "bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50"
                    )}
                  >
                    {tab === "all" && "All Talks"}
                    {tab === "instant" && "Instant Talks"}
                    {tab === "scheduled" && "Scheduled Talks"}
                    {tab === "favorites" && (
                      <span className="flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5" />
                        Favorites
                      </span>
                    )}
                  </motion.button>
                ))}
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative">
                  <button
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-sm text-slate-300 hover:bg-slate-700/50 transition-all"
                  >
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>{timeFilter === "all" ? "All Time" : timeFilter === "week" ? "This Week" : timeFilter === "month" ? "This Month" : "This Year"}</span>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search talks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent text-sm"
                  />
                </div>
              </div>
            </motion.div>

            {/* Session List */}
            <div className="space-y-4">
              {filteredSessions.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm p-12 text-center"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5" />
                  <div className="relative">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800/50 flex items-center justify-center">
                      <Calendar className="w-8 h-8 text-slate-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">No Talks Found</h3>
                    <p className="text-slate-400 mb-6">
                      {filterTab === "favorites"
                        ? "You haven't favorited any talks yet"
                        : "Try adjusting your filters or start a new talk"}
                    </p>
                    <Link to="/app/session-lobby">
                      <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-full px-6">
                        Start a New Talk
                      </Button>
                    </Link>
                  </div>
                </motion.div>
              ) : (
                paginatedSessions.map((sessionItem, index) => (
                  <motion.div
                    key={sessionItem.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index, 5) * 0.05 }}
                    className="group relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm hover:border-purple-500/30 transition-all cursor-pointer"
                    onClick={() => setSelectedSession(sessionItem)}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative flex items-center gap-4 p-4">
                      {/* Cinematic Thumbnail */}
                      <div
                        className="relative w-36 h-20 sm:w-40 sm:h-24 rounded-xl overflow-hidden flex-shrink-0"
                        style={{ background: sessionItem.thumbnail }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSession(sessionItem);
                          }}
                          className="absolute inset-0 flex items-center justify-center"
                        >
                          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                            <Play className="w-4 h-4 text-white ml-0.5" />
                          </div>
                        </motion.button>
                        {sessionItem.favorite && (
                          <div className="absolute top-2 right-2">
                            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white mb-1 truncate">{sessionItem.summary}</h3>
                        <p className="text-sm text-slate-400 mb-2 line-clamp-1">
                          You opened up about feeling overwhelmed and anxious.
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800/80 text-slate-300">
                            {sessionItem.sessionType === "scheduled" ? "Scheduled Talk" : "Instant Talk"}
                          </span>
                          {sessionItem.mood && (
                            <span className={cn(
                              "px-2.5 py-1 rounded-full text-xs font-medium",
                              MOOD_COLORS[sessionItem.mood]?.bg || "bg-slate-800/80",
                              MOOD_COLORS[sessionItem.mood]?.text || "text-slate-300"
                            )}>
                              {sessionItem.mood}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Meta & Actions */}
                      <div className="flex items-center gap-6 flex-shrink-0">
                        <div className="hidden sm:flex items-center gap-4 text-sm text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4" />
                            <span>{sessionItem.date}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4" />
                            <span>{sessionItem.duration}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MessageSquare className="w-4 h-4" />
                            <span>{sessionItem.messagesCount}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => handleToggleFavorite(sessionItem.id, e)}
                            className={cn(
                              "p-2 rounded-lg transition-all",
                              sessionItem.favorite
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "bg-slate-800/50 text-slate-500 hover:text-yellow-400 hover:bg-slate-700/50"
                            )}
                          >
                            <Star className={cn("w-4 h-4", sessionItem.favorite && "fill-current")} />
                          </motion.button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleExportSession(sessionItem);
                            }}
                            className="p-2 rounded-lg bg-slate-800/50 text-slate-500 hover:text-white hover:bg-slate-700/50 transition-all"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Pagination */}
            {filteredSessions.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="overflow-hidden rounded-xl border border-slate-800/50 bg-slate-900/50"
              >
                <AdminPaginationBar
                  total={filteredSessions.length}
                  page={currentPage}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                  selectId="session-history-page-size"
                  pageSizeOptions={[5, 10, 20, 50]}
                />
              </motion.div>
            )}
          </div>

          {/* Right Insight Rail (28%) */}
          <div className="w-full xl:w-80 2xl:w-96 flex-shrink-0 space-y-6 xl:sticky xl:top-6 xl:self-start">
            {/* Your Journey So Far */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm"
            >
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Cdefs%3E%3ClinearGradient id='bg' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%230a0a1a'/%3E%3Cstop offset='100%25' stop-color='%231a0a2e'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23bg)' width='400' height='300'/%3E%3Ccircle cx='350' cy='50' r='3' fill='white' opacity='0.3'/%3E%3Ccircle cx='320' cy='80' r='2' fill='white' opacity='0.2'/%3E%3Ccircle cx='370' cy='100' r='1.5' fill='white' opacity='0.4'/%3E%3C/svg%3E")`,
                  backgroundSize: "cover",
                }}
              />
              <div className="relative p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-semibold text-white">Your Journey So Far</h3>
                  <span className="text-xs text-slate-400">This Year</span>
                </div>

                <div className="flex flex-col items-center">
                  <CircularProgress value={journeyProgress} size={160} strokeWidth={12}>
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500/30 to-purple-500/30 flex items-center justify-center mb-1">
                      <Heart className="w-7 h-7 text-pink-400" />
                    </div>
                  </CircularProgress>
                  <div className="text-center mt-4">
                    <p className="text-sm text-slate-400">You've had</p>
                    <p className="text-3xl font-bold text-white">{completedSessions.length}</p>
                    <p className="text-sm text-slate-300">talks this year</p>
                  </div>
                  <p className="text-xs text-slate-500 mt-3 text-center">
                    Keep going! You're doing amazing.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Mood Distribution */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm p-6"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white">Mood Distribution</h3>
                  <span className="text-xs text-slate-400">This Year</span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-28 h-28 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={moodDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={30}
                          outerRadius={45}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {moodDistribution.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={entry.color}
                              style={{ filter: `drop-shadow(0 0 4px ${entry.color}40)` }}
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex-1 space-y-2">
                    {moodDistribution.map((mood) => (
                      <div key={mood.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: mood.color }}
                          />
                          <span className="text-slate-400">{mood.name}</span>
                        </div>
                        <span className="text-white font-medium">{mood.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Longest Streak */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="relative overflow-hidden rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-900/20 via-slate-900/80 to-slate-900/90 backdrop-blur-sm p-6"
            >
              <div className="absolute top-0 left-0 w-24 h-24 bg-gradient-radial from-orange-500/20 via-orange-500/5 to-transparent rounded-full blur-xl" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-4">
                  <Flame className="w-5 h-5 text-orange-400" />
                  <h3 className="font-semibold text-white">Longest Streak</h3>
                </div>

                <div className="mb-4">
                  <p className="text-4xl font-bold text-white">{longestStreak} days</p>
                  <p className="text-sm text-slate-400">Your best talk streak</p>
                </div>

                <div className="flex items-center gap-1.5">
                  {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => {
                    const isActive = i < (longestStreak % 7) || longestStreak >= 7;
                    return (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all",
                            isActive
                              ? "bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30"
                              : "bg-slate-800/50 text-slate-500"
                          )}
                        >
                          {isActive ? "✓" : day}
                        </div>
                        <span className="text-[10px] text-slate-500">{day}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
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
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-2xl z-50"
            >
              <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/95 backdrop-blur-xl max-h-[90vh] overflow-y-auto">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5" />
                
                {/* Modal Header */}
                <div className="relative px-6 pt-6 pb-4 border-b border-slate-800/50">
                  <button
                    onClick={() => setSelectedSession(null)}
                    className="absolute top-4 right-4 p-2 rounded-lg bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <h2 className="text-xl font-bold text-white">Talk Details</h2>
                </div>

                <div className="relative p-6 space-y-6">
                  {/* Session Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
                      <p className="text-xs text-slate-500 mb-1">Date</p>
                      <p className="text-sm font-medium text-white">{selectedSession.date}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
                      <p className="text-xs text-slate-500 mb-1">Time</p>
                      <p className="text-sm font-medium text-white">{selectedSession.timeLabel}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
                      <p className="text-xs text-slate-500 mb-1">Duration</p>
                      <p className="text-sm font-medium text-white">{selectedSession.duration}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
                      <p className="text-xs text-slate-500 mb-1">Messages</p>
                      <p className="text-sm font-medium text-white">{selectedSession.messagesCount}</p>
                    </div>
                  </div>

                  {/* Summary */}
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-2">Summary</h3>
                    <p className="text-sm text-slate-400">{selectedSession.summary}</p>
                  </div>

                  {/* Transcript */}
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-3">Transcript</h3>
                    <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 p-4 max-h-64 overflow-y-auto space-y-3">
                      {loadingTranscript ? (
                        <p className="text-sm text-slate-500 text-center py-4">Loading transcript...</p>
                      ) : transcript.length > 0 ? (
                        transcript.map((msg, i) => {
                          const isUser = msg.role?.toLowerCase() === "user";
                          return (
                            <div key={i} className={cn("flex gap-3", isUser && "flex-row-reverse")}>
                              <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium",
                                isUser 
                                  ? "bg-gradient-to-br from-purple-500 to-pink-500 text-white" 
                                  : "bg-slate-700 text-slate-300"
                              )}>
                                {isUser ? "U" : "E"}
                              </div>
                              <div className={cn(
                                "p-3 rounded-xl max-w-[80%] text-sm",
                                isUser 
                                  ? "bg-purple-500/20 text-purple-100" 
                                  : "bg-slate-700/50 text-slate-300"
                              )}>
                                <p>{msg.content}</p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-slate-500 text-center py-4 italic">
                          No transcript available for this talk.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={() => void handleExportSession(selectedSession, transcript)}
                      variant="outline"
                      className="flex-1 bg-slate-800/50 border-slate-700/50 text-white hover:bg-slate-700/50 rounded-xl"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export Transcript
                    </Button>
                    <Button
                      onClick={(e) => handleToggleFavorite(selectedSession.id, e)}
                      variant="outline"
                      className={cn(
                        "bg-slate-800/50 border-slate-700/50 rounded-xl",
                        selectedSession.favorite 
                          ? "text-yellow-400 border-yellow-500/30" 
                          : "text-white hover:bg-slate-700/50"
                      )}
                    >
                      <Star className={cn("w-4 h-4", selectedSession.favorite && "fill-current")} />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
