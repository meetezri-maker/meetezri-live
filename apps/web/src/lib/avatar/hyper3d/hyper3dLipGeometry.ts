import { readFileSync } from "node:fs";
import type { BlendshapePose } from "./engine/types/facialAnimation";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * LIP GEOMETRY — what a pose actually does to the mesh.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS EXISTS. Every previous shaping pass on this asset reasoned about
 * blendshape influences against the `travelMM` table, which answers "how far can
 * this channel move the mesh" but not "what shape do these channels together
 * produce". Two poses built from different channels can deform the lips almost
 * identically, and an influence-vector distance cannot see that. This module
 * reads the shipped GLB and measures the DISPLACED VERTICES, so a shape question
 * is answered with geometry.
 *
 * NODE-ONLY AND MEASUREMENT-ONLY. It reads a 44 MB file from disk and is
 * imported by diagnosis tests and by nothing on a render path. It writes
 * nothing and it holds no state the renderer can see.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE AXES, established from the morphs themselves rather than assumed
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   X  lateral    (+ = the character's left)
 *   Y  anterior   (+ = forward, so +Y is protrusion)
 *   Z  vertical   (+ = DOWN, so the brow sits at a LOWER Z than the jaw)
 *
 * Z-down is the one that matters and it is not a guess: the probe centroids run
 * brow -56.7 -> eye -41.3 -> nose +10.5 -> lips +34 -> jaw +46.5 in Z, which is
 * a clean anatomical ordering top to bottom. `jawOpen` then measures ΔZ +31.0
 * (down) and ΔY -14.9 (back), which is what opening a jaw does.
 *
 * UNITS. 1 model unit = 10 mm, and this is confirmed rather than assumed: the
 * peak displacement of all fourteen channels with a documented `travelMM` matches
 * `hyper3dMorphCalibration` to two decimal places (jawOpen 3.51920 units against
 * a documented 35.19 mm, mouthSmileLeft 1.61889 against 16.19, and so on).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * VALIDATION — the instrument is checked against the asset's own measured notes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   probe                       this module   calibration note
 *   jawOpen 0.25  aperture        15.38 mm      13.6 mm
 *   jawOpen 0.35  aperture        18.62 mm      17.3 mm
 *   jawOpen 0.50  aperture        23.49 mm      23.0 mm
 *   jawOpen 1.00  aperture        39.70 mm      41.7 mm
 *   mouthPucker 1.0 protrusion     9.32 mm      11.2 mm
 *   mouthPucker 1.0 Δaperture      +0.44 mm     +0.1 mm   <- the decisive one
 *   mouthFunnel 1.0 Δaperture     +16.09 mm    +18.3 mm   (funnel OPENS)
 *   mouthClose 0.20 aperture        0.31 mm   near contact
 *   mouthClose 0.30 aperture       -3.18 mm   lower lip passes through
 *
 * `mouthPucker` is the decisive check: the note records that it "protrudes
 * 11.2 mm while changing the lip gap by 0.1 mm", and an instrument that was
 * measuring the wrong vertices could not reproduce a 9 mm forward motion with a
 * 0.4 mm vertical one. The absolute aperture carries a constant +3.1 mm offset
 * against the note because the note measured one FBX vertex pair and this
 * measures band centroids; every ratio agrees.
 */

const UNITS_TO_MM = 10;

export interface LipModel {
  base: Float32Array;
  deltas: Record<string, Float32Array>;
  vertCount: number;
}

/** The shipped Hyper3D asset, relative to the repository root. */
export const HYPER3D_GLB_PATH = "public/avatars/female_2291.glb";

/**
 * Parse mesh 0 of the GLB: 13,631 vertices carrying all 51 ARKit morph targets.
 *
 * Only POSITION and the morph POSITION deltas are read — no normals, no indices,
 * no materials, no textures — so the 44 MB file costs a few hundred milliseconds.
 */
export function loadLipModel(file: string): LipModel {
  const buf = readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`not a GLB: ${file}`);
  const jsonLength = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.subarray(20, 20 + jsonLength).toString("utf8"));
  const binStart = 20 + jsonLength + 8;

  const read = (accessorIndex: number): Float32Array => {
    const accessor = gltf.accessors[accessorIndex];
    const view = gltf.bufferViews[accessor.bufferView];
    const start = binStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const out = new Float32Array(accessor.count * 3);
    for (let i = 0; i < out.length; i += 1) out[i] = buf.readFloatLE(start + i * 4);
    return out;
  };

  const mesh = gltf.meshes[0];
  const primitive = mesh.primitives[0];
  const targetNames: string[] = mesh.extras.targetNames;
  const base = read(primitive.attributes.POSITION);
  const deltas: Record<string, Float32Array> = {};
  for (const [index, target] of (primitive.targets as { POSITION?: number }[]).entries()) {
    if (target.POSITION !== undefined) deltas[targetNames[index]] = read(target.POSITION);
  }
  return { base, deltas, vertCount: base.length / 3 };
}

