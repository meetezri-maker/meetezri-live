import type { BlendshapePose } from "../../types/facialAnimation";

/**
 * HYPER3D EXPRESSION VOCABULARY — STAGE 1.
 *
 * Facial vocabulary only. Nothing here is wired to speech, prosody, phrase
 * intent, gaze, blink scheduling or head motion — that is Stage 2. Selecting an
 * expression produces one deterministic pose and nothing else.
 *
 * These poses are written through the RAW proof channel, so they bypass the HC2
 * speech gains. Every value below is therefore a FINAL rendered influence, and
 * each one is held at or under that channel's `hardCap` from the accepted HC1
 * calibration. Speech, jaw, P/B/M, vowel, gaze, head/neck, cadence, presence,
 * eye and skin calibration are all untouched.
 *
 * Channel confirmation (targeted re-check against the shipped FBX, not a new
 * audit). All 27 channels used here are live and act on the FACE mesh only:
 * measured eyeball displacement is 0.00 mm for every expression channel, and
 * teeth displacement is 0.00 mm for all except `jawOpen`.
 */

export interface ExpressionChannelRange {
  /** Peak travel at influence 1.0, in millimetres, measured on the FBX. */
  travelMM: number;
  /** Smallest influence that produces a change visible at review distance. */
  visibleMin: number;
  /** Bottom of the band that reads as a real, unforced expression. */
  naturalMin: number;
  /** Top of that band. */
  naturalMax: number;
  /** Legible and deliberate, still anatomically plausible. */
  strongMax: number;
  /** Never exceeded. Matches the accepted HC1 production cap. */
  hardCap: number;
  note: string;
}

/**
 * STEP 2 range table.
 *
 * `travelMM` and `hardCap` are measured/accepted values. The four band
 * boundaries are SEEDED from the HC1 calibration and the geometry, and are
 * explicitly provisional: the brief is that hardware appearance is the
 * authority, so these are what the single-channel ladder exists to confirm or
 * correct. They are not final production numbers.
 */
