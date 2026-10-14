/**
 * HYPER3D RIG ADAPTER — the one place that knows a rig's node names.
 *
 * MIGRATION, NOT TUNING. The Hyper3D performance system (speech, expression,
 * speaking head, Active Presence, gaze, blink) was measured and accepted against
 * `USCBasicPack/additional_body.fbx`. `female_229.glb` carries the SAME Hyper3D
 * face — its 51 morph targets are byte-identical in local units, see
 * `docs/HYPER3D_GLB_MIGRATION.md` — on a different skeleton, so every semantic
 * decision the engine makes stays valid and only the node it lands on changes.
 *
 * Everything above this module keeps asking for `head`, `neck` and `scapula`.
 * This is the only file that answers, which is why there is no
 * `if (isGlb)` anywhere in the animation engine.
 *
 * ---------------------------------------------------------------------------
 * MEASURED BONE MAP (rest pose, world metres after each asset's own transform)
 *
 *   semantic       FBX (additional_body.fbx)      GLB (female_229.glb)
 *   head           with_rigged_body_Head_M        head
 *   neckPrimary    with_rigged_body_Neck_M        neck_02
 *   neckSecondary  -                              neck_01
 *   leftScapula    with_rigged_body_Scapula_L     clavicle_scap_l
 *   rightScapula   with_rigged_body_Scapula_R     clavicle_scap_r
 *   leftEye        with_rigged_body_Eye_L         FACIAL_L_EyeParallel
 *   rightEye       with_rigged_body_Eye_R         FACIAL_R_EyeParallel
 *   jaw            with_rigged_body_Jaw_M         (the GLB's own jaw bone)
 *
 * The jaw pair is recorded here in prose and NOWHERE in code, deliberately: the
 * accepted runtime opens the jaw with the `jawOpen` morph on both assets, and
 * `lowerFacePrototype.test.ts` guards structurally that no file outside the
 * lower-face controller and its mappings so much as names a lower-face bone.
 *
 * `neck_02` rather than `neck_01`: the GLB splits the neck the FBX keeps whole,
 * and `neck_02` is the closer of the two to `Neck_M` in BOTH measures that
 * matter to the motion — the rotation arm from the neck joint to the head bone
 * (FBX 0.0745 m; neck_02 0.0569 m, neck_01 0.1118 m after the asset transform)
 * and its height fraction up the chest-to-head span (FBX 0.709; neck_02 0.790,
 * neck_01 0.588). The residual -24% of head displacement per degree of neck
 * rotation is rig geometry, is REPORTED rather than compensated, and no neck
 * value is touched to hide it.
 *
 * ---------------------------------------------------------------------------
 * AXIS SIGN — the one correction this adapter applies.
 *
 * `hyper3dHeadNeckCalibration` records that the FBX needed "no axis remap and no
 * sign flip". Measured world direction of each bone's local axes at rest:
 *
 *   FBX Head_M   +X -> ( 1.000,  0.001, -0.001)   +Y -> (-0.001, 0.999, 0.041)   +Z -> ( 0.001, -0.041,  0.999)
 *   FBX Neck_M   +X -> ( 1.000,  0.000,  0.000)   +Y -> ( 0.000, 0.975, 0.221)   +Z -> ( 0.000, -0.221,  0.975)
 *   GLB head     +X -> (-1.000,  0.000,  0.000)   +Y -> ( 0.000, 1.000, 0.000)   +Z -> ( 0.000,  0.000, -1.000)
 *   GLB neck_02  +X -> (-1.000,  0.000,  0.000)   +Y -> ( 0.000, 0.980, 0.198)   +Z -> ( 0.000,  0.198, -0.980)
 *
 * The GLB bone frames are the FBX frames turned 180 degrees about Y: local +Y
 * still points along world +Y with the same sign, while local +X and local +Z
 * point the opposite way. A local-X rotation of theta is therefore a world-X
 * rotation of -theta, and likewise for roll.
 *
 * So the SAME requested degrees must be written as negated pitch and roll to
 * produce the SAME world motion. This is a rig convention, not an amplitude:
 * `BoneController` applies it in the final quaternion composition ONLY, after
 * smoothing and after `cached.current` is stored, so every value the engine
 * computes, smooths, reports through `appliedDegrees()` and pins in a test is
 * bit-identical between the two assets.
 */

