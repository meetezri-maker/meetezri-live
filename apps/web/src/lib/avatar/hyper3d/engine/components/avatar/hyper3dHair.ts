import {
  Box3,
  Color,
  DoubleSide,
  FrontSide,
  Group,
  LoadingManager,
  MathUtils,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  SRGBColorSpace,
  Vector3,
  type Bone,
  type Material,
  type Mesh,
  type Texture
} from "three";

/**
 * HYPER3D CURLY HAIR — asset integration only.
 *
 * `additional_body.fbx` ships bald: `avatarModelConfig` records "HAIR: NOT
 * INCLUDED IN EXPORT. Confirmed with the package vendor." This module supplies
 * the missing hair from a SECOND, unrelated FBX and parents it to the Hyper3D
 * head bone. It adds geometry and materials and nothing else — no controller,
 * no animation, no morph, no bone. Everything here is reached exclusively from
 * the `config.id === "hyper3d-usc"` branch, so Female.228 and the current avatar
 * never see any of it.
 *
 * THE ASSET, as measured (see `scripts/hyper3d-hair-asset-audit.mjs`)
 * ---------------------------------------------------------------------------
 * `beatricehair.fbx` — "Hair: Beatrice" by @continuumreed, CC-BY, 974 KB binary
 * FBX (Kaydara FBX Binary, no ASCII fallback). Its own readme says "FBX format,
 * unrigged", and the file agrees:
 *
 *   - 2 plain `Mesh` nodes under one unnamed root `Group`. NO bones, NO
 *     SkinnedMesh, NO skin weights, NO morph targets, NO animation clips.
 *     `Hair_BEA`     113,550 vertices / 37,850 triangles / 1 material
 *     `HairCap_BEA`    4,200 vertices /  1,400 triangles / 1 material
 *   - Attributes per mesh: position, color, normal, uv. The colour attribute is
 *     a constant 1.0 on `Hair_BEA` and 0.991..1.0 on `HairCap_BEA`, i.e. it
 *     carries no information, so `vertexColors` is left off.
 *   - Both meshes are authored Z-up in METRES and carry the same node transform:
 *     rotation X -90 degrees, scale 100. The loaded result is therefore Y-up
 *     centimetres, which is the same unit the Hyper3D body is in.
 *   - Boundary-edge analysis on the position-welded mesh: 10.7% of `Hair_BEA`
 *     edges and 5.6% of `HairCap_BEA` edges are open. This is NOT a flat alpha
 *     card sheet — the curls are closed tube/clump volumes and the cap is a
 *     closed dome with an open rim. See `side` below for what that changes.
 *
 * Rest-pose extent as loaded, before any fit: x -18.39..18.54, y 158.96..195.21,
 * z -16.48..15.67 cm — a 36.9 x 36.2 x 32.1 cm wig sitting on a ~1.95 m source
 * character. The Hyper3D figure is 1.581 m, which is why the fit below scales it
 * down rather than up.
 */

/**
 * The directory the asset was delivered in. Percent-encoded because the vendor's
 * folder names contain spaces and parentheses; Vite serves `public/` verbatim,
 * so the bytes are exactly what was delivered and nothing is copied or
 * re-encoded. `curly-hair/textures/` holds a second, re-encoded copy of the same
 * maps — same dimensions, different checksums — and is deliberately NOT used:
 * these are the copies that shipped beside the FBX, and loading both sets would
 * double a 16 MB download for no difference on screen.
 */
export const HYPER3D_HAIR_BASE = encodeURI(
  "/avatars/hyper3d/curly-hair/source/Hair - Beatrice (Free) by continuumreed/Hair - Beatrice (Free) by continuumreed/"
);

/** The FBX itself. */
export const HYPER3D_HAIR_URL = `${HYPER3D_HAIR_BASE}beatricehair.fbx`;

/**
 * Rewrites a texture request onto the folder the FBX actually shipped in.
 *
 * REQUIRED, not a convenience. The FBX stores the AUTHOR'S OWN absolute paths in
 * its Video nodes — `.../data/continuum HD/Ker (Continuum) Alt/light4.png`,
 * `.../WIP characters/beatrice/beatricehair_diff.png` and so on — and FBXLoader
 * concatenates those onto its resource path verbatim. Every one of those
 * requests misses.
 *
 * The failure mode is silent and total, which is why this is worth spelling out.
 * Under Vite's dev server the misses come back 200 with `index.html`, so the
 * image decode fails without an error, the `Texture` keeps a null image, the
 * sampler returns transparent black, and `alphaTest` then discards EVERY
 * fragment: a fully attached, correctly placed, correctly scaled wig that
 * renders as nothing at all. On a static host they would be plain 404s.
 *
 * Every file the FBX names — the four maps, plus `light4.png` and
 * `hair_env2.jpg` — exists in the delivered folder under exactly the basename
 * the FBX uses, so mapping basename to folder resolves all of them.
 */
export const resolveHyper3dHairTextureUrl = (url: string): string => {
  // The FBX itself goes through the same manager and must not be rewritten.
  if (url.toLowerCase().endsWith(".fbx")) return url;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  const file = url.split(/[/\\]/).pop() ?? url;
  return `${HYPER3D_HAIR_BASE}${encodeURIComponent(decodeURIComponent(file))}`;
};

/**
 * Installs that rewrite on a PRIVATE loading manager for this one loader.
 *
 * The rewrite must not reach `THREE.DefaultLoadingManager`: that manager is
 * shared with the Hyper3D body's own maps, the Female.228 GLB and every other
 * loader in the app, and a global URL modifier would send all of their textures
 * into the hair folder. `FBXLoader.parse` builds its `TextureLoader` from
 * `this.manager`, so swapping the property is enough to scope it.
 *
 * Passed to `useLoader` as its `extensions` callback, which runs once, before
 * the load starts.
 */
