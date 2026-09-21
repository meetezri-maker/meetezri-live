import type { FacialRegion, MergeStrategy } from "../types/facialAnimation";

export const EXPECTED_MINIFACE_BLENDSHAPES = [
  "jawOpen", "jawForward", "jawLeft", "jawRight", "mouthClose", "mouthFunnel", "mouthPucker",
  "mouthSmileLeft", "mouthSmileRight", "mouthFrownLeft", "mouthFrownRight", "mouthStretchLeft",
  "mouthStretchRight", "mouthPressLeft", "mouthPressRight", "mouthLowerDownLeft", "mouthLowerDownRight",
  "mouthUpperUpLeft", "mouthUpperUpRight", "mouthRollLower", "mouthRollUpper", "mouthShrugLower",
  "mouthShrugUpper", "cheekPuff", "cheekSquintLeft", "cheekSquintRight", "browDownLeft",
  "browDownRight", "browInnerUp", "browOuterUpLeft", "browOuterUpRight", "eyeBlinkLeft",
  "eyeBlinkRight", "eyeSquintLeft", "eyeSquintRight", "eyeWideLeft", "eyeWideRight", "eyeLookDownLeft",
  "eyeLookDownRight", "eyeLookUpLeft", "eyeLookUpRight", "eyeLookInLeft", "eyeLookInRight",
  "eyeLookOutLeft", "eyeLookOutRight"
] as const;

export type MinifaceBlendshape = typeof EXPECTED_MINIFACE_BLENDSHAPES[number];

export const avatarRestPose: Record<MinifaceBlendshape, number> = Object.fromEntries(
  EXPECTED_MINIFACE_BLENDSHAPES.map((name) => [name, 0])
) as Record<MinifaceBlendshape, number>;

export const avatarMorphSafeMaximums: Record<MinifaceBlendshape, number> = Object.fromEntries(
  EXPECTED_MINIFACE_BLENDSHAPES.map((name) => [name, 1])
) as Record<MinifaceBlendshape, number>;

export const clampAvatarMorph = (name: string, value: number) => {
  const safeMaximum = avatarMorphSafeMaximums[name as MinifaceBlendshape] ?? 1;
  return Math.min(Math.max(value, 0), safeMaximum);
};

export const avatarBoneConfig = {
  headBoneNames: ["Head"],
  neckBoneNames: ["Neck"],
  smoothingSpeed: 10,
  automatic: {
    headPitchDeg: 2.25,
    neckPitchDeg: 0.9,
    headYawDeg: 1.4,
    neckYawDeg: 0.65,
    headRollDeg: 1.2,
    neckRollDeg: 0.5
  },
  manual: {
    headPitchDeg: 4.5,
    neckPitchDeg: 1.8,
    headYawDeg: 3.2,
    neckYawDeg: 1.2,
    headRollDeg: 4.5,
    neckRollDeg: 1.8
  }
} as const;

export const degreesToRadians = (degrees: number) => (degrees * Math.PI) / 180;

const byPrefix = (name: string): FacialRegion => {
  if (name.startsWith("jaw")) return "jaw";
  if (name.startsWith("brow")) return "brow";
  if (name.startsWith("eyeLook")) return "gaze";
  if (name.startsWith("eye")) return "eyes";
  if (name.startsWith("cheek")) return "cheeks";
  return "mouth";
};

export const blendshapeRegions: Record<string, FacialRegion> = Object.fromEntries(
  EXPECTED_MINIFACE_BLENDSHAPES.map((name) => [name, byPrefix(name)])
);

export const regionMergeStrategy: Record<FacialRegion, MergeStrategy> = {
  jaw: "boundedAdd",
  mouth: "boundedAdd",
  brow: "boundedAdd",
  eyes: "max",
  cheeks: "boundedAdd",
  gaze: "weightedAverage",
  head: "add"
};

export const smoothingSpeedByRegion: Record<FacialRegion, number> = {
  jaw: 24,
  mouth: 28,
  brow: 9,
  eyes: 48,
  cheeks: 10,
  gaze: 7,
  head: 5
};


