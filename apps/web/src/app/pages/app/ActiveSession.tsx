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
  Loader2,
  GripHorizontal,
} from "lucide-react";
import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
import { getCurrentRegion, getEmergencyResources, getRegionInfo } from "@/app/utils/safetyResources";
import { LowMinutesWarning } from "@/app/components/modals/LowMinutesWarning";
import { getEzriConfig } from "@/lib/ezri/config";
import { getOrCreateEzriUserid } from "@/lib/ezri/ids";
import { createEzriApiClient } from "@/lib/ezri/apiClient";
import { EzriRealtimeClient, type EzriWsStatus } from "@/lib/ezri/realtimeClient";
import { resolveEzriWsVoiceForCompanion } from "@/lib/ezri/voiceForCompanion";
import { normalizeAudioSource, toObjectUrl } from "@/lib/ezri/audio";
import {
  companionSessionUses3dModel,
  resolveCompanionModelUrl,
  resolveCompanionPortraitUrl,
} from "@/lib/avatar/companionModelUrl";
import {
  getCompanionViewTuning,
  type CompanionViewTuning,
} from "@/lib/avatar/companionViewTuning";

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Crisis keyword popup (public, user-facing).
const CRISIS_KEYWORD_MODAL_ENABLED = false;

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
  // NOTE: do NOT include generic "eyes" here — it frequently maps to a non-blink
  // control and will deform/hide the face instead of closing eyelids.
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
  // Some rigs only expose a generic "eyes" morph. We allow it as a last-resort
  // blink target (we clamp it very conservatively in the blink animator).
  if (lower === "eyes") return true;
  return BLINK_KEYWORDS.some((k) => lower === k || lower.includes(k));
}

function isMouthName(name: string): boolean {
  const lower = name.toLowerCase().trim();
  if (EXACT_MOUTH_NAMES.includes(lower)) return true;
  return MOUTH_KEYWORDS.some((k) => lower === k || lower.includes(k));
}

function isUpperEyelidBoneName(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes("eyelidupper") ||
    n.includes("eyelid_upper") ||
    n.includes("upperlid") ||
    n.includes("upper_lid") ||
    n.includes("lashupper") ||
    n.includes("upperlash") ||
    n.includes("lashesupper")
  );
}

function isLowerEyelidBoneName(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes("eyelidlower") ||
    n.includes("eyelid_lower") ||
    n.includes("lowerlid") ||
    n.includes("lower_lid") ||
    n.includes("lashlower") ||
    n.includes("lowerlash") ||
    n.includes("lasheslower")
  );
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
  // Cap vowel score so the envelope can open clearly without pegging max all the time.
  return THREE.MathUtils.clamp(normalized, 0.02, 0.92);
}

type MorphBinding = {
  mesh: THREE.Mesh;
  index: number;
  name: string;
  initialInfluence: number;
};
function storeFaceBoneDefault(bone: THREE.Bone, map: Map<string, { x: number; y: number; z: number }>) {
  if (!map.has(bone.uuid)) {
    map.set(bone.uuid, {
      x: bone.rotation.x,
      y: bone.rotation.y,
      z: bone.rotation.z,
    });
  }
}

function isJawBoneName(name: string): boolean {
  const n = name.toLowerCase();
  if (n.includes("jawline")) return false;
  return n.includes("jaw");
}

function isChinBoneName(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("chin");
}

function isJawlineBoneName(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("jawline");
}

function isMouthInteriorBoneName(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("mouthinterior");
}

function isUnderChinBoneName(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("underchin");
}

/** Driven separately from the main mouth loop — subtle puff / smile sync. */
function isCheekMorphName(name: string): boolean {
  const lower = name.toLowerCase().trim();
  if (/eye/.test(lower) && /squint/.test(lower) && !/cheek/.test(lower)) {
    return false;
  }
  return (
    lower.includes("cheek") ||
    lower.includes("nasolabial") ||
    lower.includes("puff") ||
    lower.includes("buccinator") ||
    (lower.includes("smile") && !lower.includes("eye")) ||
    (lower.includes("squint") && lower.includes("cheek"))
  );
}

function isCheekBoneName(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes("cheek") ||
    n.includes("zygomatic") ||
    n.includes("nasolabial") ||
    n.includes("buccinator") ||
    (n.includes("smile") &&
      (n.includes("facial") || /l_|_l|r_|_r|left|right/.test(n)))
  );
}

/** T1 / MetaHuman: cheek movers — skip 12IPV chains; include all CheekLower* (not only 1–2). */
function isPrimaryCheekBoneName(name: string): boolean {
  const n = name.toLowerCase();
  if (n.includes("12ipv")) return false;
  if (n.includes("cheekinner")) return true;
  if (n.includes("cheeklower")) return true;
  if (n.includes("nasolabialbulge")) return true;
  if (n.includes("masseter")) return true;
  if (n.includes("zygomatic")) return true;
  return false;
}

/** Only MetaHuman / T1 main mandible — other “jaw*” bones can move the whole head/torso visually. */
function isMainMandibleBoneName(name: string): boolean {
  const n = name.toLowerCase().trim();
  return n === "facial_c_jaw";
}

/** Animate a small set of chin movers only (not every 12IPV chin helper). */
function isPrimaryChinBoneName(name: string): boolean {
  const n = name.toLowerCase();
  if (n.includes("12ipv")) return false;
  return (
    n === "facial_c_chin" ||
    n === "facial_c_chin1" ||
    n === "facial_c_chin2" ||
    n === "facial_c_chin3"
  );
}

/** Center mouth/lip drivers (stronger deltas than peripheral chain bones). */
function isCenterLipBoneName(name: string): boolean {
  const n = name.toLowerCase();
  if (n.includes("12ipv")) return false;
  return (
    n === "facial_c_mouthupper" ||
    n === "facial_c_mouthlower" ||
    n === "facial_c_lipupper" ||
    n === "facial_c_liplower" ||
    n === "facial_c_lowerliprotation"
  );
}

function isCheekRelatedMorphKeyForLog(name: string): boolean {
  const lower = name.toLowerCase();
  return /cheek|smile|nasolabial|puff|squint/.test(lower);
}

/** 2D-only session view (everyone except Sarah): PNG portrait, no GLB — e.g. Alex, Jordan, Maya. */
function StaticSessionPortrait({
  imageUrl,
  isSpeaking,
}: {
  imageUrl: string;
  isSpeaking: boolean;
}) {
  return (
    <div className="relative w-full h-full min-h-[500px] flex items-center justify-center px-4">
      <img
        src={imageUrl}
        alt=""
        className={`max-h-[min(100%,720px)] w-auto max-w-full object-contain drop-shadow-2xl transition-transform duration-300 ${
          isSpeaking ? "scale-[1.02]" : "scale-100"
        }`}
      />
    </div>
  );
}

