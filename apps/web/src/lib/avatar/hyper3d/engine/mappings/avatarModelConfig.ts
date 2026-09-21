import { EXPECTED_MINIFACE_BLENDSHAPES } from "./avatarBlendshapeConfig";
import type { SpeakingHeadMotionMode } from "../engine/animation/SpeakingHeadMotionController";
import {
  HYPER3D_2291_EYE_REST_CORRECTION,
  HYPER3D_FBX_RIG,
  HYPER3D_GLB_EYE_REST_CORRECTION,
  HYPER3D_GLB_RIG,
  type BoneAxisSign,
  type Hyper3dEyeRestCorrection
} from "../engine/avatar/hyper3dRigAdapter";
import {
  HYPER3D_ASSET_URLS,
  HYPER3D_LEGACY_ASSET_ID,
  HYPER3D_LEGACY_FBX_URL,
  hyper3dAssetSelection,
  useLegacyHyper3dFbx,
  type Hyper3dAssetId
} from "./avatars/hyper3dAssetSelection";

export type AvatarModelId = "miniface-male" | "female" | "hyper3d-usc";
export type CompatibilityStatus = "Supported" | "Partial" | "Missing" | "Not tested";

export interface MorphTargetBinding {
  target: string;
  /** May be negative for targets listed in `signedMorphTargets`. */
  weight?: number;
}

export interface AvatarModelConfig {
  id: AvatarModelId;
  label: string;
  url: string;
  scale: [number, number, number];
  position: [number, number, number];
  rotation: [number, number, number];
  camera: {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
    near: number;
    far: number;
    minDistance: number;
    maxDistance: number;
  };
  lighting?: {
    ambientIntensity?: number;
    keyIntensity?: number;
    fillIntensity?: number;
  };
  meshNames: {
    face: string[];
    mouth: string[];
    teeth: string[];
    tongue: string[];
    eyes: string[];
    eyelashes: string[];
    hair: string[];
    body: string[];
  };
  /** Unskinned meshes reparented onto the head bone at load. See §P15. */
  headAttachedMeshes?: string[];
  boneNames: {
    head: string[];
    neck: string[];
    jaw: string[];
    leftEye: string[];
    rightEye: string[];
  };
  /**
   * Sign that carries a semantic head/neck rotation onto THIS rig's bone-local
   * axes, supplied by `hyper3dRigAdapter`. Omitted means `{1, 1, 1}` — the rig's
   * axes already agree with world, which is what every asset before
   * `female_229.glb` measured.
   *
   * `BoneController` applies it in the FINAL quaternion composition only, after
   * smoothing and after the semantic rotation has been stored, so no value any
   * controller computes, reports or pins in a test is affected by it.
   */
  boneAxisSign?: BoneAxisSign;
  morphMapping: Record<string, MorphTargetBinding[]>;
  /**
   * Targets that accept negative influence and are combined by sum instead of max.
   * Needed when a model only ships one direction of a bidirectional deformation.
   */
  signedMorphTargets?: string[];
  /**
   * Per-eye geometry rotation, used when the asset has no skinned eye bones and
   * both eyeballs share a single mesh.
   */
  eyeGeometry?: { meshName: string; maxYawDegrees: number; maxPitchDegrees: number; gazeScale: number };
  /**
   * Skinned eye bones to rotate by the gaze the pose ALREADY carries, for assets
   * whose eyeballs are a separate mesh from the one holding the eyeLook morphs.
   * Omitted means the adapter never discovers anything and never runs. See
   * `Hyper3dEyeBoneGaze`.
   */
  eyeBoneGaze?: {
    leftEye: readonly string[];
    rightEye: readonly string[];
    /**
     * Per-eye neutral rest fix for an asset whose eyeballs do not point forward
     * at rest. Composed AHEAD of the gaze rotation, so no gaze value is scaled.
     * See `HYPER3D_GLB_EYE_REST_CORRECTION`.
     */
    restCorrection?: Hyper3dEyeRestCorrection;
  };
  /**
   * Which Hyper3D material hookup this asset needs, and where the package's
   * shipped face maps live. Absent means the asset's own materials are used as
   * the loader delivered them.
   *
   * `fbx` builds every material from nothing, because `additional_body.fbx`
   * ships none. `glb` carries the accepted face values onto the GLB's own
   * authored material and leaves every other material alone. Both read the same
   * `SKIN_VARIANTS` record, so the accepted SOFT A values are one source.
   */
  hyper3dMaterials?: { mode: "fbx" | "glb"; textureBaseUrl: string };
  /**
   * Mount the external Beatrice curly-hair FBX onto this asset's head bone.
   *
   * True only for the legacy Hyper3D FBX, which ships bald. `female_229.glb`
   * ships its own fitted hair, and the Beatrice wig cannot be moved onto it
   * without changing its transform — which §12 of the migration brief forbids.
   * MEASURED reasons, both fatal on their own:
   *
   *   - The fit is stored in `Head_M` LOCAL CENTIMETRES. One `head` local unit
   *     on the GLB is 1.0533 cm after the asset transform, so every number in
   *     `HYPER3D_HAIR_MEASURED_TRANSFORM` would land 5.3% out.
   *   - The GLB head bone's frame is turned 180 degrees about Y relative to the
   *     FBX's, so the fit's +21.35 cm of Z would put the wig BEHIND the skull.
   *
   * The Beatrice implementation, its fit, its materials and its evidence are
   * untouched by this migration and still apply on the DEV rollback.
   */
  externalCurlyHair?: boolean;
  /**
   * Mount this asset's own face fill light. Additive and asset-local: the scene's
   * ambient, key and fill are untouched, and so is the renderer's exposure. The
   * spec itself lives with the face look in `HYPER3D_FACE_LOOKS`, so a review
   * switch changes the light and the material together.
   */
  faceFillLight?: boolean;
  /**
   * How the procedural speaking head behaves on this model. Defaults to `free`.
   *
   * Two procedural writers reach the head — `SpeakingHeadMotionController` through
   * `HeadMotionController`, and `HumanBehaviorController` through
   * `IdleExpressionController` — and their outputs are summed. Anything other than
   * `free` also holds the idle layer's head still while speech is active, so the
   * speaking layer is the single owner rather than one of two.
   *
   * - `free` (2026-08-17 and earlier): the uncorrected drift. Kept as the default so
   *   no model inherits a change it was not measured for.
   * - `stabilized` (§8): the emitted pose is suppressed and the head does not move.
   *   Kept because it is one word away and remains the fallback if the corrected
   *   drift is rejected on real hardware.
   * - `centered` (§15): the drift with its three measured defects corrected — a
   *   sustained one-sided lean, a 3 s direction step and per-frame amplitude
   *   modulation by the raw speech envelope. See `withCenteredDrift`.
   */
  speakingHeadMotion?: SpeakingHeadMotionMode;
  /** Authoring leftovers in the GLB that must not render. */
  hiddenMeshNames?: string[];
  /**
   * Targets the GLB declares by name but which carry no geometry deltas on any
   * primitive. Writing to them can never produce visible movement.
   */
  deadMorphTargets?: string[];
  unsupportedMorphs: string[];
  supportNotes: string[];
  bilabial: {
    status: CompatibilityStatus;
    strategy: "dedicated" | "composite" | "canonical" | "unsupported";
    targets: string[];
    notes: string;
  };
}