/** The semantic bones every animation system is allowed to ask for. */
export interface Hyper3dRigBinding {
  /** Candidate node names, most preferred first. */
  head: readonly string[];
  neckPrimary: readonly string[];
  neckSecondary: readonly string[];
  leftScapula: readonly string[];
  rightScapula: readonly string[];
  leftEye: readonly string[];
  rightEye: readonly string[];
  /**
   * Sign that carries a semantic rotation onto this rig's bone-local axes.
   * `1` everywhere means the rig's axes already agree with world, which is what
   * the accepted FBX measured.
   */
  boneAxisSign: BoneAxisSign;
}

export interface BoneAxisSign {
  pitch: 1 | -1;
  yaw: 1 | -1;
  roll: 1 | -1;
}

export const IDENTITY_BONE_AXIS_SIGN: BoneAxisSign = { pitch: 1, yaw: 1, roll: 1 };

/** `USCBasicPack/additional_body.fbx` — the rig the system was accepted on. */
export const HYPER3D_FBX_RIG: Hyper3dRigBinding = {
  head: ["with_rigged_body_Head_M"],
  neckPrimary: ["with_rigged_body_Neck_M"],
  neckSecondary: [],
  leftScapula: ["with_rigged_body_Scapula_L"],
  rightScapula: ["with_rigged_body_Scapula_R"],
  leftEye: ["with_rigged_body_Eye_L"],
  rightEye: ["with_rigged_body_Eye_R"],
  boneAxisSign: IDENTITY_BONE_AXIS_SIGN
};

/** `female_229.glb` — the same Hyper3D face on the 876-bone MetaHuman-style rig. */
export const HYPER3D_GLB_RIG: Hyper3dRigBinding = {
  head: ["head"],
  /**
   * Only `neck_02` is listed. `BoneController.findBone` matches by traversal
   * order, not by list order, so naming both would silently resolve `neck_01`
   * (it comes first in the hierarchy) and quietly change the rotation arm.
   */
  neckPrimary: ["neck_02"],
  neckSecondary: ["neck_01"],
  leftScapula: ["clavicle_scap_l"],
  rightScapula: ["clavicle_scap_r"],
  leftEye: ["FACIAL_L_EyeParallel"],
  rightEye: ["FACIAL_R_EyeParallel"],
  boneAxisSign: { pitch: -1, yaw: 1, roll: -1 }
};

/**
 * SHOULDERS, stated rather than hidden.
 *
 * Both rigs name a scapula, and on NEITHER does the runtime drive one: the
 * accepted system rotates head and neck only, and `p17PerformanceDirector.test`
 * asserts the word "clavicle" appears in no motion source. On the GLB the
 * clavicles additionally carry no usable skin weight at all — every body mesh
 * (`Face002` .. `Face002_3`) is bound 1.0 to the single rigid `neutral_bone` —
 * so the names below exist for the adapter's completeness and for a future
 * measurement, not because anything writes to them.
 */
export const HYPER3D_SCAPULA_DRIVEN = false;

/**
 * NEUTRAL EYE REST — `female_229.glb` only.
 *
 * THE DEFECT, MEASURED. The GLB's eyeballs do not point forward at rest. The
 * iris is painted at the dead centre of the eye map (measured: pupil dark-blob
 * centroid at uv 0.5001 / 0.5042, saturated-iris centroid at 0.4978 / 0.4990),
 * and the mesh vertex carrying uv (0.5, 0.5) sits well off the forward axis —
 * so with gaze demand at ZERO the avatar glances sideways.
 *
 * Optical axis at rest, measured through the skeleton on the production asset
 * transform, as the direction from each eyeball's own centre to the surface
 * point holding the iris centre:
 *
 *   eye    rest yaw   rest pitch    wanted yaw   wanted pitch
 *   left    -18.026     -0.418        -2.480       -2.008
 *   right   -20.759     +0.738        +2.479       -2.019
 *
 * Both eyes are turned toward the character's right, and **by different
 * amounts** — 2.73 degrees apart in yaw and 1.16 in pitch — so one shared offset
 * would fix neither. "Wanted" is the direction from each eyeball centre to the
 * accepted review camera at (0, 1.46, 0.8): 2.479 degrees of convergence per eye
 * for this 64 mm interocular at 0.74 m, which is convergent, symmetric, and not
 * cross-eyed.
 *
 * THE CORRECTION is the minimal-arc rotation, in each bone's own local frame,
 * that carries its measured rest axis onto its wanted direction — minimal arc so
 * no roll is introduced about an axis an eyeball has no roll on. Solved
 * iteratively against a re-measurement through the real skeleton until the
 * residual fell below a thousandth of a degree (final: left 0.00094 deg of yaw
 * and -0.00004 of pitch; right -0.00005 and 0.00000).
 *
 * IT IS A REST POSE, NOT A GAZE VALUE. `Hyper3dEyeBoneGaze` composes it as
 * `rest * correction * gaze`, so it is applied ahead of the gaze rotation and
 * every gaze rail, amplitude, cap and timing in `hyper3dGazeCalibration` reaches
 * the eye unchanged. A rigid pre-rotation cannot scale what follows it.
 */
