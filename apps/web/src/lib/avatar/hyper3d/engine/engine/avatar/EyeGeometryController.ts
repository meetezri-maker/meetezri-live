import type { BufferAttribute, Mesh, Object3D } from "three";
import { Matrix4, Vector3 } from "three";

export interface EyeGeometryConfig {
  /** Mesh that contains the eyeball geometry. */
  meshName: string;
  /** Gaze limits in degrees, applied per eye. */
  maxYawDegrees: number;
  maxPitchDegrees: number;
  /**
   * Converts behaviour-layer gaze degrees into eyeball rotation degrees. The
   * behaviour layer is authored against morph-driven models; a true rotation
   * needs a larger angle to read as the same glance.
   */
  gazeScale: number;
}

export interface EyeGroupInfo {
  side: "left" | "right";
  vertexCount: number;
  pivot: [number, number, number];
  radiusMin: number;
  radiusMax: number;
}

export interface EyeGeometrySupport {
  meshName: string;
  found: boolean;
  totalVertices: number;
  groups: EyeGroupInfo[];
  reason?: string;
}

interface EyeGroup {
  side: "left" | "right";
  indices: number[];
  pivot: Vector3;
  radiusMin: number;
  radiusMax: number;
}

const DEG = Math.PI / 180;

/**
 * Rotates each eyeball's vertices around its own pivot.
 *
 * This model has no SkinnedMesh and no mesh parented under a bone, so the
 * FACIAL_L_Eye / FACIAL_R_Eye bones cannot move any geometry. Both eyeballs also
 * share one mesh, so there is no per-eye Object3D to rotate either. Rotating the
 * vertex group of each eye about its measured centre is therefore the only path
 * that produces true directional gaze on this asset.
 *
 * This controller is the single writer of the eyeball mesh's position attribute.
 * It does not touch morph influences, so `MorphTargetController` remains the only
 * morph writer and blink continues to work on top of the rotated base pose.
 */
export class EyeGeometryController {
  private mesh?: Mesh;
  private attribute?: BufferAttribute;
  private basePositions?: Float32Array;
  private groups: EyeGroup[] = [];
  private support: EyeGeometrySupport = { meshName: "", found: false, totalVertices: 0, groups: [] };
  private applied = { yaw: 0, pitch: 0 };

  discover(root: Object3D, config?: EyeGeometryConfig): EyeGeometrySupport {
    this.mesh = undefined;
    this.attribute = undefined;
    this.basePositions = undefined;
    this.groups = [];
    this.applied = { yaw: 0, pitch: 0 };
    if (!config) {
      this.support = { meshName: "", found: false, totalVertices: 0, groups: [], reason: "No eye geometry configured for this model." };
      return this.support;
    }

    let mesh: Mesh | undefined;
    root.traverse((object) => {
      const candidate = object as Mesh;
      if (!mesh && candidate.isMesh && candidate.name === config.meshName) mesh = candidate;
    });
    if (!mesh) {
      this.support = { meshName: config.meshName, found: false, totalVertices: 0, groups: [], reason: `Mesh ${config.meshName} was not found.` };
      return this.support;
    }

    const attribute = mesh.geometry?.getAttribute?.("position") as BufferAttribute | undefined;
    if (!attribute || typeof attribute.count !== "number" || attribute.count < 6) {
      this.support = {
        meshName: config.meshName,
        found: false,
        totalVertices: attribute?.count ?? 0,
        groups: [],
        reason: `Mesh ${config.meshName} has no usable position attribute.`
      };
      return this.support;
    }
    const count = attribute.count;
    // Split the mesh into the two eyeballs by which side of the mesh centre each
    // vertex sits on. Both eyes live in one mesh on this asset.
    let midX = 0;
    for (let i = 0; i < count; i += 1) midX += attribute.getX(i);
    midX /= count;

    const build = (side: "left" | "right"): EyeGroup => {
      const indices: number[] = [];
      const centre = new Vector3();
      for (let i = 0; i < count; i += 1) {
        const x = attribute.getX(i);
        const isLeft = x >= midX;
        if ((side === "left") !== isLeft) continue;
        indices.push(i);
        centre.add(new Vector3(x, attribute.getY(i), attribute.getZ(i)));
      }
      if (indices.length) centre.divideScalar(indices.length);
      let radiusMin = Infinity;
      let radiusMax = 0;
      const point = new Vector3();
      for (const index of indices) {
        point.set(attribute.getX(index), attribute.getY(index), attribute.getZ(index)).sub(centre);
        const radius = point.length();
        radiusMin = Math.min(radiusMin, radius);
        radiusMax = Math.max(radiusMax, radius);
      }
      return { side, indices, pivot: centre, radiusMin: Number.isFinite(radiusMin) ? radiusMin : 0, radiusMax };
    };

    const left = build("left");
    const right = build("right");
    // Both groups must exist, and both pivots must be finite. A degenerate mesh
    // would otherwise produce NaN pivots that only surface later inside useFrame.
    const finitePivot = (group: EyeGroup) =>
      Number.isFinite(group.pivot.x) && Number.isFinite(group.pivot.y) && Number.isFinite(group.pivot.z);
    if (!finitePivot(left) || !finitePivot(right) || !Number.isFinite(left.radiusMax) || !Number.isFinite(right.radiusMax)) {
      this.support = {
        meshName: config.meshName,
        found: false,
        totalVertices: count,
        groups: [],
        reason: `Mesh ${config.meshName} produced non-finite eye pivots.`
      };
      return this.support;
    }
    if (!left.indices.length || !right.indices.length) {
      this.support = {
        meshName: config.meshName,
        found: false,
        totalVertices: count,
        groups: [],
        reason: "Could not split the mesh into two eye vertex groups."
      };
      return this.support;
    }

    this.mesh = mesh;
    this.attribute = attribute;
    this.basePositions = Float32Array.from(attribute.array as ArrayLike<number>);
    this.groups = [left, right];
    this.support = {
      meshName: config.meshName,
      found: true,
      totalVertices: count,
      groups: this.groups.map((group) => ({
        side: group.side,
        vertexCount: group.indices.length,
        pivot: [group.pivot.x, group.pivot.y, group.pivot.z],
        radiusMin: group.radiusMin,
        radiusMax: group.radiusMax
      }))
    };
    return this.support;
  }