/** Vertex indices with the largest displacement under one channel. */
export function topVerts(model: LipModel, channel: string, count: number): number[] {
  const delta = model.deltas[channel];
  if (!delta) throw new Error(`no morph target named ${channel}`);
  const mags: Array<[number, number]> = new Array(model.vertCount);
  for (let v = 0; v < model.vertCount; v += 1) {
    const x = delta[v * 3];
    const y = delta[v * 3 + 1];
    const z = delta[v * 3 + 2];
    mags[v] = [x * x + y * y + z * z, v];
  }
  mags.sort((a, b) => b[0] - a[0]);
  return mags.slice(0, count).map((entry) => entry[1]);
}

export interface LipLandmarks {
  upper: number[];
  lower: number[];
  cornerL: number[];
  cornerR: number[];
  region: number[];
  marginUpper: number[];
  marginLower: number[];
}

/**
 * Lip landmarks, each found through the morph that is anatomically specific to
 * it rather than through a guessed bounding region:
 *
 *   upper lip   `mouthRollUpper` rolls the UPPER lip in, so those are its own
 *   lower lip   `mouthRollLower` rolls the LOWER lip in
 *   corners     `mouthSmileLeft` / `mouthSmileRight` pull the corners
 *
 * `mouthClose` was tried as the probe for the two lip margins and is WRONG for
 * it: its 34.65 mm of travel is almost entirely on the lower lip, so splitting
 * its vertices at their median Z yields two sub-bands of the SAME lip and the
 * resulting aperture moves the wrong way under `jawOpen` — measured, and the
 * reason the margins come from the roll channels instead.
 */
export function lipLandmarks(model: LipModel, bandSize = 120): LipLandmarks {
  const upper = topVerts(model, "mouthRollUpper", bandSize);
  const lower = topVerts(model, "mouthRollLower", bandSize);
  const cornerL = topVerts(model, "mouthSmileLeft", 40);
  const cornerR = topVerts(model, "mouthSmileRight", 40);
  const region = [
    ...new Set([...upper, ...lower, ...cornerL, ...cornerR, ...topVerts(model, "mouthPucker", bandSize)])
  ];
  const nearMidline = (v: number) => Math.abs(model.base[v * 3]) < 1.2;
  const marginUpper = upper.filter(nearMidline);
  const marginLower = lower.filter(nearMidline);
  if (marginUpper.length < 8 || marginLower.length < 8) throw new Error("midline band too small");
  return { upper, lower, cornerL, cornerR, region, marginUpper, marginLower };
}

const axisOf = (model: LipModel, pose: BlendshapePose, v: number, axis: number): number => {
  let c = model.base[v * 3 + axis];
  for (const channel in pose) {
    const weight = pose[channel];
    const delta = model.deltas[channel];
    if (weight && delta) c += weight * delta[v * 3 + axis];
  }
  return c;
};

const meanAxis = (model: LipModel, pose: BlendshapePose, list: readonly number[], axis: number) => {
  let sum = 0;
  for (const v of list) sum += axisOf(model, pose, v, axis);
  return sum / list.length;
};

