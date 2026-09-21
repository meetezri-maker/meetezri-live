/**
 * FEMALE_229 — FEMALE.228 APPEARANCE TRANSFER.
 *
 * ============================================================================
 * APPEARANCE ONLY. NOTHING HERE REACHES ANIMATION.
 * ============================================================================
 *
 * This module carries Female.228's ACCEPTED render settings onto
 * `female_229.glb`. It exports material, light and renderer values and nothing
 * else: no morph value, no phoneme table, no calibration entry, no gaze, blink,
 * head, neck, expression or Active Presence constant is read, written or
 * re-exported here, and no file that owns one imports this. The Hyper3D
 * animation stack is untouched and stays the single owner of behaviour.
 *
 * It also does NOT carry a camera. Female.228's accepted preset has its own
 * portrait camera; reproducing it here would reframe the shot, which the
 * transfer brief forbids. `AvatarCanvas` therefore mounts the profile's
 * lighting, environment, materials and exposure while leaving
 * `avatarModelConfigs["hyper3d-usc"].camera` as the only camera source.
 *
 * ONE SOURCE FOR THE REFERENCE VALUES. Everything below is derived from
 * `femaleRenderPresets["portrait-final"]` at module load rather than retyped, so
 * a later change to the accepted Female.228 preset propagates here instead of
 * silently drifting from it. The only values written out longhand are the ones
 * that a measurement says cannot be copied unchanged, and each of those states
 * the measurement.
 *
 * ---------------------------------------------------------------------------
 * MEASURED STRUCTURAL COMPATIBILITY, read from the two .glb files themselves
 * (authored material blocks, embedded image bytes and UV accessors — not from
 * screenshots and not from the loader's post-processing):
 *
 *   material              Female.228              female_229           verdict
 *   UnrealMaterial.004    eyes, rough 0.0745      IDENTICAL            1:1
 *   UnrealMaterial.002    teeth, rough 1.0        IDENTICAL            1:1
 *   Material.005          hair, metal 0.5455      IDENTICAL            1:1
 *   Material.004          black, rough 0.5        IDENTICAL            1:1
 *   Wolf3D_Body           rough 0.70              IDENTICAL            1:1
 *   Wolf3D_Outfit_*       rough 1.0, metal 1.0    IDENTICAL            1:1
 *   UnrealMaterial.001    face skin               ABSENT (M_Face.002)  adapter
 *   UnrealMaterial.006    lash / tear line        ABSENT               none
 *
 * "IDENTICAL" is byte-level: the same material name carrying the same authored
 * factors and the same embedded textures. Worked examples —
 *
 *   eye base colour  sha256 3fb816a2e2b6105b on BOTH assets
 *   eye normal map   sha256 28d899836b41570a on BOTH assets
 *   eye mesh UV_0    sha256 8c199ff65da868ef on BOTH assets, 772 vertices each
 *   hair base colour sha256 57d1c082cd3448ed on BOTH assets
 *   teeth maps       sha256 07faca63fa450725 / 9c8a0882cba5e6fb / 543f6bde20a0c006
 *
 * So the eye appearance transfer has the exact UV/texture compatibility proof
 * that the brief requires before any eye value may move, and the hair, teeth,
 * body and outfit transfers are the same material receiving the same number.
 *
 * THE FACE IS THE ONE REGION THAT IS NOT SHARED, and it is not close:
 *
 *   Female.228  UnrealMaterial.001 on Face.002,        13,292 face vertices
 *               base colour "ChatGPT Image Jul 9 2026" sha256 a516b7dd4dde09ef
 *               normal map  MI_Face_Skin_Baked_LOD1_VT sha256 ae1a67fc42b09b0c
 *               UV_0 sha256 18609425c94da6a0
 *   female_229  M_Face.002 on blendshapes.002,         13,631 face vertices
 *               base colour "texture_diffuse"          sha256 d488ee0555b8f830
 *               normal map  NONE AUTHORED (the runtime binds the USC pack's
 *                           texture_normal.png, a UDIM tile-1001 projection)
 *               UV_0 sha256 b186cfc907b05e2f
 *
 * Different unwrap, different vertex count, different maps. Neither texture may
 * be moved to the other asset, which is why this module transfers face
 * PARAMETERS and never face IMAGE DATA.
 */