export interface Hyper3dEyeRestCorrection {
  /**
   * The asset's AUTHORED bone-local quaternion for each eye, measured once and
   * pinned here.
   *
   * Pinned rather than read off the bone at load, and that is the whole point.
   * The adapter WRITES these bones, `useLoader` caches the parsed GLB so the same
   * `Bone` objects come back on every remount, and a controller that re-derives
   * "the authored rest" by reading `bone.quaternion` will read back
   * `authored x correction` and compose a SECOND correction onto it. Measured,
   * that compounds hard: mount 1 leaves the eyes at -2.48 / +2.48 degrees, mount
   * 2 at +12.98 / +25.53, mount 3 at +27.70 / +47.13, mount 5 at +55.76 / +92.14
   * — by which point the right pupil has rotated out of the aperture entirely and
   * the socket shows pure sclera, with the two eyes 36 degrees divergent.
   *
   * A constant cannot do that. `rest = authored x correction` is the same value
   * on every mount, in any order, however many times it runs.
   *
   * Both eyes are authored identically at [0, -1, 0, 0] — a 180 degree turn about
   * Y — so the 2.73 degree difference in where they LOOK is carried by the mesh
   * and its UVs, not by the bones.
   */
  readonly authored: {
    readonly left: readonly [number, number, number, number];
    readonly right: readonly [number, number, number, number];
  };
  /** Bone-local quaternion, [x, y, z, w]. */
  readonly left: readonly [number, number, number, number];
  readonly right: readonly [number, number, number, number];
}

export const HYPER3D_GLB_EYE_REST_CORRECTION: Hyper3dEyeRestCorrection = {
  authored: { left: [0, -1, 0, 0], right: [0, -1, 0, 0] },
  // 14.664 deg, principally yaw (+14.585) with -1.526 of pitch.
  left: [-0.012773815, 0.005066315, 0.126879191, 0.991822985],
  // 22.362 deg, principally yaw (+22.206) with -2.684 of pitch.
  right: [-0.022713359, 0.005880503, 0.192485644, 0.981019266]
};

/**
 * What the correction is measured against, so a reviewer can check the premise
 * rather than the arithmetic. Degrees, world frame, at gaze demand zero.
 */
export const HYPER3D_GLB_EYE_REST_EVIDENCE = {
  raw: { left: { yaw: -18.026, pitch: -0.418 }, right: { yaw: -20.759, pitch: 0.738 } },
  centered: { left: { yaw: -2.4794, pitch: -2.0078 }, right: { yaw: 2.4792, pitch: -2.0192 } },
  reviewCamera: [0, 1.46, 0.8] as const,
  /** Total vergence at the review camera. Positive = convergent. */
  vergenceDegrees: 4.959
} as const;

