import {
  Mic,
  MicOff,
  PhoneOff,
  Video,
  VideoOff,
  Sparkles,
  Circle,
  AlertCircle,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  Camera,
  Check,
  X,
  Clock,
  Zap,
  Crown,
  ArrowRight,
  Heart,
  Pause,
  Play,
  Loader2
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/app/components/ui/button";
import { useSafety } from "@/app/contexts/SafetyContext";
import { useAuth } from "@/app/contexts/AuthContext";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { analyzeTextForSafety } from "@/app/utils/safetyDetection";
import { SafetyStateIndicator } from "@/app/components/safety/SafetyStateIndicator";
import { SafetyBoundaryMessage } from "@/app/components/safety/SafetyBoundaryMessage";
import { SafetyResourceCard } from "@/app/components/safety/SafetyResourceCard";
import { getSafetyResources } from "@/app/utils/safetyResources";
import { LowMinutesWarning } from "@/app/components/modals/LowMinutesWarning";

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const AVATAR_MODEL_PATH = "/C1v5.glb";

// ─────────────────────────────────────────────────────────────────────────────
// Keyword lists — covers Ready Player Me, Blender ARKit, Mixamo, CC3/CC4,
// MetaHuman, and most custom Blender rigs.
// ─────────────────────────────────────────────────────────────────────────────


// function isBlink(name: string): boolean {
//   const lower = name.toLowerCase();
//   return BLINK_KEYWORDS.some((k) => lower.includes(k));
// }

// function isMouth(name: string): boolean {
//   const lower = name.toLowerCase();
//   return MOUTH_KEYWORDS.some((k) => lower === k || lower.includes(k));
// }



// Exact names for your current file
// IMPORTANT: do not force-map "eyes" as a blink target on this GLB,
// it is not a safe eyelid morph and animating it can hide the head/face.
const EXACT_EYE_NAMES: string[] = [];
const EXACT_MOUTH_NAMES = ["mouth"];

// Generic fallbacks for other rigs
const BLINK_KEYWORDS = [
  "blink",
  "eyeblink",
  "eye_blink",
  "eyelid",
  "eye_lid",
  "upperlid",
  "lowerlid",
  "lid",
  "eyeclose",
  "eye_close",
  "eyesclosed",
  "eyes_closed",
  "wink",
  "closeeye",
  "close_eye",
  "eyeblinkleft",
  "eyeblinkright",
  "eyesquintleft",
  "eyesquintright",
  "eyes", // important for your GLB
];

const MOUTH_KEYWORDS = [
  "mouth",
  "jaw",
  "viseme",
  "mouthopen",
  "mouth_open",
  "jawopen",
  "jaw_open",
  "open",
  "aa",
  "ah",
  "oh",
  "ee",
  "ih",
  "uh",
];

function isBlinkName(name: string): boolean {
  const lower = name.toLowerCase().trim();
  if (EXACT_EYE_NAMES.includes(lower)) return true;
  return BLINK_KEYWORDS.some((k) => lower === k || lower.includes(k));
}

function isMouthName(name: string): boolean {
  const lower = name.toLowerCase().trim();
  if (EXACT_MOUTH_NAMES.includes(lower)) return true;
  return MOUTH_KEYWORDS.some((k) => lower === k || lower.includes(k));
}

function getSpeechOpennessAt(text: string, idx: number): number {
  if (!text || idx < 0 || idx >= text.length) return 0.1;
  const window = text.slice(Math.max(0, idx - 1), Math.min(text.length, idx + 4)).toLowerCase();
  let score = 0;

  for (const ch of window) {
    if ("aeiou".includes(ch)) score += 1.0;
    else if ("yw".includes(ch)) score += 0.55;
    else if ("fvszxj".includes(ch)) score += 0.45;
    else if ("rlntdkg".includes(ch)) score += 0.35;
    else if ("bmp".includes(ch)) score -= 0.5; // bilabials tend to close lips
    else if (ch === " " || ch === "," || ch === "." || ch === "!" || ch === "?") score -= 0.35;
  }

  const normalized = (score + 1.5) / 4.5;
  return THREE.MathUtils.clamp(normalized, 0.02, 1);
}

type MorphBinding = {
  mesh: THREE.Mesh;
  index: number;
  name: string;
  initialInfluence: number;
};

function ThreeAvatar({
  isSpeaking,
  audioLevel,
  speechPulse,
  speechText,
  speechCharIndex,
}: {
  isSpeaking: boolean;
  audioLevel: number;
  speechPulse: number;
  speechText: string;
  speechCharIndex: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Different morphs respond very differently. On many rigs a generic "mouth"
  // morph balloons the lower lip if overdriven; "jaw/open" is usually safer to boost.
  // Favor jaw/mouth-open targets for visible teeth opening.
  // Keep generic lip-shape targets conservative to avoid deformation.
  const JAW_GAIN = 142;
  const JAW_MAX = 176;
  const MOUTH_GAIN = 5;
  const MOUTH_MAX = 10;
  const OTHER_MOUTH_GAIN = 22;
  const OTHER_MOUTH_MAX = 34;

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const frameRef = useRef<number | null>(null);

  const baseScaleRef = useRef(1);

  const mouthBindingsRef = useRef<MorphBinding[]>([]);
  const blinkBindingsRef = useRef<MorphBinding[]>([]);
  const jawBoneRef = useRef<THREE.Bone | null>(null);
  const eyelidBonesRef = useRef<THREE.Bone[]>([]);
  const eyelidDefaultRotXRef = useRef<Map<string, number>>(new Map());

  const mouthTargetRef = useRef(0);
  const mouthBaseRef = useRef(0);
  const mouthPulseRef = useRef(0);
  const mouthSmoothedRef = useRef(0);
  const lastBoundaryAtRef = useRef(0);

  const blinkRafRef = useRef<number | null>(null);
  const blinkTimeoutRef = useRef<number | null>(null);
  const blinkFnRef = useRef<((duration?: number, onDone?: () => void) => void) | null>(
    null
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(35, width / height, 0.01, 1000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(3, 5, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
    fillLight.position.set(-3, 2, 4);
    scene.add(fillLight);

    // Reset refs
    mouthBindingsRef.current = [];
    blinkBindingsRef.current = [];
    jawBoneRef.current = null;
    eyelidBonesRef.current = [];
    mouthTargetRef.current = 0;
    mouthSmoothedRef.current = 0;

    const loader = new GLTFLoader();

    loader.load(
      AVATAR_MODEL_PATH,
      (gltf) => {
        const model = gltf.scene;
        modelRef.current = model;

        console.group("[Avatar] Morph inventory");

        model.traverse((child: any) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            const dict = child.morphTargetDictionary as
              | Record<string, number>
              | undefined;
            const influences = child.morphTargetInfluences as
              | number[]
              | undefined;

            if (dict && influences && influences.length > 0) {
              const entries = Object.entries(dict) as [string, number][];

              console.log(`Mesh: "${child.name}" →`, entries.map(([n]) => n));

              // Mouth bindings
              const mouthCandidates = entries.filter(([name]) =>
                isMouthName(name)
              );

              mouthCandidates.forEach(([name, index]) => {
                mouthBindingsRef.current.push({
                  mesh: child as THREE.Mesh,
                  index,
                  name,
                  initialInfluence: influences[index] ?? 0,
                });
              });

              // Blink bindings
              const blinkCandidates = entries.filter(([name]) =>
                isBlinkName(name)
              );

              blinkCandidates.forEach(([name, index]) => {
                blinkBindingsRef.current.push({
                  mesh: child as THREE.Mesh,
                  index,
                  name,
                  initialInfluence: influences[index] ?? 0,
                });
              });
            }
          }

          if ((child as any).isBone) {
            const boneName = (child.name || "").toLowerCase();

            if (/jaw|mouth|chin/.test(boneName)) {
              jawBoneRef.current = child as THREE.Bone;
              console.log("[Avatar] Jaw bone:", child.name);
            }

            if (/eyelid|upperlid|lowerlid|lid/.test(boneName)) {
              const bone = child as THREE.Bone;
              eyelidDefaultRotXRef.current.set(bone.uuid, bone.rotation.x);
              eyelidBonesRef.current.push(bone);
              console.log("[Avatar] Eyelid bone:", child.name);
            }
          }
        });

        console.groupEnd();

        console.log(
          "[Avatar] Summary — mouth bindings:",
          mouthBindingsRef.current.map((b) => `${b.mesh.name}:${b.name}`),
          "| blink bindings:",
          blinkBindingsRef.current.map((b) => `${b.mesh.name}:${b.name}`),
          "| eyelid bones:",
          eyelidBonesRef.current.length
        );

        if (
          mouthBindingsRef.current.length === 0 &&
          jawBoneRef.current === null
        ) {
          console.warn("[Avatar] No mouth morphs or jaw bone found.");
        }

        if (
          blinkBindingsRef.current.length === 0 &&
          eyelidBonesRef.current.length === 0
        ) {
          console.warn("[Avatar] No blink morphs or eyelid bones found.");
        }

        // Center and frame model
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();

        box.getSize(size);
        box.getCenter(center);

        model.position.sub(center);

        const maxDim = Math.max(size.x, size.y, size.z);
        const baseScale = 4.5 / maxDim;
        baseScaleRef.current = baseScale;
        model.scale.setScalar(baseScale);

        scene.add(model);

        const scaledBox = new THREE.Box3().setFromObject(model);
        const scaledSize = new THREE.Vector3();
        const scaledCenter = new THREE.Vector3();

        scaledBox.getSize(scaledSize);
        scaledBox.getCenter(scaledCenter);

        const portraitHeight = scaledSize.y * 0.38;
        const fovRad = (camera.fov * Math.PI) / 180;
        const distance = portraitHeight / 2 / Math.tan(fovRad / 2);
        const lookAtY = scaledCenter.y + scaledSize.y * 0.36;

        camera.position.set(scaledCenter.x, lookAtY, distance * 0.9);
        camera.lookAt(
          new THREE.Vector3(scaledCenter.x, lookAtY, scaledCenter.z)
        );
        camera.updateProjectionMatrix();

        startBlinkLoop();
      },
      undefined,
      (error) => {
        console.error("[Avatar] Failed to load GLB:", error);
      }
    );

    const handleResize = () => {
      const c = containerRef.current;
      const r = rendererRef.current;
      const cam = cameraRef.current;
      if (!c || !r || !cam) return;

      const w = c.clientWidth || 800;
      const h = c.clientHeight || 600;

      cam.aspect = w / h;
      cam.updateProjectionMatrix();
      r.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    const renderLoop = () => {
      frameRef.current = requestAnimationFrame(renderLoop);

      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const renderer = rendererRef.current;
      const model = modelRef.current;

      if (!scene || !camera || !renderer) return;

      // Word-boundary mouth envelope: fast open + reliable close.
      mouthPulseRef.current *= 0.9;
      mouthBaseRef.current *= 0.92;
      if (mouthPulseRef.current < 0.001) mouthPulseRef.current = 0;
      if (mouthBaseRef.current < 0.001) mouthBaseRef.current = 0;
      mouthTargetRef.current = mouthBaseRef.current + mouthPulseRef.current;

      // Smooth mouth using a stable lerp factor in [0,1]
      const target = THREE.MathUtils.clamp(mouthTargetRef.current, 0, 1.5);
      const lerpFactor = target > mouthSmoothedRef.current ? 0.25 : 0.35;
      mouthSmoothedRef.current +=
        (target - mouthSmoothedRef.current) * lerpFactor;
      const mouth = THREE.MathUtils.clamp(mouthSmoothedRef.current, 0, 1.5);

      // Apply mouth morphs — conservative ranges to avoid extreme deformation.
      // Also avoid any targets that look like full head/neck controls.
      if (mouthBindingsRef.current.length > 0) {
        mouthBindingsRef.current.forEach(({ mesh, index, name }) => {
          const influences = mesh.morphTargetInfluences;
          if (!influences || index >= influences.length) return;

          const lower = name.toLowerCase();

          if (lower.includes("head") || lower.includes("neck")) {
            return;
          }

          let strength = mouth;
          if (
            lower.includes("jaw") ||
            lower.includes("open") ||
            lower.includes("mouth") ||
            lower.includes("teeth") ||
            lower.includes("tooth")
          ) {
            strength = mouth * 1.0;
          } else if (lower.includes("aa") || lower.includes("ah") || lower.includes("oh")) {
            strength = mouth * 0.9;
          } else if (lower.includes("ee") || lower.includes("ih")) {
            strength = mouth * 0.7;
          } else if (lower.includes("uh")) {
            strength = mouth * 0.8;
          } else {
            strength = mouth * 0.8;
          }

          // Non-linear shaping helps avoid "first boundary ballooning" on some rigs.
          const shaped = Math.pow(THREE.MathUtils.clamp(strength, 0, 1.5), 0.72);

          const isJawLike =
            lower.includes("jaw") ||
            lower.includes("jawopen") ||
            lower.includes("mouthopen") ||
            lower.includes("open");

          const isGenericMouth = lower.trim() === "mouth";
          const isTeethLike = lower.includes("teeth") || lower.includes("tooth");
          const isRiskyLipShape =
            lower.includes("lip") ||
            lower.includes("smile") ||
            lower.includes("frown") ||
            lower.includes("pucker") ||
            lower.includes("stretch") ||
            lower.includes("press") ||
            lower.includes("roll");

          const isOpenTarget = isJawLike || isTeethLike;
          const gain = isOpenTarget
            ? isTeethLike
              ? JAW_GAIN * 1.15
              : JAW_GAIN
            : isGenericMouth
            ? MOUTH_GAIN
            : isRiskyLipShape
            ? OTHER_MOUTH_GAIN * 0.35
            : OTHER_MOUTH_GAIN;
          const max = isOpenTarget
            ? isTeethLike
              ? JAW_MAX * 1.55
              : JAW_MAX
            : isGenericMouth
            ? MOUTH_MAX
            : isRiskyLipShape
            ? OTHER_MOUTH_MAX * 0.45
            : OTHER_MOUTH_MAX;

          influences[index] = THREE.MathUtils.clamp(shaped * gain, 0, max);
        });
      }

      // Disable jaw bone rotation entirely to avoid moving the whole head
      // out of frame for rigs where the "jaw" bone also controls head/neck.
      // Slight scale pulse while speaking
      if (model) {
        const speakingScale = isSpeaking ? 1.01 : 1;
        const audioPulse = isSpeaking
          ? 1 + Math.min(audioLevel / 1200, 0.006)
          : 1;
        model.scale.setScalar(baseScaleRef.current * speakingScale * audioPulse);
      }

      renderer.render(scene, camera);
    };

    renderLoop();

    function clearBlinkState() {
      blinkBindingsRef.current.forEach(
        ({ mesh, index, initialInfluence }) => {
        const influences = mesh.morphTargetInfluences;
        if (!influences || index >= influences.length) return;
        influences[index] = initialInfluence;
      }
      );

      eyelidBonesRef.current.forEach((bone) => {
        const defaultX = eyelidDefaultRotXRef.current.get(bone.uuid) ?? 0;
        bone.rotation.x = defaultX;
      });
    }

    function animateBlink(duration = 180, onDone?: () => void) {
      const start = performance.now();

      const tick = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        // Human-like blink: fast close, short hold, then open.
        const closeT = 0.55;
        const holdT = 0.15;
        const openT = 1 - closeT - holdT;
        const smoothstep = (x: number) => x * x * (3 - 2 * x);

        let blinkValue = 0;
        if (t < closeT) {
          blinkValue = smoothstep(t / closeT);
        } else if (t < closeT + holdT) {
          blinkValue = 1;
        } else {
          const x = (t - closeT - holdT) / openT; // 0..1
          blinkValue = 1 - smoothstep(x);
        }

        blinkBindingsRef.current.forEach(
          ({ mesh, index, name, initialInfluence }) => {
          const influences = mesh.morphTargetInfluences;
          if (!influences || index >= influences.length) return;
          const lower = name.toLowerCase();
          const isRiskyEyes =
            lower.includes("eyes") &&
            !lower.includes("blink") &&
            !lower.includes("lid") &&
            !lower.includes("wink") &&
            !lower.includes("squint");
          const maxBlink = isRiskyEyes ? 0.35 : 0.82;
          influences[index] = initialInfluence + blinkValue * maxBlink;
        }
        );

        eyelidBonesRef.current.forEach((bone) => {
          const defaultX = eyelidDefaultRotXRef.current.get(bone.uuid) ?? 0;
          bone.rotation.x = defaultX + 0.33 * blinkValue;
        });

        if (t < 1) {
          blinkRafRef.current = requestAnimationFrame(tick);
        } else {
          clearBlinkState();
          onDone?.();
        }
      };

      blinkRafRef.current = requestAnimationFrame(tick);
    }

    blinkFnRef.current = animateBlink;

    function scheduleNextBlink() {
      if (!modelRef.current) return;

      const delay = 2500 + Math.random() * 2300;
      blinkTimeoutRef.current = window.setTimeout(() => {
        const hasBlinkTargets =
          blinkBindingsRef.current.length > 0 || eyelidBonesRef.current.length > 0;

        if (!hasBlinkTargets) {
          scheduleNextBlink();
          return;
        }

        const blinkDuration = 140 + Math.random() * 90;
        const doDoubleBlink = Math.random() < 0.08;
        if (doDoubleBlink) {
          animateBlink(blinkDuration, () => {
            window.setTimeout(
              () => animateBlink(120, scheduleNextBlink),
              110
            );
          });
        } else {
          animateBlink(blinkDuration, scheduleNextBlink);
        }
      }, delay);
    }

    function startBlinkLoop() {
      if (blinkTimeoutRef.current) {
        clearTimeout(blinkTimeoutRef.current);
      }
      scheduleNextBlink();
    }

    return () => {
      window.removeEventListener("resize", handleResize);

      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (blinkRafRef.current) cancelAnimationFrame(blinkRafRef.current);
      if (blinkTimeoutRef.current) clearTimeout(blinkTimeoutRef.current);

      clearBlinkState();

      if (modelRef.current && sceneRef.current) {
        sceneRef.current.remove(modelRef.current);

        modelRef.current.traverse((child: any) => {
          if (child.isMesh) {
            child.geometry?.dispose();

            if (Array.isArray(child.material)) {
              child.material.forEach((m: any) => m?.dispose?.());
            } else {
              child.material?.dispose?.();
            }
          }
        });
      }

      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (
          containerRef.current &&
          containerRef.current.contains(rendererRef.current.domElement)
        ) {
          containerRef.current.removeChild(rendererRef.current.domElement);
        }
      }

      blinkFnRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isSpeaking) {
      mouthTargetRef.current = 0;
      mouthBaseRef.current = 0;
      mouthPulseRef.current = 0;
      lastBoundaryAtRef.current = 0;
      return;
    }

    // Boundary-driven talk cycle: opens on syllable, then naturally closes.
    const openness = getSpeechOpennessAt(speechText, speechCharIndex);
    mouthBaseRef.current = Math.max(
      mouthBaseRef.current,
      openness * 0.16 + 0.05
    );
    mouthPulseRef.current = Math.max(
      mouthPulseRef.current,
      openness * 1.32 + 0.38
    );
    lastBoundaryAtRef.current = performance.now();
  }, [speechPulse, isSpeaking]);

  useEffect(() => {
    // Fallback: if no boundary events fire (browser-dependent), still animate lightly.
    if (!isSpeaking) {
      mouthTargetRef.current = 0;
      mouthBaseRef.current = 0;
      mouthPulseRef.current = 0;
      return;
    }

    let rafId: number | null = null;
    const start = performance.now();

    const tick = () => {
      if (!isSpeaking) return;

      const elapsed = (performance.now() - start) / 1000;
      const sinceBoundary = performance.now() - lastBoundaryAtRef.current;

      // If boundary timings are available, avoid synthetic fake speech.
      if (sinceBoundary < 260) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      // Boundary unsupported: tiny fallback so avatar is not frozen.
      const fallback =
        Math.max(0, Math.sin(elapsed * 7.2)) * 0.08 +
        Math.max(0, Math.sin(elapsed * 11.9 + 0.5)) * 0.04 +
        THREE.MathUtils.clamp(audioLevel / 260, 0, 0.04);
      mouthBaseRef.current = Math.max(mouthBaseRef.current, fallback);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isSpeaking, audioLevel, speechText, speechCharIndex]);
  return <div ref={containerRef} className="w-full h-full min-h-[500px]" />;
}

export default ThreeAvatar;
// ─────────────────────────────────────────────────────────────────────────────
// ActiveSession component  (unchanged from original except imports above)
// ─────────────────────────────────────────────────────────────────────────────
export function ActiveSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refreshProfile } = useAuth();
  const { sessionId: stateSessionId, duration, config } = location.state || {};

  const apiSessionId = useMemo(() => {
    if (typeof stateSessionId === "string" && stateSessionId.length > 0) return stateSessionId;
    try {
      const fromQuery = new URLSearchParams(location.search).get("sessionId");
      if (fromQuery) return fromQuery;
    } catch {}
    try {
      const fromStorage = window.localStorage.getItem("ezri_active_session_id");
      if (fromStorage) return fromStorage;
    } catch {}
    return null;
  }, [stateSessionId, location.search]);

  useEffect(() => {
    if (!apiSessionId) return;
    try {
      window.localStorage.setItem("ezri_active_session_id", apiSessionId);
    } catch {}
  }, [apiSessionId]);

  const permissionStorageKey = useMemo(() => {
    if (typeof window === "undefined") return "ezri_media_permissions";
    if (!user?.id) return "ezri_media_permissions";
    return `ezri_media_permissions_${user.id}`;
  }, [user?.id]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isUploading, setIsUploading] = useState(false);

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const sessionContainerRef = useRef<HTMLDivElement>(null);
  const [showPermissionRequest, setShowPermissionRequest] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [permissionStateInitialized, setPermissionStateInitialized] =
    useState(false);
  const [transcript, setTranscript] = useState<
    { role: string; content: string; timestamp: number }[]
  >([]);
  const speechTimeoutRef = useRef<number | null>(null);
  const isMutedRef = useRef(isMuted);
  const isSoundOffRef = useRef(isSoundOff);
  const isSessionPausedRef = useRef(false);
  const scriptStepRef = useRef(0);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isEzriSpeakingRef = useRef(false);
  const speechEndTimeoutRef = useRef<number | null>(null);
  const speechFallbackIntervalRef = useRef<number | null>(null);
  const transcriptRef = useRef<
    { role: string; content: string; timestamp: number }[]
  >([]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const lastSpeechStartRef = useRef(0);
  const isRecognitionActiveRef = useRef(false);
  const isSessionEndingRef = useRef(false);

  const [currentSubtitle, setCurrentSubtitle] = useState<string | null>(null);
  const [speechPulse, setSpeechPulse] = useState(0);
  const [speechText, setSpeechText] = useState("");
  const [speechCharIndex, setSpeechCharIndex] = useState(0);

  // ── Audio Visualizer ────────────────────────────────────────────────────
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
        setAudioLevel(sum / bufferLength);
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

  // ── speakAvatar ─────────────────────────────────────────────────────────
  const speakAvatar = (text: string) => {
    console.log("speakAvatar called with:", text);
    setCurrentSubtitle(text);

    if (typeof window === "undefined") return;
    const synth = (window as any).speechSynthesis as SpeechSynthesis | undefined;
    if (!synth) {
      toast.error("Speech synthesis not supported");
      return;
    }

    try {
      const stopFallbackSpeechDriver = () => {
        if (speechFallbackIntervalRef.current) {
          window.clearInterval(speechFallbackIntervalRef.current);
          speechFallbackIntervalRef.current = null;
        }
      };

      if (synth.speaking || synth.pending) {
        stopFallbackSpeechDriver();
        currentUtteranceRef.current = null;
        synth.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      currentUtteranceRef.current = utterance;
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = isSoundOffRef.current ? 0 : 1;

      const voices = synth.getVoices();
      const preferredVoice =
        voices.find((v) => v.name.includes("Google") && v.lang.startsWith("en")) ||
        voices.find((v) => v.lang.startsWith("en"));
      if (preferredVoice) utterance.voice = preferredVoice;

      const wordCount = text.split(/\s+/).length;
      const estimatedDurationMs = Math.max(
        3000,
        (wordCount / 2.5) * 1000 + 2000
      );
      let sawNativeBoundary = false;

      utterance.onstart = () => {
        console.log("Speech started");
        setIsEzriSpeaking(true);
        isEzriSpeakingRef.current = true;
        setSpeechText(text);
        setSpeechCharIndex(0);

        // If sound is off, pause immediately (so we can resume mid-sentence later)
        if (isSoundOffRef.current) {
          try {
            synth.pause();
          } catch {}
        }

        if (recognitionRef.current && isListening) {
          try {
            recognitionRef.current.stop();
          } catch (e) {}
        }

        if (speechEndTimeoutRef.current)
          window.clearTimeout(speechEndTimeoutRef.current);

        stopFallbackSpeechDriver();
        const startAt = performance.now();
        let lastDrivenIdx = -1;
        let lastPulseAt = 0;

        // Fallback driver for browsers/voices that don't emit onboundary reliably.
        // Use a slightly stretched duration so mouth pacing is not too fast.
        const effectiveDurationMs = estimatedDurationMs * 1.25;
        speechFallbackIntervalRef.current = window.setInterval(() => {
          if (!isEzriSpeakingRef.current) return;
          const now = performance.now();
          const elapsed = now - startAt;
          const progress = THREE.MathUtils.clamp(elapsed / effectiveDurationMs, 0, 1);
          const idx = Math.min(text.length - 1, Math.max(0, Math.floor(progress * text.length)));
          setSpeechCharIndex(idx);

          // If native boundaries are missing, emit pulses from simulated text progress.
          if (!sawNativeBoundary && idx !== lastDrivenIdx) {
            const ch = text[idx]?.toLowerCase?.() ?? "";
            const shouldPulse =
              /[aeiou]/.test(ch) ||
              ch === " " ||
              ch === "," ||
              ch === "." ||
              ch === "!" ||
              ch === "?";

            if (shouldPulse && now - lastPulseAt > 115) {
              setSpeechPulse((v) => v + 1);
              lastPulseAt = now;
            }
          }
          lastDrivenIdx = idx;

          if (progress >= 1) {
            stopFallbackSpeechDriver();
          }
        }, 40);

        speechEndTimeoutRef.current = window.setTimeout(() => {
          console.warn(
            `Speech synthesis timed out after ${estimatedDurationMs}ms, forcing reset`
          );
          if (isEzriSpeakingRef.current) {
            setIsEzriSpeaking(false);
            isEzriSpeakingRef.current = false;
            if (currentUtteranceRef.current === utterance) {
              currentUtteranceRef.current = null;
              setCurrentSubtitle(null);
            }
            stopFallbackSpeechDriver();
            synth.cancel();
            if (recognitionRef.current && !isListening) {
              try {
                recognitionRef.current.start();
              } catch (e) {}
            }
          }
        }, estimatedDurationMs);
      };

      utterance.onboundary = (event: SpeechSynthesisEvent) => {
        // Not all browsers fire this reliably; when it does, it's the best "timing" proxy we have.
        // We treat boundaries as mouth-open pulses; sentence-ending punctuation triggers a blink.
        try {
          sawNativeBoundary = true;
          setSpeechPulse((v) => v + 1);
          const idx = typeof event.charIndex === "number" ? event.charIndex : -1;
          setSpeechCharIndex(idx >= 0 ? idx : 0);
        } catch {}
      };

      utterance.onend = () => {
        if (speechEndTimeoutRef.current)
          window.clearTimeout(speechEndTimeoutRef.current);
        stopFallbackSpeechDriver();
        setIsEzriSpeaking(false);
        isEzriSpeakingRef.current = false;
        setSpeechPulse((v) => v + 1);
        setSpeechCharIndex(0);
        setSpeechText("");

        if (currentUtteranceRef.current === utterance) {
          currentUtteranceRef.current = null;
          setCurrentSubtitle(null);
        }

        if (recognitionRef.current && !isListening) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.error("Failed to restart recognition after speech:", e);
          }
        }
        setIsEzriSpeaking(false);
      };

      utterance.onerror = (e) => {
        console.error("Speech synthesis error:", e);
        if (speechEndTimeoutRef.current)
          window.clearTimeout(speechEndTimeoutRef.current);
        stopFallbackSpeechDriver();
        setIsEzriSpeaking(false);
        isEzriSpeakingRef.current = false;
        setSpeechPulse((v) => v + 1);
        setSpeechCharIndex(0);
        setSpeechText("");

        if (currentUtteranceRef.current === utterance) {
          currentUtteranceRef.current = null;
          setCurrentSubtitle(null);
        }

        if (recognitionRef.current && !isListening) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.error("Failed to restart recognition after error:", e);
          }
        }
        setIsEzriSpeaking(false);
      };

      synth.speak(utterance);
      if (synth.paused) synth.resume();
    } catch (error) {
      console.error("Failed to play avatar audio:", error);
      if (speechFallbackIntervalRef.current) {
        window.clearInterval(speechFallbackIntervalRef.current);
        speechFallbackIntervalRef.current = null;
      }
      setIsEzriSpeaking(false);
      isEzriSpeakingRef.current = false;
      if (recognitionRef.current && !isListening) {
        try {
          recognitionRef.current.start();
        } catch (e) {}
      }
    }
  };

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isSoundOffRef.current = isSoundOff;
  }, [isSoundOff]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const synth = (window as any).speechSynthesis as SpeechSynthesis | undefined;
    if (!synth) return;
    if (isSoundOff) {
      try {
        // Pause instead of cancel so subtitles/transcript don't vanish and
        // we can resume from the same point later.
        synth.pause();
      } catch {}
    }
  }, [isSoundOff]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const synth = (window as any).speechSynthesis as SpeechSynthesis | undefined;
    if (!synth) return;
    if (!isSoundOff) {
      try {
        synth.resume();
      } catch {}
    }
  }, [isSoundOff]);

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
          setPermissionsGranted(true);
          setShowPermissionRequest(false);
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

  // ── Speech recognition ──────────────────────────────────────────────────
  useEffect(() => {
    if (!permissionsGranted) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.log("Speech recognition not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      console.log("Speech recognition started");
      lastSpeechStartRef.current = Date.now();
      setIsListening(true);
      isRecognitionActiveRef.current = true;
      toast.info("Microphone Active");
    };

    recognition.onsoundstart = () =>
      console.log("SpeechRecognition: Sound detected");
    recognition.onsoundend = () =>
      console.log("SpeechRecognition: Sound ended");

    recognition.onresult = (event: any) => {
      if (
        isMutedRef.current ||
        isSessionPausedRef.current ||
        isEzriSpeakingRef.current
      ) {
        if (isEzriSpeakingRef.current)
          console.log("Ignored speech: Ezri is speaking");
        return;
      }

      const current = event.resultIndex;
      const result = event.results[current];
      const transcriptText = result[0].transcript;
      const isFinal = result.isFinal;

      if (transcriptText.trim()) {
        const trimmed = transcriptText.trim();

        if (!isFinal) {
          console.log("Interim:", trimmed);
          toast(`Listening: "${trimmed}"`, { id: "speech-interim" });
          return;
        }

        const lowerTrimmed = trimmed.toLowerCase();
        console.log(
          "Heard (Final):",
          lowerTrimmed,
          "Current Step:",
          scriptStepRef.current
        );
        toast.success(`Heard: "${trimmed}"`, {
          id: "speech-interim",
          duration: 2000,
        });

        setTranscript((prev) => {
          const lastEntry = prev[prev.length - 1];
          if (
            lastEntry &&
            lastEntry.content === trimmed &&
            Date.now() - lastEntry.timestamp < 1000
          ) {
            return prev;
          }
          return [
            ...prev,
            { role: "user", content: trimmed, timestamp: Date.now() },
          ];
        });

        if (speechTimeoutRef.current)
          window.clearTimeout(speechTimeoutRef.current);

        let assistantText = "";
        const currentStep = scriptStepRef.current;
        let nextStep = currentStep;

        if (
          lowerTrimmed === "repeat question" ||
          lowerTrimmed === "what did you say" ||
          lowerTrimmed === "say that again"
        ) {
          const lastAssistant = transcriptRef.current
            .slice()
            .reverse()
            .find((t) => t.role === "assistant");
          assistantText = lastAssistant
            ? lastAssistant.content
            : "I haven't said anything yet.";
          nextStep = currentStep;
        } else if (
          lowerTrimmed.includes("repeat") ||
          lowerTrimmed.startsWith("say ")
        ) {
          assistantText = trimmed;
          nextStep = currentStep;
        } else if (
          lowerTrimmed.includes("hear me") ||
          lowerTrimmed.includes("listening")
        ) {
          assistantText = `Yes, I can hear you. I heard: "${trimmed}".`;
          nextStep = currentStep;
        } else if (
          lowerTrimmed === "test" ||
          lowerTrimmed.includes("testing")
        ) {
          assistantText = "Test received. I am listening and ready.";
          nextStep = currentStep;
        } else if (currentStep === 0) {
          assistantText = "Hey. How's today treating you?";
          nextStep = 1;
        } else if (currentStep === 1) {
          if (
            lowerTrimmed.match(
              /(long|busy|draining|tough|hard|bad|terrible|awful|stress|tired|exhausted|shitty|crap|sad|rough|difficult)/
            )
          ) {
            assistantText = "Long as in busy… or long as in draining?";
            nextStep = 2;
          } else if (
            lowerTrimmed.match(
              /(good|great|fine|okay|ok|well|nice|awesome|amazing|happy|calm|peaceful|alright|not bad)/
            )
          ) {
            assistantText =
              "I'm glad to hear that. Even on good days, it helps to pause. What's been the best part?";
            nextStep = 10;
          } else {
            assistantText = `I hear you saying "${trimmed}". Sometimes days just blur together. Would you say it's been more draining, or just busy?`;
            nextStep = 2;
          }
        } else if (currentStep === 2) {
          if (
            lowerTrimmed.match(
              /(draining|exhausting|tired|both|heavy|mental|emotional|soul|spirit)/
            )
          ) {
            assistantText =
              "That kind of day sticks to you. What took most of your energy?";
            nextStep = 3;
          } else if (
            lowerTrimmed.match(
              /(busy|work|lot|time|rushed|hurried|chaos|crazy|hectic)/
            )
          ) {
            assistantText =
              "Busyness can be its own kind of heavy. What took up most of your time?";
            nextStep = 3;
          } else {
            assistantText = `Yeah, "${trimmed}" adds up. What took the most energy out of you today?`;
            nextStep = 3;
          }
        } else if (currentStep === 3) {
          if (
            lowerTrimmed.match(
              /(work|meeting|job|boss|colleague|email|deadline|project|client|customer)/
            )
          ) {
            assistantText =
              "Too many conversations and not enough breathing space?";
            nextStep = 4;
          } else {
            assistantText =
              "That sounds heavy. Does it feel like you didn't have enough breathing space?";
            nextStep = 4;
          }
        } else if (currentStep === 4) {
          if (
            lowerTrimmed.match(
              /(exactly|yes|yeah|yep|right|totally|definitely|sure|absolutely|maybe|sort of|kind of)/
            )
          ) {
            assistantText =
              "Yeah. That builds up. Did anything today feel even slightly good?";
            nextStep = 5;
          } else {
            assistantText =
              "I understand. Amidst all that, did anything today feel even slightly good?";
            nextStep = 5;
          }
        } else if (currentStep === 5) {
          if (
            lowerTrimmed.match(
              /(coffee|friend|lunch|break|walk|tea|sun|weather|music|song|food|meal|dinner|sleep|nap|cat|dog|pet|kids|child|partner|spouse)/
            )
          ) {
            assistantText =
              "There it is. What about it felt different from the rest of the day?";
            nextStep = 6;
          } else if (
            lowerTrimmed.match(/(no|nothing|not really|nope|none|nada)/)
          ) {
            assistantText =
              "That's honest. Sometimes we just need to get through it. If you could have 20 minutes of calm tonight, what would you do?";
            nextStep = 7;
          } else {
            assistantText =
              "It's important to notice those moments. What about it felt different?";
            nextStep = 6;
          }
        } else if (currentStep === 6) {
          if (
            lowerTrimmed.match(
              /(calm|peace|quiet|relax|pressure|slow|happy|joy|smile|laugh|fun|safe|warm)/
            )
          ) {
            assistantText =
              "So calm exists in your day. It just gets crowded out. If tonight had even 20 minutes of that same calm… what would you do?";
            nextStep = 7;
          } else {
            assistantText =
              "That feeling is worth holding onto. If tonight had even 20 minutes of that... what would you do?";
            nextStep = 7;
          }
        } else if (currentStep === 7) {
          if (
            lowerTrimmed.match(
              /(sit|quiet|phone|nothing|read|sleep|rest|bath|shower|meditate|tv|watch|movie|game|play|music|listen)/
            )
          ) {
            assistantText =
              "That sounds like your nervous system asking for a reset. You don't need to solve your whole life tonight. Just protect those 20 minutes.";
            nextStep = 8;
          } else {
            assistantText =
              "That sounds exactly like what you need. A reset. You don't need to solve everything tonight. Just protect those 20 minutes.";
            nextStep = 8;
          }
        } else if (currentStep === 8) {
          assistantText =
            "Good. Then let's make that the goal for today. Nothing dramatic. Just quiet.";
          nextStep = 9;
        } else if (currentStep === 10) {
          assistantText =
            "That sounds lovely. Holding onto that feeling can help carry you through the rest of the week.";
          nextStep = 9;
        }

        if (!assistantText) {
          assistantText = trimmed.endsWith("?")
            ? `I heard you ask: "${trimmed}". Let's focus on your day for now.`
            : `I heard: "${trimmed}". Please go on.`;
        }

        scriptStepRef.current = nextStep;

        speechTimeoutRef.current = window.setTimeout(() => {
          setTranscript((prev) => [
            ...prev,
            {
              role: "assistant",
              content: assistantText,
              timestamp: Date.now(),
            },
          ]);
          speakAvatar(assistantText);
        }, 1500);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      if (event.error !== "no-speech") setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      isRecognitionActiveRef.current = false;

      if (
        permissionsGranted &&
        !isEzriSpeakingRef.current &&
        !isSessionEndingRef.current
      ) {
        const sessionDuration = Date.now() - lastSpeechStartRef.current;
        const restartDelay = sessionDuration < 1000 ? 2000 : 500;
        console.log(
          `Speech recognition ended (ran for ${sessionDuration}ms), restarting in ${restartDelay}ms...`
        );

        setTimeout(() => {
          if (isSessionEndingRef.current) return;
          try {
            if (
              !isEzriSpeakingRef.current &&
              recognitionRef.current &&
              !isRecognitionActiveRef.current
            ) {
              recognitionRef.current.start();
            }
          } catch (e) {
            console.error("Failed to restart speech recognition", e);
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
      } catch (e) {}
      setIsListening(false);
      isRecognitionActiveRef.current = false;
      recognitionRef.current = null;
    };
  }, [permissionsGranted]);

  // ── Watchdog ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!permissionsGranted) return;

    const watchdog = setInterval(() => {
      if (
        !isSessionEndingRef.current &&
        !isListening &&
        !isEzriSpeakingRef.current &&
        recognitionRef.current &&
        !isRecognitionActiveRef.current
      ) {
        console.log("Watchdog: Recognition stopped unexpectedly, restarting...");
        try {
          recognitionRef.current.start();
        } catch (e) {}
      }

      if (isListening && audioLevel < 2 && !isEzriSpeakingRef.current) {
        console.warn(
          "Watchdog: Microphone seems silent despite 'Listening' state."
        );
      }
    }, 5000);

    return () => clearInterval(watchdog);
  }, [permissionsGranted, isListening, audioLevel]);

  // ── Initial greeting ────────────────────────────────────────────────────
  useEffect(() => {
    if (
      permissionsGranted &&
      scriptStepRef.current === 0 &&
      transcript.length === 0
    ) {
      const initialText = "Hey. How's today treating you?";

      const timer = setTimeout(() => {
        scriptStepRef.current = 1;
        setTranscript((prev) => [
          ...prev,
          { role: "assistant", content: initialText, timestamp: Date.now() },
        ]);
        speakAvatar(initialText);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [permissionsGranted, transcript.length]);

  // ── Media stream ────────────────────────────────────────────────────────
  useEffect(() => {
    if (permissionsGranted && !stream) {
      const initMedia = async () => {
        try {
          const userStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          setStream(userStream);
          if (videoRef.current) videoRef.current.srcObject = userStream;
        } catch (err) {
          console.error("Failed to access media devices:", err);
          toast.error("Failed to access camera/microphone");
          setPermissionsGranted(false);
          setShowPermissionRequest(true);
          try {
            if (
              typeof window !== "undefined" &&
              typeof window.localStorage !== "undefined"
            ) {
              window.localStorage.removeItem(permissionStorageKey);
            }
          } catch (error) {
            console.error("Failed to clear media permission setting:", error);
          }
        }
      };
      initMedia();
    }

    return () => {
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
  }, [permissionsGranted, stream]);

  useEffect(() => {
    if (stream) {
      stream
        .getAudioTracks()
        .forEach((track) => (track.enabled = !isMuted));
      stream
        .getVideoTracks()
        .forEach((track) => (track.enabled = !isCameraOff));
    }
  }, [isMuted, isCameraOff, stream]);

  // Safety state
  const [showSafetyBoundary, setShowSafetyBoundary] = useState(false);
  const [showSafetyResources, setShowSafetyResources] = useState(false);
  const [isSessionPaused, setIsSessionPaused] = useState(false);
  const [lastSafetyState, setLastSafetyState] = useState(currentState);

  useEffect(() => {
    isSessionPausedRef.current = isSessionPaused;
  }, [isSessionPaused]);

  // Credits
  const [initialCreditsSeconds, setInitialCreditsSeconds] = useState<number | null>(
    null
  );
  const [accountCreditsSeconds, setAccountCreditsSeconds] = useState<number | null>(null);
  const [showLowCreditsWarning, setShowLowCreditsWarning] = useState(false);
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

  const [sessionId] = useState(() => apiSessionId || `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [hasSessionEnded, setHasSessionEnded] = useState(false);

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

  useEffect(() => {
    const analysisInterval = setInterval(() => {
      const mockPhrases = [
        "I'm feeling okay today",
        "Things have been really hard lately",
        "I'm struggling with everything",
        "I don't know if I can keep going",
      ];

      if (Math.random() < 0.3 && !isSessionPaused) {
        const randomPhrase =
          mockPhrases[Math.floor(Math.random() * mockPhrases.length)];
        const analysis = analyzeTextForSafety(randomPhrase, currentState);

        if (
          analysis.confidence > 0.6 &&
          analysis.suggestedState !== currentState
        ) {
          updateState(
            analysis.suggestedState,
            "conversation_analysis",
            analysis.detectedSignals
          );
        }
      }
    }, 10000);

    return () => clearInterval(analysisInterval);
  }, [currentState, isSessionPaused, updateState]);

  useEffect(() => {
    if (isSessionPaused || hasSessionEnded) return;

    const timer = setInterval(() => {
      setSessionTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isSessionPaused, hasSessionEnded]);

  // Heartbeat: deduct credits during the live session (server-side).
  useEffect(() => {
    if (!apiSessionId) return;
    if (isSessionPaused || hasSessionEnded) return;

    let cancelled = false;
    let lastSent = 0;

    const tick = async () => {
      if (cancelled) return;
      // Avoid sending too early (need at least a few seconds of session time)
      if (sessionTime <= 0) return;
      // Only send if at least 15s have passed since last send
      if (sessionTime - lastSent < 15) return;

      try {
        await api.sessions.heartbeat(apiSessionId, sessionTime);
        lastSent = sessionTime;
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
  }, [apiSessionId, isSessionPaused, hasSessionEnded, sessionTime]);

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
      if (!showLowCreditsWarning) setShowLowCreditsWarning(true);
    } else {
      if (showLowCreditsWarning) setShowLowCreditsWarning(false);
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const endSessionAndCleanup = async () => {
    if (isSessionEndingRef.current) return;
    setHasSessionEnded(true);
    isSessionEndingRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch (e) {}
      isRecognitionActiveRef.current = false;
      setIsListening(false);
    }

    setIsUploading(true);
    const durationSeconds = sessionTime;

    try {
      if (!apiSessionId) {
        toast.error("Missing session id. Please restart the session from the lobby.");
        return;
      }
      await api.sessions.end(apiSessionId, durationSeconds, undefined, transcript);
      try {
        await refreshProfile();
      } catch (e) {
        console.error("Failed to refresh profile after session end:", e);
      }
      toast.success("Session ended successfully");
    } catch (error) {
      console.error("Failed to end session:", error);
      toast.error("Failed to save session data");
    } finally {
      setIsUploading(false);
    }
  };

  const handleEndSession = async () => {
    await endSessionAndCleanup();

    const durationSeconds = sessionTime;

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
      navigate("/app/dashboard", {
        state: {
          sessionId,
          sessionDuration: durationSeconds,
        },
      });
    }
  };

  const getConnectionColor = () => {
    switch (connectionQuality) {
      case "excellent":
        return "text-green-400";
      case "good":
        return "text-yellow-400";
      case "poor":
        return "text-red-400";
    }
  };

  const toggleFullscreen = async () => {
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
  };

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
    if (currentUtteranceRef.current) {
      window.speechSynthesis.cancel();
      currentUtteranceRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    setTimeout(() => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
      setPermissionsGranted(true);
      window.location.reload();
    }, 100);
    toast.info("Resetting Session...");
  };

  return (
    <div
      ref={sessionContainerRef}
      className="h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-black/30 backdrop-blur-xl border-b border-white/10 px-6 py-4 z-20"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.div
              animate={{
                boxShadow: [
                  "0 0 20px rgba(139, 92, 246, 0.5)",
                  "0 0 40px rgba(139, 92, 246, 0.8)",
                  "0 0 20px rgba(139, 92, 246, 0.5)",
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center"
            >
              <Sparkles className="w-6 h-6 text-white" />
            </motion.div>
            <div>
              <h2 className="font-bold text-white text-lg">
                Video Session with {currentAvatar.name}
              </h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-2 h-2 bg-green-400 rounded-full"
                  />
                  <span className="text-sm text-gray-300">Live</span>
                </div>
                <span className="text-sm text-gray-400">•</span>
                <span className="text-sm text-gray-300 font-mono">
                  {formatTime(sessionTime)}
                </span>
                <span className="text-sm text-gray-400">•</span>
                <div className="flex items-center gap-1">
                  <Circle
                    className={`w-3 h-3 ${getConnectionColor()} fill-current`}
                  />
                  <span className={`text-xs ${getConnectionColor()}`}>
                    {connectionQuality.charAt(0).toUpperCase() +
                      connectionQuality.slice(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Video Session Area */}
      <div className="flex-1 relative overflow-hidden p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full h-full rounded-3xl overflow-hidden relative bg-gradient-to-br from-amber-900/30 via-orange-900/20 to-purple-900/30 backdrop-blur-xl border-2 border-white/10 shadow-2xl"
        >
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
            <AnimatePresence>
              {isEzriSpeaking && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-gradient-to-b from-purple-500/20 via-transparent to-transparent pointer-events-none"
                >
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 bg-gradient-radial from-purple-500/30 to-transparent blur-3xl"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              className="relative z-10 w-full h-full"
              animate={{
                y: isEzriSpeaking ? [0, -2, 0, -1, 0] : [0, -1, 0],
              }}
              transition={{
                duration: isEzriSpeaking ? 2 : 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <ThreeAvatar
                isSpeaking={isEzriSpeaking}
                audioLevel={audioLevel}
                speechPulse={speechPulse}
                speechText={speechText}
                speechCharIndex={speechCharIndex}
              />
            </motion.div>

            {isEzriSpeaking && (
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-purple-900/80 to-transparent" />
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1 bg-purple-400 rounded-full"
                      animate={{ height: [10, 30, 15, 25, 10] }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        delay: i * 0.1,
                        ease: "easeInOut",
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Avatar Name */}
          <div className="absolute top-6 left-6 bg-black/60 backdrop-blur-xl px-4 py-2 rounded-xl border border-white/20">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <p className="text-sm font-semibold text-white">
                {currentAvatar.name}
              </p>
            </div>
          </div>

          {/* Connection & Credits */}
          <div className="absolute top-6 right-6 flex flex-col gap-2 items-end">
            <div className="bg-black/60 backdrop-blur-xl px-3 py-2 rounded-lg border border-white/20 flex items-center gap-2">
              <Circle
                className={`w-2 h-2 ${getConnectionColor()} fill-current animate-pulse`}
              />
              <span className="text-xs text-white font-medium">
                {connectionQuality === "excellent"
                  ? "HD"
                  : connectionQuality === "good"
                  ? "SD"
                  : "Low Quality"}
              </span>
            </div>

            <motion.div
              animate={{
                scale:
                  remainingWholeMinutes !== null &&
                  remainingWholeMinutes <= 10
                    ? [1, 1.05, 1]
                    : 1,
              }}
              transition={{
                duration: 1,
                repeat:
                  remainingWholeMinutes !== null &&
                  remainingWholeMinutes <= 10
                    ? Infinity
                    : 0,
              }}
              className={`px-4 py-2 rounded-xl border flex items-center gap-2 ${
                remainingWholeMinutes !== null && remainingWholeMinutes <= 10
                  ? "bg-red-500/90 border-red-300"
                  : remainingWholeMinutes !== null &&
                    remainingWholeMinutes <= 30
                  ? "bg-amber-500/90 border-amber-300"
                  : "bg-black/60 backdrop-blur-xl border-white/20"
              }`}
            >
              <Clock
                className={`w-4 h-4 ${
                  remainingWholeMinutes !== null && remainingWholeMinutes <= 10
                    ? "text-white"
                    : "text-blue-300"
                }`}
              />
              <div>
                <p
                  className={`text-xs ${
                    remainingWholeMinutes !== null && remainingWholeMinutes <= 10
                      ? "text-white"
                      : "text-gray-300"
                  }`}
                >
                  Minutes Left
                </p>
                <p className="text-lg font-bold text-white font-mono">
                  {remainingSeconds !== null ? formatTime(remainingSeconds) : "—"}
                </p>
              </div>
            </motion.div>
          </div>

          {/* Status */}
          <div className="absolute bottom-6 left-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-black/60 backdrop-blur-xl px-4 py-2 rounded-xl border border-white/20"
            >
              {isEzriSpeaking ? (
                <div className="flex items-center gap-2 text-purple-300">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  >
                    <Volume2 className="w-4 h-4" />
                  </motion.div>
                  <span className="text-sm font-medium">Speaking...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-300">
                  <div className="flex items-end gap-[2px] h-4">
                    {[1, 2, 3].map((bar) => (
                      <motion.div
                        key={bar}
                        className="w-1 bg-green-400 rounded-t-sm"
                        animate={{
                          height: Math.max(4, Math.min(16, (audioLevel / 2) * bar)),
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 20,
                        }}
                      />
                    ))}
                  </div>
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Circle
                      className={`w-3 h-3 ${
                        isListening
                          ? "fill-current"
                          : "fill-transparent stroke-current"
                      }`}
                    />
                  </motion.div>
                  <span className="text-sm font-medium">
                    {isListening ? "Listening" : "Connecting..."}
                    {audioLevel > 10 && (
                      <span className="text-xs ml-1 text-green-200">
                        ({Math.round(audioLevel)})
                      </span>
                    )}
                  </span>
                </div>
              )}
            </motion.div>
          </div>
        </motion.div>

        {/* Subtitles */}
        <AnimatePresence>
          {currentSubtitle && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-8 left-0 right-0 px-8 flex justify-center z-40 pointer-events-none"
            >
              <div className="bg-black/70 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 max-w-2xl text-center shadow-xl">
                <p className="text-white text-lg font-medium leading-relaxed">
                  {currentSubtitle}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* User PiP camera */}
        <motion.div
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="absolute bottom-28 right-10 w-64 h-48 rounded-2xl overflow-hidden bg-gradient-to-br from-slate-700 to-slate-900 border-2 border-white/20 shadow-2xl"
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`w-full h-full object-cover ${
              isCameraOff ? "hidden" : "block"
            }`}
          />
          {isCameraOff && (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <div className="text-center">
                <VideoOff className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Camera Off</p>
              </div>
            </div>
          )}
          {isMuted && !isCameraOff && (
            <div className="absolute bottom-2 left-2 bg-red-500 p-2 rounded-full">
              <MicOff className="w-4 h-4 text-white" />
            </div>
          )}
        </motion.div>
      </div>

      {/* Notice */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-6 pb-2"
      >
        <div className="max-w-7xl mx-auto bg-blue-500/10 backdrop-blur-xl border border-blue-500/30 rounded-xl p-3 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-200">
            <span className="font-semibold">Voice-Only Session:</span> This is a
            video call with voice interaction. There is no chat feature — speak
            naturally with your AI companion.
          </p>
        </div>
      </motion.div>

      {/* Controls */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-black/30 backdrop-blur-xl border-t border-white/10 px-6 py-6"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsMuted(!isMuted)}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
              isMuted
                ? "bg-red-500 hover:bg-red-600"
                : "bg-white/10 hover:bg-white/20 border-2 border-white/20"
            }`}
          >
            {isMuted ? (
              <MicOff className="w-7 h-7 text-white" />
            ) : (
              <Mic className="w-7 h-7 text-white" />
            )}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsCameraOff(!isCameraOff)}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
              isCameraOff
                ? "bg-red-500 hover:bg-red-600"
                : "bg-white/10 hover:bg-white/20 border-2 border-white/20"
            }`}
          >
            {isCameraOff ? (
              <VideoOff className="w-7 h-7 text-white" />
            ) : (
              <Video className="w-7 h-7 text-white" />
            )}
          </motion.button>

          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsSoundOff((prev) => !prev)}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
              isSoundOff
                ? "bg-red-500 hover:bg-red-600"
                : "bg-white/10 hover:bg-white/20 border-2 border-white/20"
            }`}
            aria-label={isSoundOff ? "Turn sound on" : "Turn sound off"}
          >
            {isSoundOff ? (
              <VolumeX className="w-7 h-7 text-white" />
            ) : (
              <Volume2 className="w-7 h-7 text-white" />
            )}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowEndConfirm(true)}
            className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 flex items-center justify-center shadow-lg shadow-red-500/50 transition-all"
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </motion.button>
        </div>

        <div className="max-w-7xl mx-auto flex items-center justify-center gap-4 mt-3">
          <span className="text-xs text-gray-400 w-16 text-center">
            {isMuted ? "Unmute" : "Mute"}
          </span>
          <span className="text-xs text-gray-400 w-16 text-center">Camera</span>
          <span className="text-xs text-gray-400 w-16 text-center">Sound</span>
          <span className="text-xs text-gray-400 w-16 text-center">End</span>
        </div>
      </motion.div>

      {/* Permission Modal */}
      <AnimatePresence>
        {showPermissionRequest && !permissionsGranted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-gradient-to-br from-slate-900 to-purple-900 rounded-3xl p-8 max-w-lg w-full border-2 border-purple-500/30 shadow-2xl"
            >
              <div className="text-center mb-6">
                <motion.div
                  animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                  className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/50"
                >
                  <Camera className="w-10 h-10 text-white" />
                </motion.div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  Camera & Microphone Access
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  To have a video session with {currentAvatar.name}, we need
                  permission to access your camera and microphone.
                </p>
              </div>

              <div className="bg-black/30 backdrop-blur-xl rounded-2xl p-5 mb-6 border border-white/10">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Video className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">Camera Access</p>
                      <p className="text-sm text-gray-400">
                        So {currentAvatar.name} can see you during the
                        conversation
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-pink-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Mic className="w-4 h-4 text-pink-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">Microphone Access</p>
                      <p className="text-sm text-gray-400">
                        So you can speak naturally with your AI companion
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-500/10 backdrop-blur-xl rounded-xl p-4 mb-6 border border-blue-500/30">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-200">
                    <span className="font-semibold">Your privacy matters:</span>{" "}
                    Your video is only used during the session and is never
                    recorded or stored. You can disable your camera at any time.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setShowPermissionRequest(false);
                    navigate("/app/dashboard");
                  }}
                  className="flex-1 px-6 py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium flex items-center justify-center gap-2 border border-white/10"
                >
                  <X className="w-5 h-5" />
                  Cancel
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setPermissionsGranted(true);
                    setShowPermissionRequest(false);
                    try {
                      if (
                        typeof window !== "undefined" &&
                        typeof window.localStorage !== "undefined"
                      ) {
                        window.localStorage.setItem(
                          permissionStorageKey,
                          JSON.stringify(true)
                        );
                      }
                    } catch (error) {
                      console.error(
                        "Failed to save media permission setting:",
                        error
                      );
                    }
                  }}
                  className="flex-1 px-6 py-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-purple-500/50"
                >
                  <Check className="w-5 h-5" />
                  Allow Access
                </motion.button>
              </div>

              <p className="text-xs text-gray-400 text-center mt-4">
                Your browser may show an additional permission prompt after
                clicking "Allow Access"
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Low Credits Warning */}
      <AnimatePresence>
        {showLowCreditsWarning &&
          projectedAccountRemainingWholeMinutes !== null &&
          projectedAccountRemainingWholeMinutes > 0 &&
          projectedAccountRemainingWholeMinutes < 10 && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-32 left-1/2 -translate-x-1/2 z-40 max-w-md"
            >
              <div className="bg-amber-500 border-2 border-amber-300 rounded-2xl p-4 shadow-2xl">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-white flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-white font-bold mb-1">
                      Running Low on Minutes!
                    </h4>
                    <p className="text-sm text-amber-50 mb-3">
                      You have{" "}
                      <span className="font-mono">
                        {projectedAccountRemainingSeconds !== null
                          ? formatTime(projectedAccountRemainingSeconds)
                          : "—"}
                      </span>{" "}
                      left. Consider
                      purchasing more or your session will end soon.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          if (isBuyingMoreMinutes) return;
                          setIsBuyingMoreMinutes(true);
                          try {
                            await endSessionAndCleanup();
                            navigate("/app/billing");
                          } finally {
                            setIsBuyingMoreMinutes(false);
                          }
                        }}
                        disabled={isBuyingMoreMinutes}
                        className="px-4 py-2 bg-white text-amber-700 rounded-lg font-semibold text-sm hover:bg-amber-50 transition-colors disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center gap-2"
                      >
                        {isBuyingMoreMinutes && <Loader2 className="w-4 h-4 animate-spin" />}
                        Buy More Minutes
                      </button>
                      <button
                        onClick={() => setShowLowCreditsWarning(false)}
                        disabled={isBuyingMoreMinutes}
                        className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium text-sm hover:bg-amber-700 transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
      </AnimatePresence>

      {/* Out of Credits Modal */}
      <AnimatePresence>
        {showOutOfCredits && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-slate-900 to-purple-900 rounded-3xl p-8 max-w-lg w-full border-2 border-red-500/30 shadow-2xl"
            >
              <div className="text-center mb-6">
                <motion.div
                  animate={{ scale: [1, 1.1, 1], rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.5, repeat: 3 }}
                  className="w-20 h-20 bg-gradient-to-br from-red-500 to-rose-600 rounded-full flex items-center justify-center mx-auto mb-4"
                >
                  <Clock className="w-10 h-10 text-white" />
                </motion.div>
                <h3 className="text-3xl font-bold text-white mb-2">
                  Session Paused
                </h3>
                <p className="text-gray-300 text-lg">
                  You've used all your included minutes for this month.
                </p>
              </div>

              <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 mb-6 border border-white/10">
                <div className="text-center mb-4">
                  <p className="text-gray-300 mb-2">Your session time:</p>
                  <p className="text-4xl font-bold text-white font-mono">
                    {formatTime(sessionTime)}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 text-amber-400">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    0 minutes remaining
                  </span>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <h4 className="text-white font-semibold text-center mb-3">
                  Continue Your Wellness Journey:
                </h4>
                <button
                  onClick={async () => {
                    await endSessionAndCleanup();
                    navigate("/app/billing");
                  }}
                  className="w-full p-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl text-white font-semibold flex items-center justify-between group transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold">Buy More Minutes</p>
                      <p className="text-xs text-green-100">
                        Pay-as-you-go available
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>

                <button
                  onClick={async () => {
                    await endSessionAndCleanup();
                    navigate("/app/billing");
                  }}
                  className="w-full p-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl text-white font-semibold flex items-center justify-between group transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <Crown className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold">Upgrade Your Plan</p>
                      <p className="text-xs text-purple-100">
                        Get more minutes & better rates
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              <button
                onClick={() => navigate("/app/dashboard")}
                className="w-full px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors"
              >
                End Session & Return to Dashboard
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <LowMinutesWarning
        isOpen={showLowMinutesModal}
        onClose={() => setShowLowMinutesModal(false)}
        minutesRemaining={remainingWholeMinutes ?? 0}
      />

      {/* End Session Confirm */}
      <AnimatePresence>
        {showEndConfirm && (
            <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowEndConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              className="bg-slate-900 rounded-2xl p-6 max-w-md w-full border-2 border-red-500/30"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <PhoneOff className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  End Session?
                </h3>
                <p className="text-gray-300">
                  Are you sure you want to end your video session with{" "}
                  {currentAvatar.name}?
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  Session duration: {formatTime(sessionTime)}
                </p>
              </div>

              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowEndConfirm(false)}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium"
                >
                  Continue Session
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleEndSession}
                  disabled={isUploading}
                  className={`flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-medium flex items-center justify-center gap-2 ${
                    isUploading ? "opacity-70 cursor-not-allowed" : ""
                  }`}
                >
                  {isUploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : null}
                  {isUploading ? "Ending..." : "End Session"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Safety Boundary */}
      <AnimatePresence>
        {showSafetyBoundary && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-32 left-1/2 -translate-x-1/2 z-40 max-w-md"
          >
            <div className="bg-red-500 border-2 border-red-300 rounded-2xl p-4 shadow-2xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-white flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-white font-bold mb-1">Safety Alert!</h4>
                  <p className="text-sm text-red-50 mb-3">
                    We've detected a potential safety concern in your
                    conversation. Please take a moment to review the following
                    resources.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowSafetyResources(true)}
                      className="px-4 py-2 bg-white text-red-700 rounded-lg font-semibold text-sm hover:bg-red-50 transition-colors"
                    >
                      View Resources
                    </button>
                    <button
                      onClick={() => setShowSafetyBoundary(false)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium text-sm hover:bg-red-700 transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Safety Resources Modal */}
      <AnimatePresence>
        {showSafetyResources && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-slate-900 to-purple-900 rounded-3xl p-8 max-w-lg w-full border-2 border-red-500/30 shadow-2xl"
            >
              <div className="text-center mb-6">
                <motion.div
                  animate={{ scale: [1, 1.1, 1], rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.5, repeat: 3 }}
                  className="w-20 h-20 bg-gradient-to-br from-red-500 to-rose-600 rounded-full flex items-center justify-center mx-auto mb-4"
                >
                  <Heart className="w-10 h-10 text-white" />
                </motion.div>
                <h3 className="text-3xl font-bold text-white mb-2">
                  Safety Resources
                </h3>
                <p className="text-gray-300 text-lg">
                  We've detected a potential safety concern in your conversation.
                  Here are some resources to help you.
                </p>
              </div>

              <div className="space-y-3 mb-6">
                <h4 className="text-white font-semibold text-center mb-3">
                  Helpful Resources:
                </h4>
                {safetyResources.map((resource) => (
                  <SafetyResourceCard key={resource.id} resource={resource} />
                ))}
              </div>

              <button
                onClick={() => navigate("/app/dashboard")}
                className="w-full px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors"
              >
                End Session & Return to Dashboard
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <SafetyStateIndicator />

      {/* Pause Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsSessionPaused(!isSessionPaused)}
        className={`absolute bottom-16 left-16 w-16 h-16 rounded-full flex items-center justify-center transition-all ${
          isSessionPaused
            ? "bg-green-500 hover:bg-green-600"
            : "bg-white/10 hover:bg-white/20 border-2 border-white/20"
        }`}
      >
        {isSessionPaused ? (
          <Play className="w-7 h-7 text-white" />
        ) : (
          <Pause className="w-7 h-7 text-white" />
        )}
      </motion.button>
    </div>
  );
}