import { getFemaleRenderConfig } from "../femaleRenderPresets";
import type {
  RenderEnvironmentConfig,
  RenderLightConfig,
  RenderMaterialTuning
} from "../femaleRenderPresets";

/** The accepted Female.228 production state. The reference for everything below. */
const FEMALE_228 = getFemaleRenderConfig("portrait-final");

/**
 * Measured world-space geometry of the two faces, with each asset's own runtime
 * `scale` and `position` from `avatarModelConfig` already applied. Used only to
 * place the one light whose effect depends on where it sits.
 */
export const FACE_WORLD_GEOMETRY = {
  female228: { chinY: 0.9096, crownY: 1.1504, frontZ: 0.1287 },
  female229: { chinY: 1.3012, crownY: 1.5892, frontZ: 0.1026 }
} as const;

/**
 * LIGHTING — Female.228's accepted rig, reproduced.
 *
 * AMBIENT, KEY, FILL and RIM are copied verbatim, and that is exact rather than
 * approximate: three's `directionalLight` uses `position` only to derive a
 * DIRECTION toward its target (the origin, for all three here) and applies no
 * distance falloff, so a directional delivers identical irradiance to an
 * identically-oriented surface no matter where that surface sits. female_229's
 * face sits ~0.39 m higher in world space than Female.228's, and for these four
 * lights that changes nothing at all.
 *
 * THE BOUNCE IS THE ONE EXCEPTION, and it is a pointLight, so it is the one
 * light for which position IS the parameter. Every number Female.228 chose is
 * preserved — intensity 0.06, colour #ffe8d8, distance 1.6, decay 2 — and only
 * the anchor moves, by exactly the offset Female.228 placed it at:
 *
 *   Female.228 bounce  [0, 0.3500, 0.1800]
 *   its face chin      [0, 0.9096, 0.1287]
 *   offset             [0, -0.5596, +0.0513]   (0.5619 m from the chin)
 *
 *   female_229 chin    [0, 1.3012, 0.1026]
 *   same offset gives  [0, 0.7416, 0.1539]     (0.5619 m from the chin)
 *
 * Copying the literal [0, 0.35, 0.18] instead would leave the light 0.9543 m
 * from female_229's chin, i.e. at decay 2 only (0.5619/0.9543)^2 = 34.7% of the
 * accepted irradiance, and arriving at a much shallower angle. That would be the
 * number transferred and the light lost. The offset form transfers both.
 */
export const HYPER3D_F228_LIGHTING: RenderLightConfig = {
  ...FEMALE_228.lighting,
  bouncePosition: [
    FEMALE_228.lighting.bouncePosition[0],
    FEMALE_228.lighting.bouncePosition[1] -
      FACE_WORLD_GEOMETRY.female228.chinY +
      FACE_WORLD_GEOMETRY.female229.chinY,
    FEMALE_228.lighting.bouncePosition[2] -
      FACE_WORLD_GEOMETRY.female228.frontZ +
      FACE_WORLD_GEOMETRY.female229.frontZ
  ]
};

/**
 * ENVIRONMENT — copied verbatim, and exactly transferable.
 *
 * `StudioEnvironment` renders five lightformers into a cube target and hands the
 * result to `scene.environment`, which three samples as an infinite surround.
 * It has no position relative to the avatar, so there is nothing to adapt.
 *
 * This is also the single largest appearance gap being closed: female_229 has
 * been rendering with `scene.environment` unset, so every `envMapIntensity` in
 * the table below had nothing to multiply and the eyeballs — authored at
 * roughness 0.0745, i.e. a near-mirror — had nothing to reflect.
 */
export const HYPER3D_F228_ENVIRONMENT: RenderEnvironmentConfig = { ...FEMALE_228.environment };

/**
 * The face-skin material's name on each asset. Female.228's tuning table is
 * keyed by material name, so the one region whose name differs needs a remap;
 * every other key in that table already names a material female_229 also has.
 *
 * Both spellings are listed because Blender's exporter suffixes duplicated
 * datablocks (`M_Face` -> `M_Face.002`), and `applyMaterialTuning` matches the
 * exported spelling exactly. Deliberately NOT solved with a generic
 * "strip the numeric suffix" rule: that would fold `UnrealMaterial.001`,
 * `UnrealMaterial.004`, `Material.004` and `Material.005` into two buckets and
 * cross-wire the face, eyes, hair and the black head geometry.
 */
export const FEMALE_229_FACE_MATERIAL_NAMES = ["M_Face", "M_Face.002"] as const;

