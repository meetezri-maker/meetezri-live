import type { Bone, Object3D } from "three";
import { Quaternion, Vector3 } from "three";
import {
  femaleHybridJawProfile,
  resolveHybridJawDrive,
  type FemaleHybridJawProfile,
  type HybridJawDrive,
  type HybridJawMode
} from "../../mappings/femaleHybridJawProfile";

export interface HybridJawSupport {
  /** Every bone the profile asks for, and whether it was found. */
  bones: { name: string; found: boolean }[];
  /** True only when EVERY paired bone resolved. */
  supported: boolean;
  /** Measured distance between the paired pivots, in metres. Should be ~0. */
  pivotSeparation: number;
  /** Measured angle between the paired rest orientations, in degrees. Should be ~0. */
  pivotOrientationDegrees: number;
  limitations: string[];
}

export interface HybridJawFrame extends HybridJawDrive {
  /** False when the controller passed the demand straight through. */
  active: boolean;
  mode: HybridJawMode;
  /** What each bone actually received. These must always be equal. */
  applied: { name: string; degrees: number }[];
  /** The demand that arrived, before the split. */
  demand: number;
}

const axisVector = (axis: "x" | "y" | "z") =>
  new Vector3(axis === "x" ? 1 : 0, axis === "y" ? 1 : 0, axis === "z" ? 1 : 0);

const findBone = (root: Object3D, name: string) => {
  let found: Bone | undefined;
  root.traverse((object) => {
    if (!found && object.type === "Bone" && object.name === name) found = object as Bone;
  });
  return found;
};

interface CachedJawBone {
  bone: Bone;
  restQuaternion: Quaternion;
}

/**
 * Hybrid jaw prototype — one logical jaw, two bones, disabled by default.
 *
 * Reads the rendered `jawOpen` demand a frame is about to write to the morph,
 * and optionally moves some or all of it onto a paired bone rotation. In
 * `"morph-only"` mode — the default, and the only mode production ever
 * selects — it resets both bones to rest and hands the demand back unchanged,
 * so the rendered result is byte-identical to not having this controller at all.
 *
 * Two invariants this class exists to enforce:
 *
 *  1. **Both bones or neither.** `FACIAL_C_Jaw` carries the chin and jawline
 *     skin; `FACIAL_C_LowerLipRotation` carries the lower lip, lower teeth and
 *     tongue. Driving one alone was measured as strictly worse than the morph:
 *     zero added aperture, doubled chin travel, teeth left behind. If either
 *     bone is missing, this controller refuses to drive and degrades to
 *     morph-only rather than rendering half a jaw.
 *  2. **One angle, applied identically.** There is no per-bone offset and no
 *     way to ask for one. The two bones share a pivot to within 0.0 mm, so a
 *     common angle is a rigid rotation; any offset would shear the jaw apart.
 *
 * It holds no timing state. The split is a pure function of the demand, so the
 * bone and the corrective morph cannot drift out of phase with each other or
 * with the coarticulation layer that produced the demand.
 */
export class HybridJawController {
  private cached: CachedJawBone[] = [];
  private profile: FemaleHybridJawProfile = femaleHybridJawProfile;
  private support: HybridJawSupport = {
    bones: [],
    supported: false,
    pivotSeparation: 0,
    pivotOrientationDegrees: 0,
    limitations: ["Not discovered yet."]
  };
  private lastFrame?: HybridJawFrame;

  discover(root: Object3D, enabled: boolean, profile: FemaleHybridJawProfile = femaleHybridJawProfile) {
    this.profile = profile;
    this.cached = [];
    this.lastFrame = undefined;
    const limitations: string[] = [];
    if (!enabled) {
      this.support = {
        bones: profile.pairedBoneNames.map((name) => ({ name, found: false })),
        supported: false,
        pivotSeparation: 0,
        pivotOrientationDegrees: 0,
        limitations: ["Hybrid jaw is not enabled for this model."]
      };
      return this.support;
    }
    const found = profile.pairedBoneNames.map((name) => ({ name, bone: findBone(root, name) }));
    for (const entry of found) {
      if (!entry.bone) limitations.push(`Paired jaw bone ${entry.name} was not found.`);
    }
    const allFound = found.every((entry) => entry.bone);
    if (allFound) {
      this.cached = found.map((entry) => ({
        bone: entry.bone as Bone,
        restQuaternion: (entry.bone as Bone).quaternion.clone()
      }));
    } else {
      // Deliberately no partial drive. Half a jaw is worse than none.
      limitations.push("Hybrid jaw disabled: it drives both paired bones or neither.");
    }

    let pivotSeparation = 0;
    let pivotOrientationDegrees = 0;
    if (allFound && found.length === 2) {
      const [a, b] = found.map((entry) => entry.bone as Bone);
      a.updateMatrixWorld(true);
      b.updateMatrixWorld(true);
      const pa = new Vector3().setFromMatrixPosition(a.matrixWorld);
      const pb = new Vector3().setFromMatrixPosition(b.matrixWorld);
      pivotSeparation = pa.distanceTo(pb);
      const qa = a.getWorldQuaternion(new Quaternion());
      const qb = b.getWorldQuaternion(new Quaternion());
      pivotOrientationDegrees = (2 * Math.acos(Math.min(1, Math.abs(qa.dot(qb))))* 180) / Math.PI;
    }

    this.support = {
      bones: found.map((entry) => ({ name: entry.name, found: Boolean(entry.bone) })),
      supported: allFound,
      pivotSeparation,
      pivotOrientationDegrees,
      limitations
    };
    return this.support;
  }

  isSupported() {
    return this.support.supported;
  }

  getSupport(): HybridJawSupport {
    return { ...this.support, bones: this.support.bones.map((b) => ({ ...b })), limitations: [...this.support.limitations] };
  }

  getLastFrame() {
    return this.lastFrame;
  }

  /**
   * Splits the frame's jaw demand and poses the bones.
   *
   * @param demand The `jawOpen` influence this frame would otherwise write.
   * @returns The `jawOpen` influence that should be written instead.
   */
  apply(demand: number, mode: HybridJawMode, profile?: FemaleHybridJawProfile): HybridJawFrame {
    const active = mode !== "morph-only" && this.isSupported();
    const drive = resolveHybridJawDrive(demand, active ? mode : "morph-only", profile ?? this.profile);
    const axis = axisVector((profile ?? this.profile).openingAxis);
    const radians = (drive.degrees * Math.PI) / 180;
    for (const entry of this.cached) {
      entry.bone.quaternion.copy(entry.restQuaternion);
      if (active && radians !== 0) {
        entry.bone.quaternion.multiply(new Quaternion().setFromAxisAngle(axis, radians)).normalize();
      }
    }
    this.lastFrame = {
      ...drive,
      degrees: active ? drive.degrees : 0,
      active,
      mode,
      demand,
      applied: this.cached.map((entry) => ({
        name: entry.bone.name,
        degrees: active ? drive.degrees : 0
      }))
    };
    return this.lastFrame;
  }

  reset() {
    for (const entry of this.cached) entry.bone.quaternion.copy(entry.restQuaternion);
    this.lastFrame = undefined;
  }
}