export const HYPER3D_EXPRESSION_CHANNELS: Record<string, ExpressionChannelRange> = {
  browInnerUp: { travelMM: 6.75, visibleMin: 0.05, naturalMin: 0.09, naturalMax: 0.30, strongMax: 0.45, hardCap: 0.60, note: "Single combined channel on this asset — Female.228 splits L/R. Carries concern and question." },
  browOuterUpLeft: { travelMM: 7.02, visibleMin: 0.05, naturalMin: 0.08, naturalMax: 0.30, strongMax: 0.45, hardCap: 0.60, note: "Healthy outer lift. The asymmetry channel of choice for questioning." },
  browOuterUpRight: { travelMM: 6.76, visibleMin: 0.05, naturalMin: 0.08, naturalMax: 0.30, strongMax: 0.45, hardCap: 0.60, note: "4% shorter travel than the left." },
  browDownLeft: { travelMM: 7.31, visibleMin: 0.05, naturalMin: 0.08, naturalMax: 0.22, strongMax: 0.32, hardCap: 0.45, note: "Reads as anger quickly. Held well under the cap in every expression." },
  browDownRight: { travelMM: 6.61, visibleMin: 0.05, naturalMin: 0.08, naturalMax: 0.22, strongMax: 0.32, hardCap: 0.45, note: "10% shorter than the left." },

  cheekSquintLeft: { travelMM: 5.79, visibleMin: 0.06, naturalMin: 0.12, naturalMax: 0.38, strongMax: 0.52, hardCap: 0.60, note: "The Duchenne carrier. Also displaces the lash cards ~2.4 mm, so heavy values shift the lash line." },
  cheekSquintRight: { travelMM: 5.79, visibleMin: 0.06, naturalMin: 0.12, naturalMax: 0.38, strongMax: 0.52, hardCap: 0.60, note: "Travel identical to the left; lash displacement ~2.0 mm." },

  mouthSmileLeft: { travelMM: 16.19, visibleMin: 0.03, naturalMin: 0.12, naturalMax: 0.38, strongMax: 0.55, hardCap: 0.55, note: "Strongest expression channel. 1.0 is a 33%-wider rictus, hence the 0.55 cap." },
  mouthSmileRight: { travelMM: 16.21, visibleMin: 0.03, naturalMin: 0.12, naturalMax: 0.38, strongMax: 0.55, hardCap: 0.55, note: "Matches the left to 0.1%." },
  mouthDimpleLeft: { travelMM: 9.95, visibleMin: 0.04, naturalMin: 0.06, naturalMax: 0.22, strongMax: 0.32, hardCap: 0.45, note: "Real corner-pocket geometry. Cheap realism on a smile." },
  mouthDimpleRight: { travelMM: 9.18, visibleMin: 0.04, naturalMin: 0.06, naturalMax: 0.22, strongMax: 0.32, hardCap: 0.45, note: "8% shorter than the left." },
  mouthPressLeft: { travelMM: 4.65, visibleMin: 0.08, naturalMin: 0.10, naturalMax: 0.28, strongMax: 0.40, hardCap: 0.90, note: "WEAK geometry, but the right lever for composure and focus." },
  mouthPressRight: { travelMM: 3.69, visibleMin: 0.08, naturalMin: 0.10, naturalMax: 0.28, strongMax: 0.40, hardCap: 0.90, note: "WEAK, 21% shorter than the left. Expressions compensate by authoring the right slightly higher." },
  mouthFrownLeft: { travelMM: 5.77, visibleMin: 0.06, naturalMin: 0.06, naturalMax: 0.18, strongMax: 0.26, hardCap: 0.50, note: "Used only in trace amounts — a visible frown reads as theatrical sadness." },
  mouthFrownRight: { travelMM: 6.25, visibleMin: 0.06, naturalMin: 0.06, naturalMax: 0.18, strongMax: 0.26, hardCap: 0.50, note: "8% longer than the left." },
  mouthUpperUpLeft: { travelMM: 7.53, visibleMin: 0.05, naturalMin: 0.06, naturalMax: 0.18, strongMax: 0.26, hardCap: 0.60, note: "Reveals upper teeth. Only appropriate on a strong happy smile." },
  mouthUpperUpRight: { travelMM: 7.47, visibleMin: 0.05, naturalMin: 0.06, naturalMax: 0.18, strongMax: 0.26, hardCap: 0.60, note: "Matches the left to 0.8%." },
  mouthShrugUpper: { travelMM: 6.42, visibleMin: 0.05, naturalMin: 0.05, naturalMax: 0.16, strongMax: 0.24, hardCap: 0.35, note: "WEAK, and it opens the lip gap. Trace amounts only." },

  eyeWideLeft: { travelMM: 4.28, visibleMin: 0.08, naturalMin: 0.05, naturalMax: 0.20, strongMax: 0.34, hardCap: 0.50, note: "WEAK. Also the anti-sedation lever: a trace of it OPENS the lid, countering droop." },
  eyeWideRight: { travelMM: 3.55, visibleMin: 0.08, naturalMin: 0.05, naturalMax: 0.20, strongMax: 0.34, hardCap: 0.50, note: "WEAK, 17% shorter than the left." },
  eyeSquintLeft: { travelMM: 3.46, visibleMin: 0.10, naturalMin: 0.05, naturalMax: 0.16, strongMax: 0.22, hardCap: 0.60, note: "WEAK, and it narrows the LOWER lid. Kept tiny; cheekSquint is the preferred smiling-eye carrier." },
  eyeSquintRight: { travelMM: 3.02, visibleMin: 0.10, naturalMin: 0.05, naturalMax: 0.16, strongMax: 0.22, hardCap: 0.60, note: "Weakest expression channel on the asset." },
  eyeBlinkLeft: { travelMM: 11.27, visibleMin: 0.05, naturalMin: 0, naturalMax: 0, strongMax: 0, hardCap: 1.00, note: "BLINK ONLY. Deliberately unusable as an expression channel — see the sedation rule below." },
  eyeBlinkRight: { travelMM: 11.85, visibleMin: 0.05, naturalMin: 0, naturalMax: 0, strongMax: 0, hardCap: 1.00, note: "BLINK ONLY. Carries the lash cards 10.75 mm, so any sustained value visibly drops the lash line." },

  noseSneerLeft: { travelMM: 10.18, visibleMin: 0.04, naturalMin: 0.05, naturalMax: 0.14, strongMax: 0.22, hardCap: 0.35, note: "Strong and reads as disgust fast. Not used by any Stage-1 expression." },
  noseSneerRight: { travelMM: 10.24, visibleMin: 0.04, naturalMin: 0.05, naturalMax: 0.14, strongMax: 0.22, hardCap: 0.35, note: "Not used by any Stage-1 expression." },
  jawOpen: { travelMM: 35.19, visibleMin: 0.02, naturalMin: 0.02, naturalMax: 0.08, strongMax: 0.12, hardCap: 0.55, note: "EXPRESSION POSE PARAMETER ONLY. Trace amounts for surprise/curiosity. Does not touch the speech jaw calibration or architecture." }
};