export const configureHyper3dHairLoader = (loader: { manager: LoadingManager }): void => {
  const manager = new LoadingManager();
  manager.setURLModifier(resolveHyper3dHairTextureUrl);
  loader.manager = manager;
};

/** The two meshes the FBX contains, in the order they appear in the file. */
export const HYPER3D_HAIR_MESH_NAMES = ["Hair_BEA", "HairCap_BEA"] as const;

/** Name of the group this module inserts under the head bone. */
export const HYPER3D_HAIR_GROUP_NAME = "hyper3d-curly-hair";
/** Name of the inner group that carries the measured default fit. */
export const HYPER3D_HAIR_BASE_NAME = "hyper3d-curly-hair-base";

/**
 * The bone the hair is parented to.
 *
 * `Head_M` is the correct and only sensible choice, and it is a measurement:
 * `avatarModelConfig` records `Head_M` reaching skin influence 1.0000 over
 * 127,428 vertices, and it is the bone `BoneController` already drives for head
 * pitch/yaw/roll. Parenting under it means head motion, neck motion, speaking
 * head motion and Active Presence idle motion all propagate through the normal
 * matrix update with no second animation path, no per-frame write and nothing
 * for this module to keep in sync.
 */
export const HYPER3D_HAIR_PARENT_BONE = "with_rigged_body_Head_M";

/**
 * Rotation/scale pivot, in `Head_M` local centimetres.
 *
 * This is the measured centre of the Hyper3D skull: the bounding box of every
 * vertex whose `Head_M` skin weight is >= 0.9 is x -8.607..8.611,
 * y 137.796..158.105, z -8.441..10.619, whose centre is 5.00 cm above and
 * 1.33 cm in front of the `Head_M` bone origin.
 *
 * The pivot matters because the DEV fit controls rotate and scale ABOUT it. The
 * bone origin sits at the top of the neck, ~5 cm below the skull centre; pivoting
 * there would make a one-degree rotation slide the wig sideways instead of
 * tilting it, and a scale nudge would lift it off the crown. Pivoting at the
 * skull centre makes ROT X read as "tilt the wig forward/back on the head" and
 * HAIR SCALE as "grow the wig evenly around the skull", which is what the fit
 * pass actually needs.
 */
export const HYPER3D_HAIR_PIVOT: readonly [number, number, number] = [0, 4.995, 1.326];

/** The seven DEV-adjustable numbers, as OFFSETS from the measured fit. */
export interface Hyper3dHairFit {
  /** Uniform scale about `HYPER3D_HAIR_PIVOT`. 1 = the measured default. */
  scale: number;
  /** Offset from the measured default, in `Head_M` local centimetres. */
  position: readonly [number, number, number];
  /** Offset from the measured default, in degrees, about `HYPER3D_HAIR_PIVOT`. */
  rotationDegrees: readonly [number, number, number];
}

/** The DEV controls start here, and RESET HAIR FIT returns here. */
export const HYPER3D_HAIR_DEFAULT_FIT: Hyper3dHairFit = {
  scale: 1,
  position: [0, 0, 0],
  rotationDegrees: [0, 0, 0]
};

/** The fit, the HAIR ON/OFF switch and the review look. All the store holds. */
export interface Hyper3dHairState extends Hyper3dHairFit {
  enabled: boolean;
  /** Which of `HYPER3D_HAIR_LOOKS` is mounted. Review-only; see that record. */
  look: Hyper3dHairLook;
}

/** Ranges the DEV sliders span. Wide enough to correct a bad fit, not to lose the wig. */
export const HYPER3D_HAIR_FIT_RANGES = {
  /** +/- 25% around the measured scale. */
  scale: { min: 0.75, max: 1.25, step: 0.005 },
  /** Centimetres. The skull is 17 x 20 x 19 cm, so 4 cm covers any plausible correction. */
  position: { min: -4, max: 4, step: 0.05 },
  /** Degrees. */
  rotation: { min: -20, max: 20, step: 0.25 }
} as const;

/**
 * The measured placement: where the loaded FBX root sits in `Head_M` local
 * space, before any DEV offset.
 *
 * DERIVED, NOT GUESSED. `scripts/hyper3d-hair-asset-audit.mjs` builds a signed
 * distance field of the Hyper3D scalp — every vertex with `Head_M` skin weight
 * >= 0.9, carrying its own normal, sampled onto a 0.4 cm grid — then fits
 * uniform scale, X rotation and Y/Z translation of the HAIR CAP, not the curls,
 * by Nelder-Mead from 27 starts. All 27 converge on the same optimum.
 *
 * The cap is the right registration target because it IS a scalp: a
 * 16.6 x 20.9 x 19.6 cm dome authored to lie on a skull, against the Hyper3D
 * skull's measured 17.2 x 20.3 x 19.1 cm. Fitting the curls instead would let
 * the loose ends, which hang well past the head, drag the solution around.
 *
 * The objective is "sit 0.25 cm proud of the skin", NOT "be near the skin", and
 * sinking inside is penalised four times as heavily as standing off. Plain
 * nearest-distance was tried first and is degenerate: it shrinks the cap to 0.80
 * and buries it in the skull, because a buried point is as close to the surface
 * as a seated one. The signed objective removes that solution.
 *
 * X translation and Y/Z rotation are fixed at zero by construction — both the
 * skull and the wig are symmetric about x=0 to within 0.02 cm, so a non-zero
 * value there would be fitting noise. The fit does return -0.18 cm of X and
 * ~0.06 degrees of Y/Z, which is that noise, and it is kept only so these
 * numbers are exactly what the audit produced rather than a tidied version.
 */
