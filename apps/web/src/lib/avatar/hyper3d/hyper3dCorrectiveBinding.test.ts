import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CORRECTIVE_MORPH, CORRECTIVE_TARGETS, hyper3dCorrectiveProfile } from "./hyper3dCorrectiveMorph";
import { calibrateHyper3dPose } from "./engine/mappings/avatars/hyper3dCalibration";
import { HYPER3D_GLB_PATH, loadLipModel, lipLandmarks, measureLips } from "./hyper3dLipGeometry";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * STAGE 2 §5 — DOES THE EXPERIMENTAL ASSET STILL BIND LIKE THE PRODUCTION ONE?
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS IS NOT COVERED BY "IT LOADS". §8 of the Stage 1 brief was explicit
 * that a successful GLB load is insufficient evidence of preservation, and the
 * reason is specific to how morphs are addressed. `MorphTargetController` writes
 * influences through `morphTargetDictionary`, which three.js builds from the
 * target ORDER in the primitive. An asset that loads perfectly but has shifted
 * one morph's index writes every subsequent channel to the wrong shape — a
 * smile that blinks — and nothing about loading would reveal it.
 *
 * Stage 1's `verifyCorrectiveMorph.mjs` already compared all 214 accessors of
 * the two files byte for byte. This file checks the thing that script cannot:
 * what the RUNTIME sees after parsing, through the same reader the rest of the
 * Hyper3D geometry work uses.
 *
 * WHAT WOULD MAKE THIS FAIL, which is the useful way to read a verification
 * file: a reordered target list, a renamed channel, a dropped `targetNames`
 * entry, morph NORMALS missing on the new target (the asset's other 51 all have
 * them, and a position-only morph shades as though the surface never moved), a
 * changed vertex count, or any existing delta differing by a single float.
 */

const EXPERIMENTAL_GLB_PATH = "public/avatars/experimental/female_2291-lowerlip-v2.glb";

/** Enough of the glTF to check BINDING, which `loadLipModel` deliberately skips. */
type GltfMesh = {
  name: string;
  extras?: { targetNames?: string[] };
  primitives: Array<{
    attributes: Record<string, number>;
    targets?: Array<{ POSITION?: number; NORMAL?: number }>;
  }>;
};

type Binding = {
  targetNames: string[];
  targets: Array<{ POSITION?: number; NORMAL?: number }>;
  vertCount: number;
  meshCount: number;
  /** Every mesh that carries morphs, with its own target names. */
  morphedMeshes: Array<{ name: string; targetNames: string[]; primitives: number }>;
};

function readBinding(file: string): Binding {
  const buf = readFileSync(file);
  const jsonLength = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.subarray(20, 20 + jsonLength).toString("utf8")) as {
    meshes: GltfMesh[];
    accessors: Array<{ count: number }>;
  };
  const mesh = gltf.meshes[0];
  const primitive = mesh.primitives[0];
  const morphedMeshes = gltf.meshes
    .filter((m) => m.primitives.some((p) => (p.targets?.length ?? 0) > 0))
    .map((m) => ({
      name: m.name,
      targetNames: m.extras?.targetNames ?? [],
      primitives: m.primitives.length
    }));
  return {
    targetNames: mesh.extras?.targetNames ?? [],
    targets: primitive.targets ?? [],
    vertCount: gltf.accessors[primitive.attributes.POSITION].count,
    meshCount: gltf.meshes.length,
    morphedMeshes
  };
}

const production = resolve(HYPER3D_GLB_PATH);
const experimental = resolve(EXPERIMENTAL_GLB_PATH);
const bothPresent = existsSync(production) && existsSync(experimental);
const describeAssets = bothPresent ? describe : describe.skip;

