import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  type MutableRefObject,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useSafety } from "@/app/contexts/SafetyContext";
import { useAuth } from "@/app/contexts/AuthContext";
import { api } from "@/lib/api";
import {
  parseSessionBackdropPreference,
  resolveSessionBackdropLayers,
  SESSION_BACKDROP_EMOJI_OPTIONS,
  SESSION_BACKDROP_STORAGE_KEY,
  type SessionBackdropPreference,
} from "@/lib/sessionBackdropPresets";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
// import { analyzeTextForSafety } from "@/app/utils/safetyDetection";
import { analyzeTextForSafety } from "@/app/utils/safetyDetection";
import { getSafetyResources } from "@/app/utils/safetyResources";
import { getCurrentRegion, getEmergencyResources, getRegionInfo } from "@/app/utils/safetyResources";
import { getEzriConfig } from "@/lib/ezri/config";
import { getOrCreateEzriUserid } from "@/lib/ezri/ids";
import { createEzriApiClient } from "@/lib/ezri/apiClient";
import {
  EzriRealtimeClient,
  type EzriAvatarData,
  type EzriWsStatus,
} from "@/lib/ezri/realtimeClient";
import { resolveEzriWsVoiceForCompanion } from "@/lib/ezri/voiceForCompanion";
import { normalizeAudioSource, toObjectUrl } from "@/lib/ezri/audio";
import {
  normalizeCompanionId,
  companionSessionUsesRfv2Morphs,
  companionSessionUses3dModel,
  resolveCompanionModelUrl,
  resolveCompanionPortraitUrl,
} from "@/lib/avatar/companionModelUrl";
import {
  getCompanionViewTuning,
  type CompanionViewTuning,
} from "@/lib/avatar/companionViewTuning";
import { SARA_V2_AVATAR_DEFINITION } from "@/lib/avatar/configs/saraV2Config";
import type { AvatarPhonemeTimeline } from "@/lib/avatar/avatarMorphTypes";
import { normalizeAvatarPhonemeTimeline } from "@/lib/avatar/phonemeToViseme";
import * as THREE from "three";
import { ActiveSessionView } from "./components";
import type { FixedAvatarViewportConfig } from "./components/ThreeAvatar";
import {
  extractJordanSentimentCompound,
  getSpeechOpennessAt,
} from "./utils/speech";
import { CRISIS_KEYWORD_MODAL_ENABLED, EZRI_PCM_BUFFER_SIZE } from "./constants";
import { useLiveUserSpeechStore } from "./hooks/useLiveUserSpeechStore";
import { moodEmojiForLabel } from "./utils/moodEmoji";
import {
  mergeUserTranscriptAppend,
  type TranscriptLine,
  USER_TRANSCRIPT_MERGE_WINDOW_MS,
  USER_SAME_SPEECH_BURST_MS,
} from "./utils/transcript";
import { getConnectionQualityColor } from "./utils/sessionFormat";
import { usesBrowserStt, usesServerPcmStt } from "./utils/sttMode";
import {
  createPcmCaptureAudioContext,
  downsampleFloat32To16k,
  EZRI_PCM_SAMPLE_RATE,
  float32ToInt16Pcm,
  int16PcmToArrayBuffer,
} from "./utils/pcmStream";
import { usePipDrag } from "./hooks/usePipDrag";

type SaraGreetingSyncState = {
  id: number;
  sentence: string;
  audioReceived: number;
  avatarDataReceived: number | null;
};

type WsAudioQueueItem = {
  subtitle: string;
  audio: unknown;
  avatarData: EzriAvatarData | null;
  audioReceived: number | null;
  avatarDataReceived: number | null;
  saraGreetingSync?: SaraGreetingSyncState;
};

type SaraGreetingDiagnostics = {
  greetingSentence: string;
  audioReceived: number | null;
  avatarDataReceived: number | null;
  timelineAttached: boolean;
  phonemeCount: number;
  firstPhoneme: {
    phoneme: string;
    start: number;
    end: number | null;
  } | null;
  firstViseme: string | null;
  playbackStart: number | null;
  firstVisemeTime: number | null;
  deltaMs: number | null;
};

type SaraLiveAvatarMode = "hybrid" | "rfv2";

const SARA_LIVE_RFV2_MODEL_URL = "/avatars/sara.glb";
const isDevSaraLiveRfv2PreviewAllowed = () => import.meta.env.DEV === true;

