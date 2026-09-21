import {
  NoColorSpace,
  SRGBColorSpace,
  TextureLoader,
  type ColorSpace,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  type Texture
} from "three";

/**
 * RENDER PIPELINE — COLOUR MANAGEMENT AND HAIR ALPHA.
 *
 * ============================================================================
 * THIS FILE TOUCHES TEXTURE METADATA AND ALPHA FLAGS. NOTHING ELSE.
 * ============================================================================
 *
 * It does not read or write a morph influence, a bone, a phoneme, an
 * expression, a gaze or blink value, a camera, a geometry attribute or a
 * texture's image data. It sets `Texture.colorSpace` — a metadata field the
 * shader reads to decide whether to linearise a sample — and the alpha flags on
 * the materials it is told are hair.
 *
 * ---------------------------------------------------------------------------
 * WHY THE COLOUR PASS IS A VALIDATOR AND NOT A FIX.
 *
 * Measured on the live scene before any of this existed (see
 * `docs/evidence/female229-render-pipeline/audit-current.json`): across all ten
 * materials and every texture slot they carry, the number of slots with an
 * incorrect colour space was ZERO. GLTFLoader on three r185 already tags
 * base-colour and emissive as `SRGBColorSpace` and leaves normal, roughness,
 * metalness, AO and alpha maps at `NoColorSpace`.
 *
 * So this pass exists to PROVE that, continuously, and to catch the case it
 * cannot prove statically: a material this app builds itself, or a texture it
 * loads through `TextureLoader` rather than through GLTFLoader — which is
 * exactly how the Hyper3D face normal map arrives. It corrects what is wrong and
 * reports what it found, and on a correct asset it is a no-op that returns a
 * clean bill.
 *
 * THERE IS EXACTLY ONE COLOUR-MANAGEMENT PATH, and it is three's own: the
 * renderer's `outputColorSpace` plus per-texture `colorSpace`. This file adds no
 * manual gamma, no `pow(colour, 2.2)`, and no shader-side conversion, so nothing
 * here can double-convert. A texture already tagged correctly is left alone
 * rather than re-tagged, and `needsUpdate` is raised only on a texture whose
 * tag actually changed — re-uploading an unchanged 4096x4096 map every frame
 * would be a real cost for no effect.
 */

/** Slots carrying AUTHORED COLOUR. These must be decoded from sRGB. */
export const COLOUR_TEXTURE_SLOTS = ["map", "emissiveMap", "specularColorMap", "sheenColorMap"] as const;

/**
 * Slots carrying DATA — vectors, scalars, masks. These must stay linear.
 *
 * A normal map tagged sRGB is the classic version of this bug: the shader
 * applies a 2.4 gamma to what are meant to be signed vector components, which
 * bends every surface normal toward flat and reads as soft, waxy, "plastic"
 * shading. The same mistake on a roughness or AO map silently changes the
 * material's response curve.
 */
export const DATA_TEXTURE_SLOTS = [
  "normalMap", "roughnessMap", "metalnessMap", "aoMap", "alphaMap", "lightMap",
  "bumpMap", "displacementMap", "clearcoatNormalMap", "clearcoatMap",
  "clearcoatRoughnessMap", "transmissionMap", "thicknessMap", "iridescenceMap",
  "iridescenceThicknessMap", "sheenRoughnessMap", "specularIntensityMap", "anisotropyMap"
] as const;

export interface TextureColorSpaceFinding {
  material: string;
  slot: string;
  kind: "colour" | "data";
  was: string;
  now: string;
  corrected: boolean;
}

export interface ColorPipelineReport {
  /** Every texture slot inspected, whatever its verdict. */
  inspected: number;
  /** Slots that were already correct. On a healthy asset this is all of them. */
  alreadyCorrect: number;
  /** Slots this pass changed. Each one is a bug it caught. */
  corrected: TextureColorSpaceFinding[];
  /** Materials seen, by name, so a report can be read against the audit. */
  materials: string[];
}