function ThreeAvatar({
  isSpeaking,
  audioLevel,
  /** Per-frame mouth driver (mic or TTS RMS). State props lag behind RAF; ref does not. */
  mouthAudioLevelRef,
  speechPulse,
  speechText,
  speechCharIndex,
  modelUrl,
  viewTuning,
}: {
  isSpeaking: boolean;
  audioLevel: number;
  mouthAudioLevelRef: MutableRefObject<number>;
  speechPulse: number;
  speechText: string;
  speechCharIndex: number;
  /** Resolved GLB URL for the selected companion (see `resolveCompanionModelUrl`). */
  modelUrl: string;
  /** Framing + mouth strength for this companion’s GLB (see `getCompanionViewTuning`). */
  viewTuning: CompanionViewTuning;
}) {
  const [avatarLoadState, setAvatarLoadState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [avatarLoadProgress, setAvatarLoadProgress] = useState<number | null>(
    null
  );

  const isSpeakingRef = useRef(isSpeaking);
  const audioLevelRef = useRef(audioLevel);
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);
  useEffect(() => {
    audioLevelRef.current = audioLevel;
  }, [audioLevel]);
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
  const mouthDriveMultRef = useRef(viewTuning.mouthDriveMultiplier);
  mouthDriveMultRef.current = viewTuning.mouthDriveMultiplier;

  const mouthBindingsRef = useRef<MorphBinding[]>([]);
  const blinkBindingsRef = useRef<MorphBinding[]>([]);
  // const jawBoneRef = useRef<THREE.Bone | null>(null);
  // const jawDefaultRotXRef = useRef<number | null>(null);
  const eyelidBonesRef = useRef<THREE.Bone[]>([]);
  const eyelidDefaultRotXRef = useRef<Map<string, number>>(new Map());
  const eyelidDefaultRotZRef = useRef<Map<string, number>>(new Map());
  const eyelidDefaultRotYRef = useRef<Map<string, number>>(new Map());
  const eyelidDefaultPosYRef = useRef<Map<string, number>>(new Map());
  const eyelidDefaultPosZRef = useRef<Map<string, number>>(new Map());
  const lipBonesUpperRef = useRef<THREE.Bone[]>([]);
  const lipBonesLowerRef = useRef<THREE.Bone[]>([]);
  const lipDefaultRotXRef = useRef<Map<string, number>>(new Map());
  const jawBonesRef = useRef<THREE.Bone[]>([]);
  const chinBonesRef = useRef<THREE.Bone[]>([]);
  const jawlineBonesRef = useRef<THREE.Bone[]>([]);
  const mouthInteriorBonesRef = useRef<THREE.Bone[]>([]);
  const underChinBonesRef = useRef<THREE.Bone[]>([]);
  const cheekBindingsRef = useRef<MorphBinding[]>([]);
  const cheekBonesRef = useRef<THREE.Bone[]>([]);
  const lastMouthFrameTimeRef = useRef(performance.now());
  /** Follows mouth envelope with a short delay (secondary motion for lips vs jaw). */
  const lipDelayedRef = useRef(0);

  const faceBoneDefaultsRef = useRef<
    Map<string, { x: number; y: number; z: number }>
  >(new Map());
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

    let cancelled = false;
    setAvatarLoadState("loading");
    setAvatarLoadProgress(null);

    const loadingManager = new THREE.LoadingManager();
    loadingManager.onProgress = (_url, loaded, total) => {
      if (cancelled || total <= 0) return;
      setAvatarLoadProgress(loaded / total);
    };

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

    // Make the canvas fill the container exactly so it never overflows (which
    // would clip the top of the avatar under the parent's overflow-hidden).
    renderer.domElement.style.display = "block";
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.top = "0";
    renderer.domElement.style.left = "0";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

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
    // jawBoneRef.current = null;
    // jawDefaultRotXRef.current = null;
    eyelidBonesRef.current = [];
    lipBonesUpperRef.current = [];
    lipBonesLowerRef.current = [];
    lipDefaultRotXRef.current = new Map();
    mouthTargetRef.current = 0;
    mouthSmoothedRef.current = 0;
    lipDelayedRef.current = 0;
    jawBonesRef.current = [];
    chinBonesRef.current = [];
    jawlineBonesRef.current = [];
    mouthInteriorBonesRef.current = [];
    underChinBonesRef.current = [];
    cheekBindingsRef.current = [];
    cheekBonesRef.current = [];
    faceBoneDefaultsRef.current = new Map();
    const loader = new GLTFLoader(loadingManager);

    loader.load(
      modelUrl,
      (gltf) => {
        if (cancelled) return;
        const model = gltf.scene;
        modelRef.current = model;
        // const model = gltf.scene;
        // modelRef.current = model;
        
        // 👇 ADD THIS (SAFE - DEBUG ONLY)
        (window as any).avatarGltf = gltf;
        (window as any).avatarModel = model;
        (window as any).avatarScene = scene;
        console.group("[Avatar] Morph inventory");

        model.traverse((child: any) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            // Skinned meshes have stale bounding spheres after the model is
            // repositioned/scaled, causing Three.js frustum culling to
            // incorrectly discard them (head and other parts disappear).
            // Disabling frustum culling is the standard fix for GLB avatars.
            child.frustumCulled = false;

            const dict = child.morphTargetDictionary as
              | Record<string, number>
              | undefined;
            const influences = child.morphTargetInfluences as
              | number[]
              | undefined;

            if (dict && influences && influences.length > 0) {
              const entries = Object.entries(dict) as [string, number][];

              console.log(`Mesh: "${child.name}" →`, entries.map(([n]) => n));

              for (const name of Object.keys(dict)) {
                if (isCheekRelatedMorphKeyForLog(name)) {
                  console.log(
                    "[Avatar] Morph key (cheek/smile/nasolabial/puff/squint):",
                    child.name,
                    name
                  );
                }
              }

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

              const cheekCandidates = entries.filter(([name]) =>
                isCheekMorphName(name)
              );
              cheekCandidates.forEach(([name, index]) => {
                cheekBindingsRef.current.push({
                  mesh: child as THREE.Mesh,
                  index,
                  name,
                  initialInfluence: influences[index] ?? 0,
                });
              });
            }
          }

          if ((child as any).isBone) {
            const bone = child as THREE.Bone;
            const boneName = (child.name || "").toLowerCase();
          
            storeFaceBoneDefault(bone, faceBoneDefaultsRef.current);
          
            if (/eyelid|upperlid|lowerlid|lid/.test(boneName)) {
              eyelidDefaultRotXRef.current.set(bone.uuid, bone.rotation.x);
              eyelidDefaultRotYRef.current.set(bone.uuid, bone.rotation.y);
              eyelidDefaultRotZRef.current.set(bone.uuid, bone.rotation.z);
              eyelidDefaultPosYRef.current.set(bone.uuid, bone.position.y);
              eyelidDefaultPosZRef.current.set(bone.uuid, bone.position.z);
              eyelidBonesRef.current.push(bone);
              console.log("[Avatar] Eyelid bone:", child.name);
            }
          
            if (/(upperlip|upper_lip|lipupper|lip_upper|up_lip|uplip)/.test(boneName)) {
              lipDefaultRotXRef.current.set(bone.uuid, bone.rotation.x);
              lipBonesUpperRef.current.push(bone);
              console.log("[Avatar] Upper lip bone:", child.name);
            }
          
            if (/(lowerlip|lower_lip|liplower|lip_lower|low_lip|lowlip)/.test(boneName)) {
              lipDefaultRotXRef.current.set(bone.uuid, bone.rotation.x);
              lipBonesLowerRef.current.push(bone);
              console.log("[Avatar] Lower lip bone:", child.name);
            }
          
            if (isJawBoneName(boneName)) {
              jawBonesRef.current.push(bone);
              console.log("[Avatar] Jaw bone:", child.name);
            }
          
            if (isChinBoneName(boneName)) {
              chinBonesRef.current.push(bone);
              console.log("[Avatar] Chin bone:", child.name);
            }
          
            if (isJawlineBoneName(boneName)) {
              jawlineBonesRef.current.push(bone);
              console.log("[Avatar] Jawline bone:", child.name);
            }
          
            if (isMouthInteriorBoneName(boneName)) {
              mouthInteriorBonesRef.current.push(bone);
              console.log("[Avatar] Mouth interior bone:", child.name);
            }
          
            if (isUnderChinBoneName(boneName)) {
              underChinBonesRef.current.push(bone);
              console.log("[Avatar] Under chin bone:", child.name);
            }

            if (isCheekBoneName(boneName)) {
              cheekBonesRef.current.push(bone);
              console.log("[Avatar] Cheek bone (L/R / zygomatic / nasolabial):", child.name);
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
        console.log("[Avatar] jaw bones count:", jawBonesRef.current.length);
        console.log("[Avatar] chin bones count:", chinBonesRef.current.length);
        console.log("[Avatar] jawline bones count:", jawlineBonesRef.current.length);
        console.log("[Avatar] mouth interior bones count:", mouthInteriorBonesRef.current.length);
        console.log("[Avatar] under chin bones count:", underChinBonesRef.current.length);
        console.log(
          "[Avatar] Cheek morph detection — bound targets:",
          cheekBindingsRef.current.map((b) => `${b.mesh.name}:${b.name}`)
        );
        console.log(
          "[Avatar] Cheek bone usage — bones:",
          cheekBonesRef.current.map((b) => b.name)
        );

        // if (
        //   mouthBindingsRef.current.length === 0 &&
        //   jawBoneRef.current === null
        // ) {
        //   console.warn("[Avatar] No mouth morphs or jaw bone found.");
        // }

        if (
          blinkBindingsRef.current.length === 0 &&
          eyelidBonesRef.current.length === 0
        ) {
          console.warn("[Avatar] No blink morphs or eyelid bones found.");
        }

        // Apply export-orientation correction BEFORE framing so the bounding
        // box is computed on the correctly-oriented model.
        if (viewTuning.modelRotationX) model.rotation.x = viewTuning.modelRotationX;
        if (viewTuning.modelRotationY) model.rotation.y = viewTuning.modelRotationY;
        if (viewTuning.modelRotationZ) model.rotation.z = viewTuning.modelRotationZ;

        // Center and frame model
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();

        box.getSize(size);
        box.getCenter(center);

        model.position.sub(center);

        // When showing a portrait (cameraDistanceMultiplier < 1), scale by the
        // model's HEIGHT only — not the widest dimension. This prevents T-pose
        // arm-spans from shrinking the model and pushing the head out of frame.
      
        const scaleDim = size.y; // Always scale by height for portrait framing
        const baseScale = (4.5 / scaleDim) * viewTuning.scaleMultiplier;
        baseScaleRef.current = baseScale;
        model.scale.setScalar(baseScale);
        model.position.y += viewTuning.offsetY;

        scene.add(model);

        const scaledBox = new THREE.Box3().setFromObject(model);
        const scaledSize = new THREE.Vector3();
        const scaledCenter = new THREE.Vector3();

        scaledBox.getSize(scaledSize);
        scaledBox.getCenter(scaledCenter);

        // Try to find the head bone so the camera looks exactly at the face
        // instead of relying on a guessed fraction of model height.
        let headBone: THREE.Object3D | null = null;
        model.traverse((child: THREE.Object3D) => {
          if ((child as any).isBone && !headBone) {
            const n = child.name.toLowerCase();
            if (/\bhead\b/.test(n)) headBone = child;
          }
        });
        // Second pass: looser match if strict "head" wasn't found
        if (!headBone) {
          model.traverse((child: THREE.Object3D) => {
            if ((child as any).isBone && !headBone) {
              const n = child.name.toLowerCase();
              if (n.includes("head") || n.includes("skull") || n.includes("cranium")) {
                headBone = child;
              }
            }
          });
        }

        let lookAtY: number;
        if (headBone) {
          // Get the head bone world position after all transforms are applied
          const headPos = new THREE.Vector3();
          (headBone as THREE.Object3D).updateWorldMatrix(true, false);
          (headBone as THREE.Object3D).getWorldPosition(headPos);
          // Aim slightly above the head-bone pivot (the pivot is typically at
          // the base of the skull; we add 8% of model height to reach the face).
          lookAtY = headPos.y + scaledSize.y * 0.08;
        } else {
          // Fallback: fraction-based estimate
          lookAtY = scaledCenter.y + scaledSize.y * viewTuning.lookAtYOffsetFraction;
        }

        const portraitHeight = scaledSize.y * 0.98;
        const fovRad = (camera.fov * Math.PI) / 180;
        const distance =
          (portraitHeight / 2 / Math.tan(fovRad / 2)) *
          viewTuning.cameraDistanceMultiplier;

        camera.position.set(scaledCenter.x, lookAtY, distance);
        camera.lookAt(new THREE.Vector3(scaledCenter.x, lookAtY, scaledCenter.z));
        camera.updateProjectionMatrix();

        if (!cancelled) {
          setAvatarLoadState("ready");
          setAvatarLoadProgress(1);
        }
        startBlinkLoop();
      },
      undefined,
      (error) => {
        console.error("[Avatar] Failed to load GLB:", error);
        if (!cancelled) setAvatarLoadState("error");
      }
    );

    const handleResize = () => {
      const c = containerRef.current;
      const r = rendererRef.current;
      const cam = cameraRef.current;
      if (!c || !r || !cam) return;

      // Use getBoundingClientRect so we always get the CSS-rendered size,
      // not the canvas pixel size (which can differ after CSS 100% scaling).
      const rect = c.getBoundingClientRect();
      const w = rect.width || c.clientWidth || 800;
      const h = rect.height || c.clientHeight || 600;

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

      const now = performance.now();
      const dt = Math.min(
        0.05,
        Math.max(0.001, (now - lastMouthFrameTimeRef.current) / 1000)
      );
      lastMouthFrameTimeRef.current = now;

      const speaking = isSpeakingRef.current;
      const audioLevelNow = mouthAudioLevelRef.current;

      // Word-boundary mouth envelope: fast open + reliable close.
      mouthPulseRef.current *= 0.9;
      mouthBaseRef.current *= 0.92;
      if (mouthPulseRef.current < 0.001) mouthPulseRef.current = 0;
      if (mouthBaseRef.current < 0.001) mouthBaseRef.current = 0;
      let envelope = mouthBaseRef.current + mouthPulseRef.current;
      if (speaking) {
        envelope += (Math.random() - 0.5) * 0.01;
      }
      mouthTargetRef.current = envelope;

      const target = THREE.MathUtils.clamp(mouthTargetRef.current, 0, 1.08);
      const openLambda = 20;
      const closeLambda = 11;
      const lambda =
        target > mouthSmoothedRef.current ? openLambda : closeLambda;
      mouthSmoothedRef.current = THREE.MathUtils.damp(
        mouthSmoothedRef.current,
        target,
        lambda,
        dt
      );

      const mouthViseme = THREE.MathUtils.clamp(mouthSmoothedRef.current, 0, 1.28);
      // Tuned for both mic (~20–120) and boosted TTS RMS (~25–200): same divisor family.
      const audioNorm = speaking
        ? THREE.MathUtils.clamp(audioLevelNow / 360, 0, 1)
        : 0;
      // Viseme timing + live level: audio must lift the jaw when text envelope lags (common in conversation).
      const mouth = Math.max(mouthViseme, speaking ? audioNorm * 0.88 : 0);
      const jawOpen = THREE.MathUtils.clamp(
        mouth * (0.9 + audioNorm * 0.34) + (speaking ? audioNorm * 0.055 : 0),
        0,
        1.22
      );

      lipDelayedRef.current = THREE.MathUtils.damp(
        lipDelayedRef.current,
        Math.max(mouthSmoothedRef.current, speaking ? audioNorm * 0.82 : 0),
        20,
        dt
      );
      const lipFromMic = speaking
        ? THREE.MathUtils.clamp(audioLevelNow / 360, 0, 1)
        : 0;
      const lipFollow = THREE.MathUtils.clamp(
        lipDelayedRef.current * 0.58 + lipFromMic * 0.58,
        0,
        1.22
      );

      const mdm = mouthDriveMultRef.current;
      const mouthAdj = THREE.MathUtils.clamp(mouth * mdm, 0, 1.35);
      const jawOpenAdj = THREE.MathUtils.clamp(jawOpen * mdm, 0, 1.35);
      const lipFollowAdj = THREE.MathUtils.clamp(lipFollow * mdm, 0, 1.35);

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

          if (isCheekMorphName(name)) {
            return;
          }

          const isUpperLipMorph =
            (lower.includes("upper") &&
              (lower.includes("lip") || lower.includes("lips"))) ||
            lower.includes("upperlip") ||
            lower.includes("lip_upper") ||
            lower.includes("uplip");
          const isLowerLipMorph =
            (lower.includes("lower") &&
              (lower.includes("lip") || lower.includes("lips"))) ||
            lower.includes("lowerlip") ||
            lower.includes("lip_lower") ||
            lower.includes("lowlip");

          let strength = mouthAdj;
          if (
            lower.includes("jaw") ||
            lower.includes("open") ||
            lower.includes("mouth") ||
            lower.includes("teeth") ||
            lower.includes("tooth")
          ) {
            if (isUpperLipMorph) {
              strength = jawOpenAdj * (1 - lipFollowAdj * 0.42);
            } else if (isLowerLipMorph) {
              strength = lipFollowAdj;
            } else if (
              lower.includes("teeth") ||
              lower.includes("tooth") ||
              lower.includes("jaw") ||
              lower.includes("open")
            ) {
              strength = jawOpenAdj;
            } else {
              strength = jawOpenAdj * 0.9;
            }
          } else if (lower.includes("aa") || lower.includes("ah") || lower.includes("oh")) {
            strength = jawOpenAdj * 0.88;
          } else if (lower.includes("ee") || lower.includes("ih")) {
            strength = jawOpenAdj * 0.65;
          } else if (lower.includes("uh")) {
            strength = jawOpenAdj * 0.75;
          } else {
            strength = mouthAdj * 0.78;
          }

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
              ? JAW_GAIN * 1.12
              : JAW_GAIN
            : isGenericMouth
            ? MOUTH_GAIN
            : isRiskyLipShape
            ? OTHER_MOUTH_GAIN * 0.35
            : OTHER_MOUTH_GAIN;
          const max = isOpenTarget
            ? isTeethLike
              ? JAW_MAX * 1.42
              : JAW_MAX
            : isGenericMouth
            ? MOUTH_MAX
            : isRiskyLipShape
            ? OTHER_MOUTH_MAX * 0.45
            : OTHER_MOUTH_MAX;

          influences[index] = THREE.MathUtils.clamp(shaped * gain, 0, max);
        });
      }

      const ampNorm = THREE.MathUtils.clamp(audioLevelNow / 420, 0, 1);
      const cheekDriver = THREE.MathUtils.lerp(
        0.1,
        0.55,
        THREE.MathUtils.clamp(
          Math.pow(THREE.MathUtils.clamp(jawOpenAdj, 0, 1), 1.05) * 0.55 +
            ampNorm * 0.45,
          0,
          1
        )
      );

      if (cheekBindingsRef.current.length > 0) {
        cheekBindingsRef.current.forEach(
          ({ mesh, index, name, initialInfluence }) => {
            const influences = mesh.morphTargetInfluences;
            if (!influences || index >= influences.length) return;
            const lower = name.toLowerCase();
            let k = 0.85;
            if (lower.includes("puff") || lower.includes("cheek")) k = 1;
            if (lower.includes("nasolabial")) k = 0.72;
            if (lower.includes("smile")) k = 0.78;
            influences[index] = THREE.MathUtils.clamp(
              initialInfluence + cheekDriver * k * 0.95,
              0,
              0.42
            );
          }
        );
      }

      // Cheeks: strong enough pitch to read on camera; small lateral Y/Z for puff (kept < ~0.12 rad).
      cheekBonesRef.current.forEach((bone) => {
        if (!isPrimaryCheekBoneName(bone.name)) return;
        const d = faceBoneDefaultsRef.current.get(bone.uuid);
        if (!d) return;
        const c = cheekDriver;
        const bn = (bone.name || "").toLowerCase();
        const pitch = c * 0.26;
        const side =
          /facial_l_|_l_|^l_|left/.test(bn) && !/facial_r_|_r_|right/.test(bn)
            ? 1
            : /facial_r_|_r_|^r_|right/.test(bn)
              ? -1
              : 0;
        const yawIn = side !== 0 ? side * c * 0.1 : c * 0.04;
        const roll = side !== 0 ? side * c * 0.07 : 0;
        bone.rotation.x = d.x + pitch;
        bone.rotation.y = d.y + yawIn;
        bone.rotation.z = d.z + roll;
      });

      // Bone-driven mouth (T1.glb: no morphs — bones only)
      const mouthForJaw = Math.pow(
        THREE.MathUtils.clamp(jawOpenAdj, 0, 1),
        1.04
      );
      const mouthForLips = Math.pow(
        THREE.MathUtils.clamp(lipFollowAdj, 0, 1),
        0.93
      );

      const applyFaceBoneX = (bone: THREE.Bone, delta: number) => {
        const d = faceBoneDefaultsRef.current.get(bone.uuid);
        if (!d) return;
        bone.rotation.x = d.x + delta;
      };

      jawBonesRef.current.forEach((bone) => {
        if (!isMainMandibleBoneName(bone.name)) return;
        applyFaceBoneX(bone, mouthForJaw * 0.26);
      });

      lipBonesUpperRef.current.forEach((bone) => {
        const center = isCenterLipBoneName(bone.name);
        const mult = center ? 0.115 : 0.038;
        applyFaceBoneX(bone, -mouthForLips * mult);
      });

      lipBonesLowerRef.current.forEach((bone) => {
        const center = isCenterLipBoneName(bone.name);
        const mult = center ? 0.145 : 0.046;
        applyFaceBoneX(bone, mouthForLips * mult);
      });

      chinBonesRef.current.forEach((bone) => {
        if (!isPrimaryChinBoneName(bone.name)) return;
        const n = (bone.name || "").toLowerCase();
        const main = n === "facial_c_chin" || n === "facial_c_chin1";
        applyFaceBoneX(bone, mouthForJaw * (main ? 0.06 : 0.032));
      });

      jawlineBonesRef.current.forEach((bone) => {
        applyFaceBoneX(bone, mouthForJaw * 0.028);
      });

      mouthInteriorBonesRef.current.forEach((bone) => {
        applyFaceBoneX(bone, mouthForJaw * 0.022);
      });

      underChinBonesRef.current.forEach((bone) => {
        applyFaceBoneX(bone, mouthForJaw * 0.022);
      });

      if (model) {
        model.scale.setScalar(baseScaleRef.current);
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
        const defaultY = eyelidDefaultRotYRef.current.get(bone.uuid) ?? 0;
        bone.rotation.x = defaultX;
        bone.rotation.y = defaultY;
        const defaultZ = eyelidDefaultRotZRef.current.get(bone.uuid);
        if (typeof defaultZ === "number") bone.rotation.z = defaultZ;
        const defaultPosY = eyelidDefaultPosYRef.current.get(bone.uuid);
        if (typeof defaultPosY === "number") bone.position.y = defaultPosY;
        const defaultPosZ = eyelidDefaultPosZRef.current.get(bone.uuid);
        if (typeof defaultPosZ === "number") bone.position.z = defaultPosZ;
      });
    }

    function animateBlink(duration = 320, onDone?: () => void) {
      const start = performance.now();

      const tick = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        // Smooth blink (no hard "hold" plateau).
        const smoothstep = (x: number) => x * x * (3 - 2 * x);
        const tri = t < 0.5 ? t * 2 : (1 - t) * 2; // 0..1..0
        const blinkValue = smoothstep(tri);

        // Use BOTH when possible:
        // - If eyelid bones are weighted, they give smooth motion.
        // - If bones are present but not weighted (common), morph blink still works.
        const useBoneBlink = eyelidBonesRef.current.length > 0;
        const useMorphBlink = blinkBindingsRef.current.length > 0;

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
          const maxBlink =
            lower === "eyes"
              ? 0.38
              : isRiskyEyes
              ? 0.22
              : 0.88;
          influences[index] = useMorphBlink
            ? initialInfluence + blinkValue * maxBlink
            : initialInfluence;
        }
        );

        eyelidBonesRef.current.forEach((bone) => {
          const defaultX = eyelidDefaultRotXRef.current.get(bone.uuid) ?? 0;
          const defaultY = eyelidDefaultRotYRef.current.get(bone.uuid) ?? 0;
          const defaultZ = eyelidDefaultRotZRef.current.get(bone.uuid) ?? 0;
          const defaultPosY = eyelidDefaultPosYRef.current.get(bone.uuid) ?? bone.position.y;
          const defaultPosZ = eyelidDefaultPosZRef.current.get(bone.uuid) ?? bone.position.z;
          if (!useBoneBlink) {
            bone.rotation.x = defaultX;
            bone.rotation.y = defaultY;
            bone.rotation.z = defaultZ;
            bone.position.y = defaultPosY;
            bone.position.z = defaultPosZ;
            return;
          }

          // Upper eyelid closes by rotating down; lower eyelid closes by rotating up (opposite X).
          const boneScale = useMorphBlink ? 0.55 : 1;
          const magnitude = 0.48 * boneScale * blinkValue;
          const upper = isUpperEyelidBoneName(bone.name);
          const lower = isLowerEyelidBoneName(bone.name);
          let deltaX = 0;
          // Local X sign is rig-dependent; flipped so blink closes instead of opening wider.
          if (upper && !lower) {
            deltaX = +magnitude; // upper lid moves down toward closed
          } else if (lower && !upper) {
            deltaX = -magnitude; // lower lid moves up toward closed
          } else {
            deltaX = +magnitude; // generic "lid" / ambiguous → treat as upper
          }
          bone.rotation.x = defaultX + deltaX;
          bone.rotation.y = defaultY;
          bone.rotation.z = defaultZ;
          bone.position.y = defaultPosY;
          bone.position.z = defaultPosZ;

          bone.updateMatrixWorld(true);
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

      // Slow down + avoid back-to-back blinks (no "double blink" bursts).
      const delay = 2200 + Math.random() * 3200;
      blinkTimeoutRef.current = window.setTimeout(() => {
        const hasBlinkTargets =
          blinkBindingsRef.current.length > 0 || eyelidBonesRef.current.length > 0;

        if (!hasBlinkTargets) {
          scheduleNextBlink();
          return;
        }

        const blinkDuration = 300 + Math.random() * 200;
        animateBlink(blinkDuration, scheduleNextBlink);
      }, delay);
    }

    function startBlinkLoop() {
      if (blinkTimeoutRef.current) {
        clearTimeout(blinkTimeoutRef.current);
      }
      // Trigger one blink immediately so we can verify eyelid bones affect the mesh.
      animateBlink(340, scheduleNextBlink);
    }

    return () => {
      cancelled = true;
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
  }, [modelUrl, viewTuning]);

  useEffect(() => {
    if (!isSpeaking) {
      mouthTargetRef.current = 0;
      mouthBaseRef.current = 0;
      mouthPulseRef.current = 0;
      lastBoundaryAtRef.current = 0;
      return;
    }

    // Boundary-driven talk cycle: balance visible motion vs. “stuck wide open”.
    const openness = getSpeechOpennessAt(speechText, speechCharIndex);
    mouthBaseRef.current = Math.max(
      mouthBaseRef.current,
      openness * 0.095 + 0.028
    );
    mouthPulseRef.current = Math.max(
      mouthPulseRef.current,
      openness * 0.72 + 0.1
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
        Math.max(0, Math.sin(elapsed * 7.2)) * 0.065 +
        Math.max(0, Math.sin(elapsed * 11.9 + 0.5)) * 0.038 +
        THREE.MathUtils.clamp(audioLevel / 300, 0, 0.038);
      mouthBaseRef.current = Math.max(mouthBaseRef.current, fallback);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isSpeaking, audioLevel, speechText, speechCharIndex]);
  return (
    <div className="relative w-full h-full">
      {avatarLoadState === "loading" && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl bg-gradient-to-b from-slate-900/95 to-purple-950/90 px-6 text-center"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-10 w-10 shrink-0 animate-spin text-purple-300" />
          <p className="text-sm font-medium text-white">Loading avatar…</p>
          {avatarLoadProgress !== null && avatarLoadProgress < 1 && (
            <p className="text-xs text-white/70">
              {Math.round(avatarLoadProgress * 100)}%
            </p>
          )}
          <p className="max-w-sm text-xs text-white/50">
            The model file is large; first visit may take a while on slower
            networks.
          </p>
        </div>
      )}
      {avatarLoadState === "error" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-2xl bg-slate-900/90 px-6 text-center">
          <p className="text-sm text-white">Could not load avatar.</p>
          <p className="text-xs text-white/60">
            Refresh the page or try again on a stronger connection.
          </p>
        </div>
      )}
      {/* position: relative so the absolute canvas stays clipped to this box */}
      <div
        ref={containerRef}
        className={`relative h-full w-full ${
          avatarLoadState !== "ready" ? "opacity-0" : "opacity-100"
        }`}
      />
    </div>
  );
}

