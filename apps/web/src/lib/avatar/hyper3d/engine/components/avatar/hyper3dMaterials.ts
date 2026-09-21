import {
  Color,
  MeshStandardMaterial,
  RepeatWrapping,
  type MeshStandardMaterialParameters,
  SRGBColorSpace,
  TextureLoader,
  type Material,
  type Mesh,
  Vector2,
  type Object3D,
  type Texture
} from "three";
import { createHyper3dEyeTexture, createHyper3dLashAlphaTexture, type Hyper3dEyeVariantId } from "./hyper3dEyeTexture";
import { isHyper3dHairObject } from "./hyper3dHair";

/**
 * Minimum viable materials for the Hyper3D USC asset. PHASE H1.
 *
 * `additional_body.fbx` ships **no textures and no PBR authoring at all**: every
 * one of its 23 materials arrives from FBXLoader as a flat `#cccccc`
 * MeshPhongMaterial, and the package embeds no media (no Video nodes, no
 * RelativeFilename entries). Rendered as-is the character is a uniform grey
 * mannequin, which is not a useful visual test.
 *
 * Why only the face gets maps
 * ---------------------------
 * The asset's single UV set is a **UDIM layout**, measured off the shipped file:
 *
 *   M_Face      u=[0.005,0.995]   tile 1001
 *   M_BackHead  u=[1.009,1.991]   tile 1002
 *   Fluid       u=[4.026,5.973]   tiles 1005/1006
 *   EyeLashes   u=[6.012,6.988]   tiles 1006/1007
 *   M_Body      u=[7.004,7.996]   tile 1008
 *   teeth / eyeballs / Occ / teeth_fluid   u=[0,1]   tile 1001 range
 *
 * The package ships exactly three 2048x2048 maps — `texture_diffuse`,
 * `texture_normal`, `texture_specular` — and they are a **tile 1001 face
 * projection**: opening the diffuse map shows a frontal face unwrap with brows,
 * eyes, nose, lips and both ears filling the 0..1 square. `demo.blend` references
 * those same three files and nothing else, and the `tex_slow.mtl` that
 * `model.obj` names is not in the package, so nothing states a tile assignment
 * for anything else.
 *
 * So `M_Face` is textured and nothing else is. Binding the same map to a tile
 * 1002-1008 material would wrap the face image around the body; binding it to
 * teeth or eyeballs — whose UVs do span 0..1 — would paint a whole face onto
 * each of them. Both would be an invented UV transformation, which the H1 brief
 * rules out. Those regions get measured flat colours instead, and the gap is
 * reported rather than papered over.
 *
 * Everything here is idempotent and keyed off `userData`, because `useLoader`
 * caches the parsed FBX: switching model away and back returns the same object
 * graph with these materials already installed.
 */

/** Marks a material this module created, so a re-apply is a no-op. */
const APPLIED_FLAG = "hyper3dMaterialApplied";

/**
 * Skin tone for the regions that have no map, sampled from `texture_diffuse.png`
 * so the untextured back-head and body match the textured face instead of
 * reverting to grey. Measured by decoding the PNG and averaging the forehead
 * patch at u=0.40-0.60, v=0.82-0.92: rgb(155, 96, 68). The cheek patch reads
 * rgb(158, 90, 59) and the whole-map average rgb(147, 86, 57), so this is
 * representative rather than a highlight or a shadow.
 */
const SKIN = "#9b6044";
/** Enamel. No map ships for the teeth UV. */
const TEETH = "#e8e2d8";
/**
 * Sclera.
 *
 * EYES APPEARANCE: INCOMPLETE — this flat colour is a placeholder, not a choice.
 * Verified against the raw package rather than inferred:
 *
 * - Both `additional_body.fbx` and `additional_component.fbx` declare ZERO
 *   Texture / Video / LayeredTexture objects, and all 23 materials are byte-
 *   identical default Phong stubs (DiffuseColor 0.8,0.8,0.8). No material
 *   carries eye colour.
 * - The eye region of the two FBX files is identical — same materials, same UVs,
 *   same 1278/1272 front and 3330/3336 back vertex counts — so `component` holds
 *   nothing `body` lacks and combining them would gain nothing.
 * - The eyeball is ONE closed shell per eye with a dedicated 0..1 spherical
 *   unwrap; both eyes share the SAME UVs, so they expect one shared eye texture.
 *   There is no separate iris or pupil geometry to colour instead.
 * - All three supplied maps are the same tile-1001 face projection. Sampled over
 *   the eyeball's iris-zone UV footprint they return plain skin (diffuse
 *   rgb 139,78,57; normal 126,126,253 i.e. flat; specular 98 grey). No
 *   sclera-white and no iris structure exists anywhere in any of them — the
 *   source capture had the eyes closed.
 * - `demo.blend` contains 5 images (the 3 face maps, the HDRI, a Render Result)
 *   and a single mesh object, `OBface`. The vendor's own demo scene never
 *   rendered eyes.
 *
 * The fix is an eye texture, which the export does not contain. Nothing in the
 * renderer can recover it.
 */
const SCLERA = "#dedad2";

export interface Hyper3dMaterialReport {
  /** Material names that received the shipped maps. */
  textured: string[];
  /** Material names given a measured flat colour because no map ships for their UV tile. */
  flat: string[];
  /** Material names carrying the TEMPORARY procedural demo eye map. */
  eyes: string[];
  /** Material names made translucent so they do not occlude what sits behind them. */
  translucent: string[];
  /** Shipped maps that are not bound to anything, and why. */
  unusedMaps: string[];
  /** The skin variant actually applied to the face material. */
  skin: { mode: string; normalScale: number; roughness: number };
  /**
   * Ready-made status lines, when the default FBX wording would misdescribe what
   * happened. Set by the GLB hookup, absent for the FBX.
   */
  notes?: string[];
}

const texturePromises = new Map<string, Promise<{ diffuse: Texture; normal: Texture }>>();

/**
 * EYE-COMPONENT REVIEW MODES.
 *
 * The eye region is six material groups per eye on ONE mesh, so a component
 * cannot be hidden with `visible`. "Hidden" here means fully transparent with
 * `depthWrite` off — the geometry is untouched and every mode is reversible by
 * switching back, which is why nothing is ever deleted.
 */
