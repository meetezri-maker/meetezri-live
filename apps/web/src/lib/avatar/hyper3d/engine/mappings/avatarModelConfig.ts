import { EXPECTED_MINIFACE_BLENDSHAPES } from "./avatarBlendshapeConfig";
import type { SpeakingHeadMotionMode } from "../engine/animation/SpeakingHeadMotionController";
import {
  HYPER3D_2291_EYE_REST_CORRECTION,
  HYPER3D_AFR_EYE_REST_CORRECTION,
  HYPER3D_FBX_RIG,
  HYPER3D_GLB_EYE_REST_CORRECTION,
  HYPER3D_BIANCA_EYE_REST_CORRECTION,
  HYPER3D_DAMIAN_EYE_REST_CORRECTION,
  HYPER3D_FRANKIE_EYE_REST_CORRECTION,
  HYPER3D_GLB_RIG,
  HYPER3D_SASHA_EYE_REST_CORRECTION,
  HYPER3D_JORDAN_EYE_REST_CORRECTION,
  HYPER3D_PERM_EYE_REST_CORRECTION,
  HYPER3D_SARA_EYE_REST_CORRECTION,
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
import {
  HYPER3D_EYELASH_MESH_NAME,
  withHyper3dEyelashBindings
} from "./avatars/hyper3dEyelashBinding";

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
  hyper3dMaterials?: {
    mode: "fbx" | "glb";
    textureBaseUrl: string;
    /**
     * WHERE THIS ASSET'S FACE BASE COLOUR COMES FROM.
     *
     * `usc-shared` (the default, and what female_229 / female_2291 / afr need):
     * the face material's `map` is replaced at load with the USC package's
     * corrected albedo, `texture_diffuse_evened.png`. That is the whole point of
     * the correction for those assets — their authored face map IS the USC
     * `texture_diffuse`, and the evened file is the fixed version of it.
     *
     * `authored`: the GLB's own face map is left alone. Required by every asset
     * that is a DIFFERENT PERSON, because the swap is keyed on the material name
     * stem `M_Face` and has no idea whose face it is overwriting. On `jordan.glb`
     * both head materials are named `M_Face.*` — the bearded face AND the
     * short-hair scalp — so the shared albedo erased his beard and his hair and
     * rendered him bald and clean-shaven. See the note on `faceMaps` in
     * `HYPER3D_ASSET_ADAPTERS`.
     *
     * It gates the MAP only. Roughness, metalness and normalScale still come
     * from the shared face look on every asset, so the skin still renders
     * through the accepted pipeline — only the identity texture is preserved.
     */
    faceMaps?: "usc-shared" | "authored";
    /**
     * WHETHER THE SHARED HAIR PASSES MAY TOUCH THIS ASSET'S HAIR.
     *
     * `shared-tuning` (the default, and every asset before 2026-10-23): the
     * appearance pass applies female_2291's accepted hair correction to any
     * material named `Material.005` — base colour, metalness, roughness and
     * envMapIntensity in `applyMaterialTuning`, sorted blending in
     * `applyHairAlpha`, and the `hair_o_dense` map swap in `applyHairMap`.
     *
     * `authored`: none of those three passes runs, and the hair keeps exactly
     * what the GLB authored. Needed by `sasha.glb`, whose hair material happens
     * to share the name `Material.005` and whose approved look is the designer's
     * black hair — the shared passes turn it dark brown and swap its texture.
     */
    hairAppearance?: "shared-tuning" | "authored";
  };
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
  female_229: HYPER3D_GLB_EYE_REST_CORRECTION,
  /**
   * THE SAME OBJECT AS `female_2291`, BY REFERENCE AND NOT BY COPY.
   *
   * The Stage 2 experimental asset is `female_2291.glb` with one appended mouth
   * morph; `verifyCorrectiveMorph.mjs` proves its eye meshes, skin and every
   * original accessor are byte-identical. So it needs the identical eye-rest
   * pre-rotation, and sharing the reference is what guarantees that: a future
   * retune of the production constant cannot leave the experiment behind on a
   * stale copy, which is exactly how an asset A/B acquires a second difference
   * nobody intended.
   */
  female_2291_lowerlip_v2: HYPER3D_2291_EYE_REST_CORRECTION,
  /**
   * The four per-companion assets. Each is solved onto female_2291's accepted
   * neutral by one identical measure — a transfer, not a retune. See the block
   * above `HYPER3D_AFR_EYE_REST_CORRECTION` in `hyper3dRigAdapter`.
   */
  hyper3d_afr: HYPER3D_AFR_EYE_REST_CORRECTION,
  /**
   * TRIAL ASSET `arfv2.glb` — THE SAME OBJECT AS `hyper3d_afr`, BY REFERENCE.
   *
   * MEASURED against the shipped `afr.glb`: the `Eyes` mesh (`Face.003`, 772
   * vertices) carries the same indices and the same UVs, and its POSITION
   * buffer differs by at most 3.6e-7 model units — float noise from the
   * re-export, not a re-aim. Both `Eyeball_*` morph deltas agree to 1.2e-7.
   * So this asset's authored eye rest IS afr's, and it takes afr's correction
   * unchanged; sharing the reference is what stops the two drifting apart.
   */
  hyper3d_arfv2: HYPER3D_AFR_EYE_REST_CORRECTION,
  /**
   * ROMY'S BACKUP — A VALUE COPY, NOT A SHARED REFERENCE. THAT IS THE POINT.
   *
   * `female_2291_lowerlip_v2` above shares its correction BY REFERENCE so a
   * retune cannot leave the experiment behind. Here the requirement is the
   * exact opposite: the backup is a frozen snapshot of a different file, and
   * retuning the primary must NOT silently retune it. So the numbers are
   * written out, and they describe `romy-fallback.glb` alone.
   *
   * The values equal afr's today because the backup is currently a byte copy
   * of the same export, measured the same way: `Eyes` POSITION within 3.6e-7
   * of afr's, same indices, same UVs.
   */
  hyper3d_romy_backup: {
    authored: { left: [0, -1, 0, 0], right: [0, -1, 0, 0] },
    left: [-0.013448521, -0.001946699, -0.057415431, 0.99825789],
    right: [-0.023373826, 0.00078643, 0.035701211, 0.99908882],
  },
  hyper3d_sara: HYPER3D_SARA_EYE_REST_CORRECTION,
  /**
   * Frankie's backup snapshot since 2026-10-23. Unchanged: still measured
   * against `perm.glb`, which is unchanged.
   */
  hyper3d_perm: HYPER3D_PERM_EYE_REST_CORRECTION,
  /**
   * `frankie.glb` — SOLVED FOR THIS FILE. Deliberately not perm's constant:
   * the eyeballs were re-aimed in this export, and perm's correction would
   * leave Frankie about seven degrees off neutral.
   */
  hyper3d_frankie: HYPER3D_FRANKIE_EYE_REST_CORRECTION,
  hyper3d_jordan: HYPER3D_JORDAN_EYE_REST_CORRECTION,
  /**
   * The 2026-10-23 companions, each solved for its own file on the eyeball's
   * own aim — see the block above `HYPER3D_BIANCA_EYE_REST_CORRECTION`. Damian
   * deliberately does NOT share perm's constant despite identical eye geometry.
   */
  hyper3d_bianca: HYPER3D_BIANCA_EYE_REST_CORRECTION,
  hyper3d_damian: HYPER3D_DAMIAN_EYE_REST_CORRECTION,
  hyper3d_sasha: HYPER3D_SASHA_EYE_REST_CORRECTION
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
          eyelashes: [HYPER3D_EYELASH_MESH_NAME],
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
     *
     * `Object_2002`, THE EYELASHES, added 2026-09-24 with the re-exported asset
     * and for exactly the reason above. MEASURED on the new GLB: the lash node
     * carries no `JOINTS_0`/`WEIGHTS_0`, references no skin, and sits at the
     * scene ROOT with no parent at all. It is the hair problem again — morphing
     * the lashes would deform them correctly while the head turned out from
     * under them, leaving the lashes hanging in space. It is unskinned, so
     * `attachHeadMeshes` accepts it rather than refusing it the way it refuses
     * `Eyes` and `Teeth`; `attach()` preserves the world transform, and the lash
     * AABB already sits on the eyes at rest (world X -0.041..+0.041,
     * Y 1.355..1.382 against the eyeball mesh's X -0.036..+0.036,
     * Y 1.357..1.379), so the rest pose does not move.
     */
    headAttachedMeshes: useLegacyHyper3dFbx
      ? []
      : ["blendshapes", "Teeth", "Character002", "Character002_1", HYPER3D_EYELASH_MESH_NAME],
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
     *
     * The 2026-09-24 re-export adds FOURTEEN more bindings of that same shape,
     * for the same reason: `withHyper3dEyelashBindings` gives each of the eye
     * blink / look / squint / wide channels a second target on the new
     * `Object_2002` lash mesh. The lashes are a follower — they receive the
     * final composed influence the eyelid receives, so they inherit the blink
     * trajectory, the resting lid closure and the gaze rails instead of
     * restating any of them. See `hyper3dEyelashBinding` for why this is a
     * mapping rather than an adapter, and for the four target names the asset
     * misspells.
     */
    morphMapping: useLegacyHyper3dFbx
      ? identityMorphMapping
      : withHyper3dEyelashBindings({
          ...identityMorphMapping,
          jawOpen: [{ target: "jawOpen" }, { target: "JawOpen" }]
        }),
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
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT A PER-COMPANION ASSET IS ALLOWED TO CHANGE.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * EVERY FIELD HERE IS A PROPERTY OF THE FILE, NOT A TUNING CHOICE. The lip-sync
 * engine, coarticulation, phoneme mapping, Active Presence, idle behaviour,
 * blink, gaze policy, emotion, head/neck motion, the speaking presets, the
 * CAMERA and the LIGHTING are shared and are not reachable from this table.
 * Four avatars run one runtime; this says only where each one's meshes are and
 * how big it was authored.
 *
 * The four entries below are measured, not fitted:
 *
 *   `scale`     0.01 / the asset's own face-node authoring scale — the SAME
 *               derivation as the shipped 1.266446, so every morph target
 *               displaces the same number of world metres it displaces today.
 *   `position`  solved so the EYE LINE lands on the accepted anchor
 *               (0, 1.48604, 0.05960) that the shipped transform puts it on.
 *               Derived from scale, never fitted; the camera does not move.
 *   `meshNames.face`
 *               `sara`, `perm` and `jordan` export the head as TWO primitives
 *               (face 9,409 v + back-head 2,905 v), which three.js r183 wraps in
 *               a GROUP named `blendshapes` with children `blendshapes_1` and
 *               `blendshapes_2`. `findMeshByName` requires a Mesh, so the
 *               children are named here. Both carry all 51 targets and
 *               `MorphTargetController.discover` buckets by target NAME across
 *               every mesh, so both animate with no extra morph bindings —
 *               verified against the real loader.
 *   `meshNames.hair`
 *               `perm` and `jordan` ship NO hair mesh. Empty, and the hair gate
 *               is skipped for them rather than relaxed for everyone.
 *   `meshNames.eyelashes`
 *               all four renamed the lash node from `Object_2.002` to `Lashes`.
 *               Diagnostics only — the 14 lash targets bind by name and already
 *               resolve — but a report that says "not found" about a mesh that
 *               is present is a report nobody will trust twice.
 *   `headAttachedMeshes`
 *               the same list, per asset. `attachHeadMeshes` uses
 *               `getObjectByName`, so the `blendshapes` GROUP attaches in one
 *               go and carries both primitives.
 *   `hiddenMeshNames`
 *               only `female_2291` and `sara` carry the 9-vertex `Face002_4`
 *               teeth-pivot stub; the others' body exports have 4 primitives
 *               and no stub to hide.
 */
type Hyper3dAssetAdapter = {
  label: string;
  scale?: [number, number, number];
  position?: [number, number, number];
  face?: string[];
  hair?: string[];
  eyelashes?: string[];
  headAttachedMeshes?: string[];
  hiddenMeshNames?: string[];
  /** See `AvatarModelConfig.hyper3dMaterials.faceMaps`. */
  faceMaps?: "usc-shared" | "authored";
  /** See `AvatarModelConfig.hyper3dMaterials.hairAppearance`. */
  hairAppearance?: "shared-tuning" | "authored";
};

const HYPER3D_ASSET_ADAPTERS: Readonly<Partial<Record<Hyper3dAssetId, Hyper3dAssetAdapter>>> = {
  /**
   * `afr.glb`, shown as Sara Mitchell — the designer's updated `female_2291`
   * with corrected hair and outfit. MEASURED: identical face authoring scale
   * (0.00789611042), identical jawOpen / mouthClose / mouthFunnel / mouthPucker
   * / mouthSmileLeft / eyeBlinkLeft delta magnitudes to four decimals, identical
   * single-primitive head, identical hair mesh names. So it inherits the shipped
   * transform exactly and overrides only the renamed lash node.
   */
  hyper3d_afr: {
    label: "Hyper3D (afr — Sara Mitchell)",
    eyelashes: ["Lashes"],
    headAttachedMeshes: ["blendshapes", "Teeth", "Character002", "Character002_1", "Lashes"],
    hiddenMeshNames: [],
    /**
     * SHARED, and this is the one asset of the four for which that is right:
     * afr is the designer's updated female_2291, its authored face map IS the
     * USC `texture_diffuse`, and `texture_diffuse_evened.png` is the accepted
     * correction of that same texture.
     */
    faceMaps: "usc-shared"
  },
  /**
   * `arfv2.glb` — the designer re-export shown as Sara Mitchell / Romy.
   *
   * MEASURED against the shipped `afr.glb`, through the real GLTFLoader, on the
   * 19 Oct export (43,260,712 bytes, exporter Blender I/O v5.0.21):
   *
   *   same   875-joint `Skel`, every joint name, every scene-root node name,
   *          `blendshapes` POSITION byte-identical with all 51 morph targets
   *          byte-identical, `Lashes` byte-identical with all 14 targets,
   *          `Eyes` and `Teeth` to within 5e-7, the outfit byte-identical,
   *          and the `blendshapes` authoring scale 0.00789611 — so it inherits
   *          the shipped transform, the morph bindings and afr's eye-rest.
   *   differs the face mesh — 13,637 vertices against 11,517, with a
   *          re-authored face texture — and re-sculpted lashes. The hair mesh,
   *          `Eyes`, `Teeth` and the outfit are byte-identical to afr's.
   *
   * THE HAIR NAMES BELOW ARE A COMPATIBILITY LIST, NOT THE LOOKUP. Successive
   * exports of this character have named the hair mesh `Character.002`, then
   * `Character.001`, then `Character.002` again — Blender datablock suffixes,
   * carrying no meaning. Each flip broke the `material-setup` gate and head
   * attachment in one stroke and dropped Romy onto the legacy avatar.
   * `resolveHyper3dHairMeshes` now finds the hair under the stable `Hair` node
   * and these names are only the fallback, so the next re-export cannot repeat
   * it. They record what the CURRENT file holds, verified with the real loader.
   *
   * RE-DELIVERED 2026-10-27 (44,039,044 bytes, sha256 2295edec…, Blender I/O
   * v5.2.40): inside-nose colour corrected and a new hairstyle. MEASURED with
   * the real GLTFLoader and engine factory:
   *
   *   face   the head mesh is now `blendshapes.001` with TWO primitives, so
   *          three.js names them `blendshapes001` (1,099 v, `M_Face.001`, an
   *          interior shell mapped to a dark patch) and `blendshapes001_1`
   *          (10,415 v, `M_Face.002`, the face proper — listed first). Both
   *          carry all 51 targets. The inherited single `blendshapes` no longer
   *          exists, and with it the binding gate threw "face mesh did not
   *          resolve" and Romy fell to her backup.
   *   hair   a new style under the same `Hair` node, `Character.001` ->
   *          `Character001` (`Material.003` cap) and `Character001_1` (57,180 v
   *          on a material named `Hair`). No shared hair pass targets either
   *          name (they match `Material.005`), so the designer's colour, alpha
   *          and texture reach the screen as authored.
   *   same   `Eyes` and `Teeth` within 1.1e-6 of the 19 Oct file (same UVs,
   *          joints, weights), the authoring scale, the skeleton within float
   *          noise — so the inherited transform and afr's eye-rest still hold
   *          (re-measured: 0.002 / 0.003 deg off the accepted neutral).
   *
   * `faceMaps: "authored"` — CHANGED from afr's `usc-shared` for THIS FILE ONLY.
   * The designer's nostril fix lives in this asset's face map; the shared swap
   * replaced it with the USC albedo, whose nostril interior renders pale in the
   * production pipeline, and also discarded the dark scalp painted under the
   * new hair. Romy's frozen backup keeps `usc-shared`.
   */
  hyper3d_arfv2: {
    label: "Hyper3D (arfv2 — Sara Mitchell)",
    face: ["blendshapes001_1", "blendshapes001"],
    eyelashes: ["Lashes"],
    hair: ["Character001", "Character001_1"],
    headAttachedMeshes: ["blendshapes", "Teeth", "Character001", "Character001_1", "Lashes"],
    hiddenMeshNames: [],
    faceMaps: "authored"
  },
  /**
   * `romy-fallback.glb` — ROMY'S FROZEN BACKUP SNAPSHOT.
   *
   * Reached only after `hyper3d_arfv2` has failed, via `HYPER3D_ASSET_BACKUPS`.
   * Same companion, same canonical id, same voice and persona — only the file
   * differs, which is what makes a second attempt identity-safe here.
   *
   * EVERY FIELD IS A VALUE COPY. Nothing is spread from the `hyper3d_arfv2`
   * entry and nothing is computed from it, so a future primary re-export and
   * any adapter change it needs cannot reach this entry. When the backup is
   * deliberately refreshed, re-verify these names against the new file: the
   * hair spelling is exactly what has flipped between exports before.
   *
   * VERIFIED against the file on disk with the real GLTFLoader: 875-joint
   * `Skel`, `blendshapes` carrying the 51 ARKit targets, `Eyes` and `Teeth`
   * skinned, `Lashes` with 14 targets, and the hair under the `Hair` node as
   * `Character002` / `Character002_1`. `resolveHyper3dHairMeshes` finds the
   * hair structurally, so these two arrays are the compatibility fallback
   * rather than the lookup — the same arrangement as the primary.
   */
  hyper3d_romy_backup: {
    label: "Hyper3D (romy-fallback — Sara Mitchell, backup snapshot)",
    eyelashes: ["Lashes"],
    hair: ["Character002", "Character002_1"],
    headAttachedMeshes: ["blendshapes", "Teeth", "Character002", "Character002_1", "Lashes"],
    hiddenMeshNames: [],
    faceMaps: "usc-shared"
  },
  /** `sara.glb`, shown as Maya Chen. Split head, own authoring scale, has hair. */
  hyper3d_sara: {
    label: "Hyper3D (sara — Maya Chen)",
    scale: [1.275206, 1.275206, 1.275206],
    position: [0, -0.25805, -0.05324],
    face: ["blendshapes_1", "blendshapes_2"],
    eyelashes: ["Lashes"],
    headAttachedMeshes: ["blendshapes", "Teeth", "Character002", "Character002_1", "Lashes"],
    // Her own face is "Photorealistic Female Face UV Texture Atlas".
    faceMaps: "authored"
  },
  /**
   * `perm.glb`, shown as Alex. Split head, no body stub.
   *
   * HAIR ARRIVED IN A RE-DELIVERY on 2026-10-14 (46.08 MB -> 63.87 MB). The
   * earlier cut was bald and this entry declared no hair; the current file adds
   * `Object_7`, a 322,688-vertex sculpt on `GoZMesh_Import_Material` — the
   * permed style the filename always implied. Measured against the new file:
   * the head, face, eye and teeth geometry are UNCHANGED (same vertex counts,
   * same authoring scale 0.00851077400), so the transform and the eye-rest
   * correction below still hold; only the hair is new.
   *
   * It is listed in `headAttachedMeshes` because it is UNSKINNED, and unskinned
   * hair that is not reparented onto the head bone is the "head turns inside a
   * stationary wig" defect `attachHeadMeshes` exists to prevent.
   *
   * SIZE NOTE, reported not acted on: 322,688 vertices is roughly seventeen
   * times the rest of this asset put together. It is the reason the file grew
   * 17.8 MB, and it is the first thing to look at if Alex is slow on a phone.
   */
  hyper3d_perm: {
    label: "Hyper3D (perm — Alex)",
    scale: [1.174981, 1.174981, 1.174981],
    position: [0, -0.12097, -0.04438],
    face: ["blendshapes_1", "blendshapes_2"],
    hair: ["Object_7"],
    eyelashes: ["Lashes"],
    headAttachedMeshes: ["blendshapes", "Teeth", "Lashes", "Object_7"],
    hiddenMeshNames: [],
    // His own face is "Photorealistic Male Face Texture Map".
    faceMaps: "authored"
  },
  /**
   * `frankie.glb`, shown as Frankie — his current export, with `hyper3d_perm`
   * above as its backup. EVERY FIELD IS WRITTEN OUT; nothing is inherited from
   * perm, because perm must stay exactly as verified to serve as the backup.
   *
   * MEASURED through the real GLTFLoader and the real engine factory:
   *
   *   face   the head mesh is named `blendshapes.001` in this export, so
   *          three.js names its two primitives `blendshapes001` (9,251 v,
   *          `M_Face.003`) and `blendshapes001_1` (2,053 v, `M_BackHead.003`)
   *          under the `blendshapes` group. Perm's `blendshapes_1/_2` do not
   *          exist here — with them the binding gate throws "face mesh did not
   *          resolve" and Frankie would leave Hyper3D entirely.
   *   scale  0.01 / 0.00859828573, this file's own face-node authoring scale.
   *   position  solved so the eye-bone pivot midpoint lands on the accepted
   *          anchor (0, 1.48604, 0.05960); the same solve reproduces perm's
   *          shipped position to 1e-5.
   *   hair   `Object_7`, byte-identical to perm's sculpt (322,688 v,
   *          `GoZMesh_Import_Material`), UNSKINNED and not under a `Hair`
   *          node, so it resolves by this name and must be head-attached.
   *   morphs all 51 face targets on both primitives, `Teeth.JawOpen`, and 14
   *          lash targets on `Lashes` — identical names to perm.
   *
   * `faceMaps: "authored"`: his face is "Realistic Male Face UV Texture Map".
   * The shared USC albedo would replace it with the female_2291 face.
   */
  hyper3d_frankie: {
    label: "Hyper3D (frankie — Frankie)",
    scale: [1.163023, 1.163023, 1.163023],
    position: [0, -0.10462, -0.04332],
    face: ["blendshapes001", "blendshapes001_1"],
    hair: ["Object_7"],
    eyelashes: ["Lashes"],
    headAttachedMeshes: ["blendshapes", "Teeth", "Lashes", "Object_7"],
    hiddenMeshNames: [],
    faceMaps: "authored"
  },
  /**
   * `jordan.glb`, shown as Jordan Taylor. Split head, no separate hair mesh, no
   * stub — his short hair and beard live in the HEAD TEXTURES, which is exactly
   * why the shared face albedo erased both and rendered him bald and
   * clean-shaven. He names BOTH head materials `M_Face.*` (`.001` the bearded
   * face, `.002` the scalp), and the swap matches on the stem, so it took both.
   */
  hyper3d_jordan: {
    label: "Hyper3D (jordan — Jordan Taylor)",
    scale: [1.182122, 1.182122, 1.182122],
    position: [0, -0.13074, -0.04501],
    face: ["blendshapes_1", "blendshapes_2"],
    hair: [],
    eyelashes: ["Lashes"],
    headAttachedMeshes: ["blendshapes", "Teeth", "Lashes"],
    hiddenMeshNames: [],
    // His beard, eyebrows and short hair are in "Photorealistic Bearded Face
    // UV Texture Map" and the scalp map beside it. Both must survive.
    faceMaps: "authored"
  },
  /**
   * ─────────────────────────────────────────────────────────────────────────
   * BIANCA, DAMIAN, SASHA — 2026-10-23. EVERY FIELD WRITTEN OUT.
   * ─────────────────────────────────────────────────────────────────────────
   *
   * Each measured through the real GLTFLoader and the real engine factory on
   * the file whose checksum `hyper3dAssetSelection` records. Common to all
   * three: the 875-joint `Skel`, all 51 face targets on BOTH head primitives,
   * `Teeth.JawOpen`, 14 lash targets on an unskinned `Lashes`, and an
   * unskinned hair mesh that IS the `Hair` node — found structurally by
   * `resolveHyper3dHairMeshes` and head-attached. `scale` is 0.01 / the face
   * node's authoring scale; `position` puts the eye-bone pivot midpoint on the
   * accepted anchor (the same solve that reproduces perm's shipped position).
   *
   * `hiddenMeshNames: []` and `faceMaps: "authored"` are explicit on all three:
   * none carries the `Face002_4` stub, and each face/scalp map is that person's
   * own. Left unset they would inherit female_2291's defaults — the shared USC
   * albedo, which replaces every one of these faces with female_2291's.
   */
  /** `bianca.glb`. Head primitives 9,251 + 2,053 v; hair 54,183 v on `Material.002`. */
  hyper3d_bianca: {
    label: "Hyper3D (bianca — Bianca)",
    scale: [1.272596, 1.272596, 1.272596],
    position: [0, -0.25448, -0.05302],
    face: ["blendshapes_1", "blendshapes_2"],
    hair: ["Hair"],
    eyelashes: ["Lashes"],
    headAttachedMeshes: ["blendshapes", "Teeth", "Lashes", "Hair"],
    hiddenMeshNames: [],
    // Her own "Surreal Flattened Face Texture Map". It ships no face normal map,
    // so under `authored` the face keeps none (the shared USC normal is not bound).
    faceMaps: "authored",
    // A no-op today: her hair material is `Material.002`, which no shared hair
    // pass targets. Stated so the decision is visible rather than inherited.
    hairAppearance: "shared-tuning"
  },
  /**
   * `damian.glb`. Head primitives, eyes, teeth, lashes and outfit are
   * byte-for-byte perm's (same names `blendshapes_1/_2`, same authoring scale
   * 0.00851077400), so the transform equals perm's. Hair is 7,920 v of cards on
   * `hair-cards.001`. BOTH head materials are `M_Face.*` (`M_Face.003` face,
   * `M_Face.001` back of head) — the Jordan pattern — so `authored` is what
   * keeps his scalp from being overwritten by a face texture.
   */
  hyper3d_damian: {
    label: "Hyper3D (damian — Damian)",
    scale: [1.174981, 1.174981, 1.174981],
    position: [0, -0.12097, -0.04438],
    face: ["blendshapes_1", "blendshapes_2"],
    hair: ["Hair"],
    eyelashes: ["Lashes"],
    headAttachedMeshes: ["blendshapes", "Teeth", "Lashes", "Hair"],
    hiddenMeshNames: [],
    faceMaps: "authored",
    // A no-op today: `hair-cards.001` is not a shared-pass target.
    hairAppearance: "shared-tuning"
  },
  /**
   * `sasha.glb`. The head mesh is named `blendshapes.001`, so its primitives
   * load as `blendshapes001` / `blendshapes001_1`. Her outfit mesh is named
   * `Face.002` (loads as `Face002`..`Face002_3`) with FOUR primitives, so the
   * female_2291 stub `Face002_4` does not exist here and nothing is hidden.
   *
   * HAIR: 1,102,572 v / 1,449,024 tri on `Material.005` with `hair_o` —
   * the exact material name the shared hair passes target.
   * `hairAppearance: "authored"` keeps the approved designer black hair: without it, the passes recolour it
   * to #241a14, drop its metalness, change its roughness and envMap, switch it
   * to sorted blending and swap its texture for `hair_o_dense.png`.
   */
  hyper3d_sasha: {
    label: "Hyper3D (sasha — Sasha)",
    scale: [1.274839, 1.274839, 1.274839],
    position: [0, -0.25755, -0.05322],
    face: ["blendshapes001", "blendshapes001_1"],
    hair: ["Hair"],
    eyelashes: ["Lashes"],
    headAttachedMeshes: ["blendshapes", "Teeth", "Lashes", "Hair"],
    hiddenMeshNames: [],
    // Her own "Hyper-Realistic Facial UV Texture Atlas".
    faceMaps: "authored",
    hairAppearance: "authored"
  }
};

/** True when this asset declares no hair mesh, so the hair gate must not run. */
export const hyper3dAssetHasHair = (config: AvatarModelConfig): boolean =>
  config.meshNames.hair.length > 0;

/**
 * Rebinds the `hyper3d-usc` config onto a SPECIFIC Hyper3D asset.
 *
 * Originally this existed because the module-level config is resolved once at
 * load while the automatic load-failure fallback has to switch assets DURING a
 * session. It is now also the one seam that turns one shared runtime into four
 * companions: the host resolves its asset at mount and the engine is built from
 * the config this returns, so nothing downstream learns there is more than one.
 *
 * INSTANCE-SPECIFIC BY CONSTRUCTION. It builds a NEW config object and never
 * writes to `avatarModelConfigs`, so two hosts, a remount, or a session that
 * switches companion cannot see each other's asset. The shared module constant
 * stays bound to `female_2291` exactly as it is today.
 *
 * It still reaches nothing behavioural. Not the lip-sync engine, expression
 * system, Active Presence, lighting profile, skin profile, hair pipeline,
 * camera, morph mapping or rig binding — only the fields in
 * `HYPER3D_ASSET_ADAPTERS`, every one of which is a property of the file.
 *
 * A non-Hyper3D config, or the DEV FBX rollback, is returned untouched.
 */
export const hyper3dConfigForAsset = (config: AvatarModelConfig, assetId: Hyper3dAssetId): AvatarModelConfig => {
  if (config.id !== "hyper3d-usc" || useLegacyHyper3dFbx) return config;
  const url = HYPER3D_ASSET_URLS[assetId];
  const restCorrection = HYPER3D_EYE_REST_CORRECTIONS[assetId];
  const adapter = HYPER3D_ASSET_ADAPTERS[assetId];
  if (!adapter && config.url === url && config.eyeBoneGaze?.restCorrection === restCorrection) return config;
  return {
    ...config,
    url,
    label:
      adapter?.label ??
      (assetId === HYPER3D_LEGACY_ASSET_ID ? "Hyper3D (female_229 legacy)" : config.label),
    scale: adapter?.scale ?? config.scale,
    position: adapter?.position ?? config.position,
    meshNames: adapter
      ? {
          ...config.meshNames,
          face: adapter.face ?? config.meshNames.face,
          hair: adapter.hair ?? config.meshNames.hair,
          eyelashes: adapter.eyelashes ?? config.meshNames.eyelashes
        }
      : config.meshNames,
    headAttachedMeshes: adapter?.headAttachedMeshes ?? config.headAttachedMeshes,
    hiddenMeshNames: adapter?.hiddenMeshNames ?? config.hiddenMeshNames,
    hyper3dMaterials:
      (adapter?.faceMaps || adapter?.hairAppearance) && config.hyper3dMaterials
        ? {
            ...config.hyper3dMaterials,
            ...(adapter.faceMaps ? { faceMaps: adapter.faceMaps } : {}),
            ...(adapter.hairAppearance ? { hairAppearance: adapter.hairAppearance } : {})
          }
        : config.hyper3dMaterials,
    eyeBoneGaze: config.eyeBoneGaze ? { ...config.eyeBoneGaze, restCorrection } : config.eyeBoneGaze
  };
};

/**
 * Whether this asset's face base colour comes from the shared USC package.
 *
 * Absent means `usc-shared`, which is what female_229, female_2291 and the DEV
 * experimental asset have always done — so the default preserves them exactly.
 */
export const hyper3dUsesSharedFaceMaps = (config: AvatarModelConfig): boolean =>
  (config.hyper3dMaterials?.faceMaps ?? "usc-shared") === "usc-shared";

/**
 * Whether this asset's hair must stay exactly as the GLB authored it, so the
 * shared hair passes are skipped. Absent means `shared-tuning` — every asset
 * that existed before this field keeps its hair behaviour unchanged.
 */
export const hyper3dPreservesAuthoredHair = (config: AvatarModelConfig): boolean =>
  config.hyper3dMaterials?.hairAppearance === "authored";
export const avatarModelOptions = Object.values(avatarModelConfigs).map(({ id, label }) => ({ id, label }));

export const resolveMorphBindings = (config: AvatarModelConfig, canonicalName: string) => {
  if (Object.prototype.hasOwnProperty.call(config.morphMapping, canonicalName)) return config.morphMapping[canonicalName];
  return [{ target: canonicalName }];
};