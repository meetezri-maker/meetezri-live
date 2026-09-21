import { Euler, Quaternion, type Bone, type Object3D } from "three";
import { hyper3dGazeCalibration } from "../../mappings/avatars/hyper3dCalibration";
import type { Hyper3dEyeRestCorrection, Hyper3dRigBinding } from "./hyper3dRigAdapter";
import type { BlendshapePose } from "../../types/facialAnimation";

/**
 * ASSET ADAPTER for gaze. It decides NOTHING about where the avatar looks.
 *
 * THE PROBLEM, MEASURED. On the Hyper3D FBX the eyeballs are material groups of
 * the same mesh as the face, so `eyeLookIn/Out/Up/Down` rotate the eyeballs
 * themselves — `eyeLookOutLeft` moves 5.25 mm at influence 1.0, which is an eye
 * turning in its socket. On `female_229.glb` the face (`blendshapes`) and the
 * eyeballs (`Eyes`) are SEPARATE meshes and only the face carries the morph
 * targets, so the same influence moves lid and socket skin — 1.20-1.93 mm — and
 * the eyeball itself does not turn at all. The pupils would never move.
 *
 * THE FIX, AND ITS LIMITS. This reads the eyeLook influences the accepted
 * pipeline ALREADY RESOLVED and converts them back to degrees with
 * `hyper3dGazeCalibration`'s own measured constants — the same
 * `degreesPerUnitHorizontal` / `degreesPerUnitVertical` that
 * `hyper3dGazePose` used to produce them — then rotates the two eye bones by
 * that angle. It is the inverse of a conversion that already happened, so:
 *
 *   - no gaze value changes: not `gazeScale`, not `maxYawDegrees`, not the
 *     asymmetric `maxPitchDownDegrees`, not `cap`, not the amplitude, not the
 *     timing. Every rail is applied upstream, before this ever sees a pose.
 *   - the morphs keep rendering too. The lid and socket skin still move exactly
 *     as they did; this only adds back the eyeball rotation the FBX got for free.
 *   - it produces nothing of its own. An empty pose leaves the eyes at rest.
 *
 * WHY NOT `EyeGeometryController`: that is Female.228's gaze system and carries
 * Female.228's `gazeScale` (4.01) and rails. Pointing it at this asset would
 * replace the accepted Hyper3D gaze values with another model's.
 *
 * ---------------------------------------------------------------------------
 * MEASURED RIG FACTS behind the axis mapping.
 *
 *   `Eyes` skin weights: FACIAL_L_EyeParallel 1.0000 over 386 vertices,
 *   FACIAL_R_EyeParallel 1.0000 over 386, plus a 97-vertex pupil ring on each
 *   FACIAL_*_Pupil, which is a CHILD of its EyeParallel and so follows it.
 *
 *   Bone origin vs eyeball centre (world metres, pre-normalisation):
 *     left   bone (0.02524, 1.36764, 0.08836)  box centre (0.02531, 1.36763, 0.08883)
 *     right  bone (-0.02536, 1.36775, 0.08863) box centre (-0.02529, 1.36775, 0.08904)
 *   i.e. the bones sit on the eyeball centres to within 0.5 mm, so rotating them
 *   spins each eyeball about its own pivot and cannot translate it out of the lid.
 *
 *   Bone-local axes at rest, in world terms:
 *     FACIAL_L_EyeParallel  +X -> (-1, 0, 0)   +Y -> (0, 0, 1)   +Z -> (0, 1, 0)
 *     FACIAL_R_EyeParallel  +X -> (-1, 0, 0)   +Y -> (0, 0, 1)   +Z -> (0, 1, 0)
 *
 *   The character faces world +Z and its LEFT is world +X (`clavicle_l` at
 *   x=+0.0079, `FACIAL_L_EyeParallel` at x=+0.0253). So:
 *     yaw toward the character's left  = rotation about world +Y = local +Z
 *     pitch upward                     = rotation about world -X = local +X
 *   Both eyes receive the identical rotation, so gaze stays parallel and
 *   convergence cannot occur.
 */

const DEG = Math.PI / 180;

export interface Hyper3dEyeBoneGazeSupport {
  found: boolean;
  leftBone: string | null;
  rightBone: string | null;
  /** Whether the measured neutral correction is in the rest pose. */
  restMode: "raw" | "centered";
  reason?: string;
}