export type Hyper3dEyeMode =
  | "current" | "occ-off" | "fluid-off" | "lash-off" | "clean"
  /** Diagnostic: every eye overlay off, leaving only the face diffuse texture. */
  | "bare"
  /** Integration candidates. Material-level only — see `EYE_INTEGRATION`. */
  | "integration-a" | "integration-b";

const HIDDEN: MeshStandardMaterialParameters = { transparent: true, opacity: 0, depthWrite: false };

/**
 * SKIN SOFTNESS VARIANTS — appearance only, and independent of the eye variant so
 * any skin choice can be combined with any eye choice.
 *
 * Attribution, measured on the shipped maps rather than guessed:
 *
 *   NORMAL MAP — tilt of the encoded normals away from flat, and how much of that
 *   tilt is fine relief rather than facial form:
 *
 *     region     meanTilt  p95    max     high-frequency share
 *     forehead    0.0788  0.1769  0.8892       61.2%
 *     cheek L     0.0582  0.1404  0.5127       53.8%
 *     cheek R     0.0748  0.1813  0.6094       55.3%
 *     nose        0.1261  0.3032  0.9562       45.2%
 *     lips        0.1373  0.3525  0.9956       58.1%
 *
 *   DIFFUSE MAP — contrast split by frequency, in luma:
 *
 *     region     sd(full)  sd(high-freq)  high/full
 *     forehead     2.31        1.02         0.443
 *     cheek L      4.00        1.05         0.261
 *     nose        15.66        1.90         0.121
 *
 * So 45-61% of the NORMAL map's signal is pore-scale relief rather than form,
 * with harsh outliers reaching 0.89-0.99 tilt on the forehead and lips — that is
 * the sandpaper. The DIFFUSE map's high-frequency contrast is only 1.0-3.2 luma,
 * which is very low: the roughness is not coming from the colour texture. That is
 * why the diffuse map is not touched at all here, and why `normalScale` is the
 * single cleanest lever.
 *
 * Lowering `normalScale` does not delete pores — it scales the whole relief, so
 * pores stay visible at 62% / 45% strength while the harsh outliers drop below
 * the threshold where they read as grain. Facial FORM is carried mostly by the
 * 222,438-vertex geometry and the diffuse map's low-frequency shading, neither of
 * which this touches.
 *
 * Roughness moves only slightly and stays well above the point where skin turns
 * waxy; `metalness` stays 0 in every variant.
 */
export type Hyper3dSkinMode = "current" | "soft-a" | "soft-b";

export interface Hyper3dSkinVariant {
  /** Multiplier on the normal map's tilt. 1 = the shipped relief. */
  normalScale: number;
  roughness: number;
}

export const SKIN_VARIANTS: Record<Hyper3dSkinMode, Hyper3dSkinVariant> = {
  /** The accepted material, unchanged. The A/B reference. */
  current: { normalScale: 1, roughness: 0.68 },
  /** Mild: cheek p95 tilt 0.14-0.18 -> 0.09-0.11, i.e. "gentle" relief. */
  "soft-a": { normalScale: 0.62, roughness: 0.62 },
  /** Stronger, still natural: p95 -> 0.06-0.08, pores at 45% strength. */
  "soft-b": { normalScale: 0.45, roughness: 0.56 }
};

/**
 * `female_229.glb` FACE LOOK — the review pair for this asset's face.
 *
 * Its own record rather than more entries in `SKIN_VARIANTS`: those are the
 * values accepted on the FBX and nothing here may move them.
 *
 * WHY THERE IS ANYTHING TO CHOOSE. `female_229.glb` ships its face material with
 * `texture_diffuse` as base colour, `roughnessFactor` 0.5, **no normal map and no
 * AO map** (measured: the authored material is `{baseColorTexture,
 * metallicFactor 0, roughnessFactor 0.5}`). The migration binds the package's
 * `texture_normal.png` so the accepted face material is reproduced, and that map
 * is where the surface relief comes from.
 *
 * ---------------------------------------------------------------------------
 * WHERE THE REMAINING NOSE AND CHEEK HARSHNESS COMES FROM — measured per region
 * on this asset's own maps, not inferred from the render.
 *
 * NORMAL MAP, tilt away from flat. `etched` is the share of texels above 0.30
 * tilt, the band that reads as a hard line rather than as skin:
 *
 *   region           meanTilt    p95     max    etched@0.40   etched@0.34
 *   nostrils           0.1842  0.4276  0.9137        0.02%         0.00%
 *   nose tip           0.1648  0.3828  0.9562        0.02%         0.01%
 *   nasolabial L       0.1247  0.2865  0.9925        0.01%         0.00%
 *   upper cheek L      0.0815  0.1932  0.5448        0.00%         0.00%
 *   lower cheek R      0.0854  0.2079  0.8222        0.00%         0.00%
 *   forehead           0.0770  0.1723  0.7148        0.00%         0.00%
 *
 * The OUTLIERS were already gone at 0.40 — every region is at or below 0.02%
 * etched. What is left is SUSTAINED relief, and it is not evenly spread: the
 * nostrils and nose tip carry **2.0-2.2x the mean tilt of the cheeks**. That is
 * why the nose still read harsher than the rest of the face, and it is an
 * authored property of the map that one uniform scale cannot equalise.
 *
 * DIFFUSE, luma standard deviation split by spatial band — high < 3 px (pores),
 * mid 3-12 px (mottling), low > 12 px (form and baked shading):
 *
 *   region          sd(total)  sd(high)  sd(mid)  sd(low)
 *   nasolabial L        19.41      1.29     1.55    18.90
 *   nose tip            18.70      1.19     3.86    16.83
 *   nostrils            14.18      1.86     4.96    11.50
 *   lower cheek R        5.64      0.98     1.07     5.17
 *   upper cheek L        4.27      0.68     1.04     3.86
 *   forehead             2.51      0.55     0.69     2.23
 *
 * Every region is dominated by its LOW band. The albedo carries almost no pore
 * noise (0.55-1.86) and almost no mottling (0.69-4.96); what it carries is baked
 * SHADING — 11.5-18.9 of painted shadow around the nose and nasolabial folds, and
 * 3.9-5.2 of tonal variation across the cheeks.
 *
 * So the two complaints have two different causes, and two different fixes:
 *
 *   nose still harsh    -> the normal map, which peaks there. Lower `normalScale`.
 *   cheeks look uneven  -> low-frequency shading painted into the ALBEDO, which
 *                          no material parameter can reach without modifying the
 *                          texture. Lifting it is what the face fill light is for.
 *
 * AO is not a contributor: the asset ships no occlusion map and this module adds
 * none.
 *
 * ---------------------------------------------------------------------------
 * THE TWO LOOKS.
 *
 * `normalScale` 0.40 -> 0.34 is a 15% reduction, the middle of the reviewed
 * 10-20% band. It takes the nose-tip mean tilt from 0.0659 to 0.0560 and the
 * cheeks from 0.0324 to 0.0275, while leaving the relief at 34% of authored
 * strength — pores stay visible and facial FORM is untouched, since that comes
 * from the 13,631-vertex geometry and the diffuse's low band, neither of which
 * this touches.
 *
 * `roughness` 0.58 -> 0.60 is deliberately tiny. It widens the specular lobe so
 * cheek highlights spread rather than glint. It cannot be targeted at one region:
 * the asset ships no roughness map, so this is a single value for the whole face,
 * and the trade-off is stated rather than hidden — a larger increase would start
 * to read chalky, and a decrease would read oily.
 *
 * Neither look modifies the base-colour texture, and no image data is processed
 * in code.
 */