export const HYPER3D_HAIR_MEASURED_TRANSFORM = {
  /**
   * Uniform scale of the wig relative to its authored size. The source character
   * is ~1.95 m and the Hyper3D figure is 1.581 m, so the wig comes down 12%.
   */
  scale: 0.880466,
  /**
   * Position of the FBX root in `Head_M` local space, centimetres. The large Y
   * and Z are not a fudge: the FBX geometry is authored around the SOURCE
   * character's origin, ~180 cm above its own root, so the root node has to move
   * that far to bring the wig onto this skull.
   */
  position: [-0.1793, -152.2152, 21.3524] as readonly [number, number, number],
  /**
   * Rotation of the FBX root in `Head_M` local space, degrees, XYZ order. The
   * -8.61 degrees of pitch is the difference between the two characters' head
   * rest poses: `Head_M` itself sits at +2.34 degrees of world pitch, so the
   * fitted wig lands at -6.26 degrees in world terms.
   */
  rotationDegrees: [-8.6056, -0.0517, -0.0672] as readonly [number, number, number]
} as const;

/**
 * The fit, as measured after it was applied. Pinned by
 * `src/tests/hyper3dCurlyHair.test.ts` against a fresh run of the audit script,
 * so a change to the numbers above has to be a deliberate re-measurement.
 *
 * All values are in the asset's own centimetres, on the rest pose.
 *
 *   HAIR CAP (the scalp) vs the Hyper3D skin, signed, + = standing proud:
 *     p05 -0.11   p50 +0.38   p95 +1.22   min -0.26   14.6% of samples inside
 *   That is a scalp seated on a skull: a ~4 mm median standoff, worst case
 *   2.6 mm buried under the skin where the two shapes disagree, and nothing
 *   floating. The buried fraction is invisible — it is under the curls.
 *
 *   CURLS vs the skin: p05 +0.11, p50 +2.29, 4.0% inside. The inside fraction
 *   is the long back and side hair passing through the neck and shoulders, not
 *   the scalp.
 *
 *   CROWN: hair apex y 161.63 against a skull crown of 158.105, i.e. 3.52 cm of
 *   curl volume above the skull. No gap: 23,985 hair vertices sit above y 156.
 *
 *   HAIRLINE: the lowest front-centre hair vertex (|x| < 3, z > 5) is at
 *   y 150.46, which is the brow ridge. Eye centres are at y 148.60, so the
 *   fringe stops 1.9 cm above the eyes and does not occlude them. Across the
 *   whole eye band (y 147..150, |x| < 6) exactly 35 of 117,750 hair vertices sit
 *   in front of the skin, all of them stray curl tips at the temples.
 *
 *   EARS: 100% of the 2,403 sampled ear-surface points have hair OUTBOARD of
 *   them, by 2.20 cm at p05 and 4.17 cm at p50. The ears are inside the hair
 *   volume, so this style covers them and any hair/ear intersection is hidden —
 *   the acceptable case, not a cut-through.
 */
export const HYPER3D_HAIR_FIT_EVIDENCE = {
  capSignedDistanceCm: { p05: -0.11, p50: 0.38, p95: 1.22, min: -0.26, insideFraction: 0.146 },
  curlSignedDistanceCm: { p05: 0.11, p50: 2.29, insideFraction: 0.04 },
  hairApexY: 161.63,
  skullCrownY: 158.105,
  frontHairlineY: 150.46,
  eyeCentreY: 148.6,
  eyeBandOccludingVertices: 35,
  earPointsCoveredFraction: 1
} as const;

/**
 * Material policy for the two hair meshes.
 *
 * WHAT THE FBX HANDS US, and why it cannot be used as-is. FBXLoader maps the
 * asset's Phong material by FBX property name, and the author bound the maps the
 * Maya/Blender way rather than the three.js way:
 *
 *   DiffuseColor      -> map        = light4.png            (11 x 10 pixels)
 *   TransparentColor  -> alphaMap   = beatricehair_diff.png (2048 x 2048 RGBA)
 *   NormalMap         -> normalMap  = beatricehair_norm.png (2048 x 2048)
 *
 * `light4.png` is an 11 x 10 lighting swatch, not a base colour, and the real
 * 2048 diffuse — mean #36211a, a warm dark brown — arrives in the alpha slot.
 * Worse, three's `alphaMap` reads the GREEN channel, so leaving it there would
 * drive opacity from the hair's green colour rather than from its alpha. Both
 * slots are therefore re-derived here by filename, which is why the material is
 * rebuilt rather than tweaked. Nothing is invented: every map bound below is a
 * file the FBX itself references.
 *
 * WHAT THE MAPS ACTUALLY CONTAIN (measured, `hyper3d-hair-asset-audit.mjs`)
 * ---------------------------------------------------------------------------
 * These four numbers decide every parameter in the two looks below.
 *
 *   ALPHA IS ESSENTIALLY BINARY. `beatricehair_diff.png`: 44.6% of texels at
 *   alpha 0, 40.3% at 225-255, and only 8.2% spread across the whole 1..192
 *   range. Raising the cut-off from 0.10 to 0.60 changes how much of the inked
 *   map survives by ten percentage points (90.0% -> 79.5%). The consequence is
 *   worth stating plainly: THE HARD SILHOUETTE IS IN THE SUPPLIED MASK, and no
 *   `alphaTest` value can soften it. The only lever that touches the edge is
 *   letting that thin 8% fringe BLEND instead of being cut, which is what
 *   `transparent` does in the realistic look.
 *
 *   THE COLOUR IS CORRECT, NOT TOO DARK. Body texels (alpha >= 200) mean
 *   #36211a with a linear luminance of 0.0262 — squarely in the 0.02..0.06 that
 *   real dark-brown hair occupies. It is also genuinely warm (R-B +27.6,
 *   R/G 1.62) and genuinely varied (sRGB luma p10 11.3, p50 31.5, p90 71.9,
 *   max 190.4, a six-fold spread). So "flat near-black" is a SHADING result, not
 *   a texture defect, and the fix is to stop crushing the variation rather than
 *   to tint the map.
 *
 *   THE NORMAL MAP IS GENTLE. Mean tangent-space tilt is 7.5 degrees on the
 *   curls and 5.7 on the cap. It is a soft strand relief, not a harsh one, so it
 *   needs scaling down rather than replacing — and there is no reason to
 *   synthesise a second, noisier one.
 *
 *   NO ROUGHNESS, SPECULAR, AO OR METALNESS MAP SHIPS. The vendor readme
 *   advertises a 1024 specular map; the download does not contain one. Those
 *   slots stay empty and the scalars below apply instead, rather than inventing
 *   a map.
 *
 * WHY THE LIGHTING MAKES THIS HARD. Hyper3D is lit by ambient 0.55 plus two
 * directionals (key 2.1, fill 0.85) and NO environment map — `StudioEnvironment`
 * is female-only. With no IBL there is no soft ambient specular, so a low
 * roughness produces two small, hard GGX highlights on an otherwise 0.026-albedo
 * surface. That is precisely the reported "plastic, too glossy, dark and
 * uniform": a near-black body with two shiny blobs on it. Scene lighting is
 * shared with the face and its accepted baseline, so it is not touched here; the
 * whole correction is material-side.
 */