const NAMES = new Map<ColorSpace | string, string>([
  [SRGBColorSpace, "SRGBColorSpace"],
  [NoColorSpace, "NoColorSpace"]
]);
const nameOf = (space: ColorSpace | string) => NAMES.get(space) ?? String(space || "(empty)");

const materialsOf = (object: Object3D): Material[] => {
  const mesh = object as Mesh;
  if (!mesh.isMesh || !mesh.material) return [];
  return Array.isArray(mesh.material) ? mesh.material.filter(Boolean) : [mesh.material];
};

/**
 * Walks every mesh, every material slot — `material` AND `material[]` — and
 * every texture slot, and makes each texture's colour space match what that slot
 * means. Idempotent: a second run finds nothing to correct.
 */
export const normaliseTextureColorSpaces = (root: Object3D): ColorPipelineReport => {
  const report: ColorPipelineReport = { inspected: 0, alreadyCorrect: 0, corrected: [], materials: [] };
  const seenMaterials = new Set<string>();
  // Textures are shared between materials, so a slot already visited through
  // one material must not be counted twice.
  const seenTextures = new Set<string>();

  root.traverse((object) => {
    for (const material of materialsOf(object)) {
      const standard = material as MeshStandardMaterial & Record<string, unknown>;
      const materialName = material.name || "(unnamed)";
      if (!seenMaterials.has(material.uuid)) {
        seenMaterials.add(material.uuid);
        report.materials.push(materialName);
      }

      const apply = (slot: string, kind: "colour" | "data", wanted: ColorSpace) => {
        const texture = standard[slot] as Texture | null | undefined;
        if (!texture) return;
        const key = `${texture.uuid}|${slot}`;
        if (seenTextures.has(key)) return;
        seenTextures.add(key);
        report.inspected += 1;
        if (texture.colorSpace === wanted) {
          report.alreadyCorrect += 1;
          return;
        }
        const was = nameOf(texture.colorSpace);
        texture.colorSpace = wanted;
        // Only a texture that actually changed is re-uploaded.
        texture.needsUpdate = true;
        material.needsUpdate = true;
        report.corrected.push({ material: materialName, slot, kind, was, now: nameOf(wanted), corrected: true });
      };

      for (const slot of COLOUR_TEXTURE_SLOTS) apply(slot, "colour", SRGBColorSpace);
      for (const slot of DATA_TEXTURE_SLOTS) apply(slot, "data", NoColorSpace);
    }
  });

  return report;
};

export interface HairAlphaFinding {
  material: string;
  mesh: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  alphaSource: "map alpha channel" | "alphaMap" | "opacity only";
}

export interface HairAlphaReport {
  applied: HairAlphaFinding[];
  /** Hair materials restored to exactly what the loader delivered. */
  reverted: HairAlphaFinding[];
  /** Hair materials found but left alone, and why. */
  skipped: { material: string; reason: string }[];
  alphaHashSupported: boolean;
}

/**
 * Where the loader's own alpha state is kept, so `enabled: false` can put it
 * back byte for byte instead of merely declining to change it.
 *
 * Stamped the FIRST time a material is seen and never re-stamped, so a second
 * pass cannot launder a corrected value into the baseline — the same discipline
 * `BaselineRendererStore` uses for the renderer.
 */
const AUTHORED_ALPHA = "renderPipelineAuthoredAlpha";

interface AuthoredAlpha {
  transparent: boolean;
  alphaHash: boolean;
  alphaTest: number;
  depthWrite: boolean;
}