  isSupported() {
    return Boolean(this.mesh && this.basePositions && this.groups.length === 2);
  }

  getSupport() {
    return { ...this.support, groups: this.support.groups.map((group) => ({ ...group, pivot: [...group.pivot] as [number, number, number] })) };
  }

  /**
   * Applies a conjugate gaze. Both eyes receive the same rotation, so they stay
   * parallel and can never cross.
   *
   * @param yawDegrees positive looks toward +X, negative toward -X
   * @param pitchDegrees positive looks up
   */
  apply(yawDegrees: number, pitchDegrees: number, config: EyeGeometryConfig) {
    if (!this.isSupported()) return false;
    if (!Number.isFinite(yawDegrees) || !Number.isFinite(pitchDegrees)) return false;
    const attribute = this.attribute!;
    const base = this.basePositions!;
    const yaw = Math.max(-config.maxYawDegrees, Math.min(config.maxYawDegrees, yawDegrees)) * DEG;
    const pitch = Math.max(-config.maxPitchDegrees, Math.min(config.maxPitchDegrees, pitchDegrees)) * DEG;

    // Skip the rewrite when nothing changed, so a still avatar costs nothing.
    if (Math.abs(yaw - this.applied.yaw) < 1e-6 && Math.abs(pitch - this.applied.pitch) < 1e-6) return true;
    this.applied = { yaw, pitch };

    const array = attribute.array as Float32Array;
    const rotation = new Matrix4();
    const point = new Vector3();
    for (const group of this.groups) {
      // Yaw about the model's up axis, then pitch about the eye's own lateral axis.
      rotation.makeRotationY(yaw);
      const pitchMatrix = new Matrix4().makeRotationX(pitch);
      rotation.multiply(pitchMatrix);
      for (const index of group.indices) {
        const offset = index * 3;
        // Guards against a stale index if the mesh were ever swapped underneath us.
        if (offset + 2 >= base.length) continue;
        point.set(base[offset], base[offset + 1], base[offset + 2]).sub(group.pivot);
        point.applyMatrix4(rotation).add(group.pivot);
        array[offset] = point.x;
        array[offset + 1] = point.y;
        array[offset + 2] = point.z;
      }
    }
    attribute.needsUpdate = true;
    return true;
  }

  /** Restores the authored eyeball positions. */
  reset() {
    if (!this.attribute || !this.basePositions) return;
    (this.attribute.array as Float32Array).set(this.basePositions);
    this.attribute.needsUpdate = true;
    this.applied = { yaw: 0, pitch: 0 };
  }

  appliedDegrees() {
    return { yawDegrees: this.applied.yaw / DEG, pitchDegrees: this.applied.pitch / DEG };
  }
}