/** Female.228's face-skin key, remapped off the table and onto female_229's names. */
const FEMALE_228_FACE_MATERIAL_NAME = "UnrealMaterial.001";

/**
 * THE EYEBALL AND TEETH MATERIALS, AS `female_229.glb` ACTUALLY SPELLS THEM.
 *
 * A SILENT REGRESSION, found by auditing the live scene rather than the file
 * this profile was written against. Blender re-suffixes duplicated material
 * datablocks on export, and a later delivery of `female_229.glb` renamed both:
 *
 *   region   Female.228            female_229 (earlier)   female_229 (shipping)
 *   eyes     UnrealMaterial.004    UnrealMaterial.004     UnrealMaterial.023
 *   teeth    UnrealMaterial.002    UnrealMaterial.002     UnrealMaterial.022
 *
 * Both keys are matched by NAME, so after the rename the eye treatment bound to
 * nothing and the teeth key bound to the wrong slot. Measured on the running app
 * before this fix: the eyeballs rendered at their authored roughness 0.0745 with
 * `envMapIntensity` 1 and no clearcoat — i.e. the accepted corneal material was
 * absent — and the `Teeth` mesh sat at `envMapIntensity` 1 against the intended
 * 0.30, while the 0.30 landed on the body mesh's inner-mouth slot, which still
 * carries the old `UnrealMaterial.002`.
 *
 * That is a direct cause of two of the reported symptoms: no eye reflections and
 * a weak specular response. NO ACCEPTED VALUE CHANGES HERE — the Female.228
 * numbers are exactly the ones already in this file. Only the addresses they are
 * delivered to are corrected, and every historical spelling is kept so an older
 * copy of the asset still binds.
 */
const FEMALE_229_EYE_MATERIAL_NAMES = ["UnrealMaterial.004", "UnrealMaterial.023"] as const;
const FEMALE_229_TEETH_MATERIAL_NAMES = ["UnrealMaterial.002", "UnrealMaterial.022"] as const;

/** The hair materials, for the alpha pass. Both assets spell these the same. */
export const FEMALE_229_HAIR_MATERIAL_NAMES = ["Material.005"] as const;

/**
 * A material Female.228 tunes that female_229 does not have at all.
 *
 * `UnrealMaterial.006` is Female.228's lash / tear-line strip, a BLEND material
 * carrying `KHR_materials_specular` (specularColorFactor 1.05, 1.018, 1.0) and
 * the only specular/sheen authoring anywhere in either asset. female_229 ships
 * no lash material and no lash geometry, so its envMapIntensity 0.9 and its
 * specular colour have no target here. REPORTED, not substituted onto some
 * other material.
 */
const UNTRANSFERABLE_MATERIAL_NAMES = ["UnrealMaterial.006"] as const;

/**
 * MATERIALS — Female.228's accepted per-material tuning, remapped by name.
 *
 * Each entry is the same dimensionless quantity applied to the same physical
 * role, so no value is converted, only re-addressed:
 *
 *   UnrealMaterial.001  0.42  face skin   ->  M_Face / M_Face.002  (adapter)
 *   UnrealMaterial.002  0.30  teeth       ->  same material        (1:1)
 *   UnrealMaterial.004  1.25  eyeballs    ->  same material        (1:1)
 *   Wolf3D_Body         0.35  body skin   ->  same material        (1:1)
 *   Wolf3D_Outfit_*     0.50  outfit      ->  same materials       (1:1)
 *   Material.004        0.40  black geo   ->  same material        (1:1)
 *   Material.005        0.75  hair        ->  same material        (1:1)
 *   UnrealMaterial.006  0.90  lashes      ->  NO TARGET            (dropped)
 *
 * The face-skin remap is the one place the brief's "transferable with material
 * adapter" applies: both are `MeshStandardMaterial` at metalness 0 with no
 * roughness map and no AO map, so `envMapIntensity` means the same thing on
 * both and 0.42 carries across as itself.
 *
 * HAIR AND EYES CARRY FEMALE.228'S CORRECTIONS UNCHANGED, because both assets
 * ship the identical defect and the identical material:
 *
 *   hair  `Material.005` is authored metalness 0.5455 over a pure black base
 *         colour on BOTH files. A half-metal with a black albedo renders as a
 *         dead silhouette; Female.228's accepted fix is metalness 0 and base
 *         colour #1a1418, and female_229 has been rendering the uncorrected
 *         version.
 *   eyes  `UnrealMaterial.004` is authored roughness 0.0745 on BOTH files —
 *         a polished sclera, the single strongest artificial cue. Female.228's
 *         accepted fix separates the two optical layers the geometry does not:
 *         base roughness 0.42 so the eyeball shades as tissue, and a clearcoat
 *         at roughness 0.06 as the tear film. The eye mesh, its UVs and both of
 *         its textures are byte-identical across the two assets (hashes in the
 *         module header), so this is a proven 1:1 transfer and not an
 *         assumption.
 *
 * The eye BONE REST correction, gaze axis mapping, gaze amplitude and gaze
 * timing are not touched by any of this: they live in `hyper3dRigAdapter` and
 * `hyper3dGazeCalibration` and belong to the separate eye-rig calibration task.
 * What moves here is the eyeball's SURFACE, not where it points.
 */