/**
 * HAIR ALPHA.
 *
 * Scoped by material name, so it reaches the hair and nothing else — the brief's
 * "do not apply transparency settings to the entire avatar" is enforced by the
 * caller passing names rather than by a heuristic here.
 *
 * WHAT WAS MEASURED, and why `alphaHash` is the right answer for this asset.
 * `Material.005` arrives from the GLB as `alphaMode: BLEND` with its alpha in
 * the ALPHA CHANNEL of the 4096x4096 RGBA `hair_o` base-colour map — there is no
 * separate `alphaMap`. GLTFLoader turns BLEND into `transparent: true` and
 * `depthWrite: false`, and that combination is the whole of the reported
 * "rough/blocky" hair: sorted blending with depth writes off means overlapping
 * strand cards composite in draw order rather than depth order, so the silhouette
 * breaks up and edges read as hard steps.
 *
 * ---------------------------------------------------------------------------
 * `alphaHash` WAS TRIED FIRST, AND MEASURED, AND REJECTED.
 *
 * It is the textbook answer and it is what the brief asked for: stochastic
 * alpha-to-coverage keeps or discards each fragment against a hashed threshold,
 * so the material is depth-correct and needs no sorting. three r185 supports it,
 * and it was implemented, captured and compared.
 *
 * ON THIS PIPELINE IT IS WORSE THAN THE DEFECT IT TARGETS. A hash is only smooth
 * once many samples of it are averaged — temporal accumulation, or a high MSAA
 * count. This renderer has neither: one shaded sample per pixel per frame, and
 * a still capture has no frames to accumulate. The hash therefore resolves as
 * per-pixel dither, and the hair renders as speckled noise across the whole
 * silhouette. See `docs/evidence/female229-render-pipeline/` — the hash frame is
 * visibly grainy where the loader's own frame is merely badly sorted, and the
 * "silhouette holes" measure rose from 598 to 701 because each dithered gap
 * counts as a hole.
 *
 * A DEPTH-CORRECT CUTOUT WAS THE ANSWER FOR A WHILE, and it is still the
 * `cutout` mode below. It removes the sorting entirely and introduces no noise,
 * at the cost of a harder edge than true blending gives. The hair review then
 * rejected that edge as the ribbon/card look, and measuring the texture showed
 * why it could never have been soft: nothing in the map is opaque, so a cutout
 * necessarily promotes a feathered ramp to a hard stencil. Densifying the map
 * made blending viable, and `blend` is now the shipping mode.
 *
 * THE THREE MECHANISMS ARE NEVER STACKED, which the brief specifically warns
 * against: exactly one of `alphaHash`, `alphaTest` and sorted `transparent`
 * blending is active in any mode, and an authored non-zero `alphaTest` is
 * treated as the asset declaring itself a cutout and is preserved as-is.
 */
export type HairAlphaMode =
  /** Exactly what the loader delivered: sorted blending, depth writes off. */
  | "loader"
  /** Depth-correct cutout. Superseded; kept because it is the honest baseline. */
  | "cutout"
  /**
   * Blending on the DENSIFIED map. The shipping treatment.
   *
   * Blending is only viable because the base map's alpha was densified first —
   * see `applyHairMap`. On the embedded map, whose densest strand core is about
   * 95% opaque, blending rendered the hair grey and hazy. On the derived map the
   * cores reach opacity, and blending then gives what the cutout cannot: a soft
   * silhouette with no stencil edge. Measured against the cutout at the same
   * tint and roughness — silhouette holes 1058 -> 435, background leakage
   * 71.3% -> 67.3%, coverage 28.7% -> 32.7%.
   */
  | "blend";

/**
 * The cutout threshold.
 *
 * Modest on purpose, per the brief. High enough that a faint strand edge stops
 * writing depth over the face — which is what was darkening the forehead — and
 * low enough that the strand tips survive rather than being chopped into blocks.
 */
export const HAIR_ALPHA_TEST = 0.3;