describeAssets("§5 morph binding, production vs experimental", () => {
  const prod = readBinding(production);
  const exp = readBinding(experimental);

  it("adds exactly one morph and appends it last", () => {
    /**
     * APPENDED, not inserted, and that is the whole safety property. Every
     * existing channel keeps its index, so every existing
     * `morphTargetDictionary` lookup resolves to the shape it always did.
     */
    expect(prod.targetNames).toHaveLength(51);
    expect(exp.targetNames).toHaveLength(52);
    expect(exp.targetNames.slice(0, 51)).toEqual(prod.targetNames);
    expect(exp.targetNames[51]).toBe(CORRECTIVE_MORPH);
    expect(prod.targetNames).not.toContain(CORRECTIVE_MORPH);
    // Same list length as the primitive's target array, or the dictionary lies.
    expect(exp.targets).toHaveLength(52);
    expect(prod.targets).toHaveLength(51);
  });

  it("leaves every existing morph pointing at the same accessor", () => {
    /**
     * The strongest available statement about the 51: not "equal values" but
     * the SAME accessor indices, so they resolve to the same bytes of the same
     * buffer. Stage 1 appended two accessors and copied the original BIN as a
     * byte-for-byte prefix precisely so this would hold.
     */
    for (let i = 0; i < 51; i += 1) {
      expect(exp.targets[i], `${prod.targetNames[i]} POSITION`).toEqual(prod.targets[i]);
    }
  });

  it("gives the new morph both POSITION and NORMAL, like the other 51", () => {
    const added = exp.targets[51];
    expect(added.POSITION).toBeDefined();
    expect(added.NORMAL).toBeDefined();
    // New accessors, not aliases of an existing morph's.
    const existingPositions = new Set(prod.targets.map((t) => t.POSITION));
    expect(existingPositions.has(added.POSITION)).toBe(false);
    // And every original morph has normals too, so this is the asset's convention.
    const withNormals = prod.targets.filter((t) => t.NORMAL !== undefined).length;
    expect(withNormals).toBe(51);
  });

  it("changes no vertex count, mesh count, or other mesh's morphs", () => {
    expect(exp.vertCount).toBe(prod.vertCount);
    expect(exp.meshCount).toBe(prod.meshCount);
    /**
     * EYELASH COMPATIBILITY, from §5. The eyelashes are separate meshes with
     * their own morph lists, and the accepted eyelash binding work depends on
     * those lists being exactly what it found. The correction went onto mesh 0
     * only, so every other morphed mesh must be untouched — name, target names
     * and primitive count.
     */
    expect(exp.morphedMeshes.length).toBe(prod.morphedMeshes.length);
    for (let i = 1; i < prod.morphedMeshes.length; i += 1) {
      expect(exp.morphedMeshes[i]).toEqual(prod.morphedMeshes[i]);
    }
  });

  it("reads back through the production loader with its deltas intact", () => {
    /**
     * Through `loadLipModel`, which is the reader every other Hyper3D geometry
     * measurement in this project used — so a binding change would also have
     * invalidated those numbers.
     */
    const prodModel = loadLipModel(production);
    const expModel = loadLipModel(experimental);
    expect(expModel.vertCount).toBe(prodModel.vertCount);
    expect(Object.keys(expModel.deltas)).toHaveLength(52);
    expect(expModel.deltas[CORRECTIVE_MORPH]).toBeDefined();

    // Base mesh identical, float for float.
    expect(expModel.base.length).toBe(prodModel.base.length);
    let baseDiffs = 0;
    for (let i = 0; i < prodModel.base.length; i += 1) {
      if (expModel.base[i] !== prodModel.base[i]) baseDiffs += 1;
    }
    expect(baseDiffs).toBe(0);

    // And all 51 original deltas identical, float for float.
    let deltaDiffs = 0;
    for (const name of Object.keys(prodModel.deltas)) {
      const a = prodModel.deltas[name];
      const b = expModel.deltas[name];
      expect(b, name).toBeDefined();
      for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) deltaDiffs += 1;
    }
    expect(deltaDiffs).toBe(0);
  }, 120_000);

  it("delivers its designed amplitude, and reconciles the two ways of measuring it", () => {
    /**
     * ───────────────────────────────────────────────────────────────────────
     * TWO NUMBERS THAT LOOK LIKE A CONTRADICTION AND ARE NOT.
     * ───────────────────────────────────────────────────────────────────────
     *
     * Stage 1B reported the correction gaining AA 1.78 mm of aperture. Measured
     * here through `measureLips` it gains 0.52 mm. Both are right; they measure
     * different things, and recording which is which is the point of this test,
     * because the smaller number is the one that would otherwise look like a
     * broken asset.
     *
     *   PEAK VERTEX           2.973 mm at full influence — the asset's designed
     *                         3.0 mm amplitude, delivered
     *   120-VERTEX BAND MEAN  0.608 mm at full influence, 0.517 at AA's 0.85
     *
     * The morph moves 304 of 13,631 vertices. `measureLips` averages a
     * 120-vertex margin band chosen for the WHOLE lip, and most of that band
     * lies outside a 304-vertex support — the band's minimum displacement under
     * this morph is exactly 0.000 mm. So the band mean dilutes a sharp local
     * deformation by roughly a factor of five, and 0.608 x 0.85 = 0.517 is
     * precisely the aperture gain the band metric reports. The agreement to
     * three decimals is what says the asset is fine and the instrument is
     * narrow, rather than the other way round.
     *
     * WHICH ONE MATTERS VISUALLY is the peak: at AA the inner lower lip margin
     * drops 2.50 mm at the midline, against a bilabial closure gap of ~2.3 mm.
     * That is a visible change, which is the whole reason the experiment exists.
     */
    const model = loadLipModel(experimental);
    const landmarks = lipLandmarks(model);
    const delta = model.deltas[CORRECTIVE_MORPH];
    const displacementMM = (vertex: number) =>
      Math.hypot(delta[vertex * 3], delta[vertex * 3 + 1], delta[vertex * 3 + 2]) * 10;

    const moved: number[] = [];
    for (let v = 0; v < model.vertCount; v += 1) {
      const m = displacementMM(v);
      if (m > 0) moved.push(m);
    }
    moved.sort((a, b) => b - a);

    // The designed amplitude, delivered.
    expect(moved[0]).toBeGreaterThan(2.9);
    expect(moved[0]).toBeLessThan(3.05);
    // Local: a correction, not a global reshape.
    expect(moved.length).toBeGreaterThan(200);
    expect(moved.length).toBeLessThan(600);

    // The band's dilution, stated rather than discovered later.
    const band = landmarks.marginLower.map(displacementMM);
    const bandMean = band.reduce((s, x) => s + x, 0) / band.length;
    expect(Math.max(...band)).toBeCloseTo(moved[0], 2);
    expect(Math.min(...band)).toBe(0);
    expect(bandMean).toBeLessThan(moved[0] / 3);

    const rows: string[] = [""];
    rows.push("=== §5 the correction through the runtime geometry, mm ===");
    rows.push(`peak vertex at full influence      ${moved[0].toFixed(3)}  (design: 3.0)`);
    rows.push(`vertices moved                     ${moved.length} of ${model.vertCount}`);
    rows.push(`120-vertex margin band mean        ${bandMean.toFixed(3)}`);
    rows.push("");
    rows.push(
      "ph".padEnd(5) + "weight".padStart(8) + "peakDropMM".padStart(12) +
      "apertureMM".padStart(12) + "+corr".padStart(9) + "gain".padStart(8) + "jawOpen".padStart(9)
    );

    for (const [phoneme, weight] of Object.entries(CORRECTIVE_TARGETS)) {
      const definition = hyper3dCorrectiveProfile[phoneme as keyof typeof hyper3dCorrectiveProfile];
      expect(definition, phoneme).toBeDefined();
      const withCorrection = calibrateHyper3dPose({ ...definition!.pose });
      // Calibration must not touch the correction — it is not in any cap table.
      expect(withCorrection[CORRECTIVE_MORPH], `${phoneme} calibrated weight`).toBe(weight);
      const without = { ...withCorrection };
      delete without[CORRECTIVE_MORPH];

      const a = measureLips(model, landmarks, without);
      const b = measureLips(model, landmarks, withCorrection);
      rows.push(
        phoneme.padEnd(5) + weight.toFixed(2).padStart(8) +
        (moved[0] * weight).toFixed(2).padStart(12) +
        a.apertureMM.toFixed(2).padStart(12) + b.apertureMM.toFixed(2).padStart(9) +
        (b.apertureMM - a.apertureMM).toFixed(2).padStart(8) +
        (withCorrection.jawOpen ?? 0).toFixed(3).padStart(9)
      );

      // It opens the aperture and drops the lower lip, by the band metric.
      expect(b.apertureMM, `${phoneme} aperture`).toBeGreaterThan(a.apertureMM + 0.25);
      expect(b.lowerLipDropMM, `${phoneme} lower lip`).toBeGreaterThan(a.lowerLipDropMM + 0.25);
      /**
       * AND IT IS LIP RATHER THAN JAW, which is the claim the whole experiment
       * rests on. `jawOpen` is byte-identical between the two columns, so the
       * aperture gain cannot be the jaw opening further, and the other four
       * measured quantities stay put.
       *
       * NOT EXACTLY ZERO, and the reason is deliberate. Stage 1B took the
       * correction's direction from the asset's OWN `mouthLowerDown` rather
       * than inventing a straight-down vector, so it inherits that morph's
       * small anterior component. The measured side effects are 0.021 mm of
       * protrusion and less elsewhere — a fiftieth of the correction's own
       * 2.5 mm, and below the 0.1 mm the asset's vertices are symmetric to. The
       * bound is stated in millimetres because that is the quantity that
       * matters, not a decimal count.
       */
      expect(Math.abs(b.protrusionMM - a.protrusionMM), `${phoneme} protrusion`).toBeLessThan(0.05);
      expect(Math.abs(b.cornerSpreadMM - a.cornerSpreadMM), `${phoneme} corners`).toBeLessThan(0.05);
      expect(Math.abs(b.upperLipLiftMM - a.upperLipLiftMM), `${phoneme} upper lip`).toBeLessThan(0.05);
      expect(b.widthMM, `${phoneme} width`).toBeCloseTo(a.widthMM, 1);
    }
    // eslint-disable-next-line no-console
    console.log(rows.join("\n"));

    // Monotone in weight: no weight at which the correction reverses or stalls.
    const neutral = measureLips(model, landmarks, {});
    let previous = neutral.apertureMM;
    for (const weight of [0.25, 0.5, 0.75, 1]) {
      const posed = measureLips(model, landmarks, { [CORRECTIVE_MORPH]: weight });
      expect(posed.apertureMM).toBeGreaterThan(previous);
      previous = posed.apertureMM;
    }
  }, 120_000);

  it("is a no-op channel on the production asset", () => {
    /**
     * The last line of production isolation, stated geometrically rather than
     * by reading the code: even if a corrective weight somehow reached the
     * production asset, there is no shape for it to drive.
     */
    const model = loadLipModel(production);
    expect(model.deltas[CORRECTIVE_MORPH]).toBeUndefined();
    const landmarks = lipLandmarks(model);
    const neutral = measureLips(model, landmarks, {});
    const withWeight = measureLips(model, landmarks, { [CORRECTIVE_MORPH]: 1 });
    expect(withWeight.apertureMM).toBe(neutral.apertureMM);
    expect(withWeight.lowerLipDropMM).toBe(neutral.lowerLipDropMM);
  }, 120_000);
});
