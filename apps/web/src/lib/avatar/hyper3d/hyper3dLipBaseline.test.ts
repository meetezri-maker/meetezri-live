import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkLipFrame, loadLipModel, HYPER3D_GLB_PATH, HYPER3D_ROMY_GLB_PATH } from "./hyper3dLipGeometry";
import {
  LIP_BASELINE_ASSETS,
  LIP_BASELINE_PHONEMES,
  MIXER_SEAL_JAW_CAP,
  SEAL_LEAD_LEVEL,
  measureLipBaseline,
  type LipBaselineAssetId,
  type LipRow
} from "./hyper3dLipBaseline";
import { HYPER3D_LIP_BASELINE } from "./hyper3dLipBaseline.fixture";
import { BILABIAL_SEAL_LEVEL } from "./engine/engine/lipsync/CoarticulationEngine";

/**
 * STAGE 2, STEP 1 — LIP-GEOMETRY BASELINE. MEASUREMENT ONLY.
 *
 * Re-measures every Hyper3D face against `hyper3dLipBaseline.fixture.ts`. The
 * fixture is the "before" column for Stage 2: it is never rewritten by this
 * test, and nothing here writes a snapshot.
 *
 * The "DOCUMENTED LIMITATIONS" block asserts CURRENT behaviour the Stage 2 audit
 * found, so that each one is reproducible from the repository. Those assertions
 * are expected to flip when an approved Stage 2 step changes the shape — and
 * that is the point: the change then shows up here as a measured difference
 * rather than an impression.
 */

const ASSET_IDS = Object.keys(LIP_BASELINE_ASSETS) as LipBaselineAssetId[];
const available = ASSET_IDS.filter((id) => existsSync(LIP_BASELINE_ASSETS[id]));
const romyAvailable = existsSync(HYPER3D_ROMY_GLB_PATH);
const describeRomy = romyAvailable ? describe : describe.skip;

/** Rows are rounded to 2 dp, so any real change is at least 0.01 mm. */
const TOLERANCE_MM = 0.0051;
const FIELDS = ["aperture", "width", "protrusion", "upperLipLift", "lowerLipDrop"] as const;

const measured = new Map<LipBaselineAssetId, ReturnType<typeof measureLipBaseline>>();
const measure = (id: LipBaselineAssetId) => {
  let result = measured.get(id);
  if (!result) {
    result = measureLipBaseline(LIP_BASELINE_ASSETS[id]);
    measured.set(id, result);
  }
  return result;
};

const rowDiffs = (label: string, actual: LipRow, expected: LipRow) =>
  FIELDS.flatMap((field, i) =>
    Math.abs(actual[i] - expected[i]) > TOLERANCE_MM ? [`${label}.${field}: ${actual[i]} != ${expected[i]}`] : []
  );