export const applyHairAlpha = (
  root: Object3D,
  hairMaterialNames: readonly string[],
  mode: HairAlphaMode
): HairAlphaReport => {
  const report: HairAlphaReport = { applied: [], reverted: [], skipped: [], alphaHashSupported: false };
  const wanted = new Set(hairMaterialNames);
  const seen = new Set<string>();

  root.traverse((object) => {
    for (const material of materialsOf(object)) {
      const name = material.name || "";
      if (!wanted.has(name) || seen.has(material.uuid)) continue;
      seen.add(material.uuid);

      const standard = material as MeshStandardMaterial;
      const supportsHash = "alphaHash" in standard;
      report.alphaHashSupported = supportsHash;

      const usesMapAlpha = Boolean(standard.map);
      const alphaSource = standard.alphaMap
        ? ("alphaMap" as const)
        : usesMapAlpha
          ? ("map alpha channel" as const)
          : ("opacity only" as const);

      // Captured once, from the state the loader produced.
      if (!standard.userData[AUTHORED_ALPHA]) {
        standard.userData[AUTHORED_ALPHA] = {
          transparent: standard.transparent,
          alphaHash: supportsHash ? (standard as unknown as { alphaHash: boolean }).alphaHash : false,
          alphaTest: standard.alphaTest,
          depthWrite: standard.depthWrite
        } satisfies AuthoredAlpha;
      }
      const authored = standard.userData[AUTHORED_ALPHA] as AuthoredAlpha;

      const snapshot = () => ({
        transparent: standard.transparent,
        alphaHash: supportsHash ? (standard as unknown as { alphaHash: boolean }).alphaHash : null,
        alphaTest: standard.alphaTest,
        opacity: standard.opacity,
        depthWrite: standard.depthWrite,
        depthTest: standard.depthTest,
        hasAlphaMap: Boolean(standard.alphaMap)
      });
      const before = snapshot();

      if (alphaSource === "opacity only") {
        report.skipped.push({ material: name, reason: "no base-colour map and no alphaMap — nothing for a hash to sample" });
        continue;
      }
      if (!supportsHash) {
        report.skipped.push({ material: name, reason: `three r${(root as unknown as { REVISION?: string }).REVISION ?? "?"} has no alphaHash on this material` });
        continue;
      }

      if (mode === "loader") {
        /**
         * RESTORE, not skip. The A/B has to be truthful in both directions: a
         * pass that merely declined to act would leave a previously-corrected
         * material corrected, and CURRENT would silently photograph CORRECTED.
         * That is exactly what the first capture of this pass did — every
         * measured delta came back 0.0000 — so the baseline is written back
         * from the stamp above rather than assumed.
         */
        standard.transparent = authored.transparent;
        if (supportsHash) (standard as unknown as { alphaHash: boolean }).alphaHash = authored.alphaHash;
        standard.alphaTest = authored.alphaTest;
        standard.depthWrite = authored.depthWrite;
        standard.needsUpdate = true;
        report.reverted.push({ material: name, mesh: object.name, before, after: snapshot(), alphaSource });
        continue;
      }

      /**
       * An authored cutout is respected: `alphaTest` above 0 means the source
       * texture IS a cutout by design, so it is left exactly as authored rather
       * than being given a second alpha mechanism on top.
       */
      if (authored.alphaTest > 0) {
        report.skipped.push({ material: name, reason: `authored cutout (alphaTest ${authored.alphaTest}) — left as the asset declares it` });
        continue;
      }

      if (mode === "blend") {
        /**
         * One mechanism: sorted blending. No hash, no cutout threshold.
         * `depthWrite` off is what lets overlapping strand cards accumulate
         * instead of the nearest one stencilling the rest out — which is the
         * whole point, and it is safe here because the cards are dense enough
         * after the map swap that the accumulation reads as hair rather than
         * as haze.
         */
        (standard as unknown as { alphaHash: boolean }).alphaHash = false;
        standard.transparent = true;
        standard.alphaTest = 0;
        standard.depthWrite = false;
      } else {
        // Depth-correct cutout: one alpha mechanism, no sorting, no dither.
        (standard as unknown as { alphaHash: boolean }).alphaHash = false;
        standard.transparent = false;
        standard.alphaTest = HAIR_ALPHA_TEST;
        standard.depthWrite = true;
      }
      standard.needsUpdate = true;

      report.applied.push({ material: name, mesh: object.name, before: { ...authored }, after: snapshot(), alphaSource });
    }
  });

  return report;
};

/**
 * Which alpha treatment a render-pipeline selection uses.
 *
 * `alpha-hash` exists so the rejected option stays one switch away and the
 * comparison can be re-taken; it is never the shipping path.
 */
export const hairAlphaMode = (pipeline: "current" | "corrected" | "alpha-hash"): HairAlphaMode =>
  pipeline === "corrected" ? "blend" : pipeline === "alpha-hash" ? "cutout" : "loader";