/**
 * NEUTRAL EYE REST — `female_2291.glb`, the production asset.
 *
 * WHY THIS EXISTS AND IS NOT THE CONSTANT ABOVE. female_2291 fixes most of
 * female_229's authored glance IN THE MESH: measured, its eyeballs are
 * female_229's eyeballs rigidly rotated about world Y by 21.175 degrees (left)
 * and 18.110 degrees (right), with an RMS residual of 0.00001 mm — ten
 * nanometres, i.e. the eyeballs were straightened, not remodelled or re-UV'd.
 *
 * So the old correction MUST NOT be carried over. Applying it to the corrected
 * asset drives the eyes to +19.92 / +21.60 degrees — both looking about 20
 * degrees to the character's LEFT, 22.4 and 19.1 degrees off the accepted
 * neutral. That is the double compensation the migration brief forbids, and it
 * is why this is a second constant rather than an edit to the first: the legacy
 * asset still needs its own.
 *
 * Dropping the correction entirely is also wrong. female_2291's eyes rest at
 * +4.31 / -1.76 degrees of yaw — 6.07 degrees DIVERGENT — against an accepted
 * 4.96 degrees convergent.
 *
 * THE DERIVATION IS A TRANSFER, NOT A RETUNE, and that distinction is the whole
 * safety argument. The target was not re-derived from the camera or from any
 * gaze value; it was MEASURED off female_229 with the shipping correction above
 * applied, through the real skeleton. This constant is then the minimal-arc
 * bone-local pre-rotation carrying female_2291's measured rest onto that same
 * direction. Because both assets are measured by an identical procedure, any
 * systematic bias in the measure cancels, and the result is exactly "the new
 * asset's neutral eyes point where the accepted ones did".
 *
 * SOLVED AGAINST THE MEASURE THE ACCEPTED NUMBER IS WRITTEN IN, which matters
 * more than it sounds. The gate measures the UV-iris centre relative to the
 * eyeball shell's bbox centre, through three.js skinning; a structural measure
 * taken from the eye BONE pivot disagrees with it by a few tenths of a degree,
 * because female_2291's eyeballs are rotated about a pivot ~1.1 mm off the bone
 * and the shell is therefore slightly translated as well as turned. Solving
 * against the structural measure left the asset 0.42 degrees off the accepted
 * neutral; solving against the gate's own measure lands it exactly.
 *
 * Iterated against a re-measurement through the real skeleton and the real
 * `Hyper3dEyeBoneGaze` composition until the residual vanished: FINAL RESIDUAL
 * 0.0000000 degrees on both axes, both eyes, and the resulting neutral is
 * left -2.4794 / right +2.4792 with vergence 4.9586 — IDENTICAL to female_229's
 * accepted values in `HYPER3D_GLB_EYE_REST_EVIDENCE`.
 *
 * Reproduce with `node scripts/female-2291-eye-rest-solve.mjs`.
 * `scripts/female-2291-eye-rest-derivation.mjs` is the structural companion: it
 * characterises the asset loader-free, and is not the authority for this value.
 *
 * `authored` is unchanged, and that is measured too: both eye bones are still
 * authored at [0, -1, 0, 0], the bone pivots agree to 0.001 mm, and the skin
 * weights are identical. It is pinned rather than read off the bone at load for
 * the compounding reason documented on `Hyper3dEyeRestCorrection.authored`.
 *
 * IT IS A REST POSE, NOT A GAZE VALUE. `Hyper3dEyeBoneGaze` composes it as
 * `rest x correction x gaze`, ahead of the gaze rotation, so every gaze rail,
 * amplitude, cap, event frequency and timing reaches the eye unchanged.
 */
export const HYPER3D_2291_EYE_REST_CORRECTION: Hyper3dEyeRestCorrection = {
  authored: { left: [0, -1, 0, 0], right: [0, -1, 0, 0] },
  // 6.764 deg.
  left: [-0.013423055, -0.001434235, -0.05743097, 0.998258207],
  // 4.890 deg.
  right: [-0.023341462, 0.000249734, 0.035710264, 0.999089531]
};

/**
 * What the female_2291 correction is measured against, so a reviewer can check
 * the premise rather than the arithmetic. Degrees, world frame, at gaze demand
 * zero, measured as the direction from each eye bone's pivot to the pupil-ring
 * centroid.
 *
 * These are measured by the migration harness, which reads the pupil RING
 * rather than the iris-centre surface point used for the female_229 constant
 * above. The two procedures differ by a consistent fraction of a degree, which
 * is exactly why the transfer measures BOTH assets the same way instead of
 * comparing one procedure's number against the other's — `acceptedTarget` below
 * is female_229's accepted neutral as THIS procedure sees it.
 */
