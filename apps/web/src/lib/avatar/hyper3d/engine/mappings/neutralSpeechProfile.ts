import { SUPPORTED_PHONEMES, type SupportedPhoneme } from "./phonemeAliases";
import type { PhonemePoseDefinition } from "../types/facialAnimation";

const base = {
  attack: 0.04,
  holdBias: 0.5,
  release: 0.06,
  defaultIntensity: 0.7,
  intensityMin: 0,
  intensityMax: 1,
  jawDominance: 0.45,
  lipDominance: 0.45,
  coarticulationBefore: 0.4,
  coarticulationAfter: 0.45
} as const;

const poseByPhoneme: Partial<Record<SupportedPhoneme, PhonemePoseDefinition["pose"]>> = {
  SIL: {},
  SP: {},
  PAUSE: {},
  P: { mouthClose: 0.62, jawOpen: 0.02 },
  B: { mouthClose: 0.58, jawOpen: 0.02 },
  M: { mouthClose: 0.66, jawOpen: 0.015 },
  F: { mouthLowerDownLeft: 0.18, mouthLowerDownRight: 0.18, jawOpen: 0.06 },
  V: { mouthLowerDownLeft: 0.16, mouthLowerDownRight: 0.16, jawOpen: 0.055 },
  TH: { jawOpen: 0.1, mouthStretchLeft: 0.04, mouthStretchRight: 0.04 },
  DH: { jawOpen: 0.09, mouthStretchLeft: 0.035, mouthStretchRight: 0.035 },
  S: { jawOpen: 0.045, mouthStretchLeft: 0.08, mouthStretchRight: 0.08 },
  Z: { jawOpen: 0.04, mouthStretchLeft: 0.07, mouthStretchRight: 0.07 },
  SH: { jawOpen: 0.07, mouthFunnel: 0.1, mouthPucker: 0.04 },
  ZH: { jawOpen: 0.065, mouthFunnel: 0.09, mouthPucker: 0.035 },
  CH: { jawOpen: 0.08, mouthFunnel: 0.08, mouthPucker: 0.035 },
  JH: { jawOpen: 0.075, mouthFunnel: 0.07, mouthPucker: 0.03 },
  W: { jawOpen: 0.06, mouthPucker: 0.2, mouthFunnel: 0.12 },
  R: { jawOpen: 0.08, mouthPucker: 0.1, mouthFunnel: 0.08 },
  ER: { jawOpen: 0.13, mouthPucker: 0.09, mouthFunnel: 0.08 },
  UW: { jawOpen: 0.1, mouthPucker: 0.24, mouthFunnel: 0.16 },
  UH: { jawOpen: 0.14, mouthPucker: 0.11, mouthFunnel: 0.08 },
  OW: { jawOpen: 0.18, mouthPucker: 0.16, mouthFunnel: 0.16 },
  AO: { jawOpen: 0.24, mouthPucker: 0.08, mouthFunnel: 0.14 },
  OY: {
    jawOpen: 0.18,
    mouthPucker: 0.1,
    mouthFunnel: 0.12,
    mouthStretchLeft: 0.04,
    mouthStretchRight: 0.04
  },
  AW: { jawOpen: 0.26, mouthFunnel: 0.08 },
  AA: { jawOpen: 0.34, mouthLowerDownLeft: 0.08, mouthLowerDownRight: 0.08 },
  AE: {
    jawOpen: 0.28,
    mouthStretchLeft: 0.1,
    mouthStretchRight: 0.1,
    mouthLowerDownLeft: 0.08,
    mouthLowerDownRight: 0.08
  },
  AH: { jawOpen: 0.24, mouthLowerDownLeft: 0.06, mouthLowerDownRight: 0.06 },
  AY: { jawOpen: 0.26, mouthStretchLeft: 0.06, mouthStretchRight: 0.06 },
  IY: { jawOpen: 0.1, mouthStretchLeft: 0.18, mouthStretchRight: 0.18 },
  IH: { jawOpen: 0.13, mouthStretchLeft: 0.12, mouthStretchRight: 0.12 },
  EH: { jawOpen: 0.18, mouthStretchLeft: 0.09, mouthStretchRight: 0.09 },
  EY: { jawOpen: 0.16, mouthStretchLeft: 0.12, mouthStretchRight: 0.12 },
  Y: { jawOpen: 0.08, mouthStretchLeft: 0.1, mouthStretchRight: 0.1 },
  L: { jawOpen: 0.1, mouthStretchLeft: 0.04, mouthStretchRight: 0.04 },
  T: { jawOpen: 0.075, mouthClose: 0.08 },
  D: { jawOpen: 0.07, mouthClose: 0.06 },
  N: { jawOpen: 0.065, mouthClose: 0.06 },
  K: { jawOpen: 0.08, mouthClose: 0.04 },
  G: { jawOpen: 0.075, mouthClose: 0.035 },
  NG: { jawOpen: 0.06, mouthClose: 0.04 },
  HH: { jawOpen: 0.08 }
};

