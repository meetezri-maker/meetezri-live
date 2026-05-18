import type * as THREE from "three";
import type { MorphBinding } from "./avatarMorphTypes";
import {
  JORDAN_BLINK_MORPH_NAMES,
  JORDAN_MORPH_NAME_SET,
  JORDAN_VISEME_NAMES,
  type JordanMorphName,
} from "./jordanRfv2Config";

export function getSentimentLabel(sentiment: unknown): string {
  if (!sentiment) return "";
  if (typeof sentiment === "string") return sentiment.toLowerCase();
  if (typeof sentiment === "object") {
    const label = (sentiment as Record<string, unknown>).label;
    return typeof label === "string" ? label.toLowerCase() : "";
  }
  return String(sentiment).toLowerCase();
}

export function isSadSentiment(sentiment: unknown): boolean {
  const label = getSentimentLabel(sentiment);
  return /sad|negative|concerning|crisis|distress|upset|depress|anxious/.test(
    label
  );
}

export function isPositiveSentiment(sentiment: unknown): boolean {
  const label = getSentimentLabel(sentiment);
  return /positive|happy|warm|good|great|calm|hopeful|relief|encourag|support/.test(
    label
  );
}

export function isRfv2VisemeMorphName(name: string): boolean {
  return JORDAN_VISEME_NAMES.includes(name as JordanMorphName);
}

export function isRfv2BlinkMorphName(name: string): boolean {
  return JORDAN_BLINK_MORPH_NAMES.includes(name as JordanMorphName);
}

export function isRfv2ExpressionMorphName(name: string): boolean {
  return JORDAN_MORPH_NAME_SET.has(name);
}

export function jordanJawSupportForViseme(viseme: JordanMorphName | null): number {
  switch (viseme) {
    case "viseme_AA":
      return 0.22;
    case "viseme_O":
      return 0.16;
    case "viseme_E":
    case "viseme_IH":
      return 0.1;
    case "viseme_PP":
    case "viseme_S":
    case "viseme_CH":
      return 0.025;
    default:
      return 0;
  }
}

export function isJordanBlinkMorph(name: JordanMorphName): boolean {
  return JORDAN_BLINK_MORPH_NAMES.includes(name);
}

export function isLikelyJordanMainFaceMesh(mesh: THREE.Mesh): boolean {
  const meshName = (mesh.name || "").toLowerCase();
  const materialNames = (Array.isArray(mesh.material) ? mesh.material : [mesh.material])
    .filter(Boolean)
    .map((material: any) => String(material?.name ?? "").toLowerCase())
    .join(" ");
  const label = `${meshName} ${materialNames}`;
  const looksFaceLike =
    /face|head|skin|bodymesh|wolf3d_head|mesh_0|primitive_0/.test(label);
  const looksAccessoryLike =
    /hair|lash|brow|eye|cornea|teeth|tooth|tongue|mouth|beard|shirt|top|bottom|footwear|shoe/.test(label);
  return looksFaceLike && !looksAccessoryLike;
}

export function getJordanBlinkMode(bindings: Map<JordanMorphName, MorphBinding[]>): string {
  const hasSplitBlink =
    (bindings.get("eyeBlinkLeft")?.length ?? 0) > 0 &&
    (bindings.get("eyeBlinkRight")?.length ?? 0) > 0;
  if (hasSplitBlink) return "left/right";
  if ((bindings.get("eye_blink")?.length ?? 0) > 0) return "fallback eye_blink";
  return "none";
}