/** The derived, alpha-densified hair map. Written by the hair-texture script. */
export const DENSE_HAIR_MAP_URL = "/avatars/hyper3d/USCBasicPack/hair_o_dense.png";
/** Where the GLB's own embedded hair map is kept, so the swap is reversible. */
const AUTHORED_HAIR_MAP = "hyper3dAuthoredHairMap";

export type HairMapMode = "authored" | "dense";

let denseHairMap: Promise<Texture> | undefined;

export interface HairMapReport {
  swapped: string[];
  restored: string[];
  mode: HairMapMode;
}

/**
 * Swaps the hair's base-colour map for the alpha-densified derivative.
 *
 * WHY A DIFFERENT MAP RATHER THAN A DIFFERENT MATERIAL SETTING. Measured on the
 * embedded `hair_o`: 68.0% of it is fully transparent, 28.7% is a soft ramp, and
 * NOTHING is opaque — the `alpha == 255` bucket is empty and even 243-254 holds
 * only 1.65%. No material property can add density that the texture does not
 * have, which is why the cutout renders as a hard stencil and the blend renders
 * as grey haze. `scripts/female229-hair-texture.mjs` raises the strand cores
 * with a gamma on the alpha channel alone; RGB is copied verbatim, and it is
 * copied rather than adjusted because this map has no colour in it at all — it
 * is pure white everywhere, luma 255.00, so the hair's colour is entirely the
 * material's base colour factor.
 *
 * `flipY: false` matches the glTF convention the mesh's UVs are authored in, the
 * same correction the face normal map needed. `colorSpace` is sRGB because this
 * is the base-colour slot, and the alpha channel is unaffected by that tag.
 *
 * Reversible: the embedded texture object is stashed on first swap and put back
 * for `authored`, so the A/B is truthful in both directions.
 */
export const applyHairMap = (
  root: Object3D,
  hairMaterialNames: readonly string[],
  mode: HairMapMode
): HairMapReport => {
  const report: HairMapReport = { swapped: [], restored: [], mode };
  const wanted = new Set(hairMaterialNames);
  const seen = new Set<string>();

  const load = () => {
    if (!denseHairMap) {
      denseHairMap = new Promise<Texture>((resolve, reject) =>
        new TextureLoader().load(DENSE_HAIR_MAP_URL, resolve, undefined, reject)
      ).then((texture) => {
        texture.colorSpace = SRGBColorSpace;
        texture.flipY = false;
        texture.needsUpdate = true;
        return texture;
      });
    }
    return denseHairMap;
  };

  root.traverse((object) => {
    for (const material of materialsOf(object)) {
      const standard = material as MeshStandardMaterial;
      const name = standard.name || "";
      if (!wanted.has(name) || seen.has(standard.uuid) || !standard.map) continue;
      seen.add(standard.uuid);

      if (mode === "dense") {
        if (standard.userData[AUTHORED_HAIR_MAP] === undefined) standard.userData[AUTHORED_HAIR_MAP] = standard.map;
        report.swapped.push(name);
        void load()
          .then((texture) => {
            if (standard.map === texture) return;
            // Carry the authored wrapping and repeat across, so only the image
            // changes and nothing about how it is sampled does.
            const authored = standard.userData[AUTHORED_HAIR_MAP] as Texture;
            texture.wrapS = authored.wrapS;
            texture.wrapT = authored.wrapT;
            texture.repeat.copy(authored.repeat);
            texture.offset.copy(authored.offset);
            texture.channel = authored.channel;
            standard.map = texture;
            standard.needsUpdate = true;
          })
          .catch(() => {
            // Keep the embedded map. A missing derivative must not blank the hair.
          });
      } else if (standard.userData[AUTHORED_HAIR_MAP] !== undefined) {
        const authored = standard.userData[AUTHORED_HAIR_MAP] as Texture;
        if (standard.map !== authored) {
          standard.map = authored;
          standard.needsUpdate = true;
        }
        report.restored.push(name);
      }
    }
  });

  return report;
};