export interface Hyper3dFaceFillLight {
  /**
   * A point light, not a directional, and for the same reason the female
   * preset's chin bounce is one: a directional is parallel with no distance
   * falloff, so it would light the hair, the shoulders and the outfit exactly as
   * hard as the face. Inverse-square decay is what keeps this a FACE fill.
   *
   * Stated limitation: three.js tests light layers against the CAMERA, not per
   * object, so a light cannot be masked to one mesh in the standard pipeline.
   * Distance and decay are the available scoping, and they are enough here — at
   * the back of the hair the irradiance is already ~21% of the face's.
   */
  position: readonly [number, number, number];
  intensity: number;
  color: string;
  /** Cut-off in metres. Nothing beyond this receives any of it. */
  distance: number;
  /** 2 = physically correct inverse-square. */
  decay: number;
}

export interface Hyper3dFaceLookVariant {
  /** Multiplier on the normal map's tilt. */
  normalScale: number;
  roughness: number;
  /** Face fill light, or `null` for none. */
  fill: Hyper3dFaceFillLight | null;
}

export type Hyper3dFaceLook = "current" | "final-soft" | "f228-profile";

export const HYPER3D_FACE_LOOKS: Record<Hyper3dFaceLook, Hyper3dFaceLookVariant> = {
  /**
   * The A/B reference: the accepted state before this pass. (The migration
   * originally shipped 0.62 / 0.62, carried over from the FBX `soft-a`; the
   * skin/eye pass took it to 0.40 / 0.58 and fixed the inverted green channel.)
   */
  current: { normalScale: 0.4, roughness: 0.58, fill: null },
  /**
   * Default. Nose relief down 15%, cheek highlights slightly softer, and one
   * soft upper-front fill to lift the shading the albedo has baked in.
   */
  "final-soft": {
    normalScale: 0.34,
    roughness: 0.6,
    /**
     * Placed 0.07 m above the eye line (y 1.486) and 0.32 m in front of the face
     * front plane (z 0.103), so it is a slightly-upper-front fill rather than a
     * flat frontal wash — the nose and brow keep their shadow side and the face
     * is not flattened.
     *
     * Distance to the nose tip is 0.338 m, so at `decay` 2 the face sees
     * 0.055 / 0.338^2 = 0.48 of irradiance against the key's 2.1 — about a 14%
     * lift on an already-lit face, which is the "start low" the brief asks for.
     * At the back of the hair (0.74 m) that is already down to 21% of the face
     * value, and the background is a flat `<color>` with no geometry, so no light
     * reaches it at all.
     *
     * `#fff4ea` is very slightly warm — 4% more red than blue — so it reads as
     * bounced skin light rather than as a second white source.
     */
    fill: { position: [0, 1.56, 0.42], intensity: 0.055, color: "#fff4ea", distance: 0.95, decay: 2 }
  },
  /**
   * FEMALE.228 APPEARANCE PROFILE — the face half of the transfer.
   *
   * The scene half (ambient, key, fill, rim, bounce, studio environment,
   * exposure and the per-material reflection table) lives in
   * `mappings/avatars/hyper3dAppearanceProfile.ts`; `AvatarCanvas` mounts both
   * from this one look id, so the comparison in §8 of the transfer brief is a
   * single switch and the two halves can never be half-applied.
   *
   * ROUGHNESS 0.6454545259475708 — A LITERAL 1:1 TRANSFER.
   *
   * This is Female.228's production face roughness, read from the authored
   * material block of `Female.228.glb` (`UnrealMaterial.001.pbrMetallicRoughness
   * .roughnessFactor`) rather than from any render. It is the PRODUCTION value
   * and not merely the authored one: the accepted `portrait-final` preset tunes
   * `envMapIntensity`, `metalness` and `color` per material and never touches
   * roughness, so what the artist authored is what ships.
   *
   * Nothing is converted on the way across. Both faces are
   * `MeshStandardMaterial` at metalness 0, neither authors a roughness map, and
   * neither authors an AO map, so a single roughness scalar governs the whole
   * face on both assets and means the same thing on both. It replaces
   * `final-soft`'s 0.60, a difference of +0.045 — very slightly wider specular
   * lobe, so cheek highlights spread a little further rather than glinting.
   *
   * ---------------------------------------------------------------------------
   * NORMALSCALE 0.53 — A MEASURED EQUIVALENT, NOT A COPIED NUMBER, AND THIS IS
   * THE ONE VALUE IN THE WHOLE TRANSFER THAT COULD NOT BE MOVED VERBATIM.
   *
   * Female.228 renders its face at `normalScale` 1.0. Copying that literal 1.0
   * would be exactly the "blindly copy values between incompatible shader
   * models" the brief rules out, because `normalScale` is not a look — it is a
   * MULTIPLIER ON A SPECIFIC MAP, and the two assets carry different maps with
   * different intrinsic relief. Measured over 1,048,576 texels of each map at
   * 2048x2048, tilt = |(n.x, n.y)| decoded from the stored normal:
   *
   *   map                                   mean    median     p95     p99     max
   *   Female.228 MI_Face_Skin_Baked_LOD1  0.0428    0.0299  0.1060  0.2019  0.8353
   *   female_229 USC texture_normal.png   0.0805    0.0557  0.2335  0.4571  0.9961
   *
   * The USC map carries 1.88x the mean relief and 2.20x the p95. So the
   * equivalent of Female.228's rendered surface is a SCALE of 0.0428 / 0.0805 =
   * 0.5315, not a scale of 1.0.
   *
   * Two independent criteria were solved and they agree, which is why this is a
   * derivation rather than a taste call:
   *
   *   criterion                                      scale
   *   match mean rendered tilt                      0.5315
   *   match the share of texels above 0.30 tilt     0.5294
   *
   * They differ by 0.4%, and 0.53 sits between them. At 0.53 the rendered face
   * matches the reference on both measures at once:
   *
   *                        mean tilt   >0.20     >0.30     >0.40
   *   Female.228 @ 1.00       0.0428   1.026%    0.482%    0.300%
   *   female_229 @ 0.53       0.0427   1.690%    0.483%    0.148%
   *
   * — the same mean, the same 0.30 "reads as a hard line rather than as skin"
   * population, and HALF the reference's harshest 0.40+ band, because the two
   * criteria were matched from below.
   *
   * WHAT THIS MEANS FOR §5 OF THE BRIEF, AND IT NEEDS SAYING PLAINLY: the
   * transfer makes this face a little LESS smooth than it is today, not more.
   * `final-soft` renders at 0.34, i.e. mean tilt 0.0274 — 36% BELOW the
   * Female.228 reference. Female.228's complexion does not read smoother than
   * female_229's because its normal map is scaled down; it reads smoother
   * because its BAKED MAP IS GENTLER to begin with, and because of the studio
   * environment, the rim and the exposure that arrive with the rest of this
   * profile. The brief asks for Female.228's measured values and asks that they
   * not be retuned by eye, so the measured equivalent is what is applied and the
   * direction of travel is reported rather than quietly corrected. `final-soft`
   * remains one switch away if the reviewer prefers the softer state.
   *
   * NO IMAGE DATA IS TOUCHED. The base-colour texture, the normal map and the
   * UVs are female_229's own in every look; only this multiplier moves.
   *
   * `fill: null` — Female.228 has no face fill light. See
   * `HYPER3D_F228_FACE_FILL_DIFFERENCE` for the reported difference and the
   * decision behind leaving it off.
   */
  "f228-profile": {
    /**
     * 0.53 -> 0.18, AND THE REASON IS THAT 0.53 WAS CHOSEN FROM THE WRONG
     * EVIDENCE.
     *
     * 0.53 matched the two assets' normal-map STATISTICS, and hardware review
     * rejected it on the render. Measuring the RENDER instead settles it: swept
     * across 0.34 / 0.25 / 0.18 / 0.10 / 0.00 at a frozen pose, camera, lighting
     * and exposure, with every frame gated on being pixel-identical in the hair
     * and shoulder, the rendered face changes almost not at all —
     *
     *   normalScale        0.34    0.25    0.18    0.10    0.00
     *   local contrast     1.990   1.970   1.956   1.946   1.938
     *   fold contrast      3.233   3.198   3.175   3.155   3.143
     *
     * Across the ENTIRE range local contrast moves 2.6% and fold contrast 2.8%.
     * The normal map contributes about 3% of this face's rendered skin detail;
     * the other 97% is the albedo, the geometry and the lights. So no value in
     * this range can produce the reported harshness, and none can remove it.
     *
     * 0.18 -> 0.50 ON THE RE-TEST, and the reason the first answer was too low
     * is that it was measured against a broken map and a dirty albedo.
     *
     * Both of those were then fixed. The normal map was being bound upside down
     * against the albedo (see `loadTextures`), so its relief landed in the wrong
     * places and read as noise — which is what "too much relief" was really
     * describing, and why the honest response at the time was to turn it down.
     * The albedo's mid-frequency mottling was also still present, adding its own
     * blotchiness on top. With the orientation corrected and the mottling
     * suppressed, the same sweep behaves completely differently: 0.18 -> 0.70
     * now moves local contrast 8.1%, against 2.6% across the whole 0.34 -> 0.00
     * range before, because the relief finally lands on clean skin where it
     * belongs.
     *
     * Re-swept 0.18 / 0.34 / 0.50 / 0.70 at a frozen pose, camera, lighting and
     * exposure, every frame pixel-gated on the hair and shoulder:
     *
     *   normalScale              0.18    0.34    0.50    0.70
     *   local contrast (pores)  1.976   2.010   2.059   2.137
     *   nose fold contrast      3.382   3.549   3.755   4.060
     *
     * Chosen on pore quality and absence of harsh folds, which is what the
     * review asked for rather than a contrast minimum. 0.18 is visibly waxy —
     * this albedo's high band is 0.41-0.81 luma, so the normal map is the ONLY
     * source of pore-scale detail the face has, and at 0.18 there is effectively
     * none. 0.70 does render convincing pores, but the nasolabial and
     * mouth-corner creases harden into etched lines and fine wrinkling appears
     * under the eye — the defect the original review rejected. 0.50 carries
     * visible micro-texture, within 3.8% of the pore contrast 0.70 reaches,
     * while holding nose fold contrast 7.5% below it.
     */
    normalScale: 0.5,
    /**
     * UNCHANGED, and measured rather than assumed. Swept 0.58 / 0.62 / 0.645 /
     * 0.68 at the final normal and albedo: local contrast moves 5.0% and mean
     * luma 1.2% across the whole range, and 0.645 -> 0.68 is 1.6% of contrast.
     * Nothing in that is worth moving an accepted Female.228 value for, and the
     * upper end starts trading a soft highlight for a chalky one.
     */
    roughness: 0.6454545259475708,
    fill: null
  }
};

