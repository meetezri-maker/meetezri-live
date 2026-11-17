import {
  checkLipFrame,
  lipLandmarks,
  loadLipModel,
  measureLips,
  type LipFrameCheck,
  type LipMeasurement,
  type LipModelSource
} from "./hyper3dLipGeometry";
import { hyper3dPhonemeToBlendshape } from "./engine/mappings/phonemeToBlendshape";
import { calibrateHyper3dMorph, calibrateHyper3dPose } from "./engine/mappings/avatars/hyper3dCalibration";
import type { BlendshapePose } from "./engine/types/facialAnimation";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * STAGE 2, STEP 1 — THE LIP-GEOMETRY BASELINE. MEASUREMENT ONLY.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * What the CURRENT production phoneme table does to each Hyper3D face, measured
 * on the mesh. Nothing here is on a render path: it is imported by tests only,
 * it reads GLBs from disk through `hyper3dLipGeometry`, and it writes nothing.
 *
 * THE POSE MEASURED for a phoneme is its STATIC APEX: the shipped
 * `hyper3dPhonemeToBlendshape` pose x `defaultIntensity`, through the real
 * `calibrateHyper3dPose` — the same construction `hyper3dShapeRefinement` and
 * `hyper3dShapeDiagnosis` use. Diphthongs are measured at `pose`, which the glide
 * table defines as their temporal midpoint. Coarticulation, the follower and the
 * expression layers are deliberately NOT applied: this is the shape each label
 * asks for, not what a given sentence renders.
 *
 * SCENARIOS add the two frame situations the Stage 2 audit identified for the
 * bilabials, built from constants that exist in the runtime rather than invented:
 *
 *   residual jaw   `FacialPoseMixer.combine` caps `jawOpen` at 0.08 (pre-
 *                  calibration) whenever `mouthClose` > 0.65 — i.e. the most jaw
 *                  a sealing frame may still carry.
 *   seal lead      `BILABIAL_SEAL_LEVEL` 0.7 on `mouthClose` alone, which is what
 *                  the lead-in writes while the previous sound still owns the jaw.
 *
 * UNITS. Asset-local millimetres (1 unit = 10 mm, the convention the instrument
 * was validated against on `female_2291`). Each companion is rendered with its
 * own node/adapter scale, so cross-avatar comparisons should use the deltas
 * from each face's own rest, not the absolute values.
 */

/** Every phoneme in the shipped Hyper3D table that is not silence, in a fixed order. */
export const LIP_BASELINE_PHONEMES = [
  "AA", "AE", "AH", "AO", "AW", "AY", "OY", "EH", "EY", "IH", "IY",
  "ER", "OW", "UH", "UW",
  "P", "B", "M", "F", "V", "TH", "DH", "T", "D", "N", "NG", "K", "G",
  "S", "Z", "SH", "ZH", "CH", "JH", "L", "R", "W", "Y", "HH"
] as const;

/** The seven Hyper3D companion files, plus the calibration's own reference asset. */
export const LIP_BASELINE_ASSETS = {
  /** The asset `hyper3dMorphCalibration` was measured on. Reference only. */
  female_2291: "public/avatars/female_2291.glb",
  /** Original Romy (`sarah`). */
  hyper3d_arfv2: "public/avatars/hyper3d/arfv2.glb",
  hyper3d_sara: "public/avatars/hyper3d/sara.glb",
  hyper3d_frankie: "public/avatars/hyper3d/frankie.glb",
  hyper3d_jordan: "public/avatars/hyper3d/jordan.glb",
  hyper3d_bianca: "public/avatars/hyper3d/bianca.glb",
  hyper3d_damian: "public/avatars/hyper3d/damian.glb",
  hyper3d_sasha: "public/avatars/hyper3d/sasha.glb"
} as const;

export type LipBaselineAssetId = keyof typeof LIP_BASELINE_ASSETS;

/**
 * `FacialPoseMixer.combine`: `if (mouthClose > .65) jawOpen = min(jawOpen, .08)`.
 * Mirrored here as a measurement input; the mixer itself is not imported or
 * changed. A test pins that the literal is still in the mixer source.
 */
export const MIXER_SEAL_JAW_CAP = 0.08;
/** `CoarticulationEngine.BILABIAL_SEAL_LEVEL`, mirrored for the same reason. */
export const SEAL_LEAD_LEVEL = 0.7;