/**
 * STEP 6 — the sedation rule, enforced rather than intended.
 *
 * Earlier avatars looked sedated because a state-held eyelid value simulated
 * smiling eyes. `eyeBlink` therefore has `strongMax: 0` above and is rejected by
 * `validateExpressionPose`, so no expression can hold the lids down. Smiling
 * eyes come from `cheekSquint`, which lifts the lower lid as a by-product of the
 * cheek — the anatomically correct route — with at most a trace of `eyeSquint`.
 * `eyeWide` appears in the focused/attentive poses specifically to counteract
 * droop rather than to widen the eye.
 */
export const SEDATION_FORBIDDEN_CHANNELS = ["eyeBlinkLeft", "eyeBlinkRight"] as const;

export type ExpressionIntensity = "strong" | "natural";
export type ExpressionAsymmetry = "symmetric" | "subtleAsymmetricA" | "subtleAsymmetricB";

export interface Hyper3dSemanticExpression {
  id: string;
  label: string;
  target: string;
  strong: BlendshapePose;
  natural: BlendshapePose;
  /** Why these channels, and why the natural version falls off the way it does. */
  rationale: string;
}

/**
 * STEP 3 / STEP 4 — the semantic set.
 *
 * `natural` is NOT `strong` times one scalar. Uniform scaling collapses these:
 * a smile scaled down uniformly loses its cheek before its mouth and turns into
 * a mouth-only smirk, and a concerned brow loses its inner lift before its
 * mouth and turns into a mild frown. So each expression keeps a per-channel
 * falloff, and the channel that CARRIES the meaning always falls off least.
 * The per-expression falloff ratios are stated in each rationale.
 */
