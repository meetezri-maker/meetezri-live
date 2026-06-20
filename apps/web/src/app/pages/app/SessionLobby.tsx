import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate, useLocation, useSearchParams, Link } from "react-router-dom";
import {
  Video,
  Calendar,
  Clock,
  Sparkles,
  User,
  Volume2,
  X,
  Check,
  Palette,
  Loader2,
} from "lucide-react";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Skeleton } from "../../components/ui/skeleton";
import { preloadAvatarModel } from "@/lib/avatar/preloadAvatarModel";
import {
  companionSessionUses3dModel,
  resolveCompanionAvatarRuntime,
  resolveCompanionModelUrl,
  companionCardPortraitFrameClass,
  companionCardPortraitImgClass,
  resolveCompanionPortraitUrl,
} from "@/lib/avatar/companionModelUrl";
import { LOBBY_AVATARS, lobbyAvatarByName, lobbyAvatarsFromApiRows } from "@/lib/avatar/lobbyAvatars";
import {
  DEFAULT_SELECTABLE_COMPANION_NAME,
  isCompanionComingSoon,
  isSessionEnvironmentComingSoon,
  resolveCompanionForProfileSave,
  resolveEnvironmentForProfileSave,
} from "@/lib/avatar/companionAvailability";
import { ComingSoonOverlay } from "@/components/ui/ComingSoonOverlay";
import { FluentEmoji } from "@/components/ui/FluentEmoji";
import { TalkItOutLobbyLayout } from "./talk-it-out/TalkItOutLobbyLayout";
import { cn } from "@/lib/utils";
import {
  modalBadge,
  modalCloseButton,
  modalEmphasisText,
  modalFreeFlowCard,
  modalFreeFlowCardSelected,
  modalInput,
  modalInsetPanel,
  modalLabel,
  modalMutedText,
  modalOptionCard,
  modalOptionCardDisabled,
  modalOptionCardMeta,
  modalOptionCardSelected,
  modalOverlay,
  modalPanel,
  modalPanelBody,
  modalPanelHeader,
  modalPanelLg,
  modalPanelMd,
  modalPrimaryButton,
  modalSecondaryButton,
  modalSectionTitle,
  modalSubtitle,
  modalTitle,
} from "@/lib/modalTheme";

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
  icon?: string;
  comment?: string;
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

const LOBBY_DURATION_PRESETS: readonly number[] = [10, 25, 45];

function environmentLabel(value: string | undefined | null): string {
  if (!value) return "Default";
  const found = SESSION_ENVIRONMENTS.find((e) => e.value === value);
  return found?.label ?? value;
}

function isFemaleAvatarName(name: string | null | undefined): boolean {
  const n = (name ?? "").trim().toLowerCase();
  return n === "maya chen" || n === "maya" || n === "sara mitchell" || n === "sarah mitchell" || n === "sarah";
}

declare global {
  interface Window {
    sessionLobbyDiagnostics?: {
      buttonDisabled: boolean;
      disabledReason: string | null;
      blockingStates: Record<string, boolean>;
      isLoading: boolean;
      isStarting: boolean;
      canStart: boolean;
      companionReady: boolean;
      avatarReady: boolean;
      micReady: boolean;
      sessionReady: boolean;
      selectedCompanion: string | null;
      selectedAvatarRuntime: string | null;
    };
  }
}