/** Degrees recovered from the resolved pose. Reporting only; nothing reads it back. */
export interface Hyper3dEyeBoneGazeState {
  yawDegrees: number;
  pitchDegrees: number;
}

/**
 * Inverse of `hyper3dGazePose`, channel for channel.
 *
 * `hyper3dGazePose` writes `eyeLookOutLeft` + `eyeLookInRight` for a gaze to the
 * character's LEFT and `eyeLookInLeft` + `eyeLookOutRight` for a gaze to the
 * RIGHT, each at `|yaw| / degreesPerUnitHorizontal`; vertical is the pair
 * `eyeLookUp*` or `eyeLookDown*` at `|pitch| / degreesPerUnitVertical`.
 *
 * The pair is averaged rather than read from one side, because downstream layers
 * (blink, affect, Active Presence) may max-merge a value onto one channel; the
 * mean is the gaze both eyes agree on.
 */
export const hyper3dEyeGazeDegreesFromPose = (pose: BlendshapePose): Hyper3dEyeBoneGazeState => {
  const c = hyper3dGazeCalibration;
  const read = (name: string) => {
    const value = pose[name];
    return Number.isFinite(value) && (value as number) > 0 ? (value as number) : 0;
  };
  const left = (read("eyeLookOutLeft") + read("eyeLookInRight")) / 2;
  const right = (read("eyeLookInLeft") + read("eyeLookOutRight")) / 2;
  const up = (read("eyeLookUpLeft") + read("eyeLookUpRight")) / 2;
  const down = (read("eyeLookDownLeft") + read("eyeLookDownRight")) / 2;
  return {
    yawDegrees: (left - right) * c.degreesPerUnitHorizontal,
    pitchDegrees: (up - down) * c.degreesPerUnitVertical
  };
};

export class Hyper3dEyeBoneGaze {
  /**
   * `rest` is the bone's authored rest pose with the NEUTRAL CORRECTION already
   * composed in — `rest * correction` — so the gaze rotation below is applied to
   * a corrected rest and nothing about the gaze itself changes. See
   * `HYPER3D_GLB_EYE_REST_CORRECTION` for the measurement, and `restMode` for
   * the DEV switch that leaves it out.
   */
  private left?: { bone: Bone; rest: Quaternion };
  private right?: { bone: Bone; rest: Quaternion };
  private restMode: "raw" | "centered" = "raw";
  /**
   * FALLBACK ONLY, for an asset that supplies no measured authored constant.
   *
   * MODULE-LEVEL, not per instance: `useLoader` caches the parsed asset, so the
   * same `Bone` objects come back on a remount while `useMemo` builds a NEW
   * controller. An instance-level cache is therefore empty exactly when the bone
   * is already carrying a correction, which is the compounding this exists to
   * prevent. See `HYPER3D_GLB_EYE_REST_CORRECTION.authored`.
   */
  private static readonly seenAuthoredRest = new WeakMap<Bone, Quaternion>();
  private support: Hyper3dEyeBoneGazeSupport = { found: false, leftBone: null, rightBone: null, restMode: "raw", reason: "not discovered" };
  private state: Hyper3dEyeBoneGazeState = { yawDegrees: 0, pitchDegrees: 0 };