export function ActiveSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, refreshProfile, session } = useAuth();
  const { sessionId: stateSessionId, duration, config } = location.state || {};

  const viewerFirstName = useMemo(() => {
    const full =
      typeof profile?.full_name === "string" ? profile.full_name.trim() : "";
    if (full) return full.split(/\s+/)[0] || "You";
    const metaFull =
      typeof (user?.user_metadata as { full_name?: string } | undefined)
        ?.full_name === "string"
        ? String(
          (user?.user_metadata as { full_name?: string }).full_name
        ).trim()
        : "";
    if (metaFull) return metaFull.split(/\s+/)[0] || "You";
    return "You";
  }, [profile?.full_name, user?.user_metadata]);

  const [wallNow, setWallNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setWallNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const sessionGreeting = useMemo(() => {
    const h = wallNow.getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, [wallNow]);

  const companionAvatarLabel =
    typeof config?.avatar === "string" ? config.avatar : undefined;

  const sessionUsesCompanion3d = useMemo(
    () => companionSessionUses3dModel(companionAvatarLabel),
    [companionAvatarLabel]
  );

  const sessionUsesRfv2Morphs = useMemo(
    () => companionSessionUsesRfv2Morphs(companionAvatarLabel),
    [companionAvatarLabel]
  );

  const companionCanonicalId = useMemo(
    () => normalizeCompanionId(companionAvatarLabel),
    [companionAvatarLabel]
  );

  const [saraLiveAvatarMode, setSaraLiveAvatarMode] =
    useState<SaraLiveAvatarMode>(() => {
      if (!isDevSaraLiveRfv2PreviewAllowed()) return "hybrid";
      if (typeof window === "undefined") return "hybrid";
      return new URLSearchParams(window.location.search).get("saraMode") === "rfv2"
        ? "rfv2"
        : "hybrid";
    });

  const showSaraLiveRfv2ModeSwitch =
    isDevSaraLiveRfv2PreviewAllowed() && companionCanonicalId === "sarah";
  const saraLiveRfv2PreviewEnabled =
    showSaraLiveRfv2ModeSwitch && saraLiveAvatarMode === "rfv2";

  useEffect(() => {
    if (companionCanonicalId !== "sarah" && saraLiveAvatarMode !== "hybrid") {
      setSaraLiveAvatarMode("hybrid");
    }
  }, [companionCanonicalId, saraLiveAvatarMode]);

  const companionModelUrl = useMemo(
    () =>
      saraLiveRfv2PreviewEnabled
        ? SARA_LIVE_RFV2_MODEL_URL
        : resolveCompanionModelUrl(companionAvatarLabel),
    [companionAvatarLabel, saraLiveRfv2PreviewEnabled]
  );

  const companionPortraitUrl = useMemo(
    () => resolveCompanionPortraitUrl(companionAvatarLabel),
    [companionAvatarLabel]
  );

  const companionViewTuning = useMemo(
    () => getCompanionViewTuning(companionAvatarLabel),
    [companionAvatarLabel]
  );

  const companionFixedViewportConfig = useMemo<FixedAvatarViewportConfig | null>(
    () =>
      companionCanonicalId === "sarah"
        ? {
            debugLabel: "Sara",
            avatarId: SARA_V2_AVATAR_DEFINITION.id,
            camera: SARA_V2_AVATAR_DEFINITION.camera,
            gltfTransform: SARA_V2_AVATAR_DEFINITION.gltfTransform,
          }
        : null,
    [companionCanonicalId]
  );

  useEffect(() => {
    if (companionCanonicalId !== "sarah") return;
    console.log("[Sara Route]", {
      rawAvatar: companionAvatarLabel,
      normalizedAvatarId: companionCanonicalId,
      activeAvatarId: companionCanonicalId,
      modelUrl: companionModelUrl,
      uses3d: sessionUsesCompanion3d,
      useRfv2Morphs: sessionUsesRfv2Morphs,
      saraLiveAvatarMode,
      saraLiveRfv2PreviewEnabled,
      hasFixedViewportConfig: Boolean(companionFixedViewportConfig),
      cameraConfig: companionFixedViewportConfig?.camera ?? null,
      gltfTransformConfig: companionFixedViewportConfig?.gltfTransform ?? null,
    });
  }, [
    companionAvatarLabel,
    companionCanonicalId,
    companionFixedViewportConfig,
    companionModelUrl,
    saraLiveAvatarMode,
    saraLiveRfv2PreviewEnabled,
    sessionUsesCompanion3d,
    sessionUsesRfv2Morphs,
  ]);

  const handleSaraLiveAvatarModeChange = useCallback(
    (mode: SaraLiveAvatarMode) => {
      if (!showSaraLiveRfv2ModeSwitch) return;
      setSaraLiveAvatarMode(mode);
    },
    [showSaraLiveRfv2ModeSwitch]
  );

  const handleSaraLiveRfv2Fallback = useCallback((reason: string) => {
    setSaraLiveAvatarMode("hybrid");
    toast.warning(`Sara RFv2 Preview fell back to Current Hybrid: ${reason}`);
  }, []);

  useEffect(() => {
    if (!isDevSaraLiveRfv2PreviewAllowed() || companionCanonicalId !== "sarah") {
      return;
    }
    if (typeof window === "undefined" || saraLiveRfv2PreviewEnabled) return;
    (window as any).saraLiveRfv2Diagnostics = {
      mode: "Current Hybrid",
      modelPath: companionModelUrl,
      rfv2Enabled: false,
      faceBound: false,
      boundMeshes: [],
      activePhoneme: null,
      activeViseme: null,
      rawTargets: {},
      smoothedTargets: {},
      appliedMorphs: {},
      missingMorphs: [],
      blockedMorphs: [],
      fallbackReason: null,
    };
  }, [companionCanonicalId, companionModelUrl, saraLiveRfv2PreviewEnabled]);

  /** Same id as WebSocket `voice=` â€” must be sent on REST speak/chat too or TTS often defaults to one (female) voice. */
  const ezriTtsVoiceId = useMemo(
    () =>
      resolveEzriWsVoiceForCompanion(
        companionAvatarLabel,
        typeof config?.voice === "string" ? config.voice : undefined
      ),
    [companionAvatarLabel, config?.voice]
  );

  const ezriConfig = useMemo(() => {
    try {
      return getEzriConfig();
    } catch (e: any) {
      // Donâ€™t crash the whole session UI if env is missing; surface actionable error.
      console.error(e);
      toast.error(e?.message || "Ezri env is missing/misconfigured.");
      return null;
    }
  }, []);

  const apiSessionId = useMemo(() => {
    if (typeof stateSessionId === "string" && stateSessionId.length > 0) return stateSessionId;
    try {
      const fromQuery = new URLSearchParams(location.search).get("sessionId");
      if (fromQuery) return fromQuery;
    } catch { }
    try {
      const fromStorage = window.localStorage.getItem("ezri_active_session_id");
      if (fromStorage) return fromStorage;
    } catch { }
    return null;
  }, [stateSessionId, location.search]);

  useEffect(() => {
    if (!apiSessionId) return;
    try {
      window.localStorage.setItem("ezri_active_session_id", apiSessionId);
    } catch { }
  }, [apiSessionId]);

  const permissionStorageKey = useMemo(() => {
    if (typeof window === "undefined") return "ezri_media_permissions";
    if (!user?.id) return "ezri_media_permissions";
    return `ezri_media_permissions_${user.id}`;
  }, [user?.id]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamCleanupRef = useRef<MediaStream | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const ezriWarmupReadyRef = useRef(false);
  const pendingMediaEntryRef = useRef(false);
  const prePermissionAudioQueueRef = useRef<WsAudioQueueItem[]>([]);
  const prePermissionTranscriptRef = useRef<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [pendingMediaEntry, setPendingMediaEntry] = useState(false);

  const requestMediaAccess = useCallback(async () => {
    type DOMErr = { name?: string; message?: string; constraint?: string };

    // â”€â”€ Step 1: microphone (required) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let audioStream: MediaStream;
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
    } catch (err: unknown) {
      const e = err as DOMErr;
      console.error("MEDIA ACCESS FAILED â€” microphone", {
        name: e?.name,
        message: e?.message,
        constraint: e?.constraint,
      });
      if (e?.name === "NotAllowedError") {
        toast.error(
          "Microphone access was denied. Please allow microphone access in your browser's address bar and try again."
        );
      } else if (e?.name === "NotFoundError") {
        toast.error(
          "No microphone found. Please connect a microphone and try again."
        );
      } else {
        toast.error(
          "Could not access microphone. Please check your device settings and try again."
        );
      }
      // microphone is required â€” keep modal open
      return;
    }

    // â”€â”€ Step 2: camera (optional â€” voice-only fallback on any hardware error) â”€
    let videoStream: MediaStream | null = null;
    try {
      videoStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
    } catch (err: unknown) {
      const e = err as DOMErr;
      console.error("MEDIA ACCESS FAILED â€” camera", {
        name: e?.name,
        message: e?.message,
        constraint: e?.constraint,
      });
      const isCameraUnavailable =
        e?.name === "AbortError" ||
        e?.name === "NotReadableError" ||
        e?.name === "NotFoundError";
      const isPermissionDenied = e?.name === "NotAllowedError";

      if (isPermissionDenied) {
        toast.error(
          "Camera access was denied. Continuing with microphone only."
        );
      } else if (isCameraUnavailable) {
        toast.warning(
          "Camera could not start. Continuing with microphone only."
        );
      } else {
        toast.warning(
          "Camera unavailable. Continuing with microphone only."
        );
      }
      setIsCameraOff(true);
      // videoStream stays null â€” session continues in voice-only mode
    }

    // â”€â”€ Step 3: combine tracks and attach â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const tracks = [
      ...audioStream.getAudioTracks(),
      ...(videoStream ? videoStream.getVideoTracks() : []),
    ];
    const combinedStream = new MediaStream(tracks);
    const hasLiveVideoTrack = combinedStream
      .getVideoTracks()
      .some((track) => track.readyState === "live");

    setStream(combinedStream);
    setIsCameraOff(!hasLiveVideoTrack);
    if (videoRef.current) videoRef.current.srcObject = combinedStream;
    pendingMediaEntryRef.current = true;
    setPendingMediaEntry(true);

    // Unlock AudioContext inside this user-gesture so Firefox allows audio.play() later.
    if (!audioUnlockedRef.current) {
      try {
        const AudioCtx =
          window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          let ctx = playbackAudioContextRef.current;
          if (!ctx || ctx.state === "closed") {
            ctx = new AudioCtx();
            playbackAudioContextRef.current = ctx;
          }
          if (ctx.state === "suspended") await ctx.resume();
          // Play a 0.1s silent buffer to satisfy autoplay policies.
          const buf = ctx.createBuffer(1, ctx.sampleRate / 10, ctx.sampleRate);
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.connect(ctx.destination);
          src.start();
          audioUnlockedRef.current = true;
          console.log("[Audio] AudioContext unlocked via user gesture, state:", ctx.state);
        }
      } catch (unlockErr) {
        console.warn("[Audio] AudioContext unlock failed (non-fatal):", unlockErr);
      }
    }

    // Prime mic-capture AudioContext in the same user gesture (Firefox blocks contexts
    // created later in useEffect — ScriptProcessor would never run / sends silence).
    try {
      let pcmCtx = pcmCaptureAudioContextRef.current;
      if (!pcmCtx || pcmCtx.state === "closed") {
        pcmCtx = await createPcmCaptureAudioContext();
        pcmCaptureAudioContextRef.current = pcmCtx;
      } else if (pcmCtx.state === "suspended") {
        await pcmCtx.resume();
      }
      console.log(
        "[PCM] Capture AudioContext primed on user gesture, rate:",
        pcmCtx.sampleRate,
        "state:",
        pcmCtx.state,
      );
    } catch (pcmErr) {
      console.warn("[PCM] Failed to prime capture AudioContext (will retry on connect):", pcmErr);
    }

    try {
      if (
        typeof window !== "undefined" &&
        typeof window.localStorage !== "undefined"
      ) {
        window.localStorage.setItem(permissionStorageKey, JSON.stringify(true));
      }
    } catch (storageErr) {
      console.error("Failed to save media permission flag:", storageErr);
    }
  }, [permissionStorageKey]);

  useEffect(() => {
    const restoreMediaPermissions = async () => {
      try {
        const saved = localStorage.getItem(permissionStorageKey);

        if (saved === "true") {
          // silently restore previously granted devices; finalizeSessionEntry runs after warmup
          await requestMediaAccess();
        } else {
          setShowPermissionRequest(true);
        }
      } catch (err) {
        console.error("Failed to restore media permissions:", err);
        setShowPermissionRequest(true);
      }
    };

    restoreMediaPermissions();
  }, [permissionStorageKey, requestMediaAccess]);

  const { currentState, updateState } = useSafety();
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSoundOff, setIsSoundOff] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [isEzriSpeaking, setIsEzriSpeaking] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<
    "excellent" | "good" | "poor"
  >("excellent");
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sessionStatsOpen, setSessionStatsOpen] = useState(true);
  const [sessionBackdropPreference, setSessionBackdropPreference] =
    useState<SessionBackdropPreference>(() =>
      typeof window !== "undefined"
        ? parseSessionBackdropPreference(
          localStorage.getItem(SESSION_BACKDROP_STORAGE_KEY),
        )
        : "auto",
    );
  const [roomMoodPickerOpen, setRoomMoodPickerOpen] = useState(false);

  /** Toggle camera â€” if the session started mic-only (camera denied / failed), turning â€œonâ€ must acquire video. */
  const handleCameraToggle = useCallback(async () => {
    if (!stream) {
      setIsCameraOff((v) => !v);
      return;
    }
    if (!isCameraOff) {
      setIsCameraOff(true);
      return;
    }
    const hasUsableVideo = stream
      .getVideoTracks()
      .some((t) => t.readyState === "live");
    if (hasUsableVideo) {
      setIsCameraOff(false);
      return;
    }
    try {
      const vs = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      stream.getVideoTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          /* noop */
        }
      });
      const nextTracks = [...stream.getAudioTracks(), ...vs.getVideoTracks()];
      const nextStream = new MediaStream(nextTracks);
      setStream(nextStream);
      if (videoRef.current) videoRef.current.srcObject = nextStream;
      setIsCameraOff(false);
      toast.success("Camera on");
    } catch (err: unknown) {
      const e = err as { name?: string };
      console.error("Camera could not be enabled:", err);
      toast.error(
        e?.name === "NotAllowedError"
          ? "Camera is blocked. Allow camera in the site settings (address bar), then try again."
          : "Could not start the camera. Check permissions or that no other app is using it."
      );
      setIsCameraOff(true);
    }
  }, [stream, isCameraOff]);

  const sessionContainerRef = useRef<HTMLDivElement>(null);
  const leftSessionChromeRef = useRef<HTMLDivElement>(null);
  const { pipPos, handlePipPointerDown, handlePipPointerMove, handlePipPointerUp } =
    usePipDrag({ sessionContainerRef, leftSessionChromeRef });

  /** Start true so we never paint one frame of â€œlive sessionâ€ before the consent UI (and never connect WS/STT without a stream). */
  const [showPermissionRequest, setShowPermissionRequest] = useState(true);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [permissionStateInitialized, setPermissionStateInitialized] =
    useState(false);
  /** Pipeline warmup while the permission modal is visible (Ezri Avatar app.js parity). */
  const [ezriWarmupStatus, setEzriWarmupStatus] = useState<"idle" | "warming" | "ready">("idle");
  const permissionsGrantedRef = useRef(false);
  const flushWsAudioQueueRef = useRef<() => void>(() => {});

  const [transcript, setTranscript] = useState<
    { role: string; content: string; timestamp: number }[]
  >([]);
  const transcriptListRef = useRef<HTMLDivElement | null>(null);
  const speechTimeoutRef = useRef<number | null>(null);
  const isMutedRef = useRef(isMuted);
  const isSoundOffRef = useRef(isSoundOff);
  const isSessionPausedRef = useRef(false);
  const scriptStepRef = useRef(0);
  const isEzriSpeakingRef = useRef(false);
  /** Single source for ThreeAvatar RMS: updated every RAF (TTS tap or mic), never React state. */
  const mouthAudioLevelRef = useRef(0);
  /** WS TTS queue (declared early for sound-off / stop handlers). */
  const wsAudioQueueRef = useRef<WsAudioQueueItem[]>([]);
  const wsIsPlaybackActiveRef = useRef(false);
  /** True after backend `step:speaking` until `tts_done` (Ezri Avatar / app.js parity). Used to detect idle server interrupts. */
  const wsTtsStreamingRef = useRef(false);
  const wsTtsDoneReceivedRef = useRef(false);
  const wsActiveTurnRef = useRef(0);
  const wsAudioSeenTurnRef = useRef(0);
  const wsSpeakFallbackTimerRef = useRef<number | null>(null);
  const wsTtsDoneGraceTimerRef = useRef<number | null>(null);
  const wsPendingFallbackTextRef = useRef<string>("");
  const lastBargeInAtRef = useRef(0);
  /** Audio finished before `tts_done` — send playback_done once tts_done arrives (Ezri app.js). */
  const pendingPlaybackDoneRef = useRef(false);
  /** Tracks whether the server was told greeting/TTS playback finished (opens server mic). */
  const playbackDoneAckRef = useRef(false);
  const lastServerMicUnlockAttemptRef = useRef(0);
  /** First successful playback_done after permissions — gates session billing heartbeat. */
  const sessionBillingStartedRef = useRef(false);

  const TTS_SPEAK_FALLBACK_MS = 1000;
  const TTS_DONE_GRACE_MS = 500;
  const THINKING_STUCK_MS = 45_000;

  const clearSpeakFallbackTimer = () => {
    if (wsSpeakFallbackTimerRef.current !== null) {
      window.clearTimeout(wsSpeakFallbackTimerRef.current);
      wsSpeakFallbackTimerRef.current = null;
    }
  };

  const clearTtsDoneGraceTimer = () => {
    if (wsTtsDoneGraceTimerRef.current !== null) {
      window.clearTimeout(wsTtsDoneGraceTimerRef.current);
      wsTtsDoneGraceTimerRef.current = null;
    }
  };
  /** After barge-in, don't treat overlap with the last assistant line as Ezri echo (common follow-ups share words). */
  const bargeInEchoGraceUntilRef = useRef(0);
  /** True while Solace may still be streaming or playing TTS (covers gaps between WS audio chunks). */
  const ezriWsAudioPipelineActive = (): boolean =>
    isEzriSpeakingRef.current ||
    wsTtsStreamingRef.current ||
    wsIsPlaybackActiveRef.current ||
    wsAudioQueueRef.current.length > 0;

  useEffect(() => {
    permissionsGrantedRef.current = permissionsGranted;
  }, [permissionsGranted]);

  const transcriptRef = useRef<
    { role: string; content: string; timestamp: number }[]
  >([]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const { data: moodPreview = [] } = useQuery({
    queryKey: ["activeSession", "moodsPreview", user?.id ?? "anon"],
    queryFn: async () => {
      const rows = (await api.moods.getMyMoods()) as {
        mood: string;
        created_at: string;
        intensity?: number;
      }[];
      return Array.isArray(rows) ? rows.slice(0, 12) : [];
    },
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  const sortedMoodPreview = useMemo(() => {
    if (!moodPreview.length) return [];
    return [...moodPreview].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [moodPreview]);

  const latestMoodEmoji = useMemo(
    () => moodEmojiForLabel(String(sortedMoodPreview[0]?.mood ?? "")),
    [sortedMoodPreview],
  );

  const sessionBackdropLayers = useMemo(
    () =>
      resolveSessionBackdropLayers(
        sessionBackdropPreference,
        sortedMoodPreview[0]?.mood ?? null,
      ),
    [sessionBackdropPreference, sortedMoodPreview],
  );

  const selectedRoomMoodOption = useMemo(() => {
    const fromList = SESSION_BACKDROP_EMOJI_OPTIONS.find(
      (o) => o.value === sessionBackdropPreference,
    );
    if (fromList) return fromList;
    if (sessionBackdropPreference === "solace") {
      return {
        value: "solace" as const,
        emoji: "ðŸ’ ",
        label: "Solace â€” brand default",
      };
    }
    return SESSION_BACKDROP_EMOJI_OPTIONS[0];
  }, [sessionBackdropPreference]);

  useEffect(() => {
    try {
      localStorage.setItem(
        SESSION_BACKDROP_STORAGE_KEY,
        sessionBackdropPreference,
      );
    } catch {
      /* private mode */
    }
  }, [sessionBackdropPreference]);

  const apiSessionIdRef = useRef<string | null>(null);
  const sessionTimeRef = useRef(0);
  const authTokenRef = useRef<string | null>(null);
  const sessionFullyCleanedRef = useRef(false);
  const remoteEndAttemptedRef = useRef(false);
  const pendingUnmountTeardownRef = useRef<number | null>(null);

  useEffect(() => {
    apiSessionIdRef.current = apiSessionId;
  }, [apiSessionId]);

  useEffect(() => {
    authTokenRef.current = session?.access_token ?? null;
  }, [session?.access_token]);

  const [isListening, setIsListening] = useState(false);
  const [sttRestartTrigger, setSttRestartTrigger] = useState(0);
  const liveUserSpeechStore = useLiveUserSpeechStore();
  const latestUserTextRef = useRef("");
  const latestJordanTextRef = useRef("");
  const userSpeechStartedAtMsRef = useRef(0);
  const userLastSpeechAtMsRef = useRef(0);
  const jordanSpeechStartedAtMsRef = useRef(0);
  const jordanLastSpeechAtMsRef = useRef(0);
  const sentimentCompoundRef = useRef<number | undefined>(undefined);
  const scrollTranscriptToBottom = useCallback(() => {
    const el = transcriptListRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, []);

  useEffect(() => {
    scrollTranscriptToBottom();
  }, [transcript, scrollTranscriptToBottom]);

  const setLiveUserSpeech = useCallback(
    (text: string) => {
      liveUserSpeechStore.set(text);
      scrollTranscriptToBottom();
    },
    [liveUserSpeechStore, scrollTranscriptToBottom],
  );
  const subtitleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaRecorderActiveRef = useRef(false);
  const serverSttToastShownRef = useRef(false);
  const lastSpeechStartRef = useRef(0);
  const isRecognitionActiveRef = useRef(false);
  const isSessionEndingRef = useRef(false);
  /** Throttle sonner toasts â€” same id + rapid updates can trigger "Maximum update depth exceeded". */
  const lastInterimToastAtRef = useRef(0);
  const lastInterimTextRef = useRef("");
  /** Mic RMS for watchdog + barge-in (refs only — no React state). */
  const audioLevelForWatchdogRef = useRef(0);
  const lastSilentMicWarnAtRef = useRef(0);

  /** Lip-sync timing — refs only so the 40ms speech driver does not re-render the tree. */
  const speechTextRef = useRef("");
  const speechCharIndexRef = useRef(0);
  const speechPulseRef = useRef(0);
  const playbackAudioContextRef = useRef<AudioContext | null>(null);
  /** Mic capture context — must be created/resumed during the permission click (Firefox). */
  const pcmCaptureAudioContextRef = useRef<AudioContext | null>(null);
  const pcmChunksSentRef = useRef(0);
  const audioUnlockedRef = useRef(false);
  const ttsAnalyserRafRef = useRef<number | null>(null);
  const ttsAudioClockRafRef = useRef<number | null>(null);
  const ezriPlaybackSmoothRef = useRef(0);
  const ttsMouthTapOkRef = useRef(false);
  /** Text of the clip currently playing (for echo filter; state alone lags behind STT). */
  const ezriPlaybackTextRef = useRef<string>("");
  const suppressSttRef = useRef(false);
  const lastPlaybackDoneAtRef = useRef(0);
  const playbackDoneCooldownTimerRef = useRef<number | null>(null);
  /** Bumped on interrupt/pause â€” invalidates awaited work inside `playEzriAudio`. */
  const audioPlaySeqRef = useRef<number>(0);
  const avatarPendingDataRef = useRef<EzriAvatarData | null>(null);
  const avatarPendingDataReceivedAtRef = useRef<number | null>(null);
  const avatarPhonemeTimelineRef = useRef<AvatarPhonemeTimeline | null>(null);
  const avatarAudioCurrentTimeRef = useRef(0);
  const saraGreetingSyncSeqRef = useRef(0);
  const updateSaraGreetingDiagnostics = useCallback(
    (patch: Partial<SaraGreetingDiagnostics>) => {
      if (typeof window === "undefined") return;
      const current =
        ((window as any).saraGreetingDiagnostics as SaraGreetingDiagnostics | undefined) ??
        {
          greetingSentence: "",
          audioReceived: null,
          avatarDataReceived: null,
          timelineAttached: false,
          phonemeCount: 0,
          firstPhoneme: null,
          firstViseme: null,
          playbackStart: null,
          firstVisemeTime: null,
          deltaMs: null,
        };
      (window as any).saraGreetingDiagnostics = {
        ...current,
        ...patch,
      } satisfies SaraGreetingDiagnostics;
    },
    []
  );
  // Tracks the in-flight REST request so it can be aborted on interruption.
  const restAbortControllerRef = useRef<AbortController | null>(null);
  // When true, ALL incoming WS audio/text from the server is dropped.
  // Set to true on interrupt, cleared only when a new user message is actually sent.
  // This is the ONLY reliable way to ignore late audio chunks that the server
  // buffered before it processed our interrupt signal.
  const suppressIncomingAudioRef = useRef(false);
  // Ref mirror of isEzriThinking state â€” safe to read inside STT callbacks and
  // async functions without stale closure issues.
  const isEzriThinkingRef = useRef(false);
  // Text of the most recent message sent to the backend that has NOT yet produced
  // any audio response. Used to merge follow-up user speech during the silence gap.
  const pendingUserTextRef = useRef<string>("");
  /** Blocks duplicate `sendChat` if Web Speech fires two finals for the same phrase. */
  const lastSentUserChatFingerprintRef = useRef<{ n: string; t: number }>({
    n: "",
    t: 0,
  });
  // How many old in-flight server responses to silently drop before playing the
  // next one. Incremented each time a merge fires so that only the LATEST merged
  // message's response is played. Decremented on each tts_done / server interrupt.
  const dropOldResponsesRef = useRef(0);

  // True for iOS / Android where keeping recognition alive during TTS playback
  // triggers hardware audio-capture errors that permanently break the recognizer.
  // On desktop Chrome/Firefox/Edge, recognition can safely run while audio plays.
  const isMobileBrowser = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const browserSttActive = usesBrowserStt(ezriConfig?.defaults?.sttProvider);
  const serverPcmSttActive = usesServerPcmStt(ezriConfig?.defaults?.sttProvider);
  /** Web Speech API is only used when stt_provider=browser (not for server PCM). */
  const browserSpeechRecognitionActive = browserSttActive;

  /** Ezri_Avatar app.js: abort browser SpeechRecognition while Ezri speaks; resume after playback_done. */
  const pauseStt = () => {
    if (!browserSpeechRecognitionActive) return;
    if (!recognitionRef.current || suppressSttRef.current) return;
    suppressSttRef.current = true;
    try {
      recognitionRef.current.abort();
    } catch (_) {
      /* already stopped */
    }
  };

  /** Pass `delayMs: 0` after barge-in so the mic opens immediately â€” long delays clip the user's first words. */
  const resumeStt = (
    delayMs = 150,
    opts?: { ignoreSpeakingGate?: boolean },
  ) => {
    if (!browserSpeechRecognitionActive) return;
    suppressSttRef.current = false;
    // Short delay to let speaker echo decay after normal TTS (not needed right after client barge-in).
    window.setTimeout(() => {
      if (
        !permissionsGranted ||
        isSessionEndingRef.current ||
        isSessionPausedRef.current ||
        isMutedRef.current ||
        (!opts?.ignoreSpeakingGate && isEzriSpeakingRef.current)
      ) {
        return;
      }
      if (!recognitionRef.current) {
        const SR =
          typeof window !== "undefined" &&
          ((window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition);
        if (SR) setSttRestartTrigger((t) => t + 1);
        return;
      }
      try {
        if (!isRecognitionActiveRef.current) {
          recognitionRef.current.start();
        }
      } catch (e: unknown) {
        const nm =
          typeof e === "object" &&
          e !== null &&
          "name" in e &&
          typeof (e as { name: unknown }).name === "string"
            ? (e as { name: string }).name
            : "";
        // Chrome fires InvalidStateError if start() races a session that is already listening.
        if (nm === "InvalidStateError") {
          return;
        }
        // start() threw â€” recognizer is in a bad state. Force a full effect reinit.
        console.error("[STT] start() threw in resumeStt, forcing reinit:", e);
        recognitionRef.current = null;
        isRecognitionActiveRef.current = false;
        setSttRestartTrigger((t) => t + 1);
      }
    }, delayMs);
  };

  const stopPlaybackAndCooldown = (opts?: {
    sendPlaybackDone?: boolean;
    cooldownMs?: number;
    /** Bypass 2s debounce (needed for explicit user barge-in so we always ACK playback_done to the server). */
    bypassPlaybackDoneDebounce?: boolean;
  }) => {
    if (playbackDoneCooldownTimerRef.current !== null) {
      window.clearTimeout(playbackDoneCooldownTimerRef.current);
      playbackDoneCooldownTimerRef.current = null;
    }
    clearSpeakFallbackTimer();
    clearTtsDoneGraceTimer();

    // Drop any in-flight playEzriAudio (await normalizeSource / await play) â€” otherwise a chunk
    // that finishes decoding after interrupt can start playing and Ezri keeps talking.
    audioPlaySeqRef.current += 1;

    // Stop all audio immediately, clear queue, and (optionally) send playback_done after cooldown.
    wsAudioQueueRef.current = [];
    wsIsPlaybackActiveRef.current = false;
    wsTtsDoneReceivedRef.current = true; // treat as done so we don't get stuck waiting
    wsPendingFallbackTextRef.current = "";
    wsTtsStreamingRef.current = false;
    stopAudioAndSpeechDriver();

    const shouldSend = opts?.sendPlaybackDone !== false;
    if (!shouldSend) return;
    sendPlaybackDoneAfterCooldown(
      opts?.cooldownMs ?? 1500,
      opts?.bypassPlaybackDoneDebounce ?? false,
    );
  };

  const stopAudioAndSpeechDriver = () => {
    if (ttsAnalyserRafRef.current) {
      cancelAnimationFrame(ttsAnalyserRafRef.current);
      ttsAnalyserRafRef.current = null;
    }
    if (ttsAudioClockRafRef.current) {
      cancelAnimationFrame(ttsAudioClockRafRef.current);
      ttsAudioClockRafRef.current = null;
    }
    ezriPlaybackSmoothRef.current = 0;
    ttsMouthTapOkRef.current = false;
    mouthAudioLevelRef.current = 0;
    avatarAudioCurrentTimeRef.current = 0;
    avatarPhonemeTimelineRef.current = null;
    avatarPendingDataRef.current = null;
    avatarPendingDataReceivedAtRef.current = null;
    if (speechDriverIntervalRef.current) {
      window.clearInterval(speechDriverIntervalRef.current);
      speechDriverIntervalRef.current = null;
    }
    if (audioRef.current) {
      try {
        // Prevent "Empty src attribute" spam when we intentionally stop/clear audio.
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.onloadedmetadata = null;
        audioRef.current.pause();
        // Avoid setting src="" (triggers MEDIA_ERR_SRC_NOT_SUPPORTED in some browsers).
        audioRef.current.removeAttribute("src");
        audioRef.current.load();
      } catch { }
      audioRef.current = null;
    }
    if (audioUrlRevokeRef.current) {
      try {
        audioUrlRevokeRef.current();
      } catch { }
      audioUrlRevokeRef.current = null;
    }
    setIsEzriSpeaking(false);
    isEzriSpeakingRef.current = false;
    ezriPlaybackTextRef.current = "";
    speechTextRef.current = "";
    speechCharIndexRef.current = 0;
  };

  /** Between WS TTS chunks, only swap the audio element — keep speaking state/lip-sync alive. */
  const stopPriorEzriAudioForNextChunk = () => {
    if (ttsAnalyserRafRef.current) {
      cancelAnimationFrame(ttsAnalyserRafRef.current);
      ttsAnalyserRafRef.current = null;
    }
    if (ttsAudioClockRafRef.current) {
      cancelAnimationFrame(ttsAudioClockRafRef.current);
      ttsAudioClockRafRef.current = null;
    }
    if (audioRef.current) {
      try {
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.onloadedmetadata = null;
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
        audioRef.current.load();
      } catch {
        /* noop */
      }
      audioRef.current = null;
    }
    if (audioUrlRevokeRef.current) {
      try {
        audioUrlRevokeRef.current();
      } catch {
        /* noop */
      }
      audioUrlRevokeRef.current = null;
    }
  };

  const driveSpeechAnimationForText = (text: string, durationMs: number) => {
    if (!text) return;
    if (speechDriverIntervalRef.current) {
      window.clearInterval(speechDriverIntervalRef.current);
      speechDriverIntervalRef.current = null;
    }
    const startAt = performance.now();
    const effectiveDurationMs = Math.max(1200, durationMs);
    let lastIdx = -1;
    let lastPulseAt = 0;
    speechDriverIntervalRef.current = window.setInterval(() => {
      if (!isEzriSpeakingRef.current) return;
      const elapsed = performance.now() - startAt;
      const progress = THREE.MathUtils.clamp(elapsed / effectiveDurationMs, 0, 1);
      const idx = Math.min(text.length - 1, Math.max(0, Math.floor(progress * text.length)));
      speechCharIndexRef.current = idx;
      if (!ttsMouthTapOkRef.current) {
        const o = getSpeechOpennessAt(text, idx);
        mouthAudioLevelRef.current = 26 + o * 118;
      }
      if (idx !== lastIdx) {
        const ch = text[idx]?.toLowerCase?.() ?? "";
        const vowelOrBreak =
          /[aeiou]/.test(ch) ||
          ch === " " ||
          ch === "," ||
          ch === "." ||
          ch === "!" ||
          ch === "?";
        const plosive = /[tdkgpb]/.test(ch);
        const shouldPulse = vowelOrBreak || plosive;
        const minGap = plosive && !vowelOrBreak ? 95 : 72;
        if (shouldPulse && performance.now() - lastPulseAt > minGap) {
          speechPulseRef.current += 1;
          lastPulseAt = performance.now();
        }
      }
      lastIdx = idx;
      if (progress >= 1) {
        if (speechDriverIntervalRef.current) {
          window.clearInterval(speechDriverIntervalRef.current);
          speechDriverIntervalRef.current = null;
        }
      }
    }, 40);
  };

  /** Only reopen STT between WebSocket TTS chunks when the turn is truly finished (Ezri Avatar queue + tts_done). */
  const maybeResumeMicAfterEzriPlayback = (partOfWsStreamingTurn?: boolean) => {
    if (!partOfWsStreamingTurn) {
      resumeStt();
      return;
    }
    if (
      wsAudioQueueRef.current.length === 0 &&
      wsTtsDoneReceivedRef.current
    ) {
      resumeStt();
    }
  };

  const playEzriAudio = async (
    text: string,
    audioSource: any,
    opts?: {
      onDone?: () => void;
      onError?: () => void;
      /** When true, do not resume STT until all WS chunks played and server sent `tts_done`. */
      partOfWsStreamingTurn?: boolean;
      avatarData?: EzriAvatarData | null;
      audioReceived?: number | null;
      avatarDataReceived?: number | null;
      saraGreetingSync?: SaraGreetingSyncState;
    }
  ) => {
    if (typeof window === "undefined") return;
    if (isSoundOffRef.current) {
      opts?.onDone?.();
      return;
    }

    audioPlaySeqRef.current += 1;
    const seq = audioPlaySeqRef.current;

    if (opts?.partOfWsStreamingTurn) {
      stopPriorEzriAudioForNextChunk();
    } else {
      stopAudioAndSpeechDriver();
    }
    ezriPlaybackTextRef.current = text;
    speechTextRef.current = text;
    speechCharIndexRef.current = 0;
    setIsEzriSpeaking(true);
    isEzriSpeakingRef.current = true;
    setLiveUserSpeech("");
    pauseStt();

    let url = "";
    let revoke: (() => void) | undefined;
    try {
      if (!audioSource) {
        throw new Error("Empty audioSource");
      }
      const normalized = await normalizeAudioSource(audioSource);
      const out = toObjectUrl(normalized);
      url = (out.url || "").trim();
      revoke = out.revoke;
      if (!url) {
        throw new Error("Empty audio URL from toObjectUrl()");
      }
    } catch (e) {
      if (seq !== audioPlaySeqRef.current) return;
      console.error("Ezri audio source invalid; refusing to play.", { audioSource, error: e });
      stopAudioAndSpeechDriver();
      toast.error("Audio playback failed (empty audio source).");
      opts?.onDone?.();
      return;
    }

    if (seq !== audioPlaySeqRef.current) {
      try {
        revoke?.();
      } catch {
        /* noop */
      }
      opts?.onDone?.();
      return;
    }

    audioUrlRevokeRef.current = revoke ?? null;

    const audio = new Audio();
    audioRef.current = audio;
    audio.preload = "auto";
    audio.src = url;
    avatarAudioCurrentTimeRef.current = 0;
    const initialPhonemeTimeline = normalizeAvatarPhonemeTimeline(
      opts?.avatarData ?? null
    );
    avatarPhonemeTimelineRef.current = initialPhonemeTimeline;
    const isSaraHybridPlayback =
      companionCanonicalId === "sarah" &&
      saraLiveAvatarMode === "hybrid" &&
      !saraLiveRfv2PreviewEnabled &&
      !sessionUsesRfv2Morphs;
    let currentAvatarDataReceivedAt =
      opts?.avatarDataReceived ??
      opts?.saraGreetingSync?.avatarDataReceived ??
      null;
    const currentAudioReceivedAt =
      opts?.audioReceived ??
      opts?.saraGreetingSync?.audioReceived ??
      null;
    const updateSaraMouthPlaybackDiagnostics = (
      patch: Record<string, unknown>
    ) => {
      if (typeof window === "undefined" || !isSaraHybridPlayback) return;
      (window as any).saraV2MouthDiagnostics = {
        ...((window as any).saraV2MouthDiagnostics ?? {}),
        ...patch,
      };
    };
    const waitForSaraPhonemesBeforePlayback = async () => {
      const waitStartedAt = performance.now();
      let waitedForPhonemesBeforePlayback = false;
      while (
        seq === audioPlaySeqRef.current &&
        performance.now() - waitStartedAt < 300 &&
        !avatarPhonemeTimelineRef.current?.phonemes?.length
      ) {
        waitedForPhonemesBeforePlayback = true;
        if (avatarPendingDataRef.current) {
          const lateTimeline = normalizeAvatarPhonemeTimeline(
            avatarPendingDataRef.current,
            Number.isFinite(audio.duration) ? audio.duration : undefined
          );
          if (lateTimeline?.phonemes.length) {
            avatarPhonemeTimelineRef.current = lateTimeline;
            currentAvatarDataReceivedAt =
              avatarPendingDataReceivedAtRef.current ?? performance.now();
            avatarPendingDataRef.current = null;
            avatarPendingDataReceivedAtRef.current = null;
            break;
          }
        }
        await new Promise((resolve) => window.setTimeout(resolve, 25));
      }
      const phonemeWaitMs = performance.now() - waitStartedAt;
      return {
        waitedForPhonemesBeforePlayback,
        phonemeWaitMs,
        timelineAttachedBeforeAudioPlay:
          !!avatarPhonemeTimelineRef.current?.phonemes?.length,
      };
    };
    if (opts?.saraGreetingSync) {
      const firstPhoneme = initialPhonemeTimeline?.phonemes[0] ?? null;
      updateSaraGreetingDiagnostics({
        greetingSentence:
          initialPhonemeTimeline?.sentence ||
          opts.saraGreetingSync.sentence ||
          text,
        audioReceived: opts.saraGreetingSync.audioReceived,
        avatarDataReceived: opts.saraGreetingSync.avatarDataReceived,
        timelineAttached: !!initialPhonemeTimeline?.phonemes.length,
        phonemeCount: initialPhonemeTimeline?.phonemes.length ?? 0,
        firstPhoneme: firstPhoneme
          ? {
              phoneme: firstPhoneme.phoneme,
              start: firstPhoneme.start,
              end: firstPhoneme.end ?? null,
            }
          : null,
        firstViseme: null,
        playbackStart: null,
        firstVisemeTime: null,
        deltaMs: null,
      });
      console.log("[Sara Greeting Sync]", {
        greetingSentence:
          initialPhonemeTimeline?.sentence ||
          opts.saraGreetingSync.sentence ||
          text,
        audioReceived: opts.saraGreetingSync.audioReceived,
        avatarDataReceived: opts.saraGreetingSync.avatarDataReceived,
        phonemeCount: initialPhonemeTimeline?.phonemes.length ?? 0,
        firstPhonemeStart: firstPhoneme?.start ?? null,
        playbackStart: null,
        firstVisemeApplied: null,
        timelineAttached: !!initialPhonemeTimeline?.phonemes.length,
      });
    }
    if (ttsAudioClockRafRef.current) {
      cancelAnimationFrame(ttsAudioClockRafRef.current);
      ttsAudioClockRafRef.current = null;
    }
    const clockSeq = seq;
    const tickAudioClock = () => {
      if (clockSeq !== audioPlaySeqRef.current) return;
      avatarAudioCurrentTimeRef.current = audio.currentTime || 0;
      ttsAudioClockRafRef.current = requestAnimationFrame(tickAudioClock);
    };
    ttsAudioClockRafRef.current = requestAnimationFrame(tickAudioClock);

    // Drive jaw/lips from Ezriâ€™s **amplitude** (RMS). Raw FFT averages are too low for speech vs mic.
    try {
      if (ttsAnalyserRafRef.current) {
        cancelAnimationFrame(ttsAnalyserRafRef.current);
        ttsAnalyserRafRef.current = null;
      }
      ezriPlaybackSmoothRef.current = 0;
      let ctx = playbackAudioContextRef.current;
      if (!ctx || ctx.state === "closed") {
        ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        playbackAudioContextRef.current = ctx;
      }
      if (ctx.state === "suspended") await ctx.resume();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.45;
      const source = ctx.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      const bufferLength = analyser.fftSize;
      const dataArray = new Uint8Array(bufferLength);
      const attachSeq = seq;
      const tick = () => {
        if (attachSeq !== audioPlaySeqRef.current) return;
        analyser.getByteTimeDomainData(dataArray);
        let sumSq = 0;
        for (let i = 0; i < bufferLength; i++) {
          const x = (dataArray[i] - 128) / 128;
          sumSq += x * x;
        }
        const rms = Math.sqrt(sumSq / bufferLength);
        // Map to a similar scale as the mic bar (typical 20â€“120); TTS RMS often 0.02â€“0.2.
        const instant = Math.min(240, 22 + rms * 980);
        ezriPlaybackSmoothRef.current +=
          (instant - ezriPlaybackSmoothRef.current) * 0.5;
        mouthAudioLevelRef.current = ezriPlaybackSmoothRef.current;
        ttsAnalyserRafRef.current = requestAnimationFrame(tick);
      };
      ttsAnalyserRafRef.current = requestAnimationFrame(tick);
      ttsMouthTapOkRef.current = true;
    } catch (e) {
      ttsMouthTapOkRef.current = false;
      console.warn("[Avatar] TTS playback analyser failed; mouth uses text timing only.", e);
    }

    let playbackEndHandled = false;
    let playbackEndFallbackTimer: number | null = null;

    const finishPlayback = (reason: string) => {
      if (playbackEndHandled || seq !== audioPlaySeqRef.current) return;
      playbackEndHandled = true;
      if (playbackEndFallbackTimer !== null) {
        window.clearTimeout(playbackEndFallbackTimer);
        playbackEndFallbackTimer = null;
      }
      if (reason !== "ended") {
        console.warn(`[Audio] Completing playback via ${reason} (browser may have skipped onended)`);
      }
      stopAudioAndSpeechDriver();
      maybeResumeMicAfterEzriPlayback(opts?.partOfWsStreamingTurn);
      speechPulseRef.current += 1;
      opts?.onDone?.();
    };

    audio.onloadedmetadata = () => {
      if (seq !== audioPlaySeqRef.current) return;
      const ms = Number.isFinite(audio.duration) ? Math.max(800, audio.duration * 1000) : 3500;
      const metadataPhonemeTimeline = normalizeAvatarPhonemeTimeline(
        opts?.avatarData ?? null,
        Number.isFinite(audio.duration) ? audio.duration : undefined
      );
      if (metadataPhonemeTimeline?.phonemes.length || opts?.avatarData) {
        avatarPhonemeTimelineRef.current = metadataPhonemeTimeline;
      }
      if (opts?.saraGreetingSync) {
        const firstPhoneme = metadataPhonemeTimeline?.phonemes[0] ?? null;
        updateSaraGreetingDiagnostics({
          timelineAttached: !!metadataPhonemeTimeline?.phonemes.length,
          phonemeCount: metadataPhonemeTimeline?.phonemes.length ?? 0,
          firstPhoneme: firstPhoneme
            ? {
                phoneme: firstPhoneme.phoneme,
                start: firstPhoneme.start,
                end: firstPhoneme.end ?? null,
              }
            : null,
        });
      }
      driveSpeechAnimationForText(text, ms);

      // Firefox sometimes never fires `onended` for blob WAV — force queue advance + playback_done.
      if (opts?.partOfWsStreamingTurn && Number.isFinite(audio.duration) && audio.duration > 0) {
        playbackEndFallbackTimer = window.setTimeout(
          () => finishPlayback("duration_fallback"),
          Math.ceil(audio.duration * 1000) + 800,
        );
      }
    };

    audio.onended = () => {
      finishPlayback("ended");
    };

    audio.onerror = () => {
      if (seq !== audioPlaySeqRef.current) return;
      // If we cleared src as part of an intentional stop, ignore.
      if (!audio.src) return;
      const me = audio.error;
      const sniffedMime = audio.src.startsWith("blob:")
        ? "(blob â€” check normalizeAudioSource)"
        : "(url)";
      console.error("EZRI AUDIO ONERROR", {
        mediaErrorCode: me?.code,
        mediaErrorMessage: me?.message,
        audioSrc: audio.src.slice(0, 120),
        mimeHint: sniffedMime,
        canPlayMpeg: audio.canPlayType("audio/mpeg"),
        canPlayWav: audio.canPlayType("audio/wav"),
        canPlayOgg: audio.canPlayType("audio/ogg"),
        canPlayWebm: audio.canPlayType("audio/webm"),
      });
      stopAudioAndSpeechDriver();
      maybeResumeMicAfterEzriPlayback(opts?.partOfWsStreamingTurn);
      if (opts?.partOfWsStreamingTurn) {
        const fallback =
          text.trim() ||
          wsPendingFallbackTextRef.current.trim() ||
          wsLastFinalTextRef.current.trim();
        if (fallback) {
          clearSpeakFallbackTimer();
          void speakViaEzriTts(fallback);
        }
      }
      opts?.onError?.();
      finishPlayback("error");
    };

    // Resume AudioContext and pre-load before play to satisfy Firefox autoplay policy.
    try {
      const ctx = playbackAudioContextRef.current;
      if (ctx && ctx.state === "suspended") await ctx.resume();
    } catch (_) { /* non-fatal */ }

    audio.load();

    console.log("[Audio] canPlayType check", {
      mpeg: audio.canPlayType("audio/mpeg"),
      wav: audio.canPlayType("audio/wav"),
      ogg: audio.canPlayType("audio/ogg"),
      webm: audio.canPlayType("audio/webm"),
      src: audio.src.slice(0, 80),
    });

    try {
      const shouldWaitForSaraPhonemes =
        isSaraHybridPlayback &&
        Boolean(
          opts?.partOfWsStreamingTurn ||
            opts?.saraGreetingSync ||
            opts?.avatarData ||
            avatarPendingDataRef.current
        );
      const waitDiagnostics = shouldWaitForSaraPhonemes
        ? await waitForSaraPhonemesBeforePlayback()
        : {
            waitedForPhonemesBeforePlayback: false,
            phonemeWaitMs: 0,
            timelineAttachedBeforeAudioPlay:
              !!avatarPhonemeTimelineRef.current?.phonemes?.length,
          };
      const audioPlayStartedAtMs = performance.now();
      updateSaraMouthPlaybackDiagnostics({
        ...waitDiagnostics,
        audioPlayStartedAtMs,
        avatarDataReceivedAtMs: currentAvatarDataReceivedAt,
        audioReceivedAtMs: currentAudioReceivedAt,
        deltaAvatarDataToAudioPlayMs:
          currentAvatarDataReceivedAt !== null
            ? audioPlayStartedAtMs - currentAvatarDataReceivedAt
            : null,
      });
      console.log(
        "[PHONEME TIMELINE BEFORE PLAY]",
        avatarPhonemeTimelineRef.current
      );
      await audio.play();
      if (seq === audioPlaySeqRef.current && opts?.saraGreetingSync) {
        const playbackStart = audioPlayStartedAtMs;
        updateSaraGreetingDiagnostics({ playbackStart });
        console.log("[Sara Greeting Sync]", {
          greetingSentence: opts.saraGreetingSync.sentence || text,
          audioReceived: opts.saraGreetingSync.audioReceived,
          avatarDataReceived: opts.saraGreetingSync.avatarDataReceived,
          phonemeCount: avatarPhonemeTimelineRef.current?.phonemes.length ?? 0,
          firstPhonemeStart: avatarPhonemeTimelineRef.current?.phonemes[0]?.start ?? null,
          playbackStart,
          firstVisemeApplied:
            ((window as any).saraGreetingDiagnostics as SaraGreetingDiagnostics | undefined)
              ?.firstViseme ?? null,
        });
      }
    } catch (e: any) {
      if (seq !== audioPlaySeqRef.current) return;
      if (e?.name === "AbortError") return;
      const sniffedMime = audio.src.startsWith("blob:")
        ? "(blob â€” check normalizeAudioSource)"
        : "(url)";
      console.error("EZRI AUDIO PLAY() FAILED", {
        errorName: e?.name,
        errorMessage: e?.message,
        audioSrc: audio.src.slice(0, 120),
        mimeHint: sniffedMime,
        canPlayMpeg: audio.canPlayType("audio/mpeg"),
        canPlayWav: audio.canPlayType("audio/wav"),
        canPlayOgg: audio.canPlayType("audio/ogg"),
        canPlayWebm: audio.canPlayType("audio/webm"),
      });
      stopAudioAndSpeechDriver();
      maybeResumeMicAfterEzriPlayback(opts?.partOfWsStreamingTurn);
      if (opts?.partOfWsStreamingTurn) {
        const fallback =
          text.trim() ||
          wsPendingFallbackTextRef.current.trim() ||
          wsLastFinalTextRef.current.trim();
        if (fallback) {
          clearSpeakFallbackTimer();
          void speakViaEzriTts(fallback);
        }
      }
      opts?.onError?.();
      finishPlayback("play_failed");
    }

    // play() resolves before first frame; interrupt during decode/scheduling otherwise leaves audio audible.
    if (seq !== audioPlaySeqRef.current) {
      try {
        audio.pause();
        audio.onended = null;
        audio.onerror = null;
        audio.onloadedmetadata = null;
        audio.removeAttribute("src");
        audio.load();
      } catch {
        /* noop */
      }
      try {
        revoke?.();
      } catch {
        /* noop */
      }
      finishPlayback("superseded");
    }
  };

  const speakViaEzriTts = async (text: string) => {
    if (!ezriApi || !ezriConfig) return;
    clearSpeakFallbackTimer();
    const ttsProvider = ezriConfig.defaults.ttsProvider;

    const tryPlay = (format?: string): Promise<void> =>
      new Promise(async (resolve, reject) => {
        try {
          const res = await ezriApi.speakRest({
            text,
            tts_provider: ttsProvider,
            voice: ezriTtsVoiceId,
            ...(format ? { format } : {}),
          });
          await playEzriAudio(text, res.audio, {
            onDone: resolve,
            onError: () => reject(new Error("playback_error")),
          });
        } catch (e) {
          reject(e);
        }
      });

    try {
      await tryPlay();
    } catch (e: any) {
      if (e?.message === "playback_error") {
        // Audio decoded but browser could not play it â€” retry with explicit mp3.
        console.warn("[TTS] Primary playback failed â€” retrying with mp3 format.");
        toast.warning("Firefox could not play this audio format. Trying fallback.");
        try {
          await tryPlay("mp3");
        } catch (retryErr: any) {
          console.error("Ezri speak fallback also failed:", retryErr);
          toast.error(retryErr?.message || "Ezri speak failed");
        }
      } else {
        console.error("Ezri speak failed:", e);
        toast.error(e?.message || "Ezri speak failed");
      }
    }
  };

  /** If WS text arrived but no audible playback started, speak via REST (fixes skipped TTS). */
  const scheduleAssistantSpeakFallback = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    clearSpeakFallbackTimer();
    const turn = wsActiveTurnRef.current;
    wsSpeakFallbackTimerRef.current = window.setTimeout(() => {
      wsSpeakFallbackTimerRef.current = null;
      if (suppressIncomingAudioRef.current) return;
      if (turn !== wsActiveTurnRef.current) return;
      if (ezriWsAudioPipelineActive()) return;
      const line =
        wsPendingFallbackTextRef.current.trim() ||
        wsLastFinalTextRef.current.trim() ||
        trimmed;
      if (!line) return;
      wsPendingFallbackTextRef.current = "";
      void speakViaEzriTts(line);
    }, TTS_SPEAK_FALLBACK_MS);
  };

  const appendAssistantFinal = (text: string) => {
    if (!text.trim()) return;
    const t = text.trim();
    latestJordanTextRef.current = t;
    wsLastFinalTextRef.current = t;
    ezriPlaybackTextRef.current = t;
    setTranscript((prev) => [
      ...prev,
      { role: "assistant", content: text, timestamp: Date.now() },
    ]);
  };

  /**
   * Ezri Avatar `app.js` `playNextInQueue`: send `playback_done` immediately when the
   * audio queue is empty and `tts_done` was received — do not delay or debounce.
   */
  const sendPlaybackDoneNow = useCallback(() => {
    if (playbackDoneCooldownTimerRef.current !== null) {
      window.clearTimeout(playbackDoneCooldownTimerRef.current);
      playbackDoneCooldownTimerRef.current = null;
    }
    lastPlaybackDoneAtRef.current = Date.now();
    pendingPlaybackDoneRef.current = false;
    if (serverPcmSttActive) {
      const ws = wsClientRef.current;
      if (ws?.getStatus() === "connected") {
        try {
          const ok = ws.sendPlaybackDone();
          if (ok) {
            playbackDoneAckRef.current = true;
            console.log("[WS] playback_done sent — server mic unlocked");
          }
        } catch {
          /* ignore */
        }
      }
    }
    if (!sessionBillingStartedRef.current) {
      sessionBillingStartedRef.current = true;
    }
    resumeStt(150, { ignoreSpeakingGate: true });
  }, [serverPcmSttActive]);

  /** Tell the backend Ezri finished speaking so VAD/STT accepts user audio (is_bot_speaking lock). */
  const tryUnlockServerMic = useCallback(
    (reason: string) => {
      if (!serverPcmSttActive) return;
      if (playbackDoneAckRef.current) return;
      const ws = wsClientRef.current;
      if (!ws || ws.getStatus() !== "connected") return;
      const now = Date.now();
      if (now - lastServerMicUnlockAttemptRef.current < 800) return;
      lastServerMicUnlockAttemptRef.current = now;
      console.log(`[WS] Unlocking server mic (${reason})`);
      sendPlaybackDoneNow();
    },
    [serverPcmSttActive, sendPlaybackDoneNow],
  );

  const sendPlaybackDoneNowRef = useRef(sendPlaybackDoneNow);
  const tryUnlockServerMicRef = useRef(tryUnlockServerMic);
  useEffect(() => {
    sendPlaybackDoneNowRef.current = sendPlaybackDoneNow;
    tryUnlockServerMicRef.current = tryUnlockServerMic;
  }, [sendPlaybackDoneNow, tryUnlockServerMic]);

  /** After interrupt / stopPlayback — 1500ms echo cooldown (reference app.js). */
  const sendPlaybackDoneAfterCooldown = (
    cooldownMs = 1500,
    bypassDebounce = false,
  ) => {
    const now = Date.now();
    if (!bypassDebounce && now - lastPlaybackDoneAtRef.current < 2000) {
      resumeStt(0, { ignoreSpeakingGate: true });
      return;
    }
    lastPlaybackDoneAtRef.current = now;
    if (playbackDoneCooldownTimerRef.current !== null) {
      window.clearTimeout(playbackDoneCooldownTimerRef.current);
      playbackDoneCooldownTimerRef.current = null;
    }
    playbackDoneCooldownTimerRef.current = window.setTimeout(() => {
      playbackDoneCooldownTimerRef.current = null;
      if (serverPcmSttActive) {
        try {
          wsClientRef.current?.sendPlaybackDone();
        } catch {
          /* ignore */
        }
      }
      if (!sessionBillingStartedRef.current) {
        sessionBillingStartedRef.current = true;
      }
      resumeStt(150, { ignoreSpeakingGate: true });
    }, cooldownMs);
  };

  const playNextWsQueue = () => {
    if (suppressIncomingAudioRef.current) {
      wsAudioQueueRef.current = [];
      wsIsPlaybackActiveRef.current = false;
      return;
    }
    if (wsIsPlaybackActiveRef.current) return;
    const next = wsAudioQueueRef.current.shift();
    if (!next) {
      if (wsTtsDoneReceivedRef.current) {
        wsTtsDoneReceivedRef.current = false;
        sendPlaybackDoneNow();
      } else {
        pendingPlaybackDoneRef.current = true;
        console.log(
          "[WS] Audio queue drained before tts_done — will send playback_done when tts_done arrives",
        );
      }
      return;
    }
    clearSpeakFallbackTimer();
    wsAudioSeenTurnRef.current = wsActiveTurnRef.current;
    wsIsPlaybackActiveRef.current = true;
    void playEzriAudio(next.subtitle, next.audio, {
      partOfWsStreamingTurn: true,
      avatarData: next.avatarData,
      audioReceived: next.audioReceived,
      avatarDataReceived: next.avatarDataReceived,
      saraGreetingSync: next.saraGreetingSync,
      onDone: () => {
        wsIsPlaybackActiveRef.current = false;
        playNextWsQueue();
      },
    });
  };

  flushWsAudioQueueRef.current = playNextWsQueue;

  const finalizeSessionEntry = useCallback(() => {
    if (!pendingMediaEntryRef.current) return;
    if (!ezriWarmupReadyRef.current) return;
    setPermissionsGranted(true);
    setShowPermissionRequest(false);
    setPendingMediaEntry(false);
    pendingMediaEntryRef.current = false;
    permissionsGrantedRef.current = true;

    for (const line of prePermissionTranscriptRef.current) {
      if (line.role === "assistant") {
        appendAssistantFinal(line.content);
      } else if (line.content.trim()) {
        setTranscript((prev) => mergeUserTranscriptAppend(prev, line.content));
      }
    }
    prePermissionTranscriptRef.current = [];

    const queued = prePermissionAudioQueueRef.current.splice(0);
    if (queued.length > 0) {
      wsAudioQueueRef.current.push(...queued);
      playNextWsQueue();
    } else if (
      wsTtsDoneReceivedRef.current &&
      !wsIsPlaybackActiveRef.current &&
      wsAudioQueueRef.current.length === 0
    ) {
      wsTtsDoneReceivedRef.current = false;
      sendPlaybackDoneNow();
    }
  }, [sendPlaybackDoneNow]);

  useEffect(() => {
    if (!pendingMediaEntry || ezriWarmupStatus !== "ready") return;
    finalizeSessionEntry();
  }, [pendingMediaEntry, ezriWarmupStatus, finalizeSessionEntry]);

  const requestBargeInInterrupt = (source: string) => {
    const now = Date.now();
    // speech_final may arrive shortly after speech_interim; still treat as one user action.
    if (now - lastBargeInAtRef.current < 400 && source !== "speech_final") {
      return;
    }
    lastBargeInAtRef.current = now;
    bargeInEchoGraceUntilRef.current = now + 8000;

    wsAssistantBufferRef.current = "";
    wsLastFinalTextRef.current = "";
    wsPendingFallbackTextRef.current = "";

    if (restAbortControllerRef.current) {
      restAbortControllerRef.current.abort();
      restAbortControllerRef.current = null;
    }

    const wasPlaying = ezriWsAudioPipelineActive();

    /**
     * RunPod / server PCM (reference app.js): interrupt is detected on the HF server
     * via Silero VAD on incoming PCM. The client only stops playback and sends
     * playback_done after 1500ms echo cooldown — no client interrupt JSON, no
     * suppressIncomingAudio (that blocked the server's *new* response after STT).
     */
    if (serverPcmSttActive) {
      dropOldResponsesRef.current += 1;
      stopPlaybackAndCooldown({
        sendPlaybackDone: wasPlaying,
        cooldownMs: wasPlaying ? 1500 : 0,
        bypassPlaybackDoneDebounce: true,
      });
      suppressSttRef.current = false;
      resumeStt(0, { ignoreSpeakingGate: true });
      return;
    }

    // Browser STT: client must drop stale WS chunks until sendChat fires.
    suppressIncomingAudioRef.current = true;
    wsActiveTurnRef.current += 1;
    wsAudioSeenTurnRef.current = 0;

    const ws = wsClientRef.current;
    if (ws && ws.getStatus() === "connected") {
      ws.sendInterrupt(source);
    }
    stopPlaybackAndCooldown({
      sendPlaybackDone: wasPlaying,
      cooldownMs: wasPlaying ? 1500 : 0,
      bypassPlaybackDoneDebounce: true,
    });

    suppressSttRef.current = false;
    const SpeechRecognitionCtor =
      typeof window !== "undefined" &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

    // Desktop: NEVER recreate SpeechRecognition here â€” teardown costs ~300â€“800ms and drops the user's
    // first words right after interrupt. Mobile: pauseStt() aborted during TTS; full recreate only on the
    // final segment (when utterance bookkeeping is coherent). Interim/teardown-before-final is avoided elsewhere.
    const shouldRecreateSttAfterBargeIn =
      !!SpeechRecognitionCtor && isMobileBrowser && source === "speech_final";

    if (!SpeechRecognitionCtor) {
      // MediaRecorder/server STT path â€” no SpeechRecognition instance to restart.
    } else if (shouldRecreateSttAfterBargeIn) {
      isRecognitionActiveRef.current = false;
      setIsListening(false);
      setSttRestartTrigger((t) => t + 1);
    } else {
      resumeStt(0, { ignoreSpeakingGate: true });
    }

    // â”€â”€ Safety net 1: on mobile (where pauseStt aborts recognition), verify STT
    // actually restarted. Chrome can silently swallow start() on a recently-aborted
    // recognizer with no onstart, no onerror â€” just silence. Force a clean reinit
    // if still inactive after 600ms.
    window.setTimeout(() => {
      if (
        !suppressSttRef.current &&
        !isEzriSpeakingRef.current &&
        !isSessionEndingRef.current &&
        permissionsGranted &&
        !isRecognitionActiveRef.current
      ) {
        console.warn("[Interrupt] STT did not start after barge-in â€” forcing fresh reinit.");
        recognitionRef.current = null;
        isRecognitionActiveRef.current = false;
        setSttRestartTrigger((t) => t + 1);
      }
    }, 600);

    // â”€â”€ Safety net 2: suppressIncomingAudio is cleared by handleUserText(). If
    // STT never captures the user's post-interrupt words, it stays true forever
    // and all future Ezri audio is silently blocked. Auto-release after 20s.
    window.setTimeout(() => {
      if (suppressIncomingAudioRef.current) {
        console.warn("[Interrupt] suppressIncomingAudio still set after 20s â€” auto-releasing.");
        suppressIncomingAudioRef.current = false;
      }
    }, 20_000);
  };

  const normalizeSpeech = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const shouldIgnoreEchoBargeIn = (candidateRaw: string) => {
    const candidate = normalizeSpeech(candidateRaw);
    if (!candidate) return true;
    if (candidate.length < 4) return true;

    const refs = [
      ezriPlaybackTextRef.current || "",
      wsLastFinalTextRef.current || "",
      latestJordanTextRef.current || "",
      wsPendingFallbackTextRef.current || "",
      transcriptRef.current
        .slice()
        .reverse()
        .find((t) => t.role === "assistant")?.content || "",
    ]
      .map(normalizeSpeech)
      .filter(Boolean);

    const candWords = candidate.split(" ").filter(Boolean);
    if (candWords.length === 0) return true;

    for (const r of refs) {
      if (!r) continue;
      if (r.includes(candidate) || candidate.includes(r)) return true;

      const rWords = new Set(r.split(" ").filter(Boolean));
      let overlap = 0;
      for (const w of candWords) {
        if (rWords.has(w)) overlap += 1;
      }
      const overlapRatio = overlap / candWords.length;
      if (overlapRatio >= 0.5) return true;
    }
    return false;
  };

  const shouldInterruptForSpeech = (candidateRaw: string, isFinal: boolean) => {
    const candidate = normalizeSpeech(candidateRaw);
    if (!candidate) return false;

    // Do NOT use shouldIgnoreEchoBargeIn() here â€” it matched shared words with the *last assistant
    // turn* and blocked real interrupts ("stop", "wait", "I need to say something"). Echo after an
    // actual interrupt is handled separately (dropAsEzriEchoDup + listen window).

    const words = candidate.split(" ").filter(Boolean);

    // No micLevel gate: Chrome's AEC suppresses the mic signal while the speaker
    // is playing, so audioLevel is near-zero even when the user speaks clearly.
    // SpeechRecognition uses its own internal VAD â€” if it fires, the user spoke.

    // Interim: single word â‰¥3 chars ("hey", "wait", "stop") stops Ezri fast.
    if (!isFinal) {
      return words.length >= 1 && candidate.length >= 3;
    }

    // Final: even a single clear word (â‰¥4 chars) is a valid barge-in signal.
    return candidate.length >= 4;
  };

  const autoEmergencyDialTriggeredRef = useRef(false);
  const lastCrisisEventReportAtRef = useRef(0);
  const parseDialTarget = (rawPhone: string): string | null => {
    const normalized = rawPhone.toLowerCase();
    const candidates = normalized
      .split(/\bor\b|\/|,|;|\|/g)
      .map((part) => part.trim())
      .filter(Boolean);

    for (const candidate of candidates) {
      const digitsOnly = candidate.replace(/[^\d+#*]/g, "");
      if (digitsOnly.length >= 3) return digitsOnly;
    }

    const fallback = normalized.replace(/[^\d+#*]/g, "");
    return fallback.length >= 3 ? fallback : null;
  };
  const getEmergencyDialTarget = (): string | null => {
    const userRegion = getCurrentRegion();
    const emergencyByRegion = getRegionInfo(userRegion).emergencyNumber;
    const emergencyResources = getEmergencyResources(userRegion);
    const emergencyNumber =
      emergencyByRegion ||
      emergencyResources.find((r) => r.type === "emergency" && r.phone)?.phone ||
      emergencyResources.find((r) => !!r.phone)?.phone;
    if (!emergencyNumber) return null;
    return parseDialTarget(emergencyNumber);
  };
  const openEmergencyDialer = () => {
    const dialTarget = getEmergencyDialTarget();
    if (dialTarget) {
      setCrisisDialTarget(dialTarget);
      window.location.assign(`tel:${dialTarget}`);
      return;
    }
    toast.error("No emergency number available for your selected region.");
  };

  const handleUserText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const fp = normalizeSpeech(trimmed);
    if (fp.length >= 4) {
      const now = Date.now();
      const prevFp = lastSentUserChatFingerprintRef.current;
      if (prevFp.n === fp && now - prevFp.t < 4500) {
        if (import.meta.env.DEV) {
          console.warn("[chat] Deduped duplicate sendChat (same utterance within 4.5s).");
        }
        return;
      }
      lastSentUserChatFingerprintRef.current = { n: fp, t: now };
    }

    // â”€â”€ Silence-gap merge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // If the backend is still processing the previous message (thinking, not yet
    // speaking), cancel that request and re-send both texts as a single message.
    // This covers the pattern: user speaks â†’ silence â†’ user speaks again before
    // the response arrives. Without this, both utterances would be processed
    // independently, giving two separate replies instead of one coherent answer.
    if (isEzriThinkingRef.current && !isEzriSpeakingRef.current) {
      const prev = pendingUserTextRef.current;
      const merged = prev ? `${prev} ${trimmed}` : trimmed;

      // Abort in-flight REST request immediately.
      if (restAbortControllerRef.current) {
        restAbortControllerRef.current.abort();
        restAbortControllerRef.current = null;
      }
      // Tell WS callbacks to silently drop the NEXT complete response cycle
      // (text + audio + tts_done) that arrives for the old in-flight request.
      // We do NOT touch suppressIncomingAudioRef here â€” that ref is only for
      // the barge-in path. The WS path in handleUserText will lift it normally
      // for the merged message, so the merged response flows through freely.
      dropOldResponsesRef.current += 1;

      // Reset thinking state so the recursive call proceeds cleanly.
      setIsEzriThinking(false);
      isEzriThinkingRef.current = false;
      pendingUserTextRef.current = "";

      console.log(`[merge] Combining "${prev}" + "${trimmed}" â†’ "${merged}" (drop=${dropOldResponsesRef.current})`);
      void handleUserText(merged);
      return;
    }

    // Record what we are about to send so follow-up speech can be merged.
    pendingUserTextRef.current = trimmed;

    // Safety analysis should be based on real user content (not mock phrases).
    try {
      const analysis = analyzeTextForSafety(trimmed, currentState);
      const isCrisisKeywordDetection =
        analysis.matchedKeywords.length > 0 &&
        (analysis.suggestedState === "HIGH_RISK" ||
          analysis.suggestedState === "SAFETY_MODE");

      if (isCrisisKeywordDetection && CRISIS_KEYWORD_MODAL_ENABLED) {
        setDetectedCrisisKeywords(analysis.matchedKeywords);
        setShowCrisisKeywordModal(true);
      }

      if (analysis.suggestedState === "SAFETY_MODE" && !autoEmergencyDialTriggeredRef.current) {
        autoEmergencyDialTriggeredRef.current = true;
        try {
          openEmergencyDialer();
        } catch (error) {
          console.error("Failed to auto-open emergency dialer:", error);
        }
      }

      if (
        analysis.suggestedState === "ELEVATED_CONCERN" ||
        analysis.suggestedState === "HIGH_RISK" ||
        analysis.suggestedState === "SAFETY_MODE"
      ) {
        const now = Date.now();
        const shouldReport = now - lastCrisisEventReportAtRef.current > 30000;
        if (shouldReport) {
          lastCrisisEventReportAtRef.current = now;
          const riskLevel =
            analysis.suggestedState === "SAFETY_MODE"
              ? "critical"
              : analysis.suggestedState === "HIGH_RISK"
                ? "high"
                : "medium";
          api
            .reportCrisisEvent({
              riskLevel,
              eventType: "keyword_detection",
              keywords: analysis.matchedKeywords,
              aiConfidence: Math.round(analysis.confidence * 100),
              notes: `Auto-detected in active talking  (${analysis.suggestedState})`,
            })
            .catch((error) => {
              console.error("Failed to report crisis event:", error);
            });
        }
      }

      if (analysis.confidence > 0.6 && analysis.suggestedState !== currentState) {
        updateState(
          analysis.suggestedState,
          "conversation_analysis",
          analysis.detectedSignals
        );
      }
    } catch { }

    setTranscript((prev) => mergeUserTranscriptAppend(prev, trimmed));
    setLiveUserSpeech("");
    scrollTranscriptToBottom();

    setIsEzriThinking(true);
    isEzriThinkingRef.current = true;
    let spokeViaWebSocket = false;
    try {
      const ws = wsClientRef.current;
      if (ws && ws.getStatus() === "connected") {
        spokeViaWebSocket = true;
        // Abort any lingering REST request from a previous turn.
        if (restAbortControllerRef.current) {
          restAbortControllerRef.current.abort();
          restAbortControllerRef.current = null;
        }
        // Allow new audio from server now that a real new message is being sent.
        suppressIncomingAudioRef.current = false;
        wsActiveTurnRef.current += 1;
        wsAudioSeenTurnRef.current = 0;
        wsAssistantBufferRef.current = "";
        wsLastFinalTextRef.current = "";
        if (wsSpeakFallbackTimerRef.current) {
          window.clearTimeout(wsSpeakFallbackTimerRef.current);
          wsSpeakFallbackTimerRef.current = null;
        }
        try {
          ws.sendChat(trimmed);
        } catch (e: any) {
          spokeViaWebSocket = false;
          throw e;
        }
      }

      if (spokeViaWebSocket) {
        return;
      }

      if (!ezriApi || !ezriConfig) {
        throw new Error("Solace is not configured (missing env).");
      }

      // Abort any previously in-flight REST request.
      if (restAbortControllerRef.current) {
        restAbortControllerRef.current.abort();
      }
      const abortCtrl = new AbortController();
      restAbortControllerRef.current = abortCtrl;
      // Allow new audio now that we're actually sending a new message.
      suppressIncomingAudioRef.current = false;
      // Capture active turn so we can verify it hasn't been superseded when the response arrives.
      const myRestTurn = wsActiveTurnRef.current;

      const brainProvider = ezriConfig.defaults.brainProvider;
      const res = await ezriApi.sendChatRest({
        prompt: trimmed,
        provider: brainProvider,
        userid: ezriUserid,
        session_id: sessionId,
        voice: ezriTtsVoiceId,
        signal: abortCtrl.signal,
      });

      // If the user interrupted while the REST call was in-flight, discard result.
      if (myRestTurn !== wsActiveTurnRef.current) return;
      restAbortControllerRef.current = null;

      if (res.text) appendAssistantFinal(res.text);
      if (res.audio) {
        await playEzriAudio(res.text || trimmed, res.audio);
      } else if (res.text) {
        await speakViaEzriTts(res.text);
      }
    } catch (e: any) {
      // AbortError is expected when interrupted â€” don't show an error toast.
      if ((e as any)?.name === "AbortError") return;
      console.error("Solace chat failed:", e);
      toast.error(e?.message || "Solace chat failed");
    } finally {
      // WebSocket replies clear thinking in onAssistantText / onAudio / onError.
      if (!spokeViaWebSocket) {
        setIsEzriThinking(false);
        isEzriThinkingRef.current = false;
        pendingUserTextRef.current = "";
      }
    }
  };

  // â”€â”€ Audio Visualizer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!stream) return;

    let animationFrameId: number;
    let audioContext: AudioContext;

    try {
      audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const updateAudioLevel = () => {
        if (audioContext.state === "suspended") audioContext.resume();
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        const level = sum / bufferLength;
        if (!isEzriSpeakingRef.current) {
          mouthAudioLevelRef.current = level;
        }
        audioLevelForWatchdogRef.current = level;
        animationFrameId = requestAnimationFrame(updateAudioLevel);
      };

      updateAudioLevel();
    } catch (e) {
      console.error("Audio visualizer error:", e);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (audioContext && audioContext.state !== "closed") audioContext.close();
    };
  }, [stream]);

  /** Attach MediaStream to the PiP <video>; play() is required after srcObject changes (Chrome/Safari). */
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    void el.play().catch((err) => {
      console.warn("[ActiveSession] camera preview play():", err);
    });
  }, [stream]);

  useEffect(() => {
    streamCleanupRef.current = stream;
  }, [stream]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    if (permissionStateInitialized) return;

    if (
      typeof window === "undefined" ||
      typeof window.localStorage === "undefined"
    ) {
      setShowPermissionRequest(true);
      setPermissionStateInitialized(true);
      return;
    }

    try {
      const stored = window.localStorage.getItem(permissionStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed === true || parsed === "granted") {
          // Past consent is stored only for UX; never call getUserMedia until "Allow Access"
          // (still need a real MediaStream â€” same rule as first visit).
          setShowPermissionRequest(true);
          setPermissionStateInitialized(true);
          return;
        }
      }
      setShowPermissionRequest(true);
    } catch (error) {
      console.error("Failed to load media permission setting:", error);
      setShowPermissionRequest(true);
    } finally {
      setPermissionStateInitialized(true);
    }
  }, [permissionStorageKey, permissionStateInitialized]);

  // Browser STT via Web Speech API (Chrome/Edge/Safari). Server PCM mode uses mic streaming only —
  // starting SpeechRecognition alongside PCM causes mic conflicts on Firefox/Safari.
  useEffect(() => {
    if (!permissionsGranted || !stream) return;
    if (!browserSttActive) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.log("[STT] Browser STT supported: false");
      console.log("[STT] Using MediaRecorder STT fallback");
      if (!serverSttToastShownRef.current) {
        serverSttToastShownRef.current = true;
        toast.info("Using server voice recognition for this browser.");
      }
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    // Tracks whether the last error before onend was fatal (broken recognizer).
    // Fatal errors require a full recreate; non-fatal ones ('no-speech', 'aborted')
    // allow a simple restart.
    let sttErrored = false;

    recognition.onstart = () => {
      console.log("Speech recognition started");
      lastSpeechStartRef.current = Date.now();
      userSpeechStartedAtMsRef.current = performance.now();
      setIsListening(true);
      isRecognitionActiveRef.current = true;
    };

    recognition.onsoundstart = () => {
      console.log("SpeechRecognition: Sound detected");
      // Do not interrupt on raw sound alone â€” speaker echo can trigger this.
      // We interrupt on recognized speech text below after echo filtering.
    };
    recognition.onsoundend = () =>
      console.log("SpeechRecognition: Sound ended");

    recognition.onresult = (event: any) => {
      if (isMutedRef.current || isSessionPausedRef.current) {
        return;
      }

      const current = event.resultIndex;
      const result = event.results[current];
      const transcriptText = result[0].transcript;
      const isFinal = result.isFinal;

      if (transcriptText.trim()) {
        const trimmed = transcriptText.trim();

        // Drop Jordan's voice picked up by the mic (e.g. "welcome back" from "Welcome back!").
        if (shouldIgnoreEchoBargeIn(trimmed)) {
          return;
        }

        // While TTS plays, only real user barge-in may interrupt — never echo-first.
        if (ezriWsAudioPipelineActive()) {
          if (!shouldInterruptForSpeech(trimmed, isFinal)) {
            return;
          }
          if (!isFinal) {
            requestBargeInInterrupt("speech_interim");
            return;
          }
          requestBargeInInterrupt("speech_final");
        }

        if (!isFinal) {
          if (browserSttActive) {
            return;
          }
          if (trimmed.length < 2) return;
          latestUserTextRef.current = trimmed;
          userLastSpeechAtMsRef.current = performance.now();
          if (subtitleDebounceRef.current) clearTimeout(subtitleDebounceRef.current);
          subtitleDebounceRef.current = setTimeout(() => {
            setLiveUserSpeech(trimmed);
            subtitleDebounceRef.current = null;
          }, 80);
          return;
        }

        if (subtitleDebounceRef.current) {
          clearTimeout(subtitleDebounceRef.current);
          subtitleDebounceRef.current = null;
        }
        setLiveUserSpeech("");

        // Web Speech often emits a final segment that drops the leading tokens already shown in the
        // last interim â€” especially after restart / barge-in. Prepend recent interim when safe.
        const interimSnapshot = lastInterimTextRef.current.trim();
        let textForUtterance = trimmed;
        const interimRecent =
          interimSnapshot.length >= 5 &&
          Date.now() - lastInterimToastAtRef.current < 2000;
        const allowInterimCarry =
          !ezriWsAudioPipelineActive() || Date.now() < bargeInEchoGraceUntilRef.current;
        if (interimRecent && allowInterimCarry && !shouldIgnoreEchoBargeIn(interimSnapshot)) {
          const fl = trimmed.toLowerCase();
          const il = interimSnapshot.toLowerCase();
          const head = il.slice(0, Math.min(16, il.length));
          const firstWd = interimSnapshot.split(/\s+/).find((w) => w.length >= 3);
          const firstLc = firstWd?.toLowerCase() ?? "";
          if (fl.startsWith(il) || (head.length >= 4 && fl.startsWith(head))) {
            textForUtterance =
              trimmed.length >= interimSnapshot.length ? trimmed : interimSnapshot;
          } else if (firstLc && !fl.includes(firstLc)) {
            textForUtterance = `${interimSnapshot} ${trimmed}`.replace(/\s+/g, " ").trim();
          }
        }
        lastInterimTextRef.current = "";

        const lowerTrimmed = textForUtterance.toLowerCase();
        latestUserTextRef.current = textForUtterance;
        userLastSpeechAtMsRef.current = performance.now();
        console.log(
          "Heard (Final):",
          lowerTrimmed,
          "Current Step:",
          scriptStepRef.current
        );
        if (speechTimeoutRef.current)
          window.clearTimeout(speechTimeoutRef.current);

        if (
          lowerTrimmed === "repeat question" ||
          lowerTrimmed === "what did you say" ||
          lowerTrimmed === "say that again"
        ) {
          const lastAssistant = transcriptRef.current
            .slice()
            .reverse()
            .find((t) => t.role === "assistant");
          const toRepeat = lastAssistant?.content || "I haven't said anything yet.";
          void speakViaEzriTts(toRepeat);
          return;
        }

        void handleUserText(textForUtterance);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("[STT] Speech recognition error:", event.error);
      // 'no-speech' and 'aborted' are non-fatal â€” recognizer fires onend and can restart.
      if (event.error === "no-speech" || event.error === "aborted") {
        sttErrored = false;
      } else {
        // 'audio-capture', 'network', 'not-allowed', 'service-not-allowed' â€” recognizer broken.
        sttErrored = true;
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setLiveUserSpeech("");
      isRecognitionActiveRef.current = false;

      // While STT is suppressed (Ezri speaking / cooldown), do not restart yet.
      // resumeStt() will call start() once audio playback finishes.
      if (suppressSttRef.current) return;

      if (sttErrored) {
        // Fatal error — recreate recognizer (Ezri_Avatar app.js: 1000ms backoff).
        console.warn("[STT] Fatal error detected in onend — destroying recognizer, will recreate.");
        recognitionRef.current = null;
        window.setTimeout(() => {
          if (!isSessionEndingRef.current) {
            setSttRestartTrigger((t) => t + 1);
          }
        }, 1000);
        return;
      }

      if (
        permissionsGranted &&
        !isSessionPausedRef.current &&
        !isEzriSpeakingRef.current &&
        !isSessionEndingRef.current
      ) {
        const sessionDuration = Date.now() - lastSpeechStartRef.current;
        const recentBargeIn =
          Date.now() - lastBargeInAtRef.current < 3000 && lastBargeInAtRef.current > 0;
        // Small back-off only for very short runs (< 300ms) to prevent tight no-speech loops.
        // After user barge-in, restart ASAP so speech right after interrupt is not clipped.
        const restartDelay =
          sessionDuration < 300
            ? recentBargeIn
              ? 50
              : 1500
            : recentBargeIn
              ? 80
              : 300;
        console.log(
          `[STT] Recognition ended (ran for ${sessionDuration}ms), restarting in ${restartDelay}ms...`
        );

        setTimeout(() => {
          if (isSessionEndingRef.current) return;
          try {
            if (
              !isSessionPausedRef.current &&
              !isEzriSpeakingRef.current &&
              recognitionRef.current &&
              !isRecognitionActiveRef.current
            ) {
              recognitionRef.current.start();
            }
          } catch (e) {
            console.error("[STT] Failed to restart speech recognition:", e);
            recognitionRef.current = null;
            setSttRestartTrigger((t) => t + 1);
          }
        }, restartDelay);
      }
    };

    try {
      console.log("Starting speech recognition...");
      if (!isSessionEndingRef.current && !isRecognitionActiveRef.current) {
        recognition.start();
      }
    } catch (e) {
      console.error("Failed to start speech recognition", e);
    }

    return () => {
      recognition.onend = null;
      try {
        recognition.stop();
      } catch (e) { }
      setIsListening(false);
      isRecognitionActiveRef.current = false;
      recognitionRef.current = null;
    };
  }, [
    permissionsGranted,
    stream,
    sttRestartTrigger,
    browserSttActive,
    scrollTranscriptToBottom,
    ezriConfig?.apiBase,
  ]);

  // â”€â”€ Server STT via MediaRecorder (browser STT mode + no Web Speech API) â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!permissionsGranted) return;
    if (!stream) return;
    if (!browserSttActive) return;

    // Only activate when the browser does NOT support SpeechRecognition.
    const hasBrowserStt = !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );
    if (hasBrowserStt) return;

    if (typeof MediaRecorder === "undefined") {
      console.error("[STT] MediaRecorder not supported â€” no STT available in this browser.");
      return;
    }

    console.log("[STT] Browser STT supported: false");
    console.log("[STT] Using MediaRecorder STT fallback");

    const audioTracks = stream.getAudioTracks();
    console.log("[STT] MediaRecorder supported:", typeof MediaRecorder !== "undefined");
    console.log("[STT] mic stream audio tracks:", audioTracks.map((t) => ({
      label: t.label,
      readyState: t.readyState,
      enabled: t.enabled,
    })));

    if (!audioTracks.length || audioTracks[0].readyState !== "live") {
      console.warn("[STT] No live audio track available for MediaRecorder.");
      return;
    }

    // Priority: webm/opus â†’ ogg/opus â†’ webm (plain) â€” best Whisper compat across browsers.
    const mimeType =
      MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
          ? "audio/ogg;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : "";
    console.log("[STT] selected mimeType:", mimeType || "(browser default)");

    // Route STT through the AI backend's /api/v1/transcribe endpoint (multipart upload).
    const transcribeUrl = `${(ezriConfig?.apiBase || "").replace(/\/+$/, "")}/api/v1/transcribe`;
    console.log("[STT] using transcribe URL:", transcribeUrl);

    const sendChunkToStt = async (blob: Blob) => {
      console.log("[STT] blob size:", blob.size);
      if (!blob.size) return;
      if (
        isMutedRef.current ||
        isSessionPausedRef.current ||
        isSessionEndingRef.current ||
        ezriWsAudioPipelineActive()
      )
        return;

      const ext = mimeType.includes("ogg") ? "ogg" : "webm";

      // Show a processing indicator in the subtitle while waiting for the server.
      setLiveUserSpeech("ðŸŽ™ Processing...");

      try {
        const formData = new FormData();
        formData.append("file", blob, `audio.${ext}`);

        const res = await fetch(transcribeUrl, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => String(res.status));
          console.error("[STT] Server STT request failed:", res.status, errText);
          setLiveUserSpeech("");
          return;
        }

        const data = await res.json();
        const text = (data.transcription || data.text || "").trim();
        console.log("[STT] transcript result:", text || "(empty)");

        if (!text) {
          setLiveUserSpeech("");
          return;
        }
        if (isMutedRef.current || isSessionPausedRef.current) {
          setLiveUserSpeech("");
          return;
        }

        // Show the transcribed text as subtitle briefly before clearing.
        setLiveUserSpeech(text);
        latestUserTextRef.current = text;
        userLastSpeechAtMsRef.current = performance.now();

        if (shouldIgnoreEchoBargeIn(text)) {
          setLiveUserSpeech("");
          return;
        }

        if (ezriWsAudioPipelineActive()) {
          if (!shouldInterruptForSpeech(text, true)) {
            setLiveUserSpeech("");
            return;
          }
          requestBargeInInterrupt("speech_final");
          setLiveUserSpeech("");
          return;
        }

        // Deduplicate â€” server STT can repeat if the same audio is sent twice.
        setTranscript((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.content === text && Date.now() - last.timestamp < 5000)
            return prev;
          return [...prev, { role: "user", content: text, timestamp: Date.now() }];
        });

        // Repeat-last-line shortcut.
        const lower = text.toLowerCase();
        if (
          lower === "repeat question" ||
          lower === "what did you say" ||
          lower === "say that again"
        ) {
          const lastAssistant = transcriptRef.current
            .slice()
            .reverse()
            .find((t) => t.role === "assistant");
          void speakViaEzriTts(lastAssistant?.content || "I haven't said anything yet.");
          setLiveUserSpeech("");
          return;
        }

        void handleUserText(text);
        // Clear subtitle after a short delay so the user can read what was heard.
        setTimeout(() => setLiveUserSpeech(""), 1500);
      } catch (e) {
        console.error("[STT] Server STT error:", e);
        setLiveUserSpeech("");
      }
    };

    const audioOnlyStream = new MediaStream(audioTracks);
    const recorderOpts: MediaRecorderOptions = mimeType ? { mimeType } : {};
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(audioOnlyStream, recorderOpts);
    } catch (e) {
      console.error("[STT] Failed to create MediaRecorder:", e);
      return;
    }

    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        void sendChunkToStt(e.data);
      }
    };

    recorder.onstart = () => {
      mediaRecorderActiveRef.current = true;
      setIsListening(true);
      setLiveUserSpeech("ðŸŽ™ Listening...");
      console.log("[STT] MediaRecorder started, state:", recorder.state);
    };

    recorder.onstop = () => {
      mediaRecorderActiveRef.current = false;
      setIsListening(false);
      setLiveUserSpeech("");
      console.log("[STT] MediaRecorder stopped");
    };

    recorder.onerror = (e) => {
      console.error("[STT] MediaRecorder error:", e);
      mediaRecorderActiveRef.current = false;
      setIsListening(false);
      setLiveUserSpeech("");
    };

    try {
      // Collect a chunk every 3 seconds.
      recorder.start(3000);
    } catch (e) {
      console.error("[STT] Failed to start MediaRecorder:", e);
      return;
    }

    return () => {
      if (recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch (_) { }
      }
      mediaRecorderRef.current = null;
      mediaRecorderActiveRef.current = false;
      setIsListening(false);
    };
  }, [permissionsGranted, stream, browserSttActive, ezriConfig?.apiBase]);

  // â”€â”€ Watchdog (browser SpeechRecognition only — RunPod uses PCM, not recognition) â”€â”€
  useEffect(() => {
    if (!permissionsGranted) return;
    if (!browserSttActive) return;

    const watchdog = setInterval(() => {
      if (
        !isSessionEndingRef.current &&
        !isSessionPausedRef.current &&
        !isListening &&
        !isEzriSpeakingRef.current &&
        !suppressSttRef.current
      ) {
        if (recognitionRef.current && !isRecognitionActiveRef.current) {
          console.log("[Watchdog] Recognition stopped unexpectedly, restarting...");
          try {
            recognitionRef.current.start();
          } catch (e) {
            // Recognizer broken â€” null it so the trigger forces a full reinit.
            recognitionRef.current = null;
            setSttRestartTrigger((t) => t + 1);
          }
        } else if (!recognitionRef.current) {
          // Recognizer was destroyed by a fatal error and not yet recreated.
          console.log("[Watchdog] Recognizer is null, triggering reinit...");
          setSttRestartTrigger((t) => t + 1);
        }
      }

      if (
        isListening &&
        audioLevelForWatchdogRef.current < 2 &&
        !isEzriSpeakingRef.current
      ) {
        const now = Date.now();
        if (now - lastSilentMicWarnAtRef.current > 60_000) {
          lastSilentMicWarnAtRef.current = now;
          console.warn(
            "Watchdog: Microphone seems silent despite 'Listening' state."
          );
        }
      }
    }, 5000);

    return () => clearInterval(watchdog);
  }, [permissionsGranted, isListening, browserSttActive]);

  // â”€â”€ Mic-level barge-in (always when TTS pipeline active) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Mobile: Web Speech is aborted during TTS â€” mic level is the main path.
  // Desktop: Web Speech often yields no/lazy results under AEC; RMS stops playback when the user
  // clearly talks over Ezri. Desktop uses a higher threshold + longer hold than mobile to limit
  // false triggers from speaker bleed.
  useEffect(() => {
    if (!permissionsGranted) return;

    let raf: number | null = null;
    let aboveSince: number | null = null;

    const THRESH = isMobileBrowser ? 18 : 34;
    const HOLD_MS = isMobileBrowser ? 130 : 220;

    const tick = () => {
      if (isSessionEndingRef.current) return;
      if (isMutedRef.current || isSessionPausedRef.current) {
        aboveSince = null;
        raf = requestAnimationFrame(tick);
        return;
      }
      const pipelineActive = ezriWsAudioPipelineActive();
      if (!pipelineActive) {
        aboveSince = null;
        raf = requestAnimationFrame(tick);
        return;
      }

      // Speaker bleed at the start of TTS looks like user speech — ignore briefly (app.js echo window).
      if (performance.now() - jordanSpeechStartedAtMsRef.current < 1800) {
        aboveSince = null;
        raf = requestAnimationFrame(tick);
        return;
      }

      const level = audioLevelForWatchdogRef.current;
      if (level >= THRESH) {
        if (aboveSince === null) aboveSince = performance.now();
        const held = performance.now() - aboveSince;
        if (held >= HOLD_MS) {
          aboveSince = null;
          requestBargeInInterrupt("mic_level_barge_in");
        }
      } else {
        aboveSince = null;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [permissionsGranted, isMobileBrowser]);

  // â”€â”€ Media stream cleanup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Media access is initiated only via requestMediaAccess() on user action.
  // Stop tracks only when unmounting; stopping on stream updates can kill
  // reused tracks and blank the local preview in dev StrictMode.
  useEffect(() => {
    return () => {
      const currentStream = streamCleanupRef.current;
      if (currentStream) currentStream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // Safety state
  const [showSafetyBoundary, setShowSafetyBoundary] = useState(false);
  const [showSafetyResources, setShowSafetyResources] = useState(false);
  const [showCrisisKeywordModal, setShowCrisisKeywordModal] = useState(false);
  const [detectedCrisisKeywords, setDetectedCrisisKeywords] = useState<string[]>([]);
  const [crisisDialTarget, setCrisisDialTarget] = useState<string>("");
  const [isSessionPaused, setIsSessionPaused] = useState(false);
  const [lastSafetyState, setLastSafetyState] = useState(currentState);

  useEffect(() => {
    isSessionPausedRef.current = isSessionPaused;
  }, [isSessionPaused]);

  useEffect(() => {
    if (!stream) return;
    stream
      .getAudioTracks()
      .forEach((track) => (track.enabled = !isMuted && !isSessionPaused));
    stream
      .getVideoTracks()
      .forEach((track) => (track.enabled = !isCameraOff));
  }, [isMuted, isCameraOff, isSessionPaused, stream]);

  // Pause should stop *all* listening + playback (no mic capture, no STT, no avatar audio).
  useEffect(() => {
    if (isSessionPaused) {
      // Stop any assistant playback immediately
      audioPlaySeqRef.current += 1;
      wsAudioQueueRef.current = [];
      wsIsPlaybackActiveRef.current = false;
      try {
        wsClientRef.current?.sendPlaybackDone();
      } catch {
        /* ignore */
      }
      stopAudioAndSpeechDriver();

      // Stop speech recognition so we don't keep listening in the background
      try {
        if (recognitionRef.current) {
          recognitionRef.current.onend = null;
          recognitionRef.current.stop();
        }
      } catch { }
      setIsListening(false);
      isRecognitionActiveRef.current = false;
      return;
    }

    // Resume: restart recognition if allowed and not currently active
    try {
      if (
        permissionsGranted &&
        !isMutedRef.current &&
        !isEzriSpeakingRef.current &&
        !isSessionEndingRef.current &&
        recognitionRef.current &&
        !isRecognitionActiveRef.current
      ) {
        recognitionRef.current.start();
      }
    } catch {
      /* ignore */
    }
  }, [isSessionPaused, permissionsGranted]);

  // Credits
  const [initialCreditsSeconds, setInitialCreditsSeconds] = useState<number | null>(
    null
  );
  const [accountCreditsSeconds, setAccountCreditsSeconds] = useState<number | null>(null);
  const [showLowCreditsWarning, setShowLowCreditsWarning] = useState(false);
  const [lowCreditsWarningDismissed, setLowCreditsWarningDismissed] = useState(false);
  const [showOutOfCredits, setShowOutOfCredits] = useState(false);
  const [showLowMinutesModal, setShowLowMinutesModal] = useState(false);
  const [hasShownLowMinutesModal, setHasShownLowMinutesModal] = useState(false);
  const [isBuyingMoreMinutes, setIsBuyingMoreMinutes] = useState(false);
  const previousConnectionQuality = useRef(connectionQuality);

  useEffect(() => {
    const loadCredits = async () => {
      try {
        const { credits_seconds, credits } = await api.getCredits();
        const sessionLimitSeconds =
          typeof duration === "number" && duration > 0
            ? duration * 60
            : Number.POSITIVE_INFINITY;
        const userCreditsSeconds =
          typeof credits_seconds === "number"
            ? Math.max(0, credits_seconds)
            : typeof credits === "number" && credits > 0
              ? credits * 60
              : 0;
        const effectiveSeconds =
          sessionLimitSeconds === Number.POSITIVE_INFINITY
            ? userCreditsSeconds
            : Math.min(userCreditsSeconds, sessionLimitSeconds);
        setAccountCreditsSeconds(userCreditsSeconds);
        setInitialCreditsSeconds(effectiveSeconds);
      } catch (err) {
        console.error("Failed to load credits:", err);
      }
    };
    loadCredits();
  }, [duration]);

  const [fallbackEzriSessionId] = useState(
    () => `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  );
  const sessionId = apiSessionId ?? fallbackEzriSessionId;
  const [hasSessionEnded, setHasSessionEnded] = useState(false);

  const ezriUserid = useMemo(() => getOrCreateEzriUserid(user?.id), [user?.id]);
  const ezriApi = useMemo(() => (ezriConfig ? createEzriApiClient(ezriConfig.apiBase) : null), [ezriConfig]);

  const [ezriWsStatus, setEzriWsStatus] = useState<EzriWsStatus>("disconnected");
  const [isEzriThinking, setIsEzriThinking] = useState(false);

  /** Unstick UI if the server never returns after thinking (network/backend stall). */
  useEffect(() => {
    if (!isEzriThinking || isEzriSpeaking) return;

    const t = window.setTimeout(() => {
      if (!isEzriThinkingRef.current || ezriWsAudioPipelineActive()) return;
      setIsEzriThinking(false);
      isEzriThinkingRef.current = false;
      const fallback = wsPendingFallbackTextRef.current.trim();
      if (fallback) {
        wsPendingFallbackTextRef.current = "";
        void speakViaEzriTts(fallback);
      }
    }, THINKING_STUCK_MS);

    return () => window.clearTimeout(t);
  }, [isEzriThinking, isEzriSpeaking]);

  useEffect(() => {
    if (ezriWsStatus === "connected" && ezriWarmupStatus === "idle") {
      setEzriWarmupStatus("warming");
    }
  }, [ezriWsStatus, ezriWarmupStatus]);

  useEffect(() => {
    if (ezriWsStatus !== "connected" || ezriWarmupStatus === "ready") return;
    const fallbackMs = 35_000;
    const t = window.setTimeout(() => {
      if (!ezriWarmupReadyRef.current) {
        ezriWarmupReadyRef.current = true;
        setEzriWarmupStatus("ready");
      }
    }, fallbackMs);
    return () => window.clearTimeout(t);
  }, [ezriWsStatus, ezriWarmupStatus]);

  const wsClientRef = useRef<EzriRealtimeClient | null>(null);
  const wsAssistantBufferRef = useRef<string>("");
  const wsLastFinalTextRef = useRef<string>("");

  useEffect(() => {
    isSoundOffRef.current = isSoundOff;
    if (!isSoundOff) return;
    audioPlaySeqRef.current += 1;
    wsAudioQueueRef.current = [];
    wsIsPlaybackActiveRef.current = false;
    try {
      wsClientRef.current?.sendPlaybackDone();
    } catch {
      /* ignore */
    }
    stopAudioAndSpeechDriver();
  }, [isSoundOff]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRevokeRef = useRef<(() => void) | null>(null);
  const speechDriverIntervalRef = useRef<number | null>(null);

  // â”€â”€ Ezri WebSocket (primary realtime) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!ezriConfig) return;
    if (hasSessionEnded) return;
    // Connect + warmup while the permission modal is visible (Ezri Avatar app.js parity).

    const client =
      wsClientRef.current ||
      new EzriRealtimeClient({
        onStatus: (s) => setEzriWsStatus(s),
        onAssistantText: (text, kind) => {
          // Drop everything from the old turn until the user's new message is sent.
          if (suppressIncomingAudioRef.current) return;
          // Drop old in-flight responses that arrived before the merged message's response.
          if (dropOldResponsesRef.current > 0) return;

          if (kind === "partial") {
            wsAssistantBufferRef.current += text;
            return;
          }

          const full = (wsAssistantBufferRef.current + text).trim();
          wsAssistantBufferRef.current = "";

          // Deduplicate: some backends emit both transcription.ai and assistant_final.
          if (full && full === wsLastFinalTextRef.current) return;
          wsLastFinalTextRef.current = full;

          if (wsSpeakFallbackTimerRef.current) {
            window.clearTimeout(wsSpeakFallbackTimerRef.current);
            wsSpeakFallbackTimerRef.current = null;
          }

          if (full) {
            if (!permissionsGrantedRef.current) {
              prePermissionTranscriptRef.current.push({
                role: "assistant",
                content: full,
              });
            } else {
              appendAssistantFinal(full);
            }
            // Store for potential fallback ONLY if the server never sends audio.
            wsPendingFallbackTextRef.current = full;
            scheduleAssistantSpeakFallback(full);
          }
          setIsEzriThinking(false);
          isEzriThinkingRef.current = false;
          pendingUserTextRef.current = "";
        },
        onUserTranscript: (text) => {
          if (dropOldResponsesRef.current > 0) {
            dropOldResponsesRef.current = 0;
          }
          suppressIncomingAudioRef.current = false;
          const t = text.trim();
          if (!t) return;
          latestUserTextRef.current = t;
          userLastSpeechAtMsRef.current = performance.now();
          if (!permissionsGrantedRef.current) {
            prePermissionTranscriptRef.current.push({ role: "user", content: t });
            return;
          }
          setTranscript((prev) => mergeUserTranscriptAppend(prev, t));
          scrollTranscriptToBottom();
          setLiveUserSpeech("");
          if (!isEzriSpeakingRef.current && !ezriWsAudioPipelineActive()) {
            setIsEzriThinking(true);
            isEzriThinkingRef.current = true;
          }
        },
        onTtsDone: () => {
          // Greeting may finish before mic permission â€” defer playback_done until audio plays.
          if (!permissionsGrantedRef.current) {
            wsTtsDoneReceivedRef.current = true;
            wsTtsStreamingRef.current = false;
            return;
          }
          // tts_done from an interrupted turn â€” mark done so queue cannot stall (app.js parity).
          if (suppressIncomingAudioRef.current) {
            wsTtsDoneReceivedRef.current = true;
            wsTtsStreamingRef.current = false;
            return;
          }
          // This tts_done closes one old response cycle â€” decrement the drop counter
          // so the NEXT response (the merged one) is allowed through.
          if (dropOldResponsesRef.current > 0) {
            dropOldResponsesRef.current -= 1;
            wsAudioQueueRef.current = [];
            wsIsPlaybackActiveRef.current = false;
            wsTtsDoneReceivedRef.current = false;
            wsTtsStreamingRef.current = false;
            return;
          }

          wsTtsDoneReceivedRef.current = true;
          wsTtsStreamingRef.current = false;
          jordanLastSpeechAtMsRef.current = performance.now();

          // Ezri app.js: if greeting audio already finished (common on Firefox), unlock the server mic now.
          if (
            !suppressIncomingAudioRef.current &&
            !wsIsPlaybackActiveRef.current &&
            wsAudioQueueRef.current.length === 0 &&
            prePermissionAudioQueueRef.current.length === 0
          ) {
            if (pendingPlaybackDoneRef.current || !playbackDoneAckRef.current) {
              console.log("[WS] tts_done + idle queue — sending playback_done immediately");
              sendPlaybackDoneNowRef.current();
            }
          } else if (pendingPlaybackDoneRef.current) {
            sendPlaybackDoneNowRef.current();
          }

          clearTtsDoneGraceTimer();
          const turnAtDone = wsActiveTurnRef.current;
          const heardAudioThisTurn =
            wsAudioSeenTurnRef.current === turnAtDone;

          // Late binary chunks can arrive after tts_done — wait before declaring playback finished.
          wsTtsDoneGraceTimerRef.current = window.setTimeout(() => {
            wsTtsDoneGraceTimerRef.current = null;
            if (suppressIncomingAudioRef.current) return;
            if (turnAtDone !== wsActiveTurnRef.current) return;

            if (!heardAudioThisTurn && !ezriWsAudioPipelineActive()) {
              const t = wsPendingFallbackTextRef.current.trim();
              if (t) {
                wsPendingFallbackTextRef.current = "";
                void speakViaEzriTts(t);
              }
            }

            if (
              wsTtsDoneReceivedRef.current &&
              !wsIsPlaybackActiveRef.current &&
              wsAudioQueueRef.current.length === 0 &&
              prePermissionAudioQueueRef.current.length === 0
            ) {
              playNextWsQueue();
            }
          }, TTS_DONE_GRACE_MS);
        },
        onSpeakingStart: () => {
          // Always pause local STT as soon as the server commits to TTS (Ezri Avatar app.js parity).
          playbackDoneAckRef.current = false;
          pendingPlaybackDoneRef.current = false;
          wsTtsDoneReceivedRef.current = false;
          wsTtsStreamingRef.current = true;
          jordanSpeechStartedAtMsRef.current = performance.now();
          pauseStt();
          // While discarding a dead turn's audio, don't update thinking/buffer state from stray "speaking" steps.
          if (suppressIncomingAudioRef.current) return;
          setIsEzriThinking(false);
          isEzriThinkingRef.current = false;
        },
        onAvatarData: (data) => {
          // Phonemes + sentiment from backend, emitted before each TTS audio chunk.
          const avatarDataReceived = performance.now();
          const queuedGreetingWithoutData =
            companionCanonicalId === "sarah" &&
            !permissionsGrantedRef.current
              ? prePermissionAudioQueueRef.current.find(
                  (item) => item.saraGreetingSync && !item.avatarData
                )
              : undefined;
          if (queuedGreetingWithoutData?.saraGreetingSync) {
            queuedGreetingWithoutData.avatarData = data;
            queuedGreetingWithoutData.subtitle =
              data.sentence?.trim() || queuedGreetingWithoutData.subtitle;
            queuedGreetingWithoutData.saraGreetingSync = {
              ...queuedGreetingWithoutData.saraGreetingSync,
              sentence:
                data.sentence?.trim() ||
                queuedGreetingWithoutData.saraGreetingSync.sentence,
              avatarDataReceived,
            };
            const timeline = normalizeAvatarPhonemeTimeline(data);
            const firstPhoneme = timeline?.phonemes[0] ?? null;
            updateSaraGreetingDiagnostics({
              greetingSentence:
                data.sentence?.trim() ||
                queuedGreetingWithoutData.saraGreetingSync.sentence,
              avatarDataReceived,
              timelineAttached: !!timeline?.phonemes.length,
              phonemeCount: timeline?.phonemes.length ?? 0,
              firstPhoneme: firstPhoneme
                ? {
                    phoneme: firstPhoneme.phoneme,
                    start: firstPhoneme.start,
                    end: firstPhoneme.end ?? null,
                  }
                : null,
            });
            console.log("[Sara Greeting Sync]", {
              greetingSentence:
                data.sentence?.trim() ||
                queuedGreetingWithoutData.saraGreetingSync.sentence,
              audioReceived: queuedGreetingWithoutData.saraGreetingSync.audioReceived,
              avatarDataReceived,
              phonemeCount: timeline?.phonemes.length ?? 0,
              firstPhonemeStart: firstPhoneme?.start ?? null,
              playbackStart: null,
              firstVisemeApplied: null,
              repairedLateAvatarData: true,
            });
            avatarPendingDataRef.current = null;
            avatarPendingDataReceivedAtRef.current = null;
          } else {
            avatarPendingDataRef.current = data;
            avatarPendingDataReceivedAtRef.current = avatarDataReceived;
          }
          latestJordanTextRef.current = data.sentence ?? latestJordanTextRef.current;
          sentimentCompoundRef.current = extractJordanSentimentCompound(data.sentiment);
          if (process.env.NODE_ENV === "development") {
            console.debug("[Ezri] avatar_data:", data.sentence, data.sentiment, data.phonemes);
          }
        },
        onInterrupt: () => {
          // Server Silero VAD fired handle_interrupt (reference app.js case 'interrupt').
          suppressIncomingAudioRef.current = false;

          const wasPlayingOrStreaming =
            wsIsPlaybackActiveRef.current ||
            wsAudioQueueRef.current.length > 0 ||
            wsTtsStreamingRef.current;

          setLiveUserSpeech("");
          setIsEzriThinking(false);
          isEzriThinkingRef.current = false;
          pendingUserTextRef.current = "";

          if (!wasPlayingOrStreaming) {
            resumeStt(0, { ignoreSpeakingGate: true });
            return;
          }

          stopPlaybackAndCooldown({
            sendPlaybackDone: true,
            cooldownMs: 1500,
            bypassPlaybackDoneDebounce: true,
          });
          resumeStt(0, { ignoreSpeakingGate: true });
        },
        onWarmupStart: () => {
          ezriWarmupReadyRef.current = false;
          wsTtsDoneReceivedRef.current = false;
          setEzriWarmupStatus("warming");
        },
        onWarmupDone: () => {
          ezriWarmupReadyRef.current = true;
          setEzriWarmupStatus("ready");
          // Do not send playback_done here (app.js waits until greeting audio finishes playing).
        },
        onPipelineStep: (status) => {
          if (status === "thinking") {
            setIsEzriThinking(true);
            isEzriThinkingRef.current = true;
          }
        },
        onAudio: (audio) => {
          // Drop audio from the old turn â€” any chunk arriving while suppressed
          // is a server-buffered leftover that arrived before our interrupt
          // was processed. We only lift suppression when the new user message
          // is actually sent (see handleUserText).
          if (suppressIncomingAudioRef.current) return;
          // Drop audio belonging to old in-flight responses.
          if (dropOldResponsesRef.current > 0) return;
          const audioReceived = performance.now();

          const enqueueAudioWithPendingAvatarData = () => {
            if (suppressIncomingAudioRef.current) return;
            if (dropOldResponsesRef.current > 0) return;

            const buffered = wsAssistantBufferRef.current.trim();
            const sentence =
              avatarPendingDataRef.current?.sentence?.trim() ?? "";
            const subtitle =
              sentence ||
              buffered ||
              wsLastFinalTextRef.current.trim() ||
              wsPendingFallbackTextRef.current.trim() ||
              "…";
            const isSaraGreetingAudio =
              companionCanonicalId === "sarah" && !permissionsGrantedRef.current;
            const saraGreetingSync = isSaraGreetingAudio
              ? {
                  id: ++saraGreetingSyncSeqRef.current,
                  sentence: sentence || subtitle,
                  audioReceived,
                  avatarDataReceived: avatarPendingDataReceivedAtRef.current,
                }
              : undefined;
            const chunk: WsAudioQueueItem = {
              subtitle,
              audio,
              avatarData: avatarPendingDataRef.current,
              audioReceived,
              avatarDataReceived: avatarPendingDataReceivedAtRef.current,
              saraGreetingSync,
            };
            avatarPendingDataRef.current = null;
            avatarPendingDataReceivedAtRef.current = null;

            if (saraGreetingSync) {
              const timeline = normalizeAvatarPhonemeTimeline(chunk.avatarData);
              const firstPhoneme = timeline?.phonemes[0] ?? null;
              updateSaraGreetingDiagnostics({
                greetingSentence: timeline?.sentence || saraGreetingSync.sentence,
                audioReceived,
                avatarDataReceived: saraGreetingSync.avatarDataReceived,
                timelineAttached: !!timeline?.phonemes.length,
                phonemeCount: timeline?.phonemes.length ?? 0,
                firstPhoneme: firstPhoneme
                  ? {
                      phoneme: firstPhoneme.phoneme,
                      start: firstPhoneme.start,
                      end: firstPhoneme.end ?? null,
                    }
                  : null,
                firstViseme: null,
                playbackStart: null,
                firstVisemeTime: null,
                deltaMs: null,
              });
              console.log("[Sara Greeting Sync]", {
                greetingSentence: timeline?.sentence || saraGreetingSync.sentence,
                audioReceived,
                avatarDataReceived: saraGreetingSync.avatarDataReceived,
                phonemeCount: timeline?.phonemes.length ?? 0,
                firstPhonemeStart: firstPhoneme?.start ?? null,
                playbackStart: null,
                firstVisemeApplied: null,
                queuedPrePermission: true,
              });
            }

            if (!chunk.avatarData && !permissionsGrantedRef.current) {
              console.warn(
                "[Ezri] greeting audio queued without avatar_data after 300ms pairing wait; will attach late avatar_data before playback if it arrives."
              );
            }

            if (!permissionsGrantedRef.current) {
              prePermissionAudioQueueRef.current.push(chunk);
              return;
            }

            clearSpeakFallbackTimer();
            wsAudioQueueRef.current.push(chunk);
            flushWsAudioQueueRef.current();
            setIsEzriThinking(false);
            isEzriThinkingRef.current = false;
            pendingUserTextRef.current = "";
          };

          if (!permissionsGrantedRef.current && !avatarPendingDataRef.current) {
            window.setTimeout(enqueueAudioWithPendingAvatarData, 300);
            return;
          }

          enqueueAudioWithPendingAvatarData();
        },
        onError: (err, ctx) => {
          console.error("Solace WS error:", err, ctx);
          const msg =
            typeof err === "string"
              ? err
              : (err as Error)?.message || "Solace connection error";
          toast.error(msg);
          setIsEzriThinking(false);
          isEzriThinkingRef.current = false;
          pendingUserTextRef.current = "";
        },
        onUnknownMessage: (raw) => {
          if (
            raw &&
            typeof raw === "object" &&
            (raw as { type?: string }).type === "debug" &&
            typeof (raw as { rms?: number }).rms === "number"
          ) {
            const dbg = raw as { rms: number; is_speech?: boolean };
            const rms = dbg.rms;
            if (process.env.NODE_ENV === "development" && rms > 0) {
              console.debug(
                "[PCM] Server heard mic RMS:",
                rms,
                dbg.is_speech === false ? "(VAD: silence)" : "(VAD: speech)",
              );
            }
            // User is clearly talking but server may still think Ezri is speaking (no playback_done).
            if (
              permissionsGrantedRef.current &&
              rms >= 350 &&
              !playbackDoneAckRef.current
            ) {
              tryUnlockServerMicRef.current("user_voice_rms");
            }
          }
        },
      });

    wsClientRef.current = client;

    client.connect({
      wsBase: ezriConfig.wsBase,
      userid: ezriUserid,
      sessionId,
      brainProvider: ezriConfig.defaults.brainProvider,
      ttsProvider: ezriConfig.defaults.ttsProvider,
      sttProvider: ezriConfig.defaults.sttProvider,
      voice: ezriTtsVoiceId,
    });

    return () => {
      if (wsSpeakFallbackTimerRef.current) {
        window.clearTimeout(wsSpeakFallbackTimerRef.current);
        wsSpeakFallbackTimerRef.current = null;
      }
      client.disconnect();
    };
  }, [
    ezriConfig,
    ezriUserid,
    sessionId,
    hasSessionEnded,
    companionAvatarLabel,
    companionCanonicalId,
    ezriTtsVoiceId,
    updateSaraGreetingDiagnostics,
  ]);

  // â”€â”€ WebSocket keep-alive ping (prevents HF Space nginx 60-second idle timeout) â”€â”€
  // Sends a lightweight {"type":"ping"} every 30 s. The backend responds with "pong"
  // which the realtimeClient silently discards. Without this, periods of user silence
  // longer than 60 s (common in a therapy session) cause a silent disconnect.
  useEffect(() => {
    if (ezriWsStatus !== "connected") return;
    if (hasSessionEnded || isSessionPaused) return;

    const interval = window.setInterval(() => {
      try {
        wsClientRef.current?.sendPing();
      } catch { }
    }, 30_000);

    return () => window.clearInterval(interval);
  }, [ezriWsStatus, hasSessionEnded, isSessionPaused]);

  // â”€â”€ PCM audio streaming â†’ WebSocket (backend VAD + Whisper STT) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Only active when stt_provider is NOT "browser". When stt_provider=browser
  // the backend ignores all binary PCM frames, so streaming is wasteful and
  // creates an unnecessary AudioContext (which can fail or suspend on iOS).
  useEffect(() => {
    if (!permissionsGranted || !stream || ezriWsStatus !== "connected") return;
    if (hasSessionEnded || isSessionPaused) return;
    if (!serverPcmSttActive) return;

    let cancelled = false;
    let audioCtx: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let processor: ScriptProcessorNode | null = null;
    let onVisibility: (() => void) | undefined;

    const startPcmStreaming = async () => {
      try {
        audioCtx = pcmCaptureAudioContextRef.current;
        if (!audioCtx || audioCtx.state === "closed") {
          audioCtx = await createPcmCaptureAudioContext();
          pcmCaptureAudioContextRef.current = audioCtx;
        } else if (audioCtx.state === "suspended") {
          await audioCtx.resume();
        }
        if (cancelled) {
          return;
        }

        const captureRate = audioCtx.sampleRate;
        if (captureRate !== EZRI_PCM_SAMPLE_RATE) {
          console.warn(
            `[PCM] Capture rate ${captureRate}Hz — downsampling to ${EZRI_PCM_SAMPLE_RATE}Hz for server STT`,
          );
        }

        source = audioCtx.createMediaStreamSource(stream);
        processor = audioCtx.createScriptProcessor(EZRI_PCM_BUFFER_SIZE, 1, 1);
        const silentSink = audioCtx.createGain();
        silentSink.gain.value = 0;

        processor.onaudioprocess = (e: AudioProcessingEvent) => {
          if (audioCtx?.state === "suspended") {
            void audioCtx.resume().catch(() => {
              /* non-fatal */
            });
          }
          // Only hard-gate on mute/pause/ending — server ignores audio during warmup.
          if (
            isMutedRef.current ||
            isSessionPausedRef.current ||
            isSessionEndingRef.current
          )
            return;
          const ws = wsClientRef.current;
          if (!ws || ws.getStatus() !== "connected") return;

          const channel = e.inputBuffer.getChannelData(0);
          const floats =
            captureRate !== EZRI_PCM_SAMPLE_RATE
              ? downsampleFloat32To16k(channel, captureRate)
              : channel;
          const pcm = float32ToInt16Pcm(floats);
          if (pcm.length > 0) {
            ws.sendPcm(int16PcmToArrayBuffer(pcm));
            pcmChunksSentRef.current += 1;
            if (pcmChunksSentRef.current === 1) {
              console.log("[PCM] First mic chunk sent to server");
            }
          }
        };

        source.connect(processor);
        processor.connect(silentSink);
        silentSink.connect(audioCtx.destination);
        setIsListening(true);
        pcmChunksSentRef.current = 0;
        console.log(
          "[PCM] Streaming started at",
          captureRate,
          "Hz (server expects",
          EZRI_PCM_SAMPLE_RATE,
          "Hz), buffer",
          EZRI_PCM_BUFFER_SIZE,
          "state:",
          audioCtx.state,
        );

        onVisibility = () => {
          if (document.visibilityState === "visible" && audioCtx?.state === "suspended") {
            void audioCtx.resume().catch(() => {
              /* non-fatal */
            });
          }
        };
        document.addEventListener("visibilitychange", onVisibility);
      } catch (e) {
        console.error("[PCM] Failed to start audio streaming:", e);
        toast.error(
          "Could not start microphone streaming in this browser. Try Chrome or allow microphone access.",
        );
      }
    };

    void startPcmStreaming();

    return () => {
      cancelled = true;
      if (onVisibility) {
        document.removeEventListener("visibilitychange", onVisibility);
      }
      try {
        processor?.disconnect();
        source?.disconnect();
        audioCtx?.close();
      } catch { }
      setIsListening(false);
      console.log("[PCM] Streaming stopped");
    };
  }, [
    permissionsGranted,
    stream,
    ezriWsStatus,
    hasSessionEnded,
    isSessionPaused,
    serverPcmSttActive,
  ]);

  // Safety: if greeting playback_done never fires (Firefox), unlock server mic within a few seconds.
  useEffect(() => {
    if (!permissionsGranted || ezriWsStatus !== "connected" || !serverPcmSttActive) return;
    if (hasSessionEnded || isSessionPaused) return;

    const t = window.setTimeout(() => {
      if (!playbackDoneAckRef.current) {
        tryUnlockServerMicRef.current("safety_timer");
      }
    }, 6000);

    return () => window.clearTimeout(t);
  }, [
    permissionsGranted,
    ezriWsStatus,
    hasSessionEnded,
    isSessionPaused,
    serverPcmSttActive,
  ]);

  const currentAvatar = {
    name: config?.avatar || "Maya Chen",
    status: "listening",
  };

  const safetyResources = getSafetyResources();

  useEffect(() => {
    if (currentState !== lastSafetyState) {
      if (currentState !== "NORMAL") setShowSafetyBoundary(true);
      if (currentState === "HIGH_RISK" || currentState === "SAFETY_MODE")
        setShowSafetyResources(true);
      setLastSafetyState(currentState);
    }
  }, [currentState, lastSafetyState]);

  // Safety analysis should be driven by real conversation content (see `handleUserText`),
  // not synthetic mock phrases.

  useEffect(() => {
    if (isSessionPaused || hasSessionEnded) return;
    if (!permissionsGranted) return;

    const timer = setInterval(() => {
      // Keep accurate time in a ref (no React render).
      sessionTimeRef.current += 1;
      const next = sessionTimeRef.current;
      // Keep UI timer in sync (show every second).
      setSessionTime(next);
    }, 1000);

    return () => clearInterval(timer);
  }, [isSessionPaused, hasSessionEnded, permissionsGranted]);

  // Heartbeat: deduct credits during the live session (server-side).
  useEffect(() => {
    if (!apiSessionId) return;
    if (isSessionPaused || hasSessionEnded) return;
    if (!permissionsGranted) return;
    if (!sessionBillingStartedRef.current) return;

    let cancelled = false;
    let lastSent = 0;

    const tick = async () => {
      if (cancelled) return;
      const elapsed = sessionTimeRef.current;
      // Avoid sending too early (need at least a few seconds of session time)
      if (elapsed <= 0) return;
      // Only send if at least 15s have passed since last send
      if (elapsed - lastSent < 15) return;

      try {
        await api.sessions.heartbeat(apiSessionId, elapsed);
        lastSent = elapsed;
      } catch (e) {
        // Best-effort; don't interrupt session on transient failures
      }
    };

    const interval = window.setInterval(() => {
      void tick();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [apiSessionId, isSessionPaused, hasSessionEnded, permissionsGranted]);

  const remainingSeconds =
    initialCreditsSeconds !== null
      ? Math.max(0, initialCreditsSeconds - sessionTime)
      : null;
  const remainingWholeMinutes =
    remainingSeconds !== null ? Math.floor(remainingSeconds / 60) : null;

  // Account credits are only deducted on session end (server-side).
  // For in-session UX, we use a projected remaining value based on time spent so far.
  const projectedAccountRemainingSeconds =
    accountCreditsSeconds !== null
      ? Math.max(0, accountCreditsSeconds - sessionTime)
      : null;
  const projectedAccountRemainingWholeMinutes =
    projectedAccountRemainingSeconds !== null
      ? Math.floor(projectedAccountRemainingSeconds / 60)
      : null;

  useEffect(() => {
    // Show when the user is projected to drop below 10 minutes.
    if (projectedAccountRemainingWholeMinutes === null) return;
    if (
      projectedAccountRemainingWholeMinutes > 0 &&
      projectedAccountRemainingWholeMinutes < 10
    ) {
      if (!showLowCreditsWarning && !lowCreditsWarningDismissed) setShowLowCreditsWarning(true);
    } else {
      // Credits recovered above threshold â€” reset so the banner can show again next dip.
      if (showLowCreditsWarning) setShowLowCreditsWarning(false);
      if (lowCreditsWarningDismissed) setLowCreditsWarningDismissed(false);
    }
    if (remainingWholeMinutes === null) return;
    if (remainingWholeMinutes === 0 && !showOutOfCredits)
      setShowOutOfCredits(true);
    if (
      remainingWholeMinutes > 0 &&
      remainingWholeMinutes <= 3 &&
      !hasShownLowMinutesModal
    ) {
      setShowLowMinutesModal(true);
      setHasShownLowMinutesModal(true);
    }
  }, [
    remainingWholeMinutes,
    projectedAccountRemainingWholeMinutes,
    showLowCreditsWarning,
    lowCreditsWarningDismissed,
    showOutOfCredits,
    hasShownLowMinutesModal,
  ]);

  useEffect(() => {
    const previous = previousConnectionQuality.current;
    if (previous === connectionQuality) return;

    if (
      (previous === "excellent" || previous === "good") &&
      connectionQuality === "poor"
    ) {
      toast.info("Your connection seems unstable. Video quality may be affected.");
    }

    if (
      previous === "poor" &&
      (connectionQuality === "good" || connectionQuality === "excellent")
    ) {
      toast.success("Connection improved. You are back to a stable connection.");
    }

    previousConnectionQuality.current = connectionQuality;
  }, [connectionQuality]);

  const SESSION_API_BASE =
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV
      ? "http://localhost:3001/api"
      : "https://meetezri-live-api.vercel.app/api");

  const teardownLocalResources = () => {
    if (sessionFullyCleanedRef.current) return;
    sessionFullyCleanedRef.current = true;
    setHasSessionEnded(true);
    isSessionEndingRef.current = true;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
      isRecognitionActiveRef.current = false;
      setIsListening(false);
    }

    stopAudioAndSpeechDriver();

    try {
      wsClientRef.current?.disconnect();
    } catch {
      /* ignore */
    }

    try {
      window.localStorage.removeItem("ezri_active_session_id");
    } catch {
      /* ignore */
    }
  };

  const notifyServerSessionEndedKeepalive = () => {
    const id = apiSessionIdRef.current;
    const token = authTokenRef.current;
    if (!id || !token || remoteEndAttemptedRef.current) return;
    remoteEndAttemptedRef.current = true;
    const transcriptToSend = Array.isArray(transcriptRef.current)
      ? transcriptRef.current.slice(-120)
      : undefined;
    const payload = {
      duration_seconds: sessionTimeRef.current,
      recording_url: undefined as string | undefined,
      transcript: transcriptToSend,
    };
    try {
      void fetch(`${SESSION_API_BASE}/sessions/${id}/end`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    } catch {
      /* ignore */
    }
  };

  /** Refresh / close tab / bfcache-hidden page â€” browser gives us one keepalive request window. */
  const abruptSessionEnd = (reason: string) => {
    if (sessionFullyCleanedRef.current && remoteEndAttemptedRef.current) return;
    console.log("[ActiveSession] Abrupt session end:", reason);
    teardownLocalResources();
    notifyServerSessionEndedKeepalive();
  };

  useEffect(() => {
    const pending = pendingUnmountTeardownRef.current;
    if (pending !== null) {
      window.clearTimeout(pending);
      pendingUnmountTeardownRef.current = null;
    }
    return () => {
      pendingUnmountTeardownRef.current = window.setTimeout(() => {
        pendingUnmountTeardownRef.current = null;
        abruptSessionEnd("leave_route");
      }, 0);
    };
  }, []);

  useEffect(() => {
    const onPageHide = (ev: PageTransitionEvent) => {
      if (ev.persisted) return;
      abruptSessionEnd("pagehide");
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  const endSessionAndCleanup = async () => {
    teardownLocalResources();

    if (!apiSessionId) {
      toast.error("Missing session id. Please restart the session from the lobby.");
      return;
    }
    if (remoteEndAttemptedRef.current) {
      return;
    }
    remoteEndAttemptedRef.current = true;

    setIsUploading(true);
    const durationSeconds = sessionTimeRef.current;

    try {
      const transcriptToSend = Array.isArray(transcript) ? transcript.slice(-120) : undefined;
      await api.sessions.end(apiSessionId, durationSeconds, undefined, transcriptToSend as any);
      try {
        await refreshProfile();
      } catch (e) {
        console.error("Failed to refresh profile after session end:", e);
      }
      toast.success("Talking ended successfully");
    } catch (error) {
      console.error("Failed to End Talking:", error);
      toast.error("Failed to save session data");
    } finally {
      setIsUploading(false);
    }
  };

  const handleEndSession = async () => {
    // Show full-screen ending state immediately so the confirm dialog is not
    // replaced by the live session UI while we wait for the API + navigation.
    setIsEndingSession(true);
    setShowEndConfirm(false);

    try {
      await endSessionAndCleanup();

      const durationSeconds = sessionTimeRef.current;

      const needsCooldown =
        currentState === "HIGH_RISK" || currentState === "SAFETY_MODE";

      if (needsCooldown) {
        navigate("/app/settings/cooldown-screen", {
          state: {
            sessionId,
            safetyLevel: currentState,
            sessionDuration: durationSeconds,
          },
        });
      } else {
        navigate("/app/session-lobby", {
          state: {
            sessionId,
            sessionDuration: durationSeconds,
            showCarveoutPrompt: true,
          },
        });
      }
    } catch (e) {
      console.error("End Talking navigation failed:", e);
      setIsEndingSession(false);
    }
  };

  const connectionQualityColor = getConnectionQualityColor(connectionQuality);

  const hasBrowserSpeechRecognition = Boolean(
    (window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
      .SpeechRecognition ||
    (window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
      .webkitSpeechRecognition,
  );

  const toggleFullscreen = useCallback(async () => {
    if (!sessionContainerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await sessionContainerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (e) {
      console.warn("Fullscreen failed:", e);
      toast.error("Fullscreen is not supported or was denied.");
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const handleResetSession = () => {
    setIsEzriSpeaking(false);
    isEzriSpeakingRef.current = false;
    stopAudioAndSpeechDriver();
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    setTimeout(() => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) { }
      }
      setPermissionsGranted(false);
      window.location.reload();
    }, 100);
    toast.info("Resetting Talking...");
  };

  /** Edge-to-edge stage inside the app main pane (reference layout â€” no inset â€œcardâ€). */
  const stageShellPadding = isFullscreen ? "p-0" : "p-0";
  const stageRoundClass = isFullscreen ? "rounded-none" : "rounded-none";
  const stageSidePanelInsetL =
    "top-4 sm:top-5 md:top-6 start-3 sm:start-4 md:start-5";
  /** Right rail: controls + widgets in one column (avoids header overlapping connection card). */
  const stageSidePanelInsetR =
    "top-3 sm:top-4 md:top-5 end-3 sm:end-4 md:end-5";
  /** Left rail: greeting + transcript. */
  const stageRailWidthLeftClass =
    "w-full max-w-[min(24rem,calc(100%-1.5rem))] sm:max-w-[min(24rem,calc(100%-2rem))] md:w-[24rem] md:max-w-none shrink-0";
  const stageRailWidthRightClass =
    "w-[min(18rem,calc(100%-1.25rem))] sm:w-[min(18rem,calc(100%-1.5rem))] md:w-72 shrink-0";
  const stageBottomBar = "bottom-4 sm:bottom-5 md:bottom-6";

  /** Fills immersive AppLayout main (full width, no sidebar inset). */
  const sessionViewportClass =
    "relative h-full min-h-0 w-full flex-1 overflow-hidden text-white transition-[background-color] duration-500";

  const handleToggleSessionStats = useCallback(() => {
    setSessionStatsOpen((o) => !o);
  }, []);

  const handleToggleSessionPaused = useCallback(() => {
    setIsSessionPaused((p) => !p);
  }, []);

  const handleToggleMuted = useCallback(() => {
    setIsMuted((m) => {
      const next = !m;
      if (next) {
        toast.info("Microphone muted — tap the mic button again to speak.");
      }
      return next;
    });
  }, []);

  const handleToggleSoundOff = useCallback(() => {
    setIsSoundOff((prev) => !prev);
  }, []);

  const handleShowEndConfirm = useCallback(() => {
    setShowEndConfirm(true);
  }, []);

  const handlePermissionCancel = useCallback(() => {
    setShowPermissionRequest(false);
    navigate("/app/dashboard");
  }, [navigate]);

  const handleDismissLowCredits = useCallback(() => {
    setShowLowCreditsWarning(false);
    setLowCreditsWarningDismissed(true);
  }, []);

  const handleViewSafetyResources = useCallback(() => {
    setShowSafetyResources(true);
  }, []);

  const handleDismissSafetyBoundary = useCallback(() => {
    setShowSafetyBoundary(false);
  }, []);

  const handleDismissCrisisModal = useCallback(() => {
    setShowCrisisKeywordModal(false);
  }, []);

  const handleCrisisViewSafetyResources = useCallback(() => {
    setShowCrisisKeywordModal(false);
    setShowSafetyResources(true);
  }, []);

  const handleReturnToDashboard = useCallback(() => {
    navigate("/app/dashboard");
  }, [navigate]);

  const handleCloseEndConfirm = useCallback(() => {
    setShowEndConfirm(false);
  }, []);

  const handleCloseLowMinutesModal = useCallback(() => {
    setShowLowMinutesModal(false);
  }, []);

  const handleBuyMoreMinutes = useCallback(async () => {
    if (isBuyingMoreMinutes) return;
    setIsBuyingMoreMinutes(true);
    try {
      await endSessionAndCleanup();
      navigate("/app/billing");
    } finally {
      setIsBuyingMoreMinutes(false);
    }
  }, [endSessionAndCleanup, isBuyingMoreMinutes, navigate]);

  const handleOutOfCreditsBuyMore = useCallback(async () => {
    await endSessionAndCleanup();
    navigate("/app/billing");
  }, [endSessionAndCleanup, navigate]);

  const handleOutOfCreditsUpgrade = useCallback(async () => {
    await endSessionAndCleanup();
    navigate("/app/billing");
  }, [endSessionAndCleanup, navigate]);

  return (
    <ActiveSessionView
      sessionContainerRef={sessionContainerRef}
      sessionViewportClass={sessionViewportClass}
      sessionBackdropLayers={sessionBackdropLayers}
      isEndingSession={isEndingSession}
      stageShellPadding={stageShellPadding}
      stageRoundClass={stageRoundClass}
      stageSidePanelInsetL={stageSidePanelInsetL}
      stageSidePanelInsetR={stageSidePanelInsetR}
      stageRailWidthLeftClass={stageRailWidthLeftClass}
      stageRailWidthRightClass={stageRailWidthRightClass}
      stageBottomBar={stageBottomBar}
      isEzriSpeaking={isEzriSpeaking}
      sessionUsesCompanion3d={sessionUsesCompanion3d}
      companionAvatarLabel={companionAvatarLabel}
      companionCanonicalId={companionCanonicalId}
      companionModelUrl={companionModelUrl}
      companionViewTuning={companionViewTuning}
      companionFixedViewportConfig={companionFixedViewportConfig}
      sessionUsesRfv2Morphs={sessionUsesRfv2Morphs}
      showSaraLiveRfv2ModeSwitch={showSaraLiveRfv2ModeSwitch}
      saraLiveAvatarMode={saraLiveAvatarMode}
      saraLiveRfv2PreviewEnabled={saraLiveRfv2PreviewEnabled}
      onSaraLiveAvatarModeChange={handleSaraLiveAvatarModeChange}
      onSaraLiveRfv2Fallback={handleSaraLiveRfv2Fallback}
      isListening={isListening}
      isEzriThinking={isEzriThinking}
      mouthAudioLevelRef={mouthAudioLevelRef}
      avatarPhonemeTimelineRef={avatarPhonemeTimelineRef}
      avatarAudioCurrentTimeRef={avatarAudioCurrentTimeRef}
      speechTextRef={speechTextRef}
      speechCharIndexRef={speechCharIndexRef}
      speechPulseRef={speechPulseRef}
      latestUserTextRef={latestUserTextRef}
      latestJordanTextRef={latestJordanTextRef}
      userSpeechStartedAtMsRef={userSpeechStartedAtMsRef}
      userLastSpeechAtMsRef={userLastSpeechAtMsRef}
      jordanSpeechStartedAtMsRef={jordanSpeechStartedAtMsRef}
      jordanLastSpeechAtMsRef={jordanLastSpeechAtMsRef}
      sentimentCompoundRef={sentimentCompoundRef}
      companionPortraitUrl={companionPortraitUrl}
      leftSessionChromeRef={leftSessionChromeRef}
      sessionGreeting={sessionGreeting}
      viewerFirstName={viewerFirstName}
      transcriptListRef={transcriptListRef}
      transcript={transcript}
      liveUserSpeech={liveUserSpeechStore}
      isMuted={isMuted}
      companionName={currentAvatar.name}
      sttProvider={ezriConfig?.defaults.sttProvider}
      ezriWsStatus={ezriWsStatus}
      ezriWarmupStatus={ezriWarmupStatus}
      permissionsGranted={permissionsGranted}
      sessionStatsOpen={sessionStatsOpen}
      onToggleSessionStats={handleToggleSessionStats}
      isFullscreen={isFullscreen}
      onToggleFullscreen={toggleFullscreen}
      profileAvatarUrl={profile?.avatar_url}
      sessionTime={sessionTime}
      remainingSeconds={remainingSeconds}
      remainingWholeMinutes={remainingWholeMinutes}
      connectionQuality={connectionQuality}
      connectionQualityColor={connectionQualityColor}
      sortedMoodPreview={sortedMoodPreview}
      latestMoodEmoji={latestMoodEmoji}
      roomMoodPickerOpen={roomMoodPickerOpen}
      onRoomMoodPickerOpenChange={setRoomMoodPickerOpen}
      isSessionPaused={isSessionPaused}
      onToggleSessionPaused={handleToggleSessionPaused}
      selectedRoomMoodLabel={selectedRoomMoodOption.label}
      sessionBackdropPreference={sessionBackdropPreference}
      onSelectSessionBackdrop={setSessionBackdropPreference}
      onToggleMuted={handleToggleMuted}
      isCameraOff={isCameraOff}
      onCameraToggle={handleCameraToggle}
      isSoundOff={isSoundOff}
      onToggleSoundOff={handleToggleSoundOff}
      onShowEndConfirm={handleShowEndConfirm}
      pipOpen={Boolean(stream)}
      pipPos={pipPos}
      videoRef={videoRef}
      onPipPointerDown={handlePipPointerDown}
      onPipPointerMove={handlePipPointerMove}
      onPipPointerUp={handlePipPointerUp}
      showPermissionRequest={showPermissionRequest}
      pendingMediaEntry={pendingMediaEntry}
      hasBrowserSpeechRecognition={hasBrowserSpeechRecognition}
      onPermissionCancel={handlePermissionCancel}
      onAllowAccess={requestMediaAccess}
      showLowCreditsWarning={showLowCreditsWarning}
      projectedAccountRemainingWholeMinutes={projectedAccountRemainingWholeMinutes}
      projectedAccountRemainingSeconds={projectedAccountRemainingSeconds}
      isBuyingMoreMinutes={isBuyingMoreMinutes}
      onBuyMoreMinutes={handleBuyMoreMinutes}
      onDismissLowCredits={handleDismissLowCredits}
      showOutOfCredits={showOutOfCredits}
      onOutOfCreditsBuyMore={handleOutOfCreditsBuyMore}
      onOutOfCreditsUpgrade={handleOutOfCreditsUpgrade}
      showLowMinutesModal={showLowMinutesModal}
      onCloseLowMinutesModal={handleCloseLowMinutesModal}
      showEndConfirm={showEndConfirm}
      isUploading={isUploading}
      onCloseEndConfirm={handleCloseEndConfirm}
      onEndSession={handleEndSession}
      showSafetyBoundary={showSafetyBoundary}
      onViewSafetyResources={handleViewSafetyResources}
      onDismissSafetyBoundary={handleDismissSafetyBoundary}
      showCrisisKeywordModal={showCrisisKeywordModal}
      detectedCrisisKeywords={detectedCrisisKeywords}
      crisisDialTarget={crisisDialTarget}
      onCallEmergency={openEmergencyDialer}
      onCrisisViewSafetyResources={handleCrisisViewSafetyResources}
      onDismissCrisisModal={handleDismissCrisisModal}
      showSafetyResources={showSafetyResources}
      safetyResources={safetyResources}
      sessionId={sessionId}
      safetyState={currentState}
      onReturnToDashboard={handleReturnToDashboard}
    />
  );
}
