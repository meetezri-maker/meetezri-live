import { AppLayout } from "../../components/AppLayout";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import {
  Video,
  Calendar,
  Clock,
  Sparkles,
  CheckCircle,
  User,
  Volume2,
  Settings,
  ArrowRight,
  Play,
  X,
  Check,
  Palette,
  Loader2,
} from "lucide-react";
import { useMemo, useState, useEffect, useRef } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Skeleton } from "../../components/ui/skeleton";
import { preloadAvatarModel } from "@/lib/avatar/preloadAvatarModel";
import {
  companionSessionUses3dModel,
  resolveCompanionModelUrl,
} from "@/lib/avatar/companionModelUrl";
import { LOBBY_AVATARS, lobbyAvatarByName, lobbyAvatarsFromApiRows } from "@/lib/avatar/lobbyAvatars";

interface BackendSession {
  id: string;
  status: string;
  type: string;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  config: any;
  created_at: string;
}

interface UpcomingSession {
  id: string;
  avatarName: string;
  avatarImage?: string;
  type: string;
  date: string;
  duration: string;
  isExpired: boolean;
  scheduledAt: string | null;
  durationMinutes: number | null;
}

const SESSION_ENVIRONMENTS = [
  { value: "beach", label: "Beach Sunset", emoji: "🏖️", gradient: "from-orange-300 to-blue-400" },
  { value: "forest", label: "Peaceful Forest", emoji: "🌲", gradient: "from-green-400 to-emerald-600" },
  { value: "mountains", label: "Mountain View", emoji: "⛰️", gradient: "from-blue-300 to-purple-400" },
  { value: "space", label: "Starry Night", emoji: "🌌", gradient: "from-indigo-500 to-purple-900" },
  { value: "minimal", label: "Minimal Studio", emoji: "⬜", gradient: "from-gray-100 to-gray-300" }
];

function environmentLabel(value: string | undefined | null): string {
  if (!value) return "Default";
  const found = SESSION_ENVIRONMENTS.find((e) => e.value === value);
  return found?.label ?? value;
}