/** The two review looks. `current` is the material being complained about. */
export type Hyper3dHairLook = "current" | "realistic";

export interface Hyper3dHairMaterialSpec {
  label: string;
  roughness: number;
  metalness: number;
  /** Cut-off below which a fragment is discarded outright. */
  alphaTest: number;
  /** When true the surviving fringe BLENDS instead of being binary. */
  transparent: boolean;
  depthWrite: boolean;
  alphaToCoverage: boolean;
  side: typeof FrontSide | typeof DoubleSide;
  normalScale: number;
  /**
   * Sheen strength. 0 keeps a plain `MeshStandardMaterial`; above 0 the material
   * is built as `MeshPhysicalMaterial` so the sheen lobe is available.
   */
  sheen: number;
  sheenRoughness: number;
  /** Sheen tint. Warm, sampled from the map's own body colour, never white. */
  sheenColor: number;
  /**
   * Midtone lift applied to the base colour in the fragment shader. 0 = the map
   * untouched. See `applyDiffuseLift` for the curve and why it exists.
   */
  diffuseLift: number;
  /** Marks the hair meshes for the shadow pass. Inert while shadows are off. */
  castShadow: boolean;
  receiveShadow: boolean;
}

/**
 * Opens up the base colour's midtones, in the shader, after the map is sampled.
 *
 * WHY THIS IS NEEDED, and why it is not "brightening the hair because I felt
 * like it". The supplied diffuse has a linear luminance of 0.0262, which is
 * physically right for dark brown hair — and it is dark brown hair, so nothing
 * about the map is wrong. But this scene has NO environment map: Hyper3D is lit
 * by ambient 0.55 plus two directionals, and `StudioEnvironment` is female-only.
 * A 0.026-albedo surface with no IBL has almost nothing to return except two
 * specular lobes, which is exactly how the hair arrived at "near-black body with
 * plastic highlights".
 *
 * That was measured rather than assumed. Sweeping the material alone over
 * roughness 0.60-0.82, sheen 0-0.70 and an added emissive moved the rendered
 * median hair luma only between 26.9 and 33.7 — the shading parameters cannot
 * reach the brightness the brief is asking for, because the energy is not there
 * to redistribute. So the lift goes on the albedo, and it is declared here as a
 * compensation for the missing environment term rather than hidden in a texture.
 *
 * THE CURVE is `out = in * (1 + k(1 - in))` on the sRGB-encoded value. It fixes
 * both 0 and 1, so blacks stay black and highlights do not clip; only the
 * midtones open. That maps directly onto what the brief asked for — "deep brown
 * body, slightly warmer midtones, subtle lighter strands in highlights, darker
 * roots/interior" — and because it is monotonic it preserves every bit of the
 * map's own six-fold luminance variation instead of flattening it.
 *
 * `k` was chosen from renders, not taste. Measured median hair luma / share of
 * hair pixels above luma 150, against the CURRENT look's 48.2 / 1.18%:
 *
 *   k 0     28.3 / 0.10%     correct but reads flat and cool
 *   k 0.35  34.9 / 0.12%     deep brown body with lifted midtones   <- chosen
 *   k 0.55  39.3 / 0.16%     starting to read light
 *   k 0.75  44.5 / 0.26%     matches the old brightness but goes auburn
 *   k 0.95  54.5 / 0.72%     too light, and the specular tail returns
 *
 * A fragment-shader injection rather than a re-encoded texture on a canvas: no
 * second 2048x2048 upload, no dependence on the image having finished decoding
 * before the material is built, and it works in environments with no canvas at
 * all. `customProgramCacheKey` keeps three from sharing a program between two
 * materials that differ only by this.
 */
