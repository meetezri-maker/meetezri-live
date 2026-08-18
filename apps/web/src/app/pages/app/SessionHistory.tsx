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
import { pickSolaceCinematicImage } from "@/lib/solace/solaceCinematicPool";
import { SolaceSelect } from "@/app/solace";
import {
  modalOverlay,
  modalPanelLg,
  modalPanelHeader,
  modalPanelBody,
  modalTitle,
  modalCloseButton,
  modalInsetPanel,
  modalLabel,
  modalSectionTitle,
  modalBodyText,
  modalMutedText,
  modalEmphasisText,
  modalPrimaryButton,
  modalSecondaryButton,
} from "@/lib/modalTheme";
import {
  deriveSessionSummaryFromTranscript,
  formatTranscriptLine,
} from "@meetezri/shared";

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
  /** Display title (e.g. Instant Talk) */
  title: string;
  /** Stored session summary from config, if any */
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
  /** ISO timestamp for filters and insight cards */
  occurredAt: string;
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
    summary?: string;
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

const SESSION_HISTORY_HERO_IMG = "/session/talking-history.jpg";

const MOOD_COLORS: Record<string, string> = {
  Anxious: "session-history-mood-pill session-history-mood-pill--amber",
  Hopeful: "session-history-mood-pill session-history-mood-pill--emerald",
  Emotional: "session-history-mood-pill session-history-mood-pill--pink",
  Grateful: "session-history-mood-pill session-history-mood-pill--purple",
  Calm: "session-history-mood-pill session-history-mood-pill--cyan",
  Sad: "session-history-mood-pill session-history-mood-pill--blue",
  Happy: "session-history-mood-pill session-history-mood-pill--green",
  Angry: "session-history-mood-pill session-history-mood-pill--red",
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
type TimePeriod = "all" | "week" | "month" | "year";

const TIME_PERIOD_OPTIONS: { value: TimePeriod; label: string }[] = [
  { value: "all", label: "All Time" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
];

function sessionWithinPeriod(occurredAt: string, period: TimePeriod): boolean {
  if (period === "all") return true;
  const sessionMs = new Date(occurredAt).getTime();
  if (!Number.isFinite(sessionMs)) return true;
  const diffDays = Math.floor((Date.now() - sessionMs) / (1000 * 60 * 60 * 24));
  if (period === "week") return diffDays <= 7;
  if (period === "month") return diffDays <= 30;
  if (period === "year") return diffDays <= 365;
  return true;
}

function periodTalkSuffix(period: TimePeriod): string {
  if (period === "week") return "talks this week";
  if (period === "month") return "talks this month";
  if (period === "year") return "talks this year";
  return "talks total";
}

interface SessionHistoryPeriodSelectProps {
  value: TimePeriod;
  onValueChange: (value: TimePeriod) => void;
  id: string;
  ariaLabel: string;
}

function SessionHistoryPeriodSelect({
  value,
  onValueChange,
  id,
  ariaLabel,
}: SessionHistoryPeriodSelectProps) {
  return (
    <SolaceSelect
      id={id}
      value={value}
      onValueChange={(v) => onValueChange(v as TimePeriod)}
      ariaLabel={ariaLabel}
      variant="compact"
      triggerClassName="min-w-[6.75rem] shrink-0"
      contentClassName="z-[400]"
      options={TIME_PERIOD_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
    />
  );
}

export function SessionHistory() {
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const isTrialUser = profile?.subscription_plan === "trial";

  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState<TimePeriod>("year");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  const [completedSessions, setCompletedSessions] = useState<SessionData[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<SessionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [transcript, setTranscript] = useState<
    { role: string; content: string; created_at?: string }[]
  >([]);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);

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
    if (!selectedSession) {
      setGeneratedSummary("");
      setLoadingSummary(false);
      return;
    }

    let cancelled = false;
    const stored = selectedSession.summary.trim();
    const isWeakStoredSummary =
      !stored ||
      stored.length < 30 ||
      /^(instant talk|scheduled talk|talking|new session)$/i.test(stored);

    if (stored && !isWeakStoredSummary) {
      setGeneratedSummary(stored);
      setLoadingSummary(false);
      return;
    }

    const fetchSummary = async () => {
      setLoadingSummary(true);
      try {
        const result = await api.sessions.getSummary(selectedSession.id);
        if (cancelled) return;
        const text = result.summary?.trim() ?? "";
        if (!text) return;

        setGeneratedSummary(text);
        const patchSummary = (sessions: SessionData[]) =>
          sessions.map((s) => (s.id === selectedSession.id ? { ...s, summary: text } : s));
        setCompletedSessions(patchSummary);
        setUpcomingSessions(patchSummary);
        setSelectedSession((prev) => (prev ? { ...prev, summary: text } : prev));
      } catch (error) {
        console.error("Failed to fetch session summary", error);
      } finally {
        if (!cancelled) setLoadingSummary(false);
      }
    };

    void fetchSummary();
    return () => {
      cancelled = true;
    };
  }, [selectedSession?.id, selectedSession?.summary]);

  useEffect(() => {
    if (isTrialUser) {
      setIsLoading(false);
      return;
    }

    const fetchSessions = async () => {
      if (!session?.access_token) {
        setIsLoading(false);
        return;
      }

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
            thumbnail: pickSolaceCinematicImage(s.id),
            title: formatSessionSummaryTitle(s.title, s.type),
            summary:
              typeof s.config?.summary === "string" ? s.config.summary.trim() : "",
            favorite: s.is_favorite || false,
            status: s.status === 'completed' ? 'completed' : 'upcoming',
            recordingUrl: s.recording_url || undefined,
            isUpcoming: isFutureScheduled,
            avatarName: resolvedAvatar.name,
            avatarImage: resolvedAvatar.image,
            environmentLabel: formatEnvironmentLabel(s.config?.environment ?? profile?.selected_environment),
            sessionType: s.type,
            mood: randomMood,
            occurredAt: baseDate.toISOString(),
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
  }, [session, profile?.selected_avatar, profile?.selected_environment, isTrialUser]);

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

    let summaryText = sessionData.summary.trim();
    const isWeakSummary =
      !summaryText ||
      summaryText.length < 30 ||
      /^(instant talk|scheduled talk|talking|new session)$/i.test(summaryText);

    if (isWeakSummary) {
      try {
        const result = await api.sessions.getSummary(sessionData.id);
        summaryText = result.summary?.trim() ?? summaryText;
      } catch {
        // fall through to heuristic
      }
    }
    if (!summaryText && rows.length > 0) {
      summaryText = deriveSessionSummaryFromTranscript(rows);
    }

    const header = [
      `Session ID: ${sessionData.id}`,
      `Date: ${sessionData.date}`,
      `Duration: ${sessionData.duration}`,
      `Title: ${sessionData.title}`,
      `Summary: ${summaryText || "No summary available."}`,
      "",
      "--- Transcript ---",
      "",
    ].join("\n");

    const body =
      rows.length > 0
        ? rows.map((m) => formatTranscriptLine(m.role, m.content)).join("\n\n")
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
        s.title.toLowerCase().includes(q) ||
        s.summary.toLowerCase().includes(q) ||
        s.topicsDiscussed.some(topic => topic.toLowerCase().includes(q))
      );
    }

    if (timeFilter !== "all") {
      sessions = sessions.filter((s) => sessionWithinPeriod(s.occurredAt, timeFilter));
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

  const sessionsInPeriod = useMemo(
    () => completedSessions.filter((s) => sessionWithinPeriod(s.occurredAt, timeFilter)),
    [completedSessions, timeFilter],
  );

  const moodDistribution = useMemo(() => {
    const moodCounts: Record<string, number> = {};
    sessionsInPeriod.forEach((s) => {
      const mood = s.mood || "Calm";
      moodCounts[mood] = (moodCounts[mood] || 0) + 1;
    });

    const total = sessionsInPeriod.length || 1;
    return [
      { name: "Positive", value: Math.round(((moodCounts["Happy"] || 0) + (moodCounts["Hopeful"] || 0) + (moodCounts["Grateful"] || 0)) / total * 100), color: "#4ade80" },
      { name: "Neutral", value: Math.round(((moodCounts["Calm"] || 0)) / total * 100), color: "#a78bfa" },
      { name: "Anxious", value: Math.round(((moodCounts["Anxious"] || 0)) / total * 100), color: "#fbbf24" },
      { name: "Sad", value: Math.round(((moodCounts["Sad"] || 0) + (moodCounts["Angry"] || 0) + (moodCounts["Emotional"] || 0)) / total * 100), color: "#f472b6" },
    ];
  }, [sessionsInPeriod]);

  const longestStreak = profile?.streak_days || 14;
  const journeyProgress = Math.min(100, Math.round((sessionsInPeriod.length / 200) * 100));

  const selectedSessionSummary = useMemo(() => {
    if (generatedSummary.trim()) return generatedSummary;
    if (transcript.length > 0) return deriveSessionSummaryFromTranscript(transcript);
    return "";
  }, [generatedSummary, transcript]);

  if (isTrialUser) {
    return (
      <div className="session-history-page min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="session-history-gate-card relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-xl p-8 text-center max-w-md w-full"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5" />
          <div className="relative">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
              <Lock className="w-8 h-8 text-purple-400" />
            </div>
            <h2 className="session-history-gate-title text-2xl font-bold text-white mb-3">
              Talking history is part of Grow
            </h2>
            <p className="session-history-gate-lead text-slate-400 mb-8">
              Upgrade to Grow or Thrive to see your talking history in detail. Your past conversations are already saved.
            </p>
            <Button
              onClick={() => navigate("/app/billing")}
              className="session-history-btn-primary bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-full px-8"
            >Upgrade membership</Button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="session-history-page min-h-screen px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-8 flex items-center justify-between">
            <div className="space-y-2">
              <div className="session-history-skeleton h-8 w-48 rounded-lg bg-slate-800/50 animate-pulse" />
              <div className="session-history-skeleton h-4 w-72 rounded-lg bg-slate-800/30 animate-pulse" />
            </div>
            <div className="session-history-skeleton h-10 w-32 rounded-xl bg-slate-800/50 animate-pulse" />
          </div>
          <div className="session-history-skeleton h-56 w-full rounded-3xl bg-slate-800/30 animate-pulse mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="session-history-skeleton h-28 rounded-2xl bg-slate-800/30 animate-pulse" />
            ))}
          </div>
          <div className="flex flex-col xl:flex-row gap-6">
            <div className="flex-1 min-w-0 space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="session-history-skeleton h-28 rounded-2xl bg-slate-800/30 animate-pulse" />
              ))}
            </div>
            <div className="w-full xl:w-80 space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="session-history-skeleton h-48 rounded-2xl bg-slate-800/30 animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="session-history-page min-h-screen px-4 py-6 sm:px-6 lg:px-8">
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
              <div className="session-history-header-icon-wrap relative w-10 h-10 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-purple-500/30">
                <Clock className="w-5 h-5 text-purple-400" />
              </div>
            </div>
            <div>
              <h1 className="session-history-page-title text-2xl font-bold text-white">Talking History</h1>
              <p className="session-history-page-lead text-sm text-slate-400">
                Review your past talks and track your emotional growth.
              </p>
            </div>
          </div>
          <Link to="/app/session-lobby">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="session-history-btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-medium hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/25"
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
              className="session-history-hero relative overflow-hidden rounded-3xl min-h-[200px] border border-slate-800/50"
            >
              <div className="absolute inset-0" aria-hidden>
                <img
                  src={SESSION_HISTORY_HERO_IMG}
                  alt=""
                  className="h-full w-full object-cover object-center"
                  loading="eager"
                  decoding="async"
                />
                <div className="session-history-hero-scrim absolute inset-0" />
                <div className="session-history-hero-scrim-v absolute inset-0" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(168,85,247,0.12),transparent_55%)]" />
              </div>
              <div className="relative z-10 px-8 py-10 flex items-center min-h-[200px]">
                <div className="max-w-md">
                  <h2 className="session-history-hero-title text-2xl md:text-3xl font-bold text-white mb-3 leading-tight">
                    Conversations you've carried through.{" "}
                    <span className="inline-block">💜</span>
                  </h2>
                  <p className="session-history-hero-lead text-slate-300 text-sm md:text-base leading-relaxed">
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
              <div className="session-history-stat-card relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm p-5">
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-transparent" />
                <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-pink-400" />
                </div>
                <div className="relative">
                  <p className="session-history-stat-label text-xs text-slate-400 mb-1">Total Talks</p>
                  <p className="session-history-stat-value text-3xl font-bold text-white">{completedSessions.length}</p>
                  <p className="session-history-stat-meta text-xs text-slate-500 mt-1">Sessions completed</p>
                </div>
              </div>

              {/* Total Time */}
              <div className="session-history-stat-card relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm p-5">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent" />
                <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-purple-400" />
                </div>
                <div className="relative">
                  <p className="session-history-stat-label text-xs text-slate-400 mb-1">Total Time</p>
                  <p className="session-history-stat-value text-3xl font-bold text-white">{totalHours}h</p>
                  <p className="session-history-stat-meta text-xs text-slate-500 mt-1">Time spent talking</p>
                </div>
              </div>

              {/* Messages Saved */}
              <div className="session-history-stat-card relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm p-5">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent" />
                <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-cyan-400" />
                </div>
                <div className="relative">
                  <p className="session-history-stat-label text-xs text-slate-400 mb-1">Messages Saved</p>
                  <p className="session-history-stat-value text-3xl font-bold text-white">{totalMessages}</p>
                  <p className="session-history-stat-meta text-xs text-slate-500 mt-1">Important messages</p>
                </div>
              </div>

              {/* Upcoming Talks */}
              <div className="session-history-stat-card relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm p-5">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent" />
                <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="relative">
                  <p className="session-history-stat-label text-xs text-slate-400 mb-1">Upcoming Talks</p>
                  <p className="session-history-stat-value text-3xl font-bold text-white">{upcomingSessions.length}</p>
                  <p className="session-history-stat-meta text-xs text-slate-500 mt-1">{upcomingSessions.length > 0 ? "Scheduled sessions" : "None scheduled"}</p>
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
                        ? "session-history-filter-btn--active bg-gradient-to-r from-purple-600/80 to-pink-600/80 text-white shadow-lg shadow-purple-500/20"
                        : "session-history-filter-btn--inactive bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50"
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
                <SessionHistoryPeriodSelect
                  id="session-history-list-period"
                  value={timeFilter}
                  onValueChange={setTimeFilter}
                  ariaLabel="Filter talks by time period"
                />

                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search talks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="session-history-search w-full pl-10 pr-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent text-sm"
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
                  className="session-history-empty relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm p-12 text-center"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5" />
                  <div className="relative">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800/50 flex items-center justify-center">
                      <Calendar className="w-8 h-8 text-slate-600" />
                    </div>
                    <h3 className="session-history-panel-title text-lg font-semibold text-white mb-2">No Talks Found</h3>
                    <p className="session-history-panel-lead text-slate-400 mb-6">
                      {filterTab === "favorites"
                        ? "You haven't favorited any talks yet"
                        : "Try adjusting your filters or start a new talk"}
                    </p>
                    <Link to="/app/session-lobby">
                      <Button className="session-history-btn-primary bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-full px-6">
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
                    className="session-history-row group relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm hover:border-purple-500/30 transition-all cursor-pointer"
                    onClick={() => setSelectedSession(sessionItem)}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative flex items-center gap-4 p-4">
                      {/* Cinematic Thumbnail */}
                      <div className="relative h-20 w-36 shrink-0 overflow-hidden rounded-xl sm:h-24 sm:w-40">
                        <img
                          src={sessionItem.thumbnail}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
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
                        <h3 className="session-history-row-title font-semibold text-white mb-1 truncate">{sessionItem.title}</h3>
                        <p className="session-history-row-preview text-sm text-slate-400 mb-2 line-clamp-1">
                          {sessionItem.summary ||
                            (sessionItem.messagesCount > 0
                              ? `${sessionItem.messagesCount} messages — open to view summary`
                              : "Open to view talk details")}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="session-history-type-pill px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800/80 text-slate-300">
                            {sessionItem.sessionType === "scheduled" ? "Scheduled Talk" : "Instant Talk"}
                          </span>
                          {sessionItem.mood && (
                            <span className={cn(
                              MOOD_COLORS[sessionItem.mood] || "session-history-type-pill"
                            )}>
                              {sessionItem.mood}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Meta & Actions */}
                      <div className="flex items-center gap-6 flex-shrink-0">
                        <div className="session-history-row-meta hidden sm:flex items-center gap-4 text-sm text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4" />
                            <span>{sessionItem.date}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4" />
                            <span>{sessionItem.duration}</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleExportSession(sessionItem);
                            }}
                            className="session-history-row-action flex items-center gap-1.5 rounded-lg p-1 text-slate-400 transition-all hover:bg-slate-700/50 hover:text-white"
                            aria-label="Download transcript"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => handleToggleFavorite(sessionItem.id, e)}
                            className={cn(
                              "session-history-row-action p-2 rounded-lg transition-all",
                              sessionItem.favorite
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "bg-slate-800/50 text-slate-500 hover:text-yellow-400 hover:bg-slate-700/50"
                            )}
                          >
                            <Star className={cn("w-4 h-4", sessionItem.favorite && "fill-current")} />
                          </motion.button>
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
                className="session-history-pagination rounded-xl border border-slate-800/50 bg-slate-900/50"
              >
                <AdminPaginationBar
                  variant="solace"
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
              className="session-history-panel relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm"
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-30"
                aria-hidden
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Cdefs%3E%3ClinearGradient id='bg' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%230a0a1a'/%3E%3Cstop offset='100%25' stop-color='%231a0a2e'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23bg)' width='400' height='300'/%3E%3Ccircle cx='350' cy='50' r='3' fill='white' opacity='0.3'/%3E%3Ccircle cx='320' cy='80' r='2' fill='white' opacity='0.2'/%3E%3Ccircle cx='370' cy='100' r='1.5' fill='white' opacity='0.4'/%3E%3C/svg%3E")`,
                  backgroundSize: "cover",
                }}
              />
              <div className="relative z-10 p-6">
                <div className="mb-6 flex items-center justify-between gap-3">
                  <h3 className="session-history-panel-title font-semibold text-white">Your Journey So Far</h3>
                  <SessionHistoryPeriodSelect
                    id="session-history-journey-period"
                    value={timeFilter}
                    onValueChange={setTimeFilter}
                    ariaLabel="Journey time period"
                  />
                </div>

                <div className="flex flex-col items-center">
                  <CircularProgress value={journeyProgress} size={160} strokeWidth={12}>
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500/30 to-purple-500/30 flex items-center justify-center mb-1">
                      <Heart className="w-7 h-7 text-pink-400" />
                    </div>
                  </CircularProgress>
                  <div className="text-center mt-4">
                    <p className="session-history-journey-sub text-sm text-slate-400">You've had</p>
                    <p className="session-history-journey-count text-3xl font-bold text-white">{sessionsInPeriod.length}</p>
                    <p className="session-history-journey-sub text-sm text-slate-300">{periodTalkSuffix(timeFilter)}</p>
                  </div>
                  <p className="session-history-journey-hint text-xs text-slate-500 mt-3 text-center">
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
              className="session-history-panel relative overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-sm p-6"
            >
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5"
                aria-hidden
              />
              <div className="relative z-10">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="session-history-panel-title font-semibold text-white">Mood Distribution</h3>
                  <SessionHistoryPeriodSelect
                    id="session-history-mood-period"
                    value={timeFilter}
                    onValueChange={setTimeFilter}
                    ariaLabel="Mood distribution time period"
                  />
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
                          <span className="session-history-mood-row-label text-slate-400">{mood.name}</span>
                        </div>
                        <span className="session-history-mood-row-value text-white font-medium">{mood.value}%</span>
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
              className="session-history-streak-panel relative overflow-hidden rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-900/20 via-slate-900/80 to-slate-900/90 backdrop-blur-sm p-6"
            >
              <div
                className="pointer-events-none absolute top-0 left-0 h-24 w-24 rounded-full bg-gradient-radial from-orange-500/20 via-orange-500/5 to-transparent blur-xl"
                aria-hidden
              />
              <div className="relative z-10">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-orange-400" />
                    <h3 className="session-history-panel-title font-semibold text-white">Longest Streak</h3>
                  </div>
                  <SessionHistoryPeriodSelect
                    id="session-history-streak-period"
                    value={timeFilter}
                    onValueChange={setTimeFilter}
                    ariaLabel="Streak time period"
                  />
                </div>

                <div className="mb-4">
                  <p className="session-history-streak-value text-4xl font-bold text-white">{longestStreak} days</p>
                  <p className="session-history-panel-lead text-sm text-slate-400">Your best talk streak</p>
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
                              : "session-history-streak-day--inactive bg-slate-800/50 text-slate-500"
                          )}
                        >
                          {isActive ? "✓" : day}
                        </div>
                        <span className="session-history-streak-day-label text-[10px] text-slate-500">{day}</span>
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(modalOverlay, "z-50")}
            onClick={() => setSelectedSession(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={cn(modalPanelLg, "relative max-h-[90vh] overflow-y-auto")}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={modalPanelHeader}>
                <button
                  type="button"
                  onClick={() => setSelectedSession(null)}
                  className={cn(modalCloseButton, "absolute top-4 right-4")}
                  aria-label="Close talk details"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <h2 className={modalTitle}>Talk Details</h2>
              </div>

              <div className={modalPanelBody}>
                <div className="grid grid-cols-2 gap-4">
                  <div className={modalInsetPanel}>
                    <p className={modalLabel}>Date</p>
                    <p className={cn(modalEmphasisText, "text-sm")}>{selectedSession.date}</p>
                  </div>
                  <div className={modalInsetPanel}>
                    <p className={modalLabel}>Time</p>
                    <p className={cn(modalEmphasisText, "text-sm")}>{selectedSession.timeLabel}</p>
                  </div>
                  <div className={modalInsetPanel}>
                    <p className={modalLabel}>Duration</p>
                    <p className={cn(modalEmphasisText, "text-sm")}>{selectedSession.duration}</p>
                  </div>
                  <div className={modalInsetPanel}>
                    <p className={modalLabel}>Messages</p>
                    <p className={cn(modalEmphasisText, "text-sm")}>{selectedSession.messagesCount}</p>
                  </div>
                </div>

                <div>
                  <h3 className={cn(modalSectionTitle, "mb-2")}>Summary</h3>
                  {loadingSummary || (loadingTranscript && !selectedSessionSummary) ? (
                    <p className={cn(modalMutedText, "text-sm")}>Analyzing your talk…</p>
                  ) : selectedSessionSummary ? (
                    <p className={modalBodyText}>{selectedSessionSummary}</p>
                  ) : (
                    <p className={cn(modalMutedText, "text-sm italic")}>
                      No summary available for this talk.
                    </p>
                  )}
                </div>

                <div>
                  <h3 className={cn(modalSectionTitle, "mb-3")}>Transcript</h3>
                  <div className={cn(modalInsetPanel, "max-h-64 overflow-y-auto space-y-3")}>
                    {loadingTranscript ? (
                      <p className={cn(modalMutedText, "text-sm text-center py-4")}>Loading transcript...</p>
                    ) : transcript.length > 0 ? (
                      transcript.map((msg, i) => {
                        const isUser = msg.role?.toLowerCase() === "user";
                        return (
                          <div key={i} className={cn("flex gap-3", isUser && "flex-row-reverse")}>
                            <div
                              className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium",
                                isUser
                                  ? "session-history-transcript-avatar-user bg-gradient-to-br from-purple-500 to-pink-500 text-white"
                                  : "session-history-transcript-avatar-assistant bg-slate-700 text-slate-300"
                              )}
                            >
                              {isUser ? "U" : "S"}
                            </div>
                            <div
                              className={cn(
                                "p-3 rounded-xl max-w-[80%] text-sm",
                                isUser
                                  ? "session-history-transcript-user bg-purple-500/20 text-purple-100"
                                  : "session-history-transcript-assistant bg-slate-700/50 text-slate-300"
                              )}
                            >
                              <p>{msg.content}</p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className={cn(modalMutedText, "text-sm text-center py-4 italic")}>
                        No transcript available for this talk.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={() => void handleExportSession(selectedSession, transcript)}
                    variant="outline"
                    className={cn(modalPrimaryButton, "flex-1 rounded-xl")}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Transcript
                  </Button>
                  <Button
                    onClick={(e) => handleToggleFavorite(selectedSession.id, e)}
                    variant="outline"
                    className={cn(
                      modalSecondaryButton,
                      "rounded-xl",
                      selectedSession.favorite && "text-yellow-600 border-yellow-500/40"
                    )}
                  >
                    <Star className={cn("w-4 h-4", selectedSession.favorite && "fill-current")} />
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