  /**
   * Pass `undefined` for `rig` to disable; the controller then does nothing at all.
   *
   * `restCorrection` is the per-eye neutral fix. Omitting it, or passing
   * `restMode: "raw"`, reproduces the asset's authored rest exactly — which is
   * what the DEV `EYE REST: RAW GLB` review mode does.
   */
  discover(
    root: Object3D,
    rig?: Pick<Hyper3dRigBinding, "leftEye" | "rightEye">,
    restCorrection?: Hyper3dEyeRestCorrection,
    restMode: "raw" | "centered" = "centered"
  ): Hyper3dEyeBoneGazeSupport {
    this.left = undefined;
    this.right = undefined;
    this.restMode = restCorrection && restMode === "centered" ? "centered" : "raw";
    this.state = { yawDegrees: 0, pitchDegrees: 0 };
    if (!rig || !rig.leftEye.length || !rig.rightEye.length) {
      this.support = { found: false, leftBone: null, rightBone: null, restMode: "raw", reason: "no eye bones configured for this asset" };
      return this.support;
    }
    const find = (names: readonly string[]) => {
      let found: Bone | undefined;
      root.traverse((object) => {
        if (!found && object.type === "Bone" && names.includes(object.name)) found = object as Bone;
      });
      return found;
    };
    const leftBone = find(rig.leftEye);
    const rightBone = find(rig.rightEye);
    /**
     * `authored * correction`, so the correction is a PRE-rotation: the gaze
     * additive is multiplied on after it and its magnitude is untouched.
     *
     * Read off the bone each time `discover` runs rather than cached, so the
     * DEV rest-mode switch cannot compound — `discover` always starts from the
     * asset's own quaternion, which no other writer touches.
     */
    const corrected = (
      bone: Bone | undefined,
      q?: readonly [number, number, number, number],
      authoredConstant?: readonly [number, number, number, number]
    ) => {
      if (!bone) return undefined;
      /**
       * The authored neutral comes from the MEASURED CONSTANT when the asset has
       * one, so it is identical on every mount and cannot drift into whatever
       * this controller last wrote. Only an asset without one falls back to
       * first-sight capture, and that cache is module-level for the same reason.
       */
      let authored: Quaternion;
      if (authoredConstant) {
        authored = new Quaternion(authoredConstant[0], authoredConstant[1], authoredConstant[2], authoredConstant[3]);
      } else {
        let seen = Hyper3dEyeBoneGaze.seenAuthoredRest.get(bone);
        if (!seen) {
          seen = bone.quaternion.clone();
          Hyper3dEyeBoneGaze.seenAuthoredRest.set(bone, seen);
        }
        authored = seen.clone();
      }
      const rest = authored.clone();
      if (this.restMode === "centered" && q) rest.multiply(new Quaternion(q[0], q[1], q[2], q[3])).normalize();
      return { bone, rest };
    };
    this.left = corrected(leftBone, restCorrection?.left, restCorrection?.authored.left);
    this.right = corrected(rightBone, restCorrection?.right, restCorrection?.authored.right);
    // The corrected rest IS the rest, so a zero pose must land on it.
    this.write(this.state);
    this.support = {
      found: Boolean(this.left && this.right),
      leftBone: leftBone?.name ?? null,
      rightBone: rightBone?.name ?? null,
      restMode: this.restMode,
      reason: this.left && this.right ? undefined : "one or both eye bones were not found"
    };
    return this.support;
  }

  getSupport() {
    return { ...this.support };
  }

  getState() {
    return { ...this.state };
  }

  /** Writes the eyeball rotation implied by a pose that has ALREADY been resolved. */
  apply(pose: BlendshapePose) {
    if (!this.left || !this.right) return false;
    this.state = hyper3dEyeGazeDegreesFromPose(pose);
    this.write(this.state);
    return true;
  }

  /**
   * DIAGNOSTIC ONLY. Commands the eyes in degrees directly, bypassing the pose.
   *
   * It exists so the rig can be probed at exact angles — the neutral-centre
   * test, the per-axis +/-1 degree test and the safe-range sweep all need a
   * known command rather than whatever the behaviour layers happen to produce.
   * Nothing in the render path calls it; `AvatarModel` reaches it only through a
   * DEV-gated store value that ships disabled.
   */
  applyDegrees(yawDegrees: number, pitchDegrees: number) {
    if (!this.left || !this.right) return false;
    this.state = { yawDegrees, pitchDegrees };
    this.write(this.state);
    return true;
  }

  reset() {
    this.state = { yawDegrees: 0, pitchDegrees: 0 };
    this.write(this.state);
  }

  private write({ yawDegrees, pitchDegrees }: Hyper3dEyeBoneGazeState) {
    // local +X is world -X and local +Z is world +Y, so pitch-up is +X and a
    // yaw toward the character's left is +Z. See the header measurement.
    const additive = new Quaternion().setFromEuler(new Euler(pitchDegrees * DEG, 0, yawDegrees * DEG, "XYZ"));
    for (const eye of [this.left, this.right]) {
      if (!eye) continue;
      eye.bone.quaternion.copy(eye.rest).multiply(additive).normalize();
    }
  }
}