const categoryFor = (phoneme: SupportedPhoneme): PhonemePoseDefinition["category"] => {
  if (phoneme === "SIL" || phoneme === "SP" || phoneme === "PAUSE") return "silence";
  if (
    [
      "AA",
      "AE",
      "AH",
      "AO",
      "AW",
      "AY",
      "EH",
      "ER",
      "EY",
      "IH",
      "IY",
      "OW",
      "OY",
      "UH",
      "UW"
    ].includes(phoneme)
  )
    return "vowel";
  return "consonant";
};

const visemeFor = (phoneme: SupportedPhoneme) => {
  if (["SIL", "SP", "PAUSE"].includes(phoneme)) return "REST";
  if (["P", "B", "M"].includes(phoneme)) return "PP";
  if (["F", "V"].includes(phoneme)) return "FF";
  if (["TH", "DH"].includes(phoneme)) return "TH";
  if (["S", "Z"].includes(phoneme)) return "SS";
  if (["SH", "ZH", "CH", "JH"].includes(phoneme)) return "CH";
  if (["W", "UW", "UH"].includes(phoneme)) return "WQ";
  if (["R", "ER"].includes(phoneme)) return "RR";
  if (["OW", "AO", "OY", "AW"].includes(phoneme)) return "OH";
  if (["IY", "IH", "Y"].includes(phoneme)) return "EE";
  if (["EH", "EY"].includes(phoneme)) return "E";
  if (["AA", "AE", "AH", "AY"].includes(phoneme)) return "AA";
  if (["K", "G", "NG"].includes(phoneme)) return "KK";
  if (["T", "D", "N", "L"].includes(phoneme)) return "DD";
  return phoneme;
};

const makeNeutralDefinition = (phoneme: SupportedPhoneme): PhonemePoseDefinition => {
  const category = categoryFor(phoneme);
  return {
    phoneme,
    viseme: visemeFor(phoneme),
    category,
    pose: poseByPhoneme[phoneme] ?? { jawOpen: category === "vowel" ? 0.18 : 0.06 },
    attack: category === "silence" ? 0.06 : base.attack,
    holdBias: base.holdBias,
    release: category === "silence" ? 0.12 : base.release,
    defaultIntensity: category === "silence" ? 0 : base.defaultIntensity,
    intensityMin: base.intensityMin,
    intensityMax: base.intensityMax,
    jawDominance: category === "vowel" ? 0.65 : base.jawDominance,
    lipDominance: category === "vowel" ? 0.45 : base.lipDominance,
    coarticulationBefore: base.coarticulationBefore,
    coarticulationAfter: base.coarticulationAfter,
    notes:
      "Neutral comparison profile for Task 8 calibration bypass. It preserves timing while avoiding avatar-specific tuned weights."
  };
};

export const neutralSpeechProfile: Record<SupportedPhoneme, PhonemePoseDefinition> =
  Object.fromEntries(
    SUPPORTED_PHONEMES.map((phoneme) => [phoneme, makeNeutralDefinition(phoneme)])
  ) as Record<SupportedPhoneme, PhonemePoseDefinition>;
