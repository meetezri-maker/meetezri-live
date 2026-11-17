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
  /**
   * Which mesh and primitive the model was read from. Optional so a hand-built
   * model still satisfies the type; `loadLipModel` always fills it.
   */
  source?: LipModelSource;
}

export interface LipModelSource {
  file: string;
  meshIndex: number;
  meshName: string;
  primitiveIndex: number;
  /** Morph targets on the chosen primitive, in GLB order. */
  targetNames: string[];
  /** How many POSITION or morph accessors on it were sparse. */
  sparseAccessors: number;
}

/** The shipped Hyper3D asset, relative to the repository root. */
export const HYPER3D_GLB_PATH = "public/avatars/female_2291.glb";

/**
 * Original Romy — `arfv2.glb`, the file behind the `sarah` companion. Her face
 * is split into TWO primitives (10,415 + 1,099 vertices), and primitive 0 is the
 * small one, so the historical "mesh 0, primitive 0" rule reads the wrong part
 * of her face. `loadLipModel` selects the face primitive instead.
 */
export const HYPER3D_ROMY_GLB_PATH = "public/avatars/hyper3d/arfv2.glb";

/** A face primitive must carry at least this many morphs, `jawOpen` among them. */
const FACE_PRIMITIVE_MIN_TARGETS = 40;

export interface LoadLipModelOptions {
  /** Force a mesh. Omitted: the face primitive is selected automatically. */
  meshIndex?: number;
  /** Force a primitive of `meshIndex`. Requires `meshIndex`. */
  primitiveIndex?: number;
}

type GltfAccessor = {
  bufferView?: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: string;
  sparse?: {
    count: number;
    indices: { bufferView: number; byteOffset?: number; componentType: number };
    values: { bufferView: number; byteOffset?: number };
  };
};
type GltfPrimitive = { attributes: { POSITION: number }; targets?: { POSITION?: number }[] };
type GltfMesh = { name?: string; primitives: GltfPrimitive[]; extras?: { targetNames?: string[] } };

const FLOAT = 5126;

/**
 * Parse the FACE primitive of a GLB: the one carrying the ARKit morph set.
 *
 * Only POSITION and the morph POSITION deltas are read — no normals, no indices,
 * no materials, no textures — so the 44 MB file costs a few hundred milliseconds.
 *
 * SELECTION. Unless forced, the face is the primitive with at least
 * `FACE_PRIMITIVE_MIN_TARGETS` morphs including `jawOpen`, and among those the one
 * with the most vertices. On `female_2291.glb` that is mesh 0 / primitive 0 — the
 * exact part every earlier measurement read — so existing callers see the same
 * model. On the per-companion exports it is whichever primitive actually holds
 * the lips, which is not always primitive 0.
 *
 * ACCESSORS. Chunks are walked rather than assumed, `byteStride` is honoured, and
 * sparse accessors are applied on top of their (possibly absent) dense base, as
 * glTF 2.0 §3.6.2.3 specifies. Only float VEC3 data is accepted; anything else
 * throws rather than being read as the wrong type.
 */