describe("lip geometry loader", () => {
  describeRomy("original Romy (arfv2.glb)", () => {
    it("selects the 10,415-vertex face primitive, not mesh 0 / primitive 0", () => {
      const model = loadLipModel(HYPER3D_ROMY_GLB_PATH);
      expect(model.source).toMatchObject({ meshIndex: 0, primitiveIndex: 1, meshName: "blendshapes.001" });
      expect(model.vertCount).toBe(10415);
      expect(model.source!.targetNames).toHaveLength(51);
      // The primitive the old rule read is the small 1,099-vertex patch.
      expect(loadLipModel(HYPER3D_ROMY_GLB_PATH, { meshIndex: 0, primitiveIndex: 0 }).vertCount).toBe(1099);
    });

    it("reads Romy in the instrument's frame: +Z down, -Y back, 35.19 mm of jaw", () => {
      const frame = checkLipFrame(loadLipModel(HYPER3D_ROMY_GLB_PATH));
      expect(frame.axesMatch).toBe(true);
      expect(frame.jawTravelUnits * 10).toBeCloseTo(35.19, 2);
    });
  });

  (existsSync(HYPER3D_GLB_PATH) ? it : it.skip)(
    "is unchanged on female_2291: automatic selection IS mesh 0 / primitive 0, value for value",
    () => {
      const auto = loadLipModel(HYPER3D_GLB_PATH);
      const forced = loadLipModel(HYPER3D_GLB_PATH, { meshIndex: 0, primitiveIndex: 0 });
      expect(auto.source).toMatchObject({ meshIndex: 0, primitiveIndex: 0 });
      expect(auto.vertCount).toBe(13631);
      expect(Buffer.from(auto.base.buffer).equals(Buffer.from(forced.base.buffer))).toBe(true);
      for (const name of Object.keys(forced.deltas)) {
        expect(Buffer.from(auto.deltas[name].buffer).equals(Buffer.from(forced.deltas[name].buffer))).toBe(true);
      }
    }
  );

  it("reads sparse morph accessors and strided views per glTF 2.0", () => {
    // A 3-vertex primitive: strided POSITION, one sparse target with no dense
    // base, one sparse target ON TOP of a dense base.
    const floats = (values: number[]) => Buffer.from(new Float32Array(values).buffer);
    const strided = Buffer.alloc(3 * 16);
    [[0, 1, 2], [3, 4, 5], [6, 7, 8]].forEach((v, i) => floats(v).copy(strided, i * 16));
    const denseBase = floats([1, 1, 1, 1, 1, 1, 1, 1, 1]);
    const sparseIdxA = Buffer.from(new Uint16Array([0, 2]).buffer);
    const sparseValA = floats([-1, -2, -3, 9, 9, 9]);
    const sparseIdxB = Buffer.from(new Uint8Array([1, 0, 0, 0]).buffer);
    const sparseValB = floats([5, 5, 5]);
    const parts = [strided, denseBase, sparseIdxA, sparseValA, sparseIdxB, sparseValB];
    const views: { byteOffset: number; byteLength: number; byteStride?: number }[] = [];
    let offset = 0;
    for (const part of parts) {
      views.push({ byteOffset: offset, byteLength: part.length });
      offset += part.length;
    }
    views[0].byteStride = 16;
    const bin = Buffer.concat(parts);
    const json = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: bin.length }],
      bufferViews: views.map((v) => ({ buffer: 0, ...v })),
      accessors: [
        { bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
        { componentType: 5126, count: 3, type: "VEC3", sparse: { count: 2, indices: { bufferView: 2, componentType: 5123 }, values: { bufferView: 3 } } },
        { bufferView: 1, componentType: 5126, count: 3, type: "VEC3", sparse: { count: 1, indices: { bufferView: 4, componentType: 5121 }, values: { bufferView: 5 } } }
      ],
      meshes: [{ name: "probe", extras: { targetNames: ["a", "b"] }, primitives: [{ attributes: { POSITION: 0 }, targets: [{ POSITION: 1 }, { POSITION: 2 }] }] }]
    };
    const pad = (b: Buffer, fill: number) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4, fill)]);
    const jsonChunk = pad(Buffer.from(JSON.stringify(json)), 0x20);
    const binChunk = pad(bin, 0);
    const header = Buffer.alloc(12);
    header.writeUInt32LE(0x46546c67, 0);
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);
    const chunk = (type: number, body: Buffer) => {
      const h = Buffer.alloc(8);
      h.writeUInt32LE(body.length, 0);
      h.writeUInt32LE(type, 4);
      return Buffer.concat([h, body]);
    };
    const dir = mkdtempSync(join(tmpdir(), "lipgeo-"));
    try {
      const file = join(dir, "probe.glb");
      writeFileSync(file, Buffer.concat([header, chunk(0x4e4f534a, jsonChunk), chunk(0x004e4942, binChunk)]));
      const model = loadLipModel(file, { meshIndex: 0, primitiveIndex: 0 });
      expect([...model.base]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
      expect([...model.deltas.a]).toEqual([-1, -2, -3, 0, 0, 0, 9, 9, 9]);
      expect([...model.deltas.b]).toEqual([1, 1, 1, 5, 5, 5, 1, 1, 1]);
      expect(model.source!.sparseAccessors).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("recorded baseline — every Hyper3D face against the fixture", () => {
  it("covers the reference asset and all seven companion files", () => {
    expect(ASSET_IDS).toHaveLength(8);
    expect(Object.keys(HYPER3D_LIP_BASELINE).sort()).toEqual([...ASSET_IDS].sort());
  });

  for (const id of ASSET_IDS) {
    (available.includes(id) ? it : it.skip)(`${id}: geometry reproduces the recorded baseline`, () => {
      const actual = measure(id);
      const expected = HYPER3D_LIP_BASELINE[id];
      expect(actual.source).toEqual(expected.source);
      expect(actual.frame).toEqual(expected.frame);
      expect(actual.frameCheck.axesMatch).toBe(true);
      const diffs = [
        ...rowDiffs("rest", actual.rest, expected.rest),
        ...LIP_BASELINE_PHONEMES.flatMap((p) => rowDiffs(p, actual.phonemes[p], expected.phonemes[p])),
        ...Object.keys(expected.scenarios).flatMap((s) => rowDiffs(s, actual.scenarios[s], expected.scenarios[s]))
      ];
      expect(Object.keys(actual.phonemes)).toEqual([...LIP_BASELINE_PHONEMES]);
      expect(Object.keys(actual.scenarios)).toEqual(Object.keys(expected.scenarios));
      expect(diffs).toEqual([]);
    });
  }

  it("is deterministic — measuring the same file twice gives identical rows", () => {
    if (!romyAvailable) return;
    const a = measureLipBaseline(HYPER3D_ROMY_GLB_PATH);
    const b = measureLipBaseline(HYPER3D_ROMY_GLB_PATH);
    expect({ ...a, frameCheck: null }).toEqual({ ...b, frameCheck: null });
  });
});

/**
 * DOCUMENTED LIMITATIONS — current behaviour, asserted on every face.
 * Aperture deltas are against each face's OWN rest (the instrument carries a
 * constant band-centroid offset, so deltas are what compare across faces).
 */
describe("documented limitations of the current shapes (Stage 2 audit)", () => {
  const dAperture = (id: LipBaselineAssetId, row: LipRow) => row[0] - HYPER3D_LIP_BASELINE[id].rest[0];

  for (const id of ASSET_IDS) {
    it(`${id}: F and V open the lips and DROP the lower lip, away from the upper teeth`, () => {
      const base = HYPER3D_LIP_BASELINE[id];
      for (const p of ["F", "V"] as const) {
        expect(dAperture(id, base.phonemes[p])).toBeGreaterThan(3); // wider than rest by > 3 mm
        expect(base.phonemes[p][4]).toBeGreaterThan(2); // lower lip moves DOWN > 2 mm
      }
    });

    it(`${id}: P/B/M close at the static apex; M closes deepest`, () => {
      const base = HYPER3D_LIP_BASELINE[id];
      for (const p of ["P", "B", "M"] as const) expect(dAperture(id, base.phonemes[p])).toBeLessThan(-3);
      expect(base.phonemes.M[0]).toBeLessThan(base.phonemes.P[0] - 1);
    });

    it(`${id}: the residual jaw a sealing frame may keep reopens every bilabial by > 1 mm`, () => {
      const base = HYPER3D_LIP_BASELINE[id];
      for (const p of ["P", "B", "M"] as const) {
        expect(base.scenarios[`${p} + residual seal jaw`][0] - base.phonemes[p][0]).toBeGreaterThan(1);
      }
    });

    it(`${id}: the seal lead-in alone, with the jaw still at the seal cap, leaves the lips near rest`, () => {
      const base = HYPER3D_LIP_BASELINE[id];
      expect(Math.abs(dAperture(id, base.scenarios["seal lead only (close 0.7) + residual jaw"]))).toBeLessThan(1.5);
    });
  }
});

describe("the measurement mirrors runtime constants without touching them", () => {
  it("the seal level is the coarticulation engine's own constant", () => {
    expect(SEAL_LEAD_LEVEL).toBe(BILABIAL_SEAL_LEVEL);
  });

  it("the residual seal jaw is still the mixer's literal", () => {
    const mixer = readFileSync("src/lib/avatar/hyper3d/engine/engine/avatar/FacialPoseMixer.ts", "utf8");
    expect(mixer).toContain("(this.combinedPose.mouthClose ?? 0) > .65");
    expect(mixer).toContain("Math.min(this.combinedPose.jawOpen ?? 0, .08)");
    expect(MIXER_SEAL_JAW_CAP).toBe(0.08);
  });

  it("no runtime module imports the measurement tooling", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
          if (entry !== "node_modules" && entry !== "__snapshots__") walk(path);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry) || /\.test\.tsx?$/.test(entry)) continue;
        if (entry.startsWith("hyper3dLipGeometry") || entry.startsWith("hyper3dLipBaseline")) continue;
        if (/from\s+["'][^"']*hyper3dLip(Geometry|Baseline)/.test(readFileSync(path, "utf8"))) offenders.push(path);
      }
    };
    walk("src");
    expect(offenders).toEqual([]);
  });
});
