import type { MorphTargetBinding } from "../avatarModelConfig";

/**
 * EYELASHES — a FOLLOWER of the accepted eye system, never a second one.
 *
 * `female_2291.glb` was re-exported on 2026-09-24 carrying one new mesh of
 * eyelash geometry with fourteen morph targets of its own. This file is the
 * whole integration: a name table and a binding table. There is no lash
 * controller, no lash scheduler and no lash resolver, and that is deliberate.
 *
 * WHY A MAPPING AND NOT AN ADAPTER. `MorphTargetController.write` is already the
 * single writer to every morph influence in the scene, and it already drives a
 * second mesh from one semantic channel: `jawOpen` writes both the face's
 * `jawOpen` and the separate `Teeth` mesh's `JawOpen`. Eyelashes are that exact
 * shape of problem — one semantic channel, two meshes — so they take that exact
 * shape of solution. Every alternative loses something:
 *
 *   a lash adapter writing influences directly  -> clobbered, see OWNERSHIP
 *   a lash copy of the gaze/blink planner       -> a second source of truth
 *   a per-frame "read eye state, write lashes"  -> a frame of lag, and a
 *                                                  traversal we do not need
 *
 * Binding through `morphMapping` means the lash target receives EXACTLY the
 * influence the eyelid target receives, computed by the accepted resolver, in
 * the same frame, after the same composition. Blink dominance at full closure,
 * the 0.17 resting lid, the +-2.8 degree speaking yaw rails, the 52/18/105
 * blink trajectory and the irregular scheduler are all inherited rather than
 * re-derived, because the lashes never see any of them — they only ever see the
 * one number the lid got.
 *
 * OWNERSHIP, and why nothing else can own this. `MorphTargetController.write`
 * ends by looping over EVERY target it discovered and assigning
 * `resolved.get(name) ?? 0`. A lash target it has discovered but that no pose
 * channel maps to is therefore actively written to zero on every frame. Any
 * separate writer would be overwritten within one frame, whatever order it ran
 * in. Routing through the mapping is not merely the tidiest option, it is the
 * only one that survives.
 *
 * ANATOMICAL SIDES ARE INHERITED, NOT RESTATED. `hyper3dGazePose` writes
 * `eyeLookOutLeft` + `eyeLookInRight` for a gaze to the character's LEFT, and
 * `eyeLookInLeft` + `eyeLookOutRight` for a gaze to the RIGHT (see
 * `Hyper3dEyeBoneGaze`, which inverts exactly those pairs). Because each
 * canonical channel here binds to the lash target of the SAME eye and the SAME
 * direction, the horizontal asymmetry the brief calls out comes out right
 * without this file knowing the sign convention at all. Confirmed against the
 * asset: the "Left" lash morphs move vertices centred at world X +0.027, the
 * same side as `FACIAL_L_EyeParallel` at X +0.025, and the "Right" ones at
 * X -0.027 against `FACIAL_R_EyeParallel` at X -0.025. No side is swapped.
 */

/**
 * The lash mesh as THREE names it, NOT as the GLB spells it.
 *
 * The glTF node is `Object_2.002` and its mesh is `Object_0.002`. GLTFLoader
 * runs `PropertyBinding.sanitizeNodeName`, which strips `.`, and a
 * single-primitive node takes the NODE's name — so the object that reaches the
 * scene graph is `Object_2002`, which is also the name the designer's inspector
 * screenshot showed. Looking up `Object_0.002` or `Object_2.002` finds nothing.
 */
export const HYPER3D_EYELASH_MESH_NAME = "Object_2002";

/**
 * Canonical eye channel -> the lash target it drives, verbatim from the asset.
 *
 * FOUR OF THESE NAMES ARE MISSPELLED IN THE GLB. The designer authored
 * `...LahesLeft` / `...LahesRight` on both LookDown targets and both LookIn
 * targets, while the other ten spell `Lashes` correctly. The spellings below
 * are the asset's, copied from `morphTargetDictionary`, because a morph target
 * is addressed by the string the exporter wrote and nothing at runtime
 * normalises it. `hyper3dEyelashBinding.test` pins all fourteen against the
 * shipped GLB, so if a future re-export fixes the typos that test fails loudly
 * instead of the lashes silently going still.
 *
 * Correcting them belongs in the asset, not here.
 */
export const HYPER3D_EYELASH_TARGETS: Readonly<Record<string, string>> = {
  eyeBlinkLeft: "eyeBlinkLashesLeft",
  eyeBlinkRight: "eyeBlinkLashesRight",
  eyeLookDownLeft: "eyeLookDownLahesLeft",
  eyeLookDownRight: "eyeLookDownLahesRight",
  eyeLookInLeft: "eyeLookInLahesLeft",
  eyeLookInRight: "eyeLookInLahesRight",
  eyeLookOutLeft: "eyeLookOutLashesLeft",
  eyeLookOutRight: "eyeLookOutLashesRight",
  eyeLookUpLeft: "eyeLookUpLashesLeft",
  eyeLookUpRight: "eyeLookUpLashesRight",
  eyeSquintLeft: "eyeSquintLashesLeft",
  eyeSquintRight: "eyeSquintLashesRight",
  eyeWideLeft: "eyeWideLashesLeft",
  eyeWideRight: "eyeWideLashesRight"
};

/** The fourteen lash target names, for diagnostics and tests. */
export const HYPER3D_EYELASH_TARGET_NAMES: readonly string[] = Object.values(HYPER3D_EYELASH_TARGETS);

/** The canonical channels that gain a second binding. */
export const HYPER3D_EYELASH_SOURCE_CHANNELS: readonly string[] = Object.keys(HYPER3D_EYELASH_TARGETS);

/**
 * Adds the lash binding to each eye channel, keeping the channel's own target.
 *
 * WEIGHT 1 ON BOTH, which is the whole of the calibration decision for now and
 * is the brief's stated starting point (`lashBlink = eyeBlink`). The resting lid
 * closure needs no special case under this mapping: the lash target receives the
 * FINAL `eyeBlinkLeft/Right` the lid receives, 0.17 included, so the lashes rest
 * against a lid that is already 17% closed rather than closing a second time.
 *
 * If visual review finds a target that overshoots or undershoots its lid, the
 * fix is a `weight` on THAT ONE binding here — a bounded per-target multiplier,
 * still driven by the same evaluated channel. It is not a new curve, and it is
 * not a change to the accepted eye behaviour.
 */
export const withHyper3dEyelashBindings = (
  base: Record<string, MorphTargetBinding[]>
): Record<string, MorphTargetBinding[]> => {
  const mapping: Record<string, MorphTargetBinding[]> = { ...base };
  for (const [channel, lashTarget] of Object.entries(HYPER3D_EYELASH_TARGETS)) {
    const existing = mapping[channel] ?? [{ target: channel }];
    if (existing.some((binding) => binding.target === lashTarget)) continue;
    mapping[channel] = [...existing, { target: lashTarget }];
  }
  return mapping;
};