/**
 * HAIR, AND THE ONE PLACE female_229 DEPARTS FROM THE ACCEPTED FEMALE.228
 * MATERIAL VALUES.
 *
 * Female.228's hair correction — metalness 0.545 -> 0 and a base colour lifted
 * off pure black — transfers unchanged and is still what fixes the dead
 * silhouette. These two go further, and only for this asset, because the hair
 * review measured them against a target:
 *
 *   hairColor      #1a1418 -> #241a14. A dark warm brown instead of a cool
 *                  near-black. This is not a liberty: `hair_o` carries NO colour
 *                  at all — it is pure white across the whole 4096x4096 image,
 *                  luma 255.00 — so the tint is the only thing that decides what
 *                  colour the hair is. Measured +3.1 mean luma, which answers
 *                  "overly dark" without crossing into washed out (#2e2119 was
 *                  also swept and reached 97.8, too light).
 *   hairRoughness  0.673 -> 0.55. Swept 0.45 / 0.55 / 0.65 at a frozen pose:
 *                  0.45 puts 7.3% of hair pixels into near-black with a p95 of
 *                  159.5, which is the hot-highlight, plastic end; 0.65 drops
 *                  p95 to 116.8 and reads flat. 0.55 sits between at p95 135.2
 *                  with 0.83% near-black — a broad sheen rather than a glint.
 *
 * Female.228 itself is untouched: it has no `hairRoughness` and keeps its own
 * `hairColor`, because this record spreads its values and overrides only these.
 */
export const FEMALE_229_HAIR_COLOR = "#241a14";
export const FEMALE_229_HAIR_ROUGHNESS = 0.55;

export const HYPER3D_F228_MATERIALS: RenderMaterialTuning = {
  ...FEMALE_228.materials,
  eyeMaterialNames: FEMALE_229_EYE_MATERIAL_NAMES,
  hairColor: FEMALE_229_HAIR_COLOR,
  hairRoughness: FEMALE_229_HAIR_ROUGHNESS,
  envMapIntensityByMaterial: Object.fromEntries(
    Object.entries(FEMALE_228.materials.envMapIntensityByMaterial).flatMap(([name, intensity]) => {
      if (UNTRANSFERABLE_MATERIAL_NAMES.includes(name as (typeof UNTRANSFERABLE_MATERIAL_NAMES)[number])) return [];
      if (name === FEMALE_228_FACE_MATERIAL_NAME) {
        return FEMALE_229_FACE_MATERIAL_NAMES.map((target) => [target, intensity] as const);
      }
      // The eye and teeth keys are delivered to every spelling the asset has
      // used, with the accepted Female.228 value unchanged on each.
      if (name === "UnrealMaterial.004") return FEMALE_229_EYE_MATERIAL_NAMES.map((target) => [target, intensity] as const);
      if (name === "UnrealMaterial.002") return FEMALE_229_TEETH_MATERIAL_NAMES.map((target) => [target, intensity] as const);
      return [[name, intensity] as const];
    })
  )
};

/** Renderer exposure. A global scalar with no asset dependence — copied verbatim. */
export const HYPER3D_F228_EXPOSURE = FEMALE_228.toneMappingExposure;

export interface Hyper3dAppearanceProfile {
  id: "f228";
  label: string;
  lighting: RenderLightConfig;
  environment: RenderEnvironmentConfig;
  materials: RenderMaterialTuning;
  toneMappingExposure: number;
}

