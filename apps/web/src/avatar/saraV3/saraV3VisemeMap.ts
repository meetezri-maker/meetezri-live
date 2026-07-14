/**
 * SaraV3-owned phoneme → viseme map (B2.1, reshaped in B2.2).
 *
 * Derived from PHONEME_TO_JORDAN_VISEME but deliberately NOT imported from it:
 * SaraV3's GLB exposes only the 7 viseme morphs below plus `mouthRollLower`
 * (see docs/sara-v3-morph-inventory.md). Jordan keeps its own map and its
 * `viseme_S` entry; SaraV3 has no `viseme_S` morph, so S/Z routed there were
 * silently dropped by the morph binder and rendered as jaw-only motion.
 *
 * B2.2: each phoneme now carries a `weight` alongside its target morph. The
 * weight scales BOTH the viseme strength and the jaw opening from
 * SARA_V3_VISEME_TABLE, so vowels read as dominant shapes and consonants as
 * subtle hints. Strength is still clamped by SARA_V3_VISEME_MAX_STRENGTH.
 */
export const SARA_V3_VISEME_MORPH_NAMES = [
  "viseme_rest",
  "viseme_AA",
  "viseme_IH",
  "viseme_O",
  "viseme_PP",
  "viseme_CH",
  "viseme_E",
  "mouthRollLower",
] as const;

export type SaraV3VisemeMorphName = (typeof SARA_V3_VISEME_MORPH_NAMES)[number];

export type SaraV3VisemeMapEntry = {
  readonly viseme: SaraV3VisemeMorphName;
  readonly weight: number;
};

/**
 * Fallback for any phoneme absent from the map. Preserves the pre-B2.2
 * behavior (unknown label → rest) with no undefined access in the driver.
 */
export const SARA_V3_REST_VISEME_ENTRY: SaraV3VisemeMapEntry = {
  viseme: "viseme_rest",
  weight: 1,
};

export const PHONEME_TO_SARA_V3_VISEME: Record<string, SaraV3VisemeMapEntry> = {
  // Vowels — dominant shapes, full weight.
  AA: { viseme: "viseme_AA", weight: 1.0 },
  AH: { viseme: "viseme_AA", weight: 1.0 },
  AE: { viseme: "viseme_AA", weight: 1.0 },
  AY: { viseme: "viseme_AA", weight: 1.0 },
  AW: { viseme: "viseme_AA", weight: 1.0 },
  EY: { viseme: "viseme_E", weight: 1.0 },
  EH: { viseme: "viseme_E", weight: 1.0 },
  IH: { viseme: "viseme_IH", weight: 1.0 },
  IY: { viseme: "viseme_IH", weight: 1.0 },
  AO: { viseme: "viseme_O", weight: 1.0 },
  OW: { viseme: "viseme_O", weight: 1.0 },
  OY: { viseme: "viseme_O", weight: 1.0 },
  UW: { viseme: "viseme_O", weight: 1.0 },
  UH: { viseme: "viseme_O", weight: 1.0 },
  // Bilabials — full closure, near-shut jaw (jawOpen lives in the table).
  P: { viseme: "viseme_PP", weight: 1.0 },
  B: { viseme: "viseme_PP", weight: 1.0 },
  M: { viseme: "viseme_PP", weight: 1.0 },
  // Labiodentals — B2.2 moves these off viseme_PP (a full bilabial closure)
  // onto the real lower-lip roll morph.
  F: { viseme: "mouthRollLower", weight: 1.0 },
  V: { viseme: "mouthRollLower", weight: 1.0 },
  // Affricates/sibilants. viseme_CH is the only real sibilant shape in the
  // GLB; S/Z borrow it at reduced weight so they read softer than CH/SH/JH.
  CH: { viseme: "viseme_CH", weight: 1.0 },
  SH: { viseme: "viseme_CH", weight: 1.0 },
  JH: { viseme: "viseme_CH", weight: 1.0 },
  S: { viseme: "viseme_CH", weight: 0.7 },
  Z: { viseme: "viseme_CH", weight: 0.7 },
  // Rounding
  W: { viseme: "viseme_O", weight: 0.8 },
  // Rhotics
  R: { viseme: "viseme_E", weight: 0.6 },
  ER: { viseme: "viseme_E", weight: 0.7 },
  // Tongue/velar consonants — no tongue morphs exist, so viseme_IH stands in
  // at low weight as a hint rather than an articulated shape.
  Y: { viseme: "viseme_IH", weight: 0.6 },
  D: { viseme: "viseme_IH", weight: 0.4 },
  T: { viseme: "viseme_IH", weight: 0.4 },
  N: { viseme: "viseme_IH", weight: 0.4 },
  L: { viseme: "viseme_IH", weight: 0.4 },
  K: { viseme: "viseme_IH", weight: 0.35 },
  G: { viseme: "viseme_IH", weight: 0.35 },
  NG: { viseme: "viseme_IH", weight: 0.35 },
  TH: { viseme: "viseme_IH", weight: 0.4 },
  DH: { viseme: "viseme_IH", weight: 0.4 },
  // Rest
  HH: { viseme: "viseme_rest", weight: 1.0 },
  PAUSE: { viseme: "viseme_rest", weight: 1.0 },
  SIL: { viseme: "viseme_rest", weight: 1.0 },
  REST: { viseme: "viseme_rest", weight: 1.0 },
  SP: { viseme: "viseme_rest", weight: 1.0 },
};

/**
 * Weight-less projection of the map above, kept only so
 * `SARA_V3_AVATAR_DEFINITION.visemes.phonemeToViseme` still satisfies the
 * shared `AvatarVisemeConfig` contract (Record<string, string>), which the
 * avatar registry type-checks against. Nothing reads it at runtime; the driver
 * uses the weighted map via `saraV3.visemeMap`.
 */
export const SARA_V3_PHONEME_TO_VISEME_NAME: Record<string, SaraV3VisemeMorphName> =
  Object.fromEntries(
    Object.entries(PHONEME_TO_SARA_V3_VISEME).map(([phoneme, entry]) => [phoneme, entry.viseme])
  );
