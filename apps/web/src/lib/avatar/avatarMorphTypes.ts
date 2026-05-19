import type * as THREE from "three";

export type MorphBinding = {
  mesh: THREE.Mesh;
  index: number;
  name: string;
  initialInfluence: number;
  primitiveIndex?: number;
};

export type AvatarPhoneme = {
  rawPhoneme?: string;
  phoneme: string;
  debugNormalizedPhoneme?: string;
  start: number;
  end?: number;
};

export type AvatarPhonemeTimeline = {
  sentence: string;
  sentiment: unknown;
  phonemeFormat: "timestamped" | "string-fallback";
  phonemes: AvatarPhoneme[];
};

export type AvatarRenderMode = "legacyHybrid" | "rfv2Morph";