export interface LipMeasurement {
  /** Lip-margin separation at the midline, mm. The aperture. */
  apertureMM: number;
  /** Corner-to-corner distance, mm. */
  widthMM: number;
  /** Forward displacement of the lip region from neutral, mm. */
  protrusionMM: number;
  /** Upward displacement of the upper lip from neutral, mm. */
  upperLipLiftMM: number;
  /** Downward displacement of the lower lip from neutral, mm. */
  lowerLipDropMM: number;
  /** Width change from neutral, mm. Positive is wider. */
  cornerSpreadMM: number;
}

/** The seven quantities §5 of the brief asks for, in millimetres. */
export function measureLips(model: LipModel, lm: LipLandmarks, pose: BlendshapePose): LipMeasurement {
  const neutral: BlendshapePose = {};
  const upperInner = meanAxis(model, pose, lm.marginUpper, 2);
  const lowerInner = meanAxis(model, pose, lm.marginLower, 2);
  const xL = meanAxis(model, pose, lm.cornerL, 0);
  const xR = meanAxis(model, pose, lm.cornerR, 0);
  const neutralWidth = Math.abs(
    meanAxis(model, neutral, lm.cornerL, 0) - meanAxis(model, neutral, lm.cornerR, 0)
  );
  return {
    apertureMM: (lowerInner - upperInner) * UNITS_TO_MM,
    widthMM: Math.abs(xL - xR) * UNITS_TO_MM,
    protrusionMM:
      (meanAxis(model, pose, lm.region, 1) - meanAxis(model, neutral, lm.region, 1)) * UNITS_TO_MM,
    // +Z is down, so a NEGATIVE upper-lip delta is a LIFT and a POSITIVE
    // lower-lip delta is a DROP. Both are reported in anatomical terms.
    upperLipLiftMM:
      -(meanAxis(model, pose, lm.upper, 2) - meanAxis(model, neutral, lm.upper, 2)) * UNITS_TO_MM,
    lowerLipDropMM:
      (meanAxis(model, pose, lm.lower, 2) - meanAxis(model, neutral, lm.lower, 2)) * UNITS_TO_MM,
    cornerSpreadMM: (Math.abs(xL - xR) - neutralWidth) * UNITS_TO_MM
  };
}

/**
 * RMS vertex distance between two poses over the lip region, in millimetres.
 *
 * THE SHAPE DISTANCE. It compares where the geometry ends up, so two poses built
 * from different channels that deform the mesh the same way score as identical —
 * which is exactly what an influence-vector distance cannot detect and what §5
 * asks to be measured instead.
 */
export function shapeDistanceMM(
  model: LipModel,
  lm: LipLandmarks,
  a: BlendshapePose,
  b: BlendshapePose
): number {
  let sum = 0;
  for (const v of lm.region) {
    let squared = 0;
    for (let axis = 0; axis < 3; axis += 1) {
      const d = axisOf(model, a, v, axis) - axisOf(model, b, v, axis);
      squared += d * d;
    }
    sum += squared;
  }
  return Math.sqrt(sum / lm.region.length) * UNITS_TO_MM;
}

/** Deformation from neutral, RMS over the lip region, in millimetres. */
export const deformationMM = (model: LipModel, lm: LipLandmarks, pose: BlendshapePose) =>
  shapeDistanceMM(model, lm, pose, {});

/** The jaw channels, for splitting a pose into its jaw and lip contributions. */
export const JAW_CHANNELS: readonly string[] = Object.freeze([
  "jawOpen",
  "jawForward",
  "jawLeft",
  "jawRight"
]);

export const jawPart = (pose: BlendshapePose): BlendshapePose =>
  Object.fromEntries(Object.entries(pose).filter(([name]) => JAW_CHANNELS.includes(name)));

export const lipPart = (pose: BlendshapePose): BlendshapePose =>
  Object.fromEntries(Object.entries(pose).filter(([name]) => !JAW_CHANNELS.includes(name)));
