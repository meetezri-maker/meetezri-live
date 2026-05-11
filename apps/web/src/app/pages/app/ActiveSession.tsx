import {
  Mic,
  MicOff,
  PhoneOff,
  Video,
  VideoOff,
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
  Wifi,
  WifiOff,
  Activity,
  Gauge,
  Smile,
  GripVertical,
} from "lucide-react";
import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useCallback,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/app/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverAnchor,
} from "@/app/components/ui/popover";
import { useSafety } from "@/app/contexts/SafetyContext";
import { useAuth } from "@/app/contexts/AuthContext";
import { api } from "@/lib/api";
import {
  parseSessionBackdropPreference,
  resolveSessionBackdropLayers,
  SESSION_BACKDROP_EMOJI_OPTIONS,
  SESSION_BACKDROP_STORAGE_KEY,
  SESSION_MOOD_SWATCH_GRADIENT,
  SESSION_MOOD_TILE_CAPTION,
  type SessionBackdropPreference,
} from "@/lib/sessionBackdropPresets";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { analyzeTextForSafety } from "@/app/utils/safetyDetection";
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
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    /** Softer rolloff in dark tones — reduces stepped “rings” on large curved surfaces. */
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
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
    scene.add(new THREE.AmbientLight(0xc8d4e8, 0.52));
    scene.add(new THREE.HemisphereLight(0x9eb6d4, 0x1e2838, 0.38));

    const keyLight = new THREE.DirectionalLight(0xfff4e8, 1.25);
    keyLight.position.set(3, 6, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.setScalar(2048);
    keyLight.shadow.bias = -0.00025;
    keyLight.shadow.normalBias = 0.045;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 40;
    keyLight.shadow.camera.left = -14;
    keyLight.shadow.camera.right = 14;
    keyLight.shadow.camera.top = 14;
    keyLight.shadow.camera.bottom = -14;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xb8c8e8, 0.65);
    fillLight.position.set(-4, 4, 4);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x4466aa, 0.35);
    rimLight.position.set(-2, 5, -4);
    scene.add(rimLight);

    const roomWarmth = new THREE.PointLight(0xffc9a8, 0.45, 28);
    roomWarmth.position.set(1.5, 3.5, 2);
    scene.add(roomWarmth);

    /** Cyclorama-style room: curved backdrop (center recesses) + sides nearer the figure. */
    let sessionRoomGroup: THREE.Group | null = null;
    const room = new THREE.Group();
    room.name = "ezriSessionRoom";
    /** Shared grain texture — breaks up 8-bit banding on large smooth surfaces (not from the GLB). */
    let roomGrainTexture: THREE.DataTexture | null = null;

    const wallProps: THREE.MeshStandardMaterialParameters = {
      color: 0x2c3a4e,
      roughness: 0.94,
      metalness: 0.03,
      side: THREE.DoubleSide,
    };
    const curvedWallMat = new THREE.MeshStandardMaterial(wallProps);
    const sideWallMatL = new THREE.MeshStandardMaterial(wallProps);
    const sideWallMatR = new THREE.MeshStandardMaterial(wallProps);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1a2434,
      roughness: 0.91,
      metalness: 0.06,
    });
    const ceilMat = new THREE.MeshStandardMaterial({
      color: 0x232f3f,
      roughness: 1,
      metalness: 0,
    });

    const arcSpan = Math.PI * 1.26;
    const thetaStart = -Math.PI / 2 - arcSpan / 2;

    /** Deeper outer bend — reads clearly on screen as a curved “bowl” behind the figure. */
    const BACK_CY_R_OUT = 28.5;
    const BACK_CY_Z_OUT = 10.75;
    const wallMatDeep = new THREE.MeshStandardMaterial({
      color: 0x1a2838,
      roughness: 0.96,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });

    {
      const grainSize = 196;
      const grainData = new Uint8Array(grainSize * grainSize * 4);
      for (let i = 0; i < grainSize * grainSize; i++) {
        const g = 160 + Math.floor(Math.random() * 95);
        grainData[i * 4] = g;
        grainData[i * 4 + 1] = g;
        grainData[i * 4 + 2] = g;
        grainData[i * 4 + 3] = 255;
      }
      roomGrainTexture = new THREE.DataTexture(
        grainData,
        grainSize,
        grainSize,
        THREE.RGBAFormat
      );
      roomGrainTexture.wrapS = THREE.RepeatWrapping;
      roomGrainTexture.wrapT = THREE.RepeatWrapping;
      roomGrainTexture.repeat.set(12, 12);
      roomGrainTexture.colorSpace = THREE.NoColorSpace;
      roomGrainTexture.needsUpdate = true;
    }
    const roomMatsWithGrain: THREE.MeshStandardMaterial[] = [
      curvedWallMat,
      sideWallMatL,
      sideWallMatR,
      floorMat,
      ceilMat,
      wallMatDeep,
    ];
    for (const mat of roomMatsWithGrain) {
      mat.roughnessMap = roomGrainTexture;
      mat.roughness = 0.88;
      /* Tiny lift in albedo — eases 8-bit banding on navy surfaces. */
      mat.emissive = new THREE.Color(0x0d1522);
      mat.emissiveIntensity = 0.07;
    }

    const curvedBackdropOuter = new THREE.Mesh(
      new THREE.CylinderGeometry(
        BACK_CY_R_OUT,
        BACK_CY_R_OUT,
        38,
        192,
        1,
        true,
        thetaStart,
        arcSpan
      ),
      wallMatDeep
    );
    curvedBackdropOuter.position.set(0, 9, BACK_CY_Z_OUT);
    /* No receive — shadow maps on huge curves read as vertical “stripes” / layers. */
    curvedBackdropOuter.receiveShadow = false;
    room.add(curvedBackdropOuter);

    const BACK_CY_R = 11.75;
    /** Tighter radius + pushed back reads as a stronger “news cyclorama” wrap on camera. */
    const BACK_CY_Z = 4.65;

    const curvedBackdrop = new THREE.Mesh(
      new THREE.CylinderGeometry(
        BACK_CY_R,
        BACK_CY_R,
        36,
        192,
        1,
        true,
        thetaStart,
        arcSpan
      ),
      curvedWallMat
    );
    curvedBackdrop.position.set(0, 9, BACK_CY_Z);
    curvedBackdrop.receiveShadow = false;
    room.add(curvedBackdrop);

    /* Curved floor: stronger infinity-cove sweep (floor → wall) like a broadcast studio. */
    const floorGeo = new THREE.PlaneGeometry(48, 32, 40, 24);
    const floorPos = floorGeo.attributes.position;
    for (let i = 0; i < floorPos.count; i++) {
      const xl = floorPos.getX(i);
      const yl = floorPos.getY(i);
      const worldZ = -yl;
      const t = THREE.MathUtils.clamp((-worldZ - 2) / 18, 0, 1);
      const lift = t * t * 3.05;
      floorPos.setZ(i, lift);
      /* Bowl: bring lateral floor edges a bit closer to the avatar. */
      const side = Math.min(1, Math.abs(xl) / 20);
      floorPos.setY(i, yl - side * side * 0.52 * t);
    }
    floorPos.needsUpdate = true;
    floorGeo.computeVertexNormals();

    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -2.35, 2);
    floor.receiveShadow = true;
    room.add(floor);

    /* Side wings: angle farther back so they meet a tighter cyclorama without a flat corner. */
    const sidePanelH = 29;
    const sidePanelW = 14;
    const leftWing = new THREE.Mesh(
      new THREE.PlaneGeometry(sidePanelW, sidePanelH),
      sideWallMatL
    );
    leftWing.position.set(-12.85, 9, -3.15);
    leftWing.rotation.set(0, Math.PI * 0.445, 0);
    leftWing.receiveShadow = false;
    room.add(leftWing);

    const rightWing = new THREE.Mesh(
      new THREE.PlaneGeometry(sidePanelW, sidePanelH),
      sideWallMatR
    );
    rightWing.position.set(12.85, 9, -3.15);
    rightWing.rotation.set(0, -Math.PI * 0.445, 0);
    rightWing.receiveShadow = false;
    room.add(rightWing);

    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(52, 52), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 21.25, 0);
    room.add(ceiling);

    scene.add(room);
    sessionRoomGroup = room;

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

      if (sessionRoomGroup && sceneRef.current) {
        sceneRef.current.remove(sessionRoomGroup);
        sessionRoomGroup.traverse((child: any) => {
          if (child.isMesh) {
            child.geometry?.dispose?.();
            const mat = child.material;
            const mats: THREE.Material[] = Array.isArray(mat)
              ? mat
              : mat
                ? [mat]
                : [];
            for (const m of mats) {
              const std = m as THREE.MeshStandardMaterial;
              if (
                std?.isMeshStandardMaterial &&
                std.roughnessMap === roomGrainTexture
              ) {
                std.roughnessMap = null;
              }
              m?.dispose?.();
            }
          }
        });
        sessionRoomGroup = null;
      }
      roomGrainTexture?.dispose();
      roomGrainTexture = null;

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

