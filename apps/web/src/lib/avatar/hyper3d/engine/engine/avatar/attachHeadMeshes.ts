import type { Bone, Object3D } from "three";

export interface HeadAttachmentResult {
  attached: string[];
  alreadyAttached: string[];
  missing: string[];
  skippedSkinned: string[];
  headBone: string | null;
}

/**
 * Reparents unskinned head-borne meshes onto the head bone.
 *
 * Female.228 carries its hair as two UNSKINNED meshes, `Character002` (the cap,
 * 1163 vertices) and `Character002_1` (the long hair, 22805 vertices), parented
 * to a `Character` group hanging directly off the Scene. They are not part of
 * the skeleton in any sense: no skin weights, no bones, no ancestor that the
 * animation touches.
 *
 * The consequence is measurable and total. Rotating the head bone 8 degrees of
 * yaw moves the skinned scalp 11.7 mm and moves the hair **0.0000 mm**; at
 * yaw+8 with pitch+6 the scalp moves 16.5 mm and the hair still moves nothing.
 * The head turns inside a stationary wig. See
 * `docs/evidence/p15-hair/hair-follow-test.json`.
 *
 * The GLB carries 38 bones with "Hair" in the name, which looks like the fix but
 * is not: every one of them drives scalp vertices of `Face002_4`, the face skin,
 * and not one vertex of either hair mesh is influenced by any bone at all.
 * Weighting the hair to them would be a re-rig of the asset, which this pass is
 * not allowed to do and does not need to do.
 *
 * `attach()` rather than `add()`: it preserves the object's world transform, so
 * the rest pose is pixel-identical and only subsequent head motion propagates.
 * Idempotent — a mesh already under the head bone is left alone, so a re-render
 * or a hot reload cannot compound the transform.
 *
 * Skinned meshes are refused outright. A skinned mesh already follows the
 * skeleton, and reparenting one would apply the head transform twice.
 */
export const attachHeadMeshes = (root: Object3D, headBone: Bone | undefined, meshNames: readonly string[]): HeadAttachmentResult => {
  const result: HeadAttachmentResult = {
    attached: [], alreadyAttached: [], missing: [], skippedSkinned: [], headBone: headBone?.name ?? null
  };
  if (!headBone || !meshNames.length) {
    result.missing.push(...meshNames);
    return result;
  }
  for (const name of meshNames) {
    const object = root.getObjectByName(name);
    if (!object) { result.missing.push(name); continue; }
    if ((object as { isSkinnedMesh?: boolean }).isSkinnedMesh) { result.skippedSkinned.push(name); continue; }
    let ancestor: Object3D | null = object.parent;
    let already = false;
    while (ancestor) {
      if (ancestor === headBone) { already = true; break; }
      ancestor = ancestor.parent;
    }
    if (already) { result.alreadyAttached.push(name); continue; }
    headBone.attach(object);
    result.attached.push(name);
  }
  return result;
};