const identityMorphMapping = Object.fromEntries(
  EXPECTED_MINIFACE_BLENDSHAPES.map((name) => [name, [{ target: name }]])
) as Record<string, MorphTargetBinding[]>;

const femaleDirectMorphs = [
  "eyeBlinkLeft", "eyeBlinkRight", "mouthSmileLeft", "mouthSmileRight", "mouthFrownLeft", "mouthFrownRight",
  "eyeLookUpLeft", "eyeLookUpRight", "cheekSquintLeft", "cheekSquintRight", "eyeLookDownLeft", "eyeLookDownRight",
  "browDownLeft", "browDownRight", "noseSneerLeft", "noseSneerRight", "mouthUpperUpLeft", "mouthUpperUpRight",
  "mouthLowerDownLeft", "mouthLowerDownRight", "mouthPressLeft", "mouthPressRight", "mouthShrugLower", "mouthShrugUpper",
  "mouthRollLower", "jawLeft", "jawRight", "jawForward", "browOuterUpLeft", "browOuterUpRight", "mouthFunnel",
  "mouthPucker", "eyeWideLeft", "eyeWideRight", "eyeSquintLeft", "eyeSquintRight"
];

/**
 * Declared on the female GLB but carrying no geometry on any primitive, so they
 * are inert no matter what value the runtime writes.
 *
 * Measured at load through GLTFLoader, which resolves sparse morph accessors.
 * Most of this asset's morph targets are stored sparsely, so a reader that
 * ignores sparse accessors reports almost everything as empty. Every other
 * target does carry real travel: brow and cheek targets move 20-40% as far as a
 * full blink at influence 1.0.
 */
const femaleDeadMorphTargets = [
  "Eyes", "Mouth", "browDownLeft", "browDownRight", "mouthDimpleLeft", "mouthDimpleRight"
];