const applyDiffuseLift = (material: MeshStandardMaterial, gain: number): void => {
  if (gain <= 0) return;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.hyper3dHairLift = { value: gain };
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "uniform float hyper3dHairLift;\nvoid main() {")
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        {
          // Encode, lift the midtones, decode. Alpha is never touched: it is the
          // cut-out mask and any change to it would move the silhouette.
          vec3 hairEncoded = pow( max( diffuseColor.rgb, vec3( 0.0 ) ), vec3( 1.0 / 2.2 ) );
          hairEncoded = min( vec3( 1.0 ), hairEncoded * ( 1.0 + hyper3dHairLift * ( 1.0 - hairEncoded ) ) );
          diffuseColor.rgb = pow( hairEncoded, vec3( 2.2 ) );
        }`
      );
  };
  material.customProgramCacheKey = () => `hyper3dHairLift:${gain}`;
};

export const HYPER3D_HAIR_LOOKS: Record<Hyper3dHairLook, Hyper3dHairMaterialSpec> = {
  /**
   * CURRENT HAIR — the material from the placement pass, kept verbatim as the
   * A/B reference. Every complaint in the realism brief is visible here, and
   * three of its values are the cause:
   *
   *   roughness 0.52  the two directionals land as hard specular blobs
   *   normalScale 1   every strand slope catches one of them, so the silhouette
   *                   reads as a field of separate lit ribbons
   *   alphaTest 0.5   with transparent false, the edge is strictly binary
   */
  current: {
    label: "CURRENT HAIR",
    roughness: 0.52,
    metalness: 0,
    alphaTest: 0.5,
    transparent: false,
    depthWrite: true,
    alphaToCoverage: true,
    side: DoubleSide,
    normalScale: 1,
    sheen: 0,
    sheenRoughness: 1,
    sheenColor: 0x000000,
    diffuseLift: 0,
    castShadow: false,
    receiveShadow: false
  },

  /**
   * REALISTIC HAIR — the realism pass. Five changes, each aimed at one of the
   * reported symptoms and each sized from the measurements above.
   *
   * 1. `roughness` 0.52 -> 0.82. THE dominant lever for "plastic" and "too
   *    glossy". With no environment map the specular is two directional lobes;
   *    widening them spreads the same energy over most of the surface, which
   *    both kills the hard shine and lifts the body out of near-black. 0.82 sits
   *    at the top of the brief's 0.65-0.85 band because this scene has no IBL to
   *    supply soft reflection — a lower value in an IBL scene would read the
   *    same as this one here.
   *
   * 2. `normalScale` 1 -> 0.45. The map's mean tilt is only 7.5 degrees, so at
   *    full strength it is not exaggerated in the abstract — but every one of
   *    those slopes was picking up its own piece of the hard highlight, which is
   *    what made the silhouette read as noisy separate ribbons. Halving it keeps
   *    the strand grain and stops it glittering. It is reduced, NOT replaced,
   *    and no synthetic normal detail is added.
   *
   * 3. `transparent` false -> true with `alphaTest` 0.5 -> 0.22. The only
   *    softening the supplied mask allows. Below 0.22 the fragment is discarded
   *    exactly as before; above it, it now blends by its own alpha instead of
   *    being forced fully opaque. Since 40.3% of texels are already at alpha
   *    225+, the body stays solid and only the ~8% fringe actually feathers.
   *
   *    `depthWrite` STAYS TRUE, and that is deliberate against the usual
   *    "transparent means depthWrite false" habit. These curls are 37,850
   *    triangles of closed, heavily interpenetrating clump volumes, not a few
   *    sorted cards; with depth writing off, back curls draw over near ones in
   *    index order and the whole wig swims as the head turns. Keeping depth
   *    writing makes the solid body depth-correct and confines any ordering
   *    error to the thin blended fringe.
   *
   * 4. `sheen` 0.35, warm, rough. This is the "some sheen, but not hard plastic
   *    highlights" the brief asks for, and it is the right instrument for it:
   *    the sheen lobe is a broad grazing-angle term rather than a mirror
   *    highlight, so it lifts the curl silhouettes and the outer volume without
   *    putting a bright spot on any single card. Tinted #7a5238 — the map's own
   *    body hue lifted, not white — so the sheen reads as light through brown
   *    hair instead of a grey film. `sheenRoughness` 0.85 keeps it broad.
   *
   * 5. `side` stays `DoubleSide`. It was tested against `FrontSide` and
   *    `FrontSide` is worse here: the clumps are closed volumes (only 10.7% open
   *    edges) and the mask removes 44.6% of their surface, so with backfaces
   *    culled every hole becomes a window straight through the wig to the scalp.
   *    See `docs/evidence/hyper3d-curly-hair/`.
   *
   * NOT changed, and deliberately: the base colour stays white over the supplied
   * map. The map is already the right albedo and already carries a six-fold
   * luminance spread, so tinting it would only re-flatten what the roughness
   * change just recovered.
   */
  realistic: {
    label: "REALISTIC HAIR",
    roughness: 0.82,
    metalness: 0,
    alphaTest: 0.22,
    transparent: true,
    depthWrite: true,
    alphaToCoverage: true,
    side: DoubleSide,
    normalScale: 0.45,
    sheen: 0.35,
    sheenRoughness: 0.85,
    sheenColor: 0x7a5238,
    diffuseLift: 0.35,
    castShadow: true,
    receiveShadow: true
  }
};

/**
 * Shadow-pass settings for the hair, in world metres.
 *
 * `extentMetres` is a HALF-extent: 0.35 gives a 0.7 m orthographic box around a
 * 0.27 m head, so the 2048 map lands about 0.34 mm per texel — finer than a
 * curl. The three default of 5 m would put ~5 mm on each texel and turn the
 * self-shadow into blocks.
 *
 * `bias` and `normalBias` are the pair that keeps alpha-tested hair from
 * shadow-acneing on itself. `normalBias` does most of the work here because the
 * curls are thin closed tubes whose front and back faces are a millimetre apart.
 */
export const HYPER3D_HAIR_SHADOW = {
  mapSize: 2048,
  extentMetres: 0.35,
  near: 0.1,
  far: 12,
  bias: -0.0008,
  normalBias: 0.01,
  /** Skull centre in world metres: `HYPER3D_HAIR_PIVOT` through `config.scale`. */
  targetMetres: [0, 1.45, 0] as readonly [number, number, number]
} as const;

/** The look a fresh session starts on: the product of this pass. */
export const HYPER3D_HAIR_DEFAULT_LOOK: Hyper3dHairLook = "realistic";

/**
 * Kept as the name the placement pass's tests and the DEV panel already use.
 * It is the CURRENT look, i.e. the A/B reference, not the shipped default.
 */
export const HYPER3D_HAIR_MATERIAL = HYPER3D_HAIR_LOOKS.current;

/** What `prepareHyper3dHair` found and did, for the DEV panel and the tests. */
export interface Hyper3dHairMeshReport {
  name: string;
  vertices: number;
  triangles: number;
  skinned: boolean;
  /** Filenames of the textures bound to this mesh, by slot. */
  maps: { map?: string; normalMap?: string };
  /** Texture filenames present on the FBX material that were deliberately dropped. */
  droppedMaps: string[];
}

/** What `prepareHyper3dHair` found in the FBX. */
export interface Hyper3dHairAssetReport {
  meshes: Hyper3dHairMeshReport[];
  /** True when the FBX declared any bone or SkinnedMesh. */
  rigged: boolean;
  animations: number;
}

/** The full DEV readout: what the asset contained, and where it ended up. */
export interface Hyper3dHairReport extends Hyper3dHairAssetReport {
  assetUrl: string;
  /** The node the hair is parented to, or null when the bone was not found. */
  parentBone: string | null;
  attached: boolean;
  reason?: string;
  /** Rest-pose world bounds of the fitted hair, in metres (post `config.scale`). */
  bounds?: { min: [number, number, number]; max: [number, number, number]; size: [number, number, number] };
}

/** Where the loader's original material is parked, so a look switch can rebuild. */
const SOURCE_MATERIAL = "hyper3dHairSourceMaterial";

/** Reads the source filename off a texture, whatever the loader recorded. */
const textureFileName = (texture: Texture | null | undefined): string | undefined => {
  if (!texture) return undefined;
  const image = texture.image as { currentSrc?: string; src?: string } | undefined;
  const raw = image?.currentSrc ?? image?.src ?? texture.name;
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw.split("?")[0].split("/").pop() ?? raw);
  } catch {
    return raw;
  }
};

/** Every texture the loader bound anywhere on a material, indexed by filename. */
const collectTextures = (material: Material): Map<string, Texture> => {
  const found = new Map<string, Texture>();
  const source = material as unknown as Record<string, Texture | null | undefined>;
  for (const slot of ["map", "alphaMap", "normalMap", "bumpMap", "specularMap", "emissiveMap", "aoMap", "envMap"]) {
    const texture = source[slot];
    const name = textureFileName(texture);
    if (texture && name && !found.has(name)) found.set(name, texture);
  }
  return found;
};

const pickTexture = (textures: Map<string, Texture>, suffix: string): Texture | undefined => {
  for (const [name, texture] of textures) if (name.toLowerCase().endsWith(suffix)) return texture;
  return undefined;
};

/**
 * Builds this mesh's replacement material from the textures the FBX already
 * loaded. No texture is fetched a second time: the objects handed back by
 * FBXLoader are re-bound into the correct slots.
 */
const buildHairMaterial = (
  name: string,
  source: Material,
  spec: Hyper3dHairMaterialSpec
): { material: MeshStandardMaterial; report: Hyper3dHairMeshReport["maps"]; dropped: string[] } => {
  const textures = collectTextures(source);
  const diffuse = pickTexture(textures, "_diff.png");
  const normal = pickTexture(textures, "_norm.png");
  const used = new Set([diffuse, normal].filter(Boolean) as Texture[]);
  const dropped = [...textures].filter(([, texture]) => !used.has(texture)).map(([file]) => file);

  /**
   * COLOUR SPACE. The base colour must be sRGB or the whole map is decoded as if
   * it were linear and the hair renders roughly twice as dark as authored —
   * which on a 0.026-albedo texture is the difference between dark brown and
   * black. The normal map must NOT be, because its texels are vectors.
   *
   * Both are asserted rather than trusted: FBXLoader sets sRGB only on whatever
   * it bound to `map`, and for this asset that was the 11x10 lighting swatch,
   * not the file we are about to put there.
   */
  if (diffuse) diffuse.colorSpace = SRGBColorSpace;
  if (normal) normal.colorSpace = "" as Texture["colorSpace"];

  const parameters = {
    name: `${name}__hyper3dHair`,
    map: diffuse ?? null,
    normalMap: normal ?? null,
    /**
     * Falls back to the measured mean of the diffuse map (#36211a) ONLY if the
     * asset ever ships without one. With the map bound this stays white: the
     * map's own six-fold luminance spread IS the colour variation the brief
     * asks for, and any tint would multiply it back down toward flat.
     */
    color: diffuse ? 0xffffff : 0x36211a,
    roughness: spec.roughness,
    metalness: spec.metalness,
    transparent: spec.transparent,
    depthWrite: spec.depthWrite,
    // Depth TESTING is always on. Only depth WRITING is a question for hair.
    depthTest: true,
    alphaTest: diffuse ? spec.alphaTest : 0,
    side: spec.side
  };

  /**
   * `MeshPhysicalMaterial` only when sheen is actually wanted. It is a strict
   * superset of `MeshStandardMaterial` but compiles a heavier shader, so the
   * A/B reference keeps the cheaper one and the comparison stays honest about
   * what the realistic look costs.
   */
  const material = spec.sheen > 0
    ? new MeshPhysicalMaterial({
        ...parameters,
        sheen: spec.sheen,
        sheenRoughness: spec.sheenRoughness,
        sheenColor: new Color(spec.sheenColor)
      })
    : new MeshStandardMaterial(parameters);

  /**
   * Hardware MSAA resolve on the alpha-tested edge. `<Canvas>` is created with
   * r3f's default `antialias: true`, so the drawing buffer is multisampled; on a
   * context without MSAA this is simply inert.
   */
  material.alphaToCoverage = spec.alphaToCoverage;
  if (normal) material.normalScale.set(spec.normalScale, spec.normalScale);
  applyDiffuseLift(material, spec.diffuseLift);

  return {
    material,
    report: { map: textureFileName(diffuse), normalMap: textureFileName(normal) },
    dropped
  };
};

/**
 * Turns the freshly loaded FBX root into the group that gets parented to the
 * head bone, and reports what it contained.
 *
 * Idempotent by construction: it is called once per loaded asset and the result
 * is cached by the caller, and `attachHyper3dHair` refuses to add a group that
 * is already under the bone.
 */
export const prepareHyper3dHair = (
  loaded: Object3D,
  look: Hyper3dHairLook = HYPER3D_HAIR_DEFAULT_LOOK
): { group: Group; report: Hyper3dHairAssetReport } => {
  const report: Hyper3dHairAssetReport = { meshes: [], rigged: false, animations: loaded.animations?.length ?? 0 };

  /**
   * Two nested groups, and the split is the point.
   *
   *   outer (`HYPER3D_HAIR_GROUP_NAME`)  the DEV fit: pivot + offsets. Rewritten
   *                                      on every slider move.
   *   inner (`HYPER3D_HAIR_BASE_NAME`)   the measured default fit. Written once
   *                                      and never touched again.
   *
   * Keeping them apart means RESET HAIR FIT is a write of three literal defaults
   * rather than a recomputation, and a slider can never corrupt the measurement.
   */
  const group = new Group();
  group.name = HYPER3D_HAIR_GROUP_NAME;
  const base = new Group();
  base.name = HYPER3D_HAIR_BASE_NAME;
  group.add(base);

  const measured = HYPER3D_HAIR_MEASURED_TRANSFORM;
  // `base` carries the fitted transform with the pivot removed, so that placing
  // `group` AT the pivot reproduces the fit exactly: T(pivot) * T(-pivot) * fit.
  base.position.set(
    measured.position[0] - HYPER3D_HAIR_PIVOT[0],
    measured.position[1] - HYPER3D_HAIR_PIVOT[1],
    measured.position[2] - HYPER3D_HAIR_PIVOT[2]
  );
  base.rotation.set(
    MathUtils.degToRad(measured.rotationDegrees[0]),
    MathUtils.degToRad(measured.rotationDegrees[1]),
    MathUtils.degToRad(measured.rotationDegrees[2])
  );
  base.scale.setScalar(measured.scale);

  // The FBX children keep their own authored transform (rotation X -90, scale
  // 100). Moving them rather than copying keeps the loader's geometry, so a
  // model switch and back reuses the same buffers.
  for (const child of [...loaded.children]) {
    const mesh = child as Mesh & { isMesh?: boolean; isSkinnedMesh?: boolean };
    if (!mesh.isMesh) continue;
    if (mesh.isSkinnedMesh) {
      // Refused for the same reason `attachHeadMeshes` refuses one: a skinned
      // mesh already follows its own skeleton, so reparenting would apply the
      // head transform twice. The audit says this asset has none; the guard is
      // here so a swapped asset degrades to "no hair" instead of "double hair".
      report.rigged = true;
      continue;
    }
    const position = mesh.geometry.attributes.position;
    const index = mesh.geometry.index;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    /**
     * The loader's own material is kept, unused, so a look switch can rebuild
     * from the ORIGINAL texture bindings. Rebuilding from the replacement would
     * work once and then compound, because the replacement no longer carries the
     * dropped slots the rebuild classifies by.
     */
    mesh.userData[SOURCE_MATERIAL] = material;
    const built = buildHairMaterial(mesh.name, material, HYPER3D_HAIR_LOOKS[look]);
    mesh.material = built.material;
    mesh.castShadow = HYPER3D_HAIR_LOOKS[look].castShadow;
    mesh.receiveShadow = HYPER3D_HAIR_LOOKS[look].receiveShadow;
    /**
     * Render after the head. In the CURRENT look the hair is alpha-tested and
     * opaque, so this only guarantees the skull has already filled depth when a
     * cut-out fragment is discarded. In the REALISTIC look the material is
     * `transparent`, so three already queues it after the opaque pass and this
     * just fixes the order within it.
     */
    mesh.renderOrder = 1;
    base.add(mesh);
    report.meshes.push({
      name: mesh.name,
      vertices: position.count,
      triangles: (index ? index.count : position.count) / 3,
      skinned: false,
      maps: built.report,
      droppedMaps: built.dropped
    });
  }

  loaded.traverse((object) => {
    if (object.type === "Bone") report.rigged = true;
  });

  return { group, report };
};

/**
 * Rebuilds the hair materials for a different review look, in place.
 *
 * Rebuild rather than mutate: the two looks differ in MATERIAL CLASS —
 * `realistic` needs `MeshPhysicalMaterial` for its sheen lobe — so there is no
 * set of property writes that turns one into the other. Each mesh is rebuilt
 * from the loader's original material, which `prepareHyper3dHair` parked on
 * `userData`, so switching back and forth is lossless and cannot compound.
 *
 * The old material is disposed on the way out; its TEXTURES are not, because
 * they are owned by the r3f loader cache and shared with the incoming material.
 */
export const applyHyper3dHairLook = (group: Object3D, look: Hyper3dHairLook): Hyper3dHairMeshReport["maps"][] => {
  const spec = HYPER3D_HAIR_LOOKS[look];
  const reports: Hyper3dHairMeshReport["maps"][] = [];
  group.traverse((object) => {
    const mesh = object as Mesh & { isMesh?: boolean };
    if (!mesh.isMesh) return;
    const source = mesh.userData[SOURCE_MATERIAL] as Material | undefined;
    if (!source) return;
    const previous = mesh.material as MeshStandardMaterial;
    const built = buildHairMaterial(mesh.name, source, spec);
    mesh.material = built.material;
    mesh.castShadow = spec.castShadow;
    mesh.receiveShadow = spec.receiveShadow;
    if (previous?.name?.endsWith("__hyper3dHair")) previous.dispose();
    reports.push(built.report);
  });
  return reports;
};

/**
 * Writes a fit, and the HAIR ON/OFF state, onto the group. Cheap enough to call
 * on every slider frame: it touches three vectors and a boolean.
 *
 * Visibility lives here rather than at the call site so the caller never has to
 * reach into the group it was handed — which is also what keeps the React
 * compiler's immutability rule satisfied in `Hyper3dHair`.
 */
export const applyHyper3dHairFit = (group: Object3D, fit: Hyper3dHairFit, visible = true): void => {
  group.visible = visible;
  group.position.set(
    HYPER3D_HAIR_PIVOT[0] + fit.position[0],
    HYPER3D_HAIR_PIVOT[1] + fit.position[1],
    HYPER3D_HAIR_PIVOT[2] + fit.position[2]
  );
  group.rotation.set(
    MathUtils.degToRad(fit.rotationDegrees[0]),
    MathUtils.degToRad(fit.rotationDegrees[1]),
    MathUtils.degToRad(fit.rotationDegrees[2])
  );
  group.scale.setScalar(fit.scale);
};

/**
 * Parents the hair under the head bone.
 *
 * `add`, not `attach`: the group's transform is already expressed in `Head_M`
 * local space by construction, so preserving a world transform would be exactly
 * wrong here. (`attachHeadMeshes` uses `attach` for the opposite reason — those
 * meshes are already correctly placed in world space and must not move.)
 *
 * Returns false when the bone is missing or the group is already parented, so a
 * re-render, a hot reload or a model switch and back cannot produce two wigs.
 */
export const attachHyper3dHair = (root: Object3D, group: Object3D): { attached: boolean; bone: string | null; reason?: string } => {
  const bone = root.getObjectByName(HYPER3D_HAIR_PARENT_BONE) as Bone | undefined;
  if (!bone) return { attached: false, bone: null, reason: `bone ${HYPER3D_HAIR_PARENT_BONE} not found` };
  if (group.parent === bone) return { attached: false, bone: bone.name, reason: "already attached" };
  bone.add(group);
  return { attached: true, bone: bone.name };
};

/**
 * Removes the group and frees the materials this module created.
 *
 * Runs on a real unmount (model switch) and, in dev, also on StrictMode's
 * simulated unmount — where the very same materials are re-attached immediately
 * after. That is survivable rather than a fault: `Material.dispose()` releases
 * the compiled program and three re-initialises the material the next time it is
 * rendered, so the double-effect costs one shader recompile and nothing else.
 */
export const disposeHyper3dHair = (group: Object3D): void => {
  group.removeFromParent();
  group.traverse((object) => {
    const mesh = object as Mesh & { isMesh?: boolean };
    if (!mesh.isMesh) return;
    const material = mesh.material as MeshStandardMaterial | MeshStandardMaterial[];
    // Only the materials built here are disposed. The TEXTURES are owned by the
    // r3f loader cache and shared with any other mount of the same URL, so
    // disposing them would blank the hair on the next model switch.
    for (const entry of Array.isArray(material) ? material : [material]) {
      if (entry?.name?.endsWith("__hyper3dHair")) entry.dispose();
    }
  });
};

/**
 * True for the hair group and everything under it.
 *
 * The hair lives INSIDE the avatar's own scene graph — it has to, it hangs off a
 * bone — so every `scene.traverse` in `AvatarModel` and `hyper3dMaterials` walks
 * into it. This is the guard those traversals use to walk back out again. The
 * three places that need it are documented at their call sites; everything else
 * either filters the hair out already (morph discovery needs a
 * `morphTargetDictionary`, bone discovery needs a `Bone`) or is female-only.
 */
export const isHyper3dHairObject = (object: Object3D): boolean => {
  for (let node: Object3D | null = object; node; node = node.parent) {
    if (node.name === HYPER3D_HAIR_GROUP_NAME) return true;
  }
  return false;
};

/** Rest-pose world bounds of the fitted hair, for the DEV readout. */
export const hyper3dHairBounds = (group: Object3D): { min: Vector3; max: Vector3; size: Vector3 } => {
  group.updateWorldMatrix(true, true);
  const box = new Box3().setFromObject(group);
  const size = new Vector3();
  box.getSize(size);
  return { min: box.min.clone(), max: box.max.clone(), size };
};
