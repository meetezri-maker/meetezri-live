/**
 * Female avatar portrait rendering presets (Phase V2, pass 1).
 *
 * Each preset is cumulative, so the developer panel can isolate the contribution
 * of one change at a time:
 *
 *   legacy               → exactly what shipped before this phase
 *   portrait-camera      → + portrait framing only
 *   portrait-environment → + studio environment map
 *   portrait-lighting    → + revised key / fill / rim
 *   portrait-final       → + material reflection tuning, hair fix, exposure
 *
 * Baseline numbers come from docs/FEMALE_RENDERING_AUDIT.md.
 */

export type FemaleRenderPreset =
  | "legacy"
  | "portrait-camera"
  | "portrait-environment"
  | "portrait-lighting"
  | "portrait-final";

export interface RenderCameraConfig {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  minDistance: number;
  maxDistance: number;
}

export interface RenderLightConfig {
  ambientIntensity: number;
  keyIntensity: number;
  keyPosition: [number, number, number];
  keyColor: string;
  fillIntensity: number;
  fillPosition: [number, number, number];
  fillColor: string;
  /** Back light for silhouette separation. 0 disables it. */
  rimIntensity: number;
  rimPosition: [number, number, number];
  rimColor: string;
  /**
   * Under-chin bounce. A `pointLight`, not a directional, because only a light
   * with distance falloff and a steep downward angle can separate the jaw
   * underside from the neck front. 0 disables it.
   */
  bounceIntensity: number;
  bouncePosition: [number, number, number];
  bounceColor: string;
  bounceDistance: number;
  bounceDecay: number;
}

export interface RenderEnvironmentConfig {
  enabled: boolean;
  /** Cube render-target resolution for the generated studio environment. */
  resolution: number;
  /** Scales the environment contribution to lighting. */
  environmentIntensity: number;
}

/**
 * Per-material environment reflection strength. Keys are material names as
 * exported in the GLB; anything not listed keeps its authored value.
 */
export interface RenderMaterialTuning {
  enabled: boolean;
  envMapIntensityByMaterial: Record<string, number>;
  /**
   * Every material name the eye treatment should reach, when the asset spells it
   * differently from `eye.materialName`.
   *
   * Female.228 needs none of this: its eyeball material is `UnrealMaterial.004`
   * and `eye.materialName` names it. It exists because Blender re-suffixes
   * duplicated material datablocks on export, so the SAME eyeball material can
   * arrive as `.004` in one delivery of an asset and `.023` in the next — which
   * is exactly what happened to `female_229.glb`, and the eye tuning then bound
   * to nothing at all and failed silently. Matching a set rather than a string
   * makes that a configuration line instead of an invisible regression.
   *
   * Omitted means `[eye.materialName]`, i.e. the behaviour before this existed.
   */
  eyeMaterialNames?: readonly string[];
  /** Hair correction: the GLB ships metalness 0.545 with a pure-black base colour. */
  hairMaterialName: string;
  hairMetalness: number;
  hairColor: string;
  /**
   * Hair roughness. Omitted leaves the material's authored value, which is what
   * Female.228 does — it has never tuned this. `female_229` sets it, because its
   * hair pass measured the sheen against the target and Female.228's authored
   * 0.673 rendered flatter than that target wants.
   */
  hairRoughness?: number;
  /** Eye realism (Phase V3). See `portraitEyes` for the reasoning. */
  eye: RenderEyeTuning;
}

/**
 * Eye material tuning.
 *
 * The asset has no cornea shell: sclera, iris and pupil are baked into one 1024²
 * basecolor on a single material with zero geometry groups, so per-region roughness
 * is not addressable. A clearcoat layer is the one way to model a wet cornea over a
 * softly shaded eyeball with a single material.
 */
export interface RenderEyeTuning {
  enabled: boolean;
  materialName: string;
  /** Base layer: the eyeball itself. Soft, so sclera and iris read as tissue. */
  roughness: number;
  /** Clearcoat layer: the tear film. Sharp, so the catchlight stays small and wet. */
  clearcoat: number;
  clearcoatRoughness: number;
  /** Cornea index of refraction is ~1.376. */
  ior: number;
  /** Slight tint off pure white so the sclera is never paper. */
  color: string;
}