const femaleMorphMapping: Record<string, MorphTargetBinding[]> = {
  ...Object.fromEntries(femaleDirectMorphs.map((name) => [name, [{ target: name }]])),
  // The new asset exposes only the capitalised JawOpen; lowercase jawOpen is gone.
  jawOpen: [{ target: "JawOpen" }],
  /**
   * Bilabial closure composite, re-derived 2026-08-18 from measured lip mechanics.
   * See docs/FEMALE_REALISM_REMEDIATION.md §13 and
   * docs/evidence/bilabial-lip-mechanics/bilabial-lip-mechanics.json.
   *
   * `mouthClose` saturates at 1.0 on every P/B/M (authored 0.8-0.96 x defaultIntensity
   * x the 1.9 gain), so these weights are not a blend — they ARE the influences that
   * render on a bilabial. Three measured problems followed from that, and all three
   * are fixed here rather than in a controller:
   *
   * 1. **The lateral squeeze was unbalanced, because this composite bypassed
   *    `sideBalance`.** That correction is applied by the coordinated controller to
   *    the canonical `mouthPressLeft/Right`, but `MorphTargetController.write` expands
   *    this composite afterwards and max-merges, and 0.78 beat every side-balanced
   *    value the controller produced (0.508/0.333 on P). Both sides therefore rendered
   *    at exactly 0.78 while `mouthPressRight` moves 1.53x the tissue of its partner,
   *    so the rendered bilabial was lopsided **1.79:1** against a geometric floor of
   *    1.21 — the full raw asset lean, uncorrected. §7 measured 1.008 on the canonical
   *    pose and never saw this, because the imbalance is created after that pose.
   *    The balance is now baked in per side, at `0.22 x sideBalance`.
   *
   * 2. **`mouthPress` was doing almost no sealing for almost all of the lateral
   *    stress.** Measured against the rest lip gap of 0.940e-3: the press pair at 0.78
   *    closes it by 0.0065e-3, while `mouthShrugLower` + `mouthRollLower` close it by
   *    0.598e-3 — the lower lip does the sealing, and press contributes ~1% of it
   *    while supplying ~100% of the horizontal compression. Dropped 0.78 -> 0.22 so it
   *    is a compression term rather than the seal, which also puts it BELOW the
   *    authored per-phoneme press values (P 0.3, B 0.32, M 0.52). Those were
   *    previously inert — the max-merge always discarded them — and are now what
   *    governs speech, already side-balanced by the controller.
   *
   * 3. **`mouthShrugUpper` was fighting the seal.** It moves the upper lip UP and
   *    FORWARD (meanDY +1.0e-3, meanDZ +2.1e-3, 67.5% of its travel on Z), so at 0.42
   *    it lifted the upper lip away from the lower lip as fast as the lower lip rose:
   *    the full composite closes the gap by 0.022e-3 where its lower-lip half alone
   *    closes it by 0.598e-3. It is also the whole of the "upper lip pushed forward
   *    and flattened" appearance — a uniform slab translation of the lip band against
   *    pinned corners. Cut 0.42 -> 0.12; the coordinated layer keeps its own
   *    separately-tuned upper-lip participation via `bilabials.upperLipSupport`.
   *
   * The lower-lip weights are unchanged: they are the half of this composite that was
   * doing its job.
   *
   * Net effect at the seal, through the real pipeline: lip contact unchanged
   * (gap -2.0% on P before and after), horizontal compression down 49%, rendered L/R
   * imbalance 1.79 -> 1.17, upper-lip lift down 45% and protrusion down 54%.
   */
  mouthClose: [
    // 0.22 x femaleSpeechProfile.sideBalance.mouthPress.left (1.236)
    { target: "mouthPressLeft", weight: 0.272 },
    // 0.22 x femaleSpeechProfile.sideBalance.mouthPress.right (0.809)
    { target: "mouthPressRight", weight: 0.178 },
    { target: "mouthShrugUpper", weight: 0.12 },
    { target: "mouthShrugLower", weight: 0.38 },
    { target: "mouthRollLower", weight: 0.2 }
  ],
  // Dimple_ZZ no longer exists in the new asset, and mouthDimple* are empty, so
  // lip-corner stretch has no renderable target on this GLB.
  mouthStretchLeft: [],
  mouthStretchRight: [],
  mouthRollUpper: [{ target: "mouthShrugUpper", weight: 0.52 }],
  browInnerUp: [{ target: "browInnerUpLeft" }, { target: "browInnerUpRight" }],
  // Gaze is produced by EyeGeometryController, which rotates each eyeball's
  // vertex group about its own pivot. The eyeball morphs are deliberately NOT
  // bound to the gaze channels: they only rotate an eye outward, so they cannot
  // express a direction on their own, and driving them as well would double-move
  // the eyes.
  eyeLookOutLeft: [],
  eyeLookInLeft: [],
  eyeLookOutRight: [],
  eyeLookInRight: [],
  // Direct proof-control aliases so the proof panel can still exercise the raw
  // morph targets one-to-one.
  LeftEyeball: [{ target: "LeftEyeball" }],
  RightEyeball: [{ target: "RightEyeball" }],
  cheekPuff: [],
  // Renamed with a capital M in the new asset. This was the lip-sync break.
  mouthFunnel: [{ target: "MouthFunnel" }],
  mouthPucker: [{ target: "MouthPucker" }]
};

/**
 * THE EYE-REST CONSTANT EACH HYPER3D ASSET NEEDS, and the only value in this
 * file that differs between them.
 *
 * Each GLB carries its own authored eyeball orientation, so each needs the
 * pre-rotation that cancels ITS OWN neutral. Both land on the SAME accepted
 * neutral — left yaw -2.83, right yaw +2.03, vergence +4.86 convergent — which
 * is the point: the correction differs precisely so the rendered result does
 * not. See `HYPER3D_2291_EYE_REST_CORRECTION` for the transfer derivation.
 */
const HYPER3D_EYE_REST_CORRECTIONS: Readonly<Record<Hyper3dAssetId, Hyper3dEyeRestCorrection>> = {
  female_2291: HYPER3D_2291_EYE_REST_CORRECTION,
  female_229: HYPER3D_GLB_EYE_REST_CORRECTION
};

