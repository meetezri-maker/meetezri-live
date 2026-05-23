import fs from "fs";
import path from "path";

const src = "apps/web/src/app/pages/app/ActiveSession.tsx";
const base = "apps/web/src/app/pages/app/active-session";
const lines = fs.readFileSync(src, "utf8").split(/\r?\n/);

const avatarImports = `import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  type MutableRefObject,
} from "react";
import {
  DEBUG_JORDAN_EXPRESSION_TEST,
  DEBUG_JORDAN_BEHAVIOR_TIMING,
  DEBUG_JORDAN_LISTENING_MORPH_TEST,
  DEBUG_JORDAN_PHONEMES,
  DEBUG_JORDAN_STRONG_EXPRESSION_VERIFY,
  DEBUG_JORDAN_TEST_MORPH,
  DEBUG_JORDAN_TEST_VALUE,
  JORDAN_EYE_INTELLIGENCE_TUNING,
  JORDAN_EYE_FOCUS_TUNING,
  JORDAN_EXPRESSION_AUTHORITY_MORPHS,
  JORDAN_EXPRESSION_CAPS,
  JORDAN_EXPRESSION_PRESETS,
  JORDAN_EXPRESSION_PRESET_TUNING,
  JORDAN_EMOTIONAL_MODULATION_TUNING,
  JORDAN_FINAL_HUMANIZATION_TUNING,
  JORDAN_HEAD_PRESENCE_TUNING,
  JORDAN_HEAD_OFFSET_X,
  JORDAN_HEAD_OFFSET_Y,
  JORDAN_IDLE_BROW_TUNING,
  JORDAN_LISTENING_FACE_TUNING,
  JORDAN_MORPH_NAME_SET,
  JORDAN_MORPH_NAMES,
  JORDAN_RFV2_EXPRESSION_TEST_SEQUENCE,
  JORDAN_RFV2_BLINK_TUNING,
  JORDAN_RFV2_FACE_TUNING,
  JORDAN_RFV2_IDLE_TUNING,
  JORDAN_RFV2_LISTENING_MORPH_TEST_SEQUENCE,
  JORDAN_RFV2_MORPH_AUDIT_NAMES,
  JORDAN_RFV2_REQUIRED_DRIVER_MORPHS,
  JORDAN_SPEAKING_BEHAVIOR_TUNING,
  type JordanMorphName,
} from "@/lib/avatar/jordanRfv2Config";
import {
  createJordanBehaviorTimingState,
  updateJordanBehaviorTimingScheduler,
  type JordanBehaviorTimingEvent,
  type JordanBehaviorTimingState,
} from "@/lib/avatar/jordanBehaviorTimingScheduler";
import {
  findActiveJordanPhoneme,
  hasInvalidJordanPhonemeTimestamps,
  normalizeAvatarPhonemeTimeline,
  normalizeMorphName,
  normalizePhonemeLabelForDebug,
} from "@/lib/avatar/phonemeToViseme";
import {
  getJordanBlinkMode,
  getSentimentLabel,
  isJordanBlinkMorph,
  isLikelyJordanMainFaceMesh,
  isPositiveSentiment,
  isRfv2BlinkMorphName,
  isRfv2ExpressionMorphName,
  isRfv2VisemeMorphName,
  isSadSentiment,
  jordanJawSupportForViseme,
} from "@/lib/avatar/avatarExpressionUtils";
import type {
  AvatarPhonemeTimeline,
  AvatarRenderMode,
  MorphBinding,
} from "@/lib/avatar/avatarMorphTypes";
import type {
  AvatarCameraConfig,
  AvatarGltfTransformConfig,
  Vector3Object,
  Vector3Config,
} from "@/lib/avatar/avatarConfigTypes";
import type { CompanionViewTuning } from "@/lib/avatar/companionViewTuning";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

`;

let avatarBody = lines.slice(170, 6191).join("\n");
avatarBody = avatarBody.replace(
  "export default ThreeAvatar;",
  "export { ThreeAvatar, StaticSessionPortrait };"
);
avatarBody = avatarBody.replace(
  /^function StaticSessionPortrait/m,
  "export function StaticSessionPortrait"
);
avatarBody = avatarBody.replace(/^function ThreeAvatar/m, "export function ThreeAvatar");

fs.mkdirSync(path.join(base, "avatar"), { recursive: true });
fs.writeFileSync(
  path.join(base, "avatar/ThreeAvatar.tsx"),
  avatarImports + avatarBody
);

const moodLines = lines
  .slice(6197, 6236)
  .map((l) => l.replace(/^  /, ""))
  .join("\n");
fs.mkdirSync(path.join(base, "utils"), { recursive: true });
fs.writeFileSync(
  path.join(base, "utils/moodEmoji.ts"),
  `/** Native emoji for mood label (keyword match). */\n${moodLines}\n`
);

const transcriptHeader = `/** Transcript merge utilities for Active Session. */

export interface TranscriptLine {
  role: string;
  content: string;
  timestamp: number;
}

export const USER_TRANSCRIPT_MERGE_WINDOW_MS = 16_000;
export const USER_SAME_SPEECH_BURST_MS = 6200;

`;

const transcriptBody = lines
  .slice(6250, 6364)
  .map((l) => l.replace(/^  /, ""))
  .join("\n");
fs.writeFileSync(
  path.join(base, "utils/transcript.ts"),
  transcriptHeader + transcriptBody
);

fs.writeFileSync(
  path.join(base, "constants.ts"),
  `export const CRISIS_KEYWORD_MODAL_ENABLED = false;

export const glassPanel =
  "rounded-2xl border border-white/10 bg-[#0A0F1E]/45 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.25)]";

export const glassControlDock =
  "bg-transparent shadow-none backdrop-blur-none ring-0 outline-none border-0";

export const glassControlBtn =
  "rounded-full border-0 text-white shadow-none ring-0 outline-none backdrop-blur-xl transition-[background-color] hover:shadow-none [background-color:rgba(255,255,255,0.16)] hover:[background-color:rgba(255,255,255,0.22)]";

export const glassControlBtnDanger =
  "rounded-full border-0 text-white shadow-none ring-0 outline-none backdrop-blur-xl transition-[background-color] hover:shadow-none [background-color:rgba(255,255,255,0.12)] hover:[background-color:rgba(255,255,255,0.18)]";
`
);

// Build new ActiveSession.tsx: imports + ActiveSession only
const sessionImports = lines.slice(0, 169).join("\n");
const sessionBody = lines
  .slice(6365)
  .map((l) => (l.startsWith("  ") ? l.slice(2) : l))
  .join("\n");

const newSessionFile = `${sessionImports}
import { ThreeAvatar, StaticSessionPortrait } from "./avatar/ThreeAvatar";
import { CRISIS_KEYWORD_MODAL_ENABLED, glassPanel, glassControlDock, glassControlBtn, glassControlBtnDanger } from "./constants";
import { moodEmojiForLabel } from "./utils/moodEmoji";
import {
  mergeUserTranscriptAppend,
  type TranscriptLine,
  USER_TRANSCRIPT_MERGE_WINDOW_MS,
  USER_SAME_SPEECH_BURST_MS,
} from "./utils/transcript";
${sessionBody.replace(/^export function ActiveSession/, "export function ActiveSession")}`;

fs.writeFileSync(path.join(base, "ActiveSession.tsx"), newSessionFile);

console.log("Done. Avatar:", 6191 - 170, "lines. Session body:", lines.length - 6365, "lines.");