export const HYPER3D_2291_EYE_REST_EVIDENCE = {
  raw: { left: { yaw: 4.3119, pitch: -0.4202 }, right: { yaw: -1.7593, pitch: 0.749 } },
  centered: { left: { yaw: -2.4794, pitch: -2.0077 }, right: { yaw: 2.4792, pitch: -2.0192 } },
  /**
   * What the OLD female_229 constant produces on THIS asset. Reported so the
   * double compensation can be checked rather than taken on trust, and asserted
   * by the gate. Never applied.
   */
  doubleCompensated: { left: { yaw: 19.9228, pitch: -1.7655 }, right: { yaw: 21.6027, pitch: -1.7735 } },
  /** The rigid rotation that carries female_229's eyeballs onto female_2291's. */
  assetRotationDegrees: { left: 21.175, right: 18.11 },
  reviewCamera: [0, 1.46, 0.8] as const,
  /** Total vergence. Positive = convergent. IDENTICAL to female_229's accepted value. */
  vergenceDegrees: 4.9586
} as const;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * NEUTRAL EYE REST — the four per-companion assets, 2026-10-13.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * SAME DERIVATION AS female_2291: a TRANSFER, not a retune. The target was not
 * re-derived from the camera or from any gaze value. It is female_2291's
 * accepted neutral, measured with its shipped correction applied, through the
 * real GLTFLoader, the real skeleton and the real `Hyper3dEyeBoneGaze`
 * composition — and each constant below is the minimal-arc bone-LOCAL
 * pre-rotation carrying that asset's own measured rest onto that same
 * direction. Because every asset is measured by one identical procedure, any
 * systematic bias in the measure cancels.
 *
 * THE MEASURE is the direction from each eye bone's pivot to the PUPIL-RING
 * centroid: 97 vertices per eye, weighted 1.0 to FACIAL_L/R_Pupil, which are
 * children of the corresponding EyeParallel. Read through three.js skinning
 * with the asset's own resolved root transform applied. Yaw is positive toward
 * the character's left; the character faces world +Z.
 *
 * WHY EVERY ASSET NEEDS ITS OWN. Measured: the `Eyes` mesh carries BYTE-IDENTICAL
 * indices, UVs, joints and weights on all five assets, and a DIFFERENT POSITION
 * buffer on each — the eyeballs were re-aimed per character, exactly as
 * female_229's were when female_2291 straightened them. Uncorrected rest yaw
 * spreads from +4.14 degrees on afr to +8.22 / -7.44 with -6.4 of pitch on
 * perm. The authored bone-local quaternion is [0, -1, 0, 0] on all five, so
 * `authored` is shared and only the correction differs.
 *
 * RESIDUAL 0.0000000 degrees on both axes, both eyes, all four assets, verified
 * by re-measuring through the composed rest the runtime actually uses.
 *
 * ONE HONEST LIMIT. `scripts/female-2291-eye-rest-solve.mjs`, the harness the
 * shipped constants were solved with, is NOT PRESENT in this repository. This
 * derivation therefore reproduces the procedure rather than re-running it. It
 * reproduces the shipped female_2291 constant to within 1.6e-5 per component —
 * left [-0.013415, -0.001948, -0.057415, 0.998258] against the shipped
 * [-0.013423, -0.001434, -0.057431, 0.998258] — but its ABSOLUTE readings sit a
 * fraction of a degree from the published evidence: this measure puts
 * female_2291's corrected neutral at left -2.449 / right +1.716 against the
 * published -2.479 / +2.479. The transfer is unaffected, because target and
 * asset are read by the same instrument. What remains unverified is the
 * absolute calibration, and the way to close it is to restore the original
 * solver. See HYPER3D_COMPANION_EYE_REST_EVIDENCE.
 */
const HYPER3D_COMPANION_AUTHORED_EYE_REST = {
  left: [0, -1, 0, 0],
  right: [0, -1, 0, 0]
} as const;