export interface FemaleRenderConfig {
  id: FemaleRenderPreset;
  label: string;
  notes: string;
  camera: RenderCameraConfig;
  lighting: RenderLightConfig;
  environment: RenderEnvironmentConfig;
  materials: RenderMaterialTuning;
  toneMappingExposure: number;
}

/** Shipped state, measured in the audit. Head fills 22.7% of frame height. */
const legacyCamera: RenderCameraConfig = {
  position: [0, 0.98, 2.25],
  target: [0, 0.9, 0.02],
  fov: 30,
  minDistance: 1.1,
  maxDistance: 4
};

/**
 * Portrait framing.
 *
 * The face bounding box is 0.269 world units tall and centred at y = 1.030. A
 * longer lens (22° instead of 30°) at 1.14 units gives a frame height of ~0.444,
 * putting the head at ~61% of frame height — inside the 55-70% portrait target
 * from the audit — while reducing the wide-angle nose distortion of the 30° lens.
 *
 * The target sits slightly above the face centre so the eyes land near the upper
 * third of the frame, which is the conventional portrait composition.
 */
const portraitCamera: RenderCameraConfig = {
  // Pulled in from z 1.18 to 1.053: the updated asset's face bounding box is
  // 0.241 tall rather than 0.269, so the same distance would have dropped the
  // head to 54% of frame height. This holds the intended ~61%.
  position: [0, 1.062, 1.053],
  target: [0, 1.045, 0.03],
  fov: 22,
  minDistance: 0.6,
  maxDistance: 2.6
};

/** Shipped lighting: flat 1.8 ambient, two white directionals, no rim. */
const legacyLighting: RenderLightConfig = {
  ambientIntensity: 1.8,
  keyIntensity: 3.2,
  keyPosition: [2, 4, 3],
  keyColor: "#ffffff",
  fillIntensity: 1.8,
  fillPosition: [-3, 2, 2],
  fillColor: "#ffffff",
  rimIntensity: 0,
  rimPosition: [0, 2, -3],
  rimColor: "#ffffff",
  bounceIntensity: 0,
  bouncePosition: [0, 0.35, 0.18],
  bounceColor: "#ffe8d8",
  bounceDistance: 1.6,
  bounceDecay: 2
};

/**
 * Studio three-point lighting.
 *
 * Ambient stays minimal because the environment map supplies the omnidirectional
 * term. The key is warm and the fill cool, which separates the planes of the face.
 *
 * Phase V2.2 — jaw/neck separation. Human review reported the jawline still merged
 * into the neck. Computing total irradiance per visible surface (rather than the
 * bounce in isolation, which was the V2.1 mistake) showed two things:
 *
 *  1. The V2.1 bounce lit the jaw *underside*, which a near-level portrait camera
 *     barely sees. It was illuminating a surface the viewer cannot look at.
 *  2. The neck front was the brightest surface in the lower portrait — 2.66 against
 *     2.62 for the cheek — because it faces forward and both key and fill were
 *     frontal. Brightness increasing downward reads as one continuous form, which
 *     is exactly the reported merge.
 *
 * The fix moves the key laterally. The neck front normal is almost pure +Z, while
 * the jaw side carries +X and -Y, so a lateral key favours the jaw and starves the
 * neck. That restores the natural portrait order: face brightest, jaw next, neck
 * darkest.
 *
 * A second side rim was evaluated and rejected. The jaw contour and the neck side
 * have near-identical normals, so any side light raises both; it made the neck side
 * brighter than the cheek and cut jaw-versus-neck-side contrast from 22% to 8%.
 */