type Definition = { pose: BlendshapePose; defaultIntensity: number };
const definitionOf = (phoneme: string): Definition | undefined =>
  (hyper3dPhonemeToBlendshape as unknown as Record<string, Definition>)[phoneme];

/** The static apex pose of one phoneme: pose x defaultIntensity, then calibrated. */
export function staticApexPose(phoneme: string): BlendshapePose {
  const definition = definitionOf(phoneme);
  if (!definition) throw new Error(`phoneme ${phoneme} is not in the Hyper3D table`);
  const scaled: BlendshapePose = {};
  for (const [name, value] of Object.entries(definition.pose)) {
    if (value > 0) scaled[name] = value * definition.defaultIntensity;
  }
  return calibrateHyper3dPose(scaled);
}

/** Calibrated influences of the two bilabial frame scenarios. */
export const residualSealJaw = () => calibrateHyper3dMorph("jawOpen", MIXER_SEAL_JAW_CAP);
export const sealLeadClose = () => calibrateHyper3dMorph("mouthClose", SEAL_LEAD_LEVEL);

/** Named poses beyond the phoneme apexes. All are calibrated influences. */
export function lipBaselineScenarios(): Record<string, BlendshapePose> {
  const jaw = residualSealJaw();
  const withJaw = (phoneme: string) => ({
    ...staticApexPose(phoneme),
    jawOpen: Math.max(staticApexPose(phoneme).jawOpen ?? 0, jaw)
  });
  return {
    "P + residual seal jaw": withJaw("P"),
    "B + residual seal jaw": withJaw("B"),
    "M + residual seal jaw": withJaw("M"),
    "seal lead only (close 0.7) + residual jaw": { mouthClose: sealLeadClose(), jawOpen: jaw },
    "seal lead only (close 0.7), jaw closed": { mouthClose: sealLeadClose() },
    "mouthClose 0.05": { mouthClose: 0.05 },
    "mouthClose 0.10": { mouthClose: 0.1 },
    "mouthClose 0.12": { mouthClose: 0.12 },
    "mouthClose 0.15": { mouthClose: 0.15 },
    "mouthClose 0.18 (cap)": { mouthClose: 0.18 }
  };
}

/** One row: [aperture, width, protrusion, upperLipLift, lowerLipDrop], mm, 2 dp. */
export type LipRow = readonly [number, number, number, number, number];

export const LIP_ROW_FIELDS = [
  "apertureMM",
  "widthMM",
  "protrusionMM",
  "upperLipLiftMM",
  "lowerLipDropMM"
] as const satisfies readonly (keyof LipMeasurement)[];

const round2 = (value: number) => Math.round(value * 100) / 100 + 0;
const toRow = (m: LipMeasurement): LipRow =>
  [round2(m.apertureMM), round2(m.widthMM), round2(m.protrusionMM), round2(m.upperLipLiftMM), round2(m.lowerLipDropMM)];

export interface LipBaseline {
  source: Pick<LipModelSource, "meshIndex" | "meshName" | "primitiveIndex" | "sparseAccessors"> & { vertCount: number };
  frame: { jawTravelUnits: number; axesMatch: boolean };
  rest: LipRow;
  phonemes: Record<string, LipRow>;
  scenarios: Record<string, LipRow>;
}

/** Measure one GLB. Deterministic: same file and same tables give the same rows. */
export function measureLipBaseline(file: string): LipBaseline & { frameCheck: LipFrameCheck } {
  const model = loadLipModel(file);
  const lm = lipLandmarks(model);
  const frameCheck = checkLipFrame(model);
  const phonemes: Record<string, LipRow> = {};
  for (const phoneme of LIP_BASELINE_PHONEMES) phonemes[phoneme] = toRow(measureLips(model, lm, staticApexPose(phoneme)));
  const scenarios: Record<string, LipRow> = {};
  for (const [name, pose] of Object.entries(lipBaselineScenarios())) scenarios[name] = toRow(measureLips(model, lm, pose));
  return {
    source: {
      meshIndex: model.source!.meshIndex,
      meshName: model.source!.meshName,
      primitiveIndex: model.source!.primitiveIndex,
      sparseAccessors: model.source!.sparseAccessors,
      vertCount: model.vertCount
    },
    frame: { jawTravelUnits: Math.round(frameCheck.jawTravelUnits * 1e4) / 1e4, axesMatch: frameCheck.axesMatch },
    rest: toRow(measureLips(model, lm, {})),
    phonemes,
    scenarios,
    frameCheck
  };
}