/** `afr.glb` — shown as Sara Mitchell. Uncorrected rest +4.141 / -2.378 yaw. */
export const HYPER3D_AFR_EYE_REST_CORRECTION: Hyper3dEyeRestCorrection = {
  authored: HYPER3D_COMPANION_AUTHORED_EYE_REST,
  // 6.765 deg. Within 1e-4 of female_2291's, which is this measurement agreeing
  // with the designer's description of afr as the updated female_2291.
  left: [-0.013448521, -0.001946699, -0.057415431, 0.99825789],
  // 4.892 deg.
  right: [-0.023373826, 0.00078643, 0.035701211, 0.99908882]
};

/** `sara.glb` — shown as Maya Chen. Uncorrected rest +5.180 / -2.981 yaw. */
export const HYPER3D_SARA_EYE_REST_CORRECTION: Hyper3dEyeRestCorrection = {
  authored: HYPER3D_COMPANION_AUTHORED_EYE_REST,
  // 7.735 deg.
  left: [-0.011315704, -0.002434734, -0.066450334, 0.997722597],
  // 5.444 deg.
  right: [-0.024023162, 0.000985673, 0.040953026, 0.998871746]
};

/**
 * `perm.glb` — shown as Alex. The largest correction of the four, and the one
 * that most needed solving: its eyes rest at +8.215 / -7.440 of yaw AND
 * -6.415 / -5.464 of PITCH, looking down and outward. Dropping the correction
 * would leave Alex glancing at the floor at gaze demand zero.
 *
 * RE-MEASURED 2026-10-14 against the hair re-delivery (63.87 MB). The eyeball
 * geometry is unchanged in that re-export — the re-solve moved each component
 * by about 1.2e-5, under a thousandth of a degree — so this is the same
 * correction, taken from the file that is actually on disk.
 */
export const HYPER3D_PERM_EYE_REST_CORRECTION: Hyper3dEyeRestCorrection = {
  authored: HYPER3D_COMPANION_AUTHORED_EYE_REST,
  // 11.323 deg.
  left: [0.034363983, -0.00552383, -0.092306089, 0.995122199],
  // 9.639 deg.
  right: [0.027120869, 0.004119553, 0.079414313, 0.996464176]
};

/** `jordan.glb` — shown as Jordan Taylor. Uncorrected rest +5.180 / -2.981 yaw. */
export const HYPER3D_JORDAN_EYE_REST_CORRECTION: Hyper3dEyeRestCorrection = {
  authored: HYPER3D_COMPANION_AUTHORED_EYE_REST,
  // 7.735 deg.
  left: [-0.011312161, -0.002434881, -0.066450498, 0.997722626],
  // 5.444 deg.
  right: [-0.024017398, 0.000985854, 0.040953409, 0.998871869]
};

/**
 * What the four corrections were measured against, in THIS instrument's own
 * readings, so a reviewer can check the premise rather than the arithmetic.
 * Degrees, world frame, at gaze demand zero, each asset under its own resolved
 * root transform. `acceptedTarget` is female_2291 WITH its shipped correction,
 * read by this same measure — the direction every row is solved onto.
 */
export const HYPER3D_COMPANION_EYE_REST_EVIDENCE = {
  acceptedTarget: { left: { yaw: -2.4487, pitch: -2.5126 }, right: { yaw: 1.7161, pitch: -2.3835 } },
  raw: {
    hyper3d_afr: { left: { yaw: 4.1409, pitch: -0.9684 }, right: { yaw: -2.3784, pitch: 0.2957 } },
    hyper3d_sara: { left: { yaw: 5.1801, pitch: -1.2097 }, right: { yaw: -2.9809, pitch: 0.3707 } },
    hyper3d_perm: { left: { yaw: 8.2151, pitch: -6.4159 }, right: { yaw: -7.4401, pitch: -5.4658 } },
    hyper3d_jordan: { left: { yaw: 5.1801, pitch: -1.2101 }, right: { yaw: -2.981, pitch: 0.37 } }
  },
  /** Residual after the correction, every asset, both eyes, both axes. */
  residualDegrees: 0,
  /** Positive = convergent. Identical on all five assets by construction. */
  vergenceDegrees: 4.1648,
  /**
   * The published female_2291 figures this instrument does NOT reproduce
   * exactly. Recorded so the gap is visible rather than implied.
   */
  instrumentOffsetVsPublished: {
    left: { yaw: 0.0307, pitch: -0.5048 },
    right: { yaw: -0.7631, pitch: -0.3643 }
  }
} as const;