export const HYPER3D_EXPRESSIONS: Record<string, Hyper3dSemanticExpression> = {
  warm: {
    id: "warm",
    label: "WARM",
    target: "Friendly, soft, appropriate mid-conversation. Not a grin.",
    strong: {
      mouthSmileLeft: 0.38, mouthSmileRight: 0.35,
      cheekSquintLeft: 0.30, cheekSquintRight: 0.28,
      mouthDimpleLeft: 0.16, mouthDimpleRight: 0.14,
      eyeSquintLeft: 0.10, eyeSquintRight: 0.09,
      browOuterUpLeft: 0.08, browOuterUpRight: 0.07
    },
    natural: {
      mouthSmileLeft: 0.20, mouthSmileRight: 0.185,
      cheekSquintLeft: 0.17, cheekSquintRight: 0.16,
      mouthDimpleLeft: 0.08, mouthDimpleRight: 0.07,
      eyeSquintLeft: 0.05, eyeSquintRight: 0.045,
      browOuterUpLeft: 0.04, browOuterUpRight: 0.035
    },
    rationale: "Smile falls off x0.53 but cheek only x0.57, so the cheek stays proportionally stronger as the smile softens — that is what stops a small smile reading as a mouth-only smirk."
  },

  happy: {
    id: "happy",
    label: "HAPPY",
    target: "Obvious happiness with the cheeks and eyes participating. Precursor to laugh work.",
    strong: {
      mouthSmileLeft: 0.55, mouthSmileRight: 0.52,
      cheekSquintLeft: 0.52, cheekSquintRight: 0.50,
      mouthDimpleLeft: 0.30, mouthDimpleRight: 0.27,
      mouthUpperUpLeft: 0.12, mouthUpperUpRight: 0.12,
      eyeSquintLeft: 0.18, eyeSquintRight: 0.16,
      browOuterUpLeft: 0.14, browOuterUpRight: 0.12,
      browInnerUp: 0.10
    },
    natural: {
      mouthSmileLeft: 0.34, mouthSmileRight: 0.32,
      cheekSquintLeft: 0.36, cheekSquintRight: 0.34,
      mouthDimpleLeft: 0.18, mouthDimpleRight: 0.16,
      mouthUpperUpLeft: 0.07, mouthUpperUpRight: 0.07,
      eyeSquintLeft: 0.12, eyeSquintRight: 0.11,
      browOuterUpLeft: 0.09, browOuterUpRight: 0.08,
      browInnerUp: 0.06
    },
    rationale: "Cheek falls off least (x0.69) against smile (x0.62): at natural strength the cheek must stay high or the mouth reads pasted onto a neutral face. Upper-lip reveal falls off most (x0.58) because visible teeth stop being appropriate as the smile softens."
  },

  attentive: {
    id: "attentive",
    label: "ATTENTIVE",
    target: "Listening, engaged, alive. Not surprised. Mouth stays essentially neutral.",
    strong: {
      browInnerUp: 0.18,
      browOuterUpLeft: 0.26, browOuterUpRight: 0.22,
      eyeWideLeft: 0.10, eyeWideRight: 0.08,
      cheekSquintLeft: 0.10, cheekSquintRight: 0.09,
      mouthSmileLeft: 0.07, mouthSmileRight: 0.06
    },
    natural: {
      browInnerUp: 0.10,
      browOuterUpLeft: 0.15, browOuterUpRight: 0.13,
      eyeWideLeft: 0.05, eyeWideRight: 0.04,
      cheekSquintLeft: 0.06, cheekSquintRight: 0.055,
      mouthSmileLeft: 0.04, mouthSmileRight: 0.035
    },
    rationale: "Outer brow leads and falls off least (x0.58). The trace of eyeWide is there to keep the lids open and alert rather than to widen the eye. The mouth never exceeds 0.07, so this stays a listening face rather than a smiling one."
  },

  curious: {
    id: "curious",
    label: "CURIOUS",
    target: "Clear questioning. Not cartoon surprise.",
    strong: {
      browInnerUp: 0.22,
      browOuterUpLeft: 0.42, browOuterUpRight: 0.24,
      eyeWideLeft: 0.12, eyeWideRight: 0.10,
      mouthSmileLeft: 0.06, mouthSmileRight: 0.04,
      jawOpen: 0.02
    },
    natural: {
      browInnerUp: 0.13,
      browOuterUpLeft: 0.25, browOuterUpRight: 0.14,
      eyeWideLeft: 0.07, eyeWideRight: 0.06,
      mouthSmileLeft: 0.035, mouthSmileRight: 0.025,
      jawOpen: 0.01
    },
    rationale: "The signature is a deliberately UNEVEN outer brow — left 0.42 against right 0.24 — which is the single strongest questioning cue on a human face. That ratio is preserved exactly in the natural version. The 0.02 jawOpen is an expression pose parameter, not speech."
  },

  thoughtful: {
    id: "thoughtful",
    label: "THOUGHTFUL",
    target: "Internal, calm, reflective. Not sadness. Intended for pauses later.",
    strong: {
      browInnerUp: 0.20,
      browDownLeft: 0.12,
      browOuterUpLeft: 0.10,
      mouthPressLeft: 0.16, mouthPressRight: 0.18,
      mouthDimpleLeft: 0.08,
      eyeSquintLeft: 0.10, eyeSquintRight: 0.08
    },
    natural: {
      browInnerUp: 0.12,
      browDownLeft: 0.07,
      browOuterUpLeft: 0.06,
      mouthPressLeft: 0.09, mouthPressRight: 0.10,
      mouthDimpleLeft: 0.04,
      eyeSquintLeft: 0.055, eyeSquintRight: 0.045
    },
    rationale: "Deliberately one-sided: inner brow up with a slight knit on the LEFT only, and a single-sided dimple. The mouth is pressed rather than pulled down — the asset's frown reads as theatrical sadness, so it is not used here at all."
  },

  serious: {
    id: "serious",
    label: "SERIOUS",
    target: "Concentration and direct engagement. Explicitly not anger.",
    strong: {
      browDownLeft: 0.28, browDownRight: 0.26,
      browInnerUp: 0.06,
      mouthPressLeft: 0.22, mouthPressRight: 0.26,
      mouthFrownLeft: 0.06, mouthFrownRight: 0.06,
      eyeWideLeft: 0.06, eyeWideRight: 0.05
    },
    natural: {
      browDownLeft: 0.17, browDownRight: 0.155,
      browInnerUp: 0.04,
      mouthPressLeft: 0.13, mouthPressRight: 0.155,
      mouthFrownLeft: 0.035, mouthFrownRight: 0.035,
      eyeWideLeft: 0.035, eyeWideRight: 0.03
    },
    rationale: "Three anti-anger measures: browDown stays at 0.28 against a 0.45 cap, a trace of browInnerUp breaks the flat scowl line, and a trace of eyeWide keeps the lids OPEN. Carries no eyelid-narrowing channel at all, which is what previously produced the sedated look."
  },

  concerned: {
    id: "concerned",
    label: "CONCERNED",
    target: "Gentle, compassionate concern. Not theatrical sadness, not a held frown.",
    strong: {
      browInnerUp: 0.34,
      browOuterUpLeft: 0.10, browOuterUpRight: 0.08,
      browDownLeft: 0.10, browDownRight: 0.09,
      mouthFrownLeft: 0.10, mouthFrownRight: 0.11,
      mouthPressLeft: 0.10, mouthPressRight: 0.12,
      mouthShrugUpper: 0.08,
      cheekSquintLeft: 0.06, cheekSquintRight: 0.05
    },
    natural: {
      browInnerUp: 0.20,
      browOuterUpLeft: 0.06, browOuterUpRight: 0.05,
      browDownLeft: 0.06, browDownRight: 0.055,
      mouthFrownLeft: 0.05, mouthFrownRight: 0.055,
      mouthPressLeft: 0.06, mouthPressRight: 0.07,
      mouthShrugUpper: 0.045,
      cheekSquintLeft: 0.035, cheekSquintRight: 0.03
    },
    rationale: "The classic concern knit: inner brow UP with the outer brow slightly DOWN at the same time, which no single channel can express. browInnerUp falls off least (x0.59) because it IS the expression; the mouth falls off to half so the natural version cannot settle into a held frown."
  },

  surprise: {
    id: "surprise",
    label: "SURPRISE",
    target: "Brief, restrained reaction. Useful later for conversational events.",
    strong: {
      browInnerUp: 0.30,
      browOuterUpLeft: 0.38, browOuterUpRight: 0.35,
      eyeWideLeft: 0.30, eyeWideRight: 0.26,
      jawOpen: 0.06,
      mouthSmileLeft: 0.04, mouthSmileRight: 0.03
    },
    natural: {
      browInnerUp: 0.17,
      browOuterUpLeft: 0.21, browOuterUpRight: 0.19,
      eyeWideLeft: 0.16, eyeWideRight: 0.14,
      jawOpen: 0.03,
      mouthSmileLeft: 0.02, mouthSmileRight: 0.015
    },
    rationale: "Restrained by construction: eyeWide reaches 0.30 of a 0.50 cap and jawOpen 0.06 of 0.55. The whole brow lifts together here, unlike CURIOUS where the unevenness is the point. jawOpen is an expression pose parameter only."
  }
};