const portraitLighting: RenderLightConfig = {
  ambientIntensity: 0.15,
  // Swung lateral (x 1.5 -> 2.5, z 2.4 -> 1.35). This is the change that separates
  // the jaw from the neck; intensity is raised to hold face brightness steady.
  keyIntensity: 3.15,
  keyPosition: [2.5, 2.35, 1.35],
  keyColor: "#fff1e0",
  // Also swung lateral so it stops washing the forward-facing neck, and raised so
  // the shadow side of the face still models. It now also lifts the shadow-side
  // jaw contour.
  fillIntensity: 0.8,
  fillPosition: [-2.65, 1.05, 0.7],
  fillColor: "#dce8ff",
  // Returned to a high back position: its job is hair and silhouette separation.
  // Low side placement was tested and made the neck side brighter than the cheek.
  rimIntensity: 1.75,
  rimPosition: [-1.3, 1.9, -2.2],
  rimColor: "#eaf2ff",
  // Reduced from 0.15. Lifting the under-jaw actively *reduces* the tonal step at
  // the jawline, so this is now only enough to keep the underside from crushing to
  // black rather than an attempt to define the jaw.
  bounceIntensity: 0.06,
  bouncePosition: [0, 0.35, 0.18],
  bounceColor: "#ffe8d8",
  bounceDistance: 1.6,
  bounceDecay: 2
};

const noEnvironment: RenderEnvironmentConfig = { enabled: false, resolution: 256, environmentIntensity: 1 };
// Raised from 1.0: the environment is the soft, omnidirectional lever for overall
// readability. Lifting it brightens the face without the flattening that raising
// ambient would cause, because it still arrives with direction from the lightformers.
const studioEnvironment: RenderEnvironmentConfig = { enabled: true, resolution: 256, environmentIntensity: 1.15 };

/** Authored eye values, used when material tuning is off. */
const authoredEyes: RenderEyeTuning = {
  enabled: false,
  materialName: "UnrealMaterial.004",
  roughness: 0.07450980693101883,
  clearcoat: 0,
  clearcoatRoughness: 0,
  ior: 1.5,
  color: "#ffffff"
};

/**
 * Eye realism, Phase V3 pass 1.
 *
 * Audit findings that drive these numbers:
 *
 *  - The eyeball mesh (`Face003_2` when audited, `Eyes` in the updated asset)
 *    holds BOTH eyeballs under one material with 0 geometry groups.
 *    Sclera, iris and pupil live in a single 1024² basecolor, so they cannot be
 *    given different roughness without a roughness map.
 *  - The lash strip (`Face003_3` when audited, `Face002_6` in the updated asset)
 *    is not a cornea: it is flat and is
 *    driven by eye_close and eyeBlink, so it follows the lid, not the eyeball.
 *  - The authored roughness of 0.0745 made the ENTIRE ball a near-mirror. A
 *    polished sclera is the single strongest "artificial" cue.
 *
 * The fix separates the two optical layers that the geometry does not:
 *  - base roughness 0.42 shades the eyeball as tissue, so the iris reads and the
 *    sclera stops looking like plastic;
 *  - a full clearcoat at roughness 0.06 sits over it as the tear film, which is
 *    what produces a small, sharp, correctly-placed catchlight and the wet look.
 *
 * This is the one case where the material class must change: `clearcoat` does not
 * exist on `MeshStandardMaterial`, and clearcoat *is* the cornea.
 */
const portraitEyes: RenderEyeTuning = {
  enabled: true,
  materialName: "UnrealMaterial.004",
  roughness: 0.42,
  clearcoat: 1,
  clearcoatRoughness: 0.06,
  ior: 1.38,
  color: "#f7f1ee"
};

const noMaterialTuning: RenderMaterialTuning = {
  enabled: false,
  envMapIntensityByMaterial: {},
  hairMaterialName: "Material.005",
  hairMetalness: 0.5454545617103577,
  hairColor: "#000000",
  eye: authoredEyes
};

/**
 * Material reflection tuning.
 *
 * Skin sits well below 1 so the environment reads as sheen rather than a shiny
 * coating. Eyes go above 1 because the eyeball is roughness 0.0745 and is the one
 * surface that should clearly mirror the studio. Hair metalness is corrected from
 * 0.545 to 0 — a half-metal with a black base colour renders as a dead silhouette
 * — and the base colour is lifted off pure black so light can register at all.
 */