export const avatarModelConfigs: Record<AvatarModelId, AvatarModelConfig> = {
  "miniface-male": {
    id: "miniface-male",
    label: "Current avatar",
    url: "/models/miniface-male.glb",
    scale: [1, 1, 1],
    position: [0, -0.12, 0],
    rotation: [0, 0, 0],
    camera: { position: [0, 1.45, 2.05], target: [0, 1.28, 0], fov: 28, near: 0.1, far: 100, minDistance: 1.2, maxDistance: 4 },
    meshNames: { face: ["male"], mouth: [], teeth: [], tongue: [], eyes: [], eyelashes: [], hair: [], body: ["male"] },
    boneNames: { head: ["Head"], neck: ["Neck"], jaw: [], leftEye: ["LeftEye"], rightEye: ["RightEye"] },
    morphMapping: identityMorphMapping,
    unsupportedMorphs: [],
    supportNotes: ["Default runtime avatar; mapping unchanged."],
    bilabial: { status: "Supported", strategy: "canonical", targets: ["mouthClose", "mouthPressLeft", "mouthPressRight"], notes: "Uses calibrated current-avatar canonical mapping." }
  },
  female: {
    id: "female",
    label: "Female GLB",
    url: "/models/female.glb",
    // 2026-08-17 (§8) the speaking head drift was held still rather than tuned;
    // 2026-08-20 (§15) the mechanism was corrected and the motion restored. Set to
    // "stabilized" to go back to the freeze. See docs/FEMALE_REALISM_REMEDIATION.md.
    speakingHeadMotion: "centered",
    scale: [1, 1, 1],
    position: [0, -0.3, 0],
    rotation: [0, 0, 0],
    camera: { position: [0, 0.98, 2.25], target: [0, 0.9, 0.02], fov: 30, near: 0.05, far: 100, minDistance: 1.1, maxDistance: 4 },
    // Every mesh was renamed in the updated GLB. Face002_4 is the 13,292-vertex
    // face skin, Eyes is the eyeball pair, Face002_6 the lash/tear-line strip,
    // Teeth the inner mouth, Character002_1 the hair.
    meshNames: {
      face: ["Face002_4", "Face002_5", "Face002_6"],
      mouth: ["Teeth"],
      teeth: ["Teeth", "Face002_5"],
      tongue: [],
      eyes: ["Eyes", "Face002_6"],
      eyelashes: ["Face002_6"],
      hair: ["Character002_1"],
      body: ["Face002", "Face002_1", "Face002_2", "Face002_3", "Character002"]
    },
    boneNames: { head: ["head"], neck: ["neck_01", "neck_02"], jaw: ["FACIAL_C_Jaw"], leftEye: ["FACIAL_L_Eye"], rightEye: ["FACIAL_R_Eye"] },
    /**
     * Unskinned meshes that must be reparented onto the head bone at load (§P15).
     *
     * Both are hair. They ship parented to a `Character` group under the Scene
     * with no skin weights, so the head rotated inside a stationary wig: 11.7 mm
     * of skinned-scalp travel at yaw 8 degrees against 0.0000 mm of hair.
     * See `src/engine/avatar/attachHeadMeshes.ts`.
     */
    headAttachedMeshes: ["Character002", "Character002_1"],
    morphMapping: femaleMorphMapping,
    signedMorphTargets: ["LeftEyeball", "RightEyeball"],
    // Measured pivots: left eye centred near x=+0.0254, right near x=-0.0255,
    // radius 0.0087-0.0133, 386 vertices per eye.
    //
    // Amplitude tuning pass. `gazeScale` is the only value that controls the
    // visible rotation: measured over 10 minutes of idle (36,000 frames), the
    // maxYaw/maxPitch clamps were hit on 0.00% of frames, so they were pure safety
    // rails, not limiters. Peak applied yaw was 11.00 deg against the old 12 deg
    // rail; peak pitch 2.75 deg against 7 deg.
    //
    // 2.25 -> 2.81 raises mean applied eye travel by 24.9% (measured on the same
    // deterministic behaviour trace, so timing is unchanged and only amplitude
    // moves). maxYawDegrees goes 12 -> 14 purely to keep the rail non-binding: at
    // 2.81 the peak reaches 13.74 deg, and leaving the rail at 12 would clip the
    // top 0.28% of frames flat, which reads as the eyes sticking at a limit.
    // maxPitchDegrees stays at 7 because the new peak pitch is only 3.44 deg.
    //
    // Safety, measured on the real GLB: rotating the eyeball groups about their own
    // pivots SHRINKS the mesh extent slightly on all three axes (-1.7e-4, -4.8e-5,
    // -3.6e-4), so no angle in this range can push an eyeball further through the
    // lid aperture than it already sits at rest. Both groups receive the same
    // rotation matrix, so gaze is parallel and convergence (cross-eye) cannot occur.
    eyeGeometry: { meshName: "Eyes", maxYawDegrees: 22, maxPitchDegrees: 12, gazeScale: 4.01 },
    deadMorphTargets: femaleDeadMorphTargets,
    // A stray 240-vertex authoring sphere (metalness 1, no envMap, so it renders
    // black) spanning y -1.3..0.7. It is not part of the character and covers the
    // lower half of the legacy framing.
    hiddenMeshNames: ["Icosphere"],
    unsupportedMorphs: ["cheekPuff"],
    supportNotes: [
      "Updated asset (Blender I/O v5.1.20). Nine meshes are now SkinnedMesh bound to the 876-bone rig; the previous asset had none, so bone-driven head, neck, jaw and eye motion is newly possible.",
      "Morph targets are sparse accessors; 50 of 56 discovered targets carry real geometry. Empty: Eyes, Mouth, browDownLeft, browDownRight, mouthDimpleLeft, mouthDimpleRight.",
      "mouthFunnel and mouthPucker were renamed MouthFunnel and MouthPucker; Dimple_ZZ, lowercase jawOpen, viseme_NN and viseme_TH were removed.",
      "Gaze is produced by rotating each eyeball vertex group of the Eyes mesh about its own measured pivot.",
      "A stray Icosphere is hidden at load; it is authoring leftover, not part of the character.",
      "Native viseme playback is disabled by configuration; female playback uses canonical phoneme poses mapped to standard female morph controls."
    ],
    bilabial: { status: "Partial", strategy: "composite", targets: ["mouthPressLeft", "mouthPressRight", "mouthShrugUpper", "mouthShrugLower", "mouthRollLower"], notes: "Native viseme_PP is disabled for playback; P/B/M use the phoneme-generated mouthClose and lip-pressure composite." }
  },
  /**
   * HYPER3D — the production avatar.
   *
   * ASSET: `female_2291.glb`. MIGRATED from `USCBasicPack/additional_body.fbx`
   * 2026-09-11 (see `docs/HYPER3D_GLB_MIGRATION.md`), then from `female_229.glb`
   * 2026-09-14 for its corrected eyeballs (see
   * `docs/FEMALE_2291_MIGRATION_AUDIT.md`).
   *
   * `female_229.glb` remains shipped as a HIDDEN PRODUCTION FALLBACK behind
   * `?hyper3dLegacyGlb=1`, and is also loaded automatically if the production
   * asset fails to load once. The legacy FBX stays reachable through the
   * DEV-only `hyper3dLegacyFbx` flag and nothing else.
   *
   * THE TWO GLBs SHARE EVERYTHING BUT THEIR EYES. Measured: the face mesh and
   * all 51 morph delta buffers are BIT-IDENTICAL, and so is the hair. The only
   * runtime difference between the two asset paths is the eye-rest constant in
   * `eyeBoneGaze` below.
   *
   * NOTHING BELOW IS A RETUNE. The accepted Hyper3D runtime — phoneme table,
   * vowel midpoints, coarticulation, calibration ladder, expression vocabulary,
   * expression timing, speaking head, Active Presence, gaze and blink — is
   * shared by both assets unchanged and is not referenced here at all. What
   * changes between the two entries is only what an asset can change: which node
   * carries which region, where the asset sits, and which morph target name
   * holds which channel.
   *
   * THE TWO ASSETS CARRY THE SAME FACE. Measured, not assumed: all 51 morph
   * targets exist under identical names on both, none is dead on either, and
   * every one of the 51 delta buffers is IDENTICAL in the mesh's own local units
   * (`jawOpen` max travel 3.5192 on both, `mouthClose` 3.4650 on both, and so on
   * for the remaining 49). The GLB's face node is authored at scale 0.00789611
   * against the FBX's 0.01, so `scale` below returns the rendered deformation to
   * exactly the accepted world amplitude rather than approximating it.
   */
  "hyper3d-usc": {
    id: "hyper3d-usc",
    label: "Hyper3D (female_2291)",
    url: useLegacyHyper3dFbx ? HYPER3D_LEGACY_FBX_URL : hyper3dAssetSelection.url,
    /**
     * ASSET NORMALISATION, not a camera change. §17 of the migration brief: the
     * camera below is byte-identical to the accepted one, and the avatar is
     * moved to meet it.
     *
     * SCALE = 0.01 / 0.00789611041545868 = 1.266446. Derived, not fitted: it is
     * the ratio of the two assets' face authoring scales, so after it every one
     * of the 51 morph targets displaces exactly the same number of world metres
     * it displaced on the FBX. A fitted number would have been an amplitude
     * change wearing a transform's clothes.
     *
     * POSITION puts the eye line where the FBX's was — the anchor of a
     * head-framed shot — and the rest follows from the scale alone. Measured
     * after applying both, base positions only (no morph union):
     *
     *   landmark          FBX                    female_229 normalised
     *   eye midpoint      (0, 1.48604, 0.0596)   (0.00007, 1.48604, 0.0596)
     *   interocular       0.06290                0.06408   (+1.9%)
     *   crown             1.58100                1.58920   (+8 mm)
     *   face front z      0.10620                0.10260   (-3.6 mm)
     *   head half-width   0.09980                0.09490   (-4.9%)
     *
     * The figure's feet leave y=0 (they land at -0.2456) because this is a head
     * normalisation on a shorter body. Reported, not corrected: correcting it
     * would move the head, which is the one thing that must not move.
     */
    scale: useLegacyHyper3dFbx ? [0.01, 0.01, 0.01] : [1.266446, 1.266446, 1.266446],
    position: useLegacyHyper3dFbx ? [0, 0, 0] : [0, -0.24607, -0.05247],
    rotation: [0, 0, 0],
    /**
     * UNCHANGED FROM THE ACCEPTED HYPER3D CAMERA. Head-and-shoulders framing,
     * derived from the FBX rest geometry: head bone y=1.4296, eye bones y=1.4860,
     * crown y=1.5810, face material y=1.314..1.564, face front z=0.106.
     *
     * Target y=1.45 is the chin-to-crown midpoint (1.314 + 1.581) / 2. At fov 30
     * the 0.77 m eye-to-target distance shows 0.41 m of vertical field, so the
     * 0.267 m head fills about 65% of frame height with the shoulders still in
     * shot. `minDistance` 0.3 keeps an orbit-in from entering the skull.
     */
    camera: { position: [0, 1.46, 0.8], target: [0, 1.45, 0.03], fov: 30, near: 0.05, far: 100, minDistance: 0.3, maxDistance: 4 },
    /**
     * UNCHANGED FROM THE ACCEPTED HYPER3D LIGHTING. These are the values the H1
     * capture and every review since were taken at. `female_229.glb` ships its
     * own PBR authoring where the FBX shipped none, which changes what the
     * materials do with this light but is not a reason to relight the scene.
     */
    lighting: { ambientIntensity: 0.55, keyIntensity: 2.1, fillIntensity: 0.85 },
    /**
     * FBX: every region is a material group of the ONE `template_fullbody` mesh,
     * so every entry names the same object.
     *
     * GLB: the regions are real, separate meshes. Measured inventory —
     *   blendshapes     13,631 v  the Hyper3D face, all 51 morph targets, UNSKINNED
     *   Teeth            3,347 v  upper + lower arch, one `JawOpen` morph, UNSKINNED
     *   Eyes               772 v  386 v per eyeball, SKINNED to the eye bones
     *   Character002     1,163 v  hair cap,  UNSKINNED
     *   Character002_1  22,805 v  long hair, UNSKINNED
     *   Face002..Face002_3      body and outfit, SKINNED 1.0 to `neutral_bone`
     *   Face002_4            9 v  teeth-pivot stub left by the export
     */
    meshNames: useLegacyHyper3dFbx
      ? {
          face: ["template_fullbody"],
          mouth: ["template_fullbody"],
          teeth: ["template_fullbody"],
          tongue: [],
          eyes: ["template_fullbody"],
          eyelashes: ["template_fullbody"],
          hair: [],
          body: ["template_fullbody"]
        }
      : {
          face: ["blendshapes"],
          mouth: ["blendshapes", "Teeth"],
          teeth: ["Teeth"],
          tongue: [],
          eyes: ["Eyes"],
          eyelashes: [],
          hair: ["Character002", "Character002_1"],
          body: ["Face002", "Face002_1", "Face002_2", "Face002_3"]
        },
    /**
     * §P15, and on this asset it is what makes head motion visible at all.
     *
     * MEASURED: on `female_229.glb` NO mesh carries skin weight from `head`,
     * `neck_01`, `neck_02` or either clavicle. The face, teeth and both hair
     * meshes are unskinned children of the Scene, and the body meshes are bound
     * 1.0 to the single rigid `neutral_bone`. Rotating the head bone therefore
     * moved nothing at all until these four were reparented onto it.
     *
     * `attachHeadMeshes` uses `Object3D.attach`, which preserves world transform,
     * so the rest pose is pixel-identical and only subsequent motion propagates.
     * `Eyes` is deliberately absent: it is skinned to `FACIAL_L/R_EyeParallel`,
     * which are already descendants of `head`, so it follows on its own and
     * reparenting it would apply the head transform twice.
     */
    headAttachedMeshes: useLegacyHyper3dFbx ? [] : ["blendshapes", "Teeth", "Character002", "Character002_1"],
    /**
     * Resolved by `hyper3dRigAdapter`, which is the only file that knows a rig's
     * node names. See it for the measured FBX -> GLB map and for why the GLB's
     * bone-local axes need a sign and nothing else.
     *
     * FBX skin weights: `Head_M` reaches 1.0000 over 127,428 vertices and
     * `Neck_M` 0.9982 over 10,458. `Jaw_M`, `Eye_L` and `Eye_R` all cap at
     * exactly 0.0909 (= 1/11, the uniform fallback), so rotating them cannot
     * articulate anything — the jaw is left to the `jawOpen` morph and the eye
     * bones are left unbound.
     *
     * GLB: the jaw is likewise morph-only. The eye bones, unlike the FBX's, DO
     * carry real weight (1.0000 over 386 vertices each) and are driven by
     * `Hyper3dEyeBoneGaze`; they are still not listed here, because this record
     * feeds `BoneController`, which owns head and neck only.
     */
    boneNames: useLegacyHyper3dFbx
      ? { head: [...HYPER3D_FBX_RIG.head], neck: [...HYPER3D_FBX_RIG.neckPrimary], jaw: [], leftEye: [], rightEye: [] }
      : { head: [...HYPER3D_GLB_RIG.head], neck: [...HYPER3D_GLB_RIG.neckPrimary], jaw: [], leftEye: [], rightEye: [] },
    boneAxisSign: useLegacyHyper3dFbx ? HYPER3D_FBX_RIG.boneAxisSign : HYPER3D_GLB_RIG.boneAxisSign,
    /**
     * Identity on both assets. The Hyper3D morph names ARE the canonical
     * vocabulary: all 45 of `EXPECTED_MINIFACE_BLENDSHAPES` are present
     * natively, including the 13 that Female.228 lacks and has to synthesise
     * (`jawOpen`, `mouthClose`, `mouthFunnel`, `mouthPucker`, `browInnerUp`,
     * `cheekPuff`, `mouthRollUpper`, `mouthStretchLeft/Right`,
     * `eyeLookIn/OutLeft/Right`). No renames, no composites, no signed targets.
     *
     * Both assets also carry the same 6 targets outside the canonical set —
     * `mouthDimpleLeft/Right`, `mouthLeft`, `mouthRight`, `noseSneerLeft/Right`.
     *
     * The GLB adds ONE binding and changes no value: `jawOpen` also drives the
     * `Teeth` mesh's own `JawOpen`. On the FBX the teeth are a material group of
     * the same mesh as the face, so one morph moved both; on the GLB they are a
     * separate mesh with a separate target, and without this line the jaw would
     * open while the teeth stayed put. Weight 1 on both bindings, so the
     * influence that reaches each is exactly the influence the runtime asked for.
     */
    morphMapping: useLegacyHyper3dFbx
      ? identityMorphMapping
      : { ...identityMorphMapping, jawOpen: [{ target: "jawOpen" }, { target: "JawOpen" }] },
    /**
     * Deliberately absent on BOTH assets: `eyeGeometry`.
     *
     * FBX: every region shares one mesh, so pointing `EyeGeometryController` at
     * `template_fullbody` would rotate the entire body about the eye pivots.
     *
     * GLB: `Eyes` is a mesh of its own and would satisfy that controller, but
     * that controller is Female.228's gaze system and carries Female.228's
     * `gazeScale` and rails. Using it here would replace the accepted Hyper3D
     * gaze values with another model's, which the migration forbids. Gaze stays
     * on `hyper3dGazeCalibration` and reaches the eyeballs through
     * `Hyper3dEyeBoneGaze`, which rotates the two eye bones by the degrees that
     * calibration already computed.
     */
    eyeBoneGaze: useLegacyHyper3dFbx
      ? undefined
      : {
          leftEye: HYPER3D_GLB_RIG.leftEye,
          rightEye: HYPER3D_GLB_RIG.rightEye,
          /**
           * PER ASSET, and it has to be: each GLB needs the correction that
           * cancels ITS OWN authored neutral. Carrying female_229's onto
           * female_2291 would rotate an already-corrected eyeball a second time.
           * See `HYPER3D_2291_EYE_REST_CORRECTION` for the measurement.
           *
           * This is the ONLY runtime difference between the two asset paths.
           */
          restCorrection: HYPER3D_EYE_REST_CORRECTIONS[hyper3dAssetSelection.assetId]
        },
    /**
     * The maps live in the USC package on BOTH paths. The GLB embeds
     * `texture_diffuse` itself but not `texture_normal`, which the accepted face
     * material needs, and it is the same file either way.
     */
    hyper3dMaterials: {
      mode: useLegacyHyper3dFbx ? "fbx" : "glb",
      textureBaseUrl: "/avatars/hyper3d/USCBasicPack"
    },
    externalCurlyHair: useLegacyHyper3dFbx,
    // GLB only. The FBX's lighting was measured without it and keeps its look.
    faceFillLight: !useLegacyHyper3dFbx,
    unsupportedMorphs: [],
    /**
     * The export's own teeth-pivot stub: 9 vertices on `FACIAL_C_TeethUpper` and
     * `FACIAL_C_TeethLower`, spanning 13 x 5 x 10 mm inside the mouth. It is
     * authoring leftover from the Female.228 body, not part of the character.
     */
    hiddenMeshNames: useLegacyHyper3dFbx ? [] : ["Face002_4"],
    supportNotes: useLegacyHyper3dFbx
      ? [
          "DEV ROLLBACK ONLY — the legacy Hyper3D FBX. Production loads female_229.glb.",
          "Loaded through FBXLoader (three r185). One SkinnedMesh `template_fullbody`, 222,438 vertices, 22 material groups, 57 bones, 51 morph targets with zero dead targets.",
          "All 45 canonical morph names are present natively, so the mapping is identity. 6 extra targets (mouthDimpleLeft/Right, mouthLeft, mouthRight, noseSneerLeft/Right) are discovered but unbound.",
          "Jaw is morph-only: Jaw_M, Eye_L and Eye_R carry 0.0909 fallback skin weights and are never driven.",
          "EyeGeometryController is disabled for this model — every region shares one mesh, so vertex-group eye rotation would move the whole body.",
          "Only the face (UDIM tile 1001) is textured. Back-head, body, lashes and eyeballs occupy tiles 1002-1008, for which the package ships no maps; they render as measured flat colours.",
          "HAIR: NOT INCLUDED IN EXPORT. Confirmed with the package vendor; the asset is bald by export. Replacement hair is the external Beatrice FBX.",
          "EYES APPEARANCE: INCOMPLETE — no eye texture exists anywhere in the export; the iris is a procedural placeholder.",
          "TEETH: COMPLETE. Upper arch (11,526 verts) responds to none of the 51 morphs; lower arch (13,524 verts) follows jawOpen at meanDY -2.400."
        ]
      : [
          "PRODUCTION ASSET. `female_2291.glb` — the Hyper3D face on the Female.228 rig. Loaded through GLTFLoader (three r185); 10 meshes, 875 bones, no animation clips. `female_229.glb` is the hidden production fallback (`?hyper3dLegacyGlb=1`), and both run the identical Hyper3D system.",
          "KNOWN FEMALE_2291 ASSET DIFFERENCE — TEETH/JAW. Measured in world space through the real bind matrices: the teeth arch rests ~7.9 mm further back, and `Teeth.JawOpen` travels 21.97 mm at influence 1.0 against female_229's 14.35 mm (1.53x). The face's own `jawOpen` morph is bit-identical, so the teeth open wider than the lips around them. ACCEPTED INTO PRODUCTION by decision on 2026-09-14 and NOT compensated: no face jawOpen, phoneme jaw, P/B/M or vowel jaw value was changed. The legacy fallback exists partly for this risk.",
          "MORPHS: all 51 Hyper3D targets present under identical names, zero dead targets, and every delta buffer is identical to the FBX's in local units. The runtime writes the same influences and the asset transform renders them at the same world amplitude.",
          "MORPH ADAPTER, the only one: canonical `jawOpen` also drives the separate `Teeth` mesh's `JawOpen`. No value changes.",
          "HEAD/NECK: no mesh carries skin weight from head, neck_01, neck_02 or either clavicle. Head motion is delivered by reparenting the face, teeth and both hair meshes onto the `head` bone (§P15 attachHeadMeshes); the eyes follow through their own eye bones.",
          "NECK: `neck_02` stands in for `Neck_M`. Its rotation arm to the head bone is 0.0569 m against the FBX's 0.0745 m, so the same commanded degrees move the head 24% less far. Rig geometry, REPORTED, not compensated.",
          "BODY/SHOULDERS: on female_229 `Face002`..`Face002_3` are bound 1.0 to the rigid `neutral_bone`; female_2291 drops that placeholder bone (876 -> 875 joints) and carries the same meshes UNSKINNED under an equivalent node transform, with world-space rest geometry preserved. Either way the neck column and shoulders cannot deform, the accepted runtime drives no clavicle on either asset, and nothing regresses — but the FBX's neck skin deformation is gone.",
          "GAZE: the GLB's eyeLookIn/Out morphs move eyelid and socket skin only; the eyeballs are a separate mesh. `Hyper3dEyeBoneGaze` rotates FACIAL_L/R_EyeParallel by the degrees `hyper3dGazeCalibration` already produced, using its own measured degrees-per-unit constants. No gaze value is changed.",
          "TEETH: on female_2291 the lower arch drops 0.02197 m at jawOpen 1.0, against female_229's 0.01435 m and the FBX's 0.024 m. Asset property, REPORTED, not compensated. See the KNOWN FEMALE_2291 ASSET DIFFERENCE note above.",
          "TEETH RIG: female_2291 skins `Teeth` to FACIAL_C_TeethUpper/TeethLower plus tongue bones (all descendants of `head`), where female_229 carried it as an unskinned mesh reparented onto `head`. `attachHeadMeshes` therefore SKIPS it now, correctly — it already follows head motion through the skeleton, and reparenting a skinned mesh would apply the head transform twice.",
          "EYES GEOMETRY: female_2291's eyeballs are female_229's rigidly rotated about world Y by 21.175 (left) and 18.110 (right) degrees, RMS residual 0.00001 mm — straightened, not remodelled or re-UV'd. This is the reason for the migration.",
          "EYES REST: each asset carries its OWN per-eye neutral correction, because each must cancel its own authored neutral — female_229 rests at -17.42/-20.18 degrees of yaw, female_2291 at +4.16/-2.29. Both corrections land on the SAME accepted neutral (left -2.83, right +2.03, vergence +4.86 convergent), verified to a residual of 0.0000000 degrees. Composed AHEAD of the gaze rotation; no gaze rail, amplitude, event frequency or timing is touched.",
          "EYES MORPHS: female_2291 adds `Eyeball_Left` and `Eyeball_Right` on the `Eyes` mesh. They are pure rigid YAW-ONLY rotations (pitch <= 0.02 degrees), each moves BOTH eyeballs by different amounts, and both poses are divergent. They cannot serve a planner that commands pitch, so gaze stays on the eye BONES and these are left present and undriven. One resolved gaze command still owns the eyes.",
          "EYES APPEARANCE: the GLB ships a real baked eye map where the FBX had none. The accepted Hyper3D eye material is an explicit placeholder built for the FBX eyeball unwrap and is NOT applied here; the authored map is left in place. Flagged for review.",
          "HAIR: the GLB ships its own fitted hair (Character002 + Character002_1). The external Beatrice wig is NOT mounted on this asset — its fit is measured in `Head_M` local centimetres and the GLB head bone is a different frame (180 degrees about Y) at a different unit scale, so it cannot transfer without changing its transform. Flagged for decision.",
          "TONGUE: unsupported. Neither asset carries a tongue mesh or a `tongueOut` target, and the accepted speech system never requests one."
        ],
    bilabial: { status: "Supported", strategy: "canonical", targets: ["mouthClose", "mouthPressLeft", "mouthPressRight"], notes: "Native mouthClose carries real geometry (max travel 3.4650 local units on both assets), so no composite is needed." }
  }
};