export function SessionLobby() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const voiceSectionRef = useRef<HTMLDivElement>(null);
  const avatarSectionRef = useRef<HTMLDivElement>(null);
  const environmentSectionRef = useRef<HTMLDivElement>(null);
  const [showCarveoutBanner, setShowCarveoutBanner] = useState(false);
  const [selectedMode, setSelectedMode] = useState<"now" | "schedule">("now");
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [showMinutesPicker, setShowMinutesPicker] = useState(false);
  const [customMinutesInput, setCustomMinutesInput] = useState("30");
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [isSavingCustomize, setIsSavingCustomize] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(profile?.selected_voice || "Voice 1");
  const [selectedAvatar, setSelectedAvatar] = useState(profile?.selected_avatar || "Alex");
  const [selectedEnvironment, setSelectedEnvironment] = useState(
    profile?.selected_environment || "minimal"
  );
  const [showUpcomingActionModal, setShowUpcomingActionModal] = useState(false);
  const [activeUpcomingSession, setActiveUpcomingSession] = useState<UpcomingSession | null>(null);
  const [scheduleAvatarOverride, setScheduleAvatarOverride] = useState<string | null>(null);
  const [editingScheduledSessionId, setEditingScheduledSessionId] = useState<string | null>(null);
  const [isCancelingScheduled, setIsCancelingScheduled] = useState(false);

  // Temporary state for modal
  const [tempSelectedVoice, setTempSelectedVoice] = useState(selectedVoice);
  const [tempSelectedAvatar, setTempSelectedAvatar] = useState(selectedAvatar);
  const [tempSelectedEnvironment, setTempSelectedEnvironment] = useState(selectedEnvironment);

  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [upcomingSessions, setUpcomingSessions] = useState<UpcomingSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);

  useEffect(() => {
    // Only sync avatar when that specific field changes (prevents effect loops)
    if (profile?.selected_avatar) {
      setSelectedAvatar(profile.selected_avatar);
      setTempSelectedAvatar(profile.selected_avatar);
    }
  }, [profile?.selected_avatar]);

  useEffect(() => {
    if (profile?.selected_voice) {
      setSelectedVoice(profile.selected_voice);
      setTempSelectedVoice(profile.selected_voice);
    }
  }, [profile?.selected_voice]);

  useEffect(() => {
    if (profile?.selected_environment) {
      setSelectedEnvironment(profile.selected_environment);
      setTempSelectedEnvironment(profile.selected_environment);
    }
  }, [profile?.selected_environment]);

  useEffect(() => {
    if (!companionSessionUses3dModel(profile?.selected_avatar)) return;
    void preloadAvatarModel(resolveCompanionModelUrl(profile?.selected_avatar));
  }, [profile?.selected_avatar]);

  useEffect(() => {
    // Load once on mount; avoid depending on `profile` identity
    loadUpcomingSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After ending a session: show carve-out prompt once; clear router state so refresh/back don't repeat
  useEffect(() => {
    const st = location.state as { showCarveoutPrompt?: boolean } | null | undefined;
    if (!st?.showCarveoutPrompt) return;
    setShowCarveoutBanner(true);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, navigate]);

  // Sync temp state when modal opens
  useEffect(() => {
    if (showCustomizeModal) {
      setTempSelectedVoice(selectedVoice);
      setTempSelectedAvatar(selectedAvatar);
      setTempSelectedEnvironment(selectedEnvironment);
    }
  }, [showCustomizeModal, selectedVoice, selectedAvatar, selectedEnvironment]);

  // Deep link from Profile → Session Preferences (Voice / Environment)
  useEffect(() => {
    const raw = searchParams.get("customize");
    if (!raw) return;
    const section = raw.toLowerCase();
    if (!["voice", "avatar", "environment"].includes(section)) return;

    setShowCustomizeModal(true);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("customize");
        return next;
      },
      { replace: true }
    );

    const scrollTarget =
      section === "voice"
        ? voiceSectionRef
        : section === "avatar"
          ? avatarSectionRef
          : environmentSectionRef;
    const t = window.setTimeout(() => {
      scrollTarget.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchParams, setSearchParams]);

  const [liveCreditsSeconds, setLiveCreditsSeconds] = useState<number | null>(null);

  useEffect(() => {
    // Use the dedicated credits endpoint (no-cache) so "Minutes available" matches Dashboard.
    const loadCredits = async () => {
      try {
        const { credits_seconds, credits } = await api.getCredits();
        const seconds =
          typeof credits_seconds === "number"
            ? Math.max(0, credits_seconds)
            : typeof credits === "number"
            ? Math.max(0, credits) * 60
            : null;
        setLiveCreditsSeconds(seconds);
      } catch {
        setLiveCreditsSeconds(null);
      }
    };
    loadCredits();
  }, []);

  const minutesAvailable = useMemo(() => {
    if (liveCreditsSeconds !== null) {
      return Math.max(0, Math.floor(liveCreditsSeconds / 60));
    }

    // Fallback (cached profile fields)
    const remainingSeconds =
      (typeof profile?.credits_remaining_seconds === "number"
        ? profile.credits_remaining_seconds
        : undefined) ??
      (typeof profile?.credits_seconds === "number" ? profile.credits_seconds : undefined);
    if (typeof remainingSeconds === "number") {
      return Math.max(0, Math.floor(remainingSeconds / 60));
    }

    const remaining =
      (typeof profile?.credits_remaining === "number" ? profile.credits_remaining : undefined) ??
      (typeof profile?.credits === "number" ? profile.credits : undefined) ??
      0;
    const purchased =
      typeof profile?.purchased_credits === "number" ? profile.purchased_credits : 0;
    return Math.max(0, remaining + purchased);
  }, [
    liveCreditsSeconds,
    profile?.credits_remaining_seconds,
    profile?.credits_seconds,
    profile?.credits_remaining,
    profile?.credits,
    profile?.purchased_credits,
  ]);

  const durations = [15, 30, 45, 60];
  const durationDisabled = useMemo(() => {
    const map = new Map<number, boolean>();
    for (const d of durations) map.set(d, minutesAvailable < d);
    return map;
  }, [minutesAvailable]);

  useEffect(() => {
    // If user's remaining minutes drop below selection, snap to the largest allowed duration.
    if (minutesAvailable <= 0) return;
    if (selectedDuration <= minutesAvailable) return;
    const allowed = durations.filter((d) => d <= minutesAvailable);
    if (allowed.length > 0) {
      setSelectedDuration(allowed[allowed.length - 1]);
    } else {
      setSelectedDuration(Math.max(1, Math.floor(minutesAvailable)));
    }
  }, [minutesAvailable, selectedDuration]);

  useEffect(() => {
    if (!showMinutesPicker) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowMinutesPicker(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showMinutesPicker]);

  useEffect(() => {
    if (!showMinutesPicker) return;
    setCustomMinutesInput(String(selectedDuration));
  }, [showMinutesPicker, selectedDuration]);

  const isOnOwnPace = minutesAvailable > 0 && selectedDuration === minutesAvailable;
  const customMinutesValue = Number(customMinutesInput);
  const isCustomMinutesValid =
    customMinutesInput.trim() !== "" &&
    Number.isFinite(customMinutesValue) &&
    customMinutesValue >= 1 &&
    customMinutesValue <= minutesAvailable;

  const applyCustomMinutes = () => {
    if (!isCustomMinutesValid) {
      toast.error(`Enter minutes between 1 and ${minutesAvailable}.`);
      return;
    }
    setSelectedDuration(Math.floor(customMinutesValue));
  };

  const handleSaveCustomize = async () => {
    if (isSavingCustomize) return;
    setIsSavingCustomize(true);
    try {
      await api.updateProfile({
        selected_voice: tempSelectedVoice,
        selected_avatar: tempSelectedAvatar,
        selected_environment: tempSelectedEnvironment
      });
      await refreshProfile();
      setSelectedVoice(tempSelectedVoice);
      setSelectedAvatar(tempSelectedAvatar);
      setSelectedEnvironment(tempSelectedEnvironment);
      setShowCustomizeModal(false);
      toast.success("Session settings updated — reloading…");
      window.setTimeout(() => {
        window.location.reload();
      }, 400);
    } catch (err) {
      console.error(err);
      toast.error("Could not save session preferences");
      setIsSavingCustomize(false);
    }
  };

  const loadUpcomingSessions = async () => {
    try {
      setIsLoadingSessions(true);
      const sessions = await api.sessions.list({ status: "scheduled" });
      const now = new Date();
      const mappedSessions: UpcomingSession[] = (sessions as BackendSession[]).map((session) => {
        const scheduledDate = session.scheduled_at ? new Date(session.scheduled_at) : null;
        const isExpired = !!scheduledDate && scheduledDate.getTime() < now.getTime() && session.status === "scheduled";
        const avatarName = session.config?.avatar || selectedAvatar || "Alex";
        const avatarPreview = lobbyAvatarByName(avatarName);
        const date = scheduledDate
          ? scheduledDate.toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })
          : new Date(session.created_at).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
            });

        return {
          id: session.id,
          avatarName: avatarPreview.name,
          avatarImage: avatarPreview.cardImage,
          type: session.type === "instant" ? "Instant" : "Scheduled",
          date,
          duration: session.duration_minutes ? `${session.duration_minutes} min` : "N/A",
          isExpired,
          scheduledAt: session.scheduled_at,
          durationMinutes: session.duration_minutes,
        };
      });
      setUpcomingSessions(mappedSessions);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const handleStartSession = async (opts?: { avatarOverride?: string }) => {
    setIsStarting(true);
    try {
      const avatarToUse = opts?.avatarOverride || selectedAvatar;
      const session = await api.sessions.create({
        type: 'instant',
        duration_minutes: selectedDuration,
        config: {
          voice: selectedVoice,
          avatar: avatarToUse
        }
      });

      // Persist sessionId so ActiveSession can recover after refresh
      try {
        window.localStorage.setItem("ezri_active_session_id", session.id);
      } catch {}

      navigate(`/app/active-session?sessionId=${encodeURIComponent(session.id)}`, { 
        state: { 
          sessionId: session.id,
          config: session.config,
          duration: session.duration_minutes
        } 
      });
    } catch (err: any) {
      const message = err?.message || "Failed to start session";
      if (message.includes("trial has expired")) {
        navigate("/error/trial-expired");
        return;
      }
      if (message.toLowerCase().includes("insufficient credits")) {
        toast.error(message);
        navigate("/app/billing");
        return;
      }
      toast.error(message);
    } finally {
      setIsStarting(false);
    }
  };

  const handleScheduleSession = async () => {
    if (!scheduleDate || !scheduleTime) {
      toast.error("Please select both date and time");
      return;
    }

    setIsScheduling(true);
    try {
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
      const avatarToUse = scheduleAvatarOverride || selectedAvatar;
      if (editingScheduledSessionId) {
        await api.sessions.updateScheduled(editingScheduledSessionId, {
          duration_minutes: selectedDuration,
          scheduled_at: scheduledAt,
          config: {
            voice: selectedVoice,
            avatar: avatarToUse
          }
        });
        toast.success("Scheduled session updated");
      } else {
        await api.sessions.schedule({
          duration_minutes: selectedDuration,
          scheduled_at: scheduledAt,
          config: {
            voice: selectedVoice,
            avatar: avatarToUse
          }
        });
        toast.success("Session scheduled successfully");
      }
      setShowScheduleModal(false);
      setScheduleAvatarOverride(null);
      setEditingScheduledSessionId(null);
      loadUpcomingSessions();
    } catch (err: any) {
      const message = err?.message || "Failed to schedule session";
      if (message.includes("trial has expired")) {
        navigate("/error/trial-expired");
        return;
      }
      if (message.toLowerCase().includes("insufficient credits")) {
        toast.error(message);
        navigate("/app/billing");
        return;
      }
      toast.error(message);
    } finally {
      setIsScheduling(false);
    }
  };

  const handleCancelScheduledSession = async () => {
    if (!activeUpcomingSession?.id || isCancelingScheduled) return;
    setIsCancelingScheduled(true);
    try {
      await api.sessions.cancelScheduled(activeUpcomingSession.id);
      toast.success("Scheduled session canceled");
      setShowUpcomingActionModal(false);
      setActiveUpcomingSession(null);
      await loadUpcomingSessions();
    } catch (err: any) {
      toast.error(err?.message || "Failed to cancel session");
    } finally {
      setIsCancelingScheduled(false);
    }
  };

  const closeScheduleModal = () => {
    setShowScheduleModal(false);
    setEditingScheduledSessionId(null);
    setScheduleAvatarOverride(null);
  };

  const voices = [
    { id: "voice1", name: "Voice 1", description: "Warm and friendly", gender: "Female" },
    { id: "voice2", name: "Voice 2", description: "Calm and reassuring", gender: "Male" },
    { id: "voice3", name: "Voice 3", description: "Professional and clear", gender: "Female" },
    { id: "voice4", name: "Voice 4", description: "Gentle and soothing", gender: "Male" }
  ];

  const [sessionAvatarList, setSessionAvatarList] = useState(LOBBY_AVATARS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await api.aiAvatars.getAll();
        if (!Array.isArray(rows) || rows.length === 0) return;
        const mapped = lobbyAvatarsFromApiRows(rows);
        if (!cancelled && mapped.length > 0) {
          setSessionAvatarList(mapped);
        }
      } catch {
        /* keep static LOBBY_AVATARS */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const avatars = sessionAvatarList;

  const selectedCompanionPreview = useMemo(
    () => lobbyAvatarByName(selectedAvatar),
    [selectedAvatar]
  );

  const [checklistItems, setChecklistItems] = useState([
    { label: "Find a quiet, private space", checked: true },
    { label: "Check your audio/video", checked: true },
    { label: "Take a few deep breaths", checked: false },
    { label: "Set your intention for this session", checked: false }
  ]);

  const toggleChecklist = (index: number) => {
    const newItems = [...checklistItems];
    newItems[index].checked = !newItems[index].checked;
    setChecklistItems(newItems);
  };

  if (isLoadingSessions) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="mb-8">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="p-6 shadow-xl">
                <Skeleton className="h-5 w-40 mb-4" />
                <div className="grid grid-cols-2 gap-4">
                  {[0, 1].map((i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-xl" />
                  ))}
                </div>
              </Card>
              <Card className="p-6 shadow-xl">
                <Skeleton className="h-5 w-44 mb-4" />
                <div className="grid grid-cols-4 gap-3">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              </Card>
              <Card className="p-6 shadow-xl">
                <Skeleton className="h-5 w-40 mb-4" />
                <Skeleton className="h-10 w-full mb-3 rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
              </Card>
            </div>
            <div className="space-y-6">
              <Card className="p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-10 w-full mb-4 rounded-lg" />
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Skeleton className="w-4 h-4 rounded" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="p-6 shadow-xl">
                <Skeleton className="h-5 w-40 mb-4" />
                <div className="space-y-3">
                  {[0, 1].map((i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-3 w-32" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                      <Skeleton className="h-8 w-24 rounded-lg" />
                    </div>
                  ))}
                </div>
              </Card>
            </div>
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
          <h1 className="text-3xl font-bold mb-2">AI Session with Ezri</h1>
          <p className="text-muted-foreground">
            Start a conversation or schedule a session for later
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Session Card */}
          <div className="lg:col-span-2 space-y-6">
            {/* Mode Selection */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="p-6 shadow-xl">
                <h2 className="text-xl font-bold mb-4">Session Type</h2>
                <div className="grid grid-cols-1 gap-4">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSelectedMode("now");
                      setShowMinutesPicker(true);
                    }}
                    className={`p-6 rounded-xl border-2 transition-all w-full ${
                      selectedMode === "now"
                        ? "border-primary bg-primary/10 shadow-lg"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Play className={`w-8 h-8 mb-3 mx-auto ${selectedMode === "now" ? "text-primary" : "text-gray-400"}`} />
                    <h3 className="font-bold mb-1">Start Now</h3>
                    <p className="text-sm text-muted-foreground">Begin immediately</p>
                  </motion.button>

                </div>
              </Card>
            </motion.div>

            {/* Duration Selection Popup */}
            <AnimatePresence>
              {selectedMode === "now" && showMinutesPicker && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowMinutesPicker(false)}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-xl flex flex-col"
                  >
                    <Card className="p-0 shadow-2xl bg-white dark:bg-gray-900 overflow-hidden border-0">
                      <div className="relative px-6 py-5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white">
                        <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-white/20 blur-2xl" />
                        <div className="absolute -bottom-12 -left-8 w-24 h-24 rounded-full bg-white/15 blur-2xl" />
                        <div className="relative flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Clock className="w-5 h-5 text-white" />
                            <h2 className="text-xl font-bold">Choose session minutes</h2>
                          </div>
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowMinutesPicker(false)}
                            className="p-2 rounded-full hover:bg-white/20 transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </motion.button>
                        </div>
                        <p className="relative mt-2 text-sm text-white/90">
                          Pick how long you want to talk with Ezri today.
                        </p>
                      </div>

                      <div className="p-6">
                      <div className="flex items-center justify-between gap-3 mb-5 text-sm">
                        <p className="text-muted-foreground">
                          Remaining: <span className="font-semibold text-foreground">{minutesAvailable} min</span>
                        </p>
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                          Selected: {selectedDuration} min
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {durations.map((duration, index) => {
                          const isDisabled = !!durationDisabled.get(duration);
                          const isSelected = selectedDuration === duration;
                          return (
                          <motion.button
                            key={duration}
                            type="button"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.06 + index * 0.05 }}
                            whileHover={isDisabled ? undefined : { y: -2, scale: 1.04 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => {
                              if (isDisabled) return;
                              setSelectedDuration(duration);
                            }}
                            disabled={isDisabled}
                            className={`relative p-4 rounded-2xl border transition-all text-left ${
                              isDisabled
                                ? "border-border bg-muted/20 opacity-45 cursor-not-allowed"
                                : isSelected
                                ? "border-primary bg-gradient-to-br from-primary/15 to-fuchsia-500/10 shadow-lg ring-2 ring-primary/20"
                                : "border-border bg-background hover:border-primary/40 hover:bg-primary/5"
                            }`}
                            aria-pressed={isSelected}
                          >
                            <div className="text-2xl font-bold">{duration}</div>
                            <div className="text-xs mt-1 text-muted-foreground">minutes</div>
                            {isSelected && (
                              <Check className="absolute top-3 right-3 w-4 h-4 text-primary" />
                            )}
                          </motion.button>
                        )})}
                      </div>

                      <div className="mt-4 rounded-2xl border border-border/70 bg-muted/20 p-3">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <p className="text-sm font-medium">Custom minutes</p>
                          <p className="text-xs text-muted-foreground">
                            1 - {minutesAvailable} min
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            max={minutesAvailable}
                            step={1}
                            inputMode="numeric"
                            value={customMinutesInput}
                            onChange={(e) => setCustomMinutesInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") applyCustomMinutes();
                            }}
                            className="h-10 w-32 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                            placeholder="e.g. 22"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10"
                            onClick={applyCustomMinutes}
                            disabled={!isCustomMinutesValid}
                          >
                            Apply
                          </Button>
                        </div>
                        {customMinutesInput.trim() !== "" && !isCustomMinutesValid && (
                          <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                            Please enter a valid value between 1 and {minutesAvailable}.
                          </p>
                        )}
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (minutesAvailable <= 0) return;
                          setSelectedDuration(minutesAvailable);
                        }}
                        disabled={minutesAvailable <= 0}
                        className={`mt-4 w-full h-12 border-amber-200 dark:border-amber-800 transition-all hover:text-black dark:hover:text-white ${
                          isOnOwnPace
                            ? "bg-gradient-to-r from-amber-100 to-orange-200 dark:from-amber-900/40 dark:to-orange-900/40 ring-2 ring-amber-500/30 shadow-md"
                            : "bg-gradient-to-r from-amber-50 to-orange-100 dark:from-amber-900/25 dark:to-orange-900/25 hover:from-amber-100 hover:to-orange-200 dark:hover:from-amber-900/40 dark:hover:to-orange-900/40"
                        }`}
                        aria-pressed={isOnOwnPace}
                      >
                        <div className="flex items-center justify-between w-full gap-3">
                          <div className="flex items-center gap-2">
                            {isOnOwnPace ? <Check className="w-4 h-4 text-amber-700" /> : null}
                            <span className="font-semibold">At your own pace</span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            Use all {minutesAvailable} min
                          </span>
                        </div>
                      </Button>

                      <div className="mt-5 flex items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                          Selected duration: <span className="font-medium text-foreground">{selectedDuration} min</span>
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowMinutesPicker(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            onClick={() => void handleStartSession()}
                            disabled={
                              isStarting ||
                              minutesAvailable <= 0 ||
                              selectedDuration > minutesAvailable ||
                              selectedDuration < 1
                            }
                            className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white hover:shadow-2xl hover:shadow-purple-500/50 transition-all"
                          >
                            <Video className="w-4 h-4 mr-2" />
                            Start Now
                          </Button>
                        </div>
                      </div>
                      </div>
                    </Card>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Ezri Preview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="p-6 shadow-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white overflow-hidden relative">
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.5, 0.3]
                  }}
                  transition={{ duration: 4, repeat: Infinity }}
                  className="absolute -top-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-3xl"
                />
                <motion.div
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.2, 0.4, 0.2]
                  }}
                  transition={{ duration: 5, repeat: Infinity }}
                  className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/20 rounded-full blur-3xl"
                />
                
                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-4">
                    <motion.div
                      animate={{ 
                        y: [0, -10, 0],
                        rotate: [0, 5, -5, 0]
                      }}
                      transition={{ duration: 3, repeat: Infinity }}
                      className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-4xl overflow-hidden ring-2 ring-white/30"
                    >
                      {selectedCompanionPreview.cardImage ? (
                        <img
                          src={selectedCompanionPreview.cardImage}
                          alt=""
                          className="h-full w-full object-cover object-top"
                        />
                      ) : (
                        <User className="h-10 w-10 text-white/90" aria-hidden />
                      )}
                    </motion.div>
                    <div>
                      <h3 className="font-bold text-lg">Ezri is ready</h3>
                      <p className="text-white/90 text-sm">Your AI companion</p>
                    </div>
                  </div>
                  <p className="text-white/90 mb-4">
                    "I'm here to listen and support you. Let's have a meaningful conversation together."
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    <span>Available 24/7 • Private & Secure</span>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Pre-Session Checklist */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="p-6 shadow-xl">
                <h2 className="text-xl font-bold mb-4">Before You Start</h2>
                <div className="space-y-3">
                  {checklistItems.map((item, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + index * 0.05 }}
                      onClick={() => toggleChecklist(index)}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                    >
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          item.checked
                            ? "bg-green-500 border-green-500"
                            : "border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        {item.checked && (
                          <CheckCircle className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <span className={item.checked ? "text-muted-foreground line-through transition-colors" : "transition-colors"}>
                        {item.label}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* Start Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              {selectedMode === "now" ? (
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button 
                    type="button"
                    className="w-full h-16 text-lg group relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:shadow-2xl hover:shadow-purple-500/50 transition-all"
                    onClick={() => setShowMinutesPicker(true)}
                    disabled={isStarting || selectedDuration > minutesAvailable}
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 pointer-events-none"
                      initial={{ x: "-100%" }}
                      whileHover={{ x: 0 }}
                      transition={{ duration: 0.3 }}
                    />
                    <span className="relative z-10 flex items-center justify-center gap-3">
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        {isStarting ? (
                          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Video className="w-6 h-6" />
                        )}
                      </motion.div>
                      <span className="font-bold">
                        {isStarting ? "Starting Session..." : "Start Session Now"}
                      </span>
                      {!isStarting && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                    </span>
                  </Button>
                </motion.div>
              ) : null}
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Session Settings */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="p-6 shadow-xl">
                <div className="flex items-center gap-2 mb-4">
                  <Settings className="w-5 h-5 text-primary" />
                  <h3 className="font-bold">Session Settings</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Voice</span>
                    </div>
                    <span className="text-sm font-medium">{selectedVoice}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Avatar</span>
                    </div>
                    <span className="text-sm font-medium">{selectedAvatar}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Environment</span>
                    </div>
                    <span className="text-sm font-medium text-right max-w-[55%] truncate">
                      {environmentLabel(selectedEnvironment)}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowCustomizeModal(true)}
                  >
                    Customize
                  </Button>
                </div>
              </Card>
            </motion.div>

            {/* Schedule (moved above Upcoming) */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="p-6 shadow-xl overflow-hidden">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5 text-primary" />
                  <h3 className="font-bold">Schedule</h3>
                </div>
                {showCarveoutBanner && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                    className="mb-4 relative rounded-2xl border-2 border-purple-400/40 bg-gradient-to-br from-violet-500/15 via-fuchsia-500/10 to-amber-400/15 dark:from-violet-500/25 dark:via-fuchsia-500/15 dark:to-amber-500/10 p-4 shadow-lg shadow-purple-500/10"
                  >
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br from-pink-400/30 to-purple-500/20 blur-2xl pointer-events-none" />
                    <div className="relative flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <p className="text-sm sm:text-base font-semibold leading-snug text-foreground">
                        Do you want to carve out time for the next time we talk?
                      </p>
                    </div>
                  </motion.div>
                )}
                <Button
                  type="button"
                  disabled={minutesAvailable <= 0 || selectedDuration > minutesAvailable}
                  className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-purple-500/10 hover:from-indigo-500 hover:to-purple-500 transition-all flex items-center gap-3 px-4"
                  onClick={() => {
                    setSelectedMode("schedule");
                    setShowMinutesPicker(false);
                    setEditingScheduledSessionId(null);
                    setScheduleAvatarOverride(null);
                    setShowScheduleModal(true);
                  }}
                >
                  <Calendar className="w-5 h-5 mr-2" />
                  <div className="flex flex-col leading-tight">
                    <span className="font-bold text-sm">Schedule for later</span>
                    <span className="text-xs text-white/80">Pick a date & time</span>
                  </div>
                </Button>
              </Card>
            </motion.div>

            {/* Upcoming Sessions */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="p-6 shadow-xl">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5 text-primary" />
                  <h3 className="font-bold">Upcoming</h3>
                </div>
                <div className="space-y-3">
                  {upcomingSessions.map((session, index) => (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + index * 0.1 }}
                      whileHover={session.isExpired ? undefined : { y: -2 }}
                      onClick={() => {
                        if (session.isExpired) return;
                        setActiveUpcomingSession(session);
                        setShowUpcomingActionModal(true);
                      }}
                      className={`rounded-xl border p-3 transition-all ${
                        session.isExpired
                          ? "opacity-60 border-red-200/70 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20"
                          : "border-gray-200 bg-gradient-to-r from-white to-violet-50/40 hover:border-primary/30 hover:shadow-md dark:border-gray-800 dark:from-gray-900 dark:to-violet-950/20 cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-full overflow-hidden ring-2 ring-white/80 dark:ring-gray-900 shadow-sm shrink-0 bg-muted/60">
                          {session.avatarImage ? (
                            <img
                              src={session.avatarImage}
                              alt={session.avatarName}
                              className="h-full w-full object-cover object-top"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center">
                              <User className="h-5 w-5 text-muted-foreground" aria-hidden />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{session.avatarName}</p>
                          <p className="text-xs text-muted-foreground">{session.date}</p>
                        </div>
                        <span
                          className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-1 rounded-full ${
                            session.isExpired
                              ? "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/40"
                              : "text-indigo-700 bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-900/40"
                          }`}
                        >
                          {session.isExpired ? "Expired" : session.type}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {session.duration}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </Card>
            </motion.div>

            {/* Tips */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="p-6 shadow-xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <h3 className="font-bold text-amber-900 dark:text-amber-200">Session Tip</h3>
                </div>
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Try to be present and honest during your session. There's no right or wrong way to feel.
                </p>
              </Card>
            </motion.div>
          </div>
        </div>

        {/* Customize Modal */}
        <AnimatePresence>
          {showCustomizeModal && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowCustomizeModal(false)}
                className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              >
                {/* Modal */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-2xl flex flex-col max-h-[85vh]"
                >
                  <Card className="flex flex-col shadow-2xl bg-white dark:bg-gray-900 overflow-hidden">
                    {/* Header - Fixed */}
                    <div className="flex items-center justify-between p-6 border-b shrink-0">
                      <div>
                        <h2 className="text-2xl font-bold">Customize Voice & Avatar</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                          Personalize your session experience
                        </p>
                      </div>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setShowCustomizeModal(false)}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </motion.button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="p-6 overflow-y-auto">
                      {/* Voice Selection */}
                      <div ref={voiceSectionRef} className="mb-6 scroll-mt-4">
                        <div className="flex items-center gap-2 mb-4">
                          <Volume2 className="w-5 h-5 text-primary" />
                          <h3 className="font-bold text-lg">Voice Selection</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {voices.map((voice, index) => (
                            <motion.button
                              key={voice.id}
                              type="button"
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.1 + index * 0.05 }}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setTempSelectedVoice(voice.name)}
                              className={`p-4 rounded-xl border-2 transition-all text-left relative ${
                                tempSelectedVoice === voice.name
                                  ? "border-primary bg-primary/10 dark:bg-primary/20 shadow-lg"
                                  : "border-border hover:border-primary/50"
                              }`}
                            >
                              {tempSelectedVoice === voice.name && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="absolute top-2 right-2 bg-primary rounded-full p-1"
                                >
                                  <Check className="w-3 h-3 text-white" />
                                </motion.div>
                              )}
                              <div className="font-bold mb-1">{voice.name}</div>
                              <div className="text-sm text-muted-foreground mb-2">
                                {voice.description}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <span className="inline-block w-2 h-2 rounded-full bg-primary"></span>
                                {voice.gender}
                              </div>
                            </motion.button>
                          ))}
                        </div>
                      </div>

                      {/* Avatar Selection */}
                      <div ref={avatarSectionRef} className="mb-6 scroll-mt-4">
                        <div className="flex items-center gap-2 mb-4">
                          <User className="w-5 h-5 text-primary" />
                          <h3 className="font-bold text-lg">Avatar Selection</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {avatars.map((avatar, index) => (
                            <motion.button
                              key={avatar.id}
                              type="button"
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.3 + index * 0.05 }}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setTempSelectedAvatar(avatar.name)}
                              className={`p-4 rounded-xl border-2 transition-all text-center relative ${
                                tempSelectedAvatar === avatar.name
                                  ? "border-primary bg-primary/10 dark:bg-primary/20 shadow-lg"
                                  : "border-border hover:border-primary/50"
                              }`}
                            >
                              {tempSelectedAvatar === avatar.name && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="absolute top-2 right-2 bg-primary rounded-full p-1"
                                >
                                  <Check className="w-3 h-3 text-white" />
                                </motion.div>
                              )}
                              {avatar.cardImage ? (
                                <img
                                  src={avatar.cardImage}
                                  alt=""
                                  className="mx-auto mb-2 h-16 w-16 rounded-full object-cover"
                                />
                              ) : (
                                <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                                  <User className="h-8 w-8 text-muted-foreground" aria-hidden />
                                </div>
                              )}
                              <div className="font-bold mb-1">{avatar.name}</div>
                              <div className="text-xs text-muted-foreground line-clamp-3">
                                {avatar.personality?.trim() ||
                                  avatar.description?.trim() ||
                                  "No personality description available"}
                              </div>
                            </motion.button>
                          ))}
                        </div>
                      </div>

                      {/* Session background (environment) */}
                      <div ref={environmentSectionRef} className="mb-2 scroll-mt-4">
                        <div className="flex items-center gap-2 mb-4">
                          <Palette className="w-5 h-5 text-primary" />
                          <h3 className="font-bold text-lg">Session Background</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          Choose a calming background for your video sessions
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {SESSION_ENVIRONMENTS.map((env, index) => (
                            <motion.button
                              key={env.value}
                              type="button"
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.05 * index }}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setTempSelectedEnvironment(env.value)}
                              className={`rounded-lg border-2 overflow-hidden transition-all text-left ${
                                tempSelectedEnvironment === env.value
                                  ? "border-primary shadow-lg"
                                  : "border-border hover:border-primary/50"
                              }`}
                            >
                              <div
                                className={`h-20 bg-gradient-to-br ${env.gradient} flex items-center justify-center dark:opacity-95`}
                              >
                                <span className="text-3xl">{env.emoji}</span>
                              </div>
                              <div className="p-2 bg-white dark:bg-gray-950">
                                <p className="text-sm font-medium">{env.label}</p>
                              </div>
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Footer Buttons - Fixed */}
                    <div className="flex items-center justify-end gap-3 p-6 border-t shrink-0 bg-gray-50/50 dark:bg-gray-800/50">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isSavingCustomize}
                        onClick={() => setShowCustomizeModal(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        disabled={isSavingCustomize}
                        aria-busy={isSavingCustomize}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white min-w-[148px]"
                        onClick={() => void handleSaveCustomize()}
                      >
                        {isSavingCustomize ? (
                          <>
                            <Loader2
                              className="w-4 h-4 mr-2 animate-spin shrink-0"
                              aria-hidden
                            />
                            Saving…
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-2 shrink-0" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Schedule Modal */}
        <AnimatePresence>
          {showScheduleModal && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeScheduleModal}
                className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              >
                {/* Modal */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-2xl flex flex-col max-h-[85vh]"
                >
                  <Card className="flex flex-col shadow-2xl bg-white dark:bg-gray-900 overflow-hidden">
                    {/* Header - Fixed */}
                    <div className="flex items-center justify-between p-6 border-b shrink-0">
                      <div>
                        <h2 className="text-2xl font-bold">
                          {editingScheduledSessionId ? "Edit Scheduled Session" : "Schedule a Session"}
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                          Pick a date and time for your session
                        </p>
                      </div>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={closeScheduleModal}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </motion.button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="p-6 overflow-y-auto">
                      {/* Duration Selection */}
                      <div className="mb-6">
                        <div className="flex items-center justify-between gap-2 mb-4">
                          <div className="flex items-center gap-2">
                            <Clock className="w-5 h-5 text-primary" />
                            <h3 className="font-bold text-lg">Session Minutes</h3>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            Selected: {selectedDuration} min
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {durations.map((duration) => {
                            const isDisabled = !!durationDisabled.get(duration);
                            const isSelected = selectedDuration === duration;
                            return (
                              <button
                                key={duration}
                                type="button"
                                disabled={isDisabled}
                                onClick={() => {
                                  if (isDisabled) return;
                                  setSelectedDuration(duration);
                                }}
                                className={`rounded-xl border p-3 text-center transition-all ${
                                  isDisabled
                                    ? "opacity-40 cursor-not-allowed"
                                    : isSelected
                                    ? "border-primary bg-primary/10"
                                    : "hover:border-primary/40"
                                }`}
                              >
                                <div className="text-lg font-bold">{duration}</div>
                                <div className="text-[10px] text-muted-foreground">min</div>
                              </button>
                            );
                          })}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Minutes available: {minutesAvailable}
                        </p>
                      </div>

                      {/* Date and Time Selection */}
                      <div className="mb-6">
                        <div className="flex items-center gap-2 mb-4">
                          <Calendar className="w-5 h-5 text-primary" />
                          <h3 className="font-bold text-lg">Date & Time</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-4 rounded-xl border-2 dark:border-gray-700 transition-all text-left relative bg-gray-50 dark:bg-gray-800/50">
                            <input
                              type="date"
                              value={scheduleDate}
                              onChange={(e) => setScheduleDate(e.target.value)}
                              className="w-full p-2 border-none outline-none bg-transparent dark:text-white"
                            />
                          </div>
                          <div className="p-4 rounded-xl border-2 dark:border-gray-700 transition-all text-left relative bg-gray-50 dark:bg-gray-800/50">
                            <input
                              type="time"
                              value={scheduleTime}
                              onChange={(e) => setScheduleTime(e.target.value)}
                              className="w-full p-2 border-none outline-none bg-transparent dark:text-white"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer Buttons - Fixed */}
                    <div className="flex items-center justify-end gap-3 p-6 border-t shrink-0 bg-gray-50/50 dark:bg-gray-800/50 dark:border-gray-800">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={closeScheduleModal}
                        disabled={isScheduling}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                        onClick={handleScheduleSession}
                        isLoading={isScheduling}
                        disabled={isScheduling || selectedDuration > minutesAvailable || selectedDuration < 1}
                      >
                        <Check className="w-4 h-4 mr-2" />
                        {editingScheduledSessionId ? "Update" : "Schedule"}
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Upcoming Session Action Modal */}
        <AnimatePresence>
          {showUpcomingActionModal && activeUpcomingSession && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUpcomingActionModal(false)}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg"
              >
                <Card className="p-6 shadow-2xl bg-white dark:bg-gray-900">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold">Session options</h3>
                      <p className="text-sm text-muted-foreground">
                        {activeUpcomingSession.avatarName} • choose minutes and action
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowUpcomingActionModal(false)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {durations.map((duration) => {
                      const isDisabled = !!durationDisabled.get(duration);
                      const isSelected = selectedDuration === duration;
                      return (
                        <button
                          key={duration}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => {
                            if (isDisabled) return;
                            setSelectedDuration(duration);
                          }}
                          className={`rounded-xl border p-3 text-center transition-all ${
                            isDisabled
                              ? "opacity-40 cursor-not-allowed"
                              : isSelected
                              ? "border-primary bg-primary/10"
                              : "hover:border-primary/40"
                          }`}
                        >
                          <div className="text-lg font-bold">{duration}</div>
                          <div className="text-[10px] text-muted-foreground">min</div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-5">
                    <span>Minutes available: {minutesAvailable}</span>
                    <span>Selected: {selectedDuration} min</span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      type="button"
                      className="flex-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white"
                      onClick={() => {
                        void handleStartSession({ avatarOverride: activeUpcomingSession.avatarName });
                        setShowUpcomingActionModal(false);
                      }}
                      disabled={isStarting || selectedDuration > minutesAvailable || selectedDuration < 1}
                    >
                      Start Now
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowUpcomingActionModal(false);
                        setSelectedMode("schedule");
                        setScheduleAvatarOverride(activeUpcomingSession.avatarName);
                        setEditingScheduledSessionId(activeUpcomingSession.id);
                        setSelectedDuration(activeUpcomingSession.durationMinutes || selectedDuration);
                        if (activeUpcomingSession.scheduledAt) {
                          const dt = new Date(activeUpcomingSession.scheduledAt);
                          const yyyy = dt.getFullYear();
                          const mm = String(dt.getMonth() + 1).padStart(2, "0");
                          const dd = String(dt.getDate()).padStart(2, "0");
                          const hh = String(dt.getHours()).padStart(2, "0");
                          const min = String(dt.getMinutes()).padStart(2, "0");
                          setScheduleDate(`${yyyy}-${mm}-${dd}`);
                          setScheduleTime(`${hh}:${min}`);
                        }
                        setShowScheduleModal(true);
                      }}
                      disabled={isScheduling || selectedDuration > minutesAvailable || selectedDuration < 1}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 border-red-300 text-red-600 hover:bg-red-500 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
                      onClick={() => {
                        void handleCancelScheduledSession();
                      }}
                      disabled={isCancelingScheduled}
                    >
                      {isCancelingScheduled ? "Canceling..." : "Cancel Session"}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