/**
 * Which appearance variant a review mode renders. Only the eye materials read
 * this; nothing else in the asset is affected.
 */
const variantFor = (mode: Hyper3dEyeMode): Hyper3dEyeVariantId =>
  mode === "integration-a" ? "a" : mode === "integration-b" ? "b" : "clean";

/** Built once per variant, so switching A/B/CLEAN does not rebuild what it already has. */
const lashAlphas = new Map<Hyper3dEyeVariantId, Texture | null>();
const demoLashAlpha = (variant: Hyper3dEyeVariantId): Texture | undefined => {
  if (!lashAlphas.has(variant)) {
    try { lashAlphas.set(variant, createHyper3dLashAlphaTexture(1024, variant)); } catch { lashAlphas.set(variant, null); }
  }
  return lashAlphas.get(variant) ?? undefined;
};

const eyeTextures = new Map<Hyper3dEyeVariantId, Texture | null>();
/**
 * Returns `undefined` rather than throwing if the map cannot be built, so a
 * failure degrades the eye to its flat `SCLERA` colour instead of taking the
 * canvas down. That fallback is also exactly the state to return to when the
 * vendor map arrives and this placeholder is deleted.
 */
/**
 * Loads the two usable FACE maps once per session.
 *
 * `texture_specular.png` is deliberately not loaded: `MeshStandardMaterial` has
 * no `specularMap`, and a specular map is the inverse of roughness rather than a
 * drop-in for `roughnessMap`, so wiring it in would be a guess. It is reported as
 * unused instead.
 */