/** Native emoji for mood label (keyword match, or first grapheme emoji if the label already contains one). */
function moodEmojiForLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "🙂";

  try {
    if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
      const seg = new Intl.Segmenter("en", { granularity: "grapheme" });
      for (const { segment } of seg.segment(trimmed)) {
        if (/\p{Extended_Pictographic}/u.test(segment)) return segment;
      }
    } else if (/\p{Extended_Pictographic}/u.test(trimmed)) {
      const m = trimmed.match(/\p{Extended_Pictographic}/gu);
      if (m?.[0]) return m[0];
    }
  } catch {
    /* engine without Unicode property escapes */
  }

  const s = trimmed.toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ");
  if (/\b(love|loving|loved)\b/.test(s)) return "🥰";
  if (/\b(happy|joy|great|good|grateful|hopeful|content|cheerful|glad)\b/.test(s))
    return "😊";
  if (/\b(excited|awesome|energized|pumped|elated|thrilled)\b/.test(s)) return "🤩";
  if (/\b(sad|down|blue|depressed|grieving|lonely|gloomy|melancholy)\b/.test(s))
    return "😢";
  if (/\b(angry|mad|furious|frustrated|irritated|rage|annoyed)\b/.test(s))
    return "😠";
  if (/\b(anxious|worried|stressed|nervous|overwhelm|panic|uneasy)\b/.test(s))
    return "😰";
  if (/\b(calm|peaceful|relaxed|okay|ok|fine|steady|serene)\b/.test(s)) return "😌";
  if (/\b(neutral|meh|unsure|mixed|indifferent)\b/.test(s)) return "😐";
  if (/\b(tired|exhausted|sleepy|burnt|weary|fatigue)\b/.test(s)) return "😴";
  if (/\b(bad|rough|terrible|awful|low|cry|crying)\b/.test(s)) return "😭";
  if (/\b(sick|ill|unwell)\b/.test(s)) return "🤒";
  if (/\b(confused|lost)\b/.test(s)) return "😕";

  return "🙂";
}

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
  /** One-shot: after localStorage says the user already consented, call getUserMedia (see permission init effect). */
  const autoMediaKickoffRef = useRef(false);
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
      // microphone is required — let the user retry from the permission modal
      setShowPermissionRequest(true);
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

  /** Toggle camera — if the session started mic-only (camera denied / failed), turning “on” must acquire video. */
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
  /** User camera PiP — px from left / bottom within the full session view (root container). */
  const [pipPos, setPipPos] = useState({ left: 0, bottom: 0 });
  const pipDragRef = useRef<{
    id: number;
    sx: number;
    sy: number;
    sl: number;
    sb: number;
  } | null>(null);
  /** Greeting + transcript glass card — used to place PiP just below it on first layout. */
  const leftSessionChromeRef = useRef<HTMLDivElement>(null);
  const pipDefaultPlacedRef = useRef(false);
  /** Approx. PiP size for initial anchor (matches `w-[15.5rem]` × `sm:h-48`). */
  const PIP_LAYOUT_W = 248;
  const PIP_LAYOUT_H = 192;
  const pipClamp = useCallback((n: number, lo: number, hi: number) => {
    return Math.min(hi, Math.max(lo, n));
  }, []);
  const handlePipPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      pipDragRef.current = {
        id: e.pointerId,
        sx: e.clientX,
        sy: e.clientY,
        sl: pipPos.left,
        sb: pipPos.bottom,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [pipPos.left, pipPos.bottom],
  );
  const handlePipPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = pipDragRef.current;
      if (!d || e.pointerId !== d.id) return;
      const boundsEl = sessionContainerRef.current;
      if (!boundsEl) return;
      const el = e.currentTarget;
      const bw = boundsEl.clientWidth;
      const bh = boundsEl.clientHeight;
      const pipW = el.offsetWidth;
      const pipH = el.offsetHeight;
      const margin = 4;
      const maxLeft = Math.max(margin, bw - pipW - margin);
      const maxBottom = Math.max(margin, bh - pipH - margin);
      const deltaX = e.clientX - d.sx;
      const deltaY = e.clientY - d.sy;
      setPipPos({
        left: pipClamp(d.sl + deltaX, margin, maxLeft),
        bottom: pipClamp(d.sb - deltaY, margin, maxBottom),
      });
    },
    [pipClamp],
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
    [],
  );

  /** First meaningful layout: tuck PiP under the left transcript card (md+); else bottom-left. */
  const anchorPipBelowTranscriptOnce = useCallback(() => {
    if (pipDefaultPlacedRef.current) return;
    const root = sessionContainerRef.current;
    const card = leftSessionChromeRef.current;
    if (!root) return;

    const margin = 8;
    const gap = 12;
    const pipW = PIP_LAYOUT_W;
    const pipH = PIP_LAYOUT_H;
    const rootRect = root.getBoundingClientRect();

    if (card) {
      const cardRect = card.getBoundingClientRect();
      if (cardRect.width >= 24 && cardRect.height >= 24) {
        const leftDesired = cardRect.left - rootRect.left;
        const bottomDesired =
          rootRect.bottom - cardRect.bottom - gap - pipH;
        setPipPos({
          left: pipClamp(
            leftDesired,
            margin,
            Math.max(margin, root.clientWidth - pipW - margin),
          ),
          bottom: pipClamp(
            bottomDesired,
            margin,
            Math.max(margin, root.clientHeight - pipH - margin),
          ),
        });
        pipDefaultPlacedRef.current = true;
        return;
      }
    }

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767.98px)").matches
    ) {
      setPipPos({ left: margin, bottom: margin });
      pipDefaultPlacedRef.current = true;
    }
  }, [pipClamp]);

  useLayoutEffect(() => {
    const run = () => anchorPipBelowTranscriptOnce();

    run();
    let rafOuter = 0;
    let rafInner = 0;
    rafOuter = requestAnimationFrame(() => {
      rafInner = requestAnimationFrame(run);
    });

    const card = leftSessionChromeRef.current;
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(run);
      if (card) ro.observe(card);
    }

    window.addEventListener("resize", run);

    const safety = window.setTimeout(() => {
      if (!pipDefaultPlacedRef.current) {
        setPipPos({ left: 8, bottom: 8 });
        pipDefaultPlacedRef.current = true;
      }
    }, 2500);

    return () => {
      cancelAnimationFrame(rafOuter);
      cancelAnimationFrame(rafInner);
      ro?.disconnect();
      window.removeEventListener("resize", run);
      window.clearTimeout(safety);
    };
  }, [anchorPipBelowTranscriptOnce]);

  const [showPermissionRequest, setShowPermissionRequest] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [permissionStateInitialized, setPermissionStateInitialized] =
    useState(false);
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
  const wsAudioQueueRef = useRef<{ subtitle: string; audio: unknown }[]>([]);
  const wsIsPlaybackActiveRef = useRef(false);
  /** True after backend `step:speaking` until `tts_done` (Ezri Avatar / app.js parity). Used to detect idle server interrupts. */
  const wsTtsStreamingRef = useRef(false);
  const lastBargeInAtRef = useRef(0);
  /** After barge-in, don't treat overlap with the last assistant line as Ezri echo (common follow-ups share words). */
  const bargeInEchoGraceUntilRef = useRef(0);
  /** After user barge-in: relax echo heuristics + show interims without debounce so every word can be captured. */
  const listenEveryWordUntilRef = useRef(0);

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

  useEffect(() => {
    const el = transcriptListRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
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
        emoji: "💠",
        label: "Solace — brand default",
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
    // Only dedupe rapid interim hypotheses — mic-level and finals must always run so audio stops.
    if (now - lastBargeInAtRef.current < 400 && source === "speech_interim") {
      return;
    }
    lastBargeInAtRef.current = now;
    bargeInEchoGraceUntilRef.current = now + 8000;
    listenEveryWordUntilRef.current = now + 20_000;

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

    // Right after user interrupt: only drop near‑verbatim repeats of Ezri's last line, not normal
    // follow‑ups that share common words ("I", "you", "that") — those were eating real user speech.
    if (Date.now() < listenEveryWordUntilRef.current) {
      const lastAsst = transcriptRef.current
        .slice()
        .reverse()
        .find((t) => t.role === "assistant")?.content || "";
      const asstN = normalizeSpeech(lastAsst);
      if (
        asstN.length >= 12 &&
        candidate.length >= 8 &&
        (candidate === asstN ||
          (asstN.includes(candidate) && candidate.length >= asstN.length * 0.72))
      ) {
        return true;
      }
      return false;
    }

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

    // Do NOT use shouldIgnoreEchoBargeIn() here — it matched shared words with the *last assistant
    // turn* and blocked real interrupts ("stop", "wait", "I need to say something"). Echo after an
    // actual interrupt is handled separately (dropAsEzriEchoDup + listen window).

    const words = candidate.split(" ").filter(Boolean);

    // No micLevel gate: Chrome's AEC suppresses the mic signal while the speaker
    // is playing, so audioLevel is near-zero even when the user speaks clearly.
    // SpeechRecognition uses its own internal VAD — if it fires, the user spoke.

    // Interim: single word ≥3 chars ("hey", "wait", "stop") stops Ezri fast.
    if (!isFinal) {
      return words.length >= 1 && candidate.length >= 3;
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
          // Do NOT setPermissionsGranted here — that flag must only flip after getUserMedia
          // succeeds. Otherwise stream stays null, STT/video never bind, and PiP stays black.
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

  // Repeat visitors: localStorage recorded consent but we must still call getUserMedia or stream
  // is never created (previous bug set permissionsGranted without acquiring tracks).
  useEffect(() => {
    if (!permissionStateInitialized) return;
    if (stream) return;
    if (autoMediaKickoffRef.current) return;

    let hasStoredConsent = false;
    try {
      const stored = window.localStorage.getItem(permissionStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        hasStoredConsent = parsed === true || parsed === "granted";
      }
    } catch {
      /* noop */
    }
    if (!hasStoredConsent) return;

    autoMediaKickoffRef.current = true;
    void requestMediaAccess();
  }, [permissionStateInitialized, stream, permissionStorageKey, requestMediaAccess]);

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
          // After barge-in, show interims immediately (even 1 char) so carry-into-final has full text.
          const urgentListen = Date.now() < listenEveryWordUntilRef.current;
          if (subtitleDebounceRef.current) clearTimeout(subtitleDebounceRef.current);
          const minLen = urgentListen ? 1 : 3;
          const debounceMs = urgentListen ? 0 : 120;
          if (trimmed.length >= minLen) {
            if (urgentListen) {
              setLiveUserSpeech(trimmed);
            } else {
              subtitleDebounceRef.current = setTimeout(() => {
                setLiveUserSpeech(trimmed);
                subtitleDebounceRef.current = null;
              }, debounceMs);
            }
          }
          const now = Date.now();
          if (
            urgentListen ||
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
        const urgentListen = Date.now() < listenEveryWordUntilRef.current;
        const interimMinLen = urgentListen ? 2 : 5;
        const interimFreshMs = urgentListen ? 4500 : 2000;
        const interimRecent =
          interimSnapshot.length >= interimMinLen &&
          Date.now() - lastInterimToastAtRef.current < interimFreshMs;
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
          const mergeWindowMs = 14_000;
          const lastEntry = prev[prev.length - 1];
          if (lastEntry?.role === "user" && Date.now() - lastEntry.timestamp < mergeWindowMs) {
            const a = lastEntry.content.trim();
            const al = a.toLowerCase();
            const bl = textForUtterance.toLowerCase();
            if (bl.startsWith(al) && textForUtterance.length >= a.length && textForUtterance !== a) {
              return [
                ...prev.slice(0, -1),
                { role: "user", content: textForUtterance, timestamp: Date.now() },
              ];
            }
            if (al.startsWith(bl) && a.length > textForUtterance.length) {
              return prev;
            }
          }
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

        const serverOwnsSendChatIdle =
          Boolean(ezriConfig?.apiBase?.trim()) &&
          String(ezriConfig?.defaults?.sttProvider ?? "").toLowerCase() !== "browser" &&
          wsClientRef.current?.getStatus() === "connected" &&
          !ezriWsAudioPipelineActive();

        if (serverOwnsSendChatIdle) {
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
  }, [permissionsGranted, sttRestartTrigger, ezriConfig?.defaults?.sttProvider, ezriConfig?.apiBase]);

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
      if (isMutedRef.current || isSessionPausedRef.current || isSessionEndingRef.current) return;

      // Always upload chunks while TTS plays — backend can filter echo; skipping here made
      // Firefox/MediaRecorder sessions unable to barge-in at all during playback.
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

        // Show what was transcribed locally (Firefox has no SpeechRecognition interim text).
        setLiveUserSpeech(text);

        /** When assistant audio is streaming, STT REST chunks can overlap TTS playback. */
        const pipActive = ezriWsAudioPipelineActive();
        let bargeFromChunk = false;
        if (pipActive) {
          if (shouldInterruptForSpeech(text, true)) {
            requestBargeInInterrupt("speech_final");
            bargeFromChunk = true;
            const dropAsEzriEchoDup =
              Date.now() < bargeInEchoGraceUntilRef.current
                ? false
                : shouldIgnoreEchoBargeIn(text);
            if (dropAsEzriEchoDup) {
              setLiveUserSpeech("");
              return;
            }
          }
          // Important: Do NOT exit here — that hid every user line in Firefox while PCM STT still
          // drove replies (Ezri sounded “in sync” but the transcript showed only Maya).
        }

        const serverSideSttMr =
          Boolean(ezriConfig?.apiBase?.trim()) &&
          String(ezriConfig?.defaults?.sttProvider ?? "").toLowerCase() !== "browser";

        // Deduplicate / merge with a prior WS `onUserTranscript` line (same turn, longer REST text).
        setTranscript((prev) => {
          const mergeWindowMs = 14_000;
          const last = prev[prev.length - 1];
          if (last?.role === "user" && Date.now() - last.timestamp < mergeWindowMs) {
            const a = last.content.trim();
            const al = a.toLowerCase();
            const bl = text.toLowerCase();
            if (bl.startsWith(al) && text.length >= a.length && text !== a) {
              return [...prev.slice(0, -1), { role: "user", content: text, timestamp: Date.now() }];
            }
            if (al.startsWith(bl) && a.length > text.length) {
              return prev;
            }
          }
          if (last && last.content === text && Date.now() - last.timestamp < 5000) return prev;
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

        // With server STT (PCM on WS), the backend already hears the mic during TTS — skip a second sendChat from this REST chunk unless we barged-in.
        if (pipActive && !bargeFromChunk && serverSideSttMr) {
          setTimeout(() => setLiveUserSpeech(""), 1500);
          return;
        }

        if (
          !pipActive &&
          serverSideSttMr &&
          wsClientRef.current?.getStatus() === "connected"
        ) {
          setTimeout(() => setLiveUserSpeech(""), 1500);
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
  }, [permissionsGranted, stream, ezriConfig]);

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

  // ── Mic-level barge-in (always when TTS pipeline active) ─────────────────
  // Mobile: Web Speech is aborted during TTS — mic level is the main path.
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
        onUserTranscript: (text) => {
          if (suppressIncomingAudioRef.current) return;
          if (dropOldResponsesRef.current > 0) return;
          const t = text.trim();
          if (!t) return;
          const mergeWindowMs = 14_000;
          setTranscript((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "user" && Date.now() - last.timestamp < mergeWindowMs) {
              const a = last.content.trim();
              const al = a.toLowerCase();
              const bl = t.toLowerCase();
              if (bl.startsWith(al) && t.length >= a.length && t !== a) {
                return [...prev.slice(0, -1), { role: "user", content: t, timestamp: Date.now() }];
              }
              if (al.startsWith(bl) && a.length > t.length) {
                return prev;
              }
            }
            if (
              last &&
              last.role === "user" &&
              last.content === t &&
              Date.now() - last.timestamp < 5000
            ) {
              return prev;
            }
            return [...prev, { role: "user", content: t, timestamp: Date.now() }];
          });
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

  const glassPanel =
    "rounded-2xl border border-white/[0.032] bg-white/[0.01] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.06)]";
  /** Control strip: no bar — only circular buttons (no drop shadow). */
  const glassControlDock =
    "bg-transparent shadow-none backdrop-blur-none ring-0 outline-none border-0";
  /** Borderless glass caps; no shadow (avoids a halo behind the dock). */
  const glassControlBtn =
    "rounded-full border-0 text-white shadow-none ring-0 outline-none backdrop-blur-xl transition-[background-color] hover:shadow-none [background-color:rgba(255,255,255,0.16)] hover:[background-color:rgba(255,255,255,0.22)]";
  /** Muted / end: no drop shadow; slight red tint on hover via background only. */
  const glassControlBtnDanger =
    "rounded-full border-0 text-white shadow-none ring-0 outline-none backdrop-blur-xl transition-[background-color] hover:shadow-none [background-color:rgba(255,255,255,0.12)] hover:[background-color:rgba(255,255,255,0.18)]";
  /** One scale for every side: outer shell (all modes) + header corner + panel offsets from the room edge. */
  const stageShellPadding = "p-4 sm:p-5 md:p-6";
  /** One rounded token for outer shell + inner clip layer (keeps 3D clipped; chrome shares same box). */
  const stageRoundClass = isFullscreen
    ? "rounded-none"
    : "rounded-[1.75rem] sm:rounded-[2.5rem] md:rounded-[3rem]";
  const stageSidePanelInsetL =
    "top-20 sm:top-22 md:top-24 start-4 sm:start-5 md:start-6";
  const stageSidePanelInsetR =
    "top-20 sm:top-22 md:top-24 end-4 sm:end-5 md:end-6";
  /** Same horizontal inset as side rails so header controls line up with panel edges */
  const stageHeaderInset =
    "top-0 end-0 pt-4 pe-4 sm:pt-5 sm:pe-5 md:pt-6 md:pe-6";
  /** Wider left rail (2× previous 18rem cap) for greeting + transcript. */
  const stageRailWidthLeftClass =
    "w-full max-w-[min(36rem,calc(100%-1.25rem))] sm:max-w-[min(36rem,calc(100%-1.5rem))] md:w-[36rem] md:max-w-none shrink-0";
  const stageRailWidthRightClass =
    "w-[min(18rem,calc(100%-1.25rem))] sm:w-[min(18rem,calc(100%-1.5rem))] md:w-72 shrink-0";
  const stageBottomBar = "bottom-4 sm:bottom-5 md:bottom-6";

  return (
    <div
      ref={sessionContainerRef}
      className="relative h-screen overflow-hidden text-white transition-[background-color] duration-500"
      style={{ backgroundColor: sessionBackdropLayers.rootBg }}
    >
      {/* Immediate takeover while ending — avoids flash of session UI after confirm closes */}
      {isEndingSession && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#07041C]/95 backdrop-blur-md px-6">
          <Loader2 className="h-12 w-12 text-purple-400 animate-spin mb-4" />
          <p className="text-lg font-semibold text-white text-center">
            Ending session…
          </p>
          <p className="text-sm text-gray-400 mt-2 text-center max-w-sm">
            Hang on — we&apos;re saving your session and taking you to the lobby.
          </p>
        </div>
      )}

      {/* Main stage: curved frame on outer shell; flat in fullscreen — equal padding on all sides for every mode */}
      <div className={`absolute inset-0 z-0 box-border ${stageShellPadding}`}>
        <div
          className={`relative h-full w-full overflow-hidden ${stageRoundClass} shadow-[0_24px_80px_rgba(0,0,0,0.4)] ring-1 ring-inset ring-white/[0.08]`}
        >
          <div className={`absolute inset-0 overflow-hidden ${stageRoundClass}`}>
            {/* Mood atmosphere — z-0 behind companion; same clip as rounded stage */}
            <div
              className="pointer-events-none absolute inset-0 z-0 min-h-full w-full"
              style={{ backgroundColor: sessionBackdropLayers.rootBg }}
              aria-hidden
            >
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: sessionBackdropLayers.radialPrimary,
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: sessionBackdropLayers.radialFloor,
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: sessionBackdropLayers.linearAccent,
                }}
              />
              <div
                className="absolute inset-0 opacity-[0.045] mix-blend-soft-light"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.78' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                }}
              />
              <div
                className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.35' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23f)'/%3E%3C/svg%3E")`,
                }}
              />
            </div>
            <div className="relative z-[1] h-full min-h-0 w-full">
            <AnimatePresence>
              {isEzriSpeaking && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="pointer-events-none absolute inset-0 z-[1]"
                  style={{ background: sessionBackdropLayers.speakingWash }}
                />
              )}
            </AnimatePresence>
            {/* Elliptical mask: outer frame is a rounded rect (flat bottom center); this
                fades the render on a curved boundary so the bust blends into the stage. */}
            <div
              className="relative z-[2] h-full w-full [-webkit-mask-image:radial-gradient(ellipse_118%_96%_at_50%_32%,#fff_0%,#fff_45%,rgba(255,255,255,0.55)_68%,transparent_84%)] [mask-image:radial-gradient(ellipse_118%_96%_at_50%_32%,#fff_0%,#fff_45%,rgba(255,255,255,0.55)_68%,transparent_84%)] [mask-repeat:no-repeat] [mask-size:100%_100%] [mask-position:center]"
            >
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
                className="pointer-events-none absolute inset-x-0 bottom-0 z-[3]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div
                  className="absolute inset-x-0 bottom-0 h-16 md:h-[4.5rem]"
                  style={{
                    background: sessionBackdropLayers.speakingBottomVignette,
                  }}
                />
                {/* Voice bars: lifted clear of the circular control row (dock + bottom inset) */}
                <div className="absolute bottom-[6.25rem] left-1/2 flex -translate-x-1/2 items-end gap-1.5 sm:bottom-[6.75rem] md:bottom-[7.25rem] md:gap-2">
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-0.5 rounded-full opacity-[0.92] md:w-1"
                      style={{
                        backgroundColor: sessionBackdropLayers.voiceBar,
                      }}
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
          </div>

        {/* Session chrome — inside the rounded stage so left/right insets match the room edge symmetrically */}
        {/* Left: greeting + live transcript */}
        <aside
          aria-label="Session greeting and transcript"
          className={`pointer-events-none absolute ${stageSidePanelInsetL} z-30 flex max-h-[min(100dvh-5rem,100%)] ${stageRailWidthLeftClass} flex-col gap-0 overflow-x-hidden overflow-y-auto overscroll-contain pb-2`}
        >
        <div
          ref={leftSessionChromeRef}
          className={`pointer-events-auto ${glassPanel} flex min-h-0 max-h-[min(100dvh-8rem,42rem)] shrink-0 flex-col space-y-3 overflow-hidden p-4 sm:p-5`}
        >
          <div className="shrink-0">
            <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl md:text-2xl">
              {sessionGreeting}, {viewerFirstName}!
            </h2>
            <p className="mt-2 border-l-2 border-sky-400/45 pl-3 text-xs leading-relaxed text-white/80 md:text-sm">
              This time is for you—take it at your own pace, and share only what
              feels right in this moment.
            </p>
          </div>
          <div className="flex min-h-0 shrink-0 flex-col">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/45">
              Transcript
            </p>
            <div
              lang="en"
              ref={transcriptListRef}
              className="h-[16.5rem] shrink-0 space-y-2 overflow-y-auto rounded-xl border border-white/[0.028] bg-black/[0.05] px-3 py-2 text-sm sm:h-[17.5rem] [scrollbar-width:thin] [scrollbar-color:rgba(78,205,196,0.65)_rgba(255,255,255,0.06)] [scrollbar-gutter:stable] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-white/[0.06] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-[#4ECDC4]/55 [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-thumb:hover]:bg-[#4ECDC4]/80"
            >
              {liveUserSpeech.trim() ? (
                <div className="rounded-lg border border-[#4ECDC4]/30 bg-[#4ECDC4]/[0.07] px-2.5 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#4ECDC4]/90">
                    You · speaking
                  </p>
                  <p className="mt-0.5 leading-snug text-white/90">{liveUserSpeech}</p>
                </div>
              ) : null}
              {transcript.length === 0 && !liveUserSpeech.trim() ? (
                <p className="text-xs text-white/50">
                  Nothing yet — your conversation will appear here.
                </p>
              ) : transcript.length > 0 ? (
                transcript.slice(-80).map((line, i) => {
                  const isUser = line.role === "user";
                  return (
                    <div
                      key={`${line.timestamp}-${i}`}
                      className={`rounded-lg px-2.5 py-2 ${
                        isUser ? "bg-white/[0.02]" : "bg-violet-500/[0.03]"
                      }`}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-white/55">
                        {isUser ? "You" : currentAvatar.name}
                      </p>
                      <p className="mt-0.5 leading-snug text-white/90">{line.content}</p>
                    </div>
                  );
                })
              ) : null}
            </div>
          </div>
        </div>
      </aside>

      {/* Top bar — same inline-end inset as right rail (not full shell padding) */}
      <header
        className={`pointer-events-none absolute z-[48] flex justify-end ${stageHeaderInset}`}
      >
        <div className="pointer-events-auto flex shrink-0 items-center gap-2 md:gap-3">
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSessionStatsOpen((o) => !o)}
            className={`flex size-10 shrink-0 items-center justify-center rounded-full ${glassControlBtn} transition-transform ${
              sessionStatsOpen ? "ring-2 ring-white/35" : ""
            }`}
            aria-expanded={sessionStatsOpen}
            aria-controls="session-widgets-panel"
            aria-label={
              sessionStatsOpen ? "Hide session stats" : "Show session stats"
            }
          >
            <Gauge className="size-5" aria-hidden />
          </motion.button>
          <Button
            variant="ghost"
            size="sm"
            className={`rounded-full ${glassControlBtn} size-10 px-0 text-white hover:text-white`}
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
          >
            {isFullscreen ? (
              <Minimize className="size-4" />
            ) : (
              <Maximize className="size-4" />
            )}
          </Button>
          {typeof profile?.avatar_url === "string" && profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="size-10 shrink-0 rounded-full border border-white/30 object-cover shadow-md"
            />
          ) : (
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/[0.18] bg-white/[0.03] text-sm font-semibold text-white/90 shadow-md backdrop-blur-xl"
              aria-hidden
            >
              {viewerFirstName.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
      </header>

      {/* Right-side session stats (connection + session snapshot + moods) */}
      <aside
        id="session-widgets-panel"
        className={`absolute ${stageSidePanelInsetR} z-[48] ${stageRailWidthRightClass} flex-col gap-3 ${
          sessionStatsOpen ? "flex" : "hidden"
        }`}
        aria-hidden={!sessionStatsOpen}
      >
        <div className={`${glassPanel} flex items-center gap-3 px-3 py-2.5`}>
          {ezriWsStatus === "connected" ? (
            <Wifi className="size-8 shrink-0 text-emerald-300" aria-hidden />
          ) : ezriWsStatus === "connecting" ||
            ezriWsStatus === "reconnecting" ? (
            <Loader2
              className="size-8 shrink-0 animate-spin text-amber-300"
              aria-hidden
            />
          ) : (
            <WifiOff className="size-8 shrink-0 text-white/45" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-medium text-white/60">
              <Activity className="size-3.5 text-emerald-400" aria-hidden />
              Talk It Out
            </p>
            <p className="truncate text-sm font-semibold text-white">
              {ezriWsStatus === "connected"
                ? "Connected"
                : ezriWsStatus === "connecting"
                  ? "Connecting…"
                  : ezriWsStatus === "reconnecting"
                    ? "Reconnecting…"
                    : "Offline"}
            </p>
            <p className="text-xs text-white/45">Live with {currentAvatar.name}</p>
          </div>
        </div>

        <div className={`${glassPanel} p-3`}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-white">Session snapshot</span>
            <span className="flex items-center gap-1 text-xs text-emerald-300">
              <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              Live
            </span>
          </div>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between gap-2 border-b border-white/[0.032] py-2 first:pt-0">
              <span className="text-white/70">Talk time</span>
              <span className="font-mono font-semibold text-white">
                {formatTime(sessionTime)}
              </span>
            </li>
            <li className="flex justify-between gap-2 border-b border-white/[0.032] py-2">
              <span className="text-white/70">Minutes left</span>
              <span
                className={`font-mono font-semibold ${
                  remainingWholeMinutes !== null && remainingWholeMinutes <= 10
                    ? "text-red-300"
                    : "text-emerald-300"
                }`}
              >
                {remainingSeconds !== null ? formatTime(remainingSeconds) : "—"}
              </span>
            </li>
            <li className="flex justify-between gap-2 py-2">
              <span className="text-white/70">Quality</span>
              <span className={`font-medium capitalize ${getConnectionColor()}`}>
                {connectionQuality}
              </span>
            </li>
          </ul>
        </div>

        <div className={`${glassPanel} p-4`}>
          <div className="mb-3 flex items-center gap-2">
            <Smile className="size-4 shrink-0 text-amber-200" aria-hidden />
            <span className="text-sm font-semibold text-white">Feelings</span>
          </div>
          {sortedMoodPreview.length === 0 ? (
            <p className="text-xs leading-relaxed text-white/55">
              No recent mood check-ins. Log one from{" "}
              <span className="text-white/80">Mood Check-In</span> to see your
              latest mood here.
            </p>
          ) : (
            <>
              <div className="mb-4 min-h-[7.5rem] rounded-2xl border border-violet-400/[0.09] bg-gradient-to-br from-violet-500/[0.035] to-sky-600/[0.025] px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.018)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">
                      Latest check-in
                    </p>
                    <p className="mt-2 text-2xl font-bold capitalize leading-tight tracking-tight text-white md:text-[1.65rem]">
                      {String(sortedMoodPreview[0]?.mood ?? "")
                        .replace(/-/g, " ")
                        .trim() || "—"}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/65">
                      <time dateTime={sortedMoodPreview[0].created_at}>
                        {new Date(sortedMoodPreview[0].created_at).toLocaleString(
                          undefined,
                          {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          },
                        )}
                      </time>
                      {typeof sortedMoodPreview[0].intensity === "number" ? (
                        <span className="rounded-md border border-white/[0.032] bg-black/[0.05] px-2 py-0.5 tabular-nums text-white/80">
                          Intensity {sortedMoodPreview[0].intensity}/10
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span
                    className="shrink-0 select-none text-[2rem] leading-none [font-family:ui-sans-serif,system-ui,'Segoe_UI_Emoji','Apple_Color_Emoji','Noto_Color_Emoji',sans-serif]"
                    role="img"
                    aria-label={`Mood: ${String(sortedMoodPreview[0]?.mood ?? "").replace(/-/g, " ")}`}
                  >
                    {latestMoodEmoji}
                  </span>
                </div>
              </div>
              {sortedMoodPreview.length > 1 ? (
                <>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/45">
                    Recent
                  </p>
                  <ul className="max-h-44 space-y-2 overflow-y-auto text-sm">
                    {sortedMoodPreview.slice(1, 3).map((m, idx) => (
                      <li
                        key={`${m.created_at}-${idx}`}
                        className="flex items-center gap-2 rounded-lg border border-white/[0.028] bg-black/[0.035] px-2.5 py-2"
                      >
                        <span className="min-w-0 flex-1 truncate font-medium capitalize text-white">
                          {String(m.mood || "").replace(/-/g, " ") || "—"}
                        </span>
                        <span
                          className="shrink-0 text-xl leading-none [font-family:ui-sans-serif,system-ui,'Segoe_UI_Emoji','Apple_Color_Emoji','Noto_Color_Emoji',sans-serif]"
                          aria-hidden
                        >
                          {moodEmojiForLabel(String(m.mood ?? ""))}
                        </span>
                        <span className="shrink-0 text-[10px] tabular-nums text-white/45">
                          {new Date(m.created_at).toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                            },
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          )}
        </div>
      </aside>

      {/* Floating glass controls — mood popover anchors to whole bar so palette sits above buttons */}
      <Popover open={roomMoodPickerOpen} onOpenChange={setRoomMoodPickerOpen}>
        <PopoverAnchor asChild>
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className={`absolute ${stageBottomBar} left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 px-0 py-0 md:gap-3 ${glassControlDock}`}
          >
        <motion.button
          type="button"
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setIsSessionPaused(!isSessionPaused)}
          className={`flex size-12 shrink-0 items-center justify-center rounded-full transition-all md:size-14 ${
            isSessionPaused
              ? "rounded-full border-0 text-white shadow-none ring-0 backdrop-blur-xl [background-color:rgba(255,255,255,0.2)] hover:[background-color:rgba(255,255,255,0.26)]"
              : glassControlBtn
          }`}
          aria-label={isSessionPaused ? "Resume session" : "Pause session"}
        >
          {isSessionPaused ? (
            <Play className="size-6 md:size-7" />
          ) : (
            <Pause className="size-6 md:size-7" />
          )}
        </motion.button>
        <PopoverTrigger asChild>
          <motion.button
            type="button"
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            className={`flex size-12 shrink-0 items-center justify-center rounded-full md:size-14 ${glassControlBtn}`}
            aria-label={`Room mood: ${selectedRoomMoodOption.label}. Open color palette.`}
            aria-expanded={roomMoodPickerOpen}
            aria-haspopup="dialog"
          >
            <span
              className="size-9 shrink-0 rounded-[0.65rem] border border-white/35 shadow-md ring-1 ring-white/15 sm:size-10"
              style={{
                background:
                  SESSION_MOOD_SWATCH_GRADIENT[sessionBackdropPreference],
              }}
              aria-hidden
            />
          </motion.button>
        </PopoverTrigger>
        <div className="mx-1 hidden h-8 w-px shrink-0 bg-white/12 sm:block" aria-hidden />
        <motion.button
          type="button"
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setIsMuted(!isMuted)}
          className={`flex size-12 items-center justify-center rounded-full md:size-14 ${
            isMuted ? glassControlBtnDanger : glassControlBtn
          }`}
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? (
            <MicOff className="size-6 md:size-7" />
          ) : (
            <Mic className="size-6 md:size-7" />
          )}
        </motion.button>
        <motion.button
          type="button"
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => void handleCameraToggle()}
          className={`flex size-12 items-center justify-center rounded-full md:size-14 ${
            isCameraOff ? glassControlBtnDanger : glassControlBtn
          }`}
          aria-label={isCameraOff ? "Turn camera on" : "Turn camera off"}
        >
          {isCameraOff ? (
            <VideoOff className="size-6 md:size-7" />
          ) : (
            <Video className="size-6 md:size-7" />
          )}
        </motion.button>
        <motion.button
          type="button"
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setIsSoundOff((prev) => !prev)}
          className={`flex size-12 items-center justify-center rounded-full md:size-14 ${
            isSoundOff ? glassControlBtnDanger : glassControlBtn
          }`}
          aria-label={isSoundOff ? "Turn sound on" : "Turn sound off"}
        >
          {isSoundOff ? (
            <VolumeX className="size-6 md:size-7" />
          ) : (
            <Volume2 className="size-6 md:size-7" />
          )}
        </motion.button>
        <motion.button
          type="button"
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setShowEndConfirm(true)}
          className={`flex size-12 items-center justify-center rounded-full md:size-14 ${glassControlBtnDanger}`}
          aria-label="End session"
        >
          <PhoneOff className="size-6 text-white md:size-7" />
        </motion.button>
          </motion.div>
        </PopoverAnchor>
        <PopoverContent
          side="top"
          align="center"
          sideOffset={10}
          collisionPadding={16}
          className="z-[200] w-[min(calc(100vw-2rem),28rem)] border border-white/12 bg-[#0A0F1E]/96 p-0 text-white shadow-2xl backdrop-blur-2xl"
        >
            <div className="border-b border-white/[0.06] px-2.5 py-2 sm:px-3 sm:py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">
                Room color mood
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-white/65 sm:text-xs">
                Tap a gradient that fits how you feel — saved on this device.{" "}
                <span className="text-white/45">
                  Auto syncs to your latest check-in.
                </span>
              </p>
            </div>
            <div
              className="grid grid-cols-4 grid-rows-2 gap-1.5 p-2.5 sm:gap-2 sm:p-3"
              role="listbox"
              aria-label="Room mood color options"
            >
              {SESSION_BACKDROP_EMOJI_OPTIONS.map((o) => {
                const selected = sessionBackdropPreference === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    aria-label={o.label}
                    onClick={() => {
                      setSessionBackdropPreference(o.value);
                      setRoomMoodPickerOpen(false);
                    }}
                    style={{
                      background: SESSION_MOOD_SWATCH_GRADIENT[o.value],
                    }}
                    className={`group relative h-[3.25rem] min-h-0 overflow-hidden rounded-lg border text-left shadow-md transition-transform hover:scale-[1.02] hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ECDC4] active:scale-[0.98] sm:h-[3.55rem] sm:rounded-xl ${
                      selected
                        ? "border-[#4ECDC4] ring-2 ring-[#4ECDC4]/90 ring-offset-2 ring-offset-[#0A0F1E]"
                        : "border-white/15 hover:border-white/35"
                    }`}
                  >
                    {selected ? (
                      <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm sm:right-1.5 sm:top-1.5 sm:size-6">
                        <Check
                          className="size-3 text-[#4ECDC4] sm:size-3.5"
                          aria-hidden
                        />
                      </span>
                    ) : null}
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/82 via-black/45 to-transparent px-0.5 pb-1.5 pt-5 text-center text-[8px] font-bold uppercase tracking-wide text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] sm:px-1.5 sm:pb-2 sm:pt-6 sm:text-[9px]">
                      {SESSION_MOOD_TILE_CAPTION[o.value]}
                    </span>
                  </button>
                );
              })}
            </div>
        </PopoverContent>
      </Popover>
        </div>
      </div>

      {/* User camera PiP — full-session drag (clamped to screen); dock z-50 stays tappable on top */}
      <div className="pointer-events-none absolute inset-0 z-[45]">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 260, damping: 28 }}
          className="pointer-events-auto absolute z-10 w-[15.5rem] max-w-[calc(100%-1rem)] cursor-grab overflow-hidden rounded-2xl border border-white/[0.07] bg-black/[0.08] shadow-lg backdrop-blur-md touch-none select-none active:cursor-grabbing h-[11.5rem] sm:h-48"
          style={{ left: pipPos.left, bottom: pipPos.bottom }}
          aria-label="Your camera preview — drag to move anywhere on screen"
          onPointerDown={handlePipPointerDown}
          onPointerMove={handlePipPointerMove}
          onPointerUp={handlePipPointerUp}
          onPointerCancel={handlePipPointerUp}
        >
          <div
            className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex h-7 items-center gap-1.5 rounded-t-[0.9rem] bg-black/12 px-2"
            aria-hidden
          >
            <GripVertical className="size-3.5 shrink-0 text-white/45" aria-hidden />
            <Video className="size-4 text-white/70" aria-hidden />
          </div>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`pointer-events-none size-full object-cover ${isCameraOff ? "hidden" : "block"}`}
          />
          {isCameraOff && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center">
                <VideoOff className="mx-auto mb-2 size-10 text-white/40" />
                <p className="text-xs text-white/50">Camera off</p>
              </div>
            </div>
          )}
          {isMuted && !isCameraOff && (
            <div className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-red-500 p-2">
              <MicOff className="size-4 text-white" />
            </div>
          )}
        </motion.div>
      </div>

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
                  <p className="text-gray-300 mb-2">Your Talk time:</p>
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
    </div>
  );
}