export function SessionLobby() {
  const { profile, refreshProfile, user, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const voiceSectionRef = useRef<HTMLDivElement>(null);
  const avatarSectionRef = useRef<HTMLDivElement>(null);
  const environmentSectionRef = useRef<HTMLDivElement>(null);
  const [showCarveoutBanner, setShowCarveoutBanner] = useState(false);
  const [selectedMode, setSelectedMode] = useState<"now" | "schedule">("now");
  const [selectedDuration, setSelectedDuration] = useState(25);
  const [showMinutesPicker, setShowMinutesPicker] = useState(false);
  const [customMinutesInput, setCustomMinutesInput] = useState("25");
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [isSavingCustomize, setIsSavingCustomize] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(profile?.selected_voice || "Voice 1");
  const [selectedAvatar, setSelectedAvatar] = useState(
    profile?.selected_avatar || DEFAULT_SELECTABLE_COMPANION_NAME,
  );
  const [selectedEnvironment, setSelectedEnvironment] = useState(
    profile?.selected_environment || "minimal"
  );
  const [showUpcomingActionModal, setShowUpcomingActionModal] = useState(false);
  const [activeUpcomingSession, setActiveUpcomingSession] = useState<UpcomingSession | null>(null);
  const [scheduleAvatarOverride, setScheduleAvatarOverride] = useState<string | null>(null);
  const [editingScheduledSessionId, setEditingScheduledSessionId] = useState<string | null>(null);
  const [isCancelingScheduled, setIsCancelingScheduled] = useState(false);
  const [sessionLengthKind, setSessionLengthKind] = useState<"fixed" | "free">("fixed");
  const [connectMode, setConnectMode] = useState<"voice" | "video" | "deep" | "quick">("voice");
  const [conversationEnergy, setConversationEnergy] = useState<
    "gentle" | "reflective" | "grounding" | "open"
  >("gentle");

  // Temporary state for modal
  const [tempSelectedVoice, setTempSelectedVoice] = useState(selectedVoice);
  const [tempSelectedAvatar, setTempSelectedAvatar] = useState(selectedAvatar);
  const [tempSelectedEnvironment, setTempSelectedEnvironment] = useState(selectedEnvironment);

  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleComment, setScheduleComment] = useState("");
  const [scheduleIcon, setScheduleIcon] = useState("💬");
  const [isStarting, setIsStarting] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [upcomingSessions, setUpcomingSessions] = useState<UpcomingSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [playingVoiceName, setPlayingVoiceName] = useState<string | null>(null);
  const voicePreviewAudioRef = useRef<HTMLAudioElement | null>(null);

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
    // Wait for auth to hydrate before calling authed endpoints (prevents 401 + retries).
    if (isAuthLoading || !user?.id) return;
    loadUpcomingSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, user?.id]);

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
    if (isAuthLoading || !user?.id) return;
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
  }, [isAuthLoading, user?.id]);

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

  const durations = LOBBY_DURATION_PRESETS;
  const durationDisabled = useMemo(() => {
    const map = new Map<number, boolean>();
    for (const d of durations) map.set(d, minutesAvailable < d);
    return map;
  }, [minutesAvailable, durations]);

  useEffect(() => {
    if (minutesAvailable <= 0) return;
    if (sessionLengthKind === "free") {
      setSelectedDuration((prev) => {
        const next = Math.max(1, minutesAvailable);
        return prev === next ? prev : next;
      });
      return;
    }
    if (selectedDuration <= minutesAvailable) return;
    const allowed = durations.filter((d) => d <= minutesAvailable);
    if (allowed.length > 0) {
      setSelectedDuration(allowed[allowed.length - 1]);
    } else {
      setSelectedDuration(Math.max(1, Math.floor(minutesAvailable)));
    }
  }, [minutesAvailable, selectedDuration, sessionLengthKind, durations]);

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

  const isOnOwnPace = sessionLengthKind === "free";
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
    setSessionLengthKind("fixed");
    setSelectedDuration(Math.floor(customMinutesValue));
  };

  const handleSaveCustomize = async () => {
    if (isSavingCustomize) return;
    setIsSavingCustomize(true);
    try {
      const avatarToSave = resolveCompanionForProfileSave(
        tempSelectedAvatar,
        selectedAvatar,
      );
      const environmentToSave = resolveEnvironmentForProfileSave(
        tempSelectedEnvironment,
        selectedEnvironment,
      );
      await api.updateProfile({
        selected_voice: tempSelectedVoice,
        selected_avatar: avatarToSave,
        selected_environment: environmentToSave,
      });
      await refreshProfile();
      setSelectedVoice(tempSelectedVoice);
      setSelectedAvatar(avatarToSave);
      setSelectedEnvironment(environmentToSave);
      setTempSelectedAvatar(avatarToSave);
      setTempSelectedEnvironment(environmentToSave);
      setShowCustomizeModal(false);
      toast.success("Talking settings updated");
      setIsSavingCustomize(false);
    } catch (err) {
      console.error(err);
      toast.error("Could not save Talking preferences");
      setIsSavingCustomize(false);
    }
  };

  const mapBackendSessionToUpcoming = (session: BackendSession): UpcomingSession => {
    const now = new Date();
    const scheduledDate = session.scheduled_at ? new Date(session.scheduled_at) : null;
    const isExpired =
      !!scheduledDate && scheduledDate.getTime() < now.getTime() && session.status === "scheduled";

    const avatarName = session.config?.avatar || selectedAvatar || "Alex";
    const avatarPreview = lobbyAvatarByName(avatarName);

    const icon =
      typeof session.config?.icon === "string"
        ? session.config.icon
        : typeof session.config?.emoji === "string"
          ? session.config.emoji
          : undefined;

    const comment =
      typeof session.config?.comment === "string"
        ? session.config.comment
        : typeof session.config?.notes === "string"
          ? session.config.notes
          : undefined;

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
      icon,
      comment,
      type: session.type === "instant" ? "Instant" : "Scheduled",
      date,
      duration: session.duration_minutes ? `${session.duration_minutes} min` : "N/A",
      isExpired,
      scheduledAt: session.scheduled_at,
      durationMinutes: session.duration_minutes,
    };
  };

  const loadUpcomingSessions = async () => {
    try {
      setIsLoadingSessions(true);
      const sessions = await api.sessions.list({ status: "scheduled" });
      const nowMs = Date.now();
      const mappedSessions: UpcomingSession[] = (sessions as BackendSession[])
        .filter((s) => {
          if (s.status !== "scheduled") return false;
          const at = s.scheduled_at ? new Date(s.scheduled_at).getTime() : 0;
          return at >= nowMs;
        })
        .map(mapBackendSessionToUpcoming);
      setUpcomingSessions(mappedSessions);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const handleStartSession = async (opts?: {
    avatarOverride?: string;
    /** When set, activates this scheduled row instead of creating a new instant session */
    scheduledSessionId?: string;
  }) => {
    setIsStarting(true);
    try {
      const avatarToUse = opts?.avatarOverride || selectedAvatar;

      try {
        const fresh = await api.getCredits({ bypassCache: true });
        const sec =
          typeof fresh?.credits_seconds === "number"
            ? Math.max(0, fresh.credits_seconds)
            : typeof fresh?.credits === "number"
              ? Math.max(0, fresh.credits) * 60
              : null;
        if (sec !== null) setLiveCreditsSeconds(sec);
      } catch {
        /* non-blocking: server is source of truth at create time */
      }

      const session = opts?.scheduledSessionId
        ? await api.sessions.startScheduled(opts.scheduledSessionId, {
            duration_minutes: selectedDuration,
          })
        : await api.sessions.create({
            type: "instant",
            duration_minutes: selectedDuration,
            config: {
              voice: selectedVoice,
              avatar: avatarToUse,
            },
          });

      if (opts?.scheduledSessionId) {
        setUpcomingSessions((prev) => prev.filter((s) => s.id !== opts.scheduledSessionId));
      }

      const sessionConfig =
        session && typeof session === "object" && "config" in session
          ? (session as { config?: Record<string, unknown> }).config
          : undefined;
      const mergedConfig = {
        voice: selectedVoice,
        avatar: avatarToUse,
        ...(sessionConfig && typeof sessionConfig === "object" ? sessionConfig : {}),
      };

      // Persist sessionId so ActiveSession can recover after refresh
      try {
        window.localStorage.setItem("ezri_active_session_id", session.id);
      } catch {}

      navigate(`/app/active-session?sessionId=${encodeURIComponent(session.id)}`, {
        state: {
          sessionId: session.id,
          config: mergedConfig,
          duration:
            (session as { duration_minutes?: number | null }).duration_minutes ??
            selectedDuration,
        },
      });

      void loadUpcomingSessions();
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
      const nextComment = scheduleComment.trim();
      const nextIcon = scheduleIcon.trim();
      if (editingScheduledSessionId) {
        const updated = (await api.sessions.updateScheduled(editingScheduledSessionId, {
          duration_minutes: selectedDuration,
          scheduled_at: scheduledAt,
          config: {
            voice: selectedVoice,
            avatar: avatarToUse,
            comment: nextComment || undefined,
            icon: nextIcon || undefined,
          }
        })) as BackendSession | undefined;
        toast.success("Scheduled session updated");

        if (updated?.id) {
          const mapped = mapBackendSessionToUpcoming(updated);
          setUpcomingSessions((prev) =>
            prev.map((s) => (s.id === mapped.id ? mapped : s))
          );
        } else {
          void loadUpcomingSessions();
        }
      } else {
        const created = (await api.sessions.schedule({
          duration_minutes: selectedDuration,
          scheduled_at: scheduledAt,
          config: {
            voice: selectedVoice,
            avatar: avatarToUse,
            comment: nextComment || undefined,
            icon: nextIcon || undefined,
          }
        })) as BackendSession | undefined;
        toast.success("Session scheduled successfully");

        if (created?.id) {
          const mapped = mapBackendSessionToUpcoming(created);
          setUpcomingSessions((prev) => {
            const without = prev.filter((s) => s.id !== mapped.id);
            return [mapped, ...without];
          });
        } else {
          void loadUpcomingSessions();
        }
      }
      setShowScheduleModal(false);
      setScheduleAvatarOverride(null);
      setEditingScheduledSessionId(null);
      setScheduleComment("");
      setScheduleIcon("💬");
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
      setUpcomingSessions((prev) => prev.filter((s) => s.id !== activeUpcomingSession.id));
      setActiveUpcomingSession(null);
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
    setScheduleComment("");
    setScheduleIcon("💬");
  };

  const voices = [
    { id: "voice1", name: "Voice 1", description: "Warm and friendly", gender: "Female", demoFile: "voice1female.wav" },
    { id: "voice2", name: "Voice 2", description: "Calm and reassuring", gender: "Male", demoFile: "voice2male.wav" },
    { id: "voice3", name: "Voice 3", description: "Professional and clear", gender: "Female", demoFile: "voice3female.wav" },
    { id: "voice4", name: "Voice 4", description: "Gentle and soothing", gender: "Male", demoFile: "voice4male.wav" }
  ];

  const tempSelectedAvatarIsFemale = isFemaleAvatarName(tempSelectedAvatar);

  const isVoiceDisabledForAvatar = (voiceGender: string): boolean => {
    const vg = voiceGender.trim().toLowerCase();
    if (tempSelectedAvatarIsFemale) return vg !== "female";
    return vg !== "male";
  };

  const stopVoicePreview = () => {
    const existing = voicePreviewAudioRef.current;
    if (!existing) return;
    existing.pause();
    existing.currentTime = 0;
    voicePreviewAudioRef.current = null;
    setPlayingVoiceName(null);
  };

  const playVoicePreview = async (voiceName: string, demoFile: string) => {
    try {
      stopVoicePreview();
      const base = import.meta.env.BASE_URL.endsWith("/")
        ? import.meta.env.BASE_URL
        : `${import.meta.env.BASE_URL}/`;
      const audio = new Audio(`${base}avatarvoices/${encodeURIComponent(demoFile)}`);
      voicePreviewAudioRef.current = audio;
      setPlayingVoiceName(voiceName);
      audio.onended = () => {
        if (voicePreviewAudioRef.current === audio) {
          voicePreviewAudioRef.current = null;
          setPlayingVoiceName(null);
        }
      };
      audio.onerror = () => {
        if (voicePreviewAudioRef.current === audio) {
          voicePreviewAudioRef.current = null;
          setPlayingVoiceName(null);
        }
        toast.error("Could not play voice preview");
      };
      await audio.play();
    } catch {
      setPlayingVoiceName(null);
      toast.error("Could not play voice preview");
    }
  };

  const handleVoiceSelect = async (
    voiceName: string,
    voiceGender: string,
    demoFile: string
  ) => {
    if (isVoiceDisabledForAvatar(voiceGender)) return;
    setTempSelectedVoice(voiceName);
    await playVoicePreview(voiceName, demoFile);
  };

  useEffect(() => {
    return () => {
      stopVoicePreview();
    };
  }, []);

  useEffect(() => {
    const selectedVoiceMeta = voices.find((v) => v.name === tempSelectedVoice);
    if (!selectedVoiceMeta) return;
    if (!isVoiceDisabledForAvatar(selectedVoiceMeta.gender)) return;

    const fallback = voices.find((v) =>
      tempSelectedAvatarIsFemale
        ? v.gender.toLowerCase() === "female"
        : v.gender.toLowerCase() === "male"
    );
    if (fallback) setTempSelectedVoice(fallback.name);
  }, [tempSelectedAvatar, tempSelectedAvatarIsFemale, tempSelectedVoice]);

  useEffect(() => {
    if (showCustomizeModal) return;
    stopVoicePreview();
  }, [showCustomizeModal]);

  const [sessionAvatarList, setSessionAvatarList] = useState(LOBBY_AVATARS);

  useEffect(() => {
    let cancelled = false;
    if (isAuthLoading || !user?.id) return;
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
  }, [isAuthLoading, user?.id]);

  const avatars = sessionAvatarList;

  const selectedCompanionPreview = useMemo(() => {
    const name = showCustomizeModal ? tempSelectedAvatar : selectedAvatar;
    const preview = lobbyAvatarByName(name);
    return {
      ...preview,
      portraitUrl: preview.cardImage ?? resolveCompanionPortraitUrl(name),
    };
  }, [showCustomizeModal, tempSelectedAvatar, selectedAvatar]);

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

  const companionTraitsLine = useMemo(() => {
    const pty = selectedCompanionPreview.personality?.trim();
    if (!pty) return "Calm • Empathetic • Supportive";
    const parts = pty
      .split(/[,•|]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length >= 2) return parts.slice(0, 3).join(" • ");
    return pty;
  }, [selectedCompanionPreview]);

  const applyDurationPreset = useCallback((d: number) => {
    setSessionLengthKind("fixed");
    setSelectedDuration(d);
  }, []);

  const selectedAvatarRuntime = useMemo(
    () => resolveCompanionAvatarRuntime(selectedAvatar),
    [selectedAvatar]
  );

  const sessionLobbyButtonDisabled =
    isStarting ||
    minutesAvailable <= 0 ||
    selectedDuration > minutesAvailable ||
    selectedDuration < 1;

  const sessionLobbyDisabledReason = useMemo(() => {
    if (isStarting) return "isStarting";
    if (minutesAvailable <= 0) return "minutesAvailable<=0";
    if (selectedDuration > minutesAvailable) return "selectedDuration>minutesAvailable";
    if (selectedDuration < 1) return "selectedDuration<1";
    return null;
  }, [isStarting, minutesAvailable, selectedDuration]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionLobbyDiagnostics = {
      buttonDisabled: sessionLobbyButtonDisabled,
      disabledReason: sessionLobbyDisabledReason,
      blockingStates: {
        isStarting,
        noMinutesAvailable: minutesAvailable <= 0,
        selectedDurationExceedsBalance: selectedDuration > minutesAvailable,
        selectedDurationBelowMinimum: selectedDuration < 1,
      },
      isLoading: isLoadingSessions || isAuthLoading,
      isStarting,
      canStart: !sessionLobbyButtonDisabled,
      companionReady: Boolean(selectedCompanionPreview?.name),
      avatarReady: true,
      micReady: true,
      sessionReady: !isStarting,
      selectedCompanion: selectedCompanionPreview?.name ?? null,
      selectedAvatarRuntime,
    };
  }, [
    isAuthLoading,
    isLoadingSessions,
    isStarting,
    minutesAvailable,
    selectedCompanionPreview,
    selectedDuration,
    selectedAvatarRuntime,
    sessionLobbyButtonDisabled,
    sessionLobbyDisabledReason,
  ]);

  const selectFreeFlow = useCallback(() => {
    setSessionLengthKind("free");
    setSelectedDuration(Math.max(1, minutesAvailable));
  }, [minutesAvailable]);

  const persistEnvironmentSelection = useCallback(
    async (value: string) => {
      if (isSessionEnvironmentComingSoon(value)) {
        toast.info("Session backgrounds are coming soon");
        return;
      }
      setSelectedEnvironment(value);
      setTempSelectedEnvironment(value);
      try {
        await api.updateProfile({ selected_environment: value });
        await refreshProfile();
      } catch (err) {
        console.error(err);
        toast.error("Could not update environment");
      }
    },
    [refreshProfile],
  );

  const openScheduleFlow = useCallback(() => {
    setEditingScheduledSessionId(null);
    setScheduleAvatarOverride(null);
    setShowMinutesPicker(false);
    setSelectedMode("schedule");
    setShowScheduleModal(true);
  }, []);

  if (isLoadingSessions) {
    return (
      <div className="relative min-h-[calc(100dvh-5rem)] pb-28 text-[var(--solace-text)] lg:pb-12">
          <div className="relative z-[1] mx-auto max-w-[1680px] px-4 pt-6 sm:px-5 sm:pt-8 lg:px-8 lg:pt-10">
            <div className="mb-8 flex flex-col gap-2 border-b border-white/[0.05] pb-8">
              <Skeleton className="h-10 w-[14rem] rounded-lg bg-white/[0.06]" />
              <Skeleton className="h-4 w-[20rem] max-w-full rounded-md bg-white/[0.05]" />
            </div>
            <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_308px]">
              <div className="min-w-0 space-y-9">
                <Skeleton className="h-[252px] w-full rounded-[1.75rem] bg-white/[0.05]" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-28 rounded-[1.2rem] bg-white/[0.05]" />
                  ))}
                </div>
                <Skeleton className="h-24 w-full rounded-[1.2rem] bg-white/[0.05]" />
                <Skeleton className="h-40 w-full rounded-[1.2rem] bg-white/[0.05]" />
              </div>
              <div className="hidden min-w-0 space-y-5 xl:block">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-32 w-full rounded-[1.2rem] bg-white/[0.05]" />
                ))}
              </div>
            </div>
          </div>
      </div>
    );
  }

  return (
    <>
      <TalkItOutLobbyLayout
        companionPill={`Your Solace Avatar, ${selectedCompanionPreview.name}`}
        companionPortraitUrl={selectedCompanionPreview.portraitUrl}
        companionAlt={selectedCompanionPreview.name}
        companionDisplayName={selectedCompanionPreview.name}
        companionTraitsLine={companionTraitsLine}
        heroMessageLine1="I'm here to listen"
        heroMessageLine2="and support you."
        heroSupporting="Whatever is on your mind, you don't have to carry it alone."
        getSupportSlot={
          <Link to="/app/emergency-resources" className="inline-flex">
            <Button
              type="button"
              className="min-h-[44px] rounded-full bg-gradient-to-r from-violet-600/90 to-indigo-600/90 px-6 text-[13px] text-white shadow-[0_0_28px_rgba(76,29,149,0.35)] hover:from-violet-500 hover:to-indigo-500"
            >
              Get Support
            </Button>
          </Link>
        }
        minutesAvailable={minutesAvailable}
        durations={durations}
        durationDisabled={durationDisabled}
        selectedDuration={selectedDuration}
        applyDurationPreset={applyDurationPreset}
        isFreeFlowActive={sessionLengthKind === "free"}
        onSelectFreeFlow={selectFreeFlow}
        selectedMode={selectedMode}
        setSelectedMode={setSelectedMode}
        setShowMinutesPicker={setShowMinutesPicker}
        isStarting={isStarting}
        showCarveoutBanner={showCarveoutBanner}
        checklistItems={checklistItems}
        toggleChecklist={toggleChecklist}
        connectMode={connectMode}
        setConnectMode={setConnectMode}
        conversationEnergy={conversationEnergy}
        setConversationEnergy={setConversationEnergy}
        selectedEnvironment={selectedEnvironment}
        onEnvironmentSelect={(v) => void persistEnvironmentSelection(v)}
        onOpenCustomize={() => setShowCustomizeModal(true)}
        onOpenSchedule={openScheduleFlow}
        upcomingSessions={upcomingSessions}
        isLoadingUpcoming={false}
        onSelectUpcomingRow={(s) => {
          setActiveUpcomingSession(s as UpcomingSession);
          setShowUpcomingActionModal(true);
        }}
        onStartFreely={() => {
          setConnectMode("voice");
          setSelectedMode("now");
          setShowMinutesPicker(true);
        }}
        onStartGuided={() => {
          setSelectedMode("now");
          setShowMinutesPicker(true);
          toast("We'll begin with a few gentle questions when you're ready.");
        }}
        onStartDeep={() => {
          setConnectMode("deep");
          setSelectedMode("now");
          setShowMinutesPicker(true);
        }}
        onQuickCheckInNavigate={() => navigate("/app/mood-checkin")}
      />

        <AnimatePresence>
          {selectedMode === "now" && showMinutesPicker && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMinutesPicker(false)}
              className={cn(modalOverlay, "left-0 top-0 h-[100dvh] w-screen")}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                onClick={(e) => e.stopPropagation()}
                className={cn(modalPanel, "max-w-xl rounded-[1.25rem]")}
                role="dialog"
                aria-modal="true"
                aria-labelledby="talk-duration-title"
              >
                <div className={modalPanelHeader}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Clock
                        className="h-5 w-5 shrink-0 text-violet-300 [html[data-ezri-theme=light]_&]:text-[#7c3aed]"
                        aria-hidden
                      />
                      <div>
                        <h2 id="talk-duration-title" className={modalTitle}>
                          Choose talk duration
                        </h2>
                        <p className={modalSubtitle}>Pick how long you want to talk today.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMinutesPicker(false)}
                      className={cn(modalCloseButton, "rounded-full p-2")}
                      aria-label="Close"
                    >
                      <X className="h-5 w-5" aria-hidden />
                    </button>
                  </div>
                </div>

                <div className={modalPanelBody}>
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <p className={modalMutedText}>
                      Remaining: <span className={modalEmphasisText}>{minutesAvailable} min</span>
                    </p>
                    <span className={modalBadge}>Selected: {selectedDuration} min</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {durations.map((duration, index) => {
                      const isDisabled = !!durationDisabled.get(duration);
                      const isSelected =
                        selectedDuration === duration && sessionLengthKind === "fixed";
                      return (
                        <motion.button
                          key={duration}
                          type="button"
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.04 + index * 0.03 }}
                          onClick={() => {
                            if (isDisabled) return;
                            applyDurationPreset(duration);
                          }}
                          disabled={isDisabled}
                          aria-pressed={isSelected}
                          className={cn(
                            isDisabled
                              ? modalOptionCardDisabled
                              : isSelected
                                ? modalOptionCardSelected
                                : modalOptionCard
                          )}
                        >
                          <div className="text-2xl font-semibold">{duration}</div>
                          <div className={modalOptionCardMeta}>minutes</div>
                          {isSelected ? (
                            <Check
                              className="absolute right-3 top-3 h-4 w-4 text-violet-300 [html[data-ezri-theme=light]_&]:text-[#7c3aed]"
                              aria-hidden
                            />
                          ) : null}
                        </motion.button>
                      );
                    })}
                  </div>

                  <div className={modalInsetPanel}>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className={modalSectionTitle}>Custom minutes</p>
                      <p className={cn(modalLabel, "text-xs")}>1 – {minutesAvailable} min</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
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
                        className={cn(modalInput, "h-11 min-w-[120px] max-w-[12rem] sm:w-auto")}
                        placeholder="e.g. 22"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(modalSecondaryButton, "h-11 flex-none")}
                        onClick={applyCustomMinutes}
                        disabled={!isCustomMinutesValid}
                      >
                        Apply
                      </Button>
                    </div>
                    {customMinutesInput.trim() !== "" && !isCustomMinutesValid ? (
                      <p className="mt-2 text-xs text-rose-500">Enter a valid value between 1 and {minutesAvailable}.</p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => selectFreeFlow()}
                    disabled={minutesAvailable <= 0}
                    aria-pressed={isOnOwnPace}
                    className={isOnOwnPace ? modalFreeFlowCardSelected : modalFreeFlowCard}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className={cn("flex items-center gap-2 font-semibold", modalSectionTitle)}>
                        {isOnOwnPace ? (
                          <Check
                            className="h-4 w-4 text-amber-300 [html[data-ezri-theme=light]_&]:text-[#b45309]"
                            aria-hidden
                          />
                        ) : null}
                        Free flow · use full balance
                      </span>
                      <span className={modalMutedText}>{minutesAvailable} min</span>
                    </div>
                  </button>

                  <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(modalSecondaryButton, "flex-none")}
                      onClick={() => setShowMinutesPicker(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleStartSession()}
                      disabled={sessionLobbyButtonDisabled}
                      className={cn(modalPrimaryButton, "h-11 px-6")}
                    >
                      <Video className="mr-2 h-4 w-4 shrink-0" aria-hidden />
                      Let&apos;s Talk Now
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Customize Modal */}
        <AnimatePresence>
          {showCustomizeModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCustomizeModal(false)}
              // className={cn(modalOverlay, "left-0 top-0 h-[100dvh] w-screen")}
              className={cn(modalOverlay, "left-0 top-0 h-[100dvh] w-screen pb-[88px] md:pb-0")}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                onClick={(e) => e.stopPropagation()}
                // className={cn(modalPanelLg, "flex max-h-[85vh] flex-col rounded-[1.25rem]")}
                className={cn(modalPanelLg, "flex max-h-[calc(90dvh-88px)] flex-col overflow-hidden rounded-[1.25rem]")}
                role="dialog"
                aria-modal="true"
                aria-labelledby="customize-voice-avatar-title"
              >
                <div className={cn(modalPanelHeader, "flex shrink-0 items-center justify-between")}>
                  <div>
                    <h2
                      id="customize-voice-avatar-title"
                      className={cn(modalTitle, "font-serif text-[1.35rem] font-normal tracking-tight")}
                    >
                      Customize Voice & Avatar
                    </h2>
                    <p className={modalSubtitle}>Personalize your talking experience</p>
                  </div>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowCustomizeModal(false)}
                    className={cn(modalCloseButton, "rounded-full p-2")}
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" aria-hidden />
                  </motion.button>
                </div>

                <div className={cn(modalPanelBody, "solace-scroll min-h-0 flex-1 overflow-y-auto pb-28")}>
                      {/* Voice Selection */}
                      <div ref={voiceSectionRef} className="mb-8 scroll-mt-4">
                        <div className="mb-4 flex items-center gap-2">
                          <Volume2
                            className="h-5 w-5 shrink-0 text-violet-300 [html[data-ezri-theme=light]_&]:text-[#7c3aed] [html[data-theme=light]_&]:text-[#7c3aed]"
                            aria-hidden
                          />
                          <h3 className={cn(modalSectionTitle, "text-[17px] tracking-tight")}>
                            Voice Selection
                          </h3>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {voices.map((voice, index) => (
                            (() => {
                              const isDisabled = isVoiceDisabledForAvatar(voice.gender);
                              const isSelected = tempSelectedVoice === voice.name;
                              return (
                            <motion.button
                              key={voice.id}
                              type="button"
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.1 + index * 0.05 }}
                              whileHover={isDisabled ? undefined : { scale: 1.01 }}
                              whileTap={isDisabled ? undefined : { scale: 0.99 }}
                              onClick={() => void handleVoiceSelect(voice.name, voice.gender, voice.demoFile)}
                              disabled={isDisabled}
                              className={cn(
                                "rounded-[1.1rem]",
                                isDisabled
                                  ? modalOptionCardDisabled
                                  : isSelected
                                    ? modalOptionCardSelected
                                    : modalOptionCard
                              )}
                            >
                              {isSelected && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="absolute right-2.5 top-2.5 rounded-full bg-violet-500 p-1 shadow-[0_0_12px_rgba(139,92,246,0.45)]"
                                >
                                  <Check
                                    className="h-3 w-3 text-[#ffffff] [html[data-ezri-theme=light]_&]:text-[#ffffff]"
                                    aria-hidden
                                  />
                                </motion.div>
                              )}
                              <div className={modalEmphasisText}>{voice.name}</div>
                              <div className={cn(modalMutedText, "mb-2 mt-1 text-sm")}>
                                {voice.description}
                              </div>
                              <div className={cn(modalOptionCardMeta, "flex items-center gap-1.5")}>
                                <span className="inline-block h-2 w-2 rounded-full bg-violet-400/80 [html[data-ezri-theme=light]_&]:bg-[#7c3aed]" />
                                {voice.gender}
                              </div>
                              <div className={modalOptionCardMeta}>
                                {isDisabled
                                  ? "Disabled for selected avatar"
                                  : playingVoiceName === voice.name
                                  ? "Playing demo..."
                                  : "Click to preview"}
                              </div>
                            </motion.button>
                              );
                            })()
                          ))}
                        </div>
                      </div>

                      {/* Avatar Selection */}
                      <div ref={avatarSectionRef} className="mb-8 scroll-mt-4">
                        <div className="mb-4 flex items-center gap-2">
                          <User
                            className="h-5 w-5 shrink-0 text-violet-300 [html[data-ezri-theme=light]_&]:text-[#7c3aed] [html[data-theme=light]_&]:text-[#7c3aed]"
                            aria-hidden
                          />
                          <h3 className={cn(modalSectionTitle, "text-[17px] tracking-tight")}>
                            Avatar Selection
                          </h3>
                        </div>
                        <div className="grid grid-cols-2 items-stretch gap-3">
                          {avatars.map((avatar, index) => {
                            const isSelected = tempSelectedAvatar === avatar.name;
                            const comingSoon = isCompanionComingSoon(avatar.name);
                            const traits =
                              avatar.personality?.trim() ||
                              avatar.description?.trim() ||
                              "Supportive companion";
                            return (
                            <motion.button
                              key={avatar.id}
                              type="button"
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.3 + index * 0.05 }}
                              whileHover={comingSoon ? undefined : { scale: 1.01 }}
                              whileTap={comingSoon ? undefined : { scale: 0.99 }}
                              disabled={comingSoon}
                              onClick={() => {
                                if (!comingSoon) setTempSelectedAvatar(avatar.name);
                              }}
                              aria-pressed={isSelected}
                              aria-disabled={comingSoon}
                              className={cn(
                                "group relative flex h-full w-full flex-col overflow-hidden rounded-[1rem] p-0 text-left transition-[border-color,box-shadow,transform] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/45",
                                comingSoon
                                  ? cn(modalOptionCardDisabled, "opacity-90")
                                  : isSelected
                                    ? cn(modalOptionCardSelected, "ring-1 ring-violet-400/25")
                                    : modalOptionCard
                              )}
                            >
                              {comingSoon ? <ComingSoonOverlay /> : null}
                              <span className={companionCardPortraitFrameClass}>
                                {avatar.cardImage ? (
                                  <img
                                    src={avatar.cardImage}
                                    alt=""
                                    className={companionCardPortraitImgClass}
                                    loading="lazy"
                                    decoding="async"
                                  />
                                ) : (
                                  <span className="flex h-full w-full items-center justify-center">
                                    <User
                                      className="h-10 w-10 text-zinc-600 [html[data-ezri-theme=light]_&]:text-[var(--text-muted)]"
                                      aria-hidden
                                    />
                                  </span>
                                )}
                                {isSelected ? (
                                  <motion.span
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.5)]"
                                  >
                                    <Check
                                      className="h-3 w-3 text-[#ffffff]"
                                      strokeWidth={2.5}
                                      aria-hidden
                                    />
                                  </motion.span>
                                ) : null}
                              </span>
                              <span
                                className={cn(
                                  "flex min-h-[4.5rem] flex-col justify-center border-t px-3 py-2.5",
                                  "border-white/[0.06] bg-black/40",
                                  "[html[data-ezri-theme=light]_&]:border-[color:var(--border)]",
                                  "[html[data-ezri-theme=light]_&]:bg-[var(--card-muted,#f8f3ff)]",
                                  "[html[data-theme=light]_&]:border-[color:var(--border)]",
                                  "[html[data-theme=light]_&]:bg-[var(--card-muted,#f8f3ff)]"
                                )}
                              >
                                <p className={cn(modalEmphasisText, "text-[13px] leading-tight")}>
                                  {avatar.name}
                                </p>
                                <p className={cn(modalMutedText, "mt-1 line-clamp-2 text-[10.5px] leading-snug")}>
                                  {traits}
                                </p>
                              </span>
                            </motion.button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Session background (environment) */}
                      <div ref={environmentSectionRef} className="mb-2 scroll-mt-4">
                        <div className="mb-4 flex items-center gap-2">
                          <Palette
                            className="h-5 w-5 shrink-0 text-violet-300 [html[data-ezri-theme=light]_&]:text-[#7c3aed] [html[data-theme=light]_&]:text-[#7c3aed]"
                            aria-hidden
                          />
                          <h3 className={cn(modalSectionTitle, "text-[17px] tracking-tight")}>
                            Talking Background
                          </h3>
                        </div>
                        <p className={cn(modalMutedText, "mb-4 text-sm")}>
                          Choose a calming background for your video sessions
                        </p>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {SESSION_ENVIRONMENTS.map((env, index) => {
                            const isSelected = tempSelectedEnvironment === env.value;
                            const comingSoon = isSessionEnvironmentComingSoon(env.value);
                            return (
                            <motion.button
                              key={env.value}
                              type="button"
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.05 * index }}
                              whileHover={comingSoon ? undefined : { scale: 1.02 }}
                              whileTap={comingSoon ? undefined : { scale: 0.98 }}
                              disabled={comingSoon}
                              onClick={() => {
                                if (!comingSoon) setTempSelectedEnvironment(env.value);
                              }}
                              aria-pressed={isSelected}
                              aria-disabled={comingSoon}
                              className={cn(
                                "relative overflow-hidden rounded-xl p-0 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/45",
                                comingSoon
                                  ? cn(modalOptionCardDisabled, "opacity-90")
                                  : isSelected
                                    ? cn(modalOptionCardSelected, "ring-1 ring-violet-400/25")
                                    : modalOptionCard
                              )}
                            >
                              {comingSoon ? <ComingSoonOverlay /> : null}
                              <div
                                className={cn(
                                  "flex h-20 items-center justify-center bg-gradient-to-br",
                                  env.gradient
                                )}
                              >
                                <span className="flex items-center justify-center text-3xl leading-none">
                                  <FluentEmoji emoji={env.emoji} size={36} />
                                </span>
                              </div>
                              <div
                                className={cn(
                                  "border-t px-2.5 py-2",
                                  "border-white/[0.06] bg-black/35",
                                  "[html[data-ezri-theme=light]_&]:border-[color:var(--border)]",
                                  "[html[data-ezri-theme=light]_&]:bg-[var(--card-muted,#f8f3ff)]",
                                  "[html[data-theme=light]_&]:border-[color:var(--border)]",
                                  "[html[data-theme=light]_&]:bg-[var(--card-muted,#f8f3ff)]"
                                )}
                              >
                                <p className={cn(modalEmphasisText, "text-sm")}>{env.label}</p>
                              </div>
                            </motion.button>
                            );
                          })}
                        </div>
                      </div>
                </div>

                <div
                  className={cn(
                    modalPanelHeader,
                    "flex shrink-0 items-center justify-end gap-3 border-b-0 border-t"
                  )}
                >
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSavingCustomize}
                    onClick={() => setShowCustomizeModal(false)}
                    className={cn(modalSecondaryButton, "flex-none")}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={isSavingCustomize}
                    aria-busy={isSavingCustomize}
                    className={cn(modalPrimaryButton, "min-w-[148px]")}
                    onClick={() => void handleSaveCustomize()}
                  >
                    {isSavingCustomize ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" aria-hidden />
                        Saving…
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4 shrink-0" aria-hidden />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Schedule Modal */}
        <AnimatePresence>
          {showScheduleModal && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeScheduleModal}
                className="fixed left-0 top-0 z-50 flex h-[100dvh] w-screen items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex max-h-[85vh] w-full max-w-2xl flex-col"
                >
                  <Card className="flex max-h-[85vh] flex-col overflow-hidden rounded-[1.25rem] border border-white/[0.08] bg-zinc-950/95 text-zinc-100 shadow-2xl">
                    <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] bg-black/35 px-6 py-5">
                      <div>
                        <h2 className="font-serif text-[1.35rem] font-normal tracking-tight text-zinc-50">
                          {editingScheduledSessionId ? "Edit Scheduled Talk" : "Schedule a Talk"}
                        </h2>
                        <p className="mt-1 text-sm text-[var(--solace-muted)]">
                          Pick a date and time for your next talk
                        </p>
                      </div>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={closeScheduleModal}
                        className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-200"
                        aria-label="Close"
                      >
                        <X className="h-5 w-5" />
                      </motion.button>
                    </div>

                    <div className="solace-scroll overflow-y-auto p-6">
                      <div className="mb-8">
                        <div className="mb-4 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-violet-300" aria-hidden />
                            <h3 className="text-[17px] font-medium tracking-tight text-zinc-100">
                              Talking Minutes
                            </h3>
                          </div>
                          <span className="text-xs text-zinc-500">
                            Selected: <span className="text-zinc-300">{selectedDuration} min</span>
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                                className={cn(
                                  "rounded-[1.1rem] border p-3 text-center transition-all",
                                  isDisabled
                                    ? "cursor-not-allowed border-white/[0.05] bg-black/20 opacity-40"
                                    : isSelected
                                      ? "border-violet-400/45 bg-violet-500/[0.12] shadow-[0_0_24px_rgba(139,92,246,0.2)]"
                                      : "border-white/[0.08] bg-black/28 text-zinc-100 hover:border-violet-400/28"
                                )}
                              >
                                <div className="text-lg font-semibold">{duration}</div>
                                <div className="text-[10px] text-zinc-500">min</div>
                              </button>
                            );
                          })}
                        </div>
                        <p className="mt-2 text-xs text-[var(--solace-muted)]">
                          Minutes available:{" "}
                          <span className="font-medium text-zinc-300">{minutesAvailable}</span>
                        </p>
                      </div>

                      <div className="mb-8">
                        <div className="mb-4 flex items-center gap-2">
                          <Calendar className="h-5 w-5 text-violet-300" aria-hidden />
                          <h3 className="text-[17px] font-medium tracking-tight text-zinc-100">Date & Time</h3>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <label className="block rounded-[1.1rem] border border-white/[0.08] bg-black/28 px-4 py-3">
                            <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                              Date
                            </span>
                            <input
                              type="date"
                              value={scheduleDate}
                              onChange={(e) => setScheduleDate(e.target.value)}
                              className="w-full border-none bg-transparent p-0 text-sm text-zinc-100 outline-none [color-scheme:dark]"
                            />
                          </label>
                          <label className="block rounded-[1.1rem] border border-white/[0.08] bg-black/28 px-4 py-3">
                            <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                              Time
                            </span>
                            <input
                              type="time"
                              value={scheduleTime}
                              onChange={(e) => setScheduleTime(e.target.value)}
                              className="w-full border-none bg-transparent p-0 text-sm text-zinc-100 outline-none [color-scheme:dark]"
                            />
                          </label>
                        </div>
                      </div>

                      <div className="mb-2">
                        <div className="mb-4 flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-violet-300" aria-hidden />
                          <h3 className="text-[17px] font-medium tracking-tight text-zinc-100">Add a note</h3>
                        </div>
                        <label className="block rounded-[1.1rem] border border-white/[0.08] bg-black/28 px-4 py-3">
                          <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                            Comment
                          </span>
                          <textarea
                            value={scheduleComment}
                            onChange={(e) => setScheduleComment(e.target.value)}
                            rows={3}
                            placeholder="Optional: what would you like to focus on next time?"
                            className="w-full resize-none border-none bg-transparent p-0 text-sm leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-600"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-end gap-3 border-t border-white/[0.06] bg-black/35 p-6">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={closeScheduleModal}
                        disabled={isScheduling}
                        className="border-white/[0.1] bg-transparent text-zinc-100 hover:bg-white/[0.04]"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        className="min-w-[132px] bg-gradient-to-r from-violet-600 via-fuchsia-600 to-indigo-700 text-white shadow-[0_0_32px_rgba(139,92,246,0.35)] hover:opacity-95"
                        onClick={handleScheduleSession}
                        isLoading={isScheduling}
                        disabled={
                          isScheduling ||
                          selectedDuration > minutesAvailable ||
                          selectedDuration < 1
                        }
                      >
                        <Check className="mr-2 h-4 w-4 shrink-0" aria-hidden />
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
              className={cn(modalOverlay, "left-0 top-0 h-[100dvh] w-screen")}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                onClick={(e) => e.stopPropagation()}
                className={cn(modalPanelMd, "rounded-[1.25rem]")}
                role="dialog"
                aria-modal="true"
              >
                <div className={modalPanelHeader}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className={modalTitle}>Talking Options</h3>
                      <p className={modalSubtitle}>
                        {activeUpcomingSession.avatarName} • Choose minutes and action
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowUpcomingActionModal(false)}
                      className={cn(modalCloseButton, "rounded-full p-2")}
                      aria-label="Close"
                    >
                      <X className="h-5 w-5" aria-hidden />
                    </button>
                  </div>
                </div>

                <div className={modalPanelBody}>
                  <div className="grid grid-cols-4 gap-2">
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
                            applyDurationPreset(duration);
                          }}
                          className={cn(
                            "rounded-[1.1rem] p-3 text-center",
                            isDisabled
                              ? modalOptionCardDisabled
                              : isSelected
                                ? modalOptionCardSelected
                                : modalOptionCard
                          )}
                        >
                          <div className="text-lg font-semibold">{duration}</div>
                          <div className={modalOptionCardMeta}>min</div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between gap-3 text-xs">
                    <p className={modalMutedText}>
                      Minutes available:{" "}
                      <span className={modalEmphasisText}>{minutesAvailable}</span>
                    </p>
                    <span className={modalBadge}>Selected: {selectedDuration} min</span>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      className={cn(modalPrimaryButton, "flex-1")}
                      isLoading={isStarting}
                      onClick={() => {
                        void handleStartSession({
                          avatarOverride: activeUpcomingSession.avatarName,
                          scheduledSessionId: activeUpcomingSession.id,
                        });
                      }}
                      disabled={isStarting || selectedDuration > minutesAvailable || selectedDuration < 1}
                    >
                      Start Now
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(modalSecondaryButton, "flex-1")}
                      onClick={() => {
                        setShowUpcomingActionModal(false);
                        setSelectedMode("schedule");
                        setScheduleAvatarOverride(activeUpcomingSession.avatarName);
                        setEditingScheduledSessionId(activeUpcomingSession.id);
                        setSelectedDuration(activeUpcomingSession.durationMinutes || selectedDuration);
                        setScheduleComment(activeUpcomingSession.comment ?? "");
                        setScheduleIcon(activeUpcomingSession.icon ?? "💬");
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
                      className={cn(
                        modalSecondaryButton,
                        "flex-1 border-red-500/30 text-red-400 hover:border-red-400/40 hover:bg-red-500/10",
                        "[html[data-ezri-theme=light]_&]:border-red-300 [html[data-ezri-theme=light]_&]:text-red-600 [html[data-ezri-theme=light]_&]:hover:bg-red-50",
                        "[html[data-theme=light]_&]:border-red-300 [html[data-theme=light]_&]:text-red-600 [html[data-theme=light]_&]:hover:bg-red-50"
                      )}
                      onClick={() => {
                        void handleCancelScheduledSession();
                      }}
                      disabled={isCancelingScheduled}
                    >
                      {isCancelingScheduled ? "Canceling..." : "Cancel Talk"}
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
    </>
  );
}