export function loadLipModel(file: string, options: LoadLipModelOptions = {}): LipModel {
  const buf = readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`not a GLB: ${file}`);
  let gltf: { accessors: GltfAccessor[]; bufferViews: { byteOffset?: number; byteStride?: number }[]; meshes: GltfMesh[] } | null = null;
  let binStart = -1;
  for (let offset = 12; offset + 8 <= buf.length; ) {
    const length = buf.readUInt32LE(offset);
    const type = buf.readUInt32LE(offset + 4);
    if (type === 0x4e4f534a) gltf = JSON.parse(buf.subarray(offset + 8, offset + 8 + length).toString("utf8"));
    else if (type === 0x004e4942 && binStart < 0) binStart = offset + 8;
    offset += 8 + length;
  }
  if (!gltf) throw new Error(`no JSON chunk: ${file}`);
  if (binStart < 0) throw new Error(`no BIN chunk: ${file}`);
  const json = gltf;
  let sparseAccessors = 0;

  const read = (accessorIndex: number): Float32Array => {
    const accessor = json.accessors[accessorIndex];
    if (accessor.type !== "VEC3" || accessor.componentType !== FLOAT) {
      throw new Error(`accessor ${accessorIndex} is ${accessor.type}/${accessor.componentType}, expected float VEC3`);
    }
    const out = new Float32Array(accessor.count * 3);
    if (accessor.bufferView !== undefined) {
      const view = json.bufferViews[accessor.bufferView];
      const stride = view.byteStride ?? 12;
      const start = binStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
      for (let v = 0; v < accessor.count; v += 1) {
        for (let axis = 0; axis < 3; axis += 1) out[v * 3 + axis] = buf.readFloatLE(start + v * stride + axis * 4);
      }
    }
    const sparse = accessor.sparse;
    if (sparse) {
      sparseAccessors += 1;
      const indexView = json.bufferViews[sparse.indices.bufferView];
      const valueView = json.bufferViews[sparse.values.bufferView];
      const indexStart = binStart + (indexView.byteOffset ?? 0) + (sparse.indices.byteOffset ?? 0);
      const valueStart = binStart + (valueView.byteOffset ?? 0) + (sparse.values.byteOffset ?? 0);
      const kind = sparse.indices.componentType;
      for (let k = 0; k < sparse.count; k += 1) {
        const vertex =
          kind === 5125
            ? buf.readUInt32LE(indexStart + k * 4)
            : kind === 5123
              ? buf.readUInt16LE(indexStart + k * 2)
              : kind === 5121
                ? buf.readUInt8(indexStart + k)
                : Number.NaN;
        if (!Number.isInteger(vertex)) throw new Error(`sparse index type ${kind} unsupported`);
        for (let axis = 0; axis < 3; axis += 1) out[vertex * 3 + axis] = buf.readFloatLE(valueStart + (k * 3 + axis) * 4);
      }
    }
    return out;
  };

  const isFace = (mesh: GltfMesh, primitive: GltfPrimitive) =>
    (primitive.targets?.length ?? 0) >= FACE_PRIMITIVE_MIN_TARGETS &&
    (mesh.extras?.targetNames ?? []).includes("jawOpen");

  let meshIndex = -1;
  let primitiveIndex = -1;
  if (options.meshIndex !== undefined) {
    meshIndex = options.meshIndex;
    primitiveIndex = options.primitiveIndex ?? 0;
  } else {
    let bestCount = -1;
    json.meshes.forEach((mesh, m) =>
      mesh.primitives.forEach((primitive, p) => {
        if (!isFace(mesh, primitive)) return;
        const count = json.accessors[primitive.attributes.POSITION].count;
        if (count > bestCount) {
          bestCount = count;
          meshIndex = m;
          primitiveIndex = p;
        }
      })
    );
  }
  const mesh = json.meshes[meshIndex];
  const primitive = mesh?.primitives[primitiveIndex];
  if (!mesh || !primitive?.targets) throw new Error(`no face primitive with morph targets in ${file}`);
  const targetNames: string[] = mesh.extras?.targetNames ?? [];
  const base = read(primitive.attributes.POSITION);
  const deltas: Record<string, Float32Array> = {};
  for (const [index, target] of primitive.targets.entries()) {
    if (target.POSITION !== undefined) deltas[targetNames[index]] = read(target.POSITION);
  }
  return {
    base,
    deltas,
    vertCount: base.length / 3,
    source: {
      file,
      meshIndex,
      meshName: mesh.name ?? `mesh ${meshIndex}`,
      primitiveIndex,
      targetNames: [...targetNames],
      sparseAccessors
    }
  };
}

/**
 * THE FRAME CHECK. `measureLips` assumes X lateral, Y anterior, Z DOWN and 10 mm
 * per unit — established on `female_2291`. Before trusting any other asset's
 * numbers, read that frame back off its own `jawOpen`: the vertex `jawOpen`
 * moves most must go DOWN (+Z) and BACK (-Y), and its travel gives the unit.
 */
export interface LipFrameCheck {
  /** Peak `jawOpen` vertex travel, in the asset's own units. */
  jawTravelUnits: number;
  /** Mean displacement of the 50 most-moved `jawOpen` vertices, per axis. */
  jawMeanDelta: [number, number, number];
  /** True when +Z is down and -Y is back, as `measureLips` assumes. */
  axesMatch: boolean;
  /** Half the corner-to-corner distance at rest, in asset units. */
  mouthHalfWidthUnits: number;
}

export function checkLipFrame(model: LipModel): LipFrameCheck {
  const jaw = model.deltas.jawOpen;
  if (!jaw) throw new Error("no jawOpen target");
  const top = topVerts(model, "jawOpen", 50);
  const mean: [number, number, number] = [0, 0, 0];
  for (const v of top) for (let axis = 0; axis < 3; axis += 1) mean[axis] += jaw[v * 3 + axis] / top.length;
  let peak = 0;
  for (let v = 0; v < model.vertCount; v += 1) {
    peak = Math.max(peak, Math.hypot(jaw[v * 3], jaw[v * 3 + 1], jaw[v * 3 + 2]));
  }
  const cornerL = topVerts(model, "mouthSmileLeft", 40);
  const cornerR = topVerts(model, "mouthSmileRight", 40);
  const meanX = (list: number[]) => list.reduce((sum, v) => sum + model.base[v * 3], 0) / list.length;
  return {
    jawTravelUnits: peak,
    jawMeanDelta: mean,
    axesMatch: mean[2] > 0 && mean[1] < 0 && Math.abs(mean[2]) > Math.abs(mean[0]),
    mouthHalfWidthUnits: Math.abs(meanX(cornerL) - meanX(cornerR)) / 2
  };
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