/**
 * `flipY` IS A PER-ASSET CONVENTION, NOT A CONSTANT, AND GETTING IT WRONG
 * MIRRORS THE NORMAL MAP.
 *
 * three's `TextureLoader` defaults to `flipY: true`, the OpenGL bottom-left
 * convention, which is right for the FBX/OBJ path these maps were written for.
 * glTF UVs have their origin at the TOP left, so `GLTFLoader` binds every
 * embedded texture with `flipY: false`.
 *
 * MEASURED, and this is the defect: the GLB embeds the BYTE-IDENTICAL
 * `texture_diffuse.png` that ships in the USC pack — both sha256
 * d488ee0555b8f830, both 2,754,819 bytes — and binds it at `flipY: false`, while
 * this loader was handing the matching `texture_normal.png` to the same material,
 * on the same UV set, at `flipY: true`. The two maps were therefore sampled
 * upside down relative to each other: every crease, pore and fold in the normal
 * map landed mirrored top-to-bottom against the albedo it belongs to, so nose
 * relief fell near the brow and nasolabial relief fell up on the cheekbone.
 *
 * That is a direct cause of the reported harsh, misplaced relief around the nose
 * and cheeks, and no value of `normalScale` can fix a misaligned map — it only
 * scales the error.
 *
 * Cached per convention rather than globally, so the FBX rollback keeps the
 * `flipY: true` it was measured with and the GLB gets the `false` its UVs need.
 */
const loadTextures = (baseUrl: string, flipY: boolean, diffuseFile = "texture_diffuse.png") => {
  const key = `${baseUrl}|${flipY}|${diffuseFile}`;
  const existing = texturePromises.get(key);
  if (existing) return existing;
  const loader = new TextureLoader();
  const load = (name: string) =>
    new Promise<Texture>((resolve, reject) => loader.load(`${baseUrl}/${name}`, resolve, undefined, reject));
  const promise = Promise.all([load(diffuseFile), load("texture_normal.png")]).then(([diffuse, normal]) => {
    // The diffuse map is authored colour and must be decoded from sRGB; the
    // normal map is vector data and must stay linear.
    diffuse.colorSpace = SRGBColorSpace;
    for (const texture of [diffuse, normal]) {
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.flipY = flipY;
      texture.needsUpdate = true;
    }
    return { diffuse, normal };
  });
  texturePromises.set(key, promise);
  return promise;
};

const demoEyeTexture = (variant: Hyper3dEyeVariantId): Texture | undefined => {
  if (!eyeTextures.has(variant)) {
    try { eyeTextures.set(variant, createHyper3dEyeTexture(512, variant)); } catch { eyeTextures.set(variant, null); }
  }
  return eyeTextures.get(variant) ?? undefined;
};

const standard = (name: string, options: MeshStandardMaterialParameters) =>
  new MeshStandardMaterial({ name, ...options });

/**
 * Replaces the loader's flat grey Phong materials on the Hyper3D mesh.
 *
 * Returns synchronously with the materials already installed; the two maps are
 * attached to the face material when they finish downloading and the next frame
 * picks them up, so this never blocks first paint.
 */