export default ThreeAvatar;
// ─────────────────────────────────────────────────────────────────────────────
// ActiveSession component  (unchanged from original except imports above)
// ─────────────────────────────────────────────────────────────────────────────
export function ActiveSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refreshProfile, session } = useAuth();
  const { sessionId: stateSessionId, duration, config } = location.state || {};

  const companionAvatarLabel =
    typeof config?.avatar === "string" ? config.avatar : undefined;

  const sessionUsesCompanion3d = useMemo(
    () => companionSessionUses3dModel(companionAvatarLabel),
    [companionAvatarLabel]
  );

  const companionModelUrl = useMemo(
    () => resolveCompanionModelUrl(companionAvatarLabel),
    [companionAvatarLabel]
  );

  const companionPortraitUrl = useMemo(
    () => resolveCompanionPortraitUrl(companionAvatarLabel),
    [companionAvatarLabel]
  );

  const companionViewTuning = useMemo(
    () => getCompanionViewTuning(companionAvatarLabel),
    [companionAvatarLabel]
  );

  /** Same id as WebSocket `voice=` — must be sent on REST speak/chat too or TTS often defaults to one (female) voice. */
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
      // Don’t crash the whole session UI if env is missing; surface actionable error.
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

  const requestMediaAccess = useCallback(async () => {
    type DOMErr = { name?: string; message?: string; constraint?: string };

    // ── Step 1: microphone (required) ───────────────────────────────────────
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
      console.error("MEDIA ACCESS FAILED — microphone", {
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
      // microphone is required — keep modal open
      return;
    }

    // ── Step 2: camera (optional — voice-only fallback on any hardware error) ─
    let videoStream: MediaStream | null = null;
    try {
      videoStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
    } catch (err: unknown) {
      const e = err as DOMErr;
      console.error("MEDIA ACCESS FAILED — camera", {
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
      // videoStream stays null — session continues in voice-only mode
    }

    // ── Step 3: combine tracks and attach ───────────────────────────────────
    const tracks = [
      ...audioStream.getAudioTracks(),
      ...(videoStream ? videoStream.getVideoTracks() : []),
    ];
    const combinedStream = new MediaStream(tracks);

    setStream(combinedStream);
    if (videoRef.current) videoRef.current.srcObject = combinedStream;
    setPermissionsGranted(true);
    setShowPermissionRequest(false);

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
  /** User PiP position (px from right / bottom); default matches previous Tailwind right-10 bottom-28. */
  const [pipPos, setPipPos] = useState({ right: 40, bottom: 112 });
  const pipDragRef = useRef<{
    id: number;
    sx: number;
    sy: number;
    sr: number;
    sb: number;
  } | null>(null);
  const PIP_W = 256;
  const pipClamp = (n: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, n));
  const handlePipPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      pipDragRef.current = {
        id: e.pointerId,
        sx: e.clientX,
        sy: e.clientY,
        sr: pipPos.right,
        sb: pipPos.bottom,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [pipPos.right, pipPos.bottom]
  );
  const handlePipPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = pipDragRef.current;
      if (!d || e.pointerId !== d.id) return;
      const margin = 8;
      const reserveBottom = 120;
      const maxRight = window.innerWidth - PIP_W - margin;
      const maxBottom = window.innerHeight - reserveBottom - margin;
      const deltaX = e.clientX - d.sx;
      const deltaY = e.clientY - d.sy;
      setPipPos({
        right: pipClamp(d.sr - deltaX, margin, maxRight),
        bottom: pipClamp(d.sb - deltaY, margin, maxBottom),
      });
    },
    []
  );
  const handlePipPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = pipDragRef.current;
      if (!d || e.pointerId !== d.id) return;
      pipDragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    []
  );
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
  const isEzriSpeakingRef = useRef(false);
  /** Single source for ThreeAvatar RMS: updated every RAF (TTS tap or mic), never React state. */
  const mouthAudioLevelRef = useRef(0);
  /** WS TTS queue (declared early for sound-off / stop handlers). */
  const wsAudioQueueRef = useRef<{ subtitle: string; audio: unknown }[]>([]);
  const wsIsPlaybackActiveRef = useRef(false);
  /** True after backend `step:speaking` until `tts_done` (Ezri Avatar / app.js parity). Used to detect idle server interrupts. */
  const wsTtsStreamingRef = useRef(false);
  const lastBargeInAtRef = useRef(0);
  /** After barge-in, don't treat overlap with the last assistant line as Ezri echo (common follow-ups share words). */
  const bargeInEchoGraceUntilRef = useRef(0);

  /** True while Solace may still be streaming or playing TTS (covers gaps between WS audio chunks). */
  const ezriWsAudioPipelineActive = (): boolean =>
    isEzriSpeakingRef.current ||
    wsTtsStreamingRef.current ||
    wsIsPlaybackActiveRef.current ||
    wsAudioQueueRef.current.length > 0;

  const transcriptRef = useRef<
    { role: string; content: string; timestamp: number }[]
  >([]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

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
  const [liveUserSpeech, setLiveUserSpeech] = useState("");
  const subtitleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaRecorderActiveRef = useRef(false);
  const serverSttToastShownRef = useRef(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const lastSpeechStartRef = useRef(0);
  const isRecognitionActiveRef = useRef(false);
  const isSessionEndingRef = useRef(false);
  /** Throttle sonner toasts — same id + rapid updates can trigger "Maximum update depth exceeded". */
  const lastInterimToastAtRef = useRef(0);
  const lastInterimTextRef = useRef("");
  /** Watchdog should not depend on `audioLevel` (updates every animation frame). */
  const audioLevelForWatchdogRef = useRef(0);
  const lastSilentMicWarnAtRef = useRef(0);

  useEffect(() => {
    audioLevelForWatchdogRef.current = audioLevel;
  }, [audioLevel]);

  const [speechPulse, setSpeechPulse] = useState(0);
  const [speechText, setSpeechText] = useState("");
  const [speechCharIndex, setSpeechCharIndex] = useState(0);
  /** RMS-ish level from Ezri TTS `<audio>` (mic is quiet while she speaks — must not drive lip sync). */
  const [ezriPlaybackLevel, setEzriPlaybackLevel] = useState(0);
  const playbackAudioContextRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false);
  const ttsAnalyserRafRef = useRef<number | null>(null);
  const ezriPlaybackSmoothRef = useRef(0);
  const ttsMouthTapOkRef = useRef(false);
  /** Text of the clip currently playing (for echo filter; state alone lags behind STT). */
  const ezriPlaybackTextRef = useRef<string>("");
  const suppressSttRef = useRef(false);
  const lastPlaybackDoneAtRef = useRef(0);
  const playbackDoneCooldownTimerRef = useRef<number | null>(null);
  /** Bumped on interrupt/pause — invalidates awaited work inside `playEzriAudio`. */
  const audioPlaySeqRef = useRef<number>(0);
  // Tracks the in-flight REST request so it can be aborted on interruption.
  const restAbortControllerRef = useRef<AbortController | null>(null);
  // When true, ALL incoming WS audio/text from the server is dropped.
  // Set to true on interrupt, cleared only when a new user message is actually sent.
  // This is the ONLY reliable way to ignore late audio chunks that the server
  // buffered before it processed our interrupt signal.
  const suppressIncomingAudioRef = useRef(false);
  // Ref mirror of isEzriThinking state — safe to read inside STT callbacks and
  // async functions without stale closure issues.
  const isEzriThinkingRef = useRef(false);
  // Text of the most recent message sent to the backend that has NOT yet produced
  // any audio response. Used to merge follow-up user speech during the silence gap.
  const pendingUserTextRef = useRef<string>("");
  // How many old in-flight server responses to silently drop before playing the
  // next one. Incremented each time a merge fires so that only the LATEST merged
  // message's response is played. Decremented on each tts_done / server interrupt.
  const dropOldResponsesRef = useRef(0);

  // True for iOS / Android where keeping recognition alive during TTS playback
  // triggers hardware audio-capture errors that permanently break the recognizer.
  // On desktop Chrome/Firefox/Edge, recognition can safely run while audio plays.
  const isMobileBrowser = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const pauseStt = () => {
    // Mobile: abort mic + suppress onend auto-restart — concurrent capture + playback breaks many devices.
    // Desktop: MUST NOT set suppressSttRef. While true, recognition.onend bails without restarting;
    // sessions often end mid–TTS (timeouts), leaving no mic until resumeStt() — users lose the first
    // words right after interrupt. Desktop keeps streaming; overlap with Ezri audio is gated by
    // ezriWsAudioPipelineActive(), shouldInterruptForSpeech, and shouldIgnoreEchoBargeIn().
    if (isMobileBrowser) {
      suppressSttRef.current = true;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
    }
  };

  /** Pass `delayMs: 0` after barge-in so the mic opens immediately — long delays clip the user's first words. */
  const resumeStt = (delayMs = 150) => {
    suppressSttRef.current = false;
    // Short delay to let speaker echo decay after normal TTS (not needed right after client barge-in).
    window.setTimeout(() => {
      if (
        !permissionsGranted ||
        isSessionEndingRef.current ||
        isSessionPausedRef.current ||
        isMutedRef.current ||
        isEzriSpeakingRef.current
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
        // start() threw — recognizer is in a bad state. Force a full effect reinit.
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

    // Drop any in-flight playEzriAudio (await normalizeSource / await play) — otherwise a chunk
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
    const now = Date.now();
    // 2000ms debounce: server echo interrupt can call this twice; avoids duplicate playback_done.
    // Client-initiated interrupts pass bypassPlaybackDoneDebounce — otherwise the ACK is skipped,
    // the server stays “bot speaking”, and STT/backend VAD never accepts user audio.
    if (
      !opts?.bypassPlaybackDoneDebounce &&
      now - lastPlaybackDoneAtRef.current < 2000
    ) {
      // Still reopen local STT — skipping only the duplicate playback_done send.
      resumeStt();
      return;
    }
    lastPlaybackDoneAtRef.current = now;

    // Default 1500ms is for server-initiated interrupts (echo from physical speakers needs ~800-1200ms to decay).
    // Client-initiated interrupts pass a shorter value since the browser's AEC already removes speaker echo.
    const delay = opts?.cooldownMs ?? 1500;
    playbackDoneCooldownTimerRef.current = window.setTimeout(() => {
      playbackDoneCooldownTimerRef.current = null;
      try {
        wsClientRef.current?.sendPlaybackDone();
      } catch {}
      resumeStt();
    }, delay);
  };

  const stopAudioAndSpeechDriver = () => {
    if (ttsAnalyserRafRef.current) {
      cancelAnimationFrame(ttsAnalyserRafRef.current);
      ttsAnalyserRafRef.current = null;
    }
    ezriPlaybackSmoothRef.current = 0;
    ttsMouthTapOkRef.current = false;
    mouthAudioLevelRef.current = 0;
    setEzriPlaybackLevel(0);
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
      } catch {}
      audioRef.current = null;
    }
    if (audioUrlRevokeRef.current) {
      try {
        audioUrlRevokeRef.current();
      } catch {}
      audioUrlRevokeRef.current = null;
    }
    setIsEzriSpeaking(false);
    isEzriSpeakingRef.current = false;
    ezriPlaybackTextRef.current = "";
    setSpeechText("");
    setSpeechCharIndex(0);
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
      setSpeechCharIndex(idx);
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
          setSpeechPulse((v) => v + 1);
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
    }
  ) => {
    if (typeof window === "undefined") return;
    if (isSoundOffRef.current) {
      opts?.onDone?.();
      return;
    }

    audioPlaySeqRef.current += 1;
    const seq = audioPlaySeqRef.current;

    stopAudioAndSpeechDriver();
    ezriPlaybackTextRef.current = text;
    setSpeechText(text);
    setSpeechCharIndex(0);
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

    // Drive jaw/lips from Ezri’s **amplitude** (RMS). Raw FFT averages are too low for speech vs mic.
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
        // Map to a similar scale as the mic bar (typical 20–120); TTS RMS often 0.02–0.2.
        const instant = Math.min(240, 22 + rms * 980);
        ezriPlaybackSmoothRef.current +=
          (instant - ezriPlaybackSmoothRef.current) * 0.5;
        mouthAudioLevelRef.current = ezriPlaybackSmoothRef.current;
        setEzriPlaybackLevel(ezriPlaybackSmoothRef.current);
        ttsAnalyserRafRef.current = requestAnimationFrame(tick);
      };
      ttsAnalyserRafRef.current = requestAnimationFrame(tick);
      ttsMouthTapOkRef.current = true;
    } catch (e) {
      ttsMouthTapOkRef.current = false;
      console.warn("[Avatar] TTS playback analyser failed; mouth uses text timing only.", e);
    }

    audio.onloadedmetadata = () => {
      if (seq !== audioPlaySeqRef.current) return;
      const ms = Number.isFinite(audio.duration) ? Math.max(800, audio.duration * 1000) : 3500;
      driveSpeechAnimationForText(text, ms);
    };

    audio.onended = () => {
      if (seq !== audioPlaySeqRef.current) return;
      stopAudioAndSpeechDriver();
      maybeResumeMicAfterEzriPlayback(opts?.partOfWsStreamingTurn);
      setSpeechPulse((v) => v + 1);
      // Do NOT call recognition.start() here.
      // Recognition auto-restart is handled centrally by recognition.onend.
      opts?.onDone?.();
    };

    audio.onerror = () => {
      if (seq !== audioPlaySeqRef.current) return;
      // If we cleared src as part of an intentional stop, ignore.
      if (!audio.src) return;
      const me = audio.error;
      const sniffedMime = audio.src.startsWith("blob:")
        ? "(blob — check normalizeAudioSource)"
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
      opts?.onError?.();
      opts?.onDone?.();
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
      await audio.play();
    } catch (e: any) {
      if (seq !== audioPlaySeqRef.current) return;
      if (e?.name === "AbortError") return;
      const sniffedMime = audio.src.startsWith("blob:")
        ? "(blob — check normalizeAudioSource)"
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
      opts?.onError?.();
      opts?.onDone?.();
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
      opts?.onDone?.();
    }
  };

  const speakViaEzriTts = async (text: string) => {
    if (!ezriApi || !ezriConfig) return;
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
        // Audio decoded but browser could not play it — retry with explicit mp3.
        console.warn("[TTS] Primary playback failed — retrying with mp3 format.");
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

  const appendAssistantFinal = (text: string) => {
    if (!text.trim()) return;
    setTranscript((prev) => [
      ...prev,
      { role: "assistant", content: text, timestamp: Date.now() },
    ]);
  };

  const requestBargeInInterrupt = (source: string) => {
    const now = Date.now();
    // speech_final may arrive shortly after speech_interim; still treat as one user action.
    if (now - lastBargeInAtRef.current < 400 && source !== "speech_final") {
      return;
    }
    lastBargeInAtRef.current = now;
    bargeInEchoGraceUntilRef.current = now + 8000;

    // ── Step 1: Suppress ALL incoming WS audio/text until the new user
    // message is sent. This is the only reliable way to discard late audio
    // chunks the server buffered before it processed our interrupt signal.
    suppressIncomingAudioRef.current = true;

    // ── Step 2: Invalidate active turn bookkeeping.
    wsActiveTurnRef.current += 1;
    wsAudioSeenTurnRef.current = 0;
    wsAssistantBufferRef.current = "";
    wsLastFinalTextRef.current = "";
    wsPendingFallbackTextRef.current = "";

    // ── Step 3: Abort any in-flight REST (LLM + TTS) request immediately.
    if (restAbortControllerRef.current) {
      restAbortControllerRef.current.abort();
      restAbortControllerRef.current = null;
    }

    // ── Step 4: Stop audio and clear queue (local only — no delayed WS ACK yet).
    stopPlaybackAndCooldown({ sendPlaybackDone: false });

    // Many backends expect interrupt first (cancel synthesis), then playback_done ACK.
    const ws = wsClientRef.current;
    if (ws && ws.getStatus() === "connected") {
      ws.sendInterrupt(source);
    }
    if (ws && ws.getStatus() === "connected") {
      const ok = ws.sendPlaybackDone();
      if (ok) lastPlaybackDoneAtRef.current = Date.now();
    }

    suppressSttRef.current = false;
    const SpeechRecognitionCtor =
      typeof window !== "undefined" &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

    // Desktop: NEVER recreate SpeechRecognition here — teardown costs ~300–800ms and drops the user's
    // first words right after interrupt. Mobile: pauseStt() aborted during TTS; full recreate only on the
    // final segment (when utterance bookkeeping is coherent). Interim/teardown-before-final is avoided elsewhere.
    const shouldRecreateSttAfterBargeIn =
      !!SpeechRecognitionCtor && isMobileBrowser && source === "speech_final";

    if (!SpeechRecognitionCtor) {
      // MediaRecorder/server STT path — no SpeechRecognition instance to restart.
    } else if (shouldRecreateSttAfterBargeIn) {
      isRecognitionActiveRef.current = false;
      setIsListening(false);
      setSttRestartTrigger((t) => t + 1);
    } else {
      resumeStt(0);
    }

    // ── Safety net 1: on mobile (where pauseStt aborts recognition), verify STT
    // actually restarted. Chrome can silently swallow start() on a recently-aborted
    // recognizer with no onstart, no onerror — just silence. Force a clean reinit
    // if still inactive after 600ms.
    window.setTimeout(() => {
      if (
        !suppressSttRef.current &&
        !isEzriSpeakingRef.current &&
        !isSessionEndingRef.current &&
        permissionsGranted &&
        !isRecognitionActiveRef.current
      ) {
        console.warn("[Interrupt] STT did not start after barge-in — forcing fresh reinit.");
        recognitionRef.current = null;
        isRecognitionActiveRef.current = false;
        setSttRestartTrigger((t) => t + 1);
      }
    }, 600);

    // ── Safety net 2: suppressIncomingAudio is cleared by handleUserText(). If
    // STT never captures the user's post-interrupt words, it stays true forever
    // and all future Ezri audio is silently blocked. Auto-release after 20s.
    window.setTimeout(() => {
      if (suppressIncomingAudioRef.current) {
        console.warn("[Interrupt] suppressIncomingAudio still set after 20s — auto-releasing.");
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
    if (shouldIgnoreEchoBargeIn(candidate)) return false;

    const words = candidate.split(" ").filter(Boolean);

    // No micLevel gate: Chrome's AEC suppresses the mic signal while the speaker
    // is playing, so audioLevel is near-zero even when the user speaks clearly.
    // SpeechRecognition uses its own internal VAD — if it fires, the user spoke.
    // shouldIgnoreEchoBargeIn() is the echo protection layer.

    // Interim: need 2+ words to avoid single-word fragments misfiring.
    if (!isFinal) {
      return words.length >= 2 && candidate.length >= 6;
    }

    // Final: even a single clear word (≥4 chars) is a valid barge-in signal.
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

    // ── Silence-gap merge ────────────────────────────────────────────────────
    // If the backend is still processing the previous message (thinking, not yet
    // speaking), cancel that request and re-send both texts as a single message.
    // This covers the pattern: user speaks → silence → user speaks again before
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
      // We do NOT touch suppressIncomingAudioRef here — that ref is only for
      // the barge-in path. The WS path in handleUserText will lift it normally
      // for the merged message, so the merged response flows through freely.
      dropOldResponsesRef.current += 1;

      // Reset thinking state so the recursive call proceeds cleanly.
      setIsEzriThinking(false);
      isEzriThinkingRef.current = false;
      pendingUserTextRef.current = "";

      console.log(`[merge] Combining "${prev}" + "${trimmed}" → "${merged}" (drop=${dropOldResponsesRef.current})`);
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
              notes: `Auto-detected in active session (${analysis.suggestedState})`,
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
    } catch {}

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
        throw new Error("Ezri is not configured (missing env).");
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
      // AbortError is expected when interrupted — don't show an error toast.
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
      // Updating React state on every animation frame forces the entire
      // ActiveSession tree to re-render ~60fps. We only need UI-level metering,
      // so throttle state updates while keeping the mouth driver ref “live”.
      let lastUiUpdateAt = 0;
      let lastUiLevel = 0;

      const updateAudioLevel = () => {
        if (audioContext.state === "suspended") audioContext.resume();
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        const level = sum / bufferLength;
        if (!isEzriSpeakingRef.current) mouthAudioLevelRef.current = level;

        const now = performance.now();
        // ~15fps max, plus a small threshold to avoid micro-updates.
        if (now - lastUiUpdateAt > 66 || Math.abs(level - lastUiLevel) > 2) {
          lastUiUpdateAt = now;
          lastUiLevel = level;
          setAudioLevel(level);
        }
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
      setIsListening(true);
      isRecognitionActiveRef.current = true;
      toast.info("Microphone Active");
    };

    recognition.onsoundstart = () => {
      console.log("SpeechRecognition: Sound detected");
      // Do not interrupt on raw sound alone — speaker echo can trigger this.
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

        // While TTS plays (including between WS chunks — isEzriSpeaking can flicker false), only
        // treat speech as barge-in through the echo filters below.
        if (ezriWsAudioPipelineActive()) {
          if (shouldInterruptForSpeech(trimmed, isFinal)) {
            requestBargeInInterrupt(isFinal ? "speech_final" : "speech_interim");
            if (!isFinal) {
              return;
            }
            const dropAsEzriEchoDup =
              Date.now() < bargeInEchoGraceUntilRef.current
                ? false
                : shouldIgnoreEchoBargeIn(trimmed);
            if (dropAsEzriEchoDup) {
              return;
            }
            // Final transcript after real interrupt — fall through to user handling.
          } else {
            return;
          }
        }

        if (!isFinal) {
          console.log("Interim:", trimmed);
          if (ezriWsAudioPipelineActive()) {
            return;
          }
          // Debounce interim subtitle updates: wait 120ms for recognition to settle
          // before rendering, so rapid per-word rewrites don't cause visible flickering.
          // Only show text that is at least 3 characters (filters out noise like "um").
          if (subtitleDebounceRef.current) clearTimeout(subtitleDebounceRef.current);
          if (trimmed.length >= 3) {
            subtitleDebounceRef.current = setTimeout(() => {
              setLiveUserSpeech(trimmed);
              subtitleDebounceRef.current = null;
            }, 120);
          }
          const now = Date.now();
          if (
            trimmed !== lastInterimTextRef.current ||
            now - lastInterimToastAtRef.current > 450
          ) {
            lastInterimTextRef.current = trimmed;
            lastInterimToastAtRef.current = now;
          }
          return;
        }

        if (subtitleDebounceRef.current) {
          clearTimeout(subtitleDebounceRef.current);
          subtitleDebounceRef.current = null;
        }
        setLiveUserSpeech("");

        // Web Speech often emits a final segment that drops the leading tokens already shown in the
        // last interim — especially after restart / barge-in. Prepend recent interim when safe.
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
        console.log(
          "Heard (Final):",
          lowerTrimmed,
          "Current Step:",
          scriptStepRef.current
        );
        toast.success(`Heard: "${textForUtterance}"`, {
          id: "ezri-speech-final",
          duration: 2000,
        });

        setTranscript((prev) => {
          const lastEntry = prev[prev.length - 1];
          if (
            lastEntry &&
            lastEntry.content === textForUtterance &&
            Date.now() - lastEntry.timestamp < 1000
          ) {
            return prev;
          }
          return [
            ...prev,
            { role: "user", content: textForUtterance, timestamp: Date.now() },
          ];
        });

        if (speechTimeoutRef.current)
          window.clearTimeout(speechTimeoutRef.current);

        // Real Ezri backend integration (WS primary, REST fallback)
        // Special case: user asks to repeat last assistant line
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
      // 'no-speech' and 'aborted' are non-fatal — recognizer fires onend and can restart.
      if (event.error === "no-speech" || event.error === "aborted") {
        sttErrored = false;
      } else {
        // 'audio-capture', 'network', 'not-allowed', 'service-not-allowed' — recognizer broken.
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
        // Fatal error — destroy and recreate the recognizer from scratch.
        console.warn("[STT] Fatal error detected in onend — destroying recognizer, will recreate.");
        recognitionRef.current = null;
        setSttRestartTrigger((t) => t + 1);
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
      } catch (e) {}
      setIsListening(false);
      isRecognitionActiveRef.current = false;
      recognitionRef.current = null;
    };
  }, [permissionsGranted, sttRestartTrigger]);

  // ── Server STT via MediaRecorder (Firefox / non-Chrome fallback) ─────────
  useEffect(() => {
    if (!permissionsGranted) return;
    if (!stream) return;

    // Only activate when the browser does NOT support SpeechRecognition.
    const hasBrowserStt = !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );
    if (hasBrowserStt) return;

    if (typeof MediaRecorder === "undefined") {
      console.error("[STT] MediaRecorder not supported — no STT available in this browser.");
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

    // Priority: webm/opus → ogg/opus → webm (plain) — best Whisper compat across browsers.
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
      setLiveUserSpeech("🎙 Processing...");

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

        // Apply barge-in filtering (covers inter-chunk gaps where isEzriSpeaking is briefly false).
        if (ezriWsAudioPipelineActive()) {
          if (shouldInterruptForSpeech(text, true)) {
            requestBargeInInterrupt("speech_final");
            const dropAsEzriEchoDup =
              Date.now() < bargeInEchoGraceUntilRef.current
                ? false
                : shouldIgnoreEchoBargeIn(text);
            if (dropAsEzriEchoDup) {
              setLiveUserSpeech("");
              return;
            }
            // Fall through — real user barge-in after filtering.
          } else {
            setLiveUserSpeech("");
            return;
          }
        }

        // Deduplicate — server STT can repeat if the same audio is sent twice.
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
      setLiveUserSpeech("🎙 Listening...");
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
        } catch (_) {}
      }
      mediaRecorderRef.current = null;
      mediaRecorderActiveRef.current = false;
      setIsListening(false);
    };
  }, [permissionsGranted, stream]);

  // ── Watchdog ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!permissionsGranted) return;

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
            // Recognizer broken — null it so the trigger forces a full reinit.
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
  }, [permissionsGranted, isListening]);

  // ── Mic-level barge-in (mobile only: STT is aborted during TTS) ─────────
  useEffect(() => {
    if (!permissionsGranted) return;
    if (!isMobileBrowser) return;
    if (isSessionPausedRef.current) return;

    let raf: number | null = null;
    let aboveSince: number | null = null;

    // Desktop: NEVER use mic RMS as a barge-in signal during TTS — speaker bleed into
    // the same MediaStream reliably trips this and fires false interrupts. Barge-in is
    // handled via Web Speech onresult + echo filters only.
    // Mobile: recognition is aborted during TTS; this analyser path is the only barge-in option.
    const THRESH = 22; // slightly less sensitive than before to reduce false triggers
    const HOLD_MS = 180;

    const tick = () => {
      if (isSessionEndingRef.current) return;
      const pipelineActive = ezriWsAudioPipelineActive();
      if (!pipelineActive) {
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

  // ── Media stream cleanup ─────────────────────────────────────────────────
  // Media access is initiated only via requestMediaAccess() on user action.
  // This effect solely handles stopping tracks when the stream is torn down.
  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
  }, [stream]);

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
      } catch {}
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

  const [sessionId] = useState(() => apiSessionId || `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [hasSessionEnded, setHasSessionEnded] = useState(false);

  const ezriUserid = useMemo(() => getOrCreateEzriUserid(user?.id), [user?.id]);
  const ezriApi = useMemo(() => (ezriConfig ? createEzriApiClient(ezriConfig.apiBase) : null), [ezriConfig]);

  const [ezriWsStatus, setEzriWsStatus] = useState<EzriWsStatus>("disconnected");
  const [isEzriThinking, setIsEzriThinking] = useState(false);
  const wsClientRef = useRef<EzriRealtimeClient | null>(null);
  const wsAssistantBufferRef = useRef<string>("");
  const wsLastFinalTextRef = useRef<string>("");
  const wsTtsDoneReceivedRef = useRef(false);
  const wsActiveTurnRef = useRef(0);
  const wsAudioSeenTurnRef = useRef(0);
  const wsSpeakFallbackTimerRef = useRef<number | null>(null);
  const wsPendingFallbackTextRef = useRef<string>("");

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

  // ── Ezri WebSocket (primary realtime) ────────────────────────────────────
  useEffect(() => {
    if (!ezriConfig) return;
    if (hasSessionEnded) return;

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
            appendAssistantFinal(full);
            // Store for potential fallback ONLY if the server never sends audio.
            wsPendingFallbackTextRef.current = full;
          }
          setIsEzriThinking(false);
          isEzriThinkingRef.current = false;
          pendingUserTextRef.current = "";
        },
        onTtsDone: () => {
          // tts_done from an interrupted turn — ignore entirely.
          if (suppressIncomingAudioRef.current) {
            wsTtsDoneReceivedRef.current = false;
            wsTtsStreamingRef.current = false;
            return;
          }
          // This tts_done closes one old response cycle — decrement the drop counter
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

          // If the server claims TTS finished but we never received any audio frames, use REST speak fallback.
          if (wsAudioSeenTurnRef.current !== wsActiveTurnRef.current && wsPendingFallbackTextRef.current.trim()) {
            const t = wsPendingFallbackTextRef.current.trim();
            wsPendingFallbackTextRef.current = "";
            void speakViaEzriTts(t);
          }
          // If audio finished before tts_done arrives, finalize immediately.
          if (!wsIsPlaybackActiveRef.current && wsAudioQueueRef.current.length === 0) {
            try {
              wsClientRef.current?.sendPlaybackDone();
            } catch {}
            wsTtsDoneReceivedRef.current = false;
            // Audio ended before tts_done — onended skipped resumeStt; open mic now.
            resumeStt();
          }
        },
        onSpeakingStart: () => {
          // Always pause local STT as soon as the server commits to TTS (Ezri Avatar app.js parity).
          wsTtsDoneReceivedRef.current = false;
          wsTtsStreamingRef.current = true;
          pauseStt();
          // While discarding a dead turn's audio, don't update thinking/buffer state from stray "speaking" steps.
          if (suppressIncomingAudioRef.current) return;
          setIsEzriThinking(false);
          isEzriThinkingRef.current = false;
        },
        onAvatarData: (data) => {
          // Phonemes + sentiment from backend, emitted before each TTS audio chunk.
          // These arrive with the sentence text and can drive more accurate lip sync.
          // Stored on a ref for the avatar to consume during playback.
          // Not yet wired to the 3D viseme driver — logged for future use.
          if (process.env.NODE_ENV === "development") {
            console.debug("[Ezri] avatar_data:", data.sentence, data.sentiment);
          }
        },
        onInterrupt: () => {
          // If a merge is in progress, the server interrupted the old turn on its
          // own (streaming server behaviour). Clear the drop counter so the merged
          // response is accepted immediately.
          if (dropOldResponsesRef.current > 0) {
            dropOldResponsesRef.current = 0;
          }

          // Ezri Avatar app.js parity: idle interrupt (nothing playing/streaming / queued locally)
          // must not flush server STT buffers with playback_done — only resume listening UI.
          const wasPlayingOrStreaming =
            wsIsPlaybackActiveRef.current ||
            wsAudioQueueRef.current.length > 0 ||
            wsTtsStreamingRef.current;

          setLiveUserSpeech("");
          setIsEzriThinking(false);
          isEzriThinkingRef.current = false;
          pendingUserTextRef.current = "";

          if (!wasPlayingOrStreaming) {
            resumeStt();
            return;
          }

          stopPlaybackAndCooldown({ sendPlaybackDone: true });
        },
        onAudio: (audio) => {
          // Drop audio from the old turn — any chunk arriving while suppressed
          // is a server-buffered leftover that arrived before our interrupt
          // was processed. We only lift suppression when the new user message
          // is actually sent (see handleUserText).
          if (suppressIncomingAudioRef.current) return;
          // Drop audio belonging to old in-flight responses.
          if (dropOldResponsesRef.current > 0) return;

          const buffered = wsAssistantBufferRef.current.trim();
          const subtitle = buffered || wsLastFinalTextRef.current.trim() || "…";
          wsAudioSeenTurnRef.current = wsActiveTurnRef.current;
          wsPendingFallbackTextRef.current = "";
          if (wsSpeakFallbackTimerRef.current) {
            window.clearTimeout(wsSpeakFallbackTimerRef.current);
            wsSpeakFallbackTimerRef.current = null;
          }
          wsAudioQueueRef.current.push({ subtitle, audio });
          const playNext = () => {
            // Drop queued chunk if suppression was re-enabled mid-queue.
            if (suppressIncomingAudioRef.current) {
              wsAudioQueueRef.current = [];
              wsIsPlaybackActiveRef.current = false;
              return;
            }
            if (wsIsPlaybackActiveRef.current) return;
            const next = wsAudioQueueRef.current.shift();
            if (!next) {
              if (wsTtsDoneReceivedRef.current) {
                try {
                  wsClientRef.current?.sendPlaybackDone();
                } catch {}
                wsTtsDoneReceivedRef.current = false;
              }
              return;
            }
            wsIsPlaybackActiveRef.current = true;
            void playEzriAudio(next.subtitle, next.audio, {
              partOfWsStreamingTurn: true,
              onDone: () => {
                wsIsPlaybackActiveRef.current = false;
                playNext();
              },
            });
          };
          playNext();
          setIsEzriThinking(false);
          isEzriThinkingRef.current = false;
          pendingUserTextRef.current = "";
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
  }, [ezriConfig, ezriUserid, sessionId, hasSessionEnded, companionAvatarLabel, ezriTtsVoiceId]);

  // ── WebSocket keep-alive ping (prevents HF Space nginx 60-second idle timeout) ──
  // Sends a lightweight {"type":"ping"} every 30 s. The backend responds with "pong"
  // which the realtimeClient silently discards. Without this, periods of user silence
  // longer than 60 s (common in a therapy session) cause a silent disconnect.
  useEffect(() => {
    if (ezriWsStatus !== "connected") return;
    if (hasSessionEnded || isSessionPaused) return;

    const interval = window.setInterval(() => {
      try {
        wsClientRef.current?.sendPing();
      } catch {}
    }, 30_000);

    return () => window.clearInterval(interval);
  }, [ezriWsStatus, hasSessionEnded, isSessionPaused]);

  // ── PCM audio streaming → WebSocket (backend VAD + Whisper STT) ──────────
  // Only active when stt_provider is NOT "browser". When stt_provider=browser
  // the backend ignores all binary PCM frames, so streaming is wasteful and
  // creates an unnecessary AudioContext (which can fail or suspend on iOS).
  useEffect(() => {
    if (!permissionsGranted || !stream || ezriWsStatus !== "connected") return;
    if (hasSessionEnded || isSessionPaused) return;
    if (ezriConfig?.defaults.sttProvider === "browser") return;

    const SAMPLE_RATE = 16000;
    const BUFFER_SIZE = 4096;

    let audioCtx: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let processor: ScriptProcessorNode | null = null;

    try {
      audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
      source = audioCtx.createMediaStreamSource(stream);
      processor = audioCtx.createScriptProcessor(BUFFER_SIZE, 1, 1);

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        // Only hard-gate on mute/pause/ending — NOT on isEzriSpeakingRef.
        // The backend's own is_bot_speaking flag suppresses echo while Ezri
        // is speaking. Gating here too causes the first words after Ezri
        // stops to be swallowed (the ref clears 1-2 chunks late).
        if (
          isMutedRef.current ||
          isSessionPausedRef.current ||
          isSessionEndingRef.current
        )
          return;
        const ws = wsClientRef.current;
        if (!ws || ws.getStatus() !== "connected") return;

        const floats = e.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(floats.length);
        for (let i = 0; i < floats.length; i++) {
          pcm[i] = Math.max(-1, Math.min(1, floats[i])) * 0x7fff;
        }
        ws.sendPcm(pcm.buffer);
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
      console.log("[PCM] Streaming started at", SAMPLE_RATE, "Hz, buffer", BUFFER_SIZE);
    } catch (e) {
      console.error("[PCM] Failed to start audio streaming:", e);
    }

    return () => {
      try {
        processor?.disconnect();
        source?.disconnect();
        audioCtx?.close();
      } catch {}
      console.log("[PCM] Streaming stopped");
    };
  }, [permissionsGranted, stream, ezriWsStatus, hasSessionEnded, isSessionPaused]);

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

    const timer = setInterval(() => {
      // Keep accurate time in a ref (no React render).
      sessionTimeRef.current += 1;
      const next = sessionTimeRef.current;
      // Keep UI timer in sync (show every second).
      setSessionTime(next);
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
  }, [apiSessionId, isSessionPaused, hasSessionEnded]);

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
      // Credits recovered above threshold — reset so the banner can show again next dip.
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

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

  /** Refresh / close tab / bfcache-hidden page — browser gives us one keepalive request window. */
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
      toast.success("Session ended successfully");
    } catch (error) {
      console.error("Failed to end session:", error);
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
      console.error("End session navigation failed:", e);
      setIsEndingSession(false);
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
    stopAudioAndSpeechDriver();
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
      className="h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col overflow-hidden relative"
    >
      {/* Immediate takeover while ending — avoids flash of session UI after confirm closes */}
      {isEndingSession && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md px-6">
          <Loader2 className="h-12 w-12 text-purple-400 animate-spin mb-4" />
          <p className="text-lg font-semibold text-white text-center">
            Ending session…
          </p>
          <p className="text-sm text-gray-400 mt-2 text-center max-w-sm">
            Hang on — we&apos;re saving your session and taking you to the lobby.
          </p>
        </div>
      )}

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
                <div className="flex items-center gap-2">
                  <span className="text-xs text-purple-200">
                    Ezri:
                    <span className="ml-1 font-semibold">
                      {ezriWsStatus === "connected"
                        ? "Connected"
                        : ezriWsStatus === "connecting"
                        ? "Connecting"
                        : ezriWsStatus === "reconnecting"
                        ? "Reconnecting"
                        : "Disconnected"}
                    </span>
                  </span>
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

      {/* Video Session Area — plain divs (no layout/scale motion on the avatar card). */}
      <div className="flex-1 relative overflow-hidden p-6">
        <div className="w-full h-full rounded-3xl overflow-hidden relative bg-gradient-to-br from-amber-900/30 via-orange-900/20 to-purple-900/30 backdrop-blur-xl border-2 border-white/10 shadow-2xl">
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
            <AnimatePresence>
              {isEzriSpeaking && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-gradient-to-b from-purple-500/15 via-transparent to-transparent pointer-events-none"
                >
                  <div className="absolute inset-0 bg-gradient-radial from-purple-500/20 to-transparent blur-3xl opacity-50" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Stable container — do not animate `y` here or the whole avatar bobs up/down. */}
            <div className="relative z-10 w-full h-full">
              {sessionUsesCompanion3d ? (
                <ThreeAvatar
                  modelUrl={companionModelUrl}
                  viewTuning={companionViewTuning}
                  isSpeaking={isEzriSpeaking}
                  audioLevel={audioLevel}
                  mouthAudioLevelRef={mouthAudioLevelRef}
                  speechPulse={speechPulse}
                  speechText={speechText}
                  speechCharIndex={speechCharIndex}
                />
              ) : (
                <StaticSessionPortrait
                  imageUrl={companionPortraitUrl}
                  isSpeaking={isEzriSpeaking}
                />
              )}
            </div>

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
          <div className="absolute top-6 left-6 bg-black/60 backdrop-blur-xl px-4 py-2 rounded-xl border border-white/20 z-20">
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

          {/* Live user speech subtitle */}
          <AnimatePresence>
            {liveUserSpeech && !isEzriSpeaking && (
              <motion.div
                key="user-subtitle"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-[4.5rem] left-6 right-6 z-20 pointer-events-none"
              >
                <div className="bg-black/75 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/15 inline-block max-w-full">
                  <p className="text-white text-sm font-medium leading-snug">
                    {liveUserSpeech}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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
                    {isListening
                      ? "Listening"
                      : isMuted
                        ? "Mic off"
                        : "Starting mic"}
                    {audioLevel > 10 && (
                      <span
                        className="text-xs ml-1 text-green-200 tabular-nums"
                        title="Microphone signal level"
                      >
                        ({Math.round(audioLevel)})
                      </span>
                    )}
                  </span>
                </div>
              )}
            </motion.div>
          </div>
        </div>

        {/* User PiP camera — draggable */}
        <motion.div
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="absolute w-64 h-48 rounded-2xl overflow-hidden bg-gradient-to-br from-slate-700 to-slate-900 border-2 border-white/20 shadow-2xl z-30 touch-none select-none cursor-grab active:cursor-grabbing"
          style={{ right: pipPos.right, bottom: pipPos.bottom }}
          onPointerDown={handlePipPointerDown}
          onPointerMove={handlePipPointerMove}
          onPointerUp={handlePipPointerUp}
          onPointerCancel={handlePipPointerUp}
        >
          <div
            className="absolute top-0 left-0 right-0 h-7 z-10 flex items-center justify-center bg-black/35 rounded-t-[0.9rem] pointer-events-none"
            aria-hidden
          >
            <GripHorizontal className="w-5 h-5 text-white/70" />
          </div>
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
                  onClick={requestMediaAccess}
                  className="flex-1 px-6 py-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-purple-500/50"
                >
                  <Check className="w-5 h-5" />
                  Allow Access
                </motion.button>
              </div>

              {!(
                (window as any).SpeechRecognition ||
                (window as any).webkitSpeechRecognition
              ) && (
                <p className="text-xs text-blue-300 text-center mt-3 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                  Using server voice recognition for this browser.
                </p>
              )}

              <p className="text-xs text-gray-400 text-center mt-2">
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
                        onClick={() => {
                          setShowLowCreditsWarning(false);
                          setLowCreditsWarningDismissed(true);
                        }}
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

      {/* Crisis Keyword Modal */}
      <AnimatePresence>
        {CRISIS_KEYWORD_MODAL_ENABLED && showCrisisKeywordModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-slate-900 to-red-950 rounded-2xl sm:rounded-3xl p-4 sm:p-6 max-w-md w-full max-h-[92dvh] overflow-y-auto border border-red-400/40 shadow-2xl"
            >
              <div className="text-center mb-4">
                <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center mx-auto mb-3">
                  <AlertCircle className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white">Emergency alert detected</h3>
                <p className="text-sm sm:text-base text-red-100 mt-2">
                  We detected wording that suggests you may need immediate help. Please contact emergency support now.
                </p>
              </div>

              {detectedCrisisKeywords.length > 0 ? (
                <div className="mb-5">
                  <p className="text-xs text-red-100/90 mb-2">Detected keywords:</p>
                  <div className="flex flex-wrap gap-2">
                    {detectedCrisisKeywords.slice(0, 6).map((kw) => (
                      <span
                        key={kw}
                        className="px-2 py-1 rounded-md text-xs bg-red-900/60 text-red-100 border border-red-300/30"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <button
                  onClick={openEmergencyDialer}
                  className="w-full px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold"
                >
                  Call Emergency Now{crisisDialTarget ? ` (${crisisDialTarget})` : ""}
                </button>
                <button
                  onClick={() => {
                    setShowCrisisKeywordModal(false);
                    setShowSafetyResources(true);
                  }}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium"
                >
                  View Safety Resources
                </button>
                <button
                  onClick={() => setShowCrisisKeywordModal(false)}
                  className="w-full px-4 py-3 rounded-xl bg-transparent text-red-200 font-medium"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
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
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-slate-900 to-purple-900 rounded-2xl sm:rounded-3xl w-full max-w-2xl h-[94dvh] sm:h-[90dvh] border-2 border-red-500/30 shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="text-center px-4 sm:px-6 pt-4 sm:pt-6 pb-4 border-b border-white/10">
                <motion.div
                  animate={{ scale: [1, 1.1, 1], rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.5, repeat: 3 }}
                  className="w-14 h-14 sm:w-20 sm:h-20 bg-gradient-to-br from-red-500 to-rose-600 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4"
                >
                  <Heart className="w-7 h-7 sm:w-10 sm:h-10 text-white" />
                </motion.div>
                <h3 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                  Safety Resources
                </h3>
                <p className="text-sm sm:text-lg text-gray-300">
                  We've detected a potential safety concern in your conversation.
                  Here are some resources to help you.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4">
                <h4 className="text-white font-semibold text-center mb-3">
                  Emergency Resources:
                </h4>
                <div className="space-y-3">
                  {safetyResources.map((resource) => (
                    <SafetyResourceCard
                      key={resource.id}
                      resource={resource}
                      contextSessionId={sessionId}
                      safetyState={currentState}
                    />
                  ))}
                </div>
              </div>

              <div className="px-4 sm:px-6 py-3 border-t border-white/10 bg-black/20">
                <button
                  onClick={() => navigate("/app/dashboard")}
                  className="w-full px-4 sm:px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors"
                >
                  End Session & Return to Dashboard
                </button>
              </div>
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