export const HYPER3D_F228_APPEARANCE: Hyper3dAppearanceProfile = {
  id: "f228",
  label: "Female.228 appearance profile",
  lighting: HYPER3D_F228_LIGHTING,
  environment: HYPER3D_F228_ENVIRONMENT,
  materials: HYPER3D_F228_MATERIALS,
  toneMappingExposure: HYPER3D_F228_EXPOSURE
};

/**
 * What Female.228 has that female_229 cannot receive, and why. Rendered by the
 * DEV comparison panel so the gaps are visible next to the render rather than
 * only in this file.
 */
export const HYPER3D_F228_NOT_TRANSFERRED: readonly { item: string; reason: string }[] = [
  {
    item: "Face base-colour texture (ChatGPT Image Jul 9 2026, sha256 a516b7dd4dde09ef)",
    reason:
      "Different unwrap. Female.228's face is 13,292 vertices with UV_0 sha256 18609425c94da6a0; female_229's is 13,631 vertices with UV_0 sha256 b186cfc907b05e2f, a UDIM tile-1001 projection. No UV compatibility proof exists, so female_229 keeps its own texture_diffuse."
  },
  {
    item: "Face normal map (MI_Face_Skin_Baked_LOD1_VT_Normal, sha256 ae1a67fc42b09b0c)",
    reason:
      "Same unwrap mismatch as the base colour. female_229 keeps the USC pack's texture_normal.png. Only the normalScale MULTIPLIER transfers, and only after being re-derived against this map's own measured relief — see HYPER3D_FACE_LOOKS['f228-profile']."
  },
  {
    item: "normalScale 1.0 as a literal value",
    reason:
      "Not a like-for-like number: it multiplies a different map. Female.228's baked normal has mean tilt 0.0428; the USC map has 0.0805, i.e. 1.88x the relief. Copying 1.0 would render 88% more surface relief than the reference, not the same amount. Transferred as the measured equivalent instead."
  },
  {
    item: "UnrealMaterial.006 — lash / tear-line strip (envMapIntensity 0.90)",
    reason: "female_229 ships no lash material and no lash geometry. No target."
  },
  {
    item: "KHR_materials_specular (specularColorFactor 1.05, 1.018, 1.0 + specular texture)",
    reason:
      "The only specular/sheen authoring in either asset, and it sits on UnrealMaterial.006, which female_229 does not have. Neither asset's SKIN carries specular or sheen authoring, so there is no skin specular value to transfer. MeshStandardMaterial has no sheen channel; inventing one was declined."
  },
  {
    item: "Portrait camera (position [0, 1.062, 1.053], target [0, 1.045, 0.03], fov 22)",
    reason: "Out of scope by instruction. female_229 keeps its accepted camera [0, 1.46, 0.8] / fov 30, unchanged."
  },
  {
    item: "Female.228's face roughnessMap / aoMap",
    reason: "Neither asset authors one on the face. Nothing to transfer; the single face roughness scalar carries the whole surface on both."
  }
];

/**
 * A difference the brief asks to be REPORTED before it is acted on.
 *
 * female_229 currently mounts an asset-local face fill light that Female.228
 * does not have: a pointLight, intensity 0.055, #fff4ea, at [0, 1.56, 0.42],
 * distance 0.95, decay 2. It was added to lift the low-frequency shading baked
 * into the USC albedo (measured sd 11.5-18.9 around the nose and nasolabial
 * folds, 3.9-5.2 across the cheeks) at a time when female_229 had no rim, no
 * bounce and no environment at all.
 *
 * DECISION, stated rather than silent: the Female.228 profile does NOT mount it
 * (`fill: null` on the `f228-profile` face look). Reproducing Female.228's
 * arrangement means reproducing the lights Female.228 has, and this is not one
 * of them; the arrangement now arriving — a 1.15 studio environment, a 1.75 rim
 * and the under-chin bounce — supplies omnidirectional lift that the face fill
 * was standing in for. It is one switch away: `FACE LOOK: FINAL SOFT` restores
 * it together with that look's own face values, unchanged.
 */
export const HYPER3D_F228_FACE_FILL_DIFFERENCE = {
  presentOnFemale229: true,
  presentOnFemale228: false,
  spec: "pointLight 0.055 #fff4ea @ [0, 1.56, 0.42] distance 0.95 decay 2",
  decision: "Not mounted under the Female.228 profile. Female.228 has no face fill light."
} as const;