export const applyHyper3dMaterials = (
  root: Object3D,
  textureBaseUrl: string,
  eyeMode: Hyper3dEyeMode = "clean",
  skinMode: Hyper3dSkinMode = "current"
): Hyper3dMaterialReport => {
  const skin = SKIN_VARIANTS[skinMode];
  const report: Hyper3dMaterialReport = {
    textured: [],
    flat: [],
    eyes: [],
    translucent: [],
    unusedMaps: [
      "texture_specular.png (MeshStandardMaterial has no specularMap; specular is not roughness, so it is left unbound rather than guessed)"
    ],
    skin: { mode: skinMode, normalScale: skin.normalScale, roughness: skin.roughness }
  };
  const faceMaterials: MeshStandardMaterial[] = [];

  /**
   * The per-material plan, derived from the material NAME alone.
   *
   * Separated from the mutation below so the report describes the final state of
   * every material rather than only the ones this particular call constructed.
   * `useLoader` caches the parsed FBX and React re-runs effects (twice on mount
   * under StrictMode), so the second pass finds materials it already replaced —
   * classifying by name means it still reports them instead of returning three
   * empty lists.
   */
  const planFor = (name: string): { bucket: keyof Omit<Hyper3dMaterialReport, "unusedMaps" | "skin" | "notes">; build: () => MeshStandardMaterial } => {
    // Tile 1001 face projection — the one region the shipped maps describe.
    if (name === "M_Face") {
      return {
        bucket: "textured",
        /**
         * Starts skin-toned so the face is never a white blank during the
         * texture download, then goes to white on load — `MeshStandardMaterial`
         * multiplies `map` by `color`, so leaving the tint on would darken the
         * diffuse map by itself.
         */
        build: () => standard(name, {
          color: new Color(SKIN),
          // SKIN SOFTNESS. Both levers come from `SKIN_VARIANTS`; the diffuse and
          // normal TEXTURES are untouched in every variant.
          roughness: skin.roughness,
          metalness: 0,
          // Set at construction rather than only when the map attaches, so the
          // value is correct the moment the material exists and is readable from
          // the report instead of only after an async load.
          normalScale: new Vector2(skin.normalScale, skin.normalScale)
        })
      };
    }
    // Corneal fluid and the eye occlusion card. Both are overlays that sit in
    // front of the eyeball; rendered opaque they would cover it with a solid
    // disc. `depthWrite: false` so they never occlude the eye behind them.
    if (name.startsWith("Fluid")) {
      // Corneal wet film. Sits at mean -2.0 mm, 77% below the eye centre.
      if (eyeMode === "fluid-off" || eyeMode === "bare") return { bucket: "translucent", build: () => standard(name, HIDDEN) };
      return {
        bucket: "translucent",
        // Preserved in every variant: it is the wet contact between eyeball and
        // lid. B raises it slightly for a more defined wet line.
        build: () => standard(name, { color: new Color("#ffffff"), transparent: true, opacity: eyeMode === "integration-b" ? 0.12 : 0.08, depthWrite: false, roughness: 0.05, metalness: 0 })
      };
    }
    if (name.startsWith("Occ")) {
      /**
       * Eye occlusion contact shadow, 26 x 10 mm at mean -1.7 mm and 77% below
       * the eye centre — i.e. mostly UNDER the eye and facing the camera. At the
       * original 0.22 it was a visible dark wash contributing to the under-eye
       * darkness; `clean` takes it to 0.10, enough to keep the eye seated in the
       * socket without reading as a smudge.
       */
      if (eyeMode === "occ-off" || eyeMode === "bare") return { bucket: "translucent", build: () => standard(name, HIDDEN) };
      /**
       * Measured: removing Occ entirely changes the under-eye bands by only
       * ~1.5 luma out of ~70, because the socket shadow is already painted into
       * the face diffuse map. It is therefore mostly double-shadowing, and the
       * integration variants dial it back rather than removing it — it still
       * does useful work seating the eyeball against the lid.
       */
      const opacity = eyeMode === "integration-b" ? 0.05 : eyeMode === "integration-a" ? 0.07 : eyeMode === "clean" ? 0.1 : 0.22;
      return {
        bucket: "translucent",
        build: () => standard(name, { color: new Color("#3a2418"), transparent: true, opacity, depthWrite: false, roughness: 0.9, metalness: 0 })
      };
    }
    // 12 lash cards. These are alpha-cutout strips in the original pipeline and
    // the package ships no alpha map, so opaque quads would read as slabs over
    // the eyes. Semi-transparent keeps them present without hiding the eye.
    if (name.startsWith("M_EyeLashes")) {
      if (eyeMode === "lash-off" || eyeMode === "bare") return { bucket: "translucent", build: () => standard(name, HIDDEN) };
      const usesAlpha = eyeMode === "clean" || eyeMode === "integration-a" || eyeMode === "integration-b";
      const alphaMap = usesAlpha ? demoLashAlpha(variantFor(eyeMode)) : undefined;
      if (alphaMap) {
        /**
         * THE FIX. These cards are alpha-cutout strips with no shipped alpha map,
         * so as plain quads three stacked lower cards composite to 91% opaque —
         * the black slab under each eye. `alphaMap` supplies the missing cutout,
         * so the gaps between strands become genuinely transparent and the card
         * stops being a rectangle. `alphaTest` discards the near-empty texels
         * outright, which also removes the sort artefacts that many stacked
         * transparent layers would otherwise produce.
         */
        return {
          bucket: "translucent",
          build: () => standard(name, {
            color: new Color("#241a15"), alphaMap, transparent: true, opacity: 0.92,
            alphaTest: 0.18, depthWrite: false, roughness: 0.6, metalness: 0
          })
        };
      }
      return {
        bucket: "translucent",
        build: () => standard(name, { color: new Color("#241a15"), transparent: true, opacity: 0.55, depthWrite: false, roughness: 0.6, metalness: 0 })
      };
    }
    if (name.startsWith("teeth")) {
      return { bucket: "flat", build: () => standard(name, { color: new Color(TEETH), roughness: 0.35, metalness: 0 }) };
    }
    if (name.endsWith("eyeball.001")) {
      /**
       * TEMPORARY HYPER3D DEMO EYE MATERIAL — see `hyper3dEyeTexture.ts`.
       *
       * `color` stays white so the map is not tinted by it. Roughness 0.18 is
       * what produces the corneal highlight: low enough for the scene key light
       * to leave a real specular glint on a wet surface, high enough not to read
       * as polished plastic. The highlight comes from the LIGHTING rather than
       * being painted into the texture, so it stays put as the eye rotates
       * instead of sliding around with the iris.
       */
      const map = demoEyeTexture(variantFor(eyeMode));
      if (!map) return { bucket: "flat", build: () => standard(name, { color: new Color(SCLERA), roughness: 0.25, metalness: 0 }) };
      return { bucket: "eyes", build: () => standard(name, { map, color: new Color("#ffffff"), roughness: 0.18, metalness: 0 }) };
    }
    // M_Body (tile 1008), M_BackHead (tile 1002) and the two declared-but-unused
    // M_Face.001 / M_BackHead.001. Skin tone measured off the diffuse map.
    return { bucket: "flat", build: () => standard(name, { color: new Color(SKIN), roughness: 0.75, metalness: 0 }) };
  };

  const seen = new Set<string>();
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    /**
     * HYPER3D CURLY HAIR. The hair is a SECOND FBX parented to `Head_M`, so it
     * is inside this traversal, but it is not part of the USC pack and none of
     * the plan above applies to it: `planFor` classifies by material name and
     * would fall through to the flat skin colour, replacing the hair's own
     * authored diffuse and normal maps with a bald skin-toned material.
     * `hyper3dHair.ts` owns those materials; this one leaves them alone.
     */
    if (isHyper3dHairObject(object)) return;
    const materials: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const replaced = materials.map((material) => {
      const name = material?.name ?? "";
      const plan = planFor(name);
      // One report line per distinct material name, however many groups use it.
      if (!seen.has(name)) {
        seen.add(name);
        report[plan.bucket].push(name);
      }
      // Already ours AND built for the mode being asked for. A mode change falls
      // through and rebuilds; the geometry is never touched either way.
      if (material?.userData?.[APPLIED_FLAG] === `${eyeMode}|${skinMode}`) {
        if (name === "M_Face") faceMaterials.push(material as MeshStandardMaterial);
        return material;
      }
      const built = plan.build();
      /**
       * Stamp the MODE it was built for rather than a boolean. A re-apply under
       * the same mode is still a no-op — which is what keeps this safe against
       * StrictMode double-effects and the cached FBX — but switching review mode
       * falls through above and rebuilds.
       */
      built.userData[APPLIED_FLAG] = `${eyeMode}|${skinMode}`;
      if (name === "M_Face") faceMaterials.push(built);
      return built;
    });
    mesh.material = Array.isArray(mesh.material) ? replaced : replaced[0];
  });

  if (faceMaterials.length) {
    void loadTextures(textureBaseUrl, true)
      .then(({ diffuse, normal }) => {
        for (const face of faceMaterials) {
          if (face.map) continue;
          face.map = diffuse;
          face.normalMap = normal;
          // The softness lever. Applied here because `normalScale` only matters
          // once a normal map exists on the material.
          face.normalScale.set(skin.normalScale, skin.normalScale);
          face.color.set("#ffffff");
          face.needsUpdate = true;
        }
      })
      .catch(() => {
        // The face keeps its flat skin-toned standard material. Reported by the
        // caller through the runtime status warnings rather than thrown, because
        // a missing texture must not take the canvas down.
        for (const face of faceMaterials) face.color.set(SKIN);
      });
  }

  return report;
};