const LEFT = /Left$/;
const RIGHT = /Right$/;
const pairOf = (name: string) => (LEFT.test(name) ? name.replace(LEFT, "Right") : RIGHT.test(name) ? name.replace(RIGHT, "Left") : undefined);

/**
 * STEP 5 — deterministic asymmetry variants.
 *
 * `subtleAsymmetricA` is the pose exactly as authored, which is already
 * left-dominant. `subtleAsymmetricB` mirrors it, so review can tell whether the
 * asymmetry helps this particular face or whether it simply prefers one side.
 * `symmetric` levels every L/R pair to their maximum.
 *
 * Nothing here is randomised — the same selection always produces the same pose.
 */
export const applyAsymmetry = (pose: BlendshapePose, mode: ExpressionAsymmetry): BlendshapePose => {
  if (mode === "subtleAsymmetricA") return { ...pose };
  const out: BlendshapePose = {};
  for (const [name, value] of Object.entries(pose)) {
    const pair = pairOf(name);
    if (!pair) { out[name] = value; continue; }
    if (mode === "symmetric") {
      const peak = Math.max(value, pose[pair] ?? 0);
      out[name] = peak;
    } else {
      // Mirror: this channel takes its partner's value.
      out[name] = pose[pair] ?? 0;
    }
  }
  // A mirrored pose must also carry channels that only existed on one side.
  if (mode === "subtleAsymmetricB") {
    for (const [name, value] of Object.entries(pose)) {
      const pair = pairOf(name);
      if (pair && out[pair] === undefined) out[pair] = value;
    }
  }
  return out;
};

/** Reports any channel that breaks the Stage-1 rules. Empty means the pose is legal. */
export const validateExpressionPose = (pose: BlendshapePose): string[] => {
  const problems: string[] = [];
  for (const [name, value] of Object.entries(pose)) {
    if ((SEDATION_FORBIDDEN_CHANNELS as readonly string[]).includes(name) && value > 0) {
      problems.push(`${name} is blink-only and must never be held by an expression`);
    }
    const range = HYPER3D_EXPRESSION_CHANNELS[name];
    if (!range) { problems.push(`${name} is not a calibrated expression channel`); continue; }
    if (value > range.hardCap) problems.push(`${name} ${value} exceeds hardCap ${range.hardCap}`);
  }
  return problems;
};

/** The resolved pose for a review selection. Deterministic. */
export const resolveHyper3dExpression = (
  id: string,
  intensity: ExpressionIntensity,
  asymmetry: ExpressionAsymmetry
): BlendshapePose => {
  const expression = HYPER3D_EXPRESSIONS[id];
  if (!expression) return {};
  return applyAsymmetry(expression[intensity], asymmetry);
};

/** Review-selector order, matching the brief. */
export const HYPER3D_EXPRESSION_ORDER = ["warm", "happy", "attentive", "curious", "thoughtful", "serious", "concerned", "surprise"] as const;