/**
 * The avatar a fresh session starts on.
 *
 * PRE-HARDWARE REVIEW: Hyper3D is the model under review, so the app opens on it
 * rather than on the legacy rollback avatar. Nothing else changes — Female.228
 * (`female`) and the current avatar stay selectable in the Model panel, and no
 * per-model tuning, calibration or profile is touched by this constant.
 */
export const defaultAvatarModelId: AvatarModelId = "hyper3d-usc";
/**
 * Deliberately NOT `defaultAvatarModelId`.
 *
 * This is the safety net for an id that does not resolve, and the rollback model
 * is the right thing to land on there: it is the one asset with no format,
 * texture or rig caveats. Making the initial selection Hyper3D must not also
 * change what a corrupt id falls back to.
 */
export const fallbackAvatarModelId: AvatarModelId = "miniface-male";
export const getAvatarModelConfig = (id: AvatarModelId) => avatarModelConfigs[id] ?? avatarModelConfigs[fallbackAvatarModelId];

/**
 * Rebinds the `hyper3d-usc` config onto a SPECIFIC Hyper3D asset.
 *
 * Needed because the module-level config is resolved once at load, while the
 * automatic load-failure fallback has to switch assets DURING a session. It
 * returns a config identical to the shipping one except for the two things an
 * asset owns — the GLB that loads and the eye-rest constant that cancels that
 * GLB's authored neutral.
 *
 * It deliberately reaches NOTHING ELSE. Not the lip-sync engine, expression
 * system, Active Presence, lighting profile, skin profile, hair pipeline,
 * camera, transform, morph mapping or rig binding: both assets run the same
 * current Hyper3D system, and the fallback exists to change the asset, not the
 * system.
 *
 * A non-Hyper3D config, or the DEV FBX rollback, is returned untouched.
 */
export const hyper3dConfigForAsset = (config: AvatarModelConfig, assetId: Hyper3dAssetId): AvatarModelConfig => {
  if (config.id !== "hyper3d-usc" || useLegacyHyper3dFbx) return config;
  const url = HYPER3D_ASSET_URLS[assetId];
  const restCorrection = HYPER3D_EYE_REST_CORRECTIONS[assetId];
  if (config.url === url && config.eyeBoneGaze?.restCorrection === restCorrection) return config;
  return {
    ...config,
    url,
    label: assetId === HYPER3D_LEGACY_ASSET_ID ? "Hyper3D (female_229 legacy)" : config.label,
    eyeBoneGaze: config.eyeBoneGaze ? { ...config.eyeBoneGaze, restCorrection } : config.eyeBoneGaze
  };
};
export const avatarModelOptions = Object.values(avatarModelConfigs).map(({ id, label }) => ({ id, label }));

export const resolveMorphBindings = (config: AvatarModelConfig, canonicalName: string) => {
  if (Object.prototype.hasOwnProperty.call(config.morphMapping, canonicalName)) return config.morphMapping[canonicalName];
  return [{ target: canonicalName }];
};