/**
 * Sets `normalScale` magnitude WITHOUT destroying the sign the loader chose.
 *
 * THE DEFECT THIS FIXES. `female_229.glb` ships no TANGENT attribute on any
 * primitive, so three derives tangents from screen-space derivatives, and
 * GLTFLoader compensates by negating `normalScale.y` — every material in this
 * asset arrives as `[1, -1]` (measured; see
 * `GLTFLoader.js` `useDerivativeTangents`, three/issues/11438).
 *
 * The migration pass wrote `normalScale.set(s, s)`, which threw that `-1` away
 * and **inverted the normal map's green channel**. With green inverted, every
 * crease is lit as though the light came from the opposite vertical direction:
 * grooves render as ridges and pores as bumps, which reads exactly as the
 * "wrinkled / rough / aged" skin reported from the first review render. The
 * texture was never the whole story — the sign was.
 *
 * `Math.sign` of the current y, so this is correct on an asset that ships real
 * tangents too (where the loader leaves `+1`) rather than hard-coding `-1`.
 */
const setNormalScalePreservingSign = (material: MeshStandardMaterial, scale: number) => {
  const sign = material.normalScale.y < 0 ? -1 : 1;
  material.normalScale.set(scale, scale * sign);
};

/**
 * THE SAME ACCEPTED FACE MATERIAL, ON THE GLB'S OWN AUTHORING.
 *
 * `applyHyper3dMaterials` above exists because `additional_body.fbx` ships no
 * textures and no PBR authoring at all, so every material has to be built from
 * nothing. `female_229.glb` is the opposite case: it arrives from GLTFLoader as
 * real `MeshStandardMaterial`s with real maps, including the SAME Hyper3D
 * `texture_diffuse` on the face. Rebuilding those would be a material pass, and
 * the migration forbids one.
 *
 * So this touches exactly one material and carries across exactly the values
 * that were accepted:
 *
 *   roughness   <- SKIN_VARIANTS[skinMode].roughness    (SOFT A: 0.62)
 *   normalScale <- SKIN_VARIANTS[skinMode].normalScale  (SOFT A: 0.62)
 *   metalness   <- 0
 *   normalMap   <- the shipped `texture_normal.png`
 *
 * The normal map is bound because the accepted face material has it and the GLB
 * does not: the author bound `texture_diffuse` as base colour and stopped there.
 * Both maps are the same tile-1001 projection and the mesh's UVs are the same
 * layout, so the normal map lands where the diffuse lands.
 *
 * EVERY OTHER MATERIAL IS LEFT EXACTLY AS AUTHORED, and each is reported:
 *
 *   UnrealMaterial.004  eyes   — a real baked iris map + normal. The accepted
 *                               Hyper3D eye material is an explicit PLACEHOLDER
 *                               built for the FBX eyeball unwrap ("remove when
 *                               the vendor supplies a real eye map"); this asset
 *                               supplies one, and its UVs are not the FBX's.
 *                               Applying the placeholder here would be a
 *                               downgrade, so the conflict is REPORTED instead.
 *   UnrealMaterial.002  teeth  — real baked base colour, normal and roughness,
 *                               where the FBX plan had only a flat enamel colour.
 *   Material.004/.005   hair   — owned by the asset's built-in hair.
 *   Wolf3D_*            body and outfit — regions the FBX does not have at all.
 *
 * KNOWN ASSET ARTEFACT, reported not corrected: `blendshapes` spans UDIM tiles
 * 1001 AND 1002 (u = 0.005 .. 1.987) on this one material, so the back of the
 * head samples the tile-1001 face map a second time. The FBX splits those into
 * `M_Face` and `M_BackHead`. It is behind the hair in the accepted framing.
 */
/** The derived, evened base colour. Written by the correction script. */
export const EVENED_ALBEDO_FILE = "texture_diffuse_evened.png";
/** Where the GLB's own embedded base colour is kept, so the swap is reversible. */
const AUTHORED_MAP = "hyper3dAuthoredAlbedo";

export type Hyper3dSkinAlbedo = "authored" | "evened";

export const applyHyper3dGlbMaterials = (
  root: Object3D,
  textureBaseUrl: string,
  faceLook: Hyper3dFaceLook = "f228-profile",
  /**
   * TEMPORARY SKIN-NORMAL SWEEP — DEV review only, see
   * `useAvatarStore.hyper3dSkinNormalOverride`.
   *
   * Overrides `normalScale` and NOTHING else: `roughness` still comes from the
   * face look, so the accepted 0.6454545259475708 is unreachable from here, and
   * so is every other value on this material and on every other material.
   * `undefined` is the production path.
   */
  normalScaleOverride?: number,
  albedo: Hyper3dSkinAlbedo = "authored"
): Hyper3dMaterialReport => {
  const look = HYPER3D_FACE_LOOKS[faceLook];
  const skin: Hyper3dFaceLookVariant =
    normalScaleOverride === undefined ? look : { ...look, normalScale: normalScaleOverride };
  const report: Hyper3dMaterialReport = {
    textured: [],
    flat: [],
    eyes: [],
    translucent: [],
    unusedMaps: [
      "texture_specular.png (MeshStandardMaterial has no specularMap; specular is not roughness, so it is left unbound rather than guessed)"
    ],
    skin: { mode: faceLook, normalScale: skin.normalScale, roughness: skin.roughness }
  };
  const faceMaterials: MeshStandardMaterial[] = [];
  const seen = new Set<string>();

  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    if (isHyper3dHairObject(object)) return;
    const materials: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      const name = material?.name ?? "";
      // Blender's export suffixes duplicated datablocks (`M_Face` -> `M_Face.002`),
      // so the region is matched on the stem rather than the exported spelling.
      const stem = name.replace(/\.\d+$/, "");
      const standardMaterial = material as MeshStandardMaterial;
      if (stem === "M_Face" && standardMaterial?.isMeshStandardMaterial) {
        if (!seen.has(name)) { seen.add(name); report.textured.push(name); }
        // The sweep value is part of the key, or a re-apply at a new strength
        // would be swallowed as "already ours".
        const stamp = `glb|${faceLook}|${normalScaleOverride ?? "look"}`;
        if (standardMaterial.userData?.[APPLIED_FLAG] === stamp) {
          faceMaterials.push(standardMaterial);
          continue;
        }
        standardMaterial.roughness = skin.roughness;
        standardMaterial.metalness = 0;
        setNormalScalePreservingSign(standardMaterial, skin.normalScale);
        standardMaterial.userData[APPLIED_FLAG] = stamp;
        standardMaterial.needsUpdate = true;
        faceMaterials.push(standardMaterial);
        continue;
      }
      if (!seen.has(name)) {
        seen.add(name);
        report.flat.push(`${name} (left exactly as authored in the GLB)`);
      }
    }
  });

  const f228 = faceLook === "f228-profile";
  report.notes = [
    `Face material carrying the accepted Hyper3D skin values (${report.textured.length}): ${report.textured.join(", ") || "none"}`,
    `Face look applied: ${faceLook} (normalScale ${skin.normalScale}, roughness ${skin.roughness}, fill ${skin.fill ? `${skin.fill.intensity} @ ${skin.fill.position.join(",")}` : "none"}) — appearance only; the GLB's own diffuse texture is untouched`,
    f228
      ? `Materials this module leaves as the GLB authored them (${report.flat.length}): ${report.flat.join(", ") || "none"}. NOTE: under the Female.228 appearance profile, \`applyMaterialTuning\` runs AFTER this pass and then carries Female.228's accepted envMapIntensity, hair metalness/base-colour and corneal eye values onto the materials that exist on both assets. See mappings/avatars/hyper3dAppearanceProfile.ts.`
      : `Materials left exactly as the GLB authored them (${report.flat.length}): ${report.flat.join(", ") || "none"}`,
    f228
      ? "EYES: `UnrealMaterial.004` is byte-identical across Female.228 and female_229 — same authored roughness 0.0745, same base-colour and normal textures, and the eye mesh carries byte-identical UVs (sha256 8c199ff65da868ef, 772 vertices) on both. Female.228's accepted corneal eye material is therefore transferred 1:1 with a proven UV/texture match. The asset's own iris map is kept; the FBX-era placeholder map is still NOT applied. Eye bone rest, gaze axis, amplitude and timing are untouched."
      : "EYES: the GLB ships a real baked iris map. The accepted Hyper3D eye material is a documented placeholder for an asset that shipped none, and its UV layout is the FBX eyeball unwrap, so it is NOT applied here. Flagged for review.",
    f228
      ? "TEETH: `UnrealMaterial.002` is byte-identical across both assets (same baked base colour, normal and roughness maps). Female.228's accepted envMapIntensity 0.30 transfers 1:1; the maps themselves are untouched."
      : "TEETH: the GLB ships baked base colour, normal and roughness where the FBX plan had a flat enamel colour. Left as authored. Flagged for review.",
    "ASSET ARTEFACT: `blendshapes` spans UDIM tiles 1001 and 1002 (u 0.005..1.987) on one material, so the back of the head samples the tile-1001 face map a second time. Behind the hair in the accepted framing. Reported, not corrected.",
    ...report.unusedMaps.map((entry) => `Shipped map left unbound: ${entry}`)
  ];

  if (faceMaterials.length) {
    /**
     * `flipY: false` — the glTF convention, which is what this mesh's UVs are.
     * See `loadTextures` for the measurement behind that, and for why binding
     * this map at `true` mirrored it against the albedo.
     */
    void loadTextures(textureBaseUrl, false, albedo === "evened" ? EVENED_ALBEDO_FILE : undefined)
      .then(({ diffuse, normal }) => {
        for (const face of faceMaterials) {
          // The map is bound once; the strength is re-asserted every time, so a
          // sweep step still lands on a material that already carries the map.
          if (!face.normalMap) face.normalMap = normal;
          /**
           * THE ALBEDO CORRECTION, and the reason it is a swap rather than an
           * edit. `authored` leaves the GLB's own embedded base colour exactly
           * as it arrived; `evened` points `map` at the DERIVED file that
           * `scripts/female229-albedo-correction.mjs` writes next to the source.
           * The source PNG is never modified, the UVs are untouched, and
           * switching back restores the embedded texture object itself.
           */
          if (albedo === "evened") {
            if (face.userData[AUTHORED_MAP] === undefined) face.userData[AUTHORED_MAP] = face.map;
            if (face.map !== diffuse) { face.map = diffuse; face.needsUpdate = true; }
          } else if (face.userData[AUTHORED_MAP] !== undefined) {
            const authored = face.userData[AUTHORED_MAP] as typeof face.map;
            if (face.map !== authored) { face.map = authored; face.needsUpdate = true; }
          }
          // `normalScale` only matters once a normal map exists on the material.
          setNormalScalePreservingSign(face, skin.normalScale);
          face.needsUpdate = true;
        }
      })
      .catch(() => {
        // The face keeps the GLB's own authored diffuse and a flat normal. The
        // caller reports it; a missing map must not take the canvas down.
      });
  }

  return report;
};
