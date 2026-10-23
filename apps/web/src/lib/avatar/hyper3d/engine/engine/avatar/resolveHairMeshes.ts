import type { Mesh, Object3D } from "three";

/**
 * WHICH MESHES ARE THIS ASSET'S HAIR — RESOLVED BY STRUCTURE, NOT BY FILENAME.
 *
 * THE DEFECT THIS EXISTS TO END. Every Hyper3D export so far parents the hair
 * under a node named `Hair`, and every export names the MESH underneath it
 * differently depending on which Blender datablock suffix the exporter happened
 * to assign. `afr.glb` shipped `Character.002`; the 16 Oct `arfv2.glb` shipped
 * `Character.001`; the 19 Oct `arfv2.glb` shipped `Character.002` again. three.js
 * strips the dot, so the configured names flip between `Character002*` and
 * `Character001*` with no change of meaning and no change to the character.
 *
 * Each flip broke the avatar outright, because the hair name is read in two
 * places that both matter: the `material-setup` validation gate (hair missing =
 * init throws = the member is dropped onto a different-looking avatar) and
 * `headAttachedMeshes` (hair not reparented = the head turns inside a
 * stationary wig). Twice now the fix has been to retype the same two arrays.
 *
 * THE NODE NAME IS THE STABLE THING. Measured across every asset shipped today:
 *
 *   female_2291.glb  node `Hair` -> 2 primitives -> Character002, Character002_1
 *   female_229.glb   node `Hair` -> 2 primitives -> Character002, Character002_1
 *   sara.glb         node `Hair` -> 2 primitives -> Character002, Character002_1
 *   arfv2.glb        node `Hair` -> 2 primitives -> Character002, Character002_1
 *   perm.glb         NO `Hair` node; hair is the single mesh `Object_7`
 *   jordan.glb       NO `Hair` node and no hair mesh — scalp is in the head texture
 *
 * So the node resolves four of the six, and the other two keep working through
 * the configured names exactly as before. This is deliberately ADDITIVE: the
 * configured list is still consulted, still reported, and still the answer
 * whenever the node is absent. Nothing that resolves today stops resolving.
 *
 * IT IS NOT A WAY TO SKIP THE GATE. An asset that declares hair and delivers
 * none still returns an empty list and still fails `material-setup`, which is
 * the check that stops a half-bound avatar reaching a member.
 */

/** The node name every Hyper3D export has used for the hair group. */
export const HYPER3D_HAIR_NODE_NAMES = ["Hair"] as const;

export interface Hyper3dHairResolution {
  /** Mesh object names to validate, attach and report. Empty means no hair found. */
  meshNames: string[];
  /** Where the answer came from, for diagnostics. */
  source: "hair-node" | "configured-names" | "none";
  /** The node the meshes were found under, when that is how they were found. */
  hairNodeName: string | null;
  /** Configured names that DO resolve in this scene. */
  configuredResolved: string[];
  /**
   * Configured names that do NOT resolve — the stale spellings. The caller
   * drops these from the head-attachment list so a rename leaves no phantom.
   */
  configuredMissing: string[];
}

const EMPTY: Hyper3dHairResolution = {
  meshNames: [],
  source: "none",
  hairNodeName: null,
  configuredResolved: [],
  configuredMissing: [],
};

const isMesh = (object: Object3D): object is Mesh =>
  (object as { isMesh?: boolean }).isMesh === true;

const findMeshNamed = (root: Object3D, name: string): Mesh | null => {
  let found: Mesh | null = null;
  root.traverse((object) => {
    if (found) return;
    if (isMesh(object) && object.name === name) found = object;
  });
  return found;
};

const findHairNode = (root: Object3D, nodeNames: readonly string[]): Object3D | null => {
  for (const name of nodeNames) {
    const direct = root.getObjectByName(name);
    if (direct) return direct;
  }
  // Second pass, case-insensitive: an exporter that writes `hair` rather than
  // `Hair` is the same node, and guessing wrong here costs an avatar.
  const wanted = nodeNames.map((n) => n.toLowerCase());
  let found: Object3D | null = null;
  root.traverse((object) => {
    if (found) return;
    if (object.name && wanted.includes(object.name.toLowerCase())) found = object;
  });
  return found;
};

/**
 * Hair meshes for this scene.
 *
 * Skinned meshes are INCLUDED in the result. Skinned hair is still this asset's
 * hair for validation and reporting, and `attachHeadMeshes` already refuses to
 * reparent anything skinned — reparenting one would apply the head transform on
 * top of the skeleton's. Keeping that single refusal in one place is what stops
 * the two passes disagreeing about what is safe to move.
 */
export function resolveHyper3dHairMeshes(
  root: Object3D,
  configuredNames: readonly string[],
  nodeNames: readonly string[] = HYPER3D_HAIR_NODE_NAMES,
): Hyper3dHairResolution {
  const configuredResolved: string[] = [];
  const configuredMissing: string[] = [];
  for (const name of configuredNames) {
    if (findMeshNamed(root, name)) configuredResolved.push(name);
    else configuredMissing.push(name);
  }

  const hairNode = findHairNode(root, nodeNames);
  const fromNode: string[] = [];
  if (hairNode) {
    // The node itself is the mesh when the hair exported as one primitive;
    // it is a Group with one child per primitive when it exported as several.
    if (isMesh(hairNode) && hairNode.name) fromNode.push(hairNode.name);
    hairNode.traverse((object) => {
      if (object === hairNode) return;
      if (isMesh(object) && object.name) fromNode.push(object.name);
    });
  }

  if (fromNode.length) {
    // Union, node first: a configured mesh that lives outside the node is still
    // this asset's hair and must keep being attached.
    const meshNames = [...new Set([...fromNode, ...configuredResolved])];
    return {
      meshNames,
      source: "hair-node",
      hairNodeName: hairNode?.name ?? null,
      configuredResolved,
      configuredMissing,
    };
  }

  if (configuredResolved.length) {
    return {
      meshNames: [...configuredResolved],
      source: "configured-names",
      hairNodeName: null,
      configuredResolved,
      configuredMissing,
    };
  }

  return { ...EMPTY, configuredMissing: [...configuredMissing] };
}