const portraitMaterials: RenderMaterialTuning = {
  enabled: true,
  envMapIntensityByMaterial: {
    "UnrealMaterial.001": 0.42, // face skin — lifted slightly, still far below 1 so skin stays soft, not glossy
    "UnrealMaterial.002": 0.3, // inner mouth / teeth
    // Lowered from 1.6: the clearcoat now carries the reflection, so a high base
    // env washed the iris out. Still the highest value in the rig.
    "UnrealMaterial.004": 1.25, // eyeballs
    "UnrealMaterial.006": 0.9, // lashes / tear line
    "Wolf3D_Outfit_Bottom": 0.5,
    "Wolf3D_Body": 0.35, // body skin
    "Wolf3D_Outfit_Footwear": 0.5,
    "Wolf3D_Outfit_Top": 0.5,
    "Material.004": 0.4, // untextured black head-level geometry
    "Material.005": 0.75 // hair
  },
  hairMaterialName: "Material.005",
  hairMetalness: 0,
  hairColor: "#1a1418",
  eye: portraitEyes
};

const build = (
  id: FemaleRenderPreset,
  label: string,
  notes: string,
  camera: RenderCameraConfig,
  lighting: RenderLightConfig,
  environment: RenderEnvironmentConfig,
  materials: RenderMaterialTuning,
  toneMappingExposure: number
): FemaleRenderConfig => ({ id, label, notes, camera, lighting, environment, materials, toneMappingExposure });

export const femaleRenderPresets: Record<FemaleRenderPreset, FemaleRenderConfig> = {
  legacy: build(
    "legacy",
    "Legacy",
    "Exactly the shipped configuration audited in Phase V1. Head fills 22.7% of frame height.",
    legacyCamera,
    legacyLighting,
    noEnvironment,
    noMaterialTuning,
    1
  ),
  "portrait-camera": build(
    "portrait-camera",
    "Portrait camera",
    "Portrait framing only. Everything else is still legacy, so this isolates the framing contribution.",
    portraitCamera,
    legacyLighting,
    noEnvironment,
    noMaterialTuning,
    1
  ),
  "portrait-environment": build(
    "portrait-environment",
    "+ Studio environment",
    "Adds the generated studio environment map. Lighting is still legacy, so ambient 1.8 still flattens the face.",
    portraitCamera,
    legacyLighting,
    studioEnvironment,
    noMaterialTuning,
    1
  ),
  "portrait-lighting": build(
    "portrait-lighting",
    "+ Studio lighting",
    "Adds the revised key/fill/rim and drops ambient to 0.12. Material reflection is still authored-default.",
    portraitCamera,
    portraitLighting,
    studioEnvironment,
    noMaterialTuning,
    1
  ),
  "portrait-final": build(
    "portrait-final",
    "Portrait final",
    "Adds per-material reflection tuning, the hair metalness/base-colour correction, and exposure trim.",
    portraitCamera,
    portraitLighting,
    studioEnvironment,
    portraitMaterials,
    1.12
  )
};

export const femaleRenderPresetIds = Object.keys(femaleRenderPresets) as FemaleRenderPreset[];
export const defaultFemaleRenderPreset: FemaleRenderPreset = "portrait-final";
export const getFemaleRenderConfig = (id: FemaleRenderPreset) =>
  femaleRenderPresets[id] ?? femaleRenderPresets[defaultFemaleRenderPreset];

/** Measured face bounding-box height in world units. Updated asset: was 0.269. */
export const FEMALE_FACE_WORLD_HEIGHT = 0.241;
/** Measured face bounding-box centre in world units, from the Phase V1 audit. */
export const FEMALE_FACE_WORLD_CENTRE_Y = 1.03;

/** Fraction of frame height the head occupies for a given camera configuration. */
export const headFrameFraction = (camera: RenderCameraConfig, faceCentreY = FEMALE_FACE_WORLD_CENTRE_Y) => {
  const dy = camera.position[1] - faceCentreY;
  const dz = camera.position[2] - 0.038;
  const distance = Math.hypot(dy, dz);
  const frameHeight = 2 * distance * Math.tan(((camera.fov / 2) * Math.PI) / 180);
  return FEMALE_FACE_WORLD_HEIGHT / frameHeight